import {useCallback,useEffect,useRef,useState} from 'react'
import {workforceApi,type I9CopyList,type I9CopyView,type I9EmployerPreview} from '../../utils/workforceApi'
import W4PdfReview from './W4PdfReview'
function CopyViewer({employeeId,taskId,cycle,reviewId,previewSha256,copy}:{employeeId:number;taskId:number;cycle:number;reviewId:string|number;previewSha256:string;copy:I9CopyView}){
 const [status,setStatus]=useState(''),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[zoom,setZoom]=useState(1)
 const {copyId}=copy
 const displayed=useCallback(async(page:number)=>{await workforceApi.recordI9CopyPage(employeeId,taskId,{onboardingCycle:cycle,reviewId,previewSha256,copyId,page,displayed:true})},[employeeId,taskId,cycle,reviewId,previewSha256,copyId])
 if(copy.mime==='application/pdf')return <W4PdfReview pdfBase64={copy.contentBase64} pageCount={copy.pageCount} formName="I-9 document copy" reviewTitle="Review the retained document copy" onDisplayed={displayed}/>
 return <div className="space-y-2 rounded border p-3"><p className="font-semibold">Review the retained document image</p><label className="block text-sm">Image zoom<select className="ml-2 rounded border p-2" value={zoom} onChange={e=>setZoom(Number(e.target.value))}><option value={1}>Fit width</option><option value={2}>200%</option><option value={3}>300%</option></select></label><div tabIndex={0} role="region" aria-label="Document image; scroll horizontally when zoomed" className="overflow-auto"><img key={attempt} alt="Retained I-9 identity or employment authorization document copy" style={{width:`${zoom*100}%`,maxWidth:'none',height:'auto'}} src={`data:${copy.mime};base64,${copy.contentBase64}`} onLoad={()=>{void displayed(1).then(()=>setStatus('Image displayed and review visit saved.')).catch(e=>setError(e.message))}} onError={()=>setError('The retained image could not be displayed. Upload a readable copy.')}/></div>{status?<p role="status">{status}</p>:null}{error?<p role="alert">{error}</p>:null}<button type="button" className="underline" onClick={()=>{setError('');setStatus('');setAttempt(n=>n+1)}}>Reload document image</button></div>
}
export default function I9EmployerCopies({employeeId,taskId,cycle,preview}:{employeeId:number;taskId:number;cycle:number;preview:I9EmployerPreview}){
 const {reviewId,previewSha256}=preview
 const [list,setList]=useState<I9CopyList|null>(null),[files,setFiles]=useState<Record<string,File|undefined>>({}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[view,setView]=useState<I9CopyView|null>(null),[reload,setReload]=useState(0)
 const retries=useRef<Record<string,{file:File;key:string}>>({})
 useEffect(()=>{let live=true;void workforceApi.i9EmployerCopies(employeeId,taskId,{onboardingCycle:cycle,reviewId,previewSha256}).then(value=>{if(live)setList(value)}).catch(e=>{if(live)setError(e.message)});return()=>{live=false}},[employeeId,taskId,cycle,reviewId,previewSha256,reload])
 const upload=async(rowKey:string)=>{
  const file=files[rowKey];if(!file)return
  setBusy(true);setError('');setNotice('')
  if(retries.current[rowKey]?.file!==file)retries.current[rowKey]={file,key:crypto.randomUUID()}
  try{await workforceApi.uploadI9EmployerCopy(employeeId,taskId,{onboardingCycle:cycle,reviewId,previewSha256,rowKey,requestKey:retries.current[rowKey].key},file);setNotice('Document copy retained securely. Review each page before certifying the examination.');setReload(n=>n+1)}catch(e){setError(e instanceof Error?e.message:'Unable to retain document copy. Retry unchanged to confirm the upload.')}
  finally{setBusy(false)}
 }
 const open=async(copyId:string|number)=>{setBusy(true);setView(null);setError('');try{setView(await workforceApi.viewI9EmployerCopy(employeeId,taskId,{onboardingCycle:cycle,reviewId,previewSha256,copyId}))}catch(e){setError(e instanceof Error?e.message:'Unable to open copy.')}finally{setBusy(false)}}
 return <section aria-label="I-9 document copies" className="space-y-3 rounded-xl border border-slate-300 p-3">
  <h3 className="font-bold">Retain and review document copies</h3>
  <p className="text-sm">Attach clear copies for each employee-chosen document entry. Include the front, back and other required pages in one PDF or multiple files. Copies remain private. The employer must separately record the actual examination and sign the certification.</p>
  {error?<p role="alert">{error}</p>:null}{notice?<p role="status">{notice}</p>:null}
  <button type="button" disabled={busy} className="underline" onClick={()=>{setError('');setReload(n=>n+1)}}>Refresh retained copies</button>
  {list?.documents.map(row=><fieldset key={row.key} disabled={busy} className="min-w-0 space-y-2 rounded border p-3"><legend className="px-1 font-semibold">{row.label}</legend>
   <label className="block text-sm">{row.label}: copy file (PDF, PNG or JPEG, up to 5 MB)<input type="file" className="block w-full min-w-0 max-w-full text-sm" accept="application/pdf,image/png,image/jpeg" onChange={e=>{setFiles(current=>({...current,[row.key]:e.target.files?.[0]}));delete retries.current[row.key];setNotice('')}}/></label>
   <button type="button" disabled={!files[row.key]} className="rounded border px-3 py-2 font-semibold disabled:opacity-40" onClick={()=>void upload(row.key)}>Retain {row.label.toLowerCase()} copy</button>
   <ul className="space-y-2">{row.copies.map((copy,index)=><li key={copy.id} className="text-sm"><button type="button" className="underline" onClick={()=>void open(copy.id)}>View {row.label.toLowerCase()} copy {index+1}</button> · {copy.pageCount} {copy.mime==='application/pdf'?'PDF page(s)':'image'} · {copy.createdAt}</li>)}</ul>
  </fieldset>)}
  {view?<div className="space-y-2"><button type="button" className="underline" onClick={()=>setView(null)}>Close document copy</button><CopyViewer key={view.copyId} employeeId={employeeId} taskId={taskId} cycle={cycle} reviewId={reviewId} previewSha256={previewSha256} copy={view}/></div>:null}
 </section>
}
