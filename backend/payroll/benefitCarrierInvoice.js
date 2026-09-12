import {benefitCoverageLedger} from './benefitCoverageLedger.js'
import {registerCarrierPaymentSchedules} from './carrierPaymentSchedule.js'
import {registerCarrierPaymentDispatch} from './carrierPaymentDispatch.js'
import {registerCarrierPaymentAuthorizations} from './carrierPaymentAuthorization.js'
import {carrierPaymentPreview} from './carrierPaymentPreview.js'
import {reconcileCarrierPremiumReversal,verifyCarrierCorrectionChain} from './carrierPremiumCorrection.js'
import {registerCarrierReversalPosting} from './carrierReversalPosting.js'
import {authorizeCarrierPremiumReversal,cancelCarrierPremiumReversal} from './carrierPremiumReversalAuthorization.js'
import {carrierPremiumReversalPreview} from './carrierPremiumReversal.js'
import {quickbooksRequest} from './quickbooks.js'
import {resolveCarrierPremiumJournal} from './carrierPremiumDispatch.js'
import {registerCarrierPremiumPosting} from './carrierPremiumPosting.js'
import {carrierPremiumPreview} from './carrierPremiumJournal.js'
import {carrierAccountingCheck} from './carrierAccountingCheck.js'
import {carrierContributions,matchCarrierContributions} from './carrierContributionMatching.js'
import {carrierInvoiceAllocation} from './carrierInvoiceAllocation.js'
import {documentInput,encryptDocument,decryptDocument,vaultReady} from './onboarding.js'
import {createHash,randomUUID} from 'node:crypto'
import {employerBenefitFundingReport} from './employerBenefitFundingReport.js'
import {compensationEvidence} from './employmentCompensation.js'
const fail=(message,status=400)=>Object.assign(new Error(message),{status})
const hash=value=>createHash('sha256').update(JSON.stringify(compensationEvidence(value))).digest('hex')
function monthRange(month){if(typeof month!=='string'||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))throw fail('Choose a valid coverage month.');return [`${month}-01`,new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).toISOString().slice(0,10)]}
async function basis(db,facility,month){const range=monthRange(month),funding=await employerBenefitFundingReport(db,facility,...range);const contributions=await carrierContributions(db,facility,...range);const coverage=(await benefitCoverageLedger(db,facility,month,{contributions})).rows;return {month,funding,contributions,coverage,fingerprint:hash({month,funding,contributions,coverage})}}
function input(body){
 const result={month:body.month};monthRange(result.month)
 for(const [key,min,max] of [['carrier',2,200],['invoiceNumber',1,200],['reference',12,2000],['reconciliation',12,4000]]){const v=body[key];if(typeof v!=='string'||v.trim().length<min||v.length>max||/[\u0000-\u001f\u007f]/.test(v))throw fail(`Provide a valid ${key} for the carrier invoice.`);result[key]=v.trim()}
 for(const key of ['invoiceDate','dueDate']){const v=body[key];if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw fail('Enter valid invoice and due dates.');result[key]=v}
 if(body.accountingDate!==undefined&&body.accountingDate!==''){const v=body.accountingDate;if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)throw fail('Enter a valid premium accounting date.');result.accountingDate=v}
 if(result.dueDate<result.invoiceDate)throw fail('The due date cannot precede the invoice date.')
 if(!Number.isSafeInteger(body.amountCents)||body.amountCents<=0||body.amountCents>9999999999)throw fail('Enter the positive carrier invoice total in cents.')
 if(body.confirmed!==true)throw fail('Confirm the carrier invoice, covered employees and reconciliation.')
 if(body.coverageReviewIds!==undefined&&(!Array.isArray(body.coverageReviewIds)||body.coverageReviewIds.length>1000||new Set(body.coverageReviewIds).size!==body.coverageReviewIds.length||body.coverageReviewIds.some(id=>typeof id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))))throw fail('Select distinct retained monthly coverage reviews.')
 return {...result,...(body.coverageReviewIds?.length?{coverageReviewIds:[...body.coverageReviewIds].sort()}:{}),amountCents:body.amountCents,...(body.allocation?{allocation:carrierInvoiceAllocation(body.allocation,body.amountCents)}:{})}
}
export async function prepareCarrierAccounting(db,req,forcePreview=false,{fetcher=fetch}={}){
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id))throw fail('Choose a retained invoice.')
  const facility=req.canonicalAccess.facilityId,row=(await db.query('SELECT * FROM payroll_benefit_carrier_invoice WHERE facility_id=$1 AND id=$2',[facility,req.params.id])).rows[0]
  if(!row)throw fail('Carrier invoice was not found.',404)
  const latest=(await db.query('SELECT id FROM payroll_benefit_carrier_invoice WHERE facility_id=$1 AND carrier_key=$2 AND invoice_key=$3 ORDER BY revision DESC LIMIT 1',[facility,row.carrier_key,row.invoice_key])).rows[0]
  const source=await basis(db,facility,row.coverage_month)
  if(latest?.id!==row.id||source.fingerprint!==row.source_fingerprint)throw fail('Refresh the invoice reconciliation before checking its accounting.',409)
  if((await db.query('SELECT c.premium_authorization_id FROM payroll_carrier_premium_correction c JOIN payroll_carrier_premium_authorization a ON a.id=c.premium_authorization_id WHERE a.invoice_id=$1',[row.id])).rows.length)throw fail('Revise the reconciled invoice before preparing another premium journal.',409)
  await verifyCarrierCorrectionChain(db,facility,row,{fetcher})
  await matchCarrierContributions(db,facility,row.invoice,source)
  const check=await carrierAccountingCheck(db,facility,row.invoice,{fetcher})
  if(forcePreview||req.body?.prepareJournal===true)check.premiumPreview=await carrierPremiumPreview(db,facility,row,check,req.body,{fetcher})
  return {row,check}
 }
export async function prepareCarrierPayment(db,req,reservationIgnoreId=null,{fetcher=fetch,paymentFetcher=fetch}={}){const {row,check}=await prepareCarrierAccounting(db,req,false,{fetcher});return carrierPaymentPreview(db,req.canonicalAccess.facilityId,row,check,req.body||{},{quickbooksFetcher:fetcher,paymentFetcher,reservationIgnoreId})}
export function registerBenefitCarrierInvoiceRoutes(app,pool,{fetcher=fetch,paymentFetcher=fetch,now=()=>new Date()}={}){
 const endpoint=(write,work)=>async(req,res)=>{res.setHeader('Cache-Control','no-store');const db=await pool.connect();try{await db.query(write?'BEGIN':'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');if(write)await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=$1 FOR UPDATE',[req.canonicalAccess.facilityId]);const data=await work(db,req);await db.query('COMMIT');res.json({success:true,data})}catch(e){await db.query('ROLLBACK').catch(()=>{});res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to reconcile carrier invoice.'})}finally{db.release()}}
 app.get('/api/admin/payroll/benefit-carrier-invoices',endpoint(false,async(db,req)=>{
  const facility=req.canonicalAccess.facilityId,month=req.query.month;monthRange(month)
  let source=null,sourceIssue=null;try{source=await basis(db,facility,month)}catch(e){if(e.status!==409)throw e;sourceIssue=e.message}
  const records=(await db.query('SELECT id,invoice,source_snapshot,source_fingerprint,revision,created_at FROM payroll_benefit_carrier_invoice WHERE facility_id=$1 AND coverage_month=$2 ORDER BY created_at DESC,id DESC',[facility,month])).rows
  const documents=(await db.query('SELECT d.id,d.invoice_id,d.filename,d.mime_type,d.content_hash,d.created_at FROM payroll_benefit_carrier_document d JOIN payroll_benefit_carrier_invoice i ON i.id=d.invoice_id WHERE i.facility_id=$1 AND i.coverage_month=$2 ORDER BY d.created_at,d.id',[facility,month])).rows
  const authorizations=(await db.query('SELECT a.*,EXISTS(SELECT 1 FROM payroll_carrier_premium_no_send n WHERE n.authorization_id=a.id) AS no_send_proven,c.created_at AS cancelled_at,c.reference AS cancellation_reference,EXISTS(SELECT 1 FROM payroll_carrier_premium_claim cl WHERE cl.authorization_id=a.id) AS claimed,(SELECT o.result FROM payroll_carrier_premium_observation o WHERE o.authorization_id=a.id ORDER BY o.id DESC LIMIT 1) AS posting_result FROM payroll_carrier_premium_authorization a JOIN payroll_benefit_carrier_invoice i ON i.id=a.invoice_id LEFT JOIN payroll_carrier_premium_cancellation c ON c.authorization_id=a.id WHERE i.facility_id=$1 AND i.coverage_month=$2 ORDER BY a.created_at DESC,a.id DESC',[facility,month])).rows
  const reversals=(await db.query('SELECT r.*,x.reference AS correction_reference,x.created_at AS correction_at,x.evidence AS correction_evidence,EXISTS(SELECT 1 FROM payroll_carrier_reversal_claim cl WHERE cl.authorization_id=r.id) AS claimed,(SELECT result FROM payroll_carrier_reversal_observation WHERE authorization_id=r.id ORDER BY id DESC LIMIT 1) AS posting_result,c.created_at AS cancelled_at,c.reference AS cancellation_reference FROM payroll_carrier_reversal_authorization r JOIN payroll_carrier_premium_authorization a ON a.id=r.premium_authorization_id JOIN payroll_benefit_carrier_invoice i ON i.id=a.invoice_id LEFT JOIN payroll_carrier_reversal_cancellation c ON c.authorization_id=r.id LEFT JOIN payroll_carrier_premium_correction x ON x.reversal_authorization_id=r.id WHERE i.facility_id=$1 AND i.coverage_month=$2 ORDER BY r.created_at DESC,r.id DESC',[facility,month])).rows
  for(const a of authorizations){a.reversals=reversals.filter(r=>r.premium_authorization_id===a.id);a.corrected=a.reversals.some(r=>r.correction_at)}
  const latest=new Set();return {month,source,sourceIssue,documentStorageReady:vaultReady(),history:records.map(row=>{const key=JSON.stringify([row.invoice.carrier.toLowerCase(),row.invoice.invoiceNumber.toLowerCase()]),superseded=latest.has(key);latest.add(key);return {...row,authorizations:authorizations.filter(a=>a.invoice_id===row.id),documents:documents.filter(d=>d.invoice_id===row.id),current:!superseded&&!!source&&source.fingerprint===row.source_fingerprint,superseded,allocationStatus:!row.invoice.allocation?'NEEDS_ALLOCATION':row.invoice.allocation.employeeContributionCents>0&&!row.invoice.allocation.contributions?'NEEDS_MATCHING':'REVIEWED',accountingStatus:authorizations.some(a=>a.invoice_id===row.id&&a.corrected)?'CORRECTION_RECONCILED':reversals.some(r=>r.preview.invoiceId===row.id&&!r.cancelled_at&&r.posting_result?.status==='SYNCED')?'REVERSAL_POSTED':reversals.some(r=>r.preview.invoiceId===row.id&&!r.cancelled_at&&r.claimed)?'REVERSAL_RECOVERY':authorizations.some(a=>a.invoice_id===row.id&&!a.cancelled_at&&a.posting_result?.status==='SYNCED')?'POSTED':authorizations.some(a=>a.invoice_id===row.id&&!a.cancelled_at&&a.claimed)?'NEEDS_RECOVERY':'NOT_POSTED',paymentStatus:'NOT_SUBMITTED'}})}
 }))
 const prepareAccounting=(db,req,forcePreview=false)=>prepareCarrierAccounting(db,req,forcePreview,{fetcher})
 const preparePayment=(db,req,reservationIgnoreId=null)=>prepareCarrierPayment(db,req,reservationIgnoreId,{fetcher,paymentFetcher})
 app.post('/api/admin/payroll/benefit-carrier-invoices/:id/payment-preview',endpoint(true,preparePayment))
 registerCarrierPaymentAuthorizations(app,pool,preparePayment)
 registerCarrierPaymentDispatch(app,pool,preparePayment,{fetcher:paymentFetcher,now})
 registerCarrierPaymentSchedules(app,pool,{now})
 registerCarrierPremiumPosting(app,pool,prepareAccounting,{fetcher})
 registerCarrierReversalPosting(app,pool,{fetcher})
 app.post('/api/admin/payroll/carrier-reversal-authorizations/:id/reconcile',endpoint(true,(db,req)=>reconcileCarrierPremiumReversal(db,req.canonicalAccess.facilityId,req.params.id,req.body,req.adminId,{fetcher})))
 app.post('/api/admin/payroll/carrier-premium-authorizations/:id/reversal-preview',endpoint(true,(db,req)=>carrierPremiumReversalPreview(db,req.canonicalAccess.facilityId,req.params.id,req.body?.reversalDate,{fetcher})))
 app.post('/api/admin/payroll/carrier-premium-authorizations/:id/reversal-authorizations',endpoint(true,(db,req)=>authorizeCarrierPremiumReversal(db,req.canonicalAccess.facilityId,req.params.id,req.body,req.adminId,{fetcher})))
 app.post('/api/admin/payroll/carrier-reversal-authorizations/:id/cancel',endpoint(true,(db,req)=>cancelCarrierPremiumReversal(db,req.canonicalAccess.facilityId,req.params.id,req.body,req.adminId)))
 app.post('/api/admin/payroll/benefit-carrier-invoices/:id/accounting-check',endpoint(true,async(db,req)=>(await prepareAccounting(db,req)).check))
 const reference=b=>{if(b?.confirmed!==true||typeof b.reference!=='string'||b.reference.trim().length<12||b.reference.length>2000||/[\u0000-\u001f\u007f]/.test(b.reference))throw fail('Confirm this premium journal action and provide its review reference.');return b.reference.trim()}
 app.post('/api/admin/payroll/benefit-carrier-invoices/:id/premium-authorizations',endpoint(true,async(db,req)=>{
  if(typeof req.body?.requestKey!=='string'||!/^[-a-zA-Z0-9]{16,80}$/.test(req.body.requestKey))throw fail('Refresh the premium authorization form.')
  const ref=reference(req.body),{row,check}=await prepareAccounting(db,req,true),preview=check.premiumPreview
  if(req.body.fingerprint!==preview.fingerprint)throw fail('Premium journal facts changed. Refresh and review the preview before authorizing.',409)
  const retry=(await db.query('SELECT a.*,c.authorization_id AS cancelled FROM payroll_carrier_premium_authorization a LEFT JOIN payroll_carrier_premium_cancellation c ON c.authorization_id=a.id WHERE a.invoice_id=$1 AND a.request_key=$2',[row.id,req.body.requestKey])).rows[0]
  if(retry){if(retry.cancelled||retry.fingerprint!==preview.fingerprint||retry.reference!==ref)throw fail('This premium request was cancelled or has different terms. Start a fresh authorization.',409);return {id:retry.id,reused:true}}
  const old=(await db.query('SELECT a.* FROM payroll_carrier_premium_authorization a WHERE invoice_id=$1 AND NOT EXISTS(SELECT 1 FROM payroll_carrier_premium_cancellation c WHERE c.authorization_id=a.id)',[row.id])).rows[0]
  if(old)throw fail('A premium authorization is already retained. Refresh its history before continuing.',409)
  const id=randomUUID();await db.query('INSERT INTO payroll_carrier_premium_authorization(id,invoice_id,preview,fingerprint,reference,created_by,request_key) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,row.id,{...preview,realmId:check.realmId,environment:check.environment},preview.fingerprint,ref,req.adminId,req.body.requestKey])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'CARRIER_PREMIUM_AUTHORIZED','carrier_premium_authorization',$3,$4)",[req.canonicalAccess.facilityId,req.adminId,id,{invoiceId:row.id,fingerprint:preview.fingerprint}]);return {id,reused:false}
 }))
 app.post('/api/admin/payroll/carrier-premium-authorizations/:id/cancel',endpoint(true,async(db,req)=>{
  const ref=reference(req.body)
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id))throw fail('Choose a retained premium authorization.')
  const row=(await db.query('SELECT a.* FROM payroll_carrier_premium_authorization a JOIN payroll_benefit_carrier_invoice i ON i.id=a.invoice_id WHERE i.facility_id=$1 AND a.id=$2',[req.canonicalAccess.facilityId,req.params.id])).rows[0]
  if(!row)throw fail('Premium authorization was not found.',404)
  if((await db.query('SELECT authorization_id FROM payroll_carrier_premium_cancellation WHERE authorization_id=$1',[row.id])).rows.length)return {id:row.id,reused:true}
  if((await db.query('SELECT authorization_id FROM payroll_carrier_premium_claim WHERE authorization_id=$1',[row.id])).rows.length){
   if(!(await db.query('SELECT authorization_id FROM payroll_carrier_premium_no_send WHERE authorization_id=$1',[row.id])).rows.length)throw fail('This premium has a dispatch claim. Recover its outcome before any accounting correction.',409)
   const qbo=(await db.query('SELECT * FROM payroll_quickbooks_connection WHERE facility_id=$1 FOR UPDATE',[req.canonicalAccess.facilityId])).rows[0]
   if(!qbo||qbo.realm_id!==row.preview.realmId||qbo.environment!==row.preview.environment)throw fail('Reconnect the authorized QuickBooks company before cancelling the unsent premium.',409)
   const result=await resolveCarrierPremiumJournal({id:row.id,payload:row.preview.payload},(path,options)=>quickbooksRequest(db,qbo,path,{...options,fetcher}))
   if(result.status!=='NOT_FOUND')throw fail('QuickBooks did not confirm the journal is absent. Recover and review its outcome.',409)
   await db.query('INSERT INTO payroll_carrier_premium_observation(authorization_id,result) VALUES($1,$2)',[row.id,result])
   if(!(await db.query('SELECT payroll_carrier_premium_can_cancel_claim($1) AS allowed',[row.id])).rows[0].allowed)throw fail('Retained journal evidence requires accounting review before correction.',409)
  }
  await db.query('INSERT INTO payroll_carrier_premium_cancellation(authorization_id,reference,created_by) VALUES($1,$2,$3)',[row.id,ref,req.adminId])
  await db.query("UPDATE payroll_alert SET status='DISMISSED',dismissed_at=now() WHERE facility_id=$1 AND dedupe_key=$2 AND status='OPEN'",[req.canonicalAccess.facilityId,`carrier-premium-${row.id}`])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'CARRIER_PREMIUM_CANCELLED','carrier_premium_authorization',$3,$4)",[req.canonicalAccess.facilityId,req.adminId,row.id,{reference:ref}]);return {id:row.id,reused:false}
 }))
 app.post('/api/admin/payroll/benefit-carrier-invoices/:id/documents',endpoint(true,async(db,req)=>{
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id))throw fail('Choose a retained invoice.')
  const facility=req.canonicalAccess.facilityId,invoice=(await db.query('SELECT id FROM payroll_benefit_carrier_invoice WHERE facility_id=$1 AND id=$2',[facility,req.params.id])).rows[0]
  if(!invoice)throw fail('Carrier invoice was not found.',404)
  const file=documentInput(req.body||{}),old=(await db.query('SELECT id FROM payroll_benefit_carrier_document WHERE invoice_id=$1 AND content_hash=$2',[invoice.id,file.hash])).rows[0]
  if(old)return {id:old.id,reused:true}
  const count=(await db.query('SELECT count(*)::int AS total FROM payroll_benefit_carrier_document WHERE invoice_id=$1',[invoice.id])).rows[0].total
  if(count>=20)throw fail('This invoice revision already has 20 supporting documents.',409)
  const id=randomUUID(),encrypted=encryptDocument(file.bytes,`carrier-invoice:${facility}:${invoice.id}:${id}`)
  await db.query('INSERT INTO payroll_benefit_carrier_document(id,invoice_id,filename,mime_type,content_hash,encrypted_content,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,invoice.id,file.filename,file.mime,file.hash,encrypted,req.adminId])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'CARRIER_INVOICE_DOCUMENT_ADDED','benefit_carrier_invoice',$3,$4)",[facility,req.adminId,invoice.id,{documentId:id,contentHash:file.hash}])
  return {id,reused:false}
 }))
 app.get('/api/admin/payroll/benefit-carrier-invoices/:id/documents/:documentId',async(req,res)=>{
  res.setHeader('Cache-Control','no-store')
  try{
   if(![req.params.id,req.params.documentId].every(id=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)))throw fail('Choose a retained invoice document.')
   const row=(await pool.query('SELECT d.* FROM payroll_benefit_carrier_document d JOIN payroll_benefit_carrier_invoice i ON i.id=d.invoice_id WHERE i.facility_id=$1 AND i.id=$2 AND d.id=$3',[req.canonicalAccess.facilityId,req.params.id,req.params.documentId])).rows[0]
   if(!row)throw fail('Carrier invoice document was not found.',404)
   const bytes=decryptDocument(row.encrypted_content,`carrier-invoice:${req.canonicalAccess.facilityId}:${req.params.id}:${row.id}`)
   if(createHash('sha256').update(bytes).digest('hex')!==row.content_hash)throw fail('The retained invoice document needs integrity review.',409)
   res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Type',row.mime_type);res.setHeader('Content-Disposition',`attachment; filename="${row.filename}"`);res.send(bytes)
  }catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to retrieve carrier invoice document.'})}
 })
 app.post('/api/admin/payroll/benefit-carrier-invoices',endpoint(true,async(db,req)=>{
  const facility=req.canonicalAccess.facilityId,invoice=input(req.body||{}),source=await basis(db,facility,invoice.month)
  if(req.body.fingerprint!==source.fingerprint)throw fail('Coverage evidence changed. Reload and reconcile the invoice again.',409)
  const carrier=invoice.carrier.toLowerCase(),number=invoice.invoiceNumber.toLowerCase(),old=(await db.query('SELECT * FROM payroll_benefit_carrier_invoice WHERE facility_id=$1 AND carrier_key=$2 AND invoice_key=$3 ORDER BY revision DESC LIMIT 1',[facility,carrier,number])).rows[0]
  for(const id of invoice.coverageReviewIds||[]){const covered=source.coverage.find(row=>row.current?.id===id);if(!covered||covered.status!=='REVIEWED'||covered.current.review.disposition!=='COVERED'||covered.current.review.carrier.toLowerCase()!==carrier)throw fail('Selected coverage must be current, confirmed and match this carrier.',409)}
  await matchCarrierContributions(db,facility,invoice,source)
  const payloadFingerprint=hash({invoice,source})
  if(old?.payload_fingerprint===payloadFingerprint)return {id:old.id,reused:true}
  if((old?.id||null)!==(req.body.previousId||null))throw fail('This invoice has another saved revision. Reload its current evidence before replacing it.',409)
  if(old&&old.coverage_month!==invoice.month)throw fail('An invoice number already belongs to a different coverage month.',409)
  if(old&&(await db.query('SELECT a.id FROM payroll_carrier_premium_authorization a WHERE a.invoice_id=$1 AND NOT EXISTS(SELECT 1 FROM payroll_carrier_premium_cancellation c WHERE c.authorization_id=a.id) AND NOT EXISTS(SELECT 1 FROM payroll_carrier_premium_correction x WHERE x.premium_authorization_id=a.id)',[old.id])).rows.length)throw fail('Cancel the active premium authorization before revising this invoice.',409)
  if(old)await verifyCarrierCorrectionChain(db,facility,{...old,invoice},{fetcher})
  const id=randomUUID(),revision=Number(old?.revision||0)+1
  await db.query('INSERT INTO payroll_benefit_carrier_invoice(id,facility_id,coverage_month,carrier_key,invoice_key,revision,invoice,source_snapshot,source_fingerprint,payload_fingerprint,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[id,facility,invoice.month,carrier,number,revision,invoice,source,source.fingerprint,payloadFingerprint,req.adminId])
  await db.query("INSERT INTO payroll_audit_log(facility_id,actor_user_id,action,entity_type,entity_id,after_data) VALUES($1,$2,'BENEFIT_CARRIER_INVOICE_RECONCILED','benefit_carrier_invoice',$3,$4)",[facility,req.adminId,id,{month:invoice.month,revision,amountCents:invoice.amountCents}])
  return {id,reused:false}
 }))
}
