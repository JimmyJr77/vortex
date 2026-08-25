/**
 * Canonical Vortex workout contracts.
 *
 * This module deliberately has no database or AI dependency. It is the boundary
 * shared by deterministic generation, AI intent interpretation, persistence,
 * validation, and evaluation.
 */
import { findExerciseSkillLevelPaths } from './exerciseCardSemantics.js'
import {
  EQUIPMENT_V2_ALIASES,
  EQUIPMENT_V2_KEYS,
  TAXONOMY_V2_FACETS,
  resolveEquipmentV2Key,
  taxonomyV2Term,
} from './taxonomyV2.js'
import {
  STRESS_SCORE_FIELDS,
  TASK_DEMAND_FIELDS,
  structuredProfileCompleteness,
} from './canonicalExerciseProfilesV2.js'

export const WORKOUT_SCHEMA_VERSION = '1.0.0'
export const GENERATOR_VERSION = 'canonical-deterministic-2'

export const SESSION_PHASE_ORDER = Object.freeze([
  'prepare_and_access',
  'movement_intelligence',
  'output',
  'capacity',
  'resilience',
  'sustained_capacity',
  'restore',
])

export const WORKOUT_FOCUS_STRENGTHS = Object.freeze([
  'required',
  'strong_preference',
  'preferred',
  'neutral',
  'exclude',
])

export const WORKOUT_FOCUS_SCOPES = Object.freeze([
  'whole_session',
  'anchor_exercises',
  'main_work',
  'prepare_restore',
  'accessories',
  'conditioning',
  ...SESSION_PHASE_ORDER,
])

export const WORKOUT_FOCUS_FACETS = Object.freeze([
  'phase',
  'exercise',
  'equipment',
  'movement_pattern',
  'body_region',
  ...Object.keys(TAXONOMY_V2_FACETS),
])

export const WORKOUT_STRESS_BUDGET_FIELDS = Object.freeze([
  'jointStress', 'tissueStress', 'neuralDemand', 'impactStress',
  'localMuscularFatigue', 'systemicFatigue', 'gripFatigue',
  'conditioningFatigue', 'recoveryCost',
])

/**
 * These legacy keys are still present on pre-v2 variants. They remain explicit
 * compatibility keys until their exact equipment migration is complete; this
 * does not make arbitrary equipment strings valid in a canonical request.
 */
export const CANONICAL_WORKOUT_LEGACY_EQUIPMENT_KEYS = Object.freeze([
  'box',
  'bench',
  'pull_up_bar',
])

const CONTROLLED_WORKOUT_EQUIPMENT_KEYS = new Set([
  ...EQUIPMENT_V2_KEYS,
  ...Object.keys(EQUIPMENT_V2_ALIASES),
  ...CANONICAL_WORKOUT_LEGACY_EQUIPMENT_KEYS,
])

export const EXERCISE_STATUSES = Object.freeze([
  'draft',
  'review',
  'published',
  'deprecated',
  'archived',
])

export const SCORE_FIELDS = Object.freeze([
  'contentConfidence',
  'scoringConfidence',
  'mediaConfidence',
  'technicalComplexity',
  'absoluteLoadDemand',
  'baseOverallDifficulty',
])

const PUBLISHED_REQUIRED_DIFFICULTY_FIELDS = Object.freeze([
  'technicalComplexity',
  'absoluteLoadDemand',
  'baseOverallDifficulty',
])

export function score100(value, { nullable = true, field = 'score' } = {}) {
  if (value == null || value === '') {
    if (nullable) return null
    throw new TypeError(`${field} is required`)
  }
  const number = Number(value)
  if (!Number.isInteger(number) || number < 1 || number > 100) {
    throw new RangeError(`${field} must be an integer from 1 to 100 or null`)
  }
  return number
}

export function deriveOverallDifficulty(technicalComplexity, absoluteLoadDemand) {
  const technical = score100(technicalComplexity, {
    nullable: false,
    field: 'technicalComplexity',
  })
  const physical = score100(absoluteLoadDemand, {
    nullable: false,
    field: 'absoluteLoadDemand',
  })
  return Math.max(technical, physical)
}

/**
 * Initial traceable conversion only. Converted values remain unreviewed until
 * recalibrated against anchor exercises and approved by a coach.
 */
export function convertLegacyScore(value, scale, zeroMeaning = 'missing') {
  if (value == null || value === '') {
    return { value: null, legacyValue: value ?? null, legacyScale: scale, confidence: 20, reviewRequired: true }
  }
  const number = Number(value)
  if (!Number.isFinite(number)) throw new TypeError('legacy score must be numeric or null')
  if (number === 0) {
    if (!['missing', 'negligible'].includes(zeroMeaning)) throw new TypeError('zeroMeaning must be missing or negligible')
    return {
      value: zeroMeaning === 'missing' ? null : 1,
      legacyValue: 0,
      legacyScale: scale,
      confidence: 25,
      reviewRequired: true,
    }
  }
  if (scale !== 5 && scale !== 10) throw new TypeError('legacy scale must be 5 or 10')
  if (!Number.isInteger(number) || number < 1 || number > scale) {
    throw new RangeError(`legacy ${scale}-point score must be between 1 and ${scale}`)
  }
  return {
    value: number * (scale === 5 ? 20 : 10),
    legacyValue: number,
    legacyScale: scale,
    confidence: 40,
    reviewRequired: true,
  }
}

function stringList(value) {
  return [...new Set((Array.isArray(value) ? value : []).map(String).map((v) => v.trim()).filter(Boolean))]
}

function integer(value, field, { min, max, fallback = null } = {}) {
  if (value == null || value === '') return fallback
  const number = Number(value)
  if (!Number.isInteger(number) || (min != null && number < min) || (max != null && number > max)) {
    throw new RangeError(`${field} must be an integer${min != null ? ` >= ${min}` : ''}${max != null ? ` and <= ${max}` : ''}`)
  }
  return number
}

function quantityMap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return Object.freeze({})
  return Object.freeze(Object.fromEntries(
    Object.entries(value).map(([key, quantity]) => [
      resolveEquipmentV2Key(String(key)).key ?? String(key),
      integer(quantity, `equipmentQuantities.${key}`, { min: 0, max: 1000 }),
    ]),
  ))
}

function controlledEquipmentList(value, field) {
  const values = [...new Set(stringList(value).map((key) => (
    resolveEquipmentV2Key(key).key ?? key
  )))]
  const invalid = values.filter((key) => !CONTROLLED_WORKOUT_EQUIPMENT_KEYS.has(key))
  if (invalid.length) {
    throw new TypeError(`${field} contains unknown controlled equipment keys: ${invalid.join(', ')}`)
  }
  return values
}

function normalizeCohorts(value) {
  if (value == null) return Object.freeze([])
  if (!Array.isArray(value)) throw new TypeError('athleteCohorts must be an array')
  return Object.freeze(value.map((raw, index) => {
    if (!raw || typeof raw !== 'object') throw new TypeError(`athleteCohorts[${index}] must be an object`)
    const key = String(raw.key ?? '').trim()
    if (!key) throw new TypeError(`athleteCohorts[${index}].key is required`)
    const ageMin = integer(raw.ageMin, `athleteCohorts[${index}].ageMin`, { min: 5, max: 99 })
    const ageMax = integer(raw.ageMax, `athleteCohorts[${index}].ageMax`, { min: 5, max: 99 })
    if (ageMin > ageMax) throw new RangeError(`athleteCohorts[${index}] ageMin must not exceed ageMax`)
    return Object.freeze({
      key,
      label: String(raw.label ?? key),
      ageMin,
      ageMax,
      trainingExperience: String(raw.trainingExperience ?? raw.skillLevel ?? 'beginner'),
      maxDifficulty: score100(raw.maxDifficulty ?? 60, {
        nullable: false,
        field: `athleteCohorts[${index}].maxDifficulty`,
      }),
    })
  }))
}

function phaseEmphasisMap(value) {
  if (value == null) return Object.freeze({})
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('phaseEmphasis must be an object keyed by canonical phase')
  }
  const normalized = {}
  for (const [rawKey, rawWeight] of Object.entries(value)) {
    const key = String(rawKey).trim()
    if (!SESSION_PHASE_ORDER.includes(key)) throw new TypeError(`Unknown phaseEmphasis phase: ${key}`)
    normalized[key] = integer(rawWeight, `phaseEmphasis.${key}`, { min: 0, max: 100 })
  }
  return Object.freeze(normalized)
}

function focusScopes(value, field) {
  const values = Array.isArray(value) ? value : [value ?? 'whole_session']
  const normalized = [...new Set(values.map((entry) => {
    const scope = String(entry).trim()
    if (scope === 'session' || scope === 'all_phases') return 'whole_session'
    if (scope === 'anchors') return 'anchor_exercises'
    if (scope === 'prepare_and_restore') return 'prepare_restore'
    return scope
  }))]
  for (const scope of normalized) {
    if (!WORKOUT_FOCUS_SCOPES.includes(scope)) throw new TypeError(`Unknown ${field} scope: ${scope}`)
  }
  return Object.freeze(normalized)
}

function normalizeWorkoutFocus(raw, index, preserveFacets) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new TypeError(`focuses[${index}] must be an object`)
  }
  const facet = String(raw.facet ?? raw.facetType ?? '').trim()
  const value = String(raw.value ?? raw.facetKey ?? '').trim()
  if (!WORKOUT_FOCUS_FACETS.includes(facet)) throw new TypeError(`Unknown focuses[${index}].facet: ${facet}`)
  if (!value) throw new TypeError(`focuses[${index}].value is required`)
  if (facet === 'phase' && !SESSION_PHASE_ORDER.includes(value)) {
    throw new TypeError(`Unknown phase focus value: ${value}`)
  }
  if (Object.hasOwn(TAXONOMY_V2_FACETS, facet) && !taxonomyV2Term(facet, value)) {
    throw new TypeError(`Unknown Taxonomy v2 focus: ${facet}:${value}`)
  }
  const rawStrength = String(raw.strength ?? 'preferred').trim()
  const strength = rawStrength === 'emphasize' ? 'strong_preference' : rawStrength
  if (!WORKOUT_FOCUS_STRENGTHS.includes(strength)) {
    throw new TypeError(`Unknown focuses[${index}].strength: ${strength}`)
  }
  return Object.freeze({
    facet,
    value,
    scopes: focusScopes(raw.scope ?? raw.scopes, `focuses[${index}]`),
    strength,
    weight: integer(raw.weight, `focuses[${index}].weight`, { min: 1, max: 100, fallback: 70 }),
    preserveOnSubstitution: raw.preserveOnSubstitution == null
      ? (strength === 'required' || preserveFacets.has(facet))
      : Boolean(raw.preserveOnSubstitution),
  })
}

function normalizeWorkoutFocuses(raw) {
  const preserveFacets = new Set(stringList(raw.preserveOnSubstitution))
  const supplied = Array.isArray(raw.focuses) ? raw.focuses : []
  const legacy = Array.isArray(raw.focusTargets) ? raw.focusTargets.map((target) => ({
    facet: target.facet ?? target.facetType,
    value: target.value ?? target.facetKey,
    scope: target.scope ?? target.phaseKey ?? 'whole_session',
    strength: target.strength ?? 'preferred',
    weight: target.weight ?? 70,
  })) : []
  return Object.freeze([...supplied, ...legacy].map((focus, index) => (
    normalizeWorkoutFocus(focus, index, preserveFacets)
  )))
}

export function normalizeWorkoutIntent(raw = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new TypeError('workout intent must be an object')
  const durationMinutes = integer(raw.durationMinutes, 'durationMinutes', { min: 15, max: 240 })
  const athleteCount = integer(raw.athleteCount, 'athleteCount', { min: 1, max: 100 })
  const coachCount = integer(raw.coachCount, 'coachCount', { min: 1, max: 20 })
  const ageMin = integer(raw.ageMin, 'ageMin', { min: 5, max: 99 })
  const ageMax = integer(raw.ageMax, 'ageMax', { min: 5, max: 99 })
  if (ageMin > ageMax) throw new RangeError('ageMin must not exceed ageMax')
  const fatigueBudgets = raw.fatigueBudgets && typeof raw.fatigueBudgets === 'object'
    ? raw.fatigueBudgets
    : {}
  const fatigueDefault = ageMax <= 12 ? 65 : ageMax <= 17 ? 75 : 85
  const stressBudgets = raw.stressBudgets && typeof raw.stressBudgets === 'object'
    ? raw.stressBudgets
    : {}

  const equipmentAvailable = controlledEquipmentList(raw.equipmentAvailable, 'equipmentAvailable')
  const equipmentRequired = controlledEquipmentList(raw.equipmentRequired, 'equipmentRequired')
  const equipmentAvoid = controlledEquipmentList(raw.equipmentAvoid, 'equipmentAvoid')
  const equipmentQuantities = quantityMap(raw.equipmentQuantities)
  const quantityKeys = Object.keys(equipmentQuantities)
  const invalidQuantityKeys = quantityKeys.filter((key) => !CONTROLLED_WORKOUT_EQUIPMENT_KEYS.has(key))
  if (invalidQuantityKeys.length) {
    throw new TypeError(`equipmentQuantities contains unknown controlled equipment keys: ${invalidQuantityKeys.join(', ')}`)
  }
  const unavailableQuantityKeys = quantityKeys.filter((key) => !equipmentAvailable.includes(key))
  if (unavailableQuantityKeys.length) {
    throw new RangeError(`equipment quantity was supplied for unavailable equipment: ${unavailableQuantityKeys.join(', ')}`)
  }
  const requiredAvoidOverlap = equipmentRequired.filter((key) => equipmentAvoid.includes(key))
  if (requiredAvoidOverlap.length) {
    throw new RangeError(`equipment cannot be both required and avoided: ${requiredAvoidOverlap.join(', ')}`)
  }
  const unavailableRequired = equipmentRequired.filter((key) => !equipmentAvailable.includes(key))
  if (unavailableRequired.length) {
    throw new RangeError(`required equipment is not available: ${unavailableRequired.join(', ')}`)
  }

  return Object.freeze({
    schemaVersion: WORKOUT_SCHEMA_VERSION,
    mode: raw.mode === 'ai_assisted' ? 'ai_assisted' : 'deterministic',
    objective: String(raw.objective || 'general_athletic_development'),
    phaseEmphasis: phaseEmphasisMap(raw.phaseEmphasis),
    focuses: normalizeWorkoutFocuses(raw),
    durationMinutes,
    athleteCount,
    coachCount,
    ageMin,
    ageMax,
    trainingAgeMonths: integer(raw.trainingAgeMonths, 'trainingAgeMonths', { min: 0, max: 1200, fallback: 0 }),
    trainingExperience: String(raw.trainingExperience ?? raw.skillLevel ?? 'beginner'),
    randomSeed: String(raw.randomSeed ?? 'vortex-default'),
    equipmentAvailable,
    equipmentQuantities,
    equipmentRequired,
    equipmentAvoid,
    movementAvoid: stringList(raw.movementAvoid),
    bodyRegionAvoid: stringList(raw.bodyRegionAvoid),
    exerciseInclude: stringList(raw.exerciseInclude),
    exerciseAvoid: stringList(raw.exerciseAvoid),
    recentExerciseIds: stringList(raw.recentExerciseIds),
    modifiers: stringList(raw.modifiers),
    limitations: stringList(raw.limitations),
    athleteCohorts: normalizeCohorts(raw.athleteCohorts),
    space: Object.freeze({
      environment: String(raw.space?.environment || 'indoor'),
      floorAreaSquareFeet: integer(raw.space?.floorAreaSquareFeet, 'space.floorAreaSquareFeet', { min: 1, fallback: null }),
      laneLengthFeet: integer(raw.space?.laneLengthFeet, 'space.laneLengthFeet', { min: 1, fallback: null }),
    }),
    maxDifficulty: score100(raw.maxDifficulty ?? 60, { nullable: false, field: 'maxDifficulty' }),
    maxTechnicalRisk: score100(raw.maxTechnicalRisk ?? 60, { nullable: false, field: 'maxTechnicalRisk' }),
    maxHighImpactContacts: integer(raw.maxHighImpactContacts, 'maxHighImpactContacts', {
      min: 0,
      max: 500,
      fallback: ageMax <= 12 ? 40 : 60,
    }),
    fatigueBudgets: Object.freeze({
      grip: score100(fatigueBudgets.grip ?? fatigueDefault, { nullable: false, field: 'fatigueBudgets.grip' }),
      localMuscle: score100(fatigueBudgets.localMuscle ?? fatigueDefault, { nullable: false, field: 'fatigueBudgets.localMuscle' }),
      spinalLoading: score100(fatigueBudgets.spinalLoading ?? Math.max(45, fatigueDefault - 10), { nullable: false, field: 'fatigueBudgets.spinalLoading' }),
      eccentricStress: score100(fatigueBudgets.eccentricStress ?? Math.max(50, fatigueDefault - 5), { nullable: false, field: 'fatigueBudgets.eccentricStress' }),
      impactAccumulation: score100(fatigueBudgets.impactAccumulation ?? Math.max(45, fatigueDefault - 10), { nullable: false, field: 'fatigueBudgets.impactAccumulation' }),
      technicalSensitivity: score100(fatigueBudgets.technicalSensitivity ?? Math.max(50, fatigueDefault - 5), { nullable: false, field: 'fatigueBudgets.technicalSensitivity' }),
    }),
    stressBudgets: Object.freeze(Object.fromEntries(WORKOUT_STRESS_BUDGET_FIELDS.map((field) => [
      field,
      score100(stressBudgets[field] ?? (
        ['jointStress', 'tissueStress', 'impactStress'].includes(field)
          ? Math.max(45, fatigueDefault - 10)
          : fatigueDefault
      ), { nullable: false, field: `stressBudgets.${field}` }),
    ]))),
    assumptions: stringList(raw.assumptions),
  })
}

export function validateExerciseCard(card) {
  const errors = []
  if (!card || typeof card !== 'object') return { valid: false, errors: ['card must be an object'] }
  for (const path of findExerciseSkillLevelPaths(card)) {
    errors.push(`${path} is not valid exercise-card metadata; use difficulty dimensions and readiness rules`)
  }
  for (const field of ['id', 'slug', 'canonicalName', 'cardVersion', 'schemaVersion', 'status']) {
    if (card[field] == null || card[field] === '') errors.push(`${field} is required`)
  }
  if (!EXERCISE_STATUSES.includes(card.status)) errors.push('status is invalid')
  if (!card.familyId) errors.push('familyId is required')
  if (!Array.isArray(card.deliveryProfiles) || card.deliveryProfiles.length === 0) errors.push('deliveryProfiles are required')
  for (const field of SCORE_FIELDS) {
    try { score100(card.difficulty?.[field] ?? card[field], { field }) } catch (error) { errors.push(error.message) }
  }
  const difficulty = card.difficulty ?? {}
  const legacyDifficultyFields = [
    'relativeStrengthDemand', 'mobilityDemand', 'balanceDemand', 'stabilityDemand',
    'coordinationDemand', 'speedDemand', 'decisionDemand', 'workCapacityDemand',
    'impact', 'eccentricTissueStress', 'jointStress', 'spinalLoading', 'gripDemand',
    'inversionDemand', 'fearConfidenceBarrier', 'supervisionDemand',
    'spottingDemand', 'failureConsequence',
  ].filter((field) => difficulty[field] != null)
  if (legacyDifficultyFields.length) {
    errors.push(`difficulty may contain only technicalComplexity, absoluteLoadDemand, and baseOverallDifficulty; move task/stress fields: ${legacyDifficultyFields.join(', ')}`)
  }
  if (
    difficulty.baseOverallDifficulty != null
    && (
      difficulty.technicalComplexity == null
      || difficulty.absoluteLoadDemand == null
    )
  ) {
    errors.push(
      'difficulty.baseOverallDifficulty requires both '
      + 'difficulty.technicalComplexity and difficulty.absoluteLoadDemand',
    )
  }
  if (
    difficulty.technicalComplexity != null
    && difficulty.absoluteLoadDemand != null
    && difficulty.baseOverallDifficulty != null
  ) {
    try {
      const expected = deriveOverallDifficulty(
        difficulty.technicalComplexity,
        difficulty.absoluteLoadDemand,
      )
      if (Number(difficulty.baseOverallDifficulty) !== expected) {
        errors.push(
          'difficulty.baseOverallDifficulty must equal the greater of '
          + 'difficulty.technicalComplexity and difficulty.absoluteLoadDemand',
        )
      }
    } catch {
      // SCORE_FIELDS already reports malformed score values.
    }
  }
  if (card.status === 'published') {
    if (!card.media?.approvedVideoUrl) errors.push('published cards require an approved demonstration video')
    if (!card.approvedBy) errors.push('published cards require approvedBy')
    if (card.contentConfidence == null || card.scoringConfidence == null || card.mediaConfidence == null) {
      errors.push('published cards require content, scoring, and media confidence')
    }
    for (const field of PUBLISHED_REQUIRED_DIFFICULTY_FIELDS) {
      if (card.difficulty?.[field] == null) errors.push(`published cards require difficulty.${field}`)
    }
    for (const field of TASK_DEMAND_FIELDS) {
      try {
        score100(card.taskDemands?.[field], { nullable: false, field: `taskDemands.${field}` })
      } catch (error) { errors.push(error.message) }
    }
    for (const field of STRESS_SCORE_FIELDS) {
      try {
        score100(card.stressProfile?.[field], { nullable: false, field: `stressProfile.${field}` })
      } catch (error) { errors.push(error.message) }
    }
    for (const issue of structuredProfileCompleteness(card).issues) {
      errors.push(`published cards require ${issue.field} (${issue.code})`)
    }
  }
  return { valid: errors.length === 0, errors }
}

export function assertCanonicalPhaseOrder(phaseKeys) {
  let previous = -1
  for (const key of phaseKeys) {
    const index = SESSION_PHASE_ORDER.indexOf(key)
    if (index < 0) throw new RangeError(`unknown phase key: ${key}`)
    if (index <= previous) throw new RangeError('phases must be unique and in canonical order')
    previous = index
  }
  return true
}
