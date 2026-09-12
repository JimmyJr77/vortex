import {continuePayrollCancelledCheck} from './checkCancellationContinuation.js'
import {randomUUID} from 'node:crypto'
import {decryptDocument} from './onboarding.js'
import {readPayrollPaymentConnection} from './paymentConnection.js'
import {cancelPayrollDigitalCheck} from './modernTreasuryCheckCancellation.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
export async function cancelPayrollCheck(pool,facility,runId,batchId,employeeId,{fetcher,actorId=null,automatic=false,recoveryOnly=false,retry=false,expectedSubmissionId,expectedCheckObservationId,reference,confirmed=false}={}){
 if(automatic&&(!recoveryOnly||retry))throw fail('Automatic cancellation can only recover a retained request.',400)
 const db=await pool.connect(),lock=`payroll-payment-connection:${facility}`;let locked=false
 try{
  await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility]);await db.query('SELECT pg_advisory_lock(hashtextextended($1,0))',[lock]);locked=true
  const issue=(await db.query('SELECT * FROM payroll_check_issue WHERE facility_id=$1 AND payroll_run_id=$2 AND batch_id=$3 AND employee_id=$4',[facility,runId,batchId,employeeId])).rows[0]
  if(!issue)throw fail('Issued check not found.',404)
  let claim=(await db.query('SELECT * FROM payroll_check_cancellation WHERE issue_id=$1',[issue.id])).rows[0]
  if((await db.query('SELECT 1 FROM payroll_payment_batch_cancellation WHERE batch_id=$1',[batchId])).rowCount){await db.query('COMMIT');return {id:claim?.id||null,status:'AUTHORIZATION_CANCELLED',recovery:true}}
  let recovery=!!claim,retryId=null
  if(retry){
   if(!claim||recoveryOnly)throw fail('Choose an existing cancellation to retry.',400)
   if(confirmed!==true||!Number.isSafeInteger(actorId)||typeof reference!=='string'||reference.trim().length<12||reference.length>2000||/[\u0000-\u001f\u007f]/.test(reference))throw fail('Confirm the retry and retain its review reference.',400)
   const current=(await db.query("SELECT payroll_check_cancel_retryable($1) AS ready,(SELECT max(id) FROM payroll_check_cancellation_observation WHERE cancellation_id=$1 AND source='SUBMISSION') AS submission_id,(SELECT max(id) FROM payroll_check_issue_observation WHERE issue_id=$2) AS check_id",[claim.id,issue.id])).rows[0]
   if(!current.ready||String(expectedSubmissionId)!==String(current.submission_id)||String(expectedCheckObservationId)!==String(current.check_id))throw fail('Refresh and review current evidence proving no cancellation update was sent before retrying.')
   retryId=randomUUID();await db.query('INSERT INTO payroll_check_cancellation_retry(id,cancellation_id,prior_submission_id,source_observation_id,reference,created_by) VALUES($1,$2,$3,$4,$5,$6)',[retryId,claim.id,current.submission_id,current.check_id,reference.trim(),actorId]);recovery=false
  }
  if(!claim){
   if(recoveryOnly)throw fail('No provider check cancellation has started.')
   if(confirmed!==true||!Number.isSafeInteger(actorId)||typeof reference!=='string'||reference.trim().length<12||reference.length>2000||/[\u0000-\u001f\u007f]/.test(reference))throw fail('Confirm the original check cancellation and retain its review reference.',400)
   if(!(await db.query('SELECT payroll_check_cancel_reviewable($1) AS ready',[issue.id])).rows[0].ready)throw fail('Recover the current unprocessed check before cancellation. Sent, paid or delivered checks need their separate recovery workflow.')
   const source=(await db.query('SELECT id,result FROM payroll_check_issue_observation WHERE issue_id=$1 ORDER BY id DESC LIMIT 1',[issue.id])).rows[0]
   claim=(await db.query('INSERT INTO payroll_check_cancellation(id,issue_id,provider_id,source_observation_id,reference,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[randomUUID(),issue.id,source.result.providerId,source.id,reference.trim(),actorId])).rows[0]
  }
  const intent=JSON.parse(decryptDocument(issue.encrypted_intent,`payroll-check-issue:${facility}:${runId}:${employeeId}`).toString()),connection=await readPayrollPaymentConnection(db,facility,issue.connection_id)
  if(connection.mode!==intent.mode||connection.originatingAccountId!==intent.originatingAccountId)throw fail('Retained check funding changed.')
  await db.query('COMMIT')
  const result=await cancelPayrollDigitalCheck(intent,{id:claim.id,providerId:claim.provider_id},{...connection,fetcher},{allowCancel:!recovery})
  await db.query('BEGIN')
  const observed=(await db.query('INSERT INTO payroll_check_cancellation_observation(cancellation_id,source,result,retry_id) VALUES($1,$2,$3,$4) RETURNING id',[claim.id,recovery?'RECOVERY':'SUBMISSION',result,retryId])).rows[0]
  await db.query('INSERT INTO payroll_check_issue_observation(issue_id,source,result) VALUES($1,$2,$3)',[issue.id,recovery?'RECOVERY':'SUBMISSION',result.payment||{status:'UNCERTAIN'}])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'CHECK_CANCELLATION_OBSERVED','check_cancellation',$3,$4)",[facility,actorId,claim.id,{observationId:Number(observed.id),employeeId,status:result.status,source:recovery?'RECOVERY':'SUBMISSION',automatic,retryId,requestSent:result.requestSent}])
  await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'CRITICAL','Payroll check cancellation needs follow-up',$3) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message",[facility,`check-cancel-${issue.id}`,`Employee ${employeeId}: ${result.status}. Recover cancellation before reviewing unpaid wages or rebuilding payroll.`])
  if((await db.query('SELECT 1 FROM payroll_check_cancellation_continuation WHERE cancellation_id=$1',[claim.id])).rowCount&&!(await db.query('SELECT payroll_check_cancellation_blocks($1) AS blocked',[issue.id])).rows[0].blocked)await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key=$2",[facility,`check-cancel-${issue.id}`])
  await db.query('COMMIT');return {id:claim.id,status:result.status,recovery,retryId}
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{let destroy=false;if(locked)try{await db.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[lock])}catch{destroy=true}db.release(destroy)}
}
export function registerCheckCancellationRoutes(app,pool,{fetcher}={}){
 const path='/api/admin/payroll/runs/:id/payment-authorization/:batchId/checks/:employeeId/cancellation'
 const scope=req=>{const [runId,batchId,employeeId]=[req.params.id,req.params.batchId,req.params.employeeId].map(Number);if(![runId,batchId,employeeId].every(v=>Number.isSafeInteger(v)&&v>0))throw fail('Choose an issued check.',400);return {facility:req.canonicalAccess.facilityId,runId,batchId,employeeId}}
 app.get(path,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{
  const {facility,runId,batchId,employeeId}=scope(req),row=(await pool.query("SELECT c.id,c.reference,c.created_at,o.id AS cancellation_observation_id,o.result,payroll_check_cancel_continuable(c.id) AS can_continue,(SELECT jsonb_build_object('reference',v.reference,'createdAt',v.created_at,'current',NOT payroll_check_cancellation_blocks(i.id)) FROM payroll_check_cancellation_continuation v WHERE v.cancellation_id=c.id) AS continuation,payroll_check_cancel_retryable(c.id) AS can_retry,(SELECT max(id) FROM payroll_check_cancellation_observation WHERE cancellation_id=c.id AND source='SUBMISSION') AS submission_id,(SELECT max(id) FROM payroll_check_issue_observation WHERE issue_id=i.id) AS check_id,(SELECT COALESCE(jsonb_agg(jsonb_build_object('id',t.id,'reference',t.reference,'createdAt',t.created_at,'status',COALESCE(x.result->>'status','UNCERTAIN')) ORDER BY t.created_at,t.id),'[]'::jsonb) FROM payroll_check_cancellation_retry t LEFT JOIN payroll_check_cancellation_observation x ON x.retry_id=t.id WHERE t.cancellation_id=c.id) AS retries,payroll_check_cancel_reviewable(i.id) AS can_request,payroll_check_provider_cancelled(i.id) AS ready FROM payroll_check_issue i LEFT JOIN payroll_check_cancellation c ON c.issue_id=i.id LEFT JOIN LATERAL(SELECT id,result FROM payroll_check_cancellation_observation WHERE cancellation_id=c.id ORDER BY id DESC LIMIT 1)o ON true WHERE i.facility_id=$1 AND i.payroll_run_id=$2 AND i.batch_id=$3 AND i.employee_id=$4",[facility,runId,batchId,employeeId])).rows[0]
  if(!row)throw fail('Issued check not found.',404)
  res.json({success:true,data:{canRequest:!row.id&&row.can_request,readyToRelease:row.ready,canContinue:row.can_continue,continuation:row.continuation,continuationReview:row.can_continue?{cancellationObservationId:row.cancellation_observation_id,checkObservationId:row.check_id}:null,canRetry:row.can_retry,retryReview:row.can_retry?{submissionId:row.submission_id,checkObservationId:row.check_id}:null,retries:row.retries,request:row.id?{id:row.id,reference:row.reference,createdAt:row.created_at,status:row.result?.status||'UNCERTAIN'}:null}})
 }catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to review provider check cancellation.'})}})
 app.post(`${path}/continue`,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{const {facility,runId,batchId,employeeId}=scope(req);res.json({success:true,data:await continuePayrollCancelledCheck(pool,facility,runId,batchId,employeeId,req.body,{actorId:req.adminId})})}catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain the original-check review.'})}})
 app.post(path,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{const {facility,runId,batchId,employeeId}=scope(req),body=req.body||{};if(!['SUBMIT','RECOVER','RETRY'].includes(body.action))throw fail('Choose cancellation submission or recovery.',400);res.json({success:true,data:await cancelPayrollCheck(pool,facility,runId,batchId,employeeId,{fetcher,actorId:req.adminId,recoveryOnly:body.action==='RECOVER',retry:body.action==='RETRY',expectedSubmissionId:body.expectedSubmissionId,expectedCheckObservationId:body.expectedCheckObservationId,reference:body.reference,confirmed:body.confirmed})})}catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain cancellation. Recover the existing request before further action.'})}})
}
