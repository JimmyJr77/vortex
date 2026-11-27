import assert from 'node:assert/strict'
import { once } from 'node:events'
import http from 'node:http'
import test from 'node:test'
import pg from 'pg'
import { createRuntimeDatabasePool } from '../runtimeDatabasePool.js'

const connectionString = process.env.NEW_ADMIN_TEST_DATABASE_URL
if (connectionString) {
  const url = new URL(connectionString)
  if (process.env.NODE_ENV === 'production' || !['postgres:', 'postgresql:'].includes(url.protocol)
    || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.search || url.hash
    || !/^vortex_new_admin_dev(?:_[a-z0-9_]+)?$/.test(decodeURIComponent(url.pathname.slice(1)))) {
    throw new Error('Database recovery tests require an isolated local vortex_new_admin_dev database.')
  }
}

test('HTTP requests keep working after PostgreSQL terminates an idle API connection', { skip: !connectionString, timeout: 10000 }, async () => {
  const warnings = [], recoveries = []
  const apiUrl = new URL(connectionString)
  apiUrl.searchParams.set('options', '-c timezone=UTC -c jit=on')
  const pool = createRuntimeDatabasePool({ environment: { DATABASE_URL: apiUrl.toString(), DATABASE_SSL: 'false' },
    logger: { warn: (...args) => warnings.push(args), info: (...args) => recoveries.push(args) } })
  const admin = new pg.Client({ connectionString, ssl: false, connectionTimeoutMillis: 3000 })
  const server = http.createServer(async (_request, response) => {
    try {
      const row = (await pool.query("SELECT 1 AS value, current_setting('jit') AS jit")).rows[0]
      response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(row))
    } catch { response.writeHead(503).end('Database unavailable') }
  })
  try {
    await admin.connect()
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const endpoint = `http://127.0.0.1:${server.address().port}/health`
    const before = await fetch(endpoint)
    assert.equal(before.status, 200)
    assert.deepEqual(await before.json(), { value: 1, jit: 'off' })
    const originalPid = (await pool.query('SELECT pg_backend_pid() AS pid')).rows[0].pid
    const disconnected = once(pool, 'error', { signal: AbortSignal.timeout(5000) })
    assert.equal((await admin.query('SELECT pg_terminate_backend($1) AS terminated', [originalPid])).rows[0].terminated, true)
    await disconnected
    const after = await fetch(endpoint)
    assert.equal(after.status, 200, 'the HTTP process survives and a fresh connection serves the next request')
    assert.deepEqual(await after.json(), { value: 1, jit: 'off' })
    assert.notEqual((await pool.query('SELECT pg_backend_pid() AS pid')).rows[0].pid, originalPid)
    assert.equal(warnings.length, 1)
    assert.equal(recoveries.length, 1)
  } finally {
    server.closeAllConnections()
    if (server.listening) await new Promise(resolve => server.close(resolve))
    await pool.end()
    await admin.end()
  }
})

test('parallel API reads stay within the connection cap and an exhausted pool times out', { skip: !connectionString, timeout: 10000 }, async () => {
  const pool = createRuntimeDatabasePool({ environment: {
    DATABASE_URL: connectionString, DATABASE_SSL: 'false', DB_CONNECT_TIMEOUT_MS: '500',
  } })
  const held = []
  try {
    held.push(...await Promise.all(Array.from({ length: 4 }, () => pool.connect())))
    assert.equal(pool.totalCount, 4)
    await assert.rejects(pool.connect(), /timeout/i, 'queue exhaustion fails within the configured bound')
    for (const client of held.splice(0)) client.release()
    const rows = await Promise.all(Array.from({ length: 12 }, () => pool.query('SELECT pg_backend_pid() AS pid, pg_sleep(0.02)')))
    assert.equal(pool.totalCount, 4)
    assert.ok(new Set(rows.map(result => result.rows[0].pid)).size <= 4)
  } finally {
    for (const client of held) client.release()
    await pool.end()
  }
})

test('losing a checked-out transaction connection does not crash the API or replay the transaction', { skip: !connectionString, timeout: 10000 }, async () => {
  const warnings = []
  const pool = createRuntimeDatabasePool({ environment: { DATABASE_URL: connectionString, DATABASE_SSL: 'false' },
    logger: { warn: (...args) => warnings.push(args), info() {} } })
  const admin = new pg.Client({ connectionString, ssl: false, connectionTimeoutMillis: 3000 })
  let client
  try {
    await admin.connect()
    client = await pool.connect()
    await client.query('BEGIN')
    const pid = (await client.query('SELECT pg_backend_pid() AS pid')).rows[0].pid
    const disconnected = once(client, 'error', { signal: AbortSignal.timeout(5000) })
    await admin.query('SELECT pg_terminate_backend($1)', [pid])
    await disconnected
    await assert.rejects(client.query('COMMIT'), /connection|queryable/i)
    client.release(true)
    client = null
    assert.notEqual((await pool.query('SELECT pg_backend_pid() AS pid')).rows[0].pid, pid)
    assert.equal(warnings.length, 1)
  } finally {
    client?.release(true)
    await pool.end()
    await admin.end()
  }
})
