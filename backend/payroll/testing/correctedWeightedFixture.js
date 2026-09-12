import {settledCorrectedHourlyFixture} from './settledCorrectedHourlyFixture.js'
export async function correctedWeightedFixture(h){
 const {api,e,original}=await settledCorrectedHourlyFixture(h)
 await h.pool.query("INSERT INTO payroll_pay_rate(facility_id,employee_id,effective_on,hourly_rate_cents,reason,notice_delivered_on,notice_reference) VALUES(1,$1,'2026-08-07',3000,'Synthetic established rate increase','2026-08-01','Synthetic signed notice')",[e.id])
 for(const day of ['07','08','09'])await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,$2,$3,'ADMIN','APPROVED')",[e.id,`2026-08-${day}T12:00Z`,`2026-08-${day}T${day==='09'?22:20}:00Z`])
 const period=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-08-07','2026-08-09','2026-09-18','SEMIMONTHLY') RETURNING id")).rows[0]
 return {api,e,original,period}
}
