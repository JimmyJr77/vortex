import test from 'node:test'
import assert from 'node:assert/strict'
import {compensationApplicabilityInput,compensationCategories} from '../compensationApplicability.js'
test('compensation applicability requires every explicit category without defaults',()=>{
 const categories=Object.fromEntries(Object.keys(compensationCategories).map(key=>[key,'UNRESOLVED'])),body={year:2026,confirmed:true,expectedRevision:0,sourceFingerprint:'a'.repeat(64),reference:'Synthetic annual applicability evidence',categories}
 assert.deepEqual(compensationApplicabilityInput(body).categories,categories)
 for(const status of ['NOT_APPLICABLE','APPLICABLE'])assert.equal(compensationApplicabilityInput({...body,categories:{...categories,tips:status}}).categories.tips,status)
 for(const change of [{categories:{}},{categories:{...categories,tips:false}},{categories:{...categories,unknown:'NOT_APPLICABLE'}},{confirmed:false},{reference:'short'},{year:2025}])assert.throws(()=>compensationApplicabilityInput({...body,...change}))
})

test('employer-only retirement participation requires explicit exclusion of other retirement reporting',()=>{
 const body={year:2026,confirmed:true,expectedRevision:0,sourceFingerprint:'a'.repeat(64),reference:'Verified employer-only active retirement participation',categories:Object.fromEntries(Object.keys(compensationCategories).map(key=>[key,key==='retirement'?'EMPLOYER_ONLY_PARTICIPATION':'NOT_APPLICABLE']))}
 assert.throws(()=>compensationApplicabilityInput(body));assert.equal(compensationApplicabilityInput({...body,retirementEmployerOnlyConfirmed:true}).categories.retirement,'EMPLOYER_ONLY_PARTICIPATION')
 assert.throws(()=>compensationApplicabilityInput({...body,retirementEmployerOnlyConfirmed:true,categories:{...body.categories,tips:'EMPLOYER_ONLY_PARTICIPATION'}}))
})

test('standard 401k applicability requires explicit scope confirmation',()=>{
 const body={year:2026,confirmed:true,expectedRevision:0,sourceFingerprint:'a'.repeat(64),reference:'Verified complete internal standard 401k reporting',categories:Object.fromEntries(Object.keys(compensationCategories).map(key=>[key,key==='retirement'?'STANDARD_401K_DEFERRALS':'NOT_APPLICABLE']))}
 assert.throws(()=>compensationApplicabilityInput(body),/Confirm only/)
 assert.equal(compensationApplicabilityInput({...body,retirementStandard401kConfirmed:true}).categories.retirement,'STANDARD_401K_DEFERRALS')
})
