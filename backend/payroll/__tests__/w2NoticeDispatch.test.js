import test from 'node:test'
import assert from 'node:assert/strict'
import {w2NoticeOutcome} from '../w2NoticeDispatch.js'
test('W-2 sender evidence distinguishes acceptance, definite skips, and uncertainty',()=>{
 assert.deepEqual(w2NoticeOutcome({sent:true,messageId:'message\r\n-id'}),{outcome:'SMTP_ACCEPTED',reason:'smtp_accepted',providerMessageId:'message-id'})
 for(const result of [{sent:false,skipped:true,reason:'category_disabled'},{sent:false,suppressed:true,reason:'recipient_suppressed'}])assert.equal(w2NoticeOutcome(result).outcome,'NOT_SENT')
 for(const result of [undefined,null,{},false,{sent:false},{sent:false,skipped:true,reason:'duplicate'}])assert.equal(w2NoticeOutcome(result).outcome,'UNCERTAIN')
 assert.equal(w2NoticeOutcome({sent:true},new Error('failure after acceptance')).outcome,'UNCERTAIN')
})
