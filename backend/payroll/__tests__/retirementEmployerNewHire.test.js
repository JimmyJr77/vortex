import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHistoricalHarness} from '../testing/historicalHarness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
import {retirementPlanFixture} from '../testing/retirementPlanFixture.js'
import {retirementAnnualFixture} from '../testing/retirementAnnualFixture.js'

test('a mid-period new hire can complete employer eligibility without a pre-employment assessment',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHistoricalHarness(t,{},'2026-09-16T16:00:00.000Z');t.after(()=>h.close())
 const {api,employee,periods}=await monthlyBenefitsFixture(h,{hireDate:'2026-09-09'})
 await api('/retirement-plans',{plan:{...retirementPlanFixture(),employerContributions:'NONELECTIVE',employerContributionTerms:'Synthetic employer contribution obligation.',employerFormula:{period:'PER_PAYROLL',matchCatchUp:false,matchTiers:[],nonelectiveBps:200,compensation:{REGULAR:true,OVERTIME:true,BONUS:false,PAID_LEAVE:true},eligibilityTerms:'Synthetic reviewed new hire entry terms.',vestingTerms:'Synthetic reviewed vesting schedule.'}},expectedRevision:0,requestKey:randomUUID()})
 const annualPath=`/employees/${employee.id}/retirement-annual-sources/standard`,annual=await api(annualPath)
 await api(annualPath,{planRevisionId:annual.planRevisionId,expectedRevision:0,requestKey:randomUUID(),facts:{...retirementAnnualFixture(),employerFunding:{compensationCents:0,matchingCents:0,nonelectiveCents:0,reference:'Synthetic verified zero external employer amounts.'}}})
 const eligibilityPath=`/employees/${employee.id}/retirement-employer-eligibility/standard`,source=await api(eligibilityPath)
 const review={sourceFingerprint:source.source.fingerprint,expectedRevision:0,requestKey:randomUUID(),confirmed:true,assessedFrom:'2026-09-09',assessedThrough:'2026-09-15',reference:'Synthetic eligibility assessed only for actual employment.',matching:{status:'NOT_APPLICABLE',eligibleOn:null,vestedBps:null},nonelective:{status:'ELIGIBLE',eligibleOn:'2026-09-09',vestedBps:0}}
 await api(eligibilityPath,{...review,assessedFrom:'2026-09-01'},'POST',400)
 await api(eligibilityPath,review)
 const preview=(await api('/runs/preview',{payPeriodId:periods[0].id})).preview
 const funding=preview.employees[0].employerCompensationPreview
 assert.ok(funding,JSON.stringify(preview.warnings))
 assert.equal(funding.eligibility.status,'REVIEWED_FOR_PAY_PERIOD',JSON.stringify(funding.eligibility))
 assert.equal(funding.eligibility.periodStart,'2026-09-09');assert.equal(funding.periodStart,'2026-09-01')
 assert.equal(funding.eligibility.coverage.clippedForNewHire,true)
 assert.equal(funding.eligibility.components.nonelective.eligible,true)
 assert.equal(funding.eligibleCompensationCents,20000)
 assert.equal(funding.requiresEmployerEligibilityReview,false)
 assert.equal(funding.requiresApprovalReservation,true);assert.equal(preview.canApprove,false)
 // A later plan entry within actual employment still needs dated allocation.
 await api(eligibilityPath,{...review,expectedRevision:1,requestKey:randomUUID(),nonelective:{...review.nonelective,eligibleOn:'2026-09-12'}})
 const later=(await api('/runs/preview',{payPeriodId:periods[0].id})).preview.employees[0].employerCompensationPreview
 assert.equal(later.eligibility.status,'REVIEW_REQUIRED');assert.match(later.eligibility.message,/inside the contribution period/)
})
