import RetirementAllocationFile from './RetirementAllocationFile'
import RetirementRemittancePreview from './RetirementRemittancePreview'
import {useEffect,useState} from 'react'
import {adminApiRequest} from '../../utils/api'
type Allocation={allocationFormat?:{status:string};timing?:{status:string;depositDate?:string;submissionAt?:string};destinationReview:{status:string};participantMapping:{status:string};ledgerId:string;employeeId:string;employeeName:string;planId:string;planName:string;ordinaryPretaxCents:number;ordinaryRothCents:number;catchUpPretaxCents:number;catchUpRothCents:number;totalCents:number}
type Source={sourceFingerprint:string|null;runId:string;paymentDate:string;runKind:string;status:'DELIVERY_UNVERIFIED'|'NO_EMPLOYEE_CONTRIBUTION'|'RECONCILIATION_REQUIRED';totalCents:number|null;allocations:Allocation[];issue:string|null}
type Page={year:number;items:Source[];nextCursor:string|null}
const money=(cents:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100)
export default function RetirementRemittanceSources(){
 const [data,setData]=useState<Page|null>(null),[cursor,setCursor]=useState<string|null>(null),[refresh,setRefresh]=useState(0),[error,setError]=useState(''),[loading,setLoading]=useState(true)
 useEffect(()=>{
  let live=true,inFlight=false
  const read=async()=>{if(inFlight)return;inFlight=true;try{
   const response=await adminApiRequest(`/api/admin/payroll/retirement-remittance-sources${cursor?`?beforeRunId=${encodeURIComponent(cursor)}`:''}`),body=await response.json()
   if(!response.ok||!body.success)throw new Error(body.message||'Unable to reconcile retirement contributions.')
   if(live){setData(body.data);setError('')}
  }catch(e){if(live){setData(null);setError(e instanceof Error?e.message:'Unable to reconcile retirement contributions.')}}finally{inFlight=false;if(live)setLoading(false)}}
  setLoading(true);setData(null);void read();const timer=setInterval(()=>void read(),30000)
  return()=>{live=false;clearInterval(timer)}
 },[cursor,refresh])
 return <section aria-label="Retirement contribution reconciliation" className="space-y-3 rounded-xl border border-slate-200 p-4">
  <h4 className="font-bold">Retirement contribution reconciliation · 2026</h4>
  <p className="text-sm">Review employee deductions from finalized payroll before arranging remittance. Bank payment and allocation file delivery have separate authorization and recovery. Plan receipt and participant allocation still require verification. Delivery remains unverified; these amounts are not a provider balance.</p>
  <div className="flex flex-wrap gap-2"><button type="button" disabled={loading} className="rounded border px-3 py-2" onClick={()=>setRefresh(n=>n+1)}>Refresh contributions</button>{cursor?<button type="button" disabled={loading} className="rounded border px-3 py-2" onClick={()=>setCursor(null)}>Newest payroll contributions</button>:null}</div>
  {loading?<p role="status">Reconciling payroll contributions…</p>:null}{error?<p role="alert">{error} Automatic refresh will retry.</p>:null}
  {data&&!data.items.length?<p>No finalized retirement payroll on this page.</p>:null}
  {data?.items.map(run=><article key={run.runId} aria-label={`Retirement contributions for payroll ${run.runId}`} className="space-y-2 rounded-lg border p-3">
   <h5 className="font-bold">Payroll {run.runId} · Paid {run.paymentDate}</h5>
   {run.status==='RECONCILIATION_REQUIRED'?<p role="alert">Reconciliation required: {run.issue} Resolve the retained payroll evidence before preparing remittance.</p>:<>
    <p className="font-semibold">{run.status==='DELIVERY_UNVERIFIED'?`Withheld: ${money(run.totalCents!)} · Delivery unverified`:'No employee contribution withheld'}</p>
    {run.allocations.map(a=><div key={a.ledgerId} className="space-y-1 border-t pt-2 text-sm"><p className="font-semibold">{a.employeeName} · {a.planName}</p><p>Contribution timing: {a.timing?.status.replaceAll('_',' ')||'REVIEW REQUIRED'}</p>{a.timing?.depositDate?<p>Reviewed deposit target: {a.timing.depositDate} · Submission cutoff: {new Date(a.timing.submissionAt!).toLocaleString()}</p>:null}<p>Allocation format: {a.allocationFormat?.status.replaceAll('_',' ')||'REVIEW REQUIRED'}</p><p>Participant mapping: {a.participantMapping.status.replaceAll('_',' ')}</p><p>Destination review: {a.destinationReview.status.replaceAll('_',' ')}</p><dl>{[['Pretax',a.ordinaryPretaxCents],['Roth',a.ordinaryRothCents],['Pretax catch-up',a.catchUpPretaxCents],['Roth catch-up',a.catchUpRothCents],['Employee contribution',a.totalCents]].map(([label,cents])=><div key={String(label)} className="flex justify-between gap-3"><dt>{label}</dt><dd>{money(Number(cents))}</dd></div>)}</dl></div>)}
   {run.sourceFingerprint?[...new Set(run.allocations.filter(a=>a.totalCents>0).map(a=>a.planId))].map(planId=><div key={planId} className="space-y-3"><RetirementRemittancePreview runId={run.runId} planId={planId} sourceFingerprint={run.sourceFingerprint!}/><RetirementAllocationFile runId={run.runId} planId={planId} sourceFingerprint={run.sourceFingerprint!}/></div>):null}
   </>}
  </article>)}
  {data?.nextCursor?<button type="button" className="rounded border px-3 py-2" onClick={()=>setCursor(data.nextCursor)}>Older payroll contributions</button>:null}
  <p className="text-sm text-slate-600">Each page shows up to 20 payrolls and refreshes automatically. Approved unpaid payroll and outside-employer contributions are excluded.</p>
 </section>
}
