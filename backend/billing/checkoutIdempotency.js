import crypto from 'node:crypto'

export function normalizeCheckoutRequestKey(value, namespace) {
  const raw = String(value ?? '').trim()
  if (!raw) {
    const error = new Error('An Idempotency-Key header is required.')
    error.status = 400
    error.statusCode = 400
    error.code = 'CHECKOUT_IDEMPOTENCY_KEY_REQUIRED'
    throw error
  }
  if (!/^[A-Za-z0-9_.:-]{8,120}$/.test(raw)) {
    const error = new Error('Idempotency-Key must be 8–120 URL-safe characters.')
    error.status = 400
    error.statusCode = 400
    error.code = 'CHECKOUT_IDEMPOTENCY_KEY_INVALID'
    throw error
  }
  return `${namespace}:${raw}`
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue)
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter((key) => value[key] !== undefined)
        .map((key) => [key, canonicalValue(value[key])]),
    )
  }
  return value
}

export function checkoutFingerprint(value) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(canonicalValue(value)))
    .digest('hex')
}

export function stripeCheckoutIdempotencyKey(namespace, accountId, requestKey) {
  const digest = crypto.createHash('sha256').update(String(requestKey)).digest('hex')
  return `${namespace}:${Number(accountId)}:${digest}`
}

export function checkoutIdempotencyConflict(message = 'Idempotency-Key was already used for a different checkout request.') {
  const error = new Error(message)
  error.code = 'CHECKOUT_IDEMPOTENCY_CONFLICT'
  error.status = 409
  error.statusCode = 409
  return error
}
