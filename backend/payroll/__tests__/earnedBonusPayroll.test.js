import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {marylandWithholding2026,federalWithholding2026} from '../withholding2026.js'
import {statementLines} from '../payStatement.js'
import {reconcileBonusCoverage} from '../bonusPaymentCoverage.js'
test('historical bonus coverage rejects missing, duplicate and unreconciled finalized wages',()=>{
 const entry={id:1,clockIn:'2026-08-03T12:00:00Z',clockOut:'2026-08-03T20:00:00Z',unpaidBreakMinutes:0,status:'APPROVED'}
 const allocation={evidence:[{entryId:1,clockIn:entry.clockIn,clockOut:entry.clockOut,breakMinutes:0,workDate:'2026-08-03'}]},period={period_start:'2026-08-10',period_end:'2026-08-16'}
 const row={run_id:1,employee_id:1,gross_pay_cents:20000,regular_minutes:480,overtime_minutes:0,calculation_snapshot:{employees:[{employeeId:1,grossPayCents:20000,entries:[entry]}]}}
 assert.equal(reconcileBonusCoverage(allocation,period,[row]).evidence[0].runId,1)
 const matchingPeriod={period_start:'2026-08-03',period_end:'2026-08-09'}
 assert.equal(reconcileBonusCoverage(allocation,matchingPeriod,[]).evidence[0].source,'CURRENT_PAYROLL')
 assert.throws(()=>reconcileBonusCoverage(allocation,matchingPeriod,[],{requireFinalized:true}),/exactly one/)
 assert.equal(reconcileBonusCoverage(allocation,matchingPeriod,[row],{requireFinalized:true}).evidence[0].source,'FINALIZED_PAYROLL')
 assert.throws(()=>reconcileBonusCoverage(allocation,period,[{...row,calculation_snapshot:{employees:[...row.calculation_snapshot.employees,...row.calculation_snapshot.employees]}}]),/wage snapshots/)
 assert.throws(()=>reconcileBonusCoverage(allocation,period,[]),/exactly one/)
 assert.throws(()=>reconcileBonusCoverage(allocation,period,[row,{...row,run_id:2}]),/exactly one/)
 assert.throws(()=>reconcileBonusCoverage(allocation,period,[{...row,regular_minutes:420}]),/hours do not reconcile/)
 assert.throws(()=>reconcileBonusCoverage(allocation,period,[{...row,gross_pay_cents:1}]),/wage snapshots/)
 assert.throws(()=>reconcileBonusCoverage({...allocation,evidence:[{...allocation.evidence[0],workDate:'2026-08-17'}]},period,[]),/after this payroll/)
})
for(const scenario of ['hourly current','hourly historical','salary historical'])test(`${scenario} earned bonus pays additional overtime and preserves coverage in finalized statements`,{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200,method='POST')=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method,headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});const json=await r.json();assert.equal(r.status,status,JSON.stringify(json));return json.data}
 await api('/settings',{legalBusinessName:'Earned Bonus Fixture',businessAddress:'123 Test Street, Bowie MD',businessPhone:'5550100000'},200,'PATCH')
 await api('/employer-taxes',{futaRatePercent:0.6,mdUiRatePercent:2.6,source:'Synthetic verified employer tax notice',confirmed:true},200,'PATCH')
 const salary=scenario.startsWith('salary'),historical=scenario.endsWith('historical')
 const e=await api('/employees',{employeeNumber:scenario,legalFirstName:'Earned',legalLastName:'Payroll',hireDate:'2026-08-03',...(salary?{payType:'SALARY',annualSalaryCents:7800000,jobTitle:'Coordinator'}:{hourlyRateCents:2500})},201)
 if(salary)await api(`/employees/${e.id}/salary-review`,{classification:'NONEXEMPT',fixed40Verified:true,minimumWageVerified:true,minimumWageCents:1500,source:'Synthetic fixed forty hour salary agreement',confirmed:true})
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE',w4_status='COMPLETE',state_withholding_status='COMPLETE' WHERE id=$1",[e.id])
 await api(`/employees/${e.id}/tax-elections`,{confirmed:true,sourceNote:'Synthetic signed tax elections',federal:{filingStatus:'SINGLE'},maryland:{filingStatus:'SINGLE',localRate:3.2,exemptions:1}},200,'PATCH')
 const first=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-08-03','2026-08-09','2026-08-14','WEEKLY') RETURNING id")).rows[0]
 const next=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-08-10','2026-08-16','2026-08-21','WEEKLY') RETURNING id")).rows[0]
 for(let i=3;i<=8;i++)await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,$2,$3,'ADMIN','APPROVED')",[e.id,`2026-08-0${i}T12:00:00Z`,`2026-08-0${i}T22:00:00Z`])
 if(historical)for(let i=10;i<=14;i++)await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,$2,$3,'ADMIN','APPROVED')",[e.id,`2026-08-${i}T12:00:00Z`,`2026-08-${i}T20:00:00Z`])
 const target=historical?next:first,base={amountCents:10000,earnedStart:'2026-08-03',earnedEnd:'2026-08-03'}
 const allocation=await api(`/employees/${e.id}/bonus-allocation/preview`,base)
 await api(`/employees/${e.id}/bonuses`,{...base,payPeriodId:target.id,classification:'NONDISCRETIONARY',paymentType:'ANNUAL_LUMP_SUM',confirmed:true,source:'Synthetic bonus earned in proportion to actual work hours',allocationMethod:'PROPORTIONAL_EARNED_HOURS',allocationMethodVerified:true,allocationFingerprint:allocation.fingerprint},201)
 const finalize=async(id,date)=>{const run=await api('/runs',{payPeriodId:id},201);await api(`/runs/${run.id}/status`,{status:'REVIEW'},200,'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},200,'PATCH');await api(`/runs/${run.id}/finalize`,{paymentDate:date,paymentConfirmationReference:'SYNTHETIC-EARNED-BONUS-PAYMENT'});return run}
 await api('/runs/preview',{payPeriodId:target.id});await h.pool.query("UPDATE payroll_compliance_task SET status='COMPLETE' WHERE facility_id=1")
 let prior
 if(historical){
  const missing=(await api('/runs/preview',{payPeriodId:target.id})).preview
  assert.ok(missing.warnings.some(w=>w.code==='BONUS_PAYMENT_RECONCILIATION'))
  prior=await finalize(first.id,'2026-08-14')
 }
 const preview=(await api('/runs/preview',{payPeriodId:target.id})).preview
 assert.equal(preview.canApprove,true,JSON.stringify(preview.warnings))
 const wages=preview.employees[0]
 assert.equal(wages.grossPayCents,(salary?150000:historical?100000:175000)+11667)
 assert.equal(wages.federalIncomeTaxCents,federalWithholding2026(wages.grossPayCents,{filingStatus:'SINGLE'},52))
 assert.equal(wages.stateIncomeTaxCents,marylandWithholding2026(wages.grossPayCents-10000,{filingStatus:'SINGLE',localRate:3.2,exemptions:1},'WEEKLY')+970)
 assert.equal(wages.payItems.find(p=>p.kind==='BONUS_OVERTIME').amountCents,1667)
 const proof=wages.payItems.find(p=>p.kind==='BONUS').bonusAllocation.coverage
 assert.ok(proof.evidence.every(p=>p.source===(historical?'FINALIZED_PAYROLL':'CURRENT_PAYROLL')))
 if(prior)assert.ok(proof.evidence.every(p=>p.runId===Number(prior.id)))
 const paid=await finalize(target.id,historical?'2026-08-21':'2026-08-14')
 const row=(await h.pool.query('SELECT * FROM payroll_run_employee WHERE payroll_run_id=$1',[paid.id])).rows[0]
 assert.equal(row.statement_snapshot.payItems.find(p=>p.kind==='BONUS_OVERTIME').amountCents,1667)
 assert.equal(row.statement_snapshot.payItems.find(p=>p.kind==='BONUS').bonusAllocation.fingerprint,allocation.fingerprint)
 assert.ok(statementLines(row).lines.some(line=>line[1]==='BONUS OVERTIME'&&line[2]===1667))
 assert.doesNotMatch(JSON.stringify(row.statement_snapshot),/Synthetic bonus earned/)
})
