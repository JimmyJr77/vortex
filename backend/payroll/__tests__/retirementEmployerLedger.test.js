import {retirementStatementSummary} from '../retirementStatement.js'
import {verifyEmployerRetirementPosting} from '../retirementEmployerJournal.js'
import {loadBasePreview} from '../registerRoutes.js'
import {retainRetirementRunLedger,retirementInternalBalances} from '../retirementLedger.js'
import {retirementEmployerApprovedCalculation,retainEmployerRetirementRunLedger} from '../retirementEmployerLedger.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHistoricalHarness} from '../testing/historicalHarness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
import {retirementPlanFixture} from '../testing/retirementPlanFixture.js'
import {retirementAnnualFixture} from '../testing/retirementAnnualFixture.js'

test('employer reservations retain exact approved evidence and consume shared annual capacity',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHistoricalHarness(t,{},'2026-09-16T16:00:00.000Z');t.after(()=>h.close())
 const {api,employee,periods}=await monthlyBenefitsFixture(h,{hireDate:'2026-09-09'})
 await api('/retirement-plans',{plan:{...retirementPlanFixture(),employerContributions:'MATCH_AND_NONELECTIVE',employerContributionTerms:'Synthetic employer contribution obligation.',employerFormula:{period:'PER_PAYROLL',matchCatchUp:false,matchTiers:[{upToBps:300,matchBps:10000}],nonelectiveBps:200,compensation:{REGULAR:true,OVERTIME:true,BONUS:false,PAID_LEAVE:true},eligibilityTerms:'Synthetic reviewed new hire entry terms.',vestingTerms:'Synthetic reviewed vesting schedule.'}},expectedRevision:0,requestKey:randomUUID()})
 const annualPath=`/employees/${employee.id}/retirement-annual-sources/standard`,annual=await api(annualPath)
 await api(annualPath,{planRevisionId:annual.planRevisionId,expectedRevision:0,requestKey:randomUUID(),facts:{...retirementAnnualFixture(),employerFunding:{compensationCents:0,matchingCents:0,nonelectiveCents:0,reference:'Synthetic verified zero external employer amounts.'}}})
 const eligibilityPath=`/employees/${employee.id}/retirement-employer-eligibility/standard`,source=await api(eligibilityPath)
 const review={sourceFingerprint:source.source.fingerprint,expectedRevision:0,requestKey:randomUUID(),confirmed:true,assessedFrom:'2026-09-09',assessedThrough:'2026-09-15',reference:'Synthetic eligibility assessed only for actual employment.',matching:{status:'NOT_ELIGIBLE',eligibleOn:null,vestedBps:null},nonelective:{status:'ELIGIBLE',eligibleOn:'2026-09-09',vestedBps:0}}
 await api(eligibilityPath,{...review,assessedFrom:'2026-09-01'},'POST',400)
 await api(eligibilityPath,review)
 const preview=(await api('/runs/preview',{payPeriodId:periods[0].id})).preview
 const funding=preview.employees[0].employerCompensationPreview
 assert.ok(funding,JSON.stringify(preview.warnings))
 assert.equal(funding.eligibility.status,'REVIEWED_FOR_PAY_PERIOD',JSON.stringify(funding.eligibility))
 assert.equal(funding.eligibility.periodStart,'2026-09-09');assert.equal(funding.periodStart,'2026-09-01')
 assert.equal(funding.eligibility.coverage.clippedForNewHire,true)
 assert.equal(funding.eligibility.components.nonelective.eligible,true)
 assert.equal(funding.eligibleCompensationCents,20000)
 assert.equal(funding.requiresEmployerEligibilityReview,false)
 assert.equal(funding.obligationPreview.obligation.nonelectiveCents,400)
 assert.equal(funding.obligationPreview.ordinaryDeferralsCents,null)
 assert.equal(funding.obligationPreview.deferralEvidence,'NOT_REQUIRED')
 assert.equal(funding.requiresObligationCalculation,false)
 assert.equal(funding.obligationPreview.requiresAnnualAdditionsReview,true)
 assert.match(preview.warnings.find(w=>w.code==='RETIREMENT_PAYROLL_REVIEW').message,/Nonelective obligation: \$4\.00/)
 assert.equal(funding.requiresApprovalReservation,true);assert.equal(preview.canApprove,false)
 await api(eligibilityPath,{...review,expectedRevision:1,requestKey:randomUUID(),matching:{status:'ELIGIBLE',eligibleOn:'2026-09-09',vestedBps:0}})
 const partial=(await api('/runs/preview',{payPeriodId:periods[0].id})).preview.employees[0].employerCompensationPreview
 assert.equal(partial.obligationPreview.obligation.matchingCents,null);assert.equal(partial.obligationPreview.obligation.nonelectiveCents,400)
 assert.equal(partial.obligationPreview.status,'DEFERRAL_EVIDENCE_REQUIRED');assert.equal(partial.requiresObligationCalculation,true)
 const deferralPath=`/employees/${employee.id}/retirement-eligibility/standard`,deferralSource=await api(deferralPath)
 await api(deferralPath,{sourceFingerprint:deferralSource.source.fingerprint,expectedRevision:0,requestKey:randomUUID(),confirmed:true,disposition:'ELIGIBLE',eligibleOn:'2026-09-09',methods:['PERCENTAGE'],reference:'Synthetic reviewed employee deferral eligibility.',employeeExplanation:'Eligible to elect employee deferrals under reviewed terms.'})
 const proposal=(await api('/retirement',undefined,'GET',200,true)).plans[0].proposal
 const elect=async(pretax,roth,expectedRevision,action='ELECT')=>api('/retirement/standard/elections',{action,method:'PERCENTAGE',pretax,roth,signature:'Monthly Benefits',confirmed:true,effectiveOn:'2026-09-17',expectedRevision,requestKey:randomUUID(),proposalFingerprint:proposal.fingerprint},'POST',200,true)
 await elect(500,200,0)
 const processingPath='/retirement-plans/standard/processing-review',processing=await api(processingPath)
 const pendingPolicy=(await api('/runs/preview',{payPeriodId:periods[0].id})).preview.employees[0].employerCompensationPreview
 assert.match(pendingPolicy.deferralPreview.message,/processing policies/)
 await api(processingPath,{planRevisionId:processing.planRevisionId,expectedRevision:0,requestKey:randomUUID(),review:{disposition:'REVIEWED',catchUpAuthorized:false,confirmed:true,reference:'Synthetic reviewed deferral preview processing policies.',policies:processing.policies}})
 assert.equal((await api(processingPath)).executionIssues.length,1)
 const matchedPayroll=(await api('/runs/preview',{payPeriodId:periods[0].id})).preview,matched=matchedPayroll.employees[0].employerCompensationPreview
 // Simulate the pending integrated producer using actual engine inputs. The
 // public approval route deliberately remains gated until accounting is ready.
 const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201)
 const c={...matched.deferralPreview.calculation,previewOnly:false,requiresPayrollIntegration:false,availablePayEvidence:matched.deferralPreview.availablePayEvidence}
 const rebuilt=await loadBasePreview(h.pool,1,periods[0].id,null,run.id,false,null,[],null,{[employee.id]:c.retirement401k})
 const applied=rebuilt.preview.employees[0]
 applied.retirementPlans=[{planId:'standard',calculation:c}]
 const snapshot={...rebuilt.preview,employees:[applied]}
 await h.pool.query("UPDATE payroll_run SET status='APPROVED',calculation_snapshot=$1,deduction_cents=$2,net_pay_cents=$4,employee_tax_cents=$5 WHERE id=$3",[snapshot,applied.totalDeductionCents,run.id,applied.netPayCents,c.availablePayEvidence.employeeTaxCents])
 await h.pool.query('UPDATE payroll_run_employee SET regular_pay_cents=$1,overtime_pay_cents=$2,other_taxable_pay_cents=$3,paid_leave_cents=$4,net_pay_cents=$5,pretax_deduction_cents=$6,posttax_deduction_cents=$7 WHERE payroll_run_id=$8 AND employee_id=$9',[applied.regularPayCents,applied.overtimePayCents,applied.otherTaxablePayCents,applied.paidLeavePayCents,applied.netPayCents,applied.pretaxDeductionCents,applied.posttaxDeductionCents,run.id,employee.id])
 const db=await h.pool.connect()
 try{
  await db.query('BEGIN')
  await retainRetirementRunLedger(db,1,run.id)
  const args={facility:1,runId:run.id,employeeId:employee.id,planId:'standard'}
  const employer=await retirementEmployerApprovedCalculation(db,args)
  assert.deepEqual(employer.contribution.proposed,{matchingCents:600,nonelectiveCents:400,totalCents:1000})
  assert.equal(employer.contribution.annualAdditionsRemainingCents,18600)
  applied.employerRetirementPlans=[{planId:'standard',calculation:employer}]
  await db.query('UPDATE payroll_run SET calculation_snapshot=$1 WHERE id=$2',[snapshot,run.id])
  await assert.rejects(retainEmployerRetirementRunLedger(db,1,run.id),/fully integrated/)
  employer.requiresPayrollIntegration=false
  employer.sourceFingerprint='0'.repeat(64)
  await db.query('UPDATE payroll_run SET calculation_snapshot=$1 WHERE id=$2',[snapshot,run.id])
  await assert.rejects(retainEmployerRetirementRunLedger(db,1,run.id),/sources or annual capacity changed/)
  applied.employerRetirementPlans[0].calculation={...await retirementEmployerApprovedCalculation(db,args),requiresPayrollIntegration:false}
  await db.query('UPDATE payroll_run SET calculation_snapshot=$1 WHERE id=$2',[snapshot,run.id])
  assert.equal(await retainEmployerRetirementRunLedger(db,1,run.id),1)
  assert.equal(await retainEmployerRetirementRunLedger(db,1,run.id),0)
  const accountingRun={id:run.id,facility_id:1,calculation_snapshot:snapshot}
  const employerLines=await verifyEmployerRetirementPosting(db,accountingRun)
  assert.equal(employerLines.filter(line=>line[2]==='Debit').reduce((n,line)=>n+line[1],0),1000)
  const omitted=structuredClone(accountingRun);delete omitted.calculation_snapshot.employees[0].employerRetirementPlans
  await assert.rejects(verifyEmployerRetirementPosting(db,omitted),/omits or duplicates/)
  const altered=structuredClone(accountingRun);altered.calculation_snapshot.employees[0].employerRetirementPlans[0].calculation.sourceFingerprint='f'.repeat(64)
  await assert.rejects(verifyEmployerRetirementPosting(db,altered),/exact retained/)

  const balances=await retirementInternalBalances(db,1,employee.id,'standard',2026)
  assert.equal(balances.totals.ordinaryDeferralsCents,1400)
  assert.equal(balances.totals.annualAdditionsCents,2400)
  assert.equal(balances.totals.compensation415Cents,20000)
  assert.equal((await retirementInternalBalances(db,1,employee.id,'standard',2026,{excludeRunId:run.id})).totals.annualAdditionsCents,0)
  assert.equal((await retirementInternalBalances(db,2,employee.id,'standard',2026)).totals.annualAdditionsCents,0)
  await db.query('COMMIT')
 }catch(error){await db.query('ROLLBACK');throw error}finally{db.release()}
 const reserve=async()=>{const connection=await h.pool.connect();try{await connection.query('BEGIN');const count=await retainEmployerRetirementRunLedger(connection,1,run.id);await connection.query('COMMIT');return count}catch(error){await connection.query('ROLLBACK');throw error}finally{connection.release()}}
 assert.deepEqual(await Promise.all([reserve(),reserve()]),[0,0])
 await assert.rejects(h.pool.query('UPDATE payroll_retirement_employer_run_ledger SET matching_cents=0'),/append-only/)
 await assert.rejects(h.pool.query('DELETE FROM payroll_retirement_employer_run_ledger'),/append-only/)
 const retained=(await h.pool.query('SELECT * FROM payroll_retirement_employer_run_ledger')).rows[0]
 await assert.rejects(h.pool.query('INSERT INTO payroll_retirement_employer_run_ledger(facility_id,run_id,employee_id,plan_id,tax_year,calculation,matching_cents,nonelective_cents) VALUES(2,$1,$2,$3,2026,$4,$5,$6)',[run.id,employee.id,'standard',retained.calculation,600,400]),/exact approved/)
 await api('/accounting-mapping',{verifiedByBookkeeper:true,retirementLiabilityAccount:'Retirement payable'},'PATCH')
 const csv=()=>fetch(`${h.url}/api/admin/payroll/reports/quickbooks.csv?runId=${run.id}`,{headers:{Authorization:'Bearer payroll-test-admin'}})
 assert.equal((await csv()).status,409)
 await api('/accounting-mapping',{verifiedByBookkeeper:true,employerRetirementExpenseAccount:'Employer retirement expense'},'PATCH')
 const exported=await csv();assert.equal(exported.status,200,await exported.clone().text())
 const csvText=await exported.text();assert.match(csvText,/Employer retirement expense/);assert.match(csvText,/employer matching contributions/);assert.match(csvText,/employer nonelective contributions/)
 const statement={payItems:applied.payItems,retirement:retirementStatementSummary(applied),employeeName:'Monthly Benefits',employeeNumber:'SYNTHETIC',employer:{name:'Synthetic Employer'}}
 const statementRow=(await h.pool.query('UPDATE payroll_run_employee SET statement_snapshot=$1 WHERE payroll_run_id=$2 AND employee_id=$3 RETURNING id',[statement,run.id,employee.id])).rows[0]
 await h.pool.query("UPDATE payroll_run SET status='FINALIZED' WHERE id=$1",[run.id])
 const statementResponse=await fetch(`${h.url}/api/payroll/employee/pay-statements/${statementRow.id}.pdf`,{headers:{Authorization:'Bearer monthly-benefits-session'}})
 assert.equal(statementResponse.status,200)
 assert.equal(statementResponse.headers.get('content-type'),'application/pdf')
 assert.equal(Buffer.from(await statementResponse.arrayBuffer()).subarray(0,5).toString(),'%PDF-')
 assert.equal((await h.pool.query("SELECT count(*)::int n FROM payroll_audit_log WHERE action='STATEMENT_DOWNLOADED'")).rows[0].n,1)
 await h.pool.query("UPDATE payroll_run SET status='VOID' WHERE id=$1",[run.id])
 assert.equal((await retirementInternalBalances(h.pool,1,employee.id,'standard',2026)).totals.annualAdditionsCents,0)
 assert.equal((await h.pool.query('SELECT count(*)::int n FROM payroll_retirement_employer_run_ledger')).rows[0].n,1)
})
