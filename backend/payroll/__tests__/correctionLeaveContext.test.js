import test from 'node:test'
import assert from 'node:assert/strict'
import {correctionLeaveContext} from '../correctionLeaveContext.js'
const input=()=>({plan:{version:1,status:'LEAVE_DIFFERENCE_CALCULATED',throughRunId:1,creditDifferenceMinutes:4,finalRemainder:29,items:[{runId:1,paymentDate:'2026-08-14',deltaMinutes:4,remainderBefore:0,remainderAfter:29,workedMinutesBefore:2400,workedMinutesAfter:2549}]},calculationId:10,fingerprint:'reviewed',paymentDate:'2026-09-04',balanceMinutes:80,yearAccruedMinutes:80,remainder:{sourceRunId:'1',remainder:0,source:'FINALIZED_FRACTION'},eligibility:{priorRunId:'1',priorWorkedMinutes:2400}})
test('target leave context carries corrected balances fractions and preceding hours',()=>{
 const r=correctionLeaveContext(input());assert.equal(r.balanceMinutes,84);assert.equal(r.yearAccruedMinutes,84);assert.equal(r.remainder.remainder,29);assert.equal(r.eligibility.priorWorkedMinutes,2549)
})
test('target leave context rejects changed sources carryover insufficient balances and inconsistent replay',()=>{
 const a=input();assert.throws(()=>correctionLeaveContext({...a,remainder:{...a.remainder,sourceRunId:'2'}}),/fraction source/)
 assert.throws(()=>correctionLeaveContext({...a,paymentDate:'2027-01-05'}),/carryover/)
 assert.throws(()=>correctionLeaveContext({...a,eligibility:{priorRunId:'1',priorWorkedMinutes:2300}}),/preceding-period hours/)
 assert.throws(()=>correctionLeaveContext({...a,plan:{...a.plan,creditDifferenceMinutes:5}}),/totals/)
 assert.throws(()=>correctionLeaveContext({...a,balanceMinutes:0,plan:{...a.plan,creditDifferenceMinutes:-4,items:[{...a.plan.items[0],deltaMinutes:-4}]}}),/insufficient balance/)
})
