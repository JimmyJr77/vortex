import {randomUUID} from 'node:crypto'
import {retirementRemittanceAuthorizationFixture} from './retirementRemittanceAuthorizationFixture.js'
export async function retirementAllocationDeliveryFixture(h,configuration){
 const f=await retirementRemittanceAuthorizationFixture(h),remittance=await f.api(f.path,f.body),setupPath='/retirement-plans/standard/allocation-delivery',setup=await f.api(setupPath)
 const config=await f.api(setupPath,{action:'REVIEW',planRevisionId:setup.planRevisionId,formatId:setup.formatId,configuration,expectedRevision:0,requestKey:randomUUID(),confirmed:true,acceptsCsv:true,stagingExcluded:true,nonOverwritingRename:true,noAutomaticDebit:true,reference:'Independent recordkeeper verification of this file contract and separate CCD funding'})
 await f.api(`${setupPath}/${config.id}/check`,{})
 return {...f,remittanceId:remittance.id,setupPath,configurationId:config.id,deliveryPath:`/retirement-remittance-authorizations/${remittance.id}/allocation-delivery`,deliveryBody:{configurationId:config.id,fileName:`retirement_${remittance.id}.csv`,reference:'Reviewed exact authorized file, unique filename and absent external allocation submissions',confirmed:true,outsideActivityReviewed:true,requestKey:randomUUID()}}
}
