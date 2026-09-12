import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes,randomUUID} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {decryptDocument} from '../onboarding.js'
import {retirementDestinationProvider} from '../testing/retirementDestinationProvider.js'
import {retirementRemittanceAuthorizationFixture} from '../testing/retirementRemittanceAuthorizationFixture.js'
test('remittance authorization reserves exact contributions once, encrypts allocations and preserves offline cancellation',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY,key=randomBytes(32).toString('hex');process.env.PAYROLL_DOCUMENT_KEY=key
 const provider=retirementDestinationProvider(),h=await createHarness({paymentFetcher:provider.fetcher,remittanceNow:()=>new Date('2026-09-19T12:00:00Z'),retirementNow:()=>new Date('2026-09-11T12:00:00Z')});t.after(async()=>{await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const {api,path,body,run}=await retirementRemittanceAuthorizationFixture(h)
 await api(path,{...body,outsideActivityReviewed:false},'POST',400)
 await api(path,{...body,amountCents:1401},'POST',409)
 const [a,b]=await Promise.all([api(path,body),api(path,body)]);assert.equal(a.id,b.id)
 await api(path,{...body,requestKey:randomUUID()},'POST',409)
 await api(path,{...body,reference:'Different review with the same request identity'},'POST',409)
 const row=(await h.pool.query('SELECT * FROM payroll_retirement_remittance_authorization WHERE id=$1',[a.id])).rows[0]
 assert.equal(Number(row.amount_cents),1400);assert.ok(!JSON.stringify(row.basis).includes('PRIVATE-PARTICIPANT'));assert.ok(!row.encrypted_allocation.toString().includes('PRIVATE-PARTICIPANT'))
 assert.match(decryptDocument(row.encrypted_allocation,`payroll-retirement-remittance:1:${a.id}`).toString(),/PRIVATE-PARTICIPANT-54321/)
 assert.equal((await api(path)).history[0].status,'RESERVED_NOT_SENT');assert.equal((await api(path)).history[0].sourceCurrent,true)
 const foreign=await fetch(`${h.url}/api/admin/payroll${path}`,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}});assert.equal(foreign.status,404)
 await assert.rejects(h.pool.query('UPDATE payroll_retirement_remittance_authorization SET amount_cents=1 WHERE id=$1',[a.id]),/immutable|append|cannot|not allowed/i)
 provider.unavailable(true);delete process.env.PAYROLL_DOCUMENT_KEY
 assert.equal((await api(path)).history[0].sourceCurrent,false)
 const cancelPath=`/retirement-remittance-authorizations/${a.id}/cancel`,cancel={reference:'Cancel unsubmitted authorization pending trustee instruction review',confirmed:true,requestKey:randomUUID()}
 const reads=provider.reads(),[c,d]=await Promise.all([api(cancelPath,cancel),api(cancelPath,cancel)]);assert.equal(c.id,d.id);assert.equal(provider.reads(),reads)
 const retry=await api(path,body);assert.equal(retry.id,a.id);assert.equal(retry.cancelled,true);assert.equal((await api(path)).history[0].status,'CANCELLED')
 await assert.rejects(h.pool.query('INSERT INTO payroll_retirement_remittance_claim(id,authorization_id) VALUES($1,$2)',[randomUUID(),a.id]),/Cancelled/)
 process.env.PAYROLL_DOCUMENT_KEY=key;provider.unavailable(false)
 const renewed=await api(path,{...body,requestKey:randomUUID()});assert.notEqual(renewed.id,a.id)
 await h.pool.query('INSERT INTO payroll_retirement_remittance_claim(id,authorization_id) VALUES($1,$2)',[randomUUID(),renewed.id])
 await api(`/retirement-remittance-authorizations/${renewed.id}/cancel`,{...cancel,requestKey:randomUUID()},'POST',409)
 await assert.rejects(h.pool.query('INSERT INTO payroll_retirement_remittance_cancellation(id,facility_id,authorization_id,reference,request_key,request_fingerprint,created_by) VALUES($1,1,$2,$3,$4,$5,99)',[randomUUID(),renewed.id,cancel.reference,randomUUID(),'test']),/unclaimed/)
 assert.equal((await api(path)).history[0].status,'CLAIMED');assert.equal((await h.pool.query('SELECT count(*)::int AS count FROM payroll_retirement_run_ledger WHERE run_id=$1',[run.id])).rows[0].count,1);assert.equal(provider.posts(),0)
})
test('authorization refuses changed bank evidence and expired submission windows without reserving contributions',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex');let clock=new Date('2026-09-19T12:00:00Z')
 const provider=retirementDestinationProvider();let advanceDuringRead=false;const fetcher=async(...args)=>{const result=await provider.fetcher(...args);if(advanceDuringRead)clock=new Date('2026-09-21T18:00:00Z');return result},h=await createHarness({paymentFetcher:fetcher,remittanceNow:()=>clock,retirementNow:()=>new Date('2026-09-11T12:00:00Z')});t.after(async()=>{await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const {api,path,body,run}=await retirementRemittanceAuthorizationFixture(h)
 provider.change(true);await api(path,body,'POST',409);provider.change(false)
 advanceDuringRead=true;await api(path,body,'POST',409);advanceDuringRead=false
 clock=new Date('2026-09-21T18:00:00Z')
 const source=(await api('/retirement-remittance-sources')).items[0],file=await api(`/runs/${run.id}/retirement-allocation-file`,{planId:'standard',sourceFingerprint:source.sourceFingerprint})
 await api(path,{...body,sourceFingerprint:source.sourceFingerprint,fileFingerprint:file.fingerprint},'POST',409)
 assert.equal((await h.pool.query('SELECT count(*)::int AS count FROM payroll_retirement_remittance_authorization')).rows[0].count,0);assert.equal(provider.posts(),0)
})
