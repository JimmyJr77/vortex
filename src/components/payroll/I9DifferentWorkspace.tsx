import I9DifferentExamination from './I9DifferentExamination'
import I9DifferentCopies from './I9DifferentCopies'
import {useEffect,useState} from 'react'
import {workforceApi,type I9DifferentContext,type I9DifferentPreview,type I9EmployerDocument} from '../../utils/workforceApi'
import I9DifferentReviewPages from './I9DifferentReviewPages'
const blank=():I9EmployerDocument=>({title:'',issuingAuthority:'',number:'',expiresOn:''})
const input='mt-1 block w-full min-w-0 rounded border p-2'
export default function I9DifferentWorkspace({employeeId,taskId,signatureId,onUpdated}:{employeeId:number;taskId:string|number;signatureId:string|number;onUpdated:()=>void}){
 const [signing,setSigning]=useState(false)
 const [selected,setSelected]=useState<Record<string,string[]>>({})
 const [reload,setReload]=useState(0)
 const [open,setOpen]=useState(false),[context,setContext]=useState<I9DifferentContext|null>(null),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[preview,setPreview]=useState<I9DifferentPreview|null>(null)
 const [choice,setChoice]=useState(''),[method,setMethod]=useState(''),[listA,setListA]=useState<I9EmployerDocument[]>([blank()]),[listB,setListB]=useState(blank),[listC,setListC]=useState(blank)
 const [businessName,setBusinessName]=useState(''),[businessAddress,setBusinessAddress]=useState(''),[representative,setRepresentative]=useState(''),[reason,setReason]=useState(''),[initials,setInitials]=useState(''),[notes,setNotes]=useState('')
 useEffect(()=>{
  if(!open)return
  let live=true;setLoading(true);setError('');setContext(null);setPreview(null);setSelected({})
  void workforceApi.differentContext(employeeId,taskId).then(value=>{if(!live)return;if(String(value.signatureId)!==String(signatureId))throw new Error('Reload the current employer certification.');setContext(value);setBusinessName(value.employerDefaults.businessName);setBusinessAddress(value.employerDefaults.businessAddress)}).catch(e=>{if(live)setError(e instanceof Error?e.message:'Unable to load the receipt context.')}).finally(()=>{if(live)setLoading(false)})
  return()=>{live=false}
 },[open,employeeId,taskId,signatureId,reload])
 const change=(action:()=>void)=>{setPreview(null);setSelected({});setError('');action()}
 const prepare=async()=>{
  if(!context)return
  setBusy(true);setError('');setPreview(null);setSelected({})
  try{setPreview(await workforceApi.differentPreview(employeeId,taskId,{signatureId,reason,initials,section2:{edition:'01/20/25',documentChoice:choice,...(choice==='LIST_A'?{listA}:{listB,listC}),examinationMethod:method,firstDayEmployed:context.employerDefaults.firstDayEmployed,representativeNameAndTitle:representative,businessName,businessAddress,additionalInformation:notes}}))}
  catch(e){setError(e instanceof Error?e.message:'Unable to prepare the replacement packet.')}
  finally{setBusy(false)}
 }
 const docFields=(label:string,doc:I9EmployerDocument,set:(value:I9EmployerDocument)=>void)=><fieldset className="min-w-0 space-y-2 rounded border p-3"><legend className="font-semibold">{label}</legend>{([['title','Document title'],['issuingAuthority','Issuing authority'],['number','Document number'],['expiresOn','Expiration (if any)']] as const).map(([key,title])=><label className="block" key={key}>{label} — {title}<input className={input} type={key==='expiresOn'?'date':'text'} value={doc[key]} maxLength={key==='title'?150:key==='issuingAuthority'?200:100} onChange={e=>change(()=>set({...doc,[key]:e.target.value}))}/></label>)}</fieldset>
 if(!open)return <button type="button" className="rounded border p-2" onClick={()=>setOpen(true)}>Prepare different replacement documents</button>
 return <section aria-label="Different-document replacement workspace" className="min-w-0 space-y-3 rounded border p-3">
  <h4 className="font-bold">Different replacement documents</h4>
  <p>Record the acceptable documents the employee chose. The new certification stays with the original signed I-9.</p>
  <button type="button" className="underline" disabled={loading||busy||signing} onClick={()=>setReload(n=>n+1)}>Reload replacement context</button>
  {loading?<p role="status">Loading retained receipt context…</p>:null}{error?<p role="alert">{error}</p>:null}
  {context?.sourceKind==='SUPPLEMENT_B'?<p>This receipt was recorded during reverification and requires its Supplement B replacement process.</p>:context?<>
   <p>Receipt row {context.rowKey}; due {context.dueOn}. Original first day employed: {context.employerDefaults.firstDayEmployed}.</p>
   <fieldset disabled={busy||loading||signing} className="min-w-0 space-y-3">
    <label className="block">Replacement document combination<select aria-label="Replacement document combination" className={input} value={choice} onChange={e=>change(()=>setChoice(e.target.value))}><option value="">Choose documents presented</option><option value="LIST_A">List A</option><option value="LIST_B_C">List B and List C</option></select></label>
    {choice==='LIST_A'?<>{listA.map((doc,index)=><div key={index}>{docFields(`List A document ${index+1}`,doc,value=>setListA(rows=>rows.map((row,n)=>n===index?value:row)))}</div>)}<button type="button" className="underline" disabled={listA.length===3} onClick={()=>change(()=>setListA(rows=>[...rows,blank()]))}>Add List A document</button>{listA.length>1?<button type="button" className="ml-3 underline" onClick={()=>change(()=>setListA(rows=>rows.slice(0,-1)))}>Remove last List A document</button>:null}</>:choice==='LIST_B_C'?<div className="grid min-w-0 gap-3 md:grid-cols-2">{docFields('List B document',listB,setListB)}{docFields('List C document',listC,setListC)}</div>:null}
    <label className="block">Replacement examination method<select aria-label="Replacement examination method" className={input} value={method} onChange={e=>change(()=>setMethod(e.target.value))}><option value="">Choose examination method</option><option value="PHYSICAL">Physical examination</option><option value="ALTERNATIVE">Authorized alternative procedure</option></select></label>
    <label className="block">Replacement examiner name and title<input className={input} value={representative} maxLength={200} onChange={e=>change(()=>setRepresentative(e.target.value))}/></label>
    <label className="block">Employer business name<input className={input} value={businessName} maxLength={200} onChange={e=>change(()=>setBusinessName(e.target.value))}/></label>
    <label className="block">Employer business address<input className={input} value={businessAddress} maxLength={200} onChange={e=>change(()=>setBusinessAddress(e.target.value))}/></label>
    <label className="block">Reason for different replacement documents<input className={input} value={reason} maxLength={500} onChange={e=>change(()=>setReason(e.target.value))}/></label>
    <label className="block">Replacement examiner initials<input className={input} value={initials} maxLength={20} onChange={e=>change(()=>setInitials(e.target.value))}/></label>
    <label className="block">Additional replacement information<input className={input} value={notes} maxLength={1000} onChange={e=>change(()=>setNotes(e.target.value))}/></label>
    <button type="button" className="rounded border p-2" disabled={!choice||!method} onClick={()=>void prepare()}>Prepare replacement certification</button>
   </fieldset>
   {busy?<p role="status">Preparing replacement packet…</p>:null}
   {preview?<fieldset disabled={signing} className="min-w-0 space-y-3"><p>Review every page. Preparing this packet does not complete the receipt follow-up.</p>{preview.packet.map(part=><I9DifferentReviewPages key={`${preview.reviewId}:${part.documentKey}`} employeeId={employeeId} taskId={taskId} reviewId={preview.reviewId} previewSha256={preview.previewSha256} documentKey={part.documentKey} pdfBase64={part.pdfBase64} pageCount={part.pageCount} title={part.documentKey==='replacement'?'Review new replacement certification':part.documentKey==='source'?'Review original employer I-9':part.documentKey==='employee'?'Review original employee I-9':`Review retained amendment ${part.documentKey}`}/>) }{(choice==='LIST_A'?listA.map((_,index)=>`A${index+1}`):['B','C']).map(rowKey=><I9DifferentCopies key={`${preview.reviewId}:${rowKey}`} employeeId={employeeId} taskId={taskId} reviewId={preview.reviewId} previewSha256={preview.previewSha256} rowKey={rowKey} selected={selected[rowKey]||[]} onSelected={ids=>setSelected(value=>({...value,[rowKey]:ids}))}/>) }<I9DifferentExamination key={preview.reviewId} employeeId={employeeId} taskId={taskId} preview={preview} initials={initials} method={method} selected={selected} rowKeys={choice==='LIST_A'?listA.map((_,index)=>`A${index+1}`):['B','C']} onBusy={setSigning} onSigned={onUpdated}/></fieldset>:null}
  </>:null}
 </section>
}
