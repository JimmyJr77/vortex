import {retirementPlanInput} from './retirementPlanInput.js'
import {retirementAnnualInput} from './retirementAnnualInput.js'
import {retirement401kLimits} from './retirement401kLimits.js'
const fail=message=>Object.assign(new Error(message),{status:400})
const amount=value=>Number.isSafeInteger(value)&&value>=0
const sum=(a,b)=>{if(!amount(a)||!amount(b)||!Number.isSafeInteger(a+b))throw fail('Use complete nonnegative annual ledger amounts without overflow.');return a+b}
const remaining=(limit,used)=>Math.max(0,limit-used)
// Capacity diagnostics only. The caller must derive internal amounts from the
// scoped ledger (including reservations); this function never authorizes pay.
export function retirementAnnualCapacity({plan,annual,internal}){
 const p=retirementPlanInput({...plan,confirmed:true}),a=retirementAnnualInput({...annual,confirmed:true})
 if(p.unusedPto&&p.unusedPto.limitationYear!=='CALENDAR_YEAR')throw fail('Reconcile the non-calendar or unresolved plan limitation year before calculating annual retirement capacity.')
 if(plan.fingerprint!==p.fingerprint||annual.fingerprint!==a.fingerprint)throw fail('Use exact retained plan and annual source evidence.')
 const keys=['ordinaryDeferralsCents','catchUpDeferralsCents','planOrdinaryDeferralsCents','planCatchUpDeferralsCents','annualAdditionsCents','planCompensationCents','compensation415Cents']
 if(!internal||keys.some(key=>!amount(internal[key])))throw fail('Every internal annual balance must be derived explicitly; unknown is not zero.')
 if(internal.planOrdinaryDeferralsCents>internal.ordinaryDeferralsCents||internal.planCatchUpDeferralsCents>internal.catchUpDeferralsCents||internal.planOrdinaryDeferralsCents>internal.annualAdditionsCents)throw fail('Internal plan contributions must be included in aggregate balances.')
 const limits=retirement401kLimits({taxYear:2026,planType:p.planType,ageAtYearEnd:a.ageAtYearEnd,priorYearSponsorFicaWagesCents:a.priorYearSponsorFicaWagesCents,allowsCatchUp:p.allowsCatchUp,allowsHigherCatchUp:p.allowsHigherCatchUp,allowsRoth:p.allowsRoth})
 const used={ordinaryDeferralsCents:sum(a.externalOrdinaryDeferralsCents,internal.ordinaryDeferralsCents),catchUpDeferralsCents:sum(a.externalCatchUpDeferralsCents,internal.catchUpDeferralsCents),planOrdinaryDeferralsCents:sum(a.externalPlanOrdinaryDeferralsCents,internal.planOrdinaryDeferralsCents),planCatchUpDeferralsCents:sum(a.externalPlanCatchUpDeferralsCents,internal.planCatchUpDeferralsCents),annualAdditionsCents:sum(a.externalAnnualAdditionsCents,internal.annualAdditionsCents),planCompensationCents:sum(a.externalPlanCompensationCents,internal.planCompensationCents),compensation415Cents:sum(a.external415CompensationCents,internal.compensation415Cents)}
 const ordinaryPlanCap=Math.min(p.planOrdinaryDeferralLimitCents??Infinity,a.participantOrdinaryCapCents??Infinity)
 const catchUpPlanCap=Math.min(p.planCatchUpLimitCents??Infinity,a.participantCatchUpCapCents??Infinity)
 const annualAdditionsLimitCents=Math.min(7200000,used.compensation415Cents)
 const ordinaryRemainingCents=Math.min(remaining(limits.statutoryOrdinaryLimitCents,used.ordinaryDeferralsCents),remaining(ordinaryPlanCap,used.planOrdinaryDeferralsCents),remaining(annualAdditionsLimitCents,used.annualAdditionsCents))
 const catchUpRemainingCents=Math.min(remaining(limits.statutoryCatchUpLimitCents,used.catchUpDeferralsCents),remaining(catchUpPlanCap,used.planCatchUpDeferralsCents))
 return {taxYear:2026,planFingerprint:p.fingerprint,annualSourceFingerprint:a.fingerprint,used,limits,annualAdditionsLimitCents,annualAdditionsRemainingCents:remaining(annualAdditionsLimitCents,used.annualAdditionsCents),ordinaryRemainingCents,catchUpRemainingCents,compensationLimitCents:36000000,compensationBelowLimitRemainingCents:remaining(36000000,used.planCompensationCents),compensationCapTreatment:a.compensationCapTreatment,requiresPayrollIntegration:true}
}
