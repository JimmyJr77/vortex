import test from 'node:test'
import assert from 'node:assert/strict'

import {
  findCanonicalCardDuplicates,
  listCanonicalCards,
} from '../canonicalCardRepository.js'

test('canonical card search includes hidden aliases and display names', async () => {
  const pool = {
    async query(sql, params) {
      assert.deepEqual(params, [9, null, 'push ups'])
      assert.match(sql, /d\.display_name ILIKE/)
      assert.match(sql, /unnest\(d\.aliases\)/)
      assert.match(sql, /alias ILIKE/)
      return { rows: [{ id: 'definition-1', canonical_name: 'Push-Up' }] }
    },
  }

  const cards = await listCanonicalCards(pool, 9, { search: 'push ups' })
  assert.equal(cards[0].canonical_name, 'Push-Up')
})

test('canonical duplicate checks exclude explicitly adjudicated distinct identities', async () => {
  const definitionId = '10000000-0000-4000-8000-000000000001'
  const pool = {
    async query(sql, params) {
      assert.deepEqual(params, [9, definitionId])
      assert.match(sql, /exercise_identity_resolution_v1/)
      return {
        rows: [{
          id: '10000000-0000-4000-8000-000000000002',
          canonical_name: 'Dead Hang',
          display_name: 'Dead Hang',
          aliases: [],
          family_key: 'hang',
          identity_resolution_id: '20000000-0000-4000-8000-000000000001',
          identity_resolution_decision: 'distinct_exercises',
          identity_resolution_source: 'deterministic_identity_equivalence',
        }],
      }
    },
  }

  const duplicates = await findCanonicalCardDuplicates(pool, 9, {
    canonicalName: 'Active Hang',
    displayName: 'Active Hang',
    aliases: ['Dead Hang'],
    familyKey: 'hang',
  }, definitionId)

  assert.deepEqual(duplicates, [])
})

test('canonical duplicate checks retain pairs that still need human review', async () => {
  const definitionId = '10000000-0000-4000-8000-000000000001'
  const pool = {
    async query() {
      return {
        rows: [{
          id: '10000000-0000-4000-8000-000000000002',
          canonical_name: 'Dead Hang',
          display_name: 'Dead Hang',
          aliases: [],
          family_key: 'hang',
          identity_resolution_id: '20000000-0000-4000-8000-000000000001',
          identity_resolution_decision: 'needs_human_review',
          identity_resolution_source: 'deterministic_identity_equivalence',
        }],
      }
    },
  }

  const duplicates = await findCanonicalCardDuplicates(pool, 9, {
    canonicalName: 'Active Hang',
    displayName: 'Active Hang',
    aliases: ['Dead Hang'],
    familyKey: 'hang',
  }, definitionId)

  assert.equal(duplicates.length, 1)
  assert.equal(duplicates[0].exactCollision, true)
  assert.equal(duplicates[0].identityResolution.decision, 'needs_human_review')
})
