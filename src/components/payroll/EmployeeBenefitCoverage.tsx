import {useEffect,useState} from 'react'
import {employeePayrollApi,type EmployeeBenefitCoverage as Coverage} from '../../utils/employeePayrollApi'
function MonthlyCoverage({month}:{month:string}){
 const [data,setData]=useState<Coverage|null>(null),[error,setError]=useState(''),[refresh,setRefresh]=useState(0)
 useEffect(()=>{let live=true,inFlight=false;const load=async()=>{if(inFlight)return;inFlight=true;try{const next=await employeePayrollApi.benefitCoverage(month);if(live){setData(next);setError('')}}catch(e){if(live)setError(e instanceof Error?e.message:'Unable to load coverage.')}finally{inFlight=false}};void load();const timer=setInterval(()=>void load(),30000);return()=>{live=false;clearInterval(timer)}},[month,refresh])
 return <div className="space-y-3 text-sm"><button type="button" onClick={()=>setRefresh(value=>value+1)} className="rounded-xl border px-3 py-2 font-bold">Refresh my coverage</button>
 {error?<p role="alert">{error} Coverage may be outdated; automatic refresh will retry.</p>:null}
 {!data&&!error?<p role="status">Loading coverage…</p>:null}
 {data&&!data.rows.length?<p>No retained plan coverage records for this month. Check your onboarding benefits choice or contact your hiring admin; this does not establish that you are uninsured.</p>:null}
 {data?.rows.map(row=><article key={`${row.onboardingCycle}:${row.planId}`} className="space-y-2 rounded-xl border border-slate-200 p-3"><h4 className="font-bold">{row.planName} · Employment cycle {row.onboardingCycle}</h4>
 {error?<p>Refresh is required before relying on this retained review.</p>:row.status==='COVERED'?<><p>Admin verified carrier coverage with {row.carrier}.</p><p>Covered dates: {row.coverageStart} through {row.coverageEnd}.</p></>:row.status==='NOT_COVERED'?<p>Admin recorded no carrier coverage for this month with {row.carrier}. Contact your hiring admin about this determination.</p>:<p>Admin coverage review required. An earlier review may have changed or been retracted. Contact your hiring admin before relying on coverage.</p>}
 {row.reviewedAt?<p>Last retained review: {new Date(row.reviewedAt).toLocaleString()}.</p>:null}</article>)}
 </div>
}
export default function EmployeeBenefitCoverage({onRequestHelp}:{onRequestHelp?:(month:string)=>void}){
 const [month,setMonth]=useState(()=>`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`),valid=/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)
 return <section aria-label="My monthly benefit coverage" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5"><h3 className="text-lg font-black">My monthly benefit coverage</h3><p className="text-sm text-slate-600">Your admin’s retained carrier review, including months before your first paycheck. This is separate from payroll deductions and is not a live carrier eligibility lookup.</p><label className="block text-sm font-bold">My coverage month<input type="month" value={month} onChange={event=>setMonth(event.target.value)} className="mt-1 block rounded-xl border px-3 py-2"/></label>{valid&&onRequestHelp?<button type="button" onClick={()=>onRequestHelp(month)} className="rounded-xl border px-3 py-2 text-sm font-bold">Ask my admin about coverage</button>:null}{valid?<MonthlyCoverage key={month} month={month}/>:<p>Choose a valid coverage month.</p>}</section>
}
