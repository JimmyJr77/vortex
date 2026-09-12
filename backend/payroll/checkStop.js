import {currentCheckStopAttempt} from './checkStopAttempt.js'
import {refreshCheckStopCases} from './checkStopCase.js'
import {releasePayrollCheckStop} from './checkStopRelease.js'
import {randomUUID} from 'node:crypto'
import {decryptDocument} from './onboarding.js'
import {readPayrollPaymentConnection} from './paymentConnection.js'
import {readPayrollDigitalCheck} from './modernTreasuryChecks.js'
import {resolvePayrollCheckStop} from './modernTreasuryCheckStop.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
export async function stopPayrollCheck(pool,facility,runId,batchId,employeeId,{fetcher,actorId=null,automatic=false,recoveryOnly=false,retry=false,renewal=false,expectedReleaseId,expectedObservationId,originalCheckUnavailable=false,reference,confirmed=false,stopPaymentsEnabled=false}={}){
 if(automatic&&(!recoveryOnly||retry||renewal))throw fail('Automatic stop processing can only recover a retained request.',400)
 const db=await pool.connect(),lock=`payroll-payment-connection:${facility}`;let locked=false
 try{
  await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility]);await db.query('SELECT pg_advisory_lock(hashtextextended($1,0))',[lock]);locked=true
  const issue=(await db.query('SELECT * FROM payroll_check_issue WHERE facility_id=$1 AND payroll_run_id=$2 AND batch_id=$3 AND employee_id=$4',[facility,runId,batchId,employeeId])).rows[0]
  if(!issue)throw fail('Issued check not found.',404)
  const intent=JSON.parse(decryptDocument(issue.encrypted_intent,`payroll-check-issue:${facility}:${runId}:${employeeId}`).toString()),connection=await readPayrollPaymentConnection(db,facility,issue.connection_id)
  if(connection.mode!==intent.mode||connection.originatingAccountId!==intent.originatingAccountId)throw fail('Retained check funding changed.')
  let claim=(await db.query('SELECT * FROM payroll_check_stop WHERE issue_id=$1',[issue.id])).rows[0]
  let recovery=!!claim
  if(retry||renewal){
   if(!claim||recoveryOnly)throw fail('Choose an existing failed stop to retry.',400)
   if(!Number.isSafeInteger(actorId)||confirmed!==true||originalCheckUnavailable!==true||stopPaymentsEnabled!==true||typeof reference!=='string'||reference.trim().length<12||reference.length>2000||/[\u0000-\u001f\u007f]/.test(reference))throw fail('Confirm the unavailable original, bank support and retry review reference.',400)
   const source=(await db.query('SELECT id,result,CASE WHEN $2::boolean THEN payroll_check_stop_renewable(stop_id) ELSE payroll_check_stop_retryable(stop_id) END AS ready,payroll_check_stop_current_release(stop_id) AS release_id FROM payroll_check_stop_observation WHERE stop_id=$1 ORDER BY id DESC LIMIT 1',[claim.id,renewal])).rows[0]
   if(!source?.ready||String(source.id)!==String(expectedObservationId)||(renewal&&String(source.release_id)!==String(expectedReleaseId)))throw fail('Refresh and review the current failed stop before another request.')
   await db.query('INSERT INTO payroll_check_stop_retry(id,stop_id,prior_observation_id,prior_action_id,reference,created_by,prior_release_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),claim.id,source.id,source.result.actionId||null,reference.trim(),actorId,renewal?source.release_id:null]);recovery=false
  }
  if(!claim){
   if(recoveryOnly)throw fail('No stop request has started.')
   if(!Number.isSafeInteger(actorId)||confirmed!==true||stopPaymentsEnabled!==true||typeof reference!=='string'||reference.trim().length<12||reference.length>2000||/[\u0000-\u001f\u007f]/.test(reference))throw fail('Confirm the stop request, bank stop-payment support and review reference.',400)
   const first=(await db.query("SELECT result->>'providerId' AS id FROM payroll_check_issue_observation WHERE issue_id=$1 AND result->>'providerId' IS NOT NULL ORDER BY id LIMIT 1",[issue.id])).rows[0]
   const payment=await readPayrollDigitalCheck(intent,{...connection,fetcher})
   await db.query("INSERT INTO payroll_check_issue_observation(issue_id,source,result) VALUES($1,'RECOVERY',$2)",[issue.id,payment])
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'CHECK_STOP_PREFLIGHT_OBSERVED','check_issue',$3,$4)",[facility,actorId,issue.id,{status:payment.status,employeeId}])
   if(!first||payment.providerId!==first.id||!(await db.query('SELECT payroll_check_stop_initial_ready($1) AS ready',[issue.id])).rows[0].ready){await db.query('COMMIT');throw fail('Recover the original sent check and resolve earlier paid or conflicting evidence before requesting a stop.')}
   claim=(await db.query('INSERT INTO payroll_check_stop(id,issue_id,provider_id,reference,created_by) VALUES($1,$2,$3,$4,$5) RETURNING *',[randomUUID(),issue.id,first.id,reference.trim(),actorId])).rows[0]
  }
  const attempt=await currentCheckStopAttempt(db,claim.id)
  await db.query('COMMIT')
  let result=await resolvePayrollCheckStop(intent,{id:attempt.id,providerId:claim.provider_id},{...connection,fetcher,stopPaymentsEnabled:true},{allowCreate:!recovery,priorActions:attempt.priorActions})
  await db.query('BEGIN')
  if(attempt.actionId&&result.actionId&&result.actionId!==attempt.actionId)result={...result,status:'NEEDS_REVIEW'}
  await db.query('INSERT INTO payroll_check_stop_observation(stop_id,source,result,retry_id) VALUES($1,$2,$3,$4)',[claim.id,recovery?'RECOVERY':'SUBMISSION',result,attempt.retryId])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'CHECK_STOP_OBSERVED','check_stop',$3,$4)",[facility,actorId,claim.id,{status:result.status,employeeId,automatic,retryId:attempt.retryId,requestSent:result.requestSent,source:recovery?'RECOVERY':'SUBMISSION'}])
  await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'CRITICAL','Payroll check stop requires follow-up',$3) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message",[facility,`check-stop-${issue.id}`,`Employee ${employeeId}: ${result.status}. Review unpaid wages and stop evidence before any replacement.`])
  if(!(await db.query('SELECT payroll_check_stop_blocks($1) AS blocked',[issue.id])).rows[0].blocked)await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key=$2",[facility,`check-stop-${issue.id}`])
  await refreshCheckStopCases(db,facility,runId)
  await db.query('COMMIT');return {id:claim.id,status:result.status,recovery,retryId:attempt.retryId}
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{let destroy=false;if(locked)try{await db.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[lock])}catch{destroy=true}db.release(destroy)}
}
export function registerCheckStopRoutes(app,pool,{fetcher}={}){
 const path='/api/admin/payroll/runs/:id/payment-authorization/:batchId/checks/:employeeId/stop'
 const scope=req=>{const [runId,batchId,employeeId]=[req.params.id,req.params.batchId,req.params.employeeId].map(Number);if(![runId,batchId,employeeId].every(v=>Number.isSafeInteger(v)&&v>0))throw fail('Choose an issued check.',400);return {facility:req.canonicalAccess.facilityId,runId,batchId,employeeId}}
 app.get(path,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{const {facility,runId,batchId,employeeId}=scope(req);const row=(await pool.query("SELECT s.id,s.created_at,o.id AS observation_id,o.result,payroll_check_stop_retryable(s.id) AS can_retry,payroll_check_stop_renewable(s.id) AS can_renew,NOT payroll_check_original_unpaid_history(i.id) AS history_block,payroll_check_stop_continuable(s.id) AS can_continue,(payroll_check_stop_retryable(s.id) AND payroll_check_stop_no_action_original_current(s.id)) AS can_continue_no_send,(SELECT COALESCE(jsonb_agg(jsonb_build_object('id',t.id,'reference',t.reference,'createdAt',t.created_at,'priorReleaseId',t.prior_release_id) ORDER BY t.sequence),'[]'::jsonb) FROM payroll_check_stop_retry t WHERE t.stop_id=s.id) AS retries,(SELECT COALESCE(jsonb_agg(jsonb_build_object('id',x.id,'reference',x.reference,'createdAt',x.created_at) ORDER BY x.id),'[]'::jsonb) FROM payroll_check_stop_release x WHERE x.stop_id=s.id) AS continuations,r.id AS release_id,r.created_at AS released_at,payroll_check_stop_blocks(i.id) AS blocking FROM payroll_check_issue i LEFT JOIN payroll_check_stop s ON s.issue_id=i.id LEFT JOIN payroll_check_stop_release r ON r.id=payroll_check_stop_current_release(s.id) LEFT JOIN LATERAL(SELECT id,result FROM payroll_check_stop_observation WHERE stop_id=s.id ORDER BY id DESC LIMIT 1)o ON true WHERE i.facility_id=$1 AND i.payroll_run_id=$2 AND i.batch_id=$3 AND i.employee_id=$4",[facility,runId,batchId,employeeId])).rows[0];if(!row)throw fail('Issued check not found.',404);res.json({success:true,data:row.id?{id:row.id,status:row.result?.status||'UNCERTAIN',createdAt:row.created_at,releasedAt:row.released_at,blocking:row.blocking,canRetry:row.can_retry,canRenew:row.can_renew,currentReleaseId:row.release_id,continuations:row.continuations,historyBlock:row.history_block,canContinue:row.can_continue,canContinueNoSend:row.can_continue_no_send,retryKind:row.can_retry?(row.result?.status==='NOT_FOUND'?'NOT_TRANSMITTED':'FAILED_ACTION'):null,observationId:row.observation_id,retries:row.retries}:null})}catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to read check stop status.'})}})
 app.post(`${path}/release`,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{const {facility,runId,batchId,employeeId}=scope(req);res.json({success:true,data:await releasePayrollCheckStop(pool,facility,runId,batchId,employeeId,req.body,{fetcher,actorId:req.adminId})})}catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain the stop disposition.'})}})
 app.post(path,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{const {facility,runId,batchId,employeeId}=scope(req),body=req.body||{};if(!['SUBMIT','RECOVER','RETRY','RENEW'].includes(body.action))throw fail('Choose stop submission or recovery.',400);res.json({success:true,data:await stopPayrollCheck(pool,facility,runId,batchId,employeeId,{fetcher,actorId:req.adminId,recoveryOnly:body.action==='RECOVER',retry:body.action==='RETRY',renewal:body.action==='RENEW',expectedReleaseId:body.expectedReleaseId,expectedObservationId:body.expectedObservationId,originalCheckUnavailable:body.originalCheckUnavailable,reference:body.reference,confirmed:body.confirmed,stopPaymentsEnabled:body.stopPaymentsEnabled})})}catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to confirm the check stop. Recover this request before further payment action.'})}})
}
