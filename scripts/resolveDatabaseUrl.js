/**
 * Resolve Postgres connection string for CLI scripts (evaluator, sync, audit).
 * Prefers EXTERNAL_DB_URL / DB_URL from backend/.env.local (Render) over
 * a stale shell DATABASE_URL or docker-internal INTERNAL_DB_URL hostnames.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ENV_LOCAL = path.join(__dirname, '../backend/.env.local')

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}
  const out = {}
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    out[key] = val
  }
  return out
}

function hostFromUrl(connectionString) {
  if (!connectionString) return null
  try {
    const u = new URL(connectionString.replace(/^postgres(ql)?:\/\//, 'http://'))
    return u.hostname || null
  } catch {
    return null
  }
}

function isResolvableExternalHost(hostname) {
  if (!hostname) return false
  // Docker-internal Render hostnames omit the public suffix
  return hostname.includes('.')
}

function buildLocalUrl(fileEnv) {
  const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD } = fileEnv
  if (!DB_HOST || !DB_USER || !DB_NAME) return null
  const user = encodeURIComponent(DB_USER)
  const pass = encodeURIComponent(DB_PASSWORD ?? '')
  return `postgresql://${user}:${pass}@${DB_HOST}:${DB_PORT || 5432}/${DB_NAME}`
}

export function resolveDatabaseUrl(options = {}) {
  const fileEnv = parseEnvFile(ENV_LOCAL)
  const candidates = [
    { key: 'EXTERNAL_DB_URL', value: fileEnv.EXTERNAL_DB_URL ?? process.env.EXTERNAL_DB_URL },
    { key: 'DB_URL', value: fileEnv.DB_URL ?? process.env.DB_URL },
    { key: 'DATABASE_URL', value: fileEnv.DATABASE_URL ?? process.env.DATABASE_URL },
    { key: 'INTERNAL_DB_URL', value: fileEnv.INTERNAL_DB_URL ?? process.env.INTERNAL_DB_URL },
    { key: 'local', value: buildLocalUrl(fileEnv) },
  ]

  for (const { key, value } of candidates) {
    if (!value) continue
    const host = hostFromUrl(value)
    if (key === 'INTERNAL_DB_URL' && !isResolvableExternalHost(host)) continue
    if (key === 'DATABASE_URL' && !isResolvableExternalHost(host)) continue
    return { connectionString: value, source: key, host }
  }

  return { connectionString: null, source: null, host: null }
}

export function requireDatabaseUrl() {
  const resolved = resolveDatabaseUrl()
  if (!resolved.connectionString) {
    console.error('No database URL found. Set EXTERNAL_DB_URL or DB_URL in backend/.env.local')
    process.exit(2)
  }
  return resolved
}
