import CarrierAlternateDelivery from './CarrierAlternateDelivery'
import CarrierRemittanceDelivery from './CarrierRemittanceDelivery'
import CarrierRemittanceAdvice from './CarrierRemittanceAdvice'
import CarrierApplication from './CarrierApplication'
import {useState} from 'react'
import {adminApiRequest} from '../../utils/api'
export type CarrierReceipt={id:string;employerName:string;carrier:string;invoiceNumber:string;invoiceRevision:number;amountCents:number;paymentDate:string;mode:string;status:string;createdAt:string;observedAt:string;destination:{holderName:string;accountType:string;accountLast4:string};bankWithdrawals:{transactionId:string;postedDate:string;amountCents:number}[]}
const money=(cents:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100)
export default function CarrierPaymentReceipt({receipt}:{receipt:CarrierReceipt}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('')
 const download=async()=>{setBusy(true);setError('');try{const r=await adminApiRequest(`/api/admin/payroll/carrier-payment-authorizations/${receipt.id}/receipt/download`);if(!r.ok)throw new Error((await r.json()).message||'Unable to download carrier receipt.');const url=URL.createObjectURL(await r.blob()),a=document.createElement('a');a.href=url;a.download=`carrier-payment-${receipt.id}.html`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch(e){setError(e instanceof Error?e.message:'Unable to download carrier receipt.')}finally{setBusy(false)}}
 return <section aria-label="Carrier payment receipt" className="space-y-2 rounded-lg border p-3">
  <h5 className="font-bold">Carrier payment receipt</h5><p role="status">{receipt.status==='BANK_CONFIRMED'?'Retained bank settlement evidence matches':'Receipt needs review — later payment evidence changed'}</p>
  <p className="break-words">{receipt.employerName} · {receipt.carrier} · Invoice {receipt.invoiceNumber}, revision {receipt.invoiceRevision}</p><p>{money(receipt.amountCents)} · Payment date {receipt.paymentDate} · {receipt.mode==='LIVE'?'Live':'Test — synthetic funds'}</p>
  <p className="break-words">{receipt.destination.holderName} · {receipt.destination.accountType} ending {receipt.destination.accountLast4}</p>
  {receipt.bankWithdrawals.map(w=><p key={w.transactionId}>Bank withdrawal {w.postedDate} · {money(w.amountCents)}</p>)}
  <p>Retained {new Date(receipt.createdAt).toLocaleString()}<br/>Last observed {new Date(receipt.observedAt).toLocaleString()}</p><p>Bank evidence does not confirm the carrier applied this payment to the invoice. Review settlement accounting separately.</p>
  <button type="button" disabled={busy} onClick={()=>void download()} className="rounded-lg border px-3 py-2 font-bold">Download carrier payment receipt</button>{error?<p role="alert">{error}</p>:null}
 <CarrierAlternateDelivery paymentId={receipt.id}/>
 <CarrierRemittanceAdvice key={`${receipt.id}:${receipt.status}:${receipt.observedAt}`} paymentId={receipt.id} status={receipt.status}/>
 <CarrierRemittanceDelivery key={`delivery:${receipt.id}`} paymentId={receipt.id} receiptStatus={receipt.status}/>
 <CarrierApplication paymentId={receipt.id} receiptStatus={receipt.status} observedAt={receipt.observedAt}/>
 </section>
}
