import {useState} from 'react'
import {adminApiRequest} from '../../utils/api'
export default function OvertimeQualificationForm({runId,employeeId,sourceFingerprint,reviewId,paidPremiumCents,onSaved}:{runId:number;employeeId:number;sourceFingerprint:string;reviewId:number;paidPremiumCents:number;onSaved:()=>Promise<void>}){
 const [status,setStatus]=useState(''),[amount,setAmount]=useState(''),[reference,setReference]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[stale,setStale]=useState(false),[error,setError]=useState('')
 const parts=amount.split('.'),cents=/^\d+(\.\d{1,2})?$/.test(amount)?Number(parts[0])*100+Number((parts[1]||'').padEnd(2,'0')):NaN
 const valid=!stale&&confirmed&&status&&Number.isSafeInteger(cents)&&cents>=0&&cents<=paidPremiumCents&&(status!=='NOT_FLSA_REQUIRED'||cents===0)&&reference.trim().length>=12
 const save=async()=>{if(!valid)return;setBusy(true);setError('');try{
 const response=await adminApiRequest(`/api/admin/payroll/runs/${runId}/employees/${employeeId}/overtime-qualification`,{method:'POST',body:JSON.stringify({sourceFingerprint,expectedReviewId:reviewId,qualifiedPremiumCents:cents,flsaStatus:status,reference,confirmed})}),json=await response.json()
 if(!response.ok){if(response.status===409){setStale(true);setConfirmed(false)}throw new Error(json.message||'Unable to save qualification review.')}
 await onSaved()
 }catch(e){setError(e instanceof Error?e.message:'Unable to save qualification review.')}finally{setBusy(false)}}
 const input='mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2 font-normal'
 return <details className="border-t border-slate-200 pt-3"><summary className="cursor-pointer font-bold">Record FLSA qualification review</summary><p className="my-2">Use the reviewed FLSA coverage and premium calculation for this payment. The qualified amount may be less than the paid premium. Recording a review preserves the paid statement.</p>
 {error?<p role="alert" className="text-red-700">{error}</p>:null}
 <fieldset disabled={busy||stale} className="space-y-3"><label className="block font-semibold">FLSA treatment<select value={status} onChange={e=>{setStatus(e.target.value);setConfirmed(false)}} className={input}><option value="">Choose reviewed treatment</option><option value="FLSA_REQUIRED">Includes FLSA-required compensation</option><option value="NOT_FLSA_REQUIRED">No FLSA-required compensation</option></select></label>
 <label className="block font-semibold">Qualified overtime premium ($)<input inputMode="decimal" value={amount} onChange={e=>{setAmount(e.target.value);setConfirmed(false)}} className={input}/></label>
 <label className="block font-semibold">FLSA review reference<textarea maxLength={2000} value={reference} onChange={e=>{setReference(e.target.value);setConfirmed(false)}} className={input}/></label>
 <label className="flex items-start gap-2"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I verified the FLSA treatment and qualified premium against the referenced source.</label>
 <button type="button" disabled={!valid} onClick={()=>void save()} className="rounded-lg bg-slate-900 px-3 py-2 font-bold text-white disabled:opacity-50">{busy?'Saving review…':'Save qualification review'}</button></fieldset>
 {stale?<p className="mt-2 text-amber-900">Refresh overtime sources before reviewing again.</p>:null}</details>
}
