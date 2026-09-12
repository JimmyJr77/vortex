import {correctionPaymentFixture} from './correctionPaymentFixture.js'
export async function correctionBonusFixture(h,options={}){
 const f=await correctionPaymentFixture(h,options),{api,request,input,target,e}=f
 const preview=await api(`/requests/${request.id}/payroll-correction-payment-preview`,input)
 await api(`/requests/${request.id}/payroll-correction-authorizations`,{...input,fingerprint:preview.fingerprint,requestKey:'bonus-source-correction-authorization',reason:'Authorize corrected original work before the later earned bonus',confirmed:true},'POST',201)
 const correctionRun=await api('/runs',{payPeriodId:target.id},'POST',201)
 await api(`/runs/${correctionRun.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${correctionRun.id}/status`,{status:'APPROVED'},'PATCH')
 await api(`/runs/${correctionRun.id}/finalize`,{paymentDate:input.paymentDate,paymentConfirmationReference:'SYNTHETIC-CORRECTION-BEFORE-BONUS'})
 const bonusPeriod=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-09-01','2026-09-15','2026-09-18','SEMIMONTHLY') RETURNING id")).rows[0]
 for(const day of ['07','08','09','10','11'])await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,$2,$3,'ADMIN','APPROVED')",[e.id,`2026-09-${day}T12:00Z`,`2026-09-${day}T20:00Z`])
 const bonus={amountCents:10000,earnedStart:'2026-08-03',earnedEnd:'2026-08-03'}
 const allocation=await api(`/employees/${e.id}/bonus-allocation/preview`,bonus)
 await api(`/employees/${e.id}/bonuses`,{...bonus,payPeriodId:bonusPeriod.id,classification:'NONDISCRETIONARY',paymentType:'ANNUAL_LUMP_SUM',confirmed:true,source:'Synthetic bonus earned proportionally using corrected actual work hours',allocationMethod:'PROPORTIONAL_EARNED_HOURS',allocationMethodVerified:true,allocationFingerprint:allocation.fingerprint},'POST',201)
 return {...f,correctionRun,bonusPeriod,allocation}
}
