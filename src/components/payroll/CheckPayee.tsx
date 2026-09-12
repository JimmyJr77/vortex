import {useCallback,useEffect,useState} from 'react'
import {adminApiRequest} from '../../utils/api'
type Progress={claimed:boolean;status:string}
type Data={revision:number;id:string|null;payeeName:string;setupStatus:string;connectionId:number;connectionChanged:boolean;progress:Record<string,Progress>;history:Array<{id:string;revision:string;connection_id:string;created_at:string}>}
const steps=[['COUNTERPARTY','recipient identity'],['ACCOUNT','check payment account']] as const
export default function CheckPayee({employeeId}:{employeeId:number}){
 const [data,setData]=useState<Data|null>(null),[name,setName]=useState(''),[reference,setReference]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('')
 const path=`/api/admin/payroll/employees/${employeeId}/check-payee`
 const read=useCallback(async()=>{const response=await adminApiRequest(path),json=await response.json();if(!response.ok)throw new Error(json.message);return json.data as Data},[path])
 const apply=(value:Data)=>{setData(value);setName(value.payeeName);setConfirmed(false);setReference('')}
 useEffect(()=>{let active=true;void read().then(value=>{if(active)apply(value)}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setBusy(false)});return()=>{active=false}},[read])
 useEffect(()=>{
  if(busy||confirmed||reference||!data||name!==data.payeeName)return
  let active=true,pending=false
  const timer=setInterval(()=>{if(document.visibilityState!=='visible'||pending)return;pending=true;void read().then(value=>{if(active){if(JSON.stringify(value.progress)!==JSON.stringify(data.progress))setNotice('Recipient status updated automatically.');apply(value);setError('')}}).catch(()=>{if(active)setError('Automatic status refresh is unavailable. Refresh check recipient to retry.')}).finally(()=>{pending=false})},30000)
  return()=>{active=false;clearInterval(timer)}
 },[busy,confirmed,reference,name,data,read])
 const refresh=async()=>{setBusy(true);setData(null);setError('');setConfirmed(false);try{apply(await read())}catch(e){setError(e instanceof Error?e.message:'Unable to read check recipient.')}finally{setBusy(false)}}
 const action=async(suffix:string,body:Record<string,unknown>)=>{if(busy)return;setBusy(true);setError('');setNotice('');setConfirmed(false);try{const response=await adminApiRequest(`${path}${suffix}`,{method:'POST',body:JSON.stringify(body)}),json=await response.json();if(!response.ok)throw new Error(json.message);apply(await read());setNotice(suffix?`Recipient step: ${json.data.status.replaceAll('_',' ')}.`:'Check recipient saved. Continue the two setup steps below.')}catch(e){setError(e instanceof Error?e.message:'Unable to update check recipient.')}finally{setBusy(false)}}
 return <section aria-label="Employee check recipient" aria-busy={busy} className="space-y-4 rounded-2xl border bg-white p-5">
  <h3 className="text-lg font-bold">Check recipient</h3><p className="text-sm text-slate-600">Prepare this employee’s legal check name and provider recipient. These steps do not issue a check or deliver wages.</p>
  {error?<p role="alert" className="text-red-700">{error}</p>:null}{notice?<p role="status" className="text-emerald-800">{notice}</p>:null}
  <button type="button" disabled={busy} onClick={()=>void refresh()} className="font-bold underline">Refresh check recipient</button>
  {data?<><p>Employer setup: {data.setupStatus.replaceAll('_',' ')}</p>{data.connectionChanged?<p role="alert">Funding connection changed. Save a recipient for the current connection.</p>:null}
   <fieldset disabled={busy||data.setupStatus!=='ACTIVATION_RECORDED'} className="space-y-3"><legend className="font-semibold">Review recipient name</legend>
    <label className="block">Legal name on check<input maxLength={200} value={name} className="block w-full rounded border p-2" onChange={e=>{setName(e.target.value);setConfirmed(false)}}/></label>
    <label className="block">Check recipient review reference<input maxLength={2000} value={reference} className="block w-full rounded border p-2" onChange={e=>{setReference(e.target.value);setConfirmed(false)}}/></label>
    <label className="flex items-start gap-2"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I reviewed this employee’s legal check name and authorize recipient setup.</label>
    <button type="button" disabled={!confirmed||name.trim().length<2||reference.trim().length<12} className="rounded bg-slate-900 px-4 py-2 font-bold text-white disabled:opacity-50" onClick={()=>void action('',{expectedRevision:data.revision,connectionId:data.connectionId,payeeName:name,reference,confirmed})}>Save check recipient</button>
   </fieldset>
   {data.id?<div className="space-y-3">{steps.map(([stage,label])=>{const progress=data.progress[stage];return <div key={stage}><p>{label}: {progress?.status.replaceAll('_',' ')||'NOT STARTED'}</p><button type="button" disabled={busy||(!progress?.claimed&&(!confirmed||name!==data.payeeName||data.connectionChanged||data.setupStatus!=='ACTIVATION_RECORDED'||(stage==='ACCOUNT'&&data.progress.COUNTERPARTY?.status!=='RECORDED')))} className="font-bold underline disabled:opacity-50" onClick={()=>void action(`/${data.id}/advance`,{stage,action:progress?.claimed?'RECOVER':'CONTINUE',confirmed})}>{progress?.claimed?'Recover':'Create'} {label}</button></div>})}</div>:null}
   {data.history.length>1?<details><summary>Earlier check recipient records</summary><ul className="space-y-3">{data.history.filter(row=>row.id!==data.id).map(row=><li key={row.id}>Revision {row.revision} · {new Date(row.created_at).toLocaleString()}<div className="flex flex-wrap gap-3">{steps.map(([stage,label])=><button type="button" key={stage} disabled={busy} className="underline" onClick={()=>void action(`/${row.id}/advance`,{stage,action:'RECOVER'})}>Recover earlier {label}</button>)}</div></li>)}</ul></details>:null}
  </>:null}
 </section>
}
