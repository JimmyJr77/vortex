#!/usr/bin/env node
import pg from 'pg'

import { buildCanonicalIdentityQueue } from '../platform/canonicalIdentityQueue.js'

function argument(name, fallback) {
  const prefix = `--${name}=`
  const item = process.argv.find((value) => value.startsWith(prefix))
  return item ? item.slice(prefix.length) : fallback
}

const connectionString = process.env.DATABASE_URL
  || process.env.DB_URL
  || process.env.EXTERNAL_DB_URL
if (!connectionString) {
  console.error('Set DATABASE_URL, DB_URL, or EXTERNAL_DB_URL.')
  process.exit(2)
}

const facilityId = Number(argument('facility', process.env.FACILITY_ID || 1))
const threshold = Number(argument('threshold', 72))
const limit = Number(argument('limit', 50))
const json = process.argv.includes('--json')
const pool = new pg.Pool({
  connectionString,
  ssl: process.env.DATABASE_SSL === 'false' ? false : undefined,
})

try {
  const report = await buildCanonicalIdentityQueue(pool, {
    facilityId,
    threshold,
    limit,
  })
  if (json) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    console.log(`Canonical identity queue for facility ${report.facilityId}`)
    console.log(`Active definitions: ${report.activeDefinitions}`)
    console.log(
      `Unresolved pairs at score ${report.threshold}+: ${report.unresolvedPairCount}`,
    )
    console.log(`Exact collisions: ${report.exactCollisionCount}`)
    for (const pair of report.pairs) {
      console.log(
        `${pair.score}\t${pair.left.slug}\t${pair.right.slug}`
        + `\t${pair.left.displayName} <> ${pair.right.displayName}`,
      )
    }
  }
} finally {
  await pool.end()
}
