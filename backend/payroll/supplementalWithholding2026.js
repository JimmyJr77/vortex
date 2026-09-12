import {federalWithholding2026} from './withholding2026.js'
const periods={WEEKLY:52,BIWEEKLY:26,SEMIMONTHLY:24,MONTHLY:12}
const cents=(value,label)=>{if(!Number.isSafeInteger(value)||value<0)throw new Error(`${label} must be non-negative safe integer cents.`);return value}
const add=(a,b,label)=>cents(a+b,label)
const percent=(value,rate)=>Number((BigInt(value)*BigInt(rate)+50n)/100n)
// IRS Publication 15 (2026), section 7. The caller must reconcile actual
// supplemental wage history and, for aggregate treatment, the selected regular
// payroll plus every earlier supplemental payment in that payroll period.
export function federalSupplementalWithholding2026({paymentCents,ytdSupplementalCents,historyVerified,year,method,regularWithholdingVerified=false,aggregate}){
 if(year!==2026||historyVerified!==true)throw new Error('Reconciled supplemental wage history for 2026 is required.')
 cents(paymentCents,'Supplemental payment');cents(ytdSupplementalCents,'Year-to-date supplemental wages')
 if(paymentCents===0)throw new Error('The supplemental payment must be positive.')
 if(!['FLAT_22','AGGREGATE'].includes(method))throw new Error('Select flat or aggregate supplemental withholding.')
 add(ytdSupplementalCents,paymentCents,'Cumulative supplemental wages')
 const ordinaryCents=Math.min(paymentCents,Math.max(0,100000000-ytdSupplementalCents)),mandatoryCents=paymentCents-ordinaryCents
 let ordinaryTaxCents=0,combinedFederalTaxCents=null,alreadyWithheldCents=null
 if(ordinaryCents&&method==='FLAT_22'){
  if(regularWithholdingVerified!==true)throw new Error('Flat 22% withholding requires evidence of federal withholding from regular wages in the current or immediately preceding calendar year.')
  ordinaryTaxCents=percent(ordinaryCents,22)
 }
 if(ordinaryCents&&method==='AGGREGATE'){
  if(aggregate?.verified!==true||aggregate.election?.verified!==true||!periods[aggregate.payFrequency])throw new Error('Verify the regular payroll basis, all earlier supplemental payments in that payroll period, and the current W-4 before aggregate withholding.')
  const regular=cents(aggregate.regularWagesCents,'Regular payroll wages'),prior=cents(aggregate.previousSupplementalCents,'Earlier supplemental payments')
  if(prior>ytdSupplementalCents)throw new Error('Earlier supplemental payments exceed the reconciled year-to-date total.')
  alreadyWithheldCents=add(cents(aggregate.regularFederalWithheldCents,'Regular payroll withholding'),cents(aggregate.previousFederalWithheldCents,'Earlier supplemental withholding'),'Prior withholding')
  const combined=add(add(regular,prior,'Aggregate wage basis'),ordinaryCents,'Aggregate taxable wages')
  combinedFederalTaxCents=federalWithholding2026(combined,aggregate.election,periods[aggregate.payFrequency])
  ordinaryTaxCents=Math.max(0,combinedFederalTaxCents-alreadyWithheldCents)
 }
 const mandatoryTaxCents=percent(mandatoryCents,37),federalIncomeTaxCents=add(ordinaryTaxCents,mandatoryTaxCents,'Supplemental federal withholding')
 return {version:'2026-irs15-supplemental-v1',method,ordinaryCents,mandatoryCents,ordinaryTaxCents,mandatoryTaxCents,combinedFederalTaxCents,alreadyWithheldCents,federalIncomeTaxCents,requiresNetPayReview:federalIncomeTaxCents>paymentCents}
}
