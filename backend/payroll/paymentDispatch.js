import {refreshPaymentReturnCases} from './paymentReturnCase.js'
import {payrollPaymentPlan} from './paymentPlan.js'
import {readPayrollPaymentConnection} from './paymentConnection.js'
import {submitModernTreasuryPayment,readModernTreasuryPayment} from './modernTreasuryPayments.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})

// Internal coordinator: callers must supply the configured transport and real
// calculation dependencies. The admin route supplies the transport; scheduled recovery uses recoveryOnly and cannot submit payments.
export async function dispatchPayrollInstruction(pool,facility,batchId,instructionId,{fetcher,loadRunPreview,payrollFingerprint,actorId=null,expectedRunId,expectedFingerprint,recoveryOnly=false,scheduledRequestId=null,now=()=>new Date()}={}){
 if(typeof fetcher!=='function'||typeof loadRunPreview!=='function'||typeof payrollFingerprint!=='function')throw fail('Configured payment execution dependencies are required.',503)
 const db=await pool.connect(),lock=`payroll-payment-connection:${facility}`;let locked=false
 try{
  await db.query('BEGIN')
  await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
  // Use the same order as employee authorization. Keep the connection lock after
  // committing the claim, through the provider request and observation write.
  await db.query('SELECT pg_advisory_lock(hashtextextended($1,0))',[lock]);locked=true
  const batch=(await db.query('SELECT b.*,r.status AS run_status,c.batch_id AS cancelled FROM payroll_payment_batch b JOIN payroll_run r ON r.id=b.payroll_run_id AND r.facility_id=b.facility_id LEFT JOIN payroll_payment_batch_cancellation c ON c.batch_id=b.id WHERE b.facility_id=$1 AND b.id=$2 FOR UPDATE OF r',[facility,batchId])).rows[0]
  if(!batch)throw fail('Payment authorization not found.',404)
  if(expectedRunId!==undefined&&Number(batch.payroll_run_id)!==expectedRunId)throw fail('Payment authorization not found in this run.',404)
  if(expectedFingerprint!==undefined&&batch.fingerprint!==expectedFingerprint)throw fail('Refresh the retained payment authorization before submitting.')
  if(batch.cancelled)throw fail('Cancelled payment authorization cannot be dispatched.')
  const row=(await db.query('SELECT i.*,i.payment_date::text AS payment_day FROM payroll_payment_instruction i JOIN payroll_payment_batch_instruction l ON l.instruction_id=i.id WHERE l.batch_id=$1 AND i.id=$2 AND i.facility_id=$3 AND i.payroll_run_id=$4',[batchId,instructionId,facility,batch.payroll_run_id])).rows[0]
  if(!row)throw fail('Payment instruction not found in this authorization.',404)
  const payment=batch.plan.payments.find(p=>p.employeeId===Number(row.employee_id)&&p.method==='DIRECT_DEPOSIT')
  if(!payment||payment.amountCents!==Number(row.amount_cents))throw fail('Retained payment instruction does not match its authorized plan.')
  const intent={id:row.id,facilityId:Number(row.facility_id),runId:Number(row.payroll_run_id),employeeId:Number(row.employee_id),originatingAccountId:row.originating_account_id,receivingAccountId:row.receiving_account_id,amountCents:Number(row.amount_cents),paymentDate:row.payment_day,mode:row.mode}
  const connection=await readPayrollPaymentConnection(db,facility,payment.readiness.connectionId)
  if(connection.mode!==intent.mode||connection.originatingAccountId!==intent.originatingAccountId)throw fail('Retained employer connection does not match this instruction.')
  let attempt=(await db.query('SELECT id FROM payroll_payment_dispatch_attempt WHERE batch_id=$1 AND instruction_id=$2',[batchId,instructionId])).rows[0]
  const recovery=Boolean(attempt)
  if(!attempt){
   const schedule=(await db.query('SELECT q.*,c.schedule_id AS cancelled FROM payroll_payment_submission_schedule q LEFT JOIN payroll_payment_submission_cancellation c ON c.schedule_id=q.id WHERE q.instruction_id=$1 AND q.batch_id=$2',[instructionId,batchId])).rows[0]
   if(scheduledRequestId!==null){
    if(!schedule||Number(schedule.id)!==scheduledRequestId||schedule.cancelled||new Date(schedule.submit_at)>now())throw fail('Scheduled payment authorization changed, was cancelled, or is not due.')
    const timezone=(await db.query('SELECT timezone FROM payroll_settings WHERE facility_id=$1',[facility])).rows[0].timezone
    if(new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now())>intent.paymentDate)throw fail('The approved payment date has passed. Review the payment plan before submitting.')
   }else if(schedule&&!schedule.cancelled&&!recoveryOnly)throw fail('Cancel the scheduled submission before sending this payment manually.')
   if(recoveryOnly)throw fail('No dispatch has started for this instruction. Status recovery cannot submit payments.')
   if(batch.run_status!=='APPROVED')throw fail('Only an approved run may start a payment.')
   const current=await payrollPaymentPlan(db,facility,Number(batch.payroll_run_id),{loadRunPreview,payrollFingerprint})
   if(current.status!=='READY_FOR_PAYMENT_REVIEW'||current.fingerprint!==batch.fingerprint)throw fail('Payroll or employee payment authorization changed. No payment was submitted.')
   attempt=(await db.query('INSERT INTO payroll_payment_dispatch_attempt(batch_id,instruction_id) VALUES($1,$2) RETURNING id',[batchId,instructionId])).rows[0]
  }
  await db.query('COMMIT')
  const result=await (recovery?readModernTreasuryPayment:submitModernTreasuryPayment)(intent,{...connection,fetcher})
  // Never reacquire the settings/run locks here: another employee action may be
  // holding settings while waiting for this session-level connection lock.
  await db.query('BEGIN')
  const observation=(await db.query('INSERT INTO payroll_payment_observation(attempt_id,source,result) VALUES($1,$2,$3) RETURNING id,created_at',[attempt.id,recovery?'RECOVERY':'SUBMISSION',JSON.stringify(result)])).rows[0]
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'PAYMENT_PROVIDER_OBSERVED','payment_instruction',$3,$4)",[facility,actorId,instructionId,{batchId:Number(batchId),attemptId:Number(attempt.id),observationId:Number(observation.id),status:result.status,source:recovery?'RECOVERY':'SUBMISSION'}])
  if(['RETURNED','REVERSED','FAILED','DENIED','CANCELLED','STOPPED','UNCERTAIN','NOT_FOUND','REVIEW_REQUIRED'].includes(result.status)||['NEEDS_REVIEW','UNAVAILABLE'].includes(result.settlementStatus)){
   await db.query(`INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message)
    VALUES($1,$2,'CRITICAL','Payroll payment needs review',$3)
    ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message`,[facility,`payment-exception-${instructionId}`,`Authorization ${batchId}, employee ${row.employee_id}: ${result.status}. Review retained payment evidence before any replacement payment.`])
  }
  await refreshPaymentReturnCases(db,facility,Number(batch.payroll_run_id))
  await db.query('COMMIT')
  return {attemptId:Number(attempt.id),observationId:Number(observation.id),recovery,result}
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}
 finally{
  let destroy=false
  if(locked)try{await db.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[lock])}catch{destroy=true}
  db.release(destroy)
 }
}

export function registerPaymentDispatchRoutes(app,pool,dependencies){
 app.post('/api/admin/payroll/runs/:id/payment-authorization/:batchId/instructions/:instructionId/dispatch',async(req,res)=>{
  res.setHeader('Cache-Control','no-store')
  try{
   const runId=Number(req.params.id),batchId=Number(req.params.batchId),body=req.body||{}
   if(!Number.isSafeInteger(runId)||runId<=0||!Number.isSafeInteger(batchId)||batchId<=0||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(req.params.instructionId)||!['SUBMIT','RECOVER'].includes(body.action))throw fail('Choose a valid payment instruction and action.',400)
   if(body.action==='SUBMIT'&&(body.confirmed!==true||typeof body.fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(body.fingerprint)))throw fail('Confirm the retained employee payment amount and payment date before submitting.',400)
   const data=await dispatchPayrollInstruction(pool,req.canonicalAccess.facilityId,batchId,req.params.instructionId,{...dependencies,actorId:req.adminId,expectedRunId:runId,expectedFingerprint:body.action==='SUBMIT'?body.fingerprint:undefined,recoveryOnly:body.action==='RECOVER'})
   res.json({success:true,data})
  }catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain payment status. Refresh this authorization and recover provider status before further action.'})}
 })
}
