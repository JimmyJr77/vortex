#!/usr/bin/env node

/**
 * Reassign legacy full tuition for late-start enrollments to the next full
 * calendar month and post the first month's actual scheduled proration.
 * Dry-run by default. Corrections are idempotent and append-only.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import pg from 'pg'
import { repairLateStartEnrollmentProration } from '../billing/initialEnrollmentProrationRepair.js'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(scriptDir, '..', '.env.local') })
dotenv.config({ path: path.join(scriptDir, '..', '.env') })

function argument(name) {
  return process.argv.find((entry) => entry.startsWith(`--${name}=`))?.slice(name.length + 3) ?? null
}

const accountIds = String(argument('account-ids') ?? '')
  .split(',')
  .map(Number)
  .filter((value) => Number.isFinite(value) && value > 0)
const apply = process.argv.includes('--apply')
const connectionString = process.env.EXTERNAL_DB_URL || process.env.DATABASE_URL || process.env.DB_URL
if (!connectionString) throw new Error('A database connection URL is required.')
const pool = new pg.Pool({
  connectionString,
  ssl: /render\.com|neon\.tech|supabase\.co|rds\.amazonaws\.com/i.test(connectionString)
    ? { rejectUnauthorized: false }
    : false,
})

try {
  const result = await repairLateStartEnrollmentProration(pool, { accountIds, apply })
  console.log(JSON.stringify({
    apply,
    candidateCount: result.repairs.length,
    applied: result.applied,
    repairs: result.repairs.map((repair) => ({
      accountId: Number(repair.account_id),
      chargeId: Number(repair.charge_id),
      signupId: Number(repair.signup_id),
      description: repair.description,
      enrollmentStart: repair.enrollmentStart,
      fullTuitionServiceMonth: repair.nextPeriodStart.slice(0, 7),
      remainingClasses: repair.proration.remainingClasses,
      prorationRatio: repair.proration.ratio,
      proratedAmountCents: repair.proratedNetCents,
      priorProrationCreditCents: Number(repair.prior_proration_credit_cents ?? 0),
    })),
  }, null, 2))
} finally {
  await pool.end()
}
