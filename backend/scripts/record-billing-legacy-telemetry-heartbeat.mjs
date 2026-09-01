#!/usr/bin/env node

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import pg from 'pg'

import { assertRequiredBillingSchema } from '../billing/billingSchemaReadiness.js'
import { recordLegacyBillingTelemetryHeartbeat } from '../billing/billingLegacyRetirement.js'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const backendDirectory = path.resolve(scriptDirectory, '..')
dotenv.config({ path: path.join(backendDirectory, '.env.local') })
dotenv.config({ path: path.join(backendDirectory, '.env') })

function option(name) {
  const prefix = `--${name}=`
  return process.argv.find((entry) => entry.startsWith(prefix))?.slice(prefix.length) ?? null
}

function ssl(connectionString) {
  if (process.env.DATABASE_SSL === 'false') return false
  if (process.env.DATABASE_SSL === 'true') return { rejectUnauthorized: false }
  return /render\.com|neon\.tech|supabase\.co|rds\.amazonaws\.com/i.test(String(connectionString ?? ''))
    ? { rejectUnauthorized: false }
    : false
}

async function main() {
  if (!process.argv.includes('--apply')) {
    throw new Error('The telemetry heartbeat write requires --apply.')
  }
  const connectionString = process.env.EXTERNAL_DB_URL || process.env.DATABASE_URL || process.env.DB_URL
  if (!connectionString) throw new Error('EXTERNAL_DB_URL, DATABASE_URL, or DB_URL is required.')
  const observedAt = option('as-of') ? new Date(option('as-of')) : new Date()
  if (Number.isNaN(observedAt.getTime())) throw new Error('--as-of must be a valid ISO timestamp.')

  const pool = new pg.Pool({ connectionString, ssl: ssl(connectionString) })
  try {
    await assertRequiredBillingSchema(pool)
    const heartbeat = await recordLegacyBillingTelemetryHeartbeat(pool, {
      status: 'healthy',
      observedAt,
      checkerVersion: 'scheduled-canary-v1',
    })
    console.log(JSON.stringify({
      observedOn: heartbeat?.observed_on ?? observedAt.toISOString().slice(0, 10),
      status: heartbeat?.status ?? 'healthy',
    }))
  } catch (error) {
    const errorCode = /^[A-Za-z0-9_.:-]{1,80}$/.test(String(error?.code ?? ''))
      ? String(error.code)
      : 'scheduled_canary_failed'
    await recordLegacyBillingTelemetryHeartbeat(pool, {
      status: 'error',
      observedAt,
      errorCode,
      checkerVersion: 'scheduled-canary-v1',
    }).catch(() => {})
    throw error
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error('[billing:retirement:heartbeat]', error?.message ?? error)
  process.exitCode = 1
})
