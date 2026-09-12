import test from 'node:test'
import assert from 'node:assert/strict'
import { validatePayChange } from '../compensation.js'
import { buildEmployeePreview } from '../payrollEngine.js'
import { statementLines } from '../payStatement.js'
import { createHarness } from '../testing/harness.js'
import { initPayrollTables } from '../initTables.js'

const employee={employment_status:'ACTIVE',pay_type:'HOURLY',hire_date:'2026-01-01'}
const settings={workweek_starts_on:1,pay_frequency:'SEMIMONTHLY'}
const opening={effective_on:'2026-01-01',hourly_rate_cents:2500}
const change={effectiveOn:'2026-09-28',hourlyRateCents:2600,noticeDeliveredOn:'2026-09-09',noticeConfirmed:true,noticeReference:'Signed notice receipt number 10',reason:'Annual compensation review'}
test('effective pay changes allow future midweek dates and enforce written advance notice for decreases',()=>{
 assert.doesNotThrow(()=>validatePayChange(change,settings,employee,opening,'2026-09-09'))
 assert.doesNotThrow(()=>validatePayChange({...change,effectiveOn:'2026-09-29'},settings,employee,opening,'2026-09-09'))
 assert.throws(()=>validatePayChange({...change,effectiveOn:'2026-09-07'},settings,employee,opening,'2026-09-09'),/future/)
 assert.throws(()=>validatePayChange({...change,noticeConfirmed:false},settings,employee,opening,'2026-09-09'),/Confirm/)
 assert.throws(()=>validatePayChange({...change,hourlyRateCents:2400,effectiveOn:'2026-09-21'},settings,employee,opening,'2026-09-09'),/16 days/)
 assert.doesNotThrow(()=>validatePayChange({...change,hourlyRateCents:2400},settings,employee,opening,'2026-09-09'))
 assert.throws(()=>validatePayChange({...change,effectiveOn:'2026-02-30'},settings,employee,opening,'2026-01-01'),/valid/)
})
test('different workweeks pay their effective rates and preserve all statement rate details',()=>{
 const preview=buildEmployeePreview({employee:{id:1,payType:'HOURLY',hourlyRateCents:2500,w4Status:'COMPLETE',stateWithholdingStatus:'COMPLETE'},entries:[{id:1,clockIn:'2026-09-21T09:00Z',clockOut:'2026-09-21T17:00Z',status:'APPROVED',hourlyRateCents:2500},{id:2,clockIn:'2026-09-28T09:00Z',clockOut:'2026-09-28T17:00Z',status:'APPROVED',hourlyRateCents:3000}],priorApprovedMinutesByWeek:{'2026-09-28':2400}})
 assert.equal(preview.regularPayCents,20000);assert.equal(preview.overtimePayCents,36000)
 assert.deepEqual(preview.rateBreakdown.map(r=>[r.hourlyRateCents,r.regularMinutes,r.overtimeMinutes]),[[2500,480,0],[3000,0,480]])
 const {lines}=statementLines({regular_pay_cents:20000,overtime_pay_cents:36000,other_taxable_pay_cents:0,statement_snapshot:{rateBreakdown:preview.rateBreakdown}})
 assert.ok(lines.some(l=>l[1]==='8.00 hours at $25.00/hour'&&l[2]===20000));assert.ok(lines.some(l=>l[1]==='8.00 hours at $45.00/hour'&&l[2]===36000))
})
test('compensation history is scoped, notices can be acknowledged, and late time keeps its rate', {skip:!process.env.PAYROLL_TEST_DATABASE_URL}, async t=>{
 const h=await createHarness();t.after(()=>h.close());let token
 const api=async(path,body,{status=200,facility=1,employee=false,method}={})=>{
  const res=await fetch(`${h.url}/api/${employee?'payroll/employee':'admin/payroll'}${path}`,{method:method||(body?'POST':'GET'),headers:{'Content-Type':'application/json',Authorization:`Bearer ${employee?token:'payroll-test-admin'}`,'x-test-facility':String(facility)},body:body?JSON.stringify(body):undefined})
  const json=await res.json();assert.equal(res.status,status,JSON.stringify(json));return json.data
 }
 const e=await api('/employees',{employeeNumber:'RATES-001',legalFirstName:'Rate',legalLastName:'Fixture',hireDate:'2026-01-01',hourlyRateCents:2400,personalEmail:'rates@example.test'},{status:201})
 await h.pool.query("UPDATE payroll_onboarding_task SET status='COMPLETE' WHERE employee_id=$1 AND task_key IN ('WAGE_NOTICE','PAY_REVIEW')",[e.id])
 await api(`/employees/${e.id}`,{hourlyRateCents:2500},{method:'PATCH'})
 const resetTasks=(await h.pool.query("SELECT task_key,status FROM payroll_onboarding_task WHERE employee_id=$1 AND task_key IN ('WAGE_NOTICE','PAY_REVIEW') ORDER BY task_key",[e.id])).rows
 assert.deepEqual(resetTasks,[{task_key:'PAY_REVIEW',status:'OPEN'},{task_key:'WAGE_NOTICE',status:'CHANGES_REQUESTED'}])
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE' WHERE id=$1",[e.id])
 const invite=await api(`/employees/${e.id}/invitations`,{email:'rates@example.test',sendEmail:false},{status:201})
 token=(await api('/invitations/redeem',{token:new URL(invite.inviteUrl).searchParams.get('invite')},{employee:true})).sessionToken
 const history=await api(`/employees/${e.id}/pay-rates`)
 const effective=new Date('2050-01-01T00:00:00Z');while(effective.getUTCDay()!==history.workweekStartsOn)effective.setUTCDate(effective.getUTCDate()+1)
 const effectiveOn=effective.toISOString().slice(0,10)
 const body={...change,effectiveOn,noticeDeliveredOn:history.today,hourlyRateCents:3000}
 await api(`/employees/${e.id}/pay-rates`,body,{facility:2,status:404})
 const saved=await api(`/employees/${e.id}/pay-rates`,body,{status:201})
 await api(`/employees/${e.id}/pay-rates`,body,{status:409})
 await api(`/employees/${e.id}`,{hourlyRateCents:3500},{method:'PATCH',status:409})
 const notices=await api('/pay-rates',undefined,{employee:true});assert.equal(notices.rates.length,2);assert.equal(notices.currentRateCents,2500)
 const ack=await api(`/pay-rates/${saved.id}/acknowledge`,{acknowledged:true},{employee:true});assert.ok(ack.acknowledged_at)
 const addTime=async date=>{const row=await api('/time-entries',{employeeId:e.id,clockIn:`${date}T14:00:00Z`,clockOut:`${date}T22:00:00Z`,evidenceNote:'Verified synthetic shift record'},{status:201});await api(`/time-entries/${row.id}/status`,{status:'APPROVED'},{method:'PATCH'})}
 await addTime(effectiveOn)
 const before=new Date(effective);before.setUTCDate(before.getUTCDate()-1);await addTime(before.toISOString().slice(0,10))
 // A late entry entered after the raise was scheduled still earns the opening rate.
 const periods=await api('/pay-periods/generate',{year:2050,month:1},{status:201})
 const p=periods.find(p=>String(p.period_start).startsWith('2050-01-01'))
 const preview=(await api('/runs/preview',{payPeriodId:p.id})).preview.employees[0]
 assert.equal(preview.regularPayCents,44000);assert.equal(preview.rateBreakdown.length,2)
 const row=await h.pool.query('SELECT hourly_rate_cents FROM payroll_employee WHERE id=$1',[e.id]);assert.equal(row.rows[0].hourly_rate_cents,2500)
 const leaveRequest=(await h.pool.query("INSERT INTO payroll_employee_request(facility_id,employee_id,kind,status,payload) VALUES(1,$1,'LEAVE','APPROVED','{}') RETURNING id",[e.id])).rows[0]
 await h.pool.query('INSERT INTO payroll_paid_leave(facility_id,employee_id,request_id,leave_date,minutes,hourly_rate_cents) VALUES(1,$1,$2,$3,60,3000)',[e.id,leaveRequest.id,effectiveOn])
 assert.equal((await api('/runs/preview',{payPeriodId:p.id})).preview.employees[0].paidLeavePayCents,3000)
 const cancellation={reason:'Correcting the scheduled compensation notice',noticeDeliveredOn:history.today,noticeReference:'Signed cancellation delivery receipt 11',noticeConfirmed:true}
 const cancelPath=`/employees/${e.id}/pay-rates/${saved.id}/cancel`
 await api(cancelPath,cancellation,{facility:2,status:404})
 await api(cancelPath,{...cancellation,noticeConfirmed:false},{status:400})
 await api(`/employees/${e.id}/pay-rates/${history.rates[0].id}/cancel`,cancellation,{status:409})
 const locked=(await h.pool.query("INSERT INTO payroll_run(facility_id,pay_period_id,status) VALUES(1,$1,'APPROVED') RETURNING id",[p.id])).rows[0]
 await api(cancelPath,cancellation,{status:409})
 await h.pool.query("UPDATE payroll_run SET status='VOID' WHERE id=$1",[locked.id])
 const cancelled=await api(cancelPath,cancellation)
 assert.ok(cancelled.cancelled_at);assert.equal(new Date(cancelled.acknowledged_at).toISOString(),new Date(ack.acknowledged_at).toISOString())
 await api(cancelPath,cancellation,{status:404})
 await api(`/pay-rates/${saved.id}/acknowledge`,{acknowledged:true},{employee:true,status:404})
 assert.ok((await api(`/pay-rates/${saved.id}/acknowledge`,{acknowledged:true,cancellation:true},{employee:true})).cancellation_acknowledged_at)
 const reverted=(await api('/runs/preview',{payPeriodId:p.id})).preview.employees[0]
 assert.equal(reverted.regularPayCents,40000);assert.equal(reverted.rateBreakdown.length,1);assert.equal(reverted.paidLeavePayCents,2500)
 const replacement=await api(`/employees/${e.id}/pay-rates`,{...body,hourlyRateCents:3200},{status:201})
 assert.notEqual(replacement.id,saved.id)
 assert.equal((await api('/pay-rates',undefined,{employee:true})).rates.length,3)
 assert.equal((await api('/runs/preview',{payPeriodId:p.id})).preview.employees[0].regularPayCents,45600)
 const later=new Date(effective);later.setUTCDate(later.getUTCDate()+7)
 const next=await api(`/employees/${e.id}/pay-rates`,{...body,effectiveOn:later.toISOString().slice(0,10),hourlyRateCents:3400},{status:201})
 await api(`/employees/${e.id}/pay-rates/${replacement.id}/cancel`,cancellation,{status:409})
 await api(`/employees/${e.id}/pay-rates/${next.id}/cancel`,cancellation)
 assert.equal((await h.pool.query("SELECT COUNT(*)::int AS count FROM payroll_audit_log WHERE action='PAY_CHANGE_CANCELLED' AND facility_id=1")).rows[0].count,2)
 await initPayrollTables(h.pool)
 const restored=await api(`/employees/${e.id}/pay-rates`)
 assert.equal(restored.rates.length,4);assert.equal(restored.rates.filter(r=>r.cancelled_at).length,2)
 assert.equal((await api('/runs/preview',{payPeriodId:p.id})).preview.employees[0].paidLeavePayCents,3200)
 const nearEmployee=await api('/employees',{employeeNumber:'RATES-002',legalFirstName:'Notice',legalLastName:'Fixture',hireDate:'2026-01-01',hourlyRateCents:2500,personalEmail:'notice@example.test'},{status:201})
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE' WHERE id=$1",[nearEmployee.id])
 const soon=new Date(`${history.today}T00:00:00Z`);soon.setUTCDate(soon.getUTCDate()+1);while(soon.getUTCDay()!==history.workweekStartsOn)soon.setUTCDate(soon.getUTCDate()+1)
 const nearRate=await api(`/employees/${nearEmployee.id}/pay-rates`,{...body,effectiveOn:soon.toISOString().slice(0,10)},{status:201})
 await api(`/employees/${nearEmployee.id}/pay-rates/${nearRate.id}/cancel`,cancellation,{status:400})
 await api(`/pay-rates/${nearRate.id}/acknowledge`,{acknowledged:true},{employee:true,status:404})
 await api(`/employees/${e.id}`,{employmentStatus:'TERMINATED'},{method:'PATCH'})
 assert.ok((await api(`/pay-rates/${next.id}/acknowledge`,{acknowledged:true,cancellation:true},{employee:true})).cancellation_acknowledged_at)
 assert.ok((await api(`/pay-rates/${replacement.id}/acknowledge`,{acknowledged:true},{employee:true})).acknowledged_at)



})
