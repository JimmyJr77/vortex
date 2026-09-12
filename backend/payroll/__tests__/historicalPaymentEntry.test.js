import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
test('historical wage entry validates evidence, isolates employers and records concurrent retries once',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const request=async(path,body,facility=1)=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':String(facility)},body:JSON.stringify(body)});return {status:r.status,...await r.json()}}
 const employee=(await request('/employees',{employeeNumber:'HIST-ENTRY',legalFirstName:'History',legalLastName:'Entry',hireDate:'2026-01-01',hourlyRateCents:2500})).data
 const path=`/employees/${employee.id}/historical-payments`,body={requestId:'historical-payment-test-001',periodStart:'2026-08-03',periodEnd:'2026-08-05',paymentDate:'2026-08-14',method:'CHECK',reference:'SYNTHETIC-PAID-001',grossCents:60000,taxCents:12000,netCents:48000,evidence:'Synthetic prior payroll register and cleared payment record',confirmed:true,wageOnlyConfirmed:true}
 for(const extra of [{netCents:48001},{confirmed:false},{wageOnlyConfirmed:false},{periodEnd:'2026-02-30'},{evidence:'short'},{grossCents:-1}])assert.equal((await request(path,{...body,...extra})).status,400)
 assert.equal((await request(path,body,2)).status,404)
 assert.equal((await request(path,{...body,periodStart:'2099-08-03',periodEnd:'2099-08-05',paymentDate:'2099-08-14'})).status,409)
 await h.pool.query("CREATE FUNCTION reject_historical_entry() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='HISTORICAL_PAYMENT_RECORDED' THEN RAISE EXCEPTION 'Synthetic import audit failure'; END IF; RETURN NEW; END $$")
 await h.pool.query('CREATE TRIGGER reject_historical_entry BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_historical_entry()')
 assert.equal((await request(path,body)).status,500)
 assert.equal((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_historical_payment')).rows[0].n,0)
 await h.pool.query('DROP TRIGGER reject_historical_entry ON payroll_audit_log')
 const repeated=await Promise.all(Array.from({length:3},()=>request(path,body)))
 assert.deepEqual(repeated.map(r=>r.status).sort(),[200,200,201]);assert.equal(new Set(repeated.map(r=>Number(r.data.id))).size,1)
 assert.equal((await h.pool.query("SELECT COUNT(*)::int n FROM payroll_audit_log WHERE action='HISTORICAL_PAYMENT_RECORDED'")).rows[0].n,1)
 assert.equal((await request(path,{...body,evidence:'Different evidence using the same request reference'})).status,409)
 assert.equal((await request(path,{...body,requestId:'duplicate-other-reference',reference:'DIFFERENT-REFERENCE'})).status,409)
 const period=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-09-01','2026-09-15','2026-09-20','SEMIMONTHLY') RETURNING id")).rows[0]
 const run=(await h.pool.query("INSERT INTO payroll_run(facility_id,pay_period_id,status) VALUES(1,$1,'APPROVED') RETURNING id",[period.id])).rows[0]
 await h.pool.query('INSERT INTO payroll_run_employee(payroll_run_id,employee_id) VALUES($1,$2)',[run.id,employee.id])
 assert.equal((await request(path,{...body,requestId:'earlier-history-new-record',reference:'EARLIER-HISTORY',periodStart:'2026-07-01',periodEnd:'2026-07-15',paymentDate:'2026-07-20'})).status,409)
 assert.equal((await request(path,body)).status,200)
})
