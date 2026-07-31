import 'dotenv/config'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'
import { registerEmailPool } from '../email/emailDeliveryStore.js'
import { emailDailyRoster } from './dailyRoster.js'

const directory = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(directory, '..', '.env.local') })
const connectionString = process.env.DATABASE_URL || process.env.EXTERNAL_DB_URL || process.env.DB_URL
if (!connectionString) throw new Error('DATABASE_URL is required')

const pool = new pg.Pool({
  connectionString,
  ssl: connectionString.includes('localhost') ? undefined : { rejectUnauthorized: false },
})
registerEmailPool(pool)

try {
  const result = await emailDailyRoster(pool)
  console.log(JSON.stringify({
    date: result.roster.date,
    recipient: result.recipient,
    classCount: result.roster.classCount,
    athleteCount: result.roster.athleteCount,
    delivery: result.delivery,
  }))
} catch (error) {
  console.error('[daily-roster] Fatal:', error)
  process.exitCode = 1
} finally {
  await pool.end()
}
