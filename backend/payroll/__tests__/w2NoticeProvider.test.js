import test from 'node:test'
import assert from 'node:assert/strict'
import {generateKeyPairSync,sign} from 'node:crypto'
import {w2NoticeSmtpTracking,verifyW2NoticeProviderEvents} from '../w2NoticeProvider.js'
const key='w2-notice-00000000-0000-4000-8000-000000000001'
test('SendGrid W-2 metadata carries only the retained opaque dispatch key',()=>{
 assert.deepEqual(w2NoticeSmtpTracking({category:'payroll_w2_notice',idempotencyKey:key,host:' smtp.sendgrid.net '}),{provider:'smtp:sendgrid',headers:{'X-SMTPAPI':JSON.stringify({unique_args:{vortex_w2_dispatch:key}})}})
 assert.equal(w2NoticeSmtpTracking({category:'payroll_w2_notice',idempotencyKey:key,host:'smtp.gmail.com'}),null)
 assert.equal(w2NoticeSmtpTracking({category:'payroll_employee_invitation',idempotencyKey:key,host:'smtp.sendgrid.net'}),null)
 assert.throws(()=>w2NoticeSmtpTracking({category:'payroll_w2_notice',idempotencyKey:'employee@example.test',host:'smtp.sendgrid.net'}),/dispatch key/)
})
// SendGrid's published interoperability vector; trailing CRLF is signed.
// https://github.com/sendgrid/sendgrid-nodejs/blob/main/packages/eventwebhook/src/eventwebhook.spec.js
const publicKey='MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE83T4O/n84iotIvIW4mdBgQ/7dAfSmpqIM8kF9mN1flpVKS3GRqe62gw+2fNNRaINXvVpiglSI8eNEc6wEA3F+g=='
const signature='MEUCIGHQVtGj+Y3LkG9fLcxf3qfI10QysgDWmMOVmxG0u6ZUAiEAyBiXDWzM+uOe5W0JuG+luQAbPIqHh89M15TluLtEZtM='
const timestamp='1600112502',raw=Buffer.from(JSON.stringify([{email:'hello@world.com',event:'dropped',reason:'Bounced Address',sg_event_id:'ZHJvcC0xMDk5NDkxOS1MUnpYbF9OSFN0T0doUTRrb2ZTbV9BLTA',sg_message_id:'LRzXl_NHStOGhQ4kofSm_A.filterdrecv-p3mdw1-756b745b58-kmzbl-18-5F5FC76C-9.0','smtp-id':'<LRzXl_NHStOGhQ4kofSm_A@ismtpd0039p1iad1.sendgrid.net>',timestamp:1600112492}])+'\r\n')
test('verifies SendGrid official signed raw-byte fixture and rejects transformed bytes',()=>{
 assert.equal(verifyW2NoticeProviderEvents(raw,{publicKey,signature,timestamp}).events[0].event,'dropped')
 assert.throws(()=>verifyW2NoticeProviderEvents(raw.subarray(0,-2),{publicKey,signature,timestamp}),/signature/)
 assert.throws(()=>verifyW2NoticeProviderEvents(raw,{publicKey,signature,timestamp:'1600112503'}),/signature/)
})
test('rejects untrusted signatures, future timestamps, malformed keys and oversized bodies',()=>{
 const other=generateKeyPairSync('ec',{namedCurve:'prime256v1'}).publicKey.export({format:'pem',type:'spki'})
 assert.throws(()=>verifyW2NoticeProviderEvents(raw,{publicKey:other,signature,timestamp}),/signature/)
 assert.throws(()=>verifyW2NoticeProviderEvents(raw,{publicKey:'invalid',signature,timestamp}),e=>e.status===503)
 assert.throws(()=>verifyW2NoticeProviderEvents(raw,{publicKey,signature:'!',timestamp}),e=>e.status===401)
 assert.throws(()=>verifyW2NoticeProviderEvents(raw,{publicKey,signature:'YQ==',timestamp}),e=>e.status===401)
 assert.throws(()=>verifyW2NoticeProviderEvents(raw,{publicKey,signature,timestamp:'999999999999'}),/timestamp/)
 assert.throws(()=>verifyW2NoticeProviderEvents(Buffer.alloc(1024*1024+1),{publicKey,signature,timestamp}),/body/)
})
test('parses only bounded signed JSON batches after cryptographic verification',()=>{
 const pair=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),publicKey=pair.publicKey.export({format:'pem',type:'spki'})
 for(const body of ['invalid','{}','[]','[null]',JSON.stringify(Array.from({length:1001},()=>({event:'bounce'})))]){
  const bytes=Buffer.from(body),signature=sign('sha256',Buffer.concat([Buffer.from(timestamp),bytes]),pair.privateKey).toString('base64')
  assert.throws(()=>verifyW2NoticeProviderEvents(bytes,{publicKey,signature,timestamp}),/JSON|batch/)
 }
})
