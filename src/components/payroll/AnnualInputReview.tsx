import AnnualReviewSnapshot from './AnnualReviewSnapshot'
import {useState} from 'react'
import {adminApiRequest} from '../../utils/api'
export type AnnualReviewHistory={id:string;reference:string;created_by:string;created_at:string;status:string}
export default function AnnualInputReview({employeeId,sourceFingerprint,ready,history,onSaved}:{employeeId:number;sourceFingerprint:string;ready:boolean;history:AnnualReviewHistory[];onSaved:()=>Promise<void>}){
 const [reference,setReference]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[stale,setStale]=useState(false),[error,setError]=useState('')
 const valid=ready&&!stale&&!busy&&confirmed&&reference.trim().length>=12&&reference.trim().length<=2000&&!Array.from(reference).some(char=>char.charCodeAt(0)<32||char.charCodeAt(0)===127)
 const save=async()=>{if(!valid)return;setBusy(true);setError('');try{
 const response=await adminApiRequest(`/api/admin/payroll/employees/${employeeId}/annual-input-review`,{method:'POST',body:JSON.stringify({year:2026,sourceFingerprint,expectedReviewId:Number(history[0]?.id||0),reference,confirmed})}),json=await response.json()
 if(!response.ok){if(response.status===409){setStale(true);setConfirmed(false)}throw new Error(json.message||'Unable to record annual input review.')}
 await onSaved()
 }catch(e){setError(e instanceof Error?e.message:'Unable to record annual input review.')}finally{setBusy(false)}}
 return <section aria-label="Annual input review" className="space-y-3 border-t border-slate-200 pt-3"><h5 className="font-bold">Annual input review</h5><p>Record your review of the retained inputs above. Tax-form classification, approval and issuance are separate steps.</p>
 {error?<p role="alert" className="text-red-700">{error}</p>:null}
 {ready?<fieldset disabled={busy||stale} className="space-y-3"><label className="block font-semibold">Annual input verification reference<input autoComplete="off" maxLength={2000} value={reference} onChange={e=>{setReference(e.target.value);setConfirmed(false)}} className="mt-1 block w-full rounded-lg border border-slate-300 p-2 font-normal"/></label><label className="flex items-start gap-2"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I reviewed the displayed annual inputs against the referenced evidence.</label><button type="button" disabled={!valid} onClick={()=>void save()} className="rounded-lg bg-slate-900 px-3 py-2 font-bold text-white disabled:opacity-50">{busy?'Saving annual review…':'Save annual input review'}</button></fieldset>:<p className="text-amber-900">Resolve source reconciliation issues before recording an annual input review.</p>}
 {stale?<p className="text-amber-900">Prepare 2026 payroll inputs again before reviewing.</p>:null}
 <h6 className="font-bold">Annual review history</h6>{history.length?history.map(item=><div key={item.id} className="rounded-lg bg-slate-50 p-3"><p>{item.status} · Review {item.id}</p><p className="break-words">{item.reference}</p><p className="text-xs text-slate-500">Reviewer {item.created_by} · {new Date(item.created_at).toLocaleString()}</p><AnnualReviewSnapshot employeeId={employeeId} reviewId={item.id}/></div>):<p>No annual input review recorded.</p>}</section>
}
