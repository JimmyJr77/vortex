import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {correctionPaymentFixture} from '../testing/correctionPaymentFixture.js'

async function fixture(h,missing=false){
 const f=await correctionPaymentFixture(h),{api,request,input,target}=f
 if(missing){
  request.payload={clockIn:'2026-08-03T20:00:00Z',clockOut:'2026-08-03T22:00:00Z',unpaidBreakMinutes:0,reason:'Record missing work after the paid shift'}
  await h.pool.query('UPDATE payroll_employee_request SET payload=$1 WHERE id=$2',[request.payload,request.id])
  const impact=await api(`/requests/${request.id}/payroll-impact`,undefined,'GET')
  await api(`/requests/${request.id}/payroll-impact/reviews`,{requestKey:'missing-storage-impact',fingerprint:impact.fingerprint,reason:'Verify missing work and its original payment dependencies',confirmed:true},'POST',201)
  const calculation=await api(`/requests/${request.id}/payroll-correction-preview`,{})
  const retained=await api(`/requests/${request.id}/payroll-corrections`,{requestKey:'missing-storage-calculation',fingerprint:calculation.fingerprint,reason:'Retain the complete missing work wage and leave calculation',confirmed:true},'POST',201)
  input.calculationId=retained.id
 }
 const preview=await api(`/requests/${request.id}/payroll-correction-payment-preview`,input)
 const authorization=await api(`/requests/${request.id}/payroll-correction-authorizations`,{...input,fingerprint:preview.fingerprint,requestKey:'correction-storage-authorization',reason:'Authorize complete correction settlement storage evidence',confirmed:true},'POST',201)
 const run=await api('/runs',{payPeriodId:target.id},'POST',201)
 await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH')
 const row=(await h.pool.query('SELECT * FROM payroll_run_employee WHERE payroll_run_id=$1',[run.id])).rows[0]
 const plan=(await h.pool.query('SELECT calculation_snapshot FROM payroll_run WHERE id=$1',[run.id])).rows[0].calculation_snapshot.employees[0].correctionSettlements[0]
 return {...f,authorization,run,row,plan}
}
const insert=async(db,f,overrides={})=>{
 const x={facility:1,employee:f.e.id,request:f.request.id,authorization:f.authorization.id,runEmployee:f.row.id,entry:f.entry.id,plan:f.plan,...overrides}
 return (await db.query("INSERT INTO payroll_correction_settlement(facility_id,employee_id,request_id,authorization_id,run_employee_id,effective_entry_id,plan,created_by) VALUES($1,$2,$3,$4,$5,COALESCE($6::bigint,nextval('payroll_time_entry_id_seq')),$7,99) RETURNING *",[x.facility,x.employee,x.request,x.authorization,x.runEmployee,x.entry,x.plan])).rows[0]
}
async function complete(db,f,settlement,omit){
 if(omit!=='payment')await db.query("UPDATE payroll_run SET status='FINALIZED' WHERE id=$1",[f.run.id])
 if(omit!=='request')await db.query("UPDATE payroll_employee_request SET status='APPROVED' WHERE id=$1",[f.request.id])
 if(omit!=='historicalLeave')await db.query("INSERT INTO payroll_leave_transaction(facility_id,employee_id,transaction_date,minutes,reason,transaction_kind,source_request_id) VALUES(1,$1,$2,$3,'Synthetic atomic correction credit','ADJUSTMENT',$4)",[f.e.id,f.input.paymentDate,f.plan.correctionLeave.creditDifferenceMinutes,f.request.id])
 if(omit!=='targetLeave')await db.query("INSERT INTO payroll_leave_transaction(facility_id,employee_id,transaction_date,minutes,reason,transaction_kind,source_run_employee_id) VALUES(1,$1,$2,$3,'Synthetic target accrual','PAYROLL_ACCRUAL',$4)",[f.e.id,f.input.paymentDate,f.plan.targetLeave.after.accrualMinutes,f.row.id])
 if(omit!=='statement')await db.query("UPDATE payroll_run_employee SET statement_snapshot=jsonb_build_object('correctionSettlementIds',jsonb_build_array($1::bigint)) WHERE id=$2",[settlement.id,f.row.id])
}
test('correction storage requires atomic payment, request, leave and statement completion',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();let db;t.after(async()=>{if(db){await db.query('ROLLBACK');db.release()}await h.close()});const f=await fixture(h)
 db=await h.pool.connect()
 const source=(await db.query('SELECT * FROM payroll_time_entry ORDER BY id')).rows
 for(const omit of ['payment','request','historicalLeave','targetLeave','statement','wrongLeaveDate','changedNet','changedRequest']){
  await db.query('BEGIN');const settlement=await insert(db,f);await complete(db,f,settlement,omit)
  if(omit==='wrongLeaveDate')await db.query("UPDATE payroll_leave_transaction SET transaction_date=transaction_date+1 WHERE source_request_id=$1",[f.request.id])
  if(omit==='changedNet')await db.query('UPDATE payroll_run_employee SET net_pay_cents=net_pay_cents+1 WHERE id=$1',[f.row.id])
  if(omit==='changedRequest')await db.query("UPDATE payroll_employee_request SET payload=payload||'{\"reason\":\"Changed request after settlement insertion\"}'::jsonb WHERE id=$1",[f.request.id])
  await assert.rejects(db.query('COMMIT'),{code:'23514'});await db.query('ROLLBACK')
  assert.equal((await db.query('SELECT COUNT(*)::int n FROM payroll_correction_settlement')).rows[0].n,0)
  assert.equal((await db.query('SELECT status FROM payroll_run WHERE id=$1',[f.run.id])).rows[0].status,'APPROVED')
 }
 await db.query('BEGIN');const settlement=await insert(db,f)
 assert.equal((await db.query('SELECT clock_out FROM payroll_effective_time_entry WHERE id=$1',[f.entry.id])).rows[0].clock_out.toISOString(),'2026-08-03T20:00:00.000Z')
 await complete(db,f,settlement);await db.query('COMMIT')
 assert.deepEqual((await db.query('SELECT * FROM payroll_time_entry ORDER BY id')).rows,source)
 assert.equal((await db.query('SELECT clock_out FROM payroll_effective_time_entry WHERE id=$1',[f.entry.id])).rows[0].clock_out.toISOString(),'2026-08-03T22:00:00.000Z')
 assert.equal((await db.query('SELECT COUNT(*)::int n FROM payroll_effective_time_entry')).rows[0].n,source.length)
 assert.equal((await db.query('SELECT COUNT(*)::int n FROM payroll_effective_time_entry WHERE facility_id=2')).rows[0].n,0)
 const displayed=(await f.api('/dashboard',undefined,'GET')).timeEntries.find(entry=>Number(entry.id)===Number(f.entry.id))
 assert.equal(new Date(displayed.clock_out).toISOString(),'2026-08-03T22:00:00.000Z');assert.equal(displayed.worked_minutes,600)
 await assert.rejects(db.query('UPDATE payroll_correction_settlement SET created_by=100 WHERE id=$1',[settlement.id]),{code:'23514'})
 await assert.rejects(db.query('DELETE FROM payroll_correction_settlement WHERE id=$1',[settlement.id]),{code:'23514'})
 await assert.rejects(insert(db,f),{code:'23514'})
})
test('correction storage rejects different facility, payment identity and approved source evidence',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close());const f=await fixture(h)
 for(const overrides of [{facility:2},{entry:Number(f.entry.id)+1},{authorization:Number(f.authorization.id)+1},{plan:{...f.plan,priorWageCorrectionCents:1}},{plan:{...f.plan,proposedTime:{...f.plan.proposedTime,clockOut:'2026-08-03T23:00Z'}}}])await assert.rejects(insert(h.pool,f,overrides),{code:'23514'})
 assert.equal((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_correction_settlement')).rows[0].n,0)
})
test('missing paid time gets one stable effective identity without creating a replacement original',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();let db;t.after(async()=>{if(db){await db.query('ROLLBACK');db.release()}await h.close()});const f=await fixture(h,true)
 db=await h.pool.connect();const source=(await db.query('SELECT * FROM payroll_time_entry ORDER BY id')).rows
 await db.query('BEGIN');const settlement=await insert(db,f,{entry:null});await complete(db,f,settlement);await db.query('COMMIT')
 const effective=(await db.query('SELECT * FROM payroll_effective_time_entry WHERE id=$1',[settlement.effective_entry_id])).rows[0]
 assert.equal(effective.clock_in.toISOString(),'2026-08-03T20:00:00.000Z');assert.equal(effective.clock_out.toISOString(),'2026-08-03T22:00:00.000Z')
 assert.equal(effective.status,'APPROVED');assert.equal(effective.source,'RECONSTRUCTION');assert.equal(effective.unpaid_break_minutes,0)
 assert.equal((await db.query('SELECT COUNT(*)::int n FROM payroll_effective_time_entry')).rows[0].n,source.length+1)
 assert.deepEqual((await db.query('SELECT * FROM payroll_time_entry ORDER BY id')).rows,source)
 assert.equal((await db.query("SELECT nextval('payroll_time_entry_id_seq') AS id")).rows[0].id===settlement.effective_entry_id,false)
})
