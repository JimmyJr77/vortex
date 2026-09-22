import {randomUUID} from 'node:crypto'
import {monthlyBenefitsFixture} from './monthlyBenefitsFixture.js'
export async function datedBenefitContinuationFixture(h){
 const f=await monthlyBenefitsFixture(h),{api,employee}=f
 let packet=await api('/onboarding',undefined,'GET',200,true)
 packet=await api('/benefits-election',{choice:'WAIVE',signature:'Monthly Benefits',confirmed:true,displayedTerms:packet.policy.benefitsText,requestKey:'dated-final-pay-benefit-waiver',selections:[{planId:'medical',optionId:'WAIVE'}],onboardingCycle:1},'POST',200,true)
 const task=packet.tasks.find(t=>t.task_key==='PAY_REVIEW')
 await api(`/employees/${employee.id}/onboarding/${task.id}/review`,{status:'COMPLETE',note:'Verified coverage ending after final regular payment',paySetupFingerprint:packet.paySetup.fingerprint,benefitsReview:{disposition:'WAIVED',effectiveOn:'2026-09-20',summary:'The reviewed waiver starts after the September 18 payment.',evidenceReference:'Synthetic dated carrier coverage ending',confirmed:true}})
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date='2026-09-16' WHERE id=$1",[employee.id])
 await h.pool.query("UPDATE payroll_employment_period SET ended_on='2026-09-16' WHERE employee_id=$1",[employee.id])
 await h.pool.query("DELETE FROM payroll_time_entry WHERE employee_id=$1 AND clock_in>'2026-09-16T23:59:59Z'",[employee.id])
 const row=(await api('/benefit-coverage?month=2026-09')).rows[0]
 const coverageBody={month:row.month,employeeId:row.employeeId,onboardingCycle:row.onboardingCycle,planId:row.planId,sourceFingerprint:row.sourceFingerprint,expectedRevision:0,disposition:'COVERED',carrier:'Synthetic dated coverage carrier',coverageStart:'2026-09-01',coverageEnd:'2026-09-19',reference:'Actual carrier coverage ends when the future waiver takes effect; full signed monthly premium remains due',confirmed:true,requestKey:randomUUID()}
 await api('/benefit-coverage',coverageBody)
 const path=`/employees/${employee.id}/benefit-continuation`,state=()=>api(`${path}?paymentDate=2026-09-18`)
 return {...f,path,state,coverageBody}
}
