import assert from 'node:assert/strict'
import test from 'node:test'
import { EventEmitter } from 'node:events'
import { registerWorkoutProgrammingRoutes } from '../coachWorkoutProgrammingRoutes.js'
import { compositionFixtures } from './workoutProgrammingBuilderFixtures.js'
import { evidenceFixtures, evidencePool } from './workoutAthleteEvidenceFixtures.js'

function routes(overrides = {}, pool = {}) {
  const registered = new Map()
  const permissions = []
  const app = Object.fromEntries(['get', 'post'].map((method) => [method, (path, ...handlers) => registered.set(`${method} ${path}`, handlers.at(-1))]))
  const calls = []
  registerWorkoutProgrammingRoutes(app, pool, {
    can(permission) { permissions.push(permission); return [] },
    ok(res, data) { res.result = { status: 200, data }; res.writableEnded = true },
    bad(res, message, status = 400, details = null) { res.result = { status, message, details }; res.writableEnded = true },
    featureAccess: async (_pool, facilityId, feature) => { calls.push({ type: 'feature', facilityId, feature }); return { enabled: true } },
    registryFactory: () => ({ list: () => [{ id: 'synthetic/test' }] }),
    generate: async (args) => { calls.push({ type: 'generate', args }); return { persistedWorkoutId: 'synthetic-saved-id' } },
    load: async (_pool, context, id) => { calls.push({ type: 'load', context, id }); return null },
    list: async (_pool, context, options) => { calls.push({ type: 'list', context, options }); return { items: [], nextCursor: null } },
    revalidate: async (_pool, context, id) => { calls.push({ type: 'revalidate', context, id }); return { status: 'QA_PASSED' } },
    choices: async (_pool, context, request) => { calls.push({ type: 'choices', context, request }); return { components: [] } },
    interpret: async (args) => { calls.push({ type: 'interpret', args }); return { status: 'READY_FOR_REVIEW', workoutGenerated: false } },
    gapResearch: async (_pool, context, input) => { calls.push({ type: 'gapResearch', context, input }); return { exerciseGap: null, creatorAuthorized: false } },
    gapAssessment: async (args) => { calls.push({ type: 'gapAssessment', args }); return { status: 'NEEDS_COACH_REVIEW', exerciseGap: null, creatorAuthorized: false } },
    proposeExercise: async (args) => { calls.push({ type: 'proposeExercise', args }); return { state: 'AI_PROPOSED', canonicalDraftId: null, libraryApprovalGranted: false } },
    loadExerciseProposal: async (_pool, context, id) => { calls.push({ type: 'loadExerciseProposal', context, id }); return null },
    acceptExerciseProposal: async (_pool, context, id, input) => { calls.push({ type: 'acceptExerciseProposal', context, id, input }); return { canonicalCardId: 'saved-draft', libraryApprovalGranted: false } },
    listExerciseProposals: async (_pool, context, options) => { calls.push({ type: 'listExerciseProposals', context, options }); return { items: [], nextCursor: null } },
    reviewExerciseProposal: async (_pool, context, id) => { calls.push({ type: 'reviewExerciseProposal', context, id }); return null },
    stageExerciseProposal: async (_pool, context, id, input) => { calls.push({ type: 'stageExerciseProposal', context, id, input }); return { alreadyStaged: false } },
    loadStagedRevision: async (_pool, context, id) => { calls.push({ type: 'loadStagedRevision', context, id }); return null },
    loadProposalRevision: async (_pool, context, id) => { calls.push({ type: 'loadProposalRevision', context, id }); return null },
    changeStagedRevision: async (_pool, context, id, input) => { calls.push({ type: 'changeStagedRevision', context, id, input }); return { state: 'review' } },
    ...overrides,
  })
  const invoke = async (key, patch = {}) => {
    const { assumptions, ...body } = compositionFixtures().request
    const req = Object.assign(new EventEmitter(), { body, query: {}, params: {}, platformAuth: { user: { facility_id: '9', id: '7' } }, ...patch })
    const res = Object.assign(new EventEmitter(), { writableEnded: false })
    await registered.get(key)(req, res)
    return { req, res, result: res.result }
  }
  return { invoke, calls, permissions }
}

test('generation uses authenticated scope, server-owned capabilities and bounded budgets', async () => {
  const api = routes()
  const { req, res, result } = await api.invoke('post /api/coach/workout-programming')
  assert.deepEqual(api.permissions, ['workouts.manage', 'workouts.manage', ...Array.from({ length: 11 }, () => ['workouts.manage', 'library.manage']).flat(), ...Array(5).fill('workouts.manage')])
  assert.equal(result.status, 200)
  const invocation = api.calls.find((entry) => entry.type === 'generate').args
  assert.deepEqual(invocation.context, { facilityId: '9', userId: '7' })
  assert.equal(invocation.maxRepairPasses, 2)
  assert.equal(invocation.runOptions.maxCalls, 18)
  assert.equal(invocation.runOptions.timeoutMs, 180000)
  assert.deepEqual(api.calls.filter((entry) => entry.type === 'feature').map((entry) => entry.feature), ['canonical_generator_coach_opt_in', 'canonical_ai_intent'])
  assert.equal(req.listenerCount('aborted'), 0)
  assert.equal(res.listenerCount('close'), 0)
})

test('exercise-gap research requires library permission and facility rollout without a model or client authority', async () => {
  const { assumptions, ...request } = compositionFixtures().request
  const body = { request, componentKey: 'strength', need: { canonicalName: 'Proposed movement', aliases: [], familyKey: null,
    description: 'A specific movement demand that needs canonical coverage research.', movementPatterns: ['hinge'], bodyRegions: ['lower_body'], requiredEquipment: [] } }
  const api = routes({ registryFactory() { throw new Error('Research must not invoke a model') } })
  const response = await api.invoke('post /api/coach/workout-programming/exercise-gap/research', { body })
  assert.equal(response.result.status, 200)
  assert.ok(api.permissions.includes('library.manage'))
  const call = api.calls.find((entry) => entry.type === 'gapResearch')
  assert.deepEqual(call.context, { facilityId: '9', userId: '7' })
  assert.deepEqual(call.input, body)
  assert.equal(response.result.data.creatorAuthorized, false)
  assert.deepEqual(api.calls.filter((entry) => entry.type === 'feature').map((entry) => entry.feature), ['canonical_generator_coach_opt_in'])
  const disabled = routes({ featureAccess: async () => ({ enabled: false }) })
  assert.equal((await disabled.invoke('post /api/coach/workout-programming/exercise-gap/research', { body })).result.status, 404)
  assert.ok(disabled.calls.every((entry) => entry.type !== 'gapResearch'))
  for (const patch of [{ facilityId: '10' }, { exerciseGap: {} }, { creatorAuthorized: true }, { research: {} }]) {
    const invalid = routes()
    assert.equal((await invalid.invoke('post /api/coach/workout-programming/exercise-gap/research', { body: { ...body, ...patch } })).result.status, 400)
    assert.ok(invalid.calls.every((entry) => entry.type !== 'gapResearch'))
  }
})

test('client artifacts, scope overrides and model budgets are rejected before generation', async () => {
  for (const patch of [{ workflow: {} }, { sessionIntent: {} }, { facilityId: '10' }, { registry: [] }, { maxRepairPasses: 99 }, { runOptions: { maxCalls: 100 } }]) {
    const { assumptions, ...body } = compositionFixtures().request
    const api = routes()
    assert.equal((await api.invoke('post /api/coach/workout-programming', { body: { ...body, ...patch } })).result.status, 400)
    assert.ok(api.calls.every((entry) => entry.type !== 'generate'))
  }
})

test('facility rollout and absent AI configuration block generation while saved records remain readable', async () => {
  const disabled = routes({ featureAccess: async () => ({ enabled: false, reason: 'facility_not_enrolled' }) })
  assert.equal((await disabled.invoke('post /api/coach/workout-programming')).result.status, 404)
  assert.ok(disabled.calls.every((entry) => entry.type !== 'generate'))
  const noModel = routes({ registryFactory: () => ({ list: () => [] }) })
  assert.equal((await noModel.invoke('post /api/coach/workout-programming')).result.status, 503)
  const api = routes()
  assert.equal((await api.invoke('get /api/coach/workout-programming')).result.status, 200)
  assert.ok(api.calls.filter((entry) => entry.type === 'feature').every((entry) => entry.feature !== 'canonical_ai_intent'))
  assert.equal((await api.invoke('get /api/coach/workout-programming/:id', { params: { id: 'missing' } })).result.status, 404)
  assert.deepEqual(api.calls.find((entry) => entry.type === 'load').context, { facilityId: '9', userId: '7' })
})

test('saved-session pagination rejects partial cursors and unrecognized query fields', async () => {
  const api = routes()
  for (const query of [{ beforeId: 'id' }, { limit: '25oops' }, { facilityId: '10' }]) {
    assert.equal((await api.invoke('get /api/coach/workout-programming', { query })).result.status, 400)
  }
  assert.ok(api.calls.every((entry) => entry.type !== 'list'))
})

test('unexpected service errors do not expose database details', async () => {
  const api = routes({ generate: async () => { throw new Error('Synthetic private database detail') } })
  const { result } = await api.invoke('post /api/coach/workout-programming')
  assert.equal(result.status, 500)
  assert.doesNotMatch(result.message, /private database/)
})

test('revalidation accepts only a saved ID and uses no model or submitted QA evidence', async () => {
  const api = routes({ registryFactory() { throw new Error('No model should be configured for revalidation') } })
  assert.equal((await api.invoke('post /api/coach/workout-programming/:id/revalidate', { params: { id: 'saved-id' }, body: {} })).result.status, 200)
  assert.equal((await api.invoke('post /api/coach/workout-programming/:id/revalidate', { params: { id: 'saved-id' }, body: { qa: { status: 'PASS' } } })).result.status, 400)
  assert.equal(api.calls.filter((entry) => entry.type === 'revalidate').length, 1)
})

test('canonical choice discovery is scoped and rollout-gated without configuring a model', async () => {
  const api = routes({ registryFactory() { throw new Error('Read-only discovery must not configure a model') } })
  assert.equal((await api.invoke('post /api/coach/workout-programming/resources')).result.status, 200)
  assert.deepEqual(api.calls.find((entry) => entry.type === 'choices').context, { facilityId: '9', userId: '7' })
  assert.deepEqual(api.calls.filter((entry) => entry.type === 'feature').map((entry) => entry.feature), ['canonical_generator_coach_opt_in'])
  const disabled = routes({ featureAccess: async () => ({ enabled: false }) })
  assert.equal((await disabled.invoke('post /api/coach/workout-programming/resources')).result.status, 404)
  assert.ok(disabled.calls.every((entry) => entry.type !== 'choices'))
})

test('coach observation route uses the shared reader and rejects scope or source overrides', async () => {
  const source = evidenceFixtures()
  source['skill_progress:history'] = source['skill_progress:explicit']
  const pool = evidencePool(source)
  const api = routes({ registryFactory() { throw new Error('Evidence discovery must not configure a model') } }, pool)
  const key = 'get /api/coach/workout-programming/evidence/:memberId'
  const query = { kind: 'skill_progress', asOfDate: '2026-09-12' }
  const valid = await api.invoke(key, { params: { memberId: '101' }, query })
  assert.equal(valid.result.status, 200)
  assert.equal(valid.result.data[0].memberId, '101')
  assert.match(valid.result.data[0].sourceHash, /^[a-f0-9]{64}$/)
  const reads = () => pool.calls.filter((entry) => entry.sql.includes('programming_athlete_evidence:')).length
  assert.equal(reads(), 1)
  for (const patch of [{ query: { ...query, facilityId: '10' } }, { query: { ...query, kind: 'unknown_table' } },
    { query: { ...query, asOfDate: '2026-02-30' } }, { params: { memberId: 'not-an-id' } }]) {
    assert.equal((await api.invoke(key, { params: { memberId: '101' }, query, ...patch })).result.status, 400)
  }
  assert.equal(reads(), 1)
  const disabled = routes({ featureAccess: async () => ({ enabled: false }) }, pool)
  assert.equal((await disabled.invoke(key, { params: { memberId: '101' }, query })).result.status, 404)
  assert.equal(reads(), 1)
})

test('Modify Existing accepts bounded coach edits but never a client-supplied parent snapshot or compiled authority', async () => {
  const { assumptions, ...original } = compositionFixtures().request
  const body = { ...original, mode: 'modify_existing', instruction: 'Reduce strength volume.', modification: {
    workoutId: '00000000-0000-0000-0000-000000000001', expectedRevision: 'source-revision', regenerateComponentKeys: ['strength'],
    blockEdits: [{ blockId: 'strength:1', dose: { sets: 2 } }],
  } }
  const api = routes()
  assert.equal((await api.invoke('post /api/coach/workout-programming', { body })).result.status, 200)
  assert.deepEqual(api.calls.find((entry) => entry.type === 'generate').args.rawRequest.modification, body.modification)
  for (const modification of [
    { ...body.modification, sourceSnapshot: {} }, { ...body.modification, sourceContentHash: 'forged' },
    { ...body.modification, preservedComponentKeys: [] }, { ...body.modification, blockEdits: [{ blockId: 'strength:1', dose: { sets: 2, waiveBounds: true } }] },
  ]) assert.equal((await api.invoke('post /api/coach/workout-programming', { body: { ...body, modification } })).result.status, 400)
  assert.equal(api.calls.filter((entry) => entry.type === 'generate').length, 1)
  for (const [code, status] of [['source_workout_revision_conflict', 409], ['source_workout_unavailable', 404], ['invalid_modification_controls', 400]]) {
    const failed = routes({ generate: async () => { throw Object.assign(new Error('Source revision requires review'), { code }) } })
    assert.equal((await failed.invoke('post /api/coach/workout-programming', { body })).result.status, status)
  }
})

test('revision interpretation uses one bounded Director capability and never accepts client authority or writes a workout', async () => {
  const { assumptions, ...request } = compositionFixtures().request
  request.mode = 'modify_existing'; request.instruction = 'Review the selected changes.'
  request.modification = { workoutId: '00000000-0000-0000-0000-000000000001', expectedRevision: 'source-revision' }
  const body = { request, instruction: 'Make this appropriate for ages 9–11.' }
  const api = routes()
  const key = 'post /api/coach/workout-programming/interpret'
  const { result, req, res } = await api.invoke(key, { body })
  assert.equal(result.status, 200)
  assert.equal(result.data.workoutGenerated, false)
  const call = api.calls.find((entry) => entry.type === 'interpret').args
  assert.deepEqual(call.context, { facilityId: '9', userId: '7' })
  assert.equal(call.runOptions.maxCalls, 1)
  assert.equal(call.runOptions.perCallTimeoutMs, 20000)
  assert.equal(call.runOptions.maxOutputTokens, 6000)
  assert.ok(api.calls.every((entry) => entry.type !== 'generate'))
  assert.deepEqual(api.calls.filter((entry) => entry.type === 'feature').map((entry) => entry.feature), ['canonical_generator_coach_opt_in', 'canonical_ai_intent'])
  assert.equal(req.listenerCount('aborted'), 0)
  assert.equal(res.listenerCount('close'), 0)
  for (const patch of [{ sourceSnapshot: {} }, { proposedRequest: request }, { maxCalls: 30 }, { instruction: '' }, { request: { ...request, mode: 'guided', modification: null } }]) {
    assert.equal((await api.invoke(key, { body: { ...body, ...patch } })).result.status, 400)
  }
  assert.equal(api.calls.filter((entry) => entry.type === 'interpret').length, 1)
  const disabled = routes({ featureAccess: async () => ({ enabled: false }) })
  assert.equal((await disabled.invoke(key, { body })).result.status, 404)
  const noModel = routes({ registryFactory: () => ({ list: () => [] }) })
  assert.equal((await noModel.invoke(key, { body })).result.status, 503)
  const changed = routes({ interpret: async () => { throw Object.assign(new Error('The active taxonomy changed during interpretation.'), { code: 'interpretation_sources_changed' }) } })
  assert.equal((await changed.invoke(key, { body })).result.status, 409)
})

test('disconnecting revision interpretation aborts its shared signal and releases event listeners', async () => {
  let started
  const entered = new Promise((resolve) => { started = resolve })
  let signal
  const api = routes({ interpret: async (args) => {
    signal = args.runOptions.signal; started()
    await new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true }))
    return { status: 'NEEDS_COACH_INPUT' }
  } })
  const { assumptions, ...request } = compositionFixtures().request
  request.mode = 'modify_existing'; request.instruction = 'Review changes.'
  request.modification = { workoutId: '00000000-0000-0000-0000-000000000001', expectedRevision: 'source-revision' }
  // Capture the request emitter without replacing the production handler or its abort wiring.
  const req = new EventEmitter()
  const pending = api.invoke('post /api/coach/workout-programming/interpret', { body: { request, instruction: 'Use three lanes.' }, on: req.on.bind(req), off: req.off.bind(req) })
  await entered
  req.emit('aborted')
  const completed = await pending
  assert.equal(signal.aborted, true)
  assert.equal(completed.result, undefined)
  assert.equal(req.listenerCount('aborted'), 0)
  assert.equal(completed.res.listenerCount('close'), 0)
})

test('exercise gap assessment binds scope, provider limits and rollout without accepting client research or gap claims', async () => {
  const { assumptions, ...request } = compositionFixtures().request
  const body = { request, componentKey: 'strength', need: { canonicalName: 'Proposed movement', aliases: [], familyKey: null,
    description: 'A specific movement demand that needs canonical coverage research.', movementPatterns: ['hinge'], bodyRegions: ['lower_body'], requiredEquipment: [] } }
  const key = 'post /api/coach/workout-programming/exercise-gap/assess'
  const api = routes()
  const response = await api.invoke(key, { body })
  assert.equal(response.result.status, 200)
  const invocation = api.calls.find((entry) => entry.type === 'gapAssessment').args
  assert.deepEqual(invocation.context, { facilityId: '9', userId: '7' })
  assert.equal(invocation.runOptions.maxCalls, 1)
  assert.equal(invocation.runOptions.maxOutputTokens, 8000)
  assert.equal(invocation.runOptions.timeoutMs, 60000)
  assert.deepEqual(api.calls.filter((entry) => entry.type === 'feature').map((entry) => entry.feature), ['canonical_generator_coach_opt_in', 'canonical_ai_intent'])
  assert.equal(response.req.listenerCount('aborted'), 0)
  assert.equal(response.res.listenerCount('close'), 0)
  for (const patch of [{ research: {} }, { exerciseGap: {} }, { creatorAuthorized: true }, { runOptions: { maxCalls: 100 } }, { facilityId: '10' }]) {
    const invalid = routes()
    assert.equal((await invalid.invoke(key, { body: { ...body, ...patch } })).result.status, 400)
    assert.ok(invalid.calls.every((entry) => entry.type !== 'gapAssessment'))
  }
  assert.equal((await routes({ featureAccess: async () => ({ enabled: false }) }).invoke(key, { body })).result.status, 404)
  assert.equal((await routes({ registryFactory: () => ({ list: () => [] }) }).invoke(key, { body })).result.status, 503)
  const changed = routes({ gapAssessment: async () => { throw Object.assign(new Error('Sources changed'), { code: 'exercise_gap_sources_changed' }) } })
  assert.equal((await changed.invoke(key, { body })).result.status, 409)
})

test('disconnecting exercise gap assessment cancels its provider and clears listeners', async () => {
  let started
  const entered = new Promise((resolve) => { started = resolve })
  let signal
  const api = routes({ gapAssessment: async (args) => {
    signal = args.runOptions.signal; started()
    await new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true }))
    return { status: 'NEEDS_COACH_REVIEW' }
  } })
  const { assumptions, ...request } = compositionFixtures().request
  const body = { request, componentKey: 'strength', need: { canonicalName: 'Proposed movement', aliases: [], familyKey: null,
    description: 'A specific movement demand that needs canonical coverage research.', movementPatterns: ['hinge'], bodyRegions: ['lower_body'], requiredEquipment: [] } }
  const req = new EventEmitter()
  const pending = api.invoke('post /api/coach/workout-programming/exercise-gap/assess', { body, on: req.on.bind(req), off: req.off.bind(req) })
  await entered
  req.emit('aborted')
  const completed = await pending
  assert.equal(signal.aborted, true)
  assert.equal(completed.result, undefined)
  assert.equal(req.listenerCount('aborted'), 0)
  assert.equal(completed.res.listenerCount('close'), 0)
})

test('exercise proposals use one shared two-call budget and an authenticated read-only audit lookup', async () => {
  const { assumptions, ...request } = compositionFixtures().request
  const body = { request, componentKey: 'strength', need: { canonicalName: 'Proposed movement', aliases: [], familyKey: null,
    description: 'A specific movement demand that needs canonical coverage research.', movementPatterns: ['hinge'], bodyRegions: ['lower_body'], requiredEquipment: [] } }
  const key = 'post /api/coach/workout-programming/exercise-gap/propose'
  const api = routes()
  const response = await api.invoke(key, { body })
  assert.equal(response.result.status, 200)
  const call = api.calls.find((entry) => entry.type === 'proposeExercise').args
  assert.deepEqual(call.context, { facilityId: '9', userId: '7' })
  assert.equal(call.runOptions.maxCalls, 2)
  assert.equal(call.runOptions.maxOutputTokens, 16000)
  assert.equal(call.runOptions.timeoutMs, 120000)
  assert.equal(response.req.listenerCount('aborted'), 0)
  assert.equal(response.res.listenerCount('close'), 0)
  for (const patch of [{ exerciseGap: {} }, { proposal: {} }, { approved: true }, { scope: { facilityId: '10' } }, { runOptions: {} }]) {
    const invalid = routes()
    assert.equal((await invalid.invoke(key, { body: { ...body, ...patch } })).result.status, 400)
    assert.ok(invalid.calls.every((entry) => entry.type !== 'proposeExercise'))
  }
  assert.equal((await routes({ featureAccess: async () => ({ enabled: false }) }).invoke(key, { body })).result.status, 404)
  assert.equal((await routes({ registryFactory: () => ({ list: () => [] }) }).invoke(key, { body })).result.status, 503)
  for (const code of ['exercise_gap_sources_changed', 'exercise_proposal_duplicate', 'exercise_proposal_search_incomplete']) {
    const conflict = routes({ proposeExercise: async () => { throw Object.assign(new Error('Proposal conflict'), { code }) } })
    assert.equal((await conflict.invoke(key, { body })).result.status, 409)
  }
  const reader = routes({ registryFactory() { throw new Error('Opening a proposal must not invoke AI') } })
  const readKey = 'get /api/coach/workout-programming/exercise-proposals/:id'
  const missing = await reader.invoke(readKey, { params: { id: 'an-audit-id' } })
  assert.equal(missing.result.status, 404)
  assert.deepEqual(reader.calls.find((entry) => entry.type === 'loadExerciseProposal').context, { facilityId: '9', userId: '7' })
  assert.equal((await reader.invoke(readKey, { params: { id: 'an-audit-id' }, query: { facilityId: '10' } })).result.status, 400)
})

test('disconnecting the proposal workflow aborts its shared budget and clears response listeners', async () => {
  let entered
  const started = new Promise((resolve) => { entered = resolve })
  let signal
  const api = routes({ proposeExercise: async (args) => {
    signal = args.runOptions.signal; entered()
    await new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true }))
    return { state: 'NEEDS_COACH_REVIEW' }
  } })
  const { assumptions, ...request } = compositionFixtures().request
  const body = { request, componentKey: 'strength', need: { canonicalName: 'Proposed movement', aliases: [], familyKey: null,
    description: 'A specific movement demand that needs canonical coverage research.', movementPatterns: ['hinge'], bodyRegions: ['lower_body'], requiredEquipment: [] } }
  const req = new EventEmitter()
  const pending = api.invoke('post /api/coach/workout-programming/exercise-gap/propose', { body, on: req.on.bind(req), off: req.off.bind(req) })
  await started
  req.emit('aborted')
  const completed = await pending
  assert.equal(signal.aborted, true)
  assert.equal(completed.result, undefined)
  assert.equal(req.listenerCount('aborted'), 0)
  assert.equal(completed.res.listenerCount('close'), 0)
})

test('human proposal acceptance uses authenticated scope and facility access without calling a model', async () => {
  const key = 'post /api/coach/workout-programming/exercise-proposals/:id/accept'
  const body = { expectedProposalHash: 'a'.repeat(64) }
  const api = routes({ registryFactory() { throw new Error('Acceptance must not invoke AI') } })
  const { result } = await api.invoke(key, { body, params: { id: 'an-audit-id' } })
  assert.equal(result.status, 200)
  assert.equal(result.data.libraryApprovalGranted, false)
  assert.deepEqual(api.calls.find((entry) => entry.type === 'acceptExerciseProposal'), {
    type: 'acceptExerciseProposal', context: { facilityId: '9', userId: '7' }, id: 'an-audit-id', input: body,
  })
  assert.deepEqual(api.calls.filter((entry) => entry.type === 'feature').map((entry) => entry.feature), ['canonical_generator_coach_opt_in'])
  for (const patch of [{ draft: {} }, { approved: true }, { context: { facilityId: '10' } }, { sourceProvenance: {} }]) {
    const invalid = routes()
    assert.equal((await invalid.invoke(key, { body: { ...body, ...patch } })).result.status, 400)
    assert.ok(invalid.calls.every((entry) => entry.type !== 'acceptExerciseProposal'))
  }
  assert.equal((await api.invoke(key, { body, query: { approved: true } })).result.status, 400)
  const disabled = routes({ featureAccess: async () => ({ enabled: false }) })
  assert.equal((await disabled.invoke(key, { body })).result.status, 404)
  assert.ok(disabled.calls.every((entry) => entry.type !== 'acceptExerciseProposal'))
  assert.equal((await routes({ acceptExerciseProposal: async () => null }).invoke(key, { body })).result.status, 404)
  for (const code of ['exercise_proposal_not_applicable', 'exercise_proposal_revision_required', 'exercise_proposal_audit_conflict', 'exercise_gap_sources_changed']) {
    const conflict = routes({ acceptExerciseProposal: async () => { throw Object.assign(new Error('Acceptance conflict'), { code }) } })
    assert.equal((await conflict.invoke(key, { body })).result.status, 409)
  }
})

test('proposal history and review are scoped reads without model authority or query overrides', async () => {
  const api = routes({ registryFactory() { throw new Error('Proposal review must not invoke AI') } })
  const listKey = 'get /api/coach/workout-programming/exercise-proposals'
  const reviewKey = 'get /api/coach/workout-programming/exercise-proposals/:id/review'
  assert.equal((await api.invoke(listKey, { query: { limit: '10', beforeCreatedAt: '2026-09-13T00:00:00.000001Z', beforeId: 'audit-id' } })).result.status, 200)
  assert.deepEqual(api.calls.find((entry) => entry.type === 'listExerciseProposals'), { type: 'listExerciseProposals', context: { facilityId: '9', userId: '7' },
    options: { limit: 10, before: { createdAt: '2026-09-13T00:00:00.000001Z', id: 'audit-id' } } })
  for (const query of [{ scope: '10' }, { beforeId: 'missing-date' }, { limit: '1.5' }, { limit: ['10'] }]) {
    assert.equal((await api.invoke(listKey, { query })).result.status, 400)
  }
  assert.equal((await api.invoke(reviewKey, { params: { id: 'audit-id' } })).result.status, 404)
  assert.deepEqual(api.calls.find((entry) => entry.type === 'reviewExerciseProposal').context, { facilityId: '9', userId: '7' })
  assert.equal((await api.invoke(reviewKey, { query: { approved: 'true' } })).result.status, 400)
  for (const key of [listKey, reviewKey]) {
    const disabled = routes({ featureAccess: async () => ({ enabled: false }) })
    assert.equal((await disabled.invoke(key)).result.status, 404)
    assert.ok(disabled.calls.every((entry) => !['listExerciseProposals', 'reviewExerciseProposal'].includes(entry.type)))
  }
})

test('staged revision routes reuse authenticated permissions, facility gates and strict human action contracts without AI', async () => {
  const stage = 'post /api/coach/workout-programming/exercise-proposals/:id/stage-revision'
  const read = 'get /api/coach/workout-programming/staged-card-revisions/:id'
  const change = 'post /api/coach/workout-programming/staged-card-revisions/:id/change'
  const recover = 'get /api/coach/workout-programming/exercise-proposals/:id/staged-revision'
  const api = routes({ registryFactory() { throw new Error('Staged review must not invoke AI') } })
  const hash = 'a'.repeat(64)
  assert.equal((await api.invoke(stage, { body: { expectedProposalHash: hash }, params: { id: 'proposal-id' } })).result.status, 200)
  assert.deepEqual(api.calls.find((entry) => entry.type === 'stageExerciseProposal').context, { facilityId: '9', userId: '7' })
  assert.equal((await api.invoke(read, { params: { id: 'staged-id' } })).result.status, 404)
  assert.equal((await api.invoke(recover, { params: { id: 'proposal-id' } })).result.status, 404)
  assert.deepEqual(api.calls.find((entry) => entry.type === 'loadProposalRevision').context, { facilityId: '9', userId: '7' })
  const body = { expectedEventHash: hash, action: 'submit', changeSummary: 'Submit this exact staged profile for independent review.' }
  assert.equal((await api.invoke(change, { params: { id: 'staged-id' }, body })).result.status, 200)
  assert.deepEqual(api.calls.find((entry) => entry.type === 'changeStagedRevision').input, body)
  assert.equal((await api.invoke(change, { body: { ...body, action: 'approve' } })).result.status, 400)
  for (const [key, body] of [[stage, { expectedProposalHash: hash }], [read, {}], [recover, {}], [change, { expectedEventHash: hash, action: 'submit', changeSummary: 'Submit this exact candidate.' }]]) {
    assert.equal((await api.invoke(key, { body, query: { facilityId: '10' } })).result.status, 400)
    assert.equal((await routes({ featureAccess: async () => ({ enabled: false }) }).invoke(key, { body })).result.status, 404)
  }
  for (const code of ['canonical_revision_source_changed', 'canonical_revision_profile_conflict', 'canonical_revision_audit_conflict', 'canonical_revision_conflict', 'canonical_revision_transition']) {
    const conflict = routes({ changeStagedRevision: async () => { throw Object.assign(new Error('Revision conflict'), { code }) } })
    assert.equal((await conflict.invoke(change, { body })).result.status, 409)
  }
})
