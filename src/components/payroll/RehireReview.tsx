import {useEffect,useRef,useState} from 'react'
import {payrollApi,type RehireReviewData} from '../../utils/payrollApi'
import {workforceButton} from './OnboardingWorkspace'

export default function RehireReview({employeeId,refreshKey,onRehired}:{employeeId:number;refreshKey?:unknown;onRehired:()=>Promise<void>}){
 const [start,setStart]=useState(''),[data,setData]=useState<RehireReviewData|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const [saving,setSaving]=useState(false),[reason,setReason]=useState(''),[reference,setReference]=useState(''),[confirmed,setConfirmed]=useState(false),[obligations,setObligations]=useState(false),[requestId,setRequestId]=useState(()=>crypto.randomUUID())
 const request=useRef(0)
 useEffect(()=>{const counter=request;counter.current++;setData(null);setError('');setBusy(false);return()=>{counter.current++}},[employeeId,refreshKey])
 async function review(){
  const current=++request.current;setBusy(true);setError('');setData(null);setConfirmed(false);setObligations(false);setRequestId(crypto.randomUUID())
  try{const result=await payrollApi.rehireReview(employeeId,start);if(current===request.current)setData(result)}catch(e){if(current===request.current)setError(e instanceof Error?e.message:'Unable to prepare review.')}finally{if(current===request.current)setBusy(false)}
 }
 async function rehire(){
  if(!data)return
  setSaving(true);setError('')
  try{await payrollApi.rehire(employeeId,{requestId,startDate:data.proposedStartDate,reviewFingerprint:data.fingerprint,reason,reviewReference:reference,termsConfirmed:confirmed,priorObligationsReviewed:obligations});await onRehired()}catch(e){setError(e instanceof Error?e.message:'Unable to reopen onboarding.')}finally{setSaving(false)}
 }
 const money=(cents:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100)
 return <section aria-label="Rehire preparation" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
  <h3 className="text-lg font-black">Rehire preparation</h3>
  <p className="text-sm text-slate-600">Review the existing employee’s employment, payroll, compensation and leave records before preparing a new hiring cycle.</p>
  <form className="flex flex-wrap items-end gap-3" onSubmit={event=>{event.preventDefault();void review()}}>
   <label className="min-w-0 text-sm font-bold">Proposed rehire date<input type="date" required disabled={saving} value={start} className="mt-1 block max-w-full rounded-xl border border-slate-300 p-2" onChange={event=>{request.current++;setStart(event.target.value);setData(null);setError('');setBusy(false)}}/></label>
   <button className={workforceButton} disabled={busy||saving||!start}>{busy?'Reviewing…':'Review rehire records'}</button>
  </form>
  {error?<p role="alert" className="text-sm text-red-700">{error}</p>:null}
  {data?<div className="space-y-3" role="status">
   <p className="text-sm font-bold">Employee {data.employeeNumber} · proposed start {data.proposedStartDate}</p>
   {data.issues.length?<div className="rounded-xl bg-amber-50 p-3"><h4 className="font-bold">Items to reconcile</h4><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">{data.issues.map(issue=><li key={issue}>{issue}</li>)}</ul></div>:<p className="text-sm">No outstanding items were found by these checks. Review historical wages, corrections and leave policy before proceeding.</p>}
   <p className="text-sm">Recorded pay at the proposed start: <strong>{data.compensation.payType==='SALARY'?`${money(data.compensation.annualSalaryCents??0)} annually`:`${money(data.compensation.hourlyRateCents??0)}/hour`}</strong>{data.compensation.effectiveOn?` · effective ${data.compensation.effectiveOn}`:' · current employee profile'}.</p>
   <p className="text-sm">{data.employmentTerms.jobTitle} · {data.employmentTerms.overtimeClassification.replaceAll('_',' ')} · work state {data.employmentTerms.workState} · residence {data.employmentTerms.residenceState}. Location: {data.employmentTerms.location||'not recorded'}.</p>
   {data.pendingRuns.length?<ul className="space-y-1 text-sm">{data.pendingRuns.map(run=><li key={run.id}>Run #{run.id} · {run.kind.replaceAll('_',' ')} · {run.status} · {run.start} through {run.end}</li>)}</ul>:null}
   <div className="text-sm"><h4 className="font-bold">Recorded leave as of {data.asOfDate}</h4>{data.leaveBalances.length?<ul className="mt-1 space-y-1">{data.leaveBalances.map(balance=><li key={balance.type}>{balance.type.replaceAll('_',' ')}: {balance.minutes/60} hours{balance.reservedMinutes?` · ${balance.reservedMinutes/60} hours reserved for payout`:''}</li>)}</ul>:<p>No leave transactions recorded through this date.</p>}<p className="mt-1 text-slate-600">These are ledger balances. Rehire availability depends on the reviewed leave policy and any outstanding payout.</p></div>
   <p className="text-sm">Retained under this employee identity: {data.employmentPeriods.length} employment {data.employmentPeriods.length===1?'period':'periods'} and {data.onboarding.length} onboarding steps.</p>
  </div>:null}
  <p className="text-sm text-slate-600">Reopening keeps this employee’s payroll and document history, password and recorded leave balances. It revokes existing sessions and unused invitations, clears verified tax elections, and requires fresh onboarding submissions and admin reviews before activation. The displayed role and pay terms carry into the new hiring cycle.</p>
  {data&&!data.issues.length?<form className="space-y-3 border-t border-slate-200 pt-3" onSubmit={event=>{event.preventDefault();void rehire()}}>
   <label className="block text-sm font-bold">Rehire reason<textarea required minLength={12} maxLength={2000} disabled={saving} value={reason} onChange={event=>setReason(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-300 p-2"/></label>
   <label className="block text-sm font-bold">Prior obligations and leave policy review reference<textarea required minLength={20} maxLength={2000} disabled={saving} value={reference} onChange={event=>setReference(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-300 p-2"/></label>
   <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={saving} onChange={event=>setConfirmed(event.target.checked)} className="mt-1"/>I confirm the displayed start date, role and compensation terms.</label>
   <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={obligations} disabled={saving} onChange={event=>setObligations(event.target.checked)} className="mt-1"/>I reviewed prior wages, corrections, expenses and leave policy, including retaining the displayed balances.</label>
   <button className={workforceButton} disabled={saving||!confirmed||!obligations||reason.trim().length<12||reference.trim().length<20}>{saving?'Opening onboarding…':'Reopen onboarding'}</button>
  </form>:null}
 </section>
}
