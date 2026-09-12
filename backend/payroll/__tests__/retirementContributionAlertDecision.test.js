import test from 'node:test'
import assert from 'node:assert/strict'
import {retirementContributionAlertDecision as decide} from '../retirementContributionAlertDecision.js'
const assessment={authorizationId:'synthetic-original-contribution',status:'RECONCILED',payrollStatus:'MATCHED',bankStatus:'BANK_POSTED',receiptStatus:'POSTED',accountingStatus:'MATCHED',amountCents:1400,postedCents:1400,issues:[]}
test('combined alerts clear delivery warnings only when every contribution component reconciles',()=>{
 const result=decide(assessment);assert.equal(result.combinedAlert,'DISMISS');assert.equal(result.clearDeliveryWarnings,true)
 for(const patch of [{payrollStatus:'REVIEW_REQUIRED'},{bankStatus:'UNVERIFIED'},{receiptStatus:'UNVERIFIED'},{accountingStatus:'REQUIRED'},{returnAccountingStatus:'MATCHED'},{returnAccountingStatus:'REQUIRED'},{returnReviewRequired:true},{postedCents:1399},{postedCents:null},{issues:['Provider evidence needs review.']}]){const changed=decide({...assessment,...patch});assert.equal(changed.combinedAlert,'OPEN');assert.equal(changed.clearDeliveryWarnings,false);assert.notEqual(changed.fingerprint,result.fingerprint);assert.equal(changed.summary.status,'REVIEW_REQUIRED')}
 const delivery=decide({...assessment,status:'DELIVERY_EVIDENCE_MATCHED',accountingStatus:'REQUIRED'});assert.equal(delivery.combinedAlert,'OPEN');assert.equal(delivery.clearDeliveryWarnings,false)
})
test('routine observation timestamps do not create status changes and cancellation cannot clear separate delivery warnings',()=>{
 assert.equal(decide({...assessment,bankCheckedAt:'2026-09-12T12:00:00Z'}).fingerprint,decide({...assessment,bankCheckedAt:'2026-09-13T12:00:00Z'}).fingerprint)
 const cancelled=decide({...assessment,status:'CANCELLED'});assert.equal(cancelled.combinedAlert,'DISMISS');assert.equal(cancelled.clearDeliveryWarnings,false)
 assert.throws(()=>decide({...assessment,amountCents:1.5}));assert.throws(()=>decide({...assessment,status:'UNKNOWN'}));assert.throws(()=>decide({...assessment,issues:null}))
})

test('replacement closure requires every original return and replacement component and reopens on contradictions',()=>{
 const replacement={authorizationId:'replacement',originalAuthorizationId:assessment.authorizationId,status:'RECONCILED',caseStatus:'CLOSED',originalEvidenceStatus:'MATCHED',bankStatus:'BANK_POSTED',receiptStatus:'POSTED',deliveryStatus:'MATCHED',accountingStatus:'MATCHED',returnReviewRequired:false,amountCents:1400,postedCents:1400}
 const closed={...assessment,status:'REPLACEMENT_RECONCILED',bankStatus:'RETURN_CREDIT_POSTED',receiptStatus:'REVERSED',accountingStatus:'VERIFIED_WITH_RETURN',returnAccountingStatus:'MATCHED',returnReviewRequired:false,reversedAllocationCents:1400,postedCents:0,replacementCaseStatus:'CLOSED',replacementEvidence:replacement}
 const result=decide(closed);assert.equal(result.combinedAlert,'DISMISS');assert.equal(result.summary.status,'REPLACEMENT_RECONCILED');assert.equal(result.clearDeliveryWarnings,true)
 for(const patch of [{accountingStatus:'REVIEW_REQUIRED'},{bankStatus:'UNVERIFIED'},{receiptStatus:'UNVERIFIED'},{returnReviewRequired:true},{postedCents:1399},{originalAuthorizationId:'other'}]){const reopened=decide({...closed,replacementEvidence:{...replacement,...patch}});assert.equal(reopened.combinedAlert,'OPEN');assert.equal(reopened.summary.status,'REVIEW_REQUIRED');assert.equal(reopened.clearDeliveryWarnings,false)}
 for(const patch of [{returnAccountingStatus:'REQUIRED'},{reversedAllocationCents:1399},{payrollStatus:'REVIEW_REQUIRED'},{returnReviewRequired:true}])assert.equal(decide({...closed,...patch}).combinedAlert,'OPEN')
})
