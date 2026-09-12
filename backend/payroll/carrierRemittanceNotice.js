import {carrierPriorUnsentReleasesReady} from './carrierRemittanceUnsentProof.js'
import {carrierAddressClearance,carrierReturnReviewPreview} from './carrierRemittanceReturnReview.js'
import {hashEmail} from '../email/emailDeliveryStore.js'
import {carrierDeliveryState} from './carrierRemittanceDeliveryState.js'
import {processCarrierRemittance} from './carrierRemittanceDispatch.js'
import {carrierRemittanceSender} from './carrierRemittanceAutomation.js'
import {createHash,randomUUID} from 'node:crypto'
import {encryptDocument,decryptDocument} from './onboarding.js'
import {carrierRemittanceAdvice} from './carrierRemittanceAdvice.js'
import {readCarrierPaymentReceipt} from './carrierPaymentReceipt.js'
import {readCurrentCarrierRecipient} from './carrierRemittanceRecipient.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v)
const hash=v=>createHash('sha256').update(v).digest('hex')
const context=row=>`carrier-remittance-notice:${row.facility_id}:${row.id}`
const reference=body=>{if(body?.confirmed!==true||typeof body.reference!=='string'||body.reference.trim().length<12||body.reference.length>2000||/[\u0000-\u001f\u007f]/.test(body.reference))throw fail('Confirm this notice action and provide its review reference.',400);return body.reference.trim()}
export function readCarrierRemittanceNotice(row){
 const bytes=decryptDocument(row.encrypted_notice,context(row));if(hash(bytes)!==row.content_sha256)throw new Error('Carrier notice integrity mismatch.')
 const notice=JSON.parse(bytes.toString());if(notice.version!==1||notice.facilityId!==Number(row.facility_id)||notice.paymentId!==row.payment_id||notice.recipient.id!==String(row.recipient_id)||notice.receiptFingerprint!==row.receipt_fingerprint||notice.previewFingerprint!==row.preview_fingerprint||(notice.returnReviewId||null)!==(row.return_review_id||null))throw new Error('Carrier notice identity mismatch.')
 return notice
}
async function payment(db,facility,id){
 if(!uuid(id))throw fail('Choose a carrier payment.',400)
 const row=(await db.query('SELECT a.id,a.invoice_id,i.carrier_key FROM payroll_carrier_payment_authorization a JOIN payroll_benefit_carrier_invoice i ON i.id=a.invoice_id WHERE a.id=$1 AND i.facility_id=$2',[id,facility])).rows[0]
 if(!row)throw fail('Carrier payment was not found.',404);return row
}
export async function carrierNoticePreview(db,facility,id){
 const releases=await carrierPriorUnsentReleasesReady(db,id);if(!releases.ready)throw fail(releases.reason)
 const source=await payment(db,facility,id),receipt=await readCarrierPaymentReceipt(db,facility,id),advice=carrierRemittanceAdvice(receipt),recipient=await readCurrentCarrierRecipient(db,facility,source.carrier_key)
 if(recipient?.action!=='REVIEW')throw fail('Review a current carrier remittance recipient before authorizing delivery.')
 const clearance=await carrierAddressClearance(db,facility,recipient)
 if(!clearance.ready)throw fail('This carrier address has retained delivery-return evidence. Review the return and carrier contact before further sending.')
 const retained=(await db.query('SELECT fingerprint FROM payroll_carrier_payment_receipt WHERE authorization_id=$1 AND facility_id=$2',[id,facility])).rows[0]
 const preview={version:1,returnReviewId:clearance.reviewId,facilityId:Number(facility),paymentId:id,invoiceId:source.invoice_id,recipient:{id:String(recipient.id),revision:recipient.revision,name:recipient.contact.name,email:recipient.contact.email},receiptFingerprint:retained.fingerprint,advice}
 return {...preview,fingerprint:hash(JSON.stringify(preview))}
}
// Later dispatch compares immutable receipt identity/current bank status and the
// reviewed contact. Routine observation timestamps do not rewrite authorized text.
export async function carrierNoticeReadiness(db,row){
 const releases=await carrierPriorUnsentReleasesReady(db,row.payment_id);if(!releases.ready)return releases
 const notice=readCarrierRemittanceNotice(row),source=await payment(db,row.facility_id,row.payment_id),receipt=await readCarrierPaymentReceipt(db,row.facility_id,row.payment_id)
 const retained=(await db.query('SELECT fingerprint FROM payroll_carrier_payment_receipt WHERE authorization_id=$1 AND facility_id=$2',[row.payment_id,row.facility_id])).rows[0]
 const recipient=await readCurrentCarrierRecipient(db,row.facility_id,source.carrier_key)
 if(receipt?.status!=='BANK_CONFIRMED'||retained?.fingerprint!==notice.receiptFingerprint)return {ready:false,reason:'Bank receipt evidence changed. Review the payment before delivery.'}
 if(recipient?.action!=='REVIEW'||String(recipient.id)!==notice.recipient.id||recipient.contact.email!==notice.recipient.email||recipient.contact.name!==notice.recipient.name)return {ready:false,reason:'Carrier recipient changed or was revoked. Cancel this unclaimed notice and review delivery again.'}
 const clearance=await carrierAddressClearance(db,row.facility_id,recipient)
 if(!clearance.ready||(clearance.reviewId||null)!==(notice.returnReviewId||null))return {ready:false,reason:'This carrier address has retained delivery-return evidence. Review the return and carrier contact before further sending.'}
 return {ready:true,reason:null}
}
export function registerCarrierRemittanceNoticeRoutes(app,pool,{sender,now=()=>new Date()}={}){
 const configuredSender=()=>sender===undefined?carrierRemittanceSender():sender
 const base='/api/admin/payroll/carrier-payment-authorizations/:id/remittance-notices'
 const endpoint=work=>async(req,res)=>{res.setHeader('Cache-Control','no-store');const db=await pool.connect();try{await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[req.canonicalAccess.facilityId]);await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${req.canonicalAccess.facilityId}`]);await payment(db,req.canonicalAccess.facilityId,req.params.id);const data=await work(db,req);await db.query('COMMIT');res.json({success:true,data})}catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to review carrier remittance delivery.'})}finally{db.release()}}
 app.post(`${base}/:noticeId/process`,async(req,res)=>{res.setHeader('Cache-Control','no-store');try{if(req.body?.confirmed!==true||!uuid(req.params.noticeId))throw fail('Confirm remittance processing or recovery.',400);await payment(pool,req.canonicalAccess.facilityId,req.params.id);const scoped=(await pool.query('SELECT id FROM payroll_carrier_remittance_notice WHERE id=$1 AND payment_id=$2 AND facility_id=$3',[req.params.noticeId,req.params.id,req.canonicalAccess.facilityId])).rows[0];if(!scoped)throw fail('Remittance notice was not found.',404);res.json({success:true,data:await processCarrierRemittance(pool,req.canonicalAccess.facilityId,scoped.id,{sender:configuredSender(),now:now()})})}catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to process carrier remittance. Recover its retained outcome before retrying.'})}})
 const active=async(db,id)=>(await db.query('SELECT n.id FROM payroll_carrier_remittance_notice n WHERE n.payment_id=$1 AND NOT EXISTS(SELECT 1 FROM payroll_carrier_remittance_cancellation c WHERE c.notice_id=n.id) AND NOT EXISTS(SELECT 1 FROM payroll_carrier_remittance_return_review r WHERE r.notice_id=n.id) AND NOT EXISTS(SELECT 1 FROM payroll_carrier_remittance_unsent_release u WHERE u.notice_id=n.id)',[id])).rows[0]
 app.get(base,endpoint(async(db,req)=>{
  const rows=(await db.query('SELECT n.*,c.reference AS cancelled_reference,c.created_at AS cancelled_at,k.created_at AS claimed_at FROM payroll_carrier_remittance_notice n LEFT JOIN payroll_carrier_remittance_cancellation c ON c.notice_id=n.id LEFT JOIN payroll_carrier_remittance_claim k ON k.notice_id=n.id WHERE n.payment_id=$1 AND n.facility_id=$2 ORDER BY n.created_at DESC,n.id DESC',[req.params.id,req.canonicalAccess.facilityId])).rows,history=[]
  for(const row of rows){const notice=readCarrierRemittanceNotice(row),delivery=await carrierDeliveryState(db,row.id,{now:now()}),readiness=row.cancelled_at||!delivery.canAttempt?null:await carrierNoticeReadiness(db,row);history.push({id:row.id,createdAt:row.created_at,recipient:notice.recipient,advice:notice.advice,reference:notice.reference,cancelledAt:row.cancelled_at,cancellationReference:row.cancelled_reference,claimedAt:row.claimed_at,returnReviews:(await db.query('SELECT id,reference,recipient_id AS "recipientId",created_at AS "createdAt",source_event_ids AS "sourceEventIds",target_event_ids AS "targetEventIds" FROM payroll_carrier_remittance_return_review WHERE notice_id=$1 ORDER BY created_at DESC,id DESC',[row.id])).rows,status:row.cancelled_at?'CANCELLED':readiness&&!readiness.ready?'BLOCKED':delivery.status,issue:delivery.releaseIssue||readiness?.reason||null,delivery})}
  return {history,deliveryEnabled:typeof configuredSender()==='function'}
 }))
 app.post(`${base}/preview`,endpoint(async(db,req)=>{if(await active(db,req.params.id))throw fail('An active notice already exists for this payment. Review its history before preparing another.');return carrierNoticePreview(db,req.canonicalAccess.facilityId,req.params.id)}))
 app.post(base,endpoint(async(db,req)=>{
  const b=req.body||{},ref=reference(b),facility=req.canonicalAccess.facilityId
  if(!uuid(b.requestKey)||typeof b.fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(b.fingerprint))throw fail('Preview the current remittance notice before authorization.',400)
  const requestFingerprint=hash(JSON.stringify({paymentId:req.params.id,fingerprint:b.fingerprint,reference:ref})),old=(await db.query('SELECT id,request_fingerprint FROM payroll_carrier_remittance_notice WHERE facility_id=$1 AND request_key=$2',[facility,b.requestKey])).rows[0]
  if(old){if(old.request_fingerprint!==requestFingerprint)throw fail('This notice request was already used for different terms.');return {id:old.id,reused:true}}
  if(await active(db,req.params.id))throw fail('An active notice already exists for this payment. Review its history before preparing another.')
  const preview=await carrierNoticePreview(db,facility,req.params.id);if(preview.fingerprint!==b.fingerprint)throw fail('Payment evidence or the recipient changed. Preview the notice again.')
  const id=randomUUID(),notice={...preview,previewFingerprint:preview.fingerprint,reference:ref},bytes=Buffer.from(JSON.stringify(notice))
  await db.query('INSERT INTO payroll_carrier_remittance_notice(id,facility_id,payment_id,recipient_id,receipt_fingerprint,preview_fingerprint,encrypted_notice,content_sha256,request_key,request_fingerprint,created_by,return_review_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[id,facility,req.params.id,preview.recipient.id,preview.receiptFingerprint,preview.fingerprint,encryptDocument(bytes,context({facility_id:facility,id})),hash(bytes),b.requestKey,requestFingerprint,req.adminId,preview.returnReviewId])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'CARRIER_REMITTANCE_AUTHORIZED','carrier_remittance_notice',$3,$4)",[facility,req.adminId,id,{paymentId:req.params.id,recipientId:preview.recipient.id}]);return {id,reused:false}
 }))
 app.post(`${base}/:noticeId/return-review/preview`,endpoint(async(db,req)=>{
  if(!uuid(req.params.noticeId))throw fail('Choose a retained remittance notice.',400)
  const scoped=(await db.query('SELECT id FROM payroll_carrier_remittance_notice WHERE id=$1 AND payment_id=$2 AND facility_id=$3',[req.params.noticeId,req.params.id,req.canonicalAccess.facilityId])).rows[0]
  if(!scoped)throw fail('Remittance notice was not found.',404)
  return carrierReturnReviewPreview(db,req.canonicalAccess.facilityId,scoped.id)
 }))
 app.post(`${base}/:noticeId/return-review`,endpoint(async(db,req)=>{
  const b=req.body||{},ref=reference(b),facility=req.canonicalAccess.facilityId
  if(!uuid(req.params.noticeId)||!uuid(b.requestKey)||typeof b.fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(b.fingerprint)||b.recipientRequestedDelivery!==true)throw fail('Confirm the carrier requested delivery to the freshly reviewed contact and preview current return evidence.',400)
  const scoped=(await db.query('SELECT id FROM payroll_carrier_remittance_notice WHERE id=$1 AND payment_id=$2 AND facility_id=$3',[req.params.noticeId,req.params.id,facility])).rows[0]
  if(!scoped)throw fail('Remittance notice was not found.',404)
  const fingerprint=hash(JSON.stringify({noticeId:scoped.id,fingerprint:b.fingerprint,reference:ref,recipientRequestedDelivery:true})),old=(await db.query('SELECT id,request_fingerprint FROM payroll_carrier_remittance_return_review WHERE facility_id=$1 AND request_key=$2',[facility,b.requestKey])).rows[0]
  if(old){if(old.request_fingerprint!==fingerprint)throw fail('This return review request was already used for different evidence.');return {id:old.id,reused:true}}
  const preview=await carrierReturnReviewPreview(db,facility,scoped.id)
  if(preview.fingerprint!==b.fingerprint)throw fail('Return evidence, contact or an earlier review changed. Preview the return review again.')
  const id=randomUUID()
  await db.query('INSERT INTO payroll_carrier_remittance_return_review(id,facility_id,notice_id,recipient_id,target_recipient_hash,source_event_ids,target_event_ids,previous_review_id,reference,request_key,request_fingerprint,created_by,recipient_requested_delivery) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true)',[id,facility,scoped.id,preview.recipient.id,hashEmail(preview.recipient.email),JSON.stringify(preview.sourceEventIds),JSON.stringify(preview.targetEventIds),preview.previousReviewId,ref,b.requestKey,fingerprint,req.adminId])
  await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=clock_timestamp(),dismissed_by=$3 WHERE facility_id=$1 AND dedupe_key=$2",[facility,`carrier-remittance-${scoped.id}`,req.adminId])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'CARRIER_REMITTANCE_RETURN_REVIEWED','carrier_remittance_notice',$3,$4)",[facility,req.adminId,scoped.id,{reviewId:id,recipientId:preview.recipient.id,eventCount:preview.sourceEventIds.length}])
  return {id,reused:false}
 }))
 app.post(`${base}/:noticeId/cancel`,endpoint(async(db,req)=>{
  const ref=reference(req.body);if(!uuid(req.params.noticeId))throw fail('Choose a retained remittance notice.',400)
  const row=(await db.query('SELECT id FROM payroll_carrier_remittance_notice WHERE id=$1 AND payment_id=$2 AND facility_id=$3',[req.params.noticeId,req.params.id,req.canonicalAccess.facilityId])).rows[0]
  if(!row)throw fail('Remittance notice was not found.',404)
  const old=(await db.query('SELECT reference FROM payroll_carrier_remittance_cancellation WHERE notice_id=$1',[row.id])).rows[0]
  if(old){if(old.reference!==ref)throw fail('Cancellation was already retained with a different reference.');return {id:row.id,reused:true}}
  if((await db.query('SELECT notice_id FROM payroll_carrier_remittance_claim WHERE notice_id=$1',[row.id])).rows.length)throw fail('Delivery has been claimed. Recover its outcome before any replacement.')
  await db.query('INSERT INTO payroll_carrier_remittance_cancellation(notice_id,reference,created_by) VALUES($1,$2,$3)',[row.id,ref,req.adminId]);await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now(),dismissed_by=$3 WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[req.canonicalAccess.facilityId,`carrier-remittance-${row.id}`,req.adminId]);await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'CARRIER_REMITTANCE_CANCELLED','carrier_remittance_notice',$3,$4)",[req.canonicalAccess.facilityId,req.adminId,row.id,{paymentId:req.params.id}]);return {id:row.id,reused:false}
 }))
}
