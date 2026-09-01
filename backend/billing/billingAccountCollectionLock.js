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
  if (client[COLLECTION_LOCK_POISON]) throw client[COLLECTION_LOCK_POISON]
  const lockKey = `household-monthly-invoice:${normalizedAccountId}`
  let locked = false
  let callbackError = null
  try {
    await client.query('SELECT pg_advisory_lock(hashtextextended($1::text, 0))', [lockKey])
    locked = true
    return await callback(client)
  } catch (error) {
    callbackError = error
    throw error
  } finally {
    let unlockError = null
    if (locked) {
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
