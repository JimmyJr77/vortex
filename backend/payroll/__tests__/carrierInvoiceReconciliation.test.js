import test from 'node:test'
import assert from 'node:assert/strict'
import {summarizeCarrierInvoicePayments} from '../carrierInvoiceReconciliation.js'
const invoice={id:'invoice-current',revision:2,invoice:{amountCents:10000}}
const payment=(amount,patch={})=>({invoiceId:invoice.id,outsideActivityReviewed:true,amountCents:amount,bankConfirmedCents:amount,appliedCents:amount,reconciledCents:amount,...patch})
test('invoice balance distinguishes authorized, bank-settled, applied and reconciled partial payments',()=>{
 const pending=payment(6000,{bankConfirmedCents:0,appliedCents:0,reconciledCents:0})
 const open=summarizeCarrierInvoicePayments(invoice,[payment(4000),pending])
 assert.equal(open.status,'OPEN');assert.equal(open.unreservedCents,0);assert.equal(open.remainingToApplyCents,6000);assert.equal(open.reconciledCents,4000)
 assert.equal(summarizeCarrierInvoicePayments(invoice,[payment(4000),payment(6000)]).status,'RECONCILED')
 assert.equal(summarizeCarrierInvoicePayments(invoice,[payment(4000),payment(6000,{appliedCents:3000,reconciledCents:0})]).remainingToApplyCents,3000)
 assert.equal(summarizeCarrierInvoicePayments(invoice,[]).remainingToApplyCents,10000)
})
test('invoice totals refuse invalid evidence, historical active payments and missing outside-activity review',()=>{
 for(const rows of [[payment(10001)],[payment(10000,{invoiceId:'old'})],[payment(10000,{outsideActivityReviewed:false})],[payment(10000,{appliedCents:10001})],[payment(-1),payment(10001)],[payment(Number.MAX_SAFE_INTEGER),payment(1)]])assert.equal(summarizeCarrierInvoicePayments(invoice,rows).status,'OPEN')
 assert.equal(summarizeCarrierInvoicePayments(invoice,[payment(10001)]).unreservedCents,null)
 const oldView=summarizeCarrierInvoicePayments(invoice,[payment(10000)],{historical:true});assert.equal(oldView.historical,true);assert.equal(oldView.invoiceRevision,2)
})
