import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {carrierAlternateDeliveryHistory,checkCarrierAlternateDeliveries} from '../carrierAlternateDelivery.js'
import {carrierRemittanceFixture} from '../testing/carrierRemittanceFixture.js'
test('alternate carrier delivery retains exact advice, scope, encryption and correction history',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const priorKey=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='b'.repeat(64);t.after(()=>{if(priorKey===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=priorKey})
 const f=await carrierRemittanceFixture();t.after(()=>f.h.close());f.setNow('2026-09-20T12:00:00Z')
 await carrierAlternateDeliveryHistory(f.h.pool,1,f.payment.id)
 const path=`/carrier-payment-authorizations/${f.payment.id}/alternate-delivery`,model=await f.api(path)
 assert.equal(model.status,'NOT_RECORDED');assert.ok(model.advice)
 const body={action:'RECORD',expectedRevision:0,adviceFingerprint:model.advice.fingerprint,channel:'CARRIER_PORTAL',recipient:'Verified Carrier Team',destination:'Synthetic private carrier portal inbox',deliveredAt:'2026-09-19T12:00:00.000Z',reference:'Synthetic carrier portal delivery receipt reference',confirmed:true,requestKey:randomUUID()}
 await f.api(path,{...body,deliveredAt:'2026-09-21T00:00:00.000Z'},'POST',400)
 await f.api(path,{...body,deliveredAt:'2026-02-30T00:00:00.000Z'},'POST',400)
 await f.api(path,{...body,deliveredAt:new Date(Date.parse(model.advice.observedAt)-1).toISOString()},'POST',409)
 await f.api(path,{...body,adviceFingerprint:'bad'},'POST',409)
 const [a,b]=await Promise.all([f.api(path,body),f.api(path,body)]);assert.equal(a.id,b.id)
 await f.api(path,{...body,reference:'Different evidence under a reused request key'},'POST',409)
 await f.api(path,{...body,requestKey:randomUUID()},'POST',409)
 let saved=await f.api(path);assert.equal(saved.status,'RECORDED');assert.equal(saved.history.length,1);assert.equal(saved.history[0].destination,body.destination);assert.equal(saved.history[0].advice.text,model.advice.text)
 await f.api(`/carrier-payment-authorizations/${f.payment.id}/dispatch`,{action:'RECOVER',confirmed:true});assert.equal((await f.api(path)).status,'RECORDED')
 const raw=(await f.h.pool.query('SELECT encrypted_evidence FROM payroll_carrier_alternate_delivery')).rows[0].encrypted_evidence;assert.ok(Buffer.isBuffer(raw));assert.equal(raw.toString().includes(body.destination),false)
 await assert.rejects(f.h.pool.query('DELETE FROM payroll_carrier_alternate_delivery'),/append-only/)
 const foreign=await fetch(`${f.h.url}/api/admin/payroll${path}`,{headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2'}});assert.equal(foreign.status,404)
 assert.deepEqual(await checkCarrierAlternateDeliveries(f.h.pool,1,{now:f.now()}),{checked:1,failed:0})
 const key=process.env.PAYROLL_DOCUMENT_KEY;delete process.env.PAYROLL_DOCUMENT_KEY
 try{
  assert.deepEqual(await checkCarrierAlternateDeliveries(f.h.pool,1,{now:f.now()}),{checked:0,failed:1})
  const alert=(await f.h.pool.query('SELECT status,title FROM payroll_alert WHERE dedupe_key=$1',[`carrier-alternate-delivery:${f.payment.id}`])).rows[0];assert.equal(alert.status,'OPEN');assert.equal(alert.title,'Alternate carrier delivery check needs recovery')
  assert.equal((await f.h.pool.query('SELECT status FROM payroll_carrier_alternate_delivery_check WHERE review_id=$1',[a.id])).rows[0].status,'CHECK_FAILED')
  await f.api(path,undefined,'GET',503)
 }finally{process.env.PAYROLL_DOCUMENT_KEY=key}
 assert.deepEqual(await checkCarrierAlternateDeliveries(f.h.pool,1,{now:f.now()}),{checked:1,failed:0})
 assert.equal((await f.api(path)).history[0].reference,body.reference)
 assert.equal((await f.h.pool.query('SELECT status FROM payroll_alert WHERE dedupe_key=$1',[`carrier-alternate-delivery:${f.payment.id}`])).rows[0].status,'DISMISSED')
 await f.returnBank();saved=await f.api(path);assert.equal(saved.status,'EVIDENCE_CHANGED');await checkCarrierAlternateDeliveries(f.h.pool,1,{now:f.now()});assert.equal((await f.h.pool.query('SELECT status FROM payroll_alert WHERE dedupe_key=$1',[`carrier-alternate-delivery:${f.payment.id}`])).rows[0].status,'OPEN');assert.equal(saved.history[0].reference,body.reference);assert.equal((await f.h.pool.query('SELECT title FROM payroll_alert WHERE dedupe_key=$1',[`carrier-alternate-delivery:${f.payment.id}`])).rows[0].title,'Alternate carrier delivery evidence needs review')
 await f.api(path,{...body,expectedRevision:1,requestKey:randomUUID()},'POST',409)
 await f.api(path,{action:'RETRACT',expectedRevision:1,reference:'Carrier portal receipt was incorrect; retain original history',confirmed:true,requestKey:randomUUID()})
 saved=await f.api(path);assert.equal(saved.status,'RETRACTED');await checkCarrierAlternateDeliveries(f.h.pool,1,{now:f.now()});assert.equal((await f.h.pool.query('SELECT status FROM payroll_alert WHERE dedupe_key=$1',[`carrier-alternate-delivery:${f.payment.id}`])).rows[0].status,'DISMISSED');assert.equal(saved.history.length,2)
 await f.api(path,{action:'RETRACT',expectedRevision:2,reference:'Cannot retract an already retracted delivery review',confirmed:true,requestKey:randomUUID()},'POST',409)
 await f.h.pool.query(await readFile(new URL('../../migrations/813_payroll_onboarding.sql',import.meta.url),'utf8'));assert.equal((await f.api(path)).history.length,2)
 assert.equal((await f.h.pool.query('SELECT count(*) AS n FROM payroll_carrier_remittance_cancellation')).rows[0].n,'0')
})
