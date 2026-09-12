import {useCallback,useEffect,useRef,useState} from 'react'
import {adminApiRequest} from '../../utils/api'
type Entry={key:string;category:'ORIGINAL'|'STOP'|'CANCELLATION';source:string;observedAt:string;status:string|null;checkStatus:string|null;attempt:number;paidObserved:boolean;identityMismatch:boolean;conflictingEvidence:boolean;dateMatches:boolean|null;expiryMatches:boolean|null;liveMode:boolean|null;reconciliationStatus:string|null;settlementStatus:string|null;requestSent:boolean|null}
type Evidence={paymentDate:string;amountCents:number;entries:Entry[];nextCursor:string|null}
const label=(value:string|null)=>value?value.toLowerCase().replaceAll('_',' ').replace(/^./,c=>c.toUpperCase()):'Not recorded'
const category={ORIGINAL:'Original check',STOP:'Bank stop',CANCELLATION:'Check cancellation'}
export default function CheckEvidenceHistory({base}:{base:string}){
 const [open,setOpen]=useState(false),[data,setData]=useState<Evidence|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const revision=useRef(0)
 const load=useCallback(async(cursor?:string)=>{
  const current=++revision.current;setBusy(true);setError('')
  try{const response=await adminApiRequest(`${base}/evidence${cursor?`?cursor=${encodeURIComponent(cursor)}`:''}`),json=await response.json();if(current!==revision.current)return;if(!response.ok)throw new Error(json.message||'Unable to load check evidence.');const next=json.data as Evidence;setData(previous=>cursor&&previous?{...next,entries:[...previous.entries,...next.entries]}:next)}catch(e){if(current===revision.current)setError(e instanceof Error?e.message:'Unable to load check evidence.')}finally{if(current===revision.current)setBusy(false)}
 },[base])
 const invalidate=useCallback(()=>{revision.current++},[])
 useEffect(()=>{setData(null);setError('');if(open)void load();return invalidate},[base,open,load,invalidate])
 return <details onToggle={e=>setOpen(e.currentTarget.open)} className="rounded border p-3"><summary className="font-bold">Retained check evidence</summary><section aria-label="Retained check evidence" className="mt-3 space-y-3" aria-busy={busy}>
  <p>Recorded observations, newest first. These are historical facts, not authorization for another payment. Use recovery controls to obtain a newer provider result.</p>
  <button type="button" disabled={busy} onClick={()=>void load()} className="font-bold underline disabled:opacity-50">Refresh check evidence</button>
  {error?<p role="alert" className="text-red-700">{error}{data?' Previously loaded observations remain below.':''}</p>:null}
  {data?<><p>Original pay date: {data.paymentDate} · {(data.amountCents/100).toLocaleString('en-US',{style:'currency',currency:'USD'})}</p><ol className="space-y-3">{data.entries.map(entry=><li key={entry.key} className="space-y-1 rounded border p-2 break-words">
   <h6 className="font-bold">{category[entry.category]} · {label(entry.source)}{entry.category!=='ORIGINAL'?` · Attempt ${entry.attempt}`:''}</h6><p><time dateTime={entry.observedAt}>{new Date(entry.observedAt).toLocaleString(undefined,{timeZoneName:'short'})}</time></p>
   <p>Result: {label(entry.status)}</p>{entry.category!=='ORIGINAL'?<p>Original check: {label(entry.checkStatus)}</p>:null}
   {entry.paidObserved?<p className="font-semibold">Provider reported paid or reconciled.</p>:null}{entry.identityMismatch?<p className="font-semibold">Provider identity did not match the retained check.</p>:null}{entry.conflictingEvidence?<p>Stopped, returned or conflicting check facts were observed.</p>:null}
   {entry.settlementStatus?<p>Bank evidence: {label(entry.settlementStatus)}</p>:null}{entry.reconciliationStatus?<p>Reconciliation: {label(entry.reconciliationStatus)}</p>:null}
   {entry.dateMatches===false?<p>Payment date did not match.</p>:null}{entry.expiryMatches===false?<p>Expiration did not match.</p>:null}{entry.liveMode===false?<p>Provider test-mode record.</p>:null}
   {entry.requestSent!==null?<p>Stop/cancellation update sent in this step: {entry.requestSent?'Yes':'No'}</p>:null}
  </li>)}</ol>{data.entries.length===0?<p>No retained provider observations.</p>:null}{data.nextCursor?<button type="button" disabled={busy} onClick={()=>void load(data.nextCursor!)} className="font-bold underline disabled:opacity-50">Load older check evidence</button>:<p>End of retained observations.</p>}</>:busy?<p role="status">Loading check evidence…</p>:null}
 </section></details>
}
