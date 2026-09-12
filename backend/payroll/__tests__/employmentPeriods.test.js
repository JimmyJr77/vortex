import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {assertEmploymentRange} from '../employmentPeriods.js'
import {recordPayrollClock} from '../clockActions.js'
test('employment history preserves separated periods and rejects work in gaps or outside local-day boundaries',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200,method='POST',facility=1)=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method,headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':String(facility)},body:body===undefined?undefined:JSON.stringify(body)});const j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j.data}
 const e=await api('/employees',{employeeNumber:'EMPLOYMENT-HISTORY',legalFirstName:'Returning',legalLastName:'Worker',hireDate:'2026-08-03',hourlyRateCents:2500},201)
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date='2026-08-08' WHERE id=$1",[e.id])
 // Exercise the employment-period model directly. A user-facing rehire must
 // additionally reset onboarding, document reviews and compensation safely.
 await h.pool.query("UPDATE payroll_employee SET hire_date='2026-09-07',termination_date=NULL,employment_status='ONBOARDING' WHERE id=$1",[e.id])
 const periods=await api(`/employees/${e.id}/employment-periods`,undefined,200,'GET')
 assert.equal(periods.length,2);assert.equal(periods[0].started_on.slice(0,10),'2026-08-03');assert.equal(periods[0].ended_on.slice(0,10),'2026-08-08')
 assert.equal(periods[1].started_on.slice(0,10),'2026-09-07');assert.equal(periods[1].ended_on,null)
 await api(`/employees/${e.id}/employment-periods`,undefined,404,'GET',2)
 const time=(clockIn,clockOut)=>({employeeId:e.id,clockIn,clockOut,evidenceNote:'Synthetic employee time evidence'})
 await api('/time-entries',time('2026-08-02T12:00:00Z','2026-08-02T13:00:00Z'),409)
 await api('/time-entries',time('2026-08-10T12:00:00Z','2026-08-10T13:00:00Z'),409)
 await api('/time-entries',time('2026-08-08T23:00:00Z','2026-08-09T04:00:00Z'),201)
 await api('/time-entries',time('2026-08-08T12:00:00Z','2026-08-09T04:00:00.001Z'),409)
 await api('/time-entries',time('2026-09-07T12:00:00Z','2026-09-07T13:00:00Z'),201)
 await assert.rejects(()=>assertEmploymentRange(h.pool,1,e.id,'2026-08-08T12:00:00Z','2026-09-08T12:00:00Z'),/employment period/)
 await api('/shifts',{employeeId:e.id,scheduledStart:'2026-08-03T12:00:00Z',scheduledEnd:'2026-08-03T13:00:00Z',repeatWeeks:2},409)
 assert.equal((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_shift WHERE employee_id=$1',[e.id])).rows[0].n,0)
 await assert.rejects(()=>h.pool.query("INSERT INTO payroll_employment_period(facility_id,employee_id,started_on,ended_on) VALUES(1,$1,'2026-08-07','2026-08-10')",[e.id]),/overlap/)
 await assert.rejects(()=>h.pool.query("UPDATE payroll_employment_period SET started_on='2026-08-02' WHERE id=$1",[periods[0].id]),/cannot be rewritten/)
 await assert.rejects(()=>h.pool.query('DELETE FROM payroll_employment_period WHERE id=$1',[periods[0].id]),/retained/)
 const future=await api('/employees',{employeeNumber:'FUTURE-HIRE-CLOCK',legalFirstName:'Future',legalLastName:'Hire',hireDate:'2100-01-01',hourlyRateCents:2500},201)
 await assert.rejects(()=>recordPayrollClock(h.pool,{facilityId:1,employeeId:future.id,action:'IN',isAdmin:true}),/employment period/)
 assert.equal((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_time_entry WHERE employee_id=$1',[future.id])).rows[0].n,0)
})
