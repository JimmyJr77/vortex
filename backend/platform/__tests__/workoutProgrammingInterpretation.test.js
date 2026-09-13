import assert from 'node:assert/strict'
import test from 'node:test'
import { interpretWorkoutProgrammingRevision, applyProgrammingInterpretation, programmingInterpretationContract } from '../workoutProgrammingInterpretation.js'
import { createProgrammingStaffRegistry } from '../programmingStaffRuntime.js'
import { normalizeCoachWorkoutRequest, programmingValueHash } from '../workoutProgrammingRequest.js'
import { loadWorkoutProgrammingChoices } from '../workoutProgrammingChoices.js'
import { compileWorkoutProgrammingModification } from '../workoutProgrammingModification.js'
import { generateAndPersistWorkoutProgramming } from '../workoutProgrammingService.js'
import { modificationFixtures as sourceFixtures, modificationRequest } from './workoutProgrammingModificationFixtures.js'
import { SCOPE, uuid } from './workoutProgrammingLibrarianFixtures.js'
import { createProgrammingStaffModelInvoker } from '../programmingStaffModel.js'
import { MockLanguageModelV3 } from 'ai/test'
import { syntheticInterpretationTaxonomy, withSyntheticInterpretationTaxonomy } from './workoutProgrammingInterpretationFixtures.js'

async function modificationFixtures() {
  const state = await sourceFixtures()
  const taxonomy = syntheticInterpretationTaxonomy()
  return { ...state, taxonomy, pool: withSyntheticInterpretationTaxonomy(state.pool, taxonomy) }
}

const instruction = 'Use ages 9–11, 15 athletes, 3 lanes and 60 athletic minutes. Focus explosiveness on acceleration and make capacity competitive.'
function director(operations, { questions = [], during, transform } = {}) {
  const calls = []
  const registry = createProgrammingStaffRegistry([{ id: 'vortex/director', role: 'director', version: 'test-interpretation', async invoke(input, context) {
    calls.push({ input, context })
    await during?.(input, context)
    const output = { requestRevision: input.request.revision, summary: 'Review the proposed controls before rebuilding the whole workout.',
      questions, operations: typeof operations === 'function' ? operations(input) : operations }
    transform?.(output)
    return { output, modelVersion: 'synthetic-interpreter', usage: { inputTokens: 100, outputTokens: 300 } }
  } }])
  return { registry, calls }
}
const operation = (kind, fields, instructionQuote = instruction) => ({ kind, ...fields, instructionQuote })
const run = (state, model, patch = {}) => interpretWorkoutProgrammingRevision({ pool: state.pool, context: SCOPE, registry: model.registry,
  rawInput: { request: modificationRequest(state.saved), instruction }, ...patch })

test('one Director call translates age, group logistics, time and acceleration into reviewable typed controls without writes', async () => {
  const state = await modificationFixtures()
  const model = director((input) => [operation('age_range', { cohortKey: input.request.athletes[0].key, ageMin: 9, ageMax: 11 }),
    operation('group_size', { cohortKey: input.request.athletes[0].key, athleteCount: 15 }), operation('logistics', { field: 'laneCount', value: 3 }),
    operation('session_time', { athleticMinutes: 60, tumblingMinutes: 0 }),
    operation('priority', { componentKey: 'explosiveness', facet: 'athletic_niche', value: 'acceleration', strength: 'preferred', weight: 80 }),
    operation('regenerate_components', { componentKeys: ['explosiveness', 'capacity_competition'] })])
  const result = await run(state, model)
  assert.equal(result.status, 'READY_FOR_REVIEW', JSON.stringify(result.issues))
  assert.equal(result.sourceContentHash, state.saved.workout.contentHash)
  assert.equal(result.workoutGenerated, false)
  assert.equal(result.libraryApprovalGranted, false)
  assert.equal(result.proposedRequest.athletes[0].ageMin, 9)
  assert.equal(result.proposedRequest.athletes[0].ageMax, 11)
  assert.equal(result.proposedRequest.athletes[0].athleteCount, 15)
  assert.equal(result.proposedRequest.logistics.laneCount, 3)
  assert.equal(result.proposedRequest.logistics.totalBookedMinutes, 60)
  assert.deepEqual(result.proposedRequest.components.find((entry) => entry.key === 'explosiveness').priorities,
    [{ facet: 'athletic_niche', value: 'acceleration', strength: 'preferred', weight: 80 }])
  assert.equal(result.proposedRequest.instruction, instruction)
  assert.ok(result.changes.some((entry) => entry.label.endsWith('Youngest age') && entry.after === 9))
  assert.equal(result.proposalHash, programmingValueHash({ baseRequestHash: result.baseRequestHash, sourceContentHash: result.sourceContentHash,
    sourceTaxonomyHash: result.sourceTaxonomyHash, proposedRequest: result.proposedRequest }))
  assert.equal(model.calls.length, 1)
  assert.equal(model.calls[0].input.task, 'interpret_revision_controls')
  assert.equal(model.calls[0].input.choices.creatorAuthorized, false)
  assert.equal(result.trace.calls[0].modelVersion, 'synthetic-interpreter')
  assert.equal(state.database.rows.size, 1)
  assert.equal(state.database.calls.filter((entry) => entry.sql.includes('INSERT INTO')).length, 1)
})

test('unknown edits, invented references, unsupported taxonomy and unquoted changes cannot become proposed controls', async () => {
  const state = await modificationFixtures()
  for (const edit of [operation('grant_readiness', { cleared: true }), operation('replace_exercise', { blockId: 'strength:1', deliveryProfileId: uuid(999) }),
    operation('priority', { componentKey: 'strength', facet: 'methodology', value: 'invented_method', strength: 'preferred', weight: 70 }),
    operation('logistics', { field: 'laneCount', value: 2 }, 'Words the coach never supplied')]) {
    const model = director([edit])
    const result = await run(state, model)
    assert.equal(result.status, 'NEEDS_COACH_INPUT')
    assert.equal(result.proposedRequest, null)
    assert.equal(result.changes.length, 0)
    assert.equal(model.calls.length, 1)
  }
  const forged = director([], { transform: (output) => { output.overrideLocks = true } })
  assert.equal((await run(state, forged)).status, 'NEEDS_COACH_INPUT')
  assert.equal(state.database.rows.size, 1)
})

test('ambiguity returns questions and no partial applyable request, even when the model also proposes edits', async () => {
  const state = await modificationFixtures()
  const model = director([operation('logistics', { field: 'laneCount', value: 2 })], { questions: ['Does the 60-minute booking include tumbling?'] })
  const result = await run(state, model)
  assert.equal(result.status, 'NEEDS_COACH_INPUT')
  assert.deepEqual(result.questions, ['Does the 60-minute booking include tumbling?'])
  assert.equal(result.proposedRequest, null)
  assert.deepEqual(result.changes, [])
})

test('source identity is verified before and after interpretation and never accepted from client payloads', async () => {
  const state = await modificationFixtures()
  const model = director([])
  const request = modificationRequest(state.saved)
  for (const patch of [{ sourceSnapshot: state.saved }, { maxCalls: 20 }, { facilityId: '10' }, { proposalHash: 'forged' }]) {
    await assert.rejects(run(state, model, { rawInput: { request, instruction, ...patch } }), TypeError)
  }
  await assert.rejects(run(state, model, { rawInput: { request: { ...request, modification: { ...request.modification, expectedRevision: 'stale' } }, instruction } }), { code: 'source_workout_revision_conflict' })
  await assert.rejects(run(state, model, { context: { facilityId: '10', userId: '8' } }), { code: 'source_workout_unavailable' })
  assert.equal(model.calls.length, 0)
  const removed = director([], { during: () => state.database.rows.delete(state.saved.persistedWorkoutId) })
  await assert.rejects(run(state, removed), { code: 'source_workout_unavailable' })
  assert.equal(removed.calls.length, 1)
})

test('conflicting interpretations retain source locks and normalizer bounds instead of repairing them silently', async () => {
  const state = await modificationFixtures()
  const request = modificationRequest(state.saved)
  const block = state.saved.workout.workflow.draft.activities.find((entry) => entry.componentKey === 'strength')
  request.components.find((entry) => entry.key === 'strength').lockedBlocks = [{ blockId: block.activityId, fields: ['dose'] }]
  const result = await run(state, director([operation('block_dose', { blockId: block.activityId, field: 'sets', value: 2 })]), { rawInput: { request, instruction } })
  assert.equal(result.status, 'NEEDS_COACH_INPUT')
  assert.match(result.issues[0].detail, /dose change contradicts its block lock/)
  const original = structuredClone(request)
  const valid = await run(state, director([operation('logistics', { field: 'laneCount', value: 2 })]), { rawInput: { request, instruction } })
  assert.deepEqual(valid.proposedRequest.components.find((entry) => entry.key === 'strength').lockedBlocks,
    request.components.find((entry) => entry.key === 'strength').lockedBlocks)
  assert.deepEqual(request, original)
  for (const edits of [[operation('logistics', { field: 'coachCount', value: 0 })],
    [operation('logistics', { field: 'laneCount', value: 2 }), operation('logistics', { field: 'laneCount', value: 4 })],
    [operation('regenerate_components', { componentKeys: ['body_control'] })],
    [operation('priority', { componentKey: 'body_control', facet: 'tenet', value: 'body_control', strength: 'preferred', weight: 80 })]]) {
    assert.equal((await run(state, director(edits))).status, 'NEEDS_COACH_INPUT')
  }
})

test('roster resizing cannot clear identities, readiness, restrictions or existing source evidence', async () => {
  const state = await modificationFixtures()
  const raw = modificationRequest(state.saved)
  raw.athletes[0].memberIds = Array.from({ length: raw.athletes[0].athleteCount }, (_, i) => String(101 + i))
  raw.athletes[0].limitations = ['Existing coach restriction']
  raw.athletes[0].evidenceReferences = [{ kind: 'skill_progress', id: '71', memberId: '101', expectedSourceHash: 'a'.repeat(64) }]
  const request = normalizeCoachWorkoutRequest(raw)
  const plan = compileWorkoutProgrammingModification(request, state.saved)
  const choices = await loadWorkoutProgrammingChoices(state.pool, SCOPE, modificationRequest(state.saved))
  const output = { requestRevision: request.revision, summary: 'Adjust roster size.', questions: [], operations: [operation('group_size', { cohortKey: request.athletes[0].key, athleteCount: request.athletes[0].athleteCount + 1 })] }
  assert.throws(() => applyProgrammingInterpretation(request, plan, choices, output, instruction), /roster must bind every athlete/)
  output.operations = [operation('age_range', { cohortKey: request.athletes[0].key, ageMin: 9, ageMax: 11 })]
  const applied = applyProgrammingInterpretation(request, plan, choices, output, instruction)
  for (const field of ['memberIds', 'evidenceReferences', 'limitations', 'readiness']) assert.deepEqual(applied.proposedRequest.athletes[0][field], request.athletes[0][field])
})

test('canonical swaps and dose proposals become a real reviewed child only through the existing generation service', async () => {
  const state = await modificationFixtures()
  const [first, second] = state.saved.workout.workflow.draft.activities.filter((entry) => entry.componentKey === 'strength')
  const text = 'Swap the first two strength exercises, use method 9 for the first and reduce its sets to 2.'
  const edits = [operation('replace_exercise', { blockId: first.activityId, deliveryProfileId: second.profile.id }, text),
    operation('replace_exercise', { blockId: second.activityId, deliveryProfileId: first.profile.id }, text),
    operation('block_method', { blockId: first.activityId, programmingMethodId: '9' }, text),
    operation('block_dose', { blockId: first.activityId, field: 'sets', value: 2 }, text)]
  const result = await run(state, director(edits), { rawInput: { request: modificationRequest(state.saved), instruction: text } })
  assert.equal(result.status, 'READY_FOR_REVIEW', JSON.stringify(result.issues))
  assert.equal(state.database.rows.size, 1)
  assert.deepEqual(new Set(result.reviewReferences.exercises.map((entry) => entry.ref.deliveryProfileId)), new Set([first.profile.id, second.profile.id]))
  assert.equal(result.reviewReferences.methods.find((entry) => entry.id === '9').name, 'strength reviewed method 9')
  assert.ok(result.changes.some((entry) => entry.label === first.card.displayName))
  const { assumptions, ...rawRequest } = result.proposedRequest
  const saved = await generateAndPersistWorkoutProgramming({ pool: state.pool, context: SCOPE, registry: state.registry, rawRequest })
  assert.equal(saved.workout.status, 'QA_PASSED', JSON.stringify(saved.workout.validation.findings.map((entry) => entry.code)))
  const changed = saved.workout.workflow.draft.activities.find((entry) => entry.activityId === first.activityId)
  assert.equal(changed.profile.id, second.profile.id)
  assert.equal(changed.method.id, '9')
  assert.equal(changed.dose.sets, 2)
  assert.equal(state.database.rows.size, 2)
  assert.equal(saved.workout.workflow.sessionIntent.modification.sourceContentHash, state.saved.workout.contentHash)
})

test('equipment and component clocks use existing vocabulary and report derived changes without granting availability or waiving conflicts', async () => {
  const state = await modificationFixtures()
  const text = 'We have six dumbbells. Book 60 athletic minutes and 20 tumbling minutes. Use dumbbells for Strength.'
  const edits = [operation('equipment_availability', { equipmentKey: 'dumbbell', available: true, quantity: 6 }, text),
    operation('component_equipment', { componentKey: 'strength', allowed: ['dumbbell'] }, text),
    operation('session_time', { athleticMinutes: 60, tumblingMinutes: 20 }, text)]
  const result = await run(state, director(edits), { rawInput: { request: modificationRequest(state.saved), instruction: text } })
  assert.equal(result.status, 'READY_FOR_REVIEW', JSON.stringify(result.issues))
  assert.equal(result.proposedRequest.equipment.quantities.dumbbell, 6)
  assert.equal(result.proposedRequest.logistics.totalBookedMinutes, 80)
  assert.equal(result.proposedRequest.components.find((entry) => entry.key === 'body_control').budgetSeconds, 1200)
  assert.ok(result.changes.some((entry) => entry.path === 'logistics.totalBookedMinutes' && entry.after === 80))
  assert.ok(result.changes.some((entry) => entry.path === 'components.body_control'))
  assert.equal(result.proposedRequest.athletes[0].readiness, state.saved.workout.intent.athletes[0].readiness)
  const request = modificationRequest(state.saved)
  request.equipment = { ...request.equipment, available: ['none', 'dumbbell'], required: ['dumbbell'], quantities: { dumbbell: 6 } }
  const removed = await run(state, director([operation('equipment_availability', { equipmentKey: 'dumbbell', available: false, quantity: null })]), { rawInput: { request, instruction } })
  assert.equal(removed.status, 'NEEDS_COACH_INPUT')
  assert.equal(removed.proposedRequest, null)
})

test('strict JSON schema and runtime parsing bind revisions and cancellation aborts the sole provider call', async () => {
  const state = await modificationFixtures()
  const request = normalizeCoachWorkoutRequest(modificationRequest(state.saved))
  const plan = compileWorkoutProgrammingModification(request, state.saved)
  const choices = await loadWorkoutProgrammingChoices(state.pool, SCOPE, modificationRequest(state.saved))
  const contract = programmingInterpretationContract(request, plan, choices, instruction)
  assert.equal(contract.outputSchema.additionalProperties, false)
  assert.ok(contract.outputSchema.properties.operations.items.anyOf.every((variant) => variant.additionalProperties === false
    && variant.required.includes('instructionQuote')))
  assert.throws(() => contract.parseOutput({ requestRevision: 'foreign', summary: 'Bad', questions: [], operations: [] }))
  const controller = new AbortController()
  let signal
  const model = director([], { during: (_input, context) => { signal = context.signal; controller.abort(); return new Promise(() => {}) } })
  await assert.rejects(run(state, model, { runOptions: { signal: controller.signal } }), { code: 'canceled' })
  assert.equal(signal.aborted, true)
  assert.equal(model.calls.length, 1)
  assert.equal(state.database.rows.size, 1)
})

test('the installed AI SDK accepts the edit union and uses the existing Director role with no extra tools or calls', async () => {
  const state = await modificationFixtures()
  const request = modificationRequest(state.saved)
  const output = { requestRevision: request.revision, summary: 'Review the lane change.', questions: [], operations: [operation('logistics', { field: 'laneCount', value: 2 })] }
  const model = new MockLanguageModelV3({ doGenerate: {
    content: [{ type: 'text', text: JSON.stringify(output) }], finishReason: { unified: 'stop', raw: 'stop' }, warnings: [],
    usage: { inputTokens: { total: 12, noCache: 12, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 80, text: 80, reasoning: 0 } },
  } })
  const registry = createProgrammingStaffRegistry([{ id: 'vortex/director', role: 'director', version: 'test-sdk-interpretation',
    invoke: createProgrammingStaffModelInvoker({ model, role: 'director', modelVersion: model.modelId }) }])
  const result = await run(state, { registry }, { rawInput: { request, instruction } })
  assert.equal(result.status, 'READY_FOR_REVIEW', JSON.stringify(result.issues))
  assert.equal(model.doGenerateCalls.length, 1)
  assert.equal(model.doGenerateCalls[0].responseFormat.type, 'json')
  assert.ok(model.doGenerateCalls[0].responseFormat.schema.properties.operations.items.anyOf.length >= 10)
  assert.match(model.doGenerateCalls[0].prompt[0].content, /interpret_revision_controls/)
  assert.equal(result.proposedRequest.logistics.laneCount, 2)
  assert.equal(result.trace.calls[0].usage.outputTokens, 80)
})

test('canonical replacement eligibility is checked again after the interpreted athlete controls change', async () => {
  const state = await modificationFixtures()
  const [first, second] = state.saved.workout.workflow.draft.activities.filter((entry) => entry.componentKey === 'strength')
  const model = director((input) => [operation('age_range', { cohortKey: input.request.athletes[0].key, ageMin: 90, ageMax: 99 }),
    operation('replace_exercise', { blockId: first.activityId, deliveryProfileId: second.profile.id })])
  const result = await run(state, model)
  assert.equal(result.status, 'NEEDS_COACH_INPUT')
  assert.equal(result.proposedRequest, null)
  assert.match(result.issues[0].detail, /no longer eligible/)
  assert.equal(model.calls.length, 1)
  assert.equal(state.database.rows.size, 1)
})

test('database taxonomy governs offered priorities and a catalog change during interpretation invalidates the proposal', async () => {
  const state = await modificationFixtures()
  const term = state.taxonomy.find((entry) => entry.facet_type === 'athletic_niche' && entry.key === 'acceleration')
  term.status = 'retired'
  const edit = operation('priority', { componentKey: 'explosiveness', facet: 'athletic_niche', value: 'acceleration', strength: 'preferred', weight: 80 })
  const model = director([edit])
  const retired = await run(state, model)
  assert.equal(retired.status, 'NEEDS_COACH_INPUT')
  assert.equal(model.calls[0].input.taxonomy.athletic_niche.some((entry) => entry.key === 'acceleration'), false)
  term.status = 'active'
  const changing = director([edit], { during: () => { term.status = 'retired' } })
  await assert.rejects(run(state, changing), { code: 'interpretation_sources_changed' })
  assert.equal(state.database.rows.size, 1)
})

test('reaffirming equipment and priority controls preserves order and cannot widen revision scope unnecessarily', async () => {
  const state = await modificationFixtures()
  const request = modificationRequest(state.saved)
  request.equipment.available = ['none', 'dumbbell', 'kettlebell']
  request.priorities = [{ facet: 'tenet', value: 'strength', strength: 'preferred', weight: 70 },
    { facet: 'tenet', value: 'speed', strength: 'preferred', weight: 80 }]
  const model = director([operation('equipment_availability', { equipmentKey: 'dumbbell', available: true, quantity: 6 }),
    operation('priority', { componentKey: null, facet: 'tenet', value: 'strength', strength: 'preferred', weight: 70 })])
  const result = await run(state, model, { rawInput: { request, instruction } })
  assert.equal(result.status, 'READY_FOR_REVIEW', JSON.stringify(result.issues))
  assert.deepEqual(result.proposedRequest.equipment.available, request.equipment.available)
  assert.deepEqual(result.proposedRequest.priorities, request.priorities)
  assert.deepEqual(result.changes.map((entry) => entry.path), ['instruction'])
})
