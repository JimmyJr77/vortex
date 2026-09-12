import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {automateLeaveYearOpening} from '../leaveYearAutomation.js'
test('saved annual policy opens each year once, alerts on conflicts and recovers after correction',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body)=>{const response=await fetch(`${h.url}/api/admin/payroll${path}`,{method:body?'POST':'GET',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const json=await response.json();assert.ok(response.ok,JSON.stringify(json));return json.data}
 const employee=await api('/employees',{employeeNumber:'ANNUAL-AUTO',legalFirstName:'Automatic',legalLastName:'Annual',hireDate:'2026-01-01',hourlyRateCents:2500})
 await h.pool.query("UPDATE payroll_employee SET sick_leave_policy='FRONTLOAD' WHERE id=$1",[employee.id])
 await api('/leave-year/policy',{enabled:true,firstYear:2027,carryCapMinutes:2400,frontloadMinutes:2400,confirmed:true,source:'Verified recurring calendar-year leave policy'})
 assert.deepEqual(await automateLeaveYearOpening(h.pool,1,new Date('2026-12-31T12:00:00Z')),{opened:null})
 assert.deepEqual(await automateLeaveYearOpening(h.pool,1,new Date('2027-01-01T12:00:00Z')),{opened:2027})
 assert.deepEqual(await automateLeaveYearOpening(h.pool,1,new Date('2027-01-01T12:00:00Z')),{opened:null})
 const history=await api('/leave-year/history');assert.equal(history.history.length,1);assert.equal(history.history[0].employee_snapshot[0].grantMinutes,2400);assert.equal(history.policy.first_year,2027)
 assert.equal((await h.pool.query("SELECT SUM(minutes)::int AS n FROM payroll_leave_transaction WHERE employee_id=$1",[employee.id])).rows[0].n,2400)
 const period=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2027-12-01','2027-12-15','2027-12-20','SEMIMONTHLY') RETURNING id")).rows[0]
 const run=(await h.pool.query('INSERT INTO payroll_run(facility_id,pay_period_id) VALUES(1,$1) RETURNING id',[period.id])).rows[0]
 assert.equal((await automateLeaveYearOpening(h.pool,1,new Date('2028-01-01T12:00:00Z'))).reviewRequired,true)
 assert.equal((await h.pool.query("SELECT status FROM payroll_alert WHERE dedupe_key='leave-year-automation'")).rows[0].status,'OPEN')
 await api('/leave-year/policy',{enabled:false,firstYear:2027,carryCapMinutes:2400,frontloadMinutes:2400,confirmed:true,source:'Verified pause of recurring leave policy'})
 assert.equal((await h.pool.query("SELECT status FROM payroll_alert WHERE dedupe_key='leave-year-automation'")).rows[0].status,'DISMISSED')
 assert.deepEqual(await automateLeaveYearOpening(h.pool,1,new Date('2028-01-01T12:00:00Z')),{opened:null})
 await api('/leave-year/policy',{enabled:true,firstYear:2027,carryCapMinutes:2400,frontloadMinutes:2400,confirmed:true,source:'Verified recurring calendar-year leave policy'})
 await h.pool.query("UPDATE payroll_run SET status='VOID' WHERE id=$1",[run.id])
 assert.deepEqual(await automateLeaveYearOpening(h.pool,1,new Date('2028-01-01T12:00:00Z')),{opened:2028})
 assert.equal((await h.pool.query("SELECT status FROM payroll_alert WHERE dedupe_key='leave-year-automation'")).rows[0].status,'DISMISSED')
 assert.equal((await h.pool.query("SELECT SUM(minutes)::int AS n FROM payroll_leave_transaction WHERE employee_id=$1",[employee.id])).rows[0].n,2400)
 assert.equal((await h.pool.query('SELECT COUNT(*)::int AS n FROM payroll_leave_year_close WHERE facility_id=2')).rows[0].n,0)
})
