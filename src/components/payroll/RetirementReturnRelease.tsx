import {useEffect,useRef,useState} from 'react'
import {adminApiRequest} from '../../utils/api'
type Preview={fingerprint:string;realmId:string;environment:string;journals:{journalId:string;documentNumber:string;status:string}[]}
export default function RetirementReturnRelease({id,evidenceKey,onChanged}:{id:string;evidenceKey:string;onChanged:()=>void}){
 const [preview,setPreview]=useState<Preview|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[reference,setReference]=useState(''),[confirmed,setConfirmed]=useState(false),[retry,setRetry]=useState(false)
 const pending=useRef<Record<string,unknown>|null>(null),path=`/api/admin/payroll/retirement-return-authorizations/${id}`
 useEffect(()=>{if(!pending.current){setPreview(null);setConfirmed(false)}},[evidenceKey])
 const request=async(suffix:string,body:unknown)=>{const r=await adminApiRequest(`${path}/${suffix}`,{method:'POST',body:JSON.stringify(body)}),j=await r.json();if(!r.ok||!j.success)throw Object.assign(new Error(j.message||'Unable to verify return accounting release.'),{status:r.status});return j.data}
 const load=async()=>{setBusy(true);setPreview(null);setConfirmed(false);setError('');try{setPreview(await request('release-preview',{}))}catch(e){setError(e instanceof Error?e.message:'Unable to review release.')}finally{setBusy(false)}}
 const release=async()=>{
  setBusy(true);setError('')
  try{
   if(!pending.current){if(!preview||!confirmed)throw new Error('Review the exact non-send evidence first.');pending.current={fingerprint:preview.fingerprint,reference,confirmed:true,outsideActivityReviewed:true}}
   await request('release-unsent',pending.current);pending.current=null;setRetry(false);setPreview(null);setConfirmed(false);onChanged()
  }catch(e){
   if(e&&typeof e==='object'&&'status'in e&&Number(e.status)>=400&&Number(e.status)<500){pending.current=null;setPreview(null);setConfirmed(false)}
   setRetry(!!pending.current);setError(e instanceof Error?e.message:'Retry the original release to recover its outcome.')
  }finally{setBusy(false)}
 }
 return <section aria-label={`Unsent return accounting release ${id}`} className="space-y-2 rounded border p-3">
  <h4 className="font-bold">Release an unsent return journal</h4><p>Review original non-send evidence and fresh QuickBooks absence. Release cancels this return accounting authorization; a replacement requires a new reviewed approval.</p>
  <button type="button" disabled={busy||retry} className="rounded border px-3 py-2" onClick={()=>void load()}>Review unsent retirement return accounting</button>
  {error?<p role="alert">{error}</p>:null}
  {preview?<><p>Original company: {preview.realmId} · {preview.environment}</p><ul>{preview.journals.map(j=><li key={j.journalId} className="break-words">{j.documentNumber}: absence verified</li>)}</ul><label className="block">Unsent return accounting release reason<textarea className="block w-full rounded border p-2" disabled={busy||retry} maxLength={2000} value={reference} onChange={e=>{setReference(e.target.value);setConfirmed(false)}}/></label><label className="flex gap-2"><input type="checkbox" disabled={busy||retry} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I reviewed this exact non-send evidence and verified no outside accounting activity.</label><button type="button" disabled={busy||retry||!confirmed||reference.trim().length<12} className="rounded border px-3 py-2" onClick={()=>void release()}>Release unsent retirement return accounting</button></>:null}
  {retry?<button type="button" disabled={busy} className="rounded border px-3 py-2" onClick={()=>void release()}>Retry original return accounting release</button>:null}
 </section>
}
