import test from 'node:test'
import assert from 'node:assert/strict'

import {
  buildCanonicalCardTestPacket,
  evaluateCanonicalCardReadiness,
  validateCanonicalCardDraft,
} from '../canonicalCardAuthoring.js'
import { PRODUCTION_REFERENCE_CARD_DRAFT } from '../canonicalReferenceCard.js'
import { generateCanonicalWorkout } from '../canonicalDeterministicEngine.js'
import {
  renderCanonicalWorkoutForAthlete,
  renderCanonicalWorkoutForCoach,
} from '../canonicalWorkoutRendering.js'

function reviewedReferenceCard() {
  const card = structuredClone(PRODUCTION_REFERENCE_CARD_DRAFT)
  card.status = 'published'
  card.approvedBy = 'independent-reviewer'
  card.approvedVideoUrl = 'https://media.example.test/incline-push-up/current-card-version'
  card.mediaConfidence = 95
  card.variants[0].status = 'published'
  card.variants[0].profiles[0].status = 'published'
  return card
}

const mediaReview = {
  url: 'https://media.example.test/incline-push-up/current-card-version',
  exactVariantMatch: true,
  demonstrationQualityScore: 95,
  linkStatus: 'healthy',
  reviewedCardVersion: 1,
  reviewBasis: {
    reviewMethod: 'manual_playback',
    playbackReviewed: true,
    exactVariantCompared: true,
    linkChecked: true,
    accessibilityChecked: true,
  },
}

test('reference card covers generation, athlete, coach, and operational support contracts', () => {
  const draft = validateCanonicalCardDraft(PRODUCTION_REFERENCE_CARD_DRAFT)
  assert.equal(draft.valid, true)
  const card = reviewedReferenceCard()
  const readiness = evaluateCanonicalCardReadiness(card, { mediaReview })
  assert.deepEqual(readiness.issues, [])
  assert.equal(readiness.ready, true)
  const packet = buildCanonicalCardTestPacket(card, {
    mediaReview,
    invalidTaxonomyKeys: [],
    duplicates: [],
    relationships: [],
  })
  assert.equal(packet.status, 'passed')
  assert.equal(card.variants[0].programming.sequenceRules.preferredBefore.includes('conditioning'), true)
  assert.equal(card.coachSupport.faultCorrections.length, 4)
  assert.equal(card.athleteSupport.mediaAlternatives.captionsRequired, true)
  assert.equal(card.supportOperations.changeImpactPolicy.safetyChange.includes('invalidate'), true)
})

test('reference card data reaches generator and distinct coach/member projections', () => {
  const reference = reviewedReferenceCard()
  const phaseNames = {
    prepare_and_access: 'Prepare Reference',
    movement_intelligence: 'Movement Reference',
    output: 'Output Reference',
    resilience: 'Resilience Reference',
    sustained_capacity: 'Sustained Reference',
    restore: 'Restore Reference',
  }
  const supportingCards = Object.entries(phaseNames).map(([phaseKey, name]) => {
    const card = structuredClone(reference)
    card.id = `support-${phaseKey}`
    card.variantId = `support-${phaseKey}-variant`
    card.slug = `support-${phaseKey.replaceAll('_', '-')}`
    card.canonicalName = name
    card.displayName = name
    card.familyId = `family-${phaseKey}`
    card.media = { approvedVideoUrl: card.approvedVideoUrl }
    card.equipment = { required: [], quantityPerStation: {} }
    card.equipmentRoles = [{ key: 'none', role: 'required', quantityPerStation: 0, conditions: {} }]
    card.variants[0].profiles[0].phaseKey = phaseKey
    card.deliveryProfiles = card.variants[0].profiles
    card.difficulty = card.variants[0].difficulty
    card.loadProfile = card.variants[0].loadProfile
    card.fatigueProfile = card.variants[0].fatigueProfile
    card.programming = card.variants[0].programming
    card.movementGeometry = card.variants[0].movementGeometry
    card.anatomyProfile = card.variants[0].anatomyProfile
    card.taskDemands = card.variants[0].taskDemands
    card.stressProfile = card.variants[0].stressProfile
    card.scalingHandles = card.variants[0].scalingHandles
    card.compositionProfile = card.variants[0].compositionProfile
    card.structuredProfileReview = card.variants[0].structuredProfileReview
    return card
  })
  reference.variantId = reference.variants[0].id
  reference.familyId = reference.familyKey
  reference.media = { approvedVideoUrl: reference.approvedVideoUrl }
  reference.equipment = { required: ['box'], quantityPerStation: { box: 1 } }
  reference.deliveryProfiles = reference.variants[0].profiles
  reference.difficulty = reference.variants[0].difficulty
  reference.loadProfile = reference.variants[0].loadProfile
  reference.fatigueProfile = reference.variants[0].fatigueProfile
  reference.programming = reference.variants[0].programming
  reference.movementGeometry = reference.variants[0].movementGeometry
  reference.anatomyProfile = reference.variants[0].anatomyProfile
  reference.equipmentRoles = reference.variants[0].equipmentRoles
  reference.taskDemands = reference.variants[0].taskDemands
  reference.stressProfile = reference.variants[0].stressProfile
  reference.scalingHandles = reference.variants[0].scalingHandles
  reference.compositionProfile = reference.variants[0].compositionProfile
  reference.structuredProfileReview = reference.variants[0].structuredProfileReview
  const workout = generateCanonicalWorkout({
    durationMinutes: 60,
    athleteCount: 2,
    coachCount: 1,
    ageMin: 12,
    ageMax: 14,
    equipmentAvailable: ['box'],
    equipmentQuantities: { box: 1 },
    randomSeed: 'reference-card-flow',
    objective: 'strength_priority',
  }, [...supportingCards, reference])
  const coach = renderCanonicalWorkoutForCoach(workout)
  const athlete = renderCanonicalWorkoutForAthlete(workout)
  const coachReference = coach.phases.flatMap((phase) => phase.prescriptions)
    .find((item) => item.exerciseId === reference.id)
  const athleteReference = athlete.exercises.find((item) => item.exerciseName === reference.displayName)
  assert.equal(workout.validation.status, 'passed')
  assert.equal(coachReference.coachSupport.faultCorrections.length, 4)
  assert.equal(coachReference.measurement.primaryMetric, 'clean_repetitions')
  assert.equal(athleteReference.support.primaryCue, 'Move your chest and hips together.')
  assert.equal(athleteReference.qualityGate, 'Every repetition uses the planned range with head, ribs, pelvis, and heels moving together.')
  assert.equal(athleteReference.measurement.primaryMetric, 'clean_repetitions')
  assert.equal(athleteReference.coachSupport, undefined)
  assert.equal(athlete.diagnostics, undefined)
})
