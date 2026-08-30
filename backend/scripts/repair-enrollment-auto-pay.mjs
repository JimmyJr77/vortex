#!/usr/bin/env node

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import pg from 'pg'
import Stripe from 'stripe'
import {
  backfillLegacyEnrollmentPromo,
  ensureLegacyEnrollmentAdjustmentRecords,
  repairSavedCardEnrollmentSubscriptions,
} from '../billing/enrollmentSubscriptionRepair.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })
dotenv.config({ path: path.join(__dirname, '..', '.env') })

function argument(name) {
  return process.argv.find((entry) => entry.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null
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
const accountIds = numberList('account-ids')
const signupIds = numberList('signup-ids')
const legacyAccountId = Number(argument('legacy-promo-account'))
const legacySignupIds = numberList('legacy-promo-signups')
const legacyRuleId = Number(argument('legacy-promo-rule'))
const legacyReason = argument('legacy-promo-reason')
const hasLegacyPromo =
  Number.isFinite(legacyAccountId) &&
  legacySignupIds.length > 0 &&
  Number.isFinite(legacyRuleId) &&
  Boolean(legacyReason)

const connectionString =
  process.env.EXTERNAL_DB_URL || process.env.DATABASE_URL || process.env.DB_URL
const stripeKey =
  process.env.STRIPE_SECRET_KEY ||
  process.env.STRIPE_SECRET_KEY_PROD ||
  process.env.STRIPE_SECRET_KEY_TEST

if (!connectionString) throw new Error('A database connection URL is required.')
if (!stripeKey) throw new Error('A Stripe secret key is required.')

// Downstream schedule synchronization uses the shared Stripe client.
process.env.STRIPE_SECRET_KEY = stripeKey
process.env.STRIPE_ENABLED = 'true'

const pool = new pg.Pool({
  connectionString,
  ssl: needsSsl(connectionString) ? { rejectUnauthorized: false } : false,
})
const stripe = new Stripe(stripeKey)

async function main() {
  const output = {
    mode: apply ? 'apply' : 'dry_run',
    stripeMode: stripeKey.startsWith('sk_live_') ? 'live' : 'test',
    scope: { accountIds, signupIds },
    legacyPromo: hasLegacyPromo
      ? {
          accountId: legacyAccountId,
          signupIds: legacySignupIds,
          ruleId: legacyRuleId,
          reason: legacyReason,
          status: apply ? 'pending' : 'planned_only',
        }
      : null,
  }

  if (apply && hasLegacyPromo) {
    output.legacyPromo = {
      ...output.legacyPromo,
      status: 'backfilled',
      result: await backfillLegacyEnrollmentPromo(pool, {
        accountId: legacyAccountId,
        signupIds: legacySignupIds,
        ruleId: legacyRuleId,
        reason: legacyReason,
      }),
    }
  }

  output.repair = await repairSavedCardEnrollmentSubscriptions(pool, stripe, {
    apply,
    accountIds,
    signupIds,
  })

  if (apply && hasLegacyPromo) {
    output.legacyPromo.adjustments = await ensureLegacyEnrollmentAdjustmentRecords(pool, {
      accountId: legacyAccountId,
      signupIds: legacySignupIds,
      ruleId: legacyRuleId,
      reason: legacyReason,
    })
  }

  console.log(JSON.stringify(output, null, 2))
  if (apply && output.repair.failed.length > 0) process.exitCode = 1
}

main()
  .catch((error) => {
    console.error(error?.stack || error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
