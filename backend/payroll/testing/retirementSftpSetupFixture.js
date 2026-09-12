import {randomUUID} from 'node:crypto'
import assert from 'node:assert/strict'
import {retirementPlanFixture} from './retirementPlanFixture.js'
import {allocationFormatFixture} from './retirementAllocationFixture.js'
export async function retirementSftpSetupFixture(h,configuration){
 const api=async(path,body,status=200,facility=1)=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method:body?'POST':'GET',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':String(facility)},...(body?{body:JSON.stringify(body)}:{})});const j=await r.json();assert.equal(r.status,status,j.message);return j.data}
 await api('/retirement-plans',{plan:retirementPlanFixture(),expectedRevision:0,requestKey:randomUUID()})
 const planRevisionId=(await api('/retirement-plans')).history[0].id,formatPath='/retirement-plans/standard/allocation-format'
 const format=await api(formatPath,{planRevisionId,expectedRevision:0,requestKey:randomUUID(),format:allocationFormatFixture()})
 return {api,path:'/retirement-plans/standard/allocation-delivery',formatPath,body:{action:'REVIEW',configuration,planRevisionId,formatId:format.id,expectedRevision:0,requestKey:randomUUID(),reference:'Independently reviewed SFTP endpoint and exact recordkeeper ingestion contract',confirmed:true,acceptsCsv:true,stagingExcluded:true,nonOverwritingRename:true,noAutomaticDebit:true}}
}
