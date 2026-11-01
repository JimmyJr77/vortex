import { observeBillingConnection, assertBillingConnectionHealthy, billingConnectionFailure } from './billingDatabaseRecovery.js'

const COLLECTION_LOCK_POISON = Symbol('billingAccountCollectionLockPoison')

function positiveAccountId(value) {
  const accountId = Number(value)
  if (!Number.isInteger(accountId) || accountId <= 0) {
    throw new Error('Billing account ID is required.')
  }
  return accountId
}

/** Serialize every local or Stripe collector for one household account. */
export async function withBillingAccountCollectionLock(pool, accountId, callback) {
  const normalizedAccountId = positiveAccountId(accountId)
  const ownsClient = typeof pool.release !== 'function' && typeof pool.connect === 'function'
  const client = ownsClient ? await pool.connect() : pool
  observeBillingConnection(client)
  const lockKey = `household-monthly-invoice:${normalizedAccountId}`
  let locked = false
  let callbackError = null
  try {
    if (client[COLLECTION_LOCK_POISON]) throw client[COLLECTION_LOCK_POISON]
    assertBillingConnectionHealthy(client)
    await client.query('SELECT pg_advisory_lock(hashtextextended($1::text, 0))', [lockKey])
    locked = true
    assertBillingConnectionHealthy(client)
    // Do not race this callback against a disconnect: the losing callback
    // would keep running and could dispatch Stripe writes after lock release.
    const result = await callback(client)
    assertBillingConnectionHealthy(client)
    return result
  } catch (error) {
    callbackError = billingConnectionFailure(client) || error
    throw callbackError
  } finally {
    let unlockError = billingConnectionFailure(client) || null
    if (locked && !unlockError) {
      try {
        const result = await client.query(
          'SELECT pg_advisory_unlock(hashtextextended($1::text, 0))',
          [lockKey],
        )
        if (result.rows[0]?.pg_advisory_unlock === false) {
          throw new Error(`Billing account collection lock ${normalizedAccountId} was not held by its session.`)
        }
      } catch (error) {
        unlockError = error
        client[COLLECTION_LOCK_POISON] = error
      }
    }
    if (ownsClient && typeof client.release === 'function') {
      // A session whose unlock failed must never return to the pool: it may
      // still own the advisory lock and would silently break serialization.
      client.release(unlockError || client[COLLECTION_LOCK_POISON] || undefined)
    }
    if (unlockError && !callbackError) throw unlockError
  }
}
