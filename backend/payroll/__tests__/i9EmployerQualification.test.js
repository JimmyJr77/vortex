import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {employerI9ReviewFixture} from '../testing/employerI9ReviewFixture.js'
test('employer reviews use current qualification without changing signed Section 1',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='98'.repeat(32);t.after(()=>{if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const h=await createHarness();t.after(()=>h.close())
 const {api,base,draft,reviewBody}=await employerI9ReviewFixture(h,{alternative:true})
 const before=(await h.pool.query('SELECT * FROM payroll_i9_submission')).rows
 const current=await api('/i9/qualification'),findings={siteName:'Synthetic site',eVerifyEnrolled:true,goodStanding:false,allSitesEnrolled:true,trainingComplete:true,consistentProcedure:true,observedOn:current.today,evidence:'Good standing could not be confirmed in current employer review.'}
 await api('/i9/qualification',{findings,expectedRevision:0,requestKey:randomUUID()})
 await api(base+'/employer-page',{...reviewBody,documentKey:'main',page:1,displayed:true},'POST',409)
 const stale=await api(base+'/employer-draft?onboardingCycle=1');assert.equal(stale.invalidated,true);assert.equal(stale.draft,null)
 const saved=await api(base+'/employer-draft',{onboardingCycle:1,expectedRevision:stale.revision,basisHash:stale.basisHash,requestKey:randomUUID(),draft})
 const next=await api(base+'/employer-preview',{onboardingCycle:1,expectedRevision:saved.revision,basisHash:saved.basisHash})
 assert.equal(next.examinationContext.eVerify,false);assert.equal(next.examinationContext.qualification.revision,1)
 await api('/i9/qualification',{findings:{...findings,goodStanding:true,evidence:'Current good standing is verified with employer records.'},expectedRevision:1,requestKey:randomUUID()})
 await api(base+'/employer-page',{onboardingCycle:1,reviewId:next.reviewId,previewSha256:next.previewSha256,documentKey:'main',page:1,displayed:true},'POST',409)
 const refreshed=await api(base+'/employer-draft?onboardingCycle=1'),savedAgain=await api(base+'/employer-draft',{onboardingCycle:1,expectedRevision:refreshed.revision,basisHash:refreshed.basisHash,requestKey:randomUUID(),draft})
 const qualified=await api(base+'/employer-preview',{onboardingCycle:1,expectedRevision:savedAgain.revision,basisHash:savedAgain.basisHash})
 assert.equal(qualified.examinationContext.eVerify,true);assert.equal(qualified.examinationContext.qualification.revision,2)
 assert.deepEqual((await h.pool.query('SELECT * FROM payroll_i9_submission')).rows,before)
})
