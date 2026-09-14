import test from 'node:test'
import assert from 'node:assert/strict'
import {w4MultipleJobs2026 as calculate} from '../../../src/utils/w4MultipleJobs2026.js'
import {w4MultipleJobsTables2026 as tables} from '../../../src/utils/w4MultipleJobsTables2026.js'
const input={filingStatus:'HEAD_OF_HOUSEHOLD',annualWagesCents:[8000000,3000000],payPeriods:26}
const permutations=values=>values.length===1?[values]:values.flatMap((value,index)=>permutations(values.filter((_,position)=>position!==index)).map(rest=>[value,...rest]))
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
test('three-job results use the correct filing-status table regardless of job order',()=>{
 const examples={
  MARRIED:{line2aCents:1704000,line2bCents:684000,line2cCents:2388000,line4Cents:99500},
  SINGLE:{line2aCents:1617000,line2bCents:873000,line2cCents:2490000,line4Cents:103750},
  HEAD_OF_HOUSEHOLD:{line2aCents:1889000,line2bCents:954000,line2cCents:2843000,line4Cents:118458}
 }
 for(const [filingStatus,expected] of Object.entries(examples)){
  for(const annualWagesCents of permutations([15000000,10000000,2000000])){
   assert.deepEqual(calculate({filingStatus,annualWagesCents,payPeriods:24,additionalCents:123}),{
    line1Cents:null,...expected,line3:24,additionalCents:123,step4cCents:expected.line4Cents+123
   },`${filingStatus}: ${annualWagesCents}`)
  }
 }
})
test('highest-job pay frequency rounds once to cents and adds extra withholding per paycheck',()=>{
 const frequencies=new Map([[1,715000],[12,59583],[16,44688],[24,29792],[26,27500],[52,13750],[366,1954]])
 for(const [payPeriods,line4Cents] of frequencies){
  const result=calculate({...input,payPeriods,additionalCents:123})
  assert.equal(result.line3,payPeriods)
  assert.equal(result.line1Cents,715000)
  assert.equal(result.line4Cents,line4Cents,`${payPeriods} pay periods`)
  assert.equal(result.step4cCents,line4Cents+123)
 }
 // Rounding the two lookups separately would incorrectly produce $634.61.
 const combined=calculate({...input,annualWagesCents:[10000000,5000000,2000000]})
 assert.equal(combined.line2aCents,1010000)
 assert.equal(combined.line2bCents,640000)
 assert.equal(combined.line4Cents,63462)
})
test('official wage band boundaries include cents below next band and the inclusive $120,000 limit',()=>{
 const example={filingStatus:'SINGLE',payPeriods:12}
 assert.equal(calculate({...example,annualWagesCents:[3999999,1999999]}).line1Cents,198000)
 assert.equal(calculate({...example,annualWagesCents:[4000000,2000000]}).line1Cents,408000)
 assert.equal(calculate({...example,annualWagesCents:[45000000,12000000]}).line1Cents,2661000)
 assert.throws(()=>calculate({...example,annualWagesCents:[45000000,12000001]}),/additional tables/)
})
for(const filingStatus of Object.keys(tables)){
 test(`${filingStatus}: one job over $120,000 is supported, with a second job exactly at the limit`,()=>{
  const validWages=[
   [12000000,12000000],
   [12000001,12000000],
   [45000000,12000000],
   [12000000,12000000,12000000],
   [12000001,12000000,5000000],
   [45000000,12000000,12000000]
  ]
  for(const wages of validWages){
   const expected=calculate({...input,filingStatus,annualWagesCents:wages})
   assert.ok(Number.isSafeInteger(expected.step4cCents))
   for(const annualWagesCents of permutations(wages)){
    assert.deepEqual(calculate({...input,filingStatus,annualWagesCents}),expected)
   }
  }
  const invalidWages=[
   [12000001,12000001],
   [45000000,12000001],
   [12000001,12000001,1000000],
   [45000000,12000001,5000000],
   [12000001,12000001,12000001]
  ]
  for(const wages of invalidWages){
   for(const annualWagesCents of permutations(wages)){
    assert.throws(()=>calculate({...input,filingStatus,annualWagesCents}),/additional tables/,`${annualWagesCents}`)
   }
  }
 })
 test(`${filingStatus}: all reachable printed table bands include their lower and upper cent boundaries`,()=>{
  // This checks band selection against the committed IRS table data; the PDF
  // extraction/source audit verifies the dollar amounts themselves separately.
  const rows=tables[filingStatus]
  for(const [rowIndex,row] of rows.entries()){
   const rowMinimum=row.minimumDollars*100
   const rowMaximum=rowIndex+1<rows.length?rows[rowIndex+1].minimumDollars*100-1:Number.MAX_SAFE_INTEGER
   for(const [column,annualDollars] of row.annualDollars.entries()){
    const columnMinimum=column*1000000
    const columnMaximum=column===11?12000000:(column+1)*1000000-1
    for(const lower of [columnMinimum,columnMaximum]){
     for(const higher of [Math.max(rowMinimum,lower),rowMaximum]){
      if(higher>rowMaximum||higher<lower)continue
      const label=`row ${rowIndex}, column ${column}, wages ${higher}/${lower}`
      assert.equal(calculate({...input,filingStatus,annualWagesCents:[higher,lower]}).line1Cents,annualDollars*100,label)
     }
    }
   }
  }
 })
}
test('invalid inputs never fabricate a worksheet result or overflow integer cents',()=>{
 for(const change of [{filingStatus:'__proto__'},{filingStatus:''},{payPeriods:0},{payPeriods:26.5},{payPeriods:367},{annualWagesCents:[100]},{annualWagesCents:[1,2,3,4]},{annualWagesCents:[-1,100]},{annualWagesCents:[1.5,100]},{additionalCents:-1},{additionalCents:Number.MAX_SAFE_INTEGER}])assert.throws(()=>calculate({...input,...change}))
 const wages=[1000000,8000000];calculate({...input,annualWagesCents:wages});assert.deepEqual(wages,[1000000,8000000])
})
test('non-numeric, non-finite, fractional, and unsafe numeric inputs are rejected',()=>{
 for(const filingStatus of [undefined,null,false,123,'toString','MARRIED_FILING_SEPARATELY']){
  assert.throws(()=>calculate({...input,filingStatus}),/filing status/)
 }
 for(const payPeriods of [undefined,null,false,'26',NaN,Infinity,-Infinity,Number.MAX_SAFE_INTEGER]){
  assert.throws(()=>calculate({...input,payPeriods}),/pay periods/)
 }
 for(const annualWagesCents of [undefined,null,'8000000,3000000',{},[]]){
  assert.throws(()=>calculate({...input,annualWagesCents}),/two or three concurrent jobs/)
 }
 for(const invalid of [undefined,null,false,'100',NaN,Infinity,-Infinity,-1,1.5,Number.MAX_SAFE_INTEGER+1,1n]){
  for(const wages of [[8000000,3000000],[8000000,3000000,1000000]]){
   for(let index=0;index<wages.length;index++){
    const annualWagesCents=[...wages];annualWagesCents[index]=invalid
    assert.throws(()=>calculate({...input,annualWagesCents}),/whole-cent annual wages/)
   }
  }
  // Omitted extra withholding defaults to zero; every other invalid value fails.
  if(invalid!==undefined)assert.throws(()=>calculate({...input,additionalCents:invalid}),/whole-cent annual wages/)
 }
})
test('combined three-job wages and total per-paycheck withholding cannot overflow safe cents',()=>{
 const maximum=Number.MAX_SAFE_INTEGER
 assert.doesNotThrow(()=>calculate({...input,annualWagesCents:[maximum,12000000]}))
 assert.doesNotThrow(()=>calculate({...input,annualWagesCents:[maximum-1,1,0]}))
 for(const annualWagesCents of permutations([maximum,1,0])){
  assert.throws(()=>calculate({...input,annualWagesCents}),/whole-cent annual wages/)
 }
 const base=calculate(input).line4Cents
 assert.equal(calculate({...input,additionalCents:maximum-base}).step4cCents,maximum)
 assert.throws(()=>calculate({...input,additionalCents:maximum-base+1}),/whole-cent annual wages/)
})
