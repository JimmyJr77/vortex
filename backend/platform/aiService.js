/**
 * LLM integration via Vercel AI SDK.
 * Falls back to null when no API key — callers use rule-based text.
 */
import { generateText, jsonSchema, Output } from 'ai'
import { openai } from '@ai-sdk/openai'

export function isLlmConfigured() {
  return Boolean(process.env.OPENAI_API_KEY || process.env.AI_GATEWAY_API_KEY)
}

function resolveModel() {
  const modelId = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  return openai(modelId)
}

/**
 * @param {{ system?: string; prompt: string; maxTokens?: number }} opts
 * @returns {Promise<string | null>}
 */
export async function llmGenerateText({ system, prompt, maxTokens = 600 }) {
  if (!isLlmConfigured()) return null
  try {
    const { text } = await generateText({
      model: resolveModel(),
      system,
      prompt,
      maxOutputTokens: maxTokens,
    })
    return text?.trim() || null
  } catch (err) {
    console.warn('[ai] generateText failed:', err instanceof Error ? err.message : err)
    return null
  }
}

/**
 * Parent-friendly progress narrative grounded in athlete metrics.
 */
export async function llmProgressNarrative({
  athleteName,
  tenetCoverage,
  assessmentTrends,
}) {
  const context = JSON.stringify({ tenetCoverage, assessmentTrends }, null, 2)
  return llmGenerateText({
    system:
      'You write warm, parent-friendly progress summaries for a youth athletics facility. ' +
      'Use plain language, 3-5 short sentences, no bullet lists. Be encouraging and specific when data is provided. ' +
      'Do not invent metrics not present in the JSON context.',
    prompt: `Athlete name: ${athleteName}\n\nTraining context JSON:\n${context}\n\nWrite the progress summary.`,
    maxTokens: 400,
  })
}

/**
 * Coach assistant grounded in RAG chunks + optional chat history.
 */
export async function llmCoachAssistant({ athleteName, question, contextChunks, history }) {
  const contextBlock = contextChunks.length
    ? contextChunks.map((c, i) => `[${i + 1}] (${c.source_type}) ${c.content}`).join('\n')
    : 'No retrieved context — answer from general coaching principles only and say when data is missing.'
  const historyBlock = (history ?? [])
    .slice(-6)
    .map((m) => `${m.role === 'user' ? 'Coach' : 'Assistant'}: ${m.content}`)
    .join('\n')
  return llmGenerateText({
    system:
      'You are an expert youth athletics coach assistant inside a gym management portal. ' +
      'Ground answers in the retrieved athlete context when present. Be concise (2-5 sentences unless asked for detail). ' +
      'Never invent metrics, injuries, or results not in context. Suggest safe, age-appropriate training ideas.',
    prompt: `Athlete: ${athleteName}\n\nRetrieved context:\n${contextBlock}\n\nRecent chat:\n${historyBlock || '(none)'}\n\nCoach question: ${question}`,
    maxTokens: 500,
  })
}

const WORKOUT_INTENT_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'originalRequest', 'interpretedObjective', 'hardConstraints',
    'softPreferences', 'athleteProfile', 'facilityProfile',
    'uncertainties', 'assumptions', 'confidence',
    'clarificationRequired', 'clarificationQuestion',
  ],
  properties: {
    originalRequest: { type: 'string' },
    interpretedObjective: {
      type: 'string',
      enum: [
        'general_athletic_development', 'speed_priority',
        'explosiveness_power_priority', 'strength_priority', 'agility_priority',
        'mobility_control_priority',
        'fitness_priority', 'recovery_low_intensity',
      ],
    },
    hardConstraints: {
      type: 'object',
      additionalProperties: false,
      required: [
        'durationMinutes', 'equipmentRequired', 'equipmentAvoid', 'movementAvoid',
        'bodyRegionAvoid', 'exerciseAvoid', 'limitations', 'maxDifficulty',
        'maxTechnicalRisk',
      ],
      properties: {
        durationMinutes: { type: ['integer', 'null'], minimum: 15, maximum: 240 },
        equipmentRequired: { type: 'array', items: { type: 'string' } },
        equipmentAvoid: { type: 'array', items: { type: 'string' } },
        movementAvoid: { type: 'array', items: { type: 'string' } },
        bodyRegionAvoid: { type: 'array', items: { type: 'string' } },
        exerciseAvoid: { type: 'array', items: { type: 'string' } },
        limitations: { type: 'array', items: { type: 'string' } },
        maxDifficulty: { type: ['integer', 'null'], minimum: 1, maximum: 100 },
        maxTechnicalRisk: { type: ['integer', 'null'], minimum: 1, maximum: 100 },
      },
    },
    softPreferences: {
      type: 'object',
      additionalProperties: false,
      required: ['exerciseInclude'],
      properties: {
        exerciseInclude: { type: 'array', items: { type: 'string' } },
      },
    },
    athleteProfile: {
      type: 'object',
      additionalProperties: false,
      required: ['athleteCount', 'ageMin', 'ageMax', 'trainingAgeMonths', 'skillLevel'],
      properties: {
        athleteCount: { type: ['integer', 'null'], minimum: 1, maximum: 100 },
        ageMin: { type: ['integer', 'null'], minimum: 5, maximum: 99 },
        ageMax: { type: ['integer', 'null'], minimum: 5, maximum: 99 },
        trainingAgeMonths: { type: ['integer', 'null'], minimum: 0, maximum: 1200 },
        skillLevel: { type: ['string', 'null'] },
      },
    },
    facilityProfile: {
      type: 'object',
      additionalProperties: false,
      required: ['coachCount', 'equipmentAvailable', 'equipmentQuantities', 'space'],
      properties: {
        coachCount: { type: ['integer', 'null'], minimum: 1, maximum: 20 },
        equipmentAvailable: { type: 'array', items: { type: 'string' } },
        equipmentQuantities: {
          type: 'object',
          additionalProperties: { type: 'integer', minimum: 0, maximum: 1000 },
        },
        space: {
          type: 'object',
          additionalProperties: false,
          required: ['environment', 'floorAreaSquareFeet', 'laneLengthFeet'],
          properties: {
            environment: { type: ['string', 'null'] },
            floorAreaSquareFeet: { type: ['integer', 'null'], minimum: 1 },
            laneLengthFeet: { type: ['integer', 'null'], minimum: 1 },
          },
        },
      },
    },
    uncertainties: { type: 'array', items: { type: 'string' } },
    assumptions: { type: 'array', items: { type: 'string' } },
    confidence: {
      type: 'object',
      additionalProperties: false,
      required: ['objective', 'constraints', 'athleteProfile', 'facilityProfile'],
      properties: {
        objective: { type: 'integer', minimum: 1, maximum: 100 },
        constraints: { type: 'integer', minimum: 1, maximum: 100 },
        athleteProfile: { type: 'integer', minimum: 1, maximum: 100 },
        facilityProfile: { type: 'integer', minimum: 1, maximum: 100 },
      },
    },
    clarificationRequired: { type: 'boolean' },
    clarificationQuestion: { type: ['string', 'null'] },
  },
}

function exerciseCardDraftSchema(taxonomy) {
  const score = { type: 'integer', minimum: 1, maximum: 100 }
  return {
    type: 'object',
    additionalProperties: false,
    required: [
      'canonicalName', 'displayName', 'slug', 'description', 'aliases', 'familyKey',
      'movementPatterns', 'bodyRegions', 'requiredEquipment', 'optionalEquipment',
      'contentConfidence', 'scoringConfidence', 'variants', 'assumptions', 'uncertainties',
    ],
    properties: {
      canonicalName: { type: 'string', minLength: 2, maxLength: 120 },
      displayName: { type: 'string', minLength: 2, maxLength: 120 },
      slug: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$', maxLength: 100 },
      description: { type: 'string', minLength: 10, maxLength: 1000 },
      aliases: { type: 'array', maxItems: 12, items: { type: 'string', minLength: 1, maxLength: 100 } },
      familyKey: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$', maxLength: 100 },
      movementPatterns: {
        type: 'array', minItems: 1, uniqueItems: true,
        items: { type: 'string', enum: taxonomy.movementPatterns },
      },
      bodyRegions: {
        type: 'array', minItems: 1, uniqueItems: true,
        items: { type: 'string', enum: taxonomy.bodyRegions },
      },
      requiredEquipment: {
        type: 'array', uniqueItems: true,
        items: { type: 'string', enum: taxonomy.equipment },
      },
      optionalEquipment: {
        type: 'array', uniqueItems: true,
        items: { type: 'string', enum: taxonomy.equipment },
      },
      contentConfidence: score,
      scoringConfidence: score,
      variants: {
        type: 'array',
        minItems: 1,
        maxItems: 4,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['variantKey', 'displayName', 'difficulty', 'profiles'],
          properties: {
            variantKey: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
            displayName: { type: 'string', minLength: 2, maxLength: 120 },
            difficulty: {
              type: 'object',
              additionalProperties: false,
              required: [
                'technicalComplexity', 'supervisionDemand', 'failureConsequence',
                'impact', 'workCapacityDemand', 'baseOverallDifficulty',
              ],
              properties: {
                technicalComplexity: score,
                supervisionDemand: score,
                failureConsequence: score,
                impact: score,
                workCapacityDemand: score,
                baseOverallDifficulty: score,
              },
            },
            profiles: {
              type: 'array',
              minItems: 1,
              maxItems: 5,
              items: {
                type: 'object',
                additionalProperties: false,
                required: [
                  'profileKey', 'phaseKey', 'purpose', 'phaseSuitability',
                  'methodologyAlignment', 'dosage', 'qualityGate', 'stopRules',
                  'coachInstructions', 'athleteInstructions', 'expectedAdaptation',
                ],
                properties: {
                  profileKey: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
                  phaseKey: {
                    type: 'string',
                    enum: [
                      'prepare_and_access', 'movement_intelligence', 'output', 'capacity',
                      'resilience', 'sustained_capacity', 'restore',
                    ],
                  },
                  purpose: { type: 'string', minLength: 10, maxLength: 500 },
                  phaseSuitability: score,
                  methodologyAlignment: score,
                  dosage: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['setsMin', 'setsMax', 'repsMin', 'repsMax', 'workSeconds', 'restSeconds'],
                    properties: {
                      setsMin: { type: 'integer', minimum: 1, maximum: 10 },
                      setsMax: { type: 'integer', minimum: 1, maximum: 10 },
                      repsMin: { type: ['integer', 'null'], minimum: 1, maximum: 100 },
                      repsMax: { type: ['integer', 'null'], minimum: 1, maximum: 100 },
                      workSeconds: { type: ['integer', 'null'], minimum: 5, maximum: 600 },
                      restSeconds: { type: 'integer', minimum: 0, maximum: 600 },
                    },
                  },
                  qualityGate: { type: 'string', minLength: 10, maxLength: 500 },
                  stopRules: { type: 'array', minItems: 1, maxItems: 8, items: { type: 'string', minLength: 5, maxLength: 240 } },
                  coachInstructions: { type: 'string', minLength: 10, maxLength: 800 },
                  athleteInstructions: { type: 'string', minLength: 10, maxLength: 240 },
                  expectedAdaptation: { type: 'string', minLength: 10, maxLength: 500 },
                },
              },
            },
          },
        },
      },
      assumptions: { type: 'array', maxItems: 20, items: { type: 'string', maxLength: 300 } },
      uncertainties: { type: 'array', maxItems: 20, items: { type: 'string', maxLength: 300 } },
    },
  }
}

/**
 * Schema-constrained workout intent interpretation. The model has no exercise
 * library and cannot output exercise IDs or prescriptions.
 */
export async function llmInterpretWorkoutIntent({ request, defaults }, generate = generateText) {
  if (!isLlmConfigured()) return null
  const startedAt = Date.now()
  const result = await generate({
    model: resolveModel(),
    output: Output.object({
      name: 'vortex_workout_intent',
      description: 'A structured interpretation of coach intent; never a workout or exercise selection.',
      schema: jsonSchema(WORKOUT_INTENT_OUTPUT_SCHEMA),
    }),
    system:
      'You interpret a youth athletics coach request into structured intent only. ' +
      'Never select exercises, invent equipment, infer injuries, diagnose conditions, or write a workout. ' +
      'Treat safety, age, limitations, equipment, and explicit avoids as hard constraints. ' +
      'When a missing fact could materially change safety or feasibility, set clarificationRequired true. ' +
      'Use controlled snake_case equipment, movement, body-region, and limitation keys. ' +
      'Scores and confidence use integers 1-100; null means unknown.',
    prompt:
      `Coach request:\n${request}\n\n` +
      `Known deterministic defaults (do not contradict or invent beyond these):\n${JSON.stringify(defaults, null, 2)}`,
    maxOutputTokens: 1200,
  })
  return {
    interpretation: result.output,
    modelVersion: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    latencyMs: Date.now() - startedAt,
    usage: result.usage ?? null,
  }
}

export async function llmDraftCanonicalExerciseCard({ notes, taxonomy }, generate = generateText) {
  if (!isLlmConfigured()) return null
  const startedAt = Date.now()
  const result = await generate({
    model: resolveModel(),
    output: Output.object({
      name: 'vortex_canonical_exercise_card_draft',
      description: 'An unverified canonical exercise-card draft for mandatory human review.',
      schema: jsonSchema(exerciseCardDraftSchema(taxonomy)),
    }),
    system:
      'Create structured youth-athletics exercise-card drafts for qualified coach review. ' +
      'Never claim approval, publication, medical suitability, injury treatment, or verified media. ' +
      'Use only the supplied controlled taxonomy values. Keep athlete instructions direct and age-appropriate. ' +
      'Difficulty scores are tentative 1-100 estimates. Distinguish the stable movement from each delivery context. ' +
      'Every profile needs contextual dosage, a quality gate, stop rules, coach instructions, and athlete instructions. ' +
      'State assumptions and uncertainties rather than inventing missing facts.',
    prompt:
      `Controlled taxonomy:\n${JSON.stringify(taxonomy)}\n\n` +
      `Coach source notes:\n${notes}\n\n` +
      'Return an unverified draft only. Do not include status, approval, reviewer, or video fields.',
    maxOutputTokens: 3000,
  })
  return {
    draft: result.output,
    modelVersion: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    latencyMs: Date.now() - startedAt,
    usage: result.usage ?? null,
  }
}
