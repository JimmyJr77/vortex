import {randomUUID} from 'node:crypto'
import {paymentReplacementPlan} from './paymentReplacementReview.js'
import {readPayrollPaymentConnection} from './paymentConnection.js'
import {readPayrollPaymentDestination} from './paymentDestination.js'
import {modernTreasuryInstruction} from './modernTreasuryPayments.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v)
const reference=v=>typeof v==='string'&&v.trim().length>=12&&v.length<=1000&&!/[\u0000-\u001f\u007f]/.test(v)
export async function replacementAuthorizationHistory(db,facility,runId,instructionId){
 if(!Number.isSafeInteger(runId)||runId<=0||!uuid(instructionId))throw fail('Choose the original returned payment.',400)
 if(!(await db.query('SELECT 1 FROM payroll_payment_instruction WHERE id=$1 AND facility_id=$2 AND payroll_run_id=$3',[instructionId,facility,runId])).rowCount)throw fail('Original payment not found.',404)
 const rows=(await db.query(`SELECT a.*,EXISTS(SELECT 1 FROM payroll_payment_replacement_authorization child WHERE child.predecessor_id=a.id) AS superseded,c.authorization_id AS cancelled,c.reference AS cancellation_reference,c.created_at AS cancelled_at,t.authorization_id AS claimed,o.result AS provider_result,o.source AS provider_source
  FROM payroll_payment_replacement_authorization a LEFT JOIN payroll_payment_replacement_cancellation c ON c.authorization_id=a.id
  LEFT JOIN payroll_payment_replacement_attempt t ON t.authorization_id=a.id LEFT JOIN LATERAL (SELECT result,source FROM payroll_payment_replacement_observation WHERE authorization_id=a.id ORDER BY id DESC LIMIT 1) o ON true WHERE a.instruction_id=$1 AND a.facility_id=$2 ORDER BY a.created_at DESC,a.id DESC`,[instructionId,facility])).rows
 return rows.map(row=>({id:row.id,reviewId:Number(row.review_id),instructionId:row.instruction_id,method:row.method,amountCents:Number(row.amount_cents),paymentDate:row.intent.paymentDate,account:row.account_summary,reference:row.reference,returnResolutionReference:row.return_resolution_reference,createdAt:row.created_at,status:row.cancelled?'CANCELLED':row.superseded?'SUPERSEDED':row.claimed?'DISPATCH_STARTED':'AUTHORIZED',canCancel:!row.cancelled&&!row.superseded&&!row.claimed,cancellation:row.cancelled?{reference:row.cancellation_reference,createdAt:row.cancelled_at}:null,dispatchAvailable:!row.cancelled&&row.method==='DIRECT_DEPOSIT',provider:row.provider_result?{status:row.provider_result.status,settlementStatus:row.provider_result.settlementStatus,source:row.provider_source}:null}))
}
export async function authorizeReplacementPayment(pool,facility,runId,body,actorId,{now=()=>new Date()}={}){
 const db=await pool.connect()
 try{
  if(!uuid(body?.instructionId)||!Number.isSafeInteger(body.reviewId)||body.reviewId<=0||body.confirmed!==true||!reference(body.reference)||!reference(body.returnResolutionReference))throw fail('Review the replacement and retain authorization and return-resolution references.',400)
  await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${facility}`])
  const history=await replacementAuthorizationHistory(db,facility,runId,body.instructionId),active=history.find(h=>!['CANCELLED','SUPERSEDED'].includes(h.status))
  const currentPlan=await paymentReplacementPlan(db,facility,runId),candidate=currentPlan.items.find(i=>i.instructionId===body.instructionId)
  const replacingReturned=active&&candidate?.predecessor?.id===active.id&&candidate.revision===body.reviewId&&candidate.reviewStatus==='REVIEW_RETAINED'&&candidate.canReview
  if(active&&!replacingReturned){
   if(active.reviewId!==body.reviewId||active.reference!==body.reference.trim()||active.returnResolutionReference!==body.returnResolutionReference.trim())throw fail('A replacement is already authorized. Cancel its unstarted authorization before changing it.')
   await db.query('COMMIT');return {id:active.id,reused:true,dispatchAvailable:false}
  }
  const item=candidate
  if(!item||item.revision!==body.reviewId||item.fingerprint!==body.fingerprint||item.reviewStatus!=='REVIEW_RETAINED'||!item.canReview||item.paymentIssues.length)throw fail('Refresh and resolve the replacement review, tax treatment and employee payment setup before authorizing.')
  const review=item.history[0].review
  if(review.method!==item.method||review.amountCents!==item.amountCents||review.taxTreatment!=='ORIGINAL_PAYROLL_RETAINED'||review.noOtherPaymentConfirmed!==true)throw fail('The retained wage review does not match this replacement.')
  const timezone=(await db.query('SELECT timezone FROM payroll_settings WHERE facility_id=$1',[facility])).rows[0]?.timezone
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now())
  if(review.replacementDate<today)throw fail('The proposed replacement date has passed. Retain a current review before authorizing.')
  const id=randomUUID(),intent={...(item.predecessor?{predecessorId:item.predecessor.id}:{}),id,facilityId:facility,runId,employeeId:item.employeeId,amountCents:item.amountCents,paymentDate:review.replacementDate,method:item.method}
  let account=null
  if(item.method==='DIRECT_DEPOSIT'){
   const connection=await readPayrollPaymentConnection(db,facility,item.readiness.connectionId),destination=await readPayrollPaymentDestination(db,facility,item.employeeId,item.readiness.destinationId)
   if(connection.mode!=='LIVE'||destination.mode!=='LIVE'||destination.connectionId!==item.readiness.connectionId)throw fail('The current employer and employee bank accounts do not match.')
   Object.assign(intent,{mode:'LIVE',originatingAccountId:connection.originatingAccountId,receivingAccountId:destination.accountId,connectionId:item.readiness.connectionId,destinationId:item.readiness.destinationId,wageAuthorizationId:item.readiness.authorizationId})
   modernTreasuryInstruction(intent)
   account={holderName:destination.holderName,accountType:destination.accountType,accountLast4:destination.accountLast4}
  }
  await db.query('INSERT INTO payroll_payment_replacement_authorization(id,facility_id,payroll_run_id,employee_id,instruction_id,review_id,method,amount_cents,intent,account_summary,reference,return_resolution_reference,created_by,predecessor_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',[id,facility,runId,item.employeeId,item.instructionId,item.revision,item.method,item.amountCents,intent,account,body.reference.trim(),body.returnResolutionReference.trim(),actorId,item.predecessor?.id||null])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'PAYMENT_REPLACEMENT_AUTHORIZED','payment_replacement',$3,$4)",[facility,actorId,id,{instructionId:item.instructionId,reviewId:item.revision,amountCents:item.amountCents,method:item.method}])
  await db.query('COMMIT');return {id,reused:false,dispatchAvailable:false}
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{db.release()}
}
export async function cancelReplacementPayment(pool,facility,runId,authorizationId,body,actorId){
 const db=await pool.connect()
 try{
  if(!Number.isSafeInteger(runId)||runId<=0||!uuid(authorizationId)||body?.confirmed!==true||!reference(body.reference))throw fail('Confirm cancellation and retain a reference.',400)
  await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${facility}`])
  const row=(await db.query('SELECT * FROM payroll_payment_replacement_authorization WHERE id=$1 AND facility_id=$2 AND payroll_run_id=$3',[authorizationId,facility,runId])).rows[0]
  if(!row)throw fail('Replacement authorization not found.',404)
  const cancelled=(await db.query('SELECT authorization_id FROM payroll_payment_replacement_cancellation WHERE authorization_id=$1',[authorizationId])).rowCount
  if(cancelled){await db.query('COMMIT');return {id:authorizationId,reused:true,status:'CANCELLED'}}
  if((await db.query('SELECT 1 FROM payroll_payment_replacement_attempt WHERE authorization_id=$1',[authorizationId])).rowCount)throw fail('Dispatch has started. Recover its outcome before any further payment action.')
  await db.query('INSERT INTO payroll_payment_replacement_cancellation(authorization_id,reference,created_by) VALUES($1,$2,$3)',[authorizationId,body.reference.trim(),actorId])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'PAYMENT_REPLACEMENT_CANCELLED','payment_replacement',$3,$4)",[facility,actorId,authorizationId,{instructionId:row.instruction_id}])
  await db.query('COMMIT');return {id:authorizationId,reused:false,status:'CANCELLED'}
 }catch(e){await db.query('ROLLBACK').catch(()=>{});throw e}finally{db.release()}
}
export function registerReplacementAuthorizationRoutes(app,pool,dependencies={}){
 const path='/api/admin/payroll/runs/:id/payment-replacements'
 app.get(`${path}/:instructionId/authorization`,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{res.json({success:true,data:await replacementAuthorizationHistory(pool,req.canonicalAccess.facilityId,Number(req.params.id),req.params.instructionId)})}catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to read replacement authorization.'})}})
 app.post(`${path}/authorize`,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{res.json({success:true,data:await authorizeReplacementPayment(pool,req.canonicalAccess.facilityId,Number(req.params.id),req.body,req.adminId,dependencies)})}catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to authorize replacement payment.'})}})
 app.post(`${path}/:authorizationId/cancel`,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{res.json({success:true,data:await cancelReplacementPayment(pool,req.canonicalAccess.facilityId,Number(req.params.id),req.params.authorizationId,req.body,req.adminId)})}catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to cancel replacement authorization.'})}})
}
