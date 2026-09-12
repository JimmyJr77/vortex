import {randomUUID} from 'node:crypto'
import {retirementAllocationFixture,allocationFormatFixture} from './retirementAllocationFixture.js'
export async function retirementRemittanceAuthorizationFixture(h){
 const f=await retirementAllocationFixture(h)
 await f.api(f.formatPath,{format:allocationFormatFixture(),planRevisionId:f.planRevisionId,expectedRevision:0,requestKey:randomUUID()})
 const source=(await f.api('/retirement-remittance-sources')).items[0],file=await f.api(`/runs/${f.run.id}/retirement-allocation-file`,{planId:'standard',sourceFingerprint:source.sourceFingerprint})
 const body={planId:'standard',sourceFingerprint:source.sourceFingerprint,fileFingerprint:file.fingerprint,amountCents:file.amountCents,reference:'Reviewed all outside contributions and downloaded allocation activity before exact authorization',confirmed:true,outsideActivityReviewed:true,requestKey:randomUUID()}
 return {...f,file,body,path:`/runs/${f.run.id}/retirement-remittance-authorizations`}
}
