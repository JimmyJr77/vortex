#!/usr/bin/env node

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import pg from 'pg'
import Stripe from 'stripe'
import { auditFamilyDiscounts } from '../billing/familyDiscountAudit.js'
import { repairSavedCardEnrollmentSubscriptions } from '../billing/enrollmentSubscriptionRepair.js'
import { syncFamilyStripeSubscriptionAmounts } from '../billing/stripeSubscriptionSync.js'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(scriptDir, '..', '.env.local') })
dotenv.config({ path: path.join(scriptDir, '..', '.env') })

function argument(name) {
  return process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null
}

function numberList(name) {
  return String(argument(name) ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map(Number)
    .filter(Number.isFinite)
}

function needsSsl(value) {
  return /render\.com|neon\.tech|supabase\.co|rds\.amazonaws\.com/i.test(String(value))
}

const apply = process.argv.includes('--apply')
const periodKey = argument('period') ?? new Date().toISOString().slice(0, 7)
const accountIds = numberList('account-ids')
if (!/^\d{4}-\d{2}$/.test(periodKey)) {
  throw new Error('Billing period must use YYYY-MM format.')
}

const connectionString =
  process.env.EXTERNAL_DB_URL || process.env.DATABASE_URL || process.env.DB_URL
if (!connectionString) throw new Error('A database connection URL is required.')

const stripeKey =
  process.env.STRIPE_SECRET_KEY ||
  process.env.STRIPE_SECRET_KEY_PROD ||
  process.env.STRIPE_SECRET_KEY_TEST ||
  null
if (stripeKey) {
  process.env.STRIPE_SECRET_KEY = stripeKey
  process.env.STRIPE_ENABLED = 'true'
}

const pool = new pg.Pool({
  connectionString,
  ssl: needsSsl(connectionString) ? { rejectUnauthorized: false } : false,
})

async function runAudit() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const report = await auditFamilyDiscounts(client, {
      periodKey,
      accountIds,
      apply,
    })
    await client.query(apply ? 'COMMIT' : 'ROLLBACK')
    return report
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function main() {
  const audit = await runAudit()
  const output = {
    audit,
    stripeMode: stripeKey
      ? stripeKey.startsWith('sk_live_')
        ? 'live'
        : stripeKey.startsWith('sk_test_')
          ? 'test'
          : 'configured'
      : 'unconfigured',
    autoPayRepair: null,
    stripePriceSync: [],
  }

  if (apply && stripeKey) {
    const stripe = new Stripe(stripeKey)
    output.autoPayRepair = await repairSavedCardEnrollmentSubscriptions(pool, stripe, {
      apply: true,
      accountIds,
    })
    for (const account of audit.accounts.filter((entry) => entry.needsStripePriceSync)) {
      output.stripePriceSync.push({
        familyId: account.familyId,
        ...(await syncFamilyStripeSubscriptionAmounts(pool, account.familyId)),
      })
    }
  }

  console.log(JSON.stringify(output, null, 2))
  if (output.autoPayRepair?.failed?.length > 0) process.exitCode = 1
}

main()
  .catch((error) => {
    console.error(error?.stack || error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
