import {retirementAnnualCapacity} from './retirementAnnualCapacity.js'
import {retirementElectionInput} from './retirementElectionInput.js'
const fail=message=>Object.assign(new Error(message),{status:400})
const valid=value=>Number.isSafeInteger(value)&&value>=0
const add=(a,b)=>{if(!valid(a)||!valid(b)||!Number.isSafeInteger(a+b))throw fail('Use explicit valid contribution and compensation cents.');return a+b}
const date=value=>typeof value==='string'&&/^2026-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value
// Exact proportional allocation; a tied fractional cent goes to pretax.
// This is a documented calculation policy, not an implicit tax conversion.
function allocate(pretax,roth,cap){
 const total=add(pretax,roth),amount=Math.min(total,cap)
 if(!total||!amount)return {pretax:0,roth:0}
 const denominator=BigInt(total),p=BigInt(pretax)*BigInt(amount),r=BigInt(roth)*BigInt(amount)
 let pp=Number(p/denominator),rr=Number(r/denominator)
 if(pp+rr<amount){if(p%denominator>=r%denominator)pp++;else rr++}
 return {pretax:pp,roth:rr}
}
const percentage=(cents,bps)=>Number((BigInt(cents)*BigInt(bps)+5000n)/10000n)
// Pure proposed employee-deferral amounts. No ledger reservation, wage-tax
// calculation, payment approval or provider transaction occurs here.
export function retirementContributionCalculation({plan,annual,internal,election,payDate,runKind,compensation,compensation415Cents,availableDeductionCents,catchUpAuthorized,unusedPto}){
 if(!date(payDate)||!['REGULAR','OFF_CYCLE'].includes(runKind)||!valid(compensation415Cents)||!valid(availableDeductionCents)||typeof catchUpAuthorized!=='boolean')throw fail('Review the pay date, run kind, available pay and catch-up authorization.')
 const signed=retirementElectionInput({...election,confirmed:true},election?.proposal)
 if(signed.proposal.planFingerprint!==plan.fingerprint||signed.proposal.taxYear!==2026||signed.effectiveOn>payDate)throw fail('Select the applicable signed election and current plan for this payment.')
 const kinds=['REGULAR','OVERTIME','BONUS','PAID_LEAVE']
 if(!compensation||Object.keys(compensation).length!==kinds.length||kinds.some(kind=>!valid(compensation[kind])))throw fail('Provide every compensation category explicitly.')
 if(unusedPto!==undefined&&(!unusedPto||[unusedPto.grossCents,unusedPto.eligibleCents,unusedPto.compensation415Cents].some(v=>!valid(v))||![0,unusedPto.grossCents].includes(unusedPto.eligibleCents)||![0,unusedPto.grossCents].includes(unusedPto.compensation415Cents)||!/^[a-f0-9]{64}$/.test(unusedPto.assessmentFingerprint)||compensation415Cents!==add(kinds.reduce((sum,key)=>add(sum,compensation[key]),0),unusedPto.compensation415Cents)))throw fail('Use reconciled unused PTO compensation and its source assessment.')
 if(unusedPto){
  const term=unusedPto.paymentTiming==='IN_SERVICE'?plan.unusedPto?.inServiceDeferrals:unusedPto.paymentTiming==='POST_SEVERANCE'?plan.unusedPto?.postSeveranceDeferrals:null
  if(unusedPto.grossCents===0||!['INCLUDED','EXCLUDED'].includes(term)||unusedPto.eligibleCents!==(term==='INCLUDED'?unusedPto.grossCents:0)||unusedPto.paymentTiming==='IN_SERVICE'&&unusedPto.compensation415Cents!==unusedPto.grossCents||unusedPto.paymentTiming==='POST_SEVERANCE'&&(plan.unusedPto?.postSeverance415==='REVIEW_REQUIRED'||plan.unusedPto?.postSeverance415==='EXCLUDED'&&unusedPto.compensation415Cents!==0))throw fail('Reconcile unused PTO amounts with current plan cashout terms.')
 }
 const planCompensation=add(unusedPto?.eligibleCents||0,kinds.reduce((sum,kind)=>add(sum,plan.compensation[kind]?compensation[kind]:0),0))
 const before=retirementAnnualCapacity({plan,annual,internal})
 const capacity=retirementAnnualCapacity({plan,annual,internal:{...internal,compensation415Cents:add(internal.compensation415Cents,compensation415Cents)}})
 const eligibleCompensationCents=annual.compensationCapTreatment==='FIRST_COMPENSATION_LIMIT'?Math.min(planCompensation,before.compensationBelowLimitRemainingCents):planCompensation
 let requested={pretax:0,roth:0}
 const applies=signed.action==='ELECT'&&(signed.method!=='FIXED_PER_REGULAR_PAY'||runKind==='REGULAR')
 if(applies){
  requested=signed.method==='PERCENTAGE'?{pretax:percentage(eligibleCompensationCents,signed.pretax),roth:percentage(eligibleCompensationCents,signed.roth)}:{pretax:signed.pretax,roth:signed.roth}
  if(!eligibleCompensationCents)requested={pretax:0,roth:0}
 }
 // A cent of rounding cannot create a deduction above the eligible wages.
 requested=allocate(requested.pretax,requested.roth,eligibleCompensationCents)
 const ordinary=allocate(requested.pretax,requested.roth,capacity.ordinaryRemainingCents)
 const unallocated={pretax:requested.pretax-ordinary.pretax,roth:requested.roth-ordinary.roth}
 const catchUpRoom=catchUpAuthorized&&capacity.limits.catchUpTreatmentReady?capacity.catchUpRemainingCents:0
 const catchUp=allocate(capacity.limits.rothCatchUpRequired?0:unallocated.pretax,unallocated.roth,catchUpRoom)
 const pretaxCents=add(ordinary.pretax,catchUp.pretax),rothCents=add(ordinary.roth,catchUp.roth),totalCents=add(pretaxCents,rothCents)
 if(totalCents>availableDeductionCents)throw fail('Available pay cannot cover the proposed retirement contribution after taxes and other required deductions.')
 return {version:1,...(unusedPto?{unusedPto}:{}),payDate,planCompensationCents:planCompensation,compensation415Cents,catchUpAuthorized,notAppliedReason:applies?null:signed.action==='DECLINE'?'DECLINED':'REGULAR_PAY_ONLY',eligibleCompensationCents,requested,ordinary,catchUp,pretaxCents,rothCents,totalCents,uncollectedCents:add(requested.pretax,requested.roth)-totalCents,planFingerprint:plan.fingerprint,annualSourceFingerprint:annual.fingerprint,electionRequestKey:signed.requestKey,capacity,allocationPolicy:'PROPORTIONAL_LARGEST_REMAINDER_PRETAX_TIE',requiresPayrollIntegration:true}
}
