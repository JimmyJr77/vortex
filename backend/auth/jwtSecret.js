/**
 * Single source of truth for member/admin JWT signing.
 * Call resolveJwtSecret() at use time (not module load) so dotenv in server.js
 * has run before the secret is read in local development.
 */
let cachedSecret = null

export function resolveJwtSecret() {
  if (cachedSecret) return cachedSecret

  const secret =
    process.env.JWT_SECRET ||
    (process.env.NODE_ENV === 'production' ? undefined : 'dev-insecure-jwt-secret')

  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production.')
  }

  if (!process.env.JWT_SECRET && process.env.NODE_ENV !== 'production') {
    console.warn('⚠️ JWT_SECRET is not set. Development fallback token signing is enabled.')
  }

  cachedSecret = secret
  return cachedSecret
}

/** @internal test helper */
export function resetJwtSecretCacheForTests() {
  cachedSecret = null
}
