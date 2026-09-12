import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {calculateWithholding2026,federalWithholding2026,marylandWithholding2026} from '../withholding2026.js'
import {statementLines} from '../payStatement.js'
const election={verified:true,federal:{filingStatus:'SINGLE'},maryland:{filingStatus:'SINGLE',localRate:3.2,exemptions:1}}
test('PTO aggregate withholding includes vacation wages and rejects standalone or high cumulative wages',()=>{
 const base={grossPayCents:119163,regularWagesCents:100000,leavePayoutCents:19163,election,year:2026,workState:'MD',residenceState:'MD',payFrequency:'WEEKLY'}
 const result=calculateWithholding2026(base)
 assert.equal(result.federalIncomeTaxCents,federalWithholding2026(119163,election.federal,52))
 assert.equal(result.stateIncomeTaxCents,marylandWithholding2026(119163,election.maryland,'WEEKLY'))
 assert.match(result.method,/pto-aggregate/)
 assert.throws(()=>calculateWithholding2026({...base,grossPayCents:19163}),/concurrent regular wages/)
 assert.throws(()=>calculateWithholding2026({...base,ytdWagesCents:100000000}),/cumulative wages/)
})
for(const salary of [false,true])test(`${salary?'Salary':'Hourly'} final payroll pays multiple PTO reservations once, rolls back failed settlement and freezes statement evidence`,{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close())
 const api=async(path,body,status=200,method='POST')=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method,headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)});const j=await r.json();assert.equal(r.status,status,JSON.stringify(j));return j.data}
 await api('/settings',{legalBusinessName:'PTO Payroll Fixture',businessAddress:'123 Test Street, Bowie MD',businessPhone:'5550100000'},200,'PATCH')
 await api('/employer-taxes',{futaRatePercent:0.6,mdUiRatePercent:2.6,source:'Synthetic verified employer tax notice',confirmed:true},200,'PATCH')
 const e=await api('/employees',{employeeNumber:'PTO-PAY',legalFirstName:'Vacation',legalLastName:'Payout',hireDate:'2026-08-03',...(salary?{payType:'SALARY',annualSalaryCents:7800000,jobTitle:'Coordinator'}:{hourlyRateCents:2500})},201)
 if(salary)await api(`/employees/${e.id}/salary-review`,{classification:'NONEXEMPT',fixed40Verified:true,minimumWageVerified:true,minimumWageCents:1500,source:'Synthetic fixed forty hour salary agreement',confirmed:true})
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED',termination_date='2026-08-08',w4_status='COMPLETE',state_withholding_status='COMPLETE' WHERE id=$1",[e.id])
 await api(`/employees/${e.id}/tax-elections`,{confirmed:true,sourceNote:'Synthetic signed tax elections',...election},200,'PATCH')
 const period=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,'2026-08-03','2026-08-09','2026-08-14','WEEKLY') RETURNING id")).rows[0]
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
 for(let i=3;i<=7;i++)await h.pool.query("INSERT INTO payroll_time_entry(facility_id,employee_id,clock_in,clock_out,source,status) VALUES(1,$1,$2,$3,'ADMIN','APPROVED')",[e.id,`2026-08-0${i}T12:00:00Z`,`2026-08-0${i}T20:00:00Z`])
 await h.pool.query("INSERT INTO payroll_leave_transaction(facility_id,employee_id,leave_type,transaction_date,minutes,reason) VALUES(1,$1,'PTO','2026-08-01',480,'Synthetic earned vacation')",[e.id])
 const ids=[]
 for(const minutes of [450,30]){
  const body={leaveType:'PTO',minutes,hourlyRateCents:2555,policyVerified:true,unusedVacationVerified:true,policyReference:'Synthetic communicated vacation policy'}
  const preview=await api(`/employees/${e.id}/leave-payout/preview`,body)
  ids.push((await api(`/employees/${e.id}/leave-payouts`,{...body,payPeriodId:period.id,fingerprint:preview.fingerprint,requestKey:`synthetic-payout-${minutes}`},201)).id)
 }
 const args={payPeriodId:period.id,paymentDate:today}
 await api('/runs/preview',args);await h.pool.query("UPDATE payroll_compliance_task SET status='COMPLETE' WHERE facility_id=1")
 const preview=(await api('/runs/preview',args)).preview,w=preview.employees[0]
 assert.equal(preview.canApprove,true,JSON.stringify(preview.warnings))
 assert.equal(w.grossPayCents,salary?170441:120441);assert.equal(w.overtimeMinutes,0)
 assert.equal(w.payItems.filter(p=>p.kind==='LEAVE_PAYOUT').length,2)
 assert.equal(w.sickLeaveAccrualMinutes,80)
 const run=await api('/runs',args,201)
 await api(`/runs/${run.id}/status`,{status:'REVIEW'},200,'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},200,'PATCH')
 await api(`/employees/${e.id}/leave-payouts/${ids[0]}/cancel`,{reason:'Synthetic cancellation after approval'},409)
 await h.pool.query("CREATE FUNCTION reject_paid_payout_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='PTO_PAYOUT_PAID' THEN RAISE EXCEPTION 'synthetic audit failure'; END IF; RETURN NEW; END $$")
 await h.pool.query('CREATE TRIGGER reject_paid_payout_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_paid_payout_audit()')
 const payment={paymentDate:today,paymentConfirmationReference:'SYNTHETIC-PTO-PAYMENT'}
 await api(`/runs/${run.id}/finalize`,payment,500)
 assert.equal((await h.pool.query("SELECT SUM(minutes)::int n FROM payroll_leave_transaction WHERE employee_id=$1 AND leave_type='PTO'",[e.id])).rows[0].n,480)
 assert.equal((await h.pool.query("SELECT COUNT(*)::int n FROM payroll_leave_payout WHERE status='RESERVED'")).rows[0].n,2)
 await h.pool.query('DROP TRIGGER reject_paid_payout_audit ON payroll_audit_log')
 await api(`/runs/${run.id}/finalize`,payment)
 await api(`/runs/${run.id}/finalize`,payment,409)
 assert.equal((await h.pool.query("SELECT SUM(minutes)::int n FROM payroll_leave_transaction WHERE employee_id=$1 AND leave_type='PTO'",[e.id])).rows[0].n,0)
 const paid=(await h.pool.query("SELECT * FROM payroll_leave_payout ORDER BY id")).rows
 assert.ok(paid.every(p=>p.status==='PAID'&&p.leave_transaction_id&&p.paid_run_employee_id))
 await assert.rejects(()=>h.pool.query("UPDATE payroll_leave_payout SET status='RESERVED' WHERE id=$1",[ids[0]]),/cannot be changed/)
 await assert.rejects(()=>h.pool.query('UPDATE payroll_leave_transaction SET minutes=0 WHERE id=$1',[paid[0].leave_transaction_id]),/immutable/)
 const statement=(await h.pool.query('SELECT * FROM payroll_run_employee WHERE payroll_run_id=$1',[run.id])).rows[0]
 assert.equal(statement.statement_snapshot.payItems.filter(p=>p.kind==='LEAVE_PAYOUT').length,2)
 assert.ok(statementLines(statement).lines.some(line=>line[0]==='Unused PTO payout'&&line[2]===19163))
 assert.doesNotMatch(JSON.stringify(statement.statement_snapshot),/Synthetic communicated/)
})
