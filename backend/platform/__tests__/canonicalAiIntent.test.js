import test from 'node:test'
import assert from 'node:assert/strict'

import {
  AiIntentError,
  deterministicFallbackAfterAiFailure,
  validatedAiInterpretationToIntent,
} from '../canonicalAiIntent.js'
import { llmInterpretWorkoutIntent } from '../aiService.js'

const defaults = {
  durationMinutes: 60,
  athleteCount: 12,
  coachCount: 1,
  ageMin: 8,
  ageMax: 10,
  randomSeed: 'ai-1',
  equipmentAvailable: ['bodyweight'],
}

function interpretation(overrides = {}) {
  return {
    originalRequest: 'Build a safe strength workout for our youth group.',
    interpretedObjective: 'strength_priority',
    hardConstraints: { limitations: [], equipmentAvoid: [] },
    softPreferences: { exerciseInclude: [] },
    athleteProfile: { athleteCount: 12, ageMin: 8, ageMax: 10, trainingExperience: 'beginner' },
    facilityProfile: { coachCount: 1, equipmentAvailable: ['bodyweight'] },
    phasePreferences: {},
    uncertainties: [],
    assumptions: ['Training age not supplied; beginner policy used.'],
    confidence: { objective: 95, athleteProfile: 90, constraints: 90 },
    clarificationRequired: false,
    ...overrides,
  }
}

test('AI interpretation becomes canonical intent but cannot bypass deterministic engine', () => {
  const intent = validatedAiInterpretationToIntent(interpretation(), defaults)
  assert.equal(intent.mode, 'ai_assisted')
  assert.equal(intent.objective, 'strength_priority')
  assert.equal(intent.randomSeed, 'ai-1')
  assert.equal(intent.trainingExperience, 'beginner')
  assert.equal(Object.hasOwn(intent, 'skillLevel'), false)
})

test('ambiguous AI request fails closed with clarification', () => {
  assert.throws(
    () => validatedAiInterpretationToIntent(interpretation({
      uncertainties: ['Whether jumping is permitted'],
      clarificationRequired: true,
      clarificationQuestion: 'Should this session avoid jumping?',
    }), defaults),
    (error) => error instanceof AiIntentError && error.code === 'clarification_required',
  )
})

test('AI cannot return exercise IDs or a production workout', () => {
  assert.throws(
    () => validatedAiInterpretationToIntent(interpretation({ exerciseIds: [42] }), defaults),
    (error) => error instanceof AiIntentError && error.code === 'ai_authority_violation',
  )
})

test('conflicting equipment constraints fail canonical normalization', () => {
  assert.throws(
    () => validatedAiInterpretationToIntent(interpretation({
      hardConstraints: { equipmentRequired: ['barbell'], equipmentAvoid: ['barbell'] },
    }), defaults),
    (error) => error instanceof AiIntentError && error.code === 'invalid_canonical_intent',
  )
})

test('AI service failure degrades to a deterministic intent', () => {
  const fallback = deterministicFallbackAfterAiFailure(defaults, { code: 'service_unavailable' })
  assert.equal(fallback.intent.mode, 'deterministic')
  assert.equal(fallback.aiUnavailable, true)
})

test('AI SDK interpretation uses schema-constrained Output.object result', async () => {
  const previousKey = process.env.OPENAI_API_KEY
  process.env.OPENAI_API_KEY = 'test-key'
  let captured
  try {
    const result = await llmInterpretWorkoutIntent({
      request: 'A safe bodyweight strength workout for ages 8-10.',
      defaults,
    }, async (options) => {
      captured = options
      return {
        output: interpretation(),
        usage: { inputTokens: 100, outputTokens: 200 },
      }
    })
    assert.equal(result.interpretation.interpretedObjective, 'strength_priority')
    assert.ok(captured.output)
    assert.match(captured.system, /Never select exercises/)
  } finally {
    if (previousKey == null) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = previousKey
  }
})
