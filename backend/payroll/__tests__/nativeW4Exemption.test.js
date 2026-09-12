import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {monthlyBenefitsFixture} from '../testing/monthlyBenefitsFixture.js'
test('native signed exemption transfers blank status and produces zero federal tax without removing FICA',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='bc'.repeat(32);t.after(()=>{if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const h=await createHarness();t.after(()=>h.close());const {api,employee,periods}=await monthlyBenefitsFixture(h,{hourlyRateCents:25000})
 const task=(await api('/onboarding',undefined,'GET',200,true)).tasks.find(t=>t.task_key==='W4'),path=`/onboarding/${task.id}/w4`
 const answers={year:2026,personal:{firstNameMiddleInitial:'Synthetic',lastName:'Exempt',address:'123 Test Street',cityStateZip:'Bowie MD 20715',ssn:'123456789'},filingStatus:null,twoJobs:false,exempt:true,nonresidentAlien:false}
 const p=await api(`${path}/preview`,{answers,onboardingCycle:1},'POST',200,true)
 for(let page=1;page<=5;page++)await api(`${path}/page`,{reviewId:p.reviewId,previewSha256:p.previewSha256,onboardingCycle:1,page,displayed:true},'POST',200,true)
 await api(`${path}/sign`,{reviewId:p.reviewId,previewSha256:p.previewSha256,onboardingCycle:1,signature:'Synthetic Exempt',perjury:p.perjury,confirmed:true,reviewedAllPages:true,requestKey:randomUUID()},'POST',200,true)
 await api(`/employees/${employee.id}/onboarding/${task.id}/review`,{status:'COMPLETE',note:'Reviewed the retained signed exemption certificate',onboardingCycle:1})
 const current=await api(`/employees/${employee.id}/tax-elections`)
 assert.equal(current.nativeW4.federal.filingStatus,null);assert.equal(current.nativeW4.federal.exempt,true)
 await api(`/employees/${employee.id}/tax-elections`,{federal:current.nativeW4.federal,maryland:current.election.elections.maryland,w4SubmissionId:current.nativeW4.submissionId,w4Fingerprint:current.nativeW4.fingerprint,confirmed:true,sourceNote:'Reviewed signed federal exemption and synthetic Maryland certificate'},'PATCH')
 const saved=(await api(`/employees/${employee.id}/tax-elections`)).election.elections
 assert.equal(saved.federal.filingStatus,null);assert.equal(saved.w4Source.effectiveOn,current.nativeW4.effectiveOn)
 const result=await api('/runs/preview',{payPeriodId:periods[1].id,paymentDate:'2026-09-30'}),wages=result.preview.employees.find(e=>e.employeeId===Number(employee.id))
 assert.ok(wages.grossPayCents>0);assert.equal(wages.federalIncomeTaxCents,0)
 assert.equal(wages.socialSecurityTaxCents,Math.round(wages.grossPayCents*0.062));assert.equal(wages.medicareTaxCents,Math.round(wages.grossPayCents*0.0145))
 assert.ok(wages.stateIncomeTaxCents>0)
})
