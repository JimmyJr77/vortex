import test from 'node:test'
import assert from 'node:assert/strict'
import {previousLeavePeriodHistory} from '../leavePeriodHistory.js'
import {statementLines,payStatementPdf} from '../payStatement.js'
import {createHarness} from '../testing/harness.js'
for(const [frequency,days,gross,accrual,hours=40] of [['WEEKLY',5,195000,96],['BIWEEKLY',10,390000,192],['WEEKLY',5,260000,96,30],['BIWEEKLY',10,520000,192,30]])test(`${frequency} ${hours}-hour nonexempt salary calculates and finalizes wages, native taxes and leave through real APIs`,{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,method='POST')=>{const response=await fetch(`${h.url}/api/admin/payroll${path}`,{method,headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});const json=await response.json();assert.ok(response.ok,JSON.stringify(json));return json.data}
 await api('/pay-schedule/configure',{frequency,anchorStart:'2026-08-03',paymentLagDays:5,source:'Synthetic published frequency payroll notice',confirmed:true})
 await api('/settings',{legalBusinessName:'Synthetic Frequency Payroll',businessAddress:'123 Test Street, Bowie MD',businessPhone:'555-010-0000'},'PATCH')
 await api('/employer-taxes',{futaRatePercent:0.6,mdUiRatePercent:2.6,source:'Synthetic verified employer tax notice',confirmed:true},'PATCH')
 const employee=await api('/employees',{employeeNumber:frequency,legalFirstName:'Frequency',legalLastName:'Fixture',hireDate:'2026-08-03',payType:'SALARY',annualSalaryCents:7800000,jobTitle:'Office manager'})
 await api(`/employees/${employee.id}/salary-review`,{classification:'NONEXEMPT',standardWeeklyHours:hours,fixedHoursVerified:true,fixed40Verified:true,minimumWageVerified:true,minimumWageCents:1500,category:'ADMINISTRATIVE',salaryBasisVerified:true,dutiesVerified:true,stateRulesVerified:true,dutiesEvidence:'Verified independent discretion and judgment on significant office management matters.',source:'Synthetic job duties and salary basis agreement',confirmed:true})
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE',w4_status='COMPLETE',state_withholding_status='COMPLETE' WHERE id=$1",[employee.id])
 const election=await api(`/employees/${employee.id}/tax-elections`,{confirmed:true,sourceNote:'Synthetic signed W4 and MW507 elections',federal:{filingStatus:'SINGLE'},maryland:{filingStatus:'SINGLE',localRate:3.2,exemptions:1}},'PATCH')
 assert.match(election.version,new RegExp(frequency.toLowerCase()))
 await api(`/employees/${employee.id}/leave-transactions`,{transactionDate:'2026-08-01',minutes:480,leaveType:'PTO',reason:'Synthetic opening leave balance',transactionKind:'OPENING_BALANCE'})
 const request=(await h.pool.query("INSERT INTO payroll_employee_request(facility_id,employee_id,kind,payload) VALUES(1,$1,'LEAVE',$2) RETURNING id",[employee.id,{leaveType:'PTO',startDate:'2026-08-09',endDate:'2026-08-09',minutes:480,reason:'Synthetic paid leave'}])).rows[0]
 await api(`/requests/${request.id}/review`,{status:'APPROVED',note:'Synthetic verified paid leave'})
 const paidLeave=(await h.pool.query('SELECT * FROM payroll_paid_leave WHERE employee_id=$1',[employee.id])).rows[0]
 assert.equal(paidLeave.included_in_salary,true);assert.equal(paidLeave.hourly_rate_cents,null)
 for(let i=0;i<days+days/5;i++){
  const day=String(3+i+(i>=6?1:0)).padStart(2,'0')
  await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,$2,$3,'ADMIN','APPROVED')",[employee.id,`2026-08-${day}T12:00:00Z`,`2026-08-${day}T20:00:00Z`])
 }
 const periods=await api('/pay-periods/generate',{year:2026,month:8}),period=periods.find(p=>String(p.period_start).startsWith('2026-08-03'))
 assert.ok(period)
 await api('/runs/preview',{payPeriodId:period.id})
 await h.pool.query("UPDATE payroll_compliance_task SET status='COMPLETE' WHERE facility_id=1")
 const preview=(await api('/runs/preview',{payPeriodId:period.id})).preview
 assert.equal(preview.canApprove,true,JSON.stringify(preview.warnings))
 const calculated=preview.employees[0]
 assert.equal(calculated.grossPayCents,gross);assert.equal(calculated.overtimeMinutes,days/5*480);assert.equal(calculated.overtimePayCents,days/5*(hours===30?60000:45000));assert.equal(calculated.paidLeaveMinutes,480);assert.equal(calculated.paidLeavePayCents,0);assert.ok(calculated.federalIncomeTaxCents>0);assert.ok(calculated.stateIncomeTaxCents>0);assert.ok(calculated.netPayCents>0);assert.equal(calculated.sickLeaveAccrualMinutes,accrual)
 if(hours===30){assert.equal(calculated.salaryCalculation.extraStraightTimeMinutes,days/5*600);assert.equal(calculated.payItems.find(p=>p.kind==='SALARY_EXTRA_STRAIGHT_TIME').amountCents,days/5*50000)}
 const run=await api('/runs',{payPeriodId:period.id})
 // An employer's later schedule must not reinterpret an already-created period.
 await h.pool.query("UPDATE payroll_settings SET pay_frequency='SEMIMONTHLY' WHERE facility_id=1")
 const unchanged=(await api('/runs/preview',{payPeriodId:period.id})).preview.employees[0]
 assert.equal(unchanged.payFrequency,frequency)
 assert.equal(unchanged.netPayCents,calculated.netPayCents)
 assert.equal(unchanged.sickLeaveAccrualMinutes,accrual)
 await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH')
 await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH')
 await api(`/runs/${run.id}/finalize`,{paymentDate:String(period.pay_date).slice(0,10),paymentConfirmationReference:`SYNTHETIC-${frequency}-CHECK`})
 const overtimeReport=await api('/reports/overtime-review?year=2026',undefined,'GET');assert.equal(overtimeReport.records[0].paidPremiumCents,days/5*(hours===30?20000:15000));assert.equal(overtimeReport.records[0].qualificationStatus,'REVIEW_REQUIRED')
 const frozen=(await h.pool.query('SELECT * FROM payroll_run_employee WHERE payroll_run_id=$1',[run.id])).rows[0]
 assert.equal(Number(frozen.net_pay_cents),calculated.netPayCents)
 assert.equal(frozen.statement_snapshot.sickLeaveFraction.version,1)
 assert.equal(frozen.statement_snapshot.sickLeaveFraction.remainderAfter,0)
 assert.equal(frozen.statement_snapshot.salaryCalculation.regularPayCents,days/5*150000)
 assert.equal(frozen.statement_snapshot.salaryCalculation.leaveBasisMinutes,null)
 assert.equal(frozen.statement_snapshot.salaryCalculation.standardWeeklyHours,hours)
 if(hours===30)assert.equal(frozen.statement_snapshot.payItems.find(p=>p.kind==='SALARY_EXTRA_STRAIGHT_TIME').amountCents,days/5*50000)
 const lines=statementLines(frozen).lines;assert.equal(lines[0][0],'Salary');assert.match(lines[0][1],/78,000/)
 assert.equal(lines.some(line=>line[1].includes('/hour')),false)
 if(hours===30)assert.ok(lines.some(line=>line[0]==='Additional salary straight-time wages'&&line[1]===`${(days/5*10).toFixed(2)} hours at annual salary / 1,560`&&line[2]===days/5*50000))
 const pdf=await payStatementPdf({...frozen,period_start:period.period_start,period_end:period.period_end,pay_date:period.pay_date});assert.equal(pdf.subarray(0,5).toString(),'%PDF-')
 if(frequency==='WEEKLY'){
  const prior=await previousLeavePeriodHistory(h.pool,1,{frequency:'WEEKLY',period_start:'2026-08-10'})
  assert.equal(prior.find(row=>Number(row.employee_id)===employee.id).minutes,2880)
 }
 assert.equal(frozen.hourly_rate_cents,null)
 assert.equal((await h.pool.query("SELECT SUM(minutes)::int AS minutes FROM payroll_leave_transaction WHERE employee_id=$1 AND leave_type='MD_SICK_SAFE'",[employee.id])).rows[0].minutes,accrual)
})
