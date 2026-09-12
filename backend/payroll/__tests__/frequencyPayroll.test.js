import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
for(const [frequency,days,gross,federal,state,net,accrual] of [['WEEKLY',5,100000,7808,6941,77601,80],['BIWEEKLY',10,200000,15615,13882,155203,160]])test(`${frequency} setup calculates and finalizes wages, native taxes and leave through real APIs`,{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,method='POST')=>{const response=await fetch(`${h.url}/api/admin/payroll${path}`,{method,headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});const json=await response.json();assert.ok(response.ok,JSON.stringify(json));return json.data}
 await api('/pay-schedule/configure',{frequency,anchorStart:'2026-08-03',paymentLagDays:5,source:'Synthetic published frequency payroll notice',confirmed:true})
 await api('/settings',{legalBusinessName:'Synthetic Frequency Payroll',businessAddress:'123 Test Street, Bowie MD',businessPhone:'555-010-0000'},'PATCH')
 await api('/employer-taxes',{futaRatePercent:0.6,mdUiRatePercent:2.6,source:'Synthetic verified employer tax notice',confirmed:true},'PATCH')
 const employee=await api('/employees',{employeeNumber:frequency,legalFirstName:'Frequency',legalLastName:'Fixture',hireDate:'2026-08-03',hourlyRateCents:2500})
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE',w4_status='COMPLETE',state_withholding_status='COMPLETE' WHERE id=$1",[employee.id])
 const election=await api(`/employees/${employee.id}/tax-elections`,{confirmed:true,sourceNote:'Synthetic signed W4 and MW507 elections',federal:{filingStatus:'SINGLE'},maryland:{filingStatus:'SINGLE',localRate:3.2,exemptions:1}},'PATCH')
 assert.match(election.version,new RegExp(frequency.toLowerCase()))
 for(let i=0;i<days;i++){
  const day=String(3+i+(i>=5?2:0)).padStart(2,'0')
  await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,$2,$3,'ADMIN','APPROVED')",[employee.id,`2026-08-${day}T12:00:00Z`,`2026-08-${day}T20:00:00Z`])
 }
 const periods=await api('/pay-periods/generate',{year:2026,month:8}),period=periods.find(p=>String(p.period_start).startsWith('2026-08-03'))
 assert.ok(period)
 await api('/runs/preview',{payPeriodId:period.id})
 await h.pool.query("UPDATE payroll_compliance_task SET status='COMPLETE' WHERE facility_id=1")
 const preview=(await api('/runs/preview',{payPeriodId:period.id})).preview
 assert.equal(preview.canApprove,true,JSON.stringify(preview.warnings))
 const calculated=preview.employees[0]
 assert.equal(calculated.grossPayCents,gross);assert.equal(calculated.federalIncomeTaxCents,federal);assert.equal(calculated.stateIncomeTaxCents,state);assert.equal(calculated.netPayCents,net);assert.equal(calculated.sickLeaveAccrualMinutes,accrual)
 const run=await api('/runs',{payPeriodId:period.id})
 // An employer's later schedule must not reinterpret an already-created period.
 await h.pool.query("UPDATE payroll_settings SET pay_frequency='SEMIMONTHLY' WHERE facility_id=1")
 const unchanged=(await api('/runs/preview',{payPeriodId:period.id})).preview.employees[0]
 assert.equal(unchanged.payFrequency,frequency)
 assert.equal(unchanged.netPayCents,net)
 assert.equal(unchanged.sickLeaveAccrualMinutes,accrual)
 await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH')
 await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH')
 await api(`/runs/${run.id}/finalize`,{paymentDate:String(period.pay_date).slice(0,10),paymentConfirmationReference:`SYNTHETIC-${frequency}-CHECK`})
 const frozen=(await h.pool.query('SELECT * FROM payroll_run_employee WHERE payroll_run_id=$1',[run.id])).rows[0]
 assert.equal(Number(frozen.net_pay_cents),net)
 assert.equal(frozen.statement_snapshot.sickLeaveFraction.version,1)
 assert.equal(frozen.statement_snapshot.sickLeaveFraction.remainderAfter,0)
 assert.equal(frozen.statement_snapshot.workweekPayments.reduce((n,w)=>n+w.workedMinutes,0),days*480)
 assert.equal((await h.pool.query("SELECT SUM(minutes)::int AS minutes FROM payroll_leave_transaction WHERE employee_id=$1 AND leave_type='MD_SICK_SAFE'",[employee.id])).rows[0].minutes,accrual)
})
