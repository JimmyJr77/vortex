import {retirementAnnualReporting} from '../retirementAnnualReporting.js'
import {healthElectionFixture} from '../testing/healthElectionFixture.js'
import {statementLines} from '../payStatement.js'
import {employerContributionAccounting} from '../testing/employerContributionAccounting.js'
import {assertEmployerRemittanceReservation} from '../testing/employerRemittanceReservation.js'
import {retirementBankProvider} from '../testing/retirementBankProvider.js'
import {createRetirementSftpServer} from '../testing/retirementSftpServer.js'
import {verifyRetirementSftpConnection,transferRetirementAllocation,readRetirementSftpReceipt} from '../retirementSftpTransport.js'
import {assertEmployerContributionDelivery} from '../testing/employerContributionDelivery.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID,randomBytes} from 'node:crypto'
import {createHistoricalHarness} from '../testing/historicalHarness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
import {retirementPlanFixture} from '../testing/retirementPlanFixture.js'
import {retirementAnnualFixture} from '../testing/retirementAnnualFixture.js'

for(const taxTreatment of ['POSTTAX','PRETAX'])test(`regular employer payroll completes approval, delivery and accounting with ${taxTreatment} health premiums`,{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const key=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 const server=await createRetirementSftpServer();let clock=new Date('2026-09-18T12:06:00Z')
 const accounting=employerContributionAccounting(),provider=retirementBankProvider(),h=await createHistoricalHarness(t,{quickbooksFetcher:accounting.fetcher,paymentFetcher:provider.fetcher,remittanceNow:()=>clock,retirementSftpVerifier:c=>verifyRetirementSftpConnection(c,server.options),retirementAllocationTransfer:(c,file,options)=>transferRetirementAllocation(c,file,{...server.options,...options}),retirementReceiptReader:(c,receipt)=>readRetirementSftpReceipt(c,receipt,server.options)},'2026-09-16T16:00:00.000Z');t.after(async()=>{await h.close();await server.close();if(key===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=key})
 const fixture=taxTreatment==='PRETAX'?await healthElectionFixture(h,{benefitsOptions:{hireDate:'2026-09-09'}}):await monthlyBenefitsFixture(h,{hireDate:'2026-09-09'}),{api,employee,periods}=fixture
 if(taxTreatment==='PRETAX')await api(fixture.path,fixture.electionBody,'POST',200,true)
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
 assert.equal(matchedPayroll.canApprove,true,JSON.stringify(matchedPayroll.warnings))
 assert.deepEqual(matchedPayroll.employees[0].employerContributionReview.obligation,{matchingCents:600,nonelectiveCents:400,totalCents:1000})
 await api(annualPath,{planRevisionId:annual.planRevisionId,expectedRevision:1,requestKey:randomUUID(),facts:{...retirementAnnualFixture(),externalAnnualAdditionsCents:1,employerFunding:{compensationCents:0,matchingCents:1,nonelectiveCents:0,reference:'Synthetic external employer funding requiring payroll assignment'}}})
 const external=(await api('/runs/preview',{payPeriodId:periods[0].id})).preview
 assert.equal(external.canApprove,false);assert.match(external.warnings.find(w=>w.code==='RETIREMENT_PAYROLL_REVIEW').message,/previously funded external employer/)
 await api(annualPath,{planRevisionId:annual.planRevisionId,expectedRevision:2,requestKey:randomUUID(),facts:{...retirementAnnualFixture(),employerFunding:{compensationCents:0,matchingCents:0,nonelectiveCents:0,reference:'Synthetic reviewed zero external employer funding'}}})
 const stale=await api('/runs',{payPeriodId:periods[0].id},'POST',201)
 await api(`/runs/${stale.id}/status`,{status:'REVIEW'},'PATCH')
 await api(eligibilityPath,{...review,expectedRevision:2,requestKey:randomUUID(),matching:{status:'ELIGIBLE',eligibleOn:'2026-09-09',vestedBps:0}})
 await api(`/runs/${stale.id}/status`,{status:'APPROVED'},'PATCH',409)
 await api(`/runs/${stale.id}/status`,{status:'VOID'},'PATCH')
 const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201)
 await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH')
 await h.pool.query("CREATE FUNCTION synthetic_fail_employer_reservation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic reservation failure'; END $$; CREATE TRIGGER synthetic_fail_employer_reservation BEFORE INSERT ON payroll_retirement_employer_run_ledger FOR EACH ROW EXECUTE FUNCTION synthetic_fail_employer_reservation()")
 await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH',500)
 assert.equal((await h.pool.query('SELECT status FROM payroll_run WHERE id=$1',[run.id])).rows[0].status,'REVIEW')
 assert.equal((await h.pool.query('SELECT count(*)::int n FROM payroll_retirement_run_ledger WHERE run_id=$1',[run.id])).rows[0].n,0)
 await h.pool.query('DROP TRIGGER synthetic_fail_employer_reservation ON payroll_retirement_employer_run_ledger; DROP FUNCTION synthetic_fail_employer_reservation()')
 const approved=await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH')
 assert.equal(approved.status,'APPROVED')
 assert.equal(approved.calculation_snapshot.employees[0].employerRetirementPlans[0].calculation.contribution.proposed.totalCents,1000)
 assert.equal((await h.pool.query('SELECT count(*)::int n FROM payroll_retirement_employer_run_ledger WHERE run_id=$1',[run.id])).rows[0].n,1)
 await h.pool.query("UPDATE payroll_employee SET employment_status='LEAVE' WHERE id=$1",[employee.id])
 await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-CHANGED-EMPLOYMENT'},'POST',409)
 await h.pool.query("UPDATE payroll_employee SET employment_status='ACTIVE' WHERE id=$1",[employee.id])
 const finalized=await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-PUBLIC-EMPLOYER-PAYROLL'})
 assert.equal(finalized.status,'FINALIZED')
 const statement=(await h.pool.query('SELECT statement_snapshot FROM payroll_run_employee WHERE payroll_run_id=$1',[run.id])).rows[0].statement_snapshot
 assert.equal(statement.retirement.employerPlans[0].totalCents,1000)
 const posted=(await h.pool.query('SELECT * FROM payroll_run_employee WHERE payroll_run_id=$1',[run.id])).rows[0]
 assert.equal(statementLines(posted).lines.reduce((sum,line)=>sum+line[2],0),Number(posted.net_pay_cents))
 assert.equal(Number(posted.pretax_deduction_cents),taxTreatment==='PRETAX'?13500:1000)
 assert.equal(Number(posted.posttax_deduction_cents),taxTreatment==='PRETAX'?400:12900)
 const annualReport=await retirementAnnualReporting(h.pool,1,employee.id)
 assert.equal(annualReport.pretaxDeferrals,'10.00');assert.equal(annualReport.rothDeferrals,'4.00')
 assert.equal(annualReport.employerMatching,'6.00');assert.equal(annualReport.employerNonelective,'4.00')
 assert.equal(provider.posts(),0)
 const timingPath='/retirement-plans/standard/timing',timing=await api(timingPath)
 await api(timingPath,{planRevisionId:timing.planRevisionId,expectedRevision:0,requestKey:randomUUID(),policy:{effectiveOn:'2026-01-01',disposition:'REVIEWED',depositBusinessDays:2,providerLeadBusinessDays:1,cutoffTime:'14:00',reference:'Reviewed payroll segregation and provider timing for combined contributions',confirmed:true,calendarConfirmed:true,earliestConfirmed:true,employerFunding:{schedule:'WITH_PAYROLL',confirmed:true,reference:'Reviewed employer matching and nonelective funding with each payroll'}}})
 const delivery=(await api('/retirement-remittance-sources')).items.find(r=>r.runId===String(run.id))
 const reservation=await assertEmployerRemittanceReservation(h,api,run,delivery,timing.planRevisionId)
 await assertEmployerContributionDelivery(h,api,reservation,server,provider,value=>{clock=new Date(value)})
 await accounting.verify(h,api,reservation)
})
