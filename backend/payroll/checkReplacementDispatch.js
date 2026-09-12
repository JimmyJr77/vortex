import {retainCheckReplacementAchReceipt} from './checkReplacementAchReceipt.js'
import {refreshCheckStopCases} from './checkStopCase.js'
import {checkReplacementAuthorizationPlan,checkReplacementContext} from './checkReplacementAuthorization.js'
import {decryptDocument} from './onboarding.js'
import {readPayrollPaymentConnection} from './paymentConnection.js'
import {submitModernTreasuryPayment,readModernTreasuryPayment} from './modernTreasuryPayments.js'
import {submitPayrollDigitalCheck,readPayrollDigitalCheck} from './modernTreasuryChecks.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
export async function dispatchCheckReplacement(pool,facility,runId,batchId,employeeId,id,{fetcher,actorId=null,recoveryOnly=false,automatic=false,now=()=>new Date()}={}){
 if(typeof fetcher!=='function')throw fail('Configured payment transport is required.',503)
 const db=await pool.connect(),lock=`payroll-payment-connection:${facility}`;let locked=false
 try{
  await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility]);await db.query('SELECT pg_advisory_lock(hashtextextended($1,0))',[lock]);locked=true
  const row=(await db.query(`SELECT a.*,c.authorization_id AS cancelled,t.authorization_id AS claimed FROM payroll_check_replacement_authorization a JOIN payroll_check_issue i ON i.id=a.issue_id LEFT JOIN payroll_check_replacement_cancellation c ON c.authorization_id=a.id LEFT JOIN payroll_check_replacement_claim t ON t.authorization_id=a.id WHERE a.id=$1 AND i.facility_id=$2 AND i.payroll_run_id=$3 AND i.batch_id=$4 AND i.employee_id=$5`,[id,facility,runId,batchId,employeeId])).rows[0]
  if(!row)throw fail('Replacement authorization not found.',404)
  if(row.cancelled)throw fail('Replacement authorization is cancelled.')
  const recovery=Boolean(row.claimed),intent=JSON.parse(decryptDocument(row.encrypted_intent,checkReplacementContext(id)).toString())
  if(!recovery){
   if(recoveryOnly)throw fail('No replacement dispatch has started. Recovery cannot create a payment.')
   const plan=await checkReplacementAuthorizationPlan(db,facility,runId,batchId,employeeId,{now,dispatchAuthorizationId:id})
   if(!plan.canAuthorize||plan.fingerprint!==row.basis_fingerprint||plan.reviewId!==Number(row.review_id))throw fail('Replacement review, stopped-check evidence or payment setup changed. Cancel the unstarted authorization and review again.')
  }
  const connection=await readPayrollPaymentConnection(db,facility,intent.connectionId)
  if(connection.mode!==intent.mode||connection.originatingAccountId!==intent.originatingAccountId)throw fail('Retained funding does not match this replacement.')
  const timezone=(await db.query('SELECT timezone FROM payroll_settings WHERE facility_id=$1',[facility])).rows[0].timezone
  if(!recovery)await db.query('INSERT INTO payroll_check_replacement_claim(authorization_id,created_by) VALUES($1,$2)',[id,actorId])
  await db.query('COMMIT')
  const config={...connection,fetcher,timezone,digitalChecksEnabled:true}
  let result=intent.method==='CHECK'?await (recovery?readPayrollDigitalCheck(intent,config):submitPayrollDigitalCheck(intent,config,{allowCreate:true,now})):await (recovery?readModernTreasuryPayment:submitModernTreasuryPayment)(intent,config)
  await db.query('BEGIN')
  const first=(await db.query("SELECT result->>'providerId' AS id FROM payroll_check_replacement_observation WHERE authorization_id=$1 AND result->>'providerId' IS NOT NULL ORDER BY payroll_check_replacement_observation.id LIMIT 1",[id])).rows[0]
  if(first&&result.providerId&&first.id!==result.providerId)result={...result,status:'REVIEW_REQUIRED',settlementStatus:'NEEDS_REVIEW',identityMatches:false}
  const observed=(await db.query('INSERT INTO payroll_check_replacement_observation(authorization_id,source,result) VALUES($1,$2,$3) RETURNING id',[id,recovery?'RECOVERY':'SUBMISSION',result])).rows[0]
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'CHECK_REPLACEMENT_OBSERVED','check_replacement',$3,$4)",[facility,actorId,id,{observationId:Number(observed.id),source:recovery?'RECOVERY':'SUBMISSION',status:result.status,automatic}])
  if(!['PROCESSING','SENT','COMPLETED','PROVIDER_APPROVED','AWAITING_PROVIDER_APPROVAL'].includes(result.status)||result.dateMatches===false||result.expiryMatches===false||['NEEDS_REVIEW','UNAVAILABLE','EXCEPTION'].includes(result.settlementStatus))await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'CRITICAL','Stopped-check replacement needs review',$3) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message",[facility,`check-replacement-${id}`,`Employee ${employeeId}: ${result.status}. Recover the retained replacement before further payment action.`])
  if(recovery&&result.status==='COMPLETED'&&result.settlementStatus==='BANK_POSTED'&&result.dateMatches===true&&result.liveMode===true&&(intent.method!=='CHECK'||result.expiryMatches===true))await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[facility,`check-replacement-${id}`])
  await retainCheckReplacementAchReceipt(db,id,observed.id)
  await refreshCheckStopCases(db,facility,runId)
  await db.query('COMMIT');return {id,recovery,status:result.status,settlementStatus:result.settlementStatus||null}
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{let destroy=false;if(locked)try{await db.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[lock])}catch{destroy=true}db.release(destroy)}
}
export function registerCheckReplacementDispatchRoutes(app,pool,dependencies){
 app.post('/api/admin/payroll/runs/:id/payment-authorization/:batchId/checks/:employeeId/replacement-authorization/:authorizationId/dispatch',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');try{
   const ids=[req.params.id,req.params.batchId,req.params.employeeId].map(Number),id=req.params.authorizationId,b=req.body||{}
   if(!ids.every(v=>Number.isSafeInteger(v)&&v>0)||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)||!['SUBMIT','RECOVER'].includes(b.action)||(b.action==='SUBMIT'&&b.confirmed!==true))throw fail('Choose a replacement action and confirm its authorized payment details.',400)
   res.json({success:true,data:await dispatchCheckReplacement(pool,req.canonicalAccess.facilityId,...ids,id,{...dependencies,actorId:req.adminId,recoveryOnly:b.action==='RECOVER'})})
  }catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain replacement status. Recover the existing payment before further action.'})}
 })
}
