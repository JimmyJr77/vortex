import pg from 'pg'
import { buildMigrationPoolConfig } from '../migrationConnection.js'

function integerSetting(environment, key, fallback, minimum, maximum) {
  const value = environment[key]
  if (value == null || value === '') return fallback
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < minimum || number > maximum) {
    throw new Error(`${key} must be an integer between ${minimum} and ${maximum}.`)
  }
  return number
}

/** Limit simultaneous query memory on small databases, including read fan-out. */
export function runtimeDatabasePoolConfig(environment = process.env) {
  let connectionString = environment.DATABASE_URL || environment.DB_URL
  let remote = false
  let urlOptions = null
  if (connectionString) {
    try {
      const url = new URL(connectionString)
      remote = !['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname.toLowerCase())
      if (url.searchParams.has('options')) {
        urlOptions = url.searchParams.getAll('options').join(' ')
        // pg gives URL options precedence over the config object. Merge them
        // here so a URL's timezone/timeout settings cannot bypass the JIT limit.
        url.searchParams.delete('options')
        connectionString = url.toString()
      }
    }
    catch { throw new Error('The database connection URL is invalid.') }
  }
  const ssl = environment.DATABASE_SSL === 'false' ? false
    : environment.DATABASE_SSL === 'true' || environment.NODE_ENV === 'production' || remote
      ? { rejectUnauthorized: false } : false
  const jit = environment.DB_JIT_ENABLED || 'false'
  if (!['true', 'false'].includes(jit)) throw new Error('DB_JIT_ENABLED must be true or false.')
  return {
    ...buildMigrationPoolConfig({ connectionString, environment, ssl }),
    // Billing and background jobs can hold a lock connection while acquiring a
    // transaction connection. Keep room for that work and a health request.
    max: integerSetting(environment, 'DB_POOL_MAX', 4, 4, 20),
    connectionTimeoutMillis: integerSetting(environment, 'DB_CONNECT_TIMEOUT_MS', 3_000, 100, 30_000),
    idleTimeoutMillis: 10_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
    application_name: 'vortex-api',
    // JIT compilation can consume more memory than these short portal queries
    // need. Set this per API session; migrations and other workers stay separate.
    options: [environment.PGOPTIONS, urlOptions, `-c jit=${jit === 'true' ? 'on' : 'off'}`].filter(Boolean).join(' '),
  }
}

export function createRuntimeDatabasePool({ environment = process.env, Pool = pg.Pool, logger = console } = {}) {
  const pool = new Pool(runtimeDatabasePoolConfig(environment))
  let disconnected = false
  const onConnectionError = error => {
    // pg removes failed idle clients itself; checked-out failures still reject
    // their transaction. Exiting here prevents the next connection recovering.
    if (!disconnected) logger.warn('[database] Connection lost; the pool will reconnect.', { code: error.code, message: error.message })
    disconnected = true
  }
  pool.on('error', onConnectionError)
  pool.on('connect', client => {
    // Checked-out clients have no pg-pool error listener between transaction
    // queries. Observe their socket errors too; the transaction still fails and
    // rolls back normally, rather than crashing Node with an unhandled event.
    client.on('error', onConnectionError)
    if (disconnected) logger.info('[database] Connection restored.')
    disconnected = false
  })
  return pool
}
