import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {employerI9ReviewFixture,syntheticI9CopyPdf} from '../testing/employerI9ReviewFixture.js'
test('private I-9 copies retry once, stay scoped to exact document entries and retain page evidence',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='97'.repeat(32);t.after(()=>{if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const h=await createHarness();t.after(()=>h.close());const {api,employee,task,base,draft,saved,reviewBody}=await employerI9ReviewFixture(h)
 const bytes=await syntheticI9CopyPdf()
 const body={...reviewBody,rowKey:'A1',requestKey:randomUUID(),filename:'SENSITIVE-PERSONAL-FILENAME.pdf',contentBase64:bytes.toString('base64')}
 const [a,b]=await Promise.all([api(base+'/employer-copies',body),api(base+'/employer-copies',body)]);assert.deepEqual(a,b);assert.equal(a.pageCount,2)
 assert.deepEqual(await api(base+'/employer-copies',{...body,requestKey:body.requestKey.toUpperCase()}),a)
 await api(base+'/employer-copies',{...body,rowKey:'B'},'POST',400)
 await api(base+'/employer-copies',{...body,contentBase64:Buffer.from('%PDF-invalid').toString('base64')},'POST',409)
 await api(base+'/employer-copies',{...body,requestKey:randomUUID(),contentBase64:Buffer.from('%PDF-invalid').toString('base64')},'POST',400)
 const getCopies=r=>api(base+'/employer-copies?'+new URLSearchParams(Object.fromEntries(Object.entries(r).map(([k,v])=>[k,String(v)]))))
 const list=await getCopies(reviewBody);assert.equal(list.documents[0].copies.length,1);assert.equal(JSON.stringify(list).includes('SENSITIVE-PERSONAL'),false)
 const view=await api(base+'/employer-copy-view',{...reviewBody,copyId:a.id});assert.equal(view.contentBase64,body.contentBase64)
 for(let page=1;page<=2;page++)await api(base+'/employer-copy-page',{...reviewBody,copyId:a.id,page,displayed:true})
 await api(base+'/employer-copy-page',{...reviewBody,copyId:a.id,page:2,displayed:true})
 await api(base+'/employer-copy-page',{...reviewBody,copyId:a.id,page:3,displayed:true},'POST',400)
 assert.equal((await h.pool.query('SELECT * FROM payroll_i9_copy_page_visit')).rowCount,2)
 const retained=(await h.pool.query('SELECT d.* FROM payroll_private_document d JOIN payroll_i9_document_copy c ON c.document_id=d.id WHERE c.id=$1',[a.id])).rows[0]
 assert.equal(retained.encrypted_content.includes(Buffer.from('SYNTHETIC ID')),false)
 const foreign=await fetch(`${h.url}/api/admin/payroll${base}/employer-copy-view`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2','Content-Type':'application/json'},body:JSON.stringify({...reviewBody,copyId:a.id})});assert.equal(foreign.status,404)
 await assert.rejects(()=>h.pool.query('DELETE FROM payroll_i9_document_copy WHERE id=$1',[a.id]),/immutable/)
 await assert.rejects(()=>h.pool.query('UPDATE payroll_i9_copy_page_visit SET page_number=page_number'),/immutable/)
 const before=(await h.pool.query('SELECT count(*)::int AS n FROM payroll_private_document')).rows[0].n
 await h.pool.query(`CREATE FUNCTION reject_i9_copy_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='I9_DOCUMENT_COPY_RETAINED' THEN RAISE EXCEPTION 'Synthetic copy audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_i9_copy_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_i9_copy_audit()`)
 await api(base+'/employer-copies',{...body,requestKey:randomUUID()},'POST',500)
 assert.equal((await h.pool.query('SELECT count(*)::int AS n FROM payroll_private_document')).rows[0].n,before)
 await h.pool.query('DROP TRIGGER reject_i9_copy_audit ON payroll_audit_log')
 const next=await api(base+'/employer-preview',{onboardingCycle:1,expectedRevision:saved.revision,basisHash:saved.basisHash}),nextBody={onboardingCycle:1,reviewId:next.reviewId,previewSha256:next.previewSha256}
 assert.equal((await getCopies(nextBody)).documents[0].copies.length,1)
 await api(base+'/employer-copy-view',{...reviewBody,copyId:a.id},'POST',409)
 await api(base+'/employer-copy-view',{...nextBody,copyId:a.id})
 const changed=await api(base+'/employer-draft',{onboardingCycle:1,expectedRevision:saved.revision,basisHash:saved.basisHash,requestKey:randomUUID(),draft:{...draft,listA:[{...draft.listA[0],number:'DIFFERENT-DOCUMENT'}]}})
 const latest=await api(base+'/employer-preview',{onboardingCycle:1,expectedRevision:changed.revision,basisHash:changed.basisHash}),latestBody={onboardingCycle:1,reviewId:latest.reviewId,previewSha256:latest.previewSha256}
 assert.equal((await getCopies(latestBody)).documents[0].copies.length,0)
 await api(base+'/employer-copy-view',{...latestBody,copyId:a.id},'POST',404)
 await assert.rejects(()=>h.pool.query('INSERT INTO payroll_i9_copy_page_visit(review_id,copy_id,page_number) VALUES($1,$2,1)',[latest.reviewId,a.id]),/current reviewed entry/)
 assert.equal((await h.pool.query('SELECT count(*)::int AS n FROM payroll_i9_document_copy')).rows[0].n,1)
 assert.equal(JSON.stringify((await h.pool.query("SELECT after_data FROM payroll_audit_log WHERE action LIKE 'I9_DOCUMENT_COPY_%'")).rows).includes('SENSITIVE-PERSONAL'),false)
 assert.equal((await api(`/employees/${employee.id}/onboarding`)).tasks.find(t=>t.id===task.id).status,'OPEN')
})
