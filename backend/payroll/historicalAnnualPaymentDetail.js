// Retained reporting amounts are distinct from uncapped opening wage bases.
// Never infer withholding components or qualified overtime from gross/net pay.
export const historicalAnnualAmountKeys=[
 'federalWagesCents','marylandWagesCents','socialSecurityReportedWagesCents','additionalMedicareWagesCents',
 'federalWithheldCents','marylandWithheldCents','socialSecurityWithheldCents','medicareWithheldCents','additionalMedicareWithheldCents','qualifiedOvertimePremiumCents',
]
export const historicalEmployerTaxKeys=['socialSecurityCents','medicareCents','futaCents','marylandUnemploymentCents']
const withholdingKeys=historicalAnnualAmountKeys.slice(4,9)
const fail=message=>Object.assign(new Error(message),{status:409})
export function historicalAnnualPaymentDetail(payment,wages,input){
 if(!input||input.registerReconciledConfirmed!==true||input.reportingWagesConfirmed!==true||input.qualifiedOvertimeReviewed!==true)throw fail('Review the original register, reporting wage amounts and qualified overtime for each imported payment.')
 if(typeof input.reference!=='string'||input.reference.trim().length<20||input.reference.length>2000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(input.reference))throw fail('Retain the original annual reporting detail reference.')
 const amounts={}
 for(const key of historicalAnnualAmountKeys){
  const value=input[key]
  if(!Number.isSafeInteger(value)||value<0||value>payment.grossCents)throw fail('Enter every imported annual amount explicitly in whole cents within retained gross wages.')
  amounts[key]=value
 }
 if(withholdingKeys.reduce((sum,key)=>sum+BigInt(amounts[key]),0n)!==BigInt(payment.taxCents))throw fail('Separate imported withholding components must equal the retained total employee tax.')
 if(amounts.socialSecurityReportedWagesCents>Math.min(wages.socialSecurityWagesCents,18450000))throw fail('Reported Social Security wages exceed the reviewed wage basis or annual wage limit.')
 if(amounts.additionalMedicareWagesCents>wages.medicareWagesCents)throw fail('Additional Medicare wages exceed the reviewed Medicare wage basis.')
 if(amounts.qualifiedOvertimePremiumCents>amounts.federalWagesCents)throw fail('Qualified overtime premium exceeds retained federal wages.')
 let employerTaxes
 if(input.employerTaxes!==undefined){
  const e=input.employerTaxes
  if(!e||e.confirmed!==true||typeof e.reference!=='string'||e.reference.trim().length<20||e.reference.length>2000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(e.reference))throw fail('Confirm the original employer tax register and retain its reference.')
  employerTaxes={confirmed:true,reference:e.reference.trim()}
  for(const key of historicalEmployerTaxKeys){if(!Number.isSafeInteger(e[key])||e[key]<0||e[key]>payment.grossCents)throw fail('Enter each employer tax amount explicitly in whole cents within gross wages.');employerTaxes[key]=e[key]}
 }
 return {version:1,...amounts,...(employerTaxes?{employerTaxes}:{}),reference:input.reference.trim(),registerReconciledConfirmed:true,reportingWagesConfirmed:true,qualifiedOvertimeReviewed:true}
}

export function historicalAnnualTotals(payments){
 const keys=[...historicalAnnualAmountKeys,'medicareWagesCents'],totals=Object.fromEntries(keys.map(key=>[key,0n]))
 for(const payment of payments){
  if(!payment.annualDetail)throw fail('Imported payments need separate annual wage, withholding and qualified-overtime detail.')
  for(const key of historicalAnnualAmountKeys)totals[key]+=BigInt(payment.annualDetail[key])
  totals.medicareWagesCents+=BigInt(payment.wages.medicareWagesCents)
 }
 if(totals.socialSecurityReportedWagesCents>18450000n)throw fail('Imported reported Social Security wages exceed the employer annual wage limit.')
 if(Object.values(totals).some(value=>value>BigInt(Number.MAX_SAFE_INTEGER)))throw fail('Imported annual totals exceed supported precision.')
 return Object.fromEntries(Object.entries(totals).map(([key,value])=>[key,Number(value)]))
}
