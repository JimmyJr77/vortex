import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {salaryRowsAt} from '../salaryChanges.js'
const review={classification:'EXEMPT',category:'ADMINISTRATIVE',salaryBasisVerified:true,dutiesVerified:true,stateRulesVerified:true,dutiesEvidence:'Verified independent discretion and judgment on significant office management matters.',source:'Synthetic salary duties and basis review',confirmed:true}
test('dated salary changes preserve opening pay and select the correct payroll-period review',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200,facility=1)=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method:body?'POST':'GET',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':String(facility)},body:body?JSON.stringify(body):undefined});const json=await r.json();assert.equal(r.status,status,JSON.stringify(json));return json.data}
 const e=await api('/employees',{employeeNumber:'DATED-SALARY',legalFirstName:'Dated',legalLastName:'Salary',hireDate:'2026-01-01',jobTitle:'Office manager',payType:'SALARY',annualSalaryCents:7800000},201)
 await api(`/employees/${e.id}/salary-review`,review)
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE' WHERE id=$1",[e.id])
 const old=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-08-01','2026-08-15','2026-08-20','SEMIMONTHLY') RETURNING id")).rows[0]
 const next=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2099-01-01','2099-01-15','2099-01-20','SEMIMONTHLY') RETURNING id")).rows[0]
 const body={...review,effectiveOn:'2099-01-01',annualSalaryCents:8400000,noticeDeliveredOn:'2026-01-01',noticeConfirmed:true,noticeReference:'Synthetic written salary increase notice',reason:'Synthetic annual salary adjustment'}
 await api(`/employees/${e.id}/salary-changes`,body,404,2)
 await api(`/employees/${e.id}/salary-changes`,{...body,effectiveOn:'2099-01-02'},409)
 await api(`/employees/${e.id}/salary-changes`,body,201)
 const history=await api(`/employees/${e.id}/salary-changes`);assert.equal(history.length,2);assert.equal(Number(history[1].annual_salary_cents),7800000)
 assert.equal((await api('/runs/preview',{payPeriodId:old.id})).preview.employees[0].regularPayCents,325000)
 assert.equal((await api('/runs/preview',{payPeriodId:next.id})).preview.employees[0].regularPayCents,350000)
 const raw=(await h.pool.query('SELECT * FROM payroll_employee WHERE id=$1',[e.id])).rows
 assert.equal(Number(raw[0].annual_salary_cents),7800000)
 assert.equal(Number((await salaryRowsAt(h.pool,1,raw,'2099-01-01'))[0].annual_salary_cents),8400000)
 await api(`/employees/${e.id}/salary-review`,review,409)
 await api(`/employees/${e.id}/salary-changes`,body,409)
 assert.equal((await h.pool.query("SELECT COUNT(*)::int AS n FROM payroll_audit_log WHERE action='SALARY_CHANGE_SCHEDULED'")).rows[0].n,1)
 // Calendar edits cannot silently blend two salary agreements in one pay period.
 await h.pool.query("UPDATE payroll_pay_period SET period_start='2098-12-31' WHERE id=$1",[next.id])
 const changed=(await api('/runs/preview',{payPeriodId:next.id})).preview
 assert.ok(changed.warnings.some(w=>w.code==='SALARY_CHANGE_PERIOD_BOUNDARY'&&w.blocking))
 await h.pool.query("UPDATE payroll_pay_period SET period_start='2099-01-01' WHERE id=$1",[next.id])
 const cancellation={noticeDeliveredOn:'2026-01-02',noticeConfirmed:true,noticeReference:'Synthetic salary cancellation notice',reason:'Synthetic cancelled compensation change'}
 const changeId=history[0].id
 assert.equal(history[0].canCancel,true);assert.equal(history[1].canCancel,false)
 await api(`/employees/${e.id}/salary-changes/${changeId}/cancel`,cancellation,404,2)
 await api(`/employees/${e.id}/salary-changes/${changeId}/cancel`,{...cancellation,noticeConfirmed:false},400)
 const locked=(await h.pool.query("INSERT INTO payroll_run(facility_id,pay_period_id,status) VALUES(1,$1,'APPROVED') RETURNING id",[next.id])).rows[0]
 await api(`/employees/${e.id}/salary-changes/${changeId}/cancel`,cancellation,409)
 await h.pool.query("UPDATE payroll_run SET status='VOID' WHERE id=$1",[locked.id])
 await h.pool.query(`CREATE FUNCTION reject_cancel_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='SALARY_CHANGE_CANCELLED' THEN RAISE EXCEPTION 'Synthetic audit failure'; END IF; RETURN NEW; END $$`)
 await h.pool.query('CREATE TRIGGER reject_cancel_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_cancel_audit()')
 await api(`/employees/${e.id}/salary-changes/${changeId}/cancel`,cancellation,500)
 assert.equal((await api(`/employees/${e.id}/salary-changes`))[0].cancelled_at,null)
 await h.pool.query('DROP TRIGGER reject_cancel_audit ON payroll_audit_log')
 const cancelled=await api(`/employees/${e.id}/salary-changes/${changeId}/cancel`,cancellation)
 assert.ok(cancelled.cancelled_at);assert.equal(cancelled.cancellation_notice_reference,cancellation.noticeReference)
 assert.equal((await api('/runs/preview',{payPeriodId:next.id})).preview.employees[0].regularPayCents,325000)
 await api(`/employees/${e.id}/salary-changes/${changeId}/cancel`,cancellation,404)
 await api(`/employees/${e.id}/salary-changes/${history[1].id}/cancel`,cancellation,409)
 await api(`/employees/${e.id}/salary-changes`,{...body,annualSalaryCents:8500000},201)
 assert.equal((await api(`/employees/${e.id}/salary-changes`)).length,3)

})
