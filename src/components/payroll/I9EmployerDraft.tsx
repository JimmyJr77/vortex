import {useCallback,useEffect,useRef,useState} from 'react'
import {workforceApi,type I9EmployerDocument,type I9EmployerDraft as Draft,type I9EmployerDraftState,type I9EmployerPreview} from '../../utils/workforceApi'
import W4PdfReview from './W4PdfReview'
import I9EmployerCopies from './I9EmployerCopies'
import instructionsUrl from '../../../backend/payroll/forms/uscis-i9-instructions-012025.pdf?url'
const emptyRow=():I9EmployerDocument=>({title:'',issuingAuthority:'',number:'',expiresOn:''})
const empty=():Draft=>({documentChoice:null,listA:[],listB:null,listC:null,additionalInformation:'',examinationMethod:null,firstDayEmployed:'',representativeNameAndTitle:'',businessName:'',businessAddress:''})
const input='mt-1 block w-full min-w-0 rounded border border-slate-300 p-2'
function DocumentRow({label,value,onChange}:{label:string;value:I9EmployerDocument;onChange:(value:I9EmployerDocument)=>void}){
 return <fieldset className="min-w-0 space-y-2 rounded border p-3"><legend className="px-1 font-semibold">{label}</legend>
  {([['title','Document title'],['issuingAuthority','Issuing authority'],['number','Document number (if any)'],['expiresOn','Expiration date (if any)']] as const).map(([key,title])=><label key={key} className="block text-sm">{label}: {title}<input className={input} value={value[key]} maxLength={key==='expiresOn'?10:200} placeholder={key==='expiresOn'?'YYYY-MM-DD':undefined} onChange={e=>onChange({...value,[key]:e.target.value})}/></label>)}
 </fieldset>
}
function ReviewDocument({employeeId,taskId,cycle,preview,documentKey,pdfBase64,pageCount,label}:{employeeId:number;taskId:number;cycle:number;preview:I9EmployerPreview;documentKey:string;pdfBase64:string;pageCount:number;label:string}){
 const {reviewId,previewSha256}=preview
 const displayed=useCallback(async(page:number)=>{await workforceApi.recordI9EmployerPage(employeeId,taskId,{onboardingCycle:cycle,reviewId,previewSha256,documentKey,page,displayed:true})},[employeeId,taskId,cycle,reviewId,previewSha256,documentKey])
 return <W4PdfReview pdfBase64={pdfBase64} pageCount={pageCount} formName={label} editionLabel="01/20/25" reviewTitle={documentKey==='main'?'Review Section 2 before employer certification':'Review the retained preparer certification'} onDisplayed={displayed}/>
}
export default function I9EmployerDraft({employeeId,taskId,cycle,editable}:{employeeId:number;taskId:number;cycle:number;editable:boolean}){
 const [state,setState]=useState<I9EmployerDraftState|null>(null),[draft,setDraft]=useState<Draft>(empty),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[reload,setReload]=useState(0)
 const pending=useRef<{payload:string;requestKey:string}|null>(null)
 const [preview,setPreview]=useState<I9EmployerPreview|null>(null),[instructions,setInstructions]=useState(false)
 const dirty=JSON.stringify(draft)!==JSON.stringify(state?.draft||empty())
 useEffect(()=>{let live=true;void workforceApi.i9EmployerDraft(employeeId,taskId,cycle).then(data=>{if(live){setState(data);setDraft(data.draft||empty());pending.current=null}}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[employeeId,taskId,cycle,reload])
 const change=(next:Draft)=>{setDraft(next);setNotice('');setPreview(null);pending.current=null}
 const save=async()=>{
  if(!state)return
  setBusy(true);setError('');setNotice('');setPreview(null)
  const body={onboardingCycle:cycle,expectedRevision:state.revision,basisHash:state.basisHash,draft},payload=JSON.stringify(body)
  if(pending.current?.payload!==payload)pending.current={payload,requestKey:crypto.randomUUID()}
  try{const saved=await workforceApi.saveI9EmployerDraft(employeeId,taskId,{...body,requestKey:pending.current.requestKey});setState({...state,...saved,draft,invalidated:false});pending.current=null;setNotice('Employer I-9 draft saved securely. This does not complete examination or sign Section 2.')}
  catch(e){setError(e instanceof Error?e.message:'Unable to save employer draft. Retry unchanged entries or reload the current draft.')}
  finally{setBusy(false)}
 }
 const prepare=async()=>{if(!state||dirty)return;setBusy(true);setError('');setNotice('');setPreview(null);try{setPreview(await workforceApi.previewI9Employer(employeeId,taskId,{onboardingCycle:cycle,expectedRevision:state.revision,basisHash:state.basisHash}))}catch(e){setError(e instanceof Error?e.message:'Unable to prepare the current employer form.')}finally{setBusy(false)}}
 return <section aria-label="Employer I-9 draft" className="my-4 min-w-0 space-y-3 rounded-xl border border-slate-300 p-4">
  <h3 className="font-bold">Employer Section 2 document draft</h3>
  <p className="text-sm">Record the documents the employee chooses to present: List A, or List B together with List C. The entries are private and can be saved unfinished. Examination evidence and the employer’s own certification remain separate required steps.</p>
  {error?<p role="alert">{error}</p>:null}{notice?<p role="status">{notice}</p>:null}
  {state?.invalidated?<p role="status">The employee signature or review context changed. Previous draft entries are no longer current; start a fresh draft for this version.</p>:null}
  {state&&!state.submissionId?<p>The employee must sign Section 1 before employer document entries can be saved.</p>:null}
  <button type="button" disabled={busy} className="underline" onClick={()=>{setState(null);setDraft(empty());setPreview(null);setError('');setNotice('');setReload(n=>n+1)}}>Reload employer draft (replaces unsaved entries)</button>
  <button type="button" className="block underline" onClick={()=>setInstructions(v=>!v)}>{instructions?'Close official I-9 instructions':'Read official I-9 instructions here'}</button>
  {instructions?<W4PdfReview sourceUrl={instructionsUrl} pageCount={8} formName="I-9 instructions" editionLabel="01/20/25"/>:null}
  <form onSubmit={e=>{e.preventDefault();void save()}}><fieldset disabled={busy||!state?.submissionId||!editable} className="min-w-0 space-y-3">
   <label className="block">Employee-chosen document combination<select className={input} value={draft.documentChoice||''} onChange={e=>change({...draft,documentChoice:(e.target.value||null) as Draft['documentChoice']})}><option value="">Not answered</option><option value="LIST_A">List A</option><option value="LIST_B_C">List B and List C</option></select></label>
   {draft.documentChoice==='LIST_A'?<div className="space-y-3">{(draft.listA.length?draft.listA:[emptyRow()]).map((row,index)=><DocumentRow key={index} label={`List A document ${index+1}`} value={row} onChange={value=>{const rows=draft.listA.length?[...draft.listA]:[emptyRow()];rows[index]=value;change({...draft,listA:rows})}}/>)}<button type="button" disabled={draft.listA.length>=3} className="underline" onClick={()=>change({...draft,listA:[...(draft.listA.length?draft.listA:[emptyRow()]),emptyRow()]})}>Add another List A document</button>{draft.listA.length>1?<button type="button" className="ml-3 underline" onClick={()=>change({...draft,listA:draft.listA.slice(0,-1)})}>Remove last List A document</button>:null}</div>:null}
   {draft.documentChoice==='LIST_B_C'?<div className="grid min-w-0 gap-3 sm:grid-cols-2"><DocumentRow label="List B" value={draft.listB||emptyRow()} onChange={listB=>change({...draft,listB})}/><DocumentRow label="List C" value={draft.listC||emptyRow()} onChange={listC=>change({...draft,listC})}/></div>:null}
   <label className="block">Examination method<select className={input} value={draft.examinationMethod||''} onChange={e=>change({...draft,examinationMethod:(e.target.value||null) as Draft['examinationMethod']})}><option value="">Not answered</option><option value="PHYSICAL">Physical examination</option><option value="ALTERNATIVE">DHS-authorized alternative procedure</option></select></label>
   {draft.examinationMethod==='ALTERNATIVE'?<p className="text-sm">This selection records draft intent only. Employer eligibility, required document copies and the actual examination must be verified before certification.</p>:null}
   {([['firstDayEmployed','First day of employment (YYYY-MM-DD)'],['representativeNameAndTitle','Representative last name, first name and title'],['businessName','Employer business or organization name'],['businessAddress','Employer business address, city, state and ZIP']] as const).map(([key,label])=><label className="block" key={key}>{label}<input className={input} maxLength={key==='firstDayEmployed'?10:200} value={draft[key]} onChange={e=>change({...draft,[key]:e.target.value})}/></label>)}
   <label className="block">Additional information<input className={input} maxLength={1000} value={draft.additionalInformation} onChange={e=>change({...draft,additionalInformation:e.target.value})}/></label>
   <button className="rounded bg-slate-950 px-3 py-2 font-bold text-white disabled:opacity-40">{busy?'Saving employer draft…':'Save employer I-9 draft'}</button>
  </fieldset></form>
  {state?.savedAt?<p className="text-sm">Saved {state.savedAt} · revision {state.revision}</p>:null}
  <button type="button" disabled={busy||dirty||!state?.draft||!editable} className="rounded border border-slate-400 px-3 py-2 font-bold disabled:opacity-40" onClick={()=>void prepare()}>Prepare employer I-9 preview</button>
  {dirty?<p className="text-sm">Save your changes before preparing the official form.</p>:null}
  {preview?<div className="space-y-4"><p className="text-sm">The employee signature is retained. Section 2 is unsigned. Review all four pages and each preparer certificate; examination evidence and your employer certification remain required.</p><ReviewDocument key={`${preview.reviewId}-main`} employeeId={employeeId} taskId={taskId} cycle={cycle} preview={preview} documentKey="main" pdfBase64={preview.pdfBase64} pageCount={4} label="I-9 employer preview"/>{preview.supplements.map((s,index)=><ReviewDocument key={`${preview.reviewId}-${s.documentKey}`} employeeId={employeeId} taskId={taskId} cycle={cycle} preview={preview} documentKey={s.documentKey} pdfBase64={s.pdfBase64} pageCount={1} label={`I-9 preparer certificate ${index+1}`}/>)}<I9EmployerCopies key={preview.reviewId} employeeId={employeeId} taskId={taskId} cycle={cycle} preview={preview}/></div>:null}
 </section>
}
