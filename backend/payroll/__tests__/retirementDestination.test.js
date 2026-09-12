import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID,randomBytes} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {retirementPlanFixture} from '../testing/retirementPlanFixture.js'
import {readRetirementDestination} from '../retirementDestination.js'
import {id,retirementDestinationProvider} from '../testing/retirementDestinationProvider.js'
test('retirement destination retains encrypted scoped evidence, exact retries and current-plan checks',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 const provider=retirementDestinationProvider(),h=await createHarness({paymentFetcher:provider.fetcher});t.after(async()=>{await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const api=async(path,body,expected=200,facility=1)=>{const r=await fetch(`${h.url}/api/admin/payroll${path}`,{method:body?'POST':'GET',headers:{Authorization:'Bearer payroll-test-admin','Content-Type':'application/json','x-test-facility':String(facility)},body:body?JSON.stringify(body):undefined});const j=await r.json();assert.equal(r.status,expected,JSON.stringify(j));return j.data}
 await api('/retirement-plans',{plan:retirementPlanFixture(),expectedRevision:0,requestKey:randomUUID()})
 const connection={organizationId:id(1),originatingAccountId:id(2),apiKey:'synthetic-retirement-private',mode:'TEST',reference:'Reviewed synthetic funding account',expectedRevision:0,confirmed:true}
 await api('/payment-connection',connection,201)
 const path='/retirement-plans/standard/destination',initial=await api(path)
 assert.deepEqual(initial.history,[]);await api(path,undefined,404,2)
 assert.equal((await fetch(`${h.url}/api/admin/payroll${path}`)).status,401)
 const input={accountId:id(3),planRevisionId:initial.planRevisionId,connectionRevision:initial.connectionRevision},preview=await api(path+'/preview',input)
 assert.equal(preview.account.accountLast4,'1234');assert.ok(!JSON.stringify(preview).includes(id(3)))
 const body={...input,...preview,requestKey:randomUUID(),confirmed:true,reference:'Reviewed trustee-issued instructions for this exact retirement plan'}
 provider.change(true);await api(path,body,409);provider.change(false)
 const [first,retry]=await Promise.all([api(path,body),api(path,body)]);assert.equal(first.id,retry.id)
 provider.unavailable(true);assert.equal((await api(path,body)).id,first.id);provider.unavailable(false)
 await api(path,{...body,reference:'Different independently reviewed instructions'},409)
 const row=(await h.pool.query('SELECT * FROM payroll_retirement_destination')).rows[0];assert.ok(!row.encrypted_destination.includes(Buffer.from(id(3))));assert.equal((await readRetirementDestination(h.pool,1,row.id)).destination.accountId,id(3));await assert.rejects(readRetirementDestination(h.pool,2,row.id),/not found/)
 for(const [changed,down,status] of [[false,false,'VERIFIED'],[true,false,'CHANGED'],[false,true,'UNAVAILABLE']]){provider.change(changed);provider.unavailable(down);assert.equal((await api(`${path}/${row.id}/verify`,{})).status,status)}
 provider.change(false);provider.unavailable(false)
 await api('/retirement-plans',{plan:{...retirementPlanFixture(),name:'Revised retirement plan'},expectedRevision:1,requestKey:randomUUID()})
 assert.equal((await api(`${path}/${row.id}/verify`,{})).status,'PLAN_CHANGED');assert.equal((await api(path)).history[0].planCurrent,false)
 await api(path+'/preview',input,409)
 assert.equal((await api(path,body)).id,first.id)
 const latest=await api(path),nextInput={...input,planRevisionId:latest.planRevisionId},next=await api(path+'/preview',nextInput)
 const second=await api(path,{...body,...nextInput,...next,requestKey:randomUUID()});assert.equal(second.revision,2)
 await api(`${path}/${row.id}/verify`,{},409)
 await api('/payment-connection',{...connection,expectedRevision:initial.connectionRevision,apiKey:'replacement-synthetic-key'},201)
 assert.equal((await api(`${path}/${second.id}/verify`,{})).status,'CONNECTION_CHANGED')
 const raw=JSON.stringify(await api(path));assert.ok(!raw.includes(id(3)));assert.ok(!raw.includes('synthetic-retirement-private'))
 await assert.rejects(h.pool.query('DELETE FROM payroll_retirement_destination'),/append-only/);await assert.rejects(h.pool.query('DELETE FROM payroll_retirement_destination_check'),/append-only/)
 await assert.rejects(h.pool.query('INSERT INTO payroll_retirement_destination SELECT $1,2,plan_id,plan_revision_id,revision,connection_id,encrypted_destination,masked_destination,fingerprint,reference,$2,request_fingerprint,created_by,created_at FROM payroll_retirement_destination LIMIT 1',[randomUUID(),randomUUID()]),/current employer plan/)
 assert.equal(provider.posts(),0)
})
