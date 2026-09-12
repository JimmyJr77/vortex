import {randomUUID} from 'node:crypto'
import {retirementRemittanceFixture} from './retirementRemittanceFixture.js'
import {allocationFields} from '../retirementAllocationFormat.js'
export const allocationFormatFixture=()=>({disposition:'VERIFIED',amountFormat:'DOLLARS',dateFormat:'ISO',includeHeader:true,columns:allocationFields.map(field=>({field,header:field})),reference:'Actual recordkeeper eight-column allocation specification independently reviewed',confirmed:true})
export async function retirementAllocationFixture(h){
 const f=await retirementRemittanceFixture(h),timingPath='/retirement-plans/standard/timing',timing=await f.api(timingPath)
 await f.api(timingPath,{planRevisionId:timing.planRevisionId,expectedRevision:0,requestKey:randomUUID(),policy:{effectiveOn:'2026-01-01',disposition:'REVIEWED',depositBusinessDays:2,providerLeadBusinessDays:1,cutoffTime:'14:00',reference:'Actual two-day segregation and one-day provider receipt timing reviewed',confirmed:true,calendarConfirmed:true,earliestConfirmed:true}})
 return {...f,formatPath:'/retirement-plans/standard/allocation-format',planRevisionId:timing.planRevisionId}
}
