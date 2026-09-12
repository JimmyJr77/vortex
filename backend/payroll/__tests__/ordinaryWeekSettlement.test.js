import {writeFile} from 'node:fs/promises'
import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {statementLines} from '../payStatement.js'
for(const initial of ['HOURLY','SALARY'])test(`${initial}-first boundary and ordinary workweeks settle together in a biweekly payroll`,{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,method='POST',status=200)=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method,headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});const j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j.data}
 await api('/pay-schedule/configure',{frequency:'BIWEEKLY',anchorStart:'2026-08-03',paymentLagDays:5,source:'Synthetic published split payroll schedule',confirmed:true})
 await api('/settings',{legalBusinessName:'Split Payroll',businessAddress:'123 Test Street, Bowie MD',businessPhone:'555-010-0000'},'PATCH')
 await api('/employer-taxes',{futaRatePercent:0.6,mdUiRatePercent:2.6,source:'Synthetic employer tax notice',confirmed:true},'PATCH')
 const e=await api('/employees',{employeeNumber:`SPLIT-${initial}`,legalFirstName:'Split',legalLastName:'Settlement',hireDate:'2026-08-03',payType:initial,hourlyRateCents:2500,annualSalaryCents:6240000},'POST',201)
 const review={classification:'NONEXEMPT',fixed40Verified:true,minimumWageVerified:true,minimumWageCents:1500,confirmed:true,source:'Synthetic verified fixed salary agreement'}
 if(initial==='SALARY'){
  await api(`/employees/${e.id}/salary-review`,review)
  await h.pool.query("INSERT INTO payroll_salary_change(facility_id,employee_id,effective_on,annual_salary_cents,salary_review,reason) SELECT facility_id,id,hire_date,annual_salary_cents,salary_review,'Retained prior agreement' FROM payroll_employee WHERE id=$1",[e.id])
 }
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date='2026-08-05' WHERE id=$1",[e.id])
 await h.pool.query("UPDATE payroll_employee SET employment_status='ONBOARDING',hire_date='2026-08-07',termination_date=NULL,pay_type=$2,hourly_rate_cents=3000,annual_salary_cents=$3,salary_review=NULL WHERE id=$1",[e.id,initial==='HOURLY'?'SALARY':'HOURLY',initial==='HOURLY'?6240000:null])
 if(initial==='HOURLY')await api(`/employees/${e.id}/salary-review`,review)
 else await h.pool.query("INSERT INTO payroll_pay_rate(facility_id,employee_id,effective_on,hourly_rate_cents,reason) VALUES(1,$1,'2026-08-07',3000,'New hourly agreement')",[e.id])
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE',w4_status='COMPLETE',state_withholding_status='COMPLETE' WHERE id=$1",[e.id])
 await api(`/employees/${e.id}/tax-elections`,{confirmed:true,sourceNote:'Synthetic signed employee tax elections',federal:{filingStatus:'SINGLE'},maryland:{filingStatus:'SINGLE',localRate:3.2,exemptions:1}},'PATCH')
 for(const day of ['03','04','05','07','08','09','10','11','12','13','14'])await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,$2,$3,'ADMIN','APPROVED')",[e.id,`2026-08-${day}T12:00Z`,`2026-08-${day}T${day==='09'?22:20}:00Z`])
 const periods=await api('/pay-periods/generate',{year:2026,month:8},'POST',201),period=periods.find(p=>String(p.period_start).startsWith('2026-08-03'))
 await api('/runs/preview',{payPeriodId:period.id})
 await h.pool.query("UPDATE payroll_compliance_task SET status='COMPLETE' WHERE facility_id=1")
 const allocationInput={payPeriodId:period.id,week:'2026-08-03',salaryAllocations:[{employmentStart:initial==='HOURLY'?'2026-08-07':'2026-08-03',earningsCents:initial==='HOURLY'?120000:240000,source:'Synthetic verified allocation of all straight-time salary earnings'}]}
 const allocation=await api(`/employees/${e.id}/workweek-allocation-preview`,allocationInput)
 await api(`/employees/${e.id}/workweek-allocations`,{...allocationInput,fingerprint:allocation.fingerprint,requestId:'full-settlement-allocation',reason:'Reviewed all earned salary and hourly workweek amounts',confirmed:true},'POST',201)
 const evidence=(await api('/runs/preview',{payPeriodId:period.id})).preview.employees[0].employmentWeekReviews[0]
 await api(`/employees/${e.id}/workweek-settlement-authorizations`,{payPeriodId:period.id,week:'2026-08-03',fingerprint:evidence.paymentReconciliation.fingerprint,requestId:'full-settlement-authorized',reason:'Reviewed complete payment history and authorized unpaid workweek wages',historyComplete:true,confirmed:true},'POST',201)
 const remaining=(await api('/runs/preview',{payPeriodId:period.id})).preview
 assert.equal(remaining.employees[0].employmentWeekReviews.length,2)
 assert.equal(remaining.canApprove,false)
 const secondInput={...allocationInput,week:'2026-08-10',salaryAllocations:initial==='HOURLY'?allocationInput.salaryAllocations:[]}
 const secondAllocation=await api(`/employees/${e.id}/workweek-allocation-preview`,secondInput)
 await api(`/employees/${e.id}/workweek-allocations`,{...secondInput,fingerprint:secondAllocation.fingerprint,requestId:'ordinary-week-allocation',reason:'Reviewed the ordinary salary workweek alongside the hiring boundary',confirmed:true},'POST',201)
 const secondEvidence=(await api('/runs/preview',{payPeriodId:period.id})).preview.employees[0].employmentWeekReviews.find(w=>w.week==='2026-08-10')
 await api(`/employees/${e.id}/workweek-settlement-authorizations`,{payPeriodId:period.id,week:'2026-08-10',fingerprint:secondEvidence.paymentReconciliation.fingerprint,requestId:'ordinary-week-authorization',reason:'Reviewed all prior payments and authorized the ordinary workweek wages',historyComplete:true,confirmed:true},'POST',201)
 const preview=(await api('/runs/preview',{payPeriodId:period.id})).preview
 assert.equal(preview.canApprove,true,JSON.stringify(preview.warnings))
 const calculated=preview.employees[0];assert.equal(calculated.grossPayCents,initial==='HOURLY'?318000:469800);assert.equal(calculated.sickLeaveAccrualMinutes,180)
 const run=await api('/runs',{payPeriodId:period.id},'POST',201)
 await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH')
 await h.pool.query("CREATE FUNCTION reject_split_finalize() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='FINALIZE' THEN RAISE EXCEPTION 'Synthetic split finalization failure'; END IF; RETURN NEW; END $$")
 await h.pool.query('CREATE TRIGGER reject_split_finalize BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_split_finalize()')
 const payment={paymentDate:String(period.pay_date).slice(0,10),paymentConfirmationReference:'SYNTHETIC-SPLIT-CHECK'}
 await api(`/runs/${run.id}/finalize`,payment,'POST',500)
 assert.equal((await h.pool.query('SELECT COUNT(*)::int n FROM payroll_leave_transaction WHERE employee_id=$1',[e.id])).rows[0].n,0)
 await h.pool.query('DROP TRIGGER reject_split_finalize ON payroll_audit_log')
 await api(`/runs/${run.id}/finalize`,payment)
 await api(`/runs/${run.id}/finalize`,payment,'POST',409)
 assert.equal((await h.pool.query("SELECT COUNT(*)::int n FROM payroll_audit_log WHERE action='FINALIZE' AND entity_id=$1",[String(run.id)])).rows[0].n,1)
 await api('/runs',{payPeriodId:period.id},'POST',409)
 const settledReview=(await api('/runs/preview',{payPeriodId:period.id})).preview.employees[0].employmentWeekReviews[0]
 assert.deepEqual(settledReview.paymentReconciliation.differences,{straightTimeCents:0,premiumCents:0})
 assert.equal(settledReview.settlementAuthorization.status,'STALE')
 const frozen=(await h.pool.query('SELECT * FROM payroll_run_employee WHERE payroll_run_id=$1',[run.id])).rows[0]
 assert.deepEqual(frozen.statement_snapshot.authorizedSettlement,calculated.authorizedSettlement)
 assert.equal(statementLines(frozen).lines.reduce((n,l)=>n+Number(l[2]),0),Number(frozen.net_pay_cents))
 assert.equal((await h.pool.query('SELECT SUM(minutes)::int n FROM payroll_leave_transaction WHERE employee_id=$1',[e.id])).rows[0].n,180)
 const invite=await api(`/employees/${e.id}/invitations`,{email:'split-reader@example.test',sendEmail:false},'POST',201)
 const redeemed=await fetch(`${h.url}/api/payroll/employee/invitations/redeem`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:new URL(invite.inviteUrl).searchParams.get('invite')})});assert.equal(redeemed.status,200)
 const token=(await redeemed.json()).data.sessionToken
 const pdf=await fetch(`${h.url}/api/payroll/employee/pay-statements/${frozen.id}.pdf`,{headers:{Authorization:`Bearer ${token}`}});assert.equal(pdf.status,200);assert.match(pdf.headers.get('content-type'),/pdf/)
 if(process.env.PAYROLL_AUTHORIZED_PDF_PATH&&initial==='HOURLY')await writeFile(process.env.PAYROLL_AUTHORIZED_PDF_PATH,Buffer.from(await pdf.arrayBuffer()))
})
