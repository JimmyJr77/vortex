#!/usr/bin/env node

/**
 * Backfill missing service periods on initial recurring enrollment charges.
 *
 * A future-start enrollment can be recorded before its first class month. The
 * charge remains valid, but without a service period Customer Billing displays
 * its creation month instead of the athlete's selected start month. This tool
 * derives the original service window from enrollment_start_date. It is a
 * dry-run unless --apply is supplied.
 *
 * Usage:
 *   npm run billing:repair-recurring-periods
 *   npm run billing:repair-recurring-periods -- --apply
 *   npm run billing:repair-recurring-periods -- --account-ids=10908
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import pg from 'pg'
import { repairEnrollmentBillingCoverage } from '../billing/paymentAllocation.js'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(scriptDir, '..', '.env.local') })
dotenv.config({ path: path.join(scriptDir, '..', '.env') })

function argument(name) {
  return process.argv.find((entry) => entry.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null
}

function numberList(name) {
  return String(argument(name) ?? '')
    .split(',')
    .map(Number)
    .filter((value) => Number.isFinite(value) && value > 0)
}

function needsSsl(value) {
  return /render\.com|neon\.tech|supabase\.co|rds\.amazonaws\.com/i.test(String(value))
}

function dateOnly(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value ?? '').slice(0, 10)
}

const apply = process.argv.includes('--apply')
const requestedAccountIds = numberList('account-ids')
const connectionString = process.env.EXTERNAL_DB_URL || process.env.DATABASE_URL || process.env.DB_URL
if (!connectionString) throw new Error('A database connection URL is required.')
const pool = new pg.Pool({ connectionString, ssl: needsSsl(connectionString) ? { rejectUnauthorized: false } : false })

try {
  const accountResult = await pool.query(
    `SELECT DISTINCT charge.family_billing_account_id AS account_id
       FROM billing_charge charge
       JOIN billing_subscription subscription ON subscription.id = charge.subscription_id
       JOIN scheduling_signup signup
         ON subscription.source_type = 'scheduling_signup'
        AND subscription.source_id ~ '^[0-9]+$'
        AND signup.id = subscription.source_id::bigint
      WHERE charge.charge_type = 'recurring'
        AND charge.source_type = 'scheduling_signup'
        AND charge.service_period_start IS NULL
        AND charge.service_period_end IS NULL
        AND signup.enrollment_start_date IS NOT NULL
        AND ($1::bigint[] = '{}'::bigint[] OR charge.family_billing_account_id = ANY($1::bigint[]))
      ORDER BY charge.family_billing_account_id`,
    [requestedAccountIds],
  )
  const reports = []
  for (const { account_id: accountId } of accountResult.rows) {
    const report = await repairEnrollmentBillingCoverage(pool, {
      accountId: Number(accountId),
      apply,
      actorType: 'system',
    })
    reports.push({
      accountId: Number(accountId),
      candidates: report.candidates.map((row) => ({
        chargeId: Number(row.charge_id),
        signupId: Number(row.signup_id),
        servicePeriodStart: dateOnly(row.service_period_start),
        servicePeriodEnd: dateOnly(row.service_period_end),
      })),
      updatedChargeIds: report.updatedCharges.map((row) => Number(row.id)),
      advancedSubscriptionIds: report.advancedSubscriptions.map((row) => Number(row.id)),
    })
  }
  console.log(JSON.stringify({ apply, accounts: reports, candidateCount: reports.reduce((sum, report) => sum + report.candidates.length, 0) }, null, 2))
} finally {
  await pool.end()
}
