import assert from 'node:assert/strict'
import { goldenCard, BASE_GOLDEN_INTENT } from './canonicalGoldenFixtures.js'

export const SCOPE = { facilityId: '9', userId: '7' }
export const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
export function libraryCard(phaseKey = 'capacity', index = 1) {
  const card = goldenCard(phaseKey, index)
  card.id = uuid(index)
  card.variantId = uuid(index + 100)
  card.deliveryProfiles[0].id = uuid(index + 200)
  return card
}
export function resourceRequest(overrides = {}) {
  return {
    intent: { ...BASE_GOLDEN_INTENT }, requestRevision: 'revision-1', componentKey: 'strength',
    phaseKeys: ['capacity'], ...overrides,
  }
}

function cardRows(cards) {
  return cards.flatMap((card) => card.deliveryProfiles.map((profile) => ({
    definition_id: card.id, variant_id: card.variantId, profile_id: profile.id,
    slug: card.slug, canonical_name: card.canonicalName, display_name: card.displayName,
    family_key: card.familyId, card_version: card.cardVersion, schema_version: card.schemaVersion,
    content_confidence: card.contentConfidence, scoring_confidence: card.scoringConfidence, media_confidence: card.mediaConfidence,
    movement_patterns: card.movementPatterns, body_regions: card.bodyRegions,
    required_equipment: card.equipment.required, optional_equipment: card.equipment.optional,
    environment_json: card.environment, population_json: card.population, approved_by: card.approvedBy,
    approved_video_url: card.media.approvedVideoUrl, difficulty_json: card.difficulty,
    requirements_json: { equipmentQuantityPerStation: card.equipment.quantityPerStation },
    movement_geometry_json: card.movementGeometry, anatomy_profile_json: card.anatomyProfile,
    equipment_roles_json: card.equipmentRoles, task_demands_json: card.taskDemands, stress_profile_json: card.stressProfile,
    scaling_handles_json: card.scalingHandles, composition_profile_json: card.compositionProfile,
    structured_profile_review_status: card.structuredProfileReview.reviewStatus,
    structured_profile_reviewed_by: card.structuredProfileReview.reviewedBy,
    structured_profile_reviewed_at: card.structuredProfileReview.reviewedAt,
    load_profile_json: card.loadProfile, fatigue_profile_json: card.fatigueProfile,
    programming_profile_json: card.programming,
    profile_key: profile.id, phase_key: profile.phaseKey, role: profile.role, purpose: profile.purpose,
    phase_suitability: profile.phaseSuitability, methodology_alignment: profile.methodologyAlignment,
    objective_relevance_json: profile.objectiveRelevance, dosage_json: profile.dosage,
    quality_gate: profile.qualityGate, stop_rules: profile.stopRules, coach_instructions: profile.coachInstructions,
    athlete_instructions: profile.athleteInstructions, expected_adaptation: profile.expectedAdaptation,
    time_model_json: profile.timeModel, dose_scaling_json: profile.doseScaling,
    equipment_required: profile.equipmentRequired, logistics_json: {
      ...profile.logistics,
      scalingByCohort: profile.scalingByCohort, modifierKeys: profile.modifierKeys,
    },
  })))
}

export function libraryPool({ cards = [libraryCard()], releaseIds = cards.map((card) => card.id), noRelease = false,
  methods = [], profiles = [], prescriptions = [], methodStopRules = [], methodValidatorRules = [], methodCompatibilityRows = [], methodQualityStandards = [], programmingRuleReviews = [], failQuery = null, rollbackFailure = null } = {}) {
  const calls = []
  const client = {
    async query(sql, params = []) {
      calls.push({ sql, params })
      if (sql === 'ROLLBACK' && rollbackFailure) throw rollbackFailure
      if (failQuery && sql.includes(failQuery)) throw new Error('database unavailable')
      if (/^(BEGIN|COMMIT|ROLLBACK)/.test(sql)) return { rows: [] }
      if (sql.includes('canonical_programming_rule_reviews')) {
        assert.equal(params[0], '9')
        const requested = JSON.parse(params[1])
        return { rows: programmingRuleReviews.filter((row) => requested.some((entry) => entry.variantId === row.variant_id && entry.cardVersion === row.reviewed_card_version)) }
      }
      if (sql.includes('workout_library_release_v1')) {
        assert.deepEqual(params, ['9'])
        return { rows: noRelease ? [] : [{ id: uuid(900), version: 'fixture-release', rule_version: 'fixture-rules', definition_ids: releaseIds }] }
      }
      if (sql.includes('SELECT\n        d.id AS definition_id')) {
        assert.deepEqual(params, ['9'])
        return { rows: cardRows(cards) }
      }
      if (sql.includes('SELECT pm.*')) {
        assert.deepEqual(params.slice(0, 2), ['9', '7'])
        const [limit, offset] = params.slice(-2)
        return { rows: methods.slice(offset, offset + limit) }
      }
      if (sql.includes('SELECT * FROM coaching.programming_method_phase_profile')) {
        return { rows: profiles.filter((profile) => params[0].includes(String(profile.programming_method_id))) }
      }
      if (sql.includes('SELECT * FROM coaching.programming_method_prescription_profile')) return { rows: prescriptions.filter((row) => params[0].includes(String(row.programming_method_id))) }
      if (sql.includes('SELECT * FROM coaching.programming_method_stop_rule')) return { rows: methodStopRules.filter((row) => params[0].includes(String(row.programming_method_id))) }
      if (sql.includes('SELECT * FROM coaching.programming_method_validator_rule')) return { rows: methodValidatorRules.filter((row) => params[0].includes(String(row.programming_method_id))) }
      if (sql.includes('SELECT * FROM coaching.programming_method_exercise_compatibility')) return { rows: methodCompatibilityRows.filter((row) => params[0].includes(String(row.programming_method_id))) }
      if (sql.includes('SELECT * FROM coaching.programming_method_quality_standard')) return { rows: methodQualityStandards.filter((row) => params[0].includes(String(row.programming_method_id))) }
      return { rows: [] }
    },
    release(error) { calls.push({ sql: 'RELEASE', error }) },
  }
  return { calls, client, async connect() { return client } }
}
