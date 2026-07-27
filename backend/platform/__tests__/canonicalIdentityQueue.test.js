import assert from 'node:assert/strict'
import test from 'node:test'

import { buildCanonicalIdentityQueue } from '../canonicalIdentityQueue.js'

function poolWith({ definitions, resolutions = [] }) {
  return {
    async query(sql) {
      if (sql.includes('FROM coaching.exercise_definition_v1')) {
        return { rows: definitions }
      }
      if (sql.includes('FROM coaching.exercise_identity_resolution_v1')) {
        return { rows: resolutions }
      }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }
}

test('identity queue reports each unresolved pair once in descending score order', async () => {
  const report = await buildCanonicalIdentityQueue(poolWith({
    definitions: [
      {
        id: '1',
        slug: 'split-squat-isometric-hold',
        canonical_name: 'Split Squat Isometric Hold',
        display_name: 'Split Squat Isometric Hold',
        aliases: ['Split Squat Iso Hold'],
        family_key: 'split_squat',
      },
      {
        id: '2',
        slug: 'split-squat-iso-hold',
        canonical_name: 'Split Squat Iso Hold',
        display_name: 'Split Squat Iso Hold',
        aliases: [],
        family_key: 'split_squat',
      },
      {
        id: '3',
        slug: 'dumbbell-split-squat-isometric-hold',
        canonical_name: 'Dumbbell Split Squat Isometric Hold',
        display_name: 'Dumbbell Split Squat Isometric Hold',
        aliases: [],
        family_key: 'split_squat',
      },
    ],
  }), {
    facilityId: 1,
    threshold: 72,
    limit: 10,
  })

  assert.equal(report.unresolvedPairCount, 2)
  assert.equal(report.exactCollisionCount, 1)
  assert.equal(report.pairs.length, 2)
  assert.equal(report.pairs[0].score, 100)
  assert.equal(report.pairs[0].pairKey, '1:2')
  assert.equal(new Set(report.pairs.map((pair) => pair.pairKey)).size, 2)
  assert.ok(report.pairs[0].score >= report.pairs[1].score)
})

test('identity queue excludes adjudicated distinct and consolidated pairs', async () => {
  const definitions = [
    {
      id: '1',
      slug: 'dead-hang',
      canonical_name: 'Dead Hang',
      display_name: 'Dead Hang',
      aliases: [],
      family_key: 'hang',
    },
    {
      id: '2',
      slug: 'active-hang',
      canonical_name: 'Active Hang',
      display_name: 'Active Hang',
      aliases: ['Dead Hang'],
      family_key: 'hang',
    },
  ]
  const report = await buildCanonicalIdentityQueue(poolWith({
    definitions,
    resolutions: [{
      id: 'resolution-1',
      survivor_definition_id: '1',
      resolved_definition_id: '2',
      decision: 'distinct_exercises',
      resolution_source: 'migration:test',
      reviewed_by: null,
      resolved_at: null,
    }],
  }), {
    facilityId: 1,
  })

  assert.equal(report.unresolvedPairCount, 0)
  assert.deepEqual(report.pairs, [])
})

test('identity queue validates facility, threshold, and limit', async () => {
  const pool = poolWith({ definitions: [] })
  await assert.rejects(
    buildCanonicalIdentityQueue(pool, { facilityId: 0 }),
    /facilityId must be a positive integer/,
  )
  await assert.rejects(
    buildCanonicalIdentityQueue(pool, { facilityId: 1, threshold: 101 }),
    /threshold must be at most 100/,
  )
  await assert.rejects(
    buildCanonicalIdentityQueue(pool, { facilityId: 1, limit: 0 }),
    /limit must be a positive integer/,
  )
})
