import {useRef,useState} from 'react'
import {payrollApi,type ReviewedWorkweekAllocation} from '../../utils/payrollApi'
import {workforceButton,workforceInput} from './OnboardingWorkspace'
export default function WorkweekAllocationApproval({employeeId,body,onBusy,onSaved}:{employeeId:number;body:Record<string,unknown>;onBusy:(busy:boolean)=>void;onSaved:(record:ReviewedWorkweekAllocation)=>void}){
 const [reason,setReason]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const request=useRef<{signature:string;requestId:string}|null>(null)
 return <form className="mt-3 space-y-3 border-t border-slate-200 pt-3" onSubmit={async e=>{e.preventDefault();setBusy(true);onBusy(true);setError('');try{const input={...body,reason:reason.trim(),confirmed},signature=JSON.stringify(input);if(request.current?.signature!==signature)request.current={signature,requestId:crypto.randomUUID()};const saved=await payrollApi.saveWorkweekAllocation(employeeId,{...input,requestId:request.current.requestId});onSaved(saved)}catch(e){setError(e instanceof Error?e.message:'Unable to save allocation review')}finally{setBusy(false);onBusy(false)}}}>
  <p className="font-bold">Retain allocation review</p><p>Save after the full workweek ends. This retains your review; payment still requires current evidence and paid-premium reconciliation.</p>
  <label className="block">Allocation review reason<textarea required minLength={20} maxLength={2000} disabled={busy} rows={3} className={workforceInput} value={reason} onChange={e=>{setReason(e.target.value);setConfirmed(false)}}/></label>
  <label className="flex gap-2"><input type="checkbox" disabled={busy} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I reviewed the complete salary allocation and its supporting workweek evidence.</label>
  <button disabled={busy||!confirmed||reason.trim().length<20} className={workforceButton}>{busy?'Saving review…':'Save allocation review'}</button>
  {error?<p role="alert" className="text-red-700">{error}</p>:null}
 </form>
}
