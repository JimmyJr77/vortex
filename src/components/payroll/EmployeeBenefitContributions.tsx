import {useEffect,useState} from 'react'
import {workforceApi,type EmployeeBenefitContribution} from '../../utils/workforceApi'
const money=(cents:number)=>(cents/100).toLocaleString('en-US',{style:'currency',currency:'USD'})
function Contributions({year}:{year:string}){
 const [rows,setRows]=useState<EmployeeBenefitContribution[]|null>(null),[error,setError]=useState('')
 useEffect(()=>{
  let cancelled=false
  workforceApi.benefitContributions(`${year}-01-01`,`${year}-12-31`).then(data=>{if(!cancelled)setRows(data.contributions)}).catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:'Unable to load benefit contributions.')})
  return ()=>{cancelled=true}
 },[year])
 if(error)return <p role="alert" className="text-sm text-red-700">{error}</p>
 if(!rows)return <p role="status" className="text-sm">Loading benefit contributions…</p>
 return <div className="space-y-3 text-sm"><p className="font-bold">Collected in {year}: {money(rows.reduce((sum,row)=>sum+row.amountCents,0))}</p>
 {!rows.length?<p>No finalized benefit contributions in this year.</p>:null}
 {rows.map((row,index)=><article key={`${row.runId}:${index}`} className="space-y-1 rounded-xl border border-slate-200 p-3"><h4 className="break-words font-bold">{row.planName} · {row.optionLabel}</h4><p>{money(row.amountCents)} · Coverage month {row.month}</p><p>Paid {row.paymentDate} · Payroll {row.runId}</p><p>{row.taxTreatment==='POSTTAX'?'After-tax contribution':row.taxTreatment==='PRETAX'?'Pretax contribution':row.taxTreatment}</p></article>)}
 </div>
}
export default function EmployeeBenefitContributions(){
 const [year,setYear]=useState(()=>String(new Date().getFullYear())),[refresh,setRefresh]=useState(0)
 const valid=/^\d{4}$/.test(year)&&Number(year)>=2000&&Number(year)<=9998
 return <section aria-label="My benefit contributions" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"><h3 className="text-lg font-black">My benefit contributions</h3><p className="text-sm text-slate-600">Contributions deducted from finalized payroll, grouped by payment year. These records do not confirm carrier payment or coverage.</p>
 <div className="flex flex-wrap items-end gap-3"><label className="text-sm font-bold">Contribution payment year<input type="number" min="2000" max="9998" value={year} onChange={e=>setYear(e.target.value)} className="mt-1 block w-32 rounded-xl border border-slate-300 px-3 py-2"/></label><button type="button" disabled={!valid} onClick={()=>setRefresh(n=>n+1)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold disabled:opacity-50">Refresh contributions</button></div>
 {valid?<Contributions key={`${year}:${refresh}`} year={year}/>:<p className="text-sm">Enter a four-digit year from 2000 through 9998.</p>}
 </section>
}
