import {correctionFixture} from './correctionFixture.js'
export async function correctionPaymentFixture(h,options={}){
 const fixture=await correctionFixture(h,options),{api,e,request}=fixture
 for(const d of (options.bridgeTarget?['06']:options.sharedWeek?['07','08','09']:['17','18','19','20','21']))await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,$2,$3,'ADMIN','APPROVED')",[e.id,`2026-08-${d}T12:00Z`,`2026-08-${d}T${options.bridgeTarget?14:options.sharedWeek&&d==='09'?22:20}:00Z`])
 const target=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,$1,$2,'2026-09-04','SEMIMONTHLY') RETURNING id",[options.bridgeTarget?'2026-08-06':options.sharedWeek?'2026-08-07':'2026-08-16',options.bridgeTarget?'2026-08-06':options.sharedWeek?'2026-08-09':'2026-08-31'])).rows[0]
 const calculation=await api(`/requests/${request.id}/payroll-correction-preview`,{})
 const retained=await api(`/requests/${request.id}/payroll-corrections`,{requestKey:'correction-payment-calculation',fingerprint:calculation.fingerprint,reason:'Reviewed original wages and leave effects before preparing the correction',confirmed:true},'POST',201)
 return {...fixture,target,input:{calculationId:retained.id,payPeriodId:Number(target.id),paymentDate:'2026-09-04',historyCompleteConfirmed:true,historySource:'Verified complete synthetic employer and related-employer wage history'}}
}
