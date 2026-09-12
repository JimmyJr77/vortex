import {createHash} from 'node:crypto'
import {carrierSettlementEvents} from './carrierSettlementJournal.js'
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value
const hash=value=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')
export function carrierReceiptBankFingerprint(result){
 if(result?.status!=='COMPLETED'||result.settlementStatus!=='BANK_POSTED'||result.reconciliationStatus!=='reconciled'||result.dateMatches!==true||!Array.isArray(result.transactionIds)||!Array.isArray(result.settlementEvidence))return null
 try{return hash({providerId:result.providerId,externalId:result.externalId,effectiveDate:result.effectiveDate,liveMode:result.liveMode,transactionIds:[...result.transactionIds].sort(),settlementEvidence:result.settlementEvidence.map(e=>({transactionId:e.transactionId,postedDate:e.postedDate,amountCents:e.amountCents,lineItems:e.lineItems.map(l=>({id:l.id,amountCents:l.amountCents})).sort((a,b)=>a.id.localeCompare(b.id))})).sort((a,b)=>a.transactionId.localeCompare(b.transactionId))})}catch{return null}
}
export function carrierPaymentReceiptData(intent,preview,result){
 const events=carrierSettlementEvents(intent,result),bankFingerprint=carrierReceiptBankFingerprint(result)
 if(!bankFingerprint||preview.invoiceId!==intent.invoiceId||preview.invoiceRevision!==intent.invoiceRevision||preview.amountCents!==intent.amountCents||preview.paymentDate!==intent.paymentDate||!preview.destination?.accountLast4)throw new Error('Receipt requires exact authorized carrier payment details.')
 return {version:1,id:intent.id,invoiceId:intent.invoiceId,invoiceRevision:intent.invoiceRevision,invoiceNumber:preview.invoiceNumber,carrier:preview.carrier,amountCents:intent.amountCents,paymentDate:intent.paymentDate,mode:intent.mode,destination:preview.destination,bankWithdrawals:events.map(e=>({transactionId:e.transactionId,postedDate:e.postedDate,amountCents:e.amountCents})),bankFingerprint,sourceResult:result}
}
export async function retainCarrierPaymentReceipt(db,facility,authorization,intent){
 if(!intent||(await db.query('SELECT authorization_id FROM payroll_carrier_payment_receipt WHERE authorization_id=$1',[authorization.id])).rows.length)return null
 const source=(await db.query("SELECT id,result FROM payroll_carrier_payment_observation WHERE authorization_id=$1 AND result->>'status'='COMPLETED' AND result->>'settlementStatus'='BANK_POSTED' AND result->>'reconciliationStatus'='reconciled' AND result->>'dateMatches'='true' ORDER BY id LIMIT 1",[authorization.id])).rows[0]
 if(!source)return null
 const result=source.result,observationId=Number(source.id)
 const receipt={...carrierPaymentReceiptData(intent,authorization.preview,result),employerName:(await db.query('SELECT legal_business_name FROM payroll_settings WHERE facility_id=$1',[facility])).rows[0]?.legal_business_name||'Not recorded'}
 const saved=(await db.query('INSERT INTO payroll_carrier_payment_receipt(authorization_id,facility_id,observation_id,receipt,fingerprint) VALUES($1,$2,$3,$4,$5) ON CONFLICT(authorization_id) DO NOTHING RETURNING authorization_id',[authorization.id,facility,observationId,receipt,hash(receipt)])).rows[0]
 return saved?.authorization_id||null
}
export async function readCarrierPaymentReceipt(db,facility,id){
 const row=(await db.query('SELECT r.receipt,r.fingerprint,r.created_at,r.observation_id,(SELECT result FROM payroll_carrier_payment_observation WHERE authorization_id=r.authorization_id ORDER BY id DESC LIMIT 1) AS latest_result,(SELECT created_at FROM payroll_carrier_payment_observation WHERE authorization_id=r.authorization_id ORDER BY id DESC LIMIT 1) AS observed_at FROM payroll_carrier_payment_receipt r WHERE r.authorization_id=$1 AND r.facility_id=$2',[id,facility])).rows[0]
 if(!row)return null
 const {sourceResult,bankFingerprint,...receipt}=row.receipt
 return {...receipt,status:hash(row.receipt)===row.fingerprint&&carrierReceiptBankFingerprint(row.latest_result)===bankFingerprint?'BANK_CONFIRMED':'NEEDS_REVIEW',createdAt:row.created_at,observedAt:row.observed_at,sourceObservationId:Number(row.observation_id)}
}
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
export function carrierPaymentReceiptHtml(r){
 const money=c=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(c/100)
 const rows=[['Employer',r.employerName],['Carrier',r.carrier],['Invoice',`${r.invoiceNumber} · Revision ${r.invoiceRevision}`],['Amount',money(r.amountCents)],['Payment date',r.paymentDate],['Environment',r.mode==='LIVE'?'Live':'Test — synthetic funds'],['Destination',`${r.destination.holderName} · ${r.destination.accountType} ending ${r.destination.accountLast4}`],['Current evidence',r.status==='BANK_CONFIRMED'?'Bank settlement evidence matches':'Needs review — later payment evidence changed'],...r.bankWithdrawals.map(w=>['Bank withdrawal',`${w.postedDate} · ${money(w.amountCents)}`]),['Receipt',r.id],['Retained',new Date(r.createdAt).toISOString()],['Last observed',new Date(r.observedAt).toISOString()]]
 return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Carrier payment receipt</title><style>body{font:16px system-ui;margin:2rem auto;padding:0 1rem;max-width:48rem;color:#172033}h1{font-size:1.6rem}dl{display:grid;grid-template-columns:minmax(7rem,1fr) 2fr;gap:1rem}dt{font-weight:700}dd{margin:0;overflow-wrap:anywhere}@media(max-width:440px){dl{display:block}dd{margin:.3rem 0 1rem}}@media print{body{margin:0}}</style><body><h1>Carrier payment receipt</h1><dl>${rows.map(([label,value])=>`<dt>${escape(label)}</dt><dd>${escape(value)}</dd>`).join('')}</dl><p>This receipt records retained bank settlement evidence. It does not confirm that the carrier applied the payment to the invoice or that accounting is reconciled. Current status reflects the latest retained observation; review Payroll for later changes.</p></body></html>`
}
export function registerCarrierPaymentReceiptRoutes(app,pool){
 const serve=download=>async(req,res)=>{
  res.setHeader('Cache-Control','no-store')
  try{if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(req.params.id))return res.status(400).json({success:false,message:'Choose a carrier payment receipt.'})
   const receipt=await readCarrierPaymentReceipt(pool,req.canonicalAccess.facilityId,req.params.id)
   if(!receipt)return res.status(404).json({success:false,message:'No retained bank-confirmed carrier receipt was found.'})
   if(!download)return res.json({success:true,data:receipt})
   res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Content-Disposition',`attachment; filename="carrier-payment-${receipt.id}.html"`);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; sandbox");return res.send(carrierPaymentReceiptHtml(receipt))
  }catch{res.status(500).json({success:false,message:'Unable to read retained carrier receipt.'})}
 }
 app.get('/api/admin/payroll/carrier-payment-authorizations/:id/receipt',serve(false));app.get('/api/admin/payroll/carrier-payment-authorizations/:id/receipt/download',serve(true))
}
