import type {I9DifferentCertification} from '../../utils/workforceApi'
const human=(value:string)=>value.replaceAll('_',' ').toLowerCase()
export default function I9DifferentCertificationHistory({record,busy,onDownload}:{record:I9DifferentCertification;busy:boolean;onDownload:(id:string|number,filename:string)=>Promise<void>}){
 return <details className="min-w-0 space-y-3 rounded border p-3">
  <summary className="cursor-pointer font-semibold">Signed different-document replacement · {record.signedAt}</summary>
  {record.resolvedReceiptTasks?.length?<p>Resolved original receipt rows: {record.resolvedReceiptTasks.map(task=>`${task.rowKey} (task ${task.taskId}, due ${task.dueOn})`).join('; ')}.</p>:null}
  <p>Signed by {record.signature}. Examined {record.examination.examinedOn}. Receipt completion due {record.timing.dueOn}.</p>
  <p className="whitespace-pre-wrap break-words"><strong>Replacement reason:</strong> {record.answers.reason}</p>
  <blockquote className="whitespace-pre-wrap rounded bg-slate-50 p-3">{record.attestation}</blockquote>
  <p className="whitespace-pre-wrap break-words"><strong>Examiner identity and authority:</strong> {record.examination.identityEvidence}</p>
  <p>Recorded authorization: {record.authorization.authorizationIndefinite?'indefinite':`through ${record.authorization.authorizationThrough}`}.</p>
  <p className="whitespace-pre-wrap break-words">{record.authorization.authorizationEvidence}</p>
  {record.timing.late?<p>Signed after the receipt deadline.</p>:null}
  {record.examination.lateReason?<p className="whitespace-pre-wrap break-words"><strong>Late-completion explanation:</strong> {record.examination.lateReason}</p>:null}
  {record.examination.alternative?<><p className="whitespace-pre-wrap break-words"><strong>Alternative-procedure qualification:</strong> {record.examination.alternative.qualificationEvidence}</p><p className="whitespace-pre-wrap break-words"><strong>Live-video examination:</strong> {record.examination.alternative.videoEvidence}</p></>:null}
  <button type="button" className="underline" disabled={busy} onClick={()=>void onDownload(record.document.id,record.document.filename)}>Download signed different-document certification</button>
  {record.examination.documents.map(document=><div key={document.rowKey} className="min-w-0 space-y-2 rounded border p-2">
   <h5 className="font-semibold">Replacement document {document.rowKey}: {human(document.acceptance)}</h5>
   {document.formNotation?<p className="whitespace-pre-wrap break-words">Form notation: {document.formNotation}</p>:null}
   {document.ruleEvidence?<p className="whitespace-pre-wrap break-words">Acceptance evidence: {document.ruleEvidence}</p>:null}
   {document.ruleSource?<a href={document.ruleSource} target="_blank" rel="noreferrer" className="underline">Examiner’s official rule reference</a>:null}
   <p>Recorded follow-up: {human(document.followUpKind)}{document.followUpOn?` · ${document.followUpOn}`:''}</p>
   {record.copies.filter(copy=>copy.rowKey===document.rowKey).map((copy,index)=><button type="button" className="block underline" key={copy.copyId} disabled={busy} onClick={()=>void onDownload(copy.documentId,copy.filename)}>Download replacement document {copy.rowKey} copy {index+1} ({copy.pageCount} pages)</button>)}
  </div>)}
  <p>These are the findings retained when this certification was signed. Review associated compliance tasks for their current status.</p>
 </details>
}
