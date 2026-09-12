import {useEffect,useRef,useState} from 'react'
import {employeePayrollApi,type MarylandSigningHistory} from '../../utils/employeePayrollApi'
import {workforceButton,workforceInput} from './OnboardingWorkspace'
export default function EmployeeMarylandAgreement({onChanged}:{onChanged?:()=>void}){
 const [data,setData]=useState<MarylandSigningHistory|null>(null),[decision,setDecision]=useState<'ACCEPT'|'DECLINE'>('ACCEPT'),[signature,setSignature]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
 const attempt=useRef<{id:string;body:Record<string,unknown>}|null>(null)
 useEffect(()=>{let live=true;void employeePayrollApi.marylandAgreementProposals().then(value=>{if(live)setData(value)}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[])
 const current=data?.history[0]
 const reset=()=>{attempt.current=null;setConfirmed(false);setNotice('')}
 return <section aria-label="Your Maryland withholding agreement" className="space-y-3 rounded-2xl border bg-white p-5">
  <h2 className="text-lg font-black">Your Maryland withholding agreement</h2>
  <p>Review additional withholding with your hiring administrator here. Your response and the agreed terms are retained in your payroll records.</p>
  <button type="button" className={workforceButton} disabled={busy} onClick={async()=>{setBusy(true);setError('');try{setData(await employeePayrollApi.marylandAgreementProposals());reset()}catch(e){setError(e instanceof Error?e.message:'Unable to refresh terms.')}finally{setBusy(false)}}}>Refresh withholding proposal</button>
  {data?<p>{data.reason}</p>:!error?<p>Loading your agreement…</p>:null}
  {current&&!current.decision?<form aria-label="Respond to withholding proposal" className="space-y-3" onSubmit={async event=>{
   event.preventDefault();setBusy(true);setError('')
   try{
    const pending=attempt.current??{id:current.id,body:{requestKey:crypto.randomUUID(),proposalFingerprint:current.fingerprint,displayedTerms:current.terms.employeeTerms,decision,signature,confirmed:true}}
    attempt.current=pending
    await employeePayrollApi.respondMarylandAgreement(pending.id,pending.body)
    setData(await employeePayrollApi.marylandAgreementProposals());onChanged?.();attempt.current=null;setConfirmed(false);setNotice(decision==='ACCEPT'?'Your acceptance is saved and the agreement is active from its effective date.':'Your decline is saved. Existing withholding instructions remain unchanged.')
   }catch(e){setError(e instanceof Error?e.message:'Unable to save your response. Retry the unchanged response if its result is uncertain.')}finally{setBusy(false)}
  }}><p className="rounded-lg border p-3">{current.terms.employeeTerms}</p><fieldset disabled={busy} className="space-y-3">
   <label className="block font-bold">Your agreement response<select className={workforceInput} value={decision} onChange={e=>{setDecision(e.target.value as 'ACCEPT'|'DECLINE');reset()}}><option value="ACCEPT" disabled={!data?.actionable}>Accept these terms</option><option value="DECLINE">Decline this proposal</option></select></label>
   <label className="block font-bold">Your signature<input required minLength={3} maxLength={200} className={workforceInput} value={signature} onChange={e=>{setSignature(e.target.value);reset()}}/></label>
   <label className="flex gap-2"><input required type="checkbox" checked={confirmed} onChange={e=>{setConfirmed(e.target.checked);attempt.current=null}}/>I reviewed these terms and intend my typed name to sign my selected response.</label>
   <button className={workforceButton} disabled={!confirmed||(decision==='ACCEPT'&&!data?.actionable)}>Save agreement response</button>
  </fieldset></form>:null}
  {data?.history.length?<details><summary className="cursor-pointer font-bold">Your agreement responses</summary>{data.history.map(row=><article key={row.id} className="mt-3 space-y-2 rounded-lg border p-3"><p>Proposal {row.revision} · {row.decision==='ACCEPT'?'Accepted':row.decision==='DECLINE'?'Declined':'No response retained'}</p><p>{row.terms.employeeTerms}</p>{row.signature?<p>Signed by {row.signature} on {row.signed_at?.slice(0,10)}.</p>:null}</article>)}</details>:null}
  {error?<p role="alert" className="text-red-700">{error}</p>:null}{notice?<p role="status" className="text-emerald-700">{notice}</p>:null}
 </section>
}
