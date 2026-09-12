import test from 'node:test'
import assert from 'node:assert/strict'
import {w4Deductions2026 as calculate} from '../../../src/utils/w4Deductions2026.js'
const base=()=>({status:'SINGLE',filingStatus:'SINGLE',totalIncomeCents:5000000,selfSenior:false,spouseSenior:false,qualifiedTipsCents:0,qualifiedOvertimeCents:0,vehicleInterestCents:0,adjustmentsCents:0,medicalExpensesCents:0,stateLocalTaxesCents:0,mortgageInterestCents:0,acquisitionDebtCents:0,charitableGiftsCents:0,otherItemizedCents:0,cashGiftsCents:0})
test('standard deduction is not itself entered as an additional W-4 deduction',()=>{
 for(const [status,filingStatus,standard] of [['SINGLE','SINGLE',1610000],['MARRIED_SEPARATELY','SINGLE',1610000],['MARRIED_JOINTLY','MARRIED',3220000],['SURVIVING_SPOUSE','MARRIED',3220000],['HEAD_OF_HOUSEHOLD','HEAD_OF_HOUSEHOLD',2415000]]){
  const result=calculate({...base(),status,filingStatus});assert.equal(result.lines['11'],standard);assert.equal(result.step4bCents,0)
 }
})
test('joint deductions cap qualified estimates and add eligible seniors, adjustments and standard cash gifts',()=>{
 const result=calculate({...base(),status:'MARRIED_JOINTLY',filingStatus:'MARRIED',totalIncomeCents:10000000,selfSenior:true,spouseSenior:true,qualifiedTipsCents:3000000,qualifiedOvertimeCents:3000000,vehicleInterestCents:1500000,adjustmentsCents:200000,cashGiftsCents:300000})
 assert.equal(result.lines['1a'],2500000);assert.equal(result.lines['1b'],2500000);assert.equal(result.lines['1c'],1000000);assert.equal(result.lines['4'],1200000);assert.equal(result.lines['12'],200000);assert.equal(result.step4bCents,7600000)
})
test('itemized worksheet subtracts medical/charity floors and only deducts excess over the standard deduction',()=>{
 const result=calculate({...base(),medicalExpensesCents:1000000,stateLocalTaxesCents:1000000,mortgageInterestCents:1500000,acquisitionDebtCents:20000000,charitableGiftsCents:200000,otherItemizedCents:100000,adjustmentsCents:100000,cashGiftsCents:100000})
 assert.equal(result.lines['6a'],625000);assert.equal(result.lines['6d'],175000);assert.equal(result.lines['7'],3400000);assert.equal(result.lines['12'],0);assert.equal(result.lines['14'],1790000);assert.equal(result.step4bCents,1890000);assert.equal(result.usesItemized,true)
 const tie=calculate({...base(),otherItemizedCents:1710000,cashGiftsCents:100000});assert.equal(tie.usesItemized,false);assert.equal(tie.step4bCents,100000)
})
test('limitation boundaries, senior skip instruction and cent rounding follow page 4',()=>{
 const before=calculate({...base(),totalIncomeCents:64059999,otherItemizedCents:10000000})
 const at=calculate({...base(),totalIncomeCents:64060000,otherItemizedCents:10000000})
 assert.equal(before.lines['10'],10000000);assert.equal(at.lines['10'],9400000)
 const skip=calculate({...base(),totalIncomeCents:100000,selfSenior:true,otherItemizedCents:10000000});assert.equal(skip.lines['9'],null);assert.equal(skip.lines['10'],0);assert.equal(skip.step4bCents,600000)
 const cents=calculate({...base(),totalIncomeCents:101,medicalExpensesCents:100,charitableGiftsCents:100});assert.equal(cents.lines['6a'],92);assert.equal(cents.lines['6d'],99)
 const halfCent=calculate({...base(),totalIncomeCents:100,medicalExpensesCents:100,charitableGiftsCents:100});assert.equal(halfCent.lines['6a'],93);assert.equal(halfCent.lines['6d'],100)
})
test('separate and surviving-spouse statuses use their distinct limits',()=>{
 const separate=calculate({...base(),status:'MARRIED_SEPARATELY',stateLocalTaxesCents:3000000});assert.equal(separate.lines['6b'],2020000);assert.equal(separate.step4bCents,410000)
 const survivor=calculate({...base(),status:'SURVIVING_SPOUSE',filingStatus:'MARRIED',qualifiedOvertimeCents:2000000,cashGiftsCents:300000});assert.equal(survivor.lines['1b'],1250000);assert.equal(survivor.lines['12'],100000)
})
test('unsupported eligibility ranges and malformed values stop rather than silently omit deductions',()=>{
 for(const change of [{status:'__proto__'},{status:'MARRIED_JOINTLY'},{spouseSenior:true},{selfSenior:'yes'},{status:'MARRIED_SEPARATELY',qualifiedTipsCents:1},{status:'MARRIED_SEPARATELY',selfSenior:true},{totalIncomeCents:15000000,qualifiedTipsCents:1},{totalIncomeCents:10000000,vehicleInterestCents:1},{totalIncomeCents:7500000,selfSenior:true},{totalIncomeCents:50500000,stateLocalTaxesCents:1},{mortgageInterestCents:1,acquisitionDebtCents:75000000},{adjustmentsCents:-1},{medicalExpensesCents:1.5},{cashGiftsCents:Infinity},{adjustmentsCents:Number.MAX_SAFE_INTEGER,qualifiedTipsCents:1}])assert.throws(()=>calculate({...base(),...change}))
})
