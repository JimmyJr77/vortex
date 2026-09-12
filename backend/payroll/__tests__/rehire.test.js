import test from 'node:test'
import assert from 'node:assert/strict'
import {hashPayrollToken} from '../employeeAuth.js'
import {createHarness} from '../testing/harness.js'
for(const payType of ['HOURLY','SALARY'])test(`${payType} rehire preserves identity and history, resets onboarding atomically and completes a fresh hiring cycle`,{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200,method=body===undefined?'GET':'POST',employee=false)=>{
  const r=await fetch(`${h.url}/api/${employee?'payroll/employee':'admin/payroll'}${path}`,{method,headers:{Authorization:`Bearer ${employee?'rehire-session':'payroll-test-admin'}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)})
  const j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j.data
 }
 const e=await api('/employees',{employeeNumber:`REHIRE-${payType}`,legalFirstName:'Returning',legalLastName:'Worker',personalEmail:`${payType.toLowerCase()}@example.test`,hireDate:'2026-08-03',payType,hourlyRateCents:2500,annualSalaryCents:5200000,jobTitle:'Office manager'},201)
 if(payType==='SALARY')await api(`/employees/${e.id}/salary-review`,{classification:'EXEMPT',category:'ADMINISTRATIVE',salaryBasisVerified:true,dutiesVerified:true,stateRulesVerified:true,dutiesEvidence:'Verified independent discretion and judgment on significant office management matters.',source:'Synthetic job duties and salary basis agreement',confirmed:true})
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date='2026-08-08',portal_password_hash='synthetic-preserved-hash',w4_status='COMPLETE',state_withholding_status='COMPLETE',i9_status='COMPLETE',direct_deposit_status='ACTIVE' WHERE id=$1",[e.id])
 await h.pool.query("UPDATE payroll_onboarding_task SET status='COMPLETE',response='{\"reference\":\"prior-provider-record\"}',completed_at=now(),reviewed_by=99 WHERE employee_id=$1",[e.id])
 await h.pool.query("UPDATE payroll_employee_document SET status='VERIFIED',secure_reference='prior-secure-form',completed_at=now() WHERE employee_id=$1",[e.id])
 await h.pool.query("INSERT INTO payroll_tax_election(facility_id,employee_id,tax_year,elections,source_note,verified_by) VALUES(1,$1,2026,'{}','Synthetic old elections',99)",[e.id])
 await h.pool.query("INSERT INTO payroll_employee_session(facility_id,employee_id,token_hash,expires_at) VALUES(1,$1,$2,now()+interval '1 day')",[e.id,hashPayrollToken('old-rehire-session')])
 await h.pool.query("INSERT INTO payroll_employee_invitation(facility_id,employee_id,recipient_email,token_hash,expires_at) VALUES(1,$1,'old@example.test',$2,now()+interval '1 day')",[e.id,hashPayrollToken('old-invitation')])
 await h.pool.query("INSERT INTO payroll_leave_transaction(facility_id,employee_id,leave_type,transaction_date,minutes,reason) VALUES(1,$1,'PTO','2026-08-01',480,'Synthetic retained leave')",[e.id])
 const period=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-08-03','2026-08-09','2026-08-14','WEEKLY') RETURNING id")).rows[0]
 const run=(await h.pool.query("INSERT INTO payroll_run(facility_id,pay_period_id,status,payment_date,payment_confirmation_reference) VALUES(1,$1,'FINALIZED','2026-08-14','SYNTHETIC-PRIOR-PAID') RETURNING id",[period.id])).rows[0]
 await h.pool.query('INSERT INTO payroll_run_employee(payroll_run_id,employee_id,net_pay_cents) VALUES($1,$2,17000)',[run.id,e.id])
 const review=await api(`/employees/${e.id}/rehire-review?startDate=2099-09-07`);assert.deepEqual(review.issues,[])
 const body={requestId:`rehire-request-${payType}`,startDate:'2099-09-07',reviewFingerprint:review.fingerprint,reason:'Returning to the same reviewed role',reviewReference:'Synthetic review confirms prior wages, expenses, leave and compensation obligations',termsConfirmed:true,priorObligationsReviewed:true}
 const route=`${h.url}/api/admin/payroll/employees/${e.id}/rehire`
 assert.equal((await fetch(route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})).status,401)
 assert.equal((await fetch(route,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':'2'},body:JSON.stringify(body)})).status,404)
 await api(`/employees/${e.id}/rehire`,{...body,reviewFingerprint:'stale'},409)
 // A failed audit must roll back every prior reset, including session revocation.
 await h.pool.query("CREATE FUNCTION reject_rehire_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='EMPLOYEE_REHIRED' THEN RAISE EXCEPTION 'Synthetic rehire audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_rehire_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_rehire_audit()")
 await api(`/employees/${e.id}/rehire`,body,500)
 assert.equal((await h.pool.query('SELECT employment_status FROM payroll_employee WHERE id=$1',[e.id])).rows[0].employment_status,'TERMINATED')
 assert.equal((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_employment_period WHERE employee_id=$1',[e.id])).rows[0].n,1)
 assert.equal((await h.pool.query('SELECT revoked_at FROM payroll_employee_session WHERE employee_id=$1',[e.id])).rows[0].revoked_at,null)
 await h.pool.query('DROP TRIGGER reject_rehire_audit ON payroll_audit_log')
 const result=await api(`/employees/${e.id}/rehire`,body,201);assert.equal(result.employeeId,e.id)
 assert.deepEqual(await api(`/employees/${e.id}/rehire`,body),result)
 await api(`/employees/${e.id}/rehire`,{...body,reason:'A changed reason under the same request'},409)
 const fresh=(await h.pool.query('SELECT * FROM payroll_employee WHERE id=$1',[e.id])).rows[0]
 assert.equal(fresh.employment_status,'ONBOARDING');assert.equal(fresh.portal_password_hash,'synthetic-preserved-hash');assert.equal(fresh.w4_status,'MISSING');assert.equal(fresh.direct_deposit_status,'NOT_CONFIGURED')
 assert.equal((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_tax_election WHERE employee_id=$1',[e.id])).rows[0].n,0)
 const audit=(await h.pool.query("SELECT * FROM payroll_audit_log WHERE action='EMPLOYEE_REHIRED' AND entity_id=$1",[String(e.id)])).rows
 assert.equal(audit.length,1);assert.equal(audit[0].before_data.taxElection.source_note,'Synthetic old elections');assert.equal(audit[0].before_data.employee.portal_password_hash,undefined)
 assert.ok((await h.pool.query('SELECT revoked_at FROM payroll_employee_session WHERE employee_id=$1',[e.id])).rows[0].revoked_at)
 assert.ok((await h.pool.query('SELECT revoked_at FROM payroll_employee_invitation WHERE employee_id=$1',[e.id])).rows[0].revoked_at)
 assert.equal((await h.pool.query('SELECT SUM(minutes)::int n FROM payroll_leave_transaction WHERE employee_id=$1',[e.id])).rows[0].n,480)
 assert.equal((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_employment_period WHERE employee_id=$1',[e.id])).rows[0].n,2)
 const packet=await api(`/employees/${e.id}/onboarding`)
 assert.ok(packet.tasks.every(t=>t.status==='OPEN'&&t.onboarding_cycle===2&&Object.keys(t.response).length===0))
 const adminTask=packet.tasks.find(t=>t.task_key==='SAFETY')
 await api(`/employees/${e.id}/onboarding/${adminTask.id}/review`,{status:'COMPLETE',note:'Synthetic stale prior review',onboardingCycle:1},409)
 await api(`/employees/${e.id}/activate`,{},409)
 if(payType==='HOURLY'){
  await api(`/employees/${e.id}`,{hourlyRateCents:2800},200,'PATCH')
  const rates=(await h.pool.query('SELECT hourly_rate_cents FROM payroll_pay_rate WHERE employee_id=$1 ORDER BY effective_on',[e.id])).rows
  assert.deepEqual(rates.map(r=>r.hourly_rate_cents),[2500,2800])
 }else{
  const terms={employmentStart:'2099-09-07',classification:'NONEXEMPT',annualSalaryCents:6240000,jobTitle:'Operations coordinator',fixed40Verified:true,minimumWageVerified:true,minimumWageCents:1500,source:'Synthetic new rehire fixed salary and role agreement',confirmed:true}
  await api(`/employees/${e.id}/salary-review`,{...terms,employmentStart:'2026-08-03'},409)
  await api(`/employees/${e.id}/salary-review`,terms)
  const first=(await h.pool.query('SELECT * FROM payroll_salary_change WHERE employee_id=$1 ORDER BY effective_on,id',[e.id])).rows
  assert.equal(Number(first[0].annual_salary_cents),5200000);assert.equal(first[0].salary_review.classification,'EXEMPT')
  assert.equal(Number(first[1].annual_salary_cents),6240000);assert.equal(first[1].salary_review.classification,'NONEXEMPT')
  await api(`/employees/${e.id}/salary-review`,{...terms,annualSalaryCents:6500000})
  const changed=await api(`/employees/${e.id}/onboarding`)
  assert.equal(changed.wageTerms.annualSalaryCents,6500000);assert.equal(changed.wageTerms.jobTitle,'Operations coordinator');assert.equal(changed.wageTerms.overtimeClassification,'NONEXEMPT')
  const history=await api(`/employees/${e.id}/salary-changes`)
  assert.equal(history.length,3);assert.ok(history.every(row=>!row.canCancel))
  assert.equal(history.filter(row=>row.cancelled_at).length,1)
  const work=(await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,'2099-09-07T12:00:00Z','2099-09-07T13:00:00Z','ADMIN','UNVERIFIED') RETURNING id",[e.id])).rows[0]
  await api(`/employees/${e.id}/salary-review`,{...terms,annualSalaryCents:6600000},409)
  await h.pool.query("UPDATE payroll_time_entry SET status='REJECTED' WHERE id=$1",[work.id])
  await api(`/employees/${e.id}/salary-changes/${history[0].id}/cancel`,{reason:'Synthetic invalid opening cancellation',noticeDeliveredOn:'2026-09-09',noticeConfirmed:true,noticeReference:'Synthetic old salary restored'},409)
  const beforeRehire=await api('/runs/preview',{payPeriodId:period.id})
  assert.equal(beforeRehire.preview.employees[0].salaryCalculation.annualSalaryCents,5200000)
  assert.equal(beforeRehire.preview.employees[0].salaryCalculation.classification,'EXEMPT')
 }
 await h.pool.query("UPDATE payroll_settings SET onboarding_policy='{\"handbookText\":\"Synthetic current handbook and leave policy\"}' WHERE facility_id=1")
 await h.pool.query("INSERT INTO payroll_employee_session(facility_id,employee_id,token_hash,expires_at) VALUES(1,$1,$2,now()+interval '1 day')",[e.id,hashPayrollToken('rehire-session')])
 await api('/shifts',{employeeId:e.id,scheduledStart:'2099-09-07T12:00:00Z',scheduledEnd:'2099-09-07T16:00:00Z'},201)
 for(const task of packet.tasks){
  if(task.owner==='EMPLOYEE'){
   let response={reference:'Synthetic fresh provider receipt'}
   if(task.task_key==='PROFILE')response=Object.fromEntries(['legalFirstName','legalLastName','address','city','state','postalCode','phone','emergencyName','emergencyPhone','emergencyRelationship'].map(key=>[key,key==='state'?'MD':'Synthetic current value']))
   if(task.task_key==='PAYMENT')response={method:'CHECK'}
   if(task.task_key==='AVAILABILITY')response={note:'Available for the scheduled first shift; meet the supervisor at reception.'}
   if(['WAGE_NOTICE','HANDBOOK'].includes(task.task_key))response={acknowledged:true,signature:'Returning Worker'}
   if(task.task_key==='WAGE_NOTICE')response.displayedWageTerms=(await api(`/employees/${e.id}/onboarding`)).wageTerms
   if(task.task_key==='HANDBOOK')response.displayedHandbookTerms={handbookText:'Synthetic current handbook and leave policy',benefitsText:''}
   await api(`/onboarding/${task.id}`,{...response,onboardingCycle:2},200,'POST',true)
  }
  if(task.task_key==='PAY_REVIEW')await api(`/employees/${e.id}/tax-elections`,{confirmed:true,sourceNote:'Synthetic verified hiring tax forms',federal:{filingStatus:'SINGLE'},maryland:{filingStatus:'SINGLE',localRate:3.2,exemptions:1}},200,'PATCH')
  await api(`/employees/${e.id}/onboarding/${task.id}/review`,{status:'COMPLETE',note:'Synthetic fresh hiring review and supporting evidence',onboardingCycle:2,benefitsReview:{disposition:'NOT_OFFERED',effectiveOn:'2026-08-03',summary:'No employer benefit plan is offered for this synthetic hire.',evidenceReference:'Synthetic employer offering review',confirmed:true},paySetupFingerprint:(await api(`/employees/${e.id}/onboarding`)).paySetup.fingerprint})
 }
 assert.equal((await api(`/employees/${e.id}/onboarding`)).readiness.ready,true)
 await api(`/employees/${e.id}/activate`,{})
 if(payType==='SALARY'){
  assert.equal((await api(`/employees/${e.id}/onboarding`)).wageTerms.annualSalaryCents,6500000)
  const firstPeriod=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2099-09-01','2099-09-15','2099-09-20','SEMIMONTHLY') RETURNING id")).rows[0]
  const initial=(await api('/runs/preview',{payPeriodId:firstPeriod.id})).preview
  assert.equal(initial.employees[0].salaryCalculation.annualSalaryCents,6500000)
  assert.equal(initial.employees[0].salaryCalculation.classification,'NONEXEMPT')
  assert.equal(initial.warnings.some(w=>w.code==='SALARY_CHANGE_PERIOD_BOUNDARY'),false)
 }
 assert.equal((await h.pool.query('SELECT employment_status FROM payroll_employee WHERE id=$1',[e.id])).rows[0].employment_status,'ACTIVE')
 assert.equal((await h.pool.query('SELECT net_pay_cents FROM payroll_run_employee WHERE payroll_run_id=$1',[run.id])).rows[0].net_pay_cents,'17000')
})
