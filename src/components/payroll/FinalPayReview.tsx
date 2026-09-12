import NoWorkCloseout from './NoWorkCloseout'
import {useEffect,useState} from 'react'
import {payrollApi,type FinalPayStatus} from '../../utils/payrollApi'
import {workforceButton} from './OnboardingWorkspace'
export default function FinalPayReview({employeeId,onOpenPayroll,refreshKey,onClosed}:{employeeId:number;refreshKey?:unknown;onClosed:()=>void;onOpenPayroll:(periodId:number)=>void}){
 const [data,setData]=useState<FinalPayStatus|null>(null),[error,setError]=useState('')
 useEffect(()=>{let active=true;payrollApi.finalPayStatus(employeeId).then(value=>{if(active)setData(value)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[employeeId,refreshKey])
 return <section aria-label="Final-period payroll" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-black">Final-period payroll</h2>{error?<p role="alert" className="text-red-700">{error}</p>:!data?<p>Loading final payroll…</p>:<>
 <p className="text-sm">Employment ended {data.terminationDate||'—'}. {data.status!=='NO_WORK_CLOSED'?<>Regular final-period payday: <strong>{data.dueOn||'needs verification'}</strong>.</>:null}</p>
 <p className={`font-bold ${data.status==='PAYROLL_OVERDUE'?'text-red-700':'text-slate-800'}`}>{data.status==='NO_WORK_CLOSED'?'No-work hiring closeout recorded':data.status==='PAYROLL_FINALIZED'?'Final-period payroll finalized':data.status==='PAYROLL_OVERDUE'?'Final-period payroll confirmation is overdue':'Final-period payroll is pending'}</p>
 {data.run?<p className="text-sm">Run #{data.run.id} · {data.run.status.replaceAll('_',' ')}{data.run.status==='FINALIZED'?` · paid ${data.run.paymentDate}${data.paymentTiming==='LATE'?' (after the regular payday)':''}`:''}</p>:null}
 {data.issues.length?<ul className="list-disc space-y-1 pl-5 text-sm text-amber-800">{data.issues.map(issue=><li key={issue}>{issue}</li>)}</ul>:null}
 <p className="text-sm text-slate-600">Review unpaid wages, earned bonuses, expenses and any leave payout required by the employment policy. A finalized regular payroll does not resolve later corrections or other outstanding obligations.</p>
 {data.period?<button type="button" className={workforceButton} onClick={()=>onOpenPayroll(data.period!.id)}>Open final payroll period</button>:null}
 </>}{data?.status!=='PAYROLL_FINALIZED'?<NoWorkCloseout employeeId={employeeId} refreshKey={refreshKey} onClosed={onClosed}/>:null}</section>
}
