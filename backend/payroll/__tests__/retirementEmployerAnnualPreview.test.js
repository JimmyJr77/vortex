import test from 'node:test'
import assert from 'node:assert/strict'
import {retirementEmployerAnnualPreview as preview} from '../retirementEmployerAnnualPreview.js'
const fixture=()=>({
 compensation:{planFingerprint:'plan',annualSourceFingerprint:'annual',source:{planRevisionId:'1',annualSourceId:'2'}},fundingSourceFingerprint:'funding',
 deferralPreview:{status:'CALCULATED_NOT_APPLIED',fingerprint:'deferral',ordinaryDeferralsCents:100,catchUpDeferralsCents:200,calculation:{previewOnly:true,planFingerprint:'plan',annualSourceFingerprint:'annual',source:{planRevisionId:'1',annualSourceId:'2'},ordinary:{pretax:75,roth:25},catchUp:{pretax:100,roth:100},capacity:{planFingerprint:'plan',annualSourceFingerprint:'annual',annualAdditionsLimitCents:1000,used:{annualAdditionsCents:700},annualAdditionsRemainingCents:300}}},
 obligationPreview:{fingerprint:'obligation',planFingerprint:'plan',sourceFingerprint:'funding',obligation:{matchingCents:100,nonelectiveCents:100,totalCents:200}}
})
test('shared annual capacity includes ordinary deferrals but excludes catch-up and preserves full obligation',()=>{
 const input=fixture(),exact=preview(input)
 assert.equal(exact.remainingAfterEmployeeDeferralsCents,200)
 assert.equal(exact.excessCents,0)
 assert.equal(exact.status,'GROSS_OBLIGATION_FITS_REVIEWED_CAPACITY')
 input.obligationPreview.obligation.nonelectiveCents++
 input.obligationPreview.obligation.totalCents++
 const over=preview(input)
 assert.equal(over.excessCents,1)
 assert.equal(over.grossEmployerObligationCents,201)
 assert.equal(over.status,'GROSS_OBLIGATION_CAPACITY_SHORTFALL')
 assert.equal(input.obligationPreview.obligation.totalCents,201)
 assert.notEqual(over.fingerprint,exact.fingerprint)
 assert.equal(over.requiresApprovalReservation,true)
 assert.equal(over.requiresPayrollIntegration,true)
})
test('unresolved deferrals and obligations remain unknown',()=>{
 const input=fixture()
 input.deferralPreview=null
 assert.equal(preview(input).excessCents,null)
 assert.equal(preview(input).status,'DEFERRAL_REVIEW_REQUIRED')
 input.deferralPreview=fixture().deferralPreview;input.obligationPreview=null
 assert.equal(preview(input).status,'OBLIGATION_REVIEW_REQUIRED')
 assert.equal(preview(input).remainingAfterEmployeeDeferralsCents,null)
})
test('rejects inconsistent sources, amounts and overflow',()=>{
 const mutations=[
  x=>x.deferralPreview.calculation.source.annualSourceId='different',
  x=>x.deferralPreview.calculation.planFingerprint='different',
  x=>x.obligationPreview.sourceFingerprint='different',
  x=>x.deferralPreview.calculation.capacity.annualSourceFingerprint='different',
  x=>x.deferralPreview.ordinaryDeferralsCents++,
  x=>x.deferralPreview.calculation.capacity.annualAdditionsRemainingCents++,
  x=>x.obligationPreview.obligation.totalCents++,
  x=>x.deferralPreview.calculation.ordinary.pretax=-1,
  x=>x.deferralPreview.calculation.ordinary.pretax=Number.MAX_SAFE_INTEGER
 ]
 for(const mutate of mutations){const input=fixture();mutate(input);assert.throws(()=>preview(input),{status:409})}
})
