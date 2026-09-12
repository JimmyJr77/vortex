type JournalLine = {Amount:number;Description:string;JournalEntryLineDetail:{PostingType:string;AccountRef:{value:string}}}
export type SavedJournal = {id:number;payroll_run_id:number;realm_id:string;environment:string;status:string;external_id:string|null;error_message:string|null;attempts:number;request_id:string;payload:{TxnDate:string;DocNumber:string;PrivateNote:string;Line:JournalLine[]}}
const money=(cents:number)=>(cents/100).toLocaleString('en-US',{style:'currency',currency:'USD'})
export default function SavedQuickbooksJournal({job}:{job:SavedJournal}) {
 if(!job.payload?.Line)return null
 const total=(posting:string)=>job.payload.Line.filter(line=>line.JournalEntryLineDetail.PostingType===posting).reduce((sum,line)=>sum+Math.round(line.Amount*100),0)
 const debit=total('Debit'),credit=total('Credit')
 const download=()=>{
  const url=URL.createObjectURL(new Blob([JSON.stringify(job.payload,null,2)],{type:'application/json'}))
  const link=document.createElement('a');link.href=url;link.download=`vortex-quickbooks-job-${job.id}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
 }
 return <details className="mt-3 rounded-xl border border-slate-200 p-3">
  <summary className="cursor-pointer font-bold">View saved journal for run {job.payroll_run_id}</summary>
  <section aria-label={`Saved journal for run ${job.payroll_run_id}`} className="mt-3 space-y-3">
   <p>Company {job.realm_id} · {job.environment} · Payment date {job.payload.TxnDate}</p>
   <p>Document {job.payload.DocNumber} · Send attempts: {job.attempts}</p>
   <p className="break-all text-xs text-slate-600">Request identifier: {job.request_id}</p>
   <p className="text-slate-600">These are the saved amounts and account IDs used for this job. Retries retain them even when account mappings change.</p>
   <div className="space-y-2">{job.payload.Line.map((line,index)=><div key={index} className="rounded-lg bg-slate-50 p-3">
    <p className="break-words font-semibold">{line.Description}</p>
    <p className="mt-1 break-all">Account {line.JournalEntryLineDetail.AccountRef.value}</p>
    <p>{line.JournalEntryLineDetail.PostingType}: {money(Math.round(line.Amount*100))}</p>
   </div>)}</div>
   <p className="font-bold">Debits {money(debit)} · Credits {money(credit)}</p>
   {debit===credit?<p className="text-emerald-700">Journal balances.</p>:<p role="alert" className="text-red-700">Journal does not balance. Review before retrying.</p>}
   <button type="button" onClick={download} className="font-bold text-blue-700 underline">Download saved journal JSON</button>
  </section>
 </details>
}
