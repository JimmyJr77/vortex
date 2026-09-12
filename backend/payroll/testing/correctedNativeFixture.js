import {settledCorrectedHourlyFixture} from './settledCorrectedHourlyFixture.js'
export async function correctedNativeFixture(h){
 const {api,e,original}=await settledCorrectedHourlyFixture(h)
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date='2026-08-06' WHERE id=$1",[e.id])
 await h.pool.query("UPDATE payroll_employee SET employment_status='ONBOARDING',hire_date='2026-08-07',termination_date=NULL,pay_type='SALARY',annual_salary_cents=6240000 WHERE id=$1",[e.id])
 await h.pool.query('UPDATE payroll_onboarding_task SET onboarding_cycle=onboarding_cycle+1 WHERE employee_id=$1',[e.id])
 await api(`/employees/${e.id}/salary-review`,{classification:'NONEXEMPT',fixed40Verified:true,minimumWageVerified:true,minimumWageCents:1500,confirmed:true,source:'Synthetic verified later salary agreement',employmentStart:'2026-08-07'})
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE' WHERE id=$1",[e.id])
 for(const day of ['07','08','09'])await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,$2,$3,'ADMIN','APPROVED')",[e.id,`2026-08-${day}T12:00Z`,`2026-08-${day}T${day==='09'?22:20}:00Z`])
 const period=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-08-07','2026-08-09','2026-09-18','SEMIMONTHLY') RETURNING id")).rows[0]
 return {api,e,original,period}
}
