import {useRef,useState} from 'react'
import {payrollApi} from '../../utils/payrollApi'
import {workforceButton,workforceInput} from './OnboardingWorkspace'
type RecordValue=Record<string,unknown>
export default function WorkweekSettlementAuthorization({employeeId,payPeriodId,week,reconciliation,authorization}:{employeeId:number;payPeriodId:number;week:string;reconciliation:RecordValue;authorization:RecordValue}){
 const [reason,setReason]=useState(''),[historyComplete,setHistoryComplete]=useState(false),[confirmed,setConfirmed]=useState(false)
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState<RecordValue|null>(null)
 const request=useRef<{signature:string;requestId:string}|null>(null)
 const record=saved||authorization,current=record.status==='CURRENT'
 return <section aria-label="Workweek settlement authorization" className="space-y-3 rounded-lg border bg-white p-3">
  <p className="font-bold">Settlement authorization</p>
  {record.id?<div><p>{saved?'Authorization retained. Reload payroll to check current evidence.':current?'Authorization matches reviewed evidence.':'Authorization needs a new review.'}</p><p>Authorization #{String(record.id)} · {new Date(String(record.authorizedAt)).toLocaleDateString()}</p><p>{String(record.reason)}</p></div>:null}
  <p>Confirm that all payments for this workweek are recorded, including payments outside this system. Payroll must recheck this authorization before applying the unsettled earnings.</p>
  {saved?<p role="status">Settlement authorization saved. No payment has been applied.</p>:null}
  {!saved&&!current&&reconciliation.status==='EVIDENCE_RECONCILED'?<form className="space-y-3" onSubmit={async e=>{
   e.preventDefault();setBusy(true);setError('')
   try{
    const input={payPeriodId,week,fingerprint:reconciliation.fingerprint,reason:reason.trim(),historyComplete,confirmed},signature=JSON.stringify(input)
    if(request.current?.signature!==signature)request.current={signature,requestId:crypto.randomUUID()}
    setSaved(await payrollApi.authorizeWorkweekSettlement(employeeId,{...input,requestId:request.current.requestId}))
   }catch(error){setError(error instanceof Error?error.message:'Unable to save settlement authorization.')}finally{setBusy(false)}
  }}>
   <label className="block">Settlement review reason<textarea className={workforceInput} rows={3} required minLength={20} maxLength={2000} disabled={busy} value={reason} onChange={e=>{setReason(e.target.value);setConfirmed(false)}}/></label>
   <label className="flex gap-2"><input type="checkbox" checked={historyComplete} disabled={busy} onChange={e=>setHistoryComplete(e.target.checked)}/>All payments for this workweek, including payments outside this system, are recorded.</label>
   <label className="flex gap-2"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/>I authorize the reviewed unpaid earnings for payroll settlement after current evidence is rechecked.</label>
   <button className={workforceButton} disabled={busy||!confirmed||!historyComplete||reason.trim().length<20}>{busy?'Saving authorization…':'Authorize workweek settlement'}</button>
   {error?<p role="alert" className="text-red-700">{error}</p>:null}
  </form>:null}
 </section>
}
