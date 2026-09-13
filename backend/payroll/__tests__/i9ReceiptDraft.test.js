import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {receiptFixture} from '../testing/receiptFixture.js'
import {i9ReceiptDraftInput,readI9ReceiptDraft} from '../i9ReceiptDraft.js'
test('unfinished receipt amendment entries retain partial data but reject signatures, confirmations and unsupported fields',()=>{
 assert.deepEqual(i9ReceiptDraftInput({form:{expiresOn:'2026-0'},facts:{identityEvidence:'Work in progress\nnext line'}}),{form:{expiresOn:'2026-0'},facts:{identityEvidence:'Work in progress\nnext line'}})
 for(const draft of [{form:false},{signature:'Admin'},{form:{signature:'Admin'}},{facts:{attestationRead:true}},{form:{list:'B'}},{facts:{copyIds:['1']}},{facts:{authorizationIndefinite:true}},{form:{initials:'A'.repeat(21)}}])assert.throws(()=>i9ReceiptDraftInput(draft),e=>e.status===400)
})
test('encrypted admin draft supports retries, revision conflicts, rollback and source invalidation',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='96'.repeat(32);t.after(()=>{if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const h=await createHarness();t.after(()=>h.close());const {api,employee,signed}=await receiptFixture(h)
 const task=(await h.pool.query('SELECT compliance_task_id FROM payroll_i9_signature_followup WHERE signature_id=$1',[signed.signatureId])).rows[0].compliance_task_id,path=`/employees/${employee.id}/i9/receipt/${task}/draft`
 const initial=await api(path);assert.equal(initial.revision,0);assert.equal(initial.draft,null)
 const body={basisHash:initial.basisHash,expectedRevision:0,requestKey:randomUUID(),draft:{form:{number:'PRIVATE-RECEIPT-DRAFT'},facts:{identityEvidence:'Private unfinished examination notes.'}}}
 const [saved,retry]=await Promise.all([api(path,body),api(path,body)]);assert.deepEqual(saved,retry);assert.equal(saved.revision,1)
 assert.deepEqual(await api(path,{...body,requestKey:body.requestKey.toUpperCase()}),saved)
 await api(path,{...body,draft:{form:{number:'Different'}}},'POST',409)
 await api(path,{...body,requestKey:randomUUID()},'POST',409)
 assert.deepEqual((await api(path)).draft,body.draft)
 const row=(await h.pool.query('SELECT * FROM payroll_i9_receipt_draft')).rows[0];assert.equal(row.encrypted_draft.includes(Buffer.from('PRIVATE-RECEIPT-DRAFT')),false)
 const client=await h.pool.connect();try{await client.query('BEGIN');assert.equal((await readI9ReceiptDraft(client,{facility:1,employee:employee.id,admin:100},task)).draft,null);await client.query('ROLLBACK')}finally{client.release()}
 const next={...body,expectedRevision:1,requestKey:randomUUID(),draft:{form:{number:'SECOND-PRIVATE-DRAFT'},facts:{}}}
 await h.pool.query(`CREATE FUNCTION reject_receipt_draft_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='I9_RECEIPT_DRAFT_SAVED' THEN RAISE EXCEPTION 'Synthetic save audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_receipt_draft_audit BEFORE INSERT ON payroll_audit_log FOR EACH ROW EXECUTE FUNCTION reject_receipt_draft_audit()`)
 await api(path,next,'POST',500);assert.equal((await api(path)).revision,1)
 await h.pool.query('DROP TRIGGER reject_receipt_draft_audit ON payroll_audit_log')
 assert.equal((await api(path,next)).revision,2)
 await h.pool.query("UPDATE payroll_compliance_task SET status='IN_PROGRESS' WHERE id=$1",[task])
 const changed=await api(path);assert.equal(changed.invalidated,true);assert.equal(changed.draft,null);assert.equal(changed.revision,2)
 await api(path,{...next,expectedRevision:2,requestKey:randomUUID()},'POST',409)
 assert.equal((await api(path,{...next,basisHash:changed.basisHash,expectedRevision:2,requestKey:randomUUID()})).revision,3)
 const foreign=await fetch(`${h.url}/api/admin/payroll${path}`,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}});assert.equal(foreign.status,404)
 assert.equal(JSON.stringify((await h.pool.query("SELECT after_data FROM payroll_audit_log WHERE action='I9_RECEIPT_DRAFT_SAVED'")).rows).includes('PRIVATE'),false)
 await assert.rejects(()=>h.pool.query('DELETE FROM payroll_i9_receipt_draft'),/cannot be deleted/)
})
