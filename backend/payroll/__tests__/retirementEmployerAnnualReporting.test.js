import {PDFDocument} from 'pdf-lib'
import {randomBytes} from 'node:crypto'
import test from 'node:test'
import assert from 'node:assert/strict'
import {createHistoricalHarness} from '../testing/historicalHarness.js'
import {regularEmployerRetirementFixture} from '../testing/regularEmployerRetirementFixture.js'
import {retirementAnnualReporting} from '../retirementAnnualReporting.js'
import {w2DraftMapping} from '../w2DraftMapping.js'
import {compensationCategories} from '../compensationApplicability.js'
for(const declined of [false,true])test(`annual ${declined?'employer-only':'combined'} obligations require participation review without adding employer funding to employee deferral codes`,{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const oldKey=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex');t.after(()=>{if(oldKey===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=oldKey})
 const h=await createHistoricalHarness(t,{},'2026-09-16T16:00:00.000Z');t.after(()=>h.close())
 const {api,employee,periods}=await regularEmployerRetirementFixture(h,{declined})
 const run=await api('/runs',{payPeriodId:periods[0].id},'POST',201)
 await api(`/runs/${run.id}/status`,{status:'REVIEW'},'PATCH');await api(`/runs/${run.id}/status`,{status:'APPROVED'},'PATCH')
 assert.equal(await retirementAnnualReporting(h.pool,1,employee.id),null)
 await api(`/runs/${run.id}/finalize`,{paymentDate:'2026-09-18',paymentConfirmationReference:'SYNTHETIC-EMPLOYER-ANNUAL'})
 const report=await retirementAnnualReporting(h.pool,1,employee.id)
 assert.equal(report.hasEmployerContributions,true)
 assert.equal(report.employerMatching,declined?'0.00':'6.00');assert.equal(report.employerNonelective,'4.00')
 assert.equal(report.pretaxDeferrals,declined?'0.00':'10.00');assert.equal(report.rothDeferrals,declined?'0.00':'4.00')
 assert.equal(report.records[0].employerMatchingCents,declined?0:600);assert.equal(report.records[0].employerNonelectiveCents,400)
 assert.equal(await retirementAnnualReporting(h.pool,2,employee.id),null)
 const identity={identifier:'123456789',legalName:'Synthetic Employer',firstName:'Monthly',lastName:'Benefits',address:{line1:'123 Test Street',city:'Bowie',state:'MD',postalCode:'20715',country:'US'},reference:'Synthetic verified employer contribution annual identity',confirmed:true,expectedRevision:0,marylandRegistrationNumber:'01234567'}
 await api('/filing-identity',identity,'POST',201);await api(`/employees/${employee.id}/filing-identity`,identity,'POST',201)
 const overtime=(await api('/reports/overtime-review?year=2026')).records[0]
 await api(`/runs/${run.id}/employees/${employee.id}/overtime-qualification`,{sourceFingerprint:overtime.sourceFingerprint,expectedReviewId:0,qualifiedPremiumCents:0,flsaStatus:'FLSA_REQUIRED',reference:'Synthetic reviewed employer contribution payroll overtime',confirmed:true},'POST',201)
 const prepared=(await api('/reports/year-end-preparation?year=2026')).employees[0]
 assert.equal(prepared.sourceStatus,'READY_FOR_REVIEW');assert.deepEqual(prepared.retirementContributions,report)
 const applicability={year:2026,confirmed:true,expectedRevision:0,sourceFingerprint:prepared.sourceFingerprint,reference:'Reviewed employer-only participation and current contribution allocation evidence',categories:Object.fromEntries(Object.keys(compensationCategories).map(key=>[key,'NOT_APPLICABLE']))}
 const reviewPath=`/employees/${employee.id}/compensation-applicability`
 await api(reviewPath,applicability,'POST',409)
 applicability.categories.retirement=declined?'EMPLOYER_ONLY_PARTICIPATION':'STANDARD_401K_DEFERRALS'
 applicability.retirementEmployerOnlyConfirmed=true;applicability.retirementStandard401kConfirmed=true
 await api(reviewPath,applicability,'POST',201)
 assert.equal((await api(reviewPath,applicability)).reused,true)
 const annualEmployee={employeeId:employee.id,sourceFingerprint:'a'.repeat(64),sourceStatus:'READY_FOR_REVIEW',filingIdentity:{revision:4},inputReviewHistory:[{id:5,status:'CURRENT'}],healthClassificationHistory:[{id:6,status:'CURRENT',determination_id:2,disposition:'NO_APPLICABLE_COVERAGE'}],compensationApplicabilityHistory:[{id:7,status:'CURRENT',categories:Object.fromEntries(Object.keys(compensationCategories).map(key=>[key,'NOT_APPLICABLE']))}],wageInputs:{federal:'200.00',maryland:'200.00',socialSecurity:'200.00',medicare:'200.00'},withholding:{federal:'0.00',maryland:'0.00',socialSecurity:'12.40',medicare:'2.90',additionalMedicare:'0.00',combinedMedicare:'2.90'},reviewedQualifiedOvertime:'0.00',retirementContributions:report}
 const map=()=>w2DraftMapping(1,{revision:1,marylandRegistrationLast4:'4567'},annualEmployee,{id:2,disposition:'SMALL_EMPLOYER_RELIEF'})
 assert.equal(map().status,'REVIEW_REQUIRED');assert.equal(map().boxes,null)
 annualEmployee.compensationApplicabilityHistory[0].categories.retirement=declined?'EMPLOYER_ONLY_PARTICIPATION':'STANDARD_401K_DEFERRALS'
 const mapped=map();assert.equal(mapped.status,'DRAFT_REVIEW_REQUIRED');assert.equal(mapped.boxes.box13.retirementPlan,true)
 assert.deepEqual(mapped.boxes.box12,declined?[]:[{code:'D',amount:'10.00'},{code:'AA',amount:'4.00'}])
 const health=await api('/health-coverage-reporting',{year:2026,disposition:'SMALL_EMPLOYER_RELIEF',priorYearW2Count:1,expectedRevision:0,reference:'Synthetic verified prior-year small-employer reporting count',confirmed:true},'POST',201)
 await api(`/employees/${employee.id}/health-coverage-classification`,{year:2026,determinationId:health.revision,sourceFingerprint:prepared.sourceFingerprint,expectedRevision:0,disposition:'RELIEF_USED',reportableCostCents:null,reference:'Synthetic reviewed small-employer relief for coverage',confirmed:true},'POST',201)
 await api(`/employees/${employee.id}/annual-input-review`,{year:2026,sourceFingerprint:prepared.sourceFingerprint,expectedReviewId:0,reference:'Synthetic verified annual wages and employer contribution evidence',confirmed:true},'POST',201)
 const actualDraft=(await api('/reports/year-end-preparation?year=2026')).employees[0].w2Draft
 assert.equal(actualDraft.status,'DRAFT_REVIEW_REQUIRED');assert.equal(actualDraft.boxes.box13.retirementPlan,true);assert.deepEqual(actualDraft.boxes.box12,mapped.boxes.box12)
 const approval=await api(`/employees/${employee.id}/w2-approval`,{year:2026,draftFingerprint:actualDraft.fingerprint,expectedRevision:0,reference:'Synthetic approved employer participation and unchanged employee deferral codes',confirmed:true},'POST',201)
 const pdf=await fetch(`${h.url}/api/admin/payroll/employees/${employee.id}/w2-approval/${approval.revision}/pdf`,{headers:{Authorization:'Bearer payroll-test-admin'}})
 assert.equal(pdf.status,200)
 const packet=await PDFDocument.load(await pdf.arrayBuffer());assert.equal(packet.getPageCount(),6);assert.equal(packet.getForm().getFields().length,0)
 const retained=(await h.pool.query('SELECT calculation_snapshot FROM payroll_run WHERE id=$1',[run.id])).rows[0].calculation_snapshot
 for(const mutation of ['omitted','redistributed']){
  const changed=structuredClone(retained),participant=changed.employees.find(e=>e.employeeId===employee.id)
  if(mutation==='omitted')delete participant.employerRetirementPlans
  else for(const amounts of [participant.employerRetirementPlans[0].calculation.contribution.proposed,participant.employerRetirementPlans[0].calculation.contribution.required]){amounts.matchingCents++;amounts.nonelectiveCents--}
  await h.pool.query('UPDATE payroll_run SET calculation_snapshot=$1 WHERE id=$2',[changed,run.id])
  await assert.rejects(retirementAnnualReporting(h.pool,1,employee.id),/Employer retirement/)
  const uncertain=(await api('/reports/year-end-preparation?year=2026')).employees[0]
  assert.equal(uncertain.sourceStatus,'NEEDS_RECONCILIATION');assert.equal(uncertain.retirementContributions,undefined)
  assert.equal(uncertain.w2Draft.boxes,null);assert.equal(uncertain.w2ApprovalHistory[0].status,'STALE')
  await api(`/employees/${employee.id}/w2-approval`,{year:2026,draftFingerprint:actualDraft.fingerprint,expectedRevision:approval.revision,reference:'Synthetic changed employer contribution evidence must invalidate approval',confirmed:true},'POST',409)
  await h.pool.query('UPDATE payroll_run SET calculation_snapshot=$1 WHERE id=$2',[retained,run.id])
 }
 assert.deepEqual(await retirementAnnualReporting(h.pool,1,employee.id),report)
 await h.pool.query("UPDATE payroll_run SET status='VOID' WHERE id=$1",[run.id])
 assert.equal(await retirementAnnualReporting(h.pool,1,employee.id),null)
 assert.equal((await h.pool.query('SELECT count(*)::int n FROM payroll_retirement_employer_run_ledger WHERE run_id=$1',[run.id])).rows[0].n,1)

})
