import {useEffect,useState} from 'react'
import {workforceApi,type I9EmployerRecord} from '../../utils/workforceApi'
const human=(value:string)=>value.replaceAll('_',' ').toLowerCase()
export default function I9EmployerRecords({employeeId}:{employeeId:number}){
 const [records,setRecords]=useState<I9EmployerRecord[]|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[reload,setReload]=useState(0)
 useEffect(()=>{let live=true;void workforceApi.i9EmployerRecords(employeeId).then(data=>{if(live)setRecords(data.records)}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[employeeId,reload])
 const download=async(id:string|number,filename:string)=>{setBusy(true);setError('');try{await workforceApi.download(Number(id),filename,true)}catch(e){setError(e instanceof Error?e.message:'Unable to download retained evidence.')}finally{setBusy(false)}}
 return <section aria-label="Retained employer I-9 evidence" className="my-4 min-w-0 space-y-3 rounded-xl border p-4">
  <h3 className="font-bold">Signed employer evidence and follow-ups</h3><p className="text-sm">Reopen the examiner’s retained findings and signed documents here. Follow-up status is tracked separately from the original certification.</p>
  {error?<p role="alert">{error}</p>:null}<button type="button" className="underline" disabled={busy} onClick={()=>{setError('');setReload(n=>n+1)}}>Refresh signed employer evidence</button>
  {records?.length===0?<p>No internal employer certification has been retained yet.</p>:null}
  {records?.map(record=><details key={record.signatureId} className="min-w-0 rounded border p-3"><summary className="cursor-pointer font-semibold">{record.current?'Current certification':'Historical certification'} · cycle {record.onboardingCycle} · {record.signedAt}</summary><div className="mt-3 min-w-0 space-y-3 text-sm">
   <p>Signed by {record.signature}. Examination: {record.examination.examinedOn}. Completion due: {record.timing.dueOn}.{record.timing.late?' Signed after the recorded deadline.':''}</p>
   {!record.current?<p>This retained certification does not establish current onboarding readiness. Review the current checklist and any later findings.</p>:null}
   <blockquote className="whitespace-pre-wrap rounded bg-slate-50 p-3">{record.attestation}</blockquote>
   <p className="whitespace-pre-wrap"><strong>Examiner identity and authority:</strong> {record.examination.identityEvidence}</p>
   <p>Business days: {record.examination.businessDays.map(day=>['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][day]).join(', ')}. Closures: {record.examination.closedDates.join(', ')||'None recorded'}.</p>
   {record.examination.lateReason?<p className="whitespace-pre-wrap"><strong>Late-completion explanation:</strong> {record.examination.lateReason}</p>:null}
   {record.examination.alternative?<><p className="whitespace-pre-wrap"><strong>Alternative-procedure qualification:</strong> {record.examination.alternative.qualificationEvidence}</p><p className="whitespace-pre-wrap"><strong>Live-video examination:</strong> {record.examination.alternative.videoEvidence}</p></>:null}
   <button type="button" disabled={busy} className="underline" onClick={()=>void download(record.document.id,record.document.filename)}>Download signed employer I-9</button>
   {record.examination.documents.map(document=><div key={document.rowKey} className="min-w-0 space-y-2 rounded border p-2"><h4 className="font-bold">Document {document.rowKey}: {human(document.acceptance)}</h4>{document.formNotation?<p className="whitespace-pre-wrap">Form notation: {document.formNotation}</p>:null}{document.ruleEvidence?<p className="whitespace-pre-wrap">Rule evidence: {document.ruleEvidence}</p>:null}{document.ruleSource?<a className="break-words underline" href={document.ruleSource} target="_blank" rel="noreferrer">Examiner’s official rule reference</a>:null}<p>Recorded follow-up: {human(document.followUpKind)}{document.followUpOn?` · ${document.followUpOn}`:''}</p>{record.copies.filter(copy=>copy.rowKey===document.rowKey).map((copy,index)=><button type="button" disabled={busy} key={copy.copyId} className="block underline" onClick={()=>void download(copy.documentId,copy.filename)}>Download document {copy.rowKey} copy {index+1} ({copy.pageCount} page(s))</button>)}</div>)}
   <h4 className="font-bold">Associated compliance tasks</h4>
   {!record.followups.length?<p>No follow-up task was created by this certification.</p>:record.followups.map(task=><div key={task.id} className="space-y-1 rounded border p-2"><p className="font-semibold">{task.task_key.startsWith('I9_EVERIFY_CASE:')?'E-Verify case review':'I-9 document follow-up'} · {human(task.status)} · due {task.due_on}</p><p>{task.description}</p>{task.completion_note?<p>Recorded completion note: {task.completion_note}</p>:null}<p>Continue this task in the Compliance tab; retain the required resulting evidence.</p></div>)}
  </div></details>)}
 </section>
}
