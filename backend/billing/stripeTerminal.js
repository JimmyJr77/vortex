import { randomUUID } from 'node:crypto'
import { requireAdminFacilityScope } from './adminFacilityScope.js'
import { assertBillingConnectionHealthy, billingConnectionFailure, observeBillingConnection } from './billingDatabaseRecovery.js'
import { getStripeClient, stripeApiKeyIsLive } from './stripeBilling.js'
import { loadCustomerBillingAccount } from './customerBillingQueries.js'
import { terminalEnabledForFacility, terminalLocationForFacility } from './stripeTerminalConfig.js'
import {
  bindBillingTerminalPayment,
  prepareBillingTerminalPayment,
  releaseBillingTerminalPayment,
  settleBillingTerminalPayment,
} from './stripeTerminalBilling.js'
import { prepareStoreTerminalPayment, settleStoreTerminalPayment } from '../store/registerRoutes.js'

const adapters = {
  billing: {
    prepare: prepareBillingTerminalPayment,
    bind: bindBillingTerminalPayment,
    release: releaseBillingTerminalPayment,
    settle: settleBillingTerminalPayment,
  },
  store: { prepare: prepareStoreTerminalPayment, settle: settleStoreTerminalPayment },
}
const supportedDevices = new Set([
  'bbpos_wisepos_e', 'stripe_s700', 'stripe_s710', 'stripe_t600',
  'verifone_P400', 'verifone_v660p', 'verifone_m425', 'verifone_p630', 'verifone_ux700',
  'simulated_wisepos_e', 'simulated_stripe_s700', 'simulated_stripe_s710', 'simulated_stripe_t600',
  'simulated_verifone_m425', 'simulated_verifone_p630', 'simulated_verifone_ux700', 'simulated_verifone_v660p',
])
const requestOptions = { timeout: 12000, maxNetworkRetries: 1 }
const createRetryMs = 23 * 60 * 60 * 1000
const terminalEvents = new Set([
  'payment_intent.succeeded', 'payment_intent.canceled', 'payment_intent.payment_failed',
])
const cancelableStatuses = new Set([
  'requires_payment_method', 'requires_capture', 'requires_confirmation', 'requires_action',
])

function terminalError(statusCode, message) {
  return Object.assign(new Error(message), { statusCode })
}

function objectId(object) {
  return typeof object === 'string' ? object : object?.id ?? null
}

function targetLock(kind, targetId) {
  return `stripe-terminal:${kind}:${targetId}`
}

async function withLock(db, key, callback) {
  const { rows } = await db.query('SELECT pg_try_advisory_lock(hashtextextended($1::text, 0)) AS acquired', [key])
  if (!rows[0].acquired) {
    throw Object.assign(terminalError(409, 'This payment or reader is busy. Check its status and try again.'), {
      code: 'stripe_terminal_busy',
    })
  }
  try {
    const result = await callback()
    assertBillingConnectionHealthy(db)
    return result
  } finally {
    try {
      const result = await db.query('SELECT pg_advisory_unlock(hashtextextended($1::text, 0)) AS released', [key])
      if (!result.rows[0]?.released) throw new Error('Stripe Terminal advisory lock was lost.')
    } catch (error) {
      // Do not return a database session to the pool while it may own a lock.
      db.terminalUnlockError = error
      throw error
    }
  }
}

async function withTarget(pool, kind, targetId, callback) {
  const db = await pool.connect()
  observeBillingConnection(db)
  try {
    return await withLock(db, targetLock(kind, targetId), () => callback(db))
  } finally {
    db.release(db.terminalUnlockError || billingConnectionFailure(db) || undefined)
  }
}

async function latestAttempt(db, { facilityId, kind, targetId }) {
  const { rows } = await db.query(
    `SELECT * FROM stripe_terminal_payment
      WHERE facility_id = $1 AND kind = $2 AND target_id = $3
      ORDER BY (state = 'open') DESC, created_at DESC, id DESC LIMIT 1`,
    [facilityId, kind, targetId],
  )
  return rows[0] ?? null
}

function attemptDto(attempt, status = attempt.state, message) {
  return {
    id: attempt.id,
    readerId: attempt.reader_id,
    amountCents: attempt.amount_cents,
    status,
    simulated: attempt.reader_simulated && !attempt.livemode,
    ...(message ? { message } : {}),
  }
}

function readerDto(reader, location, liveMode) {
  const simulated = reader?.device_type?.startsWith('simulated_') === true
  if (objectId(reader?.location) !== location
    || reader?.livemode !== liveMode
    || !supportedDevices.has(reader?.device_type)
    || (simulated && liveMode)) return null
  return { id: reader.id, label: reader.label || 'Card reader', status: reader.status, simulated }
}

async function listReaders(facilityId, getStripe) {
  const testMode = !stripeApiKeyIsLive()
  const location = terminalLocationForFacility(facilityId)
  if (!terminalEnabledForFacility(facilityId)) return { enabled: false, readers: [], testMode }
  const stripe = await requireStripe(getStripe)
  const readers = []
  const stripeReaders = stripe.terminal.readers.list({ location, limit: 100 }, requestOptions)
  for await (const reader of stripeReaders) {
    const dto = readerDto(reader, location, !testMode)
    if (dto) readers.push(dto)
  }
  return { enabled: true, readers, testMode }
}

async function requireStripe(getStripe = getStripeClient) {
  const stripe = await getStripe()
  if (!stripe) throw terminalError(503, 'Stripe Terminal is unavailable.')
  return stripe
}

export function terminalKind(intent) {
  const kind = intent?.metadata?.vortexTerminal
  return typeof kind === 'string' && Object.hasOwn(adapters, kind) ? kind : null
}

export function assertTerminalIntentBinding(attempt, intent) {
  const metadata = intent?.metadata
  if (!intent?.id || !/^pi_[a-zA-Z0-9]+$/.test(intent.id)
    || (attempt.stripe_payment_intent_id && intent.id !== attempt.stripe_payment_intent_id)
    || terminalKind(intent) !== attempt.kind
    || metadata.terminalAttemptId !== attempt.id
    || metadata.terminalTargetId !== String(attempt.target_id)
    || metadata.terminalFacilityId !== String(attempt.facility_id)
    || intent.livemode !== attempt.livemode
    || intent.currency !== 'usd'
    || !Number.isSafeInteger(attempt.amount_cents)
    || intent.amount !== attempt.amount_cents
    || objectId(intent.customer) !== (attempt.stripe_customer_id ?? null)
    || intent.payment_method_types?.length !== 1
    || !intent.payment_method_types.includes('card_present')
    || (intent.status === 'succeeded' && intent.amount_received !== attempt.amount_cents)) {
    throw terminalError(409, 'Stripe payment details do not match this Terminal attempt. Reconciliation is required.')
  }
}

export function readerActionForIntent(reader, intentId) {
  const action = reader?.action
  return action?.type === 'process_payment_intent'
    && objectId(action.process_payment_intent?.payment_intent) === intentId ? action : null
}

async function closeAttempt(db, attempt, state) {
  await db.query(
    "UPDATE stripe_terminal_payment SET state = $2, updated_at = now() WHERE id = $1 AND state = 'open'",
    [attempt.id, state],
  )
  return attemptDto(attempt, state)
}

async function settleIfFinal(db, stripe, attempt, intent) {
  assertTerminalIntentBinding(attempt, intent)
  if (intent.status === 'succeeded') {
    await adapters[attempt.kind].settle(db, { attempt, intent, stripe })
    return closeAttempt(db, attempt, 'succeeded')
  }
  if (intent.status === 'canceled') {
    await adapters[attempt.kind].release?.(db, { attempt, intent })
    return closeAttempt(db, attempt, 'canceled')
  }
  return null
}

async function loadIntent(stripe, attempt) {
  return stripe.paymentIntents.retrieve(attempt.stripe_payment_intent_id, {}, requestOptions)
}

export function terminalPendingStatus(intent, reader) {
  const action = readerActionForIntent(reader, intent.id)
  if (intent.status === 'processing' || intent.status === 'requires_capture'
    || (intent.status === 'requires_payment_method' && action?.status === 'succeeded')) {
    return { status: 'processing', message: 'Stripe is confirming the payment.' }
  }
  if (action?.status === 'in_progress') return { status: 'awaiting_card' }
  if (intent.status === 'requires_payment_method') {
    return {
      status: 'retryable',
      message: reader?.status === 'offline' ? 'The reader is offline. Reconnect it and try again.'
        : action?.status === 'failed' ? 'The payment did not go through. Try again or cancel it.'
          : 'The reader is ready to retry this payment.',
    }
  }
  return { status: 'processing', message: 'Check the payment status before starting again.' }
}

async function readStatus(db, stripe, attempt) {
  if (attempt.state !== 'open') return attemptDto(attempt)
  if (!attempt.stripe_payment_intent_id) return attemptDto(attempt, 'retryable', 'Payment setup did not finish. Try again or cancel it.')
  const intent = await loadIntent(stripe, attempt)
  const final = await settleIfFinal(db, stripe, attempt, intent)
  if (final) return final
  const reader = await stripe.terminal.readers.retrieve(attempt.reader_id, {}, requestOptions)
  const pending = terminalPendingStatus(intent, reader)
  return attemptDto(attempt, pending.status, pending.message)
}

async function initializeIntent(db, stripe, attempt, storePreparation, expectedAmountCents) {
  if (attempt.stripe_payment_intent_id) return { attempt, intent: await loadIntent(stripe, attempt) }
  if (attempt.amount_cents == null) {
    const prepared = storePreparation ?? await adapters[attempt.kind].prepare(db, {
      facilityId: Number(attempt.facility_id),
      targetId: Number(attempt.target_id),
      actorUserId: Number(attempt.actor_user_id) || null,
      attemptId: attempt.id,
      stripe,
      expectedAmountCents,
    })
    if (!Number.isSafeInteger(prepared.amountCents) || prepared.amountCents < 50) {
      throw terminalError(409, 'The amount due must be at least $0.50 to pay by card reader.')
    }
    const updated = await db.query(
      `UPDATE stripe_terminal_payment
          SET amount_cents = $2, stripe_customer_id = $3, stripe_metadata = $4,
              create_started_at = now(), updated_at = now()
        WHERE id = $1 RETURNING *`,
      [attempt.id, prepared.amountCents, prepared.customerId ?? null, prepared.metadata ?? {}],
    )
    attempt = updated.rows[0]
  }
  if (Date.now() - new Date(attempt.create_started_at).getTime() >= createRetryMs) {
    throw terminalError(409, 'This setup expired before the reader was started. Cancel the attempt and start again.')
  }
  assertBillingConnectionHealthy(db)
  const intent = await stripe.paymentIntents.create({
    amount: attempt.amount_cents,
    currency: 'usd',
    capture_method: 'automatic',
    payment_method_types: ['card_present'],
    ...(attempt.stripe_customer_id ? { customer: attempt.stripe_customer_id } : {}),
    metadata: {
      ...attempt.stripe_metadata,
      vortexTerminal: attempt.kind,
      terminalAttemptId: attempt.id,
      terminalTargetId: String(attempt.target_id),
      terminalFacilityId: String(attempt.facility_id),
    },
  }, { ...requestOptions, idempotencyKey: `vortex-terminal-create-${attempt.id}` })
  assertTerminalIntentBinding(attempt, intent)
  const updated = await db.query(
    'UPDATE stripe_terminal_payment SET stripe_payment_intent_id = $2, updated_at = now() WHERE id = $1 RETURNING *',
    [attempt.id, intent.id],
  )
  return { attempt: updated.rows[0], intent }
}

async function startPayment(db, context, stripe, body) {
  const { kind, targetId, facilityId, actorUserId } = context
  const readerId = body.readerId
  if (typeof readerId !== 'string' || !/^tmr_[a-zA-Z0-9]{1,150}$/.test(readerId)) {
    throw terminalError(400, 'Choose a card reader.')
  }
  const liveMode = stripeApiKeyIsLive()
  const location = terminalLocationForFacility(facilityId)
  let attempt = await latestAttempt(db, context)
  if (attempt && attempt.livemode !== liveMode) {
    if (attempt.state === 'open') throw terminalError(409, 'This payment was created in a different Stripe mode.')
    attempt = null
  }
  if (attempt?.state === 'succeeded' && kind === 'store') return attemptDto(attempt)
  if (attempt && attempt.state !== 'open' && attempt.id !== body.previousAttemptId) return attemptDto(attempt)
  if (!Number.isSafeInteger(body.expectedAmountCents) || body.expectedAmountCents < 50) {
    throw terminalError(400, 'Confirm an amount of at least $0.50 before sending it to the reader.')
  }
  if (attempt?.state === 'open' && attempt.reader_id !== readerId) {
    throw terminalError(409, 'This payment is assigned to another reader. Cancel it before switching readers.')
  }
  return withLock(db, `stripe-terminal:reader:${readerId}`, async () => {
    const reader = await stripe.terminal.readers.retrieve(readerId, {}, requestOptions)
    const readerInfo = readerDto(reader, location, liveMode)
    if (!readerInfo) throw terminalError(404, 'This card reader is not available at your facility.')
    if (readerInfo.status !== 'online') throw terminalError(409, 'The reader is offline. Reconnect it and try again.')
    if (reader.action?.status === 'in_progress'
      && !readerActionForIntent(reader, attempt?.stripe_payment_intent_id ?? '')) {
      throw terminalError(409, 'This reader is handling another payment. Wait for it to finish or choose another reader.')
    }
    let storePreparation
    if (!attempt || attempt.state !== 'open') {
      const attemptId = randomUUID()
      if (kind === 'store') {
        storePreparation = await adapters.store.prepare(db, { facilityId, targetId, actorUserId, attemptId, stripe })
        if (storePreparation.amountCents < 50) throw terminalError(409, 'The order total must be at least $0.50 to pay by card reader.')
        if (storePreparation.amountCents !== body.expectedAmountCents) {
          throw terminalError(409, 'The order amount changed. Refresh the order and confirm the current amount.')
        }
      } else if (!await loadCustomerBillingAccount(db, targetId, facilityId)) {
        throw terminalError(404, 'Active family billing account was not found.')
      }
      const inserted = await db.query(
        `INSERT INTO stripe_terminal_payment
           (id, facility_id, kind, target_id, actor_user_id, reader_id, reader_simulated, livemode)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [attemptId, facilityId, kind, targetId, actorUserId, readerId, readerInfo.simulated, liveMode],
      )
      attempt = inserted.rows[0]
    }
    const initialized = await initializeIntent(db, stripe, attempt, storePreparation, body.expectedAmountCents)
    attempt = initialized.attempt
    const intent = initialized.intent
    const final = await settleIfFinal(db, stripe, attempt, intent)
    if (final) return final
    const pending = terminalPendingStatus(intent, reader)
    if (intent.status !== 'requires_payment_method' || pending.status !== 'retryable') {
      return attemptDto(attempt, pending.status, pending.message)
    }
    if (attempt.amount_cents !== body.expectedAmountCents) {
      throw terminalError(409, 'The payment amount changed. Refresh its status and confirm the current amount.')
    }
    await adapters[kind].bind?.(db, { attempt, intent })
    const dispatched = await db.query(
      `UPDATE stripe_terminal_payment SET dispatch_number = dispatch_number + 1, updated_at = now()
        WHERE id = $1 RETURNING dispatch_number`,
      [attempt.id],
    )
    const result = await stripe.terminal.readers.processPaymentIntent(readerId, {
      payment_intent: intent.id,
      process_config: { enable_customer_cancellation: true, skip_tipping: true },
    }, { ...requestOptions, idempotencyKey: `vortex-terminal-read-${attempt.id}-${dispatched.rows[0].dispatch_number}` })
    if (readerActionForIntent(result, intent.id)?.status === 'in_progress') return attemptDto(attempt, 'awaiting_card')
    return readStatus(db, stripe, attempt)
  })
}

async function cancelPayment(db, stripe, attempt) {
  if (!attempt.stripe_payment_intent_id) {
    // An intent which was never bound locally was never dispatched to a reader.
    await adapters[attempt.kind].release?.(db, { attempt, intent: null })
    return closeAttempt(db, attempt, 'canceled')
  }
  return withLock(db, `stripe-terminal:reader:${attempt.reader_id}`, async () => {
    let intent = await loadIntent(stripe, attempt)
    let final = await settleIfFinal(db, stripe, attempt, intent)
    if (final) return final
    const reader = await stripe.terminal.readers.retrieve(attempt.reader_id, {}, requestOptions)
    if (readerActionForIntent(reader, intent.id)?.status === 'in_progress') {
      assertBillingConnectionHealthy(db)
      await stripe.terminal.readers.cancelAction(attempt.reader_id, {}, requestOptions)
      intent = await loadIntent(stripe, attempt)
      final = await settleIfFinal(db, stripe, attempt, intent)
      if (final) return final
    }
    if (!cancelableStatuses.has(intent.status)) return attemptDto(attempt, 'processing', 'Stripe is still confirming this payment.')
    assertBillingConnectionHealthy(db)
    try {
      intent = await stripe.paymentIntents.cancel(intent.id, { cancellation_reason: 'requested_by_customer' }, requestOptions)
    } catch (error) {
      // The card may have been presented between retrieval and cancellation.
      intent = await loadIntent(stripe, attempt)
      final = await settleIfFinal(db, stripe, attempt, intent)
      if (final) return final
      if (intent.status !== 'processing') throw error
    }
    return await settleIfFinal(db, stripe, attempt, intent) ?? attemptDto(attempt, 'processing')
  })
}

async function simulatePayment(db, stripe, attempt, outcome) {
  if (attempt.livemode || stripeApiKeyIsLive() || !attempt.reader_simulated || !attempt.stripe_payment_intent_id) {
    throw terminalError(409, 'Test cards are available only on a Stripe sandbox simulator.')
  }
  if (outcome != null && !['approved', 'declined'].includes(outcome)) throw terminalError(400, 'Choose a test card outcome.')
  return withLock(db, `stripe-terminal:reader:${attempt.reader_id}`, async () => {
    const intent = await loadIntent(stripe, attempt)
    const final = await settleIfFinal(db, stripe, attempt, intent)
    if (final) return final
    const reader = await stripe.terminal.readers.retrieve(attempt.reader_id, {}, requestOptions)
    if (intent.status !== 'requires_payment_method' || reader.livemode !== false
      || !reader.device_type?.startsWith('simulated_')
      || readerActionForIntent(reader, intent.id)?.status !== 'in_progress') {
      throw terminalError(409, 'Send this payment to the simulated reader before presenting a test card.')
    }
    assertBillingConnectionHealthy(db)
    await stripe.testHelpers.terminal.readers.presentPaymentMethod(attempt.reader_id, {
      type: 'card_present',
      card_present: { number: outcome === 'declined' ? '4000000000009995' : '4242424242424242' },
    }, requestOptions)
    return readStatus(db, stripe, attempt)
  })
}

/** Called by both the signed webhook and scheduled reconciliation. */
export async function reconcileTerminalIntent(pool, stripe, intent) {
  const kind = terminalKind(intent)
  if (!kind) return false
  const targetId = Number(intent.metadata.terminalTargetId)
  const facilityId = Number(intent.metadata.terminalFacilityId)
  if (![targetId, facilityId].every((value) => Number.isSafeInteger(value) && value > 0)) {
    throw terminalError(409, 'Stripe Terminal payment has missing ownership data.')
  }
  await withTarget(pool, kind, targetId, async (db) => {
    const { rows } = await db.query(
      `SELECT * FROM stripe_terminal_payment
        WHERE stripe_payment_intent_id = $1 AND facility_id = $2 AND kind = $3 AND target_id = $4`,
      [intent.id, facilityId, kind, targetId],
    )
    const attempt = rows[0]
    if (!attempt) throw terminalError(409, 'Stripe Terminal payment has no matching local attempt.')
    if (attempt.state !== 'open') return
    await settleIfFinal(db, stripe, attempt, await loadIntent(stripe, attempt))
  })
  return true
}

export async function handleTerminalWebhook(pool, event) {
  const intent = event.data?.object
  if (!terminalEvents.has(event.type) || !terminalKind(intent)) return false
  // A decline leaves the attempt and its ledger reservation open for another card.
  if (event.type === 'payment_intent.payment_failed') return true
  return reconcileTerminalIntent(pool, await requireStripe(), intent)
}

export function registerStripeTerminalRoutes(app, pool, adminPaymentAuth, { getStripe = getStripeClient } = {}) {
  const base = '/api/admin/stripe-terminal'
  const wrap = (fn) => async (req, res) => {
    try {
      res.set('Cache-Control', 'no-store')
      const facilityId = requireAdminFacilityScope({ facilityId: req.platformAuth?.user?.facility_id })
      const data = await fn(req, facilityId)
      res.json({ success: true, data })
    } catch (error) {
      const status = Number.isInteger(error.statusCode) && error.statusCode >= 400 && error.statusCode <= 499
        && !String(error.type ?? '').startsWith('Stripe') ? error.statusCode : (error.statusCode === 503 ? 503 : 502)
      if (status >= 500) console.error('[stripe-terminal]', error.code ?? error.type ?? error.message)
      res.status(status).json({
        success: false,
        message: status === 502 ? 'Could not verify the payment with Stripe. Check its status before retrying.' : error.message,
      })
    }
  }
  app.get(`${base}/readers`, ...adminPaymentAuth, wrap((_req, facilityId) => listReaders(facilityId, getStripe)))
  const payment = `${base}/:kind/:targetId`
  const route = (action) => wrap(async (req, facilityId) => {
    const { kind } = req.params
    const targetId = Number(req.params.targetId)
    if (!Object.hasOwn(adapters, kind) || !Number.isSafeInteger(targetId) || targetId <= 0) {
      throw terminalError(404, 'Payment target was not found.')
    }
    if (action === 'start' && !terminalEnabledForFacility(facilityId)) {
      throw terminalError(503, 'Stripe Terminal is not configured for this facility.')
    }
    const context = { facilityId, kind, targetId, actorUserId: req.platformAuth?.user?.id ?? null }
    const body = req.body ?? {}
    return withTarget(pool, kind, targetId, async (db) => {
      if (action === 'start') return startPayment(db, context, await requireStripe(getStripe), body)
      const attempt = await latestAttempt(db, context)
      if (action === 'status' && !attempt) return null
      if (!attempt || (action !== 'status' && attempt.id !== body.attemptId)) {
        throw terminalError(404, 'This payment attempt was not found.')
      }
      if (attempt.state !== 'open') {
        if (action === 'status' && attempt.livemode !== stripeApiKeyIsLive()) return null
        return attemptDto(attempt)
      }
      if (attempt.livemode !== stripeApiKeyIsLive()) {
        throw terminalError(409, 'This payment was created in a different Stripe mode.')
      }
      if (action === 'status' && !attempt.stripe_payment_intent_id) return readStatus(db, null, attempt)
      if (action === 'cancel' && !attempt.stripe_payment_intent_id) return cancelPayment(db, null, attempt)
      const stripe = await requireStripe(getStripe)
      if (action === 'cancel') return cancelPayment(db, stripe, attempt)
      if (action === 'simulate') return simulatePayment(db, stripe, attempt, body.outcome)
      return readStatus(db, stripe, attempt)
    })
  })
  app.get(payment, ...adminPaymentAuth, route('status'))
  app.post(payment, ...adminPaymentAuth, route('start'))
  app.post(`${payment}/cancel`, ...adminPaymentAuth, route('cancel'))
  app.post(`${payment}/simulate`, ...adminPaymentAuth, route('simulate'))
}
