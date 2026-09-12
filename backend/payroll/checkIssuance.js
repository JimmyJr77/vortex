import {refreshCheckStopCases} from './checkStopCase.js'
import {randomUUID} from 'node:crypto'
import {encryptDocument,decryptDocument} from './onboarding.js'
import {checkIssuancePlan} from './checkIssuancePlan.js'
import {readPayrollPaymentConnection} from './paymentConnection.js'
import {digitalCheckInstruction,submitPayrollDigitalCheck,readPayrollDigitalCheck} from './modernTreasuryChecks.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const context=row=>`payroll-check-issue:${row.facility_id}:${row.payroll_run_id}:${row.employee_id}`
export async function issuePayrollCheck(pool,facility,runId,batchId,employeeId,{fetcher,loadRunPreview,payrollFingerprint,now=()=>new Date(),actorId=null,automatic=false,recoveryOnly=false,fingerprint,reference,noPriorPaymentConfirmed=false}={}){
 if(typeof fetcher!=='function')throw fail('Configured check transport is required.',503)
 const db=await pool.connect(),lock=`payroll-payment-connection:${facility}`;let locked=false
 try{
  await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility]);await db.query('SELECT pg_advisory_lock(hashtextextended($1,0))',[lock]);locked=true
  if(!(await db.query('SELECT id FROM payroll_run WHERE id=$1 AND facility_id=$2 FOR UPDATE',[runId,facility])).rowCount)throw fail('Payroll run not found.',404)
  let row=(await db.query('SELECT * FROM payroll_check_issue WHERE batch_id=$1 AND facility_id=$2 AND payroll_run_id=$3 AND employee_id=$4',[batchId,facility,runId,employeeId])).rows[0]
  if(row&&(await db.query('SELECT 1 FROM payroll_payment_batch_cancellation WHERE batch_id=$1',[batchId])).rowCount){await db.query('COMMIT');return {id:row.id,recovery:true,status:(await db.query('SELECT 1 FROM payroll_check_cancellation WHERE issue_id=$1',[row.id])).rowCount?'CANCELLED_AT_PROVIDER':'CANCELLED_BEFORE_SUBMISSION'}}
  const recovery=Boolean(row)
  let intent
  if(row)intent=JSON.parse(decryptDocument(row.encrypted_intent,context(row)).toString())
  else{
   if(recoveryOnly)throw fail('No check issuance has started. Recovery cannot create a check.')
   if(noPriorPaymentConfirmed!==true||typeof reference!=='string'||reference.trim().length<12||reference.length>2000||/[\u0000-\u001f\u007f]/.test(reference))throw fail('Retain the check issuance and no-prior-payment review reference.',400)
   const plan=await checkIssuancePlan(db,facility,runId,batchId,employeeId,{loadRunPreview,payrollFingerprint,now})
   if(plan.status!=='READY_FOR_CHECK_REVIEW'||plan.fingerprint!==fingerprint)throw fail('Check review changed or needs attention. Refresh before issuing.')
   const id=randomUUID(),b=plan.basis;intent={...b,id,noPriorPaymentConfirmed:true};digitalCheckInstruction(intent)
   row=(await db.query('INSERT INTO payroll_check_issue(id,batch_id,facility_id,payroll_run_id,employee_id,connection_id,configuration_id,payee_id,amount_cents,payment_date,review_fingerprint,encrypted_intent,reference,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *',[id,batchId,facility,runId,employeeId,b.connectionId,b.configurationId,b.payeeId,b.amountCents,b.paymentDate,fingerprint,encryptDocument(Buffer.from(JSON.stringify(intent)),context({facility_id:facility,payroll_run_id:runId,employee_id:employeeId})),reference.trim(),actorId])).rows[0]
  }
  const connection=await readPayrollPaymentConnection(db,facility,row.connection_id)
  if(connection.mode!==intent.mode||connection.originatingAccountId!==intent.originatingAccountId)throw fail('Retained check funding does not match its connection.')
  const timezone=(await db.query('SELECT timezone FROM payroll_settings WHERE facility_id=$1',[facility])).rows[0].timezone
  await db.query('COMMIT')
  const configuration={...connection,fetcher,timezone,digitalChecksEnabled:true}
  let result=recovery?await readPayrollDigitalCheck(intent,configuration):await submitPayrollDigitalCheck(intent,configuration,{allowCreate:true,now})
  await db.query('BEGIN')
  const first=(await db.query("SELECT result->>'providerId' AS provider_id FROM payroll_check_issue_observation WHERE issue_id=$1 AND result->>'providerId' IS NOT NULL ORDER BY id LIMIT 1",[row.id])).rows[0]
  if(first&&result.providerId&&first.provider_id!==result.providerId)result={...result,status:'REVIEW_REQUIRED',settlementStatus:'NEEDS_REVIEW',identityMatches:false}
  const observation=(await db.query('INSERT INTO payroll_check_issue_observation(issue_id,source,result) VALUES($1,$2,$3) RETURNING id',[row.id,recovery?'RECOVERY':'SUBMISSION',result])).rows[0]
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'CHECK_ISSUANCE_OBSERVED','check_issue',$3,$4)",[facility,actorId,row.id,{batchId,employeeId,observationId:Number(observation.id),status:result.status,source:recovery?'RECOVERY':'SUBMISSION',automatic,noPriorPaymentConfirmed:intent.noPriorPaymentConfirmed===true}])
  if(!['SENT','PROCESSING','COMPLETED','PROVIDER_APPROVED','AWAITING_PROVIDER_APPROVAL'].includes(result.status)||result.dateMatches===false||result.expiryMatches===false||['NEEDS_REVIEW','UNAVAILABLE'].includes(result.settlementStatus))await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'CRITICAL','Payroll check needs review',$3) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message",[facility,`check-issue-${row.id}`,`Employee ${employeeId}: ${result.status}. Recover the retained check before further payment action.`])
  if(recovery&&['SENT','PROCESSING','COMPLETED','PROVIDER_APPROVED','AWAITING_PROVIDER_APPROVAL'].includes(result.status)&&result.dateMatches===true&&result.expiryMatches===true&&!['NEEDS_REVIEW','UNAVAILABLE','EXCEPTION'].includes(result.settlementStatus))await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[facility,`check-issue-${row.id}`])
  await refreshCheckStopCases(db,facility,runId)
  await db.query('COMMIT');return {id:row.id,recovery,status:result.status}
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{let destroy=false;if(locked)try{await db.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[lock])}catch{destroy=true}db.release(destroy)}
}
export function registerCheckIssuanceRoutes(app,pool,dependencies){
 const path='/api/admin/payroll/runs/:id/payment-authorization/:batchId/checks/:employeeId/issue'
 const scope=req=>{const [runId,batchId,employeeId]=[req.params.id,req.params.batchId,req.params.employeeId].map(Number);if(![runId,batchId,employeeId].every(v=>Number.isSafeInteger(v)&&v>0))throw fail('Choose a payroll check.',400);return {runId,batchId,employeeId,facility:req.canonicalAccess.facilityId}}
 app.get(path,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{
  const {runId,batchId,employeeId,facility}=scope(req)
  if(!(await pool.query('SELECT id FROM payroll_payment_batch WHERE id=$1 AND facility_id=$2 AND payroll_run_id=$3',[batchId,facility,runId])).rowCount)throw fail('Payment authorization not found.',404)
  const row=(await pool.query('SELECT i.id,i.amount_cents,i.payment_date::text,i.created_at,EXISTS(SELECT 1 FROM payroll_check_cancellation WHERE issue_id=i.id) AS provider_cancellation,EXISTS(SELECT 1 FROM payroll_payment_batch_cancellation WHERE batch_id=i.batch_id) AS cancelled,payroll_check_preflight_blocked(i.id) AS preflight_blocked,payroll_check_preflight_cancellable(i.id) AS preflight_cancellable,o.source,o.result FROM payroll_check_issue i LEFT JOIN LATERAL(SELECT source,result FROM payroll_check_issue_observation WHERE issue_id=i.id ORDER BY id DESC LIMIT 1)o ON true WHERE i.batch_id=$1 AND i.facility_id=$2 AND i.payroll_run_id=$3 AND i.employee_id=$4',[batchId,facility,runId,employeeId])).rows[0]
  res.json({success:true,data:row?{id:row.id,amountCents:Number(row.amount_cents),paymentDate:row.payment_date,createdAt:row.created_at,status:row.cancelled?(row.provider_cancellation?'CANCELLED_AT_PROVIDER':'CANCELLED_BEFORE_SUBMISSION'):row.result?.status||'UNCERTAIN',dateMatches:row.result?.dateMatches??null,expiryMatches:row.result?.expiryMatches??null,settlementStatus:row.result?.settlementStatus||null,source:row.source,hasCancellation:row.provider_cancellation,preflightStatus:row.cancelled?null:row.preflight_cancellable?'READY_TO_CANCEL':row.preflight_blocked?'RECOVERY_REQUIRED':null}:null})
 }catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to read retained check.'})}})
 app.post(path,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{
  const {runId,batchId,employeeId,facility}=scope(req),b=req.body||{}
  if(!['SUBMIT','RECOVER'].includes(b.action)||(b.action==='SUBMIT'&&(b.confirmed!==true||b.noPriorPaymentConfirmed!==true||typeof b.fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(b.fingerprint))))throw fail('Confirm the reviewed check and that no earlier payment has been issued for these wages.',400)
  res.json({success:true,data:await issuePayrollCheck(pool,facility,runId,batchId,employeeId,{...dependencies,actorId:req.adminId,recoveryOnly:b.action==='RECOVER',fingerprint:b.fingerprint,reference:b.reference,noPriorPaymentConfirmed:b.noPriorPaymentConfirmed})})
 }catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain check status. Recover this check before any further payment action.'})}})
}
