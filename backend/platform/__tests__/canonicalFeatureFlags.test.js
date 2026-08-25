import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CANONICAL_ROLLOUT_FLAGS,
  assessCanonicalFacilityRollout,
  canonicalEnvironmentEnabled,
  canonicalFacilityFeatureAccess,
} from '../canonicalFeatureFlags.js'

function poolWith(row) {
  return {
    query: async () => ({ rows: row ? [row] : [] }),
  }
}

const coachRollout = {
  facility_id: 7,
  rollout_stage: 'coach',
  canonical_contract_read: true,
  canonical_score_shadow: true,
  canonical_generator_shadow: true,
  canonical_generator_coach_opt_in: true,
  canonical_ai_intent: false,
  canonical_generator_default: false,
  updated_at: '2026-08-16T00:00:00.000Z',
}

const normalizedCoachRollout = {
  facilityId: 7,
  rolloutStage: 'coach',
  canonicalContractRead: true,
  canonicalScoreShadow: true,
  canonicalGeneratorShadow: true,
  canonicalGeneratorCoachOptIn: true,
  canonicalAiIntent: false,
  canonicalGeneratorDefault: false,
  updatedAt: '2026-08-16T00:00:00.000Z',
}

test('canonical rollout flags have the expected controlled keys', () => {
  assert.deepEqual(CANONICAL_ROLLOUT_FLAGS, [
    'canonical_contract_read', 'canonical_score_shadow', 'canonical_generator_shadow',
    'canonical_generator_coach_opt_in', 'canonical_ai_intent', 'canonical_generator_default',
  ])
  assert.equal(canonicalEnvironmentEnabled({ CANONICAL_WORKOUT_GENERATOR_ENABLED: 'yes' }), true)
  assert.equal(canonicalEnvironmentEnabled({ CANONICAL_WORKOUT_GENERATOR_ENABLED: '0' }), false)
})

test('canonical generation is fail-closed until the facility is enrolled', async () => {
  const result = await canonicalFacilityFeatureAccess(
    poolWith(null), 7, 'canonical_generator_coach_opt_in',
    { CANONICAL_WORKOUT_GENERATOR_ENABLED: 'true' },
  )
  assert.deepEqual(result, { enabled: false, reason: 'facility_not_enrolled', rollout: null })
})

test('canonical generation remains fail-closed while the rollout migration is unavailable', async () => {
  const result = await canonicalFacilityFeatureAccess(
    { query: async () => { throw Object.assign(new Error('missing table'), { code: '42P01' }) } },
    7,
    'canonical_generator_coach_opt_in',
    { CANONICAL_WORKOUT_GENERATOR_ENABLED: 'true' },
  )
  assert.deepEqual(result, { enabled: false, reason: 'rollout_schema_unavailable', rollout: null })
})

test('facility rollout permits only the explicit enabled stage flags', async () => {
  const coach = await canonicalFacilityFeatureAccess(
    poolWith(coachRollout), 7, 'canonical_generator_coach_opt_in',
    { CANONICAL_WORKOUT_GENERATOR_ENABLED: 'true' },
  )
  const ai = await canonicalFacilityFeatureAccess(
    poolWith(coachRollout), 7, 'canonical_ai_intent',
    { CANONICAL_WORKOUT_GENERATOR_ENABLED: 'true' },
  )
  assert.equal(coach.enabled, true)
  assert.equal(coach.rollout.rolloutStage, 'coach')
  assert.equal(ai.enabled, false)
  assert.equal(ai.reason, 'facility_flag_disabled')
  assert.equal(ai.rollout.rolloutStage, 'coach')
})

test('the environment kill switch overrides any facility rollout', async () => {
  const result = await canonicalFacilityFeatureAccess(
    poolWith(coachRollout), 7, 'canonical_generator_coach_opt_in',
    { CANONICAL_WORKOUT_GENERATOR_ENABLED: 'false' },
  )
  assert.deepEqual(result, { enabled: false, reason: 'environment_disabled', rollout: null })
})

test('rollout configuration is explicit about enrollment, stage requirements, and coach opt-in', () => {
  assert.equal(assessCanonicalFacilityRollout(null).status, 'not_enrolled')
  assert.equal(assessCanonicalFacilityRollout(null, { requireCoachOptIn: true }).issues[0].code, 'FACILITY_ROLLOUT_NOT_ENROLLED')
  assert.equal(assessCanonicalFacilityRollout({
    ...normalizedCoachRollout,
  }).status, 'valid')
  assert.equal(assessCanonicalFacilityRollout({
    ...normalizedCoachRollout,
    rolloutStage: 'member',
  }).issues[0].code, 'FACILITY_ROLLOUT_STAGE_MISMATCH')
})
