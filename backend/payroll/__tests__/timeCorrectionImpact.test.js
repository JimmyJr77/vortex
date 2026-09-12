import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
test('time corrections detect full-workweek paid impact while isolating employees and preserving paid time',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200,facility=1)=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method:body?'POST':'GET',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':String(facility)},body:body?JSON.stringify(body):undefined});const j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j.data}
 const employees=[]
 for(const n of [1,2]){const e=await api('/employees',{employeeNumber:`IMPACT-${n}`,legalFirstName:'Impact',legalLastName:String(n),hireDate:'2026-08-01',hourlyRateCents:2500},201);await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE' WHERE id=$1",[e.id]);employees.push(e)}
 const period=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-08-07','2026-08-09','2026-08-14','WEEKLY') RETURNING id")).rows[0]
 const run=(await h.pool.query("INSERT INTO payroll_run(facility_id,pay_period_id,status) VALUES(1,$1,'APPROVED') RETURNING id",[period.id])).rows[0]
 await h.pool.query('INSERT INTO payroll_run_employee(payroll_run_id,employee_id,regular_pay_cents) VALUES($1,$2,25000)',[run.id,employees[0].id])
 const requests=[]
 for(const e of employees){
  const entry=(await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,'2026-08-03T02:00Z','2026-08-03T06:00Z','ADMIN','APPROVED') RETURNING *",[e.id])).rows[0]
  const p={entryId:entry.id,clockIn:'2026-08-03T02:00Z',clockOut:'2026-08-03T07:00Z',unpaidBreakMinutes:0,reason:'Correct the recorded end of the overnight shift'}
  const request=(await h.pool.query("INSERT INTO payroll_employee_request(facility_id,employee_id,kind,payload) VALUES(1,$1,'TIME_CORRECTION',$2) RETURNING id",[e.id,p])).rows[0]
  requests.push({request,entry})
 }
 const before=(await h.pool.query('SELECT COUNT(*)::int n FROM payroll_audit_log')).rows[0].n
 const impact=await api(`/requests/${requests[0].request.id}/payroll-impact`)
 assert.equal(impact.status,'PAYROLL_CORRECTION_REQUIRED');assert.equal(impact.runs.length,1);assert.equal(impact.proposed.workedMinutes,300)
 assert.equal(impact.scopes[0].first,'2026-07-27');assert.equal(impact.scopes[0].last,'2026-08-09')
 assert.equal((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_audit_log')).rows[0].n,before)
 await api(`/requests/${requests[0].request.id}/payroll-impact`,undefined,404,2)
 const savePath=`/requests/${requests[0].request.id}/payroll-impact/reviews`,save={requestKey:'correction-impact-review-001',fingerprint:impact.fingerprint,reason:'Reviewed the original payroll and proposed overnight time correction',confirmed:true}
 await api(savePath,{...save,confirmed:false},400)
 await api(savePath,save,404,2)
 await api(savePath,{...save,fingerprint:'0'.repeat(64)},409)
 await h.pool.query("CREATE FUNCTION reject_correction_review() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='TIME_CORRECTION_IMPACT_REVIEWED' THEN RAISE EXCEPTION 'Synthetic audit failure'; END IF; RETURN NEW; END $$")
 await h.pool.query('CREATE TRIGGER reject_correction_review BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_correction_review()')
 await api(savePath,save,500)
 await h.pool.query('DROP TRIGGER reject_correction_review ON payroll_audit_log')
 const receipts=await Promise.all(Array.from({length:3},async()=>{const r=await fetch(`${h.url}/api/admin/payroll${savePath}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(save)});return {status:r.status,data:(await r.json()).data}}))
 assert.deepEqual(receipts.map(r=>r.status).sort(),[200,200,201]);assert.equal(new Set(receipts.map(r=>r.data.id)).size,1)
 await api(savePath,{...save,reason:'Changed reason with the same request reference'},409)
 const reviewed=await api(`/requests/${requests[0].request.id}/payroll-impact`)
 assert.equal(reviewed.reviews.length,1);assert.equal(reviewed.reviews[0].status,'CURRENT')
 await h.pool.query('UPDATE payroll_run_employee SET statement_snapshot=$2 WHERE payroll_run_id=$1',[run.id,{evidence:'Changed frozen wage evidence with unchanged gross'}])
 const stale=await api(`/requests/${requests[0].request.id}/payroll-impact`)
 assert.equal(stale.reviews[0].status,'STALE')
 await api(savePath,{...save,requestKey:'correction-impact-review-stale'},409)
 assert.equal((await api(savePath,save)).id,receipts[0].data.id)
 await api(`/requests/${requests[0].request.id}/review`,{status:'APPROVED',note:'Reviewed overnight correction against payroll impact'},409)
 assert.equal((await h.pool.query('SELECT clock_out FROM payroll_time_entry WHERE id=$1',[requests[0].entry.id])).rows[0].clock_out.toISOString(),'2026-08-03T06:00:00.000Z')
 assert.equal((await api(`/requests/${requests[1].request.id}/payroll-impact`)).status,'TIMESHEET_REVIEW')
 await api(`/requests/${requests[1].request.id}/review`,{status:'APPROVED',note:'Reviewed employee-specific timesheet correction'})
 await h.pool.query("INSERT INTO payroll_historical_payment(facility_id,employee_id,period_start,period_end,payment_date,method,reference,gross_amount_cents,employee_tax_withheld_cents,net_amount_cents,evidence_note,source) VALUES(1,$1,'2026-08-03','2026-08-05','2026-08-14','CHECK','IMPACT-IMPORT',10000,0,10000,'Synthetic paid wage source','ADMIN_RECORDED')",[employees[1].id])
 const imported=await api(`/requests/${requests[1].request.id}/payroll-impact`)
 assert.equal(imported.status,'PAYROLL_CORRECTION_REQUIRED');assert.equal(imported.runs.length,0);assert.equal(imported.historicalPayments.length,1)
 const bonusPeriod=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-08-17','2026-08-23','2026-08-28','WEEKLY') RETURNING id")).rows[0]
 const bonusRun=(await h.pool.query("INSERT INTO payroll_run(facility_id,pay_period_id,status,run_kind,calculation_snapshot) VALUES(1,$1,'APPROVED','OFF_CYCLE_BONUS',$2) RETURNING id",[bonusPeriod.id,{employees:[{employeeId:Number(employees[1].id),payItems:[{kind:'BONUS',bonusAllocation:{weeks:[{week:'2026-08-03'}]}}]}]}])).rows[0]
 await h.pool.query('INSERT INTO payroll_run_employee(payroll_run_id,employee_id) VALUES($1,$2)',[bonusRun.id,employees[1].id])
 const bonusImpact=await api(`/requests/${requests[1].request.id}/payroll-impact`)
 assert.equal(bonusImpact.runs.length,1);assert.equal(bonusImpact.runs[0].run_kind,'OFF_CYCLE_BONUS')
 assert.notEqual(bonusImpact.fingerprint,imported.fingerprint)
})
