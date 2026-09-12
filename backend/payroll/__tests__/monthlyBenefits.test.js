import {hashPayrollToken} from '../employeeAuth.js'
import {benefitContributionReport} from '../benefitContributionReport.js'
import {runWorkforceAutomation} from '../workforceAutomation.js'
import {randomBytes} from 'node:crypto'
import {journalPayload,syncQuickbooksRun} from '../quickbooks.js'
import {encryptDocument} from '../onboarding.js'
import {priorMonthlyBenefitCollection} from '../monthlyBenefits.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {createHarness} from '../testing/harness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
import {statementLines} from '../payStatement.js'
test('authorized monthly benefits collect once, stale another draft, recur next month and appear on statements',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close());const {api,periods}=await monthlyBenefitsFixture(h)
 const preview=async p=>(await api('/runs/preview',{payPeriodId:p.id})).preview
 const first=await preview(periods[0]);assert.equal(first.canApprove,true,JSON.stringify(first.warnings));assert.equal(first.deductionCents,12500);assert.equal(first.employees[0].netPayCents,5970)
 const draftA=await api('/runs',{payPeriodId:periods[0].id},'POST',201),draftB=await api('/runs',{payPeriodId:periods[1].id},'POST',201)
 const finish=async(run,p)=>{await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH');await api(`/runs/${run.id}/finalize`,{paymentDate:new Date(p.pay_date).toISOString().slice(0,10),paymentConfirmationReference:'SYNTHETIC-MONTHLY-BENEFIT-PAYMENT'})}
 await finish(draftA,periods[0])
 const paid=(await h.pool.query('SELECT * FROM payroll_run_employee WHERE payroll_run_id=$1',[draftA.id])).rows[0]
 assert.equal(Number(paid.posttax_deduction_cents),12500);assert.ok(statementLines(paid).lines.some(l=>l[1]==='2026-09 monthly benefit contribution'&&l[2]===-12500))
 const proof=(await h.pool.query('SELECT r.id,r.status,r.run_kind,r.payment_date,r.calculation_snapshot,re.posttax_deduction_cents FROM payroll_run r JOIN payroll_run_employee re ON re.payroll_run_id=r.id WHERE r.id=$1',[draftA.id])).rows[0]
 assert.throws(()=>priorMonthlyBenefitCollection([{...proof,posttax_deduction_cents:12501}],paid.employee_id,'2026-09'),/do not reconcile/)
 assert.throws(()=>priorMonthlyBenefitCollection([proof,proof],paid.employee_id,'2026-09'),/More than one/)
 const withRoth=structuredClone(proof),retirementEmployee=withRoth.calculation_snapshot.employees[0]
 retirementEmployee.retirement401k={pretaxCents:0,rothCents:2000};retirementEmployee.retirementPlans=[{planId:'standard',calculation:{planName:'Synthetic standard 401k',requiresPayrollIntegration:false,ordinary:{pretax:0,roth:1500},catchUp:{pretax:0,roth:500},pretaxCents:0,rothCents:2000,totalCents:2000}}]
 retirementEmployee.payItems.push({kind:'RETIREMENT_401K_ROTH',amountCents:2000});retirementEmployee.posttaxDeductionCents+=2000;retirementEmployee.totalDeductionCents+=2000;withRoth.posttax_deduction_cents=14500
 assert.equal(priorMonthlyBenefitCollection([withRoth],paid.employee_id,'2026-09').monthlyCents,12500)
 for(const mutate of [r=>r.posttax_deduction_cents=14501,r=>delete r.calculation_snapshot.employees[0].retirementPlans,r=>r.calculation_snapshot.employees[0].retirementPlans[0].calculation.ordinary.roth++]){const bad=structuredClone(withRoth);mutate(bad);assert.throws(()=>priorMonthlyBenefitCollection([bad],paid.employee_id,'2026-09'))}
 const next=await preview(periods[1]);assert.equal(next.deductionCents,0);assert.equal(next.employees[0].benefitCollection.status,'ALREADY_COLLECTED');assert.equal(next.employees[0].netPayCents,18470)
 await api(`/runs/${draftB.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${draftB.id}/status`,{status:'APPROVED'},'PATCH',409)
 await api(`/runs/${draftB.id}/status`,{status:'VOID'},'PATCH')
 const replacement=await api('/runs',{payPeriodId:periods[1].id},'POST',201);await finish(replacement,periods[1])
 const third=await preview(periods[2]);assert.equal(third.deductionCents,12500);assert.equal(third.employees[0].benefitCollection.month,'2026-10')
 const final=await api('/runs',{payPeriodId:periods[2].id},'POST',201);await finish(final,periods[2])
 assert.deepEqual((await h.pool.query('SELECT posttax_deduction_cents::int amount FROM payroll_run_employee re JOIN payroll_run r ON r.id=re.payroll_run_id WHERE r.status=\'FINALIZED\' ORDER BY r.id')).rows.map(r=>r.amount),[12500,0,12500])
 const report=await benefitContributionReport(h.pool,1,'2026-09-01','2026-10-31');assert.equal(report.length,3);assert.deepEqual(report.slice(1).map(row=>[row[1],row[8]]),[['2026-09','125.00'],['2026-10','125.00']])
 assert.equal((await benefitContributionReport(h.pool,1,'2026-09-19','2026-09-30')).length,1)
 assert.equal((await benefitContributionReport(h.pool,2,'2026-09-01','2026-10-31')).length,1)
 const historyUrl=`${h.url}/api/payroll/employee/benefit-contributions?start=2026-09-01&end=2026-10-31&employeeId=999999&facilityId=2`
 const historyResponse=await fetch(historyUrl,{headers:{Authorization:'Bearer monthly-benefits-session'}})
 assert.equal(historyResponse.status,200);assert.equal(historyResponse.headers.get('cache-control'),'no-store')
 const history=(await historyResponse.json()).data.contributions
 assert.deepEqual(history.map(row=>row.amountCents),[12500,12500])
 assert.deepEqual(Object.keys(history[0]).sort(),['amountCents','month','optionLabel','paymentDate','planName','runId','taxTreatment'].sort())
 assert.equal((await fetch(historyUrl)).status,401)
 assert.equal((await fetch(`${h.url}/api/payroll/employee/benefit-contributions?start=2026-02-30&end=2026-10-31`,{headers:{Authorization:'Bearer monthly-benefits-session'}})).status,400)
 const other=await api('/employees',{employeeNumber:'OTHER-BENEFIT-HISTORY',legalFirstName:'Other',legalLastName:'Employee',hireDate:'2026-09-01',hourlyRateCents:2500},'POST',201)
 await h.pool.query("INSERT INTO payroll_employee_session(facility_id,employee_id,token_hash,expires_at) VALUES(1,$1,$2,now()+interval '1 day')",[other.id,hashPayrollToken('other-benefit-history-session')])
 const otherResponse=await fetch(historyUrl,{headers:{Authorization:'Bearer other-benefit-history-session'}})
 assert.equal(otherResponse.status,200);assert.deepEqual((await otherResponse.json()).data.contributions,[])
 await h.pool.query('UPDATE payroll_run_employee SET posttax_deduction_cents=12501 WHERE payroll_run_id=$1',[draftA.id])
 await assert.rejects(benefitContributionReport(h.pool,1,'2026-09-19','2026-09-30'),/reconciliation/)
 const inconsistent=await fetch(historyUrl,{headers:{Authorization:'Bearer monthly-benefits-session'}});assert.equal(inconsistent.status,409);assert.equal((await inconsistent.json()).message,'Your benefit contributions need payroll review. Contact your hiring administrator.')
 await h.pool.query('UPDATE payroll_run_employee SET posttax_deduction_cents=12500 WHERE payroll_run_id=$1',[draftA.id])
 await h.pool.query("UPDATE payroll_employee SET employment_status='TERMINATED' WHERE id=$1",[paid.employee_id])
 assert.equal((await fetch(historyUrl,{headers:{Authorization:'Bearer monthly-benefits-session'}})).status,200)
 await h.pool.query('UPDATE payroll_employee_session SET revoked_at=now() WHERE employee_id=$1',[paid.employee_id])
 assert.equal((await fetch(historyUrl,{headers:{Authorization:'Bearer monthly-benefits-session'}})).status,401)


})
test('monthly deductions skip zero wages and cannot be funded by reimbursements',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close());const {api,employee,periods}=await monthlyBenefitsFixture(h)
 const preview=async()=>(await api('/runs/preview',{payPeriodId:periods[0].id})).preview
 await h.pool.query("UPDATE payroll_time_entry SET status='REJECTED' WHERE employee_id=$1 AND clock_in::date='2026-09-10'",[employee.id])
 let result=await preview();assert.equal(result.deductionCents,0);assert.equal(result.employees[0].benefitCollection.status,'NO_WAGES')
 const saved=(await h.pool.query("SELECT id,response FROM payroll_onboarding_task WHERE employee_id=$1 AND task_key='PAY_REVIEW'",[employee.id])).rows[0]
 await h.pool.query("UPDATE payroll_onboarding_task SET response=response-'benefitsDeductionAuthorization' WHERE id=$1",[saved.id])
 result=await preview();assert.equal(result.deductionCents,0);assert.ok(!result.warnings.some(w=>w.code==='BENEFIT_DEDUCTION_REVIEW'))
 await h.pool.query('UPDATE payroll_onboarding_task SET response=$2 WHERE id=$1',[saved.id,saved.response])
 await h.pool.query("UPDATE payroll_time_entry SET status='APPROVED',clock_out='2026-09-10T13:00Z' WHERE employee_id=$1 AND clock_in::date='2026-09-10'",[employee.id])
 await api(`/employees/${employee.id}/adjustments`,{kind:'REIMBURSEMENT',name:'Synthetic expense reimbursement',amountCents:20000,activeFrom:'2026-09-01',activeTo:'2026-09-15',status:'ACTIVE',authorizationReference:'Synthetic verified business expense',taxTreatmentVerified:true},'POST',201)
 result=await preview();assert.equal(result.canApprove,false);assert.ok(result.employees[0].netPayCents>0);assert.ok(result.warnings.some(w=>w.code==='BENEFIT_DEDUCTION_REVIEW'&&w.message.includes('Reimbursements cannot fund')))
})
test('pretax and missing benefit authorizations block automatic collection',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close());const {api,employee,periods}=await monthlyBenefitsFixture(h,{taxTreatment:'PRETAX'})
 const preview=async()=>(await api('/runs/preview',{payPeriodId:periods[0].id})).preview
 let result=await preview();assert.equal(result.canApprove,false);assert.equal(result.deductionCents,0);assert.ok(result.warnings.some(w=>w.message.includes('Pretax benefit deductions')))
 await h.pool.query("UPDATE payroll_onboarding_task SET response=response-'benefitsDeductionAuthorization' WHERE employee_id=$1 AND task_key='PAY_REVIEW'",[employee.id])
 result=await preview();assert.equal(result.canApprove,false);assert.ok(result.warnings.some(w=>w.message.includes('current signed benefit deduction authorization')))
})
test('concurrent payroll approvals reserve a monthly contribution once and void releases it',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close());const {api,periods}=await monthlyBenefitsFixture(h)
 const runs=[]
 for(const p of periods.slice(0,2)){const run=await api('/runs',{payPeriodId:p.id},'POST',201);await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');runs.push(run)}
 const outcomes=await Promise.all(runs.map(run=>fetch(`${h.url}/api/admin/payroll/runs/${run.id}/status`,{method:'PATCH',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({status:'APPROVED'})})))
 assert.deepEqual(outcomes.map(r=>r.status).sort(),[200,409])
 const winner=outcomes.findIndex(r=>r.status===200),other=1-winner
 assert.equal((await h.pool.query("SELECT count(*)::int n FROM payroll_run WHERE status='APPROVED'")).rows[0].n,1)
 await api(`/runs/${runs[winner].id}/status`,{status:'VOID'},'PATCH')
 await api(`/runs/${runs[other].id}/status`,{status:'APPROVED'},'PATCH')
 await api(`/runs/${runs[other].id}/finalize`,{paymentDate:new Date(periods[other].pay_date).toISOString().slice(0,10),paymentConfirmationReference:'SYNTHETIC-SINGLE-MONTHLY-COLLECTION'})
 assert.equal((await h.pool.query("SELECT sum(re.posttax_deduction_cents)::int amount FROM payroll_run_employee re JOIN payroll_run r ON r.id=re.payroll_run_id WHERE r.status='FINALIZED'")).rows[0].amount,12500)
})

test('benefit deductions reconcile into private plan-level QuickBooks lines and immutable retries',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close());const {api,employee,periods}=await monthlyBenefitsFixture(h)
 await api(`/employees/${employee.id}/adjustments`,{kind:'POSTTAX_DEDUCTION',name:'Separate authorized deduction',amountCents:500,activeFrom:'2026-09-01',activeTo:'2026-09-15',status:'ACTIVE',authorizationReference:'Synthetic separate signed authorization',taxTreatmentVerified:true},'POST',201)
 const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201)
 await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH')
 await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-BENEFIT-JOURNAL'})
 const saved=(await h.pool.query('SELECT *,payment_date AS pay_date FROM payroll_run WHERE id=$1',[run.id])).rows[0]
 const accounts={wages:'1',employerTax:'2',reimbursements:'3',taxLiability:'4',deductions:'5',clearing:'6'}
 const payload=journalPayload(saved,accounts),deductions=payload.Line.filter(l=>l.JournalEntryLineDetail.AccountRef.value==='5')
 assert.deepEqual(deductions.map(l=>l.Amount),[5,125]);assert.equal(deductions[1].Description,'2026-09 benefit contribution: Medical — Family')
 assert.equal(payload.Line.reduce((n,l)=>n+Math.round(l.Amount*100)*(l.JournalEntryLineDetail.PostingType==='Debit'?1:-1),0),0)
 assert.ok(!JSON.stringify(payload).includes('Monthly Benefits'));assert.ok(!JSON.stringify(payload).includes('signature'));assert.ok(!JSON.stringify(payload).includes('authorization'))
 assert.throws(()=>journalPayload({...saved,deduction_cents:12999},accounts),/do not reconcile/)
 await api('/accounting-mapping',{wagesExpenseAccount:'Wages',employerTaxExpenseAccount:'Employer taxes',reimbursementExpenseAccount:'Expenses',taxLiabilityAccount:'Tax liability',deductionLiabilityAccount:'Deductions',payrollClearingAccount:'Payroll clearing',verifiedByBookkeeper:true},'PATCH')
 const exportCsv=()=>fetch(`${h.url}/api/admin/payroll/reports/quickbooks.csv?runId=${run.id}`,{headers:{Authorization:'Bearer payroll-test-admin'}})
 const exported=await exportCsv();assert.equal(exported.status,200);const csv=await exported.text()
 const lines=csv.trim().split('\r\n').slice(1).map(line=>line.split(','))
 assert.equal(lines.length,payload.Line.length);assert.deepEqual(lines.map(line=>Math.round(Number(line[3]||line[4])*100)),payload.Line.map(line=>Math.round(line.Amount*100)))
 assert.ok(lines.some(line=>line[2]==='Deductions'&&line[4]==='125.00'&&line[5]==='2026-09 benefit contribution: Medical — Family'))
 assert.equal(lines.reduce((n,line)=>n+Math.round(Number(line[3])*100)-Math.round(Number(line[4])*100),0),0)
 await h.pool.query('UPDATE payroll_run SET net_pay_cents=net_pay_cents+1 WHERE id=$1',[run.id]);assert.equal((await exportCsv()).status,409)
 await h.pool.query('UPDATE payroll_run SET net_pay_cents=net_pay_cents-1 WHERE id=$1',[run.id])
 assert.equal((await h.pool.query('SELECT count(*)::int n FROM payroll_export_log WHERE payroll_run_id=$1',[run.id])).rows[0].n,1)

 const bad=structuredClone(saved);bad.calculation_snapshot.employees[0].benefitCollection.authorization.signature=''
 assert.throws(()=>journalPayload(bad,accounts),/retained signed/)
 const oldKey=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 t.after(()=>{if(oldKey===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=oldKey})
 const encrypted=encryptDocument(Buffer.from(JSON.stringify({access_token:'test-access-token',refresh_token:'test-refresh-token',expiresAt:Date.now()+3600000})),'quickbooks:1')
 await h.pool.query("INSERT INTO payroll_quickbooks_connection (facility_id,realm_id,encrypted_tokens,environment,account_ids) VALUES (1,'123',$1,'sandbox',$2)",[encrypted,accounts])
 const attempts=[],fetcher=async(url,options)=>{attempts.push({url,body:options.body});if(attempts.length===1)throw new Error('Synthetic uncertain send');return {ok:true,status:200,json:async()=>({JournalEntry:{Id:'synthetic-benefit-journal'}})}}
 await h.pool.query('UPDATE payroll_run_employee SET posttax_deduction_cents=13001 WHERE payroll_run_id=$1',[run.id])
 await assert.rejects(syncQuickbooksRun(h.pool,1,run.id,{fetcher}),/Posted benefit deductions/);assert.equal(attempts.length,0)
 assert.equal((await exportCsv()).status,409)
 await h.pool.query('UPDATE payroll_run_employee SET posttax_deduction_cents=13000 WHERE payroll_run_id=$1',[run.id])
 await assert.rejects(syncQuickbooksRun(h.pool,1,run.id,{fetcher}),/Synthetic uncertain/)
 await h.pool.query("UPDATE payroll_quickbooks_connection SET account_ids=$1 WHERE facility_id=1",[{...accounts,deductions:'99'}])
 assert.equal((await syncQuickbooksRun(h.pool,1,run.id,{fetcher})).external_id,'synthetic-benefit-journal')
 await syncQuickbooksRun(h.pool,1,run.id,{fetcher});assert.equal(attempts.length,2);assert.deepEqual(attempts[0],attempts[1]);assert.deepEqual(JSON.parse(attempts[1].body),payload)
 const job=(await h.pool.query('SELECT id FROM payroll_quickbooks_sync WHERE payroll_run_id=$1',[run.id])).rows[0]
 await h.pool.query("UPDATE payroll_quickbooks_connection SET realm_id='999' WHERE facility_id=1")
 await assert.rejects(syncQuickbooksRun(h.pool,1,run.id,{fetcher,expectedJobId:job.id}),/different QuickBooks destination/);assert.equal(attempts.length,2)
 await h.pool.query('UPDATE payroll_quickbooks_connection SET auto_sync=true WHERE facility_id=1')
 const sweep=await runWorkforceAutomation(h.pool,1,{quickbooksFetcher:fetcher});assert.equal(sweep.syncs,0);assert.equal(attempts.length,2)
 assert.equal((await h.pool.query("SELECT status FROM payroll_alert WHERE dedupe_key=$1",[`quickbooks-${run.id}`])).rows[0].status,'OPEN')
 await assert.rejects(syncQuickbooksRun(h.pool,1,run.id,{fetcher,automatic:true,expectedDestination:{realm_id:'123',environment:'sandbox'}}),/destination changed/);assert.equal(attempts.length,2)
 assert.equal((await h.pool.query('SELECT count(*)::int n FROM payroll_quickbooks_sync WHERE payroll_run_id=$1',[run.id])).rows[0].n,1)
 await h.pool.query("UPDATE payroll_quickbooks_connection SET realm_id='123' WHERE facility_id=1")
 assert.equal((await api(`/quickbooks/jobs/${job.id}/retry`,{})).external_id,'synthetic-benefit-journal');assert.equal(attempts.length,2)
 assert.equal((await runWorkforceAutomation(h.pool,1,{quickbooksFetcher:fetcher})).syncs,0);assert.equal(attempts.length,2)
 assert.equal((await h.pool.query("SELECT status FROM payroll_alert WHERE dedupe_key=$1",[`quickbooks-${run.id}`])).rows[0].status,'DISMISSED')
 await assert.rejects(syncQuickbooksRun(h.pool,2,run.id,{fetcher}),/Connect QuickBooks/);assert.equal(attempts.length,2)
})

test('foreign destination history cannot starve automatic sync of new payroll',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close());const {periods}=await monthlyBenefitsFixture(h)
 const oldKey=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex');t.after(()=>{if(oldKey===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=oldKey})
 const encrypted=encryptDocument(Buffer.from(JSON.stringify({access_token:'synthetic',refresh_token:'synthetic',expiresAt:Date.now()+3600000})),'quickbooks:1')
 await h.pool.query("INSERT INTO payroll_quickbooks_connection (facility_id,realm_id,encrypted_tokens,environment,account_ids,auto_sync) VALUES (1,'999',$1,'sandbox',$2,true)",[encrypted,{wages:'1',clearing:'6'}])
 const insert=async()=>(await h.pool.query("INSERT INTO payroll_run(facility_id,pay_period_id,status,gross_pay_cents,net_pay_cents) VALUES(1,$1,'FINALIZED',100,100) RETURNING id",[periods[0].id])).rows[0].id
 for(let i=0;i<11;i++){const id=await insert();await h.pool.query("INSERT INTO payroll_quickbooks_sync(facility_id,payroll_run_id,realm_id,request_id,payload,environment,status) VALUES(1,$1,'123',$2,'{}','sandbox','FAILED')",[id,`synthetic-foreign-${i}`])}
 const fresh=await insert(),sent=[]
 const sweep=await runWorkforceAutomation(h.pool,1,{quickbooksFetcher:async(url,options)=>{sent.push({url,payload:JSON.parse(options.body)});return {ok:true,status:200,json:async()=>({JournalEntry:{Id:'synthetic-fresh'}})}}})
 assert.equal(sweep.syncs,1);assert.equal(sent.length,1);assert.match(sent[0].url,/company\/999\//);assert.equal(sent[0].payload.DocNumber,`VTX-PAY-${fresh}`)
 assert.equal((await h.pool.query("SELECT count(*)::int n FROM payroll_alert WHERE status='OPEN' AND title='QuickBooks destination needs review'")).rows[0].n,11)
 const repeated=await runWorkforceAutomation(h.pool,1,{quickbooksFetcher:async()=>{throw new Error('Unexpected resend')}});assert.equal(repeated.syncs,0)
 assert.equal((await h.pool.query("SELECT count(*)::int n FROM payroll_quickbooks_sync WHERE realm_id='999'")).rows[0].n,1)
})

test('an employee waiver cannot silently stop a prior authorized contribution before current admin review',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close());const {api,employee,periods}=await monthlyBenefitsFixture(h)
 let packet=await api('/onboarding',undefined,'GET',200,true)
 packet=await api('/benefits-election',{choice:'WAIVE',signature:'Monthly Benefits',confirmed:true,displayedTerms:packet.policy.benefitsText,requestKey:'monthly-benefit-waiver-review',selections:[{planId:'medical',optionId:'WAIVE'}],onboardingCycle:1},'POST',200,true)
 const preview=async()=>(await api('/runs/preview',{payPeriodId:periods[0].id})).preview
 let result=await preview();assert.equal(result.canApprove,false);assert.equal(result.deductionCents,0);assert.ok(result.warnings.some(w=>w.code==='BENEFIT_DEDUCTION_REVIEW'&&w.message.includes('changed benefit election')))
 const stale=await api('/runs',{payPeriodId:periods[0].id},'POST',201);await api(`/runs/${stale.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${stale.id}/status`,{status:'APPROVED'},'PATCH',409)
 const task=packet.tasks.find(t=>t.task_key==='PAY_REVIEW')
 await api(`/employees/${employee.id}/onboarding/${task.id}/review`,{status:'COMPLETE',note:'Reviewed requested waiver and current coverage outcome',paySetupFingerprint:packet.paySetup.fingerprint,benefitsReview:{disposition:'WAIVED',effectiveOn:'2026-09-10',summary:'Reviewed employee waiver effective before this payment.',evidenceReference:'Synthetic verified coverage waiver confirmation',confirmed:true}})
 result=await preview();assert.equal(result.canApprove,true,JSON.stringify(result.warnings));assert.equal(result.deductionCents,0)
 assert.equal(result.employees[0].benefitCollection.status,'REVIEWED_NO_CONTRIBUTION');assert.equal(result.employees[0].benefitCollection.review.disposition,'WAIVED')
 await api(`/runs/${stale.id}/status`,{status:'APPROVED'},'PATCH',409)
 await api(`/runs/${stale.id}/status`,{status:'VOID'},'PATCH')
 const fresh=await api('/runs',{payPeriodId:periods[0].id},'POST',201);await api(`/runs/${fresh.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${fresh.id}/status`,{status:'APPROVED'},'PATCH')
 assert.equal((await api('/onboarding',undefined,'GET',200,true)).benefitsDeduction.saved.signature,'Monthly Benefits')
})

test('future reviewed coverage changes preserve the signed earlier coverage for earlier payments',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness();t.after(()=>h.close());const {api,employee,periods}=await monthlyBenefitsFixture(h)
 let packet=await api('/onboarding',undefined,'GET',200,true)
 packet=await api('/benefits-election',{choice:'WAIVE',signature:'Monthly Benefits',confirmed:true,displayedTerms:packet.policy.benefitsText,requestKey:'future-monthly-benefit-waiver',selections:[{planId:'medical',optionId:'WAIVE'}],onboardingCycle:1},'POST',200,true)
 const task=packet.tasks.find(t=>t.task_key==='PAY_REVIEW')
 await api(`/employees/${employee.id}/onboarding/${task.id}/review`,{status:'COMPLETE',note:'Verified future coverage ending after the earlier payday',paySetupFingerprint:packet.paySetup.fingerprint,benefitsReview:{disposition:'WAIVED',effectiveOn:'2026-09-20',summary:'Coverage waiver starts after the September 18 payment.',evidenceReference:'Synthetic future carrier coverage confirmation',confirmed:true}})
 const preview=async period=>(await api('/runs/preview',{payPeriodId:period.id})).preview
 let first=await preview(periods[0]);assert.equal(first.canApprove,true,JSON.stringify(first.warnings));assert.equal(first.deductionCents,12500)
 const collection=first.employees[0].benefitCollection;assert.equal(collection.datedCoverage.changeEffectiveOn,'2026-09-20');assert.ok(collection.datedCoverage.revisionId>0);assert.equal(collection.authorization.proposal.monthlyCents,12500)
 const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201);await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH');await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-PRIOR-COVERAGE-PAYMENT'})
 const later=await preview(periods[1]);assert.equal(later.canApprove,true,JSON.stringify(later.warnings));assert.equal(later.deductionCents,0);assert.equal(later.employees[0].benefitCollection.review.disposition,'WAIVED')
 const report=await benefitContributionReport(h.pool,1,'2026-09-01','2026-09-30');assert.equal(report.length,2);assert.equal(report[1][8],'125.00')
 // Preview now uses a repeatable-read client; inject read faults at that
 // client boundary while preserving the immutable database history.
 const connect=h.pool.connect.bind(h.pool)
 for(const transform of [result=>{for(const row of result.rows){const saved=row.snapshot.response?.benefitsDeductionAuthorization;if(saved)saved.proposal.monthlyCents++}return result},()=>({rows:[]})]){
  h.pool.connect=async()=>{const client=await connect(),query=client.query,release=client.release;client.query=async function(sql,...args){const result=await query.call(this,sql,...args);return String(sql).startsWith('SELECT id,snapshot FROM payroll_onboarding_revision')?transform(result):result};client.release=function(...args){client.query=query;client.release=release;return release.apply(this,args)};return client}
  try{first=await preview(periods[0]);assert.equal(first.canApprove,false);assert.ok(first.warnings.some(w=>w.code==='BENEFIT_DEDUCTION_REVIEW'))}finally{h.pool.connect=connect}
 }
})
