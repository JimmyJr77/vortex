// Standard 401(k) statutory ceilings only. This module does not authorize a
// deduction, establish plan eligibility, aggregate prior contributions, or
// implement plan-level/ADP/415/compensation limits. See the retirement requirements.
// Sources: IRS Notice 2025-67 and retirement-topics-catch-up-contributions.
const fail=message=>Object.assign(new Error(message),{status:400})
export function retirement401kLimits(input){
 const b=input||{}
 if(b.taxYear!==2026||b.planType!=='STANDARD_401K')throw fail('Use a supported tax year and reviewed standard 401(k) plan type.')
 if(!Number.isInteger(b.ageAtYearEnd)||b.ageAtYearEnd<0||b.ageAtYearEnd>120)throw fail('Provide the verified age attained by the end of the tax year.')
 for(const field of ['allowsCatchUp','allowsHigherCatchUp','allowsRoth'])if(typeof b[field]!=='boolean')throw fail('Review the plan catch-up and Roth features explicitly.')
 if(b.allowsHigherCatchUp&&!b.allowsCatchUp)throw fail('Higher catch-up requires the plan to permit catch-up contributions.')
 const ageEligible=b.ageAtYearEnd>=50,catchUpEligible=ageEligible&&b.allowsCatchUp
 if(b.priorYearSponsorFicaWagesCents!==null&&b.priorYearSponsorFicaWagesCents!==undefined&&(!Number.isSafeInteger(b.priorYearSponsorFicaWagesCents)||b.priorYearSponsorFicaWagesCents<0))throw fail('Prior-year sponsor FICA wages must be verified nonnegative cents.')
 if(catchUpEligible&&!Number.isSafeInteger(b.priorYearSponsorFicaWagesCents))throw fail('Review prior-year sponsor FICA wages before determining catch-up treatment; unknown is not zero.')
 const statutoryOrdinaryLimitCents=2450000
 const higherAgeEligible=b.ageAtYearEnd>=60&&b.ageAtYearEnd<=63
 const statutoryCatchUpLimitCents=catchUpEligible?(higherAgeEligible&&b.allowsHigherCatchUp?1125000:800000):0
 const rothCatchUpRequired=catchUpEligible&&b.priorYearSponsorFicaWagesCents>15000000
 const issues=rothCatchUpRequired&&!b.allowsRoth?['The reviewed plan lacks Roth support required for this participant’s catch-up contributions. Resolve plan features before using catch-up.']:[]
 return {taxYear:2026,planType:'STANDARD_401K',statutoryOrdinaryLimitCents,statutoryCatchUpLimitCents,statutoryCombinedLimitCents:statutoryOrdinaryLimitCents+statutoryCatchUpLimitCents,catchUpEligible,higherAgeEligible,rothCatchUpRequired,catchUpTreatmentReady:!issues.length,issues}
}
