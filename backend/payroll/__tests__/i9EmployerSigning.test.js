import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {PDFDocument} from 'pdf-lib'
import {createHarness} from '../testing/harness.js'
import {employerI9ReviewFixture,syntheticI9CopyPdf} from '../testing/employerI9ReviewFixture.js'
import {I9_EMPLOYER_ATTESTATION} from '../i9Examination.js'
import {decryptDocument} from '../onboarding.js'
test('employer certification requires reviewed evidence, rolls back audit failures and retries without duplicate signatures',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='97'.repeat(32);t.after(()=>{if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const h=await createHarness();t.after(()=>h.close());const {api,employee,task,base,review,reviewBody}=await employerI9ReviewFixture(h)
 await api(`/employees/${employee.id}/onboarding/${task.id}/review`,{onboardingCycle:1,status:'COMPLETE',note:'Attempt to bypass internal employer certification.'},'POST',409)
 const copy=await api(base+'/employer-copies',{...reviewBody,rowKey:'A1',requestKey:randomUUID(),filename:'synthetic.pdf',contentBase64:(await syntheticI9CopyPdf()).toString('base64')})
 const body={...reviewBody,signature:'Reviewer Alice',requestKey:randomUUID(),attestation:I9_EMPLOYER_ATTESTATION,attestationRead:true,signingAsExaminer:true,reviewedAllPages:true,representativeIdentityConfirmed:true,examination:{examinedOn:'2026-09-01',examinerInitials:'RA',identityEvidence:'Authenticated hiring administrator and named examiner.',businessDays:[1,2,3,4,5],closedDates:[],calendarConfirmed:true,shortEmployment:false,lateReason:'Synthetic historical fixture certification performed today.',employeeChoseDocuments:true,section1Reviewed:true,documentsGenuineAndRelated:true,physicalPresence:true,documents:[{rowKey:'A1',copyIds:[copy.id],copiesComplete:true,accepted:true,acceptance:'STANDARD',followUpKind:'NONE',noFollowUpConfirmed:true}]}}
 await api(base+'/employer-sign',body,'POST',409)
 for(let page=1;page<=4;page++)await api(base+'/employer-page',{...reviewBody,documentKey:'main',page,displayed:true})
 await api(base+'/employer-sign',body,'POST',409)
 for(let page=1;page<=2;page++)await api(base+'/employer-copy-page',{...reviewBody,copyId:copy.id,page,displayed:true})
 await api(base+'/employer-sign',{...body,signingAsExaminer:false},'POST',400)
 await assert.rejects(()=>h.pool.query("UPDATE payroll_onboarding_task SET status='COMPLETE' WHERE id=$1",[task.id]),/current employer signature/)
 const before=(await h.pool.query('SELECT count(*)::int AS n FROM payroll_private_document')).rows[0].n
 await h.pool.query(`CREATE FUNCTION reject_employer_sign_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='I9_EMPLOYER_SIGNED' THEN RAISE EXCEPTION 'Synthetic signing audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_employer_sign_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_employer_sign_audit()`)
 await api(base+'/employer-sign',body,'POST',500)
 assert.equal((await h.pool.query('SELECT count(*)::int AS n FROM payroll_private_document')).rows[0].n,before)
 assert.equal((await h.pool.query('SELECT * FROM payroll_i9_employer_signature')).rowCount,0)
 await h.pool.query('DROP TRIGGER reject_employer_sign_audit ON payroll_audit_log')
 const [signed,retry]=await Promise.all([api(base+'/employer-sign',body),api(base+'/employer-sign',body)]);assert.deepEqual(signed,retry)
 assert.deepEqual(await api(base+'/employer-sign',{...body,requestKey:body.requestKey.toUpperCase()}),signed)
 await api(base+'/employer-sign',{...body,signature:'Someone Else'},'POST',409)
 const record=(await h.pool.query('SELECT * FROM payroll_i9_employer_signature')).rows[0]
 const evidence=JSON.parse(decryptDocument(record.encrypted_signature,`i9-employer-signature:1:${employee.id}:${task.id}:1:99`).toString())
 assert.equal(evidence.signature,'Reviewer Alice');assert.equal(evidence.copies.length,1)
 const doc=(await h.pool.query('SELECT * FROM payroll_private_document WHERE id=$1',[signed.documentId])).rows[0]
 const pdf=await PDFDocument.load(decryptDocument(doc.encrypted_content,`1:${employee.id}:${task.id}`)),original=await PDFDocument.load(Buffer.from(review.pdfBase64,'base64'))
 assert.equal(pdf.getForm().getTextField('Signature of Employer or AR').getText(),'Reviewer Alice')
 for(const field of original.getForm().getFields())if(typeof field.getText==='function'&&!['Signature of Employer or AR','S2 Todays Date mmddyyyy'].includes(field.getName()))assert.equal(pdf.getForm().getTextField(field.getName()).getText(),field.getText(),field.getName())
 assert.equal((await api(`/employees/${employee.id}/onboarding`)).tasks.find(t=>t.id===task.id).status,'COMPLETE')
 await assert.rejects(()=>h.pool.query('DELETE FROM payroll_i9_employer_signature'),/immutable/)
 assert.equal((await h.pool.query("SELECT * FROM payroll_audit_log WHERE action='I9_EMPLOYER_SIGNED'")).rowCount,1)
 const records=await api(`/employees/${employee.id}/i9/employer-records`);assert.equal(records.records.length,1);assert.equal(records.records[0].current,true);assert.equal(records.records[0].signature,'Reviewer Alice');assert.equal(records.records[0].copies[0].filename.endsWith('.pdf'),true)
 const foreign=await fetch(`${h.url}/api/admin/payroll/employees/${employee.id}/i9/employer-records`,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}});assert.equal(foreign.status,404)
 const viewed=(await h.pool.query("SELECT after_data FROM payroll_audit_log WHERE action='I9_EMPLOYER_RECORDS_VIEWED'")).rows;assert.equal(viewed.length,1);assert.equal(JSON.stringify(viewed).includes('Reviewer Alice'),false)
 await api(`/employees/${employee.id}/onboarding/${task.id}/review`,{onboardingCycle:1,status:'CHANGES_REQUESTED',note:'Reopen employer review for corrected examination.'})
 assert.equal((await api(`/employees/${employee.id}/i9/employer-records`)).records[0].current,false)

})
