import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { normalizeCoachWorkoutRequest } from '../backend/platform/workoutProgrammingRequest.js'
import { compileWorkoutProgrammingModification } from '../backend/platform/workoutProgrammingModification.js'
import { modificationFixtures } from '../backend/platform/__tests__/workoutProgrammingModificationFixtures.js'

// Compile the browser-only, type-import-only adapter without pulling server modules into its runtime.
const { outputText } = ts.transpileModule(readFileSync(new URL('../src/coach/workoutProgramming.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
})
const { newProgrammingRequest, programmingRequestForSubmit, requestFromSaved, revisionRequestFromSaved, activeProgrammingComponents,
  programmingControlsFingerprint, requestFromInterpretation } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`)

test('default coach controls submit a valid athletic session and retain inactive Body Control preferences', () => {
  const request = newProgrammingRequest()
  request.components.find((component) => component.key === 'body_control').priorities = [{ facet: 'tenet', value: 'flexibility', strength: 'preferred' }]
  request.athletes[0].limitations = ['  Respect existing restriction  ', '', 'Respect existing restriction']
  const normalized = normalizeCoachWorkoutRequest(programmingRequestForSubmit(request))
  assert.deepEqual(normalized.components.map((component) => component.key), ['prepare_and_access', 'explosiveness', 'strength', 'capacity_competition'])
  assert.deepEqual(normalized.athletes[0].limitations, ['Respect existing restriction'])
  assert.equal(request.components.length, 5)
  assert.equal(request.components[4].priorities.length, 1)
  request.logistics.tumblingMinutes = 30
  request.logistics.totalBookedMinutes = 90
  assert.equal(normalizeCoachWorkoutRequest(programmingRequestForSubmit(request)).components[4].priorities.length, 1)
})

test('reusing saved controls creates a fresh valid request and restores equipment aliases and optional tumbling controls', () => {
  const intent = normalizeCoachWorkoutRequest(programmingRequestForSubmit(newProgrammingRequest()))
  const restored = requestFromSaved({ workout: { intent } })
  assert.notEqual(restored.requestId, intent.requestId)
  assert.notEqual(restored.revision, intent.revision)
  assert.deepEqual(restored.equipment.available, ['bodyweight'])
  assert.equal(restored.components.length, 5)
  assert.equal(restored.components[4].equipment.allowed, undefined)
  assert.ok(restored.components.every((component) => !component.lockedBlocks.length))
  assert.equal(normalizeCoachWorkoutRequest(programmingRequestForSubmit(restored)).components.length, 4)
  restored.logistics.tumblingMinutes = 30
  restored.logistics.totalBookedMinutes = 90
  assert.equal(normalizeCoachWorkoutRequest(programmingRequestForSubmit(restored)).components[4].budgetSeconds, 1800)
})

test('revision controls bind to the actual saved parent without widening an unchanged selected-component request', async () => {
  const { saved } = await modificationFixtures()
  const original = structuredClone(saved)
  const request = revisionRequestFromSaved(saved)
  assert.equal(request.mode, 'modify_existing')
  assert.match(request.instruction, /updated controls/)
  assert.deepEqual(request.modification.regenerateComponentKeys, ['prepare_and_access', 'explosiveness', 'strength', 'capacity_competition'])
  request.modification.regenerateComponentKeys = ['strength']
  const normalized = normalizeCoachWorkoutRequest(programmingRequestForSubmit(request))
  const plan = compileWorkoutProgrammingModification(normalized, saved)
  assert.equal(plan.context.globalControlsChanged, false)
  assert.deepEqual(plan.context.preservedComponentKeys, ['explosiveness'])
  assert.deepEqual(plan.context.mutableComponentKeys, ['strength', 'capacity_competition'])
  assert.notEqual(normalized.requestId, saved.workout.intent.requestId)
  assert.notEqual(normalized.revision, saved.workout.revision)
  assert.equal(normalized.modification.expectedRevision, saved.workout.revision)
  assert.deepEqual(saved, original)
})

test('omitted revision components leave the regeneration scope but never silently discard block edits or locks', async () => {
  const { saved } = await modificationFixtures()
  const request = revisionRequestFromSaved(saved)
  const capacity = request.components.find((entry) => entry.key === 'capacity_competition')
  const blockId = saved.workout.workflow.draft.activities.find((entry) => entry.componentKey === capacity.key).activityId
  capacity.budgetSeconds = 0
  capacity.lockedBlocks = [{ blockId, fields: ['dose'] }]
  request.modification.blockEdits = [{ blockId, programmingMethodId: '9' }]
  const submitted = programmingRequestForSubmit(request)
  assert.equal(activeProgrammingComponents(request).includes(capacity.key), false)
  assert.equal(submitted.modification.regenerateComponentKeys.includes(capacity.key), false)
  assert.deepEqual(submitted.modification.blockEdits, request.modification.blockEdits)
  assert.deepEqual(submitted.components.find((entry) => entry.key === capacity.key).lockedBlocks, capacity.lockedBlocks)
  assert.throws(() => normalizeCoachWorkoutRequest(submitted), /omitted Capacity component cannot contain locked work/)
  capacity.lockedBlocks = []
  assert.throws(() => compileWorkoutProgrammingModification(normalizeCoachWorkoutRequest(programmingRequestForSubmit(request)), saved), { code: 'invalid_modification_controls' })
  request.modification.blockEdits = []
  request.components.find((entry) => entry.key === 'body_control').lockedBlocks = [{ blockId: 'body_control:1', fields: ['dose'] }]
  const withBodyLock = programmingRequestForSubmit(request)
  assert.equal(withBodyLock.components.find((entry) => entry.key === 'body_control').lockedBlocks.length, 1)
  assert.throws(() => normalizeCoachWorkoutRequest(withBodyLock), /Body Control must be explicitly included/)
})

test('applying a reviewed interpretation preserves source identity, block locks, evidence and inactive UI controls', async () => {
  const { saved } = await modificationFixtures()
  const current = revisionRequestFromSaved(saved)
  const block = saved.workout.workflow.draft.activities.find((entry) => entry.componentKey === 'strength')
  current.components.find((entry) => entry.key === 'strength').lockedBlocks = [{ blockId: block.activityId, fields: ['method', 'dose'] }]
  current.components.find((entry) => entry.key === 'body_control').priorities = [{ facet: 'tenet', value: 'body_control', strength: 'preferred', weight: 80 }]
  const baseline = programmingControlsFingerprint(current)
  const proposed = normalizeCoachWorkoutRequest({ ...programmingRequestForSubmit(current), athletes: current.athletes.map((entry) => ({ ...entry, ageMin: 9, ageMax: 11 })) })
  const result = { status: 'READY_FOR_REVIEW', proposedRequest: proposed, instruction: current.instruction, proposalHash: 'synthetic-ui-proposal',
    sourceWorkoutId: saved.persistedWorkoutId, sourceRevision: saved.workout.revision }
  const applied = requestFromInterpretation(result, current, baseline)
  assert.equal(programmingControlsFingerprint(current), baseline)
  assert.equal(applied.requestId, current.requestId)
  assert.equal(applied.revision, current.revision)
  assert.deepEqual(applied.modification, proposed.modification)
  assert.deepEqual(applied.equipment.available, ['bodyweight', 'dumbbell'])
  assert.deepEqual(applied.components.find((entry) => entry.key === 'body_control').priorities, current.components.find((entry) => entry.key === 'body_control').priorities)
  assert.deepEqual(normalizeCoachWorkoutRequest(programmingRequestForSubmit(applied)), proposed)
  for (const patch of [{ status: 'NEEDS_COACH_INPUT' }, { proposedRequest: null }, { sourceWorkoutId: 'other' },
    { sourceRevision: 'old' }, { instruction: 'Other instruction' }, { proposedRequest: { ...proposed, revision: 'other' } }]) {
    assert.throws(() => requestFromInterpretation({ ...result, ...patch }, current, baseline), /does not match/)
  }
  current.logistics.laneCount++
  assert.throws(() => requestFromInterpretation(result, current, baseline), /controls changed/)
})
