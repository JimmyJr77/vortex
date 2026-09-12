import {createHash,randomUUID} from 'node:crypto'
import {carrierRemittanceAdvice} from './carrierRemittanceAdvice.js'
import {readCarrierPaymentReceipt} from './carrierPaymentReceipt.js'
import {encryptDocument,decryptDocument} from './onboarding.js'
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const context=(facility,id)=>`carrier-alternate-delivery:${facility}:${id}`
export async function carrierAlternateDeliveryHistory(db,facility,paymentId){
 const payment=(await db.query('SELECT a.id FROM payroll_carrier_payment_authorization a JOIN payroll_benefit_carrier_invoice i ON i.id=a.invoice_id WHERE i.facility_id=$1 AND a.id=$2',[facility,paymentId])).rows[0]
 if(!payment)throw fail('Carrier payment was not found.',404)
 const records=(await db.query('SELECT * FROM payroll_carrier_alternate_delivery WHERE facility_id=$1 AND payment_id=$2 ORDER BY revision DESC',[facility,paymentId])).rows
 const receiptFingerprint=(await db.query('SELECT fingerprint FROM payroll_carrier_payment_receipt WHERE facility_id=$1 AND authorization_id=$2',[facility,paymentId])).rows[0]?.fingerprint||null
 let advice=null,issue=null
 try{const receipt=await readCarrierPaymentReceipt(db,facility,paymentId);if(!receipt)throw fail('No retained carrier payment receipt was found.');advice=carrierRemittanceAdvice(receipt)}catch(e){issue=e.status?e.message:'Current bank evidence could not be checked.'}
 const history=records.map(row=>({id:row.id,revision:row.revision,action:row.action,createdAt:new Date(row.created_at).toISOString(),...JSON.parse(decryptDocument(row.encrypted_evidence,context(facility,row.id)).toString())}))
 const current=history[0]||null,status=!current?'NOT_RECORDED':current.action==='RETRACT'?'RETRACTED':!advice||current.receiptFingerprint!==receiptFingerprint?'EVIDENCE_CHANGED':'RECORDED'
 return {paymentId,revision:current?.revision||0,status,advice,receiptFingerprint,issue,history}
}
export function registerCarrierAlternateDelivery(app,pool,{now=()=>new Date()}={}){
 const base='/api/admin/payroll/carrier-payment-authorizations/:id/alternate-delivery'
 const endpoint=write=>async(req,res)=>{
  res.setHeader('Cache-Control','no-store');if(!uuid(req.params.id))return res.status(400).json({success:false,message:'Choose a carrier payment.'})
  const db=await pool.connect(),facility=req.canonicalAccess.facilityId,paymentId=req.params.id
  try{
   await db.query(write?'BEGIN':'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
   if(write){await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility]);await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${facility}`])}
   if(!write){const data=await carrierAlternateDeliveryHistory(db,facility,paymentId);await db.query('COMMIT');return res.json({success:true,data})}
   const b=req.body||{}
   if(!['RECORD','RETRACT'].includes(b.action)||!uuid(b.requestKey)||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0||b.confirmed!==true)throw fail('Confirm the delivery review and current revision.',400)
   const text=(key,min,max)=>{const v=b[key];if(typeof v!=='string'||v.trim().length<min||v.length>max||/[\u0000-\u001f\u007f]/.test(v))throw fail('Provide a valid recipient, destination and supporting reference.',400);return v.trim()}
   const evidence={reference:text('reference',12,2000)}
   if(b.action==='RECORD'){
    if(!['CARRIER_PORTAL','POSTAL_DELIVERY','IN_PERSON'].includes(b.channel))throw fail('Choose the actual remittance delivery channel.',400)
    const timestamp=Date.parse(b.deliveredAt)
    if(typeof b.deliveredAt!=='string'||!Number.isFinite(timestamp)||new Date(timestamp).toISOString()!==b.deliveredAt||timestamp>now().getTime())throw fail('Enter the actual delivery time, not a future time.',400)
    Object.assign(evidence,{channel:b.channel,deliveredAt:new Date(timestamp).toISOString(),recipient:text('recipient',2,200),destination:text('destination',4,1000)})
   }
   const requestFingerprint=hash({paymentId,action:b.action,expectedRevision:b.expectedRevision,adviceFingerprint:b.adviceFingerprint||null,evidence})
   const prior=(await db.query('SELECT id,request_fingerprint FROM payroll_carrier_alternate_delivery WHERE facility_id=$1 AND request_key=$2',[facility,b.requestKey])).rows[0]
   if(prior){if(prior.request_fingerprint!==requestFingerprint)throw fail('This request key already belongs to different delivery evidence.');await db.query('COMMIT');return res.json({success:true,data:{id:prior.id,reused:true}})}
   const model=await carrierAlternateDeliveryHistory(db,facility,paymentId)
   if(model.revision!==b.expectedRevision)throw fail('Another delivery review was retained. Reload current history.')
   if(b.action==='RETRACT'&&(!model.history.length||model.history[0].action==='RETRACT'))throw fail('Only an existing delivery record can be retracted.')
   if(b.action==='RECORD'){
    if(!model.advice||model.advice.fingerprint!==b.adviceFingerprint)throw fail('Bank or advice evidence changed. Review the current remittance advice.')
    if(Date.parse(evidence.deliveredAt)<Date.parse(model.advice.observedAt))throw fail('Delivery must follow the bank observation used to prepare this exact advice.')
    evidence.advice=model.advice; evidence.receiptFingerprint=model.receiptFingerprint
   }else {evidence.advice=model.history[0].advice;evidence.receiptFingerprint=model.history[0].receiptFingerprint}
   const id=randomUUID(),encrypted=encryptDocument(Buffer.from(JSON.stringify(evidence)),context(facility,id))
   await db.query('INSERT INTO payroll_carrier_alternate_delivery(id,facility_id,payment_id,revision,action,encrypted_evidence,request_key,request_fingerprint,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id,facility,paymentId,model.revision+1,b.action,encrypted,b.requestKey,requestFingerprint,req.adminId])
   await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'CARRIER_ALTERNATE_DELIVERY_REVIEWED','carrier_alternate_delivery',$3,$4)",[facility,req.adminId,id,{paymentId,action:b.action,revision:model.revision+1}])
   await db.query('COMMIT');res.json({success:true,data:{id,reused:false}})
  }catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain alternate remittance delivery evidence.'})}finally{db.release()}
 }
 app.get(base,endpoint(false));app.post(base,endpoint(true))
}

export async function checkCarrierAlternateDeliveries(pool,facility,{now=new Date()}={}){
 const rows=(await pool.query(`SELECT r.* FROM payroll_carrier_alternate_delivery r LEFT JOIN payroll_carrier_alternate_delivery_check c ON c.review_id=r.id
 WHERE r.facility_id=$1 AND NOT EXISTS(SELECT 1 FROM payroll_carrier_alternate_delivery later WHERE later.payment_id=r.payment_id AND later.revision>r.revision)
 ORDER BY c.checked_at ASC NULLS FIRST,r.created_at,r.id LIMIT 20`,[facility])).rows
 let checked=0,failed=0
 for(const row of rows){const db=await pool.connect();try{
  await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[facility])
  const model=await carrierAlternateDeliveryHistory(db,facility,row.payment_id),key=`carrier-alternate-delivery:${row.payment_id}`
  if(model.status==='EVIDENCE_CHANGED')await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','Alternate carrier delivery evidence needs review',$3) ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,dismissed_by=NULL,title=EXCLUDED.title,message=EXCLUDED.message",[facility,key,`Carrier payment ${row.payment_id}: current bank or advice evidence differs from the retained alternate delivery. Review its history in Reports & QuickBooks. This does not retract the historical delivery or prove carrier application.`])
  else await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=$3,dismissed_by=NULL WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[facility,key,now])
  await db.query('INSERT INTO payroll_carrier_alternate_delivery_check(review_id,checked_at,status) VALUES($1,$2,$3) ON CONFLICT(review_id) DO UPDATE SET checked_at=EXCLUDED.checked_at,status=EXCLUDED.status',[model.history[0].id,now,model.status])
  await db.query('COMMIT');checked++
 }catch{
  await db.query('ROLLBACK').catch(()=>{});failed++
  await db.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES($1,$2,'WARNING','Alternate carrier delivery check needs recovery','Delivery evidence could not be read or checked. Workforce automation will retry; do not assume delivery is reconciled.') ON CONFLICT(facility_id,dedupe_key) DO UPDATE SET status='OPEN',dismissed_at=NULL,dismissed_by=NULL,title=EXCLUDED.title,message=EXCLUDED.message",[facility,`carrier-alternate-delivery:${row.payment_id}`])
  await db.query("INSERT INTO payroll_carrier_alternate_delivery_check(review_id,checked_at,status) VALUES($1,$2,'CHECK_FAILED') ON CONFLICT(review_id) DO UPDATE SET checked_at=EXCLUDED.checked_at,status=EXCLUDED.status",[row.id,now])
 }finally{db.release()}}
 return {checked,failed}
}
