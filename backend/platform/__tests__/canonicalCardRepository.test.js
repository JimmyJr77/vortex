import test from 'node:test'
import assert from 'node:assert/strict'

import {
  findCanonicalCardDuplicates,
  reviewCanonicalStructuredProfile,
  listCanonicalCards,
  listCanonicalCardReviewQueue,
  listCanonicalMediaVerificationQueue,
  listCanonicalRelationshipReviewQueue,
  recordCanonicalCardReview,
  listCanonicalStructuredProfileReviewQueue,
  reviewCanonicalRelationship,
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

test('media verification queue exposes only cards that lack current documented human evidence', async () => {
  const pool = {
    async query(sql, params) {
      assert.deepEqual(params, [9])
      assert.match(sql, /LEFT JOIN LATERAL/)
      assert.match(sql, /review_basis_json/)
      return {
        rows: [
          {
            id: 'definition-1', canonical_name: 'Incline Push-Up', display_name: 'Incline Push-Up',
            status: 'published', approved_video_url: 'https://media.example/incline', card_version: 2,
            reviewed_card_version: 1, demonstration_quality_score: 95, link_status: 'healthy',
            exact_variant_match: true,
            review_basis_json: {
              reviewMethod: 'manual_playback', playbackReviewed: true, exactVariantCompared: true,
              linkChecked: true, accessibilityChecked: true,
            },
          },
          {
            id: 'definition-2', canonical_name: 'Dead Bug', display_name: 'Dead Bug',
            status: 'review', approved_video_url: 'https://media.example/dead-bug', card_version: 1,
            reviewed_card_version: 1, demonstration_quality_score: 90, link_status: 'healthy',
            exact_variant_match: true,
            review_basis_json: {
              reviewMethod: 'manual_playback', playbackReviewed: true, exactVariantCompared: true,
              linkChecked: true, accessibilityChecked: true,
            },
          },
        ],
      }
    },
  }
  const queue = await listCanonicalMediaVerificationQueue(pool, 9, { limit: 10 })
  assert.equal(queue.total, 1)
  assert.equal(queue.publishedCount, 1)
  assert.deepEqual(queue.items[0].issues, ['current_card_version'])
})

test('whole-card review queue excludes cards already approved independently at the current version', async () => {
  const pool = {
    async query(sql, params) {
      assert.deepEqual(params, [9])
      assert.match(sql, /d\.status='review'/)
      assert.match(sql, /approved_review\.reviewed_card_version=d\.card_version/)
      assert.match(sql, /reviewer_user_id IS DISTINCT FROM d\.created_by/)
      return {
        rows: [{
          id: 'definition-1', canonical_name: 'Dead Bug', display_name: 'Dead Bug',
          card_version: 3, updated_at: '2026-08-16T10:00:00.000Z', review_count: 1,
          latest_review_decision: 'request_changes', latest_reviewed_at: '2026-08-16T09:00:00.000Z',
        }],
      }
    },
  }
  const queue = await listCanonicalCardReviewQueue(pool, 9, { limit: 25 })
  assert.equal(queue.total, 1)
  assert.deepEqual(queue.items[0], {
    definitionId: 'definition-1', subjectName: 'Dead Bug', canonicalName: 'Dead Bug',
    cardVersion: 3, updatedAt: '2026-08-16T10:00:00.000Z', reviewCount: 1,
    latestDecision: 'request_changes', latestReviewedAt: '2026-08-16T09:00:00.000Z',
  })
})

test('whole-card review requires observed evidence rather than a placeholder note', async () => {
  const pool = { query: async () => assert.fail('validation should happen before loading the card') }
  await assert.rejects(
    () => recordCanonicalCardReview(pool, 9, 'definition-1', 7, {
      decision: 'approve', notes: 'looks good',
    }),
    /at least 20 characters of observed evidence/,
  )
})

test('whole-card approval cannot be recorded before the current card version is publication-ready', async () => {
  let insertAttempted = false
  const pool = {
    async query(sql) {
      if (sql.includes('SELECT * FROM coaching.exercise_definition_v1')) {
        return { rows: [{
          id: 'definition-1', facility_id: 9, slug: 'incomplete-card', canonical_name: 'Incomplete Card',
          display_name: 'Incomplete Card', status: 'review', card_version: 1, created_by: 4,
          aliases: [], movement_patterns: [], body_regions: [], required_equipment: [], optional_equipment: [],
        }] }
      }
      if (sql.includes('INSERT INTO coaching.exercise_card_review_v1')) insertAttempted = true
      return { rows: [] }
    },
  }
  await assert.rejects(
    () => recordCanonicalCardReview(pool, 9, 'definition-1', 7, {
      decision: 'approve', notes: 'The current version was inspected completely before this approval decision.',
    }),
    (error) => error.status === 422 && /publication-ready current card version/.test(error.message),
  )
  assert.equal(insertAttempted, false)
})

test('whole-card review refuses an insert when the reviewed version is no longer current', async () => {
  let reviewInsert = null
  const pool = {
    async query(sql, params) {
      if (sql.includes('SELECT * FROM coaching.exercise_definition_v1')) {
        return { rows: [{
          id: 'definition-1', facility_id: 9, slug: 'incomplete-card', canonical_name: 'Incomplete Card',
          display_name: 'Incomplete Card', status: 'review', card_version: 1, created_by: 4,
          aliases: [], movement_patterns: [], body_regions: [], required_equipment: [], optional_equipment: [],
        }] }
      }
      if (sql.includes('INSERT INTO coaching.exercise_card_review_v1')) {
        reviewInsert = { sql, params }
        return { rows: [] }
      }
      return { rows: [] }
    },
  }
  await assert.rejects(
    () => recordCanonicalCardReview(pool, 9, 'definition-1', 7, {
      decision: 'request_changes', notes: 'The current version needs corrected support and media evidence before it can be approved.',
    }),
    (error) => error.status === 409 && /Reload before recording a review/.test(error.message),
  )
  assert.match(reviewInsert.sql, /d\.card_version=\$7/)
  assert.equal(reviewInsert.params.at(-1), 1)
})

test('relationship review writes immutable independent evidence before changing edge status', async () => {
  const calls = []
  const relationship = {
    id: '10000000-0000-4000-8000-000000000001', created_by: 4,
    from_variant_id: '10000000-0000-4000-8000-000000000002',
    to_variant_id: '10000000-0000-4000-8000-000000000003',
    relationship: 'progression', similarity_score: 80, dimensions: ['complexity'],
    reason: 'The receiving position and timing demand rise while the movement family remains stable.',
    conditions_json: {},
  }
  const client = {
    async query(sql, params) {
      calls.push({ sql, params })
      if (sql.includes('FOR UPDATE OF r')) return { rows: [relationship] }
      if (sql.includes('UPDATE coaching.exercise_relationship_v1')) return { rows: [{ id: relationship.id, review_status: 'approved' }] }
      return { rows: [] }
    },
    release() {},
  }
  const result = await reviewCanonicalRelationship(
    { async connect() { return client } }, 9, relationship.id, 8,
    { decision: 'approved', notes: 'Verified the progression preserves phase intent and changes only the documented task demands.' },
  )
  assert.equal(result.review_status, 'approved')
  assert.ok(calls.findIndex((call) => call.sql.includes('exercise_relationship_review_v2'))
    < calls.findIndex((call) => call.sql.includes('UPDATE coaching.exercise_relationship_v1')))
  assert.equal(calls.at(-1).sql, 'COMMIT')
})

test('relationship review queue returns only pending edges with both exact variants', async () => {
  const pool = {
    async query(sql, params) {
      assert.deepEqual(params, [9])
      assert.match(sql, /r\.review_status='review'/)
      assert.match(sql, /to_definition\.facility_id=\$1/)
      return { rows: [{
        id: 'relationship-1', relationship: 'progression', similarity_score: 82,
        dimensions: ['complexity'], reason: 'More demanding receiving position.', conditions_json: {},
        from_variant_id: 'variant-1', from_variant_name: 'High Hang Clean', from_definition_id: 'definition-1', from_canonical_name: 'Clean',
        to_variant_id: 'variant-2', to_variant_name: 'Hang Power Clean', to_definition_id: 'definition-2', to_canonical_name: 'Clean',
      }] }
    },
  }
  const queue = await listCanonicalRelationshipReviewQueue(pool, 9, { limit: 25 })
  assert.equal(queue.total, 1)
  assert.equal(queue.items[0].from.name, 'High Hang Clean')
  assert.equal(queue.items[0].to.name, 'Hang Power Clean')
})

test('structured profile review writes immutable evidence before approval', async () => {
  const calls = []
  const complete = {
    movement_geometry_json: { planes: ['sagittal'], projections: [], directions: [], supports: ['bilateral'], stances: [], limbRelationships: [] },
    anatomy_profile_json: { assignments: [{ key: 'hip', kind: 'joint', role: 'primary_target' }] },
    equipment_roles_json: [{ key: 'none', role: 'required', quantityPerStation: 0, conditions: {} }],
    task_demands_json: Object.fromEntries([
      'strengthDemand', 'powerDemand', 'mobilityDemand', 'balanceDemand', 'coordinationDemand',
      'conditioningDemand', 'impactToleranceDemand', 'eccentricControlDemand', 'bodyControlDemand',
      'perceptualDemand', 'attentionDemand', 'supervisionDemand', 'failureConsequence',
    ].map((field) => [field, 20])),
    stress_profile_json: {
      jointStress: 20, tissueStress: 20, neuralDemand: 20, impactStress: 20,
      localMuscularFatigue: 20, systemicFatigue: 20, gripFatigue: 1,
      conditioningFatigue: 20, recoveryCost: 20,
      bodyRegionStress: [], jointStressTargets: [], tissueStressTargets: [],
    },
    scaling_handles_json: [{ dimension: 'volume', boundary: 'prescription', easier: 'reduce repetitions', harder: null, limits: {} }],
    composition_profile_json: { preparesFor: [], preferredAfter: [] },
    structured_profile_provenance_json: { sourceType: 'canonical_authoring' },
    structured_profile_created_by: 4,
  }
  const client = {
    async query(sql, params) {
      calls.push({ sql, params })
      if (sql.includes('FOR UPDATE OF v')) return { rows: [complete] }
      if (sql.includes('UPDATE coaching.exercise_variant_v1')) {
        return { rows: [{ id: 'variant-1', structured_profile_review_status: 'approved' }] }
      }
      return { rows: [] }
    },
    release() {},
  }
  const result = await reviewCanonicalStructuredProfile(
    { async connect() { return client } }, 9,
    '10000000-0000-4000-8000-000000000001', 8,
    { outcome: 'approve', notes: 'Verified the exact variant contract and all stress boundaries.' },
  )
  assert.equal(result.structured_profile_review_status, 'approved')
  assert.ok(calls.findIndex((call) => call.sql.includes('exercise_structured_profile_review_v2'))
    < calls.findIndex((call) => call.sql.includes('UPDATE coaching.exercise_variant_v1')))
  assert.equal(calls.at(-1).sql, 'COMMIT')
})

test('structured profile review requires observed evidence rather than a placeholder note', async () => {
  await assert.rejects(
    reviewCanonicalStructuredProfile({ async connect() { assert.fail('validation should precede the transaction') } }, 9, 'variant-1', 8, {
      outcome: 'approve', notes: 'looks good',
    }),
    /at least 20 characters of observed evidence/,
  )
})

test('structured profile queue batches pending variants by missing field without treating suggestions as approval', async () => {
  const taskDemands = Object.fromEntries([
    'strengthDemand', 'powerDemand', 'mobilityDemand', 'balanceDemand', 'coordinationDemand',
    'conditioningDemand', 'impactToleranceDemand', 'eccentricControlDemand', 'bodyControlDemand',
    'perceptualDemand', 'attentionDemand', 'supervisionDemand', 'failureConsequence',
  ].map((field) => [field, 20]))
  const stressProfile = {
    jointStress: 20, tissueStress: 20, neuralDemand: 20, impactStress: 20,
    localMuscularFatigue: 20, systemicFatigue: 20, gripFatigue: 20,
    conditioningFatigue: 20, recoveryCost: 20,
    bodyRegionStress: [], jointStressTargets: [], tissueStressTargets: [],
  }
  const completeRow = (id, canonicalName, scalingHandles) => ({
    id,
    variant_key: 'standard',
    display_name: `${canonicalName} standard`,
    structured_profile_review_status: 'suggested',
    structured_profile_provenance_json: { sourceType: 'backfill', approvalCreated: false },
    structured_profile_created_by: null,
    movement_geometry_json: { planes: ['sagittal'], projections: [], directions: [], supports: ['bilateral'], stances: [], limbRelationships: [] },
    anatomy_profile_json: { assignments: [{ key: 'hip', kind: 'joint', role: 'primary_target' }] },
    equipment_roles_json: [{ key: 'none', role: 'required', quantityPerStation: 0, conditions: {} }],
    task_demands_json: taskDemands,
    stress_profile_json: stressProfile,
    scaling_handles_json: scalingHandles,
    composition_profile_json: { preparesFor: [] },
    definition_id: `definition-${id}`,
    canonical_name: canonicalName,
  })
  const pool = {
    async query(sql, params) {
      assert.match(sql, /structured_profile_review_status/)
      assert.deepEqual(params, [9, 'pending'])
      return {
        rows: [
          completeRow('complete', 'Complete Drill', [{ dimension: 'volume', boundary: 'prescription', easier: 'reduce reps', harder: null, limits: {} }]),
          completeRow('missing-scaling', 'Missing Scaling Drill', []),
        ],
      }
    },
  }

  const queue = await listCanonicalStructuredProfileReviewQueue(pool, 9, {
    missingField: 'scalingHandles', limit: 25,
  })
  assert.equal(queue.totalPending, 2)
  assert.equal(queue.total, 1)
  assert.equal(queue.items[0].id, 'missing-scaling')
  assert.equal(queue.eligibleForApprovalCount, 1)
  assert.deepEqual(queue.missingFieldCounts, [{ field: 'scalingHandles', count: 1 }])
  assert.equal(queue.reviewStatusCounts.suggested, 2)
})
