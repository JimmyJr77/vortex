import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {statementLines} from '../payStatement.js'
for(const initial of ['HOURLY'])test(`${initial}-first imported wages supply revalidated historical coverage for subsequent salary settlement`,{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
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
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE',w4_status='COMPLETE',state_withholding_status='COMPLETE' WHERE id=$1",[e.id])
 await api(`/employees/${e.id}/tax-elections`,{confirmed:true,sourceNote:'Synthetic signed employee tax elections',federal:{filingStatus:'SINGLE'},maryland:{filingStatus:'SINGLE',localRate:3.2,exemptions:1}},'PATCH')
 for(const day of ['03','04','05'])await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,$2,$3,'ADMIN','APPROVED')",[e.id,`2026-08-${day}T12:00Z`,`2026-08-${day}T20:00Z`])
 const periods=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-08-03','2026-08-05','2026-08-14','SEMIMONTHLY'),(1,'2026-08-07','2026-08-09','2026-08-21','SEMIMONTHLY') RETURNING id")).rows
 await api('/runs/preview',{payPeriodId:periods[0].id});await h.pool.query("UPDATE payroll_compliance_task SET status='COMPLETE' WHERE facility_id=1")
 const historical=await api(`/employees/${e.id}/historical-payments`,{requestId:'imported-coverage-wages',periodStart:'2026-08-03',periodEnd:'2026-08-05',paymentDate:'2026-08-14',method:'CHECK',reference:'IMPORT-COVERAGE-001',grossCents:60000,taxCents:12000,netCents:48000,evidence:'Synthetic complete wage source and cleared check',wageOnlyConfirmed:true,confirmed:true},'POST',201)
 const original=(await h.pool.query('SELECT * FROM payroll_historical_payment WHERE id=$1',[historical.id])).rows[0]
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date='2026-08-05' WHERE id=$1",[e.id])
 await h.pool.query("UPDATE payroll_employee SET employment_status='ONBOARDING',hire_date='2026-08-07',termination_date=NULL,pay_type='SALARY',annual_salary_cents=6240000 WHERE id=$1",[e.id])
 await h.pool.query('UPDATE payroll_onboarding_task SET onboarding_cycle=onboarding_cycle+1 WHERE facility_id=1 AND employee_id=$1',[e.id])
 await api(`/employees/${e.id}/salary-review`,{...review,employmentStart:'2026-08-07'})
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE' WHERE id=$1",[e.id])
 for(const day of ['07','08','09'])await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,$2,$3,'ADMIN','APPROVED')",[e.id,`2026-08-${day}T12:00Z`,`2026-08-${day}T${day==='09'?22:20}:00Z`])
 const input={payPeriodId:periods[1].id,week:'2026-08-03',salaryAllocations:[{employmentStart:'2026-08-07',earningsCents:120000,source:'Synthetic complete workweek salary allocation'}]}
 const allocation=await api(`/employees/${e.id}/workweek-allocation-preview`,input)
 await api(`/employees/${e.id}/workweek-allocations`,{...input,fingerprint:allocation.fingerprint,requestId:'native-allocation-review',reason:'Reviewed full workweek and historic hourly payroll',confirmed:true},'POST',201)
 const importPath=`/employees/${e.id}/historical-payments/${historical.id}`
 const imported=await api(`${importPath}/allocation-preview`,{payPeriodId:periods[0].id})
 await api(`${importPath}/allocations`,{payPeriodId:periods[0].id,fingerprint:imported.fingerprint,requestId:'imported-coverage-review',reason:'Verified all imported wages against complete dated earnings',sourceConfirmed:true,confirmed:true},'POST',201)
 const evidence=(await api('/runs/preview',{payPeriodId:periods[1].id})).preview.employees[0].employmentWeekReviews[0]
 assert.equal(evidence.paymentReconciliation.status,'EVIDENCE_RECONCILED',JSON.stringify(evidence.paymentReconciliation.issues))
 assert.equal(evidence.paymentReconciliation.paid[0].coverageSource,'RETAINED_IMPORTED_WAGES')
 await h.pool.query("UPDATE payroll_historical_payment SET evidence_note='Changed imported source evidence requires a fresh retained review' WHERE id=$1",[historical.id])
 const stale=(await api('/runs/preview',{payPeriodId:periods[1].id})).preview.employees[0].employmentWeekReviews[0]
 assert.equal(stale.paymentReconciliation.status,'REVIEW_REQUIRED')
 assert.equal(stale.historicalPayments[0].allocationReview.status,'STALE')
 await h.pool.query('UPDATE payroll_historical_payment SET evidence_note=$2 WHERE id=$1',[historical.id,original.evidence_note])
 await api(`/employees/${e.id}/workweek-settlement-authorizations`,{payPeriodId:periods[1].id,week:input.week,fingerprint:evidence.paymentReconciliation.fingerprint,requestId:'native-coverage-authorization',reason:'Confirmed complete history against retained native hourly payroll',historyComplete:true,confirmed:true},'POST',201)
 const preview=(await api('/runs/preview',{payPeriodId:periods[1].id})).preview
 assert.equal(preview.canApprove,true,JSON.stringify(preview.warnings));assert.equal(preview.employees[0].grossPayCents,138000)
 const second=await api('/runs',{payPeriodId:periods[1].id},'POST',201)
 await api(`/runs/${second.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${second.id}/status`,{status:'APPROVED'},'PATCH')
 await api(`/runs/${second.id}/finalize`,{paymentDate:'2026-08-21',paymentConfirmationReference:'SYNTHETIC-RECOVERED-SETTLEMENT'})
 const frozen=(await h.pool.query('SELECT * FROM payroll_run_employee WHERE payroll_run_id=$1',[second.id])).rows[0]
 assert.equal(statementLines(frozen).lines.reduce((n,l)=>n+Number(l[2]),0),Number(frozen.net_pay_cents))
 assert.deepEqual((await h.pool.query('SELECT * FROM payroll_historical_payment WHERE id=$1',[historical.id])).rows[0],original)
 assert.deepEqual(frozen.statement_snapshot.authorizedSettlement[0].priorHistoricalPaymentIds,[Number(historical.id)])
 assert.deepEqual(frozen.statement_snapshot.authorizedSettlement[0].priorRunIds,[])
 const paid=(await api('/runs/preview',{payPeriodId:periods[1].id})).preview.employees[0].employmentWeekReviews[0].paymentReconciliation
 assert.equal(paid.differences.straightTimeCents,0);assert.equal(paid.differences.premiumCents,0)
 assert.equal(paid.paid.length,2)
})
