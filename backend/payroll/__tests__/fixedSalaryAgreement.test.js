import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {fixedSalaryWeeklyHours,fixedSalaryRateDecreased} from '../fixedSalaryAgreement.js'
const review={classification:'NONEXEMPT',standardWeeklyHours:30,fixedHoursVerified:true,minimumWageVerified:true,minimumWageCents:1500,confirmed:true,source:'Synthetic reviewed fixed salary hours agreement'}
test('fixed salary agreements reject ambiguous hours and recognize hourly-rate decreases',()=>{
 assert.equal(fixedSalaryWeeklyHours(review),30)
 for(const hours of [0,-1,40.25,30.1,'30'])assert.throws(()=>fixedSalaryWeeklyHours({...review,standardWeeklyHours:hours}),/fixed salary workweek/)
 assert.equal(fixedSalaryRateDecreased(7800000,review,8400000,{...review,standardWeeklyHours:40}),true)
 assert.equal(fixedSalaryRateDecreased(7800000,review,10400000,{...review,standardWeeklyHours:40}),false)
})
test('adding contracted salary hours requires advance notice when the regular rate falls',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200)=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});const j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j}
 const e=(await api('/employees',{employeeNumber:'SHORT-RATE',legalFirstName:'Short',legalLastName:'Rate',hireDate:'2026-01-01',payType:'SALARY',annualSalaryCents:7800000},201)).data
 await api(`/employees/${e.id}/salary-review`,review)
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE' WHERE id=$1",[e.id])
 await h.pool.query("UPDATE payroll_settings SET pay_frequency='BIWEEKLY',workweek_starts_on=1 WHERE facility_id=1")
 const today=(await h.pool.query("SELECT (now() AT TIME ZONE timezone)::date::text AS today FROM payroll_settings WHERE facility_id=1")).rows[0].today
 const date=new Date(`${today}T00:00:00Z`);date.setUTCDate(date.getUTCDate()+((8-date.getUTCDay())%7||7));const start=date.toISOString().slice(0,10);date.setUTCDate(date.getUTCDate()+13);const end=date.toISOString().slice(0,10)
 await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,$1,$2,$2::date+5,'BIWEEKLY')",[start,end])
 const body={...review,standardWeeklyHours:40,annualSalaryCents:7800000,effectiveOn:start,noticeDeliveredOn:today,noticeConfirmed:true,noticeReference:'Synthetic delivered written notice',reason:'Synthetic change to agreed salary hours'}
 const rejected=await api(`/employees/${e.id}/salary-changes`,body,400);assert.match(rejected.message,/14 days/)
 const accepted=(await api(`/employees/${e.id}/salary-changes`,{...body,annualSalaryCents:10400000},201)).data
 assert.equal(accepted.salary_review.standardWeeklyHours,40)
})
