import {useEffect,useState} from 'react'
import {adminApiRequest} from '../../utils/api'

type Assessment={status:string;originalEvidenceStatus:string;bankStatus:string;receiptStatus:string;deliveryStatus:string;accountingStatus:string;caseStatus:string;postedCents:number|null;bankCheckedAt:string|null;receiptCheckedAt:string|null;issues:string[]}
const label=(value:string)=>value.replaceAll('_',' ')

export default function RetirementReplacementAssessment({id}:{id:string}){
 const [requested,setRequested]=useState(false),[revision,setRevision]=useState(0),[data,setData]=useState<Assessment|null>(null),[error,setError]=useState('')
 useEffect(()=>{
  if(!requested)return
  let live=true,inFlight=false
  const load=async()=>{
   if(inFlight)return
   inFlight=true
   try{
    const response=await adminApiRequest(`/api/admin/payroll/retirement-replacement-authorizations/${id}/assessment`),result=await response.json()
    if(!response.ok||!result.success)throw new Error(result.message||'Unable to assess replacement contribution.')
    if(live){setData(result.data);setError('')}
   }catch(e){if(live){setData(null);setError(e instanceof Error?e.message:'Unable to assess replacement contribution.')}}finally{inFlight=false}
  }
  void load()
  const timer=setInterval(()=>void load(),30000)
  return()=>{live=false;clearInterval(timer)}
 },[id,requested,revision])
 return <section aria-label={`Replacement reconciliation ${id}`} className="space-y-2 rounded border p-2">
  <h6 className="font-bold">Replacement reconciliation</h6>
  <p>Review the original return, replacement bank withdrawal and participant credit together. The case closes when all delivery and accounting evidence matches, and reopens if that evidence changes.</p>
  <button type="button" className="rounded border px-3 py-2" onClick={()=>{setRequested(true);setData(null);setRevision(n=>n+1)}}>Review replacement reconciliation</button>
  {error?<p role="alert">{error} Automatic refresh will retry.</p>:null}
  {data?<>
   <p>Assessment: {label(data.status)} · Case: {label(data.caseStatus)}</p>
   <p>Original evidence: {label(data.originalEvidenceStatus)}</p>
   <p>Bank: {label(data.bankStatus)} · Participants: {label(data.receiptStatus)}</p>
   <p>Replacement delivery: {label(data.deliveryStatus)}</p>
   <p>Replacement accounting: {label(data.accountingStatus)}</p>
   {data.postedCents!==null?<p>Receipt-confirmed participant credit: {new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(data.postedCents/100)}</p>:null}
   {data.bankCheckedAt?<p>Bank checked: {new Date(data.bankCheckedAt).toLocaleString()}</p>:null}
   {data.receiptCheckedAt?<p>Receipt checked: {new Date(data.receiptCheckedAt).toLocaleString()}</p>:null}
   <ul className="list-disc space-y-1 pl-5">{data.issues.map(issue=><li key={issue}>{issue}</li>)}</ul>
  </>:null}
 </section>
}
