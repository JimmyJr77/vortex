import test from 'node:test'
import assert from 'node:assert/strict'
import {health125TaxWages} from '../health125TaxWages.js'
import {calculateWithholding2026} from '../withholding2026.js'
const item={planId:'medical',optionId:'family',deductionCents:12500,annualBonusDeductionCents:0,qualificationFingerprint:'a'.repeat(64),authorizationFingerprint:'b'.repeat(64)}
const health125={version:1,classification:'SECTION125_ACCIDENT_HEALTH_PREMIUM',items:[item]}
const input={grossCents:200000,annualBonusCents:0,year:2026,workState:'MD',residenceState:'MD',health125}
const retirement={planType:'STANDARD_401K',pretaxCents:10000,rothCents:5000,pretaxAnnualBonusCents:0}
const withholding={grossPayCents:200000,election:{verified:true,federal:{filingStatus:'SINGLE'},maryland:{filingStatus:'SINGLE',localRate:3.2,exemptions:1}},payFrequency:'SEMIMONTHLY',year:2026,workState:'MD',residenceState:'MD'}
test('qualified health premiums reduce each supported tax base while preserving gross pay and source evidence',()=>{
 const result=health125TaxWages(input)
 assert.equal(result.grossWagesCents,200000);assert.equal(result.deductionCents,12500);assert.deepEqual(result.items,[item])
 for(const key of ['federalWagesCents','marylandWagesCents','socialSecurityWagesCents','medicareWagesCents','futaWagesCents','marylandUnemploymentWagesCents'])assert.equal(result[key],187500,key)
 const taxes=calculateWithholding2026({...withholding,health125})
 assert.equal(taxes.federalIncomeTaxCents,13417);assert.equal(taxes.stateIncomeTaxCents,12720)
 assert.equal(taxes.incomeTaxWageBasis.pretaxDeductionCents,12500);assert.deepEqual(taxes.incomeTaxWageBasis.health125,result)
})
test('health premiums and retirement use different employment-tax bases without subtracting either twice',()=>{
 const result=health125TaxWages({...input,retirement})
 assert.equal(result.federalWagesCents,177500);assert.equal(result.marylandWagesCents,177500)
 for(const key of ['socialSecurityWagesCents','medicareWagesCents','futaWagesCents','marylandUnemploymentWagesCents'])assert.equal(result[key],187500,key)
 const taxes=calculateWithholding2026({...withholding,health125,retirement401k:retirement})
 assert.equal(taxes.federalIncomeTaxCents,12217);assert.equal(taxes.stateIncomeTaxCents,11925)
 assert.equal(taxes.incomeTaxWageBasis.pretaxDeductionCents,22500);assert.equal(taxes.incomeTaxWageBasis.retirement401k.pretaxCents,10000)
 assert.equal(taxes.incomeTaxWageBasis.health125.deductionCents,12500)
 assert.throws(()=>calculateWithholding2026({...withholding,health125,pretaxDeductionCents:12500}),/separately verified/)
})
test('health and retirement bonus deductions retain explicit allocations to both wage categories',()=>{
 const health={...health125,items:[{...item,annualBonusDeductionCents:2500}]},ret={...retirement,pretaxAnnualBonusCents:4000}
 const result=health125TaxWages({...input,annualBonusCents:50000,health125:health,retirement:ret})
 assert.equal(result.marylandAnnualBonusWagesCents,43500);assert.equal(result.marylandRegularWagesCents,134000)
 const taxes=calculateWithholding2026({...withholding,health125:health,retirement401k:ret,hasBonus:true,annualBonusCents:50000,bonusReviewComplete:true})
 assert.equal(taxes.federalIncomeTaxCents,12217);assert.equal(taxes.stateIncomeTaxCents,12687)
 assert.throws(()=>health125TaxWages({...input,annualBonusCents:50000,health125:{...health,items:[{...item,deductionCents:145000}]},retirement}),/Combined health/)
 assert.throws(()=>health125TaxWages({...input,annualBonusCents:50000,health125:{...health,items:[{...item,deductionCents:48000,annualBonusDeductionCents:48000}]},retirement:ret}),/Combined health/)
})
test('multiple health plans retain deterministic per-plan amounts and reject duplicate coverage',()=>{
 const dental={...item,planId:'dental',deductionCents:1500},health={...health125,items:[item,dental]}
 const result=health125TaxWages({...input,health125:health})
 assert.equal(result.deductionCents,14000);assert.equal(result.federalWagesCents,186000);assert.deepEqual(result.items.map(i=>i.planId),['dental','medical'])
 assert.deepEqual(result,health125TaxWages({...input,health125:{...health,items:[dental,item]}}))
 assert.throws(()=>health125TaxWages({...input,health125:{...health,items:[item,{...item,optionId:'individual'}]}}),/one selected/)
})
test('unclassified premiums, missing proof, malformed amounts and overlapping reductions cannot produce tax wages',()=>{
 for(const patch of [{version:2},{classification:'PRETAX'},{classification:'HEALTH_FSA'},{items:[]},{items:null}])assert.throws(()=>health125TaxWages({...input,health125:{...health125,...patch}}))
 for(const patch of [{deductionCents:200001},{deductionCents:-1},{deductionCents:1.5},{deductionCents:'12500'},{deductionCents:null},{annualBonusDeductionCents:1},{qualificationFingerprint:''},{authorizationFingerprint:'not-proof'},{optionId:'WAIVE'},{planId:''}])assert.throws(()=>health125TaxWages({...input,health125:{...health125,items:[{...item,...patch}]}}))
 for(const patch of [{year:2027},{workState:'VA'},{residenceState:'PA'},{grossCents:NaN},{annualBonusCents:-1},{annualBonusCents:200001},{retirement:{...retirement,pretaxCents:190000}},{retirement:{...retirement,rothCents:180000}}])assert.throws(()=>health125TaxWages({...input,...patch}))
})
test('zero and maximum-safe wage boundaries preserve exact cents without overflow',()=>{
 const zero={...health125,items:[{...item,deductionCents:0}]}
 assert.equal(health125TaxWages({...input,grossCents:0,health125:zero}).federalWagesCents,0)
 const max=Number.MAX_SAFE_INTEGER,all={...health125,items:[{...item,deductionCents:max}]}
 assert.equal(health125TaxWages({...input,grossCents:max,health125:all}).federalWagesCents,0)
 assert.throws(()=>health125TaxWages({...input,grossCents:max,health125:{...all,items:[all.items[0],{...item,planId:'dental',deductionCents:1}]}}),/fit/)
})
