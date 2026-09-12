import test from 'node:test'
import assert from 'node:assert/strict'
import {employeeHealthInput} from '../employeeHealthClassification.js'
test('employee health classification distinguishes verified reportable cost from relief or unresolved status',()=>{
 const body={year:2026,confirmed:true,expectedRevision:0,determinationId:1,sourceFingerprint:'a'.repeat(64),disposition:'REPORT',reportableCostCents:690000,reference:'Synthetic verified annual coverage cost'}
 assert.equal(employeeHealthInput(body).reportableCostCents,690000)
 for(const disposition of ['RELIEF_USED','NO_APPLICABLE_COVERAGE','UNRESOLVED'])assert.equal(employeeHealthInput({...body,disposition,reportableCostCents:null}).reportableCostCents,null)
 for(const change of [{reportableCostCents:null},{reportableCostCents:0},{reportableCostCents:-1},{reportableCostCents:1.2},{reportableCostCents:'690000'},{disposition:'RELIEF_USED'},{determinationId:0},{confirmed:false},{sourceFingerprint:'bad'},{reference:'short'}])assert.throws(()=>employeeHealthInput({...body,...change}))
})
