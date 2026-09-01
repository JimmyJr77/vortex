import 'dotenv/config'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'
import { runStripeReconciliation } from './stripeReconciliation.js'
import { getStripeClient } from './stripeBilling.js'
import { repairSavedCardEnrollmentSubscriptions } from './enrollmentSubscriptionRepair.js'
import { billingEnrollmentAutoRepairEnabled } from './billingFeatureFlags.js'
import { assertRequiredBillingSchema } from './billingSchemaReadiness.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })
const connectionString = process.env.DATABASE_URL || process.env.EXTERNAL_DB_URL || process.env.DB_URL
const pool = new pg.Pool({
  connectionString,
  ssl: connectionString && !connectionString.includes('localhost') ? { rejectUnauthorized: false } : undefined,
})

try {
  await assertRequiredBillingSchema(pool)
  let enrollmentAutoPayRepair = null
  try {
    const stripe = await getStripeClient()
    if (stripe && billingEnrollmentAutoRepairEnabled()) {
      enrollmentAutoPayRepair = await repairSavedCardEnrollmentSubscriptions(pool, stripe, {
        apply: true,
      })
    } else if (stripe) {
      enrollmentAutoPayRepair = { skipped: 'feature_disabled' }
    }
  } catch (error) {
    enrollmentAutoPayRepair = {
      failed: true,
      error: error?.message ?? String(error),
    }
    console.error('[stripe:reconcile] enrollment auto-pay repair:', error)
  }
  const result = await runStripeReconciliation(pool, { lookbackHours: Number(process.env.STRIPE_RECONCILIATION_LOOKBACK_HOURS || 48) })
  console.log(JSON.stringify({ ...result, enrollmentAutoPayRepair }))
} catch (error) {
  console.error('[stripe:reconcile] Fatal:', error)
  process.exitCode = 1
} finally {
  await pool.end()
}
