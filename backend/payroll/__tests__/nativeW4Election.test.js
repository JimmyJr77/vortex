import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
import {calculateWithholding2026} from '../withholding2026.js'

test('signed W-4 prepopulates exact federal elections and amendments invalidate old automatic withholding',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='89'.repeat(32)
 t.after(()=>{if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const h=await createHarness();t.after(()=>h.close())
 const {api,employee}=await monthlyBenefitsFixture(h),packet=()=>api('/onboarding',undefined,'GET',200,true)
 const task=(await packet()).tasks.find(t=>t.task_key==='W4'),path=`/onboarding/${task.id}/w4`
 const answers={year:2026,personal:{firstNameMiddleInitial:'Synthetic',lastName:'Employee',address:'123 Test Street',cityStateZip:'Bowie MD 20715',ssn:'123456789'},filingStatus:'HEAD_OF_HOUSEHOLD',twoJobs:true,exempt:false,nonresidentAlien:false,creditsCents:12555,extraWithholdingCents:4250}
 const sign=async()=>{const p=await api(`${path}/preview`,{answers,onboardingCycle:1},'POST',200,true);for(let page=1;page<=5;page++)await api(`${path}/page`,{reviewId:p.reviewId,previewSha256:p.previewSha256,onboardingCycle:1,page,displayed:true},'POST',200,true);return api(`${path}/sign`,{reviewId:p.reviewId,previewSha256:p.previewSha256,onboardingCycle:1,signature:'Synthetic Employee',perjury:p.perjury,confirmed:true,reviewedAllPages:true,requestKey:randomUUID()},'POST',200,true)}
 const signed=await sign(),get=()=>api(`/employees/${employee.id}/tax-elections`),pending=await get()
 assert.equal(pending.nativeW4.submissionId,signed.submissionId);assert.equal(pending.nativeW4.reviewed,false)
 assert.equal(pending.nativeW4.federal.extraWithholdingCents,4250);assert.equal(pending.nativeW4.federal.creditsCents,12555)
 assert.equal(JSON.stringify(pending).includes(answers.personal.ssn),false)
 const body=data=>({federal:data.nativeW4.federal,maryland:data.election.elections.maryland,w4SubmissionId:data.nativeW4.submissionId,w4Fingerprint:data.nativeW4.fingerprint,confirmed:true,sourceNote:'Reviewed internal signed W-4 and synthetic signed Maryland certificate'})
 const save=(data,status=200)=>api(`/employees/${employee.id}/tax-elections`,data,'PATCH',status)
 await save(body(pending),409)
 await api(`/onboarding/${task.id}`,{confirmed:true,reference:'Replacement unsigned description',onboardingCycle:1},'POST',409,true)
 const review=()=>api(`/employees/${employee.id}/onboarding/${task.id}/review`,{status:'COMPLETE',note:'Reviewed the retained employee-signed W-4 PDF',onboardingCycle:1})
 await review();const reviewed=await get()
 await save({...body(reviewed),w4Fingerprint:'a'.repeat(64)},409)
 await save({...body(reviewed),federal:{...reviewed.nativeW4.federal,creditsCents:1}},409)
 await save(body(reviewed))
 const applied=(await get()).election.elections
 assert.deepEqual(applied.federal,reviewed.nativeW4.federal);assert.equal(applied.w4Source.submissionId,signed.submissionId);assert.equal(applied.w4ReviewRequired,undefined)
 assert.ok(Number.isInteger(calculateWithholding2026({grossPayCents:200000,election:{...applied,verified:true},payFrequency:'SEMIMONTHLY',year:2026,workState:'MD',residenceState:'MD'}).federalIncomeTaxCents))
 await api(`/employees/${employee.id}/onboarding/${task.id}/review`,{status:'CHANGES_REQUESTED',note:'Employee requested an amended extra withholding amount',onboardingCycle:1})
 await api(`/onboarding/${task.id}/draft`,{onboardingCycle:1,note:'Generic draft must not erase the signed W-4 reference'},'POST',409,true)
 answers.extraWithholdingCents=7000;const amendment=await sign(),stale=(await get()).election.elections
 assert.throws(()=>calculateWithholding2026({grossPayCents:200000,election:{...stale,verified:true},payFrequency:'SEMIMONTHLY',year:2026,workState:'MD',residenceState:'MD'}),/latest employee-signed W-4/)
 await review();await save(body(reviewed),409)
 const changed=await get();assert.equal(changed.nativeW4.submissionId,amendment.submissionId)
 await save(body(changed));assert.equal((await get()).election.elections.federal.extraWithholdingCents,7000)
 assert.equal((await h.pool.query('SELECT count(*)::int n FROM payroll_w4_submission WHERE employee_id=$1',[employee.id])).rows[0].n,2)
})
