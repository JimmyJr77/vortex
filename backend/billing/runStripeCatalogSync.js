#!/usr/bin/env node
/**
 * Backfill Vortex catalog → Stripe Products + Prices.
 * Usage: npm run stripe:sync-catalog
 */

import 'dotenv/config'
import pg from 'pg'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { syncAllCatalog } from './stripeCatalogSync.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

dotenv.config({ path: path.join(__dirname, '.env.local') })
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

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
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'vortex_athletics',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    ssl: resolveSsl(connectionString),
  })
  try {
    console.log('[stripe:sync-catalog] Starting full catalog sync…')
    const result = await syncAllCatalog(pool)
    console.log('[stripe:sync-catalog] Done:', JSON.stringify(result, null, 2))
    if (result.summary?.errors?.length) process.exit(1)
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error('[stripe:sync-catalog] Fatal:', err)
  process.exit(1)
})
