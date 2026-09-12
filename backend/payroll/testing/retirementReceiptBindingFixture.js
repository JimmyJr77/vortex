import {randomUUID} from 'node:crypto'
import {retirementAllocationDeliveryFixture} from './retirementAllocationDeliveryFixture.js'
import {receiptContractFixture} from './retirementReceiptContractFixture.js'
export async function retirementReceiptBindingFixture(h,configuration,{claim=true}={}){
 const f=await retirementAllocationDeliveryFixture(h,configuration),allocation=await f.api(f.deliveryPath,f.deliveryBody),contractPath='/retirement-plans/standard/receipt-contract',state=await f.api(contractPath)
 const contractBody={action:'REVIEW',planRevisionId:state.planRevisionId,allocationFormatId:state.allocationFormatId,expectedRevision:0,requestKey:randomUUID(),contract:receiptContractFixture()},contract=await f.api(contractPath,contractBody)
 const dispatch=()=>f.api(`${f.deliveryPath}/${allocation.id}/dispatch`,{action:'SUBMIT',confirmed:true,outsideActivityReviewed:true,reference:'Reviewed exact original allocation file and absent duplicate delivery before submission'})
 if(claim)await dispatch()
 return {...f,allocationId:allocation.id,contractPath,contractBody,dispatch,bindingPath:`${f.deliveryPath}/${allocation.id}/receipt-binding`,bindingBody:{action:'REVIEW',contractId:contract.id,directory:'/incoming',fileName:`receipt_${allocation.id}.csv`,expectedRevision:0,requestKey:randomUUID(),reference:'Reviewed the exact provider receipt path and original file interpretation contract',originalFileReviewed:true,confirmed:true}}
}
