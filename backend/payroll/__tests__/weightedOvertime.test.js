import test from 'node:test'
import assert from 'node:assert/strict'
import {calculateWeightedHourlyWeek as calculate,settleWeightedHourlyWeek as settle,allocateWorkweekPayments as allocate,applyWeightedWorkweekPremiums as apply} from '../weightedOvertime.js'
test('weighted hourly overtime uses all straight-time earnings and a half-rate premium above forty hours',()=>{
 const result=calculate([{minutes:1440,hourlyRateCents:2000},{minutes:1440,hourlyRateCents:2600}])
 // 24h*$20 + 24h*$26 = $1104; $23 regular rate; 8h*$11.50 = $92 premium.
 assert.equal(result.straightTimePayCents,110400)
 assert.equal(result.overtimePremiumCents,9200)
 assert.equal(result.totalPayCents,119600)
 assert.equal(Number(result.regularRateNumerator)/result.regularRateDenominator,2300)
 assert.equal(result.overtimeMinutes,480)
 assert.equal(calculate([{minutes:2700,hourlyRateCents:2500}]).totalPayCents,118750)
 assert.equal(calculate([{minutes:1200,hourlyRateCents:2000},{minutes:1200,hourlyRateCents:3000}]).overtimePremiumCents,0)
})
test('weighted overtime is independent of segment order and splitting and retains unrounded earnings',()=>{
 const whole=calculate([{minutes:2400,hourlyRateCents:1000},{minutes:1,hourlyRateCents:1001}])
 const split=calculate([{minutes:1,hourlyRateCents:1001},{minutes:1200,hourlyRateCents:1000},{minutes:1200,hourlyRateCents:1000}])
 assert.deepEqual(split,whole)
 assert.equal(whole.regularRateNumerator,'2401001')
 assert.equal(whole.straightTimePayCents,40017)
 assert.equal(whole.overtimePremiumCents,8)
 assert.equal(calculate([]).totalPayCents,0)
})
test('weighted overtime rejects malformed, impossible and unsafe workweek inputs',()=>{
 for(const segments of [null,[{}],[{minutes:-1,hourlyRateCents:1000}],[{minutes:1.5,hourlyRateCents:1000}],[{minutes:60,hourlyRateCents:0}],[{minutes:10081,hourlyRateCents:1000}],[{minutes:10080,hourlyRateCents:Number.MAX_SAFE_INTEGER}]])assert.throws(()=>calculate(segments))
})

import {buildEmployeePreview} from '../payrollEngine.js'
test('payroll preview retains prior-period earnings and detects rate changes hidden across a pay-period boundary',()=>{
 const input={employee:{id:1,payType:'HOURLY',hourlyRateCents:2600,w4Status:'COMPLETE',stateWithholdingStatus:'COMPLETE'},entries:[{id:1,clockIn:'2026-09-17T08:00:00Z',clockOut:'2026-09-18T08:00:00Z',hourlyRateCents:2600,status:'APPROVED'}],priorApprovedMinutesByWeek:{'2026-09-14':1440},priorApprovedSegmentsByWeek:{'2026-09-14':[{minutes:1440,hourlyRateCents:2000}]}}
 const preview=buildEmployeePreview(input)
 assert.ok(preview.warnings.some(w=>w.code==='MIXED_WORKWEEK_RATES'&&w.blocking))
 assert.equal(preview.workweekEarnings[0].straightTimePayCents,110400)
 assert.equal(preview.workweekEarnings[0].overtimePremiumCents,9200)
 assert.equal(preview.workweekEarnings[0].scope,'THROUGH_PAY_PERIOD_END')
 const missing=buildEmployeePreview({...input,priorApprovedSegmentsByWeek:{}})
 assert.ok(missing.warnings.some(w=>w.code==='WORKWEEK_EARNINGS_INCOMPLETE'&&w.blocking))
})

test('workweek settlement subtracts finalized premiums once and never invents a wage deduction',()=>{
 const input={segments:[{minutes:1440,hourlyRateCents:2000},{minutes:1440,hourlyRateCents:2600}],priorPremiums:[{runId:10,premiumCents:3000}],historyVerified:true,workweekClosed:true}
 const result=settle(input)
 assert.equal(result.status,'PREMIUM_DUE');assert.equal(result.premiumDueCents,6200)
 assert.equal(settle({...input,priorPremiums:[...input.priorPremiums,{runId:11,premiumCents:6200}]}).status,'SETTLED')
 const overpaid=settle({...input,priorPremiums:[{runId:10,premiumCents:9300}]})
 assert.equal(overpaid.status,'OVERPAYMENT_REVIEW_REQUIRED');assert.equal(overpaid.differenceCents,-100);assert.equal(overpaid.premiumDueCents,0)
 assert.throws(()=>settle({...input,priorPremiums:[...input.priorPremiums,...input.priorPremiums]}),/unique/)
})
test('unclosed workweeks and unverified premium history cannot become payable settlements',()=>{
 const input={segments:[{minutes:2700,hourlyRateCents:2500}],priorPremiums:[],historyVerified:true,workweekClosed:true}
 const open=settle({...input,workweekClosed:false});assert.equal(open.status,'WORKWEEK_OPEN');assert.equal(open.premiumDueCents,0);assert.equal(open.differenceCents,6250)
 const missing=settle({...input,historyVerified:false});assert.equal(missing.status,'HISTORY_REVIEW_REQUIRED');assert.equal(missing.premiumDueCents,0)
 for(const priorPremiums of [[{runId:0,premiumCents:1}],[{runId:1,premiumCents:-1}],[{runId:1,premiumCents:1.5}],null])assert.throws(()=>settle({...input,priorPremiums}))
})

test('actual payroll allocation preserves rate totals and assigns rounding cents deterministically',()=>{
 const segments=[{week:'2026-09-14',hourlyRateCents:1001,regularMinutes:1,overtimeMinutes:1},{week:'2026-09-21',hourlyRateCents:1001,regularMinutes:1,overtimeMinutes:1}]
 const rates=[{hourlyRateCents:1001,regularMinutes:2,overtimeMinutes:2,regularPayCents:33,overtimePayCents:50}]
 const result=allocate(segments,rates)
 assert.deepEqual(result,[{week:'2026-09-14',workedMinutes:2,straightTimePayCents:34,premiumCents:9},{week:'2026-09-21',workedMinutes:2,straightTimePayCents:32,premiumCents:8}])
 assert.equal(result.reduce((n,w)=>n+w.straightTimePayCents+w.premiumCents,0),83)
 assert.deepEqual(allocate([...segments].reverse(),rates),result)
 assert.throws(()=>allocate(segments,[{...rates[0],overtimeMinutes:3}]),/hours differ/)
 assert.throws(()=>allocate(segments,[...rates,...rates]),/duplicate/)
})

test('split-period premiums use the full-week rate without paying later-period overtime twice',()=>{
 const input={segments:[{minutes:1440,hourlyRateCents:2000},{minutes:1440,hourlyRateCents:2600}],priorPremiums:[],historyVerified:true,workweekClosed:true}
 const first=settle({...input,payableOvertimeMinutes:300})
 assert.equal(first.overtimePremiumCents,9200)
 assert.equal(first.earnedPremiumThroughPeriodCents,5750)
 assert.equal(first.premiumDueCents,5750)
 const second=settle({...input,payableOvertimeMinutes:480,priorPremiums:[{runId:1,premiumCents:first.premiumDueCents}]})
 assert.equal(second.premiumDueCents,3450)
 assert.equal(first.premiumDueCents+second.premiumDueCents,9200)
 assert.equal(settle({...input,payableOvertimeMinutes:0}).premiumDueCents,0)
 assert.throws(()=>settle({...input,payableOvertimeMinutes:481}),/complete workweek/)
})

import {reviewWorkweekSettlements as review} from '../workweekSettlementReview.js'
test('settlement review connects prior premiums, current hours and following workweek rates',()=>{
 const employee={hourlyRateCents:2000,workweekEarnings:[{week:'2026-09-14'}],workweekPaidHistory:[{week:'2026-09-14',premiums:[],issues:[],historyVerified:true}],entries:[{workweekStart:'2026-09-14',minutes:2700,hourlyRateCents:2000,status:'APPROVED'}],followingWorkweekEntries:[{week:'2026-09-14',minutes:180,hourlyRateCents:2800,status:'APPROVED',ambiguousBreak:false}]}
 const result=review(employee,{},'2026-09-21')[0]
 // 45h*$20 + 3h*$28 gives a $20.50 weighted rate; current 5 OT hours earn $51.25.
 assert.equal(result.premiumDueCents,5125);assert.equal(result.appliedToPayroll,false)
 assert.equal(review(employee,{},'2026-09-20')[0].status,'WORKWEEK_OPEN')
 assert.equal(review({...employee,workweekPaidHistory:[]},{},'2026-09-21')[0].status,'HISTORY_REVIEW_REQUIRED')
})

test('weighted premiums update rate lines and weekly payment records with identical totals',()=>{
 const week='2026-09-14'
 const segments=[{week,hourlyRateCents:2000,regularMinutes:1440,overtimeMinutes:0},{week,hourlyRateCents:2600,regularMinutes:960,overtimeMinutes:480}]
 const rates=[{hourlyRateCents:2000,regularMinutes:1440,overtimeMinutes:0,regularPayCents:48000,overtimePayCents:0},{hourlyRateCents:2600,regularMinutes:960,overtimeMinutes:480,regularPayCents:41600,overtimePayCents:31200}]
 const decision={week,...settle({segments:[{minutes:1440,hourlyRateCents:2000},{minutes:1440,hourlyRateCents:2600}],priorPremiums:[],historyVerified:true,workweekClosed:true})}
 const result=apply(segments,rates,[decision])
 assert.equal(result.regularPayCents,89600);assert.equal(result.overtimePayCents,30000)
 assert.equal(result.rateBreakdown[1].overtimePremiumCents,9200)
 assert.equal(result.workweekPayments[0].straightTimePayCents+result.workweekPayments[0].premiumCents,119600)
 assert.throws(()=>apply(segments,rates,[]),/match/)
 assert.throws(()=>apply(segments,rates,[{...decision,status:'WORKWEEK_OPEN'}]),/verified/)
 assert.throws(()=>apply(segments,rates,[decision,decision]),/duplicate/)
})
test('weighted premium shares preserve differing straight-time rates when both rates have overtime',()=>{
 const week='2026-09-14',segments=[{week,hourlyRateCents:2000,regularMinutes:0,overtimeMinutes:240},{week,hourlyRateCents:2600,regularMinutes:0,overtimeMinutes:240}]
 const rates=[{hourlyRateCents:2000,regularMinutes:0,overtimeMinutes:240,regularPayCents:0,overtimePayCents:12000},{hourlyRateCents:2600,regularMinutes:0,overtimeMinutes:240,regularPayCents:0,overtimePayCents:15600}]
 const decision={week,...settle({segments:[{minutes:2400,hourlyRateCents:2300},{minutes:240,hourlyRateCents:2000},{minutes:240,hourlyRateCents:2600}],priorPremiums:[],historyVerified:true,workweekClosed:true})}
 const result=apply(segments,rates,[decision])
 assert.deepEqual(result.rateBreakdown.map(r=>r.overtimePayCents),[12600,15000])
 assert.equal(result.overtimePayCents,27600)
 assert.equal(result.workweekPayments[0].premiumCents,9200)
})

import {statementLines} from '../payStatement.js'
test('verified weighted settlements feed payroll gross, taxes, frozen payment details and statement line amounts',()=>{
 const week='2026-09-14',decision={week,...settle({segments:[{minutes:1440,hourlyRateCents:2000},{minutes:1440,hourlyRateCents:2600}],priorPremiums:[],historyVerified:true,workweekClosed:true})}
 const input={employee:{id:1,payType:'HOURLY',hourlyRateCents:2600,w4Status:'COMPLETE',stateWithholdingStatus:'COMPLETE'},entries:[{id:1,clockIn:'2026-09-14T00:00:00Z',clockOut:'2026-09-15T00:00:00Z',hourlyRateCents:2000,status:'APPROVED'},{id:2,clockIn:'2026-09-15T00:00:00Z',clockOut:'2026-09-16T00:00:00Z',hourlyRateCents:2600,status:'APPROVED'}],weightedSettlements:[decision]}
 const result=buildEmployeePreview(input)
 assert.equal(result.weightedOvertimeApplied,true);assert.equal(result.grossPayCents,119600)
 assert.equal(result.socialSecurityTaxCents,7415)
 assert.equal(result.warnings.some(w=>w.code==='MIXED_WORKWEEK_RATES'),false)
 const statement=statementLines({regular_pay_cents:result.regularPayCents,overtime_pay_cents:result.overtimePayCents,other_taxable_pay_cents:0,statement_snapshot:{rateBreakdown:result.rateBreakdown}})
 assert.ok(statement.lines.some(l=>l[1]==='8.00 hours at $26.00/hour + $92.00 weighted overtime premium'&&l[2]===30000))
 assert.equal(statement.gross,119600)
 const rejected=buildEmployeePreview({...input,weightedSettlements:[{...decision,status:'WORKWEEK_OPEN'}]})
 assert.equal(rejected.weightedOvertimeApplied,false)
 assert.ok(rejected.warnings.some(w=>w.code==='WEIGHTED_SETTLEMENT_REQUIRED'&&w.blocking))
})
