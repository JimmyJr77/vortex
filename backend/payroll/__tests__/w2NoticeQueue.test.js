import test from 'node:test'
import assert from 'node:assert/strict'
import {w2AvailabilityNotice} from '../w2NoticeQueue.js'
test('W-2 notices include the required title and instructions without a private document link',()=>{
 const input={publicationId:42,year:2026,contact:{name:'Synthetic Employer',phone:'555-0100',address:'123 Test Street'},baseUrl:'https://payroll.example.test'}
 const notice=w2AvailabilityNotice(input);assert.equal(notice.subject,'IMPORTANT TAX RETURN DOCUMENT AVAILABLE');assert.equal(notice.portalUrl,'https://payroll.example.test/employee/payroll');assert.match(notice.text,/Download W-2 document 42/);assert.match(notice.text,/Print command/);assert.match(notice.text,/555-0100/);assert.equal(notice.text.includes('/pdf'),false)
 for(const baseUrl of ['http://example.test','https://user:secret@example.test','javascript:alert(1)'])assert.throws(()=>w2AvailabilityNotice({...input,baseUrl}),/HTTPS/)
 assert.throws(()=>w2AvailabilityNotice({...input,year:2025}),/Complete/)
})
