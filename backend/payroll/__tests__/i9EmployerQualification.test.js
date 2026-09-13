import {decryptDocument} from '../onboarding.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {employerI9ReviewFixture,syntheticI9CopyPdf} from '../testing/employerI9ReviewFixture.js'
test('employer reviews use current qualification without changing signed Section 1',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='98'.repeat(32);t.after(()=>{if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const h=await createHarness();t.after(()=>h.close())
 const {api,base,draft,reviewBody,employee,task}=await employerI9ReviewFixture(h,{alternative:true})
 const before=(await h.pool.query('SELECT * FROM payroll_i9_submission')).rows
 const current=await api('/i9/qualification'),findings={siteName:'Synthetic site',eVerifyEnrolled:true,goodStanding:false,allSitesEnrolled:true,trainingComplete:true,consistentProcedure:true,observedOn:current.today,evidence:'Good standing could not be confirmed in current employer review.'}
 await api('/i9/qualification',{findings,expectedRevision:0,requestKey:randomUUID()})
 await api(base+'/employer-page',{...reviewBody,documentKey:'main',page:1,displayed:true},'POST',409)
 const stale=await api(base+'/employer-draft?onboardingCycle=1');assert.equal(stale.invalidated,true);assert.equal(stale.draft,null)
 const saved=await api(base+'/employer-draft',{onboardingCycle:1,expectedRevision:stale.revision,basisHash:stale.basisHash,requestKey:randomUUID(),draft})
 const next=await api(base+'/employer-preview',{onboardingCycle:1,expectedRevision:saved.revision,basisHash:saved.basisHash})
 assert.equal(next.examinationContext.eVerify,false);assert.equal(next.examinationContext.qualification.revision,1)
 const reviewedSigning=async preview=>{
  const review={onboardingCycle:1,reviewId:preview.reviewId,previewSha256:preview.previewSha256}
  const copy=await api(base+'/employer-copies',{...review,rowKey:'A1',requestKey:randomUUID(),filename:'synthetic.pdf',contentBase64:(await syntheticI9CopyPdf()).toString('base64')})
  for(let page=1;page<=4;page++)await api(base+'/employer-page',{...review,documentKey:'main',page,displayed:true})
  for(let page=1;page<=2;page++)await api(base+'/employer-copy-page',{...review,copyId:copy.id,page,displayed:true})
  return {...review,requestKey:randomUUID(),signature:'Reviewer Alice',attestation:preview.attestation,attestationRead:true,signingAsExaminer:true,reviewedAllPages:true,representativeIdentityConfirmed:true,examination:{examinedOn:'2026-09-01',examinerInitials:'RA',identityEvidence:'Authenticated named examiner reviewed original documents.',businessDays:[1,2,3,4,5],closedDates:[],calendarConfirmed:true,shortEmployment:false,lateReason:'Historical synthetic examination recorded at actual signing date.',employeeChoseDocuments:true,section1Reviewed:true,documentsGenuineAndRelated:true,physicalPresence:false,alternative:{goodStanding:true,allSitesEnrolled:true,trainingComplete:true,consistentProcedure:true,copiesReceivedBeforeVideo:true,sameOriginalsPresented:true,liveVideoOn:'2026-09-01',qualificationEvidence:'Synthetic current examiner qualification evidence.',videoEvidence:'Synthetic live video examination of the same original documents.'},documents:[{rowKey:'A1',copyIds:[copy.id],copiesComplete:true,accepted:true,acceptance:'STANDARD',followUpKind:'NONE',noFollowUpConfirmed:true}]}}
 }
 const rejected=await reviewedSigning(next)
 const denied=await fetch(`${h.url}/api/admin/payroll${base}/employer-sign`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(rejected)})
 assert.equal(denied.status,400);assert.match((await denied.json()).message,/current employer qualification/)
 assert.equal(Number((await h.pool.query('SELECT count(*) FROM payroll_i9_employer_signature')).rows[0].count),0)

 await api('/i9/qualification',{findings:{...findings,goodStanding:true,evidence:'Current good standing is verified with employer records.'},expectedRevision:1,requestKey:randomUUID()})
 await api(base+'/employer-page',{onboardingCycle:1,reviewId:next.reviewId,previewSha256:next.previewSha256,documentKey:'main',page:1,displayed:true},'POST',409)
 const refreshed=await api(base+'/employer-draft?onboardingCycle=1'),savedAgain=await api(base+'/employer-draft',{onboardingCycle:1,expectedRevision:refreshed.revision,basisHash:refreshed.basisHash,requestKey:randomUUID(),draft})
 const qualified=await api(base+'/employer-preview',{onboardingCycle:1,expectedRevision:savedAgain.revision,basisHash:savedAgain.basisHash})
 assert.equal(qualified.examinationContext.eVerify,true);assert.equal(qualified.examinationContext.qualification.revision,2)
 const signing=await reviewedSigning(qualified),signed=await api(base+'/employer-sign',signing)
 assert.deepEqual(await api(base+'/employer-sign',signing),signed)
 const row=(await h.pool.query('SELECT * FROM payroll_i9_employer_signature WHERE id=$1',[signed.signatureId])).rows[0]
 const evidence=JSON.parse(decryptDocument(row.encrypted_signature,`i9-employer-signature:1:${employee.id}:${task.id}:1:99`).toString())
 assert.equal(evidence.context.qualification.revision,2);assert.equal(evidence.context.qualification.findings.goodStanding,true);assert.equal(evidence.context.alternativeQualified,true)
 assert.equal(evidence.context.eVerify,true)
 assert.deepEqual((await h.pool.query('SELECT * FROM payroll_i9_submission')).rows,before)
})
