import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {correctionPaymentFixture} from '../testing/correctionPaymentFixture.js'
for(const openingAccruedMinutes of [0,2250])test(`authorized corrections enter regular payroll with reviewed leave context ${openingAccruedMinutes}`,{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const {api,request,input,target,e,entry,first}=await correctionPaymentFixture(h,{openingAccruedMinutes})
 const preview=await api(`/requests/${request.id}/payroll-correction-payment-preview`,input)
 const authorization=await api(`/requests/${request.id}/payroll-correction-authorizations`,{...input,fingerprint:preview.fingerprint,requestKey:'correction-payroll-authorization',reason:'Authorize reviewed correction in the selected regular payroll',confirmed:true},'POST',201)
 const payroll=(await api('/runs/preview',{payPeriodId:target.id})).preview
 assert.equal(payroll.canApprove,true,JSON.stringify(payroll.warnings))
 const employee=payroll.employees[0]
 assert.equal(employee.grossPayCents,107500);assert.equal(employee.regularMinutes+employee.overtimeMinutes,2400)
 assert.equal(employee.sickLeaveAccrualMinutes,openingAccruedMinutes?66:80)
 assert.equal(employee.correctionAuthorizations[0].authorizationId,authorization.id)
 assert.equal(employee.payItems.find(i=>i.kind==='WAGE_CORRECTION').correction.authorizationId,authorization.id)
 assert.equal(employee.correctionSettlements[0].authorizationId,authorization.id)
 assert.equal(employee.correctionSettlements[0].paymentApplied,false)
 assert.equal(employee.correctionSettlements[0].originalTime.clock_out,'2026-08-03T20:00:00.000Z')
 assert.equal(new Date(employee.correctionSettlements[0].proposedTime.clockOut).toISOString(),'2026-08-03T22:00:00.000Z')
 const before=(await h.pool.query('SELECT * FROM payroll_leave_transaction ORDER BY id')).rows
 const run=await api('/runs',{payPeriodId:target.id},'POST',201)
 await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH')
 const history=await api(`/requests/${request.id}/payroll-correction-authorizations`,undefined,'GET')
 assert.equal(history[0].status,'CURRENT');assert.equal(Number(history[0].payrollRun.id),Number(run.id))
 const frozen=(await h.pool.query('SELECT calculation_snapshot FROM payroll_run WHERE id=$1',[run.id])).rows[0].calculation_snapshot
 assert.equal(frozen.employees[0].grossPayCents,107500)
 assert.deepEqual(frozen.employees[0].correctionSettlements,employee.correctionSettlements)
 const originalPayment=(await h.pool.query('SELECT * FROM payroll_run_employee WHERE payroll_run_id=$1',[first.id])).rows
 await h.pool.query("CREATE FUNCTION reject_correction_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='CORRECTION_SETTLED' THEN RAISE EXCEPTION 'Synthetic correction audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_correction_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_correction_audit()")
 await api(`/runs/${run.id}/finalize`,{paymentDate:input.paymentDate,paymentConfirmationReference:'SYNTHETIC-CORRECTION-SETTLEMENT'},'POST',500)
 assert.equal((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_correction_settlement')).rows[0].n,0)
 assert.deepEqual((await h.pool.query('SELECT * FROM payroll_leave_transaction ORDER BY id')).rows,before)
 assert.equal((await h.pool.query('SELECT status FROM payroll_employee_request WHERE id=$1',[request.id])).rows[0].status,'PENDING')
 await h.pool.query('DROP TRIGGER reject_correction_audit ON payroll_audit_log')
 await api(`/runs/${run.id}/finalize`,{paymentDate:input.paymentDate,paymentConfirmationReference:'SYNTHETIC-CORRECTION-SETTLEMENT'})
 const settled=(await h.pool.query('SELECT * FROM payroll_correction_settlement')).rows
 assert.equal(settled.length,1);assert.equal(Number(settled[0].authorization_id),authorization.id)
 assert.equal((await h.pool.query('SELECT status FROM payroll_employee_request WHERE id=$1',[request.id])).rows[0].status,'APPROVED')
 assert.deepEqual((await h.pool.query('SELECT * FROM payroll_run_employee WHERE payroll_run_id=$1',[first.id])).rows,originalPayment)
 assert.equal((await h.pool.query('SELECT clock_out FROM payroll_time_entry WHERE id=$1',[entry.id])).rows[0].clock_out.toISOString(),'2026-08-03T20:00:00.000Z')
 assert.equal((await h.pool.query('SELECT clock_out FROM payroll_effective_time_entry WHERE id=$1',[entry.id])).rows[0].clock_out.toISOString(),'2026-08-03T22:00:00.000Z')
 const statement=(await h.pool.query('SELECT statement_snapshot FROM payroll_run_employee WHERE payroll_run_id=$1',[run.id])).rows[0].statement_snapshot
 assert.equal(statement.correctionSettlements[0].paymentApplied,true);assert.deepEqual(statement.correctionSettlementIds,[Number(settled[0].id)])
 const paidHistory=await api(`/requests/${request.id}/payroll-correction-authorizations`,undefined,'GET')
 assert.equal(paidHistory[0].status,'SETTLED');assert.equal(paidHistory[0].paymentApplied,true);assert.equal(paidHistory[0].issue,null)
 assert.equal(paidHistory[0].settlement.runId,Number(run.id));assert.equal(paidHistory[0].preview.delta.netPayCents,5580)
 const replay=await api(`/requests/${request.id}/payroll-correction-authorizations`,{...input,fingerprint:preview.fingerprint,requestKey:'correction-payroll-authorization',reason:'Authorize reviewed correction in the selected regular payroll',confirmed:true})
 assert.equal(replay.id,authorization.id);assert.equal(replay.paymentApplied,true)
 const after=(await h.pool.query('SELECT * FROM payroll_leave_transaction ORDER BY id')).rows
 assert.equal(after.reduce((n,r)=>n+Number(r.minutes),0),openingAccruedMinutes?2400:164)
 await api(`/runs/${run.id}/finalize`,{paymentDate:input.paymentDate,paymentConfirmationReference:'SYNTHETIC-CORRECTION-SETTLEMENT'},'POST',409)
 assert.deepEqual((await h.pool.query('SELECT * FROM payroll_leave_transaction ORDER BY id')).rows,after)
 const next=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-09-16','2026-09-30','2026-10-02','SEMIMONTHLY') RETURNING id")).rows[0]
 for(const day of ['21','22','23','24','25'])await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,$2,$3,'ADMIN','APPROVED')",[e.id,`2026-09-${day}T12:00Z`,`2026-09-${day}T20:00Z`])
 const following=(await api('/runs/preview',{payPeriodId:next.id})).preview.employees.find(p=>Number(p.employeeId)===Number(e.id))
 assert.equal(following.sickLeaveBalanceBeforeMinutes,openingAccruedMinutes?2400:164);assert.equal(following.sickLeaveYearAccruedBeforeMinutes,openingAccruedMinutes?2400:164)
 assert.equal(following.sickLeaveAccrualMinutes,openingAccruedMinutes?0:80)
 assert.equal(following.payItems.some(i=>i.kind==='WAGE_CORRECTION'),false)
 if(!openingAccruedMinutes){
  await h.pool.query("INSERT INTO payroll_leave_transaction(facility_id,employee_id,transaction_date,minutes,reason,transaction_kind) VALUES(1,$1,'2026-09-04',-4,'Synthetic signed earned-leave correction','CORRECTION_ACCRUAL')",[e.id])
  const adjusted=(await api('/runs/preview',{payPeriodId:next.id})).preview.employees.find(p=>Number(p.employeeId)===Number(e.id))
  assert.equal(adjusted.sickLeaveBalanceBeforeMinutes,160);assert.equal(adjusted.sickLeaveYearAccruedBeforeMinutes,160)
 }
})
test('stale authorization blocks correction payroll rather than silently omitting the earning',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const {api,request,input,target,e}=await correctionPaymentFixture(h)
 const preview=await api(`/requests/${request.id}/payroll-correction-payment-preview`,input)
 await api(`/requests/${request.id}/payroll-correction-authorizations`,{...input,fingerprint:preview.fingerprint,requestKey:'stale-payroll-authorization',reason:'Authorize the reviewed correction payroll before source changes',confirmed:true},'POST',201)
 await h.pool.query("UPDATE payroll_time_entry SET clock_out=clock_out+interval '1 hour' WHERE employee_id=$1 AND clock_in='2026-08-17T12:00Z'",[e.id])
 await api('/runs/preview',{payPeriodId:target.id},'POST',409)
 await api('/runs',{payPeriodId:target.id},'POST',409)
 assert.equal((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_run WHERE pay_period_id=$1',[target.id])).rows[0].n,0)
})
test('approval rejects changed settlement evidence even when payroll totals are unchanged',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const {api,request,input,target}=await correctionPaymentFixture(h)
 const preview=await api(`/requests/${request.id}/payroll-correction-payment-preview`,input)
 await api(`/requests/${request.id}/payroll-correction-authorizations`,{...input,fingerprint:preview.fingerprint,requestKey:'frozen-settlement-authorization',reason:'Authorize the correction with complete source and leave evidence',confirmed:true},'POST',201)
 const run=await api('/runs',{payPeriodId:target.id},'POST',201)
 await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH')
 await h.pool.query(`UPDATE payroll_run SET calculation_snapshot=jsonb_set(calculation_snapshot,'{employees,0,correctionSettlements,0,proposedTime,clockOut}','"2026-08-03T23:00:00Z"'::jsonb) WHERE id=$1`,[run.id])
 await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH',409)
 assert.equal((await h.pool.query('SELECT status FROM payroll_run WHERE id=$1',[run.id])).rows[0].status,'REVIEW')
 assert.equal((await h.pool.query('SELECT status FROM payroll_employee_request WHERE id=$1',[request.id])).rows[0].status,'PENDING')
})
