import {getApiUrl} from './api'
export const PREPARER_SESSION_KEY='vortex_i9_preparer_access_v1'
export type PreparerPreview={reviewId:string;previewSha256:string;pdfBase64:string;attestation:string;pageCount:number}
export type PreparerPacket={requestId:string;recipientName:string;employee:{firstName:string;lastName:string;middleInitial:string};current:boolean;attestation:string;signature:{id:string;documentId:string;signedAt:string}|null}
async function request<T>(token:string,path:string,body?:unknown):Promise<T>{
 const response=await fetch(`${getApiUrl()}/api/payroll/preparer/${path}`,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},cache:'no-store',...(body===undefined?{}:{body:JSON.stringify(body)})}),result=await response.json()
 if(!response.ok||result.success===false)throw new Error(result.message||'Unable to process preparer certification.')
 return result.data
}
export const i9PreparerApi={
 packet:(token:string)=>request<PreparerPacket>(token,'me'),
 preview:(token:string,preparer:unknown)=>request<PreparerPreview>(token,'preview',{preparer}),
 page:(token:string,body:unknown)=>request(token,'page',body),
 sign:(token:string,body:unknown)=>request<{id:string;signedAt:string}>(token,'sign',body),
 async download(token:string){const response=await fetch(`${getApiUrl()}/api/payroll/preparer/document`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});if(!response.ok)throw new Error('Unable to download your signed supplement.');const blob=await response.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Form-I9-Supplement-A-signed.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
}
