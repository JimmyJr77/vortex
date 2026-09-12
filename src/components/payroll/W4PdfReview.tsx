import {useEffect,useRef,useState} from 'react'
import type {PDFDocumentProxy} from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import officialFormUrl from '../../../backend/payroll/forms/irs-w4-2026.pdf?url'

export default function W4PdfReview({pdfBase64,onDisplayed}:{pdfBase64?:string;onDisplayed?:(page:number)=>Promise<void>}){
 const [pdf,setPdf]=useState<PDFDocumentProxy|null>(null),[page,setPage]=useState(1),[attempt,setAttempt]=useState(0),[ready,setReady]=useState(0),[error,setError]=useState(''),[text,setText]=useState(''),[zoom,setZoom]=useState(1)
 const canvas=useRef<HTMLCanvasElement>(null)
 useEffect(()=>{
  let live=true,dispose:(()=>void)|undefined
  void import('pdfjs-dist').then(async({getDocument,GlobalWorkerOptions})=>{
   if(!live)return
   GlobalWorkerOptions.workerSrc=workerUrl
   const task=getDocument(pdfBase64?{data:Uint8Array.from(atob(pdfBase64),c=>c.charCodeAt(0)),isEvalSupported:false}:{url:officialFormUrl,isEvalSupported:false})
   dispose=()=>{void task.destroy().catch(()=>{})}
   const document=await task.promise
   if(live)setPdf(document)
  }).catch(()=>{if(live)setError('The W-4 could not be displayed. Reload this step before signing.')})
  return()=>{live=false;dispose?.()}
 },[pdfBase64])
 useEffect(()=>{
  if(!pdf||!canvas.current)return
  let live=true,cancel:(()=>void)|undefined
  const target=canvas.current
  void (async()=>{
   const sheet=await pdf.getPage(page)
   if(!live)return
   const viewport=sheet.getViewport({scale:1.8}),context=target.getContext('2d')
   if(!context)throw new Error('Canvas unavailable')
   target.width=viewport.width;target.height=viewport.height
   const rendering=sheet.render({canvas:target,canvasContext:context,viewport})
   cancel=()=>rendering.cancel()
   await rendering.promise
   const content=await sheet.getTextContent()
   if(!live)return
   setText(content.items.map(item=>'str' in item?item.str:'').join(' '))
   await onDisplayed?.(page)
   if(live)setReady(page)
  })().catch(()=>{if(live)setError('This page could not be displayed or its review saved. Reopen the page to retry.')})
  return()=>{live=false;cancel?.()}
 },[pdf,page,onDisplayed,attempt])
 const select=(value:number)=>{setReady(0);setError('');setText('');setPage(value);setAttempt(current=>current+1)}
 return <section aria-label="Official W-4 page review" className="space-y-3 rounded-xl border border-slate-300 bg-slate-50 p-3">
  <p className="font-bold">{pdfBase64?'Review your completed W-4':'Official 2026 W-4, instructions and worksheets'}</p>
  <nav aria-label="W-4 pages" className="flex flex-wrap gap-2">{[1,2,3,4,5].map(n=><button type="button" key={n} aria-current={page===n?'page':undefined} className={`rounded-lg border px-3 py-2 text-sm ${page===n?'bg-slate-950 text-white':'bg-white'}`} onClick={()=>select(n)}>Page {n}</button>)}</nav>
  <p role="status" className="text-sm">{ready===page?`Page ${page} of 5 displayed${onDisplayed?' and review visit saved':''}.`:'Loading page…'}</p>
  {error?<p role="alert" className="text-sm text-red-800">{error}</p>:null}
  <label className="block text-sm">Page zoom<select value={zoom} onChange={e=>setZoom(Number(e.target.value))} className="ml-2 rounded border bg-white p-2"><option value={1}>Fit width</option><option value={1.5}>150%</option><option value={2}>200%</option><option value={3}>300%</option></select></label>
  <div tabIndex={0} role="region" aria-label="W-4 page image; scroll horizontally when zoomed" className="overflow-auto rounded border bg-white"><canvas ref={canvas} aria-label={`Official W-4 page ${page}`} style={{width:`${zoom*100}%`,maxWidth:'none',height:'auto'}} /></div>
  {text?<details><summary className="cursor-pointer text-sm font-semibold">Read page {page} text</summary><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{text}</p></details>:null}
 </section>
}
