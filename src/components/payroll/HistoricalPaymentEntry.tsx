import {useRef,useState} from 'react'
import {payrollApi} from '../../utils/payrollApi'
import {workforceButton,workforceInput} from './OnboardingWorkspace'
const empty={employeeId:'',periodStart:'',periodEnd:'',paymentDate:'',method:'CHECK',reference:'',gross:'',tax:'',net:'',evidence:''}
export default function HistoricalPaymentEntry({employees,onSaved}:{employees:Array<{id:number;legalFirstName:string;legalLastName:string}>;onSaved:()=>Promise<void>}){
 const [form,setForm]=useState(empty),[confirmed,setConfirmed]=useState(false),[wageOnly,setWageOnly]=useState(false),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false),[error,setError]=useState('')
 const request=useRef<{signature:string;requestId:string}|null>(null)
 const change=(key:keyof typeof empty,value:string)=>{setForm(f=>({...f,[key]:value}));setConfirmed(false);setError('')}
 return <details className="mb-4 rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer font-bold">Record prior wage payment</summary><p className="mt-3 text-sm">Use a source payroll register and payment record. This adds historical taxable wages to payroll history; it does not send money. Workweek and tax reconciliation remain separate.</p>{saved?<div className="mt-3"><p role="status">Historical payment recorded. Its source evidence is retained for reconciliation.</p><button className={workforceButton} onClick={()=>{setSaved(false);setForm(empty);setConfirmed(false);setWageOnly(false);request.current=null}}>Record another payment</button></div>:<form className="mt-3 space-y-3" onSubmit={async e=>{
  e.preventDefault();setBusy(true);setError('')
  try{
   const input={periodStart:form.periodStart,periodEnd:form.periodEnd,paymentDate:form.paymentDate,method:form.method,reference:form.reference,grossCents:Math.round(Number(form.gross)*100),taxCents:Math.round(Number(form.tax)*100),netCents:Math.round(Number(form.net)*100),evidence:form.evidence,confirmed,wageOnlyConfirmed:wageOnly},signature=JSON.stringify({employeeId:form.employeeId,...input})
   if(request.current?.signature!==signature)request.current={signature,requestId:crypto.randomUUID()}
   await payrollApi.recordHistoricalPayment(Number(form.employeeId),{...input,requestId:request.current.requestId});setSaved(true);await onSaved()
  }catch(error){setError(error instanceof Error?error.message:'Unable to record payment.')}finally{setBusy(false)}
 }}><fieldset disabled={busy} className="space-y-3">
  <label className="block">Employee for historical payment<select aria-label="Employee for historical payment" required className={workforceInput} value={form.employeeId} onChange={e=>change('employeeId',e.target.value)}><option value="">Select employee</option>{employees.map(e=><option key={e.id} value={e.id}>{e.legalFirstName} {e.legalLastName}</option>)}</select></label>
  <div className="grid gap-3 sm:grid-cols-3">{([['periodStart','Work period starts'],['periodEnd','Work period ends'],['paymentDate','Actual prior payment date']] as const).map(([key,label])=><label key={key}>{label}<input required type="date" className={workforceInput} value={form[key]} onChange={e=>change(key,e.target.value)}/></label>)}</div>
  <label className="block">Prior payment method<select aria-label="Prior payment method" className={workforceInput} value={form.method} onChange={e=>change('method',e.target.value)}>{['CHECK','ACH','CASH','WIRE'].map(method=><option key={method}>{method}</option>)}</select></label>
  <label className="block">Prior payment reference<input required minLength={4} maxLength={200} className={workforceInput} value={form.reference} onChange={e=>change('reference',e.target.value)}/></label>
  <div className="grid gap-3 sm:grid-cols-3">{([['gross','Gross wages ($)'],['tax','Taxes withheld ($)'],['net','Net paid ($)']] as const).map(([key,label])=><label key={key}>{label}<input required type="number" min="0" step="0.01" className={workforceInput} value={form[key]} onChange={e=>change(key,e.target.value)}/></label>)}</div>
  <label className="block">Historical payment source evidence<textarea required minLength={20} maxLength={2000} rows={3} className={workforceInput} value={form.evidence} onChange={e=>change('evidence',e.target.value)}/></label>
  <label className="flex gap-2"><input type="checkbox" checked={wageOnly} onChange={e=>setWageOnly(e.target.checked)}/>All gross is taxable wages before annual caps. This payment has no reimbursements or other deductions; gross minus taxes equals net paid.</label>
  <label className="flex gap-2"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I verified that this payment was made and is not already recorded.</label>
  <button disabled={!confirmed||!wageOnly||!form.employeeId} className={workforceButton}>{busy?'Recording payment…':'Save prior wage payment'}</button>
 </fieldset>{error?<p role="alert" className="text-red-700">{error}</p>:null}</form>}</details>
}
