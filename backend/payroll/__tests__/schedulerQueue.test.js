import assert from 'node:assert/strict'
import test from 'node:test'
import pg from 'pg'
import {enqueuePayrollTask} from '../schedulerQueue.js'

const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return {promise, resolve}
}

test('coalesces recurring ticks and runs distinct jobs in order', async () => {
  const pool = {}, gate = deferred(), started = deferred(), calls = []
  const first = enqueuePayrollTask(pool, 'first', async () => {
    calls.push('first'); started.resolve(); await gate.promise
  })
  await started.promise
  assert.equal(enqueuePayrollTask(pool, 'first', () => calls.push('duplicate')), first)
  const second = enqueuePayrollTask(pool, 'second', () => calls.push('second'))
  await Promise.resolve()
  assert.deepEqual(calls, ['first'])
  gate.resolve()
  await Promise.all([first, second])
  await enqueuePayrollTask(pool, 'first', () => calls.push('next tick'))
  assert.deepEqual(calls, ['first', 'second', 'next tick'])
})

test('a failed job does not stop later jobs or another pool', async t => {
  const errors = []
  t.mock.method(console, 'error', (...args) => errors.push(args))
  const pool = {}, gate = deferred(), started = deferred()
  const first = enqueuePayrollTask(pool, 'failed', async () => {
    started.resolve(); await gate.promise; throw new Error('Synthetic failure')
  })
  await started.promise
  assert.equal(await enqueuePayrollTask({}, 'independent', () => 7), 7)
  const next = enqueuePayrollTask(pool, 'next', () => 9)
  gate.resolve()
  await first
  assert.equal(await next, 9)
  assert.equal(errors.length, 1)
})

test('scheduler lock holders cannot exhaust connections needed by nested work and health checks', {
  skip: !process.env.PAYROLL_TEST_DATABASE_URL,
  timeout: 15000,
}, async t => {
  // No application tables or external providers: reproduce the production
  // connection-acquisition pattern against a small real PostgreSQL pool.
  const pool = new pg.Pool({connectionString: process.env.PAYROLL_TEST_DATABASE_URL,
    max: 2, connectionTimeoutMillis: 500})
  t.after(() => pool.end())
  const holders = await Promise.all([pool.connect(), pool.connect()])
  try {
    await assert.rejects(pool.query('SELECT 1'), /timeout/i)
  } finally {
    holders.forEach(client => client.release())
  }
  let completed = 0
  const jobs = Array.from({length: 32}, (_, index) => enqueuePayrollTask(pool, `job-${index}`, async () => {
    const lock = await pool.connect()
    try {
      await lock.query('SELECT pg_advisory_lock($1, $2)', [827143, index])
      assert.equal((await pool.query('SELECT 1 AS ok')).rows[0].ok, 1)
      completed++
    } finally {
      await lock.query('SELECT pg_advisory_unlock($1, $2)', [827143, index])
      lock.release()
    }
  }))
  // This uses the same pool as the jobs, as the production health route does.
  assert.equal((await pool.query('SELECT 1 AS healthy')).rows[0].healthy, 1)
  await Promise.all(jobs)
  assert.equal(completed, 32)
  assert.equal(pool.waitingCount, 0)
  assert.equal(pool.idleCount, pool.totalCount)
})
