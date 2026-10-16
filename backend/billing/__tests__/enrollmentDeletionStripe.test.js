import test from 'node:test'
import assert from 'node:assert/strict'
import { planEnrollmentStripeDeletion, executeEnrollmentStripeDeletion } from '../enrollmentDeletionStripe.js'

import { deletionStripeFixture } from './fixtures/enrollmentDeletionStripe.js'
const input = () => ({ customerId:'cus_1',charges:[],subscriptions:[],attempts:[],invoices:[{id:1,family_billing_account_id:1,stripe_invoice_id:'in_1'}] })

test('voids an unpaid household invoice and safely replays without collecting funds', async () => {
  const stripe=deletionStripeFixture(), options=input()
  const plan=await planEnrollmentStripeDeletion(stripe,options)
  await executeEnrollmentStripeDeletion(stripe,plan,{customerId:'cus_1',operationKey:'delete:1',checkpoint:async()=>{}})
  assert.deepEqual(stripe.calls,['void:in_1'])
  const replay=await planEnrollmentStripeDeletion(stripe,{...options,previousPlan:plan})
  assert.ok(replay.every(step=>step.terminal))
  await executeEnrollmentStripeDeletion(stripe,replay,{customerId:'cus_1',operationKey:'delete:1',checkpoint:async()=>{}})
  assert.deepEqual(stripe.calls,['void:in_1'])
})
for (const change of ['paid','processing','authorized','wrong customer']) {
  test(`preflight rejects ${change} before any Stripe mutation`, async()=>{
    const stripe=deletionStripeFixture()
    if(change==='paid') stripe.invoiceState.get('in_1').amount_paid=1
    if(change==='processing') stripe.intents.get('pi_1').status='processing'
    if(change==='authorized') stripe.intents.get('pi_1').status='requires_capture'
    if(change==='wrong customer') stripe.invoiceState.get('in_1').customer='cus_other'
    await assert.rejects(planEnrollmentStripeDeletion(stripe,input()))
    assert.deepEqual(stripe.calls,[])
  })
}
test('expires a checkout and cancels a standalone unpaid intent',async()=>{
  const stripe=deletionStripeFixture()
  const plan=await planEnrollmentStripeDeletion(stripe,{...input(),invoices:[],attempts:[{stripe_checkout_session_id:'cs_1',stripe_payment_intent_id:'pi_1'}]})
  await executeEnrollmentStripeDeletion(stripe,plan,{customerId:'cus_1',operationKey:'delete:1',checkpoint:async()=>{}})
  assert.deepEqual(stripe.calls,['expire:cs_1','cancel:pi_1'])
})
test('paid lifetime subscription invoice prevents cancellation even when local charges are unpaid',async()=>{
  const stripe=deletionStripeFixture()
  stripe.invoiceState.get('in_1').status='paid'
  await assert.rejects(planEnrollmentStripeDeletion(stripe,{...input(),subscriptions:[{stripe_subscription_id:'sub_1',stripe_subscription_item_id:'si_1'}]}),/payment history/)
  assert.deepEqual(stripe.calls,[])
})
test('dedicated subscription is canceled without proration and its unpaid invoice voided',async()=>{
  const stripe=deletionStripeFixture()
  const plan=await planEnrollmentStripeDeletion(stripe,{...input(),subscriptions:[{stripe_subscription_id:'sub_1',stripe_subscription_item_id:'si_1'}]})
  await executeEnrollmentStripeDeletion(stripe,plan,{customerId:'cus_1',operationKey:'delete:1',checkpoint:async()=>{}})
  assert.deepEqual(stripe.calls,['cancel:sub_1','void:in_1'])
})
test('an ambiguous draft deletion resumes only with a persisted plan',async()=>{
  const stripe=deletionStripeFixture()
  stripe.invoiceState.get('in_1').status='draft'
  const plan=await planEnrollmentStripeDeletion(stripe,input())
  await executeEnrollmentStripeDeletion(stripe,plan,{customerId:'cus_1',operationKey:'delete:1',checkpoint:async()=>{throw new Error('database unavailable')}}).catch(()=>{})
  await assert.rejects(planEnrollmentStripeDeletion(stripe,input()),/Missing object/)
  assert.deepEqual(await planEnrollmentStripeDeletion(stripe,{...input(),previousPlan:plan}),[])
})
test('a payment that starts after preflight stops voiding and local deletion',async()=>{
  const stripe=deletionStripeFixture()
  const plan=await planEnrollmentStripeDeletion(stripe,input())
  stripe.intents.get('pi_1').status='processing'
  await assert.rejects(executeEnrollmentStripeDeletion(stripe,plan,{customerId:'cus_1',operationKey:'delete:1',checkpoint:async()=>{}}),/processing/)
  assert.deepEqual(stripe.calls,[])
})

test('subscription cancellation restores collection settings on unrelated unpaid invoices', async () => {
  const stripe=deletionStripeFixture()
  stripe.invoiceState.set('in_other',{id:'in_other',customer:'cus_1',status:'open',amount_paid:0,auto_advance:true})
  const originalCancel=stripe.subscriptions.cancel
  stripe.subscriptions.cancel=async (...args)=>{
    const result=await originalCancel(...args)
    stripe.invoiceState.get('in_other').auto_advance=false
    return result
  }
  const plan=await planEnrollmentStripeDeletion(stripe,{...input(),subscriptions:[{stripe_subscription_id:'sub_1'}]})
  await executeEnrollmentStripeDeletion(stripe,plan,{customerId:'cus_1',operationKey:'delete:1',checkpoint:async()=>{}})
  assert.equal(stripe.invoiceState.get('in_other').status,'open')
  assert.equal(stripe.invoiceState.get('in_other').auto_advance,true)
  assert.deepEqual(stripe.calls,['cancel:sub_1','void:in_1','update:in_other'])
})

test('unmapped household invoice lines block retirement before any changes', async () => {
  const stripe=deletionStripeFixture()
  stripe.invoiceItems.list=async()=>({data:[{id:'ii_other',amount:1000,metadata:{monthlyInvoiceId:'1',monthlyInvoiceLineId:'999'}}],has_more:false})
  await assert.rejects(planEnrollmentStripeDeletion(stripe,input()),/lines differ/)
  assert.deepEqual(stripe.calls,[])
})
