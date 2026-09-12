import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {carrierNoticePreview} from '../carrierRemittanceNotice.js'
import {generateKeyPairSync,randomUUID,sign} from 'node:crypto'
import {carrierRemittanceFixture} from '../testing/carrierRemittanceFixture.js'
import {retainW2ProviderEvents} from '../w2NoticeProviderIntake.js'
import {runCarrierRemittanceSweep} from '../carrierRemittanceAutomation.js'
import {processCarrierRemittance} from '../carrierRemittanceDispatch.js'
import {hashEmail,registerEmailPool,updateDeliveryStatus} from '../../email/emailDeliveryStore.js'
import {carrierRemittanceSmtpTracking} from '../carrierRemittanceTracking.js'

test('carrier SMTP correlation contains only the retained opaque dispatch key',()=>{
 const input={category:'payroll_carrier_remittance',idempotencyKey:`carrier-remittance-${randomUUID()}`,host:'smtp.sendgrid.net'}
 assert.deepEqual(JSON.parse(carrierRemittanceSmtpTracking(input).headers['X-SMTPAPI']),{unique_args:{vortex_carrier_dispatch:input.idempotencyKey}})
 assert.equal(carrierRemittanceSmtpTracking({...input,host:'smtp.example.test'}),null)
 assert.throws(()=>carrierRemittanceSmtpTracking({...input,idempotencyKey:'unretained'}))
})

test('signed carrier returns preserve evidence, reject conflicts and prevent further sends',{skip:!process.env.PAYROLL_TEST_DATABASE_URL},async t=>{
 const prior=process.env.PAYROLL_DOCUMENT_KEY;process.env.PAYROLL_DOCUMENT_KEY='31'.repeat(32)
 t.after(()=>{if(prior===undefined)delete process.env.PAYROLL_DOCUMENT_KEY;else process.env.PAYROLL_DOCUMENT_KEY=prior})
 let sends=0,mail
 const sender=async input=>{sends++;mail=input;return {sent:true,messageId:'synthetic-smtp-id'}}
 const f=await carrierRemittanceFixture({sender});t.after(()=>f.h.close())
 const {pool}=f.h
 await runCarrierRemittanceSweep(pool,{facility:1,now:f.now(),sender})
 const attempt=(await pool.query('SELECT * FROM payroll_carrier_remittance_attempt')).rows[0]
 await pool.query('CREATE TABLE email_delivery(id BIGINT PRIMARY KEY,facility_id BIGINT,recipient_hash TEXT,category TEXT,stream TEXT,template_version TEXT,status TEXT,idempotency_key TEXT,provider TEXT,created_at TIMESTAMPTZ,accepted_at TIMESTAMPTZ,bounced_at TIMESTAMPTZ,complained_at TIMESTAMPTZ,updated_at TIMESTAMPTZ)')
 await pool.query("INSERT INTO email_delivery VALUES(1,1,$1,'payroll_carrier_remittance','transactional','carrier-remittance-v1','accepted',$2,'smtp:sendgrid',$3,$3,NULL,NULL,$3)",[hashEmail(mail.to),mail.idempotencyKey,attempt.created_at])
 const now=new Date(+new Date(attempt.created_at)+2000),timestamp=String(Math.floor(+now/1000))
 const keys=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),publicKey=keys.publicKey.export({format:'pem',type:'spki'})
 const signed=events=>{const raw=Buffer.from(JSON.stringify(events));return {raw,verification:{publicKey,timestamp,now,signature:sign('sha256',Buffer.concat([Buffer.from(timestamp),raw]),keys.privateKey).toString('base64')}}}
 const retain=events=>{const s=signed(events);return retainW2ProviderEvents(pool,s.raw,s.verification)}
 const event={event:'dropped',sg_event_id:'synthetic-return-1',email:mail.to,timestamp:Number(timestamp),vortex_carrier_dispatch:mail.idempotencyKey}
 const invalid=signed([event]);await assert.rejects(retainW2ProviderEvents(pool,Buffer.concat([invalid.raw,Buffer.from(' ')]),invalid.verification),e=>e.status===401)
 assert.deepEqual(await retain([{...event,email:'foreign@example.test'}]),{accepted:0,ignored:1})
 assert.deepEqual(await retain([{...event,vortex_carrier_dispatch:`carrier-remittance-${randomUUID()}`}]),{accepted:0,ignored:1})
 await assert.rejects(retain([{...event,timestamp:Number(timestamp)+1}]),/Invalid carrier/)
 const duplicates=await Promise.all([retain([event]),retain([event])]);assert.deepEqual(duplicates,[{accepted:1,ignored:0},{accepted:1,ignored:0}])
 assert.equal((await pool.query('SELECT * FROM payroll_carrier_remittance_provider_event')).rowCount,1)
 assert.equal((await pool.query("SELECT * FROM payroll_audit_log WHERE action='CARRIER_REMITTANCE_RETURN_RETAINED'")).rowCount,1)
 await assert.rejects(retain([{...event,event:'bounce'}]),e=>e.status===409)
 assert.equal((await processCarrierRemittance(pool,1,f.notice.id,{sender,now})).status,'RETURNED');assert.equal(sends,1)
 const state=(await f.api(f.noticePath)).history[0].delivery
 assert.equal(state.status,'RETURNED');assert.equal(state.canAttempt,false);assert.equal(state.returns.length,1)
 assert.equal((await runCarrierRemittanceSweep(pool,{facility:1,now,sender})).checked,1)
 assert.equal((await pool.query('SELECT status FROM payroll_alert WHERE dedupe_key=$1',[`carrier-remittance-${f.notice.id}`])).rows[0].status,'OPEN')
 assert.equal((await pool.query('SELECT outcome FROM payroll_carrier_remittance_result')).rows[0].outcome,'SMTP_ACCEPTED')
 await pool.query('ALTER TABLE email_delivery ADD COLUMN smtp_code TEXT, ADD COLUMN provider_reason TEXT, ADD COLUMN attempt_count INTEGER DEFAULT 0')
 registerEmailPool(pool);try{await updateDeliveryStatus(1,'accepted')}finally{registerEmailPool(null)}
 assert.equal((await pool.query('SELECT status FROM email_delivery')).rows[0].status,'failed')
 await Promise.all([retain([{...event,event:'bounce',sg_event_id:'synthetic-bounce'}]),processCarrierRemittance(pool,1,f.notice.id,{sender,now})])
 assert.equal((await pool.query('SELECT status FROM email_delivery')).rows[0].status,'bounced')
 await retain([{...event,event:'spamreport',sg_event_id:'synthetic-complaint',sg_message_id:'provider-message'}])
 await retain([{...event,event:'dropped',sg_event_id:'synthetic-drop',sg_message_id:'provider-message'}])
 assert.equal((await pool.query('SELECT status FROM email_delivery')).rows[0].status,'complaint')

 registerEmailPool(pool);try{await updateDeliveryStatus(1,'accepted')}finally{registerEmailPool(null)}
 assert.equal((await pool.query('SELECT status FROM email_delivery')).rows[0].status,'complaint')
 await assert.rejects(retain([{...event,sg_event_id:'conflicting-message',sg_message_id:'different-message'}]),e=>e.status===409)
 await assert.rejects(retain([{...event,sg_event_id:'batch-rollback'}, {...event,sg_event_id:'invalid-batch',timestamp:0}]))
 assert.equal((await pool.query("SELECT * FROM payroll_carrier_remittance_provider_event WHERE event_id='batch-rollback'")).rowCount,0)
 await assert.rejects(pool.query('DELETE FROM payroll_carrier_remittance_provider_event'),/append-only/)
 await assert.rejects(pool.query('INSERT INTO payroll_carrier_remittance_attempt(notice_id,dispatch_key,created_at) VALUES($1,$2,$3)',[f.notice.id,randomUUID(),new Date(+now+600000)]),/Returned remittance/)
 await assert.rejects(carrierNoticePreview(pool,1,f.payment.id),/delivery-return evidence/)
 await pool.query(await readFile(new URL('../../migrations/813_payroll_onboarding.sql',import.meta.url),'utf8'))
 assert.equal((await f.api(f.noticePath)).history[0].delivery.status,'RETURNED')
 assert.equal(sends,1)
})
