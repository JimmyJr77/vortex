import test from 'node:test'
import assert from 'node:assert/strict'
import {previewWorkweekAllocation} from '../workweekAllocation.js'
const fixture=()=>({review:{employeeId:1,week:'2026-08-03',end:'2026-08-09',issues:[],approvedMinutes:3000,agreements:[{employmentStart:'2026-08-03',start:'2026-08-03',end:'2026-08-05',payType:'HOURLY',hourlyRateCents:2500},{employmentStart:'2026-08-07',start:'2026-08-07',end:'2026-08-09',payType:'SALARY',annualSalaryCents:6240000,salaryReview:{classification:'NONEXEMPT',verifiedAt:'2026-08-07',fixed40Verified:true,minimumWageCents:1500}}],time:[{id:1,workDate:'2026-08-03',minutes:960,status:'APPROVED'},{id:2,workDate:'2026-08-04',minutes:480,status:'APPROVED'},{id:3,workDate:'2026-08-07',minutes:960,status:'APPROVED'},{id:4,workDate:'2026-08-08',minutes:600,status:'APPROVED'}],paidLeave:[{id:1,requestId:1,leaveDate:'2026-08-05',minutes:60,status:'APPROVED',includedInSalary:false},{id:2,requestId:2,leaveDate:'2026-08-09',minutes:60,status:'APPROVED',includedInSalary:true}]},inputs:[{employmentStart:'2026-08-07',earningsCents:120000,source:'Verified salary allocation including the approved leave payment'}]})
const run=f=>previewWorkweekAllocation(f.review,f.inputs)
test('salary leave is separated from total salary, hourly leave is additional, and overtime excludes both',()=>{
 const f=fixture(),before=structuredClone(f),result=run(f)
 assert.equal(result.leaveEarnings.salaryIncludedCents,3000);assert.equal(result.leaveEarnings.hourlyAdditionalCents,2500)
 assert.equal(result.calculation.workedMinutes,3000);assert.equal(result.calculation.overtimeMinutes,600)
 assert.equal(result.calculation.straightTimePayCents,177000);assert.equal(result.calculation.overtimePremiumCents,17700)
 assert.equal(result.coverage.entries.reduce((n,e)=>n+e.straightTimePayCents,0),177000)
 assert.equal(result.calculation.straightTimePayCents+result.leaveEarnings.totalCents,182500)
 assert.equal(result.inputs[1].totalSalaryCents,120000);assert.equal(result.inputs[1].earningsCents,117000)
 assert.deepEqual(f,before)
})
test('leave-only salary allocations produce leave pay without invented worked earnings or overtime',()=>{
 const f=fixture();f.review.agreements=f.review.agreements.slice(1);f.review.time=[];f.review.approvedMinutes=0;f.review.paidLeave=f.review.paidLeave.slice(1);f.inputs[0].earningsCents=3000
 const result=run(f)
 assert.equal(result.calculation.workedMinutes,0);assert.equal(result.calculation.straightTimePayCents,0);assert.equal(result.calculation.overtimePremiumCents,0)
 assert.equal(result.leaveEarnings.totalCents,3000);assert.equal(result.coverage.entries.length,0)
})
test('leave valuation preserves fractional salary rates and rejects duplicate, unverified or impossible evidence',()=>{
 const f=fixture();f.review.agreements[1].annualSalaryCents=6240100;f.review.paidLeave[1].minutes=1
 assert.equal(run(f).leaveEarnings.salaryIncludedCents,50)
 for(const mutate of [
  f=>f.review.paidLeave.push({...f.review.paidLeave[0]}),
  f=>f.review.paidLeave[0].leaveDate='2026-08-06',
  f=>f.review.paidLeave[1].status='PENDING',
  f=>f.review.agreements[1].salaryReview.fixed40Verified=false,
  f=>f.inputs[0].earningsCents=2000,
  f=>{f.review.paidLeave[0].leaveDate='2026-08-03';f.review.paidLeave[0].minutes=481},
 ]){const input=fixture();mutate(input);assert.throws(()=>run(input))}
})

test('salary leave follows the verified fixed weekly hours and dated hourly leave ignores an old approval rate',()=>{
 const f=fixture();f.review.agreements[1].salaryReview.standardWeeklyHours=37.5;f.review.agreements[1].salaryReview.fixedHoursVerified=true
 f.review.paidLeave[0].hourlyRateCents=1
 const result=run(f)
 assert.equal(result.leaveEarnings.salaryIncludedCents,3200)
 assert.equal(result.leaveEarnings.hourlyAdditionalCents,2500)
 assert.equal(result.leaveEarnings.entries[1].rateDenominator,1950)
})
