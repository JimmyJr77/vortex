import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  LEGACY_BILLING_ENDPOINTS,
  LEGACY_RETIREMENT_MIN_BILLING_CYCLES,
  LEGACY_RETIREMENT_MIN_OBSERVATION_DAYS,
  assertLegacyBillingRetirementDeploymentReady,
  auditLegacyBillingRetirementReadiness,
  completedBillingCycleGate,
  createLegacyBillingEndpointMiddleware,
  legacyBillingEndpointsMode,
  recordBillingCycleVerificationEvidence,
  recordLegacyBillingEndpointTraffic,
  recordLegacyBillingTelemetryHeartbeat,
  resolveLegacyBillingEndpoint,
} from '../billingLegacyRetirement.js'

const testDirectory = path.dirname(fileURLToPath(import.meta.url))

function responseRecorder() {
  return {
    headers: {},
    statusCode: null,
    body: null,
    setHeader(name, value) {
      this.headers[name] = value
    },
    status(value) {
      this.statusCode = value
      return this
    },
    json(value) {
      this.body = value
      return this
    },
  }
}

function readinessPool({
  accounts = {
    active_account_count: 3,
    verified_account_count: 3,
    unverified_account_count: 0,
    missing_billing_account_count: 0,
    invalid_payer_count: 0,
    final_verified_at: '2026-09-01T04:05:00.000Z',
    final_target_month: '2026-09-01',
    final_facility_timezone: 'America/New_York',
  },
  monitor = { monitoring_started_at: '2026-09-15T00:00:00.000Z' },
  heartbeats = {
    expected_day_count: 30,
    recorded_day_count: 30,
    healthy_day_count: 30,
    missing_day_count: 0,
    unhealthy_day_count: 0,
    first_observed_on: '2026-10-03',
    last_observed_on: '2026-11-01',
  },
  traffic = { request_count: '0', last_seen_at: null },
  cycles = {
    expected_evidence_count: 6,
    recorded_evidence_count: 6,
    verified_evidence_count: 6,
    missing_evidence_count: 0,
    invalid_evidence_count: 0,
    first_required_month: '2026-10-01',
    last_required_month: '2026-11-01',
  },
  stripe = { linked_subscription_count: 0 },
  compatibility = { active_legacy_adjustment_count: 0, manual_discount_blocker_count: 0 },
} = {}) {
  const queries = []
  return {
    queries,
    async query(sql) {
      const text = String(sql)
      queries.push(text)
      if (text.includes('active_account_count')) return { rows: [accounts] }
      if (text.includes('FROM billing_legacy_endpoint_monitor')) return { rows: monitor ? [monitor] : [] }
      if (text.includes('billing_legacy_telemetry_heartbeat')) return { rows: [heartbeats] }
      if (text.includes('FROM billing_legacy_endpoint_traffic')) return { rows: [traffic] }
      if (text.includes('expected_evidence_count')) return { rows: [cycles] }
      if (text.includes('linked_subscription_count')) return { rows: [stripe] }
      if (text.includes('active_legacy_adjustment_count')) return { rows: [compatibility] }
      throw new Error(`Unexpected retirement readiness query: ${text}`)
    },
  }
}

test('legacy endpoint contracts use static non-identifying route keys and replacements', () => {
  assert.ok(LEGACY_BILLING_ENDPOINTS.length >= 15)
  assert.equal(
    resolveLegacyBillingEndpoint('GET', '/api/admin/families/98123/billing-account?include=all')?.routeKey,
    'admin_family_billing_account_read',
  )
  assert.equal(
    resolveLegacyBillingEndpoint('GET', '/api/members/billing/account')?.replacement.path,
    '/api/members/billing/customer-account',
  )
  assert.equal(resolveLegacyBillingEndpoint('GET', '/api/members/billing/customer-account'), null)
  for (const endpoint of LEGACY_BILLING_ENDPOINTS) {
    assert.match(endpoint.routeKey, /^[a-z0-9_]{1,100}$/)
    assert.doesNotMatch(endpoint.routeKey, /familyId|memberId|98123/)
    assert.ok(endpoint.replacement?.method)
    assert.ok(endpoint.replacement?.path)
  }
})

test('legacy endpoint mode defaults to enabled and rejects unsafe configuration', () => {
  assert.equal(legacyBillingEndpointsMode({}), 'enabled')
  assert.equal(legacyBillingEndpointsMode({ BILLING_LEGACY_ENDPOINTS_MODE: 'GONE' }), 'gone')
  assert.throws(
    () => legacyBillingEndpointsMode({ BILLING_LEGACY_ENDPOINTS_MODE: 'disabled' }),
    /enabled or gone/,
  )
})

test('enabled middleware observes a static key and preserves the legacy handler', async () => {
  const queries = []
  const logs = []
  const pool = { query: async (sql, params) => queries.push({ sql: String(sql), params }) }
  const middleware = createLegacyBillingEndpointMiddleware(pool, {
    environment: {},
    logger: { warn: (...args) => logs.push(args), error: (...args) => logs.push(args) },
    now: () => new Date('2026-08-31T12:00:00.000Z'),
  })
  let continued = false
  middleware(
    { method: 'GET', path: '/api/admin/families/442/billing-account' },
    responseRecorder(),
    () => { continued = true },
  )
  await new Promise((resolve) => setImmediate(resolve))

  assert.equal(continued, true)
  assert.equal(queries.length, 1)
  assert.deepEqual(queries[0].params.slice(0, 2), ['admin_family_billing_account_read', 'GET'])
  assert.doesNotMatch(JSON.stringify(logs), /442/)
})

test('gone middleware returns one-release 410 metadata and still observes traffic', async () => {
  const queries = []
  const pool = { query: async (_sql, params) => queries.push(params) }
  const middleware = createLegacyBillingEndpointMiddleware(pool, {
    environment: { BILLING_LEGACY_ENDPOINTS_MODE: 'gone' },
    logger: { warn() {}, error() {} },
  })
  const response = responseRecorder()
  let continued = false
  middleware(
    { method: 'POST', path: '/api/members/billing/customer-portal' },
    response,
    () => { continued = true },
  )
  await new Promise((resolve) => setImmediate(resolve))

  assert.equal(continued, false)
  assert.equal(response.statusCode, 410)
  assert.equal(response.headers.Deprecation, 'true')
  assert.equal(response.body.code, 'BILLING_LEGACY_ENDPOINT_RETIRED')
  assert.deepEqual(response.body.replacement, {
    method: 'POST',
    path: '/api/members/billing/payment-method-session',
  })
  assert.deepEqual(queries[0].slice(0, 2), ['member_billing_portal_alias', 'POST'])
})

test('telemetry storage failure is reported safely and never breaks legacy traffic', async () => {
  const errors = []
  const middleware = createLegacyBillingEndpointMiddleware({
    query: async () => {
      const error = new Error('database details that must not be logged')
      error.code = '08006'
      throw error
    },
  }, {
    environment: {},
    logger: { warn() {}, error: (...args) => errors.push(args) },
  })
  let continued = false
  middleware(
    { method: 'GET', path: '/api/members/billing/account' },
    responseRecorder(),
    () => { continued = true },
  )
  await new Promise((resolve) => setImmediate(resolve))

  assert.equal(continued, true)
  assert.equal(errors.length, 1)
  assert.equal(errors[0][1].errorCode, '08006')
  assert.doesNotMatch(JSON.stringify(errors), /database details/)
})

test('aggregate recorder rejects dynamic keys and upserts only normalized dimensions', async () => {
  const calls = []
  const pool = { query: async (sql, params) => calls.push({ sql: String(sql), params }) }
  await recordLegacyBillingEndpointTraffic(pool, {
    routeKey: 'member_billing_account_read',
    method: 'get',
    observedAt: '2026-08-31T12:34:56.000Z',
  })
  assert.match(calls[0].sql, /ON CONFLICT \(route_key, http_method, observed_on\)/)
  assert.deepEqual(calls[0].params, [
    'member_billing_account_read',
    'GET',
    '2026-08-31T12:34:56.000Z',
    LEGACY_BILLING_ENDPOINTS.length,
  ])
  await assert.rejects(
    recordLegacyBillingEndpointTraffic(pool, { routeKey: 'family/123', method: 'GET' }),
    /route key is invalid/,
  )
})

test('daily telemetry heartbeat is sticky-error and contains no request identity', async () => {
  const calls = []
  const pool = {
    async query(sql, params) {
      calls.push({ sql: String(sql), params })
      return { rows: [{ observed_on: '2026-08-31', status: params[1] }] }
    },
  }
  await recordLegacyBillingTelemetryHeartbeat(pool, {
    status: 'error',
    observedAt: '2026-08-31T23:50:00.000Z',
    errorCode: '08006',
    checkerVersion: 'scheduled-canary-v1',
  })
  assert.match(calls[0].sql, /billing_legacy_telemetry_heartbeat/)
  assert.match(calls[0].sql, /error_count[\s\S]*THEN 'error'/)
  assert.deepEqual(calls[0].params.slice(0, 2), ['2026-08-31T23:50:00.000Z', 'error'])
  assert.doesNotMatch(calls[0].sql, /family_id|member_id|account_id|user_id|ip_address|user_agent/)
  await assert.rejects(
    recordLegacyBillingTelemetryHeartbeat(pool, { status: 'healthy', errorCode: 'bad' }),
    /cannot contain an error code/,
  )
})

test('cycle evidence derives verified status only from complete structural parity', async () => {
  const calls = []
  const pool = {
    async query(sql, params) {
      calls.push({ sql: String(sql), params })
      return { rows: [{ id: 91, status: params[3], evidence_hash: params[22] }] }
    },
  }
  const row = await recordBillingCycleVerificationEvidence(pool, {
    accountId: 44,
    migrationId: 12,
    billingMonth: '2026-10-01',
    facilityTimezone: 'America/New_York',
    verifiedAt: '2026-11-01T12:00:00.000Z',
    verifierVersion: 'canonical-cycle-v1',
    verification: {
      legacyCollectorCount: 0,
      collectorCount: 1,
      householdInvoiceCount: 1,
      remoteHouseholdInvoiceCount: 1,
      unexpectedStripeInvoiceCount: 0,
      localInvoiceLineTotalCents: 36000,
      localInvoiceLineSubtotalCents: 36000,
      localInvoiceLineCreditCents: 0,
      localInvoiceSubtotalCents: 36000,
      localInvoiceCreditCents: 0,
      localInvoiceTotalCents: 36000,
      lineParity: true,
      issues: [],
      evidence: { stripeInvoiceId: 'in_safe' },
    },
  })
  assert.equal(row.status, 'verified')
  assert.equal(calls[0].params[3], 'verified')
  assert.match(calls[0].params[22], /^[0-9a-f]{64}$/)
  assert.match(calls[0].sql, /ON CONFLICT \(family_billing_account_id, billing_month, evidence_hash\)/)

  await recordBillingCycleVerificationEvidence(pool, {
    accountId: 44,
    migrationId: 12,
    billingMonth: '2026-10-01',
    facilityTimezone: 'America/New_York',
    verifiedAt: '2026-11-02T12:00:00.000Z',
    verifierVersion: 'canonical-cycle-v1',
    verification: {
      legacyCollectorCount: 0,
      collectorCount: 1,
      householdInvoiceCount: 1,
      remoteHouseholdInvoiceCount: 1,
      unexpectedStripeInvoiceCount: 0,
      localInvoiceLineTotalCents: 36000,
      localInvoiceSubtotalCents: 36000,
      lineParity: true,
      issues: [],
    },
  })
  assert.equal(calls[1].params[3], 'failed')
  assert.notEqual(calls[1].params[22], calls[0].params[22])

  await recordBillingCycleVerificationEvidence(pool, {
    accountId: 44,
    migrationId: 12,
    billingMonth: '2026-11-01',
    verifiedAt: '2026-12-02T12:00:00.000Z',
    verifierVersion: 'canonical-cycle-v1',
    verification: {
      legacyCollectorCount: 1,
      collectorCount: 2,
      householdInvoiceCount: 1,
      remoteHouseholdInvoiceCount: 1,
      unexpectedStripeInvoiceCount: 1,
      issues: [{ code: 'legacy_target_month_collector_present' }],
    },
  })
  assert.equal(calls[2].params[3], 'failed')
})

test('cycle evidence rejects same-month certification in the facility timezone', async () => {
  await assert.rejects(
    recordBillingCycleVerificationEvidence({ query: async () => ({ rows: [] }) }, {
      accountId: 44,
      migrationId: 12,
      billingMonth: '2026-10-01',
      facilityTimezone: 'America/New_York',
      verifiedAt: '2026-10-31T23:59:59.000-04:00',
      verifierVersion: 'canonical-cycle-v1',
      verification: {},
    }),
    /until its facility billing month is complete/,
  )
})

test('cycle evidence accepts certification at the exact next-month facility boundary', async () => {
  const calls = []
  const pool = {
    async query(sql, params) {
      calls.push({ sql: String(sql), params })
      return { rows: [{ id: 93, status: params[3], evidence_hash: params[22] }] }
    },
  }

  const row = await recordBillingCycleVerificationEvidence(pool, {
    accountId: 44,
    migrationId: 12,
    billingMonth: '2026-10-01',
    facilityTimezone: 'America/New_York',
    verifiedAt: '2026-11-01T00:00:00.000-04:00',
    verifierVersion: 'canonical-cycle-v1',
    verification: {
      legacyCollectorCount: 0,
      collectorCount: 1,
      householdInvoiceCount: 1,
      remoteHouseholdInvoiceCount: 1,
      unexpectedStripeInvoiceCount: 0,
      localInvoiceLineTotalCents: 9_000,
      localInvoiceLineSubtotalCents: 12_000,
      localInvoiceLineCreditCents: 3_000,
      localInvoiceSubtotalCents: 12_000,
      localInvoiceCreditCents: 3_000,
      localInvoiceTotalCents: 9_000,
      lineParity: true,
      issues: [],
    },
  })

  assert.equal(row.status, 'verified')
  assert.equal(calls[0].params[25], '2026-11-01T04:00:00.000Z')
})

test('cycle evidence records exact credited invoice three-way parity', async () => {
  const calls = []
  const pool = {
    async query(sql, params) {
      calls.push({ sql: String(sql), params })
      return { rows: [{ id: 92, status: params[3], evidence_hash: params[22] }] }
    },
  }
  const row = await recordBillingCycleVerificationEvidence(pool, {
    accountId: 44,
    migrationId: 12,
    billingMonth: '2026-10-01',
    facilityTimezone: 'America/New_York',
    verifiedAt: '2026-11-01T00:01:00.000-04:00',
    verifierVersion: 'canonical-cycle-v1',
    verification: {
      legacyCollectorCount: 0,
      collectorCount: 1,
      householdInvoiceCount: 1,
      remoteHouseholdInvoiceCount: 1,
      unexpectedStripeInvoiceCount: 0,
      localInvoiceLineSubtotalCents: 12_000,
      localInvoiceLineCreditCents: 3_000,
      localInvoiceLineTotalCents: 9_000,
      localInvoiceSubtotalCents: 12_000,
      localInvoiceCreditCents: 3_000,
      localInvoiceTotalCents: 9_000,
      lineParity: true,
      issues: [],
    },
  })

  assert.equal(row.status, 'verified')
  assert.equal(calls[0].params[3], 'verified')
  assert.deepEqual(calls[0].params.slice(9, 15), [9_000, 12_000, 12_000, 3_000, 3_000, 9_000])
})

test('billing cycle gate requires two complete calendar boundaries', () => {
  const before = completedBillingCycleGate({
    finalVerifiedAt: '2026-09-01T04:05:00.000Z',
    targetMonth: '2026-09-01',
    facilityTimezone: 'America/New_York',
    now: new Date('2026-11-30T23:59:00.000-05:00'),
  })
  assert.equal(before.passed, false)
  assert.equal(before.cyclesCompleted, 1)
  assert.equal(before.eligibleOn, '2026-12-01')

  const after = completedBillingCycleGate({
    finalVerifiedAt: '2026-09-01T04:05:00.000Z',
    targetMonth: '2026-09-01',
    facilityTimezone: 'America/New_York',
    now: new Date('2026-12-01T00:01:00.000-05:00'),
  })
  assert.equal(after.passed, true)
  assert.equal(after.cyclesCompleted, 2)
})

test('retirement readiness minimums cannot be reduced by CLI or callers', async () => {
  const pool = { query: async () => { throw new Error('threshold rejection must precede database access') } }
  await assert.rejects(
    auditLegacyBillingRetirementReadiness(pool, {
      observationDays: LEGACY_RETIREMENT_MIN_OBSERVATION_DAYS - 1,
      requiredBillingCycles: LEGACY_RETIREMENT_MIN_BILLING_CYCLES,
    }),
    /observationDays must be at least 30/,
  )
  await assert.rejects(
    auditLegacyBillingRetirementReadiness(pool, {
      observationDays: LEGACY_RETIREMENT_MIN_OBSERVATION_DAYS,
      requiredBillingCycles: LEGACY_RETIREMENT_MIN_BILLING_CYCLES - 1,
    }),
    /requiredBillingCycles must be at least 2/,
  )
})

test('gone deployment fails closed until persisted retirement evidence is ready', async () => {
  const blockedPool = readinessPool({
    accounts: {
      active_account_count: 3,
      verified_account_count: 2,
      unverified_account_count: 1,
      missing_billing_account_count: 0,
      invalid_payer_count: 0,
      final_verified_at: '2026-09-01T04:05:00.000Z',
      final_target_month: '2026-09-01',
      final_facility_timezone: 'America/New_York',
    },
  })
  await assert.rejects(
    assertLegacyBillingRetirementDeploymentReady(blockedPool, {
      environment: { BILLING_LEGACY_ENDPOINTS_MODE: 'gone' },
      now: new Date('2026-12-02T12:00:00.000Z'),
    }),
    (error) => (
      error.code === 'BILLING_LEGACY_RETIREMENT_NOT_READY'
      && error.retirementReadiness?.ready === false
      && error.retirementReadiness?.blockers.includes('allActiveAccountsVerified')
    ),
  )

  const ready = await assertLegacyBillingRetirementDeploymentReady(readinessPool(), {
    environment: { BILLING_LEGACY_ENDPOINTS_MODE: 'gone' },
    now: new Date('2026-12-02T12:00:00.000Z'),
  })
  assert.equal(ready.enforced, true)
  assert.equal(ready.ready, true)
})

test('emergency rollback to enabled never depends on retirement evidence', async () => {
  let queries = 0
  const result = await assertLegacyBillingRetirementDeploymentReady({
    async query() {
      queries += 1
      throw new Error('enabled rollback must not query retirement evidence')
    },
  }, {
    environment: { BILLING_LEGACY_ENDPOINTS_MODE: 'enabled' },
  })
  assert.deepEqual(result, { enforced: false, ready: true })
  assert.equal(queries, 0)
})

test('server verifies retirement evidence before opening its HTTP listener', async () => {
  const serverSource = await fs.readFile(path.join(testDirectory, '../../server.js'), 'utf8')
  const readinessCall = serverSource.indexOf('await assertLegacyBillingRetirementDeploymentReady(pool)')
  const listenCall = serverSource.indexOf('server.listen(PORT')
  assert.ok(readinessCall > 0)
  assert.ok(listenCall > readinessCall)
})

test('retirement audit CLI pins its configurable thresholds to policy minimums', async () => {
  const script = await fs.readFile(
    path.join(testDirectory, '../../scripts/audit-billing-legacy-retirement.mjs'),
    'utf8',
  )
  assert.match(script, /LEGACY_RETIREMENT_MIN_OBSERVATION_DAYS/)
  assert.match(script, /LEGACY_RETIREMENT_MIN_BILLING_CYCLES/)
  assert.match(
    script,
    /positiveIntegerOption\([\s\S]*?'observation-days'[\s\S]*?LEGACY_RETIREMENT_MIN_OBSERVATION_DAYS[\s\S]*?LEGACY_RETIREMENT_MIN_OBSERVATION_DAYS/,
  )
  assert.match(
    script,
    /positiveIntegerOption\([\s\S]*?'billing-cycles'[\s\S]*?LEGACY_RETIREMENT_MIN_BILLING_CYCLES[\s\S]*?LEGACY_RETIREMENT_MIN_BILLING_CYCLES/,
  )
})

test('retirement readiness passes only after every non-destructive gate passes', async () => {
  const pool = readinessPool()
  const report = await auditLegacyBillingRetirementReadiness(pool, {
    now: new Date('2026-12-02T12:00:00.000Z'),
  })
  assert.equal(report.ready, true)
  assert.equal(report.destructiveChangesPerformed, false)
  assert.deepEqual(report.blockers, [])
  assert.equal(report.gates.allActiveAccountsVerified.passed, true)
  assert.equal(report.gates.billingCyclesComplete.passed, true)
  assert.equal(report.gates.billingCyclesComplete.verifiedEvidenceCount, 6)
  assert.equal(report.gates.zeroLegacyTraffic.passed, true)
  assert.equal(report.gates.zeroLegacyTraffic.healthyHeartbeatDayCount, 30)
  const cycleEvidenceQuery = pool.queries.find((query) => query.includes('expected_evidence_count'))
  assert.match(
    cycleEvidenceQuery,
    /latest\.verified_at AT TIME ZONE latest\.facility_timezone/,
  )
})

test('retirement readiness fails closed when any observation day is missing or unhealthy', async () => {
  const report = await auditLegacyBillingRetirementReadiness(readinessPool({
    heartbeats: {
      expected_day_count: 30,
      recorded_day_count: 29,
      healthy_day_count: 28,
      missing_day_count: 1,
      unhealthy_day_count: 1,
    },
  }), { now: new Date('2026-11-02T12:00:00.000Z') })
  assert.equal(report.ready, false)
  assert.equal(report.gates.zeroLegacyTraffic.passed, false)
  assert.equal(report.gates.zeroLegacyTraffic.missingHeartbeatDayCount, 1)
  assert.equal(report.gates.zeroLegacyTraffic.unhealthyHeartbeatDayCount, 1)
  assert.ok(report.blockers.includes('zeroLegacyTraffic'))
})

test('retirement readiness requires latest structural evidence for every account cycle', async () => {
  const report = await auditLegacyBillingRetirementReadiness(readinessPool({
    cycles: {
      expected_evidence_count: 6,
      recorded_evidence_count: 5,
      verified_evidence_count: 4,
      missing_evidence_count: 1,
      invalid_evidence_count: 1,
      first_required_month: '2026-10-01',
      last_required_month: '2026-11-01',
    },
  }), { now: new Date('2026-11-02T12:00:00.000Z') })
  assert.equal(report.ready, false)
  assert.equal(report.gates.billingCyclesComplete.passed, false)
  assert.equal(report.gates.billingCyclesComplete.missingEvidenceCount, 1)
  assert.equal(report.gates.billingCyclesComplete.invalidEvidenceCount, 1)
  assert.ok(report.blockers.includes('billingCyclesComplete'))
})

test('retirement readiness counts active families without billing accounts as blockers', async () => {
  const pool = readinessPool({
    accounts: {
      active_account_count: 3,
      verified_account_count: 2,
      unverified_account_count: 1,
      missing_billing_account_count: 1,
      invalid_payer_count: 0,
      final_verified_at: '2026-09-01T04:05:00.000Z',
      final_target_month: '2026-09-01',
      final_facility_timezone: 'America/New_York',
    },
  })
  const report = await auditLegacyBillingRetirementReadiness(pool, {
    now: new Date('2026-11-02T12:00:00.000Z'),
  })

  assert.equal(report.ready, false)
  assert.equal(report.gates.allActiveAccountsVerified.passed, false)
  assert.equal(report.gates.allActiveAccountsVerified.missingBillingAccountCount, 1)
  assert.match(pool.queries[0], /active_family/)
  assert.match(pool.queries[0], /account\.id IS NULL/)
})

test('retirement readiness fails when a verified account no longer has a valid active payer', async () => {
  const pool = readinessPool({
    accounts: {
      active_account_count: 3,
      verified_account_count: 2,
      unverified_account_count: 1,
      missing_billing_account_count: 0,
      invalid_payer_count: 1,
      final_verified_at: '2026-09-01T04:05:00.000Z',
      final_target_month: '2026-09-01',
      final_facility_timezone: 'America/New_York',
    },
  })
  const report = await auditLegacyBillingRetirementReadiness(pool, {
    now: new Date('2026-11-02T12:00:00.000Z'),
  })

  assert.equal(report.ready, false)
  assert.equal(report.gates.allActiveAccountsVerified.passed, false)
  assert.equal(report.gates.allActiveAccountsVerified.invalidPayerCount, 1)
  assert.match(pool.queries[0], /account\.payer_member_id/)
  assert.match(pool.queries[0], /payer_membership\.is_active = TRUE/)
})

test('retirement readiness fails closed on missing history and every unresolved dependency', async () => {
  const report = await auditLegacyBillingRetirementReadiness(readinessPool({
    accounts: {
      active_account_count: 4,
      verified_account_count: 2,
      unverified_account_count: 2,
      missing_billing_account_count: 0,
      invalid_payer_count: 0,
      final_verified_at: '2026-10-01T04:05:00.000Z',
      final_target_month: '2026-10-01',
      final_facility_timezone: 'America/New_York',
    },
    monitor: null,
    traffic: { request_count: '7', last_seen_at: '2026-11-01T10:00:00.000Z' },
    stripe: { linked_subscription_count: 3 },
    compatibility: { active_legacy_adjustment_count: 2, manual_discount_blocker_count: 1 },
  }), { now: new Date('2026-11-02T12:00:00.000Z') })

  assert.equal(report.ready, false)
  assert.deepEqual(report.blockers, [
    'allActiveAccountsVerified',
    'billingCyclesComplete',
    'zeroLegacyTraffic',
    'noNonAnnualStripeLinks',
    'compatibilityDataCanonical',
  ])
  assert.equal(report.gates.zeroLegacyTraffic.monitoringStartedAt, null)
})

test('legacy telemetry migration is aggregate-only and establishes an observation epoch', async () => {
  const migration = await fs.readFile(
    path.join(testDirectory, '../../migrations/782_billing_legacy_endpoint_traffic.sql'),
    'utf8',
  )
  assert.match(migration, /CREATE TABLE IF NOT EXISTS billing_legacy_endpoint_monitor/)
  assert.match(migration, /monitoring_started_at/)
  assert.match(migration, /CREATE TABLE IF NOT EXISTS billing_legacy_endpoint_traffic/)
  assert.match(migration, /PRIMARY KEY \(route_key, http_method, observed_on\)/)
  assert.doesNotMatch(migration, /family_id|member_id|account_id|user_id|ip_address|user_agent/)
})

test('retirement evidence migration makes cycle evidence append-only and heartbeat coverage explicit', async () => {
  const migration = await fs.readFile(
    path.join(testDirectory, '../../migrations/788_billing_retirement_evidence.sql'),
    'utf8',
  )
  assert.match(migration, /CREATE TABLE IF NOT EXISTS billing_legacy_telemetry_heartbeat/)
  assert.match(migration, /CREATE TABLE IF NOT EXISTS billing_cycle_verification_evidence/)
  assert.match(migration, /status <> 'verified'[\s\S]*legacy_collector_count = 0/)
  assert.match(migration, /unexpected_stripe_invoice_count = 0/)
  assert.match(migration, /billing cycle verification evidence is append-only/)
})

test('retirement invoice parity migration requires credited three-way parity after the facility month closes', async () => {
  const migration = await fs.readFile(
    path.join(testDirectory, '../../migrations/796_billing_retirement_invoice_parity.sql'),
    'utf8',
  )
  for (const column of [
    'local_invoice_line_subtotal_cents',
    'local_invoice_line_credit_cents',
    'local_invoice_credit_cents',
    'local_invoice_total_cents',
    'facility_timezone',
  ]) {
    assert.match(migration, new RegExp(`ADD COLUMN IF NOT EXISTS ${column}`))
  }
  assert.match(migration, /local_invoice_line_subtotal_cents = local_invoice_subtotal_cents/)
  assert.match(migration, /local_invoice_line_credit_cents = local_invoice_credit_cents/)
  assert.match(migration, /local_invoice_line_total_cents = local_invoice_total_cents/)
  assert.match(
    migration,
    /local_invoice_total_cents = GREATEST\([\s\S]*local_invoice_subtotal_cents - local_invoice_credit_cents/,
  )
  assert.match(
    migration,
    /date_trunc\('month', verified_at AT TIME ZONE facility_timezone\)::date[\s\S]*> billing_month/,
  )
})

test('cycle verification CLI awaits Stripe and requires explicit accounts', async () => {
  const script = await fs.readFile(
    path.join(testDirectory, '../../scripts/verify-billing-retirement-cycle.mjs'),
    'utf8',
  )
  assert.match(script, /const stripe = await getStripeClient\(\)/)
  assert.match(script, /explicit --account-ids/)
  assert.match(script, /--all is not supported/)
})

test('legacy statements remain readable but their write routes are permanently retired', async () => {
  const routes = await fs.readFile(
    path.join(testDirectory, '../../platform/registerRoutes.js'),
    'utf8',
  )
  assert.match(routes, /app\.get\('\/api\/admin\/families\/:familyId\/statements'/)
  assert.match(
    routes,
    /app\.post\([\s\S]{0,300}'\/api\/admin\/families\/:familyId\/statements'[\s\S]{0,300}rejectLegacyStatementWrite/,
  )
  assert.match(
    routes,
    /app\.patch\([\s\S]{0,300}'\/api\/admin\/statements\/:statementId\/status'[\s\S]{0,300}rejectLegacyStatementWrite/,
  )
  assert.match(routes, /BILLING_LEGACY_STATEMENTS_READ_ONLY/)
  assert.doesNotMatch(routes, /INSERT INTO billing_statement \(/)
  assert.doesNotMatch(routes, /UPDATE billing_statement SET status/)
})
