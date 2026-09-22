import {randomUUID} from 'node:crypto'
import {monthlyBenefitsFixture} from './monthlyBenefitsFixture.js'
export async function benefitContinuationFixture(h){
 const f=await monthlyBenefitsFixture(h),{api,employee}=f
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date='2026-09-16' WHERE id=$1",[employee.id])
 await h.pool.query("UPDATE payroll_employment_period SET ended_on='2026-09-16' WHERE employee_id=$1",[employee.id])
 await h.pool.query("DELETE FROM payroll_time_entry WHERE employee_id=$1 AND clock_in>'2026-09-16T23:59:59Z'",[employee.id])
 const row=(await api('/benefit-coverage?month=2026-09')).rows[0]
 const coverageBody={month:row.month,employeeId:row.employeeId,onboardingCycle:row.onboardingCycle,planId:row.planId,sourceFingerprint:row.sourceFingerprint,expectedRevision:0,disposition:'COVERED',carrier:'Synthetic continuation carrier',coverageStart:'2026-09-01',coverageEnd:'2026-09-30',reference:'Synthetic carrier confirms continued coverage for the full monthly contribution',confirmed:true,requestKey:randomUUID()}
 const path=`/employees/${employee.id}/benefit-continuation`,state=()=>api(`${path}?paymentDate=2026-09-18`)
 const reviewBody=current=>({paymentDate:'2026-09-18',sourceFingerprint:current.source.fingerprint,expectedRevision:current.history[0]?.revision||0,disposition:'COLLECT_SIGNED_MONTHLY',reference:'Reviewed full monthly amount due, continued coverage, signed authorization and lawful final-wage collection',confirmed:true,requestKey:randomUUID()})
 return {...f,path,state,coverageBody,reviewBody}
}
