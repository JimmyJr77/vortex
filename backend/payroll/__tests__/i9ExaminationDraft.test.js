import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {employerI9ReviewFixture} from '../testing/employerI9ReviewFixture.js'
import {i9ExaminationDraftInput} from '../i9ExaminationDraft.js'
test('partial examination findings exclude signatures, certifications and unsupported values',()=>{
 assert.equal(i9ExaminationDraftInput({identity:'partial',examinedOn:'2026-'}).examinedOn,'2026-')
 assert.throws(()=>i9ExaminationDraftInput({signature:'Alice'}),/signatures/)
 assert.throws(()=>i9ExaminationDraftInput({decisions:{A1:{accepted:true}}}),/signatures/)
 assert.throws(()=>i9ExaminationDraftInput({days:[1,1]}),/business days/)
 assert.throws(()=>i9ExaminationDraftInput({decisions:{A1:{copyIds:['9223372036854775808']}}}),/copy/)
})
test('encrypted examination findings resume across fresh reviews, reject stale saves and invalidate after employer edits',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='93'.repeat(32);t.after(()=>{if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const h=await createHarness({adminMiddleware:()=>(req,res,next)=>{if(req.headers.authorization!=='Bearer payroll-test-admin')return res.sendStatus(401);req.canonicalAccess={facilityId:Number(req.headers['x-test-facility']||1)};req.adminId=Number(req.headers['x-test-admin']||99);next()}});t.after(()=>h.close());const f=await employerI9ReviewFixture(h),{api,base,reviewBody,task,saved,draft}=f
 const read=body=>api(base+'/examination-draft?'+new URLSearchParams(body))
 assert.equal((await read(reviewBody)).revision,0)
 const body={...reviewBody,expectedRevision:0,requestKey:randomUUID(),draft:{identity:'PRIVATE unfinished examiner evidence',examinedOn:'2026-',days:[1,2],decisions:{A1:{acceptance:'STANDARD',copyIds:[]}}}}
 const [a,b]=await Promise.all([api(base+'/examination-draft',body),api(base+'/examination-draft',body)]);assert.deepEqual(a,b);assert.equal(a.revision,1)
 assert.deepEqual(await api(base+'/examination-draft',{...body,requestKey:body.requestKey.toUpperCase()}),a)
 assert.equal((await read(reviewBody)).draft.identity,body.draft.identity)
 const row=(await h.pool.query('SELECT * FROM payroll_i9_examination_draft')).rows[0];assert.equal(row.encrypted_draft.includes(Buffer.from('PRIVATE')),false)
 assert.equal(JSON.stringify((await h.pool.query("SELECT after_data FROM payroll_audit_log WHERE action='I9_EXAMINATION_DRAFT_SAVED'")).rows).includes('PRIVATE'),false)
 await api(base+'/examination-draft',{...body,requestKey:randomUUID()},'POST',409)
 await api(base+'/examination-draft',{...body,draft:{identity:'Different'}},'POST',409)
 await assert.rejects(()=>h.pool.query('UPDATE payroll_i9_examination_draft SET actor_user_id=100'),/immutable/)
 await assert.rejects(()=>h.pool.query('DELETE FROM payroll_i9_examination_draft'),/deleted/)
 await h.pool.query(`CREATE FUNCTION reject_exam_draft_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='I9_EXAMINATION_DRAFT_SAVED' THEN RAISE EXCEPTION 'Synthetic audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_exam_draft_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_exam_draft_audit()`)
 await api(base+'/examination-draft',{...body,expectedRevision:1,requestKey:randomUUID()},'POST',500)
 assert.equal((await read(reviewBody)).revision,1)
 await h.pool.query('DROP TRIGGER reject_exam_draft_audit ON payroll_audit_log')
 const fresh=await api(base+'/employer-preview',{onboardingCycle:1,expectedRevision:saved.revision,basisHash:saved.basisHash}),freshBody={onboardingCycle:1,reviewId:fresh.reviewId,previewSha256:fresh.previewSha256}
 assert.deepEqual((await read(freshBody)).draft,a.draft)
 await api(base+'/examination-draft',{...body,expectedRevision:1,requestKey:randomUUID()},'POST',409)
 const changed=await api(base+'/employer-draft',{onboardingCycle:1,expectedRevision:saved.revision,basisHash:saved.basisHash,requestKey:randomUUID(),draft:{...draft,businessName:'Changed employer'}})
 const next=await api(base+'/employer-preview',{onboardingCycle:1,expectedRevision:changed.revision,basisHash:changed.basisHash}),nextBody={onboardingCycle:1,reviewId:next.reviewId,previewSha256:next.previewSha256},invalid=await read(nextBody)
 assert.equal(invalid.invalidated,true);assert.equal(invalid.draft,null);assert.equal(invalid.revision,1)
 assert.equal((await api(base+'/examination-draft',{...nextBody,expectedRevision:1,requestKey:randomUUID(),draft:{identity:'Fresh findings'}})).revision,2)
 const other=async(path,body)=>{const response=await fetch(`${h.url}/api/admin/payroll${base}${path}`,{method:body?'POST':'GET',headers:{Authorization:'Bearer payroll-test-admin','x-test-admin':'100','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});assert.equal(response.status,200);return (await response.json()).data}
 const otherReview=await other('/employer-preview',{onboardingCycle:1,expectedRevision:changed.revision,basisHash:changed.basisHash})
 const privateState=await other('/examination-draft?'+new URLSearchParams({onboardingCycle:1,reviewId:otherReview.reviewId,previewSha256:otherReview.previewSha256}));assert.equal(privateState.draft,null);assert.equal(privateState.revision,0)
 assert.equal((await h.pool.query('SELECT status FROM payroll_onboarding_task WHERE id=$1',[task.id])).rows[0].status,'OPEN')
})
