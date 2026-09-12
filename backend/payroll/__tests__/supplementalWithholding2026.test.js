import test from 'node:test'
import assert from 'node:assert/strict'
import {federalSupplementalWithholding2026 as calculate} from '../supplementalWithholding2026.js'
const base={paymentCents:200000,ytdSupplementalCents:0,historyVerified:true,year:2026,method:'FLAT_22',regularWithholdingVerified:true}
test('separate supplemental wages use eligible 22% and split the mandatory million-dollar threshold',()=>{
 assert.equal(calculate(base).federalIncomeTaxCents,44000)
 const crossing=calculate({...base,ytdSupplementalCents:99900000})
 assert.deepEqual([crossing.ordinaryCents,crossing.mandatoryCents,crossing.ordinaryTaxCents,crossing.mandatoryTaxCents],[100000,100000,22000,37000])
 assert.equal(crossing.federalIncomeTaxCents,59000)
 assert.equal(calculate({...base,ytdSupplementalCents:100000000,regularWithholdingVerified:false}).federalIncomeTaxCents,74000)
 assert.equal(calculate({...base,paymentCents:1,ytdSupplementalCents:99999999}).federalIncomeTaxCents,0)
 assert.equal(calculate({...base,paymentCents:2,ytdSupplementalCents:100000000}).federalIncomeTaxCents,1)
})
test('aggregate treatment subtracts actual regular and prior supplemental withholding once',()=>{
 const aggregate={verified:true,regularWagesCents:200000,regularFederalWithheldCents:14917,previousSupplementalCents:0,previousFederalWithheldCents:0,payFrequency:'SEMIMONTHLY',election:{verified:true,filingStatus:'SINGLE'}}
 // Independent 15-T worksheet: $3,000 * 24 - $8,600 = $63,400;
 // annual tax = $5,800 + ($63,400-$57,900)*22% = $7,010.
 const first=calculate({...base,method:'AGGREGATE',paymentCents:100000,aggregate})
 assert.equal(first.combinedFederalTaxCents,29208)
 assert.equal(first.federalIncomeTaxCents,14291)
 // $4,000 aggregate -> ($5,800 + $29,500*22%)/24 = $512.0833.
 const second=calculate({...base,method:'AGGREGATE',paymentCents:100000,ytdSupplementalCents:100000,aggregate:{...aggregate,previousSupplementalCents:100000,previousFederalWithheldCents:14291}})
 assert.equal(second.federalIncomeTaxCents,22000)
 assert.equal(second.alreadyWithheldCents,29208)
 assert.equal(calculate({...base,method:'AGGREGATE',aggregate:{...aggregate,regularFederalWithheldCents:999999}}).federalIncomeTaxCents,0)
})
test('mandatory excess ignores W-4 exemptions while ordinary aggregate wages honor them',()=>{
 const aggregate={verified:true,regularWagesCents:200000,regularFederalWithheldCents:0,previousSupplementalCents:0,previousFederalWithheldCents:0,payFrequency:'SEMIMONTHLY',election:{verified:true,filingStatus:'SINGLE',exempt:true}}
 const r=calculate({...base,method:'AGGREGATE',ytdSupplementalCents:99900000,aggregate})
 assert.equal(r.ordinaryTaxCents,0);assert.equal(r.mandatoryTaxCents,37000)
 assert.equal(calculate({...base,method:'AGGREGATE',ytdSupplementalCents:100000000}).mandatoryTaxCents,74000)
})
test('unknown history, ineligible flat method and unsafe amounts require reconciliation',()=>{
 for(const override of [{historyVerified:false},{year:2027},{regularWithholdingVerified:false},{paymentCents:-1},{paymentCents:1.5},{paymentCents:0},{ytdSupplementalCents:null},{method:'FLAT_25'},{paymentCents:Number.MAX_SAFE_INTEGER,ytdSupplementalCents:1},{method:'AGGREGATE'}])assert.throws(()=>calculate({...base,...override}))
 const aggregate={verified:true,regularWagesCents:100000,regularFederalWithheldCents:0,previousSupplementalCents:1,previousFederalWithheldCents:0,payFrequency:'WEEKLY',election:{verified:true,filingStatus:'SINGLE'}}
 assert.throws(()=>calculate({...base,method:'AGGREGATE',aggregate}),/exceed/)
})
