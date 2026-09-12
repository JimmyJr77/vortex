import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {signedI9Fixture} from '../testing/signedI9Fixture.js'
import {registerPayrollPreparerRoutes} from '../i9PreparerRoutes.js'
test('preparer routes use a separate explicit rate-limited namespace',()=>{
 const routes=[],app={get:(path,...handlers)=>routes.push(['GET',path,handlers.length]),post:(path,...handlers)=>routes.push(['POST',path,handlers.length])}
 registerPayrollPreparerRoutes(app,{})
 assert.deepEqual(routes,[['GET','/api/payroll/preparer/me',2],['POST','/api/payroll/preparer/preview',2],['POST','/api/payroll/preparer/page',2],['POST','/api/payroll/preparer/sign',2],['GET','/api/payroll/preparer/document',2]])
})
test('foreign admin scope is denied and a real employee amendment invalidates old preparer review',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='93'.repeat(32);t.after(()=>{if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const h=await createHarness();t.after(()=>h.close());const {api,employee,task,signed}=await signedI9Fixture(h),base=`/employees/${employee.id}/onboarding/${task.id}/i9/preparers`
 const denied=await fetch(`${h.url}/api/admin/payroll${base}?onboardingCycle=1`,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}});assert.equal(denied.status,404)
 const invite=await api(base,{onboardingCycle:1,submissionId:signed.submissionId,name:'Alice Translator',email:'alice@example.test',evidence:'Synthetic verified preparer identity and private contact.',confirmed:true,requestKey:randomUUID()})
 const guest=async(path,body,status=200)=>{const r=await fetch(`${h.url}/api/payroll/preparer/${path}`,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${invite.token}`,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});assert.equal(r.status,status);return (await r.json()).data}
 const p=await guest('preview',{preparer:{firstName:'Alice',lastName:'Translator',middleInitial:'',address:'20 Example Road',city:'Bowie',state:'MD',postalCode:'20715'}})
 const path=`/onboarding/${task.id}/i9`,initial=await api(path+'/draft?onboardingCycle=1',undefined,'GET',200,true)
 const draft={lastName:'Żółć',firstName:'Łukasz',address:'200 Amended Street',city:'Bowie',state:'MD',postalCode:'20715',dateOfBirth:'2000-01-01',ssn:'123456789',attestationKind:'CITIZEN',ssnPending:false,preparerAssisted:true}
 const saved=await api(path+'/draft',{draft,expectedRevision:initial.revision,baseResponseHash:initial.baseResponseHash,onboardingCycle:1,requestKey:randomUUID()},'POST',200,true)
 const preview=await api(path+'/preview',{onboardingCycle:1,expectedRevision:saved.revision,baseResponseHash:saved.baseResponseHash},'POST',200,true)
 for(let page=1;page<=4;page++)await api(path+'/page',{onboardingCycle:1,reviewId:preview.reviewId,previewSha256:preview.previewSha256,page,displayed:true},'POST',200,true)
 await api(path+'/sign',{onboardingCycle:1,reviewId:preview.reviewId,previewSha256:preview.previewSha256,signature:'Łukasz Żółć',attestation:preview.attestation,attestationRead:true,reviewedAllPages:true,signingAsEmployee:true,requestKey:randomUUID()},'POST',200,true)
 assert.equal((await guest('me')).current,false)
 await guest('page',{reviewId:p.reviewId,previewSha256:p.previewSha256,displayed:true},409)
 await guest('sign',{reviewId:p.reviewId,previewSha256:p.previewSha256,signature:'Alice Translator',attestation:p.attestation,attestationRead:true,reviewed:true,signingAsPreparer:true,requestKey:randomUUID()},409)
 assert.equal((await api(base+'?onboardingCycle=1')).requests.length,0)
 await api(`/employees/${employee.id}/onboarding/${task.id}/review`,{onboardingCycle:1,status:'COMPLETE',note:'Cannot approve an amendment using old preparer work.'},'POST',409)
})
