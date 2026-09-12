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
