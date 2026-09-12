import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {retirementContributionCalculation} from '../retirementContributionCalculation.js'
import {retirementPlanInput} from '../retirementPlanInput.js'
import {retirementAnnualInput} from '../retirementAnnualInput.js'
import {retirementElectionInput,retirementElectionProposal} from '../retirementElectionInput.js'
import {retirementPlanFixture} from '../testing/retirementPlanFixture.js'
import {retirementAnnualFixture} from '../testing/retirementAnnualFixture.js'
function fixture({facts={},terms={},choice={}}={}){
 const plan=retirementPlanInput({...retirementPlanFixture(),...terms}),annual=retirementAnnualInput({...retirementAnnualFixture(),...facts})
 const proposal=retirementElectionProposal(plan,{facilityId:1,employeeId:1,onboardingCycle:1,planRevision:1,eligibilityRevisionId:randomUUID(),employeeExplanation:'Verified current employee eligibility.',earliestEffectiveOn:'2026-09-12',methods:['PERCENTAGE','FIXED_PER_REGULAR_PAY']})
 const election=retirementElectionInput({confirmed:true,signature:'Synthetic Employee',action:'ELECT',method:'PERCENTAGE',pretax:500,roth:200,effectiveOn:'2026-09-12',requestKey:randomUUID(),proposalFingerprint:proposal.fingerprint,...choice},proposal)
 return {plan,annual,election,internal:{ordinaryDeferralsCents:0,catchUpDeferralsCents:0,planOrdinaryDeferralsCents:0,planCatchUpDeferralsCents:0,annualAdditionsCents:0,planCompensationCents:0,compensation415Cents:0},payDate:'2026-09-15',runKind:'REGULAR',compensation:{REGULAR:100000,OVERTIME:10000,BONUS:50000,PAID_LEAVE:10000},compensation415Cents:170000,availableDeductionCents:100000,catchUpAuthorized:false}
}
test('contribution proposals apply reviewed compensation categories and preserve pretax/Roth units',()=>{
 const input=fixture(),result=retirementContributionCalculation(input)
 assert.equal(result.eligibleCompensationCents,120000);assert.equal(result.pretaxCents,6000);assert.equal(result.rothCents,2400);assert.equal(result.totalCents,8400)
 const decline=retirementContributionCalculation(fixture({choice:{action:'DECLINE',pretax:0,roth:0}}));assert.equal(decline.totalCents,0)
 assert.throws(()=>retirementContributionCalculation({...input,payDate:'2026-09-11'}),/applicable signed/)
 assert.throws(()=>retirementContributionCalculation({...input,availableDeductionCents:8399}),/Available pay/)
})
test('limits allocate exact cents without converting a pretax election to mandatory Roth catch-up',()=>{
 const input=fixture({facts:{ageAtYearEnd:61,priorYearSponsorFicaWagesCents:15000001,externalOrdinaryDeferralsCents:2449999},terms:{allowsCatchUp:true,allowsHigherCatchUp:true,planCatchUpLimitCents:null},choice:{pretax:100,roth:100}})
 const result=retirementContributionCalculation({...input,catchUpAuthorized:true})
 assert.deepEqual(result.ordinary,{pretax:1,roth:0});assert.deepEqual(result.catchUp,{pretax:0,roth:1200});assert.equal(result.uncollectedCents,1199)
 const noCatchUp=retirementContributionCalculation(input);assert.equal(noCatchUp.totalCents,1)
})
test('compensation thresholds, fixed elections and fractional cents cannot exceed eligible wages',()=>{
 const input=fixture({facts:{externalPlanCompensationCents:35999999,compensationCapTreatment:'FIRST_COMPENSATION_LIMIT'},choice:{pretax:5000,roth:5000}})
 const result=retirementContributionCalculation(input);assert.equal(result.eligibleCompensationCents,1);assert.equal(result.totalCents,1);assert.deepEqual(result.ordinary,{pretax:1,roth:0})
 const fixed=fixture({choice:{method:'FIXED_PER_REGULAR_PAY',pretax:10000,roth:5000}})
 assert.equal(retirementContributionCalculation(fixed).totalCents,15000)
 const offCycle=retirementContributionCalculation({...fixed,runKind:'OFF_CYCLE'});assert.equal(offCycle.totalCents,0);assert.equal(offCycle.notAppliedReason,'REGULAR_PAY_ONLY')
 assert.throws(()=>retirementContributionCalculation({...fixed,compensation:{REGULAR:1000}}),/every compensation/)
})
test('unused PTO uses separate reviewed eligible and annual-additions compensation without treating it as taken leave',()=>{
 const terms={unusedPto:{inServiceDeferrals:'INCLUDED',postSeveranceDeferrals:'EXCLUDED',postSeverance415:'EXCLUDED',limitationYear:'CALENDAR_YEAR',terms:'Reviewed actual payout compensation definition.'}}
 for(const limitationYear of ['NON_CALENDAR_YEAR','REVIEW_REQUIRED'])assert.throws(()=>retirementContributionCalculation(fixture({terms:{unusedPto:{...terms.unusedPto,limitationYear}}})),/plan limitation year/)
 const f=fixture({terms}),compensation={REGULAR:0,OVERTIME:0,BONUS:0,PAID_LEAVE:0}
 const unusedPto={paymentTiming:'IN_SERVICE',grossCents:100000,eligibleCents:100000,compensation415Cents:100000,assessmentFingerprint:'a'.repeat(64)}
 const result=retirementContributionCalculation({...f,runKind:'OFF_CYCLE',compensation,compensation415Cents:100000,unusedPto})
 assert.equal(result.pretaxCents,5000);assert.equal(result.rothCents,2000);assert.equal(result.planCompensationCents,100000)
 const excluded=retirementContributionCalculation({...f,runKind:'OFF_CYCLE',compensation,compensation415Cents:0,unusedPto:{...unusedPto,paymentTiming:'POST_SEVERANCE',eligibleCents:0,compensation415Cents:0}})
 assert.equal(excluded.totalCents,0);assert.equal(excluded.compensation415Cents,0)
 for(const patch of [{eligibleCents:100001},{grossCents:-1},{assessmentFingerprint:'forged'},{compensation415Cents:0}])assert.throws(()=>retirementContributionCalculation({...f,compensation,compensation415Cents:100000,unusedPto:{...unusedPto,...patch}}),/reconciled unused PTO/)
 assert.throws(()=>retirementContributionCalculation({...f,runKind:'OFF_CYCLE',compensation,compensation415Cents:100000,unusedPto:{...unusedPto,paymentTiming:'POST_SEVERANCE'}}),/current plan cashout terms/)
 const fixed=fixture({terms,choice:{method:'FIXED_PER_REGULAR_PAY',pretax:1000,roth:500}})
 assert.equal(retirementContributionCalculation({...fixed,runKind:'OFF_CYCLE',compensation,compensation415Cents:100000,unusedPto}).totalCents,0)
})
