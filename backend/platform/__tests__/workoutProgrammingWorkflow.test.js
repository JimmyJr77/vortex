import assert from 'node:assert/strict'
import test from 'node:test'
import { generateWorkoutProgramming, programmingDraftContentHash, planProgrammingRepair } from '../workoutProgrammingWorkflow.js'
import { buildWorkoutProgrammingDraft } from '../workoutProgrammingBuilder.js'
import { directWorkoutProgramming } from '../workoutProgrammingDirector.js'
import { createProgrammingStaffRegistry } from '../programmingStaffRuntime.js'
import { programmingValueHash } from '../workoutProgrammingRequest.js'
import { compositionFixtures, validBuilder, validPrepare } from './workoutProgrammingBuilderFixtures.js'
import { validDirector, validAthlete } from './workoutProgrammingStaffFixtures.js'
import { SCOPE, uuid } from './workoutProgrammingLibrarianFixtures.js'
import { attachRules } from './canonicalProgrammingRulesFixtures.js'

function critic(revisions = 0, { area = 'redundancy', route = 'session_builder', componentKeys = ['strength'] } = {}) {
  let calls = 0
  return { id: 'vortex/programming-critic', role: 'programming_critic', version: 'test-1', async invoke(input) {
    const revise = calls++ < revisions
    return { output: { draftId: input.draftId, reviewHash: input.reviewHash, status: revise ? 'REVISE' : 'PASS',
      summary: revise ? 'Reduce redundant work and preserve quality.' : 'Complete coherent session after review.',
      assessments: input.reviewAreas.map((key) => ({ area: key, status: revise && key === area ? 'REVISE' : 'PASS', summary: 'Checked against actual source work and group context.' })),
      findings: revise ? [{ area, route, componentKeys, activityIds: [], message: 'The current selection needs a more complementary stimulus.',
        recommendedAction: 'Choose complementary canonical work within the existing coach controls.' }] : [],
    } }
  } }
}
const registry = (patch = {}) => createProgrammingStaffRegistry([validDirector, validAthlete, patch.builder ?? validBuilder, patch.prepare ?? validPrepare, patch.critic ?? critic()])
const raw = (fixtures) => { const { assumptions, ...request } = fixtures.request; return request }
const generate = (fixtures, patch = {}) => generateWorkoutProgramming({ pool: fixtures.pool(), context: SCOPE, registry: registry(), rawRequest: raw(fixtures), ...patch })
const repairBuilder = (change) => ({ ...validBuilder, async invoke(input) {
  if (!input.revision) return validBuilder.invoke(input)
  const output = structuredClone(input.revision.previousProposal)
  change(output, input)
  return { output }
} })

function executionRuleFixture(type = 'sequence') {
  const fixtures = compositionFixtures()
  const subject = fixtures.activities[6]
  const target = fixtures.activities[3]
  const rule = { id: 'reviewed-interaction', type, target: { targetType: 'variant', targetKey: target.card.variantId },
    ...(type === 'sequence' ? { relation: 'avoid_after' } : { maximumSets: 0 }) }
  const field = type === 'sequence' ? 'sequenceRules' : 'interferenceRules'
  attachRules(subject.card, { prerequisites: [], [field]: { reviewed: 'Do not combine this source dose with the earlier target.' } }, [rule], { [field]: [rule.id] })
  fixtures.options.programmingRuleReviews = [{ variant_id: subject.card.variantId, review_id: '9001',
    reviewed_card_version: subject.card.cardVersion, reviewer_user_id: subject.card.approvedBy, source_hash: subject.card.programmingRulesReview.sourceHash }]
  return { fixtures, subject, target }
}

test('verified sequence and interference violations repair both affected components and receive independent full QA', async () => {
  for (const type of ['sequence', 'dose_limit_after']) {
    const { fixtures, subject } = executionRuleFixture(type)
    const builder = repairBuilder((output, input) => {
      assert.deepEqual(input.revision.mutableComponentKeys, ['explosiveness', 'strength', 'capacity_competition'])
      assert.match(input.revision.feedback[0].recommendedAction, /reviewed-interaction/)
      output.components.find((entry) => entry.key === 'strength').selections = output.components.find((entry) => entry.key === 'strength')
        .selections.filter((entry) => entry.deliveryProfileId !== subject.profile.id)
    })
    const result = await generate(fixtures, { registry: registry({ builder }) })
    assert.equal(result.status, 'QA_PASSED', JSON.stringify(result.qa.findings))
    assert.equal(result.repairPasses, 1)
    assert.equal(result.history[0].qaStatus, 'NEEDS_COACH_REVIEW')
    assert.ok(result.history[0].findings.every((entry) => entry.code === 'exercise_execution_rule'))
    assert.ok(result.history[1].preparationDemandChanged)
    assert.equal(result.trace.calls.filter((entry) => entry.role === 'programming_critic').length, 1)
    assert.equal(result.qa.finalValidation.status, 'PASS')
  }
})

test('execution repair rejects altered rule findings, unknown evidence, approval gaps and mixed failures', async () => {
  const { fixtures } = executionRuleFixture()
  const result = await generate(fixtures, { maxRepairPasses: 0 })
  assert.equal(planProgrammingRepair(result.qa).status, 'AUTOMATIC')
  for (const change of [
    (qa) => { qa.findings[0].evidence.status = 'UNKNOWN' },
    (qa) => { qa.findings[0].evidence.ruleId = 'invented-rule' },
    (qa) => { qa.findings[0].activityIds = [] },
    (qa) => { qa.findings.push({ ...qa.findings[0], code: 'unapproved_execution_rule_source' }) },
    (qa) => { qa.validation.reconstructed.activities[0].card.programming = {} },
  ]) {
    const qa = structuredClone(result.qa)
    change(qa)
    assert.equal(planProgrammingRepair(qa).status, 'REQUIRES_COACH')
  }
  const unchanged = await generate(fixtures)
  assert.equal(unchanged.status, 'NEEDS_COACH_REVIEW')
  assert.equal(unchanged.stopReason, 'repair_did_not_change_session')
  assert.equal(unchanged.repairPasses, 1)
  assert.equal(unchanged.trace.calls.filter((entry) => entry.role === 'programming_critic').length, 0)
})

function addPreparationAlternative(fixtures) {
  const entry = structuredClone(fixtures.activities[1])
  entry.card.id = uuid(1001); entry.card.variantId = uuid(1101); entry.profile.id = uuid(1201)
  entry.card.familyId = 'alternative-preparation-family'
  entry.card.displayName = 'Reviewed preparation alternative'
  entry.method.id = '1001'; entry.method.name = 'Reviewed preparation alternative method'
  entry.method.prescriptions[0].id = '1101'
  fixtures.options.cards.push(entry.card)
  fixtures.options.methods.push(entry.method)
  fixtures.options.profiles.push({ programming_method_id: entry.method.id, phase_key: entry.profile.phaseKey, role: 'primary', fit_weight: 5 })
  fixtures.options.prescriptions.push({ ...entry.method.prescriptions[0], programming_method_id: entry.method.id })
  fixtures.options.methodStopRules.push({ programming_method_id: entry.method.id, stop_rule: 'Stop before quality declines.' })
}

test('one lifecycle shares ordered capability telemetry from coach request through independent QA', async () => {
  const fixtures = compositionFixtures()
  const result = await generate(fixtures)
  assert.equal(result.status, 'QA_PASSED')
  assert.equal(result.stopReason, 'qa_passed')
  assert.equal(result.repairPasses, 0)
  assert.equal(result.history.length, 1)
  assert.deepEqual(result.trace.calls.map((entry) => entry.role), ['athlete_development', 'director', 'session_builder', 'prepare_access', 'programming_critic'])
  assert.equal(result.draft.draftId, result.qa.draftId)
  assert.equal(result.validatedWorkout, false)
  assert.equal(result.creatorAuthorized, false)
  assert.equal(result.libraryApprovalGranted, false)
  assert.throws(() => { result.history.push({}) }, TypeError)
})

test('downstream repair preserves earlier work and regenerates preparation for changed actual demands', async () => {
  const fixtures = compositionFixtures()
  const prepHashes = []
  const prepare = { ...validPrepare, async invoke(input) { prepHashes.push(input.demand.downstreamHash); return validPrepare.invoke(input) } }
  const builder = repairBuilder((output, input) => {
    assert.deepEqual(input.revision.mutableComponentKeys, ['strength', 'capacity_competition'])
    assert.equal(input.revision.feedback[0].route, 'session_builder')
    output.components.find((entry) => entry.key === 'strength').selections.pop()
  })
  const result = await generate(fixtures, { registry: registry({ builder, prepare, critic: critic(1) }) })
  assert.equal(result.status, 'QA_PASSED')
  assert.equal(result.repairPasses, 1)
  assert.notEqual(prepHashes[0], prepHashes[1])
  assert.equal(result.history[1].preparationDemandChanged, true)
  assert.equal(result.history[1].changes.find((entry) => entry.componentKey === 'explosiveness').changed, false)
  assert.equal(result.history[1].changes.find((entry) => entry.componentKey === 'strength').changed, true)
  assert.equal(result.draft.activities.filter((entry) => entry.componentKey === 'strength').length, 2)
  assert.equal(result.draft.preparationProposal.downstreamHash, result.draft.preparationDemand.downstreamHash)
  assert.equal(result.trace.calls.length, 8)
})

test('preparation-only repair retains every downstream dose without calling the Builder again', async () => {
  const fixtures = compositionFixtures(); addPreparationAlternative(fixtures)
  const prepare = { ...validPrepare, async invoke(input) {
    if (!input.revision) return validPrepare.invoke(input)
    const output = structuredClone(input.revision.previousProposal)
    const component = input.components[0]
    const alternative = component.candidates.find((entry) => !output.selections.some((choice) => choice.deliveryProfileId === entry.deliveryProfileId))
    assert.ok(alternative)
    const replacement = output.selections.find((entry) => entry.role === 'position_rehearsal')
    replacement.deliveryProfileId = alternative.deliveryProfileId
    replacement.programmingMethodId = alternative.methodIds.find((id) => component.methods.find((entry) => entry.id === id).prescriptions.some((rx) =>
      rx.default_work_seconds === alternative.dosage.workSeconds && rx.default_rest_seconds === alternative.dosage.restSeconds))
    output.downstreamHash = input.demand.downstreamHash
    return { output }
  } }
  const result = await generate(fixtures, { registry: registry({ prepare, critic: critic(1, { area: 'preparation', route: 'prepare_access', componentKeys: ['prepare_and_access'] }) }) })
  assert.equal(result.status, 'QA_PASSED', JSON.stringify(result.workflowIssues))
  assert.equal(result.repairPasses, 1)
  assert.equal(result.trace.calls.filter((entry) => entry.role === 'session_builder').length, 1)
  assert.equal(result.trace.calls.filter((entry) => entry.role === 'prepare_access').length, 2)
  assert.equal(result.history[1].preparationDemandChanged, false)
  assert.equal(result.history[1].changes.find((entry) => entry.componentKey === 'prepare_and_access').changed, true)
  assert.ok(result.history[1].changes.filter((entry) => entry.componentKey !== 'prepare_and_access').every((entry) => !entry.changed))
})

test('a downstream repair preserves earlier doses that already required a reviewed set reduction', async () => {
  const fixtures = compositionFixtures()
  const explosive = fixtures.options.cards.find((card) => card.deliveryProfiles[0].phaseKey === 'output')
  explosive.stressProfile.impactStress = 55
  explosive.deliveryProfiles[0].dosage.contactsPerSet = 30
  const builder = repairBuilder((output) => { output.components.find((entry) => entry.key === 'strength').selections.pop() })
  const result = await generate(fixtures, { registry: registry({ builder, critic: critic(1) }) })
  assert.equal(result.status, 'QA_PASSED')
  assert.equal(result.draft.activities.find((entry) => entry.card.id === explosive.id).dose.sets, 1)
  assert.equal(result.draft.activities.find((entry) => entry.card.id === explosive.id).dose.contacts, 30)
  assert.equal(result.history[1].changes.find((entry) => entry.componentKey === 'explosiveness').changed, false)
})

test('a preparation repair cannot silently refresh changed preserved downstream source content', async () => {
  const fixtures = compositionFixtures()
  const reviewer = critic(1, { area: 'preparation', route: 'prepare_access', componentKeys: ['prepare_and_access'] })
  const changingReviewer = { ...reviewer, async invoke(input) {
    const response = await reviewer.invoke(input)
    fixtures.options.cards[3].deliveryProfiles[0].coachInstructions = 'Source changed after deterministic review.'
    return response
  } }
  const result = await generate(fixtures, { registry: registry({ critic: changingReviewer }) })
  assert.equal(result.status, 'NEEDS_COACH_REVIEW')
  assert.equal(result.stopReason, 'repair_failed_validation')
  assert.equal(result.draft.draftId, result.history[0].draftId)
  assert.ok(result.history[1].findings.some((entry) => entry.code === 'stale_preserved_activity'))
})

test('repair cannot change an earlier component outside its scope', async () => {
  const fixtures = compositionFixtures()
  const builder = repairBuilder((output) => { output.components.find((entry) => entry.key === 'explosiveness').selections.pop() })
  const result = await generate(fixtures, { registry: registry({ builder, critic: critic(1) }) })
  assert.equal(result.status, 'NEEDS_COACH_REVIEW')
  assert.equal(result.stopReason, 'repair_failed_validation')
  assert.equal(result.draft.draftId, result.history[0].draftId)
  assert.equal(result.qa.draftId, result.draft.draftId)
  assert.ok(result.history[1].findings.some((entry) => entry.code === 'invalid_output'))
  assert.equal(result.draft.activities.filter((entry) => entry.componentKey === 'explosiveness').length, 3)
})

test('automatic repair retains coach exercise locks even within its mutable scope', async () => {
  const fixtures = compositionFixtures()
  const locked = fixtures.activities[6]
  const request = raw(fixtures)
  request.components = request.components.map((component) => component.key !== 'strength' ? component : { ...component,
    lockedExercises: [{ exerciseCardId: locked.card.id, variantId: locked.card.variantId, deliveryProfileId: locked.profile.id, cardVersion: locked.card.cardVersion }],
  })
  const builder = repairBuilder((output) => { const strength = output.components.find((entry) => entry.key === 'strength');
    strength.selections = strength.selections.filter((entry) => entry.deliveryProfileId !== locked.profile.id) })
  const result = await generate(fixtures, { rawRequest: request, registry: registry({ builder, critic: critic(1) }) })
  assert.equal(result.stopReason, 'repair_failed_validation')
  assert.ok(result.draft.activities.some((entry) => entry.profile.id === locked.profile.id))
  assert.equal(result.draft.draftId, result.history[0].draftId)
})

test('repeated unchanged proposals stop without a cosmetic draft ID causing another Critic call', async () => {
  const fixtures = compositionFixtures()
  const result = await generate(fixtures, { registry: registry({ critic: critic(10) }) })
  assert.equal(result.stopReason, 'repair_did_not_change_session')
  assert.equal(result.repairPasses, 1)
  assert.equal(result.history[1].status, 'rejected')
  assert.equal(result.trace.calls.filter((entry) => entry.role === 'programming_critic').length, 1)
  assert.equal(result.draft.draftId, result.history[0].draftId)
  const clone = structuredClone(result.draft); clone.draftId = uuid(2000); clone.trace.calls = []
  assert.equal(programmingDraftContentHash(clone), programmingDraftContentHash(result.draft))
})

test('cycles and repair-count limits stop with the last complete draft and unresolved QA', async () => {
  const fixtures = compositionFixtures()
  let first = null
  let repairCount = 0
  const cyclingBuilder = { ...validBuilder, async invoke(input) {
    if (!input.revision) { const response = await validBuilder.invoke(input); first = structuredClone(response.output); return response }
    const output = structuredClone(first)
    if (repairCount++ === 0) output.components.find((entry) => entry.key === 'strength').selections.pop()
    return { output }
  } }
  const cycle = await generate(fixtures, { maxRepairPasses: 3, registry: registry({ builder: cyclingBuilder, critic: critic(10) }) })
  assert.equal(cycle.stopReason, 'repair_cycle_detected')
  assert.equal(cycle.repairPasses, 2)
  assert.equal(cycle.draft.draftId, cycle.history[1].draftId)
  const reducingBuilder = repairBuilder((output) => { output.components.find((entry) => entry.key === 'strength').selections.pop() })
  const limit = await generate(fixtures, { registry: registry({ builder: reducingBuilder, critic: critic(10) }) })
  assert.equal(limit.stopReason, 'repair_limit_reached')
  assert.equal(limit.repairPasses, 2)
  assert.equal(limit.history.length, 3)
  assert.equal(limit.qa.critic.status, 'REVISE')
})

test('source/evidence routes and explicit zero-repair configuration never trigger speculative repair agents', async () => {
  const fixtures = compositionFixtures()
  const manual = await generate(fixtures, { registry: registry({ critic: critic(1, { area: 'development_readiness', route: 'athlete_development', componentKeys: [] }) }) })
  assert.equal(manual.stopReason, 'no_automatic_repair_route')
  assert.equal(manual.repairPasses, 0)
  assert.equal(planProgrammingRepair(manual.qa).status, 'REQUIRES_COACH')
  const disabled = await generate(fixtures, { maxRepairPasses: 0, registry: registry({ critic: critic(1) }) })
  assert.equal(disabled.stopReason, 'repair_limit_reached')
  assert.equal(disabled.repairPasses, 0)
})

test('one call and output budget governs the entire lifecycle, including proposed repairs', async () => {
  const fixtures = compositionFixtures()
  const limited = await generate(fixtures, { registry: registry({ critic: critic(1) }), runOptions: { maxCalls: 5 } })
  assert.equal(limited.stopReason, 'run_budget_exhausted')
  assert.equal(limited.trace.calls.length, 5)
  assert.equal(limited.repairPasses, 0)
  const tokens = await generate(fixtures, { runOptions: { maxOutputTokens: 5000 } })
  assert.equal(tokens.status, 'NEEDS_COACH_REVIEW')
  assert.equal(tokens.trace.calls.length, 1)
  assert.equal(tokens.trace.outputTokensReserved, 5000)
  assert.equal(tokens.validatedWorkout, false)
})

test('repair cancellation propagates and failed repair invocation retains the preceding draft', async () => {
  const fixtures = compositionFixtures()
  const controller = new AbortController()
  const cancelBuilder = repairBuilder(() => { controller.abort() })
  await assert.rejects(generate(fixtures, { registry: registry({ builder: cancelBuilder, critic: critic(1) }), runOptions: { signal: controller.signal } }), { code: 'canceled' })
  const unavailable = { ...validBuilder, async invoke(input) { if (input.revision) throw new Error('provider unavailable'); return validBuilder.invoke(input) } }
  const failed = await generate(fixtures, { registry: registry({ builder: unavailable, critic: critic(1) }) })
  assert.equal(failed.stopReason, 'repair_failed_validation')
  assert.equal(failed.draft.draftId, failed.history[0].draftId)
  assert.ok(failed.history[1].findings.some((entry) => entry.code === 'capability_failed'))
})

test('the shared deadline is checked after final database revalidation, not just between model calls', async () => {
  const fixtures = compositionFixtures()
  const pool = fixtures.pool()
  const query = pool.client.query.bind(pool.client)
  const now = Date.now
  let elapsedClock = now()
  let criticReturned = false
  let advanced = false
  const reviewer = critic()
  const timedReviewer = { ...reviewer, async invoke(input) { const result = await reviewer.invoke(input); criticReturned = true; return result } }
  pool.client.query = async (sql, params) => {
    if (sql.startsWith('BEGIN') && criticReturned && !advanced) { advanced = true; elapsedClock += 2000 }
    return query(sql, params)
  }
  Date.now = () => elapsedClock
  try {
    await assert.rejects(generate(fixtures, { pool, registry: registry({ critic: timedReviewer }), runOptions: { timeoutMs: 1000 } }), { code: 'deadline_exceeded' })
    assert.equal(advanced, true)
    assert.equal(pool.calls.at(-1).sql, 'RELEASE')
  } finally { Date.now = now }
})

test('existing server intent is reusable but invalid request combinations and stale repair sources are rejected', async () => {
  const fixtures = compositionFixtures()
  const staff = registry()
  const intent = await directWorkoutProgramming({ pool: fixtures.pool(), context: SCOPE, rawRequest: raw(fixtures), registry: staff })
  const result = await generateWorkoutProgramming({ pool: fixtures.pool(), context: SCOPE, registry: staff, sessionIntent: intent })
  assert.equal(result.status, 'QA_PASSED')
  assert.equal(result.trace.calls.length, 3)
  for (const patch of [{ sessionIntent: intent, rawRequest: raw(fixtures) }, { maxRepairPasses: 4 }, { maxRepairPasses: -1 }]) {
    await assert.rejects(generate(fixtures, patch))
  }
  const bad = structuredClone(result.draft); bad.requestHash = programmingValueHash('different request')
  await assert.rejects(buildWorkoutProgrammingDraft({ pool: fixtures.pool(), context: SCOPE, sessionIntent: intent, registry: staff,
    revision: { previousDraft: bad, mutableComponentKeys: [], feedback: [{ message: 'Change preparation.' }] } }), { code: 'invalid_repair_source' })
  await assert.rejects(buildWorkoutProgrammingDraft({ pool: fixtures.pool(), context: SCOPE, sessionIntent: intent, registry: staff,
    revision: { previousDraft: result.draft, mutableComponentKeys: ['strength'], feedback: [{ message: 'Change strength.' }] } }), { code: 'invalid_repair_scope' })
})
