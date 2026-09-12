import test from 'node:test'
import assert from 'node:assert/strict'
import {retirementProcessingInput,retirementProcessingPolicies} from '../retirementProcessingReview.js'
const body={confirmed:true,disposition:'REVIEWED',catchUpAuthorized:false,reference:'Retained actual plan processing review',policies:{...retirementProcessingPolicies}}
test('retirement processing review requires explicit policies, permission and supporting evidence',()=>{
 const review=retirementProcessingInput(body)
 assert.equal(review.catchUpAuthorized,false);assert.deepEqual(review.policies,retirementProcessingPolicies)
 for(const patch of [{confirmed:false},{catchUpAuthorized:undefined},{catchUpAuthorized:'false'},{reference:''},{disposition:'ENABLED'},{policies:{...body.policies,affordability:'ASSUME_ENOUGH_PAY'}},{policies:{...body.policies,extra:'unreviewed'}}])assert.throws(()=>retirementProcessingInput({...body,...patch}))
 assert.equal(retirementProcessingInput({...body,disposition:'SUSPENDED'}).disposition,'SUSPENDED')
 assert.throws(()=>retirementProcessingInput({...body,disposition:'SUSPENDED',catchUpAuthorized:true}),/Suspended/)
 assert.equal(retirementProcessingInput({...body,catchUpAuthorized:true}).catchUpAuthorized,true)
})
