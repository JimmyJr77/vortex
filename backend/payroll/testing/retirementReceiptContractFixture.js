import {randomUUID} from 'node:crypto'
import assert from 'node:assert/strict'
import {retirementPlanFixture} from './retirementPlanFixture.js'
import {allocationFormatFixture} from './retirementAllocationFixture.js'
import {retirementReceiptFields} from '../retirementAllocationReceipt.js'
export const receiptContractFixture=()=>({confirmed:true,sourceHashConfirmed:true,cumulativeAmountsConfirmed:true,participantPostingConfirmed:true,reference:'Reviewed actual provider receipt headers, source digest and cumulative participant posting meanings',amountFormat:'CENTS',dateFormat:'ISO',columns:retirementReceiptFields.map(field=>({field,header:field})),statusValues:{PENDING:'Waiting',ACCEPTED:'Imported',POSTED:'Credited',REJECTED:'Rejected'}})
export async function retirementReceiptContractFixture(h){
 const api=async(path,body,status=200,facility=1)=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method:body?'POST':'GET',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':String(facility)},...(body?{body:JSON.stringify(body)}:{})});const j=await r.json();assert.equal(r.status,status,j.message);return j.data}
 await api('/retirement-plans',{plan:retirementPlanFixture(),expectedRevision:0,requestKey:randomUUID()})
 const planRevisionId=(await api('/retirement-plans')).history[0].id,formatPath='/retirement-plans/standard/allocation-format',format=await api(formatPath,{planRevisionId,expectedRevision:0,requestKey:randomUUID(),format:allocationFormatFixture()})
 return {api,path:'/retirement-plans/standard/receipt-contract',formatPath,body:{action:'REVIEW',planRevisionId,allocationFormatId:format.id,expectedRevision:0,requestKey:randomUUID(),contract:receiptContractFixture()}}
}
