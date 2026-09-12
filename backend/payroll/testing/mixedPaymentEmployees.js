// Synthetic check-paid and zero-work employees for complete mixed-batch tests.
export async function addMixedPaymentEmployees(h,api){
 const result=[]
 for(const [number,name,worked] of [['MIXED-CHECK','Check Employee',true],['MIXED-ZERO','Zero Employee',false]]){
  const [first,last]=name.split(' ')
  const employee=await api('/employees',{employeeNumber:number,legalFirstName:first,legalLastName:last,hireDate:'2026-09-01',hourlyRateCents:2500},'POST',201)
  await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE',w4_status='COMPLETE',state_withholding_status='COMPLETE' WHERE id=$1",[employee.id])
  await h.pool.query("UPDATE payroll_onboarding_task SET status='COMPLETE',response='{\"method\":\"CHECK\"}' WHERE employee_id=$1 AND task_key='PAYMENT'",[employee.id])
  await api(`/employees/${employee.id}/tax-elections`,{confirmed:true,sourceNote:'Synthetic signed withholding forms reviewed',federal:{filingStatus:'SINGLE'},maryland:{filingStatus:'SINGLE',localRate:3.2,exemptions:1}},'PATCH')
  if(worked)await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,'2026-09-10T12:00:00Z','2026-09-10T20:00:00Z','ADMIN','APPROVED')",[employee.id])
  result.push(employee)
 }
 return {checkEmployee:result[0],zeroEmployee:result[1]}
}
