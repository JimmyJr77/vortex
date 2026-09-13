/** Authenticated IDs come from server context, never from an agent decision. */
export function libraryScopeId(value, field) {
  if ((typeof value !== 'number' && typeof value !== 'string') || !/^[1-9]\d*$/.test(String(value))) {
    throw new TypeError(`${field} must be a positive database ID`)
  }
  if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new TypeError(`${field} must be a safe database ID`)
  if (BigInt(value) > 9223372036854775807n) throw new RangeError(`${field} exceeds PostgreSQL bigint range`)
  return String(value)
}

/** A librarian handoff must describe one consistent, read-only DB snapshot. */
export async function withCoachingLibrarySnapshot(pool, context, read) {
  const scope = Object.freeze({
    facilityId: libraryScopeId(context.facilityId, 'facilityId'),
    userId: libraryScopeId(context.userId, 'userId'),
  })
  const client = await pool.connect()
  let discardError
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
    const result = await read(client, scope)
    await client.query('COMMIT')
    return result
  } catch (error) {
    try { await client.query('ROLLBACK') } catch (rollbackError) { discardError = rollbackError }
    throw error
  } finally {
    client.release(discardError)
  }
}
