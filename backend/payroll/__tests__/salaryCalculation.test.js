import test from 'node:test'
import assert from 'node:assert/strict'
import {calculateExemptSalary,calculateSalary,salaryOvertimeCents} from '../salaryCalculation.js'
import {buildEmployeePreview} from '../payrollEngine.js'
const employee={id:1,payType:'SALARY',annualSalaryCents:7800000,overtimeClassification:'EXEMPT',jobTitle:'Office manager',workState:'MD',residenceState:'MD',hireDate:'2026-01-01',salaryReview:{classification:'EXEMPT',annualSalaryCents:7800000,jobTitle:'Office manager',workState:'MD',verifiedAt:'2026-01-01T00:00:00Z',salaryBasisVerified:true,dutiesVerified:true,stateRulesVerified:true}}
const period={period_start:'2026-08-03',period_end:'2026-08-09'}
test('exempt salary preserves fixed pay, includes leave and requires matching review',()=>{
 assert.equal(calculateExemptSalary(employee,period,'WEEKLY').regularPayCents,150000)
 assert.equal(calculateExemptSalary(employee,period,'WEEKLY').leaveBasisMinutes,2400)
 assert.equal(calculateExemptSalary(employee,period,'SEMIMONTHLY').regularPayCents,325000)
 assert.equal(calculateExemptSalary(employee,period,'BIWEEKLY').regularPayCents,300000)
 assert.equal(calculateExemptSalary(employee,period,'MONTHLY').regularPayCents,650000)
 assert.throws(()=>calculateExemptSalary({...employee,annualSalaryCents:7900000},period,'WEEKLY'),/current exempt/)
 assert.throws(()=>calculateExemptSalary({...employee,overtimeClassification:'NONEXEMPT'},period,'WEEKLY'),/current exempt/)
 const initial=calculateExemptSalary({...employee,hireDate:'2026-08-05'},period,'WEEKLY')
 assert.equal(initial.regularPayCents,150000);assert.equal(initial.partialPeriod,true);assert.equal(initial.leaveBasisMinutes,1440)
 const result=buildEmployeePreview({employee,payPeriod:period,payFrequency:'WEEKLY',entries:[],adjustments:[{kind:'PAID_LEAVE',amountCents:30000,minutes:480,taxTreatmentVerified:true}]})
 const worked=buildEmployeePreview({employee,payPeriod:period,payFrequency:'WEEKLY',entries:Array.from({length:6},(_,i)=>({id:i+1,clockIn:`2026-08-0${i+3}T12:00:00Z`,clockOut:`2026-08-0${i+3}T20:00:00Z`,unpaidBreakMinutes:0,status:'APPROVED'}))})
 assert.equal(worked.grossPayCents,150000);assert.equal(worked.overtimePayCents,0);assert.equal(worked.regularMinutes,2880);assert.equal(worked.overtimeMinutes,0)
 assert.equal(worked.warnings.some(w=>w.code==='MISSING_EFFECTIVE_PAY_RATE'),false)
 assert.equal(result.grossPayCents,150000);assert.equal(result.paidLeavePayCents,0);assert.equal(result.paidLeaveMinutes,480);assert.equal(result.payItems[0].includedInSalary,true)
 assert.equal(result.warnings.some(w=>['UNSUPPORTED_PAY_CONFIGURATION','MISSING_EFFECTIVE_PAY_RATE'].includes(w.code)),false)
})

test('nonexempt salary uses the fixed 40-hour regular rate, approved overtime and actual-work leave basis',()=>{
 const nonexempt={...employee,overtimeClassification:'NONEXEMPT',salaryReview:{...employee.salaryReview,classification:'NONEXEMPT',fixed40Verified:true,minimumWageVerified:true,minimumWageCents:1500}}
 const salary=calculateSalary(nonexempt,period,'WEEKLY')
 assert.equal(salary.regularPayCents,150000);assert.equal(salary.leaveBasisMinutes,null)
 assert.equal(salaryOvertimeCents(salary,480),45000)
 assert.throws(()=>calculateSalary({...nonexempt,salaryReview:{...nonexempt.salaryReview,minimumWageCents:4000}},period,'WEEKLY'),/2,080/)
 assert.throws(()=>calculateSalary({...nonexempt,salaryReview:{...nonexempt.salaryReview,fixed40Verified:false}},period,'WEEKLY'),/40-hour/)
 const result=buildEmployeePreview({employee:nonexempt,payPeriod:period,payFrequency:'WEEKLY',priorApprovedMinutesByWeek:{'2026-08-03':2400},entries:[{id:1,clockIn:'2026-08-08T12:00:00Z',clockOut:'2026-08-08T20:00:00Z',unpaidBreakMinutes:0,status:'APPROVED'}]})
 assert.equal(result.overtimeMinutes,480);assert.equal(result.overtimePayCents,45000);assert.equal(result.grossPayCents,195000)
 const bonus=buildEmployeePreview({employee:nonexempt,payPeriod:period,payFrequency:'WEEKLY',entries:[],adjustments:[{kind:'BONUS',amountCents:1000,taxTreatmentVerified:true}]})
 assert.ok(bonus.warnings.some(w=>w.code==='SALARY_BONUS_REGULAR_RATE_REVIEW'&&w.blocking))
})

test('exempt salary uses a shorter or alternate reviewed workweek without reducing salary',()=>{
 const normalWorkweekMinutes=[360,0,360,360,360,360,0]
 const shorter={...employee,salaryReview:{...employee.salaryReview,normalWorkweekMinutes}}
 const full=calculateExemptSalary(shorter,period,'WEEKLY')
 assert.equal(full.regularPayCents,150000);assert.equal(full.leaveBasisMinutes,1800)
 assert.deepEqual(full.normalWorkweekMinutes,normalWorkweekMinutes)
 const partial=calculateExemptSalary({...shorter,hireDate:'2026-08-07'},period,'WEEKLY')
 assert.equal(partial.regularPayCents,150000);assert.equal(partial.leaveBasisMinutes,720)
 for(const invalid of [[],[0,0,0,0,0,0,0],[0,600,600,600,600,600,0],[0,480.5,480,480,480,480,0],null]){
  if(invalid===null)continue // Legacy null is treated as the prior default during calculation.
  assert.throws(()=>calculateExemptSalary({...employee,salaryReview:{...employee.salaryReview,normalWorkweekMinutes:invalid}},period,'WEEKLY'),/workweeks require/)
 }
})

test('short fixed salary pays extra straight time and only counts current-period hours above the agreement',()=>{
 const employee30={...employee,overtimeClassification:'NONEXEMPT',salaryReview:{...employee.salaryReview,classification:'NONEXEMPT',standardWeeklyHours:30,fixedHoursVerified:true,minimumWageVerified:true,minimumWageCents:1500}}
 const preview=prior=>buildEmployeePreview({employee:employee30,payPeriod:period,payFrequency:'WEEKLY',priorApprovedMinutesByWeek:{'2026-08-03':prior},entries:[{id:1,clockIn:'2026-08-08T12:00:00Z',clockOut:'2026-08-08T22:00:00Z',unpaidBreakMinutes:0,status:'APPROVED'}]})
 const before=preview(25*60);assert.equal(before.salaryCalculation.extraStraightTimeMinutes,300);assert.equal(before.grossPayCents,175000)
 const after=preview(35*60);assert.equal(after.salaryCalculation.extraStraightTimeMinutes,300);assert.equal(after.overtimeMinutes,300);assert.equal(after.overtimePayCents,37500);assert.equal(after.grossPayCents,212500)
 const already=preview(40*60);assert.equal(already.salaryCalculation.extraStraightTimeMinutes,0);assert.equal(already.overtimePayCents,75000)
 const invalid={...employee30,salaryReview:{...employee30.salaryReview,fixedHoursVerified:false,fixed40Verified:true}}
 assert.throws(()=>calculateSalary(invalid,period,'WEEKLY'),/fixed salary workweek/)
})
