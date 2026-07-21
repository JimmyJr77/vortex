import 'dotenv/config'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'
import { runStripeReconciliation } from './stripeReconciliation.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })
const connectionString = process.env.DATABASE_URL || process.env.EXTERNAL_DB_URL || process.env.DB_URL
const pool = new pg.Pool({
  connectionString,
  ssl: connectionString && !connectionString.includes('localhost') ? { rejectUnauthorized: false } : undefined,
})

try {
  const result = await runStripeReconciliation(pool, { lookbackHours: Number(process.env.STRIPE_RECONCILIATION_LOOKBACK_HOURS || 48) })
  console.log(JSON.stringify(result))
} catch (error) {
  console.error('[stripe:reconcile] Fatal:', error)
  process.exitCode = 1
} finally {
  await pool.end()
}
