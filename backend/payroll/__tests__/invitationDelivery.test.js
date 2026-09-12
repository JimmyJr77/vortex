import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
test('payroll invitations record SMTP acceptance only and retain usable links after suppression',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 let result,calls=0
 const h=await createHarness({invitationSender:async options=>{calls++;assert.equal(options.category,'payroll_employee_invitation');assert.equal(options.to,'delivery@example.test');if(result instanceof Error)throw result;return result}});t.after(()=>h.close())
 const post=async(path,body,facility=1)=>fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':String(facility)},body:JSON.stringify(body)})
 const created=await post('/employees',{legalFirstName:'Delivery',legalLastName:'Test',hireDate:'2026-09-01',hourlyRateCents:2500});assert.equal(created.status,201);const employee=(await created.json()).data
 const states=[{sent:false,skipped:true,reason:'category_disabled'},{sent:false,suppressed:true,reason:'hard_bounce'},undefined,new Error('Synthetic delivery failure'),{sent:true,messageId:'synthetic-message'}]
 for(result of states){
  const response=await post(`/employees/${employee.id}/invitations`,{email:'delivery@example.test',sendEmail:true});assert.equal(response.status,201);const invitation=(await response.json()).data
  assert.equal(invitation.emailed,result?.sent===true)
  const saved=(await h.pool.query('SELECT sent_at FROM payroll_employee_invitation WHERE id=$1',[invitation.id])).rows[0]
  assert.equal(Boolean(saved.sent_at),invitation.emailed)
  assert.equal(Boolean(invitation.emailWarning),!invitation.emailed)
  const audit=(await h.pool.query("SELECT after_data FROM payroll_audit_log WHERE entity_type='employee_invitation' AND entity_id=$1 ORDER BY id DESC LIMIT 1",[String(invitation.id)])).rows[0]
  assert.equal(audit.after_data.emailed,invitation.emailed)
  if(!invitation.emailed){const redeemed=await fetch(`${h.url}/api/payroll/employee/invitations/redeem`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:new URL(invitation.inviteUrl).searchParams.get('invite')})});assert.equal(redeemed.status,200)}
 }
 assert.equal(calls,5)
 const manual=await post(`/employees/${employee.id}/invitations`,{email:'delivery@example.test',sendEmail:false});assert.equal(manual.status,201);assert.equal((await manual.json()).data.emailed,false);assert.equal(calls,5)
 assert.equal((await post(`/employees/${employee.id}/invitations`,{email:'delivery@example.test',sendEmail:true},2)).status,404);assert.equal(calls,5)
})
