import test from 'node:test'
import assert from 'node:assert/strict'
import {retirementPlanInput} from '../retirementPlanInput.js'
const plan={taxYear:2026,planType:'STANDARD_401K',planId:'retirement-401k',effectiveOn:'2026-01-01',confirmed:true,name:'Synthetic 401(k)',providerName:'Synthetic Recordkeeper',planReference:'Reviewed signed plan document reference',eligibilityTerms:'Reviewed eligibility and entry dates in retained plan.',compensationTerms:'Reviewed eligible compensation definition in retained plan.',employeeTerms:'Reviewed employee election, effective-date and withdrawal terms.',allowsPretax:true,allowsRoth:true,allowsCatchUp:true,allowsHigherCatchUp:true,automaticEnrollment:'NOT_APPLICABLE',employerContributions:'NONE',compensation:{REGULAR:true,OVERTIME:true,BONUS:false,PAID_LEAVE:true},planOrdinaryDeferralLimitCents:null,planCatchUpLimitCents:null,reviewReference:'Independent synthetic plan administrator review'}
test('retirement configuration fingerprints reviewed terms without trusting extra client fields',()=>{
 const saved=retirementPlanInput({...plan,fingerprint:'forged',enabled:true,providerSecret:'private'})
 assert.match(saved.fingerprint,/^[a-f0-9]{64}$/);assert.equal(saved.enabled,undefined);assert.equal(saved.providerSecret,undefined)
 assert.equal(retirementPlanInput({...plan,employeeTerms:'First paragraph of actual election terms.\nSecond paragraph of withdrawal terms.'}).employeeTerms.includes('\n'),true)
 assert.equal(saved.fingerprint,retirementPlanInput({...plan,compensation:{PAID_LEAVE:true,BONUS:false,OVERTIME:true,REGULAR:true}}).fingerprint)
 for(const patch of [{allowsRoth:false},{effectiveOn:'2026-02-01'},{compensation:{...plan.compensation,BONUS:true}},{planOrdinaryDeferralLimitCents:1000000},{employeeTerms:'Changed actual employee election and withdrawal terms.'}])assert.notEqual(retirementPlanInput({...plan,...patch}).fingerprint,saved.fingerprint)
})
test('retirement setup preserves applicable automatic enrollment and employer formula requirements',()=>{
 for(const automaticEnrollment of ['APPLICABLE','UNRESOLVED']){
  assert.throws(()=>retirementPlanInput({...plan,automaticEnrollment}),{status:400})
  assert.equal(retirementPlanInput({...plan,automaticEnrollment,automaticEnrollmentTerms:'Reviewed automatic enrollment terms or unresolved applicability evidence'}).automaticEnrollment,automaticEnrollment)
 }
 for(const employerContributions of ['MATCH','NONELECTIVE','MATCH_AND_NONELECTIVE','UNRESOLVED']){
  assert.throws(()=>retirementPlanInput({...plan,employerContributions}),{status:400})
  assert.equal(retirementPlanInput({...plan,employerContributions,employerContributionTerms:'Retained employer contribution formula or unresolved review evidence'}).employerContributions,employerContributions)
 }
})
test('retirement setup refuses missing assumptions, invalid dates and ambiguous plan caps',()=>{
 for(const patch of [{taxYear:2027},{planType:'SIMPLE_401K'},{effectiveOn:'2026-02-30'},{confirmed:false},{allowsRoth:undefined},{allowsPretax:false,allowsRoth:false},{allowsCatchUp:false},{planOrdinaryDeferralLimitCents:undefined},{planOrdinaryDeferralLimitCents:-1},{planCatchUpLimitCents:0.5},{compensation:{REGULAR:true}},{compensation:{...plan.compensation,OTHER:true}},{planId:'bad_id'},{reviewReference:'bad\nreference'}])assert.throws(()=>retirementPlanInput({...plan,...patch}),{status:400})
 assert.equal(retirementPlanInput({...plan,allowsCatchUp:false,allowsHigherCatchUp:false,planCatchUpLimitCents:0}).planCatchUpLimitCents,0)
})
test('unused PTO terms are explicit, canonical and independent of paid leave compensation',()=>{
 const legacy=retirementPlanInput(plan)
 assert.equal(legacy.unusedPto,undefined)
 const unusedPto={inServiceDeferrals:'INCLUDED',postSeveranceDeferrals:'EXCLUDED',postSeverance415:'INCLUDED',limitationYear:'CALENDAR_YEAR',terms:'Retained signed plan cashout clauses and limitation year reference.'}
 const saved=retirementPlanInput({...plan,unusedPto})
 assert.deepEqual(saved.unusedPto,unusedPto);assert.notEqual(saved.fingerprint,legacy.fingerprint)
 assert.equal(retirementPlanInput({...saved,confirmed:true}).fingerprint,saved.fingerprint)
 assert.equal(retirementPlanInput({...plan,unusedPto:Object.fromEntries(Object.entries(unusedPto).reverse())}).fingerprint,saved.fingerprint)
 for(const key of ['inServiceDeferrals','postSeveranceDeferrals','postSeverance415']){
  for(const value of ['INCLUDED','EXCLUDED','REVIEW_REQUIRED']){
   const next=retirementPlanInput({...plan,unusedPto:{...unusedPto,[key]:value}})
   assert.equal(next.unusedPto[key],value)
   if(value!==unusedPto[key])assert.notEqual(next.fingerprint,saved.fingerprint)
  }
 }
 for(const limitationYear of ['NON_CALENDAR_YEAR','REVIEW_REQUIRED'])assert.notEqual(retirementPlanInput({...plan,unusedPto:{...unusedPto,limitationYear}}).fingerprint,saved.fingerprint)
 for(const p of [null,[],{}, {...unusedPto,terms:'too short'},{...unusedPto,inServiceDeferrals:true},{...unusedPto,postSeveranceDeferrals:undefined},{...unusedPto,postSeverance415:'YES'},{...unusedPto,limitationYear:'2026'},{...unusedPto,enabled:true}])assert.throws(()=>retirementPlanInput({...plan,unusedPto:p}),{status:400})
 assert.equal(retirementPlanInput({...plan,unusedPto:undefined}).fingerprint,legacy.fingerprint)
})
