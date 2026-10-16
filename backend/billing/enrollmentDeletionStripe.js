import { listStripeInvoicePaymentInventory } from './stripeInvoicePaymentBinding.js'

const id = (value) => typeof value === 'string' ? value : value?.id
const unpaidIntentStatuses = new Set(['requires_payment_method', 'requires_confirmation', 'canceled'])
function owned(object, customerId) {
  if (!object?.id || id(object.customer) !== customerId) throw new Error('Stripe collection ownership could not be verified.')
}
function unpaidIntent(intent, customerId) {
  owned(intent, customerId)
  if (intent.amount_received !== 0 || !unpaidIntentStatuses.has(intent.status)) {
    throw new Error('Stripe payment is paid, authorized, or processing. Enrollment deletion is blocked.')
  }
}
async function pages(list, params) {
  const rows = [], seen = new Set()
  let cursor
  do {
    const page = await list({ ...params, limit: 100, ...(cursor ? { starting_after: cursor } : {}) })
    if (!Array.isArray(page?.data) || typeof page.has_more !== 'boolean') throw new Error('Stripe inventory is incomplete.')
    rows.push(...page.data)
    if (!page.has_more) return rows
    cursor = id(page.data.at(-1))
    if (!cursor || seen.has(cursor)) throw new Error('Stripe pagination could not be verified.')
    seen.add(cursor)
  } while (true)
}

/** Read every collector before making any change. Journaled drafts can be
 * missing after a previous delete timed out; unknown missing objects fail closed. */
export async function planEnrollmentStripeDeletion(stripe, { customerId, charges, subscriptions, attempts, invoices, previousPlan = [] }) {
  const sessions = new Set(), intentIds = new Set(), invoiceIds = new Map(), subscriptionIds = new Set(), schedules = new Set(), items = new Set()
  for (const row of [...charges, ...attempts]) {
    if (row.stripe_checkout_session_id) sessions.add(row.stripe_checkout_session_id)
    if (row.stripe_payment_intent_id) intentIds.add(row.stripe_payment_intent_id)
  }
  for (const row of charges) if (row.stripe_invoice_item_id) items.add(row.stripe_invoice_item_id)
  for (const row of subscriptions) {
    if (row.stripe_subscription_id) subscriptionIds.add(row.stripe_subscription_id)
    if (row.stripe_subscription_schedule_id) schedules.add(row.stripe_subscription_schedule_id)
  }
  for (const invoice of invoices) {
    if (invoice.stripe_invoice_id) invoiceIds.set(invoice.stripe_invoice_id, invoice)
    if (invoice.stripe_payment_intent_id) intentIds.add(invoice.stripe_payment_intent_id)
  }
  if (![sessions, intentIds, invoiceIds, subscriptionIds, schedules, items].some((set) => set.size)) return []
  if (!stripe || !customerId) throw new Error('Stripe is unavailable; enrollment deletion has not been applied.')
  const plan = []
  for (const sessionId of sessions) {
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    owned(session, customerId)
    if (!['open', 'expired'].includes(session.status) || session.payment_status === 'paid') throw new Error('Stripe Checkout is completed or processing. Enrollment deletion is blocked.')
    if (id(session.payment_intent)) {
      const intent = await stripe.paymentIntents.retrieve(id(session.payment_intent))
      unpaidIntent(intent, customerId)
      // Checkout owns cancellation of its PaymentIntent.
      intentIds.delete(intent.id)
    }
    plan.push({ kind: 'checkout', id: sessionId, terminal: session.status === 'expired' })
  }
  for (const subscriptionId of subscriptionIds) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    owned(subscription, customerId)
    if (subscription.items?.has_more || subscription.items?.data?.length !== 1) throw new Error('A shared Stripe subscription must be reconciled before deleting one enrollment.')
    const expectedItems = subscriptions.filter((row) => row.stripe_subscription_id === subscriptionId).map((row) => row.stripe_subscription_item_id).filter(Boolean)
    if (expectedItems.some((item) => item !== subscription.items.data[0].id)) throw new Error('Stripe subscription item ownership does not match the enrollment.')
    if (id(subscription.schedule)) schedules.add(id(subscription.schedule))
    // Check the entire lifetime, including refunded paid invoices.
    for (const invoice of await pages((params) => stripe.invoices.list(params), { subscription: subscriptionId })) invoiceIds.set(invoice.id, invoiceIds.get(invoice.id) ?? null)
    plan.push({ kind: 'subscription', id: subscriptionId, terminal: ['canceled', 'incomplete_expired'].includes(subscription.status) })
  }
  for (const scheduleId of schedules) {
    const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId)
    owned(schedule, customerId)
    if (['active','not_started'].includes(schedule.status) && (!Array.isArray(schedule.phases) || !schedule.phases.length || schedule.phases.some((phase) => phase.items?.length !== 1))) throw new Error('A shared Stripe schedule requires reconciliation before deletion.')
    if (id(schedule.released_subscription) && !subscriptionIds.has(id(schedule.released_subscription))) throw new Error('Released schedule payment history requires reconciliation.')
    if (id(schedule.subscription) && !subscriptionIds.has(id(schedule.subscription))) throw new Error('Stripe schedule belongs to a different subscription.')
    if (!['not_started', 'active', 'canceled', 'released', 'completed'].includes(schedule.status)) throw new Error('Stripe schedule state could not be verified.')
    plan.push({ kind: 'schedule', id: scheduleId, terminal: ['canceled','released','completed'].includes(schedule.status) })
  }
  for (const itemId of items) {
    let item
    try { item = await stripe.invoiceItems.retrieve(itemId) } catch (error) {
      if (error.code === 'resource_missing' && previousPlan.some((step) => step.id === itemId && (
        step.kind === 'invoice_item' || (step.kind === 'invoice_item_reference'
          && previousPlan.some((invoice) => invoice.kind === 'invoice' && invoice.id === step.invoiceId && invoice.draft))))) continue
      throw error
    }
    owned(item, customerId)
    if (id(item.invoice)) {
      invoiceIds.set(id(item.invoice), invoiceIds.get(id(item.invoice)) ?? null)
      plan.push({ kind: 'invoice_item_reference', id: itemId, invoiceId: id(item.invoice), terminal: true })
    }
    else plan.push({ kind: 'invoice_item', id: itemId, terminal: false })
  }
  for (const [invoiceId, local] of invoiceIds) {
    let invoice
    try { invoice = await stripe.invoices.retrieve(invoiceId) } catch (error) {
      if (error.code === 'resource_missing' && previousPlan.some((step) => step.kind === 'invoice' && step.id === invoiceId && step.draft)) continue
      throw error
    }
    owned(invoice, customerId)
    if (invoice.amount_paid !== 0 || invoice.status === 'paid' || invoice.paid === true || !['draft', 'open', 'void', 'uncollectible'].includes(invoice.status)) throw new Error('Stripe invoice has payment history or an unknown status. Enrollment deletion is blocked.')
    if (local && (String(invoice.metadata?.monthlyInvoiceId) !== String(local.id) || String(invoice.metadata?.familyBillingAccountId) !== String(local.family_billing_account_id))) throw new Error('Stripe household invoice ownership does not match the account.')
    if (local) {
      const remoteItems = await pages((params) => stripe.invoiceItems.list(params), { invoice: invoiceId })
      const expected = new Map((local.lines ?? []).map((line) => [String(line.id), line]))
      const seen = new Set()
      for (const item of remoteItems) {
        const key = String(item.metadata?.monthlyInvoiceLineId)
        const line = expected.get(key)
        if (!line || seen.has(key) || String(item.metadata?.monthlyInvoiceId) !== String(local.id)
          || Number(item.amount) !== Number(line.amount_cents)
          || (line.stripe_invoice_item_id && line.stripe_invoice_item_id !== item.id)) throw new Error('Stripe invoice lines differ from the household ledger.')
        seen.add(key)
      }
      if (invoice.status !== 'draft' && seen.size !== expected.size) throw new Error('Stripe invoice line inventory is incomplete.')
    }
    const inventory = await listStripeInvoicePaymentInventory(stripe, { stripeInvoiceId: invoiceId })
    if (!Array.isArray(inventory)) throw new Error('Stripe invoice payment inventory is unavailable.')
    for (const payment of inventory) {
      if (id(payment.invoice) !== invoiceId || Number(payment.amount_paid ?? 0) > 0 || payment.status === 'paid') throw new Error('Stripe invoice has payment history. Enrollment deletion is blocked.')
      if (payment.payment?.type !== 'payment_intent') throw new Error('An external invoice payment requires reconciliation before deletion.')
      const intentId = id(payment.payment.payment_intent)
      if (!intentId) throw new Error('Stripe invoice payment identity is missing.')
      unpaidIntent(await stripe.paymentIntents.retrieve(intentId), customerId)
      intentIds.delete(intentId)
    }
    if (id(invoice.payment_intent)) {
      unpaidIntent(await stripe.paymentIntents.retrieve(id(invoice.payment_intent)), customerId)
      intentIds.delete(id(invoice.payment_intent))
    }
    // An untracked invoice may contain other classes; only dedicated legacy
    // subscription invoices can be retired without a local household mapping.
    const subscriptionId = id(invoice.subscription) ?? id(invoice.parent?.subscription_details?.subscription)
    if (!local && !subscriptionIds.has(subscriptionId)) throw new Error('Stripe invoice has no verified enrollment or household mapping.')
    if (!local) {
      const lines = await pages((params) => stripe.invoices.listLineItems(invoiceId, params), {})
      if (!lines.length || lines.some((line) => (id(line.subscription) ?? id(line.parent?.subscription_item_details?.subscription)) !== subscriptionId)) {
        throw new Error('Legacy invoice includes other charges that require reconciliation before deletion.')
      }
    }
    plan.push({ kind: 'invoice', id: invoiceId, draft: invoice.status === 'draft', terminal: invoice.status === 'void' })
  }
  for (const intentId of intentIds) {
    unpaidIntent(await stripe.paymentIntents.retrieve(intentId), customerId)
    plan.push({ kind: 'intent', id: intentId, terminal: (await stripe.paymentIntents.retrieve(intentId)).status === 'canceled' })
  }
  // Canceling a legacy subscription can stop auto-advance on other customer
  // invoices. Preserve their prior collection setting without creating a charge.
  const restores = new Set(previousPlan.filter((step) => step.kind === 'restore_invoice').map((step) => step.id))
  if (plan.some((step) => ['subscription','schedule'].includes(step.kind) && !step.terminal)) {
    for (const invoice of await pages((params) => stripe.invoices.list(params), { customer: customerId })) {
      if (!invoiceIds.has(invoice.id) && ['open','draft'].includes(invoice.status) && invoice.auto_advance === true) restores.add(invoice.id)
    }
  }
  for (const invoiceId of restores) {
    const invoice = await stripe.invoices.retrieve(invoiceId)
    owned(invoice, customerId)
    plan.push({ kind: 'restore_invoice', id: invoiceId, terminal: invoice.auto_advance === true || !['open','draft'].includes(invoice.status) })
  }
  // Expire checkout, stop future subscriptions, then retire invoice collection.
  const order = { checkout: 0, schedule: 1, subscription: 2, invoice_item: 3, invoice: 4, intent: 5, restore_invoice: 6, invoice_item_reference: 7 }
  return plan.sort((a, b) => order[a.kind] - order[b.kind])
}

export async function executeEnrollmentStripeDeletion(stripe, plan, { customerId, operationKey, checkpoint }) {
  for (const step of plan) {
    const options = { idempotencyKey: `${operationKey}:${step.kind}:${step.id}` }
    if (step.kind === 'checkout') {
      let session = await stripe.checkout.sessions.retrieve(step.id)
      owned(session, customerId)
      if (session.payment_status === 'paid' || !['open', 'expired'].includes(session.status)) throw new Error('Checkout changed before cancellation; deletion stopped.')
      if (session.status === 'open') session = await stripe.checkout.sessions.expire(step.id, {}, options)
      if (session.status !== 'expired') throw new Error('Checkout expiration was not confirmed.')
    } else if (step.kind === 'intent') {
      let intent = await stripe.paymentIntents.retrieve(step.id)
      unpaidIntent(intent, customerId)
      if (intent.status !== 'canceled') intent = await stripe.paymentIntents.cancel(step.id, {}, options)
      unpaidIntent(intent, customerId)
      if (intent.status !== 'canceled') throw new Error('Payment cancellation was not confirmed.')
    } else if (step.kind === 'subscription') {
      let subscription = await stripe.subscriptions.retrieve(step.id)
      owned(subscription, customerId)
      if (!['canceled', 'incomplete_expired'].includes(subscription.status)) subscription = await stripe.subscriptions.cancel(step.id, { invoice_now: false, prorate: false }, options)
      if (!['canceled', 'incomplete_expired'].includes(subscription.status)) throw new Error('Subscription cancellation was not confirmed.')
    } else if (step.kind === 'schedule') {
      let schedule = await stripe.subscriptionSchedules.retrieve(step.id)
      owned(schedule, customerId)
      if (['active', 'not_started'].includes(schedule.status)) schedule = await stripe.subscriptionSchedules.cancel(step.id, { invoice_now: false, prorate: false }, options)
      if (!['canceled', 'released', 'completed'].includes(schedule.status)) throw new Error('Schedule cancellation was not confirmed.')
    } else if (step.kind === 'invoice_item') {
      try {
        const item = await stripe.invoiceItems.retrieve(step.id)
        owned(item, customerId)
        if (item.invoice) throw new Error('Invoice item was invoiced during deletion; retry to reconcile its invoice.')
        const removed = await stripe.invoiceItems.del(step.id)
        if (!removed.deleted) throw new Error('Invoice item deletion was not confirmed.')
      } catch (error) { if (error.code !== 'resource_missing') throw error }
    } else if (step.kind === 'restore_invoice') {
      const invoice = await stripe.invoices.retrieve(step.id)
      owned(invoice, customerId)
      if (['open','draft'].includes(invoice.status) && invoice.auto_advance !== true) {
        const restored = await stripe.invoices.update(step.id, { auto_advance: true }, options)
        if (restored.auto_advance !== true) throw new Error('Other household invoice collection could not be restored.')
      }
    } else if (step.kind === 'invoice') {
      let invoice
      try { invoice = await stripe.invoices.retrieve(step.id) } catch (error) {
        if (error.code === 'resource_missing' && step.draft) { await checkpoint(step); continue }
        throw error
      }
      owned(invoice, customerId)
      if (invoice.amount_paid !== 0 || invoice.paid || invoice.status === 'paid') throw new Error('Invoice was paid during deletion; local enrollment was preserved.')
      const inventory = await listStripeInvoicePaymentInventory(stripe, { stripeInvoiceId: step.id })
      if (!Array.isArray(inventory)) throw new Error('Stripe invoice payment inventory is unavailable.')
      for (const payment of inventory) {
        if (id(payment.invoice) !== step.id || Number(payment.amount_paid ?? 0) > 0 || payment.status === 'paid'
          || payment.payment?.type !== 'payment_intent') throw new Error('Invoice payment changed; deletion stopped.')
        unpaidIntent(await stripe.paymentIntents.retrieve(id(payment.payment.payment_intent)), customerId)
      }
      if (invoice.status === 'draft') {
        const removed = await stripe.invoices.del(step.id)
        if (!removed.deleted) throw new Error('Draft invoice deletion was not confirmed.')
      } else if (['open', 'uncollectible'].includes(invoice.status)) {
        invoice = await stripe.invoices.voidInvoice(step.id, {}, options)
        if (invoice.status !== 'void' || invoice.amount_paid !== 0) throw new Error('Invoice void was not confirmed.')
      } else if (invoice.status !== 'void') throw new Error('Invoice cannot be safely retired.')
    }
    await checkpoint(step)
  }
}
