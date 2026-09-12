import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {correctionPaymentFixture} from '../testing/correctionPaymentFixture.js'
import {journalPayload} from '../quickbooks.js'
import {loadSupplementalPaymentHistory} from '../supplementalPaymentHistory.js'
for(const options of [{missingTime:true},{sharedWeek:true}])test(`correction finalization settles source identity and dependent overtime: ${JSON.stringify(options)}`,{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const {api,request,input,target,e,entry}=await correctionPaymentFixture(h,options)
 const preview=await api(`/requests/${request.id}/payroll-correction-payment-preview`,input)
 assert.equal(preview.overtimeSource.status,'RECONCILED');assert.ok(Number.isSafeInteger(preview.overtimeSource.premiumCents));assert.equal(preview.overtimeSource.workedWagesDifferenceCents,preview.priorWageCorrectionCents)
 await api(`/requests/${request.id}/payroll-correction-authorizations`,{...input,fingerprint:preview.fingerprint,requestKey:'settlement-source-authorization',reason:'Authorize complete source amendment and overtime settlement',confirmed:true},'POST',201)
 const source=(await h.pool.query('SELECT * FROM payroll_time_entry ORDER BY id')).rows
 const run=await api('/runs',{payPeriodId:target.id},'POST',201)
 await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH')
 await api(`/runs/${run.id}/finalize`,{paymentDate:input.paymentDate,paymentConfirmationReference:'SYNTHETIC-SOURCE-CORRECTION-SETTLED'})
 assert.deepEqual((await h.pool.query('SELECT * FROM payroll_time_entry ORDER BY id')).rows,source)
 const settlement=(await h.pool.query('SELECT * FROM payroll_correction_settlement WHERE request_id=$1',[request.id])).rows[0]
 assert.equal(Number(settlement.employee_id),Number(e.id))
 assert.deepEqual(settlement.plan.overtimeSource,preview.overtimeSource)
 const overtimeReport=await api('/reports/overtime-review?year=2026',undefined,'GET')
 const overtimeRecord=overtimeReport.records.find(r=>r.runId===Number(run.id)),frozen=(await h.pool.query('SELECT calculation_snapshot FROM payroll_run WHERE id=$1',[run.id])).rows[0].calculation_snapshot.employees.find(row=>Number(row.employeeId)===Number(e.id))
 assert.equal(overtimeRecord.paidPremiumCents,frozen.workweekPayments.reduce((sum,w)=>sum+w.premiumCents,0)+preview.overtimeSource.premiumCents,JSON.stringify(overtimeRecord))

 const effective=(await h.pool.query('SELECT * FROM payroll_effective_time_entry ORDER BY id')).rows
 assert.equal(effective.length,source.length+(options.missingTime?1:0))
 const amended=effective.find(r=>String(r.id)===String(settlement.effective_entry_id))
 assert.equal(amended.clock_out.toISOString(),'2026-08-03T22:00:00.000Z')
 if(options.missingTime){assert.notEqual(String(amended.id),String(entry.id));assert.equal(amended.clock_in.toISOString(),'2026-08-03T20:00:00.000Z')}
 const paid=(await h.pool.query('SELECT * FROM payroll_run_employee WHERE payroll_run_id=$1',[run.id])).rows[0]
 assert.equal(Number(paid.net_pay_cents),preview.after.netPayCents)
 assert.equal(Number(paid.regular_minutes),preview.targetHours.after.regularMinutes);assert.equal(Number(paid.overtime_minutes),preview.targetHours.after.overtimeMinutes)
 assert.equal(paid.statement_snapshot.correctionSettlements[0].priorWageCorrectionCents,options.sharedWeek?5000:7500)
 assert.equal(paid.statement_snapshot.correctionSettlements[0].currentWageReclassificationCents,options.sharedWeek?2500:0)
 const history=await api(`/requests/${request.id}/payroll-correction-authorizations`,undefined,'GET')
 assert.equal(history[0].status,'SETTLED');assert.equal(history[0].settlement.effectiveEntryId,Number(amended.id))
 const payment=(await h.pool.query('SELECT r.*,COALESCE(r.payment_date,p.pay_date) AS pay_date FROM payroll_run r JOIN payroll_pay_period p ON p.id=r.pay_period_id WHERE r.id=$1',[run.id])).rows[0]
 const journal=journalPayload(payment,{wages:'1',employerTax:'2',reimbursements:'3',taxLiability:'4',deductions:'5',clearing:'6'})
 assert.equal(journal.TxnDate,input.paymentDate)
 assert.equal(Math.round(journal.Line.find(l=>l.JournalEntryLineDetail.AccountRef.value==='1').Amount*100),preview.after.grossPayCents)
 assert.equal(journal.Line.reduce((n,l)=>n+Math.round(l.Amount*100)*(l.JournalEntryLineDetail.PostingType==='Debit'?1:-1),0),0)
 const wageHistory=await loadSupplementalPaymentHistory(h.pool,1,e.id,input.paymentDate)
 assert.equal(wageHistory.reconciled,true);assert.equal(wageHistory.ytdSupplementalCents,options.sharedWeek?5000:7500)
})
