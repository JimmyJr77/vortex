import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'

test('historical harness clock is isolated from ordinary payroll database sessions', {skip:!process.env.PAYROLL_TEST_DATABASE_URL}, async()=>{
 const historical=await createHarness({databaseNow:'2026-09-08T12:00:00.000Z'})
 let ordinary
 try{
  ordinary=await createHarness()
  const old=(await historical.pool.query('SELECT now() AS saved_time, clock_timestamp() AS actual_time')).rows[0]
  const current=(await ordinary.pool.query('SELECT now() AS saved_time, clock_timestamp() AS actual_time')).rows[0]
  assert.equal(old.saved_time.toISOString(),'2026-09-08T12:00:00.000Z')
  assert.ok(Math.abs(current.saved_time-current.actual_time)<1000)
  const inserted=(await historical.pool.query("INSERT INTO payroll_audit_log(facility_id,action,entity_type,entity_id) VALUES(1,'CLOCK_FIXTURE','test','1') RETURNING created_at")).rows[0]
  assert.equal(inserted.created_at.toISOString(),'2026-09-08T12:00:00.000Z')
 }finally{if(ordinary)await ordinary.close();await historical.close()}
})

test('isolated payroll reference clock applies to business dates and expiry checks', {skip:!process.env.PAYROLL_TEST_DATABASE_URL},async()=>{
 const fixed='2026-09-13T16:00:00.000Z'
 const h=await createHarness({databaseNow:fixed})
 try{
  const row=(await h.pool.query('SELECT now() AS business_time,clock_timestamp() AS expiry_time')).rows[0]
  assert.equal(row.business_time.toISOString(),fixed)
  assert.equal(row.expiry_time.toISOString(),fixed)
 }finally{await h.close()}
 const live=await createHarness()
 try{
  const before=Date.now()
  const row=(await live.pool.query('SELECT now() AS business_time,clock_timestamp() AS expiry_time')).rows[0]
  const after=Date.now()
  for(const value of Object.values(row))assert.ok(value.getTime()>=before-1000&&value.getTime()<=after+1000)
 }finally{await live.close()}
})
