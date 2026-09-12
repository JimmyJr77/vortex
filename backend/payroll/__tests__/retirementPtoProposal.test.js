import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {regularRetirementFixture} from '../testing/regularRetirementFixture.js'
import {retirementPtoProposal} from '../retirementPtoProposal.js'
test('native PTO previews derive contribution proposals from current signed sources without posting deductions',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness({databaseNow:'2026-09-11T12:00:00.000Z',retirementNow:()=>new Date('2026-09-11T12:00:00Z')});t.after(()=>h.close())
 const unusedPto={inServiceDeferrals:'INCLUDED',postSeveranceDeferrals:'INCLUDED',postSeverance415:'INCLUDED',limitationYear:'CALENDAR_YEAR',terms:'Retained actual plan payout and compensation terms.'}
 const {api,employee,periods,processingPath,processing}=await regularRetirementFixture(h,{unusedPto})
 await h.pool.query("INSERT INTO payroll_leave_transaction(facility_id,employee_id,leave_type,transaction_date,minutes,reason) VALUES(1,$1,'PTO','2026-09-01',480,'Synthetic earned vacation')",[employee.id])
 const policy={leaveType:'PTO',minutes:240,hourlyRateCents:2500,policyVerified:true,unusedVacationVerified:true,policyReference:'Actual retained vacation payout policy'}
 const p=await api(`/employees/${employee.id}/leave-payout/preview`,policy)
 const payout=await api(`/employees/${employee.id}/leave-payouts`,{...policy,payPeriodId:periods[0].id,fingerprint:p.fingerprint,requestKey:randomUUID(),paymentMode:'STANDALONE'},'POST',201)
 const period=(await h.pool.query('SELECT id,started_on::text,ended_on::text FROM payroll_employment_period WHERE employee_id=$1',[employee.id])).rows[0]
 const evidence={employmentPeriodId:Number(period.id),employmentStartedOn:period.started_on,employmentEndedOn:period.ended_on,usableIfContinued:true,sourceReference:'Reviewed actual employment and continued-use evidence',confirmed:true}
 const input={facility:1,employeeId:employee.id,planId:'standard',payoutId:payout.id,paymentDate:'2026-09-22',evidence}
 const proposal=await retirementPtoProposal(h.pool,input)
 assert.equal(proposal.calculation.pretaxCents,500);assert.equal(proposal.calculation.rothCents,200);assert.equal(proposal.taxWages.federalWagesCents,9500);assert.equal(proposal.taxWages.marylandWagesCents,9500);assert.equal(proposal.taxWages.socialSecurityWagesCents,10000)
 assert.equal(proposal.calculation.requiresPayrollIntegration,true);assert.equal(proposal.retirement401k.pretaxAnnualBonusCents,0)
 assert.equal((await h.pool.query('SELECT count(*)::int n FROM payroll_retirement_run_ledger')).rows[0].n,0)
 const body={payPeriodId:periods[0].id,paymentDate:input.paymentDate,offCyclePto:{payoutId:Number(payout.id),historyCompleteVerified:true,historySource:'Reconciled complete payment history',retirementPtoEvidence:evidence}}
 const preview=(await api('/runs/preview',body)).preview
 assert.equal(preview.employees[0].retirementPtoProposals[0].fingerprint,proposal.fingerprint)
 assert.equal(preview.employees[0].pretaxDeductionCents,0);assert.equal(preview.canApprove,false)
 const run=await api('/runs',body,'POST',201)
 const saved=(await h.pool.query('SELECT calculation_snapshot FROM payroll_run WHERE id=$1',[run.id])).rows[0].calculation_snapshot.employees[0]
 assert.equal(saved.retirementPtoProposals[0].calculation.totalCents,700)
 await assert.rejects(retirementPtoProposal(h.pool,{...input,facility:2}),{status:409})
 await api(processingPath,{planRevisionId:processing.planRevisionId,expectedRevision:1,requestKey:randomUUID(),review:{disposition:'SUSPENDED',catchUpAuthorized:false,confirmed:true,reference:'Synthetic processing suspension review',policies:processing.policies}})
 await assert.rejects(retirementPtoProposal(h.pool,input),/processing policies/)
})
