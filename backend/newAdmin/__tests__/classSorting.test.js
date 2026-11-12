import test from 'node:test'
import assert from 'node:assert/strict'
import { sortClasses } from '../classSorting.js'

const rows=[
  {id:1,programName:'Zulu',name:'Zulu',costAmountCents:9000,enrolledCount:12,capacity:20,waitlistCount:4,isActive:false,schedules:[{dayOfWeek:5,startTime:'16:00'}]},
  {id:2,programName:'Alpha',name:'Alpha',costAmountCents:10000,enrolledCount:2,capacity:10,waitlistCount:1,isActive:true,schedules:[{dayOfWeek:1,startTime:'17:00'}]},
]
for (const key of ['program','class','schedule','enrolled','capacity','waitlisted','status']) {
  test(`${key} sorts ascending and descending`,()=>{
    assert.deepEqual(sortClasses([...rows],key,'asc').map(row=>row.id),[2,1])
    assert.deepEqual(sortClasses([...rows],key,'desc').map(row=>row.id),[1,2])
  })
}
test('price sorting is numeric, including zero and missing prices',()=>{
  const prices=[...rows,{id:3,costAmountCents:0},{id:4}]
  assert.deepEqual(sortClasses([...prices],'cost','asc').map(row=>row.id),[3,1,2,4])
  assert.deepEqual(sortClasses([...prices],'cost','desc').map(row=>row.id),[2,1,3,4])
})
test('unsupported sort values are rejected',()=>{
  assert.throws(()=>sortClasses([],'name; DROP TABLE program','asc'),/Invalid class sort/)
  assert.throws(()=>sortClasses([],'class','arbitrary'),/Invalid class sort/)
})
