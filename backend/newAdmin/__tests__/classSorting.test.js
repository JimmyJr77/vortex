import test from 'node:test'
import assert from 'node:assert/strict'
import { sortClasses } from '../classSorting.js'

const rows=[
  {id:1,programName:'Zulu',name:'Zulu',costAmountCents:9000,enrolledCount:12,capacity:20,waitlistCount:4,isActive:false,schedules:[{dayOfWeek:5,startTime:'16:00'}]},
  {id:2,programName:'Alpha',name:'Alpha',costAmountCents:10000,enrolledCount:2,capacity:10,waitlistCount:1,isActive:true,schedules:[{dayOfWeek:1,startTime:'17:00'}]},
]
for (const key of ['program','class','schedule','status']) {
  test(`${key} sorts ascending and descending`,()=>{
    assert.deepEqual(sortClasses([...rows],key,'asc').map(row=>row.id),[2,1])
    assert.deepEqual(sortClasses([...rows],key,'desc').map(row=>row.id),[1,2])
  })
}
for (const [key, metric] of [['enrolled', 'enrolledCount'], ['capacity', 'capacity'], ['waitlisted', 'waitlistCount']]) {
  test(`${key} sorts by displayed offering metrics and keeps each class together`, () => {
    const classes = [
      { id: 1, [metric]: 21, scheduleGroups: [{ id: 11, [metric]: 8 }, { id: 12, [metric]: 0 }] },
      { id: 2, [metric]: 3, scheduleGroups: [{ id: 21, [metric]: 3 }] },
      { id: 3, [metric]: 0, scheduleGroups: [] },
    ]
    const order = direction => sortClasses([...classes], key, direction)
      .map(row => [row.id, row.scheduleGroups.map(group => group.id)])
    assert.deepEqual(order('asc'), [[1, [12, 11]], [2, [21]], [3, []]])
    assert.deepEqual(order('desc'), [[1, [11, 12]], [2, [21]], [3, []]])
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
