import assert from 'node:assert/strict'
export async function correctionFixture(h,{openingAccruedMinutes=0,sharedWeek=false,missingTime=false}={}){
 const api=async(path,body,method='POST',status=200)=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method,headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j.data}
 await api('/settings',{legalBusinessName:'Split Payroll',businessAddress:'123 Test Street, Bowie MD',businessPhone:'555-010-0000'},'PATCH')
 await api('/employer-taxes',{futaRatePercent:0.6,mdUiRatePercent:2.6,source:'Synthetic employer tax notice',confirmed:true},'PATCH')
 const e=await api('/employees',{employeeNumber:'CORRECTION-001',legalFirstName:'Split',legalLastName:'Settlement',hireDate:'2026-08-03',payType:'HOURLY',hourlyRateCents:2500,annualSalaryCents:6240000},'POST',201)
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE',w4_status='COMPLETE',state_withholding_status='COMPLETE' WHERE id=$1",[e.id])
 await api(`/employees/${e.id}/tax-elections`,{confirmed:true,sourceNote:'Synthetic signed employee tax elections',federal:{filingStatus:'SINGLE'},maryland:{filingStatus:'SINGLE',localRate:3.2,exemptions:1}},'PATCH')
 for(const day of (sharedWeek?['03','04','05']:['03','04','05','06','07']))await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,$2,$3,'ADMIN','APPROVED')",[e.id,`2026-08-${day}T12:00Z`,`2026-08-${day}T20:00Z`])
 if(openingAccruedMinutes)await h.pool.query("INSERT INTO payroll_leave_transaction(facility_id,employee_id,transaction_date,minutes,reason,transaction_kind) VALUES(1,$1,'2026-08-03',$2,'Synthetic earlier earned leave for cap verification','ADJUSTMENT')",[e.id,openingAccruedMinutes])
 const periods=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-08-03',$1,'2026-08-14','SEMIMONTHLY') RETURNING id",[sharedWeek?'2026-08-05':'2026-08-09'])).rows
 await api('/runs/preview',{payPeriodId:periods[0].id});await h.pool.query("UPDATE payroll_compliance_task SET status='COMPLETE' WHERE facility_id=1")
 const first=await api('/runs',{payPeriodId:periods[0].id},'POST',201)
 await api(`/runs/${first.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${first.id}/status`,{status:'APPROVED'},'PATCH')
 await api(`/runs/${first.id}/finalize`,{paymentDate:'2026-08-14',paymentConfirmationReference:'SYNTHETIC-NATIVE-HOURLY'})

 const entry=(await h.pool.query('SELECT * FROM payroll_time_entry WHERE employee_id=$1 ORDER BY clock_in LIMIT 1',[e.id])).rows[0]
 const payload={...(missingTime?{}:{entryId:entry.id}),clockIn:missingTime?'2026-08-03T20:00:00Z':entry.clock_in.toISOString(),clockOut:'2026-08-03T22:00:00Z',unpaidBreakMinutes:0,reason:'Correct missing two hours from the first approved shift'}
 const request=(await h.pool.query("INSERT INTO payroll_employee_request(facility_id,employee_id,kind,payload) VALUES(1,$1,'TIME_CORRECTION',$2) RETURNING *",[e.id,payload])).rows[0]
 const impact=await api(`/requests/${request.id}/payroll-impact`,undefined,'GET')
 await api(`/requests/${request.id}/payroll-impact/reviews`,{requestKey:'correction-fixture-review',fingerprint:impact.fingerprint,reason:'Verified original payment and requested two-hour correction',confirmed:true},'POST',201)
 return {api,e,first,entry,request}
}
