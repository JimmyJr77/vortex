import test from 'node:test'
import assert from 'node:assert/strict'
import {leaveYearOpening} from '../leaveYearClose.js'
import {createHarness} from '../testing/harness.js'
test('annual leave policy calculates carryover or replacement frontload without inventing accrual',()=>{
 assert.deepEqual(leaveYearOpening({balance:3000,policy:'ACCRUAL',carryCapMinutes:2400,frontloadMinutes:2400}),{carryMinutes:2400,rolloverDelta:-600,grantMinutes:0,openingBalance:2400})
 assert.deepEqual(leaveYearOpening({balance:600,policy:'FRONTLOAD',carryCapMinutes:2400,frontloadMinutes:2400}),{carryMinutes:0,rolloverDelta:-600,grantMinutes:2400,openingBalance:2400})
 assert.throws(()=>leaveYearOpening({balance:-1,policy:'ACCRUAL',carryCapMinutes:2400,frontloadMinutes:2400}),/negative/)
})
test('annual opening previews, applies once, scopes employees and prevents edits to closed leave history',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200)=>{const response=await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});const json=await response.json();assert.equal(response.status,status,JSON.stringify(json));return json.data}
 const a=await api('/employees',{employeeNumber:'CARRY',legalFirstName:'Carry',legalLastName:'Fixture',hireDate:'2025-01-01',hourlyRateCents:2500},201)
 const f=await api('/employees',{employeeNumber:'FRONT',legalFirstName:'Front',legalLastName:'Fixture',hireDate:'2025-01-01',hourlyRateCents:2500},201)
 await h.pool.query("UPDATE payroll_employee SET sick_leave_policy='FRONTLOAD' WHERE id=$1",[f.id])
 await h.pool.query("INSERT INTO payroll_leave_transaction(facility_id,employee_id,transaction_date,minutes,reason) VALUES(1,$1,'2025-12-01',3000,'Synthetic prior accrual'),(1,$2,'2025-12-01',600,'Synthetic unused grant')",[a.id,f.id])
 const body={year:2026,carryCapMinutes:2400,frontloadMinutes:2400,confirmed:true,source:'Verified published calendar-year leave policy'}
 const plan=await api('/leave-year/preview',body)
 assert.equal(plan.employees.find(e=>Number(e.id)===a.id).rolloverDelta,-600)
 assert.equal((await h.pool.query('SELECT COUNT(*)::int AS n FROM payroll_leave_year_close')).rows[0].n,0)
 await api('/leave-year/apply',{...body,previewToken:'stale'},409)
 const reservation=(await h.pool.query("INSERT INTO payroll_leave_transaction(facility_id,employee_id,transaction_date,minutes,reason) VALUES(1,$1,'2026-06-01',-2700,'Synthetic reserved leave') RETURNING id",[a.id])).rows[0]
 await api('/leave-year/apply',{...body,previewToken:plan.previewToken},409)
 await h.pool.query('DELETE FROM payroll_leave_transaction WHERE id=$1',[reservation.id])

 const usedPeriod=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-01-01','2026-01-15','2026-01-20','SEMIMONTHLY') RETURNING id")).rows[0]
 const usedRun=(await h.pool.query("INSERT INTO payroll_run(facility_id,pay_period_id,status) VALUES(1,$1,'APPROVED') RETURNING id",[usedPeriod.id])).rows[0]
 await api('/leave-year/apply',{...body,previewToken:plan.previewToken},409)
 await h.pool.query('DELETE FROM payroll_run WHERE id=$1',[usedRun.id])
 await h.pool.query("CREATE FUNCTION fail_leave_year_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='LEAVE_YEAR_OPENED' THEN RAISE EXCEPTION 'Synthetic rollover audit failure'; END IF; RETURN NEW; END $$")
 await h.pool.query('CREATE TRIGGER fail_leave_year_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION fail_leave_year_audit()')
 await api('/leave-year/apply',{...body,previewToken:plan.previewToken},500)
 assert.equal((await h.pool.query('SELECT COUNT(*)::int AS n FROM payroll_leave_year_close')).rows[0].n,0)
 assert.equal((await h.pool.query("SELECT COUNT(*)::int AS n FROM payroll_leave_transaction WHERE transaction_kind IN ('ROLLOVER','FRONTLOAD')")).rows[0].n,0)
 await h.pool.query('DROP TRIGGER fail_leave_year_audit ON payroll_audit_log')
 await api('/leave-year/apply',{...body,previewToken:plan.previewToken})
 await api('/leave-year/apply',{...body,previewToken:plan.previewToken},409)
 const balances=(await h.pool.query('SELECT employee_id,SUM(minutes)::int AS n FROM payroll_leave_transaction WHERE facility_id=1 GROUP BY employee_id')).rows
 assert.ok(balances.every(b=>b.n===2400))
 assert.equal((await h.pool.query('SELECT COUNT(*)::int AS n FROM payroll_leave_year_close WHERE facility_id=2')).rows[0].n,0)
 await api(`/employees/${a.id}/leave-transactions`,{minutes:60,transactionDate:'2025-12-31',reason:'Late prior-year adjustment'},409)
 await api(`/employees/${a.id}/leave-transactions`,{minutes:60,transactionDate:'2026-09-01',transactionKind:'RESTORATION',reason:'Verified current-year correction'},201)
 await assert.rejects(h.pool.query("DELETE FROM payroll_leave_transaction WHERE employee_id=$1 AND transaction_kind='ROLLOVER'",[a.id]),e=>e.constraint==='payroll_leave_year_closed')
 assert.equal((await h.pool.query("SELECT COUNT(*)::int AS n FROM payroll_audit_log WHERE action='LEAVE_YEAR_OPENED'")).rows[0].n,1)
})
