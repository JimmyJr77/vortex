import {refreshPaymentReturnCases} from './paymentReturnCase.js'
import {retainReplacementReceipt} from './paymentReplacementReceipt.js'
import {paymentReplacementPlan} from './paymentReplacementReview.js'
import {readPayrollPaymentConnection} from './paymentConnection.js'
import {submitModernTreasuryPayment,readModernTreasuryPayment} from './modernTreasuryPayments.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
export async function dispatchReplacementPayment(pool,facility,runId,authorizationId,{fetcher,actorId=null,recoveryOnly=false,automatic=false,now=()=>new Date()}={}){
 if(typeof fetcher!=='function')throw fail('Configured payment transport is required.',503)
 const db=await pool.connect(),lock=`payroll-payment-connection:${facility}`;let locked=false
 try{
  await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
  await db.query('SELECT pg_advisory_lock(hashtextextended($1,0))',[lock]);locked=true
  const row=(await db.query('SELECT a.*,c.authorization_id AS cancelled,t.authorization_id AS claimed FROM payroll_payment_replacement_authorization a LEFT JOIN payroll_payment_replacement_cancellation c ON c.authorization_id=a.id LEFT JOIN payroll_payment_replacement_attempt t ON t.authorization_id=a.id WHERE a.id=$1 AND a.facility_id=$2 AND a.payroll_run_id=$3',[authorizationId,facility,runId])).rows[0]
  if(!row)throw fail('Replacement authorization not found.',404)
  if(row.cancelled)throw fail('Replacement authorization is cancelled.')
  if(row.method!=='DIRECT_DEPOSIT')throw fail('This replacement uses a check and cannot be sent by ACH.')
  const intent=row.intent,recovery=Boolean(row.claimed)
  if(!recovery){
   if(recoveryOnly)throw fail('No replacement dispatch has started. Recovery cannot send a payment.')
   const item=(await paymentReplacementPlan(db,facility,runId)).items.find(i=>i.instructionId===row.instruction_id)
   if(!item||item.revision!==Number(row.review_id)||item.reviewStatus!=='REVIEW_RETAINED'||!item.canReview||item.paymentIssues.length||item.method!==row.method||item.amountCents!==Number(row.amount_cents)||item.readiness.connectionId!==intent.connectionId||item.readiness.destinationId!==intent.destinationId||item.readiness.authorizationId!==intent.wageAuthorizationId)throw fail('The replacement review or employee consent changed. Cancel the unstarted authorization and review again.')
   const timezone=(await db.query('SELECT timezone FROM payroll_settings WHERE facility_id=$1',[facility])).rows[0].timezone
   if(intent.paymentDate<new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now()))throw fail('The replacement payment date has passed. Review a current date.')
  }
  const connection=await readPayrollPaymentConnection(db,facility,intent.connectionId)
  if(connection.mode!==intent.mode||connection.originatingAccountId!==intent.originatingAccountId)throw fail('Retained employer connection does not match this replacement.')
  if(!recovery)await db.query('INSERT INTO payroll_payment_replacement_attempt(authorization_id,created_by) VALUES($1,$2)',[authorizationId,actorId])
  await db.query('COMMIT')
  const result=await (recovery?readModernTreasuryPayment:submitModernTreasuryPayment)(intent,{...connection,fetcher})
  await db.query('BEGIN')
  const observation=(await db.query('INSERT INTO payroll_payment_replacement_observation(authorization_id,source,result) VALUES($1,$2,$3) RETURNING id',[authorizationId,recovery?'RECOVERY':'SUBMISSION',result])).rows[0]
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'PAYMENT_REPLACEMENT_OBSERVED','payment_replacement',$3,$4)",[facility,actorId,authorizationId,{observationId:Number(observation.id),source:recovery?'RECOVERY':'SUBMISSION',status:result.status,automatic}])
  if(result.dateMatches===false||!['PROCESSING','SENT','COMPLETED'].includes(result.status)||['NEEDS_REVIEW','UNAVAILABLE'].includes(result.settlementStatus))await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'CRITICAL','Replacement payment needs review',$3) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,message=EXCLUDED.message",[facility,`replacement-payment-${authorizationId}`,`Replacement ${authorizationId}: ${result.status}. Recover retained evidence before further payment action.`])
  if(recovery&&result.status==='COMPLETED'&&result.settlementStatus==='BANK_POSTED'&&result.dateMatches===true&&result.liveMode===true)await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[facility,`replacement-payment-${authorizationId}`])
  await retainReplacementReceipt(db,authorizationId,Number(observation.id))
  await refreshPaymentReturnCases(db,facility,runId)
  await db.query('COMMIT');return {recovery,observationId:Number(observation.id),result}
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{let destroy=false;if(locked)try{await db.query('SELECT pg_advisory_unlock(hashtextextended($1,0))',[lock])}catch{destroy=true}db.release(destroy)}
}
export function registerReplacementDispatchRoutes(app,pool,dependencies){
 app.post('/api/admin/payroll/runs/:id/payment-replacements/:authorizationId/dispatch',async(req,res)=>{
  res.setHeader('Cache-Control','no-store')
  try{
   const runId=Number(req.params.id),id=req.params.authorizationId,body=req.body||{}
   if(!Number.isSafeInteger(runId)||runId<=0||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)||!['SUBMIT','RECOVER'].includes(body.action)||(body.action==='SUBMIT'&&body.confirmed!==true))throw fail('Choose a replacement action and confirm its retained amount, date and destination before sending.',400)
   res.json({success:true,data:await dispatchReplacementPayment(pool,req.canonicalAccess.facilityId,runId,id,{...dependencies,actorId:req.adminId,recoveryOnly:body.action==='RECOVER'})})
  }catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain replacement status. Recover the existing instruction before further action.'})}
 })
}
