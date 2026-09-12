import {useRef,useState} from 'react'
import {payrollApi,type PayrollEmployee} from '../../utils/payrollApi'
import SalaryReview from './SalaryReview'
import {workforceButton,workforceInput} from './OnboardingWorkspace'

export default function HiringPayBasis({employee,onChanged}:{employee:PayrollEmployee;onChanged:()=>Promise<void>}){
 const [open,setOpen]=useState(false),[reason,setReason]=useState(''),[hourly,setHourly]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const submission=useRef<{signature:string;requestId:string}|null>(null)
 const target=employee.payType==='HOURLY'?'SALARY':'HOURLY'
 async function save(salaryReview?:Record<string,unknown>){
  if(reason.trim().length<20||!confirmed)throw new Error('Enter a detailed reason and confirm the revised offer before saving.')
  const body={employmentStart:employee.hireDate.slice(0,10),fromPayType:employee.payType,payType:target,reason:reason.trim(),confirmed,...(target==='HOURLY'?{hourlyRateCents:Math.round(Number(hourly)*100)}:{annualSalaryCents:salaryReview?.annualSalaryCents,salaryReview})}
  const signature=JSON.stringify(body)
  if(submission.current?.signature!==signature)submission.current={signature,requestId:crypto.randomUUID()}
  await payrollApi.changePayBasis(employee.id,{...body,requestId:submission.current.requestId})
 }
 return <section className="rounded-2xl border border-slate-200 bg-white p-5">
  <h2 className="text-xl font-black">Hiring pay basis</h2>
  <p className="mt-2 text-sm text-slate-600">Current offer: {employee.payType==='HOURLY'?'hourly':'salary'} · starts {employee.hireDate.slice(0,10)}. Revise the offer before work begins. Pay review and the employee’s wage acknowledgment will reopen.</p>
  <button type="button" className={`${workforceButton} mt-3`} onClick={()=>setOpen(!open)}>{open?'Close offer revision':`Revise offer to ${target==='SALARY'?'salary':'hourly'}`}</button>
  {open?<div className="mt-4 space-y-3">
   <label className="block text-sm font-bold">Pay basis change reason<textarea required minLength={20} maxLength={2000} rows={3} className={workforceInput} value={reason} onChange={e=>{setReason(e.target.value);setConfirmed(false)}}/></label>
   <label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I confirm the revised hiring offer and understand that fresh pay review and wage acknowledgment are required.</label>
   {target==='SALARY'?<SalaryReview employee={{...employee,annualSalaryCents:0,salaryReview:null}} onOfferChange={save} onChanged={onChanged}/>:<form className="space-y-3" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await save();await onChanged()}catch(e){setError(e instanceof Error?e.message:'Unable to revise offer')}finally{setBusy(false)}}}>
    <label className="block text-sm font-bold">New hourly offer ($/hour)<input required type="number" min="0.01" step="0.01" className={workforceInput} value={hourly} onChange={e=>{setHourly(e.target.value);setConfirmed(false)}}/></label>
    <button disabled={busy||!confirmed||reason.trim().length<20} className={workforceButton}>Change offer to hourly</button>
   </form>}
   {error?<p role="alert" className="text-red-700">{error}</p>:null}
  </div>:null}
 </section>
}
