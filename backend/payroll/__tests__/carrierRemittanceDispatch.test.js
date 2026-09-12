import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {carrierRemittanceFixture} from '../testing/carrierRemittanceFixture.js'
import {processCarrierRemittance,carrierNoticeSenderOutcome} from '../carrierRemittanceDispatch.js'
import {runCarrierRemittanceSweep} from '../carrierRemittanceAutomation.js'
import {hashEmail} from '../../email/emailDeliveryStore.js'
test('remittance sender distinguishes acceptance, definite non-send and uncertainty',()=>{
 assert.equal(carrierNoticeSenderOutcome({sent:true}).outcome,'SMTP_ACCEPTED');assert.equal(carrierNoticeSenderOutcome({sent:false,skipped:true}).outcome,'NOT_SENT');assert.equal(carrierNoticeSenderOutcome({sent:false,skipped:true,reason:'duplicate'}).outcome,'UNCERTAIN');assert.equal(carrierNoticeSenderOutcome({sent:true},new Error('secret')).outcome,'UNCERTAIN')
})
for(const scenario of ['RETRY','UNCERTAIN','RESULT_FAILURE','REVOKED','RETURNED','EXHAUSTED'])test(`carrier remittance durable dispatch and recovery: ${scenario}`,{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const priorKey=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='31'.repeat(32);t.after(()=>{if(priorKey===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=priorKey})
 let sends=0,throwSender=scenario==='UNCERTAIN',mail
 const sender=async input=>{sends++;mail=input;if(throwSender)throw new Error('Synthetic secret sender error');return scenario==='EXHAUSTED'||scenario==='RETRY'&&sends===1?{sent:false,skipped:true,reason:'cooldown'}:{sent:true,messageId:'synthetic-accepted'}}
 const f=await carrierRemittanceFixture({sender});t.after(()=>f.h.close());const {h,api,notice,noticePath}=f
 if(scenario==='REVOKED')await api(f.recipientPath,{...f.recipientBody,action:'REVOKE',expectedRevision:1,requestKey:randomUUID()})
 if(scenario==='RETURNED')await f.returnBank()
 if(scenario==='RESULT_FAILURE')await h.pool.query("CREATE FUNCTION synthetic_remittance_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'secret result write unavailable'; END $$; CREATE TRIGGER synthetic_remittance_failure BEFORE INSERT ON payroll_carrier_remittance_result FOR EACH ROW EXECUTE FUNCTION synthetic_remittance_failure()")
 assert.equal((await runCarrierRemittanceSweep(h.pool,{facility:2,now:f.now(),sender})).checked,0)
 const sweeps=await Promise.all([runCarrierRemittanceSweep(h.pool,{facility:1,now:f.now(),sender}),runCarrierRemittanceSweep(h.pool,{facility:1,now:f.now(),sender})]);assert.equal(sweeps.reduce((n,r)=>n+r.checked,0),1)
 if(['REVOKED','RETURNED'].includes(scenario)){assert.equal(sends,0);assert.equal((await h.pool.query('SELECT * FROM payroll_carrier_remittance_claim')).rowCount,0);assert.equal((await api(noticePath)).history[0].status,'BLOCKED');await api(`${noticePath}/${notice.id}/cancel`,{confirmed:true,reference:'Cancel blocked notice before any attempt'});assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE dedupe_key=$1',[`carrier-remittance-${notice.id}`])).rows[0].status,'DISMISSED');return}
 await processCarrierRemittance(h.pool,1,notice.id,{sender,now:new Date(+f.now()+1000)});assert.equal(sends,1)
 await assert.rejects(h.pool.query('INSERT INTO payroll_carrier_remittance_attempt(notice_id,dispatch_key,created_at) VALUES($1,$2,$3)',[notice.id,randomUUID(),new Date(+f.now()+1000)]),/known non-send/)
 assert.equal(sends,1);assert.equal(mail.to,'carrier@example.test');assert.equal(mail.category,'payroll_carrier_remittance');assert.match(mail.text,/TEST REMITTANCE ADVICE/);assert.equal(mail.text.includes('1234'),false)
 assert.equal((await runCarrierRemittanceSweep(h.pool,{facility:1,now:new Date(+f.now()+1000),sender})).checked,0)
 await api(`${noticePath}/${notice.id}/cancel`,{confirmed:true,reference:'Cancellation after a committed send claim'},'POST',409)
 if(scenario==='RESULT_FAILURE')await h.pool.query('DROP TRIGGER synthetic_remittance_failure ON payroll_carrier_remittance_result')
 const later=new Date(+f.now()+300001);f.setNow(later)
 await Promise.all([processCarrierRemittance(h.pool,1,notice.id,{sender,now:later}),processCarrierRemittance(h.pool,1,notice.id,{sender,now:later})])
 if(['UNCERTAIN','RESULT_FAILURE'].includes(scenario)){
  assert.equal(sends,1);assert.equal((await api(noticePath)).history[0].status,'UNCERTAIN')
  const attempt=(await h.pool.query('SELECT * FROM payroll_carrier_remittance_attempt WHERE notice_id=$1',[notice.id])).rows[0]
  await h.pool.query('CREATE TABLE email_delivery(id BIGINT,facility_id BIGINT,recipient_hash TEXT,category TEXT,stream TEXT,template_version TEXT,status TEXT,idempotency_key TEXT,created_at TIMESTAMPTZ,accepted_at TIMESTAMPTZ,bounced_at TIMESTAMPTZ,complained_at TIMESTAMPTZ)')
  await h.pool.query("INSERT INTO email_delivery VALUES(1,2,$1,'payroll_carrier_remittance','transactional','carrier-remittance-v1','accepted',$2,$3,$4,NULL,NULL)",[hashEmail(mail.to),mail.idempotencyKey,attempt.created_at,new Date(+new Date(attempt.created_at)+1000)])
  await processCarrierRemittance(h.pool,1,notice.id,{sender,now:later});assert.equal((await api(noticePath)).history[0].status,'UNCERTAIN')
  await h.pool.query('UPDATE email_delivery SET facility_id=1')
  assert.equal((await processCarrierRemittance(h.pool,1,notice.id,{sender,now:later})).status,'SMTP_ACCEPTED');assert.equal(sends,1);assert.equal((await h.pool.query('SELECT * FROM payroll_carrier_remittance_acceptance')).rowCount,1)
 }else if(scenario==='RETRY'){assert.equal(sends,2);assert.equal((await api(noticePath)).history[0].status,'SMTP_ACCEPTED')}
 else{assert.equal(sends,2);f.setNow(new Date(+later+300001));await processCarrierRemittance(h.pool,1,notice.id,{sender,now:f.now()});assert.equal(sends,3);assert.equal((await processCarrierRemittance(h.pool,1,notice.id,{sender,now:new Date(+f.now()+300001)})).status,'EXHAUSTED');assert.equal(sends,3)}
 await runCarrierRemittanceSweep(h.pool,{facility:1,now:new Date(+f.now()+300001),sender});assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE dedupe_key=$1',[`carrier-remittance-${notice.id}`])).rows[0].status,scenario==='EXHAUSTED'?'OPEN':'DISMISSED')
 if(scenario!=='EXHAUSTED')assert.equal((await runCarrierRemittanceSweep(h.pool,{facility:1,now:new Date(+f.now()+600001),sender})).checked,0)
 for(const table of ['payroll_carrier_remittance_attempt','payroll_carrier_remittance_result','payroll_carrier_remittance_acceptance','payroll_carrier_remittance_check'])if((await h.pool.query(`SELECT 1 FROM ${table} LIMIT 1`)).rowCount)await assert.rejects(h.pool.query(`DELETE FROM ${table}`),/append-only/)
 await assert.rejects(h.pool.query('INSERT INTO payroll_carrier_remittance_attempt(notice_id,dispatch_key,created_at) VALUES($1,$2,$3)',[notice.id,randomUUID(),new Date(+f.now()+900000)]),/known non-send/)
 const foreign={Authorization:'Bearer payroll-test-admin','x-test-facility':'2','Content-Type':'application/json'};assert.equal((await fetch(`${h.url}/api/admin/payroll${noticePath}/${notice.id}/process`,{method:'POST',headers:foreign,body:'{"confirmed":true}'})).status,404)
 await h.pool.query(await readFile(new URL('../../migrations/813_payroll_onboarding.sql',import.meta.url),'utf8'));assert.equal((await api(noticePath)).history[0].delivery.history.length,sends)
})
