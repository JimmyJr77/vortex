import {useId,useRef,useState} from 'react'
import {adminApiRequest} from '../../utils/api'
type Preview={fingerprint:string;recipient:{name:string;email:string;revision:number};sourceEventIds:string[];targetEventIds:string[]}
export default function CarrierRemittanceReturnReview({base,disabled,onSaved,onBusyChange}:{base:string;disabled:boolean;onBusyChange:(busy:boolean)=>void;onSaved:()=>Promise<void>}){
 const id=useId(),[preview,setPreview]=useState<Preview|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[reference,setReference]=useState(''),[requested,setRequested]=useState(false),[confirmed,setConfirmed]=useState(false)
 const pending=useRef<{body:string;key:string}|null>(null)
 const request=async(path:string,body:object)=>{const response=await adminApiRequest(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),json=await response.json();if(!response.ok||!json.success)throw Object.assign(new Error(json.message||'Unable to retain return review.'),{status:response.status});return json.data}
 const run=async(work:()=>Promise<void>)=>{setBusy(true);onBusyChange(true);setError('');try{await work()}catch(e){if(e instanceof Error&&'status' in e&&e.status===409){setPreview(null);setConfirmed(false);setRequested(false)}setError(e instanceof Error?e.message:'Unable to retain return review.')}finally{setBusy(false);onBusyChange(false)}}
 const prepare=()=>run(async()=>{setPreview(null);setConfirmed(false);setRequested(false);setPreview(await request(`${base}/preview`,{}))})
 const save=()=>run(async()=>{if(!preview)return;const input={fingerprint:preview.fingerprint,reference,confirmed,recipientRequestedDelivery:requested},body=JSON.stringify(input);if(pending.current?.body!==body)pending.current={body,key:crypto.randomUUID()};await request(base,{...input,requestKey:pending.current.key});setPreview(null);setConfirmed(false);setRequested(false);await onSaved()})
 return <details className="rounded border p-2"><summary className="cursor-pointer font-bold">Review returned notice</summary><section aria-label="Carrier returned notice review" className="mt-2 space-y-3">
  <p>Investigate the return and save a fresh contact review in the invoice payment review. Confirm the carrier requested delivery to that address, including permission to resume after a complaint. This review retires the original notice and permits a separate replacement authorization.</p>
  <button type="button" disabled={disabled||busy} onClick={()=>void prepare()} className="rounded border px-3 py-2 font-bold">Preview return resolution</button>
  {error?<p role="alert">{error}</p>:null}
  {preview?<fieldset disabled={disabled||busy} className="space-y-3"><legend className="font-bold">Return resolution to review</legend><p className="break-words">{preview.recipient.name} · {preview.recipient.email} · Recipient revision {preview.recipient.revision}</p><p>{preview.sourceEventIds.length} original notice return events. {preview.targetEventIds.length} retained return events for the proposed address are included in this review.</p>
   <p>Clearance applies to this employer’s current contact revision and the displayed evidence. A later return requires another review. No message is sent by saving this review.</p>
   <label htmlFor={`${id}-reference`} className="block">Return investigation and carrier request reference</label><textarea id={`${id}-reference`} value={reference} onChange={e=>{setReference(e.target.value);setConfirmed(false)}} maxLength={2000} className="block w-full rounded border p-2"/>
   <label htmlFor={`${id}-requested`} className="flex items-start gap-2"><input id={`${id}-requested`} type="checkbox" checked={requested} onChange={e=>{setRequested(e.target.checked);setConfirmed(false)}}/><span>The carrier requested remittance delivery to this reviewed address after the return was investigated.</span></label>
   <label htmlFor={`${id}-confirmed`} className="flex items-start gap-2"><input id={`${id}-confirmed`} type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>I confirm this return resolution and retire the original notice before a separate replacement authorization.</span></label>
   <button type="button" disabled={!requested||!confirmed||reference.trim().length<12} onClick={()=>void save()} className="rounded border px-3 py-2 font-bold">Retain return resolution</button>
  </fieldset>:null}
 </section></details>
}
