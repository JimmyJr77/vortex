import {correctionPaymentFixture} from './correctionPaymentFixture.js'
export async function settledCorrectedHourlyFixture(h,options={sharedWeek:true,bridgeTarget:true}){
 const {api,e,request,input,target}=await correctionPaymentFixture(h,options)
 const correction=await api(`/requests/${request.id}/payroll-correction-payment-preview`,input)
 await api(`/requests/${request.id}/payroll-correction-authorizations`,{...input,fingerprint:correction.fingerprint,requestKey:'salary-following-correction',reason:'Authorize corrected hourly wages before later salary settlement',confirmed:true},'POST',201)
 const correctionRun=await api('/runs',{payPeriodId:target.id},'POST',201)
 await api(`/runs/${correctionRun.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${correctionRun.id}/status`,{status:'APPROVED'},'PATCH')
 await api(`/runs/${correctionRun.id}/finalize`,{paymentDate:input.paymentDate,paymentConfirmationReference:'SYNTHETIC-BRIDGE-CORRECTION'})
 const original=(await h.pool.query('SELECT * FROM payroll_run_employee ORDER BY id')).rows
 return {api,e,original}
}
