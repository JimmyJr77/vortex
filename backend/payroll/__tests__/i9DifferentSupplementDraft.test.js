import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {supplementReceiptFixture} from '../testing/supplementReceiptFixture.js'
import {readI9DifferentSupplementDraft,i9DifferentSupplementDraftInput} from '../i9DifferentSupplementDraft.js'
test('replacement supplement draft excludes signature evidence',()=>{
 assert.deepEqual(i9DifferentSupplementDraftInput({form:{reason:'First line\nSecond line'},facts:{physical:'yes'}}),{form:{reason:'First line\nSecond line'},facts:{physical:'yes'}})
 for(const raw of [{signature:'A'},{form:{list:'B'}},{facts:{copiesComplete:true}},{facts:{copyIds:['1']}},{facts:{attestationRead:true}},{form:{reason:'x'.repeat(2001)}}])assert.throws(()=>i9DifferentSupplementDraftInput(raw))
})
test('replacement supplement drafts are encrypted, scoped, retryable and reject concurrent stale saves',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='98'.repeat(32)
 t.after(()=>{if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const h=await createHarness();t.after(()=>h.close())
 const {api,employee,receiptTaskId}=await supplementReceiptFixture(h),ctx={facility:1,employee:employee.id,admin:99}
 const path=`/employees/${employee.id}/i9/different-supplement/${receiptTaskId}/draft`,initial=await api(path)
 assert.equal(initial.revision,0);assert.equal(initial.draft,null)
 const request={basisHash:initial.basisHash,expectedRevision:0,requestKey:randomUUID(),draft:{form:{list:'C',reason:'Unfinished replacement reason',title:'Partial document'},facts:{identity:'Reviewer notes',physical:'yes',followUpKind:'REVERIFICATION'}}}
 const saved=await api(path,request)
 assert.equal(saved.revision,1)
 assert.deepEqual(await api(path,{...request,requestKey:request.requestKey.toUpperCase()}),saved)
 assert.deepEqual((await api(path)).draft,request.draft)
 assert.equal((await readI9DifferentSupplementDraft(h.pool,{...ctx,admin:100},receiptTaskId)).draft,null)
 const encrypted=(await h.pool.query('SELECT encrypted_draft FROM payroll_i9_different_supplement_draft')).rows[0].encrypted_draft
 assert.equal(encrypted.includes(Buffer.from('Unfinished replacement reason')),false)
 await assert.rejects(()=>api(path,{...request,draft:{form:{reason:'Changed entries'}}}),/409/)
 const responses=await Promise.all([1,2].map(n=>fetch(`${h.url}/api/admin/payroll${path}`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},body:JSON.stringify({...request,expectedRevision:1,requestKey:randomUUID(),draft:{form:{reason:`Concurrent edit ${n}`}}})})))
 assert.deepEqual(responses.map(r=>r.status).sort(),[200,409])
 assert.equal((await api(path)).revision,2)
 const foreign=await fetch(`${h.url}/api/admin/payroll${path}`,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}})
 assert.equal(foreign.status,404)
 await h.pool.query("UPDATE payroll_compliance_task SET status='IN_PROGRESS' WHERE id=$1",[receiptTaskId])
 const changed=await api(path)
 assert.equal(changed.invalidated,true);assert.equal(changed.draft,null);assert.equal(changed.revision,2)
 await assert.rejects(()=>api(path,{...request,expectedRevision:2,requestKey:randomUUID()}),/409/)
 const replacement=await api(path,{...request,basisHash:changed.basisHash,expectedRevision:2,requestKey:randomUUID()})
 assert.equal(replacement.revision,3);assert.equal(replacement.invalidated,false)
 await assert.rejects(()=>h.pool.query('DELETE FROM payroll_i9_different_supplement_draft'),/cannot be deleted/)
})
