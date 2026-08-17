import test from 'node:test'
import assert from 'node:assert/strict'

import { legacyExerciseBundleToCanonical } from '../canonicalLegacyAdapter.js'

test('legacy adapter converts scales, phase aliases, dosage, and provenance without auto-publishing', () => {
  const card = legacyExerciseBundleToCanonical({
    exercise: {
      id: 42,
      slug: 'incline-push-up',
      name: 'Incline Push-Up',
      status: 'published',
      movement_family: 'push-up',
      video_url: 'https://media.example/incline-push-up',
      default_sets: 3,
      default_reps: 8,
      movement_requirements: { impact_level: 0, station_capacity: 4 },
    },
    difficulty: { technical: 2, load: 3, complexity: 2, overall: 3, recommended_age_min: 8 },
    phaseProfiles: [{ phase_key: 'control_resilience', role: 'primary', fit_weight: 8 }],
    dosageProfiles: [{ default_sets: 2, default_reps: 6, default_rest_seconds: 45 }],
    safety: { supervision_level: 'moderate', spotter_required: false },
  })
  assert.equal(card.status, 'review')
  assert.equal(card.difficulty.technicalComplexity, 20)
  assert.equal(card.difficulty.baseOverallDifficulty, 30)
  assert.equal(card.taskDemands.impactToleranceDemand, 1)
  assert.equal(Object.keys(card.difficulty).length, 3)
  assert.equal(card.deliveryProfiles[0].phaseKey, 'resilience')
  assert.equal(card.deliveryProfiles[0].phaseSuitability, 80)
  assert.equal(card.deliveryProfiles[0].dosage.sets, 2)
  assert.equal(card.provenance.humanReviewRequired, true)
})
