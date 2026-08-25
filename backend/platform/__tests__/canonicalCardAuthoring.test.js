import test from 'node:test'
import assert from 'node:assert/strict'

import {
  approvalAppliesToVersion,
  assertExerciseCardHasNoSkillLevelMetadata,
  assertIndependentReviewer,
  buildCanonicalDuplicateIndex,
  buildCanonicalCardTestPacket,
  assertCardStatusTransition,
  evaluateCanonicalCardReadiness,
  findPotentialCanonicalDuplicates,
  findPotentialCanonicalDuplicatesFromIndex,
  normalizeCanonicalCardDraft,
  normalizeMediaReviewBasis,
  validateCanonicalCardDraft,
  validateCanonicalRelationship,
} from '../canonicalCardAuthoring.js'
import { PRODUCTION_REFERENCE_CARD_DRAFT } from '../canonicalReferenceCard.js'

function publishableCard() {
  const card = structuredClone(PRODUCTION_REFERENCE_CARD_DRAFT)
  card.approvedVideoUrl = 'https://media.example/incline-push-up'
  card.mediaConfidence = 100
  return card
}

function verifiedMediaReview(url) {
  return {
    url,
    linkStatus: 'healthy',
    exactVariantMatch: true,
    demonstrationQualityScore: 90,
    reviewBasis: {
      reviewMethod: 'manual_playback',
      playbackReviewed: true,
      exactVariantCompared: true,
      linkChecked: true,
      accessibilityChecked: true,
    },
  }
}

test('normalization deduplicates controlled lists and canonicalizes slug', () => {
  const normalized = normalizeCanonicalCardDraft({
    ...publishableCard(),
    slug: ' Incline Push Up! ',
    aliases: ['Incline press-up', 'Incline press-up'],
  })
  assert.equal(normalized.slug, 'incline-push-up')
  assert.deepEqual(normalized.aliases, ['Incline press-up'])
})

test('normalization derives overall from exercise complexity and physical difficulty', () => {
  const card = publishableCard()
  card.variants[0].difficulty.technicalComplexity = 42
  card.variants[0].difficulty.absoluteLoadDemand = 67
  card.variants[0].difficulty.baseOverallDifficulty = 99
  const normalized = normalizeCanonicalCardDraft(card)
  assert.equal(normalized.variants[0].difficulty.baseOverallDifficulty, 67)
})

test('normalization clears legacy overall when a core difficulty dimension is missing', () => {
  const card = publishableCard()
  delete card.variants[0].difficulty.absoluteLoadDemand
  card.variants[0].difficulty.baseOverallDifficulty = 72
  const normalized = normalizeCanonicalCardDraft(card)
  assert.equal(normalized.variants[0].difficulty.baseOverallDifficulty, null)
})

test('normalization permits zero impact accumulation for non-impact exercise variants', () => {
  const card = publishableCard()
  card.variants[0].fatigueProfile.impactAccumulation = 0
  const normalized = normalizeCanonicalCardDraft(card)
  assert.equal(normalized.variants[0].fatigueProfile.impactAccumulation, 0)
})

test('normalization permits zero grip demand and fatigue when grip is not part of the task', () => {
  const card = publishableCard()
  card.variants[0].loadProfile.gripDemand = 0
  card.variants[0].fatigueProfile.gripFatigue = 0
  const normalized = normalizeCanonicalCardDraft(card)
  assert.equal(normalized.variants[0].loadProfile.gripDemand, 0)
  assert.equal(normalized.variants[0].fatigueProfile.gripFatigue, 0)
})

test('authoring accepts bounded contact exposure only when the planning range is valid', () => {
  const card = publishableCard()
  delete card.variants[0].loadProfile.landingContactsPerRep
  card.variants[0].loadProfile.contactExposureModel = {
    model: 'per_set_range',
    minimumContactsPerSet: 8,
    planningDefaultContactsPerSet: 12,
    maximumContactsPerSet: 16,
  }
  assert.equal(validateCanonicalCardDraft(card).valid, true)

  card.variants[0].loadProfile.contactExposureModel.maximumContactsPerSet = 10
  const invalid = validateCanonicalCardDraft(card)
  assert.equal(invalid.valid, false)
  assert.ok(invalid.errors.some((error) => error.includes('contactExposureModel')))
})

test('exercise-card authoring rejects skill or proficiency levels at any JSON depth', () => {
  const card = publishableCard()
  card.variants[0].requirements = {
    population: {
      minimumSkillLevel: 'advanced',
      nested: [{
        athleteProficiencyClassification: 'intermediate',
      }],
    },
  }
  assert.throws(
    () => assertExerciseCardHasNoSkillLevelMetadata(card),
    /card\.variants\[0\]\.requirements\.population\.minimumSkillLevel/,
  )
  const validation = validateCanonicalCardDraft(card)
  assert.equal(validation.valid, false)
  assert.equal(validation.normalized, null)
  assert.match(
    validation.errors[0],
    /use exercise complexity and physical difficulty/,
  )
  assert.match(
    validation.errors[0],
    /athleteProficiencyClassification/,
  )
})

test('exercise difficulty dimensions remain valid exercise-card metadata', () => {
  const card = publishableCard()
  card.variants[0].difficulty.technicalComplexity = 58
  card.variants[0].difficulty.absoluteLoadDemand = 64
  assert.equal(assertExerciseCardHasNoSkillLevelMetadata(card), true)
  const normalized = normalizeCanonicalCardDraft(card)
  assert.equal(normalized.variants[0].difficulty.technicalComplexity, 58)
  assert.equal(normalized.variants[0].difficulty.absoluteLoadDemand, 64)
  assert.equal(normalized.variants[0].difficulty.baseOverallDifficulty, 64)
})

test('draft validation protects database-required authoring fields', () => {
  const invalid = validateCanonicalCardDraft({
    slug: '',
    canonicalName: '',
    familyKey: '',
    variants: [{
      variantKey: '',
      displayName: '',
      profiles: [{ profileKey: '', phaseKey: 'not-a-phase', purpose: '' }],
    }],
  })
  assert.equal(invalid.valid, false)
  assert.ok(invalid.errors.some((error) => error.includes('Canonical name')))
  assert.ok(invalid.errors.some((error) => error.includes('canonical phase')))
})

test('duplicate detection catches aliases and close normalized names', () => {
  const candidate = {
    canonicalName: 'Rear-Foot Elevated Split Squat',
    aliases: ['RFESS'],
  }
  const existing = [
    { id: '1', display_name: 'Rear Foot Elevated Split-Squat', family_key: 'split-squat', aliases: [] },
    { id: '2', display_name: 'Goblet Squat', family_key: 'squat', aliases: [] },
    { id: '3', display_name: 'Bulgarian Split Squat', family_key: 'split-squat', aliases: ['RFESS'] },
  ]
  const matches = findPotentialCanonicalDuplicates(candidate, existing)
  assert.deepEqual(matches.map((match) => match.id), ['3', '1'])
  assert.equal(matches[0].exactCollision, true)

  const indexedMatches = findPotentialCanonicalDuplicatesFromIndex(
    candidate,
    buildCanonicalDuplicateIndex(existing),
  )
  assert.deepEqual(indexedMatches, matches)
})

test('publication readiness requires reviewed exact-match healthy media', () => {
  const withoutReview = evaluateCanonicalCardReadiness(publishableCard())
  assert.equal(withoutReview.ready, false)
  assert.ok(withoutReview.issues.some((issue) => issue.code === 'media_review'))

  const ready = evaluateCanonicalCardReadiness(publishableCard(), {
    mediaReview: verifiedMediaReview('https://media.example/incline-push-up'),
  })
  assert.equal(ready.ready, true)
  assert.deepEqual(ready.issues, [])

  const unverifiedBasis = evaluateCanonicalCardReadiness(publishableCard(), {
    mediaReview: { ...verifiedMediaReview('https://media.example/incline-push-up'), reviewBasis: {} },
  })
  assert.equal(unverifiedBasis.ready, false)
  assert.ok(unverifiedBasis.issues.some((issue) => issue.code === 'media_review'))
  assert.throws(() => normalizeMediaReviewBasis({ reviewMethod: 'manual_playback', playbackReviewed: true }), /exactVariantCompared/)
})

test('publication readiness requires physical difficulty on every variant', () => {
  const card = publishableCard()
  delete card.variants[0].difficulty.absoluteLoadDemand
  const result = evaluateCanonicalCardReadiness(card, {
    mediaReview: verifiedMediaReview(card.approvedVideoUrl),
  })
  assert.equal(result.ready, false)
  assert.ok(result.issues.some((issue) => issue.path.endsWith('absoluteLoadDemand')))
})

test('publication readiness reports contextual profile omissions by path', () => {
  const card = publishableCard()
  card.variants[0].profiles[0].athleteInstructions = ''
  card.variants[0].profiles[0].dosage = {}
  const result = evaluateCanonicalCardReadiness(card, {
    mediaReview: verifiedMediaReview(card.approvedVideoUrl),
  })
  assert.equal(result.ready, false)
  assert.ok(result.issues.some((issue) => issue.path.endsWith('athleteInstructions')))
  assert.ok(result.issues.some((issue) => issue.path.endsWith('dosage')))
})

test('publication readiness requires equipment on each exact variant profile', () => {
  const card = publishableCard()
  card.variants[0].profiles[0].equipmentRequired = []
  const result = evaluateCanonicalCardReadiness(card, {
    mediaReview: verifiedMediaReview(card.approvedVideoUrl),
  })
  assert.equal(result.ready, false)
  assert.ok(result.issues.some((issue) => issue.code === 'equipment_declaration'))
})

test('lifecycle prevents direct draft publication and published editing', () => {
  assert.equal(assertCardStatusTransition('draft', 'review'), true)
  assert.equal(assertCardStatusTransition('review', 'published'), true)
  assert.throws(() => assertCardStatusTransition('draft', 'published'), /cannot transition/)
  assert.throws(() => assertCardStatusTransition('published', 'draft'), /cannot transition/)
})

test('two-person control and version-bound approval reject stale or self approval', () => {
  assert.throws(() => assertIndependentReviewer(7, 7), /different card reviewer/)
  assert.equal(assertIndependentReviewer(7, 8), true)
  const review = {
    decision: 'approve',
    reviewer_user_id: 8,
    reviewed_card_version: 3,
  }
  assert.equal(approvalAppliesToVersion(review, 3, 8), true)
  assert.equal(approvalAppliesToVersion(review, 4, 8), false)
  assert.equal(approvalAppliesToVersion(review, 3, 9), false)
})

test('progression relationships require reviewed dimensions and reason', () => {
  const invalid = validateCanonicalRelationship({
    fromVariantId: 'variant-a',
    toVariantId: 'variant-b',
    relationship: 'progression',
    similarityScore: 85,
  })
  assert.equal(invalid.valid, false)
  assert.ok(invalid.errors.some((error) => error.includes('dimension')))
  assert.ok(invalid.errors.some((error) => error.includes('reason')))

  const valid = validateCanonicalRelationship({
    fromVariantId: 'variant-a',
    toVariantId: 'variant-b',
    relationship: 'progression',
    similarityScore: 85,
    dimensions: ['leverage', 'load'],
    reason: 'Lowers the surface and increases the relative load while preserving the pattern.',
  })
  assert.equal(valid.valid, true)
})

test('accepts controlled detailed candidate relationship dimensions without approving the edge', () => {
  const result = validateCanonicalRelationship({
    fromVariantId: 'from-variant',
    toVariantId: 'to-variant',
    relationship: 'regression',
    similarityScore: 70,
    dimensions: ['physical_difficulty', 'terminal_action', 'braking', 'recovery', 'turn_angle'],
    reason: 'Candidate review relationship; human approval is still required.',
  })
  assert.equal(result.valid, true)
})

test('automated card packet reports named P0-P2 checks with evidence', () => {
  const card = publishableCard()
  const mediaReview = verifiedMediaReview(card.approvedVideoUrl)
  const packet = buildCanonicalCardTestPacket(card, {
    mediaReview,
    duplicates: [],
    invalidTaxonomyKeys: [],
    relationships: [],
  })
  assert.equal(packet.status, 'passed')
  assert.equal(packet.checks.length, 17)
  assert.equal(packet.summary.p0Failures, 0)
  assert.ok(packet.checks.some((check) => check.id === 'CARD-TAXONOMY-V2-01' && check.status === 'passed'))
  assert.ok(packet.checks.some((check) => check.id === 'CARD-STRUCTURED-PROFILE-V2-01' && check.status === 'passed'))

  const failed = buildCanonicalCardTestPacket(card, {
    mediaReview,
    duplicates: [{ id: 'duplicate', score: 100, exactCollision: true }],
    invalidTaxonomyKeys: ['movementPatterns:made_up'],
    relationships: [],
  })
  assert.equal(failed.status, 'failed')
  assert.ok(failed.checks.some((check) => check.id === 'CARD-DUPLICATE-01' && check.status === 'failed'))
  assert.ok(failed.checks.every((check) => check.evidence != null))

  const similar = buildCanonicalCardTestPacket(card, {
    mediaReview,
    duplicates: [{ id: 'distinct-variant', score: 96, exactCollision: false }],
    invalidTaxonomyKeys: [],
    relationships: [],
  })
  assert.equal(similar.status, 'warning')
  assert.ok(similar.checks.some((check) => (
    check.id === 'CARD-SIMILAR-IDENTITY-01' && check.status === 'failed' && check.priority === 'P2'
  )))
})
