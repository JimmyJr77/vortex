import {i9DifferentSupplementBasis} from '../i9DifferentSupplementBasis.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {supplementReceiptFixture} from '../testing/supplementReceiptFixture.js'
import {i9QualificationInput} from '../i9Qualification.js'
test('qualification observations retain explicit negative decisions',()=>{
 const input={siteName:'Synthetic site',eVerifyEnrolled:false,goodStanding:false,allSitesEnrolled:false,trainingComplete:false,consistentProcedure:false,observedOn:'2026-09-13',evidence:'Enrollment is not currently verified.'}
 assert.equal(i9QualificationInput(input).eVerifyEnrolled,false)
 for(const changed of [{...input,goodStanding:'yes'},{...input,observedOn:'2026-02-30'},{...input,evidence:'short'},{...input,approved:true}])assert.throws(()=>i9QualificationInput(changed))
})
test('current qualification history is scoped, immutable and leaves signed hiring evidence unchanged',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='98'.repeat(32)
 t.after(()=>{if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const h=await createHarness();t.after(()=>h.close())
 const {api,today,employee,signed,receiptTaskId}=await supplementReceiptFixture(h)
 const before=(await h.pool.query('SELECT * FROM payroll_i9_hiring_context ORDER BY task_id,onboarding_cycle,revision')).rows
 const initial=await api('/i9/qualification');assert.equal(initial.revision,0)
 const findings={siteName:'Synthetic payroll facility',eVerifyEnrolled:true,goodStanding:true,allSitesEnrolled:true,trainingComplete:true,consistentProcedure:true,observedOn:today,evidence:'Admin reviewed current employer and hiring site qualification.'}
 const ctx={facility:1,employee:employee.id,admin:99},path=`/employees/${employee.id}/i9/different-supplement/${receiptTaskId}`
 const previewBody={signatureId:signed.signatureId,initials:'RA',reason:'Employee selected different acceptable documentation.',supplement:{edition:'01/20/25',document:{list:'C',title:'Synthetic authorization',number:'SYNTHETIC',expiresOn:'2032-01-01'},representativeName:'Reviewer Alice',examinationMethod:'PHYSICAL',additionalInformation:''}}
 const initialPreview=await api(path+'/preview',previewBody)
 assert.equal((await i9DifferentSupplementBasis(h.pool,ctx,receiptTaskId)).examinationContext.eVerify,false)
 const body={findings,expectedRevision:0,requestKey:randomUUID()},saved=await api('/i9/qualification',body)
 assert.equal(saved.revision,1);assert.equal(saved.recordedRevision,1)
 await assert.rejects(()=>api(path+'/page',{reviewId:initialPreview.reviewId,previewSha256:initialPreview.previewSha256,documentKey:'replacement',page:1,displayed:true}),/409/)
 const qualified=await i9DifferentSupplementBasis(h.pool,ctx,receiptTaskId)
 assert.equal(qualified.examinationContext.eVerify,true);assert.equal(qualified.examinationContext.qualification.revision,1)
 assert.equal(qualified.retained.context.eVerify,false)
 const qualifiedPreview=await api(path+'/preview',previewBody)
 assert.deepEqual(await api('/i9/qualification',{...body,requestKey:body.requestKey.toUpperCase()}),saved)
 await assert.rejects(()=>api('/i9/qualification',{...body,findings:{...findings,goodStanding:false}}),/409/)
 const changed=await api('/i9/qualification',{findings:{...findings,goodStanding:false,evidence:'Current good standing could not be confirmed during review.'},expectedRevision:1,requestKey:randomUUID()})
 await assert.rejects(()=>api(path+'/page',{reviewId:qualifiedPreview.reviewId,previewSha256:qualifiedPreview.previewSha256,documentKey:'replacement',page:1,displayed:true}),/409/)
 const revoked=await i9DifferentSupplementBasis(h.pool,ctx,receiptTaskId);assert.equal(revoked.examinationContext.eVerify,false);assert.equal(revoked.examinationContext.qualification.revision,2)
 assert.equal(changed.revision,2);assert.equal(changed.current.findings.goodStanding,false);assert.equal(changed.history[1].findings.goodStanding,true)
 const retry=await api('/i9/qualification',body);assert.equal(retry.recordedRevision,1);assert.equal(retry.revision,2)
 await assert.rejects(()=>api('/i9/qualification',{...body,requestKey:randomUUID()}),/409/)
 const foreign=await fetch(`${h.url}/api/admin/payroll/i9/qualification`,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}})
 const data=await foreign.json();assert.equal(foreign.status,200);assert.equal(data.data?.revision??data.revision,0)
 await assert.rejects(()=>h.pool.query('DELETE FROM payroll_i9_qualification WHERE facility_id=1'),/immutable/)
 await assert.rejects(()=>h.pool.query('UPDATE payroll_i9_qualification SET findings=$1 WHERE facility_id=1',[findings]),/immutable/)
 assert.deepEqual((await h.pool.query('SELECT * FROM payroll_i9_hiring_context ORDER BY task_id,onboarding_cycle,revision')).rows,before)
 let tasks=(await h.pool.query("SELECT * FROM payroll_compliance_task WHERE task_key LIKE 'I9_PARTICIPATION_REVIEW:%' ORDER BY id")).rows
 assert.equal(tasks.length,1);assert.equal(tasks[0].employee_id,null);assert.equal(tasks[0].task_key,'I9_PARTICIPATION_REVIEW:1');assert.equal(tasks[0].status,'OPEN');assert.equal(tasks[0].severity,'WARNING')
 const departure={findings:{...findings,eVerifyEnrolled:false,evidence:'Employer participation is no longer currently verified.'},expectedRevision:2,requestKey:randomUUID()}
 await api('/i9/qualification',departure);await api('/i9/qualification',departure)
 tasks=(await h.pool.query("SELECT task_key FROM payroll_compliance_task WHERE task_key LIKE 'I9_PARTICIPATION_REVIEW:%' ORDER BY id")).rows
 assert.deepEqual(tasks,[{task_key:'I9_PARTICIPATION_REVIEW:1'},{task_key:'I9_PARTICIPATION_REVIEW:3'}])
 await h.pool.query("CREATE FUNCTION reject_qualification_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='I9_QUALIFICATION_RECORDED' THEN RAISE EXCEPTION 'synthetic qualification audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_qualification_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_qualification_audit()")
 await assert.rejects(()=>api('/i9/qualification',{findings,expectedRevision:3,requestKey:randomUUID()}),/500/)
 assert.equal((await api('/i9/qualification')).revision,3)
 assert.equal(Number((await h.pool.query("SELECT count(*) FROM payroll_compliance_task WHERE task_key LIKE 'I9_PARTICIPATION_REVIEW:%'")).rows[0].count),2)

})
