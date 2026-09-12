import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
const policy={leaveType:'PTO',minutes:450,hourlyRateCents:2555,policyVerified:true,unusedVacationVerified:true,policyReference:'Synthetic communicated vacation payout policy'}
test('PTO reservations are atomic, idempotent, protected from competing use and cancellable before payroll approval',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200,facility=1)=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method:body?'POST':'GET',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':String(facility)},body:body?JSON.stringify(body):undefined});const j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j.data}
 const e=await api('/employees',{employeeNumber:'RESERVE-PTO',legalFirstName:'Reserved',legalLastName:'PTO',hireDate:'2026-08-03',hourlyRateCents:2555},201)
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE' WHERE id=$1",[e.id])
 const period=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-08-03','2026-08-09','2026-08-14','WEEKLY') RETURNING id")).rows[0]
 const ledger=(await h.pool.query("INSERT INTO payroll_leave_transaction(facility_id,employee_id,leave_type,transaction_date,minutes,reason) VALUES(1,$1,'PTO','2026-08-01',480,'Synthetic earned leave') RETURNING id",[e.id])).rows[0]
 const prefix=`/employees/${e.id}`,preview=await api(`${prefix}/leave-payout/preview`,policy)
 const body={...policy,payPeriodId:Number(period.id),fingerprint:preview.fingerprint,requestKey:'synthetic-pto-reservation-1'}
 const payout=await api(`${prefix}/leave-payouts`,body,201)
 assert.equal(Number(payout.amount_cents),19163)
 assert.equal((await api(`${prefix}/leave-payouts`,body)).id,payout.id)
 await api(`${prefix}/leave-payouts`,{...body,minutes:440},409)
 await api(`${prefix}/leave-payouts`,undefined,404,2)
 assert.equal((await api(`${prefix}/leave-payouts`)).length,1)
 const packet=await api(`${prefix}/onboarding`);assert.equal(packet.leaveBalances.find(b=>b.leave_type==='PTO').minutes,30)
 await api(`${prefix}/leave-payout/preview`,{...policy,minutes:60},400)
 await assert.rejects(()=>h.pool.query('UPDATE payroll_leave_transaction SET minutes=400 WHERE id=$1',[ledger.id]),e=>e.constraint==='payroll_leave_payout_reserved')
 const request=(await h.pool.query("INSERT INTO payroll_employee_request(facility_id,employee_id,kind,payload) VALUES(1,$1,'LEAVE',$2) RETURNING id",[e.id,{leaveType:'PTO',startDate:'2026-08-08',endDate:'2026-08-08',minutes:60,reason:'Synthetic request competing with reserved payout'}])).rows[0]
 await api(`/requests/${request.id}/review`,{status:'APPROVED',note:'Synthetic approval review'},409)
 const payroll=(await api('/runs/preview',{payPeriodId:period.id})).preview
 assert.ok(payroll.warnings.some(w=>w.code==='PTO_PAYOUT_PAYMENT_DATE'&&w.blocking))
 await api(`${prefix}/leave-payouts/${payout.id}/cancel`,{reason:'short'},400)
 await api(`${prefix}/leave-payouts/${payout.id}/cancel`,{reason:'Synthetic revised separation payment plan'},200)
 await api(`${prefix}/leave-payouts/${payout.id}/cancel`,{reason:'Synthetic revised separation payment plan'},200)
 assert.equal((await api(`${prefix}/onboarding`)).leaveBalances.find(b=>b.leave_type==='PTO').minutes,480)
 assert.equal((await h.pool.query("SELECT COUNT(*)::int n FROM payroll_audit_log WHERE action='PTO_PAYOUT_CANCELLED'")).rows[0].n,1)
 await h.pool.query("CREATE FUNCTION reject_payout_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='PTO_PAYOUT_RESERVED' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$")
 await h.pool.query('CREATE TRIGGER reject_payout_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_payout_audit()')
 await api(`${prefix}/leave-payouts`,{...body,requestKey:'synthetic-pto-reservation-2'},500)
 assert.equal((await api(`${prefix}/leave-payouts`)).length,1)
 await h.pool.query('DROP TRIGGER reject_payout_audit ON payroll_audit_log')
 await assert.rejects(()=>h.pool.query("UPDATE payroll_leave_payout SET status='RESERVED' WHERE id=$1",[payout.id]),/cannot be changed/)
 await assert.rejects(()=>h.pool.query('DELETE FROM payroll_leave_payout WHERE id=$1',[payout.id]),/audit history/)
 const second=await api(`${prefix}/leave-payouts`,{...body,requestKey:'synthetic-pto-reservation-3'},201)
 await h.pool.query("INSERT INTO payroll_run(facility_id,pay_period_id,status) VALUES(1,$1,'APPROVED')",[period.id])
 await api(`${prefix}/leave-payouts/${second.id}/cancel`,{reason:'Synthetic change after approval'},409)
})

test('concurrent PTO reservations cannot promise the same balance twice',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const post=async(path,body)=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,...await r.json()}}
 const e=(await post('/employees',{employeeNumber:'PTO-RACE',legalFirstName:'Concurrent',legalLastName:'Payout',hireDate:'2026-08-03',hourlyRateCents:2555})).data
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE' WHERE id=$1",[e.id])
 const period=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-08-03','2026-08-09','2026-08-14','WEEKLY') RETURNING id")).rows[0]
 await h.pool.query("INSERT INTO payroll_leave_transaction(facility_id,employee_id,leave_type,transaction_date,minutes,reason) VALUES(1,$1,'PTO','2026-08-01',480,'Synthetic earned vacation')",[e.id])
 const base={...policy,minutes:300},preview=(await post(`/employees/${e.id}/leave-payout/preview`,base)).data
 const results=await Promise.all([1,2].map(i=>post(`/employees/${e.id}/leave-payouts`,{...base,payPeriodId:period.id,fingerprint:preview.fingerprint,requestKey:`synthetic-concurrent-pto-${i}`})))
 assert.equal(results.filter(r=>r.status===201).length,1)
 assert.ok(results.some(r=>[400,409].includes(r.status)))
 assert.equal((await h.pool.query("SELECT SUM(minutes)::int n FROM payroll_leave_payout WHERE status='RESERVED'")).rows[0].n,300)
})
