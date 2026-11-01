const failedConnections = new WeakMap()
const observedConnections = new WeakSet()

export function isBillingDatabaseConnectionError(error) {
  return error?.code === 'billing_database_connection_lost'
    || /^08/.test(String(error?.code ?? ''))
    || ['ECONNRESET', 'ECONNREFUSED', 'EPIPE', 'ETIMEDOUT', '57P01', '57P02', '57P03'].includes(error?.code)
    || /Connection terminated|Client has encountered a connection error|Connection ended unexpectedly|timeout exceeded when trying to connect/i.test(error?.message ?? '')
}

export function observeBillingConnection(client) {
  if (observedConnections.has(client) || typeof client.on !== 'function') return
  observedConnections.add(client)
  // A checked-out pg Client emits errors between queries (including while we
  // await Stripe). Catching a rejected query or listening on Pool is not enough.
  // Keep this listener for the lifetime of the physical connection.
  client.on('error', (cause) => {
    if (failedConnections.has(client)) return
    const error = new Error('Billing database connection was lost; its collection lock is no longer trusted.', { cause })
    error.code = 'billing_database_connection_lost'
    failedConnections.set(client, error)
  })
}

export function billingConnectionFailure(client) {
  return failedConnections.get(client)
}

export function assertBillingConnectionHealthy(client) {
  const error = billingConnectionFailure(client)
  if (error) throw error
}

export function configureBillingWorkerPool(pool, { log = console.error } = {}) {
  pool.on('connect', observeBillingConnection)
  // pg removes broken idle clients itself. Handle the pool event so one idle
  // socket cannot terminate an otherwise healthy account sweep.
  pool.on('error', (error) => log('[billing] idle database connection failed:', error.message))
  return pool
}

// Only use for idempotent bookkeeping, never for a Stripe write or an arbitrary
// transaction. The caller supplies the same run/account keys on every retry.
export async function retryBillingProgressWrite(operation, { wait = (ms) => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  for (let attempt = 0; ; attempt += 1) {
    try { return await operation() } catch (error) {
      if (!isBillingDatabaseConnectionError(error) || attempt >= 2) throw error
      await wait(250 * (attempt + 1))
    }
  }
}
