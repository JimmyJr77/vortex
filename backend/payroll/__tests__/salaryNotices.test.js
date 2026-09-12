import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
test('salary notice receipts are private, scoped, idempotent and separate for cancellations',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close());let token
 const api=async(path,body,{employee=false,status=200}={})=>{const r=await fetch(`${h.url}/api/${employee?'payroll/employee':'admin/payroll'}${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${employee?token:'payroll-test-admin'}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const json=await r.json();assert.equal(r.status,status,JSON.stringify(json));return json.data}
 const e=await api('/employees',{employeeNumber:'SALARY-NOTICE',legalFirstName:'Notice',legalLastName:'Reader',jobTitle:'Office manager',hireDate:'2026-01-01',payType:'SALARY',annualSalaryCents:7800000,personalEmail:'salary-notice@example.test'},{status:201})
 const other=await api('/employees',{employeeNumber:'OTHER-NOTICE',legalFirstName:'Other',legalLastName:'Reader',hireDate:'2026-01-01',hourlyRateCents:2500},{status:201})
 const record=async id=>(await h.pool.query("INSERT INTO payroll_salary_change(facility_id,employee_id,effective_on,annual_salary_cents,salary_review,reason,notice_delivered_on,notice_reference) VALUES(1,$1,'2099-01-01',8400000,$2,'PRIVATE REASON','2026-01-01','PRIVATE DELIVERY') RETURNING id",[id,{jobTitle:'Office manager',classification:'EXEMPT',source:'PRIVATE REVIEW'}])).rows[0]
 const own=await record(e.id),foreign=await record(other.id)
 const invite=await api(`/employees/${e.id}/invitations`,{email:'salary-notice@example.test',sendEmail:false},{status:201})
 token=(await api('/invitations/redeem',{token:new URL(invite.inviteUrl).searchParams.get('invite')},{employee:true})).sessionToken
 const notices=await api('/salary-changes',undefined,{employee:true});assert.equal(notices.length,1);assert.equal(notices[0].annualSalaryCents,8400000);assert.doesNotMatch(JSON.stringify(notices),/PRIVATE/)
 await api(`/salary-changes/${foreign.id}/acknowledge`,{acknowledged:true},{employee:true,status:404})
 await api(`/salary-changes/${own.id}/acknowledge`,{acknowledged:false},{employee:true,status:400})
 const receipt=await api(`/salary-changes/${own.id}/acknowledge`,{acknowledged:true},{employee:true})
 assert.equal((await api(`/salary-changes/${own.id}/acknowledge`,{acknowledged:true},{employee:true})).acknowledgedAt,receipt.acknowledgedAt)
 assert.equal((await h.pool.query("SELECT COUNT(*)::int AS n FROM payroll_audit_log WHERE action='SALARY_NOTICE_ACKNOWLEDGED'")).rows[0].n,1)
 await h.pool.query("UPDATE payroll_salary_change SET cancelled_at=now(),cancellation_notice_delivered_on='2026-01-02',cancellation_notice_reference='PRIVATE CANCELLATION' WHERE id=$1",[own.id])
 await api(`/salary-changes/${own.id}/acknowledge`,{acknowledged:true},{employee:true,status:404})
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED' WHERE id=$1",[e.id])
 await h.pool.query(`CREATE FUNCTION reject_receipt_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='SALARY_NOTICE_ACKNOWLEDGED' THEN RAISE EXCEPTION 'Synthetic audit failure'; END IF; RETURN NEW; END $$`)
 await h.pool.query('CREATE TRIGGER reject_receipt_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_receipt_audit()')
 await api(`/salary-changes/${own.id}/acknowledge`,{acknowledged:true,cancellation:true},{employee:true,status:500})
 assert.equal((await h.pool.query('SELECT cancellation_acknowledged_at FROM payroll_salary_change WHERE id=$1',[own.id])).rows[0].cancellation_acknowledged_at,null)
 await h.pool.query('DROP TRIGGER reject_receipt_audit ON payroll_audit_log')
 await api(`/salary-changes/${own.id}/acknowledge`,{acknowledged:true,cancellation:true},{employee:true})
 const saved=(await h.pool.query('SELECT * FROM payroll_salary_change WHERE id=$1',[own.id])).rows[0]
 assert.equal(saved.acknowledged_notice.cancelledAt,null);assert.ok(saved.cancellation_acknowledged_notice.cancelledAt);assert.equal(saved.cancellation_acknowledged_notice.cancellationNoticeDeliveredOn,'2026-01-02')
 assert.doesNotMatch(JSON.stringify(saved.cancellation_acknowledged_notice),/PRIVATE/)
 const admin=await api(`/employees/${e.id}/salary-changes`);assert.ok(admin[0].acknowledged_at);assert.ok(admin[0].cancellation_acknowledged_at)
})
