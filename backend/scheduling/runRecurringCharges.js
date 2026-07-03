/**
 * CLI entrypoint for the monthly recurring-charge generator.
 * Schedule via cron, e.g. daily:  0 6 * * *  cd backend && npm run billing:recurring
 * Safe to run more often than monthly — posting is idempotent per subscription/period.
 */

import 'dotenv/config'
import pg from 'pg'
import { generateRecurringCharges } from './generateRecurringCharges.js'
import { expirePassCredits } from '../programs/multiClassPass.js'
import { autoCompleteEndedEnrollments } from './adminEnrollmentsView.js'

const { Pool } = pg

function resolveSsl(connectionString) {
  if (process.env.DATABASE_SSL === 'false') return false
  if (process.env.DATABASE_SSL === 'true') return { rejectUnauthorized: false }
  if (process.env.NODE_ENV === 'production') return { rejectUnauthorized: false }
  const value = String(connectionString || '')
  if (/render\.com|neon\.tech|supabase\.co|rds\.amazonaws\.com/i.test(value)) {
    return { rejectUnauthorized: false }
  }
  return false
}

async function main() {
  const connectionString = process.env.DATABASE_URL || process.env.DB_URL
  const pool = new Pool({
    connectionString,
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'vortex_athletics',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
    ssl: resolveSsl(connectionString),
  })

  try {
    try {
      const completed = await autoCompleteEndedEnrollments(pool)
      if (completed.length > 0) {
        console.log(`[billing:recurring] auto-completed ${completed.length} ended enrollment(s).`)
      }
    } catch (acErr) {
      console.warn('[billing:recurring] auto-complete sweep failed:', acErr?.message || acErr)
    }
    const result = await generateRecurringCharges(pool)
    console.log(
      `[billing:recurring] processed ${result.subscriptionsProcessed} subscription(s), ` +
        `posted ${result.chargesPosted} charge(s) across ${result.periodsAdvanced} period(s).`,
    )
    try {
      const expired = await expirePassCredits(pool)
      if (expired.expiredPasses > 0) {
        console.log(
          `[billing:recurring] expired ${expired.expiredPasses} pass(es), ${expired.expiredCredits} credit(s).`,
        )
      }
    } catch (expErr) {
      console.warn('[billing:recurring] pass expiry sweep failed:', expErr?.message || expErr)
    }
  } catch (err) {
    console.error('[billing:recurring] failed:', err?.message || err)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

main()
