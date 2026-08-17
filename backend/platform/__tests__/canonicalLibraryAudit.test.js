import test from 'node:test'
import assert from 'node:assert/strict'

import {
  auditCanonicalExerciseLibrary,
  CANONICAL_CARD_AUDIT_VERSION,
} from '../canonicalLibraryAudit.js'

test('library audit evaluates every migrated legacy card and persists quarantine packets', async () => {
  let persisted
  const pool = {
    async query(sql, params) {
      if (sql.includes('INSERT INTO coaching.exercise_card_test_packet_v1')) {
        persisted = JSON.parse(params[0])
        return { rows: [] }
      }
      if (sql.includes('SELECT * FROM coaching.exercise_definition_v1')) {
        return { rows: [{
          id: '10000000-0000-4000-8000-000000000001',
          facility_id: 7,
          legacy_exercise_id: 101,
          slug: 'sample-hop',
          canonical_name: 'Sample Hop',
          display_name: 'Sample Hop',
          aliases: [],
          family_key: 'jump',
          schema_version: '1.0.0',
          card_version: 1,
          status: 'review',
          content_confidence: 40,
          scoring_confidence: 40,
          media_confidence: 20,
          movement_patterns: [],
          body_regions: [],
          required_equipment: [],
          optional_equipment: [],
          environment_json: {},
          population_json: {},
          anatomy_json: {},
          provenance_json: { source_table: 'coaching.exercise', source_id: 101 },
          approved_video_url: null,
        }] }
      }
      if (sql.includes('FROM coaching.exercise_variant_v1 v')) return { rows: [] }
      if (sql.includes('FROM coaching.exercise_delivery_profile_v1 p')) return { rows: [] }
      if (sql.includes('FROM coaching.exercise_media_review_v1 mr')) return { rows: [] }
      if (sql.includes('FROM coaching.exercise_relationship_v1 r')) return { rows: [] }
      if (sql.includes('FROM coaching.exercise_score_calibration_v1 c')) return { rows: [] }
      if (sql.includes(`SELECT 'movementPatterns' AS kind`)) return { rows: [] }
      if (sql.includes('FROM coaching.exercise_identity_resolution_v1')) return { rows: [] }
      if (sql.includes('FROM coaching.exercise WHERE facility_id=$1')) {
        return { rows: [{ count: 1, mapped_count: 1 }] }
      }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const report = await auditCanonicalExerciseLibrary(pool, { facilityId: 7 })
  assert.equal(report.auditVersion, CANONICAL_CARD_AUDIT_VERSION)
  assert.equal(report.migrationCoverageComplete, true)
  assert.deepEqual(report.totals, {
    legacyExercises: 1,
    canonicalDefinitions: 1,
    migratedLegacyExercises: 1,
    passed: 0,
    quarantined: 1,
    published: 0,
  })
  assert.equal(report.issueCounts['CARD-PUBLISH-01'], 1)
  assert.equal(report.issueCounts['CARD-CALIBRATION-01'], 1)
  assert.equal(persisted.length, 1)
  assert.equal(persisted[0].status, 'quarantined')
  assert.equal(persisted[0].human_review_required, true)
  assert.deepEqual(report.duplicateReview, {
    exactCollisions: 0,
    rawPotentialPairs: 0,
    unresolvedPotentialPairs: 0,
    adjudicatedDistinctPairs: 0,
    consolidatedPairsStillActive: 0,
    needsHumanReviewPairs: 0,
    rawByMinimumScore: {
      72: 0,
      80: 0,
      85: 0,
      90: 0,
      95: 0,
      97: 0,
      100: 0,
    },
    unresolvedByMinimumScore: {
      72: 0,
      80: 0,
      85: 0,
      90: 0,
      95: 0,
      97: 0,
      100: 0,
    },
    unresolvedHighSimilarityPairs: [],
  })
})

test('library audit rejects ambiguous facility scope', async () => {
  await assert.rejects(
    auditCanonicalExerciseLibrary({ query: async () => ({ rows: [] }) }, { facilityId: 0 }),
    /positive integer/,
  )
})

test('library audit quarantines an invalid canonical-contract row and continues reporting', async () => {
  const definitionId = '10000000-0000-4000-8000-000000000010'
  const pool = {
    async query(sql) {
      if (sql.includes('SELECT * FROM coaching.exercise_definition_v1')) {
        return { rows: [{
          id: definitionId,
          facility_id: 7,
          legacy_exercise_id: 110,
          slug: 'malformed-contract',
          canonical_name: 'Malformed Contract',
          display_name: 'Malformed Contract',
          aliases: [],
          family_key: 'test',
          schema_version: '1.0.0',
          card_version: 1,
          status: 'review',
          movement_patterns: [],
          body_regions: [],
          required_equipment: [],
          optional_equipment: [],
          environment_json: {},
          population_json: {},
          anatomy_json: {},
          provenance_json: { source_id: 110 },
          approved_video_url: null,
        }] }
      }
      if (sql.includes('FROM coaching.exercise_variant_v1 v')) {
        return { rows: [{
          id: '10000000-0000-4000-8000-000000000011',
          definition_id: definitionId,
          variant_key: 'invalid-score',
          display_name: 'Invalid score',
          modifier_keys: [],
          difficulty_json: { technicalComplexity: 0 },
          requirements_json: {},
          programming_profile_json: {},
          load_profile_json: {},
          fatigue_profile_json: {},
          movement_geometry_json: {},
          anatomy_profile_json: {},
          equipment_roles_json: [],
          task_demands_json: {},
          stress_profile_json: {},
          scaling_handles_json: [],
          composition_profile_json: {},
          structured_profile_review_status: 'suggested',
          structured_profile_provenance_json: {},
          structured_profile_reviewed_by: null,
          structured_profile_reviewed_at: null,
          status: 'review',
        }] }
      }
      if (sql.includes('FROM coaching.exercise_delivery_profile_v1 p')) return { rows: [] }
      if (sql.includes('FROM coaching.exercise_media_review_v1 mr')) return { rows: [] }
      if (sql.includes('FROM coaching.exercise_relationship_v1 r')) return { rows: [] }
      if (sql.includes('FROM coaching.exercise_score_calibration_v1 c')) return { rows: [] }
      if (sql.includes(`SELECT 'movementPatterns' AS kind`)) return { rows: [] }
      if (sql.includes('FROM coaching.exercise_identity_resolution_v1')) return { rows: [] }
      if (sql.includes('FROM coaching.exercise WHERE facility_id=$1')) {
        return { rows: [{ count: 1, mapped_count: 1 }] }
      }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const report = await auditCanonicalExerciseLibrary(pool, { facilityId: 7, persist: false })
  assert.equal(report.totals.quarantined, 1)
  assert.equal(report.issueCounts['CARD-CANONICAL-CONTRACT-01'], 1)
  const contractCheck = report.packets[0].checks_json.find((check) => (
    check.id === 'CARD-CANONICAL-CONTRACT-01'
  ))
  assert.equal(contractCheck.status, 'failed')
  assert.match(contractCheck.evidence.error, /technicalComplexity/)
})

test('library audit accepts explicit primary-source provenance for a canonical-authored card without a legacy row', async () => {
  const definitionId = '10000000-0000-4000-8000-000000000009'
  const pool = {
    async query(sql) {
      if (sql.includes('SELECT * FROM coaching.exercise_definition_v1')) {
        return { rows: [{
          id: definitionId,
          facility_id: 7,
          legacy_exercise_id: null,
          slug: 'canonical-authored-test',
          canonical_name: 'Canonical Authored Test',
          display_name: 'Canonical Authored Test',
          aliases: [],
          family_key: 'coordination',
          schema_version: '1.0.0',
          card_version: 1,
          status: 'review',
          movement_patterns: [],
          body_regions: [],
          required_equipment: [],
          optional_equipment: [],
          environment_json: {},
          population_json: {},
          anatomy_json: {},
          provenance_json: {
            canonicalAuthoredFromResearch: true,
            primaryIdentitySource: 'https://example.com/primary-source',
          },
          approved_video_url: null,
        }] }
      }
      if (sql.includes('FROM coaching.exercise_variant_v1 v')) return { rows: [] }
      if (sql.includes('FROM coaching.exercise_delivery_profile_v1 p')) return { rows: [] }
      if (sql.includes('FROM coaching.exercise_media_review_v1 mr')) return { rows: [] }
      if (sql.includes('FROM coaching.exercise_relationship_v1 r')) return { rows: [] }
      if (sql.includes('FROM coaching.exercise_score_calibration_v1 c')) return { rows: [] }
      if (sql.includes(`SELECT 'movementPatterns' AS kind`)) return { rows: [] }
      if (sql.includes('FROM coaching.exercise_identity_resolution_v1')) return { rows: [] }
      if (sql.includes('FROM coaching.exercise WHERE facility_id=$1')) {
        return { rows: [{ count: 0, mapped_count: 0 }] }
      }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const report = await auditCanonicalExerciseLibrary(pool, {
    facilityId: 7,
    persist: false,
  })
  const provenanceCheck = report.packets[0].checks_json.find(
    (check) => check.id === 'CARD-MIGRATION-01',
  )
  assert.equal(report.migrationCoverageComplete, true)
  assert.equal(provenanceCheck.status, 'passed')
  assert.deepEqual(provenanceCheck.evidence, {
    legacyExerciseId: null,
    canonicalAuthoredFromResearch: true,
    primaryIdentitySource: 'https://example.com/primary-source',
  })
})

test('library audit separates adjudicated-distinct identities from unresolved name similarity', async () => {
  const activeId = '10000000-0000-4000-8000-000000000001'
  const deadId = '10000000-0000-4000-8000-000000000002'
  const definitions = [
    {
      id: activeId,
      facility_id: 7,
      legacy_exercise_id: 101,
      slug: 'active-hang',
      canonical_name: 'Active Hang',
      display_name: 'Active Hang',
      aliases: ['Dead Hang'],
      family_key: 'hang',
      schema_version: '1.0.0',
      card_version: 1,
      status: 'review',
      movement_patterns: [],
      body_regions: [],
      required_equipment: [],
      optional_equipment: [],
      environment_json: {},
      population_json: {},
      anatomy_json: {},
      provenance_json: { source_id: 101 },
    },
    {
      id: deadId,
      facility_id: 7,
      legacy_exercise_id: 102,
      slug: 'dead-hang',
      canonical_name: 'Dead Hang',
      display_name: 'Dead Hang',
      aliases: [],
      family_key: 'hang',
      schema_version: '1.0.0',
      card_version: 1,
      status: 'review',
      movement_patterns: [],
      body_regions: [],
      required_equipment: [],
      optional_equipment: [],
      environment_json: {},
      population_json: {},
      anatomy_json: {},
      provenance_json: { source_id: 102 },
    },
  ]
  const pool = {
    async query(sql) {
      if (sql.includes('SELECT * FROM coaching.exercise_definition_v1')) {
        return { rows: definitions }
      }
      if (sql.includes('FROM coaching.exercise_variant_v1 v')) return { rows: [] }
      if (sql.includes('FROM coaching.exercise_delivery_profile_v1 p')) return { rows: [] }
      if (sql.includes('FROM coaching.exercise_media_review_v1 mr')) return { rows: [] }
      if (sql.includes('FROM coaching.exercise_relationship_v1 r')) return { rows: [] }
      if (sql.includes('FROM coaching.exercise_score_calibration_v1 c')) return { rows: [] }
      if (sql.includes(`SELECT 'movementPatterns' AS kind`)) return { rows: [] }
      if (sql.includes('FROM coaching.exercise_identity_resolution_v1')) {
        return { rows: [{
          id: '20000000-0000-4000-8000-000000000001',
          survivor_definition_id: activeId,
          resolved_definition_id: deadId,
          decision: 'distinct_exercises',
          resolution_source: 'deterministic_identity_equivalence',
          reviewed_by: null,
          resolved_at: new Date('2026-07-26T00:00:00.000Z'),
        }] }
      }
      if (sql.includes('FROM coaching.exercise WHERE facility_id=$1')) {
        return { rows: [{ count: 2, mapped_count: 2 }] }
      }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const report = await auditCanonicalExerciseLibrary(pool, {
    facilityId: 7,
    persist: false,
  })

  assert.equal(report.duplicateReview.rawPotentialPairs, 1)
  assert.equal(report.duplicateReview.unresolvedPotentialPairs, 0)
  assert.equal(report.duplicateReview.adjudicatedDistinctPairs, 1)
  assert.equal(report.duplicateReview.rawByMinimumScore['100'], 1)
  assert.equal(report.duplicateReview.unresolvedByMinimumScore['72'], 0)
  for (const packet of report.packets) {
    const duplicateCheck = packet.checks_json.find((check) => check.id === 'CARD-DUPLICATE-01')
    const similarCheck = packet.checks_json.find(
      (check) => check.id === 'CARD-SIMILAR-IDENTITY-01',
    )
    assert.equal(duplicateCheck.status, 'passed')
    assert.equal(similarCheck.status, 'passed')
  }
})
