import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
test('employees acknowledge scoped schedule changes and cancellations once while admins can inspect separate pending receipts',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close());let token
 const api=async(path,body,{employee=false,facility=1,status=200}={})=>{const response=await fetch(`${h.url}/api/${employee?'payroll/employee':'admin/payroll'}${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${employee?token:'payroll-test-admin'}`,'Content-Type':'application/json','x-test-facility':String(facility)},body:body?JSON.stringify(body):undefined});const json=await response.json();assert.equal(response.status,status,JSON.stringify(json));return json.data}
 const employee=await api('/employees',{employeeNumber:'SCHEDULE-NOTICE',legalFirstName:'Notice',legalLastName:'Fixture',hireDate:'2026-01-01',hourlyRateCents:2500,personalEmail:'notice@example.test'},{status:201})
 const invite=await api(`/employees/${employee.id}/invitations`,{email:'notice@example.test',sendEmail:false},{status:201})
 token=(await api('/invitations/redeem',{token:new URL(invite.inviteUrl).searchParams.get('invite')},{employee:true})).sessionToken
 const body={frequency:'WEEKLY',effectiveOn:'2097-01-16',anchorStart:'2097-01-16',paymentLagDays:5,noticeDeliveredOn:'2026-09-01',confirmed:true,source:'Synthetic published schedule notice'}
 const preview=await api('/pay-schedule/transition-preview',body);await api('/pay-schedule/transition',{...body,previewToken:preview.previewToken})
 const notices=await api('/pay-schedule-notices',undefined,{employee:true});assert.equal(notices.length,1);const id=notices[0].id
 assert.equal(notices[0].schedule.pay_frequency,'WEEKLY');assert.equal(notices[0].acknowledgedAt,null)
 await api(`/pay-schedule/${id}/acknowledgments`,undefined,{facility:2,status:404})
 await api('/pay-schedule-notices/999999/acknowledge',{acknowledged:true},{employee:true,status:404})
 await api(`/pay-schedule-notices/${id}/acknowledge`,{acknowledged:false},{employee:true,status:400})
 const first=await api(`/pay-schedule-notices/${id}/acknowledge`,{acknowledged:true},{employee:true})
 assert.deepEqual(await api(`/pay-schedule-notices/${id}/acknowledge`,{acknowledged:true},{employee:true}),first)
 assert.equal((await h.pool.query("SELECT COUNT(*)::int AS n FROM payroll_audit_log WHERE action='PAY_SCHEDULE_NOTICE_ACKNOWLEDGED'")).rows[0].n,1)
 const cancel=await api(`/pay-schedule/${id}/cancel-preview`,{});await api(`/pay-schedule/${id}/cancel`,{...body,previewToken:cancel.previewToken})
 await api(`/pay-schedule-notices/${id}/acknowledge`,{acknowledged:true},{employee:true,status:404})
 const receipts=await api(`/pay-schedule/${id}/acknowledgments`)
 assert.equal(receipts.length,2);assert.equal(receipts.find(r=>r.notice_kind==='CANCELLATION').acknowledged_at,null)
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED' WHERE id=$1",[employee.id])
 await api(`/pay-schedule-notices/${id}/acknowledge`,{acknowledged:true,cancellation:true},{employee:true})
 const saved=await api('/pay-schedule-notices',undefined,{employee:true});assert.ok(saved[0].cancellationAcknowledgedAt);assert.ok(saved[0].acknowledgedAt)
 assert.equal((await h.pool.query('SELECT COUNT(*)::int AS n FROM payroll_schedule_acknowledgment')).rows[0].n,2)
})
