#!/usr/bin/env node
import pg from 'pg'

import { loadCanonicalResearchQueue } from '../platform/canonicalResearchReview.js'

const value = (name, fallback) => {
  const prefix = `--${name}=`
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? fallback
}
const connectionString = process.env.DATABASE_URL || process.env.DB_URL || process.env.EXTERNAL_DB_URL
if (!connectionString) {
  console.error('Set DATABASE_URL, DB_URL, or EXTERNAL_DB_URL.')
  process.exit(2)
}
const facilityId = Number(value('facility', process.env.FACILITY_ID || 1))
const limit = Number(value('limit', 100))
const offset = Number(value('offset', 0))
const pool = new pg.Pool({
  connectionString,
  ssl: process.env.DATABASE_SSL === 'false' ? false : undefined,
})

try {
  const queue = await loadCanonicalResearchQueue(pool, facilityId, { limit, offset })
  console.log(JSON.stringify({
    facilityId,
    limit,
    offset,
    count: queue.length,
    cards: queue,
  }, null, 2))
} finally {
  await pool.end()
}

