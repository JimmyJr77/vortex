// PostgreSQL's two-int advisory-lock namespace does not overlap the one-bigint
// account-lock namespace used by migration and invoice transactions.
export const LEGACY_CLASS_SUBSCRIPTION_CREATION_LOCK_KEY = Object.freeze([
  1_448_038_996,
  1_129_070_931,
])

async function withLegacyClassSubscriptionCreationLock(pool, mode, callback) {
  const ownsClient = typeof pool.connect === 'function' && typeof pool.release !== 'function'
  const client = ownsClient ? await pool.connect() : pool
  const shared = mode === 'shared'
  const lockFunction = shared ? 'pg_advisory_lock_shared' : 'pg_advisory_lock'
  const unlockFunction = shared ? 'pg_advisory_unlock_shared' : 'pg_advisory_unlock'
  let locked = false
  let callbackError = null
  try {
    await client.query(
      `SELECT ${lockFunction}($1::integer, $2::integer)`,
      LEGACY_CLASS_SUBSCRIPTION_CREATION_LOCK_KEY,
    )
    locked = true
    return await callback(client)
  } catch (error) {
    callbackError = error
    throw error
  } finally {
    let unlockError = null
    if (locked) {
      try {
        await client.query(
          `SELECT ${unlockFunction}($1::integer, $2::integer)`,
          LEGACY_CLASS_SUBSCRIPTION_CREATION_LOCK_KEY,
        )
      } catch (error) {
        unlockError = error
      }
    }
    if (ownsClient && typeof client.release === 'function') {
      // Passing an error makes node-postgres destroy a connection whose session
      // lock could not be released instead of returning it to the pool.
      client.release(unlockError ?? undefined)
    }
    if (unlockError && !ownsClient && !callbackError) {
      throw unlockError
    }
  }
}

/** Hold while a legacy class Stripe collector is rechecked, created, and linked. */
export function withLegacyClassSubscriptionCreationSharedLock(pool, callback) {
  return withLegacyClassSubscriptionCreationLock(pool, 'shared', callback)
}

/** Hold while first-arm inventory is re-audited and the durable cutoff is written. */
export function withLegacyClassSubscriptionCreationExclusiveLock(pool, callback) {
  return withLegacyClassSubscriptionCreationLock(pool, 'exclusive', callback)
}
