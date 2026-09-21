import {createHash} from 'node:crypto'
import {retirementPlanInput} from './retirementPlanInput.js'
const fail=message=>Object.assign(new Error(message),{status:409})
const amount=value=>Number.isSafeInteger(value)&&value>=0
const safe=value=>{if(value>BigInt(Number.MAX_SAFE_INTEGER))throw fail('Employer contribution calculation exceeds supported cents.');return Number(value)}
const round=(numerator,denominator)=>(numerator*2n+denominator)/(2n*denominator)
const zero={matchingCents:0,nonelectiveCents:0,totalCents:0}

// Internal calculation only. The caller must derive the period's eligible,
// compensation-capped wages, actual deferrals, prior employer funding and
// remaining annual-additions capacity from scoped, retained source evidence.
// For ANNUAL_TRUE_UP these inputs cover the whole reviewed annual period; for
// PER_PAYROLL they cover the same payroll, including earlier retained funding.
// This function never deducts employee pay or authorizes a provider write.
export function retirementEmployerCalculation({plan,sourceFingerprint,eligibleCompensationCents,ordinaryDeferralsCents,catchUpDeferralsCents,priorMatchingCents,priorNonelectiveCents,annualAdditionsRemainingCents,eligibilityConfirmed,matchingEligible,nonelectiveEligible}){
 const retained=retirementPlanInput({...plan,confirmed:true}),formula=retained.employerFormula
 if(!formula||retained.fingerprint!==plan.fingerprint)throw fail('Use the exact retained employer funding formula and plan fingerprint.')
 if(typeof sourceFingerprint!=='string'||!/^[a-f0-9]{64}$/.test(sourceFingerprint)||eligibilityConfirmed!==true)throw fail('Review participant employer-funding eligibility and retain the current calculation sources.')
 if(typeof matchingEligible!=='boolean'||typeof nonelectiveEligible!=='boolean'||matchingEligible&&retained.employerContributions==='NONELECTIVE'||nonelectiveEligible&&retained.employerContributions==='MATCH')throw fail('Use explicit, formula-consistent matching and nonelective eligibility findings for this period.')
 const values={eligibleCompensationCents,ordinaryDeferralsCents,catchUpDeferralsCents,priorMatchingCents,priorNonelectiveCents,annualAdditionsRemainingCents}
 if(Object.values(values).some(value=>!amount(value)))throw fail('Employer calculation requires explicit, nonnegative, safe integer source cents; unknown is not zero.')
 const computed=retirementEmployerObligation({plan,sourceFingerprint,eligibleCompensationCents,ordinaryDeferralsCents,catchUpDeferralsCents,matchingEligible,nonelectiveEligible})
 const {obligation}=computed
 const overfunding={matchingCents:Math.max(0,priorMatchingCents-obligation.matchingCents),nonelectiveCents:Math.max(0,priorNonelectiveCents-obligation.nonelectiveCents)}
 const required={matchingCents:Math.max(0,obligation.matchingCents-priorMatchingCents),nonelectiveCents:Math.max(0,obligation.nonelectiveCents-priorNonelectiveCents)}
 const totalCents=safe(BigInt(required.matchingCents)+BigInt(required.nonelectiveCents))
 const excessCents=Math.max(0,totalCents-annualAdditionsRemainingCents),issues=[]
 if(overfunding.matchingCents||overfunding.nonelectiveCents)issues.push('Prior employer funding exceeds the reviewed formula in one or more contribution types. Reconcile without offsetting matching against nonelective funding.')
 if(excessCents)issues.push('The full employer contribution exceeds remaining annual-additions capacity. Reconcile employee and employer allocations; the obligation has not been silently reduced.')
 const basis={version:1,planFingerprint:retained.fingerprint,sourceFingerprint,period:formula.period,...values,eligibilityConfirmed,matchingEligible,nonelectiveEligible,obligation,required:{...required,totalCents},overfunding,excessCents,tiers:computed.tiers,roundingPolicy:'TOTAL_HALF_UP_LARGEST_REMAINDER_EARLIER_TIER_TIE'}
 return {...basis,status:issues.length?'RECONCILIATION_REQUIRED':'CALCULATED_NOT_AUTHORIZED',issues,proposed:issues.length?{...zero}:{...required,totalCents},fingerprint:createHash('sha256').update(JSON.stringify(basis)).digest('hex'),requiresPayrollIntegration:true}
}

// Formula obligation only: prior funding and annual-additions capacity are
// separate. Null deferrals remain unknown; they are unnecessary for an
// ineligible matching component or a nonelective-only formula.
export function retirementEmployerObligation({plan,sourceFingerprint,eligibleCompensationCents,ordinaryDeferralsCents=null,catchUpDeferralsCents=null,matchingEligible,nonelectiveEligible}){
 const retained=retirementPlanInput({...plan,confirmed:true}),formula=retained.employerFormula
 if(!formula||retained.fingerprint!==plan.fingerprint||typeof sourceFingerprint!=='string'||!/^[a-f0-9]{64}$/.test(sourceFingerprint))throw fail('Use exact retained employer formula and source fingerprints.')
 if(typeof matchingEligible!=='boolean'||typeof nonelectiveEligible!=='boolean'||matchingEligible&&retained.employerContributions==='NONELECTIVE'||nonelectiveEligible&&retained.employerContributions==='MATCH')throw fail('Use explicit, formula-consistent matching and nonelective eligibility findings for this period.')
 if(!amount(eligibleCompensationCents)||[ordinaryDeferralsCents,catchUpDeferralsCents].some(value=>value!==null&&!amount(value)))throw fail('Employer obligation requires exact nonnegative source cents or explicit unknown deferrals.')
 const matchingKnown=!matchingEligible||ordinaryDeferralsCents!==null&&(!formula.matchCatchUp||catchUpDeferralsCents!==null)
 const compensation=BigInt(eligibleCompensationCents),deferrals=BigInt(ordinaryDeferralsCents??0)+(formula.matchCatchUp?BigInt(catchUpDeferralsCents??0):0n)
 const denominator=100000000n
 let lower=0n
 const tiers=formula.matchTiers.map((tier,index)=>{
  const upper=compensation*BigInt(tier.upToBps),available=deferrals*10000n
  const band=available<=lower?0n:(available<upper?available:upper)-lower
  lower=upper
  const numerator=matchingEligible?band*BigInt(tier.matchBps):0n
  return {index,upToBps:tier.upToBps,matchBps:tier.matchBps,numerator,cents:numerator/denominator,remainder:numerator%denominator}
 })
 const matching=round(tiers.reduce((sum,tier)=>sum+tier.numerator,0n),denominator)
 let centsToAllocate=matching-tiers.reduce((sum,tier)=>sum+tier.cents,0n)
 for(const tier of [...tiers].sort((a,b)=>a.remainder===b.remainder?a.index-b.index:a.remainder>b.remainder?-1:1)){
  if(centsToAllocate===0n)break
  tier.cents++;centsToAllocate--
 }
 const nonelective=nonelectiveEligible?round(compensation*BigInt(formula.nonelectiveBps),10000n):0n
 const obligation={matchingCents:matchingKnown?safe(matching):null,nonelectiveCents:safe(nonelective),totalCents:matchingKnown?safe(matching+nonelective):null}
 const basis={version:1,planFingerprint:retained.fingerprint,sourceFingerprint,period:formula.period,eligibleCompensationCents,ordinaryDeferralsCents,catchUpDeferralsCents,matchingEligible,nonelectiveEligible,obligation,tiers:tiers.map(({index,upToBps,matchBps,cents})=>({index,upToBps,matchBps,matchingCents:matchingKnown?safe(cents):null})),roundingPolicy:'TOTAL_HALF_UP_LARGEST_REMAINDER_EARLIER_TIER_TIE'}
 return {...basis,status:matchingKnown?'OBLIGATION_CALCULATED_NOT_AUTHORIZED':'DEFERRAL_EVIDENCE_REQUIRED',deferralEvidence:!matchingEligible?'NOT_REQUIRED':matchingKnown?'COMPLETE':'REVIEW_REQUIRED',fingerprint:createHash('sha256').update(JSON.stringify(basis)).digest('hex'),requiresPriorFundingReview:true,requiresAnnualAdditionsReview:true,requiresPayrollIntegration:true}
}
