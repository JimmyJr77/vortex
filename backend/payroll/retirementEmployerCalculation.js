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
export function retirementEmployerCalculation({plan,sourceFingerprint,eligibleCompensationCents,ordinaryDeferralsCents,catchUpDeferralsCents,priorMatchingCents,priorNonelectiveCents,annualAdditionsRemainingCents,eligibilityConfirmed}){
 const retained=retirementPlanInput({...plan,confirmed:true}),formula=retained.employerFormula
 if(!formula||retained.fingerprint!==plan.fingerprint)throw fail('Use the exact retained employer funding formula and plan fingerprint.')
 if(typeof sourceFingerprint!=='string'||!/^[a-f0-9]{64}$/.test(sourceFingerprint)||eligibilityConfirmed!==true)throw fail('Review participant employer-funding eligibility and retain the current calculation sources.')
 const values={eligibleCompensationCents,ordinaryDeferralsCents,catchUpDeferralsCents,priorMatchingCents,priorNonelectiveCents,annualAdditionsRemainingCents}
 if(Object.values(values).some(value=>!amount(value)))throw fail('Employer calculation requires explicit, nonnegative, safe integer source cents; unknown is not zero.')
 const compensation=BigInt(eligibleCompensationCents),deferrals=BigInt(ordinaryDeferralsCents)+(formula.matchCatchUp?BigInt(catchUpDeferralsCents):0n)
 const denominator=100000000n
 let lower=0n
 const tiers=formula.matchTiers.map((tier,index)=>{
  const upper=compensation*BigInt(tier.upToBps),available=deferrals*10000n
  const band=available<=lower?0n:(available<upper?available:upper)-lower
  lower=upper
  const numerator=band*BigInt(tier.matchBps)
  return {index,upToBps:tier.upToBps,matchBps:tier.matchBps,numerator,cents:numerator/denominator,remainder:numerator%denominator}
 })
 const matching=round(tiers.reduce((sum,tier)=>sum+tier.numerator,0n),denominator)
 let centsToAllocate=matching-tiers.reduce((sum,tier)=>sum+tier.cents,0n)
 for(const tier of [...tiers].sort((a,b)=>a.remainder===b.remainder?a.index-b.index:a.remainder>b.remainder?-1:1)){
  if(centsToAllocate===0n)break
  tier.cents++;centsToAllocate--
 }
 const nonelective=round(compensation*BigInt(formula.nonelectiveBps),10000n)
 const obligation={matchingCents:safe(matching),nonelectiveCents:safe(nonelective),totalCents:safe(matching+nonelective)}
 const overfunding={matchingCents:Math.max(0,priorMatchingCents-obligation.matchingCents),nonelectiveCents:Math.max(0,priorNonelectiveCents-obligation.nonelectiveCents)}
 const required={matchingCents:Math.max(0,obligation.matchingCents-priorMatchingCents),nonelectiveCents:Math.max(0,obligation.nonelectiveCents-priorNonelectiveCents)}
 const totalCents=safe(BigInt(required.matchingCents)+BigInt(required.nonelectiveCents))
 const excessCents=Math.max(0,totalCents-annualAdditionsRemainingCents),issues=[]
 if(overfunding.matchingCents||overfunding.nonelectiveCents)issues.push('Prior employer funding exceeds the reviewed formula in one or more contribution types. Reconcile without offsetting matching against nonelective funding.')
 if(excessCents)issues.push('The full employer contribution exceeds remaining annual-additions capacity. Reconcile employee and employer allocations; the obligation has not been silently reduced.')
 const basis={version:1,planFingerprint:retained.fingerprint,sourceFingerprint,period:formula.period,...values,eligibilityConfirmed,obligation,required:{...required,totalCents},overfunding,excessCents,tiers:tiers.map(({index,upToBps,matchBps,cents})=>({index,upToBps,matchBps,matchingCents:safe(cents)})),roundingPolicy:'TOTAL_HALF_UP_LARGEST_REMAINDER_EARLIER_TIER_TIE'}
 return {...basis,status:issues.length?'RECONCILIATION_REQUIRED':'CALCULATED_NOT_AUTHORIZED',issues,proposed:issues.length?{...zero}:{...required,totalCents},fingerprint:createHash('sha256').update(JSON.stringify(basis)).digest('hex'),requiresPayrollIntegration:true}
}
