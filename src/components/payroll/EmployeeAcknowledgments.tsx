import {useState} from 'react'
import {workforceApi,type SavedAcknowledgment} from '../../utils/workforceApi'
const labels:Record<string,string>={jobTitle:'Role',payType:'Pay basis',hourlyRateCents:'Hourly rate',annualSalaryCents:'Annual salary',overtimeClassification:'Overtime classification',hireDate:'Hire date',location:'Work location',paySchedule:'Pay schedule',salaryWeeklyHours:'Hours covered by weekly salary',normalWorkweekMinutes:'Normal sick-leave workweek'}
function savedTerms(row:SavedAcknowledgment):string{
 if(typeof row.terms==='string')return `${row.terms}\n\nBenefits\n${row.benefitsTerms===null?'Benefits text was not retained with this record.':row.benefitsTerms||'No additional benefits text.'}`
 if(!row.terms)return 'Saved terms are unavailable.'
 return Object.entries(labels).filter(([key])=>row.terms&&typeof row.terms==='object'&&row.terms[key]!==undefined&&!(key==='hourlyRateCents'&&row.terms.payType==='SALARY')&&!(key==='annualSalaryCents'&&row.terms.payType==='HOURLY')).map(([key,label])=>{
  const value=(row.terms as Record<string,unknown>)[key]
  const text=key==='hireDate'&&typeof value==='string'?value.slice(0,10):key==='overtimeClassification'?(value==='NONEXEMPT'?'Overtime eligible':value==='EXEMPT'?'Exempt':'Pending review'):key==='payType'?(value==='SALARY'?'Salary':value==='HOURLY'?'Hourly':String(value)):key.endsWith('Cents')&&value!==null?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(value)/100):key==='normalWorkweekMinutes'&&Array.isArray(value)?value.map((minutes,i)=>`${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][i]} ${Number(minutes)/60}h`).join(' · '):value===null?'Not recorded':String(value).replaceAll('_',' ')
  return `${label}: ${text}`
 }).join('\n')
}
function receipt(row:SavedAcknowledgment){return `${row.title}\nOnboarding cycle: ${row.cycle}\nAcknowledged by: ${row.signature}\n${row.submittedAt?`Submitted: ${row.submittedAt}`:'Submission time not retained'}\nRecord retained: ${row.recordedAt}\n\n${savedTerms(row)}\n\nSaved acknowledgment copy. This records the terms acknowledged at that time.\n`}
export default function EmployeeAcknowledgments({taskId}:{taskId:number}){
 const [items,setItems]=useState<SavedAcknowledgment[]|null>(null),[next,setNext]=useState<number|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const load=async(older=false)=>{setBusy(true);setError('');try{const data=await workforceApi.acknowledgments(taskId,older&&next?next:undefined);setItems(previous=>older?[...(previous||[]),...data.items]:data.items);setNext(data.nextBeforeId)}catch(e){setError(e instanceof Error?e.message:'Unable to load acknowledgments')}finally{setBusy(false)}}
 return <section aria-label="Your saved acknowledgments" className="mt-4 border-t border-slate-200 pt-3">
  <button type="button" disabled={busy} className="text-sm font-bold underline disabled:opacity-50" onClick={()=>void load()}>{items?'Refresh my acknowledgments':'View my acknowledgments'}</button>
  {error?<p role="alert" className="mt-2 text-sm text-red-700">{error}</p>:null}
  {items?.length===0?<p className="mt-3 text-sm">No saved acknowledgments yet.</p>:null}
  {items?.map(row=><article key={row.id} className="mt-3 rounded-xl bg-slate-50 p-3 text-sm"><p className="font-bold">{row.title} · Cycle {row.cycle}</p><p className="mt-1">Acknowledged by {row.signature}</p><p>{row.submittedAt?`Submitted ${new Date(row.submittedAt).toLocaleString()}`:`Record retained ${new Date(row.recordedAt).toLocaleString()}; submission time unavailable`}</p><div className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-white p-3" tabIndex={0} aria-label="Saved acknowledged terms">{savedTerms(row)}</div><button type="button" className="mt-3 font-bold underline" onClick={()=>{
   const url=URL.createObjectURL(new Blob([receipt(row)],{type:'text/plain;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download=`acknowledgment-${row.id}.txt`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
  }}>Download acknowledgment copy</button></article>)}
  {next?<button type="button" disabled={busy} className="mt-3 text-sm font-bold underline disabled:opacity-50" onClick={()=>void load(true)}>Load older acknowledgments</button>:null}
 </section>
}
