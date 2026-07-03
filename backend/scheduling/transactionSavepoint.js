/**
 * Run fn inside a SAVEPOINT so a failed query does not abort the outer transaction.
 * Required for best-effort side effects (billing, pass ledger) during enrollment mutations.
 */

/**
 * Run fn inside a SAVEPOINT when the client is in a transaction; otherwise run directly.
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {() => Promise<T>} fn
 * @template T
 * @returns {Promise<T>}
 */
export async function runIsolated(db, fn) {
  const name = `sp_${String(Math.random()).slice(2, 12)}`
  try {
    await db.query(`SAVEPOINT ${name}`)
  } catch (err) {
    if (/savepoint can only be used in transaction/i.test(String(err?.message ?? err))) {
      return fn()
    }
    throw err
  }

  try {
    const result = await fn()
    await db.query(`RELEASE SAVEPOINT ${name}`)
    return result
  } catch (err) {
    await db.query(`ROLLBACK TO SAVEPOINT ${name}`).catch(() => {})
    await db.query(`RELEASE SAVEPOINT ${name}`).catch(() => {})
    throw err
  }
}

/**
 * @param {import('pg').PoolClient} client
 * @param {() => Promise<T>} fn
 * @template T
 * @returns {Promise<T>}
 * @deprecated Prefer runIsolated — kept for explicit in-transaction call sites.
 */
export async function withSavepoint(client, fn) {
  return runIsolated(client, fn)
}

/**
 * @param {import('pg').PoolClient} client
 * @param {() => Promise<T>} fn
 * @param {{ logPrefix?: string }} [opts]
 * @template T
 * @returns {Promise<T | undefined>}
 */
export async function trySavepoint(client, fn, { logPrefix = '[savepoint]' } = {}) {
  try {
    return await withSavepoint(client, fn)
  } catch (err) {
    console.warn(`${logPrefix} skipped:`, err?.message ?? err)
    return undefined
  }
}
