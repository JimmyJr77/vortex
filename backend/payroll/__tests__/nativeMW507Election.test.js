import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {marylandChoicesFromMW507,nativeMW507Election} from '../nativeMW507Election.js'
import {syntheticMw507} from '../testing/mw507Fixture.js'
import {createHarness} from '../testing/harness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
test('MW507 source preserves distinct rates, blank entries and state/local exemption claims',()=>{
 const a=syntheticMw507()
 for(const [rate,status] of [['SINGLE','SINGLE'],['MARRIED','JOINT'],['MARRIED_SINGLE','SINGLE']])assert.equal(marylandChoicesFromMW507({...a,withholdingRate:rate}).filingStatus,status)
 const pa={...a,withholdingRate:null,exemptions:null,additionalWithholdingCents:null,claim:{kind:'PENNSYLVANIA',noMarylandAbode:true,localExemption:'NONE'}}
 const stateOnly=marylandChoicesFromMW507(pa);assert.equal(stateOnly.stateExempt,true);assert.equal(stateOnly.localExempt,false);assert.equal(stateOnly.filingStatus,null);assert.equal(stateOnly.exemptions,null)
 assert.equal(marylandChoicesFromMW507({...pa,claim:{...pa.claim,localExemption:'YORK_ADAMS'}}).localExempt,true)
 assert.equal(JSON.stringify(stateOnly).includes(a.personal.ssn),false)
})
test('admin MW507 source follows current signed cycle, exposes no identity and changes with an amendment',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='68'.repeat(32)
 t.after(()=>{if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const h=await createHarness();t.after(()=>h.close());const {api,employee}=await monthlyBenefitsFixture(h)
 const task=(await api('/onboarding',undefined,'GET',200,true)).tasks.find(t=>t.task_key==='STATE_WITHHOLDING'),path=`/onboarding/${task.id}/mw507`,answers=syntheticMw507()
 assert.equal(await nativeMW507Election(h.pool,1,employee.id),null)
 const sign=async()=>{const p=await api(`${path}/preview`,{answers,onboardingCycle:1},'POST',200,true);for(let page=1;page<=2;page++)await api(`${path}/page`,{reviewId:p.reviewId,previewSha256:p.previewSha256,page,displayed:true,onboardingCycle:1},'POST',200,true);return api(`${path}/sign`,{reviewId:p.reviewId,previewSha256:p.previewSha256,onboardingCycle:1,signature:'Synthetic signer',perjury:p.perjury,confirmed:true,reviewedAllPages:true,requestKey:randomUUID()},'POST',200,true)}
 const signed=await sign(),get=()=>api(`/employees/${employee.id}/tax-elections`),pending=await get(),source=pending.nativeMW507
 assert.equal(source.submissionId,signed.submissionId);assert.equal(source.reviewed,false);assert.equal(source.choices.extraWithholdingCents,1250);assert.equal(source.requirements.additionalAgreementRequired,true);assert.match(source.receivedOn,/^2026-/)
 for(const privateValue of Object.values(answers.personal))assert.equal(JSON.stringify(source).includes(privateValue),false)
 assert.equal(await nativeMW507Election(h.pool,2,employee.id),null)
 await api(`/employees/${employee.id}/onboarding/${task.id}/review`,{status:'COMPLETE',note:'Reviewed retained synthetic Maryland certificate',onboardingCycle:1})
 assert.equal((await get()).nativeMW507.reviewed,true)
 await api(`/employees/${employee.id}/onboarding/${task.id}/review`,{status:'CHANGES_REQUESTED',note:'Employee requested updated exemption choices',onboardingCycle:1})
 answers.additionalWithholdingCents=2500;const next=await sign(),amended=(await get()).nativeMW507
 assert.equal(amended.submissionId,next.submissionId);assert.notEqual(amended.fingerprint,source.fingerprint);assert.equal(amended.choices.extraWithholdingCents,2500)
 // A stale task reference must not load an earlier signed certificate as current.
 await h.pool.query("UPDATE payroll_onboarding_task SET response=jsonb_set(response,'{mw507SubmissionId}',$2::jsonb) WHERE id=$1",[task.id,JSON.stringify(signed.submissionId)])
 await assert.rejects(()=>nativeMW507Election(h.pool,1,employee.id),/source changed/)
})
