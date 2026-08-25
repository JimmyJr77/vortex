#!/usr/bin/env node
import pg from 'pg'

import { buildCanonicalDataQualityReport } from '../platform/canonicalDataQuality.js'
import { assessCanonicalOperationalReadiness } from '../platform/canonicalOperationalReadiness.js'
import { assessCanonicalFacilityRollout, loadCanonicalFacilityRollout } from '../platform/canonicalFeatureFlags.js'

const connectionString = process.env.DATABASE_URL || process.env.DB_URL || process.env.EXTERNAL_DB_URL
const requireCoachOptIn = process.argv.includes('--require-coach-opt-in')

function emitBlockedCheck(code, message, evidence = {}, exitCode = 1) {
  console.log(JSON.stringify({
    report: null,
    readiness: {
      status: 'blocked',
      evaluatedAt: new Date().toISOString(),
      thresholds: null,
      rollout: null,
      failures: [{ code, message, evidence, humanGate: false }],
      humanGates: [],
    },
  }, null, 2))
  process.exitCode = exitCode
}

const facilityArg = process.argv.find((value) => value.startsWith('--facility='))
const facilityId = Number(facilityArg?.split('=')[1] || process.env.FACILITY_ID || 1)

if (!connectionString) {
  emitBlockedCheck(
    'RELEASE_READINESS_DATABASE_URL_MISSING',
    'Set DATABASE_URL, DB_URL, or EXTERNAL_DB_URL before checking release readiness.',
    { requireCoachOptIn },
    2,
  )
} else if (!Number.isInteger(facilityId) || facilityId <= 0) {
  emitBlockedCheck(
    'RELEASE_READINESS_FACILITY_INVALID',
    'A positive integer --facility or FACILITY_ID is required.',
    { facilityId: Number.isFinite(facilityId) ? facilityId : null, requireCoachOptIn },
    2,
  )
} else {
  const pool = new pg.Pool({
    connectionString,
    ssl: process.env.DATABASE_SSL === 'false' ? false : undefined,
  })
  try {
    const report = await buildCanonicalDataQualityReport(pool, facilityId)
    const facilityRollout = await loadCanonicalFacilityRollout(pool, facilityId)
    const rollout = {
      enrollment: facilityRollout,
      ...assessCanonicalFacilityRollout(facilityRollout, { requireCoachOptIn }),
    }
    const readiness = assessCanonicalOperationalReadiness({ ...report, rollout }, { requireCoachOptIn })
    console.log(JSON.stringify({ report: { ...report, rollout }, readiness }, null, 2))
    if (readiness.status !== 'ready') process.exitCode = 1
  } catch (error) {
    const schemaUnavailable = error?.code === '42P01'
    emitBlockedCheck(
      schemaUnavailable ? 'RELEASE_READINESS_SCHEMA_UNAVAILABLE' : 'RELEASE_READINESS_CHECK_FAILED',
      schemaUnavailable
        ? 'Required canonical release schema is unavailable. Apply the registered migrations before retrying.'
        : 'Release readiness could not query the configured database. Inspect secure application and database logs, then retry.',
      { facilityId, requireCoachOptIn, databaseCode: error?.code ?? null },
    )
  } finally {
    await pool.end()
  }
}
