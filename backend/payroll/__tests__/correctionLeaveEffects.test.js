import test from 'node:test'
import assert from 'node:assert/strict'
import {replayCorrectionLeave} from '../correctionLeaveEffects.js'
const row=(id,worked,earned,balance,year,before,after,extra={})=>({run_id:id,payment_date:`2026-08-${id===1?'14':'28'}`,regular_minutes:worked,overtime_minutes:0,sick_leave_accrual_minutes:earned,ledger_minutes:earned,frequency:'SEMIMONTHLY',statement_snapshot:{sickLeaveAccrualPolicy:{version:1,method:'ACCRUAL',annualCapMinutes:2400,balanceCapMinutes:3840},sickLeaveBalanceBeforeMinutes:balance,sickLeaveYearAccruedBeforeMinutes:year,sickLeaveFraction:{version:1,remainderBefore:before,remainderAfter:after,sourceRunId:id===1?null:'1'},...extra}})
const change=(before,after)=>[{runId:1,before:{regularMinutes:before,overtimeMinutes:0},after:{regularMinutes:after,overtimeMinutes:0}}]
test('leave correction carries earned fractions into subsequent payroll',()=>{
 const r=replayCorrectionLeave([row(1,1560,52,0,0,0,0),row(2,1561,52,52,52,0,1)],change(1560,1589))
 assert.equal(r.creditDifferenceMinutes,1);assert.equal(r.items[0].deltaMinutes,0);assert.equal(r.items[1].deltaMinutes,1);assert.equal(r.finalRemainder,0)
})
test('leave correction propagates annual and balance caps rather than duplicating credits',()=>{
 const annual=replayCorrectionLeave([row(1,2400,80,2250,2250,0,0),row(2,2400,70,2330,2330,0,0)],change(2400,2520))
 assert.deepEqual(annual.items.map(i=>i.deltaMinutes),[4,-4]);assert.equal(annual.creditDifferenceMinutes,0)
 const balance=replayCorrectionLeave([row(1,2400,80,3760,0,0,0)],change(2400,2520));assert.equal(balance.creditDifferenceMinutes,0)
})
test('weekly correction changes eligibility in the following pay period',()=>{
 const a=row(1,720,0,0,0,0,0,{sickLeaveEligibility:{priorWorkedMinutes:0,firstEmploymentPeriod:true}}),b=row(2,600,0,0,0,0,0,{sickLeaveEligibility:{priorRunId:'1',priorWorkedMinutes:720}})
 a.frequency=b.frequency='WEEKLY'
 const r=replayCorrectionLeave([a,b],change(720,1440));assert.equal(r.creditDifferenceMinutes,68);assert.deepEqual(r.items.map(i=>i.accruedMinutesAfter),[48,20])
})
test('leave correction requires original policy and reconciled ledger and fractional evidence',()=>{
 const a=row(1,2400,80,0,0,0,0)
 assert.throws(()=>replayCorrectionLeave([{...a,ledger_minutes:79}],change(2400,2520)),/recorded leave credit/)
 assert.throws(()=>replayCorrectionLeave([{...a,statement_snapshot:{...a.statement_snapshot,sickLeaveAccrualPolicy:null}}],change(2400,2520)),/dated leave accrual policy/)
 const b=row(2,2400,80,80,80,0,0);b.statement_snapshot.sickLeaveFraction.sourceRunId='99'
 assert.throws(()=>replayCorrectionLeave([a,b],change(2400,2520)),/checkpoint/)
})
