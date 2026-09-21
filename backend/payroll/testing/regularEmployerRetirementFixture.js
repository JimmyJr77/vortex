import {randomUUID} from 'node:crypto'
import {monthlyBenefitsFixture} from './monthlyBenefitsFixture.js'
import {retirementPlanFixture} from './retirementPlanFixture.js'
import {retirementAnnualFixture} from './retirementAnnualFixture.js'

// Use databaseNow / retirementNow on September 16 for the September 18 payroll.
export async function regularEmployerRetirementFixture(h,{declined=false}={}){
 const f=await monthlyBenefitsFixture(h,{hireDate:'2026-09-09'}),{api,employee}=f
 await api('/retirement-plans',{plan:{...retirementPlanFixture(),employerContributions:'MATCH_AND_NONELECTIVE',employerContributionTerms:'Synthetic employer funding terms.',employerFormula:{period:'PER_PAYROLL',matchCatchUp:false,matchTiers:[{upToBps:300,matchBps:10000}],nonelectiveBps:200,compensation:{REGULAR:true,OVERTIME:true,BONUS:false,PAID_LEAVE:true},eligibilityTerms:'Synthetic reviewed new hire entry terms.',vestingTerms:'Synthetic reviewed vesting schedule.'}},expectedRevision:0,requestKey:randomUUID()})
 const annualPath=`/employees/${employee.id}/retirement-annual-sources/standard`,annual=await api(annualPath)
 await api(annualPath,{planRevisionId:annual.planRevisionId,expectedRevision:0,requestKey:randomUUID(),facts:{...retirementAnnualFixture(),employerFunding:{compensationCents:0,matchingCents:0,nonelectiveCents:0,reference:'Synthetic verified zero external employer funding'}}})
 const employerPath=`/employees/${employee.id}/retirement-employer-eligibility/standard`,employer=await api(employerPath)
 await api(employerPath,{sourceFingerprint:employer.source.fingerprint,expectedRevision:0,requestKey:randomUUID(),confirmed:true,assessedFrom:'2026-09-09',assessedThrough:'2026-09-15',reference:'Synthetic reviewed full employment-period eligibility',matching:{status:'ELIGIBLE',eligibleOn:'2026-09-09',vestedBps:0},nonelective:{status:'ELIGIBLE',eligibleOn:'2026-09-09',vestedBps:0}})
 const path=`/employees/${employee.id}/retirement-eligibility/standard`,eligibility=await api(path)
 await api(path,{sourceFingerprint:eligibility.source.fingerprint,expectedRevision:0,requestKey:randomUUID(),confirmed:true,disposition:'ELIGIBLE',eligibleOn:'2026-09-09',methods:['PERCENTAGE'],reference:'Synthetic reviewed employee deferral eligibility',employeeExplanation:'Eligible to elect employee deferrals under reviewed terms.'})
 const proposal=(await api('/retirement',undefined,'GET',200,true)).plans[0].proposal
 await api('/retirement/standard/elections',{action:declined?'DECLINE':'ELECT',method:'PERCENTAGE',pretax:declined?0:500,roth:declined?0:200,signature:'Monthly Benefits',confirmed:true,effectiveOn:'2026-09-17',expectedRevision:0,requestKey:randomUUID(),proposalFingerprint:proposal.fingerprint},'POST',200,true)
 const processingPath='/retirement-plans/standard/processing-review',processing=await api(processingPath)
 await api(processingPath,{planRevisionId:processing.planRevisionId,expectedRevision:0,requestKey:randomUUID(),review:{disposition:'REVIEWED',catchUpAuthorized:false,confirmed:true,reference:'Synthetic reviewed employee deferral processing policies',policies:processing.policies}})
 return f
}
