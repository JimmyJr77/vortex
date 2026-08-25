import test from 'node:test'
import assert from 'node:assert/strict'

import {
  loadTaxonomyV2GovernanceReport,
  loadTaxonomyV2ReviewQueue,
  reviewTaxonomyV2Record,
} from '../taxonomyV2Repository.js'

test('taxonomy review queue combines assignments and explicit decisions by confidence', async () => {
  const pool = {
    async query(sql, params) {
      assert.deepEqual(params, [9, 25])
      if (sql.includes('exercise_taxonomy_assignment_v2 a')) {
        return { rows: [{
          id: 11, subject_scope: 'definition', assignment_role: 'primary', weight: 5,
          confidence: 80, review_status: 'suggested', provenance_json: { source: 'migration' },
          created_by: 4, facet_type: 'training_family', term_key: 'calisthenics',
          term_name: 'Calisthenics', canonical_name: 'Push-Up', variant_name: null, profile_key: null,
        }] }
      }
      return { rows: [{
        id: 12, subject_scope: 'delivery_profile', facet_type: 'conditioning_protocol',
        decision: 'not_applicable', rationale: 'Strength profile is not conditioning.',
        confidence: 95, review_status: 'review', provenance_json: {}, created_by: 4,
        canonical_name: 'Push-Up', variant_name: 'Standard', profile_key: 'capacity-strength',
      }] }
    },
  }
  const rows = await loadTaxonomyV2ReviewQueue(pool, 9, { limit: 25 })
  assert.deepEqual(rows.map((row) => row.recordType), ['decision', 'assignment'])
  assert.equal(rows[0].subjectName, 'Push-Up / Standard / capacity-strength')
  assert.equal(rows[1].termKey, 'calisthenics')
})

test('taxonomy governance counts approval only with matching immutable review evidence', async () => {
  let calls = 0
  const pool = {
    async query(sql, params = []) {
      calls += 1
      if (calls === 1) {
        assert.deepEqual(params, [9])
        assert.match(sql, /exercise_taxonomy_review_v2 review_evidence/)
        assert.match(sql, /review_evidence\.record_type='assignment'/)
        assert.match(sql, /review_evidence\.record_type='decision'/)
        assert.match(sql, /length\(btrim\(review_evidence\.notes\)\) >= 20/)
      }
      return { rows: [] }
    },
  }
  const report = await loadTaxonomyV2GovernanceReport(pool, 9)
  assert.equal(report.releaseReady, true)
  assert.equal(calls, 6)
})

test('taxonomy review records an append-only audit before updating review state', async () => {
  const calls = []
  const client = {
    async query(sql, params) {
      calls.push({ sql, params })
      if (sql.includes('FOR UPDATE OF record')) return { rows: [{ id: 11, created_by: 4, review_status: 'suggested' }] }
      if (sql.includes('UPDATE coaching.exercise_taxonomy_assignment_v2')) {
        return { rows: [{ id: 11, review_status: 'approved', reviewed_by: 8 }] }
      }
      return { rows: [] }
    },
    release() {},
  }
  const result = await reviewTaxonomyV2Record({ async connect() { return client } }, 9, 8, 'assignment', 11, {
    outcome: 'approve',
    notes: 'Verified against the exact exercise concept and approved taxonomy definitions.',
  })
  assert.equal(result.review_status, 'approved')
  assert.ok(calls.findIndex((call) => call.sql.includes('exercise_taxonomy_review_v2'))
    < calls.findIndex((call) => call.sql.includes('UPDATE coaching.exercise_taxonomy_assignment_v2')))
  assert.equal(calls.at(-1).sql, 'COMMIT')
})

test('taxonomy review requires observed evidence rather than a placeholder note', async () => {
  await assert.rejects(
    reviewTaxonomyV2Record({ async connect() { assert.fail('validation should precede the transaction') } }, 9, 8, 'assignment', 11, {
      outcome: 'approve', notes: 'looks good',
    }),
    /at least 20 characters of observed evidence/,
  )
})

test('taxonomy author cannot approve their own suggested evidence', async () => {
  const calls = []
  const client = {
    async query(sql) {
      calls.push(sql)
      if (sql.includes('FOR UPDATE OF record')) return { rows: [{ id: 11, created_by: 8 }] }
      return { rows: [] }
    },
    release() {},
  }
  await assert.rejects(
    reviewTaxonomyV2Record({ async connect() { return client } }, 9, 8, 'assignment', 11, {
      outcome: 'approve', notes: 'Attempted self-review with an otherwise substantive reviewer note.',
    }),
    /different taxonomy reviewer/i,
  )
  assert.equal(calls.at(-1), 'ROLLBACK')
})
