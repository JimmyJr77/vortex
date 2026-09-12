import {useId,useRef,useState} from 'react'
import {adminApiRequest} from '../../utils/api'
type Preview={eligible:boolean;reasons:string[];fingerprint:string;attempts:{id:string;outcome:string}[];deliveryRecords:number}
export default function CarrierRemittanceUnsentRelease({base,disabled,onSaved,onBusyChange}:{base:string;disabled:boolean;onSaved:()=>Promise<void>;onBusyChange:(busy:boolean)=>void}){
 const id=useId(),[preview,setPreview]=useState<Preview|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[reference,setReference]=useState(''),[confirmed,setConfirmed]=useState(false)
 const pending=useRef<{body:string;key:string}|null>(null)
 const request=async(path:string,body:object)=>{const response=await adminApiRequest(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),json=await response.json();if(!response.ok||!json.success)throw Object.assign(new Error(json.message||'Unable to review non-send evidence.'),{status:response.status});return json.data}
 const run=async(work:()=>Promise<void>)=>{setBusy(true);onBusyChange(true);setError('');try{await work()}catch(e){if(e instanceof Error&&'status' in e&&e.status===409){setPreview(null);setConfirmed(false)}setError(e instanceof Error?e.message:'Unable to review non-send evidence.')}finally{setBusy(false);onBusyChange(false)}}
 const prepare=()=>run(async()=>{setPreview(null);setConfirmed(false);setPreview(await request(`${base}/preview`,{}))})
 const release=()=>run(async()=>{if(!preview?.eligible)return;const input={fingerprint:preview.fingerprint,reference,confirmed},body=JSON.stringify(input);if(pending.current?.body!==body)pending.current={body,key:crypto.randomUUID()};await request(base,{...input,requestKey:pending.current.key});setPreview(null);setConfirmed(false);await onSaved()})
 return <details className="rounded border p-2"><summary className="cursor-pointer font-bold">Review notice that never sent</summary><section aria-label="Carrier non-send release review" className="mt-2 space-y-3">
  <p>Release requires a completed non-send result for every attempt and no contradictory delivery evidence. It retires this notice permanently. A replacement needs its own current recipient, payment evidence and exact-content authorization.</p>
  <button type="button" disabled={disabled||busy} onClick={()=>void prepare()} className="rounded border px-3 py-2 font-bold">Check non-send release evidence</button>
  {error?<p role="alert">{error}</p>:null}
  {preview?<div className="space-y-2"><p>{preview.attempts.length} retained attempts · {preview.deliveryRecords} matching delivery records checked.</p>{preview.attempts.map(row=><p key={row.id}>Attempt {row.id}: {row.outcome||'No completed result'}</p>)}{preview.reasons.map(reason=><p key={reason}>{reason}</p>)}</div>:null}
  {preview?.eligible?<fieldset disabled={disabled||busy} className="space-y-3"><legend className="font-bold">Release the unsent notice</legend>
   <label htmlFor={`${id}-reference`} className="block">Non-send investigation and release reference</label><textarea id={`${id}-reference`} value={reference} onChange={e=>{setReference(e.target.value);setConfirmed(false)}} maxLength={2000} className="block w-full rounded border p-2"/>
   <label htmlFor={`${id}-confirmed`} className="flex items-start gap-2"><input id={`${id}-confirmed`} type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>I reviewed all non-send evidence and authorize permanent release of this notice before any separate replacement.</span></label>
   <button type="button" disabled={!confirmed||reference.trim().length<12} onClick={()=>void release()} className="rounded border px-3 py-2 font-bold">Release unsent remittance notice</button>
  </fieldset>:null}
 </section></details>
}
