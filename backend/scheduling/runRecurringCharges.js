import { prepareUpcomingBilling } from '../billing/upcomingBillingPreparation.js'
/**
 * CLI entrypoint for the monthly recurring-charge generator.
 * Schedule via cron, e.g. daily:  0 6 * * *  cd backend && npm run billing:recurring
 * Safe to run more often than monthly — posting is idempotent per subscription/period.
 */

import 'dotenv/config'
import pg from 'pg'
import { generateRecurringCharges } from './generateRecurringCharges.js'
import { reviewBillingTurnover, recordBillingTurnoverReview } from '../billing/billingTurnoverReview.js'
import { expirePassCredits } from '../programs/multiClassPass.js'
import { assertRequiredBillingSchema } from '../billing/billingSchemaReadiness.js'

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
  const collectPayments = process.argv.includes('--collect')
  const postOnly = process.argv.includes('--post-only')
  const reviewOnly = process.argv.includes('--review-only') || (!collectPayments && !postOnly)
  if (process.argv.includes('--review-only') && (collectPayments || postOnly)) throw new Error('Review mode cannot post or collect.')
  const pool = new Pool({
    connectionString,
    ...(reviewOnly ? { options: '-c default_transaction_read_only=on' } : {}),
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'vortex_athletics',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
    ssl: resolveSsl(connectionString),
  })

  try {
    await assertRequiredBillingSchema(pool)
    if (reviewOnly) {
      const review = await reviewBillingTurnover(pool)
      console.log(JSON.stringify(review, null, 2))
      if (review.issueAccountCount) process.exitCode = 1
      return
    }
    const preparation = await prepareUpcomingBilling(pool)
    if (preparation.some((row) => row.status === 'blocked')) process.exitCode = 1
    const result = await generateRecurringCharges(pool, { collectPayments })
    const review = await reviewBillingTurnover(pool)
    await recordBillingTurnoverReview(pool, review)
    if (review.issueAccountCount) process.exitCode = 1
    console.log(
      `[billing:recurring] processed ${result.subscriptionsProcessed} subscription(s), ` +
        `posted ${result.chargesPosted} charge(s) across ${result.periodsAdvanced} period(s), ` +
        `and created ${result.householdInvoicesCreated ?? 0} household invoice(s).`,
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
    if (Number(result.accountsBlocked) > 0) {
      console.error(
        `[billing:recurring] ${result.accountsBlocked} account(s) were quarantined: ` +
          `${(result.blockedAccounts ?? [])
            .map((entry) => `${entry.accountId} (${entry.code})`)
            .join(', ') || (result.blockedAccountIds ?? []).join(', ') || 'unknown'}.`,
      )
      process.exitCode = 1
    }
  } catch (err) {
    console.error('[billing:recurring] failed:', err?.message || err)
    process.exitCode = 1
  } finally {
    await pool.end()
  }
}

main()
