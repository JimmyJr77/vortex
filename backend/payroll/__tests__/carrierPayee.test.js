import test from 'node:test'
import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {createHarness} from '../testing/harness.js'
import {readCarrierPayee} from '../carrierPayee.js'
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`
test('carrier setup binds fresh provider evidence, retains encrypted revisions and isolates employers',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const old=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY=randomBytes(32).toString('hex')
 let unavailable=false,changed=false,posts=0
 const account={id:id(3),counterparty_id:id(4),party_type:'business',party_name:'Synthetic Carrier',account_type:'checking',live_mode:false,verification_status:'verified',updated_at:'2026-09-11T12:00:00Z',account_details:[{id:id(5),account_number_safe:'1234'}],routing_details:[{id:id(6),payment_type:'ach',routing_number_type:'aba',routing_number:'021000021'}]}
 const h=await createHarness({paymentFetcher:async(url,options)=>{if(options.method==='POST')posts++;assert.equal(options.method,undefined);return {ok:!unavailable,status:unavailable?503:200,json:async()=>url.includes('/internal_accounts/')?{id:id(2),currency:'USD',live_mode:false}:{...account,updated_at:changed?'2026-09-11T12:01:00Z':account.updated_at}}}})
 t.after(async()=>{await h.close();if(old===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=old})
 const headers={Authorization:'Bearer payroll-test-admin','Content-Type':'application/json'},base=`${h.url}/api/admin/payroll/carrier-payees`
 const post=(path,body,extra={})=>fetch(`${h.url}/api/admin/payroll/${path}`,{method:'POST',headers:{...headers,...extra},body:JSON.stringify(body)})
 const connection={organizationId:id(1),originatingAccountId:id(2),apiKey:'synthetic-private-key',mode:'TEST',reference:'Reviewed employer account',expectedRevision:0,confirmed:true}
 const saved=await (await post('payment-connection',connection)).json(),connectionRevision=saved.data.revision
 const input={carrier:'Synthetic Carrier',accountId:id(3),connectionRevision}
 const preview=async()=>{const response=await post('carrier-payees/preview',input);assert.equal(response.status,200);return (await response.json()).data}
 assert.equal((await fetch(`${base}?carrier=Synthetic`)).status,401)
 const empty=await (await fetch(`${base}?carrier=Synthetic`,{headers})).json();assert.deepEqual(empty.data.history,[])
 assert.equal((await post('carrier-payees/preview',input,{'x-test-facility':'2'})).status,409)
 const p=await preview(),body={...input,previousId:p.previousId,fingerprint:p.fingerprint,reference:'Reviewed carrier issued payment instructions',confirmed:true}
 assert.equal(p.account.accountLast4,'1234');assert.equal(JSON.stringify(p).includes(id(3)),false)
 changed=true;assert.equal((await post('carrier-payees',body)).status,409);changed=false
 assert.equal((await post('carrier-payees',{...body,confirmed:false})).status,400)
 const races=await Promise.all([post('carrier-payees',body),post('carrier-payees',body)]);assert.deepEqual(races.map(r=>r.status).sort(),[200,409])
 const first=(await races.find(r=>r.status===200).json()).data
 const row=(await h.pool.query('SELECT * FROM payroll_carrier_payee')).rows[0]
 assert.equal(row.encrypted_destination.includes(Buffer.from(id(3))),false);assert.equal(JSON.stringify(row.masked_destination).includes(id(3)),false)
 assert.equal((await readCarrierPayee(h.pool,1,first.id)).destination.accountId,id(3))
 await assert.rejects(readCarrierPayee(h.pool,2,first.id),/not found/)
 await assert.rejects(h.pool.query('DELETE FROM payroll_carrier_payee'),/append-only/)
 assert.equal((await post(`carrier-payees/${first.id}/verify`,{}, {'x-test-facility':'2'})).status,404)
 for(const [change,down,status] of [[false,false,'VERIFIED'],[true,false,'CHANGED'],[false,true,'UNAVAILABLE']]){
  changed=change;unavailable=down
  const result=await post(`carrier-payees/${first.id}/verify`,{});assert.equal(result.status,200);assert.equal((await result.json()).data.status,status)
 }
 changed=false;unavailable=false
 const nextConnection=await (await post('payment-connection',{...connection,expectedRevision:connectionRevision,apiKey:'replacement-synthetic-key'})).json()
 assert.equal((await (await post(`carrier-payees/${first.id}/verify`,{})).json()).data.status,'CONNECTION_CHANGED')
 assert.equal((await post('carrier-payees/preview',input)).status,409)
 input.connectionRevision=nextConnection.data.revision
 const next=await preview();assert.equal(next.previousId,first.id)
 const second=await post('carrier-payees',{...body,...input,previousId:next.previousId,fingerprint:next.fingerprint});assert.equal(second.status,200)
 assert.equal((await second.json()).data.revision,2)
 assert.equal((await post(`carrier-payees/${first.id}/verify`,{})).status,409)
 const listing=await fetch(`${base}?carrier=Synthetic%20Carrier`,{headers}),raw=await listing.text();assert.equal(listing.headers.get('cache-control'),'no-store');assert.ok(!raw.includes(id(3)));assert.ok(!raw.includes('synthetic-private-key'))
 const history=JSON.parse(raw).data.history;assert.equal(history.length,2);assert.equal(history[0].current,true);assert.equal(history[1].connectionCurrent,false);assert.equal(history[1].checks.length,5)
 assert.equal((await (await fetch(`${base}?carrier=Synthetic%20Carrier`,{headers:{...headers,'x-test-facility':'2'}})).json()).data.history.length,0)
 await assert.rejects(h.pool.query('DELETE FROM payroll_carrier_payee_check'),/append-only/)
 await assert.rejects(h.pool.query('INSERT INTO payroll_carrier_payee(id,facility_id,carrier_key,carrier_name,revision,connection_id,encrypted_destination,masked_destination,fingerprint,reference,created_by) SELECT $1,2,carrier_key,carrier_name,1,connection_id,encrypted_destination,masked_destination,fingerprint,reference,created_by FROM payroll_carrier_payee LIMIT 1',[id(40)]),/current employer payment connection/)
 assert.equal(posts,0)
})
