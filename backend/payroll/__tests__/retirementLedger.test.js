import {retirementAnnualReporting} from '../retirementAnnualReporting.js'
import {retirementW2Codes} from '../retirementW2Codes.js'
import {verifyRetirementAnnualApproval} from '../testing/retirementAnnualApproval.js'
import {retirementStatementSummary} from '../retirementStatement.js'
import {verifyRetirementPosting} from '../retirementJournal.js'
import {retirementEmployeePayroll} from '../retirementEmployeePayroll.js'
import {buildEmployeePreview} from '../payrollEngine.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {retirementPlanFixture} from '../testing/retirementPlanFixture.js'
import {retirementAnnualFixture} from '../testing/retirementAnnualFixture.js'
import {hashPayrollToken} from '../employeeAuth.js'
import {retirementPayrollSource} from '../retirementPayrollSource.js'
import {retirementPayrollCalculation} from '../retirementPayrollCalculation.js'
import {retirementInternalBalances,retainRetirementRunLedger} from '../retirementLedger.js'
test('retirement ledger serializes approved reservations, rejects stale capacity and preserves voided history',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const now=()=>new Date('2026-09-11T12:00:00Z'),h=await createHarness({payrollNow:now,retirementNow:now});t.after(()=>h.close())
 const api=async(path,body,employee=false)=>{const r=await fetch(`${h.url}/api/${employee?'payroll/employee':'admin/payroll'}${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${employee?'retirement-ledger-session':'payroll-test-admin'}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const json=await r.json();assert.ok(r.ok,JSON.stringify(json));return json.data}
 const e=await api('/employees',{employeeNumber:'LEDGER',legalFirstName:'Synthetic',legalLastName:'Employee',hireDate:'2026-09-01',hourlyRateCents:2500})
 await api('/retirement-plans',{plan:{...retirementPlanFixture(),compensation:{...retirementPlanFixture().compensation,BONUS:true}},expectedRevision:0,requestKey:randomUUID()})
 await assert.rejects(retirementPayrollSource(h.pool,1,e.id,'standard','2026-09-15'),/annual sources/)
 const annualPath=`/employees/${e.id}/retirement-annual-sources/standard`,annualSource=await api(annualPath)
 await api(annualPath,{planRevisionId:annualSource.planRevisionId,expectedRevision:0,requestKey:randomUUID(),facts:retirementAnnualFixture()})
 await assert.rejects(retirementPayrollSource(h.pool,1,e.id,'standard','2026-09-15'),/participant eligibility/)
 const eligibilityPath=`/employees/${e.id}/retirement-eligibility/standard`,source=(await api(eligibilityPath)).source
 await api(eligibilityPath,{sourceFingerprint:source.fingerprint,expectedRevision:0,requestKey:randomUUID(),confirmed:true,disposition:'ELIGIBLE',eligibleOn:'2026-09-01',methods:['PERCENTAGE'],reference:'Retained synthetic eligibility evidence',employeeExplanation:'Eligible under the reviewed plan entry rules.'})
 await assert.rejects(retirementPayrollSource(h.pool,1,e.id,'standard','2026-09-15'),/No signed retirement election/)
 await h.pool.query("INSERT INTO payroll_employee_session(facility_id,employee_id,token_hash,expires_at) VALUES(1,$1,$2,now()+interval '1 day')",[e.id,hashPayrollToken('retirement-ledger-session')])
 const proposal=(await api('/retirement',undefined,true)).plans[0].proposal
 await api('/retirement/standard/elections',{action:'ELECT',method:'PERCENTAGE',pretax:500,roth:0,signature:'Synthetic Employee',confirmed:true,effectiveOn:'2026-09-12',expectedRevision:0,requestKey:randomUUID(),proposalFingerprint:proposal.fingerprint},true)
 const processingPath='/retirement-plans/standard/processing-review',processing=await api(processingPath)
 const processingBody={planRevisionId:processing.planRevisionId,expectedRevision:0,requestKey:randomUUID(),review:{disposition:'REVIEWED',catchUpAuthorized:false,confirmed:true,reference:'Reviewed actual payroll processing policies',policies:processing.policies}}
 await assert.rejects(retirementPayrollSource(h.pool,1,e.id,'standard','2026-09-15'),/processing policies/)
 const processingSaved=await api(processingPath,processingBody)
 assert.equal((await api(processingPath,processingBody)).id,processingSaved.id)
 const reviewPost=body=>fetch(`${h.url}/api/admin/payroll${processingPath}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(body)})
 assert.equal((await reviewPost({...processingBody,review:{...processingBody.review,reference:'Different processing review evidence'}})).status,409)
 const competitors=await Promise.all([1,2].map(()=>reviewPost({...processingBody,expectedRevision:1,requestKey:randomUUID()})))
 assert.deepEqual(competitors.map(r=>r.status).sort(),[200,409])
 assert.equal((await api(processingPath)).history.length,2)
 await api(processingPath,{...processingBody,expectedRevision:2,requestKey:randomUUID(),review:{...processingBody.review,disposition:'SUSPENDED'}})
 await assert.rejects(retirementPayrollSource(h.pool,1,e.id,'standard','2026-09-15'),/processing policies/)
 await api(processingPath,{...processingBody,expectedRevision:3,requestKey:randomUUID()})
 await assert.rejects(h.pool.query('UPDATE payroll_retirement_processing_review SET revision=99'),/append-only/)
 await assert.rejects(h.pool.query('DELETE FROM payroll_retirement_processing_review'),/append-only/)
 const payrollArgs={employee:{id:e.id,payType:'HOURLY',hourlyRateCents:2500,w4Status:'COMPLETE',stateWithholdingStatus:'COMPLETE',workState:'MD',residenceState:'MD'},entries:[{clockIn:'2026-09-07T09:00:00Z',clockOut:'2026-09-09T01:00:00Z',unpaidBreakMinutes:0,status:'APPROVED'}],taxElection:{verified:true,federal:{filingStatus:'SINGLE'},maryland:{filingStatus:'SINGLE',localRate:3.2,exemptions:1}}}
 const elect=async(pretax,roth,revision)=>api('/retirement/standard/elections',{action:'ELECT',method:'PERCENTAGE',pretax,roth,signature:'Synthetic Employee',confirmed:true,effectiveOn:'2026-09-12',expectedRevision:revision,requestKey:randomUUID(),proposalFingerprint:proposal.fingerprint},true)
 const orchestration={facility:1,planId:'standard',payDate:'2026-09-15',runKind:'REGULAR',payrollArgs,catchUpAuthorized:false}
 await elect(9000,0,1)
 const affordable=await retirementEmployeePayroll(h.pool,orchestration)
 assert.equal(affordable.pretaxDeductionCents,90000)
 assert.ok(affordable.netPayCents>=0)
 assert.ok(affordable.retirementPlans[0].calculation.availablePayEvidence.netPayBeforeRetirementCents<90000)
 assert.equal(affordable.retirementPlans[0].calculation.requiresPayrollIntegration,true)
 await elect(0,10000,2)
 await assert.rejects(retirementEmployeePayroll(h.pool,orchestration),/cannot proceed/)
 await assert.rejects(retirementEmployeePayroll(h.pool,{...orchestration,payrollArgs:{...payrollArgs,adjustments:[{kind:'REIMBURSEMENT',amountCents:100000,taxTreatmentVerified:true}]}}),/Wages after taxes/)
 await elect(500,0,3)
 const loaded=await retirementPayrollSource(h.pool,1,e.id,'standard','2026-09-15')
 const {plan,annual,election}=loaded
 assert.equal(loaded.eligibilityRevisionId,election.proposal.eligibilityRevisionId)
 await assert.rejects(retirementPayrollSource(h.pool,2,e.id,'standard','2026-09-15'),/Employee not found/)
 await assert.rejects(retirementPayrollSource(h.pool,1,e.id,'standard','2027-01-01'),/date and tax year/)
 await assert.rejects(retirementPayrollSource(h.pool,1,e.id,'standard','2026-09-11'),/No signed retirement election/)

 const payrollPreview=buildEmployeePreview(payrollArgs)
 const base={payrollPreview,plan,annual,election,internal:(await retirementInternalBalances(h.pool,1,e.id,'standard',2026)).totals,payDate:'2026-09-15',runKind:'REGULAR',compensation:{REGULAR:100000,OVERTIME:0,BONUS:0,PAID_LEAVE:0},compensation415Cents:100000,availableDeductionCents:100000,catchUpAuthorized:false}
 const calc=await retirementPayrollCalculation(h.pool,{...base,facility:1,employeeId:e.id,planId:'standard'})
 assert.equal(calc.totalCents,5000)
 assert.deepEqual(calc.retirement401k,{planType:'STANDARD_401K',pretaxCents:5000,rothCents:0,pretaxAnnualBonusCents:0})
 const applied=buildEmployeePreview({...payrollArgs,retirement401k:calc.retirement401k})
 assert.equal(applied.pretaxDeductionCents,5000)
 assert.equal(applied.incomeTaxWageBasis.federalWagesCents,95000)
 assert.equal(applied.netPayCents,applied.grossPayCents-applied.totalDeductionCents-applied.socialSecurityTaxCents-applied.medicareTaxCents-applied.additionalMedicareTaxCents-applied.federalIncomeTaxCents-applied.stateIncomeTaxCents)
 const bonusPreview=buildEmployeePreview({...payrollArgs,adjustments:[{kind:'BONUS',amountCents:50000,taxTreatmentVerified:true,bonusReview:{classification:'DISCRETIONARY',paymentType:'ANNUAL_LUMP_SUM',verifiedAt:'2026-09-11T12:00:00Z'}}]})
 const withBonus=await retirementPayrollCalculation(h.pool,{...base,payrollPreview:bonusPreview,facility:1,employeeId:e.id,planId:'standard'})
 assert.equal(withBonus.totalCents,7500)
 assert.equal(withBonus.retirement401k.pretaxAnnualBonusCents,2500)
 assert.equal(calc.source.electionId,loaded.electionId)
 assert.equal(calc.requiresPayrollIntegration,true)
 // Supplied source/ledger overrides are ignored by the service boundary.
 const forged=await retirementPayrollCalculation(h.pool,{...base,facility:1,employeeId:e.id,planId:'standard',election:{action:'DECLINE'},internal:{ordinaryDeferralsCents:2450000},annual:{},plan:{}})
 assert.deepEqual(forged,calc)
 // Simulate the future integrated payroll producer. Production calculations
 // retain requiresPayrollIntegration=true until that producer is implemented.
 const orchestrated=await retirementEmployeePayroll(h.pool,orchestration)
 const ready={...orchestrated.retirementPlans[0].calculation,requiresPayrollIntegration:false}
 const createRun=async(start,end,date,c)=>{const p=(await h.pool.query("INSERT INTO payroll_pay_period(facility_id,period_start,period_end,pay_date,frequency) VALUES(1,$1,$2,$3,'SEMIMONTHLY') RETURNING id",[start,end,date])).rows[0];const r=(await h.pool.query("INSERT INTO payroll_run(facility_id,pay_period_id,status,calculation_snapshot) VALUES(1,$1,'REVIEW',$2) RETURNING id",[p.id,{employees:[{...orchestrated,employeeId:e.id,retirementPlans:[{planId:'standard',calculation:c}]}]}])).rows[0];await h.pool.query('INSERT INTO payroll_run_employee(payroll_run_id,employee_id) VALUES($1,$2)',[r.id,e.id]);return r.id}
 const first=await createRun('2026-09-01','2026-09-15','2026-09-15',calc)
 const approve=async id=>{const db=await h.pool.connect();try{await db.query('BEGIN');await db.query('SELECT facility_id FROM payroll_settings WHERE facility_id=1 FOR UPDATE');await db.query("UPDATE payroll_run SET status='APPROVED' WHERE id=$1",[id]);const count=await retainRetirementRunLedger(db,1,id);await db.query('COMMIT');return count}catch(e){await db.query('ROLLBACK');throw e}finally{db.release()}}
 await assert.rejects(approve(first),/fully integrated/)
 await h.pool.query('UPDATE payroll_run SET calculation_snapshot=$1 WHERE id=$2',[{employees:[{...orchestrated,employeeId:e.id,retirementPlans:[{planId:'standard',calculation:{...ready,payDate:'2026-09-14'}}]}]},first])
 await assert.rejects(approve(first),/pay date differs/)
 // The database independently refuses an exact snapshot with the wrong date.
 await h.pool.query("UPDATE payroll_run SET status='APPROVED' WHERE id=$1",[first])
 await assert.rejects(h.pool.query('INSERT INTO payroll_retirement_run_ledger(facility_id,run_id,employee_id,plan_id,tax_year,calculation) VALUES(1,$1,$2,\'standard\',2026,$3)',[first,e.id,{...ready,payDate:'2026-09-14'}]),/exact approved/)
 await h.pool.query("UPDATE payroll_run SET status='REVIEW' WHERE id=$1",[first])
 await h.pool.query('UPDATE payroll_run SET calculation_snapshot=$1 WHERE id=$2',[{employees:[{...orchestrated,employeeId:e.id,retirementPlans:[{planId:'standard',calculation:ready}]}]},first])
 await h.pool.query('UPDATE payroll_run SET calculation_snapshot=$1 WHERE id=$2',[{employees:[{...orchestrated,netPayCents:orchestrated.netPayCents+1,retirementPlans:[{planId:'standard',calculation:ready}]}]},first])
 await assert.rejects(approve(first),/available-pay evidence differs/)
 await h.pool.query('UPDATE payroll_run SET calculation_snapshot=$1 WHERE id=$2',[{employees:[{...orchestrated,retirementPlans:[{planId:'standard',calculation:ready}]}]},first])
 const second=await createRun('2026-09-16','2026-09-30','2026-09-30',{...ready,payDate:'2026-09-30'})
 const concurrent=await Promise.allSettled([approve(first),approve(second)])
 assert.equal(concurrent.filter(result=>result.status==='fulfilled').length,1)
 assert.equal(concurrent.filter(result=>result.status==='rejected').length,1)
 assert.match(concurrent.find(result=>result.status==='rejected').reason.message,/allowance changed|reserved by another payroll/)
 const retained=(await h.pool.query('SELECT run_id,calculation FROM payroll_retirement_run_ledger')).rows;assert.equal(retained.length,1)
 const ledger=await retirementInternalBalances(h.pool,1,e.id,'standard',2026);assert.equal(ledger.totals.ordinaryDeferralsCents,5000);assert.equal(ledger.totals.planCompensationCents,100000);assert.equal(ledger.totals.compensation415Cents,100000);assert.deepEqual(ledger.unreconciledPayrollIds,[])
 const db=await h.pool.connect();try{await db.query('BEGIN');assert.equal(await retainRetirementRunLedger(db,1,retained[0].run_id),0);await db.query('COMMIT')}finally{db.release()}
 await h.pool.query('UPDATE payroll_run SET deduction_cents=$1 WHERE id=$2',[orchestrated.totalDeductionCents,retained[0].run_id])
 await h.pool.query('UPDATE payroll_run_employee SET pretax_deduction_cents=$1,posttax_deduction_cents=$2 WHERE payroll_run_id=$3',[orchestrated.pretaxDeductionCents,orchestrated.posttaxDeductionCents,retained[0].run_id])
 const accountingRun=(await h.pool.query('SELECT * FROM payroll_run WHERE id=$1',[retained[0].run_id])).rows[0]
 await verifyRetirementPosting(h.pool,accountingRun)
 const changedAccounting=structuredClone(accountingRun)
 changedAccounting.calculation_snapshot.employees[0].retirementPlans[0].calculation.source.processingReviewId=randomUUID()
 await assert.rejects(verifyRetirementPosting(h.pool,changedAccounting),/exact retained/)
 assert.equal(await retirementAnnualReporting(h.pool,1,e.id),null)
 const employeeStatement={payItems:orchestrated.payItems,retirement:retirementStatementSummary(accountingRun.calculation_snapshot.employees[0]),ficaWageBasis:orchestrated.ficaWageBasis,incomeTaxWageBasis:orchestrated.incomeTaxWageBasis,workweekPaymentVersion:orchestrated.workweekPaymentVersion,workweekPayments:orchestrated.workweekPayments}
 await h.pool.query('UPDATE payroll_run_employee SET statement_snapshot=$1 WHERE payroll_run_id=$2',[employeeStatement,retained[0].run_id])
 await h.pool.query("UPDATE payroll_run SET status='FINALIZED' WHERE id=$1",[retained[0].run_id])
 const annualReport=await retirementAnnualReporting(h.pool,1,e.id)
 assert.equal(annualReport.pretaxDeferrals,'50.00');assert.equal(annualReport.rothDeferrals,'0.00');assert.equal(annualReport.records.length,1)
 assert.equal(annualReport.records[0].runId,String(retained[0].run_id))
 assert.deepEqual(retirementW2Codes(annualReport),[{code:'D',amount:'50.00'}])
 await verifyRetirementAnnualApproval(h,e.id,retained[0].run_id,orchestrated)
 assert.equal(await retirementAnnualReporting(h.pool,2,e.id),null)
 const badStatement=structuredClone(employeeStatement);badStatement.retirement.plans[0].ordinaryPretaxCents++
 await h.pool.query('UPDATE payroll_run_employee SET statement_snapshot=$1 WHERE payroll_run_id=$2',[badStatement,retained[0].run_id])
 await assert.rejects(retirementAnnualReporting(h.pool,1,e.id),/retained employee statement/)
 await h.pool.query('UPDATE payroll_run_employee SET statement_snapshot=$1 WHERE payroll_run_id=$2',[employeeStatement,retained[0].run_id])
 await assert.rejects(h.pool.query('UPDATE payroll_retirement_run_ledger SET plan_id=\'other\''),/append-only/)
 await assert.rejects(h.pool.query('DELETE FROM payroll_retirement_run_ledger'),/append-only/)
 await h.pool.query("UPDATE payroll_run SET status='VOID' WHERE id=$1",[retained[0].run_id])
 assert.equal(await retirementAnnualReporting(h.pool,1,e.id),null)
 assert.equal((await retirementInternalBalances(h.pool,1,e.id,'standard',2026)).totals.ordinaryDeferralsCents,0);assert.equal((await h.pool.query('SELECT count(*)::int AS n FROM payroll_retirement_run_ledger')).rows[0].n,1)
 const old=await createRun('2026-08-01','2026-08-15','2026-08-15',ready)
 await h.pool.query("UPDATE payroll_run SET status='FINALIZED',calculation_snapshot='{}'::jsonb WHERE id=$1",[old])
 assert.deepEqual((await retirementInternalBalances(h.pool,1,e.id,'standard',2026)).unreconciledPayrollIds,[String(old)])
 const pending=String(first)===String(retained[0].run_id)?second:first
 await assert.rejects(approve(pending),/Earlier payroll needs retirement compensation reconciliation/)
 await assert.rejects(retirementPayrollCalculation(h.pool,{...base,facility:1,employeeId:e.id,planId:'standard'}),/Earlier payroll needs retirement compensation reconciliation/)

 await api(annualPath,{planRevisionId:annualSource.planRevisionId,expectedRevision:1,requestKey:randomUUID(),facts:retirementAnnualFixture({asOfDate:'2026-09-11'})})
 await assert.rejects(approve(pending),/source revisions changed/)
 await assert.rejects(retirementPayrollSource(h.pool,1,e.id,'standard','2026-09-10'),/annual evidence is dated after/)
 await api('/retirement-plans',{plan:{...retirementPlanFixture(),name:'Revised synthetic plan'},expectedRevision:1,requestKey:randomUUID()})
 await assert.rejects(retirementPayrollSource(h.pool,1,e.id,'standard','2026-09-15'),/annual sources/)
 assert.equal((await api(processingPath)).status,'REVIEW_REQUIRED')

})
