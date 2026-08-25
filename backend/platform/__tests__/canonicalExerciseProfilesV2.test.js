import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  normalizeExactVariantProfile,
  normalizeStressProfile,
  structuredProfileCompleteness,
} from '../canonicalExerciseProfilesV2.js'

const MIGRATION = readFileSync(
  new URL('../../migrations/753_coaching_canonical_structured_variant_profiles_v2.sql', import.meta.url),
  'utf8',
)
const PLANE_NORMALIZATION_MIGRATION = readFileSync(
  new URL('../../migrations/754_coaching_structured_profile_plane_normalization.sql', import.meta.url),
  'utf8',
)
const MEDIA_REVIEW_BASIS_MIGRATION = readFileSync(
  new URL('../../migrations/756_coaching_media_review_verification_basis.sql', import.meta.url),
  'utf8',
)
const RELATIONSHIP_REVIEW_EVIDENCE_MIGRATION = readFileSync(
  new URL('../../migrations/757_coaching_relationship_review_evidence.sql', import.meta.url),
  'utf8',
)
const HUMAN_REVIEW_EVIDENCE_MIGRATION = readFileSync(
  new URL('../../migrations/758_coaching_human_review_evidence_minimum.sql', import.meta.url),
  'utf8',
)
const INIT_TABLES = readFileSync(new URL('../initTables.js', import.meta.url), 'utf8')

function completeProfile() {
  return {
    movementGeometry: {
      planes: ['sagittal'], projections: ['horizontal'], directions: ['forward'],
      supports: ['bilateral'], stances: ['square'], limbRelationships: ['symmetrical'],
    },
    anatomyProfile: { assignments: [{ key: 'hip', kind: 'joint', role: 'primary_target' }] },
    equipmentRoles: [{ key: 'none', role: 'required', quantityPerStation: 0, conditions: {} }],
    taskDemands: {
      strengthDemand: 20, powerDemand: 20, mobilityDemand: 20, balanceDemand: 20,
      coordinationDemand: 20, conditioningDemand: 20, impactToleranceDemand: 20,
      eccentricControlDemand: 20, bodyControlDemand: 20, perceptualDemand: 20,
      attentionDemand: 20, supervisionDemand: 20, failureConsequence: 20,
    },
    stressProfile: {
      jointStress: 20, tissueStress: 20, neuralDemand: 20, impactStress: 20,
      localMuscularFatigue: 20, systemicFatigue: 20, gripFatigue: 1,
      conditioningFatigue: 20, recoveryCost: 20,
      bodyRegionStress: ['lower_body'], jointStressTargets: ['hip'], tissueStressTargets: [],
    },
    scalingHandles: [{
      dimension: 'volume', boundary: 'prescription', easier: 'reduce repetitions',
      harder: 'add repetitions within the approved profile cap', limits: {},
    }],
    compositionProfile: {
      preparesFor: [], preferredAfter: [], avoidAfter: [], avoidSameSession: [],
      pairsWith: [], acceptablePairs: [], interferenceRules: [],
    },
    structuredProfileReview: {
      reviewStatus: 'approved', reviewedBy: 8, reviewedAt: '2026-08-16T00:00:00.000Z',
    },
  }
}

test('exact-variant profile normalizes controlled facets and passes completeness', () => {
  const profile = normalizeExactVariantProfile(completeProfile())
  assert.equal(structuredProfileCompleteness(profile).complete, true)
  assert.equal(profile.equipmentRoles[0].quantityPerStation, 0)
})

test('legacy descriptive anatomy planes never masquerade as controlled movement geometry', () => {
  const profile = completeProfile()
  delete profile.movementGeometry.planes
  const fallbacks = {
    anatomy: {
    planes: ['sagittal_primary', 'frontal_and_transverse_control'],
    },
  }
  const normalized = normalizeExactVariantProfile(profile, fallbacks)
  assert.deepEqual(normalized.movementGeometry.planes, [])
  assert.equal(structuredProfileCompleteness(normalized).complete, false)

  profile.movementGeometry.planes = ['sagittal_primary']
  assert.throws(() => normalizeExactVariantProfile(profile, fallbacks), /Unknown movement plane: sagittal_primary/)
})

test('exact-variant stress scores use null rather than zero for irrelevant dimensions', () => {
  const profile = completeProfile()
  profile.stressProfile.gripFatigue = 0
  assert.throws(() => normalizeExactVariantProfile(profile), /1 to 100/)
})

test('a nonnumeric legacy recovery range remains unknown instead of crashing the strict profile audit', () => {
  const profile = normalizeStressProfile({}, {
    fatigueProfile: { recoveryHours: '24_to_96_context_dependent' },
  })
  assert.equal(profile.recoveryCost, null)
})

test('machine composition constraints are controlled, targeted, and unique', () => {
  const profile = completeProfile()
  profile.compositionProfile.constraints = [{
    type: 'avoid_same_session', targetType: 'taxonomy', facetType: 'training_family',
    targetKey: 'olympic_weightlifting',
  }]
  const normalized = normalizeExactVariantProfile(profile)
  assert.deepEqual(normalized.compositionProfile.constraints, profile.compositionProfile.constraints)

  profile.compositionProfile.constraints = [{ type: 'avoid_anywhere', targetType: 'family', targetKey: 'pull' }]
  assert.throws(() => normalizeExactVariantProfile(profile), /Unknown composition constraints\[0\]\.type/)
})

test('exact-variant completeness accepts explicit null for irrelevant dimensions but rejects omitted keys', () => {
  const normalized = normalizeExactVariantProfile(completeProfile())
  normalized.taskDemands.conditioningDemand = null
  normalized.stressProfile.gripFatigue = null
  assert.equal(structuredProfileCompleteness(normalized).complete, true)

  delete normalized.taskDemands.conditioningDemand
  const result = structuredProfileCompleteness(normalized)
  assert.equal(result.complete, false)
  assert.ok(result.issues.some((issue) => issue.field === 'taskDemands.conditioningDemand'))
})

test('unreviewed incomplete backfill remains quarantined', () => {
  const profile = completeProfile()
  profile.scalingHandles = []
  profile.structuredProfileReview = { reviewStatus: 'suggested' }
  const normalized = normalizeExactVariantProfile(profile)
  const result = structuredProfileCompleteness(normalized)
  assert.equal(result.complete, false)
  assert.ok(result.issues.some((issue) => issue.field === 'scalingHandles'))
  assert.ok(result.issues.some((issue) => issue.field === 'structuredProfileReview'))
})

test('structured-profile migration is registered, numeric-only, and creates no approval', () => {
  assert.match(INIT_TABLES, /753_coaching_canonical_structured_variant_profiles_v2\.sql/)
  assert.match(INIT_TABLES, /754_coaching_structured_profile_plane_normalization\.sql/)
  assert.match(MIGRATION, /jsonb_path_query_first/)
  assert.match(MIGRATION, /'key', 'none', 'role', 'required'/)
  assert.match(MIGRATION, /SET structured_profile_review_status = 'suggested'/)
  assert.match(MIGRATION, /'approvalCreated', false/)
  assert.doesNotMatch(MIGRATION, /SET structured_profile_review_status = 'approved'/)
})

test('plane normalization maps only explicit legacy words and preserves the human review gate', () => {
  assert.match(PLANE_NORMALIZATION_MIGRATION, /sagittal/)
  assert.match(PLANE_NORMALIZATION_MIGRATION, /frontal/)
  assert.match(PLANE_NORMALIZATION_MIGRATION, /transverse/)
  assert.match(PLANE_NORMALIZATION_MIGRATION, /deterministic_legacy_backfill/)
  assert.match(PLANE_NORMALIZATION_MIGRATION, /humanReviewRequired', true/)
  assert.doesNotMatch(PLANE_NORMALIZATION_MIGRATION, /'approved'/)
})

test('media review verification basis is registered without certifying legacy review rows', () => {
  assert.match(INIT_TABLES, /756_coaching_media_review_verification_basis\.sql/)
  assert.match(MEDIA_REVIEW_BASIS_MIGRATION, /review_basis_json JSONB NOT NULL DEFAULT '\{\}'::JSONB/)
  assert.doesNotMatch(MEDIA_REVIEW_BASIS_MIGRATION, /UPDATE coaching\.exercise_media_review_v1/)
})

test('relationship review evidence is registered without certifying legacy graph edges', () => {
  assert.match(INIT_TABLES, /757_coaching_relationship_review_evidence\.sql/)
  assert.match(RELATIONSHIP_REVIEW_EVIDENCE_MIGRATION, /CREATE TABLE IF NOT EXISTS coaching\.exercise_relationship_review_v2/)
  assert.doesNotMatch(RELATIONSHIP_REVIEW_EVIDENCE_MIGRATION, /UPDATE coaching\.exercise_relationship_v1/)
})

test('human-review evidence migration applies future-only minimums without certifying legacy rows', () => {
  assert.match(INIT_TABLES, /758_coaching_human_review_evidence_minimum\.sql/)
  assert.match(HUMAN_REVIEW_EVIDENCE_MIGRATION, /NOT VALID/)
  assert.match(HUMAN_REVIEW_EVIDENCE_MIGRATION, /exercise_taxonomy_review_v2_observed_evidence_check/)
  assert.match(HUMAN_REVIEW_EVIDENCE_MIGRATION, /exercise_structured_profile_review_v2_observed_evidence_check/)
  assert.doesNotMatch(HUMAN_REVIEW_EVIDENCE_MIGRATION, /UPDATE coaching\./)
})
