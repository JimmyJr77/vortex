import test from 'node:test'
import assert from 'node:assert/strict'
import {calculateAllocatedEarningsWeek as calculate} from '../regularRateWeek.js'
import {settleAllocatedEarningsWeek as settle} from '../weightedOvertime.js'
const allocations=[{minutes:1440,earningsNumerator:'100001',earningsDenominator:2},{minutes:1440,earningsNumerator:'60000',earningsDenominator:1}]
test('reviewed fractional earnings retain exact regular rate until payment rounding',()=>{
 const result=calculate(allocations)
 // $500.005 + $600 over 48 hours: $1100.005 / 48 * 0.5 * 8 = $91.6670833...
 assert.equal(result.workedMinutes,2880);assert.equal(result.overtimeMinutes,480)
 assert.equal(result.straightTimePayCents,110001);assert.equal(result.overtimePremiumCents,9167);assert.equal(result.totalPayCents,119168)
 assert.equal(result.earningsNumerator,'220001');assert.equal(result.earningsDenominator,'2')
 assert.deepEqual(calculate([...allocations].reverse()),result)
 assert.deepEqual(calculate([{minutes:720,earningsNumerator:'100001',earningsDenominator:4},{minutes:720,earningsNumerator:'100001',earningsDenominator:4},allocations[1]]),result)
 assert.equal(calculate([]).totalPayCents,0)
 assert.equal(calculate([{minutes:2400,earningsNumerator:'100000',earningsDenominator:1}]).overtimePremiumCents,0)
})
test('allocated earnings settlement uses the exact rate and independently verified premium history',()=>{
 const input={allocations,priorPremiums:[{runId:4,premiumCents:3000}],historyVerified:true,workweekClosed:true}
 const result=settle(input);assert.equal(result.premiumDueCents,6167);assert.equal(result.status,'PREMIUM_DUE')
 assert.equal(settle({...input,priorPremiums:[...input.priorPremiums,{runId:5,premiumCents:6167}]}).status,'SETTLED')
 const overpaid=settle({...input,priorPremiums:[{runId:4,premiumCents:10000}]});assert.equal(overpaid.status,'OVERPAYMENT_REVIEW_REQUIRED');assert.equal(overpaid.premiumDueCents,0)
 assert.equal(settle({...input,workweekClosed:false}).premiumDueCents,0)
 assert.equal(settle({...input,historyVerified:false}).premiumDueCents,0)
 const partial=settle({...input,payableOvertimeMinutes:240,priorPremiums:[]});assert.equal(partial.earnedPremiumThroughPeriodCents,4583)
 assert.throws(()=>settle({...input,priorPremiums:[...input.priorPremiums,...input.priorPremiums]}),/unique/)
})
test('allocated workweeks reject invalid fractions, impossible hours and unsafe payments',()=>{
 for(const allocation of [{minutes:0,earningsNumerator:'1',earningsDenominator:1},{minutes:10081,earningsNumerator:'1',earningsDenominator:1},{minutes:-1,earningsNumerator:'1',earningsDenominator:1},{minutes:1,earningsNumerator:'-1',earningsDenominator:1},{minutes:1,earningsNumerator:'1.5',earningsDenominator:1},{minutes:1,earningsNumerator:'1',earningsDenominator:0},{minutes:1,earningsNumerator:'1',earningsDenominator:1000001},{minutes:1,earningsNumerator:'9007199254740992',earningsDenominator:1}])assert.throws(()=>calculate([allocation]))
 assert.throws(()=>calculate(null));assert.throws(()=>calculate([null]))
})
