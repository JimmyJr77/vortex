import {verifyMarylandAdditionalAllocation} from './marylandAdditionalAllocation.js'
import {marylandElectionFingerprint} from './marylandElectionFingerprint.js'
import {applyPtoStateReview,ptoStateReviewInput} from './ptoStateWithholding.js'
import {marylandLumpSum2026} from './marylandLumpSum2026.js'

const fail=message=>Object.assign(new Error(message),{status:409})

// Retained reviewed contexts predate stateMethod. Preserve their chosen amount;
// new contexts without a review select native calculation explicitly.
export function ptoStateMethodInput(context){
 const method=context.stateMethod===undefined?(context.stateWithholdingReview!==undefined?'REVIEWED':'MD_LUMP_SUM'):context.stateMethod
 if(!['REVIEWED','MD_LUMP_SUM'].includes(method))throw fail('Choose automatic Maryland lump-sum withholding or a reviewed state calculation.')
 if(method==='MD_LUMP_SUM'&&context.stateWithholdingReview!==undefined)throw fail('Remove the reviewed state amount before selecting automatic Maryland withholding.')
 return {stateMethod:method,...(context.stateWithholdingReview!==undefined?{stateWithholdingReview:ptoStateReviewInput(context.stateWithholdingReview)}:{})}
}

// The payment loader must supply a current basis and server-verified payout
// classification. The payment loader supplies both from retained server evidence.
export function calculatePtoState({context,basis,wageBasisVerified,lumpSumVerified}){
 const choice=ptoStateMethodInput(context)
 if(choice.stateMethod==='REVIEWED'){
  if(!choice.stateWithholdingReview)throw fail('Record a verified state income-tax calculation for this standalone unused-vacation payout before approval.')
  const review=applyPtoStateReview(choice.stateWithholdingReview,basis)
  return {stateMethod:'REVIEWED',stateIncomeTaxCents:review.stateIncomeTaxCents,review}
 }
 const allocation=basis.marylandAdditionalAllocation,election=basis.taxElection?.maryland
 if(allocation)verifyMarylandAdditionalAllocation(allocation,{requestedAdditionalCents:election.extraWithholdingCents??0,electionFingerprint:marylandElectionFingerprint(election),payFrequency:basis.payFrequency,employeeId:basis.employeeId,paymentDate:basis.paymentDate})
 const calculation=marylandLumpSum2026({year:basis.year,workState:basis.workState,residenceState:basis.residenceState,taxableWagesCents:basis.marylandWagesCents,wageBasisVerified,lumpSumVerified,election:basis.taxElection?.verified===true?{...basis.taxElection.maryland,...(allocation?{extraWithholdingCents:0}:{}),verified:true}:null})
 const extra=allocation?.remainingAdditionalCents??0,total=BigInt(calculation.stateIncomeTaxCents)+BigInt(extra)
 if(total>BigInt(Number.MAX_SAFE_INTEGER))throw fail('Maryland withholding exceeds safe cent precision.')
 const stateTaxComponents={version:1,method:'PTO_PERIOD',payFrequency:basis.payFrequency,regularBaseCents:0,annualBonusTaxCents:0,ptoBaseCents:calculation.stateIncomeTaxCents,requestedAdditionalCents:election.extraWithholdingCents??0,appliedAdditionalCents:extra,totalCents:Number(total),exempt:false,electionFingerprint:marylandElectionFingerprint(election),...(allocation?{allocation}:{})}
 return {stateMethod:'MD_LUMP_SUM',stateIncomeTaxCents:Number(total),stateTaxComponents,calculation:{...calculation,version:'2026-md-lump-sum-v2',baseIncomeTaxCents:calculation.stateIncomeTaxCents,additionalWithholdingCents:extra,stateIncomeTaxCents:Number(total),...(allocation?{additionalAllocation:allocation}:{}),basisFingerprint:basis.fingerprint}}
}
