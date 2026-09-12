import {useState} from 'react'
import {workforceApi} from '../../utils/workforceApi'
import {workforceButton} from './OnboardingWorkspace'
const money=(v:number)=>(v/100).toLocaleString('en-US',{style:'currency',currency:'USD'})
export default function CorrectionAuthorizationHistory({requestId}:{requestId:number}){
 const [rows,setRows]=useState<Awaited<ReturnType<typeof workforceApi.correctionPaymentAuthorizations>>|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('')
 return <div className="space-y-2 border-t pt-3"><button type="button" className={workforceButton} disabled={busy} onClick={async()=>{setBusy(true);setError('');setRows(null);try{setRows(await workforceApi.correctionPaymentAuthorizations(requestId))}catch(e){setError(e instanceof Error?e.message:'Unable to load authorizations.')}finally{setBusy(false)}}}>Load payment authorizations</button>
 {error?<p role="alert" className="text-red-700">{error}</p>:null}
 {rows?.length===0?<p>No retained payment authorizations.</p>:null}
 {rows?.map(r=><div key={r.id} className="space-y-2 rounded border p-2"><p className="font-bold">Authorization #{r.id} · {r.status==='SETTLED'?'settled with payroll':r.status==='CURRENT'?'matches current payment evidence':r.status==='SUPERSEDED'?'superseded':'needs fresh payment evidence'}</p><p>{r.input.reason}</p><p>{new Date(r.authorizedAt).toLocaleString()}</p><p>Payroll: {r.preview.periodStart} through {r.preview.periodEnd}. Payment date: {r.preview.paymentDate}.</p><p>Additional gross: {money(r.preview.delta.grossPayCents)}. Additional take-home: {money(r.preview.delta.netPayCents)}.</p><p>Federal withholding change: {money(r.preview.delta.federalIncomeTaxCents)}. Maryland withholding change: {money(r.preview.delta.stateIncomeTaxCents)}. Combined leave credit change: {r.preview.targetLeave.combinedCreditDifferenceMinutes} minutes.</p>{r.issue?<p>{r.issue}</p>:null}<p>{r.paymentApplied&&r.settlement?`Settlement #${r.settlement.id} · payroll run #${r.settlement.runId}. Payment recorded for ${r.settlement.paymentDate}; corrected time and leave are applied. Original paid records remain retained.`:'Retained authorization only; payment and leave changes have not been applied.'}</p></div>)}
 </div>
}
