import {useState} from 'react'
import {w4MultipleJobs2026,type W4MultipleJobsResult} from '../../utils/w4MultipleJobs2026.js'

const input='mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm'
const dollars=(cents:number)=>`${Math.floor(cents/100)}.${String(cents%100).padStart(2,'0')}`
function amount(text:string){
 if(!/^\d+(\.\d{1,2})?$/.test(text))throw new Error('Enter each annual wage and extra amount in dollars, with up to two decimal places. Use 0 when applicable.')
 const [whole,fraction='']=text.split('.'),value=Number(whole)*100+Number(fraction.padEnd(2,'0'))
 if(!Number.isSafeInteger(value))throw new Error('This dollar amount is too large.')
 return value
}
export default function W4MultipleJobsWorksheet({filingStatus,exempt,onApply}:{filingStatus:string;exempt:boolean;onApply:(value:string)=>void}){
 const [jobs,setJobs]=useState('2'),[wages,setWages]=useState(['','','']),[periods,setPeriods]=useState(''),[extra,setExtra]=useState('0'),[highest,setHighest]=useState(false)
 const [calculation,setCalculation]=useState<{key:string;result:W4MultipleJobsResult}|null>(null),[error,setError]=useState('')
 const key=JSON.stringify({filingStatus,jobs,wages,periods,extra,exempt})
 const result=calculation?.key===key&&!exempt?calculation.result:null
 const calculate=()=>{
  setError('');setCalculation(null)
  try{
   if(exempt)throw new Error('An exempt W-4 leaves Steps 2–4 blank.')
   if(!/^\d+$/.test(periods))throw new Error('Enter a whole number of annual pay periods.')
   setCalculation({key,result:w4MultipleJobs2026({filingStatus,annualWagesCents:wages.slice(0,Number(jobs)).map(amount),payPeriods:Number(periods),additionalCents:amount(extra)})})
  }catch(e){setError(e instanceof Error?e.message:'Unable to calculate the worksheet.')}
 }
 const download=()=>{
  if(!result)return
  const text=['2026 Form W-4 — Step 2(b) Multiple Jobs Worksheet','Source: IRS Form W-4 (2026), pages 3 and 5','Keep for your records. This worksheet is not a signed W-4.',`Filing status: ${filingStatus}`,...wages.slice(0,Number(jobs)).map((w,i)=>`Job ${i+1} annual taxable wages: $${w}`),...lines(result).map(([label,value])=>`${label}: ${value}`),'Apply Step 4(c) only to the W-4 for the highest paying job.','Annual worksheet estimates do not account for year-to-date withholding or partial-year changes.'].join('\n')
  const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'})),link=document.createElement('a')
  link.href=url;link.download='W4-2026-multiple-jobs-worksheet.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
 }
 return <details className="rounded-xl border border-slate-300 bg-white p-3">
  <summary className="cursor-pointer font-semibold">Calculate Step 2(b): Multiple Jobs Worksheet</summary>
  <section aria-label="Multiple Jobs Worksheet" className="mt-3 space-y-3">
   <p className="text-sm">Use this worksheet on one W-4, preferably for the highest paying job. Include your spouse’s concurrent jobs if married filing jointly. Update other jobs’ W-4 forms if you have not updated withholding since 2019. Use only one Step 2 method.</p>
   <p className="text-sm">This is the annual worksheet from pages 3 and 5. For self-employment, partial-year work, changes during the year, more than three jobs, or more than one job over $120,000, use the IRS estimator or the additional guidance in Publication 505. It does not account for tax already withheld this year.</p>
   <p className="text-sm">Job wages stay on this screen. Save W-4 draft retains only the result after you apply it. Download a worksheet copy before leaving if you want to keep the calculation.</p>
   <label className="block text-sm font-semibold">Number of concurrent jobs<select className={input} value={jobs} onChange={e=>setJobs(e.target.value)}><option value="2">Two jobs</option><option value="3">Three jobs</option></select></label>
   {wages.slice(0,Number(jobs)).map((value,index)=><label key={index} className="block text-sm font-semibold">Job {index+1}: annual taxable wages in dollars<input className={input} inputMode="decimal" autoComplete="off" value={value} onChange={e=>setWages(current=>current.map((w,i)=>i===index?e.target.value:w))}/></label>)}
   <label className="block text-sm font-semibold">Pay periods per year at the highest paying job<input className={input} inputMode="numeric" value={periods} onChange={e=>setPeriods(e.target.value)}/></label>
   <p className="text-sm">Common frequencies: weekly 52, every other week 26, twice monthly 24, monthly 12.</p>
   <label className="block text-sm font-semibold">Other additional withholding per paycheck in dollars<input className={input} inputMode="decimal" value={extra} onChange={e=>setExtra(e.target.value)}/></label>
   <button type="button" disabled={exempt} className="rounded-lg bg-slate-800 px-3 py-2 font-semibold text-white disabled:opacity-40" onClick={calculate}>Calculate multiple-job withholding</button>
   {error?<p role="alert" className="text-sm text-red-800">{error}</p>:null}
   {result?<div className="space-y-3">
    <dl className="space-y-2 text-sm">{lines(result).map(([label,value])=><div key={label} className="flex flex-wrap justify-between gap-2"><dt>{label}</dt><dd className="font-semibold">{value}</dd></div>)}</dl>
    <p className="text-sm">Applying replaces the current Step 4(c) amount and clears the alternative Step 2(c) checkbox. Add any other desired withholding above before applying. The result is rounded to the nearest cent.</p>
    <label className="flex gap-2 text-sm"><input type="checkbox" checked={highest} onChange={e=>setHighest(e.target.checked)}/>This W-4 is for the highest paying job.</label>
    <div className="flex flex-wrap gap-3"><button type="button" disabled={!highest} className="rounded-lg bg-slate-950 px-3 py-2 font-semibold text-white disabled:opacity-40" onClick={()=>onApply(dollars(result.step4cCents))}>Apply worksheet to Step 4(c)</button><button type="button" className="font-semibold underline" onClick={download}>Download worksheet for my records</button></div>
   </div>:null}
  </section>
 </details>
}
function lines(result:W4MultipleJobsResult):[string,string][]{
 return [
  ...(result.line1Cents!==null?[['Line 1: annual amount for two jobs',`$${dollars(result.line1Cents)}`] as [string,string]]:[]),
  ...(result.line2aCents!==null?[['Line 2(a): two highest paying jobs',`$${dollars(result.line2aCents)}`],['Line 2(b): combined wages and third job',`$${dollars(result.line2bCents!)}`],['Line 2(c): annual total',`$${dollars(result.line2cCents!)}`]] as [string,string][]:[]),
  ['Line 3: pay periods',String(result.line3)],['Line 4: worksheet amount per paycheck',`$${dollars(result.line4Cents)}`],['Other additional withholding',`$${dollars(result.additionalCents)}`],['Step 4(c): total per paycheck',`$${dollars(result.step4cCents)}`],
 ]
}
