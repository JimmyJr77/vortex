import test from 'node:test'
import assert from 'node:assert/strict'
import {w2DraftMapping} from '../w2DraftMapping.js'
import {compensationCategories} from '../compensationApplicability.js'
const fixture=()=>({employer:{revision:1,issue:null,marylandRegistrationLast4:'4567'},determination:{id:2,disposition:'REPORT'},employee:{employeeId:3,sourceFingerprint:'a'.repeat(64),sourceStatus:'READY_FOR_REVIEW',filingIdentity:{revision:4,issue:null},inputReviewHistory:[{id:5,status:'CURRENT'}],healthClassificationHistory:[{id:6,status:'CURRENT',determination_id:2,disposition:'REPORT',reportable_cost_cents:'690025'}],compensationApplicabilityHistory:[{id:7,status:'CURRENT',categories:Object.fromEntries(Object.keys(compensationCategories).map(key=>[key,'NOT_APPLICABLE']))}],wageInputs:{federal:'210000.00',maryland:'210000.00',socialSecurity:'184500.00',medicare:'210000.00'},withholding:{federal:'30000.00',maryland:'15000.00',socialSecurity:'11439.00',medicare:'3045.00',additionalMedicare:'90.00',combinedMedicare:'3135.00'},reviewedQualifiedOvertime:'30000.00'}})
const map=f=>w2DraftMapping(1,f.employer,f.employee,f.determination)
test('W-2 draft maps exact wages, combined Medicare, full TT and verified DD with reviewed blank categories',()=>{
 const f=fixture(),draft=map(f);assert.equal(draft.status,'DRAFT_REVIEW_REQUIRED');assert.equal(draft.boxes.box6,'3135.00');assert.equal(draft.boxes.box17,'15000.00');assert.equal(draft.boxes.box19,null);assert.deepEqual(draft.boxes.box12,[{code:'DD',amount:'6900.25'},{code:'TT',amount:'30000.00'}]);assert.equal(draft.boxes.box15.employerIdentityRevision,1);assert.equal(draft.boxes.box13.retirementPlan,false);assert.equal(map(f).fingerprint,draft.fingerprint)
 f.employee.healthClassificationHistory[0].id=8;assert.notEqual(map(f).fingerprint,draft.fingerprint)
 f.determination.disposition='SMALL_EMPLOYER_RELIEF';f.employee.healthClassificationHistory[0].disposition='RELIEF_USED';f.employee.healthClassificationHistory[0].reportable_cost_cents=null;f.employee.reviewedQualifiedOvertime='0.00';assert.deepEqual(map(f).boxes.box12,[])
})
test('W-2 draft refuses missing, stale, unresolved or unsupported reporting evidence',()=>{
 for(const mutate of [f=>f.employee.inputReviewHistory=[],f=>f.employee.healthClassificationHistory[0].status='STALE',f=>f.employee.healthClassificationHistory[0].disposition='UNRESOLVED',f=>f.employee.compensationApplicabilityHistory[0].categories.tips='APPLICABLE',f=>delete f.employee.compensationApplicabilityHistory[0].categories.other,f=>f.employee.withholding.combinedMedicare='1.00',f=>f.employee.wageInputs.federal=null,f=>f.employer.marylandRegistrationLast4=null,f=>f.determination.disposition='UNRESOLVED']){const f=fixture();mutate(f);const draft=map(f);assert.equal(draft.boxes,null);assert.equal(draft.fingerprint,null);assert.ok(draft.issues.length)}
})

test('employer-only retirement participation marks box 13 without inventing deferral amounts',()=>{
 const f=fixture(),before=map(f);f.employee.compensationApplicabilityHistory[0].categories.retirement='EMPLOYER_ONLY_PARTICIPATION';const after=map(f)
 assert.equal(after.boxes.box13.retirementPlan,true);assert.deepEqual(after.boxes.box12,before.boxes.box12);assert.notEqual(after.fingerprint,before.fingerprint)
 f.employee.compensationApplicabilityHistory[0].status='STALE';assert.equal(map(f).boxes,null)
})

test('retained employee deferrals cannot disappear through a no-retirement applicability choice',()=>{
 const {employer,determination,employee}=fixture()
 employee.retirementContributions={status:'RECONCILED',hasEmployeeDeferrals:true,pretaxDeferrals:'100.00',rothDeferrals:'50.00'}
 const mapped=w2DraftMapping(1,employer,employee,determination)
 assert.equal(mapped.status,'REVIEW_REQUIRED');assert.equal(mapped.boxes,null)
 assert.ok(mapped.issues.some(issue=>issue.includes('contribution-code reporting')))
 employee.compensationApplicabilityHistory[0].categories.retirement='EMPLOYER_ONLY_PARTICIPATION'
 assert.equal(w2DraftMapping(1,employer,employee,determination).status,'REVIEW_REQUIRED')
})

test('reviewed standard 401k deferrals map D and AA with participation while retaining DD and TT',()=>{
 const f=fixture();f.employee.compensationApplicabilityHistory[0].categories.retirement='STANDARD_401K_DEFERRALS'
 f.employee.retirementContributions={year:2026,status:'RECONCILED',hasEmployeeDeferrals:true,pretaxDeferrals:'100.00',rothDeferrals:'50.00',records:[{runId:'1',planId:'standard',paymentDate:'2026-09-15',ordinaryPretaxCents:10000,ordinaryRothCents:2000,catchUpPretaxCents:0,catchUpRothCents:3000}]}
 const draft=map(f);assert.equal(draft.status,'DRAFT_REVIEW_REQUIRED');assert.equal(draft.boxes.box13.retirementPlan,true)
 assert.deepEqual(draft.boxes.box12,[{code:'D',amount:'100.00'},{code:'AA',amount:'50.00'},{code:'DD',amount:'6900.25'},{code:'TT',amount:'30000.00'}])
 assert.equal(draft.boxes.box1,f.employee.wageInputs.federal)
 f.employee.retirementContributions.pretaxDeferrals='101.00';assert.equal(map(f).boxes,null)
})
