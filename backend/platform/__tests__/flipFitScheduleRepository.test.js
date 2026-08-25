import assert from 'node:assert/strict'
import test from 'node:test'

import {
  FlipFitScheduleError,
  calculateFlipFitEndDate,
  loadFlipFitSchedule,
  saveFlipFitSchedule,
  validateFlipFitScheduleInput,
} from '../flipFitScheduleRepository.js'
import { registerFlipFitScheduleRoutes } from '../flipFitScheduleRoutes.js'

function scheduleRow(overrides = {}) {
  return {
    facility_id: 7,
    start_date: '2026-08-17',
    end_date: '2026-11-06',
    settings_json: { foundationAgeRange: [12, 14] },
    session_overrides_json: { 'week-01-monday': { objective: 'Acceleration' } },
    created_by: 11,
    updated_by: 11,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-02T00:00:00.000Z',
    ...overrides,
  }
}

test('end date is the final Friday of a 12-week Monday-to-Friday calendar', () => {
  assert.equal(calculateFlipFitEndDate('2026-08-17'), '2026-11-06')
  assert.equal(calculateFlipFitEndDate('2028-02-28'), '2028-05-19')
})

test('schedule validation requires a real ISO Monday and JSON objects', () => {
  const valid = validateFlipFitScheduleInput({
    startDate: '2026-08-17',
    settings: { ageFoundation: '12-14' },
    sessionOverrides: {},
  })
  assert.equal(valid.endDate, '2026-11-06')

  assert.throws(() => validateFlipFitScheduleInput({ startDate: '2026-08-18' }), /must be a Monday/)
  assert.throws(() => validateFlipFitScheduleInput({ startDate: '2026-02-30' }), /valid calendar date/)
  assert.throws(
    () => validateFlipFitScheduleInput({ startDate: '2026-08-17', settings: [] }),
    /settings must be a JSON object/,
  )
  assert.throws(
    () => validateFlipFitScheduleInput({ startDate: '2026-08-17', sessionOverrides: null }),
    /sessionOverrides must be a JSON object/,
  )
  assert.throws(
    () => validateFlipFitScheduleInput({ startDate: '2026-08-17', confirmRemap: 'yes' }),
    /confirmRemap must be a boolean/,
  )
  assert.throws(
    () => validateFlipFitScheduleInput({ startDate: '2026-08-17', expectedUpdatedAt: 'yesterday-ish' }),
    /expectedUpdatedAt must be an ISO timestamp/,
  )
})

test('load is facility scoped and returns the API schedule shape', async () => {
  const queries = []
  const pool = {
    async query(sql, params) {
      queries.push({ sql, params })
      return { rows: [scheduleRow()] }
    },
  }
  const result = await loadFlipFitSchedule(pool, 7)
  assert.deepEqual(queries[0].params, [7])
  assert.match(queries[0].sql, /WHERE facility_id = \$1/)
  assert.equal(result.facilityId, 7)
  assert.equal(result.durationWeeks, 12)
  assert.equal(result.trainingDateCount, 60)
  assert.equal(result.endDate, '2026-11-06')
})

test('save derives end date and upserts on the stable facility key', async () => {
  const queries = []
  const pool = {
    async query(sql, params) {
      queries.push({ sql, params })
      return { rows: [scheduleRow({ settings_json: JSON.parse(params[3]) })] }
    },
  }
  const result = await saveFlipFitSchedule(pool, 7, 11, {
    startDate: '2026-08-17',
    settings: { foundationAgeRange: [12, 14] },
    sessionOverrides: { 'week-01-monday': { note: 'Keep this coach edit' } },
    expectedUpdatedAt: '2026-08-02T00:00:00.000Z',
  })
  assert.match(queries[0].sql, /ON CONFLICT \(facility_id\) DO UPDATE/)
  assert.deepEqual(queries[0].params.slice(0, 3), [7, '2026-08-17', '2026-11-06'])
  assert.deepEqual(JSON.parse(queries[0].params[4]), { 'week-01-monday': { note: 'Keep this coach edit' } })
  assert.equal(queries[0].params[7], '2026-08-02T00:00:00.000Z')
  assert.match(queries[0].sql, /existing\.updated_at = \$8::timestamptz/)
  assert.equal(result.startDate, '2026-08-17')
})

test('start-date remapping requires explicit confirmation', async () => {
  let queryCount = 0
  const pool = {
    async query() {
      queryCount += 1
      return queryCount === 1
        ? { rows: [] }
        : { rows: [scheduleRow()] }
    },
  }
  await assert.rejects(
    saveFlipFitSchedule(pool, 7, 11, { startDate: '2026-08-24' }),
    (error) => error instanceof FlipFitScheduleError
      && error.status === 409
      && error.code === 'flip_fit_remap_confirmation_required',
  )
})

test('stale schedule writes fail instead of erasing another coach’s overrides', async () => {
  let queryCount = 0
  const pool = {
    async query() {
      queryCount += 1
      return queryCount === 1
        ? { rows: [] }
        : { rows: [scheduleRow({ updated_at: '2026-08-03T00:00:00.000Z' })] }
    },
  }
  await assert.rejects(
    saveFlipFitSchedule(pool, 7, 11, {
      startDate: '2026-08-17',
      sessionOverrides: { 'week-01-monday': { note: 'My stale edit' } },
      expectedUpdatedAt: '2026-08-02T00:00:00.000Z',
    }),
    (error) => error instanceof FlipFitScheduleError
      && error.status === 409
      && error.code === 'flip_fit_schedule_conflict',
  )
})

test('route exposes machine-readable conflict details', async () => {
  const routes = new Map()
  const app = {
    get(path, ...handlers) { routes.set(`GET ${path}`, handlers) },
    put(path, ...handlers) { routes.set(`PUT ${path}`, handlers) },
  }
  const pool = {
    query: async (sql) => sql.includes('INSERT INTO')
      ? { rows: [] }
      : { rows: [scheduleRow({ updated_at: '2026-08-03T00:00:00.000Z' })] },
  }
  let failure
  registerFlipFitScheduleRoutes(app, pool, {
    can: () => [(_req, _res, next) => next()],
    ok: () => assert.fail('route should not succeed'),
    bad: (_res, message, status, details) => { failure = { message, status, details } },
  })

  const putHandler = routes.get('PUT /api/coach/flip-fit-schedule').at(-1)
  await putHandler({
    platformAuth: { user: { facility_id: 7, id: 11 } },
    body: {
      startDate: '2026-08-17',
      sessionOverrides: { 'week-01-monday': { note: 'My stale edit' } },
      expectedUpdatedAt: '2026-08-02T00:00:00.000Z',
    },
  }, {})

  assert.equal(failure.status, 409)
  assert.deepEqual(failure.details, { code: 'flip_fit_schedule_conflict' })
})

test('route registration applies the required permissions and facility context', async () => {
  const routes = new Map()
  const permissions = []
  const app = {
    get(path, ...handlers) { routes.set(`GET ${path}`, handlers) },
    put(path, ...handlers) { routes.set(`PUT ${path}`, handlers) },
  }
  const can = (permission) => {
    permissions.push(permission)
    return [(_req, _res, next) => next()]
  }
  const pool = {
    async query(sql, params) {
      assert.deepEqual(params, [91])
      assert.match(sql, /WHERE facility_id = \$1/)
      return { rows: [] }
    },
  }
  let response
  registerFlipFitScheduleRoutes(app, pool, {
    can,
    ok: (_res, data) => { response = data },
    bad: () => assert.fail('route should not fail'),
  })

  assert.deepEqual(permissions, ['library.view', 'training_programs.manage'])
  assert.ok(routes.has('GET /api/coach/flip-fit-schedule'))
  assert.ok(routes.has('PUT /api/coach/flip-fit-schedule'))

  const getHandler = routes.get('GET /api/coach/flip-fit-schedule').at(-1)
  await getHandler({ platformAuth: { user: { facility_id: 91 } } }, {})
  assert.equal(response, null)
})
