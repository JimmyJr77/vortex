import {carrierPaymentReconciliation} from './carrierPaymentReconciliation.js'
import {isDeepStrictEqual} from 'node:util'
import {readCarrierPaymentReceipt} from './carrierPaymentReceipt.js'
const fail=(message,status=409)=>{throw Object.assign(new Error(message),{status})}
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v)
export async function carrierApplicationState(db,facility,id){
 const payment=(await db.query('SELECT a.id,a.invoice_id,a.premium_authorization_id,a.amount_cents,a.preview FROM payroll_carrier_payment_authorization a JOIN payroll_benefit_carrier_invoice i ON i.id=a.invoice_id WHERE a.id=$1 AND i.facility_id=$2',[id,facility])).rows[0]
 if(!payment)fail('Carrier payment was not found.',404)
 const receipt=await readCarrierPaymentReceipt(db,facility,id),receiptFingerprint=(await db.query('SELECT fingerprint FROM payroll_carrier_payment_receipt WHERE authorization_id=$1',[id])).rows[0]?.fingerprint||null
 const history=(await db.query('SELECT * FROM payroll_carrier_application WHERE payment_authorization_id=$1 ORDER BY id DESC',[id])).rows,current=history[0]
 const status=!current?'UNREVIEWED':current.kind==='RETRACT'?'RETRACTED':receipt?.status!=='BANK_CONFIRMED'||current.receipt_fingerprint!==receiptFingerprint?'NEEDS_REVIEW':current.details.appliedCents===Number(payment.amount_cents)?'FULLY_APPLIED':current.details.appliedCents===0?'UNAPPLIED':'PARTIALLY_APPLIED'
 const documents=(await db.query('SELECT id,filename FROM payroll_benefit_carrier_document WHERE invoice_id=$1 ORDER BY created_at,id',[payment.invoice_id])).rows
 const reconciliation=await carrierPaymentReconciliation(db,facility,payment,{status},receipt)
 const reconciliationHistory=(await db.query('SELECT id,assessment,created_at FROM payroll_carrier_reconciliation_assessment WHERE payment_authorization_id=$1 AND facility_id=$2 ORDER BY id DESC LIMIT 10',[id,facility])).rows
 const reconciliationCheckedAt=(await db.query('SELECT c.checked_at FROM payroll_carrier_reconciliation_check c JOIN payroll_carrier_reconciliation_assessment a ON a.id=c.assessment_id WHERE a.payment_authorization_id=$1 AND a.facility_id=$2 ORDER BY c.id DESC LIMIT 1',[id,facility])).rows[0]?.checked_at||null
 const reconciliationFailures=(await db.query('SELECT id,message,attempted_at FROM payroll_carrier_reconciliation_failure WHERE payment_authorization_id=$1 AND facility_id=$2 ORDER BY id DESC LIMIT 10',[id,facility])).rows
 const reconciliationCheckFailed=!!reconciliationFailures[0]&&(!reconciliationCheckedAt||new Date(reconciliationFailures[0].attempted_at)>=new Date(reconciliationCheckedAt))
 return {reconciliationFailures,reconciliationCheckFailed,carrier:payment.preview.carrier,invoiceNumber:payment.preview.invoiceNumber,reconciliation,reconciliationHistory,reconciliationCheckedAt,revision:Number(current?.id||0),status,receiptFingerprint,receiptStatus:receipt?.status||'NOT_RETAINED',amountCents:Number(payment.amount_cents),paymentDate:payment.preview.paymentDate,earliestBankDate:receipt?.bankWithdrawals.map(w=>w.postedDate).sort()[0]||payment.preview.paymentDate,invoiceId:payment.invoice_id,history,documents}
}
export function registerCarrierApplicationRoutes(app,pool,{now=()=>new Date()}={}){
 const path='/api/admin/payroll/carrier-payment-authorizations/:id/application'
 const endpoint=work=>async(req,res)=>{res.setHeader('Cache-Control','no-store');const db=await pool.connect();try{if(!uuid(req.params.id))fail('Choose a retained carrier payment.',400);await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[req.canonicalAccess.facilityId]);await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${req.canonicalAccess.facilityId}`]);const data=await work(db,req);await db.query('COMMIT');res.json({success:true,data})}catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain carrier application review.'})}finally{db.release()}}
 app.get(path,endpoint((db,req)=>carrierApplicationState(db,req.canonicalAccess.facilityId,req.params.id)))
 app.post(path,endpoint(async(db,req)=>{
  const b=req.body||{},facility=req.canonicalAccess.facilityId
  if(b.confirmed!==true||!['REVIEW','RETRACT'].includes(b.kind)||!Number.isSafeInteger(b.expectedRevision)||b.expectedRevision<0||typeof b.requestKey!=='string'||!/^[A-Za-z0-9_-]{16,80}$/.test(b.requestKey)||typeof b.reference!=='string'||b.reference.trim().length<12||b.reference.length>2000||/[\u0000-\u001f\u007f]/.test(b.reference))fail('Confirm the carrier evidence and provide the review reference.',400)
  const state=await carrierApplicationState(db,facility,req.params.id)
  let details={reference:b.reference.trim()},receiptFingerprint=null
  if(b.kind==='REVIEW'){
   if(!Number.isSafeInteger(b.appliedCents)||b.appliedCents<0||b.appliedCents>state.amountCents||typeof b.applicationDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(b.applicationDate)||!Number.isFinite(Date.parse(b.applicationDate))||new Date(b.applicationDate).toISOString().slice(0,10)!==b.applicationDate||!Array.isArray(b.documentIds)||b.documentIds.length>20||b.documentIds.some(id=>!uuid(id))||new Set(b.documentIds).size!==b.documentIds.length)fail('Provide a valid applied amount, carrier evidence date and supporting documents.',400)
   const timezone=(await db.query('SELECT timezone FROM payroll_settings WHERE facility_id=$1',[facility])).rows[0].timezone,today=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now())
   if(b.applicationDate<state.earliestBankDate||b.applicationDate>today)fail('The carrier evidence date must be on or after the first bank withdrawal and no later than today.',400)
   if(b.documentIds.some(id=>!state.documents.some(d=>d.id===id)))fail('Use supporting documents retained with this invoice.')
   details={reference:b.reference.trim(),applicationDate:b.applicationDate,appliedCents:b.appliedCents,unappliedCents:state.amountCents-b.appliedCents,documentIds:[...b.documentIds].sort()};receiptFingerprint=b.receiptFingerprint
  }
  const retry=state.history.find(r=>r.request_key===b.requestKey)
  if(retry){if(retry.kind!==b.kind||!isDeepStrictEqual(retry.details,details)||retry.receipt_fingerprint!==receiptFingerprint)fail('This request key already records a different carrier review.');return {id:Number(retry.id),reused:true}}
  if(state.revision!==b.expectedRevision)fail('Carrier application history changed. Reload before retaining this review.')
  if(b.kind==='RETRACT'&&!state.revision)fail('There is no carrier application review to retract.')
  if(b.kind==='REVIEW'&&(state.receiptStatus!=='BANK_CONFIRMED'||typeof receiptFingerprint!=='string'||receiptFingerprint!==state.receiptFingerprint))fail('Recover matching bank receipt evidence before reviewing carrier application.')
  const saved=(await db.query('INSERT INTO payroll_carrier_application(payment_authorization_id,previous_id,kind,receipt_fingerprint,details,request_key,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',[req.params.id,state.revision||null,b.kind,receiptFingerprint,details,b.requestKey,req.adminId])).rows[0]
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'CARRIER_APPLICATION_REVIEWED','carrier_application',$3,$4)",[facility,req.adminId,String(saved.id),{paymentAuthorizationId:req.params.id,kind:b.kind,details}]);return {id:Number(saved.id),reused:false}
 }))
}
