const list = (value) => Array.isArray(value) ? value : []
const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {}
const text = (value) => typeof value === 'string' ? value.trim() : ''
const unique = (value) => [...new Set(list(value).map(text).filter(Boolean))]

export const MOVEMENT_GEOMETRY_FIELDS = Object.freeze({
  planes: Object.freeze(['sagittal', 'frontal', 'transverse', 'multiplanar']),
  projections: Object.freeze(['vertical', 'horizontal', 'diagonal', 'rotational']),
  directions: Object.freeze(['forward', 'backward', 'lateral', 'multidirectional']),
  supports: Object.freeze(['bilateral', 'unilateral', 'alternating']),
  stances: Object.freeze(['square', 'split', 'staggered', 'tandem']),
  limbRelationships: Object.freeze(['symmetrical', 'asymmetrical', 'ipsilateral', 'contralateral']),
})

export const ANATOMY_ASSIGNMENT_KINDS = Object.freeze([
  'body_region', 'joint', 'muscle', 'tissue', 'joint_action', 'muscle_action',
])

export const ANATOMY_ASSIGNMENT_ROLES = Object.freeze([
  'primary_target', 'secondary_target', 'stabilizer', 'mobility_target', 'stress_exposure',
])

export const EQUIPMENT_ASSIGNMENT_ROLES = Object.freeze([
  'required', 'optional', 'substitute', 'measurement', 'safety_support',
])

export const TASK_DEMAND_FIELDS = Object.freeze([
  'strengthDemand',
  'powerDemand',
  'mobilityDemand',
  'balanceDemand',
  'coordinationDemand',
  'conditioningDemand',
  'impactToleranceDemand',
  'eccentricControlDemand',
  'bodyControlDemand',
  'perceptualDemand',
  'attentionDemand',
  'supervisionDemand',
  'failureConsequence',
])

export const STRESS_SCORE_FIELDS = Object.freeze([
  'jointStress',
  'tissueStress',
  'neuralDemand',
  'impactStress',
  'localMuscularFatigue',
  'systemicFatigue',
  'gripFatigue',
  'conditioningFatigue',
  'recoveryCost',
])

export const SCALING_DIMENSIONS = Object.freeze([
  'external_load', 'range_of_motion', 'movement_velocity', 'height', 'impact',
  'stability', 'base_of_support', 'complexity', 'coordination', 'reactive_uncertainty',
  'assistance', 'resistance', 'volume', 'work_duration', 'rest_duration', 'distance',
  'contacts', 'partner_pressure', 'laterality',
])

export const SCALING_BOUNDARIES = Object.freeze([
  'prescription', 'delivery_profile', 'exact_variant', 'exercise_definition',
])

/**
 * Legacy composition fields remain reviewer-readable guidance. Only these
 * explicit constraints are deterministic generator inputs after independent
 * structured-profile review.
 */
export const COMPOSITION_CONSTRAINT_TYPES = Object.freeze([
  'avoid_same_session',
  'avoid_after',
])

export const COMPOSITION_TARGET_TYPES = Object.freeze([
  'variant',
  'definition',
  'family',
  'movement_pattern',
  'body_region',
  'taxonomy',
])

function nullableScore(value, field, { allowZero = false } = {}) {
  if (value == null || value === '') return null
  const parsed = Number(value)
  const minimum = allowZero ? 0 : 1
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > 100) {
    throw new RangeError(`${field} must be null or an integer from ${minimum} to 100.`)
  }
  return parsed
}

function controlledList(raw, allowed, field) {
  const values = unique(raw)
  const invalid = values.filter((value) => !allowed.includes(value))
  if (invalid.length) throw new TypeError(`Unknown ${field}: ${invalid.join(', ')}.`)
  return values
}

export function normalizeMovementGeometry(raw = {}, fallbackAnatomy = {}) {
  const geometry = object(raw)
  const laterality = text(fallbackAnatomy.laterality)
  // `anatomy.planes` predates the controlled v2 movement-geometry vocabulary
  // and may contain descriptive prose such as "sagittal_primary". It is a
  // compatibility fallback only: preserve that prose in anatomy, but never
  // treat it as an authored controlled geometry assignment. Explicit v2
  // geometry remains strict and rejects unknown keys.
  const fallbackPlanes = unique(fallbackAnatomy.planes)
    .filter((value) => MOVEMENT_GEOMETRY_FIELDS.planes.includes(value))
  return {
    planes: controlledList(geometry.planes ?? fallbackPlanes, MOVEMENT_GEOMETRY_FIELDS.planes, 'movement plane'),
    projections: controlledList(geometry.projections, MOVEMENT_GEOMETRY_FIELDS.projections, 'movement projection'),
    directions: controlledList(geometry.directions, MOVEMENT_GEOMETRY_FIELDS.directions, 'movement direction'),
    supports: controlledList(
      geometry.supports ?? (['bilateral', 'unilateral', 'alternating'].includes(laterality) ? [laterality] : []),
      MOVEMENT_GEOMETRY_FIELDS.supports,
      'movement support',
    ),
    stances: controlledList(geometry.stances, MOVEMENT_GEOMETRY_FIELDS.stances, 'movement stance'),
    limbRelationships: controlledList(
      geometry.limbRelationships ?? (MOVEMENT_GEOMETRY_FIELDS.limbRelationships.includes(laterality) ? [laterality] : []),
      MOVEMENT_GEOMETRY_FIELDS.limbRelationships,
      'limb relationship',
    ),
  }
}

function anatomyFallbackAssignments(anatomy) {
  const rows = []
  const add = (values, kind, role) => unique(values).forEach((key) => rows.push({ key, kind, role }))
  add(anatomy.primaryMuscles, 'muscle', 'primary_target')
  add(anatomy.secondaryMuscles, 'muscle', 'secondary_target')
  add(anatomy.stabilizers, 'muscle', 'stabilizer')
  add(anatomy.joints, 'joint', 'secondary_target')
  add(anatomy.jointActions, 'joint_action', 'secondary_target')
  return rows
}

export function normalizeAnatomyProfile(raw = {}, fallbackAnatomy = {}) {
  const source = list(object(raw).assignments).length > 0
    ? list(object(raw).assignments)
    : anatomyFallbackAssignments(fallbackAnatomy)
  const seen = new Set()
  const assignments = source.map((entry, index) => {
    const key = text(entry.key)
    const kind = text(entry.kind)
    const role = text(entry.role)
    if (!key) throw new TypeError(`anatomyProfile.assignments[${index}].key is required.`)
    if (!ANATOMY_ASSIGNMENT_KINDS.includes(kind)) throw new TypeError(`Unknown anatomy assignment kind: ${kind}.`)
    if (!ANATOMY_ASSIGNMENT_ROLES.includes(role)) throw new TypeError(`Unknown anatomy assignment role: ${role}.`)
    const identity = `${kind}:${key}:${role}`
    if (seen.has(identity)) throw new TypeError(`Duplicate anatomy assignment: ${identity}.`)
    seen.add(identity)
    return { key, kind, role }
  })
  return { assignments }
}

export function normalizeEquipmentRoles(raw, fallback = {}) {
  const supplied = list(raw)
  const source = supplied.length > 0 ? supplied : [
    ...unique(fallback.required).map((key) => ({ key, role: 'required' })),
    ...unique(fallback.optional).map((key) => ({ key, role: 'optional' })),
  ]
  const seen = new Set()
  return source.map((entry, index) => {
    const key = text(entry.key)
    const role = text(entry.role)
    const quantityPerStation = entry.quantityPerStation == null ? null : Number(entry.quantityPerStation)
    if (!key) throw new TypeError(`equipmentRoles[${index}].key is required.`)
    if (!EQUIPMENT_ASSIGNMENT_ROLES.includes(role)) throw new TypeError(`Unknown equipment role: ${role}.`)
    if (quantityPerStation != null && (!Number.isInteger(quantityPerStation) || quantityPerStation < 0 || quantityPerStation > 1000)) {
      throw new RangeError(`equipmentRoles[${index}].quantityPerStation must be null or an integer from 0 to 1000.`)
    }
    const identity = `${key}:${role}`
    if (seen.has(identity)) throw new TypeError(`Duplicate equipment assignment: ${identity}.`)
    seen.add(identity)
    return { key, role, quantityPerStation, conditions: object(entry.conditions) }
  })
}

const LEGACY_TASK_DEMAND_FIELDS = Object.freeze({
  strengthDemand: ['strengthDemand', 'relativeStrengthDemand'],
  powerDemand: ['powerDemand', 'speedDemand'],
  mobilityDemand: ['mobilityDemand'],
  balanceDemand: ['balanceDemand'],
  coordinationDemand: ['coordinationDemand'],
  conditioningDemand: ['conditioningDemand', 'workCapacityDemand'],
  impactToleranceDemand: ['impactToleranceDemand', 'impact'],
  eccentricControlDemand: ['eccentricControlDemand', 'eccentricTissueStress'],
  bodyControlDemand: ['bodyControlDemand', 'stabilityDemand'],
  perceptualDemand: ['perceptualDemand', 'decisionDemand'],
  attentionDemand: ['attentionDemand'],
  supervisionDemand: ['supervisionDemand'],
  failureConsequence: ['failureConsequence'],
})

export function normalizeTaskDemands(raw = {}, legacyDifficulty = {}) {
  const source = object(raw)
  return Object.fromEntries(TASK_DEMAND_FIELDS.map((field) => {
    const fallbackKey = LEGACY_TASK_DEMAND_FIELDS[field].find((key) => legacyDifficulty[key] != null)
    return [field, nullableScore(source[field] ?? (fallbackKey ? legacyDifficulty[fallbackKey] : null), `taskDemands.${field}`)]
  }))
}

export function normalizeStressProfile(raw = {}, { loadProfile = {}, fatigueProfile = {}, taskDemands = {} } = {}) {
  const source = object(raw)
  const recoveryHours = Number(fatigueProfile.recoveryHours)
  const fallbacks = {
    jointStress: taskDemands.failureConsequence,
    tissueStress: loadProfile.eccentricStress,
    neuralDemand: taskDemands.powerDemand,
    impactStress: taskDemands.impactToleranceDemand,
    localMuscularFatigue: fatigueProfile.localMuscleFatigue,
    systemicFatigue: taskDemands.conditioningDemand,
    gripFatigue: fatigueProfile.gripFatigue,
    conditioningFatigue: taskDemands.conditioningDemand,
    recoveryCost: fatigueProfile.recoveryHours == null || !Number.isFinite(recoveryHours)
      ? null
      : Math.max(1, Math.min(100, Math.round(recoveryHours / 1.68))),
  }
  return {
    ...Object.fromEntries(STRESS_SCORE_FIELDS.map((field) => [
      field,
      nullableScore(source[field] ?? fallbacks[field], `stressProfile.${field}`),
    ])),
    bodyRegionStress: unique(source.bodyRegionStress),
    jointStressTargets: unique(source.jointStressTargets),
    tissueStressTargets: unique(source.tissueStressTargets),
  }
}

export function normalizeScalingHandles(raw) {
  return list(raw).map((entry, index) => {
    const dimension = text(entry.dimension)
    const boundary = text(entry.boundary)
    if (!SCALING_DIMENSIONS.includes(dimension)) throw new TypeError(`Unknown scaling dimension: ${dimension}.`)
    if (!SCALING_BOUNDARIES.includes(boundary)) throw new TypeError(`Unknown scaling boundary: ${boundary}.`)
    const easier = text(entry.easier) || null
    const harder = text(entry.harder) || null
    if (!easier && !harder) throw new TypeError(`scalingHandles[${index}] needs an easier or harder instruction.`)
    return { dimension, boundary, easier, harder, limits: object(entry.limits) }
  })
}

export function normalizeCompositionProfile(raw = {}, legacyProgramming = {}) {
  const source = object(raw)
  const sequence = object(legacyProgramming.sequenceRules)
  const pairing = object(legacyProgramming.pairingCompatibility)
  const constraints = list(source.constraints).map((entry, index) => {
    const rule = object(entry)
    const type = text(rule.type)
    const targetType = text(rule.targetType ?? rule.target_type)
    const targetKey = text(rule.targetKey ?? rule.target_key)
    const facetType = text(rule.facetType ?? rule.facet_type) || null
    if (!COMPOSITION_CONSTRAINT_TYPES.includes(type)) {
      throw new TypeError(`Unknown composition constraints[${index}].type: ${type}.`)
    }
    if (!COMPOSITION_TARGET_TYPES.includes(targetType)) {
      throw new TypeError(`Unknown composition constraints[${index}].targetType: ${targetType}.`)
    }
    if (!targetKey) throw new TypeError(`composition constraints[${index}].targetKey is required.`)
    if (targetType === 'taxonomy' && !facetType) {
      throw new TypeError(`composition constraints[${index}].facetType is required for a taxonomy target.`)
    }
    if (targetType !== 'taxonomy' && facetType) {
      throw new TypeError(`composition constraints[${index}].facetType is only valid for a taxonomy target.`)
    }
    return { type, targetType, targetKey, ...(facetType ? { facetType } : {}) }
  })
  const constraintKeys = constraints.map((entry) => (
    `${entry.type}:${entry.targetType}:${entry.facetType ?? ''}:${entry.targetKey}`
  ))
  if (new Set(constraintKeys).size !== constraintKeys.length) {
    throw new TypeError('Duplicate composition constraints are not allowed.')
  }
  return {
    preparesFor: unique(source.preparesFor ?? sequence.preferredBefore),
    preferredAfter: unique(source.preferredAfter ?? sequence.preferredAfter),
    avoidAfter: unique(source.avoidAfter ?? sequence.avoidAfter),
    avoidSameSession: unique(source.avoidSameSession ?? pairing.incompatible),
    pairsWith: unique(source.pairsWith ?? pairing.recommended),
    acceptablePairs: unique(source.acceptablePairs ?? pairing.acceptable),
    interferenceRules: list(source.interferenceRules ?? legacyProgramming.interferenceRules)
      .map((entry) => object(entry)),
    constraints,
  }
}

export function normalizeStructuredProfileReview(raw = {}) {
  const source = object(raw)
  const reviewStatus = text(source.reviewStatus ?? source.review_status) || 'suggested'
  if (!['suggested', 'review', 'approved', 'rejected'].includes(reviewStatus)) {
    throw new TypeError(`Unknown structured profile review status: ${reviewStatus}.`)
  }
  const reviewedBy = source.reviewedBy ?? source.reviewed_by ?? null
  const reviewedAt = source.reviewedAt ?? source.reviewed_at ?? null
  if (reviewStatus === 'approved' && (reviewedBy == null || !reviewedAt)) {
    throw new TypeError('Approved structured profiles require an independent reviewer and review timestamp.')
  }
  return {
    reviewStatus,
    provenance: object(source.provenance),
    ...(reviewStatus === 'approved' ? { reviewedBy, reviewedAt } : {}),
  }
}

export function normalizeExactVariantProfile(raw = {}, fallbacks = {}) {
  const source = object(raw)
  const taskDemands = normalizeTaskDemands(source.taskDemands, fallbacks.difficulty)
  return {
    movementGeometry: normalizeMovementGeometry(source.movementGeometry, fallbacks.anatomy),
    anatomyProfile: normalizeAnatomyProfile(source.anatomyProfile, fallbacks.anatomy),
    equipmentRoles: normalizeEquipmentRoles(source.equipmentRoles, fallbacks.equipment),
    taskDemands,
    stressProfile: normalizeStressProfile(source.stressProfile, {
      loadProfile: fallbacks.loadProfile,
      fatigueProfile: fallbacks.fatigueProfile,
      taskDemands,
    }),
    scalingHandles: normalizeScalingHandles(source.scalingHandles),
    compositionProfile: normalizeCompositionProfile(source.compositionProfile, fallbacks.programming),
    structuredProfileReview: normalizeStructuredProfileReview(source.structuredProfileReview),
  }
}

export function structuredProfileCompleteness(variant, { requireApproved = true } = {}) {
  const issues = []
  const hasOwn = (value, field) => Object.prototype.hasOwnProperty.call(object(value), field)
  const geometry = variant.movementGeometry ?? {}
  if (list(geometry.planes).length === 0) issues.push({ field: 'movementGeometry.planes', code: 'missing' })
  if (list(variant.anatomyProfile?.assignments).length === 0) issues.push({ field: 'anatomyProfile.assignments', code: 'missing' })
  if (list(variant.equipmentRoles).length === 0) issues.push({ field: 'equipmentRoles', code: 'missing' })
  for (const field of TASK_DEMAND_FIELDS) {
    if (!hasOwn(variant.taskDemands, field)) issues.push({ field: `taskDemands.${field}`, code: 'missing' })
  }
  for (const field of STRESS_SCORE_FIELDS) {
    if (!hasOwn(variant.stressProfile, field)) issues.push({ field: `stressProfile.${field}`, code: 'missing' })
  }
  if (list(variant.scalingHandles).length === 0) issues.push({ field: 'scalingHandles', code: 'missing' })
  if (Object.keys(object(variant.compositionProfile)).length === 0) issues.push({ field: 'compositionProfile', code: 'missing' })
  if (requireApproved && variant.structuredProfileReview?.reviewStatus !== 'approved') {
    issues.push({ field: 'structuredProfileReview', code: 'review_required' })
  }
  return { complete: issues.length === 0, issues }
}
