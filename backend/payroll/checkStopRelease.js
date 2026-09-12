import {currentCheckStopAttempt} from './checkStopAttempt.js'
import {decryptDocument} from './onboarding.js'
import {readPayrollPaymentConnection} from './paymentConnection.js'
import {digitalCheckInstruction} from './modernTreasuryChecks.js'
import {resolvePayrollCheckStop} from './modernTreasuryCheckStop.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
export async function releasePayrollCheckStop(pool,facility,runId,batchId,employeeId,body,{fetcher,actorId}={}){
 if(!Number.isSafeInteger(actorId)||body?.confirmed!==true||body.originalCheckAvailable!==true||typeof body.reference!=='string'||body.reference.trim().length<12||body.reference.length>2000||/[\u0000-\u001f\u007f]/.test(body.reference))throw fail('Confirm the original check is available, no replacement was issued, and retain the review reference.',400)
 const db=await pool.connect(),lock=`payroll-payment-connection:${facility}`;let locked=false
 try{
  await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility]);await db.query('SELECT pg_advisory_lock(hashtextextended($1,0))',[lock]);locked=true
  const row=(await db.query('SELECT i.*,s.id AS stop_id,s.provider_id FROM payroll_check_issue i JOIN payroll_check_stop s ON s.issue_id=i.id WHERE i.facility_id=$1 AND i.payroll_run_id=$2 AND i.batch_id=$3 AND i.employee_id=$4',[facility,runId,batchId,employeeId])).rows[0]
  if(!row)throw fail('Check stop request not found.',404)
  const existing=(await db.query('SELECT * FROM payroll_check_stop_release WHERE id=payroll_check_stop_current_release($1)',[row.stop_id])).rows[0]
  if(existing){if(existing.reference!==body.reference.trim())throw fail('This stop disposition is already retained with another reference.');await db.query('COMMIT');return {reused:true,releasedAt:existing.created_at}}
  if(!(await db.query('SELECT payroll_check_stop_continuable($1) AS ready',[row.stop_id])).rows[0].ready)throw fail('Recover current unpaid original-check evidence and resolve earlier paid or conflicting history before continuing this check.')
  const intent=JSON.parse(decryptDocument(row.encrypted_intent,`payroll-check-issue:${facility}:${runId}:${employeeId}`).toString()),connection=await readPayrollPaymentConnection(db,facility,row.connection_id)
  if(Date.parse(digitalCheckInstruction(intent).expires_at)<=Date.now())throw fail('The original check has expired and requires separate remediation.')
  if(connection.mode!==intent.mode||connection.originatingAccountId!==intent.originatingAccountId)throw fail('Retained check funding changed.')
  const attempt=await currentCheckStopAttempt(db,row.stop_id)
  if(!attempt.actionId){const review=(await db.query('SELECT id,payroll_check_stop_retryable(stop_id) AND payroll_check_stop_no_action_original_current(stop_id) AS ready FROM payroll_check_stop_observation WHERE stop_id=$1 ORDER BY id DESC LIMIT 1',[row.stop_id])).rows[0];if(!review?.ready||String(review.id)!==String(body.expectedObservationId))throw fail('Refresh and review current proof that this stop was never sent.')}
  const result=await resolvePayrollCheckStop(intent,{id:attempt.id,providerId:row.provider_id},{...connection,fetcher},{priorActions:attempt.priorActions})
  const observation=(await db.query("INSERT INTO payroll_check_stop_observation(stop_id,source,result,retry_id) VALUES($1,'RECOVERY',$2,$3) RETURNING id",[row.stop_id,result,attempt.retryId])).rows[0]
  if(result.checkStatus!=='SENT'||(attempt.actionId?(!['FAILED','CANCELLED'].includes(result.status)||result.actionId!==attempt.actionId):result.status!=='NOT_FOUND')||!(await db.query('SELECT payroll_check_stop_continuable($1) AS ready',[row.stop_id])).rows[0].ready){await db.query('COMMIT');throw fail('Recovered check evidence does not permit continuing the original. Review the retained stop and payment history.')}
  const saved=(await db.query('INSERT INTO payroll_check_stop_release(stop_id,source_observation_id,action_id,reference,created_by) VALUES($1,$2,$3,$4,$5) RETURNING created_at',[row.stop_id,observation.id,result.actionId||null,body.reference.trim(),actorId])).rows[0]
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'CHECK_STOP_RELEASED','check_stop',$3,$4)",[facility,actorId,row.stop_id,{employeeId,originalCheckAvailable:true,noReplacementIssued:true}])
  await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key=$2",[facility,`check-stop-${row.id}`])
  await db.query('COMMIT');return {reused:false,releasedAt:saved.created_at}
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{let destroy=false;if(locked)try{await db.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[lock])}catch{destroy=true}db.release(destroy)}
}
