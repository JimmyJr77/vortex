import test from 'node:test'
import assert from 'node:assert/strict'

import {
  proposeCanonicalCalibration,
  reviewCanonicalCalibration,
} from '../canonicalCalibrationRepository.js'

function transactionalPool(responses) {
  const queries = []
  const client = {
    async query(sql, params = []) {
      queries.push({ sql, params })
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] }
      return responses.shift() ?? { rows: [] }
    },
    release() {},
  }
  return { queries, pool: { async connect() { return client } } }
}

test('calibration proposals validate anchor fields and enter independent review', async () => {
  const fixture = transactionalPool([
    { rows: [{ id: 'variant-1' }] },
    { rows: [{ version: 2 }] },
    { rows: [{ id: 'calibration-1', status: 'review', version: 2 }] },
  ])
  const saved = await proposeCanonicalCalibration(fixture.pool, 7, 11, 'variant-1', {
    dimension: 'technicalComplexity',
    proposedScore: 42,
    anchorTier: 40,
    rationale: 'Comparable to the approved moderate-complexity anchor.',
  })
  assert.equal(saved.status, 'review')
  assert.equal(saved.version, 2)
  await assert.rejects(
    proposeCanonicalCalibration(fixture.pool, 7, 11, 'variant-1', {
      dimension: 'unknown',
      proposedScore: 42,
      anchorTier: 40,
      rationale: 'This rationale is sufficiently long to otherwise pass.',
    }),
    /Unknown calibration dimension/,
  )
})

test('calibration accepts physical difficulty but not independently derived overall difficulty', async () => {
  const fixture = transactionalPool([
    { rows: [{ id: 'variant-1' }] },
    { rows: [{ version: 1 }] },
    { rows: [{ id: 'calibration-1', status: 'review', version: 1 }] },
  ])
  const saved = await proposeCanonicalCalibration(fixture.pool, 7, 11, 'variant-1', {
    dimension: 'absoluteLoadDemand',
    proposedScore: 58,
    anchorTier: 60,
    rationale: 'Observed force demand aligns with the approved physical anchor.',
  })
  assert.equal(saved.status, 'review')

  await assert.rejects(
    proposeCanonicalCalibration(fixture.pool, 7, 11, 'variant-1', {
      dimension: 'baseOverallDifficulty',
      proposedScore: 60,
      anchorTier: 60,
      rationale: 'Overall is derived and must not be independently calibrated.',
    }),
    /Unknown calibration dimension/,
  )
})

test('calibration review enforces two-person control and supersedes prior anchor', async () => {
  const selfReview = transactionalPool([
    { rows: [{ id: 'calibration-1', status: 'review', created_by: 11 }] },
  ])
  await assert.rejects(
    reviewCanonicalCalibration(selfReview.pool, 7, 'calibration-1', 11, {
      decision: 'approved',
      notes: 'The observed comparison evidence agrees with the proposed calibration anchor.',
    }),
    /independent reviewer/,
  )

  const approved = transactionalPool([
    {
      rows: [{
        id: 'calibration-1',
        status: 'review',
        created_by: 11,
        variant_id: 'variant-1',
        dimension: 'impact',
      }],
    },
    { rows: [] },
    { rows: [{ id: 'calibration-1', status: 'approved', reviewed_by: 12 }] },
  ])
  const result = await reviewCanonicalCalibration(approved.pool, 7, 'calibration-1', 12, {
    decision: 'approved',
    notes: 'Observed contacts support this anchor.',
  })
  assert.equal(result.status, 'approved')
  assert.ok(approved.queries.some(({ sql }) => sql.includes("SET status='superseded'")))
})

test('calibration review requires substantive observed evidence', async () => {
  await assert.rejects(
    reviewCanonicalCalibration({ async connect() { assert.fail('validation should precede the transaction') } }, 7, 'calibration-1', 12, {
      decision: 'approved', notes: 'looks good',
    }),
    /20 to 2000 characters/,
  )
})
