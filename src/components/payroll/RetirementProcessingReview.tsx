import {useCallback,useEffect,useId,useRef,useState} from 'react'
import {adminApiRequest} from '../../utils/api'
type Review={disposition:string;catchUpAuthorized:boolean;reference:string;policies:Record<string,string>}
type Data={planRevisionId:string;planName:string;policies:Record<string,string>;status:string;history:{id:string;revision:number;review:Review;created_at:string}[]}
const policyLabels:Record<string,string>={compensation415:'Annual-additions compensation uses reconciled standard gross wages.',allocation:'Limited contributions are allocated proportionally between pretax and Roth; a tied remainder cent goes to pretax.',bonusAllocation:'Pretax bonus allocation follows included wage proportions, rounded to the nearest cent; half-cent ties go to bonus.',affordability:'Taxes are recalculated before checking available wages. Reimbursements cannot cover a shortfall.',fixedElection:'Fixed-dollar elections apply to regular payroll only.'}
export default function RetirementProcessingReview({planId}:{planId:string}){
 const id=useId()
 const [data,setData]=useState<Data|null>(null),[requested,setRequested]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[draft,setDraft]=useState<{planRevisionId:string;expectedRevision:number;policies:Record<string,string>}|null>(null),[disposition,setDisposition]=useState(''),[catchUp,setCatchUp]=useState(''),[reference,setReference]=useState(''),[confirmed,setConfirmed]=useState(false)
 const pending=useRef<string|null>(null),path=`/api/admin/payroll/retirement-plans/${encodeURIComponent(planId)}/processing-review`
 const read=useCallback(async()=>{const r=await adminApiRequest(path),b=await r.json();if(!r.ok||!b.success)throw new Error(b.message||'Unable to read processing history.');return b.data as Data},[path])
 const load=async()=>{setRequested(true);setBusy(true);try{setData(await read());setError('')}catch(e){setError(e instanceof Error?e.message:'Unable to refresh processing history.')}finally{setBusy(false)}}
 useEffect(()=>{if(!requested||busy)return;let live=true,inFlight=false;const timer=setInterval(()=>{if(inFlight)return;inFlight=true;void read().then(value=>{if(live){setData(value);setError('')}}).catch(()=>{if(live)setError('Processing history could not refresh. Automatic refresh will retry.')}).finally(()=>{inFlight=false})},30000);return()=>{live=false;clearInterval(timer)}},[requested,busy,read])
 const begin=()=>{if(!data)return;setDraft({planRevisionId:data.planRevisionId,expectedRevision:data.history[0]?.revision||0,policies:data.policies});setDisposition('');setCatchUp('');setReference('');setConfirmed(false);setMessage('');pending.current=null}
 const stale=!!draft&&(draft.planRevisionId!==data?.planRevisionId||draft.expectedRevision!==(data?.history[0]?.revision||0))
 const save=async(retry=false)=>{if(!draft&&!retry)return;setBusy(true);setMessage('');try{
  const body=retry&&pending.current?pending.current:JSON.stringify({...draft,requestKey:crypto.randomUUID(),review:{disposition,catchUpAuthorized:disposition==='SUSPENDED'?false:catchUp==='true',reference,confirmed,policies:draft?.policies}})
  pending.current=body;const r=await adminApiRequest(path,{method:'POST',headers:{'Content-Type':'application/json'},body}),b=await r.json();if(!r.ok||!b.success)throw new Error(b.message||'Unable to retain processing review.')
  pending.current=null;setDraft(null);setConfirmed(false);setMessage('Processing review retained. Regular payroll will recheck employee elections and contribution sources.');setData(await read());setError('')
 }catch(e){setError(e instanceof Error?e.message:'Unable to save processing review.')}finally{setBusy(false)}}
 return <section aria-label={`Processing review ${planId}`} className="mt-4 space-y-3 rounded border border-slate-300 p-3">
  <h4 className="font-bold">Retirement payroll processing · {planId}</h4>
  <p>Reviewed policies allow regular payroll to calculate deductions when current employee elections, eligibility and annual sources reconcile. Suspension blocks affected payroll. Payroll processing does not confirm recordkeeper acceptance or participant allocation.</p>
  <button type="button" disabled={busy} onClick={()=>void load()} className="rounded border px-3 py-2">{requested?'Refresh processing history':'Load processing review'}</button>
  {error?<p role="alert">{error}</p>:null}{message?<p role="status">{message}</p>:null}
  {pending.current?<button type="button" disabled={busy} onClick={()=>void save(true)} className="rounded border px-3 py-2">Retry original processing review</button>:null}
  {data?<><p>Current review: {data.status.replaceAll('_',' ')}</p><ul className="list-disc pl-5">{Object.keys(data.policies).map(key=><li key={key}>{policyLabels[key]||key}</li>)}</ul>
   <button type="button" disabled={busy||!!error} onClick={begin} className="rounded border px-3 py-2">Review current processing policies</button>
   {stale?<p role="alert">A source revision changed. Your draft is preserved. Start a review of the current policies before saving.</p>:null}
   {draft?<fieldset disabled={busy||stale||!!error} className="space-y-3"><legend className="font-bold">Administrator processing review</legend>
    <label htmlFor={`${id}-disposition`} className="block">Processing disposition<select aria-label="Processing disposition" id={`${id}-disposition`} className="ml-2 rounded border p-2" value={disposition} onChange={e=>{setDisposition(e.target.value);setConfirmed(false)}}><option value="">Choose disposition</option><option value="REVIEWED">Policies reviewed</option><option value="SUSPENDED">Suspend processing</option></select></label>
    {disposition==='REVIEWED'?<label htmlFor={`${id}-catchup`} className="block">Catch-up processing<select aria-label="Catch-up processing" id={`${id}-catchup`} className="ml-2 rounded border p-2" value={catchUp} onChange={e=>{setCatchUp(e.target.value);setConfirmed(false)}}><option value="">Review permission</option><option value="false">Not authorized</option><option value="true">Authorized under plan terms</option></select></label>:null}
    <label htmlFor={`${id}-reference`} className="block">Processing review reference<textarea aria-label="Processing review reference" id={`${id}-reference`} className="mt-1 block w-full rounded border p-2" maxLength={2000} value={reference} onChange={e=>{setReference(e.target.value);setConfirmed(false)}}/></label>
    <label className="flex gap-2"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>I reviewed these processing policies against the retained plan and supporting evidence.</span></label>
    <button type="button" disabled={!confirmed||!disposition||(disposition==='REVIEWED'&&!catchUp)||reference.trim().length<12} onClick={()=>void save()} className="rounded border px-3 py-2">Retain processing review</button>
   </fieldset>:null}
   {data.history.map(row=><details key={row.id} className="rounded border p-2"><summary>Processing revision {row.revision} · {row.review.disposition}</summary><p>{new Date(row.created_at).toLocaleString()}</p><p>Catch-up: {row.review.catchUpAuthorized?'Authorized':'Not authorized'}</p><p className="break-words">{row.review.reference}</p></details>)}
  </>:null}
 </section>
}
