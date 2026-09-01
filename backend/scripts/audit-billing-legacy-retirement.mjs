#!/usr/bin/env node

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import pg from 'pg'
import {
  LEGACY_RETIREMENT_MIN_BILLING_CYCLES,
  LEGACY_RETIREMENT_MIN_OBSERVATION_DAYS,
  auditLegacyBillingRetirementReadiness,
} from '../billing/billingLegacyRetirement.js'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const backendDirectory = path.resolve(scriptDirectory, '..')
dotenv.config({ path: path.join(backendDirectory, '.env.local') })
dotenv.config({ path: path.join(backendDirectory, '.env') })

function option(name) {
  const prefix = `--${name}=`
  return process.argv.find((entry) => entry.startsWith(prefix))?.slice(prefix.length) ?? null
}

function positiveIntegerOption(name, fallback, minimum = 1) {
  const raw = option(name)
  if (raw == null) return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`--${name} must be an integer of at least ${minimum}.`)
  }
  return value
}

function ssl(connectionString) {
  if (process.env.DATABASE_SSL === 'false') return false
  if (process.env.DATABASE_SSL === 'true') return { rejectUnauthorized: false }
  return /render\.com|neon\.tech|supabase\.co|rds\.amazonaws\.com/i.test(String(connectionString ?? ''))
    ? { rejectUnauthorized: false }
    : false
}

async function main() {
  if (process.argv.includes('--apply')) {
    throw new Error('billing:retirement:audit is read-only and does not accept --apply.')
  }
  const connectionString = process.env.EXTERNAL_DB_URL || process.env.DATABASE_URL || process.env.DB_URL
  if (!connectionString) throw new Error('EXTERNAL_DB_URL, DATABASE_URL, or DB_URL is required.')
  const now = option('as-of') ? new Date(option('as-of')) : new Date()
  if (Number.isNaN(now.getTime())) throw new Error('--as-of must be a valid ISO timestamp.')

  const pool = new pg.Pool({ connectionString, ssl: ssl(connectionString) })
  try {
    const report = await auditLegacyBillingRetirementReadiness(pool, {
      now,
      observationDays: positiveIntegerOption(
        'observation-days',
        LEGACY_RETIREMENT_MIN_OBSERVATION_DAYS,
        LEGACY_RETIREMENT_MIN_OBSERVATION_DAYS,
      ),
      requiredBillingCycles: positiveIntegerOption(
        'billing-cycles',
        LEGACY_RETIREMENT_MIN_BILLING_CYCLES,
        LEGACY_RETIREMENT_MIN_BILLING_CYCLES,
      ),
    })
    console.log(JSON.stringify(report, null, 2))
    if (!report.ready) process.exitCode = 1
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error('[billing:retirement:audit]', error?.message ?? error)
  process.exitCode = 1
})
