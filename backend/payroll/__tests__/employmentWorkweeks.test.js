import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {employmentWorkweekBoundaries,employmentWorkweekReviewScopes} from '../employmentWorkweeks.js'
for(const [before,after] of [['HOURLY','SALARY'],['SALARY','HOURLY'],['SALARY','SALARY']])test(`${before}/${after} agreement boundary is visible from either adjacent payroll period`,{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body)=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});const j=await r.json();assert.ok(r.ok,JSON.stringify(j));return j.data}
 const e=await api('/employees',{employeeNumber:`WEEK-${before}-${after}`,legalFirstName:'Boundary',legalLastName:'Review',hireDate:'2026-08-03',payType:before,hourlyRateCents:2500,annualSalaryCents:5200000})
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date='2026-08-05' WHERE id=$1",[e.id])
 await h.pool.query("UPDATE payroll_employee SET employment_status='ONBOARDING',hire_date='2026-08-07',termination_date=NULL,pay_type=$2,annual_salary_cents=$3 WHERE id=$1",[e.id,after,after==='SALARY'?5200000:null])
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE' WHERE id=$1",[e.id])
 await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,'2026-08-03T12:00Z','2026-08-03T13:00Z','ADMIN','APPROVED'),(1,$1,'2026-08-07T12:00Z',NULL,'ADMIN','UNVERIFIED')",[e.id])
 const settings={workweekStartsOn:1,timezone:'America/New_York'}
 for(const [start,end] of [['2026-08-03','2026-08-05'],['2026-08-07','2026-08-09']]){
  const evidence=await employmentWorkweekBoundaries(h.pool,1,[e.id],{period_start:start,period_end:end},settings)
  assert.equal(evidence.length,1);assert.equal(evidence[0].week,'2026-08-03');assert.equal(evidence[0].beforePayType,before);assert.equal(evidence[0].afterPayType,after)
  const period=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,$1,$2,'2026-08-14','SEMIMONTHLY') RETURNING id",[start,end])).rows[0]
  const preview=(await api('/runs/preview',{payPeriodId:period.id})).preview
  assert.equal(preview.canApprove,false)
  assert.ok(preview.warnings.some(w=>w.code==='EMPLOYMENT_WORKWEEK_BOUNDARY'&&w.blocking&&w.employeeId===e.id))
  assert.deepEqual(preview.employees[0].employmentWorkweekBoundaries,evidence)
  const detail=preview.employees[0].employmentWeekReviews[0]
  assert.equal(detail.week,'2026-08-03');assert.equal(detail.approvedMinutes,60);assert.equal(detail.time.length,2)
  assert.equal(detail.time[0].clockIn,'2026-08-03T12:00:00.000Z');assert.equal(detail.time[1].minutes,null)
  assert.ok(detail.issues.some(i=>i.includes('not approved')));assert.ok(detail.issues.some(i=>i.includes('clock and break')))
  assert.equal(detail.status,'REGULAR_RATE_RECONCILIATION_REQUIRED')
 }
 if(before==='SALARY'&&after==='SALARY'){
  await h.pool.query("INSERT INTO payroll_salary_change(facility_id,employee_id,effective_on,annual_salary_cents,salary_review,reason) VALUES(1,$1,'2026-08-07',6240000,'{}','Synthetic changed salary hiring agreement')",[e.id])
  const wide=(await h.pool.query("UPDATE payroll_pay_period SET period_end='2026-08-09' WHERE facility_id=1 AND period_start='2026-08-03' RETURNING id")).rows[0]
  const preview=(await api('/runs/preview',{payPeriodId:wide.id})).preview
  assert.ok(preview.warnings.some(w=>w.code==='SALARY_CHANGE_PERIOD_BOUNDARY'&&w.blocking))
 }
 assert.deepEqual(await employmentWorkweekBoundaries(h.pool,2,[e.id],{period_start:'2026-08-03',period_end:'2026-08-09'},settings),[])
 assert.deepEqual(await employmentWorkweekBoundaries(h.pool,1,[e.id],{period_start:'2026-08-10',period_end:'2026-08-16'},settings),[])
 // A Sunday-start workweek places the same dates together but changes its identity.
 assert.equal((await employmentWorkweekBoundaries(h.pool,1,[e.id],{period_start:'2026-08-07',period_end:'2026-08-09'},{...settings,workweekStartsOn:0}))[0].week,'2026-08-02')
})

test('workweek review scopes include every period week only for affected employees',()=>{
 const settings={workweekStartsOn:1,timezone:'America/New_York'},period={period_start:'2026-08-03',period_end:'2026-08-16'}
 assert.deepEqual(employmentWorkweekReviewScopes([{employeeId:2,week:'2026-08-03'},{employeeId:2,week:'2026-08-03'},{employeeId:4,week:'2026-08-10'}],period,settings),[{employeeId:2,week:'2026-08-03'},{employeeId:2,week:'2026-08-10'},{employeeId:4,week:'2026-08-03'},{employeeId:4,week:'2026-08-10'}])
 assert.deepEqual(employmentWorkweekReviewScopes([],period,settings),[])
 assert.deepEqual(employmentWorkweekReviewScopes([{employeeId:2,week:'2026-08-02'}],{period_start:'2026-08-05',period_end:'2026-08-09'},{...settings,workweekStartsOn:0}),[{employeeId:2,week:'2026-08-02'},{employeeId:2,week:'2026-08-09'}])
})
