import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { EventEmitter } from 'node:events'
import {
  auditSummary, paymentFactStatus, runDuePaymentFactAudits, startPaymentFactAuditScheduler,
} from '../paymentFactAuditScheduler.js'

const testDirectory = path.dirname(fileURLToPath(import.meta.url))
const migrationPath = path.join(testDirectory, '../../migrations/810_billing_payment_fact_audit_jobs.sql')

test('payment fact statuses preserve the processor state without optimistic settlement', () => {
  assert.equal(paymentFactStatus('pending'), 'pending')
  assert.equal(paymentFactStatus('processing'), 'processing')
  assert.equal(paymentFactStatus('reconciliation_required'), 'reconciliation_required')
  assert.equal(paymentFactStatus('succeeded'), 'settled')
  assert.equal(paymentFactStatus('settled'), 'settled')
  assert.equal(paymentFactStatus('failed'), 'failed')
  assert.equal(paymentFactStatus('canceled'), 'canceled')
  assert.equal(paymentFactStatus('cancelled'), 'canceled')
})

test('payment fact audit summary distinguishes an executed audit from a clean audit', () => {
  const result = auditSummary({
    inventory: { activeFamilyCount: 2, billingAccountCount: 2, missingBillingAccountCount: 0 },
    accounts: [
      { familyId: 48, accountId: 10895, classification: 'ready', exceptions: [] },
      { familyId: 59, accountId: 10906, classification: 'blocked', exceptions: [{ code: 'pricing_mismatch' }] },
    ],
  })
  assert.equal(result.readyAccountCount, 1)
  assert.equal(result.nonReadyAccountCount, 1)
  assert.deepEqual(result.nonReadyAccounts, [{
    familyId: 59,
    accountId: 10906,
    classification: 'blocked',
    exceptionCodes: ['pricing_mismatch'],
  }])
})

test('payment state changes enqueue a durable audit job at the database boundary', () => {
  const migration = fs.readFileSync(migrationPath, 'utf8')
  assert.match(migration, /CREATE TABLE IF NOT EXISTS billing_payment_fact_audit_job/)
  assert.match(migration, /UNIQUE \(billing_payment_id, payment_external_status\)/)
  assert.match(migration, /AFTER INSERT OR UPDATE OF external_status ON billing_payment/)
  assert.match(migration, /'pending', 'processing', 'reconciliation_required',\s*'settled', 'succeeded', 'failed', 'canceled', 'cancelled'/)
})

function lockClient({ acquired = true, unlockError = null } = {}) {
  const client = new EventEmitter()
  client.queries = []
  client.released = []
  client.query = async (sql, params) => {
    client.queries.push({ sql, params })
    if (sql.includes('pg_try_advisory_lock')) return { rows: [{ acquired }] }
    if (unlockError) throw unlockError
    return { rows: [{ pg_advisory_unlock: true }] }
  }
  client.release = destroy => client.released.push(destroy)
  return client
}

test('an audit pass acquires and releases its advisory lock on the same checked-out session', async () => {
  const client = lockClient()
  let claims = 0
  const pool = {
    connect: async () => client,
    query: async sql => {
      assert.match(sql, /WITH candidate/)
      claims += 1
      return { rows: [] }
    },
  }
  assert.deepEqual(await runDuePaymentFactAudits(pool), { processed: 0, failed: 0 })
  assert.equal(claims, 1)
  assert.equal(client.queries.length, 2)
  assert.match(client.queries[0].sql, /pg_try_advisory_lock/)
  assert.match(client.queries[1].sql, /pg_advisory_unlock/)
  assert.deepEqual(client.queries[0].params, client.queries[1].params)
  assert.deepEqual(client.released, [false])
  assert.equal(client.listenerCount('error'), 0)
})

test('a competing audit pass releases its session without claiming work or unlocking another session', async () => {
  const client = lockClient({ acquired: false })
  const pool = { connect: async () => client, query: async () => assert.fail('A competing pass must not claim a job') }
  assert.deepEqual(await runDuePaymentFactAudits(pool), { processed: 0, skipped: 'lock_not_acquired' })
  assert.equal(client.queries.length, 1)
  assert.deepEqual(client.released, [false])
})

test('failure to release the advisory lock destroys the session instead of returning a retained lock to the pool', async () => {
  const client = lockClient({ unlockError: new Error('Connection lost during unlock') })
  assert.deepEqual(await runDuePaymentFactAudits({ connect: async () => client, query: async () => ({ rows: [] }) }), { processed: 0, failed: 0 })
  assert.deepEqual(client.released, [true])
})

test('a disconnected advisory-lock session is handled and stops the pass before further work', async () => {
  const client = lockClient()
  const outage = new Error('PostgreSQL restarted')
  const pool = {
    connect: async () => client,
    query: async () => {
      client.emit('error', outage)
      return { rows: [] }
    },
  }
  await assert.rejects(runDuePaymentFactAudits(pool), outage)
  assert.equal(client.queries.length, 1, 'a broken connection must not be used to unlock')
  assert.deepEqual(client.released, [true])
})

test('scheduler ticks do not overlap a slow database pass and stopping cancels future ticks', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] })
  let resolveConnection
  let connections = 0
  const client = lockClient()
  const pool = {
    connect: () => { connections += 1; return new Promise(resolve => { resolveConnection = resolve }) },
    query: async () => ({ rows: [] }),
  }
  const scheduler = startPaymentFactAuditScheduler(pool)
  t.after(() => scheduler.stop())
  assert.equal(startPaymentFactAuditScheduler(pool), scheduler, 'starting twice must not create a second timer set')
  t.mock.timers.tick(1_000)
  await Promise.resolve()
  assert.equal(connections, 1)
  t.mock.timers.tick(20_000)
  await Promise.resolve()
  assert.equal(connections, 1, 'ticks while a connection is pending do not queue more audit passes')
  resolveConnection(client)
  await new Promise(resolve => setImmediate(resolve))
  t.mock.timers.tick(5_000)
  await Promise.resolve()
  assert.equal(connections, 2, 'a completed pass allows the next scheduled pass')
  scheduler.stop()
  resolveConnection(lockClient())
  await new Promise(resolve => setImmediate(resolve))
  t.mock.timers.tick(20_000)
  await Promise.resolve()
  assert.equal(connections, 2)
})

test('scheduler clears its in-flight guard after a database outage so a later tick recovers', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] })
  const warnings = []
  t.mock.method(console, 'warn', (...args) => warnings.push(args))
  let connections = 0
  const pool = {
    connect: async () => {
      connections += 1
      if (connections === 1) throw new Error('Connection refused')
      return lockClient()
    },
    query: async () => ({ rows: [] }),
  }
  const scheduler = startPaymentFactAuditScheduler(pool)
  t.after(() => scheduler.stop())
  t.mock.timers.tick(1_000)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(connections, 1)
  assert.equal(warnings.length, 1)
  t.mock.timers.tick(5_000)
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(connections, 2)
  assert.equal(warnings.length, 1)
})
