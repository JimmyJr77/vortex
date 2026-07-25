#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import pg from 'pg'

const filenames = process.argv.slice(2)
if (filenames.length === 0) {
  throw new Error('Pass one or more migration filenames')
}

const connectionString = process.env.DATABASE_URL || process.env.DB_URL || process.env.EXTERNAL_DB_URL
if (!connectionString) throw new Error('DATABASE_URL, DB_URL, or EXTERNAL_DB_URL is required')

const remoteTls = /render\.com|neon\.tech|supabase\.co|rds\.amazonaws\.com/i.test(connectionString)
const client = new pg.Client({
  connectionString,
  ssl: process.env.DATABASE_SSL === 'false'
    ? false
    : (process.env.DATABASE_SSL === 'true' || remoteTls ? { rejectUnauthorized: false } : undefined),
})

await client.connect()
try {
  await client.query('BEGIN')
  for (const filename of filenames) {
    const fullPath = path.resolve('migrations', path.basename(filename))
    const sql = await fs.readFile(fullPath, 'utf8')
    await client.query(sql)
    console.log(`Validated ${path.basename(filename)}`)
  }
  await client.query('ROLLBACK')
  console.log('Rolled back validation transaction; production was not changed')
} catch (error) {
  await client.query('ROLLBACK')
  throw error
} finally {
  await client.end()
}
