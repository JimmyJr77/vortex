import {useRef,useState} from 'react'
import {adminApiRequest} from '../../utils/api'
type Review={id:string;status:string;federal_wages_cents:string;maryland_wages_cents:string;evidence_reference:string;created_by:string;created_at:string}
type Source={sourceFingerprint:string;paymentDate:string;grossWagesCents:number;federalWithholdingCents:number;marylandWithholdingCents:number;reviews:Review[]}
const dollars=(cents:number|string)=>`$${(Number(cents)/100).toFixed(2)}`
const parseCents=(value:string)=>{if(!/^\d+(\.\d{1,2})?$/.test(value))return null;const [whole,fraction='']=value.split('.');const amount=Number(whole)*100+Number(fraction.padEnd(2,'0'));return Number.isSafeInteger(amount)?amount:null}
const input='mt-1 block w-full rounded-lg border border-slate-300 p-2 font-normal'
export default function IncomeTaxBasisReview({runId,employeeId}:{runId:number;employeeId:number}){
 const [source,setSource]=useState<Source|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('')
 const [federal,setFederal]=useState(''),[maryland,setMaryland]=useState(''),[reference,setReference]=useState(''),[confirmed,setConfirmed]=useState(false)
 const requestKey=useRef<string|null>(null)
 const path=`/api/admin/payroll/runs/${runId}/employees/${employeeId}/income-tax-basis`
 const reset=()=>{requestKey.current=null;setConfirmed(false);setMessage('')}
 const load=async()=>{
  setBusy(true);setSource(null);setError('');reset();setFederal('');setMaryland('');setReference('')
  try{const response=await adminApiRequest(path),json=await response.json();if(!response.ok)throw new Error(json.message||'Unable to load wage review.');setSource(json.data)}catch(e){setError(e instanceof Error?e.message:'Unable to load wage review.')}finally{setBusy(false)}
 }
 const federalCents=parseCents(federal),marylandCents=parseCents(maryland)
 const valid=source&&federalCents!==null&&marylandCents!==null&&federalCents<=source.grossWagesCents&&marylandCents<=source.grossWagesCents&&reference.trim().length>=12&&confirmed
 const save=async()=>{
  if(!valid||!source)return
  setBusy(true);setError('');setMessage('');requestKey.current??=crypto.randomUUID()
  try{
   const response=await adminApiRequest(path,{method:'POST',body:JSON.stringify({sourceFingerprint:source.sourceFingerprint,federalWagesCents:federalCents,marylandWagesCents:marylandCents,evidenceReference:reference,confirmed,requestKey:requestKey.current})}),json=await response.json()
   if(!response.ok){if(response.status===409){setSource(null);setConfirmed(false)}throw new Error(json.message||'Unable to save wage review.')}
   await load();setMessage('Wage review saved. Refresh the wage-basis report to see the reviewed totals.')
  }catch(e){setError(e instanceof Error?e.message:'Unable to save wage review.')}finally{setBusy(false)}
 }
 return <section aria-label="Review finalized income-tax wages" className="mt-4 space-y-3 border-t border-slate-200 pt-3 text-sm">
  <button type="button" disabled={busy} onClick={()=>void load()} className="rounded-lg border border-slate-300 px-3 py-2 font-bold disabled:opacity-50">{busy?'Working…':source?'Refresh income-tax wage review':'Review income-tax wages'}</button>
  {error?<p role="alert" className="text-red-700">{error}</p>:null}{message?<p role="status" className="text-emerald-800">{message}</p>:null}
  {source?<><p>Paid {source.paymentDate} · Gross wages {dollars(source.grossWagesCents)}. Recorded withholding: federal {dollars(source.federalWithholdingCents)}, Maryland {dollars(source.marylandWithholdingCents)}.</p>
   <p>Record wage inputs from your reviewed calculation. This adds a separate review for reports and preserves the paid statement. Supported scope: 2026 Maryland residents working in Maryland.</p>
   <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2"><legend className="mb-2 font-bold">Reviewed wage inputs</legend>
    <label className="font-semibold">Federal wages ($)<input inputMode="decimal" value={federal} onChange={e=>{reset();setFederal(e.target.value)}} className={input}/></label>
    <label className="font-semibold">Maryland wages ($)<input inputMode="decimal" value={maryland} onChange={e=>{reset();setMaryland(e.target.value)}} className={input}/></label>
    <label className="font-semibold sm:col-span-2">Wage calculation reference<textarea maxLength={2000} value={reference} onChange={e=>{reset();setReference(e.target.value)}} className={input} placeholder="Worksheet or provider reference, reviewer and date"/></label>
    <label className="flex items-start gap-2 sm:col-span-2"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I verified these wage inputs against the calculation source for this paid payroll.</label>
    <p className="text-slate-600 sm:col-span-2">Enter amounts from zero through gross wages, with up to two decimal places. Include a calculation reference of at least 12 characters.</p>
    <button type="button" disabled={!valid} onClick={()=>void save()} className="rounded-lg bg-slate-900 px-3 py-2 font-bold text-white disabled:opacity-50">Save income-tax wage review</button>
   </fieldset>
   <div className="space-y-2"><h5 className="font-bold">Wage review history</h5>{!source.reviews.length?<p>No wage reviews recorded.</p>:source.reviews.map(review=><article key={review.id} className="break-words rounded-lg bg-slate-50 p-3"><p className="font-bold">{review.status} · Review {review.id}</p><p>Federal {dollars(review.federal_wages_cents)} · Maryland {dollars(review.maryland_wages_cents)}</p><p>{review.evidence_reference}</p><p className="text-xs text-slate-500">Reviewer {review.created_by} · {new Date(review.created_at).toLocaleString()}</p></article>)}</div>
  </>:null}
 </section>
}
