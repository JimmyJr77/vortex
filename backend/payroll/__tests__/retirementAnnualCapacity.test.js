import test from 'node:test'
import assert from 'node:assert/strict'
import {retirementAnnualCapacity} from '../retirementAnnualCapacity.js'
import {retirementAnnualInput} from '../retirementAnnualInput.js'
import {retirementPlanInput} from '../retirementPlanInput.js'
import {retirementAnnualFixture} from '../testing/retirementAnnualFixture.js'
import {retirementPlanFixture} from '../testing/retirementPlanFixture.js'
const internal={ordinaryDeferralsCents:0,catchUpDeferralsCents:0,planOrdinaryDeferralsCents:0,planCatchUpDeferralsCents:0,annualAdditionsCents:0,planCompensationCents:0,compensation415Cents:10000000}
const calculate=(facts={},terms={},ledger={})=>retirementAnnualCapacity({annual:retirementAnnualInput({...retirementAnnualFixture(),...facts}),plan:retirementPlanInput({...retirementPlanFixture(),...terms}),internal:{...internal,...ledger}})
test('annual capacity keeps individual aggregation distinct from the employer annual-additions group',()=>{
 const result=calculate({externalOrdinaryDeferralsCents:2000000,externalAnnualAdditionsCents:7000000})
 assert.equal(result.ordinaryRemainingCents,200000);assert.equal(result.annualAdditionsRemainingCents,200000);assert.equal(result.catchUpRemainingCents,0)
 const participant=calculate({participantOrdinaryCapCents:1500000,externalOrdinaryDeferralsCents:1200000,externalPlanOrdinaryDeferralsCents:100000,externalAnnualAdditionsCents:100000})
 assert.equal(participant.ordinaryRemainingCents,1250000)
 const exhausted=calculate({externalOrdinaryDeferralsCents:2500000});assert.equal(exhausted.ordinaryRemainingCents,0)
})
test('annual additions use earned compensation and exclude separately counted catch-up contributions',()=>{
 const result=calculate({ageAtYearEnd:61,priorYearSponsorFicaWagesCents:15000001,externalCatchUpDeferralsCents:100000},{allowsCatchUp:true,allowsHigherCatchUp:true,planCatchUpLimitCents:null},{compensation415Cents:200000,annualAdditionsCents:190000})
 assert.equal(result.annualAdditionsLimitCents,200000);assert.equal(result.ordinaryRemainingCents,10000);assert.equal(result.catchUpRemainingCents,1025000);assert.equal(result.limits.rothCatchUpRequired,true)
 const cap=calculate({ageAtYearEnd:61,participantCatchUpCapCents:250000,externalPlanCatchUpDeferralsCents:100000,externalCatchUpDeferralsCents:100000},{allowsCatchUp:true,allowsHigherCatchUp:true,planCatchUpLimitCents:null})
 assert.equal(cap.catchUpRemainingCents,150000)
})
test('annual capacity rejects unverified snapshots, missing ledgers and arithmetic overflow',()=>{
 const plan=retirementPlanInput(retirementPlanFixture()),annual=retirementAnnualInput(retirementAnnualFixture())
 assert.throws(()=>retirementAnnualCapacity({plan,annual:{...annual,ageAtYearEnd:60},internal}),/exact retained/)
 assert.throws(()=>retirementAnnualCapacity({plan,annual,internal:{}}),/explicitly/)
 assert.throws(()=>calculate({externalOrdinaryDeferralsCents:Number.MAX_SAFE_INTEGER},{},{ordinaryDeferralsCents:1}),/overflow/)
 assert.throws(()=>calculate({}, {},{planOrdinaryDeferralsCents:1}),/aggregate balances/)
 assert.equal(calculate({externalPlanCompensationCents:36000000}).compensationBelowLimitRemainingCents,0)
})
