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
})

test('library audit rejects ambiguous facility scope', async () => {
  await assert.rejects(
    auditCanonicalExerciseLibrary({ query: async () => ({ rows: [] }) }, { facilityId: 0 }),
    /positive integer/,
  )
})
