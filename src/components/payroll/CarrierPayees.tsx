import {useState} from 'react'
import {adminApiRequest} from '../../utils/api'
type Account={holderName:string;accountType:string;accountLast4:string;mode:string}
type Preview={fingerprint:string;previousId:string|null;account:Account}
type History={checks:{id:number;status:string;created_at:string}[];id:string;revision:number;carrier_name:string;masked_destination:Account;reference:string;created_at:string;current:boolean;connectionCurrent:boolean;verification:{status:string;created_at:string}|null}
type Model={connectionRevision:number;vaultReady:boolean;history:History[]}
const statusLabel=(status?:string)=>({VERIFIED:'Account matches retained review',CHANGED:'Account or funding details changed — review again',UNAVAILABLE:'Verification unavailable — retry',CONNECTION_CHANGED:'Employer payment connection changed — review again'}[status||'']||'Not checked')
export default function CarrierPayees(){
 const [carrier,setCarrier]=useState(''),[accountId,setAccountId]=useState(''),[reference,setReference]=useState(''),[confirmed,setConfirmed]=useState(false),[model,setModel]=useState<Model|null>(null),[preview,setPreview]=useState<Preview|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('')
 const request=async(path:string,body?:object)=>{const r=await adminApiRequest(`/api/admin/payroll/carrier-payees${path}`,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:undefined),j=await r.json();if(!r.ok)throw new Error(j.message||'Unable to review carrier destination.');return j.data}
 const refresh=async()=>setModel(await request(`?${new URLSearchParams({carrier})}`))
 const run=async(work:()=>Promise<void>)=>{setBusy(true);setError('');setMessage('');try{await work()}catch(e){setError(e instanceof Error?e.message:'Unable to review carrier destination.')}finally{setBusy(false)}}
 const invalidate=()=>{setPreview(null);setConfirmed(false);setMessage('')}
 return <section aria-label="Carrier payment destinations" className="space-y-3 rounded-xl border p-4 text-sm">
  <h4 className="font-bold">Carrier payment destinations</h4>
  <p>Review the business account supplied by the carrier and retain the supporting payment instructions. Saving a destination does not authorize a payment.</p>
  <fieldset disabled={busy} className="space-y-3">
   <label className="block font-bold">Payee carrier name<input value={carrier} maxLength={200} onChange={e=>{setCarrier(e.target.value);setModel(null);invalidate()}} className="mt-1 block w-full rounded-lg border p-2"/></label>
   <button type="button" disabled={carrier.trim().length<2} onClick={()=>void run(async()=>{invalidate();await refresh()})} className="rounded-lg border px-4 py-2 font-bold disabled:opacity-50">Load carrier destinations</button>
   {model?<>
    {!model.connectionRevision?<p>Configure the employer payment connection before reviewing a carrier account.</p>:null}
    {!model.vaultReady?<p>Encrypted document storage must be configured before saving a destination.</p>:null}
    <label className="block font-bold">Carrier business account ID<input value={accountId} autoComplete="off" onChange={e=>{setAccountId(e.target.value);invalidate()}} className="mt-1 block w-full rounded-lg border p-2"/></label>
    <p>Use the verified business account in the connected payment provider. Match its owner and account ending to the carrier’s independently supplied instructions.</p>
    <button type="button" disabled={!model.connectionRevision||!accountId} onClick={()=>void run(async()=>{invalidate();setPreview(await request('/preview',{carrier,accountId,connectionRevision:model.connectionRevision}))})} className="rounded-lg border px-4 py-2 font-bold disabled:opacity-50">Review carrier destination</button>
    {preview?<div className="space-y-3 rounded-lg bg-slate-50 p-3">
     <p className="break-words">{preview.account.holderName} · {preview.account.accountType} ending {preview.account.accountLast4} · {preview.account.mode==='LIVE'?'Live':'Test'}</p>
     <label className="block font-bold">Carrier payment instruction reference<textarea value={reference} maxLength={2000} onChange={e=>{setReference(e.target.value);setConfirmed(false)}} rows={3} className="mt-1 block w-full rounded-lg border p-2"/></label>
     <label className="flex items-start gap-2"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>I independently verified that this business account belongs to the carrier or its authorized collection agent and matches its payment instructions.</span></label>
     <button type="button" disabled={!confirmed||reference.trim().length<12||!model.vaultReady} onClick={()=>void run(async()=>{await request('',{carrier,accountId,connectionRevision:model.connectionRevision,previousId:preview.previousId,fingerprint:preview.fingerprint,reference,confirmed});invalidate();setAccountId('');setReference('');await refresh();setMessage('Carrier destination review retained. No payment was sent.')})} className="rounded-lg bg-slate-900 px-4 py-2 font-bold text-white disabled:opacity-50">Save carrier destination</button>
    </div>:null}
    <div className="space-y-2"><h5 className="font-bold">Retained destination history</h5>{model.history.length?model.history.map(row=><article key={row.id} className="space-y-2 rounded-lg border p-3"><p className="break-words">Revision {row.revision} · {row.current?'Current':'Superseded'} · {row.masked_destination.holderName} · ending {row.masked_destination.accountLast4} · {row.masked_destination.mode}</p><p>{row.connectionCurrent?statusLabel(row.verification?.status):statusLabel('CONNECTION_CHANGED')}</p><p className="break-words">{row.reference}</p><p>Reviewed {new Date(row.created_at).toLocaleString()}</p><details><summary className="cursor-pointer font-bold">Verification history</summary><ul>{row.checks.map(check=><li key={check.id}>{statusLabel(check.status)} · {new Date(check.created_at).toLocaleString()}</li>)}</ul></details>{row.current?<button type="button" onClick={()=>void run(async()=>{const result=await request(`/${row.id}/verify`,{});await refresh();setMessage(statusLabel(result.status))})} className="rounded-lg border px-3 py-2 font-bold">Recheck carrier destination</button>:null}</article>):<p>No carrier destination has been retained.</p>}</div>
   </>:null}
  </fieldset>
  {error?<p role="alert" className="text-red-700">{error}</p>:null}{message?<p role="status">{message}</p>:null}
 </section>
}
