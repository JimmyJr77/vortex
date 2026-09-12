import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { syncQuickbooksRun } from '../quickbooks.js'
import { encryptDocument } from '../onboarding.js'
import { runWorkforceAutomation } from '../workforceAutomation.js'
import { createHarness } from '../testing/harness.js'
import { initPayrollTables } from '../initTables.js'

test('complete employee onboarding, documents, requests, payroll and QuickBooks against PostgreSQL', {skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const oldKey=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 const h=await createHarness();t.after(async()=>{await h.close();if(oldKey===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=oldKey})
 let token
 async function api(path,{body,method,employee=false,facility=1,status=200,raw=false}={}) {
  const res=await fetch(`${h.url}/api/${employee?'payroll/employee':'admin/payroll'}${path}`,{method:method||(body?'POST':'GET'),headers:{'Content-Type':'application/json',Authorization:`Bearer ${employee?token:'payroll-test-admin'}`,'x-test-facility':String(facility)},body:body?JSON.stringify(body):undefined})
  if(raw){assert.equal(res.status,status);return res.text()}
  const json=await res.json();assert.equal(res.status,status,`${path}: ${JSON.stringify(json)}`);return json.data
 }
 const initialWorkspace=await api('/dashboard')
 assert.equal(initialWorkspace.complianceTasks.length,8)
 assert.equal(initialWorkspace.summary.openCriticalTasks,8)
 const firstTask=initialWorkspace.complianceTasks[0]
 await api(`/compliance/${firstTask.id}`,{method:'PATCH',body:{status:'NOT_APPLICABLE'},status:400})
 await api(`/compliance/${firstTask.id}`,{facility:2,method:'PATCH',body:{status:'COMPLETE',completionNote:'Synthetic employer verification'},status:404})
 for(const task of initialWorkspace.complianceTasks)await api(`/compliance/${task.id}`,{method:'PATCH',body:{status:'COMPLETE',completionNote:'Synthetic employer account, policy or coverage verification reference'}})
 const readyWorkspace=await api('/dashboard')
 assert.equal(readyWorkspace.summary.setupScore,100);assert.equal(readyWorkspace.settings.einStatus,'VERIFIED')
 assert.equal((await api('/dashboard',{facility:2})).summary.openCriticalTasks,8)
 await h.pool.query("INSERT INTO facility(id,timezone) VALUES (3,'America/New_York')")
 const newWorkplace=await api('/dashboard',{facility:3})
 assert.equal(newWorkplace.settings.legalBusinessName,'');assert.equal(newWorkplace.settings.einStatus,'MISSING')
 assert.equal(newWorkplace.employees.length,0);assert.equal(newWorkplace.complianceTasks.length,8)
 const e=await api('/employees',{body:{employeeNumber:'TEST-001',legalFirstName:'Jordan',legalLastName:'Test',jobTitle:'Instructor',hireDate:'2026-09-01',hourlyRateCents:2500,personalEmail:'jordan@example.test'},status:201})
 await api('/employees',{body:{employeeNumber:'TEST-001',legalFirstName:'Duplicate',legalLastName:'Test',hireDate:'2026-09-01',hourlyRateCents:2500},status:409})
 await api(`/employees/${e.id}/onboarding`,{facility:2,status:404})
 await api(`/employees/${e.id}`,{method:'PATCH',body:{employmentStatus:'ACTIVE'},status:409})
 await api(`/employees/${e.id}/activate`,{body:{},status:409})
 await api(`/employees/${e.id}`,{body:{employmentStatus:'LEAVE'},method:'PATCH',status:409})
 await api('/settings',{method:'PATCH',body:{businessPhone:'555-010-1234',handbookText:'Test handbook: report all worked time. Sick leave policy provided at orientation.',firstDayInstructions:'Meet your supervisor at reception.'}})
 await api('/employer-taxes',{method:'PATCH',body:{futaRatePercent:0.6,mdUiRatePercent:2.6,source:'2026 synthetic rate notice and verified FUTA credit',confirmed:true}})
 const invite=await api(`/employees/${e.id}/invitations`,{body:{email:'jordan@example.test',sendEmail:false},status:201})
 const redeemed=await api('/invitations/redeem',{employee:true,body:{token:new URL(invite.inviteUrl).searchParams.get('invite')}});token=redeemed.sessionToken
 await api('/invitations/redeem',{employee:true,body:{token:new URL(invite.inviteUrl).searchParams.get('invite')},status:410})
 const packet=await api('/onboarding',{employee:true});assert.equal(packet.tasks.length,13)
 const w4=packet.tasks.find(t=>t.task_key==='W4')
 await api(`/onboarding/${w4.id}`,{employee:true,body:{},status:400})
 const doc=await api(`/onboarding/${w4.id}/documents`,{employee:true,body:{filename:'signed-w4.pdf',contentBase64:Buffer.from('%PDF-1.4\nTest signed form').toString('base64')}})
 const stored=(await h.pool.query('SELECT encrypted_content FROM payroll_private_document WHERE id=$1',[doc.id])).rows[0]
 assert.equal(stored.encrypted_content.includes(Buffer.from('Test signed form')),false)
 assert.match(await api(`/documents/${doc.id}`,{raw:true}),/Test signed form/)
 await api(`/documents/${doc.id}`,{facility:2,status:404})
 const profile={legalFirstName:'Jordan',legalLastName:'Test',address:'1 Test Lane',city:'Bowie',state:'MD',postalCode:'20715',phone:'5550100101',emergencyName:'Taylor',emergencyPhone:'5550100102',emergencyRelationship:'Sibling'}
 for(const step of packet.tasks.filter(t=>t.owner==='EMPLOYEE')){
  const body=step.task_key==='PROFILE'?profile:step.task_key==='PAYMENT'?{method:'CHECK'}:['WAGE_NOTICE','HANDBOOK'].includes(step.task_key)?{acknowledged:true,signature:'Jordan Test'}:step.task_key==='AVAILABILITY'?{note:'Weekday afternoons'}:{reference:'TEST-PROVIDER-RECEIPT'}
  if(step.task_key==='WAGE_NOTICE')body.displayedWageTerms=(await api('/onboarding',{employee:true})).wageTerms
  if(step.task_key==='HANDBOOK')body.displayedHandbookTerms={handbookText:packet.policy.handbookText,benefitsText:packet.policy.benefitsText||''}
  await api(`/onboarding/${step.id}`,{employee:true,body})
  await api(`/employees/${e.id}/onboarding/${step.id}/review`,{body:{status:'COMPLETE',note:'Test admin reviewed signed submission.'}})
 }
 await api('/shifts',{body:{employeeId:e.id,scheduledStart:'2026-09-10T14:00:00Z',scheduledEnd:'2026-09-10T18:00:00Z'},status:201})
 await api('/shifts',{body:{employeeId:e.id,scheduledStart:'2026-09-10T15:00:00Z',scheduledEnd:'2026-09-10T17:00:00Z'},status:409})
 const series=await api('/shifts',{body:{employeeId:e.id,scheduledStart:'2026-10-25T14:00:00Z',scheduledEnd:'2026-10-25T18:00:00Z',repeatWeeks:2},status:201});assert.equal(series[1].scheduled_start,'2026-11-01T15:00:00.000Z')
 await api(`/shifts/${series[1].id}`,{method:'PATCH',body:{scheduledStart:series[0].scheduled_start,scheduledEnd:series[0].scheduled_end},status:409})
 const moves=await Promise.all(series.map(shift=>fetch(`${h.url}/api/admin/payroll/shifts/${shift.id}`,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:'Bearer payroll-test-admin'},body:JSON.stringify({scheduledStart:'2026-11-02T14:00:00Z',scheduledEnd:'2026-11-02T18:00:00Z',location:'Updated test studio'})})))
 assert.deepEqual(moves.map(r=>r.status).sort(),[200,409])
 await api(`/employees/${e.id}/tax-elections`,{method:'PATCH',body:{confirmed:true,sourceNote:'Synthetic verified hiring tax forms',federal:{filingStatus:'SINGLE'},maryland:{filingStatus:'SINGLE',localRate:3.2,exemptions:1}}})
 for(const step of packet.tasks.filter(t=>t.owner==='ADMIN'))await api(`/employees/${e.id}/onboarding/${step.id}/review`,{body:{status:'COMPLETE',note:'Test verification and supporting reference recorded.',benefitsReview:{disposition:'NOT_OFFERED',effectiveOn:'2026-08-03',summary:'No employer benefit plan is offered for this synthetic hire.',evidenceReference:'Synthetic employer offering review',confirmed:true},paySetupFingerprint:(await api(`/employees/${e.id}/onboarding`)).paySetup.fingerprint}})
 assert.equal((await api(`/employees/${e.id}/onboarding`)).readiness.ready,true)
 await api(`/employees/${e.id}/activate`,{body:{}})
 assert.equal((await api('/me',{employee:true})).employee.employmentStatus,'ACTIVE')
 // Independently exercise missing-election/manual-withholding recovery after hiring verification.
 await h.pool.query('DELETE FROM payroll_tax_election WHERE employee_id=$1',[e.id])
 await api(`/employees/${e.id}/activate`,{body:{},status:409})
 await api(`/employees/${e.id}/leave-transactions`,{body:{transactionDate:'2026-09-01',minutes:480,reason:'Test opening balance'},status:201})
 const leave=await api('/requests',{employee:true,body:{kind:'LEAVE',payload:{startDate:'2026-09-11',endDate:'2026-09-11',minutes:120,leaveType:'MD_SICK_SAFE',reason:'Personal leave'}}})
 await api(`/requests/${leave.id}/review`,{body:{status:'APPROVED',note:'Approved for requested date'}})
 await api(`/requests/${leave.id}/review`,{body:{status:'APPROVED',note:'Duplicate review'},status:409})
 assert.equal((await api('/me',{employee:true})).sickLeaveBalanceMinutes,360)
 await api('/settings',{method:'PATCH',body:{sickLeavePay:'PAID'}})
 const paidLeave=await api('/requests',{employee:true,body:{kind:'LEAVE',payload:{startDate:'2026-09-12',endDate:'2026-09-12',minutes:60,leaveType:'MD_SICK_SAFE',reason:'Paid sick leave fixture'}}})
 await api(`/requests/${paidLeave.id}/review`,{body:{status:'APPROVED',note:'Paid leave approved under test policy'}})
 const entry=await api('/time-entries',{body:{employeeId:e.id,clockIn:'2026-09-10T14:00:00Z',clockOut:'2026-09-10T18:00:00Z',evidenceNote:'Test shift evidence'},status:201})
 const correction=await api('/requests',{employee:true,body:{kind:'TIME_CORRECTION',payload:{entryId:entry.id,clockIn:'2026-09-10T14:00:00Z',clockOut:'2026-09-10T19:00:00Z',unpaidBreakMinutes:0,reason:'Worked an extra hour'}}})
 await api(`/requests/${correction.id}/review`,{body:{status:'APPROVED',note:'Supervisor verified the extra hour'}})
 await api(`/time-entries/${entry.id}/status`,{method:'PATCH',body:{status:'APPROVED'}})
 const periods=await api('/pay-periods/generate',{body:{year:2026,month:9},status:201});const period=periods.find(p=>String(p.period_start).startsWith('2026-09-01'))
 assert.ok(period)
 const preview=await api('/runs/preview',{body:{payPeriodId:period.id}});assert.equal(preview.preview.grossPayCents,15000)
 assert.equal(preview.preview.employees[0].paidLeaveMinutes,60)
 assert.equal(preview.preview.employees[0].regularMinutes,300)
 const run=await api('/runs',{body:{payPeriodId:period.id},status:201})
 await api('/runs',{body:{payPeriodId:period.id},status:409})
 await api(`/runs/${run.id}/status`,{method:'PATCH',body:{status:'REVIEW'}})
 await api(`/runs/${run.id}/status`,{method:'PATCH',body:{status:'APPROVED'},status:409})
 await api(`/runs/${run.id}/employees/${e.id}/withholding`,{method:'PATCH',body:{federalIncomeTaxCents:1000,stateIncomeTaxCents:500,sourceNote:'Test independently verified withholding worksheet',professionalConfirmed:true}})
 const identityTask=initialWorkspace.complianceTasks.find(t=>t.taskKey==='ein')
 await api(`/compliance/${identityTask.id}`,{method:'PATCH',body:{status:'NOT_APPLICABLE',completionNote:'Attempted mandatory setup bypass'},status:409})
 await api(`/compliance/${identityTask.id}`,{method:'PATCH',body:{status:'OPEN'}})
 await api(`/runs/${run.id}/status`,{method:'PATCH',body:{status:'APPROVED'},status:409})
 await api(`/compliance/${identityTask.id}`,{method:'PATCH',body:{status:'COMPLETE',completionNote:'Employer identity reverified with synthetic agency confirmation'}})
 await api(`/runs/${run.id}/status`,{method:'PATCH',body:{status:'APPROVED'}})
 const pendingLaterPeriods=await api('/pay-periods/generate',{body:{year:2026,month:10},status:201})
 const pendingLater=pendingLaterPeriods.find(p=>String(p.period_start).startsWith('2026-09-16'))
 const pendingPreview=await api('/runs/preview',{body:{payPeriodId:pendingLater.id}})
 assert.ok(pendingPreview.preview.warnings.some(w=>w.code==='PRIOR_PAYMENT_NOT_FINALIZED'))

 const originalQuery=h.pool.query.bind(h.pool)
 h.pool.query=(sql,...args)=>(/^SELECT auto_sync\b/.test(String(sql))&&String(sql).includes('FROM payroll_quickbooks_connection'))?Promise.reject(new Error('Synthetic connection lookup outage')):originalQuery(sql,...args)
 try {
  const latch=await h.pool.connect()
  let pendingFinal,pendingAdjustment
  try {
   await latch.query('SELECT pg_advisory_lock(hashtext(current_schema()),1337)')
   const pid=(await latch.query('SELECT pg_backend_pid() AS pid')).rows[0].pid
   await originalQuery(`CREATE FUNCTION pause_finalization_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='FINALIZE' THEN PERFORM pg_advisory_xact_lock(hashtext(current_schema()),1337); END IF; RETURN NEW; END $$`)
   await originalQuery('CREATE TRIGGER pause_finalization_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION pause_finalization_audit()')
   pendingFinal=api(`/runs/${run.id}/finalize`,{body:{paymentConfirmationReference:'TEST-CHECK-1001',paymentDate:String(period.pay_date).slice(0,10)}})
   const blockedBy=async blocker=> (await originalQuery('SELECT pid FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))',[blocker])).rows[0]?.pid
   let finalPid
   for(let i=0;i<200&&!finalPid;i++){finalPid=await blockedBy(pid);if(!finalPid)await new Promise(r=>setTimeout(r,10))}
   assert.ok(finalPid,'Finalization must reach the paused audit while holding the payroll lock')
   let adjustmentFinished=false
   pendingAdjustment=api(`/employees/${e.id}/adjustments`,{body:{name:'Future approved reimbursement',kind:'REIMBURSEMENT',amountCents:100,activeFrom:'2099-01-01',status:'ACTIVE',authorizationReference:'Synthetic future reimbursement source',taxTreatmentVerified:true},status:201}).then(value=>{adjustmentFinished=true;return value})
   let writerPid
   for(let i=0;i<200&&!writerPid;i++){writerPid=await blockedBy(finalPid);if(!writerPid)await new Promise(r=>setTimeout(r,10))}
   assert.ok(writerPid,'A competing pay adjustment must wait for actual finalization');assert.equal(adjustmentFinished,false)
  }finally{
   await latch.query('SELECT pg_advisory_unlock(hashtext(current_schema()),1337)');latch.release()
  }
  const finalized=await pendingFinal
  await pendingAdjustment
  await originalQuery('DROP TRIGGER pause_finalization_audit ON payroll_audit_log')
  await originalQuery('DROP FUNCTION pause_finalization_audit()')
  assert.equal(finalized.status,'FINALIZED');assert.equal(finalized.quickbooksSync.status,'FAILED')
 }finally{h.pool.query=originalQuery}
 await api(`/runs/${run.id}/finalize`,{body:{paymentConfirmationReference:'TEST-CHECK-1001',paymentDate:String(period.pay_date).slice(0,10)},status:409})
 await h.pool.query('UPDATE payroll_settings SET semimonthly_second_day=21 WHERE facility_id=1')
 const regenerated=await api('/pay-periods/generate',{body:{year:2026,month:9},status:201})
 assert.equal(regenerated.find(p=>Number(p.id)===Number(period.id)).pay_date,period.pay_date)
 await h.pool.query('UPDATE payroll_settings SET semimonthly_second_day=20 WHERE facility_id=1')
 await api(`/time-entries/${entry.id}/status`,{method:'PATCH',body:{status:'REJECTED'},status:409})
 const me=await api('/me',{employee:true});assert.equal(me.payStatements.length,1);assert.equal(Number(me.payStatements[0].net_pay_cents),12352)
 await api('/accounting-mapping',{method:'PATCH',body:{wagesExpenseAccount:'Wages',employerTaxExpenseAccount:'Employer taxes',reimbursementExpenseAccount:'Expenses',taxLiabilityAccount:'Tax liability',deductionLiabilityAccount:'Deductions',payrollClearingAccount:'Payroll clearing',verifiedByBookkeeper:true}})
 const csv=await api(`/reports/quickbooks.csv?runId=${run.id}`,{raw:true});assert.match(csv,/Wages/)
 assert.match(csv,/2026-09-18/)
 const exports=(await api('/dashboard')).exportLogs;assert.equal(exports.length,1)
 assert.ok((await api('/workforce')).audit.length>20)
 await api('/access',{employee:true,body:{password:'short'},status:400})
 await api('/access',{employee:true,body:{password:'Test-Employee-Password-2026'}})
 await api('/logout',{employee:true,body:{}})
 await api('/me',{employee:true,status:401})
 await api('/login',{employee:true,body:{email:'jordan@example.test',password:'incorrect',facilityId:1},status:401})
 token=(await api('/login',{employee:true,body:{email:'jordan@example.test',password:'Test-Employee-Password-2026',facilityId:1}})).sessionToken
 assert.equal((await api('/me',{employee:true})).employee.hasPassword,true)
 const connectionTokens=encryptDocument(Buffer.from(JSON.stringify({access_token:'test-access-token',refresh_token:'test-refresh-token',expiresAt:Date.now()+3600000})),'quickbooks:1')
 await h.pool.query(`INSERT INTO payroll_quickbooks_connection (facility_id,realm_id,encrypted_tokens,environment,account_ids) VALUES (1,'123',$1,'sandbox',$2)`,[connectionTokens,{wages:'1',employerTax:'2',reimbursements:'3',taxLiability:'4',deductions:'5',clearing:'6'}])
 const attempts=[]
 const fetcher=async(url,options)=>{attempts.push({url,body:options.body});if(attempts.length===1)throw new Error('Connection interrupted after send');return {ok:true,status:200,json:async()=>({JournalEntry:{Id:'journal-789'}})}}
 await assert.rejects(syncQuickbooksRun(h.pool,1,run.id,{fetcher}))
 assert.equal((await h.pool.query('SELECT status FROM payroll_quickbooks_sync')).rows[0].status,'FAILED')
 await h.pool.query("INSERT INTO payroll_alert(facility_id,dedupe_key,severity,title,message) VALUES(1,$1,'WARNING','QuickBooks sync needs attention','Synthetic failed request')",[`quickbooks-${run.id}`])
 const syncAlert=async()=>(await h.pool.query('SELECT status,dismissed_at FROM payroll_alert WHERE facility_id=1 AND dedupe_key=$1',[`quickbooks-${run.id}`])).rows[0]
 const synced=await syncQuickbooksRun(h.pool,1,run.id,{fetcher});assert.equal(synced.external_id,'journal-789')
 assert.equal((await syncAlert()).status,'DISMISSED');assert.ok((await syncAlert()).dismissed_at)
 await h.pool.query("UPDATE payroll_alert SET status='OPEN',dismissed_at=NULL WHERE facility_id=1 AND dedupe_key=$1",[`quickbooks-${run.id}`])

 await syncQuickbooksRun(h.pool,1,run.id,{fetcher});assert.equal(attempts.length,2)
 assert.equal((await syncAlert()).status,'DISMISSED')
 assert.equal(attempts[0].url,attempts[1].url);assert.equal(attempts[0].body,attempts[1].body)
 assert.match(attempts[0].url,/sandbox-quickbooks.api.intuit.com/)
 await h.pool.query("UPDATE payroll_alert SET status='OPEN',dismissed_at=NULL WHERE facility_id=1 AND dedupe_key=$1",[`quickbooks-${run.id}`])
 assert.ok((await runWorkforceAutomation(h.pool,1,{now:new Date('2026-09-09T12:00:00Z'),sync:false})).periods>0)
 assert.equal((await syncAlert()).status,'DISMISSED')
 await h.pool.query("UPDATE payroll_quickbooks_connection SET environment='production' WHERE facility_id=1")
 await h.pool.query("UPDATE payroll_alert SET status='OPEN',dismissed_at=NULL WHERE facility_id=1 AND dedupe_key=$1",[`quickbooks-${run.id}`])
 await runWorkforceAutomation(h.pool,1,{sync:false})
 assert.equal((await syncAlert()).status,'OPEN')

 await syncQuickbooksRun(h.pool,1,run.id,{fetcher})
 assert.equal(attempts.length,3)
 assert.match(attempts[2].url,/https:\/\/quickbooks.api.intuit.com/)
 assert.notEqual(new URL(attempts[0].url).searchParams.get('requestid'),new URL(attempts[2].url).searchParams.get('requestid'))
 assert.equal((await h.pool.query('SELECT id FROM payroll_quickbooks_sync')).rows.length,2)
 await h.pool.query("UPDATE payroll_quickbooks_connection SET environment='sandbox' WHERE facility_id=1")
 const automation=await runWorkforceAutomation(h.pool,1,{now:new Date('2026-09-09T12:00:00Z'),sync:false});assert.equal(automation.periods,0)
 assert.equal((await runWorkforceAutomation(h.pool,1,{now:new Date('2026-09-09T12:00:00Z'),sync:false})).periods,0)
 const elections={confirmed:true,sourceNote:'Verified signed 2026 W-4 and Maryland MW507 test forms',federal:{filingStatus:'SINGLE'},maryland:{filingStatus:'SINGLE',localRate:3.2,exemptions:1}}
 await api(`/employees/${e.id}/tax-elections`,{method:'PATCH',body:elections})
 await api(`/employees/${e.id}/tax-elections`,{facility:2,status:404})
 const laterPeriods=await api('/pay-periods/generate',{body:{year:2026,month:10},status:201})
 const laterPeriod=laterPeriods.find(p=>String(p.period_start).startsWith('2026-09-16'))
 for(const date of ['16','17','18','21','22','23','24','25','28','29']){
  const time=await api('/time-entries',{body:{employeeId:e.id,clockIn:`2026-09-${date}T12:00:00Z`,clockOut:`2026-09-${date}T20:00:00Z`,evidenceNote:'Verified full shift for automatic withholding test'},status:201})
  await api(`/time-entries/${time.id}/status`,{method:'PATCH',body:{status:'APPROVED'}})
 }
 await api(`/employees/${e.id}/leave-transactions`,{body:{transactionDate:'2026-09-16',minutes:2400,leaveType:'PTO',reason:'Separate PTO bank must not consume statutory sick accrual cap'},status:201})
 const automaticPreview=(await api('/runs/preview',{body:{payPeriodId:laterPeriod.id}})).preview
 assert.equal(automaticPreview.employees[0].sickLeaveAccrualMinutes,160)
 assert.equal(automaticPreview.grossPayCents,200000)
 assert.equal(automaticPreview.employerTaxCents,21700)
 assert.equal(automaticPreview.netPayCents,156069)
 const staleRun=await api('/runs',{body:{payPeriodId:laterPeriod.id},status:201})
 assert.equal(Number(staleRun.net_pay_cents),156069)
 assert.equal(Number(staleRun.employer_tax_cents),21700)
 await api(`/runs/${staleRun.id}/status`,{method:'PATCH',body:{status:'REVIEW'}})
 await api(`/employees/${e.id}/tax-elections`,{method:'PATCH',body:{...elections,federal:{filingStatus:'SINGLE',extraWithholdingCents:1000}}})
 await api(`/runs/${staleRun.id}/status`,{method:'PATCH',body:{status:'APPROVED'},status:409})
 await api(`/runs/${staleRun.id}/status`,{method:'PATCH',body:{status:'VOID'}})
 await api('/runs/preview',{body:{payPeriodId:laterPeriod.id,paymentDate:'2026-02-30'},status:400})
 const nextYear=await api('/runs/preview',{body:{payPeriodId:laterPeriod.id,paymentDate:'2027-01-04'}})
 assert.ok(nextYear.preview.warnings.some(w=>w.code==='TAX_YEAR_UNSUPPORTED'))
 const automaticRun=await api('/runs',{body:{payPeriodId:laterPeriod.id,paymentDate:'2026-10-06'},status:201})
 assert.equal(String(automaticRun.payment_date).slice(0,10),'2026-10-06')
 assert.equal(Number(automaticRun.net_pay_cents),155069)
 await api(`/runs/${automaticRun.id}/status`,{method:'PATCH',body:{status:'REVIEW'}})
 await api(`/runs/${automaticRun.id}/status`,{method:'PATCH',body:{status:'APPROVED'}})
 await api(`/runs/${automaticRun.id}/finalize`,{body:{paymentConfirmationReference:'TEST-CHECK-AUTOMATIC-TAX'},status:400})
 await api(`/runs/${automaticRun.id}/finalize`,{body:{paymentConfirmationReference:'TEST-CHECK-AUTOMATIC-TAX',paymentDate:'2026-10-05'},status:409})
 await h.pool.query("UPDATE payroll_run SET payment_date='2052-01-01' WHERE id=$1",[automaticRun.id])
 await api(`/runs/${automaticRun.id}/finalize`,{body:{paymentConfirmationReference:'TEST-FUTURE-PAYMENT',paymentDate:'2052-01-01'},status:400})
 await h.pool.query("UPDATE payroll_run SET payment_date='2026-10-06' WHERE id=$1",[automaticRun.id])
 await api('/employer-taxes',{method:'PATCH',body:{futaRatePercent:0.6,mdUiRatePercent:3.0,source:'Synthetic rate change after payroll approval',confirmed:true}})
 await api(`/runs/${automaticRun.id}/finalize`,{body:{paymentConfirmationReference:'TEST-STALE-PAYMENT',paymentDate:'2026-10-06'},status:409})
 await api('/employer-taxes',{method:'PATCH',body:{futaRatePercent:0.6,mdUiRatePercent:2.6,source:'Restored verified synthetic employer tax rates',confirmed:true}})
 await api(`/runs/${automaticRun.id}/finalize`,{body:{paymentConfirmationReference:'TEST-CHECK-AUTOMATIC-TAX',paymentDate:'2026-10-06'}})
 const actualRegister=await api('/reports/payroll-register.csv?start=2026-10-06&end=2026-10-06',{raw:true})
 assert.match(actualRegister,new RegExp(`RUN-${automaticRun.id}`))
 const scheduledRegister=await api('/reports/payroll-register.csv?start=2026-10-05&end=2026-10-05',{raw:true})
 assert.doesNotMatch(scheduledRegister,new RegExp(`RUN-${automaticRun.id}`))
 const taxLedger=await api('/tax-reconciliation?year=2026')
 const federalQ4=taxLedger.quarters[3].agencies.find(a=>a.agency==='IRS_941')
 assert.equal(federalQ4.liabilityCents,46517);assert.equal(federalQ4.balanceCents,46517)
 const depositBody={agency:'IRS_941',year:2026,quarter:4,paidOn:'2026-11-15',amountCents:10000,reference:'TEST-EFTPS-RECEIPT-001',confirmed:true}
 const deposit=await api('/tax-deposits',{body:depositBody,status:201})
 await api('/tax-deposits',{body:depositBody,status:409})
 assert.equal((await api('/tax-reconciliation?year=2026')).quarters[3].agencies[0].balanceCents,36517)
 assert.equal((await api('/tax-reconciliation?year=2026',{facility:2})).deposits.length,0)
 await api(`/tax-deposits/${deposit.id}/void`,{facility:2,body:{reason:'Incorrect test receipt reference'},status:404})
 await api(`/tax-deposits/${deposit.id}/void`,{body:{reason:'Incorrect test receipt reference'},status:201})
 assert.equal((await api('/tax-reconciliation?year=2026')).quarters[3].agencies[0].balanceCents,46517)
 await api('/tax-deposits',{body:{...depositBody,reference:'TEST-FUTURE-RECEIPT',paidOn:'2052-01-01'},status:400})
 const filingBody={formType:'IRS_941',periodStart:'2026-10-01',periodEnd:'2026-12-31',filedOn:'2027-01-31',reportedWagesCents:200000,reportedTaxCents:46517,reference:'TEST-941-ACCEPTED-001',confirmed:true}
 await api('/tax-filings',{body:{...filingBody,periodEnd:'2026-11-30'},status:400})
 const filing=await api('/tax-filings',{body:filingBody,status:201})
 assert.equal((await api('/tax-reconciliation?year=2026')).filings[0].status,'MATCHED')
 // Simulate a changed underlying payroll total to test the persisted filing snapshot comparison.
 await h.pool.query('UPDATE payroll_run_employee SET other_taxable_pay_cents=other_taxable_pay_cents+100 WHERE payroll_run_id=$1',[automaticRun.id])
 assert.equal((await api('/tax-reconciliation?year=2026')).filings[0].status,'PAYROLL_CHANGED')
 await h.pool.query('UPDATE payroll_run_employee SET other_taxable_pay_cents=other_taxable_pay_cents-100 WHERE payroll_run_id=$1',[automaticRun.id])
 await api('/tax-filings',{body:{...filingBody,reference:'TEST-941-ACCEPTED-002',reportedTaxCents:46518},status:201})
 const filingHistory=(await api('/tax-reconciliation?year=2026')).filings
 assert.equal(filingHistory[0].status,'TOTALS_DIFFER');assert.equal(filingHistory.find(f=>Number(f.id)===Number(filing.id)).status,'SUPERSEDED')
 await runWorkforceAutomation(h.pool,1,{now:new Date('2026-10-10T12:00:00Z'),sync:false})
 const taxAlert=(await h.pool.query("SELECT severity,message FROM payroll_alert WHERE facility_id=1 AND dedupe_key='tax-reconciliation-2026'")).rows[0]
 assert.equal(taxAlert.severity,'WARNING');assert.match(taxAlert.message,/1 filing comparisons need review/)
 const taxReport=await api('/reports/tax-liabilities.csv',{raw:true})
 assert.match(taxReport,/Employer FUTA,Employer Maryland UI/)
 assert.match(taxReport,/12\.00,52\.00/)
 await api('/requests',{employee:true,body:{kind:'LEAVE',payload:{startDate:'2026-02-30',endDate:'2026-03-02',minutes:60,leaveType:'UNPAID',reason:'Invalid calendar date'}},status:400})
 const paidWeekMissing=await api('/requests',{employee:true,body:{kind:'TIME_CORRECTION',payload:{entryId:null,clockIn:'2026-10-02T14:00:00Z',clockOut:'2026-10-02T17:00:00Z',unpaidBreakMinutes:0,reason:'Forgot to clock in; supervisor has attendance record'}}})
 await api(`/requests/${paidWeekMissing.id}/review`,{body:{status:'APPROVED',note:'This missing shift affects a finalized workweek'},status:409})
 assert.equal((await api(`/requests/${paidWeekMissing.id}/payroll-impact`)).status,'PAYROLL_CORRECTION_REQUIRED')
 const missing=await api('/requests',{employee:true,body:{kind:'TIME_CORRECTION',payload:{entryId:null,clockIn:'2026-10-09T14:00:00Z',clockOut:'2026-10-09T17:00:00Z',unpaidBreakMinutes:0,reason:'Forgot to clock in; supervisor has attendance record'}}})
 await api(`/requests/${missing.id}/review`,{body:{status:'APPROVED',note:'Attendance record confirms the missing shift'}})
 await api(`/requests/${missing.id}/review`,{body:{status:'APPROVED',note:'Repeat click'},status:409})
 const reconstructed=(await h.pool.query("SELECT * FROM payroll_time_entry WHERE evidence_note LIKE $1",[`Employee correction request ${missing.id}:%`])).rows
 assert.equal(reconstructed.length,1);assert.equal(reconstructed[0].status,'EMPLOYEE_ATTESTED')
 const overlap=await api('/requests',{employee:true,body:{kind:'TIME_CORRECTION',payload:{entryId:null,clockIn:'2026-10-09T16:00:00Z',clockOut:'2026-10-09T18:00:00Z',unpaidBreakMinutes:0,reason:'Overlapping missing shift request'}}})
 await api(`/requests/${overlap.id}/review`,{body:{status:'APPROVED',note:'Review overlapping time'},status:409})
 const overnight=await api('/time-entries',{body:{employeeId:e.id,clockIn:'2026-10-16T03:00:00Z',clockOut:'2026-10-16T06:00:00Z',evidenceNote:'Overnight shift across semimonthly boundary'},status:201})
 await api(`/time-entries/${overnight.id}/status`,{method:'PATCH',body:{status:'APPROVED'}})
 const november=await api('/pay-periods/generate',{body:{year:2026,month:11},status:201})
 const octoberFirst=laterPeriods.find(p=>String(p.period_start).startsWith('2026-10-01'))
 const octoberSecond=november.find(p=>String(p.period_start).startsWith('2026-10-16'))
 const firstHalf=(await api('/runs/preview',{body:{payPeriodId:octoberFirst.id}})).preview.employees[0]
 const secondHalf=(await api('/runs/preview',{body:{payPeriodId:octoberSecond.id}})).preview.employees[0]
 assert.equal(firstHalf.entries.filter(t=>Number(t.id)===Number(overnight.id)).reduce((n,t)=>n+t.minutes,0),60)
 assert.equal(secondHalf.entries.filter(t=>Number(t.id)===Number(overnight.id)).reduce((n,t)=>n+t.minutes,0),120)
 await api(`/employees/${e.id}/leave-transactions`,{body:{leaveType:'PTO',transactionDate:'2026-10-01',minutes:480,reason:'Verified PTO opening balance'},status:201})
 const multiLeave=await api('/requests',{employee:true,body:{kind:'LEAVE',payload:{startDate:'2026-10-15',endDate:'2026-10-16',minutes:120,days:[{date:'2026-10-15',minutes:60},{date:'2026-10-16',minutes:60}],leaveType:'PTO',reason:'Paid time off spanning two pay periods'}}})
 await api(`/requests/${multiLeave.id}/review`,{body:{status:'APPROVED',note:'Verified one paid hour on each requested date'}})
 await api(`/requests/${multiLeave.id}/review`,{body:{status:'APPROVED',note:'Duplicate review'},status:409})
 assert.equal((await h.pool.query('SELECT id FROM payroll_paid_leave WHERE request_id=$1',[multiLeave.id])).rows.length,2)
 assert.equal((await api('/runs/preview',{body:{payPeriodId:octoberFirst.id}})).preview.employees[0].paidLeaveMinutes,60)
 assert.equal((await api('/runs/preview',{body:{payPeriodId:octoberSecond.id}})).preview.employees[0].paidLeaveMinutes,60)
 await api('/time-entries',{body:{employeeId:e.id,clockIn:'2026-09-14T14:00:00Z',clockOut:'2026-09-14T16:00:00Z',evidenceNote:'Attempt to insert into finalized payroll'},status:409})
 const concurrent=await Promise.all([14,15].map(hour=>fetch(`${h.url}/api/admin/payroll/time-entries`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer payroll-test-admin'},body:JSON.stringify({employeeId:e.id,clockIn:`2026-10-03T${hour}:00:00Z`,clockOut:`2026-10-03T${hour+3}:00:00Z`,evidenceNote:'Concurrent overlapping time-entry test'})})))
 assert.deepEqual(concurrent.map(r=>r.status).sort(),[201,409])
 const expiredTokens=encryptDocument(Buffer.from(JSON.stringify({access_token:'expired-test-token',refresh_token:'test-refresh-token',expiresAt:0})),'quickbooks:1')
 await h.pool.query('UPDATE payroll_quickbooks_connection SET encrypted_tokens=$1 WHERE facility_id=1',[expiredTokens])
 const refreshed=[]
 const refreshFetcher=async(url,options)=>{
  refreshed.push(url)
  if(url.includes('/tokens/bearer'))return {ok:true,json:async()=>({access_token:'refreshed-test-access',refresh_token:'rotated-test-refresh',expires_in:3600})}
  assert.equal(options.headers.Authorization,'Bearer refreshed-test-access')
  assert.equal(JSON.parse(options.body).TxnDate,'2026-10-06')
  return {ok:true,status:200,json:async()=>({JournalEntry:{Id:'refreshed-journal'}})}
 }
 assert.equal((await syncQuickbooksRun(h.pool,1,automaticRun.id,{fetcher:refreshFetcher})).external_id,'refreshed-journal')
 assert.equal(refreshed.length,2)
 const statements=(await api('/me',{employee:true})).payStatements
 const statement=statements.find(s=>Number(s.payroll_run_id)===Number(automaticRun.id))
 assert.equal(String(statement.pay_date).slice(0,10),'2026-10-06')
 assert.equal(statement.statement_snapshot.employer.phone,'555-010-1234')
 assert.equal(statement.statement_snapshot.workweekPaymentVersion,1)
 assert.equal(statement.statement_snapshot.workweekPayments.reduce((n,w)=>n+w.straightTimePayCents+w.premiumCents,0),Number(statement.regular_pay_cents)+Number(statement.overtime_pay_cents))
 assert.match(await api(`/pay-statements/${statement.id}.pdf`,{employee:true,raw:true}),/^%PDF-/)
 const other=await api('/employees',{body:{employeeNumber:'OTHER-TEST',legalFirstName:'Different',legalLastName:'Employee',jobTitle:'Instructor',hireDate:'2026-09-01',hourlyRateCents:2500,personalEmail:'other@example.test'},status:201})
 const otherInvite=await api(`/employees/${other.id}/invitations`,{body:{email:'other@example.test',sendEmail:false},status:201})
 const otherSession=await api('/invitations/redeem',{employee:true,body:{token:new URL(otherInvite.inviteUrl).searchParams.get('invite')}})
 const forbidden=await fetch(`${h.url}/api/payroll/employee/pay-statements/${statement.id}.pdf`,{headers:{Authorization:`Bearer ${otherSession.sessionToken}`}})
 assert.equal(forbidden.status,404)
 for(const payload of [{amountCents:1234,receiptReference:''},{amountCents:1234,receiptReference:{}},{amountCents:9007199254740992,receiptReference:'TEST-RECEIPT'}])await api('/requests',{employee:true,body:{kind:'EXPENSE',payload:{...payload,reason:'Travel supplies'}},status:400})
 for(const activeTo of ['2026-02-30','2025-12-31'])await api(`/employees/${e.id}/adjustments`,{body:{name:'Invalid date adjustment',kind:'REIMBURSEMENT',amountCents:100,activeFrom:'2026-01-01',activeTo},status:400})
 const expense=await api('/requests',{employee:true,body:{kind:'EXPENSE',payload:{amountCents:1234,receiptReference:'TEST-RECEIPT',reason:'Travel supplies'}}})
 await h.pool.query("UPDATE payroll_employee_request SET payload=jsonb_set(payload,'{receiptReference}','\"\"'::jsonb) WHERE id=$1",[expense.id])
 await api(`/requests/${expense.id}/review`,{body:{status:'APPROVED',note:'Receipt verified',taxTreatmentVerified:true},status:400})
 assert.equal((await h.pool.query('SELECT status FROM payroll_employee_request WHERE id=$1',[expense.id])).rows[0].status,'PENDING')
 await h.pool.query("UPDATE payroll_employee_request SET payload=jsonb_set(payload,'{receiptReference}','\"TEST-RECEIPT\"'::jsonb) WHERE id=$1",[expense.id])
 await api(`/requests/${expense.id}/review`,{body:{status:'APPROVED',note:'Receipt verified',taxTreatmentVerified:true}})
 await api(`/requests/${expense.id}/review`,{body:{status:'APPROVED',note:'Receipt verified',taxTreatmentVerified:true},status:409})
 assert.equal(Number((await h.pool.query('SELECT amount_cents FROM payroll_recurring_adjustment WHERE source_request_id=$1',[expense.id])).rows[0].amount_cents),1234)
 await api(`/employees/${e.id}`,{method:'PATCH',body:{employmentStatus:'TERMINATED'}})
 assert.equal((await api('/me',{employee:true})).employee.employmentStatus,'TERMINATED')
 const beforeBoot=(await h.pool.query('SELECT COUNT(*)::int AS employees FROM payroll_employee')).rows[0].employees
 await h.pool.query("INSERT INTO facility(id,timezone) VALUES (4,'America/New_York')")
 await Promise.all([initPayrollTables(h.pool),initPayrollTables(h.pool)])
 assert.equal((await h.pool.query('SELECT COUNT(*)::int AS employees FROM payroll_employee')).rows[0].employees,beforeBoot)
 assert.equal((await h.pool.query('SELECT legal_business_name FROM payroll_settings WHERE facility_id=4')).rows[0].legal_business_name,'')
 assert.equal(Number((await h.pool.query('SELECT hourly_rate_cents FROM payroll_employee WHERE id=$1',[e.id])).rows[0].hourly_rate_cents),2500)
 await api('/clock',{employee:true,body:{action:'IN'},status:403})
 await api('/requests',{employee:true,body:{kind:'LEAVE',payload:{reason:'Leave after termination'}},status:403})
 assert.match(await api(`/pay-statements/${statement.id}.pdf`,{employee:true,raw:true}),/^%PDF-/)
 await api('/logout',{employee:true,body:{}})
 token=(await api('/login',{employee:true,body:{email:'jordan@example.test',password:'Test-Employee-Password-2026',facilityId:1}})).sessionToken
 assert.equal((await api('/me',{employee:true})).employee.employmentStatus,'TERMINATED')

})
