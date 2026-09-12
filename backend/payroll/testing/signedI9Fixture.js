import {randomUUID} from 'node:crypto'
import {monthlyBenefitsFixture} from './monthlyBenefitsFixture.js'
export async function signedI9Fixture(h,{assisted=true}={}){
 const {api,employee}=await monthlyBenefitsFixture(h),task=(await api('/onboarding',undefined,'GET',200,true)).tasks.find(t=>t.task_key==='I9'),path=`/onboarding/${task.id}/i9`
 await api(`/employees/${employee.id}/onboarding/${task.id}/i9/context`,{onboardingCycle:1,expectedRevision:0,offerAccepted:true,offerAcceptedOn:'2026-09-01',eVerify:false,evidence:'Synthetic accepted offer and hiring-site participation reviewed.'})
 const initial=await api(path+'/draft?onboardingCycle=1',undefined,'GET',200,true)
 const draft={lastName:'Żółć',firstName:'Łukasz',address:'100 Example Street',city:'Bowie',state:'MD',postalCode:'20715',dateOfBirth:'2000-01-01',ssn:'123456789',attestationKind:'CITIZEN',ssnPending:false,preparerAssisted:assisted}
 const saved=await api(path+'/draft',{draft,expectedRevision:0,baseResponseHash:initial.baseResponseHash,onboardingCycle:1,requestKey:randomUUID()},'POST',200,true)
 const preview=await api(path+'/preview',{onboardingCycle:1,expectedRevision:saved.revision,baseResponseHash:saved.baseResponseHash},'POST',200,true)
 for(let page=1;page<=4;page++)await api(path+'/page',{onboardingCycle:1,reviewId:preview.reviewId,previewSha256:preview.previewSha256,page,displayed:true},'POST',200,true)
 const signed=await api(path+'/sign',{onboardingCycle:1,reviewId:preview.reviewId,previewSha256:preview.previewSha256,signature:'Łukasz Żółć',attestation:preview.attestation,attestationRead:true,reviewedAllPages:true,signingAsEmployee:true,requestKey:randomUUID()},'POST',200,true)
 return {api,employee,task,signed}
}
