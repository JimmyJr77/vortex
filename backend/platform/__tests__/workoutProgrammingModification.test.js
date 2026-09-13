import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeCoachWorkoutRequest, programmingValueHash } from '../workoutProgrammingRequest.js'
import { compileWorkoutProgrammingModification, loadWorkoutProgrammingModification } from '../workoutProgrammingModification.js'
import { generateWorkoutProgramming } from '../workoutProgrammingWorkflow.js'
import { generateAndPersistWorkoutProgramming } from '../workoutProgrammingService.js'
import { loadWorkoutProgrammingRun, revalidateWorkoutProgrammingRun, persistWorkoutProgrammingRun } from '../workoutProgrammingRepository.js'
import { validateWorkoutProgrammingDraft } from '../workoutProgrammingQA.js'
import { modificationFixtures, modificationRequest } from './workoutProgrammingModificationFixtures.js'
import { SCOPE, uuid } from './workoutProgrammingLibrarianFixtures.js'

const sourceBlock = (state, key = 'strength', position = 0) => state.saved.workout.workflow.draft.activities.filter((entry) => entry.componentKey === key)[position]
const reference = (activity) => ({ exerciseCardId: activity.card.id, variantId: activity.card.variantId, deliveryProfileId: activity.profile.id, cardVersion: activity.card.cardVersion })
const generate = (state, rawRequest) => generateWorkoutProgramming({ pool: state.pool, context: SCOPE, registry: state.registry, rawRequest })

test('modification compiles selected components, downstream effects and unchanged earlier work from the database parent', async () => {
  const state = await modificationFixtures()
  const request = normalizeCoachWorkoutRequest(modificationRequest(state.saved))
  const plan = await loadWorkoutProgrammingModification({ pool: state.pool, context: SCOPE, request })
  assert.deepEqual(plan.context.mutableComponentKeys, ['strength', 'capacity_competition'])
  assert.deepEqual(plan.context.preservedComponentKeys, ['explosiveness'])
  assert.equal(plan.context.sourceContentHash, state.saved.workout.contentHash)
  assert.equal(plan.context.globalControlsChanged, false)
  assert.ok(plan.blocks.filter((block) => block.componentKey === 'explosiveness').every((block) => block.lockedFields.length === 4))
  const resized = normalizeCoachWorkoutRequest({ ...modificationRequest(state.saved), logistics: { ...request.logistics, laneCount: 2 } })
  assert.equal(compileWorkoutProgrammingModification(resized, state.saved).context.globalControlsChanged, true)
  assert.deepEqual(compileWorkoutProgrammingModification(resized, state.saved).context.preservedComponentKeys, [])
  assert.throws(() => { plan.context.sourceRevision = 'edited' }, TypeError)
})

test('a coached dose edit saves a new immutable revision, retains earlier prescriptions and regenerates preparation demand', async () => {
  const state = await modificationFixtures()
  const rawRequest = modificationRequest(state.saved)
  rawRequest.modification.blockEdits = [{ blockId: sourceBlock(state).activityId, dose: { sets: 2 } }]
  const revised = await generateAndPersistWorkoutProgramming({ pool: state.pool, context: SCOPE, registry: state.registry, rawRequest })
  assert.equal(revised.workout.status, 'QA_PASSED', JSON.stringify(revised.workout.validation.findings.map((finding) => finding.code)))
  assert.notEqual(revised.persistedWorkoutId, state.saved.persistedWorkoutId)
  assert.equal(state.database.rows.size, 2)
  const draft = revised.workout.workflow.draft
  assert.equal(draft.activities.find((entry) => entry.activityId === sourceBlock(state).activityId).dose.sets, 2)
  assert.deepEqual(draft.activities.filter((entry) => entry.componentKey === 'explosiveness'), state.saved.workout.workflow.draft.activities.filter((entry) => entry.componentKey === 'explosiveness'))
  assert.notEqual(draft.preparationDemand.downstreamHash, state.saved.workout.workflow.draft.preparationDemand.downstreamHash)
  assert.equal(draft.preparationProposal.downstreamHash, draft.preparationDemand.downstreamHash)
  assert.equal(revised.workout.workflow.sessionIntent.modification.sourceContentHash, state.saved.workout.contentHash)
  assert.equal(state.calls.filter((entry) => entry.role === 'prepare_access').length, 1)
  assert.equal(state.calls.find((entry) => entry.role === 'session_builder').input.modification.sourceBlocks.find((block) => block.blockId === sourceBlock(state).activityId).dose.sets, 3)
  assert.deepEqual((await loadWorkoutProgrammingRun(state.pool, SCOPE, state.saved.persistedWorkoutId)).workout, state.saved.workout)
  assert.equal((await revalidateWorkoutProgrammingRun(state.pool, SCOPE, revised.persistedWorkoutId)).validatedWorkout, true)
})

test('explicit canonical exercise replacements and method choices preserve source block identities', async () => {
  const state = await modificationFixtures()
  const first = sourceBlock(state), second = sourceBlock(state, 'strength', 1)
  const rawRequest = modificationRequest(state.saved)
  rawRequest.modification.blockEdits = [
    { blockId: first.activityId, exercise: reference(second), programmingMethodId: '9' },
    { blockId: second.activityId, exercise: reference(first) },
  ]
  const result = await generate(state, rawRequest)
  assert.equal(result.status, 'QA_PASSED', JSON.stringify(result.qa.findings.map((finding) => finding.code)))
  const replaced = result.draft.activities.find((entry) => entry.activityId === first.activityId)
  assert.deepEqual(reference(replaced), reference(second))
  assert.equal(replaced.method.id, '9')
  assert.deepEqual(reference(result.draft.activities.find((entry) => entry.activityId === second.activityId)), reference(first))
  assert.notEqual(result.draft.preparationDemand.downstreamHash, state.saved.workout.workflow.draft.preparationDemand.downstreamHash)
})

test('unknown parents, foreign facilities, stale revisions and contradictory block locks stop before model calls', async () => {
  const state = await modificationFixtures()
  const request = modificationRequest(state.saved)
  const invoke = (rawRequest, context = SCOPE) => generateWorkoutProgramming({ pool: state.pool, context, registry: state.registry, rawRequest })
  await assert.rejects(invoke({ ...request, modification: { ...request.modification, workoutId: uuid(999) } }), { code: 'source_workout_unavailable' })
  await assert.rejects(invoke(request, { facilityId: '10', userId: '8' }), { code: 'source_workout_unavailable' })
  await assert.rejects(invoke({ ...request, modification: { ...request.modification, expectedRevision: 'stale' } }), { code: 'source_workout_revision_conflict' })
  const invalid = modificationRequest(state.saved)
  invalid.components.find((component) => component.key === 'strength').lockedBlocks = [{ blockId: sourceBlock(state).activityId, fields: ['dose'] }]
  invalid.modification.blockEdits = [{ blockId: sourceBlock(state).activityId, dose: { sets: 2 } }]
  await assert.rejects(invoke(invalid), { code: 'invalid_modification_controls' })
  await assert.rejects(invoke({ ...request, revision: state.saved.workout.revision }), { code: 'invalid_modification_controls' })
  assert.equal(state.calls.length, 0)
  assert.equal(state.database.rows.size, 1)
})

test('specialist output cannot drop a locked block, invent identity or change a preserved component', async () => {
  for (const mutate of [
    (output) => { output.components[1].selections[0].sourceBlockId = null },
    (output) => { output.components[1].selections[0].sourceBlockId = 'invented' },
    (output) => { output.components[0].selections.reverse() },
  ]) {
    const state = await modificationFixtures({ transformBuilder: mutate })
    const request = modificationRequest(state.saved)
    request.components.find((component) => component.key === 'strength').lockedBlocks = [{ blockId: sourceBlock(state).activityId, fields: ['method'] }]
    const result = await generate(state, request)
    assert.equal(result.status, 'NEEDS_COACH_REVIEW')
    assert.ok(result.draft.issues.some((entry) => entry.code === 'invalid_output'))
    assert.equal(result.qa.critic, null)
  }
})

test('dose and absolute timing locks cannot be silently reduced or shifted to make changed logistics fit', async () => {
  const state = await modificationFixtures()
  const request = modificationRequest(state.saved)
  request.logistics = { ...request.logistics, athleticMinutes: 90, totalBookedMinutes: 90 }
  request.components.find((component) => component.key === 'strength').lockedBlocks = [{ blockId: sourceBlock(state).activityId, fields: ['exercises', 'method', 'dose', 'timing'] }]
  const result = await generate(state, request)
  assert.equal(result.status, 'NEEDS_COACH_REVIEW')
  assert.ok(result.qa.findings.some((entry) => entry.code === 'locked_block_timing_conflict'))
  assert.deepEqual(result.draft.activities.find((entry) => entry.activityId === sourceBlock(state).activityId).dose, sourceBlock(state).dose)
  assert.equal(result.qa.critic, null)
})

test('independent QA reloads source authority and rejects source-block tampering even with coherent clocks', async () => {
  const state = await modificationFixtures()
  const result = await generate(state, modificationRequest(state.saved))
  assert.equal(result.status, 'QA_PASSED', JSON.stringify(result.qa.findings.map((entry) => entry.code)))
  const draft = structuredClone(result.draft)
  draft.activities.find((entry) => entry.componentKey === 'explosiveness').activityId = 'different-block'
  const validation = await validateWorkoutProgrammingDraft({ pool: state.pool, context: SCOPE, sessionIntent: result.sessionIntent, draft })
  assert.ok(validation.findings.some((entry) => entry.code === 'source_block_identity_changed'))
  const forged = structuredClone(result.sessionIntent)
  forged.modification.preservedComponentKeys = []
  await assert.rejects(validateWorkoutProgrammingDraft({ pool: state.pool, context: SCOPE, sessionIntent: forged, draft: result.draft }), { code: 'source_workout_revision_conflict' })
  const unchanged = programmingValueHash(state.saved.workout)
  assert.equal(programmingValueHash((await loadWorkoutProgrammingRun(state.pool, SCOPE, state.saved.persistedWorkoutId)).workout), unchanged)
})

test('preparation-only revisions reuse reviewed downstream work without a redundant Builder call', async () => {
  const state = await modificationFixtures()
  const request = modificationRequest(state.saved)
  request.modification.regenerateComponentKeys = ['prepare_and_access']
  const result = await generate(state, request)
  assert.equal(result.status, 'QA_PASSED', JSON.stringify(result.qa.findings.map((entry) => entry.code)))
  assert.equal(state.calls.filter((entry) => entry.role === 'session_builder').length, 0)
  assert.equal(state.calls.filter((entry) => entry.role === 'prepare_access').length, 1)
  // JSONB omits optional undefined hydration fields; compare the complete canonical JSON identities.
  assert.equal(programmingValueHash(result.draft.activities.filter((entry) => entry.componentKey !== 'prepare_and_access')),
    programmingValueHash(state.saved.workout.workflow.draft.activities.filter((entry) => entry.componentKey !== 'prepare_and_access')))
})

test('out-of-range explicit doses remain review stops and do not silently fall back to a permitted value', async () => {
  const state = await modificationFixtures()
  const request = modificationRequest(state.saved)
  request.modification.blockEdits = [{ blockId: sourceBlock(state).activityId, dose: { sets: 4 } }]
  const result = await generate(state, request)
  assert.equal(result.status, 'NEEDS_COACH_REVIEW')
  assert.ok(result.draft.issues.some((entry) => entry.code === 'invalid_reviewed_set_range'))
  assert.equal(result.draft.activities.some((entry) => entry.activityId === sourceBlock(state).activityId), false)
  assert.equal(result.qa.critic, null)
  assert.equal(state.database.rows.size, 1)
})

test('saving a reviewed revision rechecks parent availability in the save transaction', async () => {
  const state = await modificationFixtures()
  const result = await generate(state, modificationRequest(state.saved))
  assert.equal(result.status, 'QA_PASSED')
  state.database.rows.delete(state.saved.persistedWorkoutId)
  await assert.rejects(persistWorkoutProgrammingRun({ pool: state.pool, context: SCOPE, workflow: result }), { code: 'source_workout_unavailable' })
  assert.equal(state.database.rows.has(result.runId), false)
  assert.ok(state.database.calls.some((entry) => entry.sql === 'ROLLBACK'))
})

test('a second revision links to its direct parent without rewriting either earlier snapshot', async () => {
  const state = await modificationFixtures()
  const first = await generateAndPersistWorkoutProgramming({ pool: state.pool, context: SCOPE, registry: state.registry, rawRequest: modificationRequest(state.saved) })
  const second = await generateAndPersistWorkoutProgramming({ pool: state.pool, context: SCOPE, registry: state.registry, rawRequest: modificationRequest(first) })
  assert.equal(second.workout.status, 'QA_PASSED', JSON.stringify(second.workout.validation.findings.map((entry) => entry.code)))
  assert.equal(second.workout.workflow.sessionIntent.modification.sourceWorkoutId, first.persistedWorkoutId)
  assert.equal(first.workout.workflow.sessionIntent.modification.sourceWorkoutId, state.saved.persistedWorkoutId)
  assert.equal(state.database.rows.size, 3)
  assert.deepEqual((await loadWorkoutProgrammingRun(state.pool, SCOPE, first.persistedWorkoutId)).workout, first.workout)
})

test('new blocks receive deterministic revision identities that independent QA verifies', async () => {
  const state = await modificationFixtures({ transformBuilder(output) {
    output.components.find((entry) => entry.key === 'strength').selections.forEach((entry) => { entry.sourceBlockId = null })
  } })
  const result = await generate(state, modificationRequest(state.saved))
  assert.equal(result.status, 'QA_PASSED', JSON.stringify(result.qa.findings.map((entry) => entry.code)))
  const activity = result.draft.activities.find((entry) => entry.componentKey === 'strength')
  assert.equal(activity.activityId, `strength:new:${result.draft.requestHash}:1`)
  const draft = structuredClone(result.draft)
  draft.activities.find((entry) => entry.componentKey === 'strength').activityId = sourceBlock(state).activityId
  const check = await validateWorkoutProgrammingDraft({ pool: state.pool, context: SCOPE, sessionIntent: result.sessionIntent, draft })
  assert.ok(check.findings.some((entry) => entry.code === 'source_block_identity_changed'))
})
