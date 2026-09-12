import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
import {syntheticMw507} from '../testing/mw507Fixture.js'
import {calculateWithholding2026} from '../withholding2026.js'
test('signed Maryland values require exact reviewed source and employer evidence; amendments invalidate application',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='68'.repeat(32);t.after(()=>{if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const h=await createHarness();t.after(()=>h.close());const {api,employee}=await monthlyBenefitsFixture(h)
 const task=(await api('/onboarding',undefined,'GET',200,true)).tasks.find(t=>t.task_key==='STATE_WITHHOLDING'),path=`/onboarding/${task.id}/mw507`,answers={...syntheticMw507(),additionalWithholdingCents:0}
 const sign=async()=>{const p=await api(`${path}/preview`,{answers,onboardingCycle:1},'POST',200,true);for(let page=1;page<=2;page++)await api(`${path}/page`,{reviewId:p.reviewId,previewSha256:p.previewSha256,page,displayed:true,onboardingCycle:1},'POST',200,true);return api(`${path}/sign`,{reviewId:p.reviewId,previewSha256:p.previewSha256,onboardingCycle:1,signature:'Synthetic signer',perjury:p.perjury,confirmed:true,reviewedAllPages:true,requestKey:randomUUID()},'POST',200,true)}
 const get=()=>api(`/employees/${employee.id}/tax-elections`),save=(body,status=200)=>api(`/employees/${employee.id}/tax-elections`,body,'PATCH',status)
 const body=data=>({federal:data.election.elections.federal,maryland:{filingStatus:data.nativeMW507.choices.filingStatus,exemptions:data.nativeMW507.choices.exemptions,extraWithholdingCents:data.nativeMW507.choices.extraWithholdingCents,exempt:false,localRate:3.2},mw507SubmissionId:data.nativeMW507.submissionId,mw507Fingerprint:data.nativeMW507.fingerprint,confirmed:true,sourceNote:'Reviewed synthetic signed Maryland certificate and local table',mw507EmployerReview:{correctnessConfirmed:true,noRevocationConfirmed:true,localRateConfirmed:true,correctnessEvidence:'Reviewed retained certificate and employer correspondence',localRateEvidence:'Synthetic Maryland resident and verified local table'}})
 const review=()=>api(`/employees/${employee.id}/onboarding/${task.id}/review`,{status:'COMPLETE',note:'Reviewed retained signed Maryland certificate',onboardingCycle:1})
 const first=await sign();await save(body(await get()),409);await review();const ready=body(await get())
 await save({...ready,mw507Fingerprint:'a'.repeat(64)},409)
 await save({...ready,maryland:{...ready.maryland,exemptions:1}},409)
 await save({...ready,mw507EmployerReview:{}},409)
 await save({...ready,mw507EmployerReview:{...ready.mw507EmployerReview,noRevocationConfirmed:false}},409)
 await save(ready)
 const applied=(await get()).election.elections
 assert.equal(applied.mw507ReviewRequired,undefined);assert.equal(applied.mw507Source.submissionId,first.submissionId);assert.equal(applied.maryland.exemptions,5)
 assert.equal(applied.mw507Source.review.correctnessEvidence,ready.mw507EmployerReview.correctnessEvidence)
 assert.ok(Number.isInteger(calculateWithholding2026({grossPayCents:200000,election:{...applied,verified:true},payFrequency:'SEMIMONTHLY',year:2026,workState:'MD',residenceState:'MD'}).stateIncomeTaxCents))
 const audit=(await h.pool.query("SELECT after_data FROM payroll_audit_log WHERE action='TAX_ELECTIONS_VERIFIED' AND entity_id=$1 ORDER BY id DESC LIMIT 1",[String(employee.id)])).rows[0].after_data
 assert.equal(audit.elections.mw507Source.fingerprint,ready.mw507Fingerprint)
 await api(`/employees/${employee.id}/onboarding/${task.id}/review`,{status:'CHANGES_REQUESTED',note:'Employee requested new exemption count',onboardingCycle:1})
 answers.exemptions=3;await sign();const pending=(await get()).election.elections
 assert.throws(()=>calculateWithholding2026({grossPayCents:200000,election:{...pending,verified:true},payFrequency:'SEMIMONTHLY',year:2026,workState:'MD',residenceState:'MD'}),/latest employee-signed MW507/)
 await review();await save(ready,409);await save(body(await get()));assert.equal((await get()).election.elections.maryland.exemptions,3)
})

test('employer review requires submission evidence when the signed certificate has more than ten exemptions',async()=>{
 const {mw507EmployerReview}=await import('../mw507EmployerReview.js')
 const source={reviewed:true,submissionId:'1',documentId:'2',fingerprint:'a'.repeat(64),receivedOn:'2026-09-12',onboardingCycle:1,choices:{claim:{kind:'NONE'},filingStatus:'SINGLE',exemptions:11,extraWithholdingCents:0},requirements:{comptrollerSubmissionReasons:['MORE_THAN_TEN_EXEMPTIONS'],additionalAgreementRequired:false}}
 const body={mw507SubmissionId:'1',mw507Fingerprint:source.fingerprint,maryland:{filingStatus:'SINGLE',exemptions:11,extraWithholdingCents:0,exempt:false,localRate:3.2},mw507EmployerReview:{correctnessConfirmed:true,noRevocationConfirmed:true,localRateConfirmed:true,correctnessEvidence:'Reviewed synthetic certificate correctness',localRateEvidence:'Reviewed Maryland residence and local table'}}
 const employee={work_state:'MD',residence_state:'MD'}
 assert.throws(()=>mw507EmployerReview(source,body,employee),/Comptroller certificate submission/)
 body.mw507EmployerReview.comptrollerSubmissionEvidence='Synthetic retained delivery reference and date'
 assert.equal(mw507EmployerReview(source,body,employee).review.comptrollerSubmissionEvidence,body.mw507EmployerReview.comptrollerSubmissionEvidence)
 assert.throws(()=>mw507EmployerReview({...source,choices:{...source.choices,claim:{kind:'PENNSYLVANIA'}}},body,employee),/exemption or nonresident/)
 assert.throws(()=>mw507EmployerReview(source,body,{...employee,residence_state:'PA'}),/exemption or nonresident/)
})
