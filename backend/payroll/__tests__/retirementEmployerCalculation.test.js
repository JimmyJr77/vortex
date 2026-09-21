import test from 'node:test'
import assert from 'node:assert/strict'
import {retirementEmployerCalculation} from '../retirementEmployerCalculation.js'
import {retirementPlanInput} from '../retirementPlanInput.js'
import {retirementPlanFixture} from '../testing/retirementPlanFixture.js'
function fixture({period='PER_PAYROLL',scope='MATCH_AND_NONELECTIVE',formula={}}={}){
 const employerFormula={period,matchCatchUp:scope!=='NONELECTIVE',matchTiers:scope==='NONELECTIVE'?[]:[{upToBps:300,matchBps:10000},{upToBps:500,matchBps:5000}],nonelectiveBps:scope==='MATCH'?0:200,compensation:{REGULAR:true,OVERTIME:true,BONUS:false,PAID_LEAVE:true},eligibilityTerms:'Retained reviewed eligibility source and plan clause.',vestingTerms:'Retained reviewed vesting source and plan clause.',...formula}
 const plan=retirementPlanInput({...retirementPlanFixture(),employerContributions:scope,employerContributionTerms:'Retained reviewed employer formula terms.',employerFormula})
 return {plan,sourceFingerprint:'a'.repeat(64),eligibleCompensationCents:100000,ordinaryDeferralsCents:5000,catchUpDeferralsCents:0,priorMatchingCents:0,priorNonelectiveCents:0,annualAdditionsRemainingCents:100000,eligibilityConfirmed:true}
}
test('tiered matching and nonelective contributions reconcile independently of employee wage deductions',()=>{
 const input=fixture(),result=retirementEmployerCalculation(input)
 assert.deepEqual(result.obligation,{matchingCents:4000,nonelectiveCents:2000,totalCents:6000})
 assert.deepEqual(result.proposed,result.obligation)
 assert.deepEqual(result.tiers.map(t=>t.matchingCents),[3000,1000])
 assert.equal(result.status,'CALCULATED_NOT_AUTHORIZED');assert.equal(result.requiresPayrollIntegration,true)
 assert.equal(retirementEmployerCalculation(input).fingerprint,result.fingerprint)
 assert.notEqual(retirementEmployerCalculation({...input,sourceFingerprint:'b'.repeat(64)}).fingerprint,result.fingerprint)
 assert.notEqual(retirementEmployerCalculation({...input,annualAdditionsRemainingCents:99999}).fingerprint,result.fingerprint)
})
test('matching only applies within each tier and explicitly includes or excludes catch-up',()=>{
 const input=fixture({scope:'MATCH'}),calculate=(ordinary,catchUp=0)=>retirementEmployerCalculation({...input,ordinaryDeferralsCents:ordinary,catchUpDeferralsCents:catchUp}).obligation.matchingCents
 assert.equal(calculate(0),0);assert.equal(calculate(1000),1000);assert.equal(calculate(3000),3000);assert.equal(calculate(4000),3500);assert.equal(calculate(5000),4000);assert.equal(calculate(50000),4000)
 assert.equal(calculate(3000,2000),4000)
 assert.equal(retirementEmployerCalculation({...fixture({scope:'MATCH',formula:{matchCatchUp:false}}),ordinaryDeferralsCents:3000,catchUpDeferralsCents:2000}).obligation.matchingCents,3000)
})
test('nonelective funding survives a participant declining employee deferrals',()=>{
 const result=retirementEmployerCalculation({...fixture({scope:'NONELECTIVE'}),ordinaryDeferralsCents:0,catchUpDeferralsCents:0})
 assert.deepEqual(result.proposed,{matchingCents:0,nonelectiveCents:2000,totalCents:2000})
 assert.deepEqual(result.tiers,[])
})
test('annual true-up calculates the annual obligation less retained same-type prior funding',()=>{
 const input={...fixture({period:'ANNUAL_TRUE_UP'}),eligibleCompensationCents:1000000,ordinaryDeferralsCents:50000,priorMatchingCents:25000,priorNonelectiveCents:15000}
 const result=retirementEmployerCalculation(input)
 assert.deepEqual(result.obligation,{matchingCents:40000,nonelectiveCents:20000,totalCents:60000})
 assert.deepEqual(result.proposed,{matchingCents:15000,nonelectiveCents:5000,totalCents:20000})
 const funded=retirementEmployerCalculation({...input,priorMatchingCents:40000,priorNonelectiveCents:20000})
 assert.deepEqual(funded.proposed,{matchingCents:0,nonelectiveCents:0,totalCents:0})
 assert.notEqual(funded.fingerprint,result.fingerprint)
})
test('prior overfunding never offsets a different employer obligation or becomes a negative payment',()=>{
 const result=retirementEmployerCalculation({...fixture(),priorMatchingCents:4500,priorNonelectiveCents:0})
 assert.deepEqual(result.overfunding,{matchingCents:500,nonelectiveCents:0})
 assert.deepEqual(result.required,{matchingCents:0,nonelectiveCents:2000,totalCents:2000})
 assert.equal(result.status,'RECONCILIATION_REQUIRED')
 assert.deepEqual(result.proposed,{matchingCents:0,nonelectiveCents:0,totalCents:0})
 assert.match(result.issues.join(' '),/without offsetting/)
})
test('insufficient annual-additions capacity retains the full obligation instead of truncating employer funding',()=>{
 const input=fixture(),result=retirementEmployerCalculation({...input,annualAdditionsRemainingCents:5999})
 assert.equal(result.excessCents,1);assert.equal(result.required.totalCents,6000);assert.equal(result.proposed.totalCents,0)
 assert.equal(result.status,'RECONCILIATION_REQUIRED')
 assert.equal(retirementEmployerCalculation({...input,annualAdditionsRemainingCents:6000}).proposed.totalCents,6000)
})
test('fractional tier boundaries round the total once, allocating tied remainders to the earlier tier',()=>{
 const input=fixture({scope:'MATCH',formula:{matchTiers:[{upToBps:5000,matchBps:10000},{upToBps:10000,matchBps:10000}]}})
 const result=retirementEmployerCalculation({...input,eligibleCompensationCents:1,ordinaryDeferralsCents:1})
 assert.equal(result.obligation.matchingCents,1);assert.deepEqual(result.tiers.map(t=>t.matchingCents),[1,0])
 for(let cents=0;cents<=101;cents++){
  const r=retirementEmployerCalculation({...input,eligibleCompensationCents:cents,ordinaryDeferralsCents:cents})
  assert.equal(r.obligation.matchingCents,cents);assert.equal(r.tiers.reduce((sum,t)=>sum+t.matchingCents,0),cents)
 }
 const half=retirementEmployerCalculation({...fixture({scope:'NONELECTIVE',formula:{nonelectiveBps:5000}}),eligibleCompensationCents:1,ordinaryDeferralsCents:0})
 assert.equal(half.obligation.nonelectiveCents,1)
})
test('unknown, forged and overflowing source amounts fail rather than being treated as zero',()=>{
 const input=fixture()
 for(const key of ['eligibleCompensationCents','ordinaryDeferralsCents','catchUpDeferralsCents','priorMatchingCents','priorNonelectiveCents','annualAdditionsRemainingCents'])for(const value of [undefined,null,-1,0.1,'100',Number.MAX_SAFE_INTEGER+1])assert.throws(()=>retirementEmployerCalculation({...input,[key]:value}),{status:409})
 for(const patch of [{sourceFingerprint:'unverified'},{eligibilityConfirmed:false},{eligibilityConfirmed:undefined},{plan:{...input.plan,fingerprint:'b'.repeat(64)}}])assert.throws(()=>retirementEmployerCalculation({...input,...patch}),{status:409})
 const overflow=fixture({scope:'MATCH',formula:{matchTiers:[{upToBps:10000,matchBps:100000}]}})
 assert.throws(()=>retirementEmployerCalculation({...overflow,eligibleCompensationCents:Number.MAX_SAFE_INTEGER,ordinaryDeferralsCents:Number.MAX_SAFE_INTEGER}),/exceeds supported cents/)
 assert.equal(retirementEmployerCalculation({...input,eligibleCompensationCents:0,ordinaryDeferralsCents:0}).proposed.totalCents,0)
})
