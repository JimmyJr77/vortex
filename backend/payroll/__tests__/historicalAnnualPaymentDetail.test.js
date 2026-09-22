import test from 'node:test'
import assert from 'node:assert/strict'
import {historicalAnnualPaymentDetail as detail,historicalAnnualTotals as totals,historicalAnnualAmountKeys as keys} from '../historicalAnnualPaymentDetail.js'
import {historicalEmploymentWageSource,historicalEmploymentWageReview} from '../historicalEmploymentTaxWages.js'
const payment={grossCents:250000,taxCents:44125}
const wages={socialSecurityWagesCents:250000,medicareWagesCents:250000,futaWagesCents:250000,marylandUnemploymentWagesCents:250000}
const input=()=>({federalWagesCents:250000,marylandWagesCents:250000,socialSecurityReportedWagesCents:250000,additionalMedicareWagesCents:0,federalWithheldCents:20000,marylandWithheldCents:5000,socialSecurityWithheldCents:15500,medicareWithheldCents:3625,additionalMedicareWithheldCents:0,qualifiedOvertimePremiumCents:10000,reference:'Original employer payroll register and reviewed FLSA premium detail',registerReconciledConfirmed:true,reportingWagesConfirmed:true,qualifiedOvertimeReviewed:true})
test('annual detail retains actual separate components, zeroes and overtime without inferring from gross',()=>{
 const result=detail(payment,wages,input())
 assert.equal(result.qualifiedOvertimePremiumCents,10000)
 assert.equal(result.additionalMedicareWithheldCents,0)
 assert.deepEqual(totals([{wages,annualDetail:result}]),Object.fromEntries([...keys.map(k=>[k,result[k]]),['medicareWagesCents',250000]]))
 assert.throws(()=>totals([{wages}]),/separate annual/)
})
test('missing confirmations, omitted zeroes, unsafe precision and mismatched tax totals block annual detail',()=>{
 for(const key of ['registerReconciledConfirmed','reportingWagesConfirmed','qualifiedOvertimeReviewed'])assert.throws(()=>detail(payment,wages,{...input(),[key]:false}),/Review/)
 for(const key of keys)for(const value of [undefined,null,'0',-1,0.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>detail(payment,wages,{...input(),[key]:value}),/explicitly/)
 assert.throws(()=>detail(payment,wages,{...input(),federalWithheldCents:20001}),/equal/)
 assert.throws(()=>detail(payment,wages,{...input(),reference:'short'}),/reference/)
})
test('reported wage bases and qualified overtime cannot exceed retained evidence or annual SS cap',()=>{
 assert.throws(()=>detail(payment,{...wages,socialSecurityWagesCents:249999},input()),/Social Security/)
 assert.throws(()=>detail(payment,{...wages,medicareWagesCents:0},{...input(),additionalMedicareWagesCents:1}),/Medicare/)
 assert.throws(()=>detail(payment,wages,{...input(),federalWagesCents:9999}),/overtime/)
 const largePayment={grossCents:20000000,taxCents:0},largeWages=Object.fromEntries(Object.keys(wages).map(k=>[k,20000000]))
 const largeInput={...input(),...Object.fromEntries(keys.map(k=>[k,0])),socialSecurityReportedWagesCents:18450001}
 assert.throws(()=>detail(largePayment,largeWages,largeInput),/annual wage limit/)
 const approved=detail(largePayment,largeWages,{...largeInput,socialSecurityReportedWagesCents:18450000})
 assert.throws(()=>totals([{wages:largeWages,annualDetail:approved},{wages,annualDetail:detail(payment,wages,input())}]),/annual wage limit/)
})
test('review binds annual detail to the exact payment and leaves older opening-balance reviews annual-incomplete',()=>{
 const row={id:1,facility_id:1,employee_id:9,period_start:'2026-01-01',period_end:'2026-01-15',payment_date:'2026-01-16',gross_amount_cents:payment.grossCents,employee_tax_withheld_cents:payment.taxCents,net_amount_cents:payment.grossCents-payment.taxCents,method:'ACH'}
 const source=historicalEmploymentWageSource([row],{facilityId:1,employeeId:9,paymentDate:'2026-12-31'})
 const review={sourceFingerprint:source.fingerprint,disposition:'REVIEWED',reference:'Original retained payroll evidence reference',confirmed:true,sameEmployerConfirmed:true,uncappedWagesConfirmed:true,completeHistoryConfirmed:true,payments:[{paymentId:'1',wages,annualDetail:input()}]}
 assert.equal(historicalEmploymentWageReview(source,review).payments[0].annualDetail.federalWithheldCents,20000)
 delete review.payments[0].annualDetail
 const legacy=historicalEmploymentWageReview(source,review)
 assert.equal(legacy.payments[0].annualDetail,undefined)
 assert.throws(()=>totals(legacy.payments),/separate annual/)
})

test('optional employer tax detail requires independent explicit amounts and original source review',()=>{
 const employerTaxes={socialSecurityCents:15500,medicareCents:3625,futaCents:0,marylandUnemploymentCents:0,reference:'Original employer tax liability register reviewed',confirmed:true}
 assert.deepEqual(detail(payment,wages,{...input(),employerTaxes}).employerTaxes,employerTaxes)
 for(const key of ['socialSecurityCents','medicareCents','futaCents','marylandUnemploymentCents'])for(const value of [undefined,null,-1,'0',0.5,250001])assert.throws(()=>detail(payment,wages,{...input(),employerTaxes:{...employerTaxes,[key]:value}}),/explicitly/)
 assert.throws(()=>detail(payment,wages,{...input(),employerTaxes:{...employerTaxes,confirmed:false}}),/Confirm/)
})
