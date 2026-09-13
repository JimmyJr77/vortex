import assert from 'node:assert/strict'
import test from 'node:test'
import { EventEmitter } from 'node:events'
import { registerWorkoutProgrammingRoutes } from '../coachWorkoutProgrammingRoutes.js'
import { compositionFixtures } from './workoutProgrammingBuilderFixtures.js'

function routes(overrides = {}) {
  const registered = new Map()
  const permissions = []
  const app = Object.fromEntries(['get', 'post'].map((method) => [method, (path, ...handlers) => registered.set(`${method} ${path}`, handlers.at(-1))]))
  const calls = []
  registerWorkoutProgrammingRoutes(app, {}, {
    can(permission) { permissions.push(permission); return [] },
    ok(res, data) { res.result = { status: 200, data }; res.writableEnded = true },
    bad(res, message, status = 400, details = null) { res.result = { status, message, details }; res.writableEnded = true },
    featureAccess: async (_pool, facilityId, feature) => { calls.push({ type: 'feature', facilityId, feature }); return { enabled: true } },
    registryFactory: () => ({ list: () => [{ id: 'synthetic/test' }] }),
    generate: async (args) => { calls.push({ type: 'generate', args }); return { persistedWorkoutId: 'synthetic-saved-id' } },
    load: async (_pool, context, id) => { calls.push({ type: 'load', context, id }); return null },
    list: async (_pool, context, options) => { calls.push({ type: 'list', context, options }); return { items: [], nextCursor: null } },
    revalidate: async (_pool, context, id) => { calls.push({ type: 'revalidate', context, id }); return { status: 'QA_PASSED' } },
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
  assert.deepEqual(api.permissions, Array(6).fill('workouts.manage'))
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
