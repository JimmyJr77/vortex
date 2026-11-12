import test from 'node:test'
import assert from 'node:assert/strict'
import { createSchedulingHandlers } from '../handlers.js'

for (const [body, expected] of [
  [{}, [null,null]],
  [{startDate:'',endDate:''}, [null,null]],
  [{startDate:null,endDate:null}, [null,null]],
  [{startDate:'2026-11-12'}, ['2026-11-12',null]],
  [{endDate:'2026-12-31'}, [null,'2026-12-31']],
  [{startDate:'2026-11-12',endDate:'2026-12-31'}, ['2026-11-12','2026-12-31']],
]) test(`class offering accepts optional dates ${JSON.stringify(body)}`, async()=>{
  let inserted
  const pool={async query(sql,params){
    if(sql.includes('SELECT COUNT')) return {rows:[{c:0}]}
    assert.match(sql,/INSERT INTO scheduling_offering/)
    inserted=params
    return {rows:[{id:1,form_id:2,start_date:params[1],end_date:params[2]}]}
  }}
  const res={statusCode:200,status(code){this.statusCode=code;return this},json(body){this.body=body}}
  await createSchedulingHandlers(pool).createOffering({params:{formId:2},body},res)
  assert.equal(res.statusCode,200)
  assert.deepEqual(inserted.slice(1,3),expected)
  assert.equal(res.body.data.evergreen,expected[1]===null)
})
for(const body of [{startDate:'bad'},{endDate:'bad'},{startDate:'2026-12-31',endDate:'2026-11-12'}]) test(`invalid class dates rejected ${JSON.stringify(body)}`,async()=>{
 const pool={query(){throw new Error('Must not write invalid dates')}}
 const res={status(code){this.statusCode=code;return this},json(body){this.body=body}}
 await createSchedulingHandlers(pool).createOffering({params:{formId:2},body},res)
 assert.equal(res.statusCode,400)
})
