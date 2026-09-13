import assert from 'node:assert/strict'
import test from 'node:test'
import { directWorkoutProgramming } from '../workoutProgrammingDirector.js'
import { buildWorkoutProgrammingDraft } from '../workoutProgrammingBuilder.js'
import { validateWorkoutProgrammingDraft, reviewWorkoutProgrammingDraft, programmingCriticContract, PROGRAMMING_QA_AREAS } from '../workoutProgrammingQA.js'
import { compositionFixtures, compositionRegistry } from './workoutProgrammingBuilderFixtures.js'
import { SCOPE } from './workoutProgrammingLibrarianFixtures.js'
import { createProgrammingStaffRegistry } from '../programmingStaffRuntime.js'
import { programmingValueHash } from '../workoutProgrammingRequest.js'

const passingCritic = { id: 'vortex/programming-critic', role: 'programming_critic', version: 'test-1', async invoke(input) {
  return { output: { draftId: input.draftId, reviewHash: input.reviewHash, status: 'PASS', summary: 'Complete reviewed session with purposeful recovery and teaching.',
    assessments: input.reviewAreas.map((area) => ({ area, status: 'PASS', summary: `Reviewed ${area} against actual selected work and athlete context.` })), findings: [] } }
} }
async function setup(fixtures = compositionFixtures(), patch = {}, expectedStatus = 'READY_FOR_CRITIC') {
  const registry = compositionRegistry([passingCritic])
  const { assumptions, ...rawRequest } = fixtures.request
  const intent = await directWorkoutProgramming({ pool: fixtures.pool(), context: SCOPE, rawRequest: { ...rawRequest, ...patch }, registry })
  const draft = await buildWorkoutProgrammingDraft({ pool: fixtures.pool(), context: SCOPE, sessionIntent: intent, registry })
  assert.equal(draft.status, expectedStatus)
  return { fixtures, registry, intent, draft }
}
const args = (state, patch = {}) => ({ pool: state.fixtures.pool(), context: SCOPE, sessionIntent: state.intent, draft: state.draft, registry: state.registry, ...patch })
const codes = (result) => result.findings.map((entry) => entry.code)

test('independent review reconstructs complete draft, checks all areas and reloads sources after model PASS', async () => {
  const state = await setup()
  const pool = state.fixtures.pool()
  const registry = createProgrammingStaffRegistry([{ ...passingCritic, async invoke(input) {
    assert.equal(pool.calls.at(-1).sql, 'RELEASE')
    assert.equal(input.reviewAreas.length, 12)
    assert.equal(input.activities.length, 10)
    assert.equal(input.components[0].activities[0].events, undefined)
    assert.ok(input.components.every((component) => component.reserveSeconds === 0 || component.reserveUsage))
    return passingCritic.invoke(input)
  } }])
  const result = await reviewWorkoutProgrammingDraft(args(state, { pool, registry }))
  assert.deepEqual(result.findings, [])
  assert.equal(result.status, 'QA_PASSED')
  assert.equal(result.finalValidation.status, 'PASS')
  assert.equal(result.finalValidation.reviewHash, result.reviewHash)
  assert.equal(result.critic.assessments.length, PROGRAMMING_QA_AREAS.length)
  assert.equal(pool.calls.filter((entry) => entry.sql.startsWith('BEGIN')).length, 2)
  assert.equal(pool.calls.filter((entry) => entry.sql.includes('SELECT pm.*')).length, 2)
  assert.equal(result.trace.calls.length, 1)
  assert.equal(result.validatedWorkout, false)
  assert.equal(result.creatorAuthorized, false)
  assert.equal(result.libraryApprovalGranted, false)
  assert.throws(() => { result.findings.push({}) }, TypeError)
})

test('forged dose, participant assignments, load summaries and embedded source metadata fail independent reconstruction', async () => {
  const state = await setup()
  for (const [expected, mutate] of [
    ['stale_or_forged_dose', (draft) => { draft.activities[4].dose.highImpactContacts = 999 }],
    ['stale_schedule', (draft) => { draft.schedule.components[1].activities[0].events[0].athleteKeys = [] }],
    ['stale_load', (draft) => { draft.load.entries[1].before = {} }],
    ['stale_source_metadata', (draft) => { draft.activities[4].card.stressProfile.impactStress = 0;
      const activity = draft.activities[4]; activity.sourceHash = programmingValueHash({ card: activity.card, profile: activity.profile, method: activity.method }) }],
    ['invalid_preparation_proposal', (draft) => { draft.preparationProposal.downstreamHash = 'f'.repeat(64) }],
    ['proposal_activity_mismatch', (draft) => { [draft.activities[4], draft.activities[5]] = [draft.activities[5], draft.activities[4]] }],
  ]) {
    const draft = structuredClone(state.draft); mutate(draft)
    const result = await reviewWorkoutProgrammingDraft(args(state, { draft }))
    assert.ok(codes(result).includes(expected), `${expected}: ${JSON.stringify(result.findings)}`)
    assert.equal(result.status, 'NEEDS_COACH_REVIEW')
    assert.equal(result.critic, null)
    assert.equal(result.trace.calls.length, 0)
  }
})

test('server coach truth and strict draft shape reject authority attempts before database access', async () => {
  const state = await setup()
  const pool = { async connect() { assert.fail('Invalid draft reached database') } }
  for (const mutate of [
    (draft) => { draft.request.logistics.coachCount = 10; draft.requestHash = programmingValueHash(draft.request) },
    (draft) => { draft.componentPlan.components[0].budgetSeconds += 1 },
    (draft) => { draft.creatorAuthorized = true },
    (draft) => { draft.libraryApprovalGranted = true },
    (draft) => { draft.activities.push(draft.activities[0]) },
    (draft) => { draft.activities[0].method.id = 'foreign-method' },
  ]) {
    const draft = structuredClone(state.draft); mutate(draft)
    await assert.rejects(validateWorkoutProgrammingDraft(args(state, { pool, draft })))
  }
})

test('withdrawn release members and changed canonical source content cannot retain an earlier QA target', async () => {
  const state = await setup()
  const selectedId = state.draft.activities[4].card.id
  const removed = state.fixtures.pool({ releaseIds: state.fixtures.options.cards.filter((card) => card.id !== selectedId).map((card) => card.id) })
  assert.ok(codes(await validateWorkoutProgrammingDraft(args(state, { pool: removed }))).includes('unavailable_canonical_pair'))
  const cards = structuredClone(state.fixtures.options.cards)
  cards.find((card) => card.id === selectedId).deliveryProfiles[0].coachInstructions = 'Updated source coaching cue.'
  assert.ok(codes(await validateWorkoutProgrammingDraft(args(state, { pool: state.fixtures.pool({ cards }) }))).includes('stale_source_metadata'))
  assert.ok(codes(await validateWorkoutProgrammingDraft(args(state, { pool: state.fixtures.pool({ noRelease: true }) }))).includes('stale_library_release'))
})

test('source change while Critic runs invalidates its PASS', async () => {
  const state = await setup()
  const cards = structuredClone(state.fixtures.options.cards)
  const pool = state.fixtures.pool({ cards })
  const registry = createProgrammingStaffRegistry([{ ...passingCritic, async invoke(input) {
    cards[0].deliveryProfiles[0].coachInstructions = 'Changed while review was in flight.'
    return passingCritic.invoke(input)
  } }])
  const result = await reviewWorkoutProgrammingDraft(args(state, { pool, registry }))
  assert.equal(result.critic.status, 'PASS')
  assert.equal(result.status, 'NEEDS_COACH_REVIEW')
  assert.ok(codes(result).includes('stale_source_metadata'))
  assert.ok(codes(result).includes('review_target_changed'))
})

test('fresh source clock and readiness requirements are independently checked even after Builder eligibility passed', async () => {
  for (const [expected, modify] of [
    ['unsupported_programming_clock', (fixtures) => { fixtures.options.methods.forEach((method) => { method.programming_type = 'mixed_modal_circuit' }) }],
    ['unsupported_work_rest_field', (fixtures) => { fixtures.options.methods.forEach((method) => { method.work_rest_structure = { interval_seconds: 30 } }) }],
    ['readiness_evidence_adapter_required', (fixtures) => { fixtures.options.cards[0].programming = { prerequisites: ['pain_free'] } }],
    ['readiness_evidence_adapter_required', (fixtures) => { delete fixtures.options.cards[0].programming }],
    ['exercise_programming_rule_adapter_required', (fixtures) => { fixtures.options.cards[0].programming = { weeklyExposure: { minimumRecoveryHours: 24 } } }],
  ]) {
    const fixtures = compositionFixtures()
    const state = await setup(fixtures)
    modify(fixtures)
    const result = await reviewWorkoutProgrammingDraft(args(state))
    assert.ok(codes(result).includes(expected), JSON.stringify(result.findings))
    assert.equal(result.critic, null)
    assert.equal(result.validatedWorkout, false)
  }
})

test('Critic REVISE carries explicit specialist routes and leaves all sources unchanged', async () => {
  const state = await setup()
  const draftHash = programmingValueHash(state.draft)
  const registry = createProgrammingStaffRegistry([{ ...passingCritic, async invoke(input) {
    const { output } = await passingCritic.invoke(input)
    output.status = 'REVISE'
    output.assessments.find((entry) => entry.area === 'preparation').status = 'REVISE'
    output.findings.push({ area: 'preparation', route: 'prepare_access', activityIds: [input.activities[0].activityId], componentKeys: ['prepare_and_access'],
      message: 'The base needs a stronger mobility emphasis for today’s selected work.', recommendedAction: 'Select an appropriate existing preparation profile and recheck the downstream demand contract.' })
    return { output }
  } }])
  const result = await reviewWorkoutProgrammingDraft(args(state, { registry }))
  assert.equal(result.status, 'NEEDS_COACH_REVIEW')
  assert.equal(result.finalValidation, null)
  assert.deepEqual(result.revisionRoutes, ['prepare_access'])
  assert.equal(result.findings[0].source, 'critic')
  assert.equal(programmingValueHash(state.draft), draftHash)
})

test('athlete evidence references and booked tumbling require source-backed readiness evaluation', async () => {
  const fixtures = compositionFixtures()
  const { assumptions, ...rawRequest } = fixtures.request
  const withEvidence = await directWorkoutProgramming({ pool: fixtures.pool(), context: SCOPE, registry: compositionRegistry(), rawRequest: { ...rawRequest, athletes: fixtures.request.athletes.map((cohort) => ({ ...cohort,
    competencyEvidenceIds: ['99'], readiness: { observedAt: '2026-09-12T12:00:00.000Z', notes: 'Coach observation supplied for review.', sourceRecordIds: ['100'] },
  })) } })
  assert.equal(withEvidence.status, 'NEEDS_COACH_REVIEW')
  assert.ok(withEvidence.issues.some((entry) => entry.code === 'untyped_athlete_evidence'))
  assert.equal(withEvidence.trace.calls.length, 0)
  const withTumbling = await setup(fixtures, { logistics: { ...fixtures.request.logistics, athleticMinutes: 90, tumblingMinutes: 30, totalBookedMinutes: 120 } }, 'NEEDS_COACH_REVIEW')
  const result = await reviewWorkoutProgrammingDraft(args(withTumbling))
  assert.ok(codes(result).includes('candidate_eligibility_review_required'))
  assert.ok(withTumbling.draft.candidateEligibility.filter((entry) => entry.componentKey === 'body_control')
    .every((entry) => entry.status === 'REQUIRES_REVIEW' && entry.result.findings.some((finding) => finding.code === 'readiness_evidence_adapter_required')))
  assert.equal(result.critic, null)
  assert.ok(result.revisionRoutes.includes('director'))
})

test('cancellation during Critic execution aborts review without a final source read', async () => {
  const state = await setup()
  const controller = new AbortController()
  const pool = state.fixtures.pool()
  const registry = createProgrammingStaffRegistry([{ ...passingCritic, async invoke(input, context) {
    controller.abort()
    assert.equal(context.signal.aborted, true)
    return passingCritic.invoke(input)
  } }])
  await assert.rejects(reviewWorkoutProgrammingDraft(args(state, { pool, registry, runOptions: { signal: controller.signal } })), { code: 'canceled' })
  assert.equal(pool.calls.filter((entry) => entry.sql.startsWith('BEGIN')).length, 1)
})

test('Critic cannot return a stale, incomplete, contradictory, unreferenced or approval-bearing contract', async () => {
  const state = await setup()
  const validation = await validateWorkoutProgrammingDraft(args(state))
  const { output } = await passingCritic.invoke({ draftId: state.draft.draftId, reviewHash: validation.reviewHash, reviewAreas: PROGRAMMING_QA_AREAS })
  const contract = programmingCriticContract(validation)
  for (const mutate of [
    (value) => { value.reviewHash = 'f'.repeat(64) },
    (value) => { value.assessments.pop() },
    (value) => { value.assessments[0].status = 'REVISE' },
    (value) => { value.status = 'REVISE' },
    (value) => { value.validatedWorkout = true },
    (value) => { value.status = 'REVISE'; value.assessments[0].status = 'REVISE'; value.findings = [{ area: 'impact_volume', route: 'session_builder', message: 'Revise.',
      recommendedAction: 'Reduce within reviewed ranges.', activityIds: ['foreign'], componentKeys: ['strength'] }] },
    (value) => { value.status = 'REVISE'; value.assessments[0].status = 'REVISE'; value.findings = [{ area: 'impact_volume', route: 'session_builder', message: 'Revise.',
      recommendedAction: 'Reduce within reviewed ranges.', activityIds: [state.draft.activities[0].activityId], componentKeys: ['strength'] }] },
  ]) {
    const value = structuredClone(output); mutate(value)
    assert.throws(() => contract.parseOutput(value))
  }
  assert.throws(() => programmingCriticContract({ ...validation, status: 'REVISE' }).parseOutput(output))
})

test('unavailable, invalid and canceled critics never pass and never start retries', async () => {
  const state = await setup()
  for (const registry of [createProgrammingStaffRegistry(), createProgrammingStaffRegistry([{ ...passingCritic, async invoke() { return { output: { status: 'PASS' } } } }])]) {
    const result = await reviewWorkoutProgrammingDraft(args(state, { registry }))
    assert.equal(result.status, 'NEEDS_COACH_REVIEW')
    assert.equal(result.validatedWorkout, false)
    assert.ok(result.trace.calls.length <= 1)
    assert.deepEqual(result.revisionRoutes, ['coach'])
  }
  const controller = new AbortController(); controller.abort()
  await assert.rejects(reviewWorkoutProgrammingDraft(args(state, { runOptions: { signal: controller.signal } })), { code: 'canceled' })
})
