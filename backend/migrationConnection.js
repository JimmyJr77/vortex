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
