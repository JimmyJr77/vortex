import test from 'node:test'
import assert from 'node:assert/strict'
import {retirement401kTaxWages} from '../retirement401kTaxWages.js'
import {calculateWithholding2026} from '../withholding2026.js'
const treatment={planType:'STANDARD_401K',pretaxCents:10000,rothCents:5000,pretaxAnnualBonusCents:0}
const input={...treatment,grossCents:200000,annualBonusCents:0,year:2026,workState:'MD',residenceState:'MD'}
test('401k pretax reduces income-tax wages while Roth and unemployment/FICA bases remain distinct',()=>{
 const result=retirement401kTaxWages(input)
 assert.equal(result.federalWagesCents,190000);assert.equal(result.marylandWagesCents,190000)
 for(const field of ['socialSecurityWagesCents','medicareWagesCents','futaWagesCents','marylandUnemploymentWagesCents'])assert.equal(result[field],200000)
 const args={grossPayCents:200000,election:{verified:true,federal:{filingStatus:'SINGLE'},maryland:{filingStatus:'SINGLE',localRate:3.2,exemptions:1}},payFrequency:'SEMIMONTHLY',year:2026,workState:'MD',residenceState:'MD'}
 const withholding=calculateWithholding2026({...args,retirement401k:treatment});assert.equal(withholding.federalIncomeTaxCents,13717);assert.equal(withholding.stateIncomeTaxCents,12919)
 assert.equal(withholding.incomeTaxWageBasis.grossWagesCents,200000);assert.equal(withholding.incomeTaxWageBasis.pretaxDeductionCents,10000)
 const bonus=calculateWithholding2026({...args,hasBonus:true,annualBonusCents:50000,bonusReviewComplete:true,retirement401k:{...treatment,pretaxAnnualBonusCents:4000}});assert.equal(bonus.stateIncomeTaxCents,13724);assert.equal(bonus.incomeTaxWageBasis.marylandAnnualBonusWagesCents,46000)
 assert.equal(calculateWithholding2026(args).federalIncomeTaxCents,14917)
 assert.throws(()=>calculateWithholding2026({...args,retirement401k:treatment,pretaxDeductionCents:1}),/separately verified/)
})
test('retirement bonus allocation is explicit and cannot reduce unrelated wage categories',()=>{
 const result=retirement401kTaxWages({...input,annualBonusCents:50000,pretaxAnnualBonusCents:4000})
 assert.equal(result.marylandAnnualBonusWagesCents,46000);assert.equal(result.marylandRegularWagesCents,144000)
 for(const patch of [{rothCents:200000},{pretaxCents:200001},{pretaxAnnualBonusCents:10001},{annualBonusCents:200001},{pretaxAnnualBonusCents:null},{year:2027},{workState:'VA'},{planType:'403B'}])assert.throws(()=>retirement401kTaxWages({...input,...patch}))
 assert.throws(()=>retirement401kTaxWages({...input,annualBonusCents:199000,pretaxAnnualBonusCents:0}),/corresponding wages/)
})
