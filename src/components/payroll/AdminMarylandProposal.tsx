import {useEffect,useRef,useState} from 'react'
import {adminApiRequest} from '../../utils/api'
import type {MarylandSigningHistory,MarylandSigningTerms} from '../../utils/employeePayrollApi'
import {workforceButton,workforceInput} from './OnboardingWorkspace'
async function request<T>(path:string,body?:Record<string,unknown>):Promise<T>{const response=await adminApiRequest(path,body?{method:'POST',body:JSON.stringify(body)}:undefined),json=await response.json();if(!response.ok)throw new Error(json.message||'Unable to load agreement.');return json.data}
export default function AdminMarylandProposal({employeeId,refresh,onChanged}:{employeeId:number;refresh:number;onChanged:()=>void}){
 const [history,setHistory]=useState<MarylandSigningHistory|null>(null),[date,setDate]=useState(''),[preview,setPreview]=useState<{terms:MarylandSigningTerms;sourceFingerprint:string}|null>(null),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
 const attempt=useRef<Record<string,unknown>|null>(null),path=`/api/admin/payroll/employees/${employeeId}/maryland-agreement-proposals`
 useEffect(()=>{let live=true;setPreview(null);setConfirmed(false);attempt.current=null;void request<MarylandSigningHistory>(path).then(value=>{if(live){setHistory(value);setError('')}}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[path,refresh])
 return <section aria-label="Send Maryland agreement for employee signing" className="space-y-3 rounded-xl border p-4">
  <h3 className="font-bold">Complete this agreement in the employee portal</h3>
  <p>Review employer terms, then make the proposal available for this employee to accept or decline. Acceptance activates the agreed instructions. A new proposal replaces any unanswered proposal.</p>
  <button type="button" disabled={busy} className={workforceButton} onClick={onChanged}>Refresh signing responses</button>
  <form aria-label="Propose Maryland withholding agreement" className="space-y-3" onSubmit={async event=>{
   event.preventDefault();if(!preview||!history)return;setBusy(true);setError('');setNotice('')
   try{
    const terms=preview.terms,body=attempt.current??{expectedRevision:history.history[0]?.revision??0,requestKey:crypto.randomUUID(),confirmed:true,effectiveOn:terms.effectiveOn,amountCents:terms.agreement.amountCents,electionFingerprint:terms.agreement.electionFingerprint,periodBasis:terms.agreement.periodBasis,sourceFingerprint:preview.sourceFingerprint}
    attempt.current=body;await request(path,body);setHistory(await request<MarylandSigningHistory>(path));attempt.current=null;setConfirmed(false);setPreview(null);setNotice('Proposal is available in the employee portal.');onChanged()
   }catch(e){setError(e instanceof Error?e.message:'Unable to save the proposal. Retry unchanged if its result is uncertain.')}finally{setBusy(false)}
  }}><fieldset disabled={busy||!history} className="space-y-3">
   <label className="block font-bold">Proposed agreement effective date<input type="date" required className={workforceInput} value={date} onChange={e=>{setDate(e.target.value);setPreview(null);setConfirmed(false);attempt.current=null;setNotice('')}}/></label>
   <button type="button" disabled={!date} className={workforceButton} onClick={async()=>{setBusy(true);setError('');setNotice('');setPreview(null);setConfirmed(false);attempt.current=null;try{setPreview(await request(`${path}/preview?effectiveOn=${encodeURIComponent(date)}`))}catch(e){setError(e instanceof Error?e.message:'Unable to review terms.')}finally{setBusy(false)}}}>Review employee agreement terms</button>
   {preview?<><p className="rounded-lg border p-3">{preview.terms.employeeTerms}</p><label className="flex gap-2"><input type="checkbox" required checked={confirmed} onChange={e=>{setConfirmed(e.target.checked);attempt.current=null}}/>I approve these exact terms on behalf of the employer for this employee to sign.</label><button className={workforceButton} disabled={!confirmed}>Make proposal available for signing</button></>:null}
  </fieldset></form>
  {history?.history.length?<details><summary className="cursor-pointer font-bold">Employee signing history</summary>{history.history.map(row=><article key={row.id} className="mt-2 rounded border p-3"><p>Proposal {row.revision} · {row.decision==='ACCEPT'?'Accepted':row.decision==='DECLINE'?'Declined':'Awaiting response'} · effective {row.terms.effectiveOn}</p><p>{row.terms.employeeTerms}</p>{row.signature?<p>Signed by {row.signature} on {row.signed_at?.slice(0,10)}.</p>:null}</article>)}</details>:null}
  {error?<p role="alert">{error}</p>:null}{notice?<p role="status">{notice}</p>:null}
 </section>
}
