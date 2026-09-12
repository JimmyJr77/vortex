import AdminMarylandProposal from './AdminMarylandProposal'
import {useEffect,useRef,useState} from 'react'
import {adminApiRequest} from '../../utils/api'
import {workforceButton,workforceInput} from './OnboardingWorkspace'
type Agreement={id:string;revision:number;status:'ACTIVE'|'SUSPENDED';effectiveOn:string;sourceReference:string;agreement:{amountCents:number;payFrequency:string;periodBasis:string}}
type History={latest:Agreement|null;history:Agreement[];currentElectionFingerprint:string|null;requestedAdditionalCents:number|null;electionMatches:boolean}
export default function MarylandAdditionalAgreement({employeeId,refresh}:{employeeId:number;refresh:number}){
 const [history,setHistory]=useState<History|null>(null),[source,setSource]=useState(''),[date,setDate]=useState(''),[status,setStatus]=useState<'ACTIVE'|'SUSPENDED'>('ACTIVE'),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
 const [signingRefresh,setSigningRefresh]=useState(0)
 const attempt=useRef<Record<string,unknown>|null>(null)
 const path=`/api/admin/payroll/employees/${employeeId}/maryland-additional-agreements`
 useEffect(()=>{let live=true;setHistory(null);setConfirmed(false);attempt.current=null;void adminApiRequest(path).then(async response=>{const json=await response.json();if(!response.ok)throw new Error(json.message);if(live){setHistory(json.data);setError('')}}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[path,refresh,signingRefresh])
 const money=(cents:number)=>(cents/100).toLocaleString('en-US',{style:'currency',currency:'USD'})
 return <section aria-label="Maryland additional withholding agreement" className="mt-5 space-y-3 rounded-xl border p-4">
  <h3 className="font-bold">Maryland additional withholding agreement</h3>
  <p>Retain the employee and employer’s signed instructions for additional withholding per pay period. Review withholding in each payroll before approval.</p>
  {history?<><p>Saved MW507 additional amount: {history.requestedAdditionalCents===null?'No current election':money(history.requestedAdditionalCents)}.</p>{history.latest?<p>Revision {history.latest.revision}: {history.latest.status==='ACTIVE'?'Retained':'Suspended'} · effective {history.latest.effectiveOn}. {!history.electionMatches?'The saved tax election has changed; review a new agreement.':''}</p>:<p>No agreement retained.</p>}</>:null}
  <AdminMarylandProposal employeeId={employeeId} refresh={refresh+signingRefresh} onChanged={()=>setSigningRefresh(value=>value+1)}/>
  <form className="space-y-3" onChange={()=>{setConfirmed(false);attempt.current=null;setNotice('')}} onSubmit={async event=>{
   event.preventDefault();if(!history)return;setBusy(true);setError('')
   try{
    const body=attempt.current??{status,expectedRevision:history.latest?.revision??0,requestKey:crypto.randomUUID(),confirmed:true,sourceReference:source,effectiveOn:date,amountCents:history.requestedAdditionalCents,periodBasis:'PAYMENT_DATE',electionFingerprint:history.currentElectionFingerprint}
    attempt.current=body
    const response=await adminApiRequest(path,{method:'POST',body:JSON.stringify(body)}),json=await response.json();if(!response.ok)throw new Error(json.message)
    const loaded=await adminApiRequest(path),data=await loaded.json();if(!loaded.ok)throw new Error(data.message)
    setHistory(data.data);attempt.current=null;setConfirmed(false);setNotice(`Agreement revision ${json.data.revision} retained.`)
   }catch(e){setError(e instanceof Error?e.message:'Unable to retain agreement. Retry the unchanged request if its result is uncertain.')}finally{setBusy(false)}
  }}>
   <fieldset disabled={busy||!history} className="space-y-3">
    <label className="block font-bold">Agreement action<select className={workforceInput} value={status} onChange={e=>setStatus(e.target.value as 'ACTIVE'|'SUSPENDED')}><option value="ACTIVE">Retain current signed agreement</option><option value="SUSPENDED" disabled={history?.latest?.status!=='ACTIVE'}>Suspend retained agreement</option></select></label>
    <label className="block font-bold">Agreement effective date<input required type="date" className={workforceInput} value={date} onChange={e=>setDate(e.target.value)}/></label>
    <p>Period basis: the complete pay-calendar period containing the payment date, including separate payments made in that period. Retain this option only when the signed agreement specifies that basis.</p>
    <label className="block font-bold">Signed agreement reference<textarea required minLength={20} maxLength={2000} className={workforceInput} value={source} onChange={e=>setSource(e.target.value)}/></label>
    <label className="flex gap-2"><input type="checkbox" required checked={confirmed} onChange={e=>{e.stopPropagation();setConfirmed(e.target.checked);attempt.current=null}}/>I verified the signed employee and employer instructions, amount, payment-date period basis, and effective date.</label>
    <button className={workforceButton} disabled={!confirmed}>Retain agreement revision</button>
   </fieldset>
  </form>
  {error?<p role="alert">{error}</p>:null}{notice?<p role="status">{notice}</p>:null}
  {history?.history.length?<details><summary className="cursor-pointer font-bold">Agreement history</summary>{history.history.map(item=><article key={item.id} className="mt-2 rounded border p-3"><p>Revision {item.revision} · {item.status} · {item.effectiveOn}</p><p>{money(item.agreement.amountCents)} · {item.agreement.payFrequency.toLowerCase()} · payment-date periods</p><p className="break-words">{item.sourceReference}</p></article>)}</details>:null}
 </section>
}
