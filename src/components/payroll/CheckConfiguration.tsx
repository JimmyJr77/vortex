import {useEffect,useState} from 'react'
import {adminApiRequest} from '../../utils/api'
type Revision={id:string;connection_id:string;enabled:boolean;expiry_days:number;activation_reference:string;created_at:string}
type Configuration={revision:number;connectionId:number;mode:string|null;status:string;current:Revision|null;history:Revision[]}
export default function CheckConfiguration(){
 const [data,setData]=useState<Configuration|null>(null),[enabled,setEnabled]=useState(false),[expiryDays,setExpiryDays]=useState('90'),[reference,setReference]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('')
 const apply=(value:Configuration)=>{setData(value);setEnabled(value.current?.enabled||false);setExpiryDays(String(value.current?.expiry_days||90));setReference('');setConfirmed(false)}
 useEffect(()=>{let active=true;void (async()=>{try{const response=await adminApiRequest('/api/admin/payroll/check-configuration'),json=await response.json();if(!response.ok)throw new Error(json.message);if(active)apply(json.data)}catch(e){if(active)setError(e instanceof Error?e.message:'Unable to read check configuration.')}finally{if(active)setBusy(false)}})();return()=>{active=false}},[])
 const refresh=async()=>{setBusy(true);setData(null);setConfirmed(false);setError('');try{const response=await adminApiRequest('/api/admin/payroll/check-configuration'),json=await response.json();if(!response.ok)throw new Error(json.message);apply(json.data)}catch(e){setError(e instanceof Error?e.message:'Unable to read check configuration.')}finally{setBusy(false)}}
 const save=async()=>{if(!data||busy||!confirmed)return;setBusy(true);setError('');setNotice('');try{const response=await adminApiRequest('/api/admin/payroll/check-configuration',{method:'POST',body:JSON.stringify({expectedRevision:data.revision,connectionId:data.connectionId,enabled,expiryDays:Number(expiryDays),activationReference:reference,confirmed})}),json=await response.json();if(!response.ok)throw new Error(json.message);await refresh();setNotice('Check configuration saved. No check has been issued.')}catch(e){setError(e instanceof Error?e.message:'Unable to save check configuration.')}finally{setBusy(false);setConfirmed(false)}}
 return <section aria-busy={busy} aria-label="Payroll check configuration" className="space-y-4 rounded-2xl border bg-white p-5">
  <h2 className="text-lg font-bold">Check payment setup</h2>
  <p className="text-sm text-slate-600">Record digital-check activation arranged with Modern Treasury for your funding account. Funding verification confirms account access; check activation is your recorded confirmation. Check issuance and delivery are still being connected.</p>
  {error?<p role="alert" className="text-red-700">{error}</p>:null}{notice?<p role="status" className="text-emerald-800">{notice}</p>:null}
  <button type="button" disabled={busy} className="font-bold underline" onClick={()=>void refresh()}>Refresh check setup</button>
  {data?<><p>Status: {data.status.replaceAll('_',' ')}{data.mode?` · ${data.mode}`:''}</p>
   {!data.connectionId?<p>Save and verify the employer payment connection above first.</p>:null}
   {data.status==='CONNECTION_CHANGED'?<p role="alert">The funding connection changed. Confirm activation for the current account before using checks.</p>:null}
   <fieldset disabled={busy||!data.connectionId} className="space-y-3"><legend className="font-semibold">Employer check activation</legend>
    <label className="flex items-start gap-2"><input type="checkbox" checked={enabled} onChange={e=>{setEnabled(e.target.checked);setConfirmed(false)}}/>Digital checks are enabled for this funding account</label>
    <label className="block">Check expiration in days<input type="number" min={1} max={180} step={1} value={expiryDays} className="block w-full rounded border p-2" onChange={e=>{setExpiryDays(e.target.value);setConfirmed(false)}}/></label>
    <label className="block">Check activation or disablement reference<textarea maxLength={2000} value={reference} className="block w-full rounded border p-2" onChange={e=>{setReference(e.target.value);setConfirmed(false)}}/></label>
    <p className="text-sm text-slate-600">Before enabling, verify the current funding account above within 15 minutes. Expiration defaults to 90 days. Employee delivery arrangements are handled separately.</p>
    <label className="flex items-start gap-2"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I confirm this check setup applies to the current employer funding account.</label>
    <button type="button" disabled={!confirmed||reference.trim().length<12||!Number.isInteger(Number(expiryDays))||Number(expiryDays)<1||Number(expiryDays)>180} className="rounded bg-slate-900 px-4 py-2 font-bold text-white disabled:opacity-50" onClick={()=>void save()}>Save check setup</button>
   </fieldset>
   {data.history.length?<details><summary>Check setup history</summary><ul className="space-y-2">{data.history.map(row=><li key={row.id} className="break-words">Revision {row.id} · {row.enabled?'Activation recorded':'Disabled'} · {row.expiry_days} days · {new Date(row.created_at).toLocaleString()}<p>{row.activation_reference}</p></li>)}</ul></details>:null}
  </>:null}
 </section>
}
