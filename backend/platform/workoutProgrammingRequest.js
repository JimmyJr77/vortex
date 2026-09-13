import Joi from 'joi'
import { createHash } from 'node:crypto'
import { normalizeWorkoutIntent } from './canonicalWorkoutContract.js'
import { normalizeSessionComponentPlan, SESSION_COMPONENT_ORDER } from './sessionComponentContract.js'
import { TAXONOMY_V2_FACETS, taxonomyV2Term } from './taxonomyV2.js'
import { libraryScopeId } from './coachingLibraryContext.js'

export const PROGRAMMING_REQUEST_VERSION = '1.0.0'
export const PROGRAMMING_AUTONOMY_MODES = Object.freeze(['generate_for_me', 'guided', 'coach_directed', 'modify_existing'])
export const CANONICAL_UUID_SCHEMA = Joi.string().pattern(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
const id = Joi.string().custom((value, helpers) => {
  try { return libraryScopeId(value, 'database ID') } catch { return helpers.error('any.invalid') }
})
const text = (max = 1000) => Joi.string().trim().max(max)
const strings = (max = 100) => Joi.array().items(text(200)).max(max).unique().default([])
const ids = () => Joi.array().items(id).max(100).unique().default([])
const uuidList = () => Joi.array().items(CANONICAL_UUID_SCHEMA).max(100).unique().default([])
export const PROGRAMMING_EVIDENCE_KINDS = Object.freeze(['skill_progress', 'assessment_result', 'gymnastics_evaluation', 'wellness_checkin', 'session', 'completion_log'])
const evidenceReference = Joi.object({ kind: Joi.string().valid(...PROGRAMMING_EVIDENCE_KINDS).required(), id: id.required(), memberId: id.required(),
  expectedSourceHash: Joi.string().hex().length(64),
})

export function immutableProgrammingValue(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(immutableProgrammingValue)
    Object.freeze(value)
  }
  return value
}

export function programmingValueHash(value) {
  const ordered = (item) => Array.isArray(item) ? item.map(ordered)
    : item && typeof item === 'object' ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, ordered(item[key])])) : item
  return createHash('sha256').update(JSON.stringify(ordered(value))).digest('hex')
}

export function parseProgrammingContract(schema, raw, label) {
  const { error, value } = schema.validate(structuredClone(raw), { convert: false, abortEarly: false, allowUnknown: false })
  if (error) throw Object.assign(new TypeError(`${label}: ${error.details.map((entry) => entry.message).join('; ')}`), { code: 'invalid_staff_contract' })
  return value
}

export const EXERCISE_REFERENCE_SCHEMA = Joi.object({
  exerciseCardId: CANONICAL_UUID_SCHEMA.required(), variantId: CANONICAL_UUID_SCHEMA.required(),
  deliveryProfileId: CANONICAL_UUID_SCHEMA.required(), cardVersion: Joi.number().integer().min(1).required(),
})
export const PRIORITY_SCHEMA = Joi.object({
  facet: Joi.string().valid(...Object.keys(TAXONOMY_V2_FACETS)).required(),
  value: text(120).required(), strength: Joi.string().valid('required', 'preferred', 'exclude').required(),
  weight: Joi.number().integer().min(1).max(100).default(70),
})
const priorities = () => Joi.array().items(PRIORITY_SCHEMA).max(30).default([])
const equipmentPreferences = Joi.object({ allowed: Joi.array().items(text(200)).max(100).unique(), preferred: strings(), excluded: strings() }).default()
const references = () => Joi.array().items(EXERCISE_REFERENCE_SCHEMA).max(30).unique('deliveryProfileId').default([])
const componentSchema = Joi.object({
  key: Joi.string().valid(...SESSION_COMPONENT_ORDER).required(),
  selection: Joi.string().valid('auto', 'directed').default('auto'),
  budgetSeconds: Joi.number().integer().min(0).max(14400).allow(null).default(null),
  priorities: priorities(), equipment: equipmentPreferences,
  preferredProgrammingMethodIds: ids(), excludedProgrammingMethodIds: ids(),
  preferredExercises: references(), excludedExerciseCardIds: uuidList(),
  lockedProgrammingMethodIds: ids(), lockedExercises: references(),
  lockedBlocks: Joi.array().items(Joi.object({
    blockId: text(120).required(), fields: Joi.array().items(Joi.string().valid('method', 'exercises', 'dose', 'timing')).min(1).unique().required(),
  })).max(30).unique('blockId').default([]),
})
const athleteSchema = Joi.object({
  key: text(80).required(), athleteCount: Joi.number().integer().min(1).max(100).required(),
  ageMin: Joi.number().integer().min(5).max(99).required(), ageMax: Joi.number().integer().min(5).max(99).required(),
  trainingExperience: Joi.string().valid('beginner', 'intermediate', 'advanced').required(),
  trainingAgeMonths: Joi.number().integer().min(0).max(1200).allow(null).default(null),
  sportIds: ids(), maturityNotes: text(1000).allow(null).default(null),
  limitations: strings(), competencyEvidenceIds: ids(), recentSessionIds: uuidList(),
  memberIds: ids(), evidenceReferences: Joi.array().items(evidenceReference).max(100).unique((a, b) => a.kind === b.kind && a.id === b.id && a.memberId === b.memberId).default([]),
  readiness: Joi.object({ observedAt: Joi.string().isoDate().required(), notes: text(2000).required(), sourceRecordIds: ids() }).allow(null).default(null),
})
const requestSchema = Joi.object({
  schemaVersion: Joi.string().valid(PROGRAMMING_REQUEST_VERSION).default(PROGRAMMING_REQUEST_VERSION),
  requestId: text(120).required(), revision: text(120).required(),
  mode: Joi.string().valid(...PROGRAMMING_AUTONOMY_MODES).required(), instruction: text(4000).allow('').default(''),
  athletes: Joi.array().items(athleteSchema).min(1).max(20).unique('key').required(),
  logistics: Joi.object({
    sessionDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow(null).default(null),
    sessionStartsAt: Joi.string().isoDate().allow(null).default(null),
    athleticMinutes: Joi.number().integer().min(15).max(240).required(),
    tumblingMinutes: Joi.number().integer().min(0).max(120).default(0),
    totalBookedMinutes: Joi.number().integer().min(15).max(240).required(),
    timerAvailable: Joi.boolean().allow(null).default(null), scoreTrackingAvailable: Joi.boolean().allow(null).default(null),
    clearRunoutConfirmed: Joi.boolean().allow(null).default(null),
    coachCount: Joi.number().integer().min(1).max(20).required(), laneCount: Joi.number().integer().min(0).max(100).required(),
    stationCount: Joi.number().integer().min(1).max(100).required(),
    space: Joi.object({ environment: Joi.string().valid('indoor', 'outdoor').default('indoor'),
      floorAreaSquareFeet: Joi.number().integer().min(1).allow(null).default(null),
      laneLengthFeet: Joi.number().integer().min(1).allow(null).default(null),
    }).default(),
  }).required(),
  equipment: Joi.object({ available: strings().required(), quantities: Joi.object().pattern(Joi.string(), Joi.number().integer().min(0).max(1000).allow(null)).default({}),
    excluded: strings(), preferred: strings(), required: strings(),
  }).required(),
  objective: text(120).default('general_athletic_development'), priorities: priorities(),
  components: Joi.array().items(componentSchema).max(5).unique('key').default([]),
  preferredProgrammingMethodIds: ids(), excludedProgrammingMethodIds: ids(),
  preferredExercises: references(), excludedExerciseCardIds: uuidList(),
  consultants: Joi.array().items(Joi.string().pattern(/^[a-z0-9][a-z0-9_/-]{0,79}$/)).max(3).unique().default([]),
  modification: Joi.object({ workoutId: CANONICAL_UUID_SCHEMA.required(), expectedRevision: text(120).required(),
    regenerateComponentKeys: Joi.array().items(Joi.string().valid(...SESSION_COMPONENT_ORDER)).min(1).max(5).unique().allow(null).default(null),
    blockEdits: Joi.array().max(52).unique('blockId').items(Joi.object({ blockId: text(120).required(),
      exercise: EXERCISE_REFERENCE_SCHEMA, programmingMethodId: id,
      dose: Joi.object({ sets: Joi.number().integer().min(1).max(100), reps: Joi.number().integer().min(1).max(1000).allow(null),
        workSeconds: Joi.number().integer().min(1).max(3600), restSeconds: Joi.number().integer().min(0).max(3600) }).min(1),
    }).or('exercise', 'programmingMethodId', 'dose')).default([]),
  }).allow(null).default(null),
  randomSeed: text(120).default('vortex-staff'),
})

function validatePriorities(entries, label) {
  const seen = new Set()
  for (const entry of entries) {
    if (!taxonomyV2Term(entry.facet, entry.value)) throw new TypeError(`${label} contains unknown taxonomy ${entry.facet}:${entry.value}`)
    const key = `${entry.facet}:${entry.value}`
    if (seen.has(key)) throw new RangeError(`${label} repeats or contradicts ${key}`)
    seen.add(key)
  }
}

function assertNotExcluded(preferred, excluded, label) {
  if (preferred.some((entry) => excluded.includes(entry))) throw new RangeError(`${label} cannot be both selected/preferred and excluded`)
}

/** Coach truth is parsed once and frozen. Model decisions never replace it. */
export function normalizeCoachWorkoutRequest(raw) {
  const request = parseProgrammingContract(requestSchema, raw, 'coach workout request')
  const { athleticMinutes, tumblingMinutes, totalBookedMinutes } = request.logistics
  if (athleticMinutes + tumblingMinutes !== totalBookedMinutes) throw new RangeError('Athletic and tumbling minutes must equal total booked minutes')
  if (request.athletes.reduce((sum, cohort) => sum + cohort.athleteCount, 0) > 100) throw new RangeError('Total athlete count exceeds 100')
  for (const cohort of request.athletes) if (cohort.ageMin > cohort.ageMax) throw new RangeError(`${cohort.key}: ageMin exceeds ageMax`)
  const boundMembers = new Set()
  for (const cohort of request.athletes) {
    if (cohort.memberIds.length && cohort.memberIds.length !== cohort.athleteCount) throw new RangeError(`${cohort.key}: roster must bind every athlete in the cohort`)
    for (const memberId of cohort.memberIds) {
      if (boundMembers.has(memberId)) throw new RangeError('A member cannot appear in multiple cohorts')
      boundMembers.add(memberId)
    }
    if (cohort.evidenceReferences.some((entry) => !cohort.memberIds.includes(entry.memberId))) throw new RangeError(`${cohort.key}: evidence must belong to a bound cohort member`)
  }
  if (request.athletes.reduce((total, cohort) => total + cohort.evidenceReferences.length, 0) > 100) throw new RangeError('Session evidence references exceed 100')
  if (request.logistics.sessionDate && (Number.isNaN(Date.parse(request.logistics.sessionDate))
    || new Date(request.logistics.sessionDate).toISOString().slice(0, 10) !== request.logistics.sessionDate)) throw new RangeError('Session date must be a real calendar date')
  if (request.logistics.sessionStartsAt) {
    if (!/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(request.logistics.sessionStartsAt)) throw new RangeError('Session start requires an explicit time zone offset')
    request.logistics.sessionStartsAt = new Date(request.logistics.sessionStartsAt).toISOString()
    const date = request.logistics.sessionStartsAt.slice(0, 10)
    if (request.logistics.sessionDate && request.logistics.sessionDate !== date) throw new RangeError('Session date must match the UTC date of its explicit start')
    request.logistics.sessionDate = date
  }
  if ((request.mode === 'modify_existing') !== Boolean(request.modification)) throw new RangeError('Modify Existing requires a source workout and expected revision; other modes cannot set modification')
  if (request.mode === 'modify_existing' && !request.instruction) throw new TypeError('Modify Existing requires a coach instruction')
  validatePriorities(request.priorities, 'session priorities')
  assertNotExcluded(request.preferredProgrammingMethodIds, request.excludedProgrammingMethodIds, 'programming methods')
  assertNotExcluded(request.preferredExercises.map((ref) => ref.exerciseCardId), request.excludedExerciseCardIds, 'exercises')
  const components = SESSION_COMPONENT_ORDER.filter((key) => key !== 'body_control' || tumblingMinutes > 0).map((key) => {
    const component = request.components.find((entry) => entry.key === key)
      ?? parseProgrammingContract(componentSchema, { key }, 'component')
    if (key === 'body_control') {
      if (component.budgetSeconds !== null && component.budgetSeconds !== tumblingMinutes * 60) throw new RangeError('Body Control budget must match booked tumbling time')
      component.budgetSeconds = tumblingMinutes * 60
    }
    if (component.budgetSeconds === 0 && key !== 'capacity_competition') throw new RangeError(`Cannot omit ${key} from an athletic-development session`)
    if (component.budgetSeconds === 0 && (component.lockedExercises.length || component.lockedProgrammingMethodIds.length
      || component.lockedBlocks.length || component.priorities.some((priority) => priority.strength === 'required'))) {
      throw new RangeError('An omitted Capacity component cannot contain locked work or required priorities')
    }
    validatePriorities(component.priorities, `${key} priorities`)
    const globalExcludes = request.priorities.filter((entry) => entry.strength === 'exclude')
    for (const priority of component.priorities) {
      if (priority.strength !== 'exclude' && globalExcludes.some((entry) => entry.facet === priority.facet && entry.value === priority.value)) {
        throw new RangeError(`${key} priority contradicts a session exclusion`)
      }
    }
    const excludedMethods = [...request.excludedProgrammingMethodIds, ...component.excludedProgrammingMethodIds]
    const excludedExercises = [...request.excludedExerciseCardIds, ...component.excludedExerciseCardIds]
    assertNotExcluded([...component.preferredProgrammingMethodIds, ...component.lockedProgrammingMethodIds], excludedMethods, `${key} programming methods`)
    assertNotExcluded([...component.preferredExercises, ...component.lockedExercises].map((ref) => ref.exerciseCardId), excludedExercises, `${key} exercises`)
    for (const methodIds of [excludedMethods, [...request.preferredProgrammingMethodIds, ...component.preferredProgrammingMethodIds, ...component.lockedProgrammingMethodIds]]) {
      if (new Set(methodIds).size > 100) throw new RangeError(`${key} combined programming method controls exceed 100 IDs`)
    }
    if (component.lockedBlocks.length && !request.modification) throw new RangeError('Existing block locks require Modify Existing')
    return component
  })
  if (!tumblingMinutes && request.components.some((entry) => entry.key === 'body_control')) throw new RangeError('Body Control must be explicitly included in booked tumbling time')
  const fixedAthleticSeconds = components.filter((component) => component.key !== 'body_control').reduce((sum, component) => sum + (component.budgetSeconds ?? 0), 0)
  if (fixedAthleticSeconds > athleticMinutes * 60) throw new RangeError('Fixed component budgets exceed athletic time')
  const equipmentCheck = normalizeSessionComponentPlan({
    durationMinutes: totalBookedMinutes,
    equipment: { available: request.equipment.available, quantities: request.equipment.quantities, excluded: request.equipment.excluded },
    components: components.map((component) => ({ key: component.key, budgetSeconds: 1, equipment: component.equipment })),
  })
  const globalPreferences = normalizeSessionComponentPlan({ durationMinutes: totalBookedMinutes, equipment: equipmentCheck.equipment,
    components: [{ key: 'strength', budgetSeconds: 1, equipment: { preferred: [...request.equipment.preferred, ...request.equipment.required] } }],
  }).components[0].equipment.preferred
  const normalizedRequired = normalizeWorkoutIntent({ equipmentAvailable: equipmentCheck.equipment.available, equipmentRequired: request.equipment.required }).equipmentRequired
  request.equipment = { ...equipmentCheck.equipment, required: normalizedRequired, preferred: globalPreferences.filter((key) => !normalizedRequired.includes(key)) }
  request.components = components
  request.assumptions = request.athletes.flatMap((cohort) => [
    ...(cohort.trainingAgeMonths === null ? [`${cohort.key}: training age is unknown; retrieval uses the conservative zero-month baseline pending coach evidence.`] : []),
    ...(cohort.readiness === null ? [`${cohort.key}: no readiness observation was supplied; exercise eligibility still requires applicable prerequisites.`] : []),
  ])
  return immutableProgrammingValue(request)
}

/** Recommended clocks are starting weights, not permission to alter fixed coach budgets. */
export function allocateProgrammingComponentBudgets(request) {
  const weights = request.logistics.athleticMinutes >= 90 ? [15, 30, 30, 15] : [10, 25, 20, 5]
  const athletic = request.components.filter((component) => component.key !== 'body_control')
  const automatic = athletic.filter((component) => component.budgetSeconds === null)
  const remaining = request.logistics.athleticMinutes * 60 - athletic.reduce((sum, component) => sum + (component.budgetSeconds ?? 0), 0)
  if (automatic.length && remaining < automatic.length) throw new RangeError('Insufficient time for automatic components after fixed coach budgets')
  const totalWeight = automatic.reduce((sum, component) => sum + weights[SESSION_COMPONENT_ORDER.indexOf(component.key)], 0)
  const allocated = new Map(athletic.filter((component) => component.budgetSeconds !== null).map((component) => [component.key, component.budgetSeconds]))
  const fractional = automatic.map((component) => {
    const exact = (remaining * weights[SESSION_COMPONENT_ORDER.indexOf(component.key)]) / totalWeight
    allocated.set(component.key, Math.max(1, Math.floor(exact)))
    return { key: component.key, remainder: exact % 1 }
  }).sort((a, b) => b.remainder - a.remainder || SESSION_COMPONENT_ORDER.indexOf(a.key) - SESSION_COMPONENT_ORDER.indexOf(b.key))
  let residue = request.logistics.athleticMinutes * 60 - [...allocated.values()].reduce((sum, seconds) => sum + seconds, 0)
  for (const entry of fractional) if (residue > 0) { allocated.set(entry.key, allocated.get(entry.key) + 1); residue -= 1 }
  while (residue < 0) {
    const largest = [...automatic].sort((a, b) => allocated.get(b.key) - allocated.get(a.key))[0]
    if (!largest || allocated.get(largest.key) <= 1) throw new RangeError('Insufficient automatic component time')
    allocated.set(largest.key, allocated.get(largest.key) - 1)
    residue += 1
  }
  if (request.logistics.tumblingMinutes) allocated.set('body_control', request.logistics.tumblingMinutes * 60)
  return immutableProgrammingValue(Object.fromEntries(allocated))
}

export function programmingComponentPlan(request) {
  const budgets = allocateProgrammingComponentBudgets(request)
  return normalizeSessionComponentPlan({ durationMinutes: request.logistics.totalBookedMinutes,
    equipment: { available: request.equipment.available, quantities: request.equipment.quantities, excluded: request.equipment.excluded },
    components: request.components.filter((entry) => budgets[entry.key] > 0)
      .map((entry) => ({ key: entry.key, budgetSeconds: budgets[entry.key], equipment: entry.equipment })),
  })
}

/** Retrieval projection only; whole-session required coverage stays on the immutable request. */
export function canonicalIntentForProgrammingComponent(request, componentKey) {
  const component = request.components.find((entry) => entry.key === componentKey)
  if (!component) throw new TypeError('Unknown active request component')
  const cohortIntents = request.athletes.map((cohort) => normalizeWorkoutIntent({
    // Budget baselines must cover the youngest member, including a wide cohort.
    durationMinutes: request.logistics.totalBookedMinutes, ageMin: cohort.ageMin, ageMax: cohort.ageMin,
    trainingAgeMonths: cohort.trainingAgeMonths ?? 0, trainingExperience: cohort.trainingExperience,
  }))
  const minimumBudgets = (field) => Object.fromEntries(Object.keys(cohortIntents[0][field]).map((key) => [key, Math.min(...cohortIntents.map((intent) => intent[field][key]))]))
  const priorityEntries = [...request.priorities, ...component.priorities]
  return normalizeWorkoutIntent({
    durationMinutes: request.logistics.totalBookedMinutes,
    athleteCount: request.athletes.reduce((sum, cohort) => sum + cohort.athleteCount, 0), coachCount: request.logistics.coachCount,
    ageMin: Math.min(...request.athletes.map((cohort) => cohort.ageMin)), ageMax: Math.max(...request.athletes.map((cohort) => cohort.ageMax)),
    trainingAgeMonths: Math.min(...cohortIntents.map((intent) => intent.trainingAgeMonths)),
    trainingExperience: ['beginner', 'intermediate', 'advanced'].find((level) => request.athletes.some((cohort) => cohort.trainingExperience === level)),
    objective: request.objective, randomSeed: request.randomSeed, space: request.logistics.space,
    equipmentAvailable: request.equipment.available, equipmentQuantities: request.equipment.quantities,
    equipmentAvoid: request.equipment.excluded, equipmentRequired: request.equipment.required,
    exerciseInclude: [...request.preferredExercises, ...component.preferredExercises, ...component.lockedExercises].map((ref) => ref.exerciseCardId),
    exerciseAvoid: [...new Set([...request.excludedExerciseCardIds, ...component.excludedExerciseCardIds])],
    recentExerciseIds: [], limitations: [...new Set(request.athletes.flatMap((cohort) => cohort.limitations))],
    // "required" means session/component coverage, not every warm-up or support
    // drill matching every priority. Rank for coverage now; enforce it at composition.
    focuses: [
      ...priorityEntries.map((entry) => ({ ...entry, strength: entry.strength === 'required' ? 'strong_preference' : entry.strength, scopes: ['whole_session'] })),
      ...request.equipment.preferred.map((value) => ({ facet: 'equipment', value, strength: 'preferred', scopes: ['whole_session'] })),
    ],
    maxHighImpactContacts: Math.min(...cohortIntents.map((intent) => intent.maxHighImpactContacts)),
    fatigueBudgets: minimumBudgets('fatigueBudgets'), stressBudgets: minimumBudgets('stressBudgets'),
    assumptions: request.assumptions,
  })
}
