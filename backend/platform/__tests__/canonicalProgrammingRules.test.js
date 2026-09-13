import assert from 'node:assert/strict'
import test from 'node:test'
import { parseCanonicalProgrammingExecutionRules, canonicalProgrammingRuleSourceHash } from '../canonicalProgrammingRulesContract.js'
import { canonicalProgrammingReviewRubric } from '../canonicalProgrammingRuleReview.js'
import { evaluateCanonicalProgrammingRules } from '../canonicalProgrammingRules.js'
import { evaluateProgrammingMethodRules } from '../programmingMethodRules.js'
import { validateCanonicalCardDraft, evaluateCanonicalCardReadiness } from '../canonicalCardAuthoring.js'
import { PRODUCTION_REFERENCE_CARD_DRAFT } from '../canonicalReferenceCard.js'
import { executionActivity } from './workoutProgrammingExecutionFixtures.js'
import { attachRules, landingRule, ruleFixtures } from './canonicalProgrammingRulesFixtures.js'
import { programmingValueHash, normalizeCoachWorkoutRequest } from '../workoutProgrammingRequest.js'
import { generateWorkoutProgramming } from '../workoutProgrammingWorkflow.js'
import { reviewWorkoutProgrammingDraft } from '../workoutProgrammingQA.js'
import { compositionFixtures, compositionRegistry } from './workoutProgrammingBuilderFixtures.js'
import { evidenceFixtures, evidencePool } from './workoutAthleteEvidenceFixtures.js'
import { SCOPE } from './workoutProgrammingLibrarianFixtures.js'
const evaluate = (state, patch = {}) => evaluateCanonicalProgrammingRules({ ...state, activities: [state.activity], ...patch })
const codes = (value) => value.findings.map((entry) => entry.code)

test('source bindings, exact selectors, declared scales and approval stamps are required before execution', async () => {
  const state = await ruleFixtures()
  assert.equal(evaluate(state).status, 'PASS')
  assert.ok(parseCanonicalProgrammingExecutionRules(state.activity.card.programming))
  const original = structuredClone(state.activity.card.programming)
  for (const mutate of [
    (p) => { p.uncertaintyPolicy = 'Changed after the interpretation was reviewed.' },
    (p) => { p.executionRules.rules[0].approved = true },
    (p) => { p.executionRules.rules[0].selector = { skillLabel: 'controlled_landing' } },
    (p) => { p.executionRules.rules[0].sourceKind = 'wellness_checkin' },
    (p) => { p.executionRules.rules[0].requireCoachObservation = false },
    (p) => { p.executionRules.rules[0].scaleMaximum = null },
    (p) => { delete p.prerequisites },
  ]) { const candidate = structuredClone(original); mutate(candidate); assert.throws(() => parseCanonicalProgrammingExecutionRules(candidate)) }
  state.activity.card.programmingRulesReview.sourceHash = 'f'.repeat(64)
  assert.ok(codes(evaluate(state)).includes('unapproved_execution_rule_source'))
  assert.equal(evaluate(state).facts.decelerationReady, null)
})

test('latest matching evidence governs every athlete without cherry-picking older success or unrelated skill labels', async () => {
  const state = await ruleFixtures()
  state.source['skill_progress:explicit'][1].data.score = 2
  state.athleteEvidence = await state.reload()
  let result = evaluate(state)
  assert.equal(result.evaluations[0].status, 'VIOLATED')
  assert.equal(result.facts.decelerationReady, false)
  assert.equal(result.evaluations[0].outcomes[1].memberId, '102')
  for (const [patch, expected] of [[{ maxScore: 10 }, 'prerequisite_measurement_mismatch'], [{ coachUserId: null }, 'coach_observation_required'], [{ exerciseId: '2' }, 'missing_prerequisite_observation']]) {
    const evidence = structuredClone(state.athleteEvidence)
    Object.assign(evidence.observations.find((entry) => entry.kind === 'skill_progress' && entry.memberId === '101').data, patch)
    result = evaluate(state, { athleteEvidence: evidence })
    assert.ok(result.evaluations[0].outcomes.some((entry) => entry.code === expected))
  }
  const evidence = structuredClone(state.athleteEvidence)
  const old = evidence.observations.find((entry) => entry.kind === 'skill_progress' && entry.memberId === '102')
  evidence.observations.push({ ...old, id: '69', observedAt: '2026-09-11T13:00:00Z', data: { ...old.data, score: 5 } })
  assert.equal(evaluate(state, { athleteEvidence: evidence }).evaluations[0].status, 'VIOLATED')
})

test('stale, same-time conflicting, incomplete-roster and wrong-unit evidence stays unknown', async () => {
  const state = await ruleFixtures()
  for (const mutate of [
    (e) => { e.observations.find((entry) => entry.kind === 'skill_progress').observedAt = '2026-09-10T12:00:00Z' },
    (e) => { const entry = e.observations.find((entry) => entry.kind === 'skill_progress'); e.observations.push({ ...entry, id: '99', data: { ...entry.data, score: 1 } }) },
    (e) => { e.members.pop() },
  ]) { const evidence = structuredClone(state.athleteEvidence); mutate(evidence); assert.equal(evaluate(state, { athleteEvidence: evidence }).evaluations[0].status, 'UNKNOWN') }
  attachRules(state.activity.card, { prerequisites: ['controlled_landing'] }, [landingRule({ sourceKind: 'assessment_result', selector: { assessmentId: '4' },
    field: 'value', unit: 'cm', scaleMaximum: null })], { prerequisites: ['landing-control'] })
  const evidence = structuredClone(state.athleteEvidence)
  evidence.observations.push({ id: '99', kind: 'assessment_result', memberId: '101', observedAt: '2026-09-12T13:00:00Z', sourceHash: 'a'.repeat(64),
    data: { assessmentId: '4', value: 50, unit: 'inches', coachUserId: '7' }, truncated: false })
  assert.equal(evaluate(state, { athleteEvidence: evidence }).evaluations[0].outcomes[0].code, 'prerequisite_measurement_mismatch')
})

test('sequencing uses actual component order and exact variant IDs while preferences remain visible advice', async () => {
  const state = await ruleFixtures('body_control')
  const before = executionActivity('strength', 2, state.request)
  attachRules(state.activity.card, { prerequisites: [], sequenceRules: { avoidAfter: ['reviewed strength target'] } },
    [{ id: 'freshness', type: 'sequence', relation: 'avoid_after', target: { targetType: 'variant', targetKey: before.card.variantId } }], { sequenceRules: ['freshness'] })
  let result = evaluate(state, { activities: [before, state.activity] })
  assert.equal(result.evaluations[0].status, 'VIOLATED')
  result = evaluate(state, { activities: [state.activity, before] })
  assert.equal(result.evaluations[0].status, 'SATISFIED')
  assert.ok(codes(result).includes('body_control_current_readiness_required'))
  const rules = [{ id: 'preference', type: 'sequence', relation: 'prefers_after', target: { targetType: 'variant', targetKey: before.card.id } }]
  state.activity.componentKey = 'strength'
  attachRules(state.activity.card, { prerequisites: [], sequenceRules: { preferredAfter: ['exact variant'] } }, rules, { sequenceRules: ['preference'] })
  result = evaluate(state, { activities: [before, state.activity] })
  assert.equal(result.evaluations[0].status, 'ADVISORY', 'Definition ID must not masquerade as a variant ID')
  assert.equal(result.status, 'PASS')
  rules[0].relation = 'requires_before'
  attachRules(state.activity.card, { prerequisites: [], sequenceRules: { preferredAfter: ['exact variant'] } }, rules, { sequenceRules: ['preference'] })
  assert.equal(evaluate(state).evaluations[0].status, 'VIOLATED')
})

test('interference limits apply to actual later doses and cannot be bypassed by relabeling legacy delivery phases', async () => {
  const state = await ruleFixtures()
  const before = executionActivity('explosiveness', 2, state.request)
  attachRules(state.activity.card, { prerequisites: [], interferenceRules: [{ stimulus: 'reviewed earlier target', action: 'limit later work' }] },
    [{ id: 'after-output', type: 'dose_limit_after', target: { targetType: 'definition', targetKey: before.card.id }, maximumSets: 2 }], { interferenceRules: ['after-output'] })
  assert.equal(evaluate(state, { activities: [before, state.activity] }).evaluations[0].status, 'VIOLATED')
  assert.equal(evaluate(state, { activities: [state.activity, before] }).evaluations[0].status, 'NOT_APPLICABLE')
  const reduced = { ...state.activity, dose: { ...state.activity.dose, sets: 2 } }
  assert.equal(evaluate(state, { activity: reduced, activities: [before, reduced] }).status, 'PASS')
})

test('recorded weekly exposures count distinct sessions, include partial work, preserve scope and enforce recovery', async () => {
  const state = await ruleFixtures()
  const rule = { id: 'weekly', type: 'recorded_exposure', legacyExerciseIds: ['1'], windowDays: 7, maximumSessions: 2,
    minimumRecoveryHours: 24, historyScope: 'recorded_facility', eventTime: 'completion_logged_at' }
  const programming = { prerequisites: [], weeklyExposure: { maximum: 2, minimumRecoveryHours: 24 } }
  attachRules(state.activity.card, programming, [rule], { weeklyExposure: ['weekly'] })
  assert.equal(evaluate(state).status, 'PASS')
  const evidence = structuredClone(state.athleteEvidence)
  const old = evidence.observations.find((entry) => entry.kind === 'completion_log')
  evidence.observations.push({ ...old, id: '92', data: { ...old.data, status: 'completed' } })
  assert.equal(evaluate(state, { athleteEvidence: evidence }).status, 'PASS', 'Multiple logs for one session count once')
  evidence.observations.push({ ...old, id: '93', data: { ...old.data, sessionId: '302' } })
  assert.equal(evaluate(state, { athleteEvidence: evidence }).evaluations[0].outcomes[0].code, 'recorded_session_exposure_cap')
  const shortRest = { ...state.request, logistics: { ...state.request.logistics, sessionStartsAt: '2026-09-12T12:00:00Z' } }
  assert.equal(evaluate(state, { request: shortRest }).evaluations[0].outcomes[0].code, 'recorded_recovery_interval')
  const uncertainTime = { ...state.request, logistics: { ...state.request.logistics, sessionStartsAt: null } }
  assert.equal(evaluate(state, { request: uncertainTime }).evaluations[0].outcomes[0].code, 'recovery_window_requires_start_time')
  state.activity.card.fatigueProfile.recoveryHours = 'unknown'
  assert.equal(evaluate(state).evaluations[0].outcomes[0].code, 'invalid_exercise_recovery_metadata')
  for (const patch of [{ maximumSessions: 3 }, { minimumRecoveryHours: 12 }, { windowDays: 1 }]) {
    assert.throws(() => attachRules(state.activity.card, programming, [{ ...rule, ...patch }], { weeklyExposure: ['weekly'] }))
  }
})

test('body control and a method deceleration condition consume satisfied source-mapped facts, never wellness confidence', async () => {
  const state = await ruleFixtures('body_control')
  const result = evaluate(state)
  assert.equal(result.status, 'PASS', JSON.stringify(result.findings))
  assert.equal(result.facts.decelerationReady, true)
  state.activity.method.programming_type = 'straight_sets'
  state.activity.method.validator_rules = [{ ruleKey: 'decel', severity: 'error', conditionJson: { decel_prerequisite_met: false }, message: 'Need demonstrated control.' }]
  const method = evaluateProgrammingMethodRules({ activity: state.activity, activities: [state.activity], request: state.request, readinessFacts: result.facts })
  assert.equal(method.evaluations[0].status, 'NOT_TRIGGERED')
  delete state.activity.card.programmingRulesReview
  assert.equal(evaluate(state).facts.decelerationReady, null)
})

test('authoring preserves partial mappings as drafts, publication checks completeness, and reviewers cannot submit forged stamps', async () => {
  const state = await ruleFixtures()
  const card = structuredClone(PRODUCTION_REFERENCE_CARD_DRAFT)
  card.variants[0].programming = structuredClone(state.activity.card.programming)
  card.variants[0].programming.sequenceRules = { preferredBefore: ['later conditioning'] }
  assert.equal(validateCanonicalCardDraft(card).valid, true)
  assert.ok(evaluateCanonicalCardReadiness(card).issues.some((entry) => entry.code === 'programming_execution_rules'))
  assert.throws(() => canonicalProgrammingReviewRubric(card, {}), /Unmapped/)
  const rubric = canonicalProgrammingReviewRubric({ variants: [{ id: state.activity.card.variantId, programming: state.activity.card.programming }] },
    { usefulCoachRubric: true, programmingExecutionRules: { byVariant: { forged: 'fake' } } })
  assert.equal(rubric.usefulCoachRubric, true)
  assert.equal(rubric.programmingExecutionRules.byVariant[state.activity.card.variantId], programmingValueHash(state.activity.card.programming))
  assert.equal(rubric.programmingExecutionRules.byVariant.forged, undefined)
  assert.equal(canonicalProgrammingRuleSourceHash(state.activity.card.programming, 'prerequisites').length, 64)
  const { assumptions, ...input } = state.request
  const request = normalizeCoachWorkoutRequest({ ...input, logistics: { ...input.logistics, sessionDate: null, sessionStartsAt: '2026-09-12T16:00:00-04:00' } })
  assert.equal(request.logistics.sessionStartsAt, '2026-09-12T20:00:00.000Z')
  state.source['skill_progress:explicit'][0].observed_at = '2026-09-12T21:00:00Z'
  assert.ok((await state.reload()).findings.some((entry) => entry.code === 'observation_after_session_start'))
})

test('a complete five-component session can pass reviewed same-day roster rules and method predicates; changed approvals invalidate it', async () => {
  const fixtures = compositionFixtures()
  const memberIds = Array.from({ length: 15 }, (_, index) => String(101 + index))
  const source = evidenceFixtures(memberIds)
  source['skill_progress:explicit'] = memberIds.map((member_id, index) => ({ id: String(700 + index), member_id,
    observed_at: '2026-09-12T13:00:00.000000Z', source_count: 1,
    data: { exerciseId: '1', score: 4, maxScore: 5, coachUserId: '7', sourceType: 'skill_observation' } }))
  const body = fixtures.activities.filter((entry) => entry.componentKey === 'body_control')
  for (const activity of body) attachRules(activity.card, { prerequisites: ['controlled_landing'], uncertaintyPolicy: 'Require observed controlled landing from every athlete today.' },
    [landingRule()], { prerequisites: ['landing-control'], uncertaintyPolicy: ['landing-control'] })
  const reviews = body.map(({ card }) => ({ variant_id: card.variantId, review_id: card.programmingRulesReview.reviewId,
    reviewed_card_version: card.cardVersion, reviewer_user_id: card.approvedBy, source_hash: card.programmingRulesReview.sourceHash }))
  const validators = body.map(({ method }) => ({ programming_method_id: method.id, rule_key: 'require_decel_control', severity: 'error',
    condition_json: { decel_prerequisite_met: false }, message: 'Demonstrated control is required.' }))
  const pool = evidencePool(source, fixtures.pool({ programmingRuleReviews: reviews, methodValidatorRules: validators }))
  let criticCalls = 0
  const registry = compositionRegistry([{ id: 'vortex/programming-critic', role: 'programming_critic', version: 'test-execution-rules', async invoke(input) {
    criticCalls++
    const evaluations = input.exerciseRules.filter((entry) => entry.contract)
    assert.equal(evaluations.length, 3)
    assert.ok(evaluations.every((entry) => entry.status === 'PASS' && entry.evaluations[0].outcomes.length === 15))
    assert.ok(input.methodRules.filter((entry) => entry.evaluations.length).every((entry) => entry.evaluations[0].status === 'NOT_TRIGGERED'))
    return { output: { draftId: input.draftId, reviewHash: input.reviewHash, status: 'PASS', summary: 'Synthetic complete session respects all reviewed fixture requirements.',
      assessments: input.reviewAreas.map((area) => ({ area, status: 'PASS', summary: 'Reviewed actual prescriptions and source-backed fixture evidence.' })), findings: [] } }
  } }])
  const { assumptions, ...request } = fixtures.request
  const result = await generateWorkoutProgramming({ pool, context: SCOPE, registry, rawRequest: { ...request,
    logistics: { ...request.logistics, athleticMinutes: 90, tumblingMinutes: 30, totalBookedMinutes: 120, sessionStartsAt: '2026-09-12T20:00:00Z' },
    athletes: [{ ...request.athletes[0], memberIds, evidenceReferences: memberIds.map((memberId, index) => ({ kind: 'skill_progress', id: String(700 + index), memberId })) }] } })
  assert.equal(result.status, 'QA_PASSED', JSON.stringify(result.qa.findings))
  assert.equal(result.draft.schedule.components.length, 5)
  assert.equal(result.validatedWorkout, false)
  assert.equal(criticCalls, 1)
  reviews[0].source_hash = 'f'.repeat(64)
  const changed = await reviewWorkoutProgrammingDraft({ pool, context: SCOPE, registry, sessionIntent: result.sessionIntent, draft: result.draft })
  assert.equal(changed.status, 'NEEDS_COACH_REVIEW')
  assert.equal(changed.critic, null)
  assert.ok(codes(changed).includes('unapproved_execution_rule_source'))
  assert.equal(criticCalls, 1)
})
