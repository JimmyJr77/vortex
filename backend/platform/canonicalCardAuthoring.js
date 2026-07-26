import {
  SESSION_PHASE_ORDER,
  deriveOverallDifficulty,
  score100,
} from './canonicalWorkoutContract.js'

export const CARD_STATUSES = Object.freeze(['draft', 'review', 'published', 'deprecated', 'archived'])
export const RELATIONSHIP_TYPES = Object.freeze([
  'regression',
  'progression',
  'lateral_substitution',
  'equipment_equivalent',
  'phase_equivalent',
  'compatible_pairing',
  'contraindicated_pairing',
])
export const PROGRESSION_DIMENSIONS = Object.freeze([
  'load',
  'leverage',
  'range',
  'speed',
  'stability',
  'complexity',
  'impact',
  'decision_demand',
  'fatigue',
])
export const MOVEMENT_PLANES = Object.freeze(['sagittal', 'frontal', 'transverse', 'multiplanar'])
export const LATERALITY_OPTIONS = Object.freeze([
  'bilateral', 'unilateral', 'alternating', 'ipsilateral', 'contralateral', 'asymmetrical',
])
export const EXTERNAL_LOAD_METHODS = Object.freeze([
  'bodyweight', 'fixed_external', 'relative_external', 'velocity_targeted',
  'distance_targeted', 'coach_selected',
])

const STATUS_TRANSITIONS = Object.freeze({
  draft: new Set(['review', 'archived']),
  review: new Set(['draft', 'published', 'archived']),
  published: new Set(['deprecated']),
  deprecated: new Set(['review', 'archived']),
  archived: new Set([]),
})

function list(value) {
  return Array.isArray(value) ? value : []
}

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeDifficulty(raw) {
  const difficulty = object(raw)
  const technical = difficulty.technicalComplexity == null
    ? null
    : score100(difficulty.technicalComplexity, {
      nullable: false,
      field: 'technicalComplexity',
    })
  const physical = difficulty.absoluteLoadDemand == null
    ? null
    : score100(difficulty.absoluteLoadDemand, {
      nullable: false,
      field: 'absoluteLoadDemand',
    })
  return {
    ...difficulty,
    technicalComplexity: technical,
    absoluteLoadDemand: physical,
    baseOverallDifficulty: technical == null || physical == null
      ? null
      : deriveOverallDifficulty(technical, physical),
  }
}

function uniqueStrings(value) {
  return [...new Set(list(value).map(text).filter(Boolean))]
}

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

function identityText(value) {
  return text(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function bigrams(value) {
  const normalized = ` ${identityText(value)} `
  const result = new Set()
  for (let index = 0; index < normalized.length - 1; index += 1) {
    result.add(normalized.slice(index, index + 2))
  }
  return result
}

function bigramSimilarity(a, b) {
  if (a.size === 0 || b.size === 0) return 0
  let shared = 0
  for (const pair of a) if (b.has(pair)) shared += 1
  return Math.round((2 * shared * 100) / (a.size + b.size))
}

export function canonicalNameSimilarity(left, right) {
  return bigramSimilarity(bigrams(left), bigrams(right))
}

function prepareCanonicalIdentity(card = {}) {
  const names = uniqueStrings([
    card.canonicalName ?? card.canonical_name,
    card.displayName ?? card.display_name,
    ...list(card.aliases),
  ].map(identityText).filter(Boolean))
  return {
    id: String(card.id ?? ''),
    displayName: card.displayName ?? card.display_name,
    familyKey: card.familyKey ?? card.family_key,
    names,
    nameSet: new Set(names),
    bigramSets: names.map(bigrams),
  }
}

export function buildCanonicalDuplicateIndex(existingCards) {
  return list(existingCards).map(prepareCanonicalIdentity)
}

export function findPotentialCanonicalDuplicatesFromIndex(candidate, duplicateIndex, threshold = 72) {
  const preparedCandidate = prepareCanonicalIdentity(candidate)
  return list(duplicateIndex)
    .filter((existing) => existing.id !== preparedCandidate.id)
    .map((existing) => {
      let score = 0
      for (const candidateBigrams of preparedCandidate.bigramSets) {
        for (const existingBigrams of existing.bigramSets) {
          score = Math.max(score, bigramSimilarity(candidateBigrams, existingBigrams))
          if (score === 100) break
        }
        if (score === 100) break
      }
      const exactCollision = preparedCandidate.names.some((name) => existing.nameSet.has(name))
      return {
        id: existing.id,
        displayName: existing.displayName,
        familyKey: existing.familyKey,
        score,
        exactCollision,
      }
    })
    .filter((match) => match.score >= threshold)
    .sort((left, right) => right.score - left.score || left.displayName.localeCompare(right.displayName))
}

export function findPotentialCanonicalDuplicates(candidate, existingCards, threshold = 72) {
  return findPotentialCanonicalDuplicatesFromIndex(
    candidate,
    buildCanonicalDuplicateIndex(existingCards),
    threshold,
  )
}

export function assertCardStatusTransition(fromStatus, toStatus) {
  if (!CARD_STATUSES.includes(fromStatus) || !CARD_STATUSES.includes(toStatus)) {
    throw new TypeError('Unknown canonical card lifecycle status.')
  }
  if (fromStatus === toStatus) return true
  if (!STATUS_TRANSITIONS[fromStatus].has(toStatus)) {
    throw new RangeError(`Canonical card cannot transition from ${fromStatus} to ${toStatus}.`)
  }
  return true
}

export function assertIndependentReviewer(createdBy, reviewerUserId, subject = 'card') {
  if (createdBy != null && reviewerUserId != null && Number(createdBy) === Number(reviewerUserId)) {
    throw Object.assign(new Error(`Two-person control requires a different ${subject} reviewer.`), { status: 409 })
  }
  return true
}

export function approvalAppliesToVersion(review, cardVersion, reviewerUserId) {
  return review?.decision === 'approve'
    && Number(review.reviewer_user_id) === Number(reviewerUserId)
    && Number(review.reviewed_card_version) === Number(cardVersion)
}

export function normalizeCanonicalCardDraft(raw = {}) {
  const canonicalName = text(raw.canonicalName ?? raw.canonical_name)
  const slug = text(raw.slug)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 100)
  return {
    slug,
    canonicalName,
    displayName: text(raw.displayName ?? raw.display_name) || canonicalName,
    description: text(raw.description) || null,
    aliases: uniqueStrings(raw.aliases),
    familyKey: text(raw.familyKey ?? raw.family_key),
    movementPatterns: uniqueStrings(raw.movementPatterns ?? raw.movement_patterns),
    bodyRegions: uniqueStrings(raw.bodyRegions ?? raw.body_regions),
    requiredEquipment: uniqueStrings(raw.requiredEquipment ?? raw.required_equipment),
    optionalEquipment: uniqueStrings(raw.optionalEquipment ?? raw.optional_equipment),
    environment: raw.environment && typeof raw.environment === 'object' ? raw.environment : {},
    population: raw.population && typeof raw.population === 'object' ? raw.population : {},
    athleteSupport: object(raw.athleteSupport ?? raw.athlete_support_json),
    coachSupport: object(raw.coachSupport ?? raw.coach_support_json),
    supportOperations: object(raw.supportOperations ?? raw.support_operations_json),
    anatomy: {
      primaryMuscles: uniqueStrings(raw.anatomy?.primaryMuscles),
      secondaryMuscles: uniqueStrings(raw.anatomy?.secondaryMuscles),
      stabilizers: uniqueStrings(raw.anatomy?.stabilizers),
      joints: uniqueStrings(raw.anatomy?.joints),
      jointActions: uniqueStrings(raw.anatomy?.jointActions),
      planes: uniqueStrings(raw.anatomy?.planes),
      laterality: text(raw.anatomy?.laterality),
    },
    contentConfidence: raw.contentConfidence == null ? null : score100(raw.contentConfidence),
    scoringConfidence: raw.scoringConfidence == null ? null : score100(raw.scoringConfidence),
    mediaConfidence: raw.mediaConfidence == null ? null : score100(raw.mediaConfidence),
    approvedVideoUrl: text(raw.approvedVideoUrl ?? raw.approved_video_url) || null,
    variants: list(raw.variants).map((variant) => ({
      id: text(variant.id) || null,
      variantKey: text(variant.variantKey ?? variant.variant_key),
      displayName: text(variant.displayName ?? variant.display_name),
      modifierKeys: uniqueStrings(variant.modifierKeys ?? variant.modifier_keys),
      difficulty: normalizeDifficulty(variant.difficulty),
      requirements: variant.requirements && typeof variant.requirements === 'object' ? variant.requirements : {},
      programming: object(variant.programming ?? variant.programming_profile_json),
      loadProfile: {
        gripDemand: variant.loadProfile?.gripDemand == null ? null : score100(variant.loadProfile.gripDemand),
        spinalLoading: variant.loadProfile?.spinalLoading == null ? null : score100(variant.loadProfile.spinalLoading),
        eccentricStress: variant.loadProfile?.eccentricStress == null ? null : score100(variant.loadProfile.eccentricStress),
        landingContactsPerRep: variant.loadProfile?.landingContactsPerRep == null
          ? null
          : Number(variant.loadProfile.landingContactsPerRep),
        externalLoadMethod: text(variant.loadProfile?.externalLoadMethod) || null,
      },
      fatigueProfile: {
        localMuscleFatigue: variant.fatigueProfile?.localMuscleFatigue == null ? null : score100(variant.fatigueProfile.localMuscleFatigue),
        gripFatigue: variant.fatigueProfile?.gripFatigue == null ? null : score100(variant.fatigueProfile.gripFatigue),
        technicalFatigueSensitivity: variant.fatigueProfile?.technicalFatigueSensitivity == null
          ? null
          : score100(variant.fatigueProfile.technicalFatigueSensitivity),
        impactAccumulation: variant.fatigueProfile?.impactAccumulation == null ? null : score100(variant.fatigueProfile.impactAccumulation),
        recoveryHours: variant.fatigueProfile?.recoveryHours == null ? null : Number(variant.fatigueProfile.recoveryHours),
      },
      profiles: list(variant.profiles).map((profile) => ({
        id: text(profile.id) || null,
        profileKey: text(profile.profileKey ?? profile.profile_key),
        phaseKey: text(profile.phaseKey ?? profile.phase_key),
        role: text(profile.role) || 'primary',
        purpose: text(profile.purpose),
        phaseSuitability: profile.phaseSuitability == null ? null : score100(profile.phaseSuitability),
        methodologyAlignment: profile.methodologyAlignment == null ? null : score100(profile.methodologyAlignment),
        objectiveRelevance: profile.objectiveRelevance && typeof profile.objectiveRelevance === 'object'
          ? profile.objectiveRelevance
          : {},
        dosage: profile.dosage && typeof profile.dosage === 'object' ? profile.dosage : {},
        qualityGate: text(profile.qualityGate ?? profile.quality_gate),
        stopRules: uniqueStrings(profile.stopRules ?? profile.stop_rules),
        coachInstructions: text(profile.coachInstructions ?? profile.coach_instructions) || null,
        athleteInstructions: text(profile.athleteInstructions ?? profile.athlete_instructions) || null,
        expectedAdaptation: text(profile.expectedAdaptation ?? profile.expected_adaptation) || null,
        equipmentRequired: uniqueStrings(profile.equipmentRequired ?? profile.equipment_required),
        logistics: profile.logistics && typeof profile.logistics === 'object' ? profile.logistics : {},
        timeModel: object(profile.timeModel ?? profile.time_model_json),
        doseScaling: object(profile.doseScaling ?? profile.dose_scaling_json),
        measurement: object(profile.measurement ?? profile.measurement_json),
        supportPrompts: object(profile.supportPrompts ?? profile.support_prompts_json),
      })),
    })),
  }
}

export function validateCanonicalCardDraft(raw) {
  let card
  try {
    card = normalizeCanonicalCardDraft(raw)
  } catch (error) {
    return { valid: false, errors: [error.message], normalized: null }
  }
  const errors = []
  if (!card.slug) errors.push('Slug is required.')
  if (!card.canonicalName) errors.push('Canonical name is required.')
  if (!card.displayName) errors.push('Display name is required.')
  if (!card.familyKey) errors.push('Family key is required.')
  const invalidPlanes = card.anatomy.planes.filter((value) => !MOVEMENT_PLANES.includes(value))
  if (invalidPlanes.length) errors.push(`Unknown movement planes: ${invalidPlanes.join(', ')}.`)
  if (card.anatomy.laterality && !LATERALITY_OPTIONS.includes(card.anatomy.laterality)) {
    errors.push(`Unknown laterality value: ${card.anatomy.laterality}.`)
  }
  card.variants.forEach((variant, variantIndex) => {
    if (!variant.variantKey) errors.push(`Variant ${variantIndex + 1} needs a key.`)
    if (!variant.displayName) errors.push(`Variant ${variantIndex + 1} needs a display name.`)
    if (variant.loadProfile.landingContactsPerRep != null
      && (!Number.isInteger(variant.loadProfile.landingContactsPerRep) || variant.loadProfile.landingContactsPerRep < 0)) {
      errors.push(`Variant ${variantIndex + 1} landing contacts must be a non-negative integer.`)
    }
    if (variant.loadProfile.externalLoadMethod != null
      && !EXTERNAL_LOAD_METHODS.includes(variant.loadProfile.externalLoadMethod)) {
      errors.push(`Variant ${variantIndex + 1} has an unknown external load method.`)
    }
    if (variant.fatigueProfile.recoveryHours != null
      && (!Number.isInteger(variant.fatigueProfile.recoveryHours)
        || variant.fatigueProfile.recoveryHours < 0
        || variant.fatigueProfile.recoveryHours > 168)) {
      errors.push(`Variant ${variantIndex + 1} recovery hours must be an integer from 0 to 168.`)
    }
    variant.profiles.forEach((profile, profileIndex) => {
      const label = `Variant ${variantIndex + 1}, profile ${profileIndex + 1}`
      if (!profile.profileKey) errors.push(`${label} needs a profile key.`)
      if (!SESSION_PHASE_ORDER.includes(profile.phaseKey)) errors.push(`${label} needs a canonical phase.`)
      if (!profile.purpose) errors.push(`${label} needs a purpose.`)
      if (profile.phaseSuitability == null) errors.push(`${label} needs a phase suitability score.`)
      if (!profile.qualityGate) errors.push(`${label} needs a quality gate.`)
    })
  })
  return { valid: errors.length === 0, errors, normalized: card }
}

export function evaluateCanonicalCardReadiness(raw, { mediaReview = null } = {}) {
  let card
  try {
    card = normalizeCanonicalCardDraft(raw)
  } catch (error) {
    return { ready: false, issues: [{ code: 'invalid_score', path: 'scores', message: error.message }] }
  }
  const issues = []
  const requireText = (value, path, label) => {
    if (!text(value)) issues.push({ code: 'required', path, message: `${label} is required.` })
  }
  requireText(card.slug, 'slug', 'Slug')
  requireText(card.canonicalName, 'canonicalName', 'Canonical name')
  requireText(card.displayName, 'displayName', 'Display name')
  requireText(card.familyKey, 'familyKey', 'Family')
  if (card.movementPatterns.length === 0) {
    issues.push({ code: 'required', path: 'movementPatterns', message: 'At least one movement pattern is required.' })
  }
  if (card.bodyRegions.length === 0) {
    issues.push({ code: 'required', path: 'bodyRegions', message: 'At least one body region is required.' })
  }
  if (card.anatomy.joints.length === 0) {
    issues.push({ code: 'anatomy', path: 'anatomy.joints', message: 'At least one involved joint is required.' })
  }
  if (card.anatomy.planes.length === 0) {
    issues.push({ code: 'anatomy', path: 'anatomy.planes', message: 'At least one movement plane is required.' })
  }
  if (card.anatomy.laterality.length === 0) {
    issues.push({ code: 'anatomy', path: 'anatomy.laterality', message: 'Laterality is required.' })
  }
  for (const field of ['contentConfidence', 'scoringConfidence', 'mediaConfidence']) {
    if (card[field] == null) issues.push({ code: 'required', path: field, message: `${field} is required.` })
  }
  for (const field of [
    'whyItMatters', 'primaryCue', 'expectedSensations', 'unexpectedSensations',
    'painGuidance', 'selfChecks', 'accessibility', 'mediaAlternatives',
  ]) {
    const value = card.athleteSupport[field]
    if (value == null || value === '' || (Array.isArray(value) && value.length === 0)
      || (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0)) {
      issues.push({ code: 'athlete_support', path: `athleteSupport.${field}`, message: `${field} is required for member support.` })
    }
  }
  for (const field of [
    'observationChecklist', 'faultCorrections', 'demonstrationPlan',
    'groupManagement', 'modificationDecisionTree', 'doNotUseWhen',
  ]) {
    const value = card.coachSupport[field]
    if (value == null || (Array.isArray(value) && value.length === 0)
      || (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0)) {
      issues.push({ code: 'coach_support', path: `coachSupport.${field}`, message: `${field} is required for coach support.` })
    }
  }
  for (const field of ['issueCategories', 'supportEscalation', 'retentionPolicy', 'changeImpactPolicy']) {
    const value = card.supportOperations[field]
    if (value == null || value === '' || (Array.isArray(value) && value.length === 0)
      || (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0)) {
      issues.push({ code: 'support_operations', path: `supportOperations.${field}`, message: `${field} is required for operational support.` })
    }
  }
  if (!card.approvedVideoUrl || !isHttpsUrl(card.approvedVideoUrl)) {
    issues.push({ code: 'approved_video', path: 'approvedVideoUrl', message: 'An approved HTTPS demonstration video is required.' })
  }
  if (!mediaReview || mediaReview.url !== card.approvedVideoUrl || mediaReview.linkStatus !== 'healthy'
    || mediaReview.exactVariantMatch !== true || Number(mediaReview.demonstrationQualityScore) < 80) {
    issues.push({
      code: 'media_review',
      path: 'approvedVideoUrl',
      message: 'The approved video needs a healthy exact-match review with quality of at least 80/100.',
    })
  }
  if (card.variants.length === 0) {
    issues.push({ code: 'variant_required', path: 'variants', message: 'At least one variant is required.' })
  }
  card.variants.forEach((variant, variantIndex) => {
    const base = `variants.${variantIndex}`
    requireText(variant.variantKey, `${base}.variantKey`, 'Variant key')
    requireText(variant.displayName, `${base}.displayName`, 'Variant display name')
    const difficultyFields = [
      'technicalComplexity', 'absoluteLoadDemand', 'supervisionDemand', 'failureConsequence',
      'impact', 'workCapacityDemand', 'baseOverallDifficulty',
    ]
    for (const field of difficultyFields) {
      try {
        score100(variant.difficulty[field], { nullable: false, field })
      } catch {
        issues.push({ code: 'difficulty_score', path: `${base}.difficulty.${field}`, message: `${field} must be an integer from 1 to 100.` })
      }
    }
    if (
      Number.isInteger(variant.difficulty.technicalComplexity)
      && Number.isInteger(variant.difficulty.absoluteLoadDemand)
      && Number.isInteger(variant.difficulty.baseOverallDifficulty)
      && variant.difficulty.baseOverallDifficulty !== deriveOverallDifficulty(
        variant.difficulty.technicalComplexity,
        variant.difficulty.absoluteLoadDemand,
      )
    ) {
      issues.push({
        code: 'difficulty_model',
        path: `${base}.difficulty.baseOverallDifficulty`,
        message: 'Overall difficulty must be derived from technical complexity and physical difficulty.',
      })
    }
    for (const field of ['gripDemand', 'spinalLoading', 'eccentricStress']) {
      if (variant.loadProfile[field] == null) {
        issues.push({ code: 'load_profile', path: `${base}.loadProfile.${field}`, message: `${field} is required.` })
      }
    }
    for (const field of ['localMuscleFatigue', 'gripFatigue', 'technicalFatigueSensitivity', 'impactAccumulation']) {
      if (variant.fatigueProfile[field] == null) {
        issues.push({ code: 'fatigue_profile', path: `${base}.fatigueProfile.${field}`, message: `${field} is required.` })
      }
    }
    if (!variant.loadProfile.externalLoadMethod) {
      issues.push({ code: 'load_profile', path: `${base}.loadProfile.externalLoadMethod`, message: 'External load method is required.' })
    }
    if (variant.fatigueProfile.recoveryHours == null) {
      issues.push({ code: 'fatigue_profile', path: `${base}.fatigueProfile.recoveryHours`, message: 'Recovery hours are required.' })
    }
    for (const field of [
      'trainingStimuli', 'stimulusDose', 'weeklyExposure', 'prerequisites',
      'completionCriteria', 'sequenceRules', 'pairingCompatibility',
      'interferenceRules', 'uncertaintyPolicy',
    ]) {
      const value = variant.programming[field]
      if (value == null || (Array.isArray(value) && value.length === 0)
        || (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0)) {
        issues.push({ code: 'programming_profile', path: `${base}.programming.${field}`, message: `${field} is required for generation.` })
      }
    }
    if (variant.profiles.length === 0) {
      issues.push({ code: 'profile_required', path: `${base}.profiles`, message: 'At least one delivery profile is required.' })
    }
    variant.profiles.forEach((profile, profileIndex) => {
      const profileBase = `${base}.profiles.${profileIndex}`
      requireText(profile.profileKey, `${profileBase}.profileKey`, 'Profile key')
      if (!SESSION_PHASE_ORDER.includes(profile.phaseKey)) {
        issues.push({ code: 'phase', path: `${profileBase}.phaseKey`, message: 'A canonical phase is required.' })
      }
      requireText(profile.purpose, `${profileBase}.purpose`, 'Context-specific purpose')
      requireText(profile.qualityGate, `${profileBase}.qualityGate`, 'Quality gate')
      requireText(profile.coachInstructions, `${profileBase}.coachInstructions`, 'Coach instructions')
      requireText(profile.athleteInstructions, `${profileBase}.athleteInstructions`, 'Athlete instructions')
      requireText(profile.expectedAdaptation, `${profileBase}.expectedAdaptation`, 'Expected adaptation')
      if (profile.stopRules.length === 0) {
        issues.push({ code: 'stop_rule', path: `${profileBase}.stopRules`, message: 'At least one stop rule is required.' })
      }
      if (Object.keys(profile.dosage).length === 0) {
        issues.push({ code: 'dosage', path: `${profileBase}.dosage`, message: 'A contextual dosage rule is required.' })
      }
      if (profile.equipmentRequired.length === 0) {
        issues.push({
          code: 'equipment_declaration',
          path: `${profileBase}.equipmentRequired`,
          message: 'Declare the equipment for this exact variant/profile, or use "none" for bodyweight.',
        })
      }
      for (const [field, code] of [
        ['timeModel', 'time_model'],
        ['doseScaling', 'dose_scaling'],
        ['measurement', 'measurement'],
        ['supportPrompts', 'support_prompts'],
      ]) {
        if (Object.keys(profile[field]).length === 0) {
          issues.push({ code, path: `${profileBase}.${field}`, message: `${field} is required.` })
        }
      }
    })
  })
  return { ready: issues.length === 0, issues, normalized: card }
}

export function validateCanonicalRelationship(raw = {}) {
  const relationship = text(raw.relationship)
  const dimensions = uniqueStrings(raw.dimensions)
  const errors = []
  if (!text(raw.fromVariantId ?? raw.from_variant_id)) errors.push('fromVariantId is required.')
  if (!text(raw.toVariantId ?? raw.to_variant_id)) errors.push('toVariantId is required.')
  if (text(raw.fromVariantId ?? raw.from_variant_id) === text(raw.toVariantId ?? raw.to_variant_id)) {
    errors.push('A variant cannot relate to itself.')
  }
  if (!RELATIONSHIP_TYPES.includes(relationship)) errors.push('Unknown relationship type.')
  try {
    score100(raw.similarityScore ?? raw.similarity_score, { nullable: false, field: 'similarityScore' })
  } catch {
    errors.push('similarityScore must be an integer from 1 to 100.')
  }
  if (!text(raw.reason)) errors.push('A reviewed relationship reason is required.')
  if (['progression', 'regression'].includes(relationship)) {
    if (dimensions.length === 0) errors.push('Progressions and regressions require at least one changed dimension.')
    const invalid = dimensions.filter((dimension) => !PROGRESSION_DIMENSIONS.includes(dimension))
    if (invalid.length) errors.push(`Unknown progression dimensions: ${invalid.join(', ')}.`)
  }
  return {
    valid: errors.length === 0,
    errors,
    normalized: {
      fromVariantId: text(raw.fromVariantId ?? raw.from_variant_id),
      toVariantId: text(raw.toVariantId ?? raw.to_variant_id),
      relationship,
      similarityScore: Number(raw.similarityScore ?? raw.similarity_score),
      dimensions,
      reason: text(raw.reason),
      conditions: raw.conditions && typeof raw.conditions === 'object' ? raw.conditions : {},
    },
  }
}

export function buildCanonicalCardTestPacket(raw, context = {}) {
  const readiness = evaluateCanonicalCardReadiness(raw, { mediaReview: context.mediaReview })
  const card = readiness.normalized ?? normalizeCanonicalCardDraft(raw)
  const relationships = list(context.relationships)
  const duplicates = list(context.duplicates)
  const checks = []
  const add = (id, category, priority, passed, evidence, message) => {
    checks.push({ id, category, priority, status: passed ? 'passed' : 'failed', evidence, message })
  }

  add('CARD-IDENTITY-01', 'identity', 'P1',
    Boolean(card.slug && card.canonicalName && card.displayName && card.familyKey),
    { slug: card.slug, familyKey: card.familyKey },
    'Stable identity and family are complete.')
  add('CARD-TAXONOMY-01', 'taxonomy', 'P1',
    list(context.invalidTaxonomyKeys).length === 0,
    { invalidKeys: list(context.invalidTaxonomyKeys) },
    'All taxonomy keys are controlled.')
  add('CARD-DUPLICATE-01', 'identity', 'P1',
    !duplicates.some((duplicate) => duplicate.exactCollision),
    { exactCollisions: duplicates.filter((duplicate) => duplicate.exactCollision) },
    'No unresolved exact canonical identity collision exists.')
  add('CARD-SIMILAR-IDENTITY-01', 'identity', 'P2',
    !duplicates.some((duplicate) => duplicate.score >= 90 && !duplicate.exactCollision),
    { similarIdentities: duplicates.filter((duplicate) => duplicate.score >= 90 && !duplicate.exactCollision) },
    'High-similarity names are surfaced for context review without treating meaningful modifiers as duplicates.')
  add('CARD-PROFILE-01', 'delivery_profile', 'P1',
    card.variants.length > 0 && card.variants.every((variant) => variant.profiles.length > 0),
    { variantCount: card.variants.length },
    'Every variant has a contextual delivery profile.')
  const profileKeys = card.variants.flatMap((variant) => (
    variant.profiles.map((profile) => `${variant.variantKey}:${profile.profileKey}`)
  ))
  add('CARD-PROFILE-02', 'delivery_profile', 'P1',
    new Set(profileKeys).size === profileKeys.length,
    { profileKeys },
    'Delivery profile keys are unique within each variant.')
  const athleteInstructions = card.variants.flatMap((variant) => (
    variant.profiles.map((profile) => profile.athleteInstructions)
  ))
  add('CARD-INSTRUCTION-01', 'instructions', 'P2',
    athleteInstructions.every((instruction) => text(instruction).length >= 10 && text(instruction).length <= 240),
    { lengths: athleteInstructions.map((instruction) => text(instruction).length) },
    'Athlete instructions are present and concise.')
  add('CARD-GENERATION-SUPPORT-01', 'generation_support', 'P1',
    card.variants.length > 0 && card.variants.every((variant) => (
      Object.keys(variant.programming).length > 0
      && variant.profiles.every((profile) => (
        Object.keys(profile.timeModel).length > 0
        && Object.keys(profile.doseScaling).length > 0
        && Object.keys(profile.measurement).length > 0
      ))
    )),
    { variantCount: card.variants.length },
    'Programming behavior, timing, scaling, and measurement are complete.')
  add('CARD-ATHLETE-SUPPORT-01', 'athlete_support', 'P1',
    Object.keys(card.athleteSupport).length > 0,
    { fields: Object.keys(card.athleteSupport) },
    'Member guidance, self-checks, accessibility, and pain escalation are complete.')
  add('CARD-COACH-SUPPORT-01', 'coach_support', 'P1',
    Object.keys(card.coachSupport).length > 0,
    { fields: Object.keys(card.coachSupport) },
    'Observation, correction, demonstration, and group-management support are complete.')
  add('CARD-SUPPORT-OPS-01', 'support_operations', 'P1',
    Object.keys(card.supportOperations).length > 0
      && card.variants.every((variant) => variant.profiles.every((profile) => (
        Object.keys(profile.supportPrompts).length > 0
      ))),
    { fields: Object.keys(card.supportOperations) },
    'Issue escalation, retention, feedback, and change-impact support are complete.')
  add('CARD-MEDIA-01', 'media', 'P0',
    !readiness.issues.some((issue) => ['approved_video', 'media_review'].includes(issue.code)),
    { approvedVideoUrl: card.approvedVideoUrl, mediaReview: context.mediaReview ?? null },
    'Media is healthy, exact-match, and reviewed for the current card version.')
  const invalidEdges = relationships.filter((edge) => (
    !validateCanonicalRelationship(edge).valid
  ))
  add('CARD-GRAPH-01', 'relationship_graph', 'P1',
    invalidEdges.length === 0,
    { invalidRelationshipIds: invalidEdges.map((edge) => edge.id) },
    'Relationship edges have controlled types, scores, dimensions, and rationale.')
  add('CARD-GRAPH-02', 'relationship_graph', 'P2',
    card.variants.length <= 1 || relationships.some((edge) => edge.review_status === 'approved'),
    { approvedRelationshipCount: relationships.filter((edge) => edge.review_status === 'approved').length },
    'Multi-variant cards have at least one approved graph edge.')
  add('CARD-PUBLISH-01', 'publication', 'P0',
    readiness.ready,
    { readinessIssues: readiness.issues },
    'All canonical publication gates pass.')

  const failed = checks.filter((check) => check.status === 'failed')
  return {
    status: failed.some((check) => ['P0', 'P1'].includes(check.priority))
      ? 'failed'
      : failed.length > 0
        ? 'warning'
        : 'passed',
    checks,
    summary: {
      total: checks.length,
      passed: checks.length - failed.length,
      failed: failed.length,
      p0Failures: failed.filter((check) => check.priority === 'P0').length,
      p1Failures: failed.filter((check) => check.priority === 'P1').length,
      p2Failures: failed.filter((check) => check.priority === 'P2').length,
    },
  }
}
