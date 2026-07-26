import test from 'node:test'
import assert from 'node:assert/strict'

import { quarantineAiExerciseCardDraft } from '../canonicalAiCardDraft.js'
import { llmDraftCanonicalExerciseCard } from '../aiService.js'

function aiDraft() {
  return {
    canonicalName: 'Incline Push-Up',
    displayName: 'Incline Push-Up',
    slug: 'incline-push-up',
    description: 'A horizontal press using an elevated stable surface.',
    aliases: ['Incline press-up'],
    familyKey: 'push-up',
    movementPatterns: ['push'],
    bodyRegions: ['shoulder'],
    requiredEquipment: ['box'],
    optionalEquipment: [],
    contentConfidence: 92,
    scoringConfidence: 88,
    variants: [{
      variantKey: 'baseline',
      displayName: 'Incline Push-Up',
      difficulty: {
        technicalComplexity: 20,
        absoluteLoadDemand: 25,
        supervisionDemand: 15,
        failureConsequence: 10,
        impact: 5,
        workCapacityDemand: 35,
      },
      profiles: [{
        profileKey: 'capacity-strength',
        phaseKey: 'capacity',
        purpose: 'Build horizontal pressing strength with adjustable leverage.',
        phaseSuitability: 95,
        methodologyAlignment: 90,
        dosage: { setsMin: 2, setsMax: 4, repsMin: 5, repsMax: 10, workSeconds: null, restSeconds: 60 },
        qualityGate: 'Maintain a straight trunk through every repetition.',
        stopRules: ['Stop on pain.', 'Stop when trunk position changes.'],
        coachInstructions: 'Select a stable height that preserves clean repetitions.',
        athleteInstructions: 'Stay long and touch the target softly.',
        expectedAdaptation: 'Improved pressing strength and trunk control.',
      }],
    }],
    assumptions: ['A stable elevated surface is available.'],
    uncertainties: ['Exact surface height requires coach selection.'],
  }
}

test('AI exercise draft is quarantined, confidence-capped, and never publication-ready', () => {
  const result = quarantineAiExerciseCardDraft(aiDraft(), { modelVersion: 'model-test' })
  assert.equal(result.draft.status, 'draft')
  assert.equal(result.draft.contentConfidence, 60)
  assert.equal(result.draft.scoringConfidence, 60)
  assert.equal(result.draft.variants[0].difficulty.baseOverallDifficulty, 25)
  assert.equal(result.draft.mediaConfidence, null)
  assert.equal(result.draft.approvedVideoUrl, null)
  assert.equal(result.draft.provenance.humanReviewRequired, true)
  assert.equal(result.readiness.ready, false)
})

test('AI exercise draft rejects production authority fields', () => {
  assert.throws(
    () => quarantineAiExerciseCardDraft({ ...aiDraft(), status: 'published' }),
    /prohibited production fields/,
  )
})

test('AI SDK card drafting uses schema-constrained output without production authority', async () => {
  const previousKey = process.env.OPENAI_API_KEY
  process.env.OPENAI_API_KEY = 'test-key'
  let captured
  try {
    const result = await llmDraftCanonicalExerciseCard({
      notes: 'Create an incline push-up draft for youth strength sessions.',
      taxonomy: {
        movementPatterns: ['push'],
        bodyRegions: ['shoulder'],
        equipment: ['box'],
      },
    }, async (options) => {
      captured = options
      return { output: aiDraft(), usage: { inputTokens: 50, outputTokens: 100 } }
    })
    assert.equal(result.draft.slug, 'incline-push-up')
    assert.ok(captured.output)
    assert.match(captured.system, /Never claim approval/)
    assert.doesNotMatch(captured.prompt, /approvedVideoUrl/)
  } finally {
    if (previousKey == null) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = previousKey
  }
})
