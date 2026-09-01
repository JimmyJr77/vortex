#!/usr/bin/env node
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import dotenv from 'dotenv'
import pg from 'pg'

import { runDeployMigrations } from '../deployMigrations.js'
import {
  buildMigrationPoolConfig,
  resolveMigrationConnectionString,
} from '../migrationConnection.js'

if (process.argv.length > 2) {
  throw new Error('migrate:deploy uses a fixed allowlist and does not accept migration filenames.')
}

const explicitConnectionEnvironment = {
  DATABASE_URL: process.env.DATABASE_URL,
  EXTERNAL_DB_URL: process.env.EXTERNAL_DB_URL,
  DB_URL: process.env.DB_URL,
}
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const backendDirectory = path.join(scriptDirectory, '..')
dotenv.config({ path: path.join(backendDirectory, '.env') })
dotenv.config({ path: path.join(backendDirectory, '.env.local') })

const connectionString = resolveMigrationConnectionString(
  explicitConnectionEnvironment,
  process.env,
)

function resolveSsl(value) {
  if (process.env.DATABASE_SSL === 'false') return false
  if (process.env.DATABASE_SSL === 'true') return { rejectUnauthorized: false }
  if (process.env.NODE_ENV === 'production') return { rejectUnauthorized: false }
  return /render\.com|neon\.tech|supabase\.co|rds\.amazonaws\.com/i.test(String(value))
    ? { rejectUnauthorized: false }
    : false
}

const pool = new pg.Pool(buildMigrationPoolConfig({
  connectionString,
  ssl: resolveSsl(connectionString),
  environment: process.env,
}))

let client
try {
  client = await pool.connect()
  const result = await runDeployMigrations(client)
  console.log(JSON.stringify({
    success: true,
    applied: result.applied,
    skipped: result.skipped,
    billingSchemaReady: result.readiness.ready,
  }))
} catch (error) {
  console.error('[migrate:deploy]', error?.message ?? error)
  process.exitCode = 1
} finally {
  client?.release()
  await pool.end()
}
