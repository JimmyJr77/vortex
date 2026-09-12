import {useState} from 'react'
import {adminApiRequest,getApiUrl} from '../../utils/api'
import {getPayrollEmployeeSession} from '../../utils/employeePayrollApi'
export default function ReceiptDownload({id,runId,check=false}:{id:string;runId?:number;check?:boolean}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('')
 const download=async()=>{setBusy(true);setError('');try{
  const suffix=`${check?'check-receipts':'payment-replacement-receipts'}/${encodeURIComponent(id)}/download`
  const response=runId===undefined?await fetch(`${getApiUrl()}/api/payroll/employee/${suffix}`,{headers:{Authorization:`Bearer ${getPayrollEmployeeSession()}`}}):await adminApiRequest(`/api/admin/payroll/runs/${runId}/${suffix}`)
  if(!response.ok){const json=await response.json().catch(()=>({}));throw new Error(json.message||'Unable to download receipt.')}
  const url=URL.createObjectURL(await response.blob()),link=document.createElement('a');link.href=url;link.download=`payroll-${check?'check':'replacement'}-receipt-${id}.html`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
 }catch(e){setError(e instanceof Error?e.message:'Unable to download receipt.')}finally{setBusy(false)}}
 return <div><button type="button" className="font-bold underline" disabled={busy} onClick={()=>void download()}>{busy?'Preparing receipt…':check?'Download check receipt':'Download replacement receipt'}</button>{error?<p role="alert">{error}</p>:null}</div>
}
