import test from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { runDuePaymentFactAudits } from '../paymentFactAuditScheduler.js'

const connectionString = process.env.NEW_ADMIN_TEST_DATABASE_URL
if (connectionString) {
  const url = new URL(connectionString)
  if (process.env.NODE_ENV === 'production' || !['postgres:', 'postgresql:'].includes(url.protocol)
      || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.search || url.hash
      || !/^vortex_new_admin_dev(?:_[a-z0-9_]+)?$/.test(decodeURIComponent(url.pathname.slice(1)))) {
    throw new Error('Payment audit locking tests require an isolated local vortex_new_admin_dev database.')
  }
}

test('payment audit session lock excludes another worker for the entire pass and is released afterward', {
  skip: !connectionString,
}, async () => {
  const lockId = 810202609
  const control = new pg.Client({ connectionString, ssl: false })
  const pool = new pg.Pool({ connectionString, ssl: false, max: 2 })
  await control.connect()
  let claims = 0
  const worker = {
    connect: () => pool.connect(),
    query: async sql => {
      assert.match(sql, /WITH candidate/)
      claims += 1
      const competing = await control.query('SELECT pg_try_advisory_lock($1) AS acquired', [lockId])
      assert.equal(competing.rows[0].acquired, false, 'another session cannot enter while the audit is claiming work')
      // Do not process the disposable database's fixture payment queue.
      return { rows: [] }
    },
  }
  try {
    await control.query('SELECT pg_advisory_lock($1)', [lockId])
    assert.deepEqual(await runDuePaymentFactAudits(worker), { processed: 0, skipped: 'lock_not_acquired' })
    assert.equal(claims, 0)
    await control.query('SELECT pg_advisory_unlock($1)', [lockId])
    assert.deepEqual(await runDuePaymentFactAudits(worker), { processed: 0, failed: 0 })
    assert.equal(claims, 1)
    const released = await control.query('SELECT pg_try_advisory_lock($1) AS acquired', [lockId])
    assert.equal(released.rows[0].acquired, true, 'the completed worker must not leave its session lock behind')
    await control.query('SELECT pg_advisory_unlock($1)', [lockId])
  } finally {
    await control.end()
    await pool.end()
  }
})
