import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {createHistoricalHarness} from '../testing/historicalHarness.js'
import {healthQualificationFixture} from '../testing/healthQualificationFixture.js'
import {requireHealthPlanQualification} from '../healthPlanQualification.js'
const options={skip:!process.env.PAYROLL_TEST_DATABASE_URL}
async function fixture(t){
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='18'.repeat(32);t.after(()=>{if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const h=await createHistoricalHarness(t,{},'2026-09-16T16:00:00.000Z');t.after(()=>h.close())
 return healthQualificationFixture(h,{retainPlan:false})
}
test('written health plan is encrypted, retained with dated review, recoverable and scoped to its workplace',options,async t=>{
 const {api,h,path,body,bytes}=await fixture(t),saved=await api(path,body)
 const state=await api(path);assert.equal(state.status,'QUALIFIED');assert.equal(state.history.length,1);assert.equal(state.current.document_pages,1)
 const stored=(await h.pool.query('SELECT * FROM payroll_health_plan_qualification')).rows[0]
 assert.ok(!stored.encrypted_document.includes(Buffer.from('%PDF-')));assert.ok(!JSON.stringify(state).includes('encrypted_document'));assert.ok(!JSON.stringify(state).includes('private-employer-original-name'))
 const download=await fetch(`${h.url}/api/admin/payroll${path}/${saved.id}/document`,{headers:{Authorization:'Bearer payroll-test-admin'}})
 assert.equal(download.status,200);assert.equal(download.headers.get('cache-control'),'no-store');assert.equal(download.headers.get('content-disposition'),'attachment; filename="Section-125-written-plan.pdf"');assert.deepEqual(Buffer.from(await download.arrayBuffer()),bytes)
 const other=await fetch(`${h.url}/api/admin/payroll${path}/${saved.id}/document`,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}});assert.equal(other.status,404)
 const unauthorized=await fetch(`${h.url}/api/admin/payroll${path}`);assert.equal(unauthorized.status,401)
 delete process.env.PAYROLL_DOCUMENT_KEY
 assert.deepEqual(await api(path,body),{id:saved.id,reused:true})
 await api(path,{...body,reference:'Changed review must not reuse the original request'},'POST',409)
 process.env.PAYROLL_DOCUMENT_KEY='18'.repeat(32)
 const qualified=await requireHealthPlanQualification(h.pool,1,'medical','2026-09-18');assert.equal(qualified.reviewId,saved.id);assert.equal(qualified.fingerprint.length,64)
 await assert.rejects(()=>requireHealthPlanQualification(h.pool,1,'medical','2026-08-31'),/current dated/)
 await assert.rejects(()=>requireHealthPlanQualification(h.pool,1,'medical','2027-09-01'),/current dated/)
 await h.pool.query(await readFile(new URL('../../migrations/831_payroll_health_plan_qualification.sql',import.meta.url),'utf8'))
 assert.equal((await api(path)).history.length,1)
 await assert.rejects(()=>h.pool.query("UPDATE payroll_health_plan_qualification SET review=review||'{\"reference\":\"tampered\"}'::jsonb WHERE id=$1",[saved.id]))
 await assert.rejects(()=>h.pool.query('DELETE FROM payroll_health_plan_qualification WHERE id=$1',[saved.id]))
})
test('future health-plan suspension blocks its dates without replacing earlier valid qualification',options,async t=>{
 const {api,h,path,body}=await fixture(t),first=await api(path,body)
 await api(path,{sourceFingerprint:body.sourceFingerprint,requestKey:randomUUID(),expectedRevision:1,disposition:'SUSPENDED',effectiveOn:'2026-10-01',effectiveThrough:'2027-08-31',confirmed:true,reference:'Qualification suspended from October pending the reviewed amended written plan'})
 assert.equal((await api(path)).status,'SUSPENDED');assert.equal((await api(`${path}?paymentDate=2026-09-18`)).status,'QUALIFIED')
 assert.equal((await requireHealthPlanQualification(h.pool,1,'medical','2026-09-18')).reviewId,first.id)
 await assert.rejects(()=>requireHealthPlanQualification(h.pool,1,'medical','2026-10-20'),/current dated/)
 await h.pool.query("UPDATE payroll_settings SET legal_business_name='Changed legal employer' WHERE facility_id=1")
 assert.equal((await api(`${path}?paymentDate=2026-09-18`)).status,'STALE');await assert.rejects(()=>requireHealthPlanQualification(h.pool,1,'medical','2026-09-18'),/current dated/)
 await api(path,{...body,requestKey:randomUUID(),expectedRevision:2},'POST',409)
})
test('health qualification rejects incomplete or unreadable evidence and saves atomically with its audit event',options,async t=>{
 const {api,h,path,body}=await fixture(t)
 for(const patch of [{writtenPlanConfirmed:false},{eligibleBenefitsConfirmed:false},{nondiscriminationConfirmed:false},{classification:'PRETAX'},{effectiveOn:'2026-02-30'},{effectiveThrough:'2026-08-31'},{reference:'short'},{confirmed:false},{document:{contentBase64:Buffer.from('%PDF-not-a-readable-document').toString('base64')}}])await api(path,{...body,...patch},'POST',400)
 assert.equal((await api(path)).history.length,0)
 await h.pool.query("CREATE FUNCTION reject_health_review_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='HEALTH_PLAN_QUALIFICATION_REVIEWED' THEN RAISE EXCEPTION 'synthetic failed audit'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_health_review_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_health_review_audit()")
 await api(path,body,'POST',500);assert.equal((await api(path)).history.length,0)
 await h.pool.query('DROP TRIGGER reject_health_review_audit ON payroll_audit_log')
 const saved=await api(path,body);assert.ok(saved.id);assert.equal((await h.pool.query("SELECT count(*)::int n FROM payroll_audit_log WHERE action='HEALTH_PLAN_QUALIFICATION_REVIEWED'")).rows[0].n,1)
})
test('competing health plan reviews retain one revision and database scope guards reject forged evidence',options,async t=>{
 const {api,h,path,body}=await fixture(t)
 const send=b=>fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify(b)})
 const responses=await Promise.all([send(body),send({...body,requestKey:randomUUID()})]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);assert.equal((await api(path)).history.length,1)
 const row=(await h.pool.query('SELECT * FROM payroll_health_plan_qualification')).rows[0]
 await assert.rejects(()=>h.pool.query('INSERT INTO payroll_health_plan_qualification(id,facility_id,plan_id,revision,effective_on,effective_through,source_fingerprint,source,review,document_sha256,document_pages,encrypted_document,request_key,request_fingerprint,created_by) VALUES($1,2,$2,1,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,99)',[randomUUID(),row.plan_id,row.effective_on,row.effective_through,row.source_fingerprint,row.source,row.review,row.document_sha256,row.document_pages,row.encrypted_document,randomUUID(),row.request_fingerprint]),/retained scope/)
})
