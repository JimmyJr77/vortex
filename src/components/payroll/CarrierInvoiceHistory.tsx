import {useState} from 'react'
import {adminApiRequest} from '../../utils/api'
type Event={id:string;kind:number;occurredAt:string;message:string|null;assessment:null|{status:string;invoiceRevision:number;invoiceAmountCents:number;reconciledCents:number;issues:string[];payments:{issues:string[]}[]}}
const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n/100)
export default function CarrierInvoiceHistory({invoiceId}:{invoiceId:string}){
 const [events,setEvents]=useState<Event[]|null>(null),[cursor,setCursor]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const load=async(older=false)=>{
  setBusy(true);setError('')
  try{
   const r=await adminApiRequest(`/api/admin/payroll/benefit-carrier-invoices/${invoiceId}/reconciliation-history${older?`?cursor=${encodeURIComponent(cursor||'')}`:''}`),j=await r.json()
   if(!r.ok)throw new Error(j.message||'Unable to load invoice evidence history.')
   setEvents(previous=>older?[...(previous||[]),...j.data.events]:j.data.events);setCursor(j.data.nextCursor)
  }catch(e){setError(e instanceof Error?e.message:'Unable to load invoice evidence history.')}finally{setBusy(false)}
 }
 return <details className="rounded-lg border p-3"><summary className="cursor-pointer font-bold">All evidence for this invoice revision</summary><section aria-label="Full invoice evidence history" className="mt-3 space-y-3">
  <p>Review retained assessments and failed checks for the selected invoice revision. Loaded pages remain a consistent snapshot; refresh to include newer entries.</p>
  <button type="button" disabled={busy} onClick={()=>void load()} className="rounded-lg border px-3 py-2 font-bold">{events?'Refresh invoice evidence history':'Load invoice evidence history'}</button>
  {error?<p role="alert">{error}</p>:null}
  {events?.length===0?<p>No invoice evidence history retained.</p>:null}
  {events?.map(event=><article key={`${event.kind}:${event.id}`} className="space-y-2 rounded-lg border p-3">
   <h6 className="font-bold">{event.kind===2?'Failed invoice check':event.assessment?.status==='RECONCILED'?'Reconciled invoice assessment':'Open invoice assessment'}</h6><p>{new Date(event.occurredAt).toLocaleString()}</p>
   {event.assessment?<><p>Revision {event.assessment.invoiceRevision} · {money(event.assessment.reconciledCents)} reconciled of {money(event.assessment.invoiceAmountCents)}</p>{[...new Set([...event.assessment.issues,...event.assessment.payments.flatMap(p=>p.issues)])].map(issue=><p key={issue}>{issue}</p>)}</>:<p>{event.message}</p>}
  </article>)}
  {cursor?<button type="button" disabled={busy} onClick={()=>void load(true)} className="rounded-lg border px-3 py-2 font-bold">Load older invoice evidence</button>:null}
  {events?.length&&!cursor?<p>All entries in this snapshot are shown.</p>:null}
 </section></details>
}
