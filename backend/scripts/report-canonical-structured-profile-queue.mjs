#!/usr/bin/env node
import pg from 'pg'

import { listCanonicalStructuredProfileReviewQueue } from '../platform/canonicalCardRepository.js'

function argument(name, fallback = null) {
  const prefix = `--${name}=`
  const item = process.argv.find((value) => value.startsWith(prefix))
  return item ? item.slice(prefix.length) : fallback
}

const connectionString = process.env.DATABASE_URL || process.env.DB_URL || process.env.EXTERNAL_DB_URL
if (!connectionString) {
  console.error('Set DATABASE_URL, DB_URL, or EXTERNAL_DB_URL.')
  process.exit(2)
}

const facilityId = Number(argument('facility', process.env.FACILITY_ID || 1))
const limit = Number(argument('limit', 25))
const offset = Number(argument('offset', 0))
const status = argument('status', 'pending')
const missingField = argument('missing-field')
const sort = argument('sort', 'closest_to_complete')
const json = process.argv.includes('--json')
const pool = new pg.Pool({
  connectionString,
  ssl: process.env.DATABASE_SSL === 'false' ? false : undefined,
})

try {
  const queue = await listCanonicalStructuredProfileReviewQueue(pool, facilityId, {
    limit, offset, status, missingField, sort,
  })
  if (json) {
    console.log(JSON.stringify(queue, null, 2))
  } else {
    console.log(`Canonical structured-profile queue for facility ${facilityId}`)
    console.log(`Pending variants: ${queue.totalPending}`)
    console.log(`Matching variants: ${queue.total}`)
    console.log(`Eligible for independent approval: ${queue.eligibleForApprovalCount}`)
    console.log(`Status: ${queue.status}; sort: ${queue.sort}; missing field: ${queue.missingField ?? 'any'}`)
    console.log('Missing fields:')
    for (const entry of queue.missingFieldCounts) console.log(`  ${entry.field}: ${entry.count}`)
    console.log('Batch:')
    for (const item of queue.items) {
      const missing = item.completeness.issues.map((issue) => issue.field).join(', ') || 'none'
      console.log(`${item.id}\t${item.definitionId}\t${item.variantKey}\t${missing}`)
    }
  }
} finally {
  await pool.end()
}
