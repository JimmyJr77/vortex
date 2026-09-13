/** Shared deterministic exercise selection used by generation and librarians.
 * Extracted without changing the legacy selector's scoring or default profile choice.
 * Callers must supply a normalized intent and a facility/release-scoped library.
 */
import { SESSION_PHASE_ORDER, score100, validateExerciseCard } from './canonicalWorkoutContract.js'

function hash32(value) {
  let hash = 2166136261
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function seededJitter(seed, key) {
  return (hash32(`${seed}:${key}`) % 10001) / 10000
}

function list(value) {
  return Array.isArray(value) ? value : []
}

function requiredEquipment(card, profile) {
  const profileEquipment = list(profile?.equipmentRequired)
  const roleEquipment = list(card.equipmentRoles)
    .filter((entry) => ['required', 'safety_support'].includes(entry.role))
    .map((entry) => entry.key)
  const declared = profileEquipment.length > 0
    ? profileEquipment
    : (roleEquipment.length > 0 ? roleEquipment : list(card.equipment?.required))
  return [...new Set(declared.filter((key) => key !== 'none' && key !== 'bodyweight'))]
}

function equipmentQuantityPerStation(card, key) {
  const assignment = list(card.equipmentRoles).find((entry) => (
    entry.key === key && ['required', 'safety_support'].includes(entry.role)
  ))
  return Number(assignment?.quantityPerStation ?? card.equipment?.quantityPerStation?.[key] ?? 1)
}

function canonicalSupervisionCapacity(card) {
  const risk = Math.max(Number(card.difficulty?.technicalComplexity || 1),
    Number(card.taskDemands?.supervisionDemand || 1), Number(card.taskDemands?.failureConsequence || 1))
  return { risk, maxAthletesPerCoach: risk >= 76 ? 2 : risk >= 61 ? 4 : risk >= 41 ? 8 : 16 }
}

function intersection(a, b) {
  const right = new Set(b)
  return a.filter((value) => right.has(value))
}

const MAIN_WORK_PHASES = new Set(['movement_intelligence', 'output', 'capacity', 'resilience'])
const ACCESSORY_PHASES = new Set(['capacity', 'resilience'])
const PREPARE_RESTORE_PHASES = new Set(['prepare_and_access', 'restore'])
const OBJECTIVE_ANCHOR_PHASES = Object.freeze({
  general_athletic_development: ['output', 'capacity'],
  speed_priority: ['output'],
  explosiveness_power_priority: ['output'],
  strength_priority: ['capacity'],
  agility_priority: ['movement_intelligence', 'output'],
  mobility_control_priority: ['resilience'],
  fitness_priority: ['sustained_capacity'],
  recovery_low_intensity: ['resilience'],
})

function focusAppliesToPhase(focus, phaseKey, isAnchor) {
  return focus.scopes.some((scope) => (
    scope === 'whole_session'
    || scope === phaseKey
    || (scope === 'anchor_exercises' && isAnchor)
    || (scope === 'main_work' && MAIN_WORK_PHASES.has(phaseKey))
    || (scope === 'prepare_restore' && PREPARE_RESTORE_PHASES.has(phaseKey))
    || (scope === 'accessories' && ACCESSORY_PHASES.has(phaseKey))
    || (scope === 'conditioning' && phaseKey === 'sustained_capacity')
  ))
}

function approvedTaxonomyAssignments(card, profile) {
  return [
    ...list(card.taxonomyV2?.assignments),
    ...list(card.variantTaxonomyV2?.assignments),
    ...list(profile?.taxonomyV2?.assignments),
  ].filter((assignment) => assignment.reviewStatus === 'approved')
}

function anatomyTerms(card) {
  const values = []
  const visit = (value) => {
    if (Array.isArray(value)) value.forEach(visit)
    else if (value && typeof value === 'object') Object.values(value).forEach(visit)
    else if (typeof value === 'string' && value.trim()) values.push(value.trim())
  }
  visit(card.anatomy)
  visit(card.anatomyProfile)
  return values
}

function compositionTargetMatches(target, card, profile) {
  if (target.targetType === 'variant') {
    return [card.variantId, card.id, card.slug].filter(Boolean).map(String).includes(target.targetKey)
  }
  if (target.targetType === 'definition') return String(card.id) === target.targetKey
  if (target.targetType === 'family') return String(card.familyId) === target.targetKey
  if (target.targetType === 'movement_pattern') return list(card.movementPatterns).includes(target.targetKey)
  if (target.targetType === 'body_region') {
    return [...list(card.bodyRegions), ...anatomyTerms(card)].includes(target.targetKey)
  }
  return approvedTaxonomyAssignments(card, profile).some((assignment) => (
    assignment.facetType === target.facetType && assignment.key === target.targetKey
  ))
}

function compositionConflictReasons(card, profile, phaseKey, selected, executionIndex = null) {
  const reasons = []
  const candidateIndex = executionIndex ?? SESSION_PHASE_ORDER.indexOf(phaseKey)
  for (const entry of selected) {
    if (String(entry.card.variantId ?? entry.card.id) === String(card.variantId ?? card.id)) continue
    const otherIndex = entry.executionIndex ?? SESSION_PHASE_ORDER.indexOf(entry.phaseKey)
    for (const constraint of list(card.compositionProfile?.constraints)) {
      if (!compositionTargetMatches(constraint, entry.card, entry.profile)) continue
      if (constraint.type === 'avoid_same_session') {
        reasons.push(`composition_avoid_same_session:${constraint.targetType}:${constraint.targetKey}`)
      }
      if (constraint.type === 'avoid_after' && candidateIndex > otherIndex) {
        reasons.push(`composition_avoid_after:${constraint.targetType}:${constraint.targetKey}`)
      }
    }
    for (const constraint of list(entry.card.compositionProfile?.constraints)) {
      if (!compositionTargetMatches(constraint, card, profile)) continue
      if (constraint.type === 'avoid_same_session') {
        reasons.push(`composition_avoid_same_session:${constraint.targetType}:${constraint.targetKey}`)
      }
      if (constraint.type === 'avoid_after' && otherIndex > candidateIndex) {
        reasons.push(`composition_avoid_after:${constraint.targetType}:${constraint.targetKey}`)
      }
    }
  }
  return [...new Set(reasons)]
}

function focusMatchesCard(focus, card, profile, phaseKey) {
  if (focus.facet === 'phase') return focus.value === phaseKey
  if (focus.facet === 'exercise') {
    return [card.id, card.variantId, card.slug].map(String).includes(focus.value)
  }
  if (focus.facet === 'equipment') {
    const declared = [
      ...requiredEquipment(card, profile),
      ...list(card.equipmentRoles).map((entry) => entry.key),
      ...list(card.equipment?.optional),
    ]
    if (declared.length === 0) declared.push('none', 'bodyweight')
    return declared.includes(focus.value)
      || (focus.value === 'none' && declared.includes('bodyweight'))
      || (focus.value === 'bodyweight' && declared.includes('none'))
  }
  if (focus.facet === 'movement_pattern') return list(card.movementPatterns).includes(focus.value)
  if (focus.facet === 'body_region') {
    return [...list(card.bodyRegions), ...anatomyTerms(card)].includes(focus.value)
  }
  return approvedTaxonomyAssignments(card, profile).some((assignment) => (
    assignment.facetType === focus.facet && assignment.key === focus.value
  ))
}

function focusMatchesPrescription(focus, item, phaseKey) {
  if (focus.facet === 'phase') return focus.value === phaseKey
  if (focus.facet === 'exercise') {
    return [item.exerciseId, item.variantId, item.exerciseSlug].filter(Boolean).map(String).includes(focus.value)
  }
  if (focus.facet === 'equipment') {
    const equipment = list(item.equipment)
    if (equipment.length === 0) equipment.push('none', 'bodyweight')
    return equipment.includes(focus.value)
      || (focus.value === 'none' && equipment.includes('bodyweight'))
      || (focus.value === 'bodyweight' && equipment.includes('none'))
  }
  if (focus.facet === 'movement_pattern') return list(item.movementPatterns).includes(focus.value)
  if (focus.facet === 'body_region') {
    return [...list(item.bodyRegions), ...anatomyTerms(item)].includes(focus.value)
  }
  return list(item.taxonomyV2Assignments).some((assignment) => (
    assignment.facetType === focus.facet && assignment.key === focus.value
  ))
}

function resolveAnchorPhaseKeys(intent, phaseKeys = SESSION_PHASE_ORDER) {
  const available = new Set(phaseKeys)
  const explicit = new Set()
  for (const focus of intent.focuses) {
    if (focus.strength === 'neutral' || focus.strength === 'exclude') continue
    if (focus.facet === 'phase') explicit.add(focus.value)
    for (const scope of focus.scopes) {
      if (SESSION_PHASE_ORDER.includes(scope)) explicit.add(scope)
    }
  }
  const defaults = OBJECTIVE_ANCHOR_PHASES[intent.objective] ?? OBJECTIVE_ANCHOR_PHASES.general_athletic_development
  const selected = explicit.size > 0 ? [...explicit] : defaults
  return SESSION_PHASE_ORDER.filter((phaseKey) => available.has(phaseKey) && selected.includes(phaseKey))
}

function demandSignature(cards) {
  const unique = (values) => [...new Set(values.filter(Boolean).map(String))]
  return {
    bodyRegions: unique(cards.flatMap((card) => list(card.bodyRegions))),
    anatomy: unique(cards.flatMap(anatomyTerms)),
    movementPatterns: unique(cards.flatMap((card) => list(card.movementPatterns))),
    equipment: unique(cards.flatMap((card) => [
      ...list(card.equipmentRoles).map((entry) => entry.key),
      ...list(card.equipment?.required), ...list(card.equipment?.optional),
    ])),
    movementGeometry: unique(cards.flatMap((card) => Object.values(card.movementGeometry ?? {}).flatMap(list))),
    stressTargets: unique(cards.flatMap((card) => [
      ...list(card.stressProfile?.bodyRegionStress),
      ...list(card.stressProfile?.jointStressTargets),
      ...list(card.stressProfile?.tissueStressTargets),
    ])),
    taxonomy: unique(cards.flatMap((card) => approvedTaxonomyAssignments(card, null).map((entry) => (
      `${entry.facetType}:${entry.key}`
    )))),
  }
}

function demandAlignment(card, signature, phaseKey) {
  if (!signature || !['prepare_and_access', 'movement_intelligence', 'resilience', 'restore'].includes(phaseKey)) return 50
  const pools = [
    [list(card.bodyRegions), signature.bodyRegions],
    [anatomyTerms(card), signature.anatomy],
    [list(card.movementPatterns), signature.movementPatterns],
    [[...list(card.equipment?.required), ...list(card.equipment?.optional)], signature.equipment],
    [Object.values(card.movementGeometry ?? {}).flatMap(list), signature.movementGeometry],
    [[...list(card.stressProfile?.bodyRegionStress), ...list(card.stressProfile?.jointStressTargets), ...list(card.stressProfile?.tissueStressTargets)], signature.stressTargets],
  ].filter(([, anchorValues]) => anchorValues.length > 0)
  if (pools.length === 0) return 50
  const matched = pools.reduce((sum, [candidateValues, anchorValues]) => (
    sum + (intersection(candidateValues, anchorValues).length > 0 ? 1 : 0)
  ), 0)
  return Math.round((matched / pools.length) * 100)
}

function eligibleCard(card, profile, intent, context = {}) {
  const reasons = []
  const phaseKey = context.phaseKey ?? profile?.phaseKey
  const isAnchor = Boolean(context.isAnchor)
  const cardValidation = validateExerciseCard(card)
  if (!cardValidation.valid) reasons.push(...cardValidation.errors.map((error) => `publication_gate:${error}`))
  if (card.status !== 'published') reasons.push('status_not_published')
  if (!profile) reasons.push('delivery_profile_missing')
  if (profile && profile.role === 'avoid') reasons.push('delivery_profile_avoids_phase')
  if (intent.exerciseAvoid.includes(card.id) || intent.exerciseAvoid.includes(card.slug)) reasons.push('explicit_exercise_avoid')
  if (intent.movementAvoid.some((key) => list(card.movementPatterns).includes(key))) reasons.push('movement_avoid')
  if (intent.bodyRegionAvoid.some((key) => list(card.bodyRegions).includes(key))) reasons.push('body_region_avoid')
  const patterns = list(card.movementPatterns)
  if (intent.limitations.includes('no_jumping') && intersection(patterns, ['jump', 'land', 'bound']).length) {
    reasons.push('no_jumping')
  }
  if ((intent.limitations.includes('low_impact') || intent.modifiers.includes('reduce_impact'))
    && Number(card.taskDemands?.impactToleranceDemand ?? 1) > 40) reasons.push('low_impact_cap')

  const equipment = requiredEquipment(card, profile)
  const unavailable = equipment.filter((key) => !intent.equipmentAvailable.includes(key))
  if (unavailable.length) reasons.push(`unavailable_equipment:${unavailable.join(',')}`)
  const avoided = equipment.filter((key) => intent.equipmentAvoid.includes(key))
  if (avoided.length) reasons.push(`avoided_equipment:${avoided.join(',')}`)
  if (intent.modifiers.includes('remove_equipment') && equipment.length) reasons.push('modifier_remove_equipment')
  const stationCapacity = Math.max(1, Number(card.environment?.stationCapacity ?? intent.athleteCount))
  const stationCount = context.equipmentScheduling === 'waves' ? 1 : Math.ceil(intent.athleteCount / stationCapacity)
  const insufficient = equipment.filter((key) => {
    const quantity = intent.equipmentQuantities[key]
    const perStation = equipmentQuantityPerStation(card, key)
    return quantity != null && quantity < stationCount * perStation
  })
  if (insufficient.length) reasons.push(`insufficient_equipment_quantity:${insufficient.join(',')}`)
  if (Number(card.difficulty?.baseOverallDifficulty) > intent.maxDifficulty) reasons.push('difficulty_cap')
  const risk = Math.max(
    Number(card.difficulty?.technicalComplexity || 1),
    Number(card.taskDemands?.supervisionDemand || 1),
    Number(card.taskDemands?.failureConsequence || 1),
  )
  if (risk > intent.maxTechnicalRisk) reasons.push('technical_risk_cap')
  const { maxAthletesPerCoach } = canonicalSupervisionCapacity(card)
  if (intent.athleteCount > intent.coachCount * maxAthletesPerCoach) reasons.push('coach_supervision_capacity')
  if (card.population?.ageMin != null && intent.ageMin < card.population.ageMin) reasons.push('minimum_age')
  if (card.population?.ageMax != null && intent.ageMax > card.population.ageMax) reasons.push('maximum_age')
  if (card.population?.trainingAgeMonthsMin != null && intent.trainingAgeMonths < card.population.trainingAgeMonthsMin) {
    reasons.push('training_age')
  }
  if (intent.athleteCohorts.length > 0) {
    for (const cohort of intent.athleteCohorts) {
      if (!profile?.scalingByCohort?.[cohort.key]) reasons.push(`missing_cohort_scaling:${cohort.key}`)
      if (Number(card.difficulty?.baseOverallDifficulty) > cohort.maxDifficulty) {
        reasons.push(`cohort_difficulty_cap:${cohort.key}`)
      }
    }
  }
  for (const modifier of intent.modifiers) {
    if (!list(profile?.modifierKeys).includes(modifier)) reasons.push(`invalid_modifier:${modifier}`)
  }
  if (intent.objective === 'fitness_priority'
    && Number(card.difficulty?.technicalComplexity) > 60
    && profile?.phaseKey === 'sustained_capacity') reasons.push('hiit_technical_complexity')
  if (card.environment?.environment && !list(card.environment.environment).includes(intent.space.environment)) {
    reasons.push('environment')
  }
  if (card.environment?.floorAreaSquareFeet && intent.space.floorAreaSquareFeet != null
    && card.environment.floorAreaSquareFeet > intent.space.floorAreaSquareFeet) reasons.push('floor_space')
  if (card.environment?.laneLengthFeet && intent.space.laneLengthFeet != null
    && card.environment.laneLengthFeet > intent.space.laneLengthFeet) reasons.push('lane_length')
  for (const focus of intent.focuses) {
    if (focus.facet === 'phase' || !focusAppliesToPhase(focus, phaseKey, isAnchor)) continue
    const matches = focusMatchesCard(focus, card, profile, phaseKey)
    if (focus.strength === 'required' && !matches) reasons.push(`required_focus:${focus.facet}:${focus.value}`)
    if (focus.strength === 'exclude' && matches) reasons.push(`excluded_focus:${focus.facet}:${focus.value}`)
  }
  return [...new Set(reasons)]
}

function candidateScore(card, profile, intent, context = {}) {
  const phaseKey = context.phaseKey ?? profile.phaseKey
  const isAnchor = Boolean(context.isAnchor)
  const applicablePreferences = intent.focuses.filter((focus) => (
    focus.facet !== 'phase'
    && ['strong_preference', 'preferred'].includes(focus.strength)
    && focusAppliesToPhase(focus, phaseKey, isAnchor)
  ))
  const preferenceWeight = applicablePreferences.reduce((sum, focus) => sum + focus.weight, 0)
  const matchedPreferenceWeight = applicablePreferences.reduce((sum, focus) => (
    sum + (focusMatchesCard(focus, card, profile, phaseKey) ? focus.weight : 0)
  ), 0)
  const components = {
    phaseSuitability: score100(profile.phaseSuitability, { nullable: false, field: 'phaseSuitability' }),
    objectiveRelevance: score100(
      profile.objectiveRelevance?.[intent.objective] ?? profile.objectiveRelevance?.default ?? 50,
      { nullable: false, field: 'objectiveRelevance' },
    ),
    athleteCompatibility: score100(
      card.population?.athleteCompatibility ?? 70,
      { nullable: false, field: 'athleteCompatibility' },
    ),
    methodologyAlignment: score100(profile.methodologyAlignment ?? 70, {
      nullable: false,
      field: 'methodologyAlignment',
    }),
    focusAlignment: preferenceWeight > 0
      ? Math.round((matchedPreferenceWeight / preferenceWeight) * 100)
      : 50,
    anchorDemandAlignment: demandAlignment(card, context.anchorDemandSignature, phaseKey),
  }
  let score = (
    components.phaseSuitability * 0.4
    + components.objectiveRelevance * 0.3
    + components.athleteCompatibility * 0.2
    + components.methodologyAlignment * 0.1
  )
  if (preferenceWeight > 0) score += (components.focusAlignment - 50) * 0.2
  if (context.anchorDemandSignature) score += (components.anchorDemandAlignment - 50) * 0.12
  if (intent.exerciseInclude.includes(card.id) || intent.exerciseInclude.includes(card.slug)) score += 15
  if (intersection(requiredEquipment(card, profile), intent.equipmentRequired).length) score += 12
  if (intent.recentExerciseIds.includes(card.id) || intent.recentExerciseIds.includes(card.slug)) score -= 20
  score = Math.max(1, Math.min(100, score))
  return { score: Math.round(score * 100) / 100, components }
}

function phaseCandidates(library, phase, intent, rejectionCounts, context = {}, options = {}) {
  const candidates = []
  for (const card of library) {
    const profiles = options.allProfiles
      ? list(card.deliveryProfiles).filter((entry) => entry.phaseKey === phase.phaseKey)
      : [list(card.deliveryProfiles).find((entry) => entry.phaseKey === phase.phaseKey)]
    if (profiles.length === 0) profiles.push(undefined)
    for (const profile of profiles) {
      const candidateContext = { ...context, phaseKey: phase.phaseKey }
      const reasons = eligibleCard(card, profile, intent, candidateContext)
      if (reasons.length) {
        for (const reason of reasons) rejectionCounts[reason] = (rejectionCounts[reason] ?? 0) + 1
        options.onRejected?.({ card, profile, phaseKey: phase.phaseKey, reasons })
        continue
      }
      const scoring = candidateScore(card, profile, intent, candidateContext)
      candidates.push({
        card,
        profile,
        ...scoring,
        jitter: seededJitter(intent.randomSeed, `${phase.phaseKey}:${card.id}:${profile.id}`),
      })
    }
  }
  return candidates.sort((a, b) => b.score - a.score || b.jitter - a.jitter || String(a.card.id).localeCompare(String(b.card.id)))
}

export {
  canonicalSupervisionCapacity,
  hash32,
  list,
  requiredEquipment,
  equipmentQuantityPerStation,
  focusAppliesToPhase,
  approvedTaxonomyAssignments,
  compositionConflictReasons,
  focusMatchesCard,
  focusMatchesPrescription,
  resolveAnchorPhaseKeys,
  demandSignature,
  eligibleCard,
  candidateScore,
  phaseCandidates,
}
