import {writeFile} from 'node:fs/promises'
import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {statementLines,payStatementPdf} from '../payStatement.js'
for(const initial of ['HOURLY','SALARY'])test(`${initial}-first allocated workweek settles across adjacent periods without repeating earnings or leave`,{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,method='POST',status=200)=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method,headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});const j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j.data}
 await api('/settings',{legalBusinessName:'Split Payroll',businessAddress:'123 Test Street, Bowie MD',businessPhone:'555-010-0000'},'PATCH')
 await api('/employer-taxes',{futaRatePercent:0.6,mdUiRatePercent:2.6,source:'Synthetic employer tax notice',confirmed:true},'PATCH')
 const e=await api('/employees',{employeeNumber:`SPLIT-${initial}`,legalFirstName:'Split',legalLastName:'Settlement',hireDate:'2026-08-03',payType:initial,hourlyRateCents:2500,annualSalaryCents:6240000},'POST',201)
 const review={classification:'NONEXEMPT',fixed40Verified:true,minimumWageVerified:true,minimumWageCents:1500,confirmed:true,source:'Synthetic verified fixed salary agreement'}
 if(initial==='SALARY'){
  await api(`/employees/${e.id}/salary-review`,review)
  await h.pool.query("INSERT INTO payroll_salary_change(facility_id,employee_id,effective_on,annual_salary_cents,salary_review,reason) SELECT facility_id,id,hire_date,annual_salary_cents,salary_review,'Retained prior agreement' FROM payroll_employee WHERE id=$1",[e.id])
 }
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date='2026-08-05' WHERE id=$1",[e.id])
 await h.pool.query("UPDATE payroll_employee SET employment_status='ONBOARDING',hire_date='2026-08-07',termination_date=NULL,pay_type=$2,hourly_rate_cents=3000,annual_salary_cents=$3,salary_review=NULL WHERE id=$1",[e.id,initial==='HOURLY'?'SALARY':'HOURLY',initial==='HOURLY'?6240000:null])
 if(initial==='HOURLY')await api(`/employees/${e.id}/salary-review`,review)
 else await h.pool.query("INSERT INTO payroll_pay_rate(facility_id,employee_id,effective_on,hourly_rate_cents,reason) VALUES(1,$1,'2026-08-07',3000,'New hourly agreement')",[e.id])
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE',w4_status='COMPLETE',state_withholding_status='COMPLETE' WHERE id=$1",[e.id])
 await api(`/employees/${e.id}/tax-elections`,{confirmed:true,sourceNote:'Synthetic signed employee tax elections',federal:{filingStatus:'SINGLE'},maryland:{filingStatus:'SINGLE',localRate:3.2,exemptions:1}},'PATCH')
 for(const day of ['03','04','05','07','08','09'])await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,$2,$3,'ADMIN','APPROVED')",[e.id,`2026-08-${day}T12:00Z`,`2026-08-${day}T${day==='09'?22:20}:00Z`])
 const periods=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-08-03','2026-08-05','2026-08-14','SEMIMONTHLY'),(1,'2026-08-07','2026-08-09','2026-08-21','SEMIMONTHLY') RETURNING id,pay_date")).rows
 const allocationInput={payPeriodId:periods[0].id,week:'2026-08-03',salaryAllocations:[{employmentStart:initial==='HOURLY'?'2026-08-07':'2026-08-03',earningsCents:120000,source:'Synthetic verified full workweek salary allocation'}]}
 const allocation=await api(`/employees/${e.id}/workweek-allocation-preview`,allocationInput)
 assert.equal(allocation.version,5)
 await api(`/employees/${e.id}/workweek-allocations`,{...allocationInput,fingerprint:allocation.fingerprint,requestId:'partial-settlement-allocation',reason:'Reviewed full workweek earnings and dated allocation coverage',confirmed:true},'POST',201)
 await h.pool.query("UPDATE payroll_compliance_task SET status='COMPLETE' WHERE facility_id=1")
 const frozen=[]
 for(const [index,period] of periods.entries()){
  const evidence=(await api('/runs/preview',{payPeriodId:period.id})).preview.employees[0].employmentWeekReviews[0]
  if(index)assert.equal(evidence.settlementAuthorization.status,'STALE')
  await api(`/employees/${e.id}/workweek-settlement-authorizations`,{payPeriodId:period.id,week:'2026-08-03',fingerprint:evidence.paymentReconciliation.fingerprint,requestId:`partial-authorization-${index}`,reason:'Reviewed complete payment history and authorized remaining workweek wages',historyComplete:true,confirmed:true},'POST',201)
  const preview=(await api('/runs/preview',{payPeriodId:period.id})).preview
  assert.equal(preview.canApprove,true,JSON.stringify(preview.warnings))
  assert.equal(preview.employees[0].regularMinutes+preview.employees[0].overtimeMinutes,index?1560:1440)
  assert.equal(preview.employees[0].sickLeaveAccrualMinutes,index?52:0)
  const run=await api('/runs',{payPeriodId:period.id},'POST',201)
  await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH')
  await api(`/runs/${run.id}/finalize`,{paymentDate:new Date(period.pay_date).toISOString().slice(0,10),paymentConfirmationReference:`SYNTHETIC-PARTIAL-${index}`})
  frozen.push((await h.pool.query('SELECT * FROM payroll_run_employee WHERE payroll_run_id=$1',[run.id])).rows[0])
 }
 assert.equal(frozen.reduce((n,r)=>n+Number(r.regular_pay_cents)+Number(r.overtime_pay_cents),0),initial==='HOURLY'?198000:217800)
 assert.equal((await h.pool.query('SELECT SUM(minutes)::int n FROM payroll_leave_transaction WHERE employee_id=$1',[e.id])).rows[0].n,52)
 for(const row of frozen)assert.equal(statementLines(row).lines.reduce((n,l)=>n+Number(l[2]),0),Number(row.net_pay_cents))
 const final=(await api('/runs/preview',{payPeriodId:periods[1].id})).preview.employees[0].employmentWeekReviews[0]
 assert.deepEqual(final.paymentReconciliation.differences,{straightTimeCents:0,premiumCents:0})
 assert.equal(final.settlementAuthorization.status,'STALE')
 assert.equal(final.paymentReconciliation.paid.length,2)
 if(process.env.PAYROLL_PARTIAL_PDF_PATH&&initial==='HOURLY')await writeFile(process.env.PAYROLL_PARTIAL_PDF_PATH,await payStatementPdf({...frozen[1],period_start:'2026-08-07',period_end:'2026-08-09',pay_date:'2026-08-21'}))
})
