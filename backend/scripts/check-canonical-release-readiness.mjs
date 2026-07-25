#!/usr/bin/env node
import pg from 'pg'

import { buildCanonicalDataQualityReport } from '../platform/canonicalDataQuality.js'
import { assessCanonicalOperationalReadiness } from '../platform/canonicalOperationalReadiness.js'

const connectionString = process.env.DATABASE_URL || process.env.DB_URL || process.env.EXTERNAL_DB_URL
if (!connectionString) {
  console.error('Set DATABASE_URL, DB_URL, or EXTERNAL_DB_URL.')
  process.exit(2)
}
const facilityArg = process.argv.find((value) => value.startsWith('--facility='))
const facilityId = Number(facilityArg?.split('=')[1] || process.env.FACILITY_ID || 1)
const pool = new pg.Pool({
  connectionString,
  ssl: process.env.DATABASE_SSL === 'false' ? false : undefined,
})

try {
  const report = await buildCanonicalDataQualityReport(pool, facilityId)
  const readiness = assessCanonicalOperationalReadiness(report)
  console.log(JSON.stringify({ report, readiness }, null, 2))
  if (readiness.status !== 'ready') process.exitCode = 1
} finally {
  await pool.end()
}
