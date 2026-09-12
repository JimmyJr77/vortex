import {createHash} from 'node:crypto'
import {encryptDocument,decryptDocument,vaultReady} from './onboarding.js'
import {normalizeEmail,isValidEmail} from '../email/emailAddress.js'
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const context=row=>`carrier-remittance-recipient:${row.facility_id}:${row.invoice_id}:${row.request_key}`
const text=(value,min,max,label)=>{if(typeof value!=='string'||value.trim().length<min||value.length>max||/[\u0000-\u001f\u007f]/.test(value))throw fail(`Enter ${label}.`);return value.trim()}
export function carrierRecipientInput(body){
 const b=body||{}
 if(!['REVIEW','REVOKE'].includes(b.action)||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0||!uuid(b.requestKey)||b.confirmed!==true)throw fail('Confirm the recipient review and current revision.')
 const reference=text(b.reference,12,2000,'an independent carrier contact verification reference')
 if(b.action==='REVOKE')return {action:b.action,expectedRevision:b.expectedRevision,reference,name:null,email:null}
 const name=text(b.name,2,200,'the carrier remittance contact name'),email=normalizeEmail(text(b.email,3,254,'one carrier remittance email address'))
 // Accept a bare address, never display-name envelopes, lists, or header syntax.
 if(!isValidEmail(email)||/[<>,;:"\\()[\]]/.test(email))throw fail('Enter one bare carrier remittance email address.')
 return {action:b.action,expectedRevision:b.expectedRevision,reference,name,email}
}
export function decryptCarrierRecipient(row){
 const bytes=decryptDocument(row.encrypted_contact,context(row))
 if(hash(bytes)!==row.content_sha256)throw new Error('Carrier recipient integrity mismatch.')
 const value=JSON.parse(bytes.toString())
 if(value.version!==1||value.facilityId!==Number(row.facility_id)||value.invoiceId!==row.invoice_id||value.carrierKey!==row.carrier_key||value.action!==row.action)throw new Error('Carrier recipient identity mismatch.')
 return value
}
export async function readCurrentCarrierRecipient(db,facility,carrierKey){
 const row=(await db.query('SELECT * FROM payroll_carrier_remittance_recipient WHERE facility_id=$1 AND carrier_key=$2 ORDER BY revision DESC LIMIT 1',[facility,carrierKey])).rows[0]
 return row?{...row,contact:decryptCarrierRecipient(row)}:null
}
export function registerCarrierRemittanceRecipientRoutes(app,pool){
 const base='/api/admin/payroll/benefit-carrier-invoices/:id/remittance-recipient'
 const invoice=async(db,req)=>{
  if(!uuid(req.params.id))throw fail('Choose a carrier invoice.')
  const row=(await db.query('SELECT id,carrier_key,invoice FROM payroll_benefit_carrier_invoice WHERE id=$1 AND facility_id=$2',[req.params.id,req.canonicalAccess.facilityId])).rows[0]
  if(!row)throw fail('Carrier invoice was not found.',404)
  return row
 }
 const state=async(db,facility,source)=>{
  const rows=(await db.query('SELECT * FROM payroll_carrier_remittance_recipient WHERE facility_id=$1 AND carrier_key=$2 ORDER BY revision DESC',[facility,source.carrier_key])).rows
  const history=rows.map(row=>{const c=decryptCarrierRecipient(row);return {id:String(row.id),revision:row.revision,action:row.action,createdAt:row.created_at,reference:c.reference,name:c.name,email:c.email?`${c.email[0]}***${c.email.slice(c.email.indexOf('@'))}`:null}})
  const current=rows[0]?decryptCarrierRecipient(rows[0]):null
  return {carrier:source.invoice.carrier,revision:rows[0]?.revision||0,status:rows[0]?.action==='REVIEW'?'REVIEWED':rows.length?'REVOKED':'NOT_REVIEWED',current:current&&rows[0].action==='REVIEW'?{id:String(rows[0].id),name:current.name,email:current.email}:null,history,vaultReady:vaultReady()}
 }
 const endpoint=work=>async(req,res)=>{res.setHeader('Cache-Control','no-store');const db=await pool.connect();try{await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[req.canonicalAccess.facilityId]);const source=await invoice(db,req),data=await work(db,req,source);await db.query('COMMIT');res.json({success:true,data})}catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to review carrier remittance recipient.'})}finally{db.release()}}
 app.get(base,endpoint((db,req,source)=>state(db,req.canonicalAccess.facilityId,source)))
 app.post(base,endpoint(async(db,req,source)=>{
  const input=carrierRecipientInput(req.body),facility=req.canonicalAccess.facilityId,key=req.body.requestKey.toLowerCase(),fingerprint=hash(JSON.stringify({invoiceId:source.id,...input}))
  const existing=(await db.query('SELECT request_fingerprint FROM payroll_carrier_remittance_recipient WHERE facility_id=$1 AND request_key=$2',[facility,key])).rows[0]
  if(existing){if(existing.request_fingerprint!==fingerprint)throw fail('This recipient request was already used for different details.',409);return {...await state(db,facility,source),reused:true}}
  const prior=await readCurrentCarrierRecipient(db,facility,source.carrier_key)
  if((prior?.revision||0)!==input.expectedRevision)throw fail('The carrier recipient changed. Refresh and review the current contact.',409)
  if(input.action==='REVOKE'&&prior?.action!=='REVIEW')throw fail('Only a current reviewed recipient can be revoked.',409)
  const contact={version:1,facilityId:Number(facility),invoiceId:source.id,carrierKey:source.carrier_key,action:input.action,name:input.name,email:input.email,reference:input.reference},bytes=Buffer.from(JSON.stringify(contact))
  const saved=(await db.query('INSERT INTO payroll_carrier_remittance_recipient(facility_id,invoice_id,carrier_key,revision,previous_id,action,encrypted_contact,content_sha256,request_key,request_fingerprint,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id',[facility,source.id,source.carrier_key,input.expectedRevision+1,prior?.id||null,input.action,encryptDocument(bytes,context({facility_id:facility,invoice_id:source.id,request_key:key})),hash(bytes),key,fingerprint,req.adminId])).rows[0]
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'CARRIER_REMITTANCE_RECIPIENT_REVIEWED','carrier_remittance_recipient',$3,$4)",[facility,req.adminId,String(saved.id),{invoiceId:source.id,revision:input.expectedRevision+1,action:input.action}])
  return {...await state(db,facility,source),reused:false}
 }))
}
