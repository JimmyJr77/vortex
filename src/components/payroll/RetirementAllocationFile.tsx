import RetirementRemittanceAuthorization from './RetirementRemittanceAuthorization'
import {useEffect,useRef,useState} from 'react'
import {adminApiRequest} from '../../utils/api'
type Summary={authorizationWindowOpen:boolean;planName:string;withheldDate:string;destination:{holderName:string;accountLast4:string};timing:{depositDate?:string;submissionAt?:string;status:string};fingerprint:string;rowCount:number;amountCents:number;formatRevision:number;columns:{field:string;header:string}[];amountFormat:string;dateFormat:string;includeHeader:boolean}
export default function RetirementAllocationFile({runId,planId,sourceFingerprint}:{runId:string;planId:string;sourceFingerprint:string}){
 const base=`/api/admin/payroll/runs/${runId}/retirement-allocation-file`,generation=useRef(0)
 const [summary,setSummary]=useState<Summary|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('')
 useEffect(()=>{const invalidate=()=>{generation.current++};invalidate();setSummary(null);setBusy(false);setError('');return invalidate},[runId,planId,sourceFingerprint])
 const request=async(download=false)=>{const current=++generation.current;setBusy(true);setError('');try{
  const r=await adminApiRequest(`${base}${download?'/download':''}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({planId,sourceFingerprint,...(download?{fingerprint:summary?.fingerprint}:{})})})
  if(!r.ok){const j=await r.json();throw new Error(j.message||'Unable to prepare recordkeeper allocation file.')}
  if(download){const blob=await r.blob();if(current!==generation.current)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`retirement-allocation-${runId}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}else{const j=await r.json();if(current===generation.current)setSummary(j.data)}
 }catch(e){if(current===generation.current){setSummary(null);setError(e instanceof Error?e.message:'Unable to prepare allocation file.')}}finally{if(current===generation.current)setBusy(false)}}
 return <section aria-label={`Recordkeeper allocation file ${runId} ${planId}`} className="space-y-2 border-t pt-3"><button type="button" disabled={busy} onClick={()=>void request()} className="rounded border px-3 py-2">Prepare allocation file for {planId}</button>{error?<p role="alert">{error}</p>:null}
 {summary?<div className="space-y-2 rounded border p-3"><p className="font-bold">Allocation file: {summary.rowCount} {summary.rowCount===1?'employee':'employees'} · {new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(summary.amountCents/100)}</p><p>Format revision {summary.formatRevision} · {summary.amountFormat} · {summary.dateFormat} · {summary.includeHeader?'Headers included':'No header row'}</p><p className="break-words">{summary.columns.map(c=>c.header).join(' → ')}</p><p>The download contains full recordkeeper participant identifiers. Preparing or downloading does not submit allocations, reserve contributions or move funds.</p><button type="button" disabled={busy} onClick={()=>void request(true)} className="rounded border px-3 py-2">Download recordkeeper allocation CSV</button></div>:null}
 <RetirementRemittanceAuthorization runId={runId} planId={planId} sourceFingerprint={sourceFingerprint} preview={summary}/>
 </section>
}
