import test from 'node:test'
import assert from 'node:assert/strict'

import {
  loadCurrentCanonicalLibraryRelease,
  loadPublishedCanonicalLibrary,
  persistCanonicalWorkout,
} from '../canonicalLibraryRepository.js'

test('repository groups published delivery profiles under a stable variant card', async () => {
  const pool = {
    calls: 0,
    async query(sql, params) {
      this.calls += 1
      assert.deepEqual(params, [9])
      if (sql.includes('exercise_relationship_v1')) {
        assert.match(sql, /exercise_relationship_review_v2/)
        return {
          rows: [{
            id: 'edge-1',
            from_variant_id: 'variant-1',
            to_variant_id: 'variant-2',
            relationship: 'regression',
            similarity_score: 92,
            dimensions: ['leverage'],
            reason: 'Reduces relative load through leverage.',
            conditions_json: {},
          }],
        }
      }
      if (sql.includes('SELECT a.subject_scope')) {
        assert.match(sql, /exercise_taxonomy_review_v2/)
        assert.match(sql, /length\(btrim\(review_evidence\.notes\)\) >= 20/)
        return {
          rows: [
            {
              subject_scope: 'definition', subject_id: 'def-1', facet_type: 'training_family',
              term_key: 'calisthenics', assignment_role: 'primary', weight: 5,
              confidence: 95, review_status: 'approved', reviewed_by: 5,
              reviewed_at: '2026-08-01T00:00:00.000Z',
            },
            {
              subject_scope: 'delivery_profile', subject_id: 'profile-1', facet_type: 'tenet',
              term_key: 'strength', assignment_role: 'primary', weight: 5,
              confidence: 95, review_status: 'approved', reviewed_by: 5,
              reviewed_at: '2026-08-01T00:00:00.000Z',
            },
          ],
        }
      }
      assert.match(sql, /d\.status = 'published'/)
      assert.match(sql, /exercise_card_review_v1 card_review/)
      assert.match(sql, /length\(btrim\(card_review\.notes\)\) >= 20/)
      assert.match(sql, /exercise_media_review_v1 media/)
      assert.match(sql, /length\(btrim\(media\.notes\)\) >= 20/)
      assert.match(sql, /review_basis_json @> jsonb_build_object/)
      assert.match(sql, /exercise_structured_profile_review_v2 structured_evidence/)
      assert.match(sql, /exercise_taxonomy_review_v2 taxonomy_evidence/)
      return {
        rows: [
          {
            definition_id: 'def-1',
            variant_id: 'variant-1',
            slug: 'push-up',
            canonical_name: 'Push-Up',
            display_name: 'Push-Up',
            family_key: 'push-up',
            card_version: 1,
            schema_version: '1.0.0',
            content_confidence: 95,
            scoring_confidence: 90,
            media_confidence: 100,
            movement_patterns: ['push'],
            body_regions: ['shoulder'],
            required_equipment: [],
            optional_equipment: [],
            environment_json: { environment: ['indoor'] },
            population_json: { ageMin: 8 },
            approved_video_url: 'https://media.example/push-up',
            approved_by: 4,
            difficulty_json: {
              technicalComplexity: 30,
              absoluteLoadDemand: 40,
              supervisionDemand: 20,
              failureConsequence: 20,
              impact: 10,
              baseOverallDifficulty: 40,
            },
            requirements_json: {},
            profile_id: 'profile-1',
            profile_key: 'capacity-strength',
            phase_key: 'capacity',
            role: 'primary',
            purpose: 'Relative upper-body strength',
            phase_suitability: 95,
            methodology_alignment: 90,
            objective_relevance_json: { strength_priority: 95 },
            dosage_json: { sets: 3, reps: 8, restSeconds: 45 },
            quality_gate: 'Stop before trunk position changes.',
            stop_rules: ['Stop on pain.'],
            equipment_required: [],
            logistics_json: { demonstrationSeconds: 30 },
            substitution_ids: [],
          },
        ],
      }
    },
  }
  const cards = await loadPublishedCanonicalLibrary(pool, 9)
  assert.equal(cards.length, 1)
  assert.equal(cards[0].deliveryProfiles[0].phaseKey, 'capacity')
  assert.equal(cards[0].status, 'published')
  assert.deepEqual(cards[0].deliveryProfiles[0].substitutions, ['variant-2'])
  assert.equal(cards[0].relationships[0].similarityScore, 92)
  assert.equal(cards[0].taxonomyV2.assignments[0].key, 'calisthenics')
  assert.equal(cards[0].deliveryProfiles[0].taxonomyV2.assignments[0].key, 'strength')
})

test('release lookup and immutable workout persistence carry all versions', async () => {
  const calls = []
  const pool = {
    async query(sql, params) {
      calls.push({ sql, params })
      if (sql.includes('workout_library_release_v1')) return { rows: [{ id: 'release-1', version: '2026.07.1' }] }
      return { rows: [{ id: 'generated-1' }] }
    },
  }
  const release = await loadCurrentCanonicalLibraryRelease(pool, 9)
  assert.equal(release.version, '2026.07.1')
  const id = await persistCanonicalWorkout(pool, 9, 4, release, {
    schemaVersion: '1.0.0',
    generatorVersion: 'canonical-deterministic-1',
    ruleVersion: 'rules-1',
    mode: 'deterministic',
    randomSeed: 'seed-1',
    intent: { objective: 'strength_priority' },
    validation: { status: 'passed' },
  })
  assert.equal(id, 'generated-1')
  assert.equal(calls[1].params[1], 'release-1')
  assert.equal(calls[1].params[3], 'canonical-deterministic-1')
})
