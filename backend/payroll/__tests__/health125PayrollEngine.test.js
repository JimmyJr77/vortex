import test from 'node:test'
import assert from 'node:assert/strict'
import {buildEmployeePreview} from '../payrollEngine.js'
const health125={version:1,classification:'SECTION125_ACCIDENT_HEALTH_PREMIUM',items:[{planId:'medical',optionId:'family',deductionCents:12500,annualBonusDeductionCents:0,qualificationFingerprint:'a'.repeat(64),authorizationFingerprint:'b'.repeat(64)}]}
const args={employee:{id:1,payType:'HOURLY',hourlyRateCents:25000,workState:'MD',residenceState:'MD',w4Status:'COMPLETE',stateWithholdingStatus:'COMPLETE'},entries:[{clockIn:'2026-09-09T12:00:00Z',clockOut:'2026-09-09T20:00:00Z',unpaidBreakMinutes:0,status:'APPROVED'}],taxElection:{verified:true,federal:{filingStatus:'SINGLE'},maryland:{filingStatus:'SINGLE',localRate:3.2,exemptions:1}},employerTaxConfig:{year:2026,verified:true,futaRatePercent:.6,mdUiRatePercent:2.6},health125,ytdTaxWages:{socialSecurityWagesCents:0,medicareWagesCents:0,futaWagesCents:0,marylandUnemploymentWagesCents:0}}
test('payroll preview carries health premiums through wages, taxes, deductions and net pay exactly once',()=>{
 const x=buildEmployeePreview(args)
 assert.deepEqual(x.warnings.filter(w=>w.blocking),[])
 assert.equal(x.grossPayCents,200000);assert.equal(x.pretaxDeductionCents,12500);assert.equal(x.socialSecurityTaxCents,11625);assert.equal(x.medicareTaxCents,2719)
 assert.equal(x.federalIncomeTaxCents,13417);assert.equal(x.stateIncomeTaxCents,12720)
 assert.equal(x.netPayCents,147019)
 assert.equal(x.futaTaxCents,1125);assert.equal(x.mdUiTaxCents,4875)
 assert.equal(x.payItems.filter(i=>i.kind==='HEALTH_SECTION125_PRETAX').reduce((n,i)=>n+i.amountCents,0),12500)
 assert.equal(x.ficaWageBasis.medicareTaxableCents,187500);assert.equal(x.incomeTaxWageBasis.federalWagesCents,187500)
 assert.deepEqual(x.health125EmploymentTaxes.health125,x.health125)
})
test('combined payroll retains distinct health and retirement amounts and taxable bases',()=>{
 const x=buildEmployeePreview({...args,retirement401k:{planType:'STANDARD_401K',pretaxCents:10000,rothCents:5000,pretaxAnnualBonusCents:0}})
 assert.deepEqual(x.warnings.filter(w=>w.blocking),[])
 assert.equal(x.pretaxDeductionCents,22500);assert.equal(x.posttaxDeductionCents,5000)
 assert.equal(x.federalIncomeTaxCents,12217);assert.equal(x.stateIncomeTaxCents,11925);assert.equal(x.socialSecurityTaxCents,11625)
 assert.equal(x.netPayCents,134014);assert.equal(x.incomeTaxWageBasis.federalWagesCents,177500)
 assert.equal(x.payItems.filter(i=>i.kind==='RETIREMENT_401K_PRETAX').length,1);assert.equal(x.payItems.filter(i=>i.kind==='HEALTH_SECTION125_PRETAX').length,1)
})
test('payroll uses separate taxable history and blocks health calculations when that history is missing',()=>{
 const x=buildEmployeePreview({...args,ytdSocialSecurityWagesCents:99999999,ytdTaxWages:{socialSecurityWagesCents:18400000,medicareWagesCents:19900000,futaWagesCents:690000,marylandUnemploymentWagesCents:825000}})
 assert.equal(x.socialSecurityTaxCents,3100);assert.equal(x.additionalMedicareTaxCents,788);assert.equal(x.futaTaxCents,60);assert.equal(x.mdUiTaxCents,650)
 assert.equal(x.ficaWageBasis.ytdTaxWages.medicareWagesCents,19900000)
 const missing=buildEmployeePreview({...args,ytdTaxWages:undefined})
 assert.ok(missing.warnings.some(w=>w.code==='HEALTH_TAX_WAGE_REVIEW'&&w.blocking))
 const invalid=buildEmployeePreview({...args,health125:{...health125,classification:'PRETAX'}})
 assert.ok(invalid.warnings.some(w=>w.code==='HEALTH_TAX_WAGE_REVIEW'&&w.blocking));assert.equal(invalid.netPayCents,null)
})
test('later payroll without a premium uses separate taxable histories and does not repeat the deduction',()=>{
 const x=buildEmployeePreview({...args,health125:undefined,ytdSocialSecurityWagesCents:99999999,ytdTaxWages:{socialSecurityWagesCents:18400000,medicareWagesCents:19900000,futaWagesCents:690000,marylandUnemploymentWagesCents:825000}})
 assert.deepEqual(x.warnings.filter(w=>w.blocking),[])
 assert.equal(x.pretaxDeductionCents,0);assert.equal(x.health125,undefined)
 assert.equal(x.socialSecurityTaxCents,3100);assert.equal(x.additionalMedicareTaxCents,900)
 assert.equal(x.futaTaxCents,60);assert.equal(x.mdUiTaxCents,650)
 assert.equal(x.ficaWageBasis.employmentWageMode,'SEPARATE_YTD')
 assert.equal(x.payItems.filter(i=>i.kind==='HEALTH_SECTION125_PRETAX').length,0)
 assert.deepEqual(x.health125EmploymentTaxes.taxableWages,{socialSecurityWagesCents:200000,medicareWagesCents:200000,futaWagesCents:200000,marylandUnemploymentWagesCents:200000})
})
