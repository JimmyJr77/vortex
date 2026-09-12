import {useState} from 'react'
import {adminApiRequest} from '../../utils/api'
type EmployeeBasis={employeeId:string;employeeNumber:string;employeeName:string;finalizedRunCount:number;verifiedRunCount:number;socialSecurityWages:string|null;medicareWages:string|null;additionalMedicareWages:string|null;review:string;federalWages:string|null;marylandWages:string|null;incomeVerifiedRunCount:number;incomeReview:string}
const money=(value:string)=>`$${value.replace(/\B(?=(\d{3})+(?!\d))/g,',')}`
export default function WageBasisReview({start,end,valid}:{start:string;end:string;valid:boolean}){
 const [rows,setRows]=useState<EmployeeBasis[]|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const load=async()=>{setBusy(true);setRows(null);setError('');try{
  const response=await adminApiRequest(`/api/admin/payroll/reports/wage-bases?${new URLSearchParams({start,end})}`),json=await response.json()
  if(!response.ok)throw new Error(json.message||'Unable to review retained wage bases.')
  setRows(json.data.employees)
 }catch(e){setError(e instanceof Error?e.message:'Unable to review retained wage bases.')}finally{setBusy(false)}}
 return <div className="mt-4 space-y-3"><button type="button" disabled={busy||!valid} onClick={()=>void load()} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold disabled:opacity-50">{busy?'Loading wage bases…':'Review retained wage bases'}</button>
 {error?<p role="alert" className="text-sm text-red-700">{error}</p>:null}
 {rows?<section aria-label="Retained payroll wage bases" className="space-y-3 text-sm"><p>Payments from {start} through {end}. Use a full calendar year for annual review.</p>
 {!rows.length?<p>No finalized or imported employee payments in this range.</p>:null}
 {rows.map(row=><article key={row.employeeId} className="space-y-2 rounded-xl border border-slate-200 p-3"><h4 className="break-words font-bold">{row.employeeName} · {row.employeeNumber}</h4><p>{row.verifiedRunCount} of {row.finalizedRunCount} finalized records have verified wage bases.</p>
 {row.socialSecurityWages===null||row.medicareWages===null||row.additionalMedicareWages===null?<><p className="font-semibold text-amber-900">Wage totals unavailable — review required.</p><p className="break-words text-slate-600">{row.review}</p></>:<><p className="font-semibold text-emerald-800">Finalized wage bases reconcile.</p><dl className="space-y-1"><div><dt className="inline">Social Security taxable wages: </dt><dd className="inline font-bold">{money(row.socialSecurityWages)}</dd></div><div><dt className="inline">Medicare taxable wages: </dt><dd className="inline font-bold">{money(row.medicareWages)}</dd></div><div><dt className="inline">Additional Medicare taxable wages: </dt><dd className="inline font-bold">{money(row.additionalMedicareWages)}</dd></div></dl></>}
 <div className="space-y-1 border-t border-slate-200 pt-2"><h5 className="font-bold">Income-tax wage inputs</h5><p>Verified records: {row.incomeVerifiedRunCount} / {row.finalizedRunCount}</p>{row.federalWages===null||row.marylandWages===null?<><p className="font-semibold text-amber-900">Income-tax wage totals unavailable — review required.</p><p className="break-words text-slate-600">{row.incomeReview}</p></>:<><p className="text-slate-600">{row.incomeReview}</p><p>Federal wage input: <strong>{money(row.federalWages)}</strong></p><p>Maryland wage input: <strong>{money(row.marylandWages)}</strong></p></>}</div>
 </article>)}
 </section>:null}</div>
}
