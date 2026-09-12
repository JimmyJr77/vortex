import {payrollPaymentPlan} from './paymentPlan.js'
import {readPayrollPaymentConnection} from './paymentConnection.js'
import {readPayrollPaymentDestination} from './paymentDestination.js'
import {retainPayrollPaymentInstruction} from './paymentInstructions.js'
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
export async function assertNoActivePaymentBatch(db,facility,runId){
 if((await db.query('SELECT b.id FROM payroll_payment_batch b LEFT JOIN payroll_payment_batch_cancellation c ON c.batch_id=b.id WHERE b.facility_id=$1 AND b.payroll_run_id=$2 AND c.batch_id IS NULL',[facility,runId])).rowCount)throw fail('Cancel the unsubmitted payment authorization before manual finalization or voiding.',409)
}
export function registerPaymentBatchRoutes(app,pool,dependencies){
 const route='/api/admin/payroll/runs/:id/payment-authorization'
 app.get(route,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{
  const row=(await pool.query(`SELECT b.id,b.fingerprint,b.plan,b.reference,b.created_at,(SELECT COALESCE(jsonb_agg(jsonb_build_object('employeeId',i.employee_id,'reference',d.reference,'ready',payroll_check_closeout_ready(i.id),'replacement',(SELECT p.evidence-'movements' FROM payroll_check_replacement_closeout p WHERE p.issue_id=i.id AND payroll_check_replacement_closeout_proof_ready(p.id) ORDER BY p.id DESC LIMIT 1))),'[]'::jsonb) FROM payroll_check_issue i LEFT JOIN payroll_check_delivery d ON d.issue_id=i.id WHERE i.batch_id=b.id) AS check_deliveries,(SELECT jsonb_build_object('body',q.body,'status',CASE WHEN EXISTS(SELECT 1 FROM payroll_automatic_closeout_cancellation WHERE batch_id=b.id) THEN 'CANCELLED' WHEN EXISTS(SELECT 1 FROM payroll_payment_closeout WHERE batch_id=b.id) THEN 'COMPLETED' ELSE 'SCHEDULED' END) FROM payroll_automatic_closeout q WHERE q.batch_id=b.id) AS automatic_closeout,(SELECT jsonb_build_object('reference',x.reference,'createdAt',x.created_at,'checkPayments',x.check_payments,'bankObservations',x.bank_observations,'replacementEvidence',x.replacement_evidence) FROM payroll_payment_closeout x WHERE x.batch_id=b.id) AS closeout,(SELECT status FROM payroll_run WHERE id=b.payroll_run_id) AS run_status,c.created_at AS cancelled_at,c.check_preflight_evidence AS cancellation_check_evidence,c.provider_check_evidence AS cancellation_provider_evidence FROM payroll_payment_batch b LEFT JOIN payroll_payment_batch_cancellation c ON c.batch_id=b.id WHERE b.facility_id=$1 AND b.payroll_run_id=$2`,[req.canonicalAccess.facilityId,req.params.id])).rows[0]
  const instructions=row?(await pool.query(`SELECT i.id,i.employee_id,i.amount_cents,a.id AS attempt_id,o.source,o.result,o.created_at AS observed_at,
   (SELECT jsonb_build_object('submitAt',q.submit_at,'reference',q.reference,'status',CASE WHEN EXISTS(SELECT 1 FROM payroll_payment_submission_cancellation WHERE schedule_id=q.id) THEN 'CANCELLED' WHEN a.id IS NOT NULL THEN 'DISPATCHED' ELSE 'SCHEDULED' END) FROM payroll_payment_submission_schedule q WHERE q.instruction_id=i.id) AS schedule
   FROM payroll_payment_batch_instruction l JOIN payroll_payment_instruction i ON i.id=l.instruction_id
   LEFT JOIN payroll_payment_dispatch_attempt a ON a.instruction_id=i.id AND a.batch_id=l.batch_id
   LEFT JOIN LATERAL(SELECT source,result,created_at FROM payroll_payment_observation WHERE attempt_id=a.id ORDER BY id DESC LIMIT 1)o ON true
   WHERE l.batch_id=$1 ORDER BY i.employee_id`,[row.id])).rows.map(i=>({id:i.id,schedule:i.schedule||null,employeeId:Number(i.employee_id),amountCents:Number(i.amount_cents),attemptId:i.attempt_id?Number(i.attempt_id):null,status:i.result?.status||(i.attempt_id?'UNCERTAIN':'NOT_STARTED'),source:i.source,observedAt:i.observed_at,dateMatches:i.result?.dateMatches??null,reconciliationStatus:i.result?.reconciliationStatus||null,settlementStatus:i.result?.settlementStatus||null,returnEvidenceStatus:i.result?.returnEvidenceStatus||null})):[]
  const canCancel=row&&!row.cancelled_at&&row.run_status!=='FINALIZED'?(await pool.query('SELECT payroll_payment_batch_cancellable($1) AS allowed',[row.id])).rows[0].allowed:false
  res.json({success:true,data:row?{...row,status:row.cancelled_at?'CANCELLED':row.run_status==='FINALIZED'?'CLOSED':'AUTHORIZED',executionAvailable:!row.cancelled_at,canCancel,instructions}:null})
 }catch{res.status(500).json({success:false,message:'Unable to read payment authorization.'})}})
 const register=(suffix,cancel)=>app.post(`${route}${suffix}`,async(req,res)=>{
  res.setHeader('Cache-Control','no-store');const db=await pool.connect()
  try{
   const body=req.body||{},facility=req.canonicalAccess.facilityId,runId=Number(req.params.id)
   if(!Number.isSafeInteger(runId)||runId<=0||body.confirmed!==true||typeof body.reference!=='string'||body.reference.trim().length<12||body.reference.length>2000||/[\u0000-\u001f\u007f]/.test(body.reference))throw fail('Confirm the payment decision and retain a review reference.')
   await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility]);await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${facility}`])
   const run=(await db.query('SELECT id,status FROM payroll_run WHERE facility_id=$1 AND id=$2 FOR UPDATE',[facility,runId])).rows[0]
   if(!run)throw fail('Payroll run not found.',404)
   const existing=(await db.query('SELECT b.*,c.batch_id AS cancelled FROM payroll_payment_batch b LEFT JOIN payroll_payment_batch_cancellation c ON c.batch_id=b.id WHERE b.facility_id=$1 AND b.payroll_run_id=$2',[facility,runId])).rows[0]
   if(cancel){
    if(run.status==='FINALIZED')throw fail('Finalized payment authorization cannot be cancelled.',409)
    if(!existing||Number(existing.id)!==body.batchId)throw fail('Refresh the current payment authorization before cancelling.',409)
    if(existing.cancelled){await db.query('COMMIT');return res.json({success:true,data:{id:Number(existing.id),status:'CANCELLED',reused:true}})}
    if(!(await db.query('SELECT payroll_payment_batch_cancellable($1) AS allowed',[existing.id])).rows[0].allowed)throw fail('Current payment evidence does not permit cancellation. Recover provider status before further action.',409)
    await db.query('INSERT INTO payroll_payment_batch_cancellation(batch_id,reference,created_by) VALUES($1,$2,$3)',[existing.id,body.reference.trim(),req.adminId])
    await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND status='OPEN' AND dedupe_key IN (SELECT 'check-issue-'||id::text FROM payroll_check_issue WHERE batch_id=$2 UNION ALL SELECT 'check-cancel-'||id::text FROM payroll_check_issue WHERE batch_id=$2)",[facility,existing.id])
    await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id) VALUES($1,$2,'PAYMENT_AUTHORIZATION_CANCELLED','payment_batch',$3)",[facility,req.adminId,String(existing.id)])
    await db.query('COMMIT');return res.json({success:true,data:{id:Number(existing.id),status:'CANCELLED'}})
   }
   if(existing){
    if(existing.cancelled||existing.fingerprint!==body.fingerprint||existing.reference!==body.reference.trim())throw fail('A different or cancelled payment authorization exists. Review its history before proceeding.',409)
    await db.query('COMMIT');return res.json({success:true,data:{id:Number(existing.id),status:'AUTHORIZED',reused:true}})
   }
   const plan=await payrollPaymentPlan(db,facility,runId,dependencies)
   if(plan.status!=='READY_FOR_PAYMENT_REVIEW'||plan.fingerprint!==body.fingerprint)throw fail('Payment inputs changed or need review. Prepare the current payment plan before authorizing.',409)
   const batch=(await db.query('INSERT INTO payroll_payment_batch(facility_id,payroll_run_id,fingerprint,plan,reference,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[facility,runId,plan.fingerprint,JSON.stringify(plan),body.reference.trim(),req.adminId])).rows[0]
   for(const payment of plan.payments.filter(p=>p.method==='DIRECT_DEPOSIT')){
    const connection=await readPayrollPaymentConnection(db,facility,payment.readiness.connectionId),destination=await readPayrollPaymentDestination(db,facility,payment.employeeId,payment.readiness.destinationId)
    const saved=await retainPayrollPaymentInstruction(db,{facilityId:facility,runId,employeeId:payment.employeeId,mode:connection.mode,originatingAccountId:connection.originatingAccountId,receivingAccountId:destination.accountId,amountCents:payment.amountCents,paymentDate:plan.paymentDate},{actorId:Number(req.adminId)})
    await db.query('INSERT INTO payroll_payment_batch_instruction(batch_id,instruction_id) VALUES($1,$2)',[batch.id,saved.intent.id])
   }
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'PAYMENT_PLAN_AUTHORIZED','payment_batch',$3,$4)",[facility,req.adminId,String(batch.id),{runId,fingerprint:plan.fingerprint,totalCents:plan.totals.totalCents}])
   await db.query('COMMIT');res.status(201).json({success:true,data:{id:Number(batch.id),status:'AUTHORIZED',reused:false}})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to record payment authorization.'})}finally{db.release()}
 })
 register('',false);register('/cancel',true)
}
