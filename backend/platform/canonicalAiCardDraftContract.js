import Joi from 'joi'
import { parseProgrammingContract } from './workoutProgrammingRequest.js'

// The existing AI authoring schema is also the runtime contract. Fail closed on
// new schema keywords until their runtime semantics are implemented explicitly.
function authoringSchemaParser(schema) {
  const supported = ['type', 'enum', 'properties', 'required', 'additionalProperties', 'items', 'minItems', 'maxItems', 'uniqueItems', 'minLength', 'maxLength', 'pattern', 'minimum', 'maximum']
  if (Object.keys(schema).some((key) => !supported.includes(key))) throw new TypeError('Unsupported AI authoring schema keyword')
  const types = Array.isArray(schema.type) ? schema.type : [schema.type]
  const type = types.find((entry) => entry !== 'null')
  let rule
  if (type === 'object') {
    if (schema.additionalProperties !== false) throw new TypeError('AI authoring objects must reject unknown fields')
    rule = Joi.object(Object.fromEntries(Object.entries(schema.properties).map(([key, value]) => {
      const child = authoringSchemaParser(value)
      return [key, schema.required.includes(key) ? child.required() : child]
    })))
  } else if (type === 'array') {
    rule = Joi.array().items(authoringSchemaParser(schema.items))
    if (schema.minItems != null) rule = rule.min(schema.minItems)
    if (schema.maxItems != null) rule = rule.max(schema.maxItems)
    if (schema.uniqueItems) rule = rule.unique()
  } else if (type === 'string') {
    rule = Joi.string()
    if (!schema.minLength) rule = rule.allow('')
    if (schema.minLength != null) rule = rule.min(schema.minLength)
    if (schema.maxLength != null) rule = rule.max(schema.maxLength)
    if (schema.pattern) rule = rule.pattern(new RegExp(schema.pattern))
  } else if (type === 'integer' || type === 'number') {
    rule = type === 'integer' ? Joi.number().integer() : Joi.number()
    if (schema.minimum != null) rule = rule.min(schema.minimum)
    if (schema.maximum != null) rule = rule.max(schema.maximum)
  } else throw new TypeError('Unsupported AI authoring schema type')
  if (schema.enum) {
    if (!schema.enum.length) throw new TypeError('AI authoring requires a populated canonical taxonomy')
    rule = rule.custom((value, helpers) => schema.enum.includes(value) ? value : helpers.error('any.only'))
  }
  if (types.includes('null')) rule = rule.allow(null)
  return rule
}

/** Enforce the exact shared authoring schema independently of the provider. */
export function canonicalAiDraftOutputContract(outputSchema) {
  const parser = authoringSchemaParser(outputSchema)
  return { outputSchema, parseOutput: (raw) => parseProgrammingContract(parser, raw, 'Canonical AI authoring output') }
}

export function exerciseCardDraftSchema(taxonomy) {
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
                'technicalComplexity', 'absoluteLoadDemand', 'supervisionDemand',
                'failureConsequence', 'impact', 'workCapacityDemand',
              ],
              properties: {
                technicalComplexity: score,
                absoluteLoadDemand: score,
                supervisionDemand: score,
                failureConsequence: score,
                impact: score,
                workCapacityDemand: score,
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
