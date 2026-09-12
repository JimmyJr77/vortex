import test from 'node:test'
import assert from 'node:assert/strict'
import {randomUUID} from 'node:crypto'
import {readFile} from 'node:fs/promises'
import {carrierRemittanceFixture} from '../testing/carrierRemittanceFixture.js'
import {runCarrierRemittanceSweep} from '../carrierRemittanceAutomation.js'
import {processCarrierRemittance} from '../carrierRemittanceDispatch.js'
import {readCarrierUnsentProof} from '../carrierRemittanceUnsentProof.js'
import {hashEmail} from '../../email/emailDeliveryStore.js'
for(const scenario of ['EARLY','EXHAUSTED','UNCERTAIN','ACCEPTED','LATE_ACCEPTANCE','AFTER_RELEASE'])test(`carrier proven-non-send release: ${scenario}`,{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const prior=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='31'.repeat(32);t.after(()=>{if(prior===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=prior})
 let sends=0,allowSend=scenario==='ACCEPTED',mail
 const sender=async input=>{sends++;mail=input;if(scenario==='UNCERTAIN')throw new Error('Synthetic uncertain transport');return allowSend?{sent:true,messageId:'synthetic-accepted'}:{sent:false,skipped:true,reason:'category_disabled'}}
 const f=await carrierRemittanceFixture({sender});t.after(()=>f.h.close());const {h,api,noticePath}=f,releasePath=`${noticePath}/${f.notice.id}/release-unsent`
 await h.pool.query('CREATE TABLE email_delivery(id BIGINT PRIMARY KEY,facility_id BIGINT,recipient_hash TEXT,category TEXT,stream TEXT,template_version TEXT,status TEXT,idempotency_key TEXT,created_at TIMESTAMPTZ,accepted_at TIMESTAMPTZ,bounced_at TIMESTAMPTZ,complained_at TIMESTAMPTZ)')
 const sweep=()=>runCarrierRemittanceSweep(h.pool,{facility:1,now:f.now(),sender})
 await sweep()
 if(scenario==='EXHAUSTED')for(let i=0;i<2;i++){f.setNow(new Date(+f.now()+300001));await sweep()}
 const preview=await api(`${releasePath}/preview`,{}),body={fingerprint:preview.fingerprint,reference:'Investigated all non-send attempts and corrected delivery setup before release',confirmed:true,requestKey:randomUUID()}
 if(['UNCERTAIN','ACCEPTED'].includes(scenario)){assert.equal(preview.eligible,false);await api(releasePath,body,'POST',409);return}
 assert.equal(preview.eligible,true)
 if(scenario==='EARLY'){const proof=await readCarrierUnsentProof(h.pool,{id:f.notice.id,facility_id:1},hashEmail('carrier@example.test'));await assert.rejects(h.pool.query('INSERT INTO payroll_carrier_remittance_unsent_release(notice_id,facility_id,evidence,reference,request_key,request_fingerprint,created_by) VALUES($1,1,$2,$3,$4,$5,99)',[f.notice.id,{...proof.snapshot,attempts:[]},'Reject omitted attempt evidence',randomUUID(),'0'.repeat(64)]),/Every attempt/)}
 const addAcceptance=async()=>{const attempt=(await h.pool.query('SELECT * FROM payroll_carrier_remittance_attempt ORDER BY id DESC LIMIT 1')).rows[0];await h.pool.query("INSERT INTO email_delivery VALUES(1,1,$1,'payroll_carrier_remittance','transactional','carrier-remittance-v1','accepted',$2,$3,$4,NULL,NULL)",[hashEmail(mail.to),mail.idempotencyKey,attempt.created_at,new Date(+new Date(attempt.created_at)+1000)])}
 if(scenario==='LATE_ACCEPTANCE'){await addAcceptance();await api(releasePath,body,'POST',409);assert.equal((await api(`${releasePath}/preview`,{})).eligible,false);return}
 await api(releasePath,{...body,confirmed:false},'POST',400)
 const saved=await Promise.all([api(releasePath,body),api(releasePath,body)]);assert.equal(saved[0].id,saved[1].id)
 await api(releasePath,{...body,reference:'Conflicting release reference with the same key'},'POST',409)
 assert.equal((await api(noticePath)).history[0].status,'UNSENT_RELEASED');assert.equal((await h.pool.query('SELECT * FROM payroll_carrier_remittance_unsent_release')).rowCount,1)
 const before=sends;await sweep();assert.equal(sends,before);assert.equal((await processCarrierRemittance(h.pool,1,f.notice.id,{sender,now:f.now()})).status,'UNSENT_RELEASED')
 if(scenario==='EARLY'){
  await h.pool.query('ALTER TABLE email_delivery RENAME TO synthetic_unavailable_delivery')
  assert.equal((await api(noticePath)).history[0].status,'RELEASE_NEEDS_REVIEW');await api(`${noticePath}/preview`,{},'POST',503)
  f.setNow(new Date(+f.now()+300001));await sweep();assert.equal(sends,before)
  assert.equal((await h.pool.query('SELECT status FROM payroll_alert WHERE dedupe_key=$1',[`carrier-remittance-${f.notice.id}`])).rows[0].status,'OPEN')
  await h.pool.query('ALTER TABLE synthetic_unavailable_delivery RENAME TO email_delivery');f.setNow(new Date(+f.now()+300001));await sweep()
  assert.equal((await api(noticePath)).history[0].status,'UNSENT_RELEASED')
 }
 const nextPreview=await api(`${noticePath}/preview`,{}),next=await api(noticePath,{fingerprint:nextPreview.fingerprint,confirmed:true,reference:'Separate reviewed replacement notice after non-send release',requestKey:randomUUID()})
 if(scenario==='AFTER_RELEASE'){
  await addAcceptance();await sweep();assert.equal(sends,before)
  const rows=(await api(noticePath)).history;assert.equal(rows.find(row=>row.id===f.notice.id).status,'RELEASE_NEEDS_REVIEW');assert.equal(rows.find(row=>row.id===next.id).status,'BLOCKED')
 }else{allowSend=true;await sweep();assert.equal(sends,before+1);assert.equal((await api(noticePath)).history.find(row=>row.id===next.id).status,'SMTP_ACCEPTED')}
 await assert.rejects(h.pool.query('INSERT INTO payroll_carrier_remittance_attempt(notice_id,dispatch_key,created_at) VALUES($1,$2,$3)',[f.notice.id,randomUUID(),new Date(+f.now()+900000)]),/released/i)
 await assert.rejects(h.pool.query('DELETE FROM payroll_carrier_remittance_unsent_release'),/append-only/)
 const foreign=await fetch(`${h.url}/api/admin/payroll${releasePath}/preview`,{method:'POST',headers:{Authorization:'Bearer payroll-test-admin','x-test-facility':'2','Content-Type':'application/json'},body:'{}'});assert.equal(foreign.status,404)
 await h.pool.query(await readFile(new URL('../../migrations/813_payroll_onboarding.sql',import.meta.url),'utf8'));assert.equal((await h.pool.query('SELECT * FROM payroll_carrier_remittance_unsent_release')).rowCount,1)
})
test('non-send release waits for an in-flight sender and rejects an obsolete attempt preview',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const prior=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='31'.repeat(32);t.after(()=>{if(prior===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=prior})
 let finish,started,sends=0
 const began=new Promise(resolve=>{started=resolve}),pending=new Promise(resolve=>{finish=resolve})
 const sender=async()=>{sends++;if(sends===1){started();await pending}return {sent:false,skipped:true,reason:'category_disabled'}}
 const f=await carrierRemittanceFixture({sender});t.after(()=>f.h.close());const {h,api,noticePath}=f,path=`${noticePath}/${f.notice.id}/release-unsent`
 await h.pool.query('CREATE TABLE email_delivery(id BIGINT PRIMARY KEY,facility_id BIGINT,recipient_hash TEXT,category TEXT,stream TEXT,template_version TEXT,status TEXT,idempotency_key TEXT,created_at TIMESTAMPTZ,accepted_at TIMESTAMPTZ,bounced_at TIMESTAMPTZ,complained_at TIMESTAMPTZ)')
 const sending=processCarrierRemittance(h.pool,1,f.notice.id,{sender,now:f.now()});await began
 let previewDone=false;const previewing=api(`${path}/preview`,{}).then(value=>{previewDone=true;return value})
 try{await new Promise(resolve=>setTimeout(resolve,50));assert.equal(previewDone,false)}finally{finish()}await sending;const preview=await previewing;assert.equal(preview.eligible,true)
 f.setNow(new Date(+f.now()+300001));await processCarrierRemittance(h.pool,1,f.notice.id,{sender,now:f.now()});assert.equal(sends,2)
 const body={fingerprint:preview.fingerprint,reference:'Reviewed sender completion before releasing old notice',confirmed:true,requestKey:randomUUID()}
 await api(path,body,'POST',409);const refreshed=await api(`${path}/preview`,{});assert.equal(refreshed.attempts.length,2);await api(path,{...body,fingerprint:refreshed.fingerprint,requestKey:randomUUID()})
 assert.equal((await api(noticePath)).history[0].status,'UNSENT_RELEASED')
})
