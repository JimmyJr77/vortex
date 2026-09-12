import {randomUUID} from 'node:crypto'
import {regularRetirementFixture} from './regularRetirementFixture.js'
import {id} from './retirementDestinationProvider.js'
export async function retirementRemittanceFixture(h){
 const f=await regularRetirementFixture(h),{api,employee,periods}=f
 await api('/payment-connection',{organizationId:id(1),originatingAccountId:id(2),apiKey:'synthetic-remittance-key',mode:'TEST',reference:'Reviewed synthetic funding account',expectedRevision:0,confirmed:true},'POST',201)
 const path='/retirement-plans/standard/destination',s=await api(path),input={accountId:id(3),planRevisionId:s.planRevisionId,connectionRevision:s.connectionRevision},p=await api(path+'/preview',input)
 await api(path,{...input,...p,requestKey:randomUUID(),confirmed:true,reference:'Independently reviewed trustee instructions for actual plan'})
 const mpath=`/employees/${employee.id}/retirement-participant/standard`,m=await api(mpath)
 await api(mpath,{sourceFingerprint:m.source.fingerprint,expectedRevision:0,requestKey:randomUUID(),disposition:'VERIFIED',providerPlanId:'PRIVATE-PLAN-10001',participantId:'PRIVATE-PARTICIPANT-54321',reference:'Independently verified recordkeeper roster and employee identity',confirmed:true})
 const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201);await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH');await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-REMITTANCE-PREVIEW'})
 return {...f,run,mappingPath:mpath}
}
