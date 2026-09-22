import {health125TaxWages} from './health125TaxWages.js'
import {employerTaxes2026} from './employerTaxes.js'
const tax=(cents,numerator,denominator)=>Number((BigInt(cents)*numerator+denominator/2n)/denominator)
const percentTax=(cents,percent)=>{const [whole,fraction='']=String(percent).split('.');return tax(cents,BigInt(whole+fraction),100n*10n**BigInt(fraction.length))}
// Separate uncapped, reconciled YTD bases are required. Gross earnings and
// capped Social Security wages cannot stand in for Medicare or UI history.
export function health125EmploymentTaxes({grossCents,annualBonusCents,health125,retirement,year,workState,residenceState,ytd,employerTaxConfig}){
 if(year!==2026||workState!=='MD'||residenceState!=='MD'||!Number.isSafeInteger(grossCents)||grossCents<0)throw new Error('Use verified 2026 Maryland taxable wage inputs.')
 const health=health125===undefined?null:health125TaxWages({grossCents,annualBonusCents,health125,retirement,year,workState,residenceState})
 const wages=health||{socialSecurityWagesCents:grossCents,medicareWagesCents:grossCents,futaWagesCents:grossCents,marylandUnemploymentWagesCents:grossCents}
 for(const key of ['socialSecurityWagesCents','medicareWagesCents','futaWagesCents','marylandUnemploymentWagesCents'])if(!Number.isSafeInteger(ytd?.[key])||ytd[key]<0||!Number.isSafeInteger(ytd[key]+wages[key]))throw new Error('Reconcile separate year-to-date taxable wages before calculating Section 125 employment taxes.')
 const socialSecurityTaxableCents=Math.min(wages.socialSecurityWagesCents,Math.max(0,18450000-ytd.socialSecurityWagesCents))
 const medicareTaxableCents=wages.medicareWagesCents
 const additionalMedicareTaxableCents=Math.max(0,ytd.medicareWagesCents+medicareTaxableCents-20000000)-Math.max(0,ytd.medicareWagesCents-20000000)
 // Existing rate validation and taxable-wage caps are retained, but
 // each unemployment tax consumes its own reconciled YTD wage basis.
 const futa=employerTaxes2026({grossCents:wages.futaWagesCents,ytdWagesCents:ytd.futaWagesCents,config:employerTaxConfig,year,workState})
 const maryland=employerTaxes2026({grossCents:wages.marylandUnemploymentWagesCents,ytdWagesCents:ytd.marylandUnemploymentWagesCents,config:employerTaxConfig,year,workState})
 return {version:1,employerTaxConfig:{...employerTaxConfig},health125:health,taxableWages:{socialSecurityWagesCents:wages.socialSecurityWagesCents,medicareWagesCents:wages.medicareWagesCents,futaWagesCents:wages.futaWagesCents,marylandUnemploymentWagesCents:wages.marylandUnemploymentWagesCents},ytd:{socialSecurityWagesCents:ytd.socialSecurityWagesCents,medicareWagesCents:ytd.medicareWagesCents,futaWagesCents:ytd.futaWagesCents,marylandUnemploymentWagesCents:ytd.marylandUnemploymentWagesCents},socialSecurityTaxableCents,medicareTaxableCents,additionalMedicareTaxableCents,socialSecurityTaxCents:tax(socialSecurityTaxableCents,620n,10000n),medicareTaxCents:tax(medicareTaxableCents,145n,10000n),additionalMedicareTaxCents:tax(additionalMedicareTaxableCents,90n,10000n),employerSocialSecurityTaxCents:tax(socialSecurityTaxableCents,620n,10000n),employerMedicareTaxCents:tax(medicareTaxableCents,145n,10000n),futaWagesCents:futa.futaWagesCents,mdUiWagesCents:maryland.mdUiWagesCents,futaTaxCents:percentTax(futa.futaWagesCents,employerTaxConfig.futaRatePercent),mdUiTaxCents:percentTax(maryland.mdUiWagesCents,employerTaxConfig.mdUiRatePercent)}
}
