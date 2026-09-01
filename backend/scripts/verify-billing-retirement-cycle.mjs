#!/usr/bin/env node

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import pg from 'pg'

import { assertRequiredBillingSchema } from '../billing/billingSchemaReadiness.js'
import { recordBillingCycleVerificationEvidence } from '../billing/billingLegacyRetirement.js'
import { verifyAndRecordBillingRetirementCycle } from '../billing/billingRetirementCycleVerification.js'
import { getStripeClient, stripeEnabled } from '../billing/stripeBilling.js'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const backendDirectory = path.resolve(scriptDirectory, '..')
dotenv.config({ path: path.join(backendDirectory, '.env.local') })
dotenv.config({ path: path.join(backendDirectory, '.env') })

function option(name) {
  const prefix = `--${name}=`
  return process.argv.find((entry) => entry.startsWith(prefix))?.slice(prefix.length) ?? null
}

function positiveInteger(name) {
  const value = Number(option(name))
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`--${name} must be a positive integer.`)
  return value
}

function accountIds() {
  if (process.argv.includes('--all') || option('account-ids') === 'all') {
    throw new Error('Cycle evidence requires explicit --account-ids; --all is not supported.')
  }
  const ids = [...new Set(String(option('account-ids') ?? option('accounts') ?? '')
    .split(',')
    .map(Number)
    .filter((value) => Number.isSafeInteger(value) && value > 0))]
  if (ids.length === 0) throw new Error('At least one explicit --account-ids=<id,id> is required.')
  return ids.sort((a, b) => a - b)
}

function billingMonth() {
  const value = String(option('billing-month') ?? '')
  if (/^\d{4}-\d{2}$/.test(value)) return `${value}-01`
  if (!/^\d{4}-\d{2}-01$/.test(value)) throw new Error('--billing-month must use YYYY-MM or YYYY-MM-01.')
  return value
}

function ssl(connectionString) {
  if (process.env.DATABASE_SSL === 'false') return false
  if (process.env.DATABASE_SSL === 'true') return { rejectUnauthorized: false }
  return /render\.com|neon\.tech|supabase\.co|rds\.amazonaws\.com/i.test(String(connectionString ?? ''))
    ? { rejectUnauthorized: false }
    : false
}

function safeParity(value) {
  if (!value) return {}
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return {}
  }
}

async function main() {
  const apply = process.argv.includes('--apply')
  if (apply && option('as-of')) throw new Error('--as-of is allowed only for a dry run.')
  const runId = positiveInteger('run')
  const ids = accountIds()
  const month = billingMonth()
  const now = option('as-of') ? new Date(option('as-of')) : new Date()
  if (Number.isNaN(now.getTime())) throw new Error('--as-of must be a valid ISO timestamp.')
  if (!stripeEnabled()) throw new Error('Cycle verification requires STRIPE_ENABLED=true and STRIPE_SECRET_KEY.')
  const connectionString = process.env.EXTERNAL_DB_URL || process.env.DATABASE_URL || process.env.DB_URL
  if (!connectionString) throw new Error('EXTERNAL_DB_URL, DATABASE_URL, or DB_URL is required.')

  const pool = new pg.Pool({ connectionString, ssl: ssl(connectionString) })
  try {
    await assertRequiredBillingSchema(pool)
    const migrations = await pool.query(
      `SELECT migration.*
         FROM billing_account_migration migration
        WHERE migration.billing_migration_run_id = $1
          AND migration.family_billing_account_id = ANY($2::bigint[])
        ORDER BY migration.family_billing_account_id`,
      [runId, ids],
    )
    const byAccount = new Map(migrations.rows.map((row) => [Number(row.family_billing_account_id), row]))
    const stripe = await getStripeClient()
    if (!stripe) throw new Error('Stripe client initialization failed.')
    const accounts = []
    for (const accountId of ids) {
      const migration = byAccount.get(accountId)
      if (!migration) {
        accounts.push({ accountId, state: 'missing', recorded: false })
        continue
      }
      try {
        accounts.push(await verifyAndRecordBillingRetirementCycle(pool, {
          migration,
          stripe,
          billingMonth: month,
          now,
          apply,
        }))
      } catch (error) {
        let evidenceId = null
        if (apply && migration.state === 'verified') {
          const evidence = await recordBillingCycleVerificationEvidence(pool, {
            accountId,
            migrationId: migration.id,
            billingMonth: month,
            facilityTimezone: safeParity(migration.parity_snapshot).timezone ?? 'UTC',
            verifiedAt: now,
            verifierVersion: 'canonical-cycle-v1',
            status: 'error',
            verification: {
              issues: [{ code: String(error?.code ?? 'cycle_verification_error'), message: String(error?.message ?? error) }],
              evidence: {},
            },
          })
          evidenceId = evidence?.id == null ? null : Number(evidence.id)
        }
        accounts.push({
          accountId,
          state: 'error',
          code: error?.code ?? null,
          error: error?.message ?? String(error),
          recorded: evidenceId != null,
          evidenceId,
        })
      }
    }
    console.log(JSON.stringify({
      command: 'billing-retirement-cycle-verification',
      dryRun: !apply,
      runId,
      billingMonth: month,
      accounts,
    }, null, 2))
    if (accounts.some((account) => account.state === 'error' || account.state === 'missing' || account.verified === false)) {
      process.exitCode = 1
    }
    if (!apply) console.error('Dry run only. Re-run with --apply to append reviewed cycle evidence.')
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error('[billing:retirement:verify-cycle]', error?.message ?? error)
  process.exitCode = 1
})
