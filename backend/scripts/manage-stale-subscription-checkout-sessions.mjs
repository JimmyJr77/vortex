#!/usr/bin/env node

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import Stripe from 'stripe'
import {
  checkoutSessionHasForbiddenSubscriptionCollector,
  checkoutSessionSubscriptionId,
} from '../billing/checkoutSessionCollectionPolicy.js'

export const EXPIRE_CONFIRMATION = 'EXPIRE_OPEN_SUBSCRIPTION_CHECKOUTS'

function stripeId(value) {
  return typeof value === 'string' ? value : value?.id ?? null
}

export function summarizeSubscriptionCheckoutSession(session) {
  return {
    id: session?.id ?? null,
    mode: session?.mode ?? null,
    status: session?.status ?? null,
    subscriptionId: checkoutSessionSubscriptionId(session),
    customerId: stripeId(session?.customer),
    checkoutType: session?.metadata?.checkoutType ?? null,
    familyBillingAccountId: session?.metadata?.familyBillingAccountId ?? null,
    createdAt: session?.created ? new Date(Number(session.created) * 1000).toISOString() : null,
    expiresAt: session?.expires_at ? new Date(Number(session.expires_at) * 1000).toISOString() : null,
  }
}

/** Read-only pagination over every currently open subscription-capable Session. */
export async function enumerateOpenSubscriptionCheckoutSessions(stripe) {
  const sessions = []
  let startingAfter = null
  do {
    const page = await stripe.checkout.sessions.list({
      limit: 100,
      status: 'open',
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    })
    for (const session of page.data ?? []) {
      if (checkoutSessionHasForbiddenSubscriptionCollector(session)) {
        sessions.push(summarizeSubscriptionCheckoutSession(session))
      }
    }
    startingAfter = page.has_more && page.data?.length
      ? page.data[page.data.length - 1].id
      : null
  } while (startingAfter)
  return sessions
}

/**
 * Expiry is intentionally explicit: no bulk --all mutation exists. Every id
 * is re-read and must still be open, subscription-mode, and collector-free.
 */
export async function expireExplicitOpenSubscriptionCheckoutSessions(stripe, sessionIds, {
  apply = false,
} = {}) {
  const ids = [...new Set((sessionIds ?? []).map((value) => String(value).trim()).filter(Boolean))]
  if (ids.length === 0) throw new Error('Explicit Checkout Session ids are required.')
  const results = []
  for (const id of ids) {
    if (!/^cs_(?:test_|live_)?[A-Za-z0-9]+$/.test(id)) {
      throw new Error(`Invalid Stripe Checkout Session id: ${id}`)
    }
    const session = await stripe.checkout.sessions.retrieve(id)
    if (session.mode !== 'subscription') {
      throw new Error(`Checkout Session ${id} is ${session.mode ?? 'unknown'} mode, not subscription mode.`)
    }
    if (session.status !== 'open') {
      throw new Error(`Checkout Session ${id} is ${session.status ?? 'unknown'}, not open.`)
    }
    if (checkoutSessionSubscriptionId(session)) {
      throw new Error(`Checkout Session ${id} already has a Subscription and requires reviewed cancellation.`)
    }
    if (apply) {
      await stripe.checkout.sessions.expire(
        id,
        {},
        { idempotencyKey: `expire-stale-subscription-checkout:${id}` },
      )
    }
    results.push({ ...summarizeSubscriptionCheckoutSession(session), action: apply ? 'expired' : 'eligible' })
  }
  return results
}

function optionValue(name) {
  return process.argv.find((argument) => argument.startsWith(`${name}=`))?.slice(name.length + 1) ?? null
}

async function main() {
  const directory = path.dirname(fileURLToPath(import.meta.url))
  dotenv.config({ path: path.join(directory, '..', '.env.local') })
  dotenv.config({ path: path.join(directory, '..', '.env') })

  const apply = process.argv.includes('--apply')
  const confirmation = optionValue('--confirm')
  const ids = String(optionValue('--session-ids') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  if (apply && ids.length === 0) throw new Error('--apply requires explicit --session-ids=cs_....')
  if (apply && confirmation !== EXPIRE_CONFIRMATION) {
    throw new Error(`--apply requires --confirm=${EXPIRE_CONFIRMATION}.`)
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY_PROD
  if (!stripeKey?.startsWith('sk_')) throw new Error('Stripe secret key is not configured.')
  const stripe = new Stripe(stripeKey, { maxNetworkRetries: 2 })
  const result = ids.length > 0
    ? await expireExplicitOpenSubscriptionCheckoutSessions(stripe, ids, { apply })
    : await enumerateOpenSubscriptionCheckoutSessions(stripe)
  process.stdout.write(`${JSON.stringify({ apply, count: result.length, sessions: result }, null, 2)}\n`)
}

const direct = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (direct) {
  main().catch((error) => {
    process.stderr.write(`${error?.stack ?? error}\n`)
    process.exitCode = 1
  })
}
