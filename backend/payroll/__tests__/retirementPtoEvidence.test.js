import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {retirementPtoEvidenceInput,retirementPtoAssessment} from '../retirementPtoEvidence.js'
import {validateOffCyclePto,loadOffCyclePtoPreview} from '../offCyclePto.js'
import {createHarness} from '../testing/harness.js'
import {regularRetirementFixture} from '../testing/regularRetirementFixture.js'
import {retirementPlanFixture} from '../testing/retirementPlanFixture.js'
const evidence={employmentPeriodId:1,employmentStartedOn:'2026-09-01',employmentEndedOn:null,usableIfContinued:true,sourceReference:'Reviewed earned leave and employment policy evidence',confirmed:true}
test('PTO retirement evidence validates explicit employee facts and is retained in payroll context',()=>{
 const b={payoutId:1,historyCompleteVerified:true,historySource:'Reviewed complete payroll history',retirementPtoEvidence:evidence}
 assert.deepEqual(validateOffCyclePto(b).retirementPtoEvidence,retirementPtoEvidenceInput(evidence))
 for(const patch of [{employmentStartedOn:undefined},{employmentEndedOn:'2026-08-31'},{employmentEndedOn:'2026-02-30'},{employmentPeriodId:0},{employmentPeriodId:'1'},{usableIfContinued:null},{sourceReference:'too short'},{sourceReference:'Invalid control\ncharacter in evidence'},{confirmed:false}])assert.throws(()=>retirementPtoEvidenceInput({...evidence,...patch}),{status:400})
 assert.equal(retirementPtoEvidenceInput({...evidence,compensation415Cents:999999}).compensation415Cents,undefined)
})
test('PTO retirement assesses actual scoped plan, reserved payout and employment sources through payroll APIs',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const h=await createHarness({retirementNow:()=>new Date('2026-09-11T12:00:00Z')});t.after(()=>h.close())
 const {api,employee,periods}=await regularRetirementFixture(h)
 const period=(await h.pool.query('SELECT id FROM payroll_employment_period WHERE employee_id=$1',[employee.id])).rows[0]
 let reviewed={...evidence,employmentPeriodId:Number(period.id)}
 await h.pool.query("INSERT INTO payroll_leave_transaction(facility_id,employee_id,leave_type,transaction_date,minutes,reason) VALUES(1,$1,'PTO','2026-09-01',480,'Synthetic earned vacation')",[employee.id])
 const policy={leaveType:'PTO',minutes:240,hourlyRateCents:2500,policyVerified:true,unusedVacationVerified:true,policyReference:'Actual retained vacation payout policy for this test'}
 const p=await api(`/employees/${employee.id}/leave-payout/preview`,policy)
 const payout=await api(`/employees/${employee.id}/leave-payouts`,{...policy,payPeriodId:periods[0].id,fingerprint:p.fingerprint,requestKey:randomUUID(),paymentMode:'STANDALONE'},'POST',201)
 const input={facility:1,employeeId:employee.id,planId:'standard',payoutId:payout.id,paymentDate:'2026-09-22',evidence:reviewed}
 let a=await retirementPtoAssessment(h.pool,input)
 assert.equal(a.status,'REVIEW_REQUIRED');assert.ok(a.issues.some(i=>i.includes('Record unused PTO')))
 const unusedPto={inServiceDeferrals:'INCLUDED',postSeveranceDeferrals:'INCLUDED',postSeverance415:'INCLUDED',limitationYear:'CALENDAR_YEAR',terms:'Retained actual plan cashout and post-employment compensation terms.'}
 await api('/retirement-plans',{plan:{...retirementPlanFixture(),unusedPto},expectedRevision:1,requestKey:randomUUID()})
 a=await retirementPtoAssessment(h.pool,input);assert.equal(a.status,'EVIDENCE_READY',JSON.stringify(a));assert.equal(a.compensation415Cents,10000)
 const before=a.fingerprint
 const missing=await retirementPtoAssessment(h.pool,{...input,evidence:undefined});assert.equal(missing.status,'REVIEW_REQUIRED')
 const foreign=await retirementPtoAssessment(h.pool,{...input,facility:2});assert.equal(foreign.status,'REVIEW_REQUIRED');assert.equal(foreign.source.payout,null);assert.deepEqual(foreign.source.employmentPeriods,[])
 const wrongPeriod=await retirementPtoAssessment(h.pool,{...input,evidence:{...reviewed,employmentPeriodId:Number(period.id)+99999}});assert.equal(wrongPeriod.status,'REVIEW_REQUIRED')
 await h.pool.query("UPDATE payroll_employment_period SET ended_on='2026-09-20' WHERE id=$1",[period.id])
 a=await retirementPtoAssessment(h.pool,input);assert.equal(a.status,'REVIEW_REQUIRED');assert.ok(a.issues.some(i=>i.includes('dates changed')));assert.notEqual(a.fingerprint,before)
 reviewed={...reviewed,employmentEndedOn:'2026-09-20'};input.evidence=reviewed
 a=await retirementPtoAssessment(h.pool,input);assert.equal(a.status,'EVIDENCE_READY')
 const noUse=await retirementPtoAssessment(h.pool,{...input,evidence:{...reviewed,usableIfContinued:false}});assert.equal(noUse.status,'REVIEW_REQUIRED');assert.equal(noUse.compensation415Cents,null)
 const body={payPeriodId:periods[0].id,paymentDate:'2026-09-22',offCyclePto:{payoutId:Number(payout.id),historyCompleteVerified:true,historySource:'Reconciled actual supplemental payment history',retirementPtoEvidence:reviewed}}
 const preview=(await api('/runs/preview',body)).preview
 assert.equal(preview.employees[0].retirementPtoAssessments[0].status,'EVIDENCE_READY')
 assert.ok(preview.warnings.some(w=>w.code==='RETIREMENT_OFF_CYCLE_REVIEW'));assert.equal(preview.canApprove,false)
 const run=await api('/runs',body,'POST',201)
 const stored=(await h.pool.query('SELECT calculation_snapshot FROM payroll_run WHERE id=$1',[run.id])).rows[0].calculation_snapshot
 assert.equal(stored.employees[0].retirementPtoAssessments[0].source.evidence.sourceReference,reviewed.sourceReference)
 await api('/retirement-plans',{plan:{...retirementPlanFixture(),unusedPto:{...unusedPto,limitationYear:'NON_CALENDAR_YEAR'}},expectedRevision:2,requestKey:randomUUID()})
 const changed=(await loadOffCyclePtoPreview(h.pool,1,periods[0].id,body.paymentDate,validateOffCyclePto(body.offCyclePto),run.id)).preview
 assert.notEqual(changed.employees[0].offcycleFingerprint,preview.employees[0].offcycleFingerprint)
 assert.ok(changed.warnings.some(w=>w.message.includes('limitation year')))
 await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH')
 await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH',409)
 await api('/retirement-plans',{plan:{...retirementPlanFixture(),unusedPto:{...unusedPto,postSeveranceDeferrals:'EXCLUDED',postSeverance415:'EXCLUDED'}},expectedRevision:3,requestKey:randomUUID()})
 const excluded=await retirementPtoAssessment(h.pool,{...input,evidence:{...reviewed,usableIfContinued:false}})
 assert.equal(excluded.status,'EVIDENCE_READY');assert.equal(excluded.compensation415Cents,0);assert.equal(excluded.deferralTreatment,'EXCLUDED')
 const unsupportedYear=await retirementPtoAssessment(h.pool,{...input,paymentDate:'2027-01-01'})
 assert.equal(unsupportedYear.status,'REVIEW_REQUIRED');assert.equal(unsupportedYear.compensation415Cents,null)
 await h.pool.query("INSERT INTO payroll_employment_period(facility_id,employee_id,started_on,pay_type,source) VALUES(1,$1,'2026-09-21','HOURLY','REHIRE')",[employee.id])
 const rehired=await retirementPtoAssessment(h.pool,input);assert.equal(rehired.status,'REVIEW_REQUIRED');assert.ok(rehired.issues.some(i=>i.includes('rehire')))

})
