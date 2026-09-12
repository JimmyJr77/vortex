import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
test('salaried hires retain annual compensation, require classification review and can update ordinary profile fields',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close());let token
 const api=async(path,body,{status=200,method,employee=false}={})=>{const response=await fetch(`${h.url}/api/${employee?'payroll/employee':'admin/payroll'}${path}`,{method:method||(body?'POST':'GET'),headers:{Authorization:`Bearer ${employee?token:'payroll-test-admin'}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const json=await response.json();assert.equal(response.status,status,JSON.stringify(json));return json.data}
 const body={employeeNumber:'SALARY-HIRE',legalFirstName:'Salary',legalLastName:'Fixture',hireDate:'2026-01-01',payType:'SALARY',annualSalaryCents:7800000,personalEmail:'salary@example.test'}
 await api('/employees',{...body,annualSalaryCents:0},{status:400})
 const employee=await api('/employees',body,{status:201})
 assert.equal(employee.payType,'SALARY');assert.equal(employee.annualSalaryCents,7800000);assert.equal(employee.hourlyRateCents,null);assert.equal(employee.overtimeClassification,'EXEMPT_REVIEW')
 assert.equal((await h.pool.query('SELECT COUNT(*)::int AS n FROM payroll_pay_rate WHERE employee_id=$1',[employee.id])).rows[0].n,0)
 const packet=await api(`/employees/${employee.id}/onboarding`)
 assert.ok(packet.readiness.blockers.includes('Salary overtime classification review'))
 const updated=await api(`/employees/${employee.id}`,{phone:'2025550100'},{method:'PATCH'})
 assert.equal(updated.phone,'2025550100');assert.equal(updated.annualSalaryCents,7800000)
 await api(`/employees/${employee.id}`,{hourlyRateCents:2500},{method:'PATCH',status:409})
 const invitation=await api(`/employees/${employee.id}/invitations`,{email:'salary@example.test',sendEmail:false},{status:201})
 token=(await api('/invitations/redeem',{token:new URL(invitation.inviteUrl).searchParams.get('invite')},{employee:true})).sessionToken
 const portal=await api('/me',undefined,{employee:true});assert.equal(portal.employee.payType,'SALARY');assert.equal(portal.employee.annualSalaryCents,7800000)
 const task=packet.tasks.find(t=>t.task_key==='WAGE_NOTICE')
 await api(`/onboarding/${task.id}`,{signature:'Salary Fixture',acknowledged:true,displayedWageTerms:packet.wageTerms},{employee:true})
 const saved=(await h.pool.query('SELECT response FROM payroll_onboarding_task WHERE id=$1',[task.id])).rows[0]
 assert.equal(saved.response.terms.annualSalaryCents,7800000)
})
