import test from 'node:test'
import assert from 'node:assert/strict'
import {reconcileAggregateBasis} from '../aggregatePaymentBasis.js'
const current={id:2,period_start:'2026-09-07',period_end:'2026-09-13',frequency:'WEEKLY'}
const regular={runId:1,runKind:'REGULAR',periodStart:'2026-08-31',periodEnd:'2026-09-06',payFrequency:'WEEKLY',paymentDate:'2026-09-08',grossCents:10000,supplementalCents:0,federalIncomeTaxCents:0}
const supplemental={runId:2,runKind:'OFF_CYCLE_PTO',paymentDate:'2026-09-08',grossCents:10000,supplementalCents:10000,federalIncomeTaxCents:0}
const history=(evidence)=>({reconciled:true,evidence,fingerprint:'synthetic-history'})
test('aggregate basis includes all earlier supplemental payments in the current payroll period and actual withholding once',()=>{
 const result=reconcileAggregateBasis(history([regular,supplemental,{...supplemental,runId:3,paymentDate:'2026-09-09',federalIncomeTaxCents:100}]),current,'2026-09-09')
 assert.equal(result.regularRunId,1);assert.equal(result.regularWagesCents,10000);assert.equal(result.regularFederalWithheldCents,0)
 assert.equal(result.previousSupplementalCents,20000);assert.equal(result.previousFederalWithheldCents,100);assert.deepEqual(result.previousRunIds,[2,3])
 const older={...supplemental,runId:4,paymentDate:'2026-09-06'}
 assert.equal(reconcileAggregateBasis(history([regular,older]),current,'2026-09-09').previousSupplementalCents,0)
 assert.notEqual(result.fingerprint,reconcileAggregateBasis(history([regular,supplemental]),current,'2026-09-09').fingerprint)
})
test('aggregate basis rejects missing, stale, mixed, duplicate and cross-year regular wages',()=>{
 for(const rows of [[],[{...regular,periodStart:'2026-08-24',periodEnd:'2026-08-30'}],[{...regular,supplementalCents:100}],[regular,{...regular,runId:4}],[regular,{...supplemental,grossCents:10001}]])assert.throws(()=>reconcileAggregateBasis(history(rows),current,'2026-09-09'))
 assert.throws(()=>reconcileAggregateBasis({...history([regular]),reconciled:false},current,'2026-09-09'),/Reconcile/)
 assert.throws(()=>reconcileAggregateBasis(history([regular]),current,'2026-09-14'),/containing/)
 assert.throws(()=>reconcileAggregateBasis(history([regular]),{...current,frequency:'MONTHLY',period_start:'2026-09-01',period_end:'2026-10-31'},'2026-09-09'),/complete/)
 const january={...current,period_start:'2026-01-01',period_end:'2026-01-31',frequency:'MONTHLY'}
 assert.throws(()=>reconcileAggregateBasis(history([{...regular,payFrequency:'MONTHLY',periodStart:'2025-12-01',periodEnd:'2025-12-31',paymentDate:'2025-12-31'}]),january,'2026-01-02'),/Cross-year/)
})

test('aggregate basis uses reconciled income-tax wages after retirement while preserving actual withholding',()=>{
 const result=reconcileAggregateBasis(history([{...regular,incomeTaxGrossCents:9000},{...supplemental,incomeTaxGrossCents:8000,supplementalCents:8000,federalIncomeTaxCents:1760}]),current,'2026-09-09')
 assert.equal(result.regularWagesCents,9000);assert.equal(result.previousSupplementalCents,8000);assert.equal(result.previousFederalWithheldCents,1760)
 assert.throws(()=>reconcileAggregateBasis(history([{...regular,incomeTaxGrossCents:-1}]),current,'2026-09-09'),/regular wages/)
})
