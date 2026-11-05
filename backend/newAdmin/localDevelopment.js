import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

export const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** A deliberately separate target; repository .env credentials are never used. */
export function localDevelopmentConfig(environment = process.env) {
  if (environment.NODE_ENV !== 'development' || environment.LOCAL_DEV_SEED !== 'true') {
    throw new Error('Local New Admin tools require NODE_ENV=development and LOCAL_DEV_SEED=true.')
  }
  if (environment.STRIPE_ENABLED === 'true' || /^sk_live_/.test(environment.STRIPE_SECRET_KEY || '')) {
    throw new Error('Disable Stripe before preparing simulated local data.')
  }
  const url = new URL(environment.NEW_ADMIN_DATABASE_URL || `postgresql://${encodeURIComponent(os.userInfo().username)}@127.0.0.1:5432/vortex_new_admin_dev`)
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
    || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    || url.search || url.hash
    || !/^vortex_new_admin_dev(?:_[a-z0-9_]+)?$/.test(decodeURIComponent(url.pathname.slice(1)))) {
    throw new Error('NEW_ADMIN_DATABASE_URL must name a loopback vortex_new_admin_dev[_suffix] database, without query overrides.')
  }
  return { connectionString: url.toString(), ssl: false, database: decodeURIComponent(url.pathname.slice(1)), url }
}

export function localChildEnvironment(config, environment = process.env) {
  const child = { ...environment }
  // Prevent server.js and migration dotenv loading from activating any saved
  // hosted service credential. Preserve names, discard values without logging.
  for (const filename of ['.env', '.env.local']) {
    const filenamePath = path.join(backendDirectory, filename)
    if (fs.existsSync(filenamePath)) {
      for (const key of Object.keys(dotenv.parse(fs.readFileSync(filenamePath)))) child[key] = ''
    }
  }
  Object.assign(child, {
    NODE_ENV: 'development', LOCAL_DEV_SEED: 'true',
    DATABASE_URL: config.connectionString, DB_URL: '', EXTERNAL_DB_URL: '',
    DB_HOST: config.url.hostname.replaceAll('[', '').replaceAll(']', ''),
    DB_PORT: config.url.port || '5432', DB_NAME: config.database,
    DB_USER: decodeURIComponent(config.url.username), DB_PASSWORD: decodeURIComponent(config.url.password),
    DATABASE_SSL: 'false', STRIPE_ENABLED: 'false', STRIPE_SECRET_KEY: '', STRIPE_WEBHOOK_SECRET: '',
    EMAIL_KILL_SWITCH: 'true', DAILY_ROSTER_SCHEDULER_ENABLED: 'false',
    JWT_SECRET: 'local-new-admin-fictional-data-only-7f509c2a',
    FRONTEND_URL: 'http://localhost:5173', PORT: environment.NEW_ADMIN_PORT || '3001',
    SKIP_PLATFORM_BOOT_MIGRATIONS: 'true',
  })
  return child
}

export function isIsolatedAdminDevelopment(environment = process.env) {
  if (environment.NODE_ENV !== 'development' || environment.LOCAL_DEV_SEED !== 'true') return false
  try {
    const url = new URL(environment.DATABASE_URL)
    return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      && /^vortex_new_admin_dev(?:_[a-z0-9_]+)?$/.test(url.pathname.slice(1))
      && !url.search && environment.STRIPE_ENABLED === 'false'
      && environment.EMAIL_KILL_SWITCH === 'true'
      && environment.DB_NAME === url.pathname.slice(1)
      && ['localhost', '127.0.0.1', '::1'].includes(environment.DB_HOST)
  } catch { return false }
}
