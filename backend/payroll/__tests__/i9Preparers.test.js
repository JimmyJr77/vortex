import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {signedI9Fixture} from '../testing/signedI9Fixture.js'
import {PDFDocument} from 'pdf-lib'
test('independent preparer links certify five people without exposing SSN and gate admin completion',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='93'.repeat(32);t.after(()=>{if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const h=await createHarness();t.after(()=>h.close());const {api,employee,task,signed}=await signedI9Fixture(h),base=`/employees/${employee.id}/onboarding/${task.id}/i9/preparers`
 const guest=async(token,path,body,status=200)=>{const response=await fetch(`${h.url}/api/payroll/preparer/${path}`,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});assert.equal(response.status,status);assert.equal(response.headers.get('cache-control'),'no-store');return (await response.json()).data}
 await guest('monthly-benefits-session','me',undefined,401)
 const roster0=await api(base+'?onboardingCycle=1')
 const links=[]
 for(let n=0;n<5;n++){
  const body={onboardingCycle:1,submissionId:signed.submissionId,name:`Alice${n} Translator`,email:`preparer${n}@example.test`,evidence:'Synthetic verified assistant identity and contact.',confirmed:true,requestKey:randomUUID()}
  const link=await api(base,body);links.push(link)
  if(n===0){assert.deepEqual(await api(base,{...body,requestKey:body.requestKey.toUpperCase()}),link);await api(base,{...body,name:'Different person'},'POST',409);const row=(await h.pool.query('SELECT encrypted_access FROM payroll_i9_preparer_request WHERE id=$1',[link.id])).rows[0];assert.equal(row.encrypted_access.includes(Buffer.from(link.token)),false)}
 }
 const body={preparer:{firstName:'Alice',lastName:'Translator',middleInitial:'',address:'20 Example Road',city:'Bowie',state:'MD',postalCode:'20715'}}
 const previews=[]
 await guest(links[0].token,'preview',body,400)
 assert.equal((await fetch(`${h.url}/api/payroll/employee/me`,{headers:{Authorization:`Bearer ${links[0].token}`}})).status,401)
 for(const [index,link] of links.entries()){const packet=await guest(link.token,'me');assert.equal(packet.employee.firstName,'Łukasz');assert.equal(JSON.stringify(packet).includes('123456789'),false);previews.push(await guest(link.token,'preview',{preparer:{...body.preparer,firstName:`Alice${index}`}}))}
 const cert=(p)=>({reviewId:p.reviewId,previewSha256:p.previewSha256,signature:'Alice Translator',attestation:p.attestation,attestationRead:true,reviewed:true,signingAsPreparer:true,requestKey:randomUUID()})
 await guest(links[0].token,'sign',cert(previews[1]),409)
 await guest(links[0].token,'sign',cert(previews[0]),409)
 for(let i=0;i<5;i++){
  const p=previews[i],token=links[i].token,b=cert(p)
  await guest(token,'page',{reviewId:p.reviewId,previewSha256:p.previewSha256,displayed:true})
  if(i===0){await h.pool.query(`CREATE FUNCTION reject_preparer_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='I9_PREPARER_SIGNED' THEN RAISE EXCEPTION 'Synthetic audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_preparer_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_preparer_audit()`);await guest(token,'sign',b,500);assert.equal((await h.pool.query('SELECT * FROM payroll_i9_preparer_signature')).rowCount,0);await h.pool.query('DROP TRIGGER reject_preparer_audit ON payroll_audit_log')}
  const [a,z]=await Promise.all([guest(token,'sign',b),guest(token,'sign',{...b,requestKey:b.requestKey.toUpperCase()})]);assert.deepEqual(a,z)
  await guest(token,'sign',{...b,signature:'Different'},409)
  const document=await fetch(`${h.url}/api/payroll/preparer/document`,{headers:{Authorization:`Bearer ${token}`}});assert.equal(document.status,200)
  const pdf=await PDFDocument.load(Buffer.from(await document.arrayBuffer()));assert.equal(pdf.getPageCount(),1);assert.equal(pdf.getForm().getTextField('Signature of Preparer or Translator 0').getText(),'Alice Translator');assert.throws(()=>pdf.getForm().getTextField('US Social Security Number'))
 }
 assert.equal((await h.pool.query('SELECT * FROM payroll_i9_preparer_signature')).rowCount,5)
 const cancel=await api(base,{onboardingCycle:1,submissionId:signed.submissionId,name:'Wrong recipient',email:'wrong@example.test',evidence:'Synthetic recipient to cancel for a test.',confirmed:true,requestKey:randomUUID()})
 await api(`${base}/${cancel.id}/cancel`,{onboardingCycle:1,reason:'Synthetic wrong recipient cancellation.'});await guest(cancel.token,'me',undefined,401)
 await api(`${base}/${links[0].id}/cancel`,{onboardingCycle:1,reason:'Cannot cancel a signed certification.'},'POST',409)
 const review=`/employees/${employee.id}/onboarding/${task.id}/review`
 await api(review,{onboardingCycle:1,status:'COMPLETE',note:'Synthetic preparer review',i9PreparerReview:{confirmed:true,fingerprint:roster0.fingerprint}},'POST',409)
 const roster=await api(base+'?onboardingCycle=1');assert.equal(roster.requests.filter(r=>r.signatureId).length,5);assert.equal(JSON.stringify(roster).includes(links[0].token),false)
 await api(review,{onboardingCycle:1,status:'COMPLETE',note:'Reviewed all five synthetic preparer certifications.',i9PreparerReview:{confirmed:true,fingerprint:roster.fingerprint}})
 assert.equal((await h.pool.query('SELECT status FROM payroll_onboarding_task WHERE id=$1',[task.id])).rows[0].status,'COMPLETE')
 await assert.rejects(()=>h.pool.query('DELETE FROM payroll_i9_preparer_signature'),/immutable/)
 assert.equal(JSON.stringify((await h.pool.query("SELECT after_data FROM payroll_audit_log WHERE action LIKE 'I9_PREPARER_%'")).rows).includes('Alice'),false)
})
