import test from 'node:test'
import assert from 'node:assert/strict'
import {noticeRetryPolicy,nextNoticeRetry} from '../w2NoticeRetry.js'
test('notice retries use bounded persisted deadlines and never retry uncertain or accepted attempts',()=>{
 const now=new Date('2026-09-10T12:00:00Z'),deadline=nextNoticeRetry(now,1),row={id:1,attempt_count:'1',outcome:'NOT_SENT',retry_not_before:deadline}
 assert.equal(noticeRetryPolicy(null,now).canAttempt,true)
 assert.equal(noticeRetryPolicy(row,now).state,'WAITING')
 assert.equal(noticeRetryPolicy(row,new Date(deadline)).canAttempt,true)
 assert.equal(noticeRetryPolicy({...row,attempt_count:3},new Date('2027-01-01')).state,'EXHAUSTED')
 for(const outcome of [null,'UNCERTAIN','SMTP_ACCEPTED'])assert.equal(noticeRetryPolicy({...row,outcome},new Date('2027-01-01')).canAttempt,false)
 assert.equal(new Date(nextNoticeRetry(now,2))-now,2*86400000)
})
