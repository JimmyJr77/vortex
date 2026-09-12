import test from 'node:test'
import assert from 'node:assert/strict'
import {replacementReceiptHtml,checkReceiptHtml} from '../replacementReceiptDownload.js'
const receipt={id:'synthetic-receipt',employeeName:'A <script>alert(1)</script> & B',amountCents:5970,originalPaymentDate:'2026-09-18',paymentDate:'2026-09-22',bankPostedDates:['2026-09-22'],status:'BANK_CONFIRMED',createdAt:'2026-09-22T12:00:00Z',account:{accountType:'checking',accountLast4:'1234'}}
test('downloadable receipt escapes data and contains printable retained facts',()=>{
 const html=replacementReceiptHtml(receipt,{generatedAt:new Date('2026-09-23T12:00:00Z')})
 assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('&amp; B'));assert.ok(html.includes('$59.70'));assert.ok(html.includes('checking ending 1234'));assert.ok(html.includes('2026-09-23T12:00:00.000Z'));assert.ok(html.includes("default-src 'none'"));assert.ok(html.includes('@media print'))
})
test('download preserves review-needed status and stopped-check origin',()=>{
 const html=replacementReceiptHtml({...receipt,sourceKind:'STOPPED_CHECK',status:'NEEDS_REVIEW'})
 assert.ok(html.includes('Direct-deposit replacement of a stopped check'));assert.ok(html.includes('Needs review'));assert.ok(!html.includes('Bank evidence confirmed'));assert.ok(html.includes('2026-09-18'));assert.ok(html.includes('2026-09-22'))
})

test('check receipts distinguish handoff, acknowledgment and bank clearance',()=>{
 const check={...receipt,employerName:'Employer <unsafe>',sourceKind:'REPLACEMENT_CHECK',deliveredAt:'2026-09-22T12:00:00Z',acknowledgedAt:null,observedAt:null,status:'OUTSTANDING',bankPostedDates:[]}
 const html=checkReceiptHtml(check)
 assert.ok(html.includes('Awaiting bank clearance'));assert.ok(!html.includes('Bank clearance confirmed'));assert.ok(html.includes('Employer &lt;unsafe&gt;'));assert.ok(html.includes('Not recorded'));assert.ok(html.includes('Not confirmed'));assert.ok(html.includes('Replacement check'))
 const cleared=checkReceiptHtml({...check,status:'BANK_CONFIRMED',acknowledgedAt:'2026-09-22T13:00:00Z',bankPostedDates:['2026-09-23']})
 assert.ok(cleared.includes('Bank clearance confirmed'));assert.ok(cleared.includes('2026-09-22T13:00:00.000Z'));assert.ok(cleared.includes('2026-09-23'))
})
