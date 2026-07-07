#!/usr/bin/env node
/**
 * One-shot repair for coaching.coach_phase_template on production.
 * Usage (from backend/ with Render DATABASE_URL):
 *   DATABASE_URL='postgresql://...' npm run repair:needs-engine-schema
 */
import pg from 'pg'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { ensureCoachingNeedsEngineSchema, getNeedsEngineSchemaStatus } from '../platform/ensureCoachingNeedsEngineSchema.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env') })
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL is required. Copy it from Render → vortex-backend → Environment.')
  process.exit(1)
}

const ssl = process.env.DATABASE_SSL === 'false'
  ? false
  : { rejectUnauthorized: false }

const pool = new pg.Pool({ connectionString, ssl })

try {
  const before = await getNeedsEngineSchemaStatus(pool)
  console.log('Before:', before)
  await ensureCoachingNeedsEngineSchema(pool)
  const after = await getNeedsEngineSchemaStatus(pool)
  console.log('After:', after)
  if (!after.ready) {
    console.error('Repair did not complete.')
    process.exit(1)
  }
  console.log('Needs Engine schema repair complete.')
} finally {
  await pool.end()
}
