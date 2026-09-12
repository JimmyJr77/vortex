import {useEffect,useState} from 'react'
import {adminApiRequest} from '../../utils/api'
type History={id:string;created_at:string;automatic:boolean;summary:{status:string;issues:string[]}}
type Failure={id:string;created_at:string;message:string}
type Data={history:History[];failures:Failure[];checkpoint:{assessment_id:string;checked_at:string}|null;nextCursor:string|null;nextFailureCursor:string|null}
export default function RetirementContributionHistory({id}:{id:string}){
 const [data,setData]=useState<Data|null>(null),[error,setError]=useState(''),[actionError,setActionError]=useState(''),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0),[before,setBefore]=useState<string|null>(null),[beforeFailure,setBeforeFailure]=useState<string|null>(null)
 const path=`/api/admin/payroll/retirement-remittance-authorizations/${id}/assessment-history`
 useEffect(()=>{
  let live=true,inFlight=false
  const load=async()=>{
   if(inFlight)return;inFlight=true
   try{
    const query=new URLSearchParams();if(before)query.set('beforeId',before);if(beforeFailure)query.set('beforeFailureId',beforeFailure)
    const r=await adminApiRequest(`${path}?${query}`),j=await r.json()
    if(!r.ok||!j.success)throw new Error(j.message||'Unable to load contribution history.')
    if(live){setData(j.data);setError('')}
   }catch(e){if(live){setData(null);setError(e instanceof Error?e.message:'Unable to load contribution history.')}}finally{inFlight=false}
  }
  void load();const timer=setInterval(()=>void load(),30000)
  return()=>{live=false;clearInterval(timer)}
 },[path,before,beforeFailure,revision])
 const refresh=()=>{setData(null);setBefore(null);setBeforeFailure(null);setRevision(n=>n+1)}
 const check=async()=>{
  setBusy(true);setActionError('')
  try{const r=await adminApiRequest(path,{method:'POST',body:JSON.stringify({})}),j=await r.json();if(!r.ok||!j.success)throw new Error(j.message||'Unable to retain contribution check.');refresh()}
  catch(e){setActionError(e instanceof Error?e.message:'Unable to retain contribution check.')}
  finally{setBusy(false)}
 }
 return <section aria-label="Contribution assessment history" className="space-y-2 rounded border p-3">
  <h4 className="font-bold">Reconciliation history</h4>
  <p>Automatic checks retain changed outcomes. Historical outcomes describe the evidence available at that check.</p>
  <div className="flex flex-wrap gap-2"><button type="button" className="rounded border px-3 py-2" disabled={busy} onClick={()=>void check()}>{busy?'Checking contribution…':'Check contribution now'}</button><button type="button" className="rounded border px-3 py-2" onClick={refresh}>Refresh latest contribution history</button></div>
  {actionError?<p role="alert">{actionError} You can retry the check.</p>:null}
  {error?<p role="alert">{error} Automatic refresh will retry.</p>:null}
  {data?<>
   <p>{data.checkpoint?`Last successful check: ${new Date(data.checkpoint.checked_at).toLocaleString()}`:'No successful check has been retained yet.'}</p>
   <ol className="space-y-2">{data.history.map(row=><li key={row.id} className="rounded border p-2"><p>{row.automatic?'Automatic':'Admin'} assessment · {new Date(row.created_at).toLocaleString()}</p><p>Recorded outcome: {row.summary.status.replaceAll('_',' ')}</p><ul className="list-disc pl-5">{row.summary.issues.map(issue=><li key={issue}>{issue}</li>)}</ul></li>)}</ol>
   {data.nextCursor?<button type="button" className="rounded border px-3 py-2" onClick={()=>{setData(null);setBefore(data.nextCursor)}}>Older contribution assessments</button>:null}
   <h5 className="font-bold">Automatic check failures</h5>
   {data.failures.length?<ol className="space-y-2">{data.failures.map(row=><li key={row.id} className="rounded border p-2"><p>{new Date(row.created_at).toLocaleString()} · {row.message}</p></li>)}</ol>:<p>No failures on this page.</p>}
   {data.nextFailureCursor?<button type="button" className="rounded border px-3 py-2" onClick={()=>{setData(null);setBeforeFailure(data.nextFailureCursor)}}>Older contribution check failures</button>:null}
  </>:null}
 </section>
}
