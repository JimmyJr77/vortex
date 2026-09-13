import Joi from 'joi'
import { CANONICAL_UUID_SCHEMA, parseProgrammingContract, programmingValueHash, immutableProgrammingValue } from './workoutProgrammingRequest.js'
import { libraryScopeId } from './coachingLibraryContext.js'
import { taxonomyV2Term } from './taxonomyV2.js'

export const CANONICAL_PROGRAMMING_RULES_VERSION = '1.0.0'
export const CANONICAL_PROGRAMMING_RULE_FIELDS = Object.freeze(['prerequisites', 'sequenceRules', 'pairingCompatibility', 'weeklyExposure', 'interferenceRules', 'uncertaintyPolicy'])
const text = (max = 200) => Joi.string().trim().max(max)
const id = Joi.string().custom((value, helpers) => { try { return libraryScopeId(value, 'rule source ID') } catch { return helpers.error('any.invalid') } })
const ruleId = text(80).required()
const target = Joi.object({ targetType: Joi.string().valid('variant', 'definition', 'family', 'movement_pattern', 'body_region', 'taxonomy').required(),
  targetKey: text().required(), facetType: text().allow(null).default(null) }).required()
const observation = Joi.object({ id: ruleId, type: Joi.string().valid('athlete_observation').required(),
  prerequisite: text(1000).allow(null).default(null), purpose: Joi.string().valid('competency', 'current_readiness').required(),
  providesFact: Joi.string().valid('deceleration_ready').allow(null).default(null),
  sourceKind: Joi.string().valid('skill_progress', 'assessment_result', 'gymnastics_evaluation', 'wellness_checkin').required(),
  selector: Joi.object({ assessmentId: id, exerciseId: id, criterionId: id, skillLabel: text(), movementKey: text(), componentKey: text(), variant: text().allow(null) }).required(),
  field: Joi.string().valid('score', 'value', 'textValue', 'sleepHours', 'soreness', 'rpe', 'mood', 'energy').required(),
  operator: Joi.string().valid('gte', 'lte', 'eq').required(), value: Joi.alternatives(Joi.number(), text()).required(),
  scaleMaximum: Joi.number().positive().max(10000).allow(null).default(null), unit: text(80).allow(null).default(null),
  maxAgeDays: Joi.number().integer().min(0).max(3650).required(), requireCoachObservation: Joi.boolean().required(),
})
const sequence = Joi.object({ id: ruleId, type: Joi.string().valid('sequence').required(),
  relation: Joi.string().valid('requires_before', 'avoid_after', 'avoid_same_session', 'prefers_before', 'prefers_after').required(), target })
const dose = Joi.object({ id: ruleId, type: Joi.string().valid('dose_limit_after').required(), target,
  maximumSets: Joi.number().integer().min(0).max(100), maximumActiveSeconds: Joi.number().integer().min(0).max(360000),
  maximumHighImpactContacts: Joi.number().integer().min(0).max(1000000),
}).or('maximumSets', 'maximumActiveSeconds', 'maximumHighImpactContacts')
const exposure = Joi.object({ id: ruleId, type: Joi.string().valid('recorded_exposure').required(),
  legacyExerciseIds: Joi.array().items(id).min(1).max(100).unique().required(),
  windowDays: Joi.number().integer().min(1).max(35).required(), maximumSessions: Joi.number().integer().min(1).max(100).required(),
  minimumRecoveryHours: Joi.number().min(0).max(840).required(),
  historyScope: Joi.string().valid('recorded_facility').required(), eventTime: Joi.string().valid('completion_logged_at').required(),
})
const schema = Joi.object({ schemaVersion: Joi.string().valid(CANONICAL_PROGRAMMING_RULES_VERSION).required(),
  bindings: Joi.array().max(6).unique('field').items(Joi.object({ field: Joi.string().valid(...CANONICAL_PROGRAMMING_RULE_FIELDS).required(),
    sourceHash: Joi.string().hex().length(64).required(), ruleIds: Joi.array().items(ruleId).min(1).max(40).unique().required(),
    interpretation: text(2000).min(20).required(),
  })).required(), rules: Joi.array().items(observation, sequence, dose, exposure).min(1).max(40).unique('id').required(),
})
const present = (value) => value != null && (typeof value === 'string' ? Boolean(value.trim())
  : Array.isArray(value) ? value.length > 0 : typeof value === 'object' ? Object.keys(value).length > 0 : true)
export function canonicalProgrammingRuleSourceHash(programming, field) {
  if (!CANONICAL_PROGRAMMING_RULE_FIELDS.includes(field)) throw new TypeError('Unknown programming source field')
  return programmingValueHash({ field, value: programming[field] ?? null })
}

/** Optional extension in the existing programming JSON. Approval belongs to the existing exact card-version workflow. */
export function parseCanonicalProgrammingExecutionRules(programming, { requireComplete = true } = {}) {
  if (programming?.executionRules == null) return null
  const contract = parseProgrammingContract(schema, programming.executionRules, 'canonical programming execution rules')
  const fail = (message) => { throw new TypeError(message) }
  if (requireComplete && !Array.isArray(programming.prerequisites)) fail('An explicit prerequisite list is required before rule execution')
  for (const rule of contract.rules) {
    if (rule.target) {
      const { targetType, targetKey, facetType } = rule.target
      if (['variant', 'definition'].includes(targetType) && CANONICAL_UUID_SCHEMA.validate(targetKey).error) fail('Exact exercise rule targets require canonical UUIDs')
      if (targetType === 'taxonomy' ? !facetType || !taxonomyV2Term(facetType, targetKey) : facetType !== null) fail('Rule taxonomy target is invalid')
    }
    if (rule.type !== 'athlete_observation') continue
    const keys = Object.keys(rule.selector)
    const allowed = { skill_progress: ['exerciseId', 'criterionId', 'skillLabel'], assessment_result: ['assessmentId'], gymnastics_evaluation: ['movementKey', 'componentKey', 'variant'], wellness_checkin: [] }[rule.sourceKind]
    if (keys.some((key) => !allowed.includes(key))) fail('Observation selector does not match its source kind')
    const fields = { skill_progress: ['score'], assessment_result: ['value', 'textValue'], gymnastics_evaluation: ['score'], wellness_checkin: ['sleepHours', 'soreness', 'rpe', 'mood', 'energy'] }[rule.sourceKind]
    if (!fields.includes(rule.field)) fail('Observation metric does not match its source kind')
    if (rule.sourceKind === 'skill_progress' && !rule.selector.exerciseId && !rule.selector.criterionId) fail('Skill observations require an exact exercise or rubric-criterion ID')
    if (rule.sourceKind === 'assessment_result' && !rule.selector.assessmentId) fail('Assessment observations require an exact assessment ID')
    if (rule.sourceKind === 'gymnastics_evaluation' && (!rule.selector.movementKey || !rule.selector.componentKey || rule.scaleMaximum !== 5)) fail('Gymnastics observations require exact movement/component keys and the existing five-point scale')
    if (rule.sourceKind === 'wellness_checkin' && (rule.requireCoachObservation || rule.purpose !== 'current_readiness' || rule.providesFact)) fail('Self-reported wellness cannot certify competency or a coached skill fact')
    if (rule.providesFact && !rule.requireCoachObservation) fail('A skill-readiness fact requires a coached source observation')
    if (['skill_progress', 'gymnastics_evaluation'].includes(rule.sourceKind) && rule.scaleMaximum == null) fail('Graded observations require the reviewed score scale')
    if (rule.field === 'textValue' ? rule.operator !== 'eq' || typeof rule.value !== 'string' : typeof rule.value !== 'number') fail('Observation comparison type is invalid')
    if (rule.field === 'score' && (rule.value < 0 || rule.value > rule.scaleMaximum)) fail('Score comparison exceeds its reviewed scale')
  }
  const rules = new Map(contract.rules.map((rule) => [rule.id, rule]))
  const permitted = { prerequisites: ['athlete_observation'], sequenceRules: ['sequence'], pairingCompatibility: ['sequence'],
    weeklyExposure: ['recorded_exposure'], interferenceRules: ['sequence', 'dose_limit_after'], uncertaintyPolicy: ['athlete_observation', 'dose_limit_after', 'recorded_exposure'] }
  for (const binding of contract.bindings) {
    if (!present(programming[binding.field]) || binding.sourceHash !== canonicalProgrammingRuleSourceHash(programming, binding.field)) fail('Rule interpretation is stale or has no corresponding source guidance')
    if (binding.ruleIds.some((id) => !rules.has(id) || !permitted[binding.field].includes(rules.get(id).type))) fail('Source binding references an absent or incompatible rule')
    if (binding.field === 'weeklyExposure' && typeof programming.weeklyExposure === 'object') {
      const source = programming.weeklyExposure
      for (const id of binding.ruleIds) {
        const rule = rules.get(id)
        if (source.maximum != null && (typeof source.maximum !== 'number' || rule.maximumSessions > source.maximum || rule.windowDays < 7)
          || source.minimumRecoveryHours != null && (typeof source.minimumRecoveryHours !== 'number' || rule.minimumRecoveryHours < source.minimumRecoveryHours)) fail('Execution rules cannot relax explicit source exposure or recovery bounds')
      }
    }
    const hardSource = binding.field === 'sequenceRules' && present(programming.sequenceRules?.avoidAfter)
      || binding.field === 'pairingCompatibility' && present(programming.pairingCompatibility?.incompatible)
    if (hardSource && !binding.ruleIds.some((id) => ['avoid_after', 'avoid_same_session'].includes(rules.get(id).relation))) fail('Explicit avoid guidance requires an enforced exclusion rule')
  }
  if (contract.rules.some((rule) => !contract.bindings.some((binding) => binding.ruleIds.includes(rule.id)))) fail('Every execution rule requires a source binding')
  for (const field of CANONICAL_PROGRAMMING_RULE_FIELDS) if (requireComplete && present(programming[field]) && !contract.bindings.some((entry) => entry.field === field)) fail(`Unmapped programming source field: ${field}`)
  if (Array.isArray(programming.prerequisites)) {
    if (programming.prerequisites.some((entry) => typeof entry !== 'string' || !entry.trim())) fail('Prerequisite source keys must be explicit text')
    for (const prerequisite of programming.prerequisites) if (requireComplete && !contract.bindings.find((entry) => entry.field === 'prerequisites')?.ruleIds.some((id) => rules.get(id).prerequisite === prerequisite)) fail('Each source prerequisite requires its own exact observation mapping')
  } else if (present(programming.prerequisites)) fail('Prerequisites require an explicit list before execution mapping')
  for (const rule of contract.rules) if (rule.type === 'athlete_observation' && rule.prerequisite != null && !programming.prerequisites?.includes(rule.prerequisite)) fail('Rule invented a source prerequisite')
  return immutableProgrammingValue(contract)
}
