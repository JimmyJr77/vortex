import {createHash} from 'node:crypto'
import {readCarrierPaymentReceipt} from './carrierPaymentReceipt.js'
const fail=(message,status=409)=>Object.assign(new Error(message),{status})
const clean=(value,label)=>{if(typeof value!=='string'||!value.trim()||value.length>500||/[\u0000-\u001f\u007f]/.test(value))throw fail(`Review the ${label} before preparing remittance advice.`);return value.trim()}
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value)
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
// Deliberately allowlisted carrier-facing content: no employee records, bank
// account details, provider payloads or internal accounting/review references.
export function carrierRemittanceAdvice(receipt){
 if(receipt?.status!=='BANK_CONFIRMED')throw fail('Current bank settlement evidence must match before preparing remittance advice.')
 const employer=clean(receipt.employerName,'employer name'),carrier=clean(receipt.carrier,'carrier name'),invoice=clean(receipt.invoiceNumber,'invoice number')
 if(employer==='Not recorded'||!uuid(receipt.id)||!uuid(receipt.invoiceId)||!Number.isSafeInteger(receipt.invoiceRevision)||receipt.invoiceRevision<1||!Number.isSafeInteger(receipt.amountCents)||receipt.amountCents<=0||!date(receipt.paymentDate)||!['LIVE','TEST'].includes(receipt.mode))throw fail('The carrier receipt is missing valid payment or invoice details.')
 const withdrawals=receipt.bankWithdrawals
 if(!Array.isArray(withdrawals)||!withdrawals.length||withdrawals.some(w=>!date(w.postedDate)||!Number.isSafeInteger(w.amountCents)||w.amountCents<=0)||withdrawals.reduce((sum,w)=>sum+w.amountCents,0)!==receipt.amountCents)throw fail('Bank withdrawal amounts must match the retained payment before preparing remittance advice.')
 if(!Number.isSafeInteger(receipt.sourceObservationId)||receipt.sourceObservationId<1||!Number.isFinite(Date.parse(receipt.observedAt)))throw fail('The carrier receipt is missing a valid bank observation time.')
 const money=c=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(c/100)
 const subject=`${receipt.mode==='TEST'?'TEST — ':''}Remittance advice: ${invoice}`
 const text=[receipt.mode==='TEST'?'TEST REMITTANCE ADVICE — SYNTHETIC FUNDS':'REMITTANCE ADVICE',`From: ${employer}\nTo: ${carrier}`,`Invoice: ${invoice}\nPayment amount: ${money(receipt.amountCents)}\nPayment date: ${receipt.paymentDate}\nPayment reference: ${receipt.id}`,`Bank withdrawals:\n${withdrawals.map(w=>`${w.postedDate}: ${money(w.amountCents)}`).join('\n')}`,`Please identify this payment using the reference above and confirm its application to the invoice. This advice covers this payment only; it does not state that the invoice is paid in full.`,`Prepared from retained bank settlement evidence last observed ${new Date(receipt.observedAt).toISOString()}. This document does not establish carrier receipt, application of funds, or the current invoice balance.`].join('\n\n')
 const basis={version:1,paymentId:receipt.id,invoiceId:receipt.invoiceId,invoiceRevision:receipt.invoiceRevision,sourceObservationId:receipt.sourceObservationId,observedAt:new Date(receipt.observedAt).toISOString(),subject,text}
 return {...basis,fingerprint:createHash('sha256').update(JSON.stringify(basis)).digest('hex')}
}
export function carrierRemittanceAdviceHtml(advice){
 return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(advice.subject)}</title><style>body{font:16px system-ui;margin:2rem auto;padding:0 1rem;max-width:48rem;color:#172033}h1{font-size:1.6rem;overflow-wrap:anywhere}p{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.5}@media print{body{margin:0}}</style><body><h1>Carrier remittance advice</h1>${advice.text.split('\n\n').map(p=>`<p>${escape(p)}</p>`).join('')}</body></html>`
}
export function registerCarrierRemittanceAdviceRoutes(app,pool){
 const serve=download=>async(req,res)=>{
  res.setHeader('Cache-Control','no-store')
  try{
   if(!uuid(req.params.id))throw fail('Choose a carrier payment.',400)
   const receipt=await readCarrierPaymentReceipt(pool,req.canonicalAccess.facilityId,req.params.id)
   if(!receipt)throw fail('No retained carrier payment receipt was found.',404)
   const advice=carrierRemittanceAdvice(receipt)
   if(!download)return res.json({success:true,data:advice})
   if(req.query.fingerprint!==advice.fingerprint)throw fail('Payment evidence changed or no preview was supplied. Refresh remittance advice before downloading.')
   res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Content-Disposition',`attachment; filename="carrier-remittance-${req.params.id}.html"`);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; sandbox");res.send(carrierRemittanceAdviceHtml(advice))
  }catch(e){res.status(e.status||500).json({success:false,message:e.status?e.message:'Unable to prepare carrier remittance advice.'})}
 }
 const base='/api/admin/payroll/carrier-payment-authorizations/:id/remittance-advice'
 app.get(base,serve(false));app.get(`${base}/download`,serve(true))
}
