import test from 'node:test'
import assert from 'node:assert/strict'
import {employerCompensationAllocation} from '../retirementEmployerCompensation.js'
import {retirementPlanInput} from '../retirementPlanInput.js'
import {retirementAnnualInput} from '../retirementAnnualInput.js'
import {retirementEmployerCalculation} from '../retirementEmployerCalculation.js'
import {retirementPlanFixture} from '../testing/retirementPlanFixture.js'
import {retirementAnnualFixture} from '../testing/retirementAnnualFixture.js'
const makePlan=(definition={REGULAR:true,OVERTIME:true,BONUS:false,PAID_LEAVE:true})=>retirementPlanInput({...retirementPlanFixture(),employerContributions:'NONELECTIVE',employerContributionTerms:'Synthetic reviewed nonelective employer formula.',employerFormula:{period:'PER_PAYROLL',matchCatchUp:false,matchTiers:[],nonelectiveBps:200,compensation:definition,eligibilityTerms:'Synthetic reviewed entry conditions.',vestingTerms:'Synthetic reviewed vesting conditions.'}})
const makeAnnual=(compensationCents=0)=>retirementAnnualInput({...retirementAnnualFixture(),employerFunding:{compensationCents,matchingCents:0,nonelectiveCents:0,reference:'Synthetic reviewed external employer compensation.'}})
function fixture(){
 const plan=makePlan(),annual=makeAnnual(35900000)
 const source=(runId,paymentDate,compensation)=>({status:'RECONCILED_PAYROLL_INPUTS',facilityId:'1',employeeId:'2',planId:plan.planId,planFingerprint:plan.fingerprint,runId,runStatus:'APPROVED',paymentDate,compensation,compensation415Cents:Object.values(compensation).reduce((a,b)=>a+b,0),salaryCoveredLeave:false,fingerprint:String(runId).padStart(64,'a')})
 return {plan,annual,facility:1,employeeId:2,runId:'12',payrollSources:[source('12','2026-09-30',{REGULAR:80000,OVERTIME:10000,BONUS:100000,PAID_LEAVE:10000}),source('11','2026-09-15',{REGULAR:60000,OVERTIME:0,BONUS:50000,PAID_LEAVE:0})]}
}
test('employer compensation uses employer categories and external balances independently of employee deferral rules',()=>{
 const input=fixture(),r=employerCompensationAllocation(input)
 assert.deepEqual(r.records.map(x=>[x.runId,x.compensationCents,x.eligibleCompensationCents]),[['11',60000,60000],['12',100000,40000]])
 assert.equal(r.eligibleCompensationCents,40000);assert.equal(r.annualCompensationCents,36060000);assert.equal(r.annualEligibleCompensationCents,36000000)
 assert.equal(input.annual.externalPlanCompensationCents,0);assert.equal(input.annual.compensationCapTreatment,'DEFERRALS_CONTINUE')
 assert.equal(r.requiresPayrollIntegration,true);assert.equal(r.requiresEmployerEligibilityReview,true)
 assert.equal(employerCompensationAllocation({...input,payrollSources:[...input.payrollSources].reverse()}).fingerprint,r.fingerprint)
 assert.notEqual(employerCompensationAllocation({...input,annual:makeAnnual(35800000)}).fingerprint,r.fingerprint)
})
test('cap boundary retains raw compensation and never produces negative eligible wages',()=>{
 for(const [external,expected] of [[35939999,1],[35940000,0],[36000000,0],[40000000,0]]){
  const r=employerCompensationAllocation({...fixture(),annual:makeAnnual(external)})
  assert.equal(r.eligibleCompensationCents,expected)
  assert.equal(r.records[1].compensationCents,100000)
 }
})
test('same-date payroll order uses exact numeric identifiers and rejects backdating ahead of approved allocations',()=>{
 const input=fixture();input.payrollSources[0].runId='100';input.payrollSources[0].paymentDate='2026-09-15';input.runId='100'
 assert.deepEqual(employerCompensationAllocation(input).records.map(x=>x.runId),['11','100'])
 assert.throws(()=>employerCompensationAllocation({...input,runId:'11'}),/Later approved payroll/)
 input.payrollSources[0].runId='9007199254740993';input.runId='9007199254740993'
 assert.equal(employerCompensationAllocation(input).records.at(-1).runId,input.runId)
})
test('ambiguous salary-covered leave is rejected unless employer categories treat it identically',()=>{
 const input=fixture();input.payrollSources[0].salaryCoveredLeave=true
 assert.doesNotThrow(()=>employerCompensationAllocation(input))
 input.plan=makePlan({REGULAR:true,OVERTIME:true,BONUS:false,PAID_LEAVE:false})
 for(const s of input.payrollSources)s.planFingerprint=input.plan.fingerprint
 assert.throws(()=>employerCompensationAllocation(input),/salary-covered leave/)
})
test('source coverage rejects duplicates, mixed scopes, stale plan terms, invalid dates and unreconciled wages',()=>{
 const input=fixture()
 assert.throws(()=>employerCompensationAllocation({...input,payrollSources:[...input.payrollSources,input.payrollSources[0]]}),/more than once/)
 assert.throws(()=>employerCompensationAllocation({...input,payrollSources:[]}),/complete annual/)
 assert.throws(()=>employerCompensationAllocation({...input,runId:'99'}),/included payroll/)
 for(const patch of [{facilityId:'9'},{employeeId:'9'},{planId:'wrong'},{planFingerprint:'b'.repeat(64)},{runStatus:'VOID'},{status:'UNREVIEWED'},{paymentDate:'2026-02-30'},{paymentDate:'2027-01-01'},{runId:'1.5'},{fingerprint:undefined},{salaryCoveredLeave:undefined},{compensation415Cents:1},{compensation:{REGULAR:1}}]){
  assert.throws(()=>employerCompensationAllocation({...input,payrollSources:[{...input.payrollSources[0],...patch},input.payrollSources[1]]}),{status:409})
 }
})
test('missing and forged annual employer facts never become implicit zero balances',()=>{
 const input=fixture()
 const legacy=retirementAnnualInput(retirementAnnualFixture())
 assert.throws(()=>employerCompensationAllocation({...input,annual:legacy}),/explicit external/)
 assert.throws(()=>employerCompensationAllocation({...input,annual:{...input.annual,employerFunding:{...input.annual.employerFunding,compensationCents:0}}}),/current employer formula/)
 const future=retirementAnnualInput({...retirementAnnualFixture(),asOfDate:'2026-10-01',employerFunding:input.annual.employerFunding})
 assert.throws(()=>employerCompensationAllocation({...input,annual:future}),/applicable annual/)
 assert.throws(()=>employerCompensationAllocation({...input,annual:makeAnnual(Number.MAX_SAFE_INTEGER)}),/safe integer cents/)
})
test('retained source revisions change the allocation fingerprint even when amounts are unchanged',()=>{
 const input=fixture(),before=employerCompensationAllocation(input)
 input.payrollSources[0].fingerprint='b'.repeat(64)
 const after=employerCompensationAllocation(input)
 assert.equal(after.eligibleCompensationCents,before.eligibleCompensationCents)
 assert.notEqual(after.fingerprint,before.fingerprint)
})
test('capped compensation feeds the full employer obligation without changing employee deferrals',()=>{
 const input=fixture(),allocation=employerCompensationAllocation(input)
 const result=retirementEmployerCalculation({plan:input.plan,sourceFingerprint:allocation.fingerprint,eligibleCompensationCents:allocation.eligibleCompensationCents,ordinaryDeferralsCents:0,catchUpDeferralsCents:0,priorMatchingCents:0,priorNonelectiveCents:0,annualAdditionsRemainingCents:100000,eligibilityConfirmed:true,matchingEligible:false,nonelectiveEligible:true})
 assert.deepEqual(result.obligation,{matchingCents:0,nonelectiveCents:800,totalCents:800})
 assert.equal(result.ordinaryDeferralsCents,0)
 assert.equal(result.status,'CALCULATED_NOT_AUTHORIZED')
})
