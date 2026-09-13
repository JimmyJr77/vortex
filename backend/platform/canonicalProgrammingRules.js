import { parseCanonicalProgrammingExecutionRules } from './canonicalProgrammingRulesContract.js'
import { compositionTargetMatches } from './canonicalExerciseSelection.js'
import { immutableProgrammingValue, programmingValueHash } from './workoutProgrammingRequest.js'

export const CANONICAL_PROGRAMMING_RULE_EVALUATOR_VERSION = '1.0.0'
const DAY = 86400000
const compare = (actual, rule) => rule.operator === 'eq' ? actual === rule.value : rule.operator === 'gte' ? actual >= rule.value : actual <= rule.value
const result = (status, code = null, evidence = {}) => ({ status, ...(code ? { code } : {}), ...evidence })
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const present = (value) => value != null && (Array.isArray(value) ? value.length > 0 : object(value) ? Object.keys(value).length > 0 : typeof value === 'string' ? Boolean(value.trim()) : true)
const dateNumber = (value) => Date.parse(`${String(value).slice(0, 10)}T00:00:00.000Z`)

function observationValue(observation, rule) {
  const data = observation.data
  if (!object(data)) return null
  if (rule.sourceKind === 'gymnastics_evaluation') {
    const matches = (data.components ?? []).filter((entry) => entry.movementKey === rule.selector.movementKey && entry.componentKey === rule.selector.componentKey
      && (!Object.hasOwn(rule.selector, 'variant') || entry.variant === rule.selector.variant))
    if (!matches.length) return null
    return { value: matches.length === 1 ? matches[0].score : null, scale: 5, ambiguous: matches.length !== 1 }
  }
  if (Object.entries(rule.selector).some(([key, value]) => data[key] !== value)) return null
  return { value: data[rule.field], scale: data.maxScore ?? null, unit: data.unit ?? null }
}

function evaluateObservation(rule, memberId, evidence) {
  const observations = evidence.observations.filter((entry) => entry.memberId === memberId && entry.kind === rule.sourceKind)
    .map((entry) => ({ entry, metric: observationValue(entry, rule) })).filter((entry) => entry.metric)
    .sort((a, b) => Date.parse(b.entry.observedAt) - Date.parse(a.entry.observedAt) || (BigInt(a.entry.id) < BigInt(b.entry.id) ? 1 : -1))
  const selected = observations[0]
  if (!selected) return result('UNKNOWN', 'missing_prerequisite_observation', { memberId })
  const { entry, metric } = selected
  const provenance = { memberId, sourceKind: entry.kind, sourceId: entry.id, sourceHash: entry.sourceHash, observedAt: entry.observedAt }
  if (entry.truncated || metric.ambiguous || observations.some((other) => other !== selected && Date.parse(other.entry.observedAt) === Date.parse(entry.observedAt)
    && (other.metric.value !== metric.value || other.metric.scale !== metric.scale))) return result('UNKNOWN', 'ambiguous_prerequisite_observation', provenance)
  const ageDays = (dateNumber(evidence.referenceDate) - dateNumber(entry.observedAt)) / DAY
  if (!Number.isFinite(ageDays) || ageDays < 0 || ageDays > rule.maxAgeDays) return result('UNKNOWN', 'stale_prerequisite_observation', { ...provenance, ageDays })
  if (rule.requireCoachObservation && !/^[1-9][0-9]*$/.test(String(entry.data.coachUserId ?? ''))) return result('UNKNOWN', 'coach_observation_required', provenance)
  if (rule.field === 'score' && metric.scale !== rule.scaleMaximum || rule.sourceKind === 'assessment_result' && metric.unit !== rule.unit) {
    return result('UNKNOWN', 'prerequisite_measurement_mismatch', provenance)
  }
  if (typeof metric.value !== typeof rule.value || typeof metric.value === 'number' && !Number.isFinite(metric.value)) return result('UNKNOWN', 'unknown_prerequisite_measurement', provenance)
  return result(compare(metric.value, rule) ? 'SATISFIED' : 'VIOLATED', 'prerequisite_observation', { ...provenance, ageDays,
    actual: metric.value, operator: rule.operator, expected: rule.value })
}

function evaluateExposure(rule, memberId, evidence, request) {
  const history = evidence.history.find((entry) => entry.memberId === memberId && entry.kind === 'completion_log')
  const clock = request.logistics.sessionStartsAt == null ? dateNumber(evidence.referenceDate) : Date.parse(request.logistics.sessionStartsAt)
  const day = dateNumber(evidence.referenceDate)
  if (!history || !Number.isFinite(clock) || !Number.isFinite(day)) return result('UNKNOWN', 'missing_recorded_exposure_history', { memberId })
  const logs = evidence.observations.filter((entry) => entry.memberId === memberId && entry.kind === 'completion_log'
    && rule.legacyExerciseIds.includes(entry.data.exerciseId) && ['completed', 'partial'].includes(entry.data.status)
    && dateNumber(entry.observedAt) >= day - (rule.windowDays - 1) * DAY && dateNumber(entry.observedAt) <= day)
  const sessions = new Set(logs.map((entry) => entry.data.sessionId).filter(Boolean))
  const countWithProposedSession = sessions.size + 1
  const values = { memberId, sourceIds: logs.map((entry) => entry.id), recordedSessions: sessions.size, countWithProposedSession,
    maximumSessions: rule.maximumSessions, historyScope: rule.historyScope, eventTime: rule.eventTime }
  if (countWithProposedSession > rule.maximumSessions) return result('VIOLATED', 'recorded_session_exposure_cap', values)
  if (history.truncated || evidence.retrieval.previousDays < rule.windowDays || logs.some((entry) => entry.truncated || !entry.data.sessionId)) return result('UNKNOWN', 'incomplete_recorded_exposure_history', values)
  // Recovery considers the entire loaded history, not only the shorter frequency window.
  const recent = evidence.observations.filter((entry) => entry.memberId === memberId && entry.kind === 'completion_log'
    && rule.legacyExerciseIds.includes(entry.data.exerciseId) && ['completed', 'partial'].includes(entry.data.status))
    .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))[0]
  if (recent && rule.minimumRecoveryHours > 0) {
    const recoveryHours = (clock - Date.parse(recent.observedAt)) / 3600000
    if (!Number.isFinite(recoveryHours) || recoveryHours < rule.minimumRecoveryHours) return result(request.logistics.sessionStartsAt ? 'VIOLATED' : 'UNKNOWN',
      request.logistics.sessionStartsAt ? 'recorded_recovery_interval' : 'recovery_window_requires_start_time', { ...values, recoveryHours, minimumRecoveryHours: rule.minimumRecoveryHours, latestSourceId: recent.id })
  }
  return result('SATISFIED', 'recorded_exposure_within_bounds', values)
}

/** Evaluate freshly hydrated, released card rules against actual whole-session execution and scoped athlete observations. */
function evaluateRules({ activity, activities, request, athleteEvidence }, eligibilityOnly = false) {
  const findings = []
  const evaluations = []
  const add = (code, message, route = 'exercise_librarian', detail = {}) => findings.push({ code, message, route, ...detail })
  const programming = activity.card.programming ?? {}
  let contract = null
  try { contract = parseCanonicalProgrammingExecutionRules(programming) } catch (error) { add('invalid_exercise_execution_rules', error.message) }
  const hasReadiness = !Array.isArray(programming.prerequisites) || programming.prerequisites.length || programming.uncertaintyPolicy || activity.componentKey === 'body_control'
  const hasProgramming = ['interferenceRules', 'sequenceRules', 'pairingCompatibility', 'weeklyExposure'].some((field) => present(programming[field]))
  if (!contract) {
    if (hasReadiness) add('readiness_evidence_adapter_required', 'Reviewed prerequisite and current-readiness mappings are required for this source.', 'athlete_development')
    if (hasProgramming) add('exercise_programming_rule_adapter_required', 'Map source sequencing, pairing and exposure guidance to reviewed execution rules.')
  } else if (activity.card.status !== 'published' || !activity.card.approvedBy
    || !/^[1-9][0-9]*$/.test(String(activity.card.programmingRulesReview?.reviewId ?? ''))
    || !/^[1-9][0-9]*$/.test(String(activity.card.programmingRulesReview?.reviewerUserId ?? ''))
    || activity.card.programmingRulesReview?.sourceHash !== programmingValueHash(programming)
    || activity.card.programmingRulesReview?.reviewedCardVersion !== activity.card.cardVersion
    || activity.card.programmingRulesReview?.reviewerUserId !== String(activity.card.approvedBy)) {
    add('unapproved_execution_rule_source', 'Execution rules must come from the released, human-approved card version.')
  } else {
    const members = request.athletes.flatMap((cohort) => cohort.memberIds)
    const rosterComplete = members.length === request.athletes.reduce((total, cohort) => total + cohort.athleteCount, 0)
      && members.every((memberId) => athleteEvidence.members.some((entry) => entry.memberId === memberId))
    const index = activities.findIndex((entry) => entry.activityId === activity.activityId)
    for (const rule of contract.rules) {
      if (eligibilityOnly && ['sequence', 'dose_limit_after'].includes(rule.type)) {
        evaluations.push({ ruleId: rule.id, type: rule.type, status: 'DEFERRED', outcomes: [] })
        continue
      }
      let outcomes = []
      if (['athlete_observation', 'recorded_exposure'].includes(rule.type)) {
        if (!rosterComplete || athleteEvidence.findings.length) outcomes = [result('UNKNOWN', 'unresolved_roster_evidence')]
        else if (rule.type === 'recorded_exposure' && activity.card.fatigueProfile?.recoveryHours != null
          && (!Number.isInteger(activity.card.fatigueProfile.recoveryHours) || activity.card.fatigueProfile.recoveryHours < 0
            || activity.card.fatigueProfile.recoveryHours > 168)) outcomes = [result('UNKNOWN', 'invalid_exercise_recovery_metadata')]
        else outcomes = members.map((memberId) => rule.type === 'athlete_observation'
          ? evaluateObservation(rule, memberId, athleteEvidence) : evaluateExposure({ ...rule,
            minimumRecoveryHours: Math.max(rule.minimumRecoveryHours, activity.card.fatigueProfile?.recoveryHours ?? 0) }, memberId, athleteEvidence, request))
      } else {
        const matches = activities.map((entry, position) => ({ entry, position })).filter(({ entry }) => entry.activityId !== activity.activityId
          && compositionTargetMatches(rule.target, entry.card, entry.profile, { exactReferences: true }))
        if (index < 0) outcomes = [result('UNKNOWN', 'missing_execution_position')]
        else if (rule.type === 'sequence') {
          const before = matches.filter((entry) => entry.position < index)
          const after = matches.filter((entry) => entry.position > index)
          const satisfied = rule.relation === 'requires_before' || rule.relation === 'prefers_after' ? before.length > 0
            : rule.relation === 'prefers_before' ? after.length > 0 : rule.relation === 'avoid_after' ? before.length === 0 : matches.length === 0
          outcomes = [result(satisfied ? 'SATISFIED' : rule.relation.startsWith('prefers_') ? 'ADVISORY' : 'VIOLATED', 'exercise_sequence_rule',
            { relation: rule.relation, targetActivityIds: matches.map(({ entry }) => entry.activityId) })]
        } else if (!matches.some((entry) => entry.position < index)) outcomes = [result('NOT_APPLICABLE')]
        else {
          const bounds = [['maximumSets', 'sets'], ['maximumActiveSeconds', 'activeSecondsPerAthlete'], ['maximumHighImpactContacts', 'highImpactContacts']]
          outcomes = bounds.filter(([field]) => rule[field] != null).map(([field, doseField]) => result(
            typeof activity.dose[doseField] !== 'number' ? 'UNKNOWN' : activity.dose[doseField] > rule[field] ? 'VIOLATED' : 'SATISFIED',
            'exercise_interference_dose_limit', { field: doseField, actual: activity.dose[doseField], maximum: rule[field] }))
        }
      }
      const status = outcomes.some((entry) => entry.status === 'VIOLATED') ? 'VIOLATED' : outcomes.some((entry) => entry.status === 'UNKNOWN') ? 'UNKNOWN'
        : outcomes.some((entry) => entry.status === 'ADVISORY') ? 'ADVISORY' : outcomes.every((entry) => entry.status === 'NOT_APPLICABLE') ? 'NOT_APPLICABLE' : 'SATISFIED'
      evaluations.push({ ruleId: rule.id, type: rule.type, status, outcomes })
      if (['VIOLATED', 'UNKNOWN'].includes(status)) add('exercise_execution_rule', 'A reviewed exercise rule is violated or lacks required evidence.',
        rule.type === 'athlete_observation' ? 'athlete_development' : rule.type === 'recorded_exposure' ? 'athlete_development' : 'session_builder', { ruleId: rule.id, status, outcomes })
    }
    if (activity.componentKey === 'body_control' && !contract.rules.some((rule) => rule.type === 'athlete_observation' && rule.purpose === 'current_readiness'
      && rule.maxAgeDays === 0 && rule.requireCoachObservation && evaluations.find((entry) => entry.ruleId === rule.id)?.status === 'SATISFIED')) {
      add('body_control_current_readiness_required', 'Body Control requires a satisfied, reviewed same-day coach-observation rule for the complete roster.', 'athlete_development')
    }
  }
  const deceleration = contract?.rules.filter((entry) => entry.type === 'athlete_observation' && entry.providesFact === 'deceleration_ready') ?? []
  const factStatuses = deceleration.map((rule) => evaluations.find((entry) => entry.ruleId === rule.id)?.status)
  return immutableProgrammingValue({ schemaVersion: CANONICAL_PROGRAMMING_RULE_EVALUATOR_VERSION, activityId: activity.activityId,
    status: findings.length ? 'REVISE' : 'PASS', findings, evaluations, contract,
    facts: { decelerationReady: factStatuses.length && factStatuses.every((entry) => entry === 'SATISFIED') ? true : factStatuses.includes('VIOLATED') ? false : null } })
}

export function evaluateCanonicalProgrammingRules(args) { return evaluateRules(args) }

/** Candidate eligibility never infers sequencing or interference from an incomplete session. */
export function evaluateCanonicalProgrammingEligibility({ card, componentKey, request, athleteEvidence }) {
  return evaluateRules({ activity: { activityId: card.variantId, card, componentKey }, activities: [], request, athleteEvidence }, true)
}
