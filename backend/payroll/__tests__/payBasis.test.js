import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
for(const initial of ['HOURLY','SALARY'])test(`onboarding offer changes from ${initial}, retains terms and reopens reviews`,{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200,facility=1)=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':String(facility)},body:JSON.stringify(body)});const j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j.data}
 const e=await api('/employees',{employeeNumber:`OFFER-${initial}`,legalFirstName:'Changed',legalLastName:'Offer',hireDate:'2099-09-07',hourlyRateCents:2500,...(initial==='SALARY'?{payType:'SALARY',annualSalaryCents:5200000}:{})},201)
 const salaryReview={classification:'NONEXEMPT',fixed40Verified:true,minimumWageVerified:true,minimumWageCents:1500,confirmed:true,source:'Synthetic reviewed fixed salary agreement'}
 if(initial==='SALARY')await api(`/employees/${e.id}/salary-review`,salaryReview)
 await h.pool.query("UPDATE payroll_onboarding_task SET status='COMPLETE',response='{\"acknowledged\":true}',completed_at=now() WHERE employee_id=$1 AND task_key IN ('PAY_REVIEW','WAGE_NOTICE')",[e.id])
 const path=`/employees/${e.id}/pay-basis`,body={requestId:`offer-change-${initial}`,employmentStart:'2099-09-07',fromPayType:initial,payType:initial==='SALARY'?'HOURLY':'SALARY',hourlyRateCents:3000,annualSalaryCents:6240000,salaryReview,reason:'Synthetic renegotiated hiring offer terms',confirmed:true}
 await api(path,{...body,employmentStart:'2099-09-06'},409)
 await api(path,body,404,2)
 const entry=(await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,'2099-09-07T13:00Z','2099-09-07T14:00Z','ADMIN','UNVERIFIED') RETURNING id",[e.id])).rows[0]
 await api(path,body,409)
 await h.pool.query("UPDATE payroll_time_entry SET status='REJECTED' WHERE id=$1",[entry.id])
 await h.pool.query("CREATE FUNCTION reject_basis_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='PAY_BASIS_CHANGED' THEN RAISE EXCEPTION 'Synthetic pay basis audit failure'; END IF; RETURN NEW; END $$")
 await h.pool.query('CREATE TRIGGER reject_basis_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_basis_audit()')
 await api(path,body,500)
 assert.equal((await h.pool.query('SELECT pay_type FROM payroll_employee WHERE id=$1',[e.id])).rows[0].pay_type,initial)
 assert.equal((await h.pool.query("SELECT COUNT(*)::int n FROM payroll_onboarding_task WHERE employee_id=$1 AND task_key IN ('PAY_REVIEW','WAGE_NOTICE') AND status='COMPLETE'",[e.id])).rows[0].n,2)
 await h.pool.query('DROP TRIGGER reject_basis_audit ON payroll_audit_log')
 await api(path,body,201);await api(path,body)
 await api(path,{...body,reason:'Different terms using the same request reference'},409)
 const row=(await h.pool.query('SELECT * FROM payroll_employee WHERE id=$1',[e.id])).rows[0]
 assert.equal(row.pay_type,body.payType)
 assert.equal((await h.pool.query('SELECT pay_type FROM payroll_employment_period WHERE employee_id=$1',[e.id])).rows[0].pay_type,body.payType)
 const tasks=(await h.pool.query("SELECT status,response FROM payroll_onboarding_task WHERE employee_id=$1 AND task_key IN ('PAY_REVIEW','WAGE_NOTICE')",[e.id])).rows
 assert.ok(tasks.every(t=>t.status==='OPEN'&&Object.keys(t.response).length===0))
 if(initial==='SALARY')assert.equal((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_salary_change WHERE employee_id=$1 AND cancelled_at IS NOT NULL',[e.id])).rows[0].n,1)
 else{
  assert.equal((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_pay_rate WHERE employee_id=$1 AND cancelled_at IS NOT NULL',[e.id])).rows[0].n,1)
  await api(`/employees/${e.id}/salary-review`,{...salaryReview,employmentStart:'2099-09-07',annualSalaryCents:6500000})
  assert.equal(Number((await h.pool.query('SELECT annual_salary_cents FROM payroll_employee WHERE id=$1',[e.id])).rows[0].annual_salary_cents),6500000)
 }
 assert.equal((await h.pool.query("SELECT COUNT(*)::int n FROM payroll_audit_log WHERE action='PAY_BASIS_CHANGED' AND entity_id=$1",[String(e.id)])).rows[0].n,1)
})
