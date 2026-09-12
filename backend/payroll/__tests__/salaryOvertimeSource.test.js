import test from 'node:test'
import assert from 'node:assert/strict'
import {salaryPaidPremium} from '../salaryOvertimeSource.js'
const fixture=()=>({payType:'SALARY',regularPayCents:85200,overtimePayCents:53,overtimeMinutes:1,salaryCalculation:{version:1,reviewedAt:'2026-09-01T00:00:00Z',paymentPolicy:'FULL_PERIOD_SALARY_NO_ABSENCE_DEDUCTIONS',annualSalaryCents:4430400,periodsPerYear:52,regularPayCents:85200,classification:'NONEXEMPT',standardWeeklyHours:40,regularRateNumerator:4430400,regularRateDenominator:2080}})
test('salary premium uses retained rate rounding rather than dividing overtime payment',()=>{
 const source=fixture();assert.equal(salaryPaidPremium(source),17);assert.notEqual(salaryPaidPremium(source),Math.round(source.overtimePayCents/3))
 for(const mutate of [s=>s.overtimePayCents++,s=>s.overtimeMinutes=null,s=>s.salaryCalculation.standardWeeklyHours=41,s=>s.salaryCalculation.regularRateDenominator=1560,s=>s.salaryCalculation.reviewedAt=null,s=>s.regularPayCents++,s=>s.salaryCalculation.annualSalaryCents=Number.MAX_SAFE_INTEGER+1]){const bad=fixture();mutate(bad);assert.throws(()=>salaryPaidPremium(bad),/do not reconcile/)}
 const exempt=fixture();exempt.salaryCalculation.classification='EXEMPT';exempt.overtimeMinutes=0;exempt.overtimePayCents=0;assert.equal(salaryPaidPremium(exempt),0);exempt.overtimePayCents=1;assert.throws(()=>salaryPaidPremium(exempt),/do not reconcile/)
})
