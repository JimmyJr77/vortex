import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {employerI9ReviewFixture,syntheticI9CopyPdf} from '../testing/employerI9ReviewFixture.js'
import {I9_EMPLOYER_ATTESTATION} from '../i9Examination.js'
import {eVerifyResultInput} from '../i9EVerify.js'
const authorized=()=>({outcome:'EMPLOYMENT_AUTHORIZED',caseReference:'SYNTHETIC-CASE-123',observedOn:'2026-09-01',caseClosed:true,evidenceNote:'Official synthetic case result matched and reviewed.',verifiedAgainstOfficialCase:true,employeeAndEmployerMatched:true,evidenceReviewed:true})
test('authorized closure requires confirmations; unresolved case results require a next action',()=>{
 assert.equal(eVerifyResultInput({result:authorized()}).caseClosed,true)
 assert.throws(()=>eVerifyResultInput({result:{...authorized(),outcome:'PENDING_SSN',nextActionOn:'2030-01-01',nextAction:'Check the pending SSN evidence and create the case.'}}),/case-not-created/)
 assert.throws(()=>eVerifyResultInput({result:{...authorized(),caseClosed:false}}),/closed/)
 assert.throws(()=>eVerifyResultInput({result:{...authorized(),outcome:'MISMATCH'}}),/next action/)
 assert.throws(()=>eVerifyResultInput({result:{...authorized(),employeeAndEmployerMatched:false}}),/matching/)
 assert.equal(eVerifyResultInput({result:{...authorized(),outcome:'FINAL_NONCONFIRMATION',nextActionOn:'2030-01-01',nextAction:'Review the retained result and employee-specific disposition.'}}).outcome,'FINAL_NONCONFIRMATION')
})
test('E-Verify results retain evidence, reject generic closure, survive retries and reopen on unresolved corrections',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='92'.repeat(32);t.after(()=>{if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const h=await createHarness();t.after(()=>h.close());const {api,employee,base,reviewBody}=await employerI9ReviewFixture(h,{alternative:true}),contentBase64=(await syntheticI9CopyPdf()).toString('base64')
 const copy=await api(base+'/employer-copies',{...reviewBody,rowKey:'A1',requestKey:randomUUID(),filename:'synthetic.pdf',contentBase64})
 for(let page=1;page<=4;page++)await api(base+'/employer-page',{...reviewBody,documentKey:'main',page,displayed:true})
 for(let page=1;page<=2;page++)await api(base+'/employer-copy-page',{...reviewBody,copyId:copy.id,page,displayed:true})
 await api(base+'/employer-sign',{...reviewBody,signature:'Reviewer Alice',requestKey:randomUUID(),attestation:I9_EMPLOYER_ATTESTATION,attestationRead:true,signingAsExaminer:true,reviewedAllPages:true,representativeIdentityConfirmed:true,examination:{examinedOn:'2026-09-01',examinerInitials:'RA',identityEvidence:'Authenticated examiner in the synthetic fixture.',businessDays:[1,2,3,4,5],closedDates:[],calendarConfirmed:true,shortEmployment:false,lateReason:'Synthetic historical fixture certified at the actual current date.',employeeChoseDocuments:true,section1Reviewed:true,documentsGenuineAndRelated:true,physicalPresence:false,alternative:{goodStanding:true,allSitesEnrolled:true,trainingComplete:true,consistentProcedure:true,copiesReceivedBeforeVideo:true,sameOriginalsPresented:true,liveVideoOn:'2026-09-01',qualificationEvidence:'Synthetic site enrollment and examiner training verified.',videoEvidence:'Synthetic same original documents examined in live video.'},documents:[{rowKey:'A1',copyIds:[copy.id],copiesComplete:true,accepted:true,acceptance:'STANDARD',followUpKind:'NONE',noFollowUpConfirmed:true}]}})
 const task=(await h.pool.query("SELECT * FROM payroll_compliance_task WHERE employee_id=$1 AND task_key LIKE 'I9_EVERIFY_CASE:%'",[employee.id])).rows[0],path=`/employees/${employee.id}/i9/everify/${task.id}`
 await api(`/compliance/${task.id}`,{status:'COMPLETE',completionNote:'Unstructured note must not complete a case.'},'PATCH',409)
 await assert.rejects(()=>h.pool.query("UPDATE payroll_compliance_task SET status='COMPLETE' WHERE id=$1",[task.id]),/latest retained/)
 assert.equal((await api(path)).revision,0)
 const body={expectedRevision:0,requestKey:randomUUID(),result:authorized(),filename:'PRIVATE-case-name.pdf',contentBase64}
 await api(path,{...body,result:{...authorized(),observedOn:'2099-01-01'}},'POST',400)
 const before=(await h.pool.query('SELECT count(*)::int AS n FROM payroll_private_document')).rows[0].n
 await h.pool.query(`CREATE FUNCTION reject_everify_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='I9_EVERIFY_RESULT_RECORDED' THEN RAISE EXCEPTION 'Synthetic audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_everify_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_everify_audit()`)
 await api(path,body,'POST',500);assert.equal((await h.pool.query('SELECT count(*)::int AS n FROM payroll_private_document')).rows[0].n,before);assert.equal((await api(path)).revision,0)
 await h.pool.query('DROP TRIGGER reject_everify_audit ON payroll_audit_log')
 const [a,b]=await Promise.all([api(path,body),api(path,body)]);assert.deepEqual(a,b);assert.equal(a.status,'COMPLETE')
 assert.deepEqual(await api(path,{...body,requestKey:body.requestKey.toUpperCase()}),a)
 await api(path,{...body,requestKey:randomUUID()},'POST',409)
 const history=await api(path);assert.equal(history.events[0].result.caseReference,'SYNTHETIC-CASE-123');assert.equal(history.events[0].filename.includes('PRIVATE'),false)
 const row=(await h.pool.query('SELECT * FROM payroll_i9_everify_event')).rows[0];assert.equal(row.encrypted_evidence.includes(Buffer.from('SYNTHETIC-CASE')),false)
 await assert.rejects(()=>h.pool.query('DELETE FROM payroll_i9_everify_event'),/immutable/)
 const pending=await api(path,{...body,expectedRevision:1,requestKey:randomUUID(),result:{...authorized(),outcome:'CLOSE_AND_RESUBMIT',nextActionOn:'2030-01-01',nextAction:'Reconcile the official corrected case and retain its new result.'}});assert.equal(pending.status,'IN_PROGRESS')
 assert.equal((await h.pool.query('SELECT status FROM payroll_compliance_task WHERE id=$1',[task.id])).rows[0].status,'IN_PROGRESS')
 await assert.rejects(()=>h.pool.query("UPDATE payroll_compliance_task SET status='COMPLETE' WHERE id=$1",[task.id]),/latest retained/)
 assert.equal((await api(path)).events.length,2)
 const foreign=await fetch(`${h.url}/api/admin/payroll${path}`,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}});assert.equal(foreign.status,404)
 assert.equal(JSON.stringify((await h.pool.query("SELECT after_data FROM payroll_audit_log WHERE action LIKE 'I9_EVERIFY_%'")).rows).includes('SYNTHETIC-CASE'),false)
})
