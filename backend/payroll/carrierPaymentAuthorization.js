import {carrierInvoiceHistory} from './carrierInvoiceHistory.js'
import {carrierInvoicePaymentState} from './carrierInvoiceReconciliation.js'
import {readCarrierPaymentReceipt} from './carrierPaymentReceipt.js'
import {randomUUID} from 'node:crypto'
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v)
const reference=b=>{if(b?.confirmed!==true||typeof b.reference!=='string'||b.reference.trim().length<12||b.reference.length>2000||/[\u0000-\u001f\u007f]/.test(b.reference))throw fail('Confirm this payment action and provide its review reference.');return b.reference.trim()}
export async function carrierPaymentReservations(db,facility,row,excludeId=null){
 const rows=(await db.query('SELECT a.id,a.amount_cents FROM payroll_carrier_payment_authorization a JOIN payroll_benefit_carrier_invoice i ON i.id=a.invoice_id WHERE i.facility_id=$1 AND i.carrier_key=$2 AND i.invoice_key=$3 AND a.id IS DISTINCT FROM $4::uuid AND NOT EXISTS(SELECT 1 FROM payroll_carrier_payment_cancellation c WHERE c.authorization_id=a.id) ORDER BY a.id',[facility,row.carrier_key,row.invoice_key,excludeId])).rows.map(r=>({id:r.id,amountCents:Number(r.amount_cents)}))
 const reservedCents=rows.reduce((sum,r)=>sum+r.amountCents,0)
 if(!Number.isSafeInteger(reservedCents)||reservedCents>row.invoice.amountCents)throw fail('Reconcile existing carrier payment reservations.',409)
 return {rows,reservedCents,availableCents:row.invoice.amountCents-reservedCents}
}
export function registerCarrierPaymentAuthorizations(app,pool,prepare){
 const endpoint=work=>async(req,res)=>{res.setHeader('Cache-Control','no-store');const db=await pool.connect();try{await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[req.canonicalAccess.facilityId]);await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`payroll-payment-connection:${req.canonicalAccess.facilityId}`]);const data=await work(db,req);await db.query('COMMIT');res.json({success:true,data})}catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retain carrier payment review.'})}finally{db.release()}}
 const invoice=async(db,req)=>{if(!uuid(req.params.id))throw fail('Choose a retained invoice.');const row=(await db.query('SELECT * FROM payroll_benefit_carrier_invoice WHERE id=$1 AND facility_id=$2',[req.params.id,req.canonicalAccess.facilityId])).rows[0];if(!row)throw fail('Carrier invoice was not found.',404);return row}
 app.get('/api/admin/payroll/benefit-carrier-invoices/:id/reconciliation-history',endpoint(async(db,req)=>{const row=await invoice(db,req);return carrierInvoiceHistory(db,req.canonicalAccess.facilityId,row.id,req.query.cursor)}))
 app.get('/api/admin/payroll/benefit-carrier-invoices/:id/payment-authorizations',endpoint(async(db,req)=>{const row=await invoice(db,req),history=(await db.query('SELECT a.id,(SELECT jsonb_agg(jsonb_build_object(\'id\',s.id,\'submit_at\',s.submit_at,\'reference\',s.reference,\'cancelled_at\',sc.created_at,\'attempt\',(SELECT jsonb_build_object(\'status\',x.status,\'message\',x.message) FROM payroll_carrier_payment_schedule_attempt x WHERE x.schedule_id=s.id ORDER BY x.id DESC LIMIT 1)) ORDER BY s.created_at DESC) FROM payroll_carrier_payment_schedule s LEFT JOIN payroll_carrier_payment_schedule_cancellation sc ON sc.schedule_id=s.id WHERE s.authorization_id=a.id) AS schedules,a.amount_cents,a.payment_date,a.preview,a.reference,a.created_at,EXISTS(SELECT 1 FROM payroll_carrier_payment_claim cl WHERE cl.authorization_id=a.id) AS claimed,(SELECT o.result FROM payroll_carrier_payment_observation o WHERE o.authorization_id=a.id ORDER BY o.id DESC LIMIT 1) AS result,c.created_at AS cancelled_at,c.reference AS cancellation_reference FROM payroll_carrier_payment_authorization a LEFT JOIN payroll_carrier_payment_cancellation c ON c.authorization_id=a.id WHERE a.invoice_id=$1 ORDER BY a.created_at DESC,a.id DESC',[row.id])).rows;for(const a of history)a.receipt=await readCarrierPaymentReceipt(db,req.canonicalAccess.facilityId,a.id);const invoiceState=await carrierInvoicePaymentState(db,req.canonicalAccess.facilityId,row);return {history,invoiceBalance:invoiceState.balance,...await carrierPaymentReservations(db,req.canonicalAccess.facilityId,invoiceState.current)}}))
 app.post('/api/admin/payroll/benefit-carrier-invoices/:id/payment-authorizations',endpoint(async(db,req)=>{
  const row=await invoice(db,req),b=req.body||{},ref=reference(b)
  if(b.outsideActivityReviewed!==true)throw fail('Verify that this invoice has no outside payments, credits, refunds or pending payment instructions.')
  if(typeof b.requestKey!=='string'||!/^[-a-zA-Z0-9]{16,80}$/.test(b.requestKey))throw fail('Refresh the payment authorization form.')
  const retry=(await db.query('SELECT a.*,c.authorization_id AS cancelled FROM payroll_carrier_payment_authorization a LEFT JOIN payroll_carrier_payment_cancellation c ON c.authorization_id=a.id WHERE a.invoice_id=$1 AND a.request_key=$2',[row.id,b.requestKey])).rows[0]
  if(retry){if(retry.cancelled||retry.fingerprint!==b.fingerprint||retry.reference!==ref||Number(retry.amount_cents)!==b.amountCents||retry.preview.paymentDate!==b.paymentDate)throw fail('This payment request was cancelled or has different terms. Start a fresh review.',409);return {id:retry.id,reused:true}}
  const preview=await prepare(db,req)
  if(b.fingerprint!==preview.fingerprint)throw fail('Payment facts or reservations changed. Review the payment again.',409)
  const id=randomUUID()
  await db.query('INSERT INTO payroll_carrier_payment_authorization(id,invoice_id,premium_authorization_id,payee_id,connection_id,amount_cents,payment_date,preview,fingerprint,request_key,reference,outside_activity_reviewed,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,$12)',[id,row.id,preview.premiumAuthorizationId,preview.payeeRevisionId,preview.fundingRevisionId,preview.amountCents,preview.paymentDate,preview,preview.fingerprint,b.requestKey,ref,req.adminId])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'CARRIER_PAYMENT_AUTHORIZED','carrier_payment_authorization',$3,$4)",[req.canonicalAccess.facilityId,req.adminId,id,{invoiceId:row.id,amountCents:preview.amountCents}])
  return {id,reused:false}
 }))
 app.post('/api/admin/payroll/carrier-payment-authorizations/:id/cancel',endpoint(async(db,req)=>{
  if(!uuid(req.params.id))throw fail('Choose a retained payment authorization.')
  const ref=reference(req.body),row=(await db.query('SELECT a.id FROM payroll_carrier_payment_authorization a JOIN payroll_benefit_carrier_invoice i ON i.id=a.invoice_id WHERE a.id=$1 AND i.facility_id=$2',[req.params.id,req.canonicalAccess.facilityId])).rows[0]
  if(!row)throw fail('Carrier payment authorization was not found.',404)
  if((await db.query('SELECT authorization_id FROM payroll_carrier_payment_claim WHERE authorization_id=$1',[row.id])).rows.length)throw fail('Dispatch has been claimed. Recover the provider outcome before any replacement or cancellation.',409)
  const old=(await db.query('SELECT reference FROM payroll_carrier_payment_cancellation WHERE authorization_id=$1',[row.id])).rows[0]
  if(old){if(old.reference!==ref)throw fail('Cancellation is already retained with a different reference.',409);return {id:row.id,reused:true}}
  await db.query('INSERT INTO payroll_carrier_payment_cancellation(authorization_id,reference,created_by) VALUES($1,$2,$3)',[row.id,ref,req.adminId])
  await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key IN (SELECT 'carrier-schedule-'||id::text FROM payroll_carrier_payment_schedule WHERE authorization_id=$2)",[req.canonicalAccess.facilityId,row.id])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'CARRIER_PAYMENT_CANCELLED','carrier_payment_authorization',$3,$4)",[req.canonicalAccess.facilityId,req.adminId,row.id,{}])
  return {id:row.id,reused:false}
 }))
}
