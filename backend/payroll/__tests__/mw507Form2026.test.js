import test from 'node:test'
import assert from 'node:assert/strict'
import {mw507FormInput2026,mw507Worksheet2026,mw507ReviewRequirements2026} from '../mw507Form2026.js'
import {syntheticMw507} from '../testing/mw507Fixture.js'
test('MW507 captures exact rate choice and computes the worksheet with truncation, not rounding',()=>{
 const original=syntheticMw507(),input=mw507FormInput2026(original)
 assert.equal(input.withholdingRate,'MARRIED_SINGLE');assert.deepEqual(input.worksheet.lines,{a:960000,b:320000,c:480000,d:200000,e:1960000,f:6});assert.equal(input.exemptions,5)
 assert.deepEqual(original,syntheticMw507())
 assert.throws(()=>mw507FormInput2026({...original,exemptions:7}),{status:400})
 for(const [group,agi,expected] of [['SINGLE',10000000,320000],['SINGLE',10000001,160000],['SINGLE',12500000,160000],['SINGLE',12500001,80000],['SINGLE',15000000,80000],['SINGLE',15000001,0],['JOINT',15000000,320000],['JOINT',15000001,160000],['JOINT',17500000,160000],['JOINT',17500001,80000],['JOINT',20000000,80000],['JOINT',20000001,0]])assert.equal(mw507Worksheet2026({...original.worksheet,filingGroup:group,agiCents:agi}).exemptionValueCents,expected)
})
test('Maryland claim basis preserves separate Pennsylvania local exemptions and review obligations',()=>{
 for(const localExemption of ['NONE','YORK_ADAMS','NO_LOCAL_TAX']){
  const body={...syntheticMw507(),claim:{kind:'PENNSYLVANIA',noMarylandAbode:true,localExemption}}
  assert.equal(mw507FormInput2026(body).claim.localExemption,localExemption)
  assert.deepEqual(mw507ReviewRequirements2026(body).comptrollerSubmissionReasons,['NONRESIDENCE_CLAIM'])
 }
 const military={...syntheticMw507(),claim:{kind:'MILITARY_SPOUSE',state:'VA',certifiedEligible:true}}
 assert.deepEqual(mw507ReviewRequirements2026(military).attachmentsRequired,['MW507M','SPOUSAL_MILITARY_ID'])
 const noTax={...syntheticMw507(),claim:{kind:'NO_LIABILITY',priorYearNoTax:true,currentYearNoTax:true,effectiveYear:2026}}
 assert.equal(mw507ReviewRequirements2026(noTax).renewBy,'2027-02-15');assert.equal(mw507ReviewRequirements2026(noTax).noLiabilityWeeklyWageReviewRequired,true)
 assert.equal(mw507ReviewRequirements2026({...syntheticMw507(),worksheet:null,exemptions:11}).comptrollerSubmissionReasons[0],'MORE_THAN_TEN_EXEMPTIONS')
})
test('MW507 rejects invalid identity, mixed claims and incomplete attestations without inventing claims',()=>{
 for(const patch of [{year:2025},{withholdingRate:'HEAD_OF_HOUSEHOLD'},{exemptions:-1},{additionalWithholdingCents:1.5},{personal:{...syntheticMw507().personal,ssn:'000123456'}},{claim:{kind:'NONE',localExemption:'YORK_ADAMS'}},{claim:{kind:'NO_LIABILITY',priorYearNoTax:true,currentYearNoTax:false,effectiveYear:2026}},{claim:{kind:'RECIPROCAL',state:'PA',noMarylandAbode:true}},{claim:{kind:'PENNSYLVANIA',noMarylandAbode:false,localExemption:'NONE'}},{claim:{kind:'MILITARY_SPOUSE',state:'MD',certifiedEligible:true}}])assert.throws(()=>mw507FormInput2026({...syntheticMw507(),...patch}),{status:400})
})
