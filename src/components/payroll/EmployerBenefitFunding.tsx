import {useState} from 'react'
import {adminApiRequest} from '../../utils/api'
type Funding={employeeId:string;employeeName:string;month:string;effectiveOn:string;evidenceFingerprint:string;coverageVersions:number;employeeCollectedCents:number;payrolls:{runId:number;paymentDate:string}[];items:{planId:string;planName:string;optionLabel:string;employerMonthlyCents:number;assumedEmployeeMonthlyCents:number}[]}
const money=(cents:number)=>(cents/100).toLocaleString('en-US',{style:'currency',currency:'USD'})
export default function EmployerBenefitFunding({start,end,valid}:{start:string;end:string;valid:boolean}){
 const [rows,setRows]=useState<Funding[]|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const load=async()=>{setBusy(true);setRows(null);setError('');try{
  const response=await adminApiRequest(`/api/admin/payroll/reports/employer-benefit-funding?${new URLSearchParams({start,end})}`),json=await response.json()
  if(!response.ok)throw new Error(json.message||'Unable to load employer funding')
  setRows(json.data.funding)
 }catch(e){setError(e instanceof Error?e.message:'Unable to load employer funding')}finally{setBusy(false)}}
 return <div className="mt-4 space-y-3 text-sm"><button type="button" disabled={busy||!valid} onClick={()=>void load()} className="rounded-xl border border-slate-300 px-4 py-2 font-bold disabled:opacity-50">{busy?'Loading employer funding…':'Review employer benefit funding'}</button>
 {error?<p role="alert" className="text-red-700">{error}</p>:null}
 {rows?<section aria-label="Employer benefit funding reconciliation" className="space-y-3"><p>Published monthly premiums from finalized payroll evidence. Repeated payrolls are combined for each retained funding decision; amounts are not charges per paycheck. Reconcile coverage dates, carrier invoices and prior employee collections before recording an expense or payment.</p>{!rows.length?<p>No finalized employer-funded continuation in this payment range.</p>:null}
 {rows.map(row=><article key={`${row.employeeId}:${row.month}:${row.evidenceFingerprint}`} className="space-y-2 rounded-xl border border-slate-200 p-3"><h4 className="font-bold">{row.employeeName} · {row.month}</h4><p>Funding effective {row.effectiveOn}</p>{row.items.map(item=><p key={item.planId}>{item.planName} · {item.optionLabel}: {money(item.employerMonthlyCents)}/month, including {money(item.assumedEmployeeMonthlyCents)} assumed employee share.</p>)}<p>Employee contributions already collected this month: {money(row.employeeCollectedCents)}. This employee-level amount is shared across all displayed plans and funding versions; do not add it for each row.</p>{row.coverageVersions>1?<p className="font-semibold text-amber-900">{row.coverageVersions} funding decisions appear in this month. Reconcile the coverage change; these premiums cannot be added together.</p>:null}<p className="break-words">Payroll evidence: {row.payrolls.map(p=>`#${p.runId} (${p.paymentDate})`).join(', ')}</p><p className="text-slate-600">Carrier reconciliation required. No employer-premium journal or carrier payment is established by this report.</p></article>)}</section>:null}</div>
}
