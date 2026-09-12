import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {loadSupplementalPaymentHistory} from '../supplementalPaymentHistory.js'
for(const aggregate of [false,true])for(const overtime of [true,false])test(`earned standalone bonus ${aggregate?'aggregate':'flat'} ${overtime?'with':'without'} overtime requires paid workweeks and freezes settlement evidence`,{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200,method='POST')=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method,headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});const j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j.data}
 await api('/settings',{legalBusinessName:'Earned Standalone Fixture',businessAddress:'123 Test Street',businessPhone:'5550100000'},200,'PATCH')
 await api('/employer-taxes',{futaRatePercent:0.6,mdUiRatePercent:2.6,source:'Synthetic verified employer tax notice',confirmed:true},200,'PATCH')
 const e=await api('/employees',{employeeNumber:'EARNED-OFF-CYCLE',legalFirstName:'Earned',legalLastName:'Employee',hireDate:'2026-08-03',hourlyRateCents:2500},201)
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE',w4_status='COMPLETE',state_withholding_status='COMPLETE' WHERE id=$1",[e.id])
 await api(`/employees/${e.id}/tax-elections`,{confirmed:true,sourceNote:'Synthetic signed tax elections',federal:{filingStatus:'SINGLE'},maryland:{filingStatus:'SINGLE',localRate:3.2,exemptions:1}},200,'PATCH')
 const p=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-08-03','2026-08-09','2026-08-14','WEEKLY') RETURNING id")).rows[0]
 for(let i=3;i<=8;i++)await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,$2,$3,'ADMIN','APPROVED')",[e.id,`2026-08-0${i}T12:00:00Z`,`2026-08-0${i}T${overtime?'22':'17'}:00:00Z`])
 const allocation=await api(`/employees/${e.id}/bonus-allocation/preview`,{amountCents:10000,earnedStart:'2026-08-03',earnedEnd:'2026-08-03'})
 assert.equal(allocation.additionalOvertimeCents,overtime?1667:0)
 const bonus={employeeId:e.id,amountCents:10000,classification:'NONDISCRETIONARY',paymentType:'ANNUAL_LUMP_SUM',confirmed:true,source:'Synthetic promised bonus earned proportionally by hours',earnedStart:allocation.earnedStart,earnedEnd:allocation.earnedEnd,allocationFingerprint:allocation.fingerprint,allocationMethod:'PROPORTIONAL_EARNED_HOURS',allocationMethodVerified:true,historyCompleteVerified:true,stateBonusRateVerified:true,historySource:'Synthetic complete employer payment history review',requestKey:'synthetic-earned-off-cycle-bonus-1'}
 const date=aggregate?'2026-08-15':'2026-09-09',federal=aggregate&&!overtime?1200:overtime?2567:2200
 if(aggregate){bonus.federalMethod='AGGREGATE';await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-08-10','2026-08-16','2026-08-21','WEEKLY')")}
 const body={payPeriodId:p.id,paymentDate:date,offCycleBonus:bonus}
 const unpaid=(await api('/runs/preview',body)).preview
 assert.ok(unpaid.warnings.some(w=>w.code==='BONUS_PAYMENT_RECONCILIATION'&&w.blocking),'Matching processing period must not bypass paid-work coverage')
 await api('/runs/preview',{payPeriodId:p.id});await h.pool.query("UPDATE payroll_compliance_task SET status='COMPLETE' WHERE facility_id=1")
 const original=await api('/runs',{payPeriodId:p.id},201)
 await api(`/runs/${original.id}/status`,{status:'REVIEW'},200,'PATCH');await api(`/runs/${original.id}/status`,{status:'APPROVED'},200,'PATCH')
 await api(`/runs/${original.id}/finalize`,{paymentDate:'2026-08-14',paymentConfirmationReference:'SYNTHETIC-ORIGINAL-WAGES'})
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date='2026-08-08' WHERE id=$1",[e.id])
 const stale=(await api('/runs/preview',body)).preview
 assert.ok(stale.warnings.some(w=>w.code==='BONUS_PAYMENT_RECONCILIATION'&&w.blocking))
 const currentAllocation=await api(`/employees/${e.id}/bonus-allocation/preview`,{amountCents:10000,earnedStart:'2026-08-03',earnedEnd:'2026-08-03'})
 bonus.allocationFingerprint=currentAllocation.fingerprint
 const preview=(await api('/runs/preview',body)).preview,w=preview.employees[0]
 assert.equal(w.grossPayCents,overtime?11667:10000);assert.equal(w.regularPayCents,0);assert.equal(w.sickLeaveAccrualMinutes,0)
 assert.equal(w.federalIncomeTaxCents,federal);assert.equal(w.stateIncomeTaxCents,overtime?null:970);assert.equal(w.netPayCents,overtime?null:aggregate?7065:6065)
 const proof=w.payItems.find(p=>p.kind==='BONUS').bonusAllocation.coverage
 assert.ok(proof.evidence.every(e=>e.source==='FINALIZED_PAYROLL'&&e.runId===Number(original.id)))
 assert.equal(w.payItems.find(p=>p.kind==='BONUS_OVERTIME')?.federalSupplemental,overtime?true:undefined)
 const run=await api('/runs',body,201)
 await api(`/runs/${run.id}/status`,{status:'REVIEW'},200,'PATCH')
 if(overtime){await api(`/runs/${run.id}/status`,{status:'APPROVED'},409,'PATCH')
 await api(`/runs/${run.id}/employees/${e.id}/withholding`,{federalIncomeTaxCents:2567,stateIncomeTaxCents:1100,sourceNote:'Synthetic professional worksheet for bonus and overtime',professionalConfirmed:true},200,'PATCH')}
 await api(`/runs/${run.id}/status`,{status:'APPROVED'},200,'PATCH')
 await api(`/runs/${run.id}/finalize`,{paymentDate:date,paymentConfirmationReference:'SYNTHETIC-EARNED-BONUS'})
 const paid=(await h.pool.query('SELECT * FROM payroll_run_employee WHERE payroll_run_id=$1',[run.id])).rows[0]
 assert.equal(Number(paid.net_pay_cents),overtime?7108:aggregate?7065:6065)
 assert.deepEqual(paid.statement_snapshot.payItems.find(p=>p.kind==='BONUS').bonusAllocation.coverage,proof)
 assert.equal(Number(paid.regular_minutes)+Number(paid.overtime_minutes),0)
 const history=await loadSupplementalPaymentHistory(h.pool,1,e.id,date)
 assert.equal(history.reconciled,true);assert.equal(history.ytdSupplementalCents,overtime?11667:10000)
 assert.equal((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_leave_transaction WHERE employee_id=$1',[e.id])).rows[0].n,1)
})
