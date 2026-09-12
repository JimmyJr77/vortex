import {useState} from 'react'
import {adminApiRequest} from '../../utils/api'
type Advice={subject:string;text:string;fingerprint:string}
export default function CarrierRemittanceAdvice({paymentId,status}:{paymentId:string;status:string}){
 const [advice,setAdvice]=useState<Advice|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const base=`/api/admin/payroll/carrier-payment-authorizations/${paymentId}/remittance-advice`
 const preview=async()=>{setBusy(true);setError('');setAdvice(null);try{const response=await adminApiRequest(base),body=await response.json();if(!response.ok||!body.success)throw new Error(body.message||'Unable to prepare remittance advice.');setAdvice(body.data)}catch(e){setError(e instanceof Error?e.message:'Unable to prepare remittance advice.')}finally{setBusy(false)}}
 const download=async()=>{if(!advice)return;setBusy(true);setError('');try{const response=await adminApiRequest(`${base}/download?fingerprint=${encodeURIComponent(advice.fingerprint)}`);if(!response.ok)throw new Error((await response.json()).message||'Unable to download remittance advice.');const url=URL.createObjectURL(await response.blob()),a=document.createElement('a');a.href=url;a.download=`carrier-remittance-${paymentId}.html`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch(e){setAdvice(null);setError(e instanceof Error?e.message:'Unable to download remittance advice.')}finally{setBusy(false)}}
 return <details className="rounded-lg border p-3"><summary className="cursor-pointer font-bold">Carrier remittance advice</summary><section aria-label="Carrier remittance advice preview" className="mt-3 space-y-3">
  <p>Review a carrier-facing notice for this payment. Preparing or downloading advice does not send it or record delivery.</p>
  {status!=='BANK_CONFIRMED'?<p role="status">Resolve changed bank evidence before preparing remittance advice.</p>:<button type="button" disabled={busy} onClick={()=>void preview()} className="rounded-lg border px-3 py-2 font-bold">{advice?'Refresh remittance advice':'Preview remittance advice'}</button>}
  {error?<p role="alert">{error}</p>:null}
  {advice&&status==='BANK_CONFIRMED'?<><h6 className="break-words font-bold">{advice.subject}</h6><p className="whitespace-pre-wrap break-words">{advice.text}</p><button type="button" disabled={busy} onClick={()=>void download()} className="rounded-lg border px-3 py-2 font-bold">Download remittance advice</button></>:null}
 </section></details>
}
