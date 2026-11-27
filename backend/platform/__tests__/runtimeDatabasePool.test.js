import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'
import pg from 'pg'
import { createRuntimeDatabasePool, runtimeDatabasePoolConfig } from '../runtimeDatabasePool.js'

test('API database sessions bound concurrent work, connection waits and JIT memory', () => {
  const config = runtimeDatabasePoolConfig({ PGOPTIONS: '-c timezone=UTC' })
  assert.equal(config.max, 4)
  assert.equal(config.connectionTimeoutMillis, 3000)
  assert.equal(config.options, '-c timezone=UTC -c jit=off')
  assert.equal(config.keepAlive, true)
  assert.equal(config.ssl, false)
  const overrides = runtimeDatabasePoolConfig({ DB_POOL_MAX: '6', DB_CONNECT_TIMEOUT_MS: '8000', DB_JIT_ENABLED: 'true' })
  assert.equal(overrides.max, 6)
  assert.equal(overrides.connectionTimeoutMillis, 8000)
  assert.equal(overrides.options, '-c jit=on')
})

test('database URL and TLS settings remain authoritative over discrete host defaults', () => {
  const url = 'postgresql://example:placeholder@hosted.example/vortex'
  const config = runtimeDatabasePoolConfig({ DB_URL: url, NODE_ENV: 'development', DB_HOST: 'localhost' })
  assert.equal(config.connectionString, url)
  assert.equal(config.host, undefined)
  assert.deepEqual(config.ssl, { rejectUnauthorized: false })
  assert.equal(runtimeDatabasePoolConfig({ DATABASE_URL: url, DATABASE_SSL: 'false' }).ssl, false)
  assert.equal(runtimeDatabasePoolConfig({ DATABASE_URL: 'postgresql://localhost/test' }).ssl, false)
  assert.equal(runtimeDatabasePoolConfig({ DB_HOST: 'postgres', DB_PORT: '55439' }).port, 55439)
})

test('invalid limits fail explicitly rather than silently removing connection bounds', () => {
  for (const environment of [
    { DB_POOL_MAX: '0' }, { DB_POOL_MAX: '2' }, { DB_POOL_MAX: '1000' }, { DB_POOL_MAX: '4.5' },
    { DB_CONNECT_TIMEOUT_MS: '0' }, { DB_CONNECT_TIMEOUT_MS: 'not-a-number' }, { DB_JIT_ENABLED: 'yes' },
  ]) assert.throws(() => runtimeDatabasePoolConfig(environment))
})

test('connection URL options preserve custom settings while respecting the API JIT memory limit', () => {
  const config = runtimeDatabasePoolConfig({
    DATABASE_URL: 'postgresql://localhost/test?options=-c%20timezone%3DUTC%20-c%20jit%3Don',
    PGOPTIONS: '-c statement_timeout=30000',
  })
  const client = new pg.Client(config)
  assert.equal(new URL(config.connectionString).searchParams.has('options'), false)
  assert.equal(client.connectionParameters.options, '-c statement_timeout=30000 -c timezone=UTC -c jit=on -c jit=off')
})

test('idle disconnects keep the pool alive and recovery logging does not expose its client', () => {
  class FakePool extends EventEmitter {
    constructor(config) { super(); this.config = config }
    end() { throw new Error('The error listener must not end the pool') }
  }
  const warnings = [], recoveries = []
  const pool = createRuntimeDatabasePool({ environment: {}, Pool: FakePool,
    logger: { warn: (...args) => warnings.push(args), info: (...args) => recoveries.push(args) } })
  const error = Object.assign(new Error('Connection terminated unexpectedly'), { code: '57P01', client: { password: 'never-log-this' } })
  pool.emit('error', error)
  pool.emit('error', error)
  assert.equal(warnings.length, 1, 'a disconnect storm logs once until a connection recovers')
  assert.deepEqual(warnings[0][1], { code: '57P01', message: error.message })
  const client = new EventEmitter()
  pool.emit('connect', client)
  assert.equal(recoveries.length, 1)
  client.emit('error', error)
  assert.equal(warnings.length, 2, 'a later independent outage is reported')
})
