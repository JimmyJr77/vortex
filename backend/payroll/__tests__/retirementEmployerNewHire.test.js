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
 await api('/retirement-plans',{plan:{...retirementPlanFixture(),employerContributions:'MATCH_AND_NONELECTIVE',employerContributionTerms:'Synthetic employer contribution obligation.',employerFormula:{period:'PER_PAYROLL',matchCatchUp:false,matchTiers:[{upToBps:300,matchBps:10000}],nonelectiveBps:200,compensation:{REGULAR:true,OVERTIME:true,BONUS:false,PAID_LEAVE:true},eligibilityTerms:'Synthetic reviewed new hire entry terms.',vestingTerms:'Synthetic reviewed vesting schedule.'}},expectedRevision:0,requestKey:randomUUID()})
 const annualPath=`/employees/${employee.id}/retirement-annual-sources/standard`,annual=await api(annualPath)
 await api(annualPath,{planRevisionId:annual.planRevisionId,expectedRevision:0,requestKey:randomUUID(),facts:{...retirementAnnualFixture(),employerFunding:{compensationCents:0,matchingCents:0,nonelectiveCents:0,reference:'Synthetic verified zero external employer amounts.'}}})
 const eligibilityPath=`/employees/${employee.id}/retirement-employer-eligibility/standard`,source=await api(eligibilityPath)
 const review={sourceFingerprint:source.source.fingerprint,expectedRevision:0,requestKey:randomUUID(),confirmed:true,assessedFrom:'2026-09-09',assessedThrough:'2026-09-15',reference:'Synthetic eligibility assessed only for actual employment.',matching:{status:'NOT_ELIGIBLE',eligibleOn:null,vestedBps:null},nonelective:{status:'ELIGIBLE',eligibleOn:'2026-09-09',vestedBps:0}}
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
 assert.equal(funding.obligationPreview.obligation.nonelectiveCents,400)
 assert.equal(funding.obligationPreview.ordinaryDeferralsCents,null)
 assert.equal(funding.obligationPreview.deferralEvidence,'NOT_REQUIRED')
 assert.equal(funding.requiresObligationCalculation,false)
 assert.equal(funding.obligationPreview.requiresAnnualAdditionsReview,true)
 assert.match(preview.warnings.find(w=>w.code==='RETIREMENT_PAYROLL_REVIEW').message,/Nonelective obligation: \$4\.00/)
 assert.equal(funding.requiresApprovalReservation,true);assert.equal(preview.canApprove,false)
 await api(eligibilityPath,{...review,expectedRevision:1,requestKey:randomUUID(),matching:{status:'ELIGIBLE',eligibleOn:'2026-09-09',vestedBps:0}})
 const partial=(await api('/runs/preview',{payPeriodId:periods[0].id})).preview.employees[0].employerCompensationPreview
 assert.equal(partial.obligationPreview.obligation.matchingCents,null);assert.equal(partial.obligationPreview.obligation.nonelectiveCents,400)
 assert.equal(partial.obligationPreview.status,'DEFERRAL_EVIDENCE_REQUIRED');assert.equal(partial.requiresObligationCalculation,true)
 const deferralPath=`/employees/${employee.id}/retirement-eligibility/standard`,deferralSource=await api(deferralPath)
 await api(deferralPath,{sourceFingerprint:deferralSource.source.fingerprint,expectedRevision:0,requestKey:randomUUID(),confirmed:true,disposition:'ELIGIBLE',eligibleOn:'2026-09-09',methods:['PERCENTAGE'],reference:'Synthetic reviewed employee deferral eligibility.',employeeExplanation:'Eligible to elect employee deferrals under reviewed terms.'})
 const proposal=(await api('/retirement',undefined,'GET',200,true)).plans[0].proposal
 const elect=async(pretax,roth,expectedRevision,action='ELECT')=>api('/retirement/standard/elections',{action,method:'PERCENTAGE',pretax,roth,signature:'Monthly Benefits',confirmed:true,effectiveOn:'2026-09-17',expectedRevision,requestKey:randomUUID(),proposalFingerprint:proposal.fingerprint},'POST',200,true)
 await elect(500,200,0)
 const processingPath='/retirement-plans/standard/processing-review',processing=await api(processingPath)
 const pendingPolicy=(await api('/runs/preview',{payPeriodId:periods[0].id})).preview.employees[0].employerCompensationPreview
 assert.match(pendingPolicy.deferralPreview.message,/processing policies/)
 await api(processingPath,{planRevisionId:processing.planRevisionId,expectedRevision:0,requestKey:randomUUID(),review:{disposition:'REVIEWED',catchUpAuthorized:false,confirmed:true,reference:'Synthetic reviewed deferral preview processing policies.',policies:processing.policies}})
 assert.equal((await api(processingPath)).executionIssues.length,1)
 const matchedPayroll=(await api('/runs/preview',{payPeriodId:periods[0].id})).preview,matched=matchedPayroll.employees[0].employerCompensationPreview
 assert.equal(matched.deferralPreview.status,'CALCULATED_NOT_APPLIED',JSON.stringify(matched.deferralPreview))
 assert.equal(matched.deferralPreview.ordinaryDeferralsCents,1400);assert.equal(matched.deferralPreview.catchUpDeferralsCents,0)
 assert.equal(matched.deferralPreview.calculation.previewOnly,true)
 assert.deepEqual(matched.obligationPreview.obligation,{matchingCents:600,nonelectiveCents:400,totalCents:1000})
 assert.equal(matchedPayroll.employees[0].netPayCents,preview.employees[0].netPayCents)
 assert.equal(matchedPayroll.canApprove,false)
 assert.equal((await h.pool.query('SELECT count(*)::int n FROM payroll_retirement_run_ledger')).rows[0].n,0)
 await elect(0,10000,1)
 const unaffordable=(await api('/runs/preview',{payPeriodId:periods[0].id})).preview.employees[0].employerCompensationPreview
 assert.equal(unaffordable.deferralPreview.status,'REVIEW_REQUIRED');assert.match(unaffordable.deferralPreview.message,/cannot cover/)
 assert.equal(unaffordable.obligationPreview.obligation.matchingCents,null)
 await elect(0,0,2,'DECLINE')
 const declined=(await api('/runs/preview',{payPeriodId:periods[0].id})).preview.employees[0].employerCompensationPreview
 assert.equal(declined.deferralPreview.ordinaryDeferralsCents,0)
 assert.deepEqual(declined.obligationPreview.obligation,{matchingCents:0,nonelectiveCents:400,totalCents:400})
 // A later plan entry within actual employment still needs dated allocation.
 await api(eligibilityPath,{...review,expectedRevision:2,requestKey:randomUUID(),nonelective:{...review.nonelective,eligibleOn:'2026-09-12'}})
 const later=(await api('/runs/preview',{payPeriodId:periods[0].id})).preview.employees[0].employerCompensationPreview
 assert.equal(later.eligibility.status,'REVIEW_REQUIRED');assert.match(later.eligibility.message,/inside the contribution period/)
 assert.equal(later.obligationPreview,null)
})
