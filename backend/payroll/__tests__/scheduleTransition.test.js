import {validateScheduleNotice} from '../payScheduleTransition.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {generatePayPeriods,persistPayPeriods,effectiveScheduleSettings} from '../payCalendar.js'
test('payday notice must be delivered by the preceding complete period and cannot use invalid or future dates',()=>{
 assert.doesNotThrow(()=>validateScheduleNotice('2026-09-01','2026-09-09','2026-09-01'))
 for(const notice of [undefined,'2026-02-30','2026-09-02','2026-09-10'])assert.throws(()=>validateScheduleNotice(notice,'2026-09-09','2026-09-01'),e=>e.status===400)
 assert.throws(()=>validateScheduleNotice('2026-09-10','2026-09-09','2026-10-01'),e=>e.status===400)
})
const enabled=!!process.env.PAYROLL_TEST_DATABASE_URL
test('dated transition preserves used history, previews without mutation, rejects stale previews and regenerates historical frequency',{skip:!enabled},async t=>{
 const {createHarness}=await import('../testing/harness.js'),h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200)=>{const response=await fetch(`${h.url}/api/admin/payroll/${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});const json=await response.json();assert.equal(response.status,status,JSON.stringify(json));return json.data}
 const config=(await h.pool.query('SELECT * FROM payroll_settings WHERE facility_id=1')).rows[0]
 await persistPayPeriods(h.pool,1,[...generatePayPeriods(2097,1,config),...generatePayPeriods(2097,2,config)])
 const old=(await h.pool.query("SELECT * FROM payroll_pay_period WHERE facility_id=1 AND period_start='2097-01-01'")).rows[0]
 await h.pool.query('INSERT INTO payroll_run(facility_id,pay_period_id) VALUES(1,$1)',[old.id])
 const body={frequency:'WEEKLY',effectiveOn:'2097-01-16',anchorStart:'2097-01-16',paymentLagDays:5,noticeDeliveredOn:'2026-09-01',confirmed:true,source:'Synthetic employee notice and published schedule'}
 const preview=await api('pay-schedule/transition-preview',body)
 assert.equal(preview.periods[0].periodStart,'2097-01-01');assert.equal(preview.periods[1].periodStart,'2097-01-16');assert.equal(preview.replacedPeriodCount,2)
 assert.equal((await h.pool.query('SELECT COUNT(*)::int AS n FROM payroll_schedule_version')).rows[0].n,0)
 await api('pay-schedule/transition',{...body,noticeDeliveredOn:'2097-01-02',previewToken:preview.previewToken},400)
 await api('pay-schedule/transition',{...body,previewToken:'stale'},409)
 await api('pay-schedule/transition',{...body,previewToken:preview.previewToken,confirmed:false},400)
 await api('pay-schedule/transition',{...body,previewToken:preview.previewToken})
 assert.equal((await h.pool.query('SELECT COUNT(*)::int AS n FROM payroll_schedule_version WHERE facility_id=1')).rows[0].n,2)
 assert.equal((await h.pool.query("SELECT notice_delivered_on::text AS date FROM payroll_schedule_version WHERE effective_on='2097-01-16'")).rows[0].date,body.noticeDeliveredOn)
 assert.equal((await h.pool.query('SELECT COUNT(*)::int AS n FROM payroll_schedule_version WHERE facility_id=2')).rows[0].n,0)
 assert.deepEqual((await h.pool.query('SELECT * FROM payroll_pay_period WHERE id=$1',[old.id])).rows[0],old)
 assert.ok((await h.pool.query("SELECT frequency FROM payroll_pay_period WHERE facility_id=1 AND period_start>='2097-01-16'")).rows.every(p=>p.frequency==='WEEKLY'))
 assert.equal((await effectiveScheduleSettings(h.pool,1,config,'2097-01-15')).pay_frequency,'SEMIMONTHLY')
 assert.equal((await effectiveScheduleSettings(h.pool,1,config,'2097-01-16')).pay_frequency,'WEEKLY')
 const history=await api('pay-periods/generate',{year:2096,month:12},201)
 assert.ok(history.every(p=>p.frequency==='SEMIMONTHLY'))
 const future=await api('pay-periods/generate',{year:2097,month:6},201)
 assert.ok(future.every(p=>p.frequency==='WEEKLY'))
 await api('pay-schedule/transition-preview',{...body,effectiveOn:'2097-02-01'},409)
 assert.equal((await h.pool.query("SELECT COUNT(*)::int AS n FROM payroll_audit_log WHERE action='PAY_SCHEDULE_TRANSITION_SCHEDULED'")).rows[0].n,1)
 const target=(await h.pool.query("SELECT id FROM payroll_schedule_version WHERE facility_id=1 AND effective_on='2097-01-16'")).rows[0]
 const cancellation=await api(`pay-schedule/${target.id}/cancel-preview`,{})
 const futurePeriod=(await h.pool.query("SELECT id FROM payroll_pay_period WHERE facility_id=1 AND period_start='2097-01-16'")).rows[0]
 const blockingRun=(await h.pool.query('INSERT INTO payroll_run(facility_id,pay_period_id) VALUES(1,$1) RETURNING id',[futurePeriod.id])).rows[0]
 await api(`pay-schedule/${target.id}/cancel-preview`,{},409)
 await h.pool.query('DELETE FROM payroll_run WHERE id=$1',[blockingRun.id])
 await h.pool.query("CREATE FUNCTION fail_schedule_cancel_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='PAY_SCHEDULE_TRANSITION_CANCELLED' THEN RAISE EXCEPTION 'Synthetic cancellation audit failure'; END IF; RETURN NEW; END $$")
 await h.pool.query('CREATE TRIGGER fail_schedule_cancel_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION fail_schedule_cancel_audit()')
 await api(`pay-schedule/${target.id}/cancel`,{source:body.source,noticeDeliveredOn:body.noticeDeliveredOn,confirmed:true,previewToken:cancellation.previewToken},500)
 assert.equal((await h.pool.query('SELECT cancelled_at FROM payroll_schedule_version WHERE id=$1',[target.id])).rows[0].cancelled_at,null)
 assert.equal((await h.pool.query('SELECT frequency FROM payroll_pay_period WHERE id=$1',[futurePeriod.id])).rows[0].frequency,'WEEKLY')
 await h.pool.query('DROP TRIGGER fail_schedule_cancel_audit ON payroll_audit_log')

 assert.ok(cancellation.periods.every(p=>p.frequency==='SEMIMONTHLY'))
 assert.equal((await h.pool.query('SELECT cancelled_at FROM payroll_schedule_version WHERE id=$1',[target.id])).rows[0].cancelled_at,null)
 await api(`pay-schedule/${target.id}/cancel`,{source:body.source,noticeDeliveredOn:body.noticeDeliveredOn,confirmed:true,previewToken:'stale'},409)
 await api(`pay-schedule/${target.id}/cancel`,{source:body.source,noticeDeliveredOn:body.noticeDeliveredOn,confirmed:false,previewToken:cancellation.previewToken},400)
 await api(`pay-schedule/${target.id}/cancel`,{source:body.source,noticeDeliveredOn:body.noticeDeliveredOn,confirmed:true,previewToken:cancellation.previewToken})
 assert.ok((await h.pool.query('SELECT cancelled_at FROM payroll_schedule_version WHERE id=$1',[target.id])).rows[0].cancelled_at)
 assert.equal((await effectiveScheduleSettings(h.pool,1,config,'2097-06-01')).pay_frequency,'SEMIMONTHLY')
 assert.ok((await h.pool.query("SELECT frequency FROM payroll_pay_period WHERE facility_id=1 AND period_start>='2097-01-16'")).rows.every(p=>p.frequency==='SEMIMONTHLY'))
 assert.deepEqual((await h.pool.query('SELECT * FROM payroll_pay_period WHERE id=$1',[old.id])).rows[0],old)
 await api(`pay-schedule/${target.id}/cancel-preview`,{},404)
 const replacement=await api('pay-schedule/transition-preview',body)
 await api('pay-schedule/transition',{...body,previewToken:replacement.previewToken})
 assert.equal((await h.pool.query("SELECT COUNT(*)::int AS n FROM payroll_schedule_version WHERE effective_on='2097-01-16'")).rows[0].n,2)
 assert.equal((await h.pool.query("SELECT COUNT(*)::int AS n FROM payroll_audit_log WHERE action='PAY_SCHEDULE_TRANSITION_CANCELLED'")).rows[0].n,1)

})
test('transition rejects split boundaries and future periods with runs or locked status without deleting periods',{skip:!enabled},async t=>{
 const {createHarness}=await import('../testing/harness.js'),h=await createHarness();t.after(()=>h.close())
 const api=async body=>{const response=await fetch(`${h.url}/api/admin/payroll/pay-schedule/transition-preview`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});return {status:response.status,...await response.json()}}
 const body={frequency:'WEEKLY',effectiveOn:'2097-01-16',anchorStart:'2097-01-16',paymentLagDays:5}
 assert.equal((await api({...body,effectiveOn:'2097-01-10',anchorStart:'2097-01-10'})).status,409)
 assert.equal((await api({...body,anchorStart:'2097-01-17'})).status,409)
 const period=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency,status) VALUES(1,'2097-01-16','2097-01-31','2097-02-05','SEMIMONTHLY','LOCKED') RETURNING id")).rows[0]
 assert.equal((await api(body)).status,409)
 await h.pool.query("UPDATE payroll_pay_period SET status='OPEN' WHERE id=$1",[period.id])
 const employeeResponse=await fetch(`${h.url}/api/admin/payroll/employees`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({employeeNumber:'TRANSITION-EXPENSE',legalFirstName:'Schedule',legalLastName:'Fixture',hireDate:'2026-01-01',hourlyRateCents:2500})})
 assert.equal(employeeResponse.status,201)
 const employee=(await employeeResponse.json()).data
 const request=(await h.pool.query("INSERT INTO payroll_employee_request(facility_id,employee_id,kind,payload) VALUES(1,$1,'EXPENSE',$2) RETURNING id",[employee.id,{reimbursementPeriod:{id:period.id}}])).rows[0]
 assert.equal((await api(body)).status,409)
 await h.pool.query('DELETE FROM payroll_employee_request WHERE id=$1',[request.id])
 await h.pool.query('INSERT INTO payroll_run(facility_id,pay_period_id) VALUES(1,$1)',[period.id])
 assert.equal((await api(body)).status,409)
 assert.equal((await h.pool.query('SELECT COUNT(*)::int AS n FROM payroll_pay_period')).rows[0].n,1)
 assert.equal((await h.pool.query('SELECT COUNT(*)::int AS n FROM payroll_schedule_version')).rows[0].n,0)
})
