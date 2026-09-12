import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {refreshFinalPayAlerts} from '../finalPay.js'
test('no-work hiring closeout preparation is scoped, read-only and rejects evidence of obligations',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const headers={Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'}
 const create=await fetch(`${h.url}/api/admin/payroll/employees`,{method:'POST',headers,body:JSON.stringify({employeeNumber:'NO-WORK-HIRE',legalFirstName:'Never',legalLastName:'Started',hireDate:'2026-08-03',hourlyRateCents:2500})})
 assert.equal(create.status,201);const e=(await create.json()).data
 const url=`${h.url}/api/admin/payroll/employees/${e.id}/no-work-closeout`
 assert.equal((await fetch(url)).status,401)
 assert.equal((await fetch(url,{headers:{...headers,'x-test-facility':'2'}})).status,404)
 const review=async()=>{const r=await fetch(url,{headers});assert.equal(r.status,200);return (await r.json()).data}
 assert.equal((await review()).eligible,false)
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date='2026-08-03' WHERE id=$1",[e.id])
 const baseline=await review();assert.equal(baseline.eligible,true);assert.equal(baseline.closeout,null)
 assert.deepEqual(baseline.issues,[])
 const request=(await h.pool.query("INSERT INTO payroll_employee_request(facility_id,employee_id,kind,payload) VALUES(1,$1,'GENERAL','{\"reason\":\"Possible unrecorded orientation hours\"}') RETURNING id",[e.id])).rows[0]
 const pending=await review();assert.equal(pending.eligible,false);assert.match(pending.issues.join(' '),/employee requests/);assert.notEqual(pending.fingerprint,baseline.fingerprint)
 await h.pool.query("UPDATE payroll_employee_request SET status='DECLINED' WHERE id=$1",[request.id])
 assert.equal((await review()).eligible,true)
 await h.pool.query("INSERT INTO payroll_leave_transaction(facility_id,employee_id,leave_type,transaction_date,minutes,reason) VALUES(1,$1,'PTO','2026-08-03',60,'Synthetic entitlement needing review')",[e.id])
 assert.equal((await review()).eligible,false)
 assert.equal((await h.pool.query("SELECT COUNT(*)::int n FROM payroll_audit_log WHERE action='NO_WORK_HIRE_CLOSED'")).rows[0].n,0)
 assert.equal((await h.pool.query('SELECT employment_status FROM payroll_employee WHERE id=$1',[e.id])).rows[0].employment_status,'TERMINATED')
})

test('audited no-work closeout enables rehire without fabricating payroll and is invalidated by later obligations',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200,facility=1)=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method:body?'POST':'GET',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':String(facility)},body:body?JSON.stringify(body):undefined});const j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j.data}
 const e=await api('/employees',{employeeNumber:'NO-WORK-CLOSE',legalFirstName:'Never',legalLastName:'Started',hireDate:'2026-08-03',hourlyRateCents:2500},201)
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date='2026-08-03' WHERE id=$1",[e.id])
 const path=`/employees/${e.id}/no-work-closeout`,review=await api(path)
 const body={fingerprint:review.fingerprint,reason:'Hire cancelled before any work',reference:'Synthetic employee and supervisor no-work verification',noWorkConfirmed:true,noObligationsConfirmed:true}
 await api(path,{...body,noWorkConfirmed:false},400)
 await api(path,{...body,fingerprint:'stale'},409)
 await api(path,body,404,2)
 await h.pool.query("CREATE FUNCTION fail_no_work_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='NO_WORK_HIRE_CLOSED' THEN RAISE EXCEPTION 'Synthetic no-work audit failure'; END IF; RETURN NEW; END $$")
 await h.pool.query('CREATE TRIGGER fail_no_work_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION fail_no_work_audit()')
 await api(path,body,500);assert.equal((await api(path)).closeout,null)
 await h.pool.query('DROP TRIGGER fail_no_work_audit ON payroll_audit_log')
 assert.ok((await api(path,body,201)).closeout)
 await api(path,body)
 await api(path,{...body,reason:'Different closeout reason recorded'},409)
 assert.equal((await api(`/employees/${e.id}/final-pay`)).status,'NO_WORK_CLOSED')
 await refreshFinalPayAlerts(h.pool,1)
 assert.equal((await h.pool.query("SELECT COUNT(*)::int n FROM payroll_alert WHERE dedupe_key=$1 AND status='OPEN'",[`final-pay-${e.id}`])).rows[0].n,0)
 const pending=(await h.pool.query("INSERT INTO payroll_employee_request(facility_id,employee_id,kind,payload) VALUES(1,$1,'GENERAL','{\"reason\":\"Review possible orientation pay\"}') RETURNING id",[e.id])).rows[0]
 assert.equal((await api(path)).closeout,null)
 assert.notEqual((await api(`/employees/${e.id}/final-pay`)).status,'NO_WORK_CLOSED')
 await refreshFinalPayAlerts(h.pool,1)
 assert.equal((await h.pool.query("SELECT COUNT(*)::int n FROM payroll_alert WHERE dedupe_key=$1 AND status='OPEN'",[`final-pay-${e.id}`])).rows[0].n,1)
 await api(path,body,409)
 await h.pool.query("UPDATE payroll_employee_request SET status='DECLINED' WHERE id=$1",[pending.id])
 const rehire=await api(`/employees/${e.id}/rehire-review?startDate=2099-09-07`)
 assert.deepEqual(rehire.issues,[])
 await api(`/employees/${e.id}/rehire`,{startDate:'2099-09-07',requestId:'no-work-hire-reopened',reviewFingerprint:rehire.fingerprint,reason:'Previously cancelled hire now starting',reviewReference:'Synthetic renewed hiring terms and no-work closeout',termsConfirmed:true,priorObligationsReviewed:true},201)
 assert.equal((await h.pool.query('SELECT employment_status FROM payroll_employee WHERE id=$1',[e.id])).rows[0].employment_status,'ONBOARDING')
 assert.equal((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_run_employee WHERE employee_id=$1',[e.id])).rows[0].n,0)
 assert.equal((await h.pool.query("SELECT COUNT(*)::int n FROM payroll_audit_log WHERE action='NO_WORK_HIRE_CLOSED' AND entity_id=$1",[String(e.id)])).rows[0].n,1)
})
