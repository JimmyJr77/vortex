import test from 'node:test'
import assert from 'node:assert/strict'
import {reconcileMarylandPaymentHistory} from '../marylandPaymentHistory.js'
import {ptoStateReviewBasis,applyPtoStateReview} from '../ptoStateWithholding.js'
const row=()=>{
 const basis={version:1,source:'NATIVE_ENGINE',year:2026,workState:'MD',residenceState:'MD',grossWagesCents:10000,federalWagesCents:10000,marylandWagesCents:10000,marylandRegularWagesCents:10000,marylandAnnualBonusWagesCents:0,pretaxDeductionCents:0}
 return {run_id:1,employee_id:2,run_kind:'REGULAR',payment_date:'2026-09-10',regular_pay_cents:10000,overtime_pay_cents:0,other_taxable_pay_cents:0,federal_income_tax_cents:2200,state_income_tax_cents:500,pretax_deduction_cents:0,calculation_snapshot:{employees:[{employeeId:2,grossPayCents:10000,federalIncomeTaxCents:2200,stateIncomeTaxCents:500,incomeTaxWageBasis:basis}]},statement_snapshot:{incomeTaxWageBasis:structuredClone(basis)}}
}
test('Maryland history reconciles state wages and invalidates PTO review when state evidence changes',()=>{
 const original=row(),history=reconcileMarylandPaymentHistory([original])
 assert.equal(history.reconciled,true);assert.equal(history.evidence[0].marylandWagesCents,10000);assert.equal(history.evidence[0].stateIncomeTaxCents,500)
 const source={year:2026,workState:'MD',residenceState:'MD',federalIncomeTaxCents:2200,marylandHistory:history},basis=ptoStateReviewBasis(source)
 const review={confirmed:true,basisFingerprint:basis.fingerprint,stateIncomeTaxCents:760,sourceReference:'Reviewed exact Maryland history and PTO calculation'}
 assert.equal(applyPtoStateReview(review,basis).stateIncomeTaxCents,760)
 original.state_income_tax_cents=501
 const changed=reconcileMarylandPaymentHistory([original]);assert.equal(changed.reconciled,false);assert.notEqual(changed.fingerprint,history.fingerprint);assert.equal(changed.evidence[0].stateIncomeTaxCents,null)
 assert.throws(()=>applyPtoStateReview(review,ptoStateReviewBasis({...source,marylandHistory:changed})),/changed/)
 original.calculation_snapshot.employees[0].stateIncomeTaxCents=501
 const corrected=reconcileMarylandPaymentHistory([original]);assert.equal(corrected.reconciled,true);assert.notEqual(corrected.fingerprint,history.fingerprint)
 assert.throws(()=>applyPtoStateReview(review,ptoStateReviewBasis({...source,marylandHistory:corrected})),/changed/)
})
test('Maryland history rejects missing, contradictory and duplicate evidence without exposing source snapshots',()=>{
 const original=row(),second={...row(),run_id:3}
 assert.deepEqual(reconcileMarylandPaymentHistory([original,second]),reconcileMarylandPaymentHistory([second,original]))
 assert.equal(reconcileMarylandPaymentHistory([original,original]).reconciled,false)
 for(const mutate of [r=>{r.statement_snapshot.incomeTaxWageBasis.marylandWagesCents=9000},r=>{r.calculation_snapshot.employees={}},r=>{r.state_income_tax_cents=null}]){
  const r=row();mutate(r);const result=reconcileMarylandPaymentHistory([r]);assert.equal(result.reconciled,false);assert.equal(result.evidence[0].marylandWagesCents,null)
 }
 const invalid=row();invalid.regular_pay_cents=9999;const invalidBefore=reconcileMarylandPaymentHistory([invalid]);invalid.regular_pay_cents=9998;assert.notEqual(reconcileMarylandPaymentHistory([invalid]).fingerprint,invalidBefore.fingerprint)
 assert.deepEqual(Object.keys(reconcileMarylandPaymentHistory([original]).evidence[0]).sort(),['employeeId','marylandWagesCents','paymentDate','reconciled','runId','sourceFingerprint','stateIncomeTaxCents'].sort())
})
