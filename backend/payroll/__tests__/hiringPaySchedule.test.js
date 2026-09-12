import test from 'node:test'
import assert from 'node:assert/strict'
import {hiringPolicy,hiringScheduleDescription} from '../hiringPaySchedule.js'
import {createHarness} from '../testing/harness.js'
test('hiring schedule descriptions reflect configured pay frequency and banking rules',()=>{
 assert.match(hiringScheduleDescription({pay_frequency:'SEMIMONTHLY',semimonthly_first_day:5,semimonthly_second_day:20}),/day 5 and day 20/)
 assert.match(hiringScheduleDescription({pay_frequency:'MONTHLY',pay_period_payment_lag_days:5}),/5 calendar days/)
 assert.match(hiringScheduleDescription({pay_frequency:'WEEKLY',pay_period_anchor_start:'2026-08-03',pay_period_payment_lag_days:5}),/7-day pay periods anchored on 2026-08-03/)
})
test('hiring terms select current or future-hire schedule and retain the signed schedule snapshot',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200,employeeToken=null)=>{const r=await fetch(`${h.url}/api/${employeeToken?'payroll/employee':'admin/payroll'}${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${employeeToken||'payroll-test-admin'}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const json=await r.json();assert.equal(r.status,status,JSON.stringify(json));return json.data}
 const employee=await api('/employees',{employeeNumber:'FUTURE-SCHEDULE',legalFirstName:'Future',legalLastName:'Hire',hireDate:'2099-01-05',hourlyRateCents:2500,personalEmail:'future@example.test'},201)
 const weekly={pay_frequency:'WEEKLY',pay_period_anchor_start:'2026-08-03',pay_period_payment_lag_days:5}
 const biweekly={pay_frequency:'BIWEEKLY',pay_period_anchor_start:'2099-01-05',pay_period_payment_lag_days:5}
 await h.pool.query("UPDATE payroll_settings SET onboarding_policy=jsonb_set(onboarding_policy,'{paySchedule}','\"Obsolete manual schedule description\"') WHERE facility_id=1")
 await h.pool.query("INSERT INTO payroll_schedule_version(facility_id,effective_on,schedule_settings,source) VALUES(1,'2000-01-01',$1,'Synthetic baseline'),(1,'2099-01-05',$2,'Synthetic future schedule')",[weekly,biweekly])
 const current=await hiringPolicy(h.pool,1,{hire_date:'2026-01-01'},new Date('2026-09-09T12:00:00Z'))
 assert.equal(current.payScheduleSnapshot.frequency,'WEEKLY');assert.doesNotMatch(current.paySchedule,/Obsolete/)
 const packet=await api(`/employees/${employee.id}/onboarding`)
 assert.match(packet.wageTerms.paySchedule,/Biweekly/);assert.equal(packet.wageTerms.payScheduleSnapshot.anchorStart,'2099-01-05')
 const invite=await api(`/employees/${employee.id}/invitations`,{email:'future@example.test',sendEmail:false},201)
 const token=(await api('/invitations/redeem',{token:new URL(invite.inviteUrl).searchParams.get('invite')},200,'redeeming')).sessionToken
 const task=packet.tasks.find(t=>t.task_key==='WAGE_NOTICE')
 await api(`/onboarding/${task.id}`,{signature:'Future Hire',acknowledged:true,displayedWageTerms:packet.wageTerms},200,token)
 const signed=(await h.pool.query('SELECT response FROM payroll_onboarding_task WHERE id=$1',[task.id])).rows[0].response
 assert.deepEqual(signed.terms.payScheduleSnapshot,packet.wageTerms.payScheduleSnapshot)
 await h.pool.query("UPDATE payroll_schedule_version SET cancelled_at=now() WHERE facility_id=1 AND effective_on='2099-01-05'")
 await api(`/onboarding/${task.id}`,{signature:'Future Hire',acknowledged:true,displayedWageTerms:packet.wageTerms},400,token)
 const refreshed=await api('/onboarding',undefined,200,token);assert.equal(refreshed.wageTerms.payScheduleSnapshot.frequency,'WEEKLY')
 assert.equal((await h.pool.query('SELECT response FROM payroll_onboarding_task WHERE id=$1',[task.id])).rows[0].response.terms.payScheduleSnapshot.frequency,'BIWEEKLY')
})
