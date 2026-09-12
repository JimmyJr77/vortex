import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {monthlyBenefitsFixture} from './monthlyBenefitsFixture.js'
import {retirementPlanFixture} from './retirementPlanFixture.js'
import {retirementAnnualFixture} from './retirementAnnualFixture.js'
export async function regularRetirementFixture(h,{includeBonus=false,hourlyRateCents=2500,unusedPto}={}){
 const {api,employee,periods}=await monthlyBenefitsFixture(h,{hourlyRateCents})
 await api('/retirement-plans',{plan:{...retirementPlanFixture(),...(unusedPto?{unusedPto}:{}),compensation:{...retirementPlanFixture().compensation,BONUS:includeBonus}},expectedRevision:0,requestKey:randomUUID()})
 const annualPath=`/employees/${employee.id}/retirement-annual-sources/standard`,annual=await api(annualPath)
 await api(annualPath,{planRevisionId:annual.planRevisionId,expectedRevision:0,requestKey:randomUUID(),facts:retirementAnnualFixture()})
 const eligibilityPath=`/employees/${employee.id}/retirement-eligibility/standard`,eligibility=await api(eligibilityPath)
 await api(eligibilityPath,{sourceFingerprint:eligibility.source.fingerprint,expectedRevision:0,requestKey:randomUUID(),confirmed:true,disposition:'ELIGIBLE',eligibleOn:'2026-09-01',methods:['PERCENTAGE'],reference:'Synthetic regular payroll participant review',employeeExplanation:'Eligible under the reviewed plan entry rules.'})
 const preview=async period=>(await api('/runs/preview',{payPeriodId:period.id})).preview
 assert.ok((await preview(periods[0])).warnings.some(w=>w.code==='RETIREMENT_PAYROLL_REVIEW'&&w.blocking))
 const proposal=(await api('/retirement',undefined,'GET',200,true)).plans[0].proposal
 await api('/retirement/standard/elections',{action:'ELECT',method:'PERCENTAGE',pretax:500,roth:200,signature:'Monthly Benefits',confirmed:true,effectiveOn:'2026-09-12',expectedRevision:0,requestKey:randomUUID(),proposalFingerprint:proposal.fingerprint},'POST',200,true)
 const processingPath='/retirement-plans/standard/processing-review',processing=await api(processingPath)
 assert.ok((await preview(periods[0])).warnings.some(w=>w.code==='RETIREMENT_PAYROLL_REVIEW'&&w.message.includes('processing policies')))
 await api(processingPath,{planRevisionId:processing.planRevisionId,expectedRevision:0,requestKey:randomUUID(),review:{disposition:'REVIEWED',catchUpAuthorized:false,confirmed:true,reference:'Synthetic reviewed regular payroll processing',policies:processing.policies}})
 return {api,employee,periods,preview,processingPath,processing}
}
