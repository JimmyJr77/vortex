import {useState} from 'react'
import {adminApiRequest} from '../../utils/api'
type Contribution={paymentDate:string;month:string;employeeId:string;employeeName:string;planId:string;planName:string;optionId:string;optionLabel:string;amountCents:number;taxTreatment:string;runId:number}
const money=(cents:number)=>(cents/100).toLocaleString('en-US',{style:'currency',currency:'USD'})
export default function BenefitContributionSummary({start,end,valid}:{start:string;end:string;valid:boolean}){
 const [rows,setRows]=useState<Contribution[]|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const load=async()=>{setBusy(true);setError('');setRows(null);try{
  const response=await adminApiRequest(`/api/admin/payroll/reports/benefit-contributions?${new URLSearchParams({start,end})}`),json=await response.json()
  if(!response.ok)throw new Error(json.message||'Could not load benefit contributions')
  setRows(json.data.contributions)
 }catch(e){setError(e instanceof Error?e.message:'Could not load benefit contributions')}finally{setBusy(false)}}
 const groups=new Map<string,Contribution[]>()
 for(const row of rows||[]){const key=JSON.stringify([row.month,row.planId,row.optionId,row.planName,row.optionLabel]);groups.set(key,[...(groups.get(key)||[]),row])}
 return <div className="mt-4 space-y-3">
  <button type="button" disabled={busy||!valid} onClick={()=>void load()} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold disabled:opacity-50">{busy?'Loading contributions…':'Review benefit contributions'}</button>
  {error?<p role="alert" className="text-sm text-red-700">{error}</p>:null}
  {rows?<section aria-label="Benefit contribution reconciliation" className="space-y-3 text-sm">
   <p className="font-bold">Collected: {money(rows.reduce((sum,row)=>sum+row.amountCents,0))} · {rows.length} plan {rows.length===1?'contribution':'contributions'}</p>
   <p className="text-slate-600">Payments from {start} through {end}. These totals record employee deductions; carrier payment is reconciled separately.</p>
   {!rows.length?<p>No finalized benefit contributions in this payment range.</p>:null}
   {[...groups.entries()].map(([key,items])=><div key={key} className="rounded-xl border border-slate-200 p-3">
    <h4 className="break-words font-bold">{items[0].planName} · {items[0].optionLabel} · {items[0].month}</h4>
    <p className="mt-1">{money(items.reduce((sum,row)=>sum+row.amountCents,0))} · {new Set(items.map(row=>row.employeeId)).size} {new Set(items.map(row=>row.employeeId)).size===1?'employee':'employees'}</p>
    <details className="mt-2"><summary className="cursor-pointer font-semibold">Employee deductions</summary><div className="mt-2 space-y-2">{items.map(row=><p key={`${row.runId}:${row.employeeId}`} className="break-words rounded-lg bg-slate-50 p-2">{row.employeeName||`Employee ${row.employeeId}`} · {money(row.amountCents)}<br/>Paid {row.paymentDate} · Payroll {row.runId}</p>)}</div></details>
   </div>)}
  </section>:null}
 </div>
}
