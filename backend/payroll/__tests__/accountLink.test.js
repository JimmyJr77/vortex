import test from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import {createHarness} from '../testing/harness.js'
import {hashPayrollToken} from '../employeeAuth.js'

test('existing account linking requires both identities and remains employee/workplace scoped', {
  skip:!process.env.PAYROLL_TEST_DATABASE_URL, timeout:60000,
}, async t=>{
  const h=await createHarness();t.after(()=>h.close())
  await h.pool.query(`CREATE TABLE app_user(id BIGINT PRIMARY KEY,facility_id BIGINT,email TEXT,is_active BOOLEAN);
    INSERT INTO app_user VALUES(101,1,'existing@example.test',true),(102,1,'relative@example.test',true),(201,2,'other@example.test',true)`)
  const employees=(await h.pool.query(`INSERT INTO payroll_employee(facility_id,employee_number,legal_first_name,legal_last_name,job_title,employment_status,hourly_rate_cents,hire_date,work_state,residence_state,personal_email)
    VALUES(1,'LINK-A','Synthetic','Hire','Coach','ONBOARDING',2500,CURRENT_DATE,'MD','MD','hire@example.test'),
    (1,'LINK-B','Other','Hire','Coach','ONBOARDING',2500,CURRENT_DATE,'MD','MD','second@example.test') RETURNING id`)).rows
  for(let i=0;i<2;i++)await h.pool.query(`INSERT INTO payroll_employee_session(facility_id,employee_id,token_hash,expires_at) VALUES(1,$1,$2,now()+interval '1 hour')`,[employees[i].id,hashPayrollToken(`synthetic-payroll-${i}`)])
  const token=(id,email,options={})=>jwt.sign({userId:id,email},'synthetic-account-link-test-secret',{expiresIn:'1h',...options})
  const account=token(101,'existing@example.test'),relative=token(102,'relative@example.test'),foreign=token(201,'other@example.test')
  async function post(path,body,employeeToken){
    const response=await fetch(h.url+'/api/payroll/employee/'+path,{method:'POST',headers:{'Content-Type':'application/json',...(employeeToken?{Authorization:`Bearer ${employeeToken}`}:{})},body:JSON.stringify(body)})
    return {status:response.status,body:await response.json()}
  }
  assert.equal((await post('account-link',{accountToken:account,confirmed:true})).status,401)
  assert.equal((await post('account-link',{accountToken:'invalid',confirmed:true},'synthetic-payroll-0')).status,401)
  assert.equal((await post('account-link',{accountToken:account},'synthetic-payroll-0')).status,400)
  assert.equal((await post('account-link',{accountToken:foreign,confirmed:true},'synthetic-payroll-0')).status,403)
  assert.equal((await post('account-session',{accountToken:account,facilityId:1})).status,403,'Same email or existing account alone grants no payroll access')
  const linked=await post('account-link',{accountToken:account,confirmed:true},'synthetic-payroll-0')
  assert.equal(linked.status,200);assert.equal(linked.body.data.email,'existing@example.test')
  assert.equal((await post('account-link',{accountToken:account,confirmed:true},'synthetic-payroll-0')).status,200)
  assert.equal((await post('account-link',{accountToken:relative,confirmed:true},'synthetic-payroll-0')).status,409)
  assert.equal((await post('account-link',{accountToken:account,confirmed:true},'synthetic-payroll-1')).status,409)
  assert.equal((await post('account-session',{accountToken:relative,facilityId:1})).status,403)
  assert.equal((await post('account-session',{accountToken:account,facilityId:2})).status,403)
  const signedIn=await post('account-session',{accountToken:account,facilityId:1})
  assert.equal(signedIn.status,200);assert.equal(signedIn.body.data.employee.id,Number(employees[0].id))
  const profile=await fetch(h.url+'/api/payroll/employee/me',{headers:{Authorization:`Bearer ${signedIn.body.data.sessionToken}`}})
  assert.equal(profile.status,200);assert.equal((await profile.json()).data.employee.id,Number(employees[0].id))
  await h.pool.query('UPDATE app_user SET is_active=false WHERE id=101')
  assert.equal((await post('account-session',{accountToken:account,facilityId:1})).status,401)
  assert.equal((await h.pool.query("SELECT count(*)::int AS n FROM payroll_audit_log WHERE action='EMPLOYEE_ACCOUNT_LINKED'")).rows[0].n,1)
})
