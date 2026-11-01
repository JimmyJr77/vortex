import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { withBillingAccountCollectionLock } from '../billingAccountCollectionLock.js'
import { assertBillingConnectionHealthy, configureBillingWorkerPool, retryBillingProgressWrite } from '../billingDatabaseRecovery.js'
import { generateRecurringCharges } from '../../scheduling/generateRecurringCharges.js'

function connection() {
  const client = new EventEmitter()
  client.query = async () => ({ rows: [{ pg_advisory_unlock: true }] })
  client.release = error => { client.releasedWith = error; client.released = true }
  return client
}

test('an asynchronous disconnect poisons nested locks and cannot detach the running callback', async () => {
  const client = connection()
  let callbackFinished = false
  await assert.rejects(withBillingAccountCollectionLock({ connect: async () => client }, 8, db => (
    withBillingAccountCollectionLock(db, 8, async () => {
      client.emit('error', new Error('Connection terminated unexpectedly'))
      await new Promise(resolve => setImmediate(resolve))
      assert.equal(client.released, undefined)
      callbackFinished = true
      assertBillingConnectionHealthy(client)
    })
  )), { code: 'billing_database_connection_lost' })
  assert.equal(callbackFinished, true)
  assert.equal(client.releasedWith.code, 'billing_database_connection_lost')
  assert.equal(client.listenerCount('error'), 1)
})

test('idle pool failures are handled and newly checked-out sockets remain usable', async () => {
  const logs = []
  const pool = configureBillingWorkerPool(new EventEmitter(), { log: (...args) => logs.push(args) })
  const failed = connection()
  pool.emit('connect', failed)
  failed.emit('error', new Error('idle socket closed'))
  pool.emit('error', new Error('idle socket closed'), failed)
  assert.throws(() => assertBillingConnectionHealthy(failed), { code: 'billing_database_connection_lost' })
  const healthy = connection()
  pool.emit('connect', healthy)
  assert.doesNotThrow(() => assertBillingConnectionHealthy(healthy))
  assert.equal(logs.length, 1)
})

test('progress retries only connection failures, with a finite retry budget', async () => {
  let writes = 0
  const waits = []
  await assert.rejects(retryBillingProgressWrite(async () => {
    writes += 1
    throw Object.assign(new Error('network failure'), { code: 'ECONNRESET' })
  }, { wait: async ms => waits.push(ms) }), /network failure/)
  assert.equal(writes, 3)
  assert.deepEqual(waits, [250, 500])
  writes = 0
  await assert.rejects(retryBillingProgressWrite(async () => {
    writes += 1
    throw Object.assign(new Error('constraint failure'), { code: '23514' })
  }), /constraint failure/)
  assert.equal(writes, 1)
})

test('a disconnected account is retried on a fresh lock after reconciliation and later accounts still run', async () => {
  const accounts = [8, 9].map(id => ({ id, facility_timezone: 'America/New_York' }))
  const clients = []
  const progress = []
  const events = []
  const pool = {
    query: async () => ({ rows: accounts }),
    connect: async () => { const client = connection(); clients.push(client); return client },
  }
  let calls = 0
  const result = await generateRecurringCharges(pool, {
    collectPayments: true,
    onProgress: async entry => progress.push(entry),
    accountReconciler: async (db, { accountId }) => {
      assert.notEqual(db, clients[0])
      events.push(`reconciled:${accountId}`)
    },
    accountProcessor: async (db, account) => {
      calls += 1
      if (calls === 1) db.emit('error', new Error('Connection terminated unexpectedly'))
      assertBillingConnectionHealthy(db)
      events.push(`processed:${account.id}`)
      return { subscriptionsProcessed: 1 }
    },
  })
  assert.deepEqual(events, ['reconciled:8', 'processed:8', 'processed:9'])
  assert.equal(clients.length, 3)
  assert.equal(clients[0].releasedWith.code, 'billing_database_connection_lost')
  assert.deepEqual(result.completedAccountIds, [8, 9])
  assert.deepEqual(progress.filter(p => p.accountId === 8).map(p => p.status), ['running', 'retrying', 'running', 'completed'])
})

test('persistent connection failure is bounded, recorded, and does not abandon later accounts', async () => {
  const progress = []
  const result = await generateRecurringCharges({ query: async () => ({ rows: [8, 9].map(id => ({ id, facility_timezone: 'America/New_York' })) }) }, {
    accountLock: async (db, _id, callback) => callback(db),
    onProgress: async entry => progress.push(entry),
    accountProcessor: async (_db, account) => {
      if (account.id === 8) throw Object.assign(new Error('disconnected'), { code: 'ECONNRESET' })
      return {}
    },
  })
  assert.deepEqual(result.blockedAccountIds, [8])
  assert.deepEqual(result.completedAccountIds, [9])
  assert.equal(progress.filter(p => p.accountId === 8 && p.status === 'running').length, 2)
  assert.equal(progress.find(p => p.status === 'blocked').attempt, 2)
})

test('missing durable progress prevents payment work and does not masquerade as an account hold', async () => {
  let processed = false
  await assert.rejects(generateRecurringCharges({ query: async () => ({ rows: [{ id: 8, facility_timezone: 'America/New_York' }] }) }, {
    onProgress: async () => { throw new Error('progress unavailable') },
    accountProcessor: async () => { processed = true },
  }), /progress unavailable/)
  assert.equal(processed, false)
})
