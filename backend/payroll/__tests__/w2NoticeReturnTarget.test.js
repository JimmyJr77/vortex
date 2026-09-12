import test from 'node:test'
import assert from 'node:assert/strict'
import {noticeReturnTarget} from '../w2NoticeReturnTarget.js'
test('notice follow-up uses employer calendar dates across UTC midnight and daylight saving time',()=>{
 const target=now=>noticeReturnTarget('2026-03-08T04:30:00Z','America/New_York',new Date(now))
 assert.equal(target('2026-03-08').returnedOn,'2026-03-07');assert.equal(target('2026-03-08').dueOn,'2026-04-06')
 assert.equal(target('2026-03-29T12:00Z').status,'OPEN');assert.equal(target('2026-03-30T12:00Z').status,'DUE_SOON');assert.equal(target('2026-04-06T23:00Z').status,'DUE_SOON');assert.equal(target('2026-04-07T12:00Z').status,'OVERDUE')
 const paper=occurredAt=>noticeReturnTarget('2026-03-08T04:30:00Z','America/New_York',new Date('2026-05-01'),{status:'PAPER_RECORDED',occurredAt})
 assert.equal(paper('2026-04-07T03:00Z').status,'RESOLVED_ON_TIME');assert.equal(paper('2026-04-07T05:00Z').status,'RESOLVED_LATE')
})
