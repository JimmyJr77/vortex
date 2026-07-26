#!/usr/bin/env node
import pg from 'pg'

import { auditCanonicalExerciseLibrary } from '../platform/canonicalLibraryAudit.js'

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
const json = process.argv.includes('--json')
const persist = !process.argv.includes('--no-persist')
const pool = new pg.Pool({
  connectionString,
  ssl: process.env.DATABASE_SSL === 'false' ? false : undefined,
})

try {
  const report = await auditCanonicalExerciseLibrary(pool, { facilityId, persist })
  if (json) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    console.log(`Canonical exercise library audit ${report.auditVersion}`)
    console.log(`Facility: ${report.facilityId}`)
    console.log(`Legacy exercises: ${report.totals.legacyExercises}`)
    console.log(`Canonical definitions: ${report.totals.canonicalDefinitions}`)
    console.log(`Migration coverage complete: ${report.migrationCoverageComplete}`)
    console.log(`Passed: ${report.totals.passed}`)
    console.log(`Quarantined: ${report.totals.quarantined}`)
    console.log(`Published: ${report.totals.published}`)
    console.log('Potential identity pairs:')
    console.log(`  Raw name-similarity pairs: ${report.duplicateReview.rawPotentialPairs}`)
    console.log(`  Unresolved pairs: ${report.duplicateReview.unresolvedPotentialPairs}`)
    console.log(`  Adjudicated distinct pairs: ${report.duplicateReview.adjudicatedDistinctPairs}`)
    console.log(`  Unresolved exact collisions: ${report.duplicateReview.exactCollisions}`)
    console.log(
      `  Unresolved score >=85: ${report.duplicateReview.unresolvedByMinimumScore['85']}`,
    )
    console.log(
      `  Unresolved score >=90: ${report.duplicateReview.unresolvedByMinimumScore['90']}`,
    )
    console.log('Blocking issue counts:')
    for (const [code, count] of Object.entries(report.issueCounts)) {
      console.log(`  ${code}: ${count}`)
    }
  }
  if (!report.migrationCoverageComplete) process.exitCode = 1
} finally {
  await pool.end()
}
