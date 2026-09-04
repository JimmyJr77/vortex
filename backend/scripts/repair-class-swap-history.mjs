#!/usr/bin/env node

/**
 * Reconcile class moves created by the former standalone-credit workflow.
 * Dry-run by default. Use a precise account scope in production:
 *
 *   node backend/scripts/repair-class-swap-history.mjs --account-ids=10906
 *   node backend/scripts/repair-class-swap-history.mjs --account-ids=10906 --apply
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import pg from 'pg'
import { repairLegacyClassSwapLedger } from '../billing/customerBillingEnrollmentSwap.js'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(scriptDir, '..', '.env.local') })
dotenv.config({ path: path.join(scriptDir, '..', '.env') })

const accountIds = String(process.argv.find((entry) => entry.startsWith('--account-ids='))?.slice('--account-ids='.length) ?? '')
  .split(',')
  .map(Number)
  .filter((value) => Number.isInteger(value) && value > 0)
const apply = process.argv.includes('--apply')
const connectionString = process.env.EXTERNAL_DB_URL || process.env.DATABASE_URL || process.env.DB_URL

if (!connectionString) throw new Error('A database connection URL is required.')
if (accountIds.length === 0) throw new Error('Pass --account-ids=<billing-account-id> to keep this repair explicitly scoped.')

const pool = new pg.Pool({
  connectionString,
  ssl: /render\.com|neon\.tech|supabase\.co|rds\.amazonaws\.com/i.test(connectionString)
    ? { rejectUnauthorized: false }
    : false,
})

try {
  const result = await repairLegacyClassSwapLedger(pool, { accountIds, apply })
  console.log(JSON.stringify({
    apply,
    candidateCount: result.repairs.length,
    appliedCount: result.applied.length,
    repairs: result.repairs,
    applied: result.applied,
  }, null, 2))
} finally {
  await pool.end()
}
