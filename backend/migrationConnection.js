const CONNECTION_KEYS = Object.freeze([
  'DATABASE_URL',
  'EXTERNAL_DB_URL',
  'DB_URL',
])

function firstConnectionString(environment) {
  for (const key of CONNECTION_KEYS) {
    const value = String(environment?.[key] ?? '').trim()
    if (value) return value
  }
  return null
}

export function resolveMigrationConnectionString(
  explicitEnvironment,
  loadedEnvironment,
) {
  return (
    firstConnectionString(explicitEnvironment)
    || firstConnectionString(loadedEnvironment)
  )
}

/**
 * node-postgres lets individual host/user/database fields override values from
 * connectionString. Keep the two connection modes mutually exclusive so an
 * explicit disposable-database URL cannot be redirected by dotenv-loaded
 * DB_HOST credentials.
 */
export function buildMigrationPoolConfig({
  connectionString,
  environment = process.env,
  ssl = false,
} = {}) {
  if (String(connectionString ?? '').trim()) {
    return { connectionString: String(connectionString).trim(), ssl }
  }
  return {
    user: environment.DB_USER || 'postgres',
    host: environment.DB_HOST || 'localhost',
    database: environment.DB_NAME || 'vortex_athletics',
    password: environment.DB_PASSWORD || 'password',
    port: Number(environment.DB_PORT || 5432),
    ssl,
  }
}
