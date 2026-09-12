import {hashPayrollToken} from '../employeeAuth.js'
export async function monthlyBenefitsFixture(h,{taxTreatment='POSTTAX',hourlyRateCents=2500,authorize=true}={}){
 const api=async(path,body,method=body===undefined?'GET':'POST',status=200,employee=false)=>{const response=await fetch(`${h.url}/api/${employee?'payroll/employee':'admin/payroll'}${path}`,{method,headers:{Authorization:`Bearer ${employee?'monthly-benefits-session':'payroll-test-admin'}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const json=await response.json();if(response.status!==status)throw new Error(`${path}: ${response.status} ${JSON.stringify(json)}`);return json.data}
 await api('/settings',{legalBusinessName:'Monthly Benefits Fixture',businessAddress:'123 Test Street, Bowie MD',businessPhone:'5550100000',benefitsText:'Reviewed synthetic benefit offering.',benefitPlans:[{id:'medical',name:'Medical',description:'Synthetic coverage with reviewed employee contribution.',options:[{id:'family',label:'Family',employeeCostCents:12500,employerCostCents:45000,taxTreatment}]}],expectedBenefitCatalog:'',benefitsCatalogEvidence:'Synthetic reviewed carrier rate sheet',benefitsCatalogConfirmed:true},'PATCH')
 await api('/employer-taxes',{futaRatePercent:0.6,mdUiRatePercent:2.6,source:'Synthetic verified employer tax notice',confirmed:true},'PATCH')
 const employee=await api('/employees',{employeeNumber:'MONTHLY-BENEFITS',legalFirstName:'Monthly',legalLastName:'Benefits',hireDate:'2026-09-01',hourlyRateCents},'POST',201)
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE',w4_status='COMPLETE',state_withholding_status='COMPLETE' WHERE id=$1",[employee.id])
 await h.pool.query("UPDATE payroll_onboarding_task SET status='COMPLETE',response='{\"method\":\"CHECK\"}' WHERE employee_id=$1 AND task_key='PAYMENT'",[employee.id])
 await api(`/employees/${employee.id}/tax-elections`,{confirmed:true,sourceNote:'Synthetic signed tax forms verified',federal:{filingStatus:'SINGLE'},maryland:{filingStatus:'SINGLE',localRate:3.2,exemptions:1}},'PATCH')
 await h.pool.query("INSERT INTO payroll_employee_session(facility_id,employee_id,token_hash,expires_at) VALUES(1,$1,$2,now()+interval '1 day')",[employee.id,hashPayrollToken('monthly-benefits-session')])
 let packet=await api('/onboarding',undefined,'GET',200,true)
 packet=await api('/benefits-election',{choice:'ENROLL',signature:'Monthly Benefits',confirmed:true,displayedTerms:packet.policy.benefitsText,requestKey:'monthly-benefit-election',selections:[{planId:'medical',optionId:'family'}],onboardingCycle:1},'POST',200,true)
 const task=packet.tasks.find(t=>t.task_key==='PAY_REVIEW')
 packet=await api(`/employees/${employee.id}/onboarding/${task.id}/review`,{status:'COMPLETE',note:'Verified carrier coverage and employee contribution',paySetupFingerprint:packet.paySetup.fingerprint,benefitsReview:{disposition:'ENROLLED',effectiveOn:'2026-09-01',summary:'Reviewed family coverage enrollment with employee contribution.',evidenceReference:'Synthetic carrier confirmation',confirmed:true}})
 if(authorize)await api('/benefits-deduction-authorization',{signature:'Monthly Benefits',confirmed:true,requestKey:'monthly-benefit-authorization',onboardingCycle:1,proposalFingerprint:packet.benefitsDeduction.proposal.fingerprint},'POST',200,true)
 await api('/dashboard');await h.pool.query("UPDATE payroll_compliance_task SET status='COMPLETE' WHERE facility_id=1")
 const periods=[]
 for(const [start,end,pay,work] of [['2026-09-01','2026-09-15','2026-09-18','2026-09-10'],['2026-09-16','2026-09-30','2026-09-30','2026-09-22'],['2026-10-01','2026-10-15','2026-10-20','2026-10-06']]){
  const period=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,$1,$2,$3,'SEMIMONTHLY') RETURNING *",[start,end,pay])).rows[0]
  await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,$2,$3,'ADMIN','APPROVED')",[employee.id,`${work}T12:00:00Z`,`${work}T20:00:00Z`]);periods.push(period)
 }
 return {api,employee,periods}
}
