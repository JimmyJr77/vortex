import {useState} from 'react'
import {payrollApi} from '../../utils/payrollApi'
import {workforceButton,workforceInput} from './OnboardingWorkspace'
export default function SalaryChangeCancellation({employeeId,changeId,effectiveOn,onChanged}:{employeeId:number;changeId:number;effectiveOn:string;onChanged:()=>Promise<void>}){
 const [noticeDeliveredOn,setDate]=useState(''),[noticeReference,setReference]=useState(''),[reason,setReason]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('')
 return <details className="mt-2 rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer font-bold">Cancel salary change effective {effectiveOn}</summary><p className="mt-2 text-sm text-slate-600">Cancellation restores the preceding salary agreement from this date. The scheduled change and cancellation remain in history. Deliver written notice before submitting.</p><form className="mt-3 space-y-3" onSubmit={async event=>{event.preventDefault();setBusy(true);setError('');try{await payrollApi.cancelSalaryChange(employeeId,changeId,{noticeDeliveredOn,noticeReference,reason,noticeConfirmed:confirmed});await onChanged()}catch(e){setError(e instanceof Error?e.message:'Unable to cancel salary change')}finally{setBusy(false)}}}>
 <label className="block text-sm font-bold">Salary cancellation notice date<input required type="date" className={workforceInput} value={noticeDeliveredOn} onChange={e=>{setDate(e.target.value);setConfirmed(false)}}/></label>
 <label className="block text-sm font-bold">Salary cancellation notice reference<input required minLength={12} className={workforceInput} value={noticeReference} onChange={e=>{setReference(e.target.value);setConfirmed(false)}}/></label>
 <label className="block text-sm font-bold">Salary cancellation reason<textarea required minLength={12} rows={2} className={workforceInput} value={reason} onChange={e=>{setReason(e.target.value);setConfirmed(false)}}/></label>
 <label className="flex gap-2 text-sm"><input required type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I confirm the cancellation notice was delivered and the preceding agreement should resume.</label>
 <button disabled={busy||!confirmed} className={workforceButton}>Confirm salary cancellation</button>{error?<p role="alert" className="text-red-700">{error}</p>:null}
 </form></details>
}
