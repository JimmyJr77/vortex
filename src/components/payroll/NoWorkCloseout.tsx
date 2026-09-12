import {useEffect,useState} from 'react'
import {payrollApi,type NoWorkCloseoutReview} from '../../utils/payrollApi'
import {workforceButton,workforceInput} from './OnboardingWorkspace'
export default function NoWorkCloseout({employeeId,refreshKey,onClosed}:{employeeId:number;refreshKey?:unknown;onClosed:()=>void}){
 const [review,setReview]=useState<NoWorkCloseoutReview|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 const [reason,setReason]=useState(''),[reference,setReference]=useState(''),[noWork,setNoWork]=useState(false),[noObligations,setNoObligations]=useState(false)
 useEffect(()=>{let current=true;void payrollApi.noWorkCloseout(employeeId).then(data=>{if(current){setReview(data);setError('')}}).catch(e=>{if(current)setError(e.message)});return()=>{current=false}},[employeeId,refreshKey])
 const close=async()=>{if(!review)return;setBusy(true);setError('');try{setReview(await payrollApi.closeNoWorkHire(employeeId,{fingerprint:review.fingerprint,reason,reference,noWorkConfirmed:noWork,noObligationsConfirmed:noObligations}));onClosed()}catch(e){setError(e instanceof Error?e.message:'Unable to record closeout.')}finally{setBusy(false)}}
 return <details className="rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer font-bold">Hire never started work</summary><div className="mt-3 space-y-3">
 <p className="text-sm">Use only after reviewing a cancelled initial hourly hire. No-work closeout records the admin’s findings; it does not record a payment or waive an obligation.</p>
 {error?<p role="alert" className="text-sm text-red-700">{error}</p>:null}
 {!review?<p>Checking recorded work and pay obligations…</p>:review.closeout?<><p className="font-bold">No-work closeout recorded.</p><p className="text-sm">{review.closeout.reason}</p><p className="text-sm">Review reference: {review.closeout.reference}</p></>:review.issues.length?<ul className="list-disc space-y-1 pl-5 text-sm">{review.issues.map(issue=><li key={issue}>{issue}</li>)}</ul>:<>
 <p className="text-sm">No work, leave, payroll, pay adjustment or unresolved request was found in the checked records. Confirm the facts beyond these records before closing.</p>
 <label className="block text-sm font-bold">No-work closeout reason<textarea className={workforceInput} value={reason} onChange={e=>setReason(e.target.value)} minLength={12} maxLength={2000}/></label>
 <label className="block text-sm font-bold">No-work review evidence<textarea className={workforceInput} value={reference} onChange={e=>setReference(e.target.value)} minLength={20} maxLength={2000}/></label>
 <label className="flex gap-2 text-sm"><input type="checkbox" checked={noWork} onChange={e=>setNoWork(e.target.checked)}/>I verified that no work, orientation or paid training was performed.</label>
 <label className="flex gap-2 text-sm"><input type="checkbox" checked={noObligations} onChange={e=>setNoObligations(e.target.checked)}/>I verified that no wages, expenses, leave payout or other payment obligation remains.</label>
 <button type="button" className={workforceButton} disabled={busy||!noWork||!noObligations||reason.trim().length<12||reference.trim().length<20} onClick={()=>void close()}>Record no-work closeout</button>
 </>}
 </div></details>
}
