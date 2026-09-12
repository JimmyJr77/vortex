import test from 'node:test'
import assert from 'node:assert/strict'
import {nativeAllocationCoverage as recover} from '../nativeAllocationCoverage.js'
const fixture=()=>{
 const entry={id:1,workDate:'2026-08-03',clockIn:'2026-08-03T12:00:00Z',clockOut:'2026-08-03T13:00:00Z',minutes:60,regularMinutes:60,overtimeMinutes:0,straightTimePayCents:2500,premiumCents:0}
 const frozen={...entry,workweekStart:'2026-08-03',status:'APPROVED'}
 return {payment:{runId:1,periodStart:'2026-08-03',periodEnd:'2026-08-05',regularMinutes:60,overtimeMinutes:0,regularPayCents:2500,overtimePayCents:0,frozenCalculation:{payType:'HOURLY',regularMinutes:60,overtimeMinutes:0,regularPayCents:2500,overtimePayCents:0,entries:[frozen]}},record:{week:'2026-08-03',workedMinutes:60,straightTimePayCents:2500,premiumCents:0},coverage:{version:1,method:'TEST',entries:[entry]}}
}
test('native coverage uses matching immutable hours and paid wages without changing historical records',()=>{
 const input=fixture(),before=structuredClone(input)
 assert.deepEqual(recover(input.payment,input.record,input.coverage),input.coverage)
 assert.deepEqual(input,before)
})
test('native coverage rejects absent, changed, duplicated and unreconciled payroll evidence',()=>{
 for(const change of [
  i=>i.payment.frozenCalculation=null,
  i=>i.payment.frozenCalculation.payType='SALARY',
  i=>i.payment.frozenCalculation.regularPayCents=2501,
  i=>i.payment.frozenCalculation.entries.push({...i.payment.frozenCalculation.entries[0]}),
  i=>i.payment.frozenCalculation.entries[0].status='UNVERIFIED',
  i=>i.payment.frozenCalculation.entries[0].clockOut='2026-08-03T14:00:00Z',
  i=>i.record.premiumCents=1,
  i=>i.coverage.entries[0].straightTimePayCents=2501,
 ]){const input=fixture();change(input);assert.throws(()=>recover(input.payment,input.record,input.coverage))}
})
