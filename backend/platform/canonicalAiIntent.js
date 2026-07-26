import { normalizeWorkoutIntent, score100 } from './canonicalWorkoutContract.js'

export class AiIntentError extends Error {
  constructor(message, code, details = {}) {
    super(message)
    this.name = 'AiIntentError'
    this.code = code
    this.details = details
  }
}

const REQUIRED_INTERPRETATION_FIELDS = [
  'originalRequest',
  'interpretedObjective',
  'hardConstraints',
  'softPreferences',
  'athleteProfile',
  'facilityProfile',
  'uncertainties',
  'assumptions',
  'confidence',
  'clarificationRequired',
]

function object(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AiIntentError(`${field} must be an object`, 'invalid_ai_output', { field })
  }
  return value
}

function strings(value, field) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new AiIntentError(`${field} must be a string array`, 'invalid_ai_output', { field })
  }
  return value
}

/**
 * Validates model output and converts it to the same authority boundary used by
 * deterministic mode. No exercise IDs or production prescriptions are accepted.
 */
export function validatedAiInterpretationToIntent(aiOutput, deterministicDefaults = {}) {
  object(aiOutput, 'aiOutput')
  const missing = REQUIRED_INTERPRETATION_FIELDS.filter((field) => !(field in aiOutput))
  if (missing.length) throw new AiIntentError('AI output is missing required fields', 'invalid_ai_output', { missing })
  if ('exerciseIds' in aiOutput || 'prescriptions' in aiOutput || 'workout' in aiOutput) {
    throw new AiIntentError(
      'AI output may not select exercises or provide a production workout',
      'ai_authority_violation',
    )
  }
  object(aiOutput.hardConstraints, 'hardConstraints')
  object(aiOutput.softPreferences, 'softPreferences')
  object(aiOutput.athleteProfile, 'athleteProfile')
  object(aiOutput.facilityProfile, 'facilityProfile')
  object(aiOutput.confidence, 'confidence')
  strings(aiOutput.uncertainties, 'uncertainties')
  strings(aiOutput.assumptions, 'assumptions')
  for (const [field, value] of Object.entries(aiOutput.confidence)) {
    score100(value, { nullable: false, field: `confidence.${field}` })
  }
  if (typeof aiOutput.clarificationRequired !== 'boolean') {
    throw new AiIntentError('clarificationRequired must be boolean', 'invalid_ai_output')
  }
  if (aiOutput.clarificationRequired) {
    if (!aiOutput.clarificationQuestion || typeof aiOutput.clarificationQuestion !== 'string') {
      throw new AiIntentError('clarification question is required', 'invalid_ai_output')
    }
    throw new AiIntentError(
      aiOutput.clarificationQuestion,
      'clarification_required',
      { uncertainties: aiOutput.uncertainties },
    )
  }

  const hard = aiOutput.hardConstraints
  const athlete = aiOutput.athleteProfile
  const facility = aiOutput.facilityProfile
  const soft = aiOutput.softPreferences
  try {
    return normalizeWorkoutIntent({
      ...deterministicDefaults,
      mode: 'ai_assisted',
      objective: aiOutput.interpretedObjective,
      durationMinutes: hard.durationMinutes ?? deterministicDefaults.durationMinutes,
      athleteCount: athlete.athleteCount ?? deterministicDefaults.athleteCount,
      coachCount: facility.coachCount ?? deterministicDefaults.coachCount,
      ageMin: athlete.ageMin ?? deterministicDefaults.ageMin,
      ageMax: athlete.ageMax ?? deterministicDefaults.ageMax,
      trainingAgeMonths: athlete.trainingAgeMonths ?? deterministicDefaults.trainingAgeMonths,
      trainingExperience: athlete.trainingExperience
        ?? athlete.skillLevel
        ?? deterministicDefaults.trainingExperience
        ?? deterministicDefaults.skillLevel,
      equipmentAvailable: facility.equipmentAvailable ?? deterministicDefaults.equipmentAvailable,
      equipmentQuantities: facility.equipmentQuantities ?? deterministicDefaults.equipmentQuantities,
      equipmentRequired: hard.equipmentRequired,
      equipmentAvoid: hard.equipmentAvoid,
      movementAvoid: hard.movementAvoid,
      bodyRegionAvoid: hard.bodyRegionAvoid,
      exerciseInclude: soft.exerciseInclude,
      exerciseAvoid: hard.exerciseAvoid,
      limitations: hard.limitations,
      space: {
        ...(deterministicDefaults.space ?? {}),
        ...(facility.space ?? {}),
        environment: facility.space?.environment ?? deterministicDefaults.space?.environment,
        floorAreaSquareFeet: facility.space?.floorAreaSquareFeet ?? deterministicDefaults.space?.floorAreaSquareFeet,
        laneLengthFeet: facility.space?.laneLengthFeet ?? deterministicDefaults.space?.laneLengthFeet,
      },
      maxDifficulty: hard.maxDifficulty ?? deterministicDefaults.maxDifficulty,
      maxTechnicalRisk: hard.maxTechnicalRisk ?? deterministicDefaults.maxTechnicalRisk,
      randomSeed: deterministicDefaults.randomSeed,
      assumptions: aiOutput.assumptions,
    })
  } catch (error) {
    throw new AiIntentError(
      `AI interpretation conflicts with canonical constraints: ${error.message}`,
      'invalid_canonical_intent',
      { cause: error.message },
    )
  }
}

export function deterministicFallbackAfterAiFailure(defaults, error) {
  return {
    intent: normalizeWorkoutIntent({ ...defaults, mode: 'deterministic' }),
    aiUnavailable: true,
    warning: `AI interpretation was not used: ${error?.code ?? 'service_unavailable'}`,
  }
}
