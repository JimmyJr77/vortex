import {createHash,randomUUID} from 'node:crypto'
import {checkReplacementPlan} from './checkReplacementReview.js'
import {checkPaymentSetup} from './checkIssuancePlan.js'
import {employeePaymentReadiness} from './paymentReadiness.js'
import {readPayrollPaymentConnection} from './paymentConnection.js'
import {readPayrollPaymentDestination} from './paymentDestination.js'
import {digitalCheckInstruction} from './modernTreasuryChecks.js'
import {modernTreasuryInstruction} from './modernTreasuryPayments.js'
import {encryptDocument} from './onboarding.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const reference=v=>typeof v==='string'&&v.trim().length>=12&&v.length<=1000&&!/[\u0000-\u001f\u007f]/.test(v)
export const checkReplacementContext=id=>`payroll-check-replacement:${id}`
export async function checkReplacementAuthorizationPlan(db,facility,runId,batchId,employeeId,{now=()=>new Date(),dispatchAuthorizationId=null}={}){
 const review=await checkReplacementPlan(db,facility,runId,batchId,employeeId),latest=review.history[0],issues=[...review.issues]
 if(review.status!=='REVIEW_RETAINED')issues.push('Retain a current unpaid-wage review with original payroll reporting before authorizing.')
 const paymentDate=latest?.review.replacementDate||null
 const timezone=(await db.query('SELECT timezone FROM payroll_settings WHERE facility_id=$1',[facility])).rows[0].timezone
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now())
 if(!paymentDate||paymentDate<today)issues.push('Retain a proposed replacement date on or after today.')
 let setup={},account=null
 if(review.method==='CHECK'){
  const check=await checkPaymentSetup(db,facility,employeeId);issues.push(...check.issues);setup=check.basis;account={payeeName:setup.payeeName}
 }else if(review.method==='DIRECT_DEPOSIT'){
  const readiness=await employeePaymentReadiness(db,facility,employeeId)
  if(readiness.issue)issues.push(readiness.issue)
  setup={connectionId:readiness.connectionId,destinationId:readiness.destinationId,wageAuthorizationId:readiness.authorizationId,termsFingerprint:readiness.termsFingerprint||null}
  if(readiness.status==='READY'){
   const connection=await readPayrollPaymentConnection(db,facility,readiness.connectionId),destination=await readPayrollPaymentDestination(db,facility,employeeId,readiness.destinationId)
   if(connection.mode!=='LIVE'||destination.mode!=='LIVE'||destination.connectionId!==readiness.connectionId)issues.push('Review matching live employer and employee bank accounts.')
   Object.assign(setup,{mode:connection.mode,originatingAccountId:connection.originatingAccountId,receivingAccountId:destination.accountId})
   account={holderName:destination.holderName,accountType:destination.accountType,accountLast4:destination.accountLast4}
  }
 }
 const rows=(await db.query(`SELECT a.id,a.review_id,a.method,a.amount_cents,a.payment_date::text,a.reference,a.account_summary,a.created_at,delivery.reference AS delivery_reference,delivery.delivery_date::text AS delivery_date,d.authorization_id IS NOT NULL AS document_retained,o.result AS provider_result,o.source AS provider_source,c.authorization_id IS NOT NULL AS cancelled,t.authorization_id IS NOT NULL AS claimed FROM payroll_check_replacement_authorization a LEFT JOIN payroll_check_replacement_cancellation c ON c.authorization_id=a.id LEFT JOIN payroll_check_replacement_claim t ON t.authorization_id=a.id LEFT JOIN payroll_check_replacement_delivery delivery ON delivery.authorization_id=a.id LEFT JOIN payroll_check_replacement_document d ON d.authorization_id=a.id LEFT JOIN LATERAL(SELECT result,source FROM payroll_check_replacement_observation WHERE authorization_id=a.id ORDER BY id DESC LIMIT 1)o ON true WHERE a.issue_id=$1 ORDER BY a.created_at DESC,a.id DESC`,[review.issueId])).rows
 const history=rows.map(r=>({id:r.id,reviewId:Number(r.review_id),method:r.method,amountCents:Number(r.amount_cents),paymentDate:r.payment_date,reference:r.reference,account:r.account_summary,createdAt:r.created_at,status:r.cancelled?'CANCELLED':r.claimed?'DISPATCH_STARTED':'AUTHORIZED',canCancel:!r.cancelled&&!r.claimed,documentRetained:r.document_retained,delivery:r.delivery_reference?{reference:r.delivery_reference,paymentDate:r.delivery_date}:null,provider:r.provider_result?{status:r.provider_result.status,settlementStatus:r.provider_result.settlementStatus,source:r.provider_source}:null}))
 const active=history.find(r=>r.status!=='CANCELLED')
 if(active&&active.id!==dispatchAuthorizationId)issues.push('A replacement authorization already exists. Recover its outcome or cancel it before authorizing another.')
 const basis={issueId:review.issueId,reviewId:review.revision,reviewFingerprint:review.fingerprint,facilityId:facility,runId,batchId,employeeId,method:review.method,amountCents:review.amountCents,paymentDate,...setup}
 return {basis,fingerprint:createHash('sha256').update(JSON.stringify(basis)).digest('hex'),reviewId:review.revision,issues,canAuthorize:issues.length===0,history,method:review.method,amountCents:review.amountCents,paymentDate,account,executionAvailable:true}
}
export async function authorizeCheckReplacement(pool,facility,runId,batchId,employeeId,body,{actorId,now}={}){
 if(body?.confirmed!==true||!reference(body.reference)||!Number.isSafeInteger(body.reviewId)||body.reviewId<=0||typeof body.fingerprint!=='string')throw fail('Confirm the reviewed replacement payment and retain its authorization reference.',400)
 const db=await pool.connect()
 try{
  await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility]);await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${facility}`])
  const plan=await checkReplacementAuthorizationPlan(db,facility,runId,batchId,employeeId,{now}),active=plan.history.find(r=>r.status!=='CANCELLED')
  if(active){if(active.reviewId!==body.reviewId||active.reference!==body.reference.trim())throw fail('A different replacement is already authorized.');await db.query('COMMIT');return {id:active.id,reused:true,executionAvailable:true}}
  if(!plan.canAuthorize||plan.fingerprint!==body.fingerprint||plan.reviewId!==body.reviewId)throw fail('Replacement evidence, payment setup or the review changed. Refresh before authorizing.')
  const id=randomUUID(),intent={...plan.basis,id};if(intent.method==='CHECK')digitalCheckInstruction(intent);else modernTreasuryInstruction(intent)
  await db.query('INSERT INTO payroll_check_replacement_authorization(id,issue_id,review_id,method,amount_cents,payment_date,basis_fingerprint,encrypted_intent,account_summary,reference,created_by,connection_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[id,intent.issueId,plan.reviewId,intent.method,intent.amountCents,intent.paymentDate,plan.fingerprint,encryptDocument(Buffer.from(JSON.stringify(intent)),checkReplacementContext(id)),plan.account,body.reference.trim(),actorId,intent.connectionId])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'CHECK_REPLACEMENT_AUTHORIZED','check_replacement',$3,$4)",[facility,actorId,id,{issueId:intent.issueId,reviewId:plan.reviewId,amountCents:intent.amountCents,method:intent.method}])
  await db.query('COMMIT');return {id,reused:false,executionAvailable:true}
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{db.release()}
}
export async function cancelCheckReplacement(pool,facility,runId,batchId,employeeId,body,{actorId}={}){
 if(body?.confirmed!==true||!reference(body.reference)||typeof body.authorizationId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(body.authorizationId))throw fail('Confirm the unstarted replacement cancellation and retain a reference.',400)
 const db=await pool.connect()
 try{
  await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility]);await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${facility}`])
  const row=(await db.query('SELECT a.id FROM payroll_check_replacement_authorization a JOIN payroll_check_issue i ON i.id=a.issue_id WHERE a.id=$1 AND i.facility_id=$2 AND i.payroll_run_id=$3 AND i.batch_id=$4 AND i.employee_id=$5',[body.authorizationId,facility,runId,batchId,employeeId])).rows[0]
  if(!row)throw fail('Replacement authorization not found.',404)
  const previous=(await db.query('SELECT reference FROM payroll_check_replacement_cancellation WHERE authorization_id=$1',[row.id])).rows[0]
  if(previous){if(previous.reference!==body.reference.trim())throw fail('The retained cancellation has a different reference.');await db.query('COMMIT');return {id:row.id,reused:true}}
  if((await db.query('SELECT 1 FROM payroll_check_replacement_claim WHERE authorization_id=$1',[row.id])).rowCount)throw fail('Replacement dispatch has started. Recover its outcome before any further payment action.')
  await db.query('INSERT INTO payroll_check_replacement_cancellation(authorization_id,reference,created_by) VALUES($1,$2,$3)',[row.id,body.reference.trim(),actorId])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'CHECK_REPLACEMENT_CANCELLED','check_replacement',$3,$4)",[facility,actorId,row.id,{reference:body.reference.trim()}])
  await db.query('COMMIT');return {id:row.id,reused:false}
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{db.release()}
}
export function registerCheckReplacementAuthorizationRoutes(app,pool,dependencies){
 const path='/api/admin/payroll/runs/:id/payment-authorization/:batchId/checks/:employeeId/replacement-authorization'
 const scope=req=>{const ids=[req.params.id,req.params.batchId,req.params.employeeId].map(Number);if(!ids.every(v=>Number.isSafeInteger(v)&&v>0))throw fail('Choose an issued payroll check.',400);return [req.canonicalAccess.facilityId,...ids]}
 app.get(path,async(req,res)=>{res.setHeader('Cache-Control','no-store');const db=await pool.connect();try{await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const {basis,...data}=await checkReplacementAuthorizationPlan(db,...scope(req),dependencies);await db.query('COMMIT');res.json({success:true,data})}catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to prepare replacement authorization.'})}finally{db.release()}})
 for(const [suffix,action] of [['',authorizeCheckReplacement],['/cancel',cancelCheckReplacement]])app.post(path+suffix,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{res.json({success:true,data:await action(pool,...scope(req),req.body,{...dependencies,actorId:req.adminId})})}catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain replacement authorization.'})}})
}
