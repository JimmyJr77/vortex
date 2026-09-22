import test from 'node:test'
import assert from 'node:assert/strict'
import {health125EmploymentTaxes} from '../health125EmploymentTaxes.js'
const health125={version:1,classification:'SECTION125_ACCIDENT_HEALTH_PREMIUM',items:[{planId:'medical',optionId:'family',deductionCents:12500,annualBonusDeductionCents:0,qualificationFingerprint:'a'.repeat(64),authorizationFingerprint:'b'.repeat(64)}]}
const ytd={socialSecurityWagesCents:0,medicareWagesCents:0,futaWagesCents:0,marylandUnemploymentWagesCents:0}
const args={grossCents:200000,annualBonusCents:0,health125,year:2026,workState:'MD',residenceState:'MD',ytd,employerTaxConfig:{year:2026,verified:true,futaRatePercent:.6,mdUiRatePercent:2.6}}
test('health premiums reduce employee and employer FICA and unemployment consistently',()=>{
 const x=health125EmploymentTaxes(args)
 assert.equal(x.socialSecurityTaxableCents,187500);assert.equal(x.medicareTaxableCents,187500)
 assert.equal(x.socialSecurityTaxCents,11625);assert.equal(x.medicareTaxCents,2719);assert.equal(x.additionalMedicareTaxCents,0)
 assert.equal(x.employerSocialSecurityTaxCents,11625);assert.equal(x.employerMedicareTaxCents,2719)
 assert.equal(x.futaWagesCents,187500);assert.equal(x.mdUiWagesCents,187500);assert.equal(x.futaTaxCents,1125);assert.equal(x.mdUiTaxCents,4875)
})
test('each wage cap uses its own uncapped history, including Additional Medicare',()=>{
 const prior={socialSecurityWagesCents:18400000,medicareWagesCents:19900000,futaWagesCents:690000,marylandUnemploymentWagesCents:825000}
 const x=health125EmploymentTaxes({...args,ytd:prior})
 assert.equal(x.socialSecurityTaxableCents,50000);assert.equal(x.socialSecurityTaxCents,3100)
 assert.equal(x.additionalMedicareTaxableCents,87500);assert.equal(x.additionalMedicareTaxCents,788)
 assert.equal(x.futaWagesCents,10000);assert.equal(x.futaTaxCents,60);assert.equal(x.mdUiWagesCents,25000);assert.equal(x.mdUiTaxCents,650)
 const after=health125EmploymentTaxes({...args,ytd:{socialSecurityWagesCents:20000000,medicareWagesCents:21000000,futaWagesCents:700000,marylandUnemploymentWagesCents:850000}})
 assert.equal(after.socialSecurityTaxCents,0);assert.equal(after.additionalMedicareTaxableCents,187500);assert.equal(after.futaTaxCents,0);assert.equal(after.mdUiTaxCents,0)
})
test('retirement changes income wages but leaves health-adjusted employment taxes intact',()=>{
 const x=health125EmploymentTaxes({...args,retirement:{planType:'STANDARD_401K',pretaxCents:10000,rothCents:5000,pretaxAnnualBonusCents:0}}),plain=health125EmploymentTaxes(args)
 assert.equal(x.health125.federalWagesCents,177500)
 for(const key of ['socialSecurityTaxCents','medicareTaxCents','additionalMedicareTaxCents','futaTaxCents','mdUiTaxCents'])assert.equal(x[key],plain[key])
})
test('missing taxable history or rates cannot silently fall back to gross earnings',()=>{
 for(const ytd of [undefined,{},0,{...args.ytd,medicareWagesCents:null},{...args.ytd,socialSecurityWagesCents:-1},{...args.ytd,futaWagesCents:'0'},{...args.ytd,marylandUnemploymentWagesCents:Number.MAX_SAFE_INTEGER}])assert.throws(()=>health125EmploymentTaxes({...args,ytd}),/Reconcile separate/)
 assert.throws(()=>health125EmploymentTaxes({...args,employerTaxConfig:{...args.employerTaxConfig,verified:false}}),/Verify 2026/)
})
