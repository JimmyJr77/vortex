#!/usr/bin/env node

import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import pg from 'pg'
import Stripe from 'stripe'

import { assertRequiredBillingSchema } from '../billing/billingSchemaReadiness.js'
import { repairDuplicateStripeInvoicePayments } from '../billing/duplicateStripeInvoicePaymentRepair.js'
import {
  buildRepairPlanHash,
  databaseTargetFingerprint,
  parseRepairCliArgs,
  resolveUnambiguousDatabaseUrl,
  sanitizeRepairReport,
} from './lib/duplicate-stripe-invoice-payment-repair-cli.mjs'

const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const REPAIR_SOURCE_FILES = Object.freeze([
  'billing/duplicateStripeInvoicePaymentRepair.js',
  'billing/stripeInvoicePaymentBinding.js',
  'billing/paymentAllocation.js',
  'scripts/lib/duplicate-stripe-invoice-payment-repair-cli.mjs',
  'scripts/repair-duplicate-stripe-invoice-payments.mjs',
])

export function databaseSsl(connectionString) {
  const hostname = new URL(connectionString).hostname.toLowerCase()
  return ['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname)
    ? false
    : { rejectUnauthorized: false }
}

export async function computeRepairSourceChecksum({
  directory = backendDirectory,
  readFile = fs.readFile,
} = {}) {
  const hash = createHash('sha256')
  for (const filename of REPAIR_SOURCE_FILES) {
    hash.update(filename)
    hash.update('\0')
    hash.update(await readFile(path.join(directory, filename)))
    hash.update('\0')
  }
  return hash.digest('hex')
}

async function readOnlyInspection(pool, stripe, pairs, {
  assertSchema = assertRequiredBillingSchema,
  repair = repairDuplicateStripeInvoicePayments,
} = {}) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN TRANSACTION READ ONLY')
    await client.query("SET LOCAL statement_timeout = '30s'")
    await assertSchema(client)
    const result = await repair(client, stripe, { pairs, apply: false })
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}

function requireTargetKey(target, stripeKey) {
  const mode = stripeKey.startsWith('sk_live_') ? 'live'
    : stripeKey.startsWith('sk_test_') ? 'test'
      : null
  if (!mode) throw new Error('STRIPE_SECRET_KEY must be a standard sk_live_ or sk_test_ key.')
  if (target === 'production' && mode !== 'live') throw new Error('Production repair requires a live Stripe key.')
  if (target !== 'production' && mode !== 'test') throw new Error('Non-production repair refuses a live Stripe key.')
  return mode
}

export async function main(argv = process.argv.slice(2), environment = process.env, dependencies = {}) {
  const directory = path.dirname(fileURLToPath(import.meta.url))
  if (environment === process.env) {
    dotenv.config({ path: path.join(directory, '..', '.env.local') })
    dotenv.config({ path: path.join(directory, '..', '.env') })
  }

  const options = parseRepairCliArgs(argv)
  if (options.apply && environment.BILLING_DUPLICATE_PAYMENT_REPAIR_ENABLED !== 'true') {
    throw new Error('Apply requires BILLING_DUPLICATE_PAYMENT_REPAIR_ENABLED=true.')
  }
  if (environment.STRIPE_ENABLED !== 'true') throw new Error('STRIPE_ENABLED=true is required.')
  const stripeKey = String(environment.STRIPE_SECRET_KEY ?? '').trim()
  const stripeMode = requireTargetKey(options.target, stripeKey)
  const connectionString = resolveUnambiguousDatabaseUrl(environment)
  const databaseFingerprint = databaseTargetFingerprint(connectionString)
  if (
    options.apply
    && environment.BILLING_DUPLICATE_PAYMENT_REPAIR_DB_FINGERPRINT !== databaseFingerprint
  ) {
    throw new Error('Production database fingerprint was not explicitly approved for this repair.')
  }
  const codeVersion = String(environment.RENDER_GIT_COMMIT ?? environment.BILLING_REPAIR_CODE_VERSION ?? '').trim()
  if (options.apply && !codeVersion) throw new Error('Apply requires RENDER_GIT_COMMIT or BILLING_REPAIR_CODE_VERSION.')
  const sourceChecksum = dependencies.sourceChecksum ?? await computeRepairSourceChecksum()
  if (!/^[0-9a-f]{64}$/.test(String(sourceChecksum))) {
    throw new Error('Repair source checksum could not be established.')
  }

  const pool = dependencies.pool ?? new pg.Pool({
    connectionString,
    ssl: databaseSsl(connectionString),
    max: 2,
    application_name: 'duplicate-stripe-invoice-payment-repair',
    connectionTimeoutMillis: 10_000,
    query_timeout: 30_000,
  })
  const stripe = dependencies.stripe ?? new Stripe(stripeKey, { maxNetworkRetries: 2 })
  const repair = dependencies.repair ?? repairDuplicateStripeInvoicePayments
  const inspect = dependencies.readOnlyInspection
    ?? ((targetPool, targetStripe, pairs) => readOnlyInspection(targetPool, targetStripe, pairs, {
      assertSchema: dependencies.assertSchema ?? assertRequiredBillingSchema,
      repair,
    }))
  try {
    const stripeAccount = await stripe.accounts.retrieve()
    const identity = {
      target: options.target,
      databaseFingerprint,
      stripeAccountId: stripeAccount.id,
      stripeMode,
      codeVersion: codeVersion || 'unversioned-dry-run',
      sourceChecksum,
    }
    const preflight = await inspect(pool, stripe, options.pairs)
    const planHash = buildRepairPlanHash(preflight, identity)
    if (preflight.cohortStopped || preflight.failed.length > 0) {
      const error = new Error('Repair preflight failed; no local changes were made.')
      error.report = { identity, planHash, result: sanitizeRepairReport(preflight) }
      throw error
    }

    if (!options.apply) {
      return { identity, planHash, result: sanitizeRepairReport(preflight) }
    }
    if (environment.BILLING_DUPLICATE_PAYMENT_REPAIR_STRIPE_ACCOUNT_ID !== stripeAccount.id) {
      throw new Error('Stripe account id was not explicitly approved for this repair.')
    }
    if (options.planHash !== planHash) throw new Error('Preflight evidence changed or the supplied plan hash is stale.')

    await (dependencies.assertSchema ?? assertRequiredBillingSchema)(pool)
    let applied = null
    let applyError = null
    try {
      applied = await repair(pool, stripe, {
        pairs: options.pairs,
        apply: true,
        provenance: {
          planHash,
          changeTicket: options.changeTicket,
          operator: options.operator,
          codeVersion,
          sourceChecksum,
        },
      })
    } catch (error) {
      applyError = error
    }

    let postflight = null
    let postflightError = null
    try {
      postflight = await inspect(pool, stripe, options.pairs)
    } catch (error) {
      postflightError = error
    }
    const nextPlanHash = postflight && !postflight.cohortStopped && postflight.failed.length === 0
      ? buildRepairPlanHash(postflight, identity)
      : null
    const committedCount = applied
      ? (applied.committed ?? applied.repaired ?? []).length
      : 0
    const applyIncomplete = Boolean(
      applyError
      || !applied
      || applied.cohortStopped
      || (applied.failed ?? []).length > 0
      || (applied.notApplied ?? []).length > 0
      || (applied.unknown ?? []).length > 0
      || committedCount !== options.pairs.length,
    )
    const postflightIncomplete = Boolean(
      postflightError
      || !postflight
      || postflight.cohortStopped
      || (postflight.failed ?? []).length > 0
      || (postflight.ready ?? []).some((row) => row.state !== 'already_repaired'),
    )
    if (applyIncomplete || postflightIncomplete) {
      const fallback = applied ?? {
        mode: 'apply',
        cohortStopped: true,
        ready: [],
        repaired: [],
        committed: [],
        notApplied: [],
        unknown: [],
        failed: [{ pair: 'cohort', message: applyError?.message ?? 'Repair apply outcome is unavailable.' }],
      }
      const error = new Error(
        postflightError
          ? 'Repair outcome is uncertain because fresh post-verification failed.'
          : 'Repair apply was partial or stopped; use the fresh post-verification before replaying.',
      )
      error.report = {
        identity,
        planHash,
        nextPlanHash,
        result: sanitizeRepairReport(fallback),
        postVerification: postflight
          ? sanitizeRepairReport(postflight)
          : sanitizeRepairReport({
              mode: 'dry_run',
              cohortStopped: true,
              ready: [],
              repaired: [],
              failed: [{ pair: 'cohort', message: postflightError?.message ?? 'Post-verification is unavailable.' }],
            }),
      }
      throw error
    }
    return {
      identity,
      planHash,
      result: sanitizeRepairReport(applied),
      postVerification: sanitizeRepairReport(postflight),
    }
  } finally {
    await pool.end()
  }
}

const direct = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (direct) {
  main().then((report) => {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  }).catch((error) => {
    if (error?.report) process.stderr.write(`${JSON.stringify(error.report, null, 2)}\n`)
    process.stderr.write(`${error?.stack ?? error}\n`)
    process.exitCode = 1
  })
}
