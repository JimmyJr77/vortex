import CarrierSettlementAuthorization from './CarrierSettlementAuthorization'
import {useState} from 'react'
import {adminApiRequest} from '../../utils/api'
type Preview={fingerprint:string;realmId:string;environment:string;amountCents:number;premiumJournalId:string;mappingId:number;accounts:{bank:{name:string};liability:{name:string}};journals:{event:{key:string;amountCents:number;postedDate:string};payload:{DocNumber:string};period:{bookCloseDate:string|null}}[]}
const money=(cents:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100)
export default function CarrierSettlementPreview({authorizationId}:{authorizationId:string}){
 const [preview,setPreview]=useState<Preview|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const review=async()=>{setBusy(true);setPreview(null);setError('');try{const r=await adminApiRequest(`/api/admin/payroll/carrier-payment-authorizations/${authorizationId}/settlement-preview`,{method:'POST',body:'{}'}),j=await r.json();if(!r.ok)throw new Error(j.message||'Unable to verify settlement.');setPreview(j.data)}catch(e){setError(e instanceof Error?e.message:'Unable to verify settlement.')}finally{setBusy(false)}}
 return <section aria-label="Carrier bank accounting review" className="space-y-2 rounded-lg border p-3">
  <h5 className="font-bold">Carrier bank accounting review</h5><p>Review fresh bank withdrawals against the premium journal and retained settlement accounts.</p>
  <button type="button" disabled={busy} onClick={()=>void review()} className="rounded-lg border px-3 py-2 font-bold">{busy?'Checking bank and accounting evidence…':'Review carrier bank settlement'}</button>
  {error?<p role="alert" className="text-red-700">{error}</p>:null}
  {preview?<div role="status" className="space-y-2"><p>Verified withdrawal preview: {money(preview.amountCents)} · Company {preview.realmId} · {preview.environment}</p><p>Premium journal {preview.premiumJournalId} · Mapping {preview.mappingId}</p><p className="break-words">Debit {preview.accounts.liability.name}; credit {preview.accounts.bank.name}.</p>{preview.journals.map(j=><div key={j.event.key} className="rounded-lg bg-slate-50 p-2"><p>{j.event.postedDate} · {money(j.event.amountCents)}</p><p className="break-words">{j.payload.DocNumber}</p><p>{j.period.bookCloseDate?`Books closed through ${j.period.bookCloseDate}; withdrawal date is open.`:'Withdrawal date is in an open accounting period.'}</p></div>)}<p>This is a point-in-time review. No settlement journal has been posted by this action.</p></div>:null}
 <CarrierSettlementAuthorization paymentId={authorizationId} fingerprint={preview?.fingerprint} onSaved={()=>setPreview(null)}/>
 </section>
}
