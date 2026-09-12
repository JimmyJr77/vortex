import test from 'node:test'
import assert from 'node:assert/strict'
import {w4MultipleJobs2026 as calculate} from '../../../src/utils/w4MultipleJobs2026.js'
const input={filingStatus:'HEAD_OF_HOUSEHOLD',annualWagesCents:[8000000,3000000],payPeriods:26}
test('official two-job example uses household table, annual wages and highest-job frequency',()=>{
 assert.deepEqual(calculate({...input,additionalCents:1000}),{line1Cents:715000,line2aCents:null,line2bCents:null,line2cCents:null,line3:26,line4Cents:27500,additionalCents:1000,step4cCents:28500})
 assert.equal(calculate({...input,annualWagesCents:[3000000,8000000]}).line1Cents,715000)
 assert.equal(calculate({...input,filingStatus:'SINGLE'}).line1Cents,630000)
 assert.equal(calculate({...input,filingStatus:'MARRIED'}).line1Cents,424000)
})
test('three-job worksheet adds a second lookup using the combined top two annual wages',()=>{
 const result=calculate({filingStatus:'MARRIED',annualWagesCents:[2000000,15000000,10000000],payPeriods:24})
 assert.equal(result.line1Cents,null);assert.equal(result.line2aCents,1704000);assert.equal(result.line2bCents,684000);assert.equal(result.line2cCents,2388000);assert.equal(result.line4Cents,99500)
 const uneven=calculate({...input,annualWagesCents:[10000000,5000000,2000000]})
 assert.equal(uneven.line2cCents,1650000);assert.equal(uneven.line4Cents,63462)
})
test('official wage band boundaries include cents below next band and the inclusive $120,000 limit',()=>{
 const example={filingStatus:'SINGLE',payPeriods:12}
 assert.equal(calculate({...example,annualWagesCents:[3999999,1999999]}).line1Cents,198000)
 assert.equal(calculate({...example,annualWagesCents:[4000000,2000000]}).line1Cents,408000)
 assert.equal(calculate({...example,annualWagesCents:[45000000,12000000]}).line1Cents,2661000)
 assert.throws(()=>calculate({...example,annualWagesCents:[45000000,12000001]}),/additional tables/)
})
test('invalid inputs never fabricate a worksheet result or overflow integer cents',()=>{
 for(const change of [{filingStatus:'__proto__'},{filingStatus:''},{payPeriods:0},{payPeriods:26.5},{payPeriods:367},{annualWagesCents:[100]},{annualWagesCents:[1,2,3,4]},{annualWagesCents:[-1,100]},{annualWagesCents:[1.5,100]},{additionalCents:-1},{additionalCents:Number.MAX_SAFE_INTEGER}])assert.throws(()=>calculate({...input,...change}))
 const wages=[1000000,8000000];calculate({...input,annualWagesCents:wages});assert.deepEqual(wages,[1000000,8000000])
})
