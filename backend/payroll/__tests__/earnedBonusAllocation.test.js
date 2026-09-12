import test from 'node:test'
import assert from 'node:assert/strict'
import {allocateEarnedBonus} from '../earnedBonusAllocation.js'
import {createHarness} from '../testing/harness.js'
const week=(date,worked,earned=worked,overtimeEligible=true)=>({week:date,workedMinutes:worked*60,earnedMinutes:earned*60,overtimeEligible})
test('earned-hour allocation uses full weekly hours for additional overtime and preserves bonus cents',()=>{
 const result=allocateEarnedBonus(10000,[week('2026-08-03',40),week('2026-08-10',60)])
 assert.deepEqual(result.weeks.map(w=>w.allocatedBonusCents),[4000,6000]);assert.equal(result.additionalOvertimeCents,1000)
 const partial=allocateEarnedBonus(10000,[week('2026-08-03',60,10)])
 assert.equal(partial.additionalOvertimeCents,1667)
 assert.equal(allocateEarnedBonus(10000,[week('2026-08-03',60,10,false)]).additionalOvertimeCents,0)
 const cents=allocateEarnedBonus(1,[week('2026-08-17',60),week('2026-08-03',60),week('2026-08-10',60)])
 assert.deepEqual(cents.weeks.map(w=>w.allocatedBonusCents),[1,0,0]);assert.equal(cents.additionalOvertimeCents,0)
 assert.equal(JSON.parse(JSON.stringify(cents)).bonusCents,1)
 for(const invalid of [[null],[week('bad',40)],[week('2026-08-03',0)],[week('2026-08-03',40,50)],[week('2026-08-03',40),week('2026-08-04',40)]])assert.throws(()=>allocateEarnedBonus(100,invalid),e=>e.status===409)
 assert.throws(()=>allocateEarnedBonus(Number.MAX_SAFE_INTEGER+1,[week('2026-08-03',40)]),e=>e.status===409)
})
test('bonus allocation API includes whole closed workweeks and rejects unresolved historical time',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200,facility=1)=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':String(facility)},body:JSON.stringify(body)});const json=await r.json();assert.equal(r.status,status,JSON.stringify(json));return json.data}
 const e=await api('/employees',{employeeNumber:'EARNED-BONUS',legalFirstName:'Earned',legalLastName:'Fixture',hireDate:'2026-08-03',hourlyRateCents:2500},201)
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE' WHERE id=$1",[e.id])
 for(let i=3;i<=8;i++)await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,$2,$3,'ADMIN','APPROVED')",[e.id,`2026-08-0${i}T12:00:00Z`,`2026-08-0${i}T22:00:00Z`])
 const body={amountCents:10000,earnedStart:'2026-08-03',earnedEnd:'2026-08-03'},path=`/employees/${e.id}/bonus-allocation/preview`
 const result=await api(path,body)
 assert.equal(result.weeks[0].workedMinutes,3600);assert.equal(result.weeks[0].earnedMinutes,600);assert.equal(result.additionalOvertimeCents,1667);assert.equal(result.evidence.length,6)
 const overnight=(await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,unpaid_break_minutes,source,status) VALUES(1,$1,'2026-08-03T02:00:00Z','2026-08-03T06:00:00Z',30,'ADMIN','APPROVED') RETURNING id",[e.id])).rows[0]
 await api(path,body,409)
 await h.pool.query('UPDATE payroll_time_entry SET unpaid_break_minutes=0 WHERE id=$1',[overnight.id])
 const split=await api(path,body);assert.equal(split.weeks[0].workedMinutes,3720);assert.equal(split.weeks[0].earnedMinutes,720);assert.equal(split.additionalOvertimeCents,1774)
 await h.pool.query('DELETE FROM payroll_time_entry WHERE id=$1',[overnight.id])
 await api(path,body,404,2)
 await api(path,{...body,earnedStart:'2099-08-03',earnedEnd:'2099-08-03'},409)
 await h.pool.query("UPDATE payroll_time_entry SET status='UNVERIFIED' WHERE employee_id=$1",[e.id]);await api(path,body,409)
 await h.pool.query("UPDATE payroll_time_entry SET status='APPROVED' WHERE employee_id=$1",[e.id])
 await h.pool.query("UPDATE payroll_employee SET overtime_classification='EXEMPT' WHERE id=$1",[e.id]);await api(path,body,409)
 await h.pool.query("UPDATE payroll_employee SET overtime_classification='EXEMPT_REVIEW' WHERE id=$1",[e.id]);await api(path,body,409)
 await h.pool.query("UPDATE payroll_employee SET overtime_classification='NONEXEMPT' WHERE id=$1",[e.id])
 await h.pool.query('DELETE FROM payroll_time_entry WHERE employee_id=$1',[e.id])
 // A still-open entry that starts BEFORE the inspected range must not vanish during day splitting.
 const open=(await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,source,status) VALUES(1,$1,'2026-08-02T12:00:00Z','ADMIN','UNVERIFIED') RETURNING id",[e.id])).rows[0]
 await api(path,body,409)
 await h.pool.query('DELETE FROM payroll_time_entry WHERE id=$1',[open.id])
})
test('earned bonus saves fresh allocation evidence atomically and rejects stale or changed retries',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200)=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});const json=await r.json();assert.equal(r.status,status,JSON.stringify(json));return json.data}
 const e=await api('/employees',{employeeNumber:'SAVE-EARNED',legalFirstName:'Save',legalLastName:'Earned',hireDate:'2026-08-03',hourlyRateCents:2500},201)
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE' WHERE id=$1",[e.id])
 const period=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-08-03','2026-08-09','2026-08-14','WEEKLY') RETURNING id")).rows[0]
 for(let i=3;i<=8;i++)await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,$2,$3,'ADMIN','APPROVED')",[e.id,`2026-08-0${i}T12:00:00Z`,`2026-08-0${i}T22:00:00Z`])
 const base={amountCents:10000,earnedStart:'2026-08-03',earnedEnd:'2026-08-03'},prefix=`/employees/${e.id}`
 const old=await api(`${prefix}/bonus-allocation/preview`,base)
 const body={...base,classification:'NONDISCRETIONARY',paymentType:'ANNUAL_LUMP_SUM',payPeriodId:period.id,confirmed:true,source:'Synthetic earned-hours agreement with full historical time review',allocationMethod:'PROPORTIONAL_EARNED_HOURS',allocationMethodVerified:true,allocationFingerprint:old.fingerprint,requestKey:'earned-bonus-save-request-1'}
 await api(`${prefix}/bonuses`,{...body,allocationMethodVerified:false},400)
 await h.pool.query("UPDATE payroll_time_entry SET clock_out=clock_out-interval '1 hour' WHERE employee_id=$1",[e.id])
 await api(`${prefix}/bonuses`,body,409)
 assert.equal((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_recurring_adjustment')).rows[0].n,0)
 const fresh=await api(`${prefix}/bonus-allocation/preview`,base);body.allocationFingerprint=fresh.fingerprint
 const saved=await api(`${prefix}/bonuses`,body,201)
 assert.equal(saved.bonus_review.allocation.additionalOvertimeCents,1296)
 assert.deepEqual(saved.bonus_review.allocation.evidence,fresh.evidence)
 assert.equal(saved.bonus_review.earnedStart,base.earnedStart)
 assert.equal((await api(`${prefix}/bonuses`,body)).id,saved.id)
 await api(`${prefix}/bonuses`,{...body,earnedEnd:'2026-08-04'},409)
 const audit=(await h.pool.query("SELECT after_data FROM payroll_audit_log WHERE action='BONUS_REVIEWED'")).rows
 assert.equal(audit.length,1);assert.equal(audit[0].after_data.bonus_review.allocation.fingerprint,fresh.fingerprint)
 const preview=(await api('/runs/preview',{payPeriodId:period.id})).preview
 assert.ok(!preview.warnings.some(w=>w.code==='SALARY_BONUS_REGULAR_RATE_REVIEW'))
 assert.equal(preview.employees[0].payItems.find(p=>p.kind==='BONUS_OVERTIME').amountCents,1296)
 // Audit failure must roll back both the bonus and its saved evidence.
 await h.pool.query("CREATE FUNCTION reject_bonus_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='BONUS_REVIEWED' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$")
 await h.pool.query('CREATE TRIGGER reject_bonus_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_bonus_audit()')
 await api(`${prefix}/bonuses`,{...body,requestKey:'earned-bonus-save-request-2'},500)
 assert.equal((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_recurring_adjustment')).rows[0].n,1)
 await h.pool.query("UPDATE payroll_time_entry SET clock_in=clock_in+interval '1 hour',clock_out=clock_out+interval '1 hour' WHERE employee_id=$1",[e.id])
 const changed=(await api('/runs/preview',{payPeriodId:period.id})).preview
 assert.ok(changed.warnings.some(w=>w.code==='BONUS_PAYMENT_RECONCILIATION'))
 assert.ok(!changed.employees[0].payItems.some(p=>p.kind==='BONUS_OVERTIME'))
})
