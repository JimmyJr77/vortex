import assert from 'node:assert/strict'
export function deletionStripeFixture() {
  const calls = []
  const intents = new Map([['pi_1', { id:'pi_1', customer:'cus_1', amount_received:0, status:'requires_payment_method' }]])
  const invoices = new Map([['in_1', { id:'in_1', customer:'cus_1', amount_paid:0, status:'open', metadata:{monthlyInvoiceId:'1',familyBillingAccountId:'1'} }]])
  const sessions = new Map([['cs_1', { id:'cs_1', customer:'cus_1', status:'open', payment_status:'unpaid' }]])
  const subscriptions = new Map([['sub_1', { id:'sub_1', customer:'cus_1', status:'active', items:{data:[{id:'si_1'}],has_more:false} }]])
  const missing = () => { throw Object.assign(new Error('Missing object'),{code:'resource_missing'}) }
  const stripe = {
    calls, intents, invoiceState:invoices, sessions, subscriptionState:subscriptions,
    paymentIntents: {
      retrieve:async (key) => structuredClone(intents.get(key) ?? missing()),
      cancel:async (key) => { calls.push(`cancel:${key}`); intents.get(key).status='canceled';return structuredClone(intents.get(key)) },
    },
    checkout:{sessions:{
      retrieve:async (key) => structuredClone(sessions.get(key) ?? missing()),
      expire:async (key) => { calls.push(`expire:${key}`); sessions.get(key).status='expired';return structuredClone(sessions.get(key)) },
    }},
    invoices:{
      retrieve:async (key) => structuredClone(invoices.get(key) ?? missing()),
      list:async (params) => ({data:params.subscription ? [...invoices.values()].filter(row=>row.id==='in_1') : [...invoices.values()],has_more:false}),
      update:async (key,params)=>{calls.push(`update:${key}`);Object.assign(invoices.get(key),params);return structuredClone(invoices.get(key))},
      voidInvoice:async (key) => { calls.push(`void:${key}`); invoices.get(key).status='void';intents.get('pi_1').status='canceled';return structuredClone(invoices.get(key)) },
      del:async (key) => { calls.push(`delete:${key}`);invoices.delete(key);return {id:key,deleted:true} },
    },
    invoiceItems:{list:async()=>({data:[],has_more:false})},
    invoicePayments:{list:async ({invoice}) => ({data:invoice === 'in_1' ? [{id:'ip_1',invoice,amount_paid:0,status:'open',payment:{type:'payment_intent',payment_intent:'pi_1'}}] : [],has_more:false})},
    subscriptions:{
      retrieve:async (key) => structuredClone(subscriptions.get(key) ?? missing()),
      cancel:async (key,params) => { assert.deepEqual(params,{invoice_now:false,prorate:false});calls.push(`cancel:${key}`);subscriptions.get(key).status='canceled';return structuredClone(subscriptions.get(key)) },
    },
  }
  return stripe
}
