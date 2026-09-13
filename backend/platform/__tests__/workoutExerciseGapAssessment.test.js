import assert from 'node:assert/strict'
import test from 'node:test'
import { assessWorkoutExerciseGap } from '../workoutExerciseGapAssessment.js'
import { createProgrammingStaffRegistry } from '../programmingStaffRuntime.js'
import { createProgrammingStaffModelInvoker } from '../programmingStaffModel.js'
import { MockLanguageModelV3 } from 'ai/test'
import { exerciseGapResearchFixtures as fixtures } from './workoutExerciseGapFixtures.js'
import { SCOPE, uuid } from './workoutProgrammingLibrarianFixtures.js'

function decision(input) {
  const { research } = input
  const method = research.resources.programming.candidates[0]
  return { requestRevision: research.requestRevision, researchHash: research.researchHash,
    summary: 'The researched alternatives do not supply this synthetic movement stimulus.', needAssessment: 'supported',
    needRationale: 'Synthetic judgment: this movement demand is achievable within the declared athlete and session controls.', questions: [],
    alternatives: research.relatedDefinitions.map((card) => ({ definitionId: card.id, cardVersion: card.cardVersion,
      disposition: 'different_movement', rationale: 'Synthetic content judgment: this drill delivers a materially different movement stimulus.' })),
    proposedKind: 'missing_movement', targetDefinitionId: null, targetVariantId: null, phaseKey: method.phaseKey, programmingMethodId: method.programmingMethodId }
}
function director(transform = () => {}, during = () => {}) {
  const calls = []
  const registry = createProgrammingStaffRegistry([{ id: 'vortex/director', role: 'director', version: 'synthetic-gap-1', async invoke(input, context) {
    calls.push({ input, context })
    await during(input, context)
    const output = decision(input)
    transform(output, input)
    return { output, modelVersion: 'synthetic-gap-judge', usage: { inputTokens: 100, outputTokens: 500 } }
  } }])
  return { registry, calls }
}
const assess = (state, model, input = {}, options = {}) => assessWorkoutExerciseGap({ pool: state.pool, context: SCOPE,
  rawInput: { request: state.request, componentKey: 'strength', need: state.need, ...input }, registry: model.registry, ...options })

test('complete exact-version judgments produce a source-bound movement gap with fresh research and no publication authority', async () => {
  const state = fixtures()
  const model = director()
  const result = await assess(state, model)
  assert.equal(result.status, 'GAP_CONFIRMED', JSON.stringify(result.issues))
  assert.equal(result.exerciseGap.reason, 'missing_movement')
  assert.equal(result.exerciseGap.target, null)
  assert.equal(result.exerciseGap.sourceHash, result.research.sourceHash)
  assert.equal(result.exerciseGap.researchHash, result.research.researchHash)
  assert.deepEqual(result.exerciseGap.scope, SCOPE)
  assert.equal(result.exerciseGap.alternativesConsidered.length, result.research.relatedDefinitions.length)
  assert.equal(result.creatorAuthorized, false)
  assert.equal(result.exerciseGap.humanReviewRequired, true)
  assert.equal(result.exerciseGap.authorizesLibraryInclusion, false)
  assert.equal(model.calls.length, 1)
  assert.equal(model.calls[0].input.task, 'assess_exercise_gap')
  assert.equal(result.trace.calls[0].modelVersion, 'synthetic-gap-judge')
  assert.equal(state.researchCalls.filter((entry) => entry.sql.startsWith('BEGIN')).length, 2)
  assert.ok(state.researchCalls.every((entry) => !/^\s*(INSERT|UPDATE|DELETE)/.test(entry.sql)))
})

test('an eligible alternative wins over a requested new card, while missing approval or constraints require review', async () => {
  for (const disposition of ['reusable', 'existing_content_needs_review', 'context_conflict', 'insufficient_evidence']) {
    const state = fixtures()
    const model = director((output, input) => {
      const card = input.research.relatedDefinitions.find((entry) => entry.eligibleProfileIds.length)
      output.alternatives.find((entry) => entry.definitionId === card.id).disposition = disposition
    })
    const result = await assess(state, model)
    assert.equal(result.status, disposition === 'reusable' ? 'REUSE_EXISTING' : 'NEEDS_COACH_REVIEW')
    assert.equal(result.exerciseGap, null)
    assert.equal(result.creatorAuthorized, false)
  }
})

test('a missing delivery context binds an existing exact variant and never duplicates a draft, archived or avoid profile', async () => {
  const state = fixtures()
  const target = state.rows.find((row) => row.phase_key === 'output')
  const model = director((output) => {
    output.proposedKind = 'missing_delivery_profile'
    output.targetDefinitionId = target.definition_id
    output.targetVariantId = target.variant_id
    output.alternatives.find((entry) => entry.definitionId === target.definition_id).disposition = 'missing_delivery_profile'
  })
  const input = { need: { ...state.need, canonicalName: target.canonical_name, aliases: [] } }
  const gap = await assess(state, model, input)
  assert.equal(gap.status, 'GAP_CONFIRMED', JSON.stringify(gap.issues))
  assert.equal(gap.exerciseGap.reason, 'missing_delivery_profile')
  assert.deepEqual(gap.exerciseGap.target, { exerciseCardId: target.definition_id, variantId: target.variant_id, cardVersion: target.card_version })
  for (const status of ['draft', 'archived', 'published']) {
    state.rows.push({ ...target, profile_id: uuid(7000), profile_status: status, phase_key: gap.exerciseGap.phaseKey, role: 'avoid' })
    const result = await assess(state, model, input)
    assert.equal(result.status, 'NEEDS_COACH_REVIEW')
    assert.ok(result.issues.some((entry) => entry.code === 'gap_existing_delivery_profile'))
    state.rows.pop()
  }
  for (const status of ['draft', 'review']) {
    target.definition_status = status
    assert.equal((await assess(state, model, input)).issues[0].code, 'gap_profile_target_needs_review')
  }
  target.definition_status = 'published'
  target.variant_status = 'draft'
  assert.equal((await assess(state, model, input)).issues[0].code, 'gap_profile_target_needs_review')
})

test('missing release, taxonomy, equipment and incomplete research stop before a model call', async () => {
  const noRelease = fixtures({ patch: { noRelease: true } })
  const equipment = fixtures()
  for (const [state, input] of [[noRelease, {}], [equipment, { need: { ...equipment.need, requiredEquipment: ['barbell'] } }],
    [equipment, { need: { ...equipment.need, movementPatterns: ['invented_pattern'] } }]]) {
    const model = director()
    const result = await assess(state, model, input)
    assert.equal(result.status, 'NEEDS_COACH_REVIEW')
    assert.equal(result.exerciseGap, null)
    assert.equal(model.calls.length, 0)
  }
  const truncated = fixtures()
  truncated.rows.push(...Array.from({ length: 105 }, (_, index) => ({ ...truncated.rows[0], definition_id: uuid(8000 + index) })))
  const model = director()
  assert.equal((await assess(truncated, model)).status, 'NEEDS_COACH_REVIEW')
  assert.equal(model.calls.length, 0)
})

test('omitted, duplicated, foreign or stale alternatives and injected authority cannot confirm a gap', async () => {
  for (const transform of [
    (output) => output.alternatives.pop(),
    (output) => { output.alternatives[1] = output.alternatives[0] },
    (output) => { output.alternatives[0].definitionId = uuid(999999) },
    (output) => { output.alternatives[0].cardVersion += 1 },
    (output) => { output.researchHash = 'stale' },
    (output) => { output.creatorAuthorized = true },
    (output) => { output.programmingMethodId = '999999' },
  ]) {
    const model = director(transform)
    const result = await assess(fixtures(), model)
    assert.equal(result.status, 'NEEDS_COACH_REVIEW')
    assert.equal(result.exerciseGap, null)
    assert.equal(result.issues[0].code, 'invalid_output')
    assert.equal(model.calls.length, 1)
  }
})

test('equipment quantities, component locks, method locks and excluded profile targets remain binding', async () => {
  const state = fixtures()
  const equipmentRequest = { ...state.request, equipment: { ...state.request.equipment, available: ['bodyweight', 'barbell'], quantities: {} } }
  const model = director()
  const unknown = await assess(state, model, { request: equipmentRequest, need: { ...state.need, requiredEquipment: ['barbell'] } })
  assert.equal(unknown.issues[0].code, 'gap_equipment_quantity_unknown')
  assert.equal(model.calls.length, 0)
  const available = await assess(state, director(), { request: { ...equipmentRequest, equipment: { ...equipmentRequest.equipment, quantities: { barbell: 2 } } },
    need: { ...state.need, requiredEquipment: ['barbell'] } })
  assert.equal(available.status, 'GAP_CONFIRMED', JSON.stringify(available.issues))
  const baseline = await assess(state, director())
  const choices = baseline.research.resources.exercises.candidates
  const locked = { ...state.request, components: state.request.components.map((entry) => entry.key === 'strength' ? { ...entry, lockedExercises: [choices[0].ref] } : entry) }
  assert.equal((await assess(state, director(), { request: locked })).issues[0].code, 'gap_locked_component')
  const methodIds = [...new Set(baseline.research.resources.programming.candidates.map((entry) => entry.programmingMethodId))]
  const methodLocked = { ...state.request, components: state.request.components.map((entry) => entry.key === 'strength' ? { ...entry, lockedProgrammingMethodIds: [methodIds[0]] } : entry) }
  assert.equal((await assess(state, director((output) => { output.programmingMethodId = methodIds[1] }), { request: methodLocked })).issues[0].code, 'gap_programming_lock_conflict')
  const target = state.rows.find((row) => row.phase_key === 'output')
  const targetModel = director((output) => {
    output.proposedKind = 'missing_delivery_profile'; output.targetDefinitionId = target.definition_id; output.targetVariantId = target.variant_id
    output.alternatives.find((entry) => entry.definitionId === target.definition_id).disposition = 'missing_delivery_profile'
  })
  const excluded = await assess(state, targetModel, { request: { ...state.request, excludedExerciseCardIds: [target.definition_id] } })
  assert.equal(excluded.issues[0].code, 'gap_excluded_profile_target')
})

test('exact aliases, ineligible reuse, developmental uncertainty and unbound profile targets remain reviewable', async () => {
  const exact = fixtures()
  exact.rows[0].aliases = [exact.need.canonicalName]
  assert.equal((await assess(exact, director())).issues[0].code, 'gap_existing_identity')
  const state = fixtures()
  const model = director((output, input) => {
    const card = input.research.relatedDefinitions.find((entry) => !entry.eligibleProfileIds.length)
    output.alternatives.find((entry) => entry.definitionId === card.id).disposition = 'reusable'
  })
  assert.equal((await assess(state, model)).issues[0].code, 'gap_unapproved_reuse')
  assert.equal((await assess(state, director((output) => { output.needAssessment = 'needs_coach_review' }))).issues[0].code, 'gap_need_review')
  assert.equal((await assess(state, director((output) => { output.proposedKind = 'missing_delivery_profile' }))).issues[0].code, 'gap_profile_target_invalid')
})

test('source changes during judgment invalidate the result and cancellation aborts the existing bounded runtime', async () => {
  const changed = fixtures()
  await assert.rejects(assess(changed, director(() => {}, () => { changed.rows[0].definition_status = 'review' })), { code: 'exercise_gap_sources_changed' })
  const controller = new AbortController()
  let signal
  const model = director(() => {}, (_input, context) => { signal = context.signal; controller.abort() })
  await assert.rejects(assess(fixtures(), model, {}, { runOptions: { signal: controller.signal } }), { code: 'canceled' })
  assert.equal(signal.aborted, true)
  assert.equal(model.calls.length, 1)
})

test('task-specific Director instructions use the installed AI SDK structured-output adapter', async () => {
  let system
  const state = fixtures()
  const model = new MockLanguageModelV3({ doGenerate: async ({ prompt }) => {
    system = prompt.find((entry) => entry.role === 'system').content
    const content = prompt.find((entry) => entry.role === 'user').content.find((entry) => entry.type === 'text').text
    return { content: [{ type: 'text', text: JSON.stringify(decision(JSON.parse(content).context)) }], finishReason: { unified: 'stop', raw: 'stop' },
      usage: { inputTokens: { total: 100 }, outputTokens: { total: 200 } }, warnings: [] }
  } })
  const registry = createProgrammingStaffRegistry([{ id: 'vortex/director', role: 'director', version: 'test-sdk',
    invoke: createProgrammingStaffModelInvoker({ model, role: 'director' }) }])
  const result = await assess(state, { registry })
  assert.equal(result.status, 'GAP_CONFIRMED', JSON.stringify(result.issues))
  assert.match(system, /task assess_exercise_gap/)
  assert.match(system, /Missing approval/)
  assert.doesNotMatch(system, /Your output is a session-intent proposal/)
})
