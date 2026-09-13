import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {supplementReceiptFixture} from '../testing/supplementReceiptFixture.js'
import {decryptDocument} from '../onboarding.js'
test('replacement supplement signing rejects revoked qualification and retains restored findings',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='98'.repeat(32)
 t.after(()=>{if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const h=await createHarness();t.after(()=>h.close())
 const {api,employee,signed,receiptTaskId,pdf,today}=await supplementReceiptFixture(h)
 const path=`/employees/${employee.id}/i9/different-supplement/${receiptTaskId}`
 const qualification={siteName:'Synthetic hiring site',eVerifyEnrolled:true,goodStanding:true,allSitesEnrolled:true,trainingComplete:true,consistentProcedure:true,observedOn:today,evidence:'Current employer and site qualification verified by admin.'}
 await api('/i9/qualification',{findings:qualification,expectedRevision:0,requestKey:randomUUID()})
 const body={signatureId:signed.signatureId,initials:'RA',reason:'Employee selected a different acceptable authorization document.',supplement:{edition:'01/20/25',document:{list:'C',title:'Synthetic replacement authorization',number:'SYNTHETIC-C',expiresOn:'2032-01-01'},representativeName:'Reviewer Alice',examinationMethod:'ALTERNATIVE',additionalInformation:''}}
 const prepare=async()=>{
 const preview=await api(path+'/preview',body),page={reviewId:preview.reviewId,previewSha256:preview.previewSha256,rowKey:'document',displayed:true}
 const copy=await api(path+'/copies',{...page,requestKey:randomUUID(),filename:'synthetic.pdf',contentBase64:pdf.toString('base64')})
 for(const part of preview.packet)for(let n=1;n<=part.pageCount;n++)await api(path+'/page',{...page,documentKey:part.documentKey,page:n})
 for(let n=1;n<=2;n++)await api(path+'/copy-page',{...page,copyId:copy.id,page:n})
 const findings={differentDocumentsConfirmed:true,replacementEvidence:'Employee chose different acceptable authorization evidence.',examination:{examinedOn:today,examinerInitials:'RA',identityEvidence:'Reviewer Alice examined the original document.',reverificationRequired:true,requirementSource:'https://www.uscis.gov/i-9-central',requirementEvidence:'Synthetic finite authorization requires review.',employeeChoseDocuments:true,currentAuthorizationReviewed:true,documentsGenuineAndRelated:true,copiesComplete:true,copyIds:[copy.id],physicalPresence:false,alternative:{goodStanding:true,allSitesEnrolled:true,trainingComplete:true,consistentProcedure:true,copiesReceivedBeforeVideo:true,sameOriginalsPresented:true,liveVideoOn:today,qualificationEvidence:"Current synthetic employer and site qualification reviewed.",videoEvidence:"Same original documents reviewed by live video."},acceptance:'STANDARD',acceptanceSource:'https://www.uscis.gov/i-9-central',acceptanceEvidence:'Synthetic document acceptance used for testing.',authorizationIndefinite:false,authorizationThrough:'2031-01-01',followUpKind:'REVERIFICATION',followUpOn:'2031-01-01',noFurtherReverificationRequired:false}}
 return {...page,findings,requestKey:randomUUID(),signature:'Reviewer Alice',attestation:preview.attestation,attestationRead:true,signingAsExaminer:true,reviewedAllPages:true,representativeIdentityConfirmed:true}
 }
 const first=await prepare()
 await api('/i9/qualification',{findings:{...qualification,trainingComplete:false,evidence:'Required examiner training could not be confirmed.'},expectedRevision:1,requestKey:randomUUID()})
 await assert.rejects(()=>api(path+'/sign',first),/409/)
 const revoked=await prepare()
 await assert.rejects(()=>api(path+'/sign',revoked),/400.*alternative-procedure qualifications/)
 assert.equal(Number((await h.pool.query('SELECT count(*) FROM payroll_i9_different_supplement_signature')).rows[0].count),0)
 assert.equal((await h.pool.query('SELECT status FROM payroll_compliance_task WHERE id=$1',[receiptTaskId])).rows[0].status,'OPEN')
 await api('/i9/qualification',{findings:qualification,expectedRevision:2,requestKey:randomUUID()})
 const finalRequest=await prepare(),result=await api(path+'/sign',finalRequest)
 assert.deepEqual(await api(path+'/sign',finalRequest),result)
 const row=(await h.pool.query('SELECT * FROM payroll_i9_different_supplement_signature WHERE id=$1',[result.signatureId])).rows[0]
 const evidence=JSON.parse(decryptDocument(row.encrypted_evidence,`i9-different-supplement-signature:1:${employee.id}:${receiptTaskId}:99`).toString())
 assert.equal(evidence.context.qualification.revision,3);assert.equal(evidence.context.qualification.findings.trainingComplete,true)
 assert.equal(evidence.facts.examination.alternative.sameOriginalsPresented,true)
 assert.equal((await h.pool.query('SELECT status FROM payroll_compliance_task WHERE id=$1',[receiptTaskId])).rows[0].status,'COMPLETE')
})
