import {createHash} from 'node:crypto'
const fail=message=>Object.assign(new Error(message),{status:400})
export const retirementAnnualAmounts=['priorYearSponsorFicaWagesCents','externalOrdinaryDeferralsCents','externalCatchUpDeferralsCents','externalPlanOrdinaryDeferralsCents','externalPlanCatchUpDeferralsCents','externalAnnualAdditionsCents','externalPlanCompensationCents','external415CompensationCents']
export const retirementAnnualReferences=['ageReference','aggregationReference','balanceReference','participantLimitReference','compensationReference']
export function retirementAnnualInput(body){
 const b=body||{}
 if(b.taxYear!==2026||b.confirmed!==true||typeof b.asOfDate!=='string'||!/^2026-\d{2}-\d{2}$/.test(b.asOfDate)||!Number.isFinite(Date.parse(b.asOfDate))||new Date(b.asOfDate).toISOString().slice(0,10)!==b.asOfDate)throw fail('Confirm reviewed 2026 annual sources and a valid as-of date.')
 if(!Number.isInteger(b.ageAtYearEnd)||b.ageAtYearEnd<0||b.ageAtYearEnd>120)throw fail('Review age attained at the end of the tax year.')
 for(const key of retirementAnnualAmounts)if(!Number.isSafeInteger(b[key])||b[key]<0)throw fail('Review every external balance and wage amount in nonnegative cents; unknown amounts cannot be zero by default.')
 for(const key of ['participantOrdinaryCapCents','participantCatchUpCapCents'])if(b[key]!==null&&(!Number.isSafeInteger(b[key])||b[key]<0))throw fail('Review participant-specific caps explicitly, using null only for no additional cap.')
 if(b.externalPlanOrdinaryDeferralsCents>b.externalOrdinaryDeferralsCents||b.externalPlanCatchUpDeferralsCents>b.externalCatchUpDeferralsCents||b.externalPlanOrdinaryDeferralsCents>b.externalAnnualAdditionsCents)throw fail('This plan’s external contributions must be included in the applicable aggregate balances.')
 if(!['FIRST_COMPENSATION_LIMIT','DEFERRALS_CONTINUE'].includes(b.compensationCapTreatment))throw fail('Review how the plan treats deferrals after the annual compensation limit.')
 for(const key of retirementAnnualReferences)if(typeof b[key]!=='string'||b[key].trim().length<12||b[key].length>2000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(b[key]))throw fail('Retain supporting references for age, aggregation, balances, participant limits and compensation.')
 const facts={version:1,taxYear:2026,asOfDate:b.asOfDate,ageAtYearEnd:b.ageAtYearEnd,...Object.fromEntries(retirementAnnualAmounts.map(key=>[key,b[key]])),participantOrdinaryCapCents:b.participantOrdinaryCapCents,participantCatchUpCapCents:b.participantCatchUpCapCents,compensationCapTreatment:b.compensationCapTreatment,...Object.fromEntries(retirementAnnualReferences.map(key=>[key,b[key].trim()]))}
 return {...facts,fingerprint:createHash('sha256').update(JSON.stringify(facts)).digest('hex')}
}
