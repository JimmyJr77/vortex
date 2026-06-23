/**
 * Marketing one-click unsubscribe (RFC 8058).
 *
 * Tokens are opaque, scoped, and do NOT contain the recipient's email in the URL — the
 * address is AES-GCM encrypted inside the token. Unsubscribing adds a `marketing`-scope
 * suppression only; it never disables account-security/transactional mail.
 *
 * This is scaffolding for a future marketing stream — no marketing email is sent today.
 */

import crypto from 'crypto'
import { addSuppression } from './emailDeliveryStore.js'
import { normalizeEmail, isValidEmail } from './emailAddress.js'
import { publicAppUrl } from './publicAppUrl.js'

function key() {
  const secret = process.env.JWT_SECRET || 'dev-insecure-jwt-secret'
  return crypto.createHash('sha256').update(`unsub:${secret}`).digest()
}

/** Build an opaque token encoding { email, scope }. */
export function makeUnsubscribeToken(email, scope = 'marketing') {
  const payload = JSON.stringify({ e: normalizeEmail(email), s: scope })
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv)
  const enc = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64url')
}

/** Decode an opaque token. Returns null on tamper/invalid. */
export function readUnsubscribeToken(token) {
  try {
    const buf = Buffer.from(String(token || ''), 'base64url')
    const iv = buf.subarray(0, 12)
    const tag = buf.subarray(12, 28)
    const enc = buf.subarray(28)
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv)
    decipher.setAuthTag(tag)
    const out = Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
    const obj = JSON.parse(out)
    if (!obj?.e || !isValidEmail(obj.e)) return null
    return { email: obj.e, scope: obj.s || 'marketing' }
  } catch {
    return null
  }
}

export function unsubscribeUrl(email, scope = 'marketing') {
  return `${publicAppUrl()}/email/unsubscribe/${makeUnsubscribeToken(email, scope)}`
}

/**
 * Idempotent unsubscribe. Returns { ok } regardless of whether already suppressed
 * (idempotent by design). Never throws to the caller for a known token.
 */
export async function applyUnsubscribe(token) {
  const decoded = readUnsubscribeToken(token)
  if (!decoded) return { ok: false, reason: 'invalid_token' }
  await addSuppression(decoded.email, {
    scope: 'marketing',
    reason: 'unsubscribe',
    source: 'one_click',
    detail: null,
  })
  return { ok: true }
}

/**
 * Register the one-click unsubscribe endpoints.
 * POST performs the unsubscribe directly (no login, no second confirmation).
 */
export function registerEmailUnsubscribeRoutes(app) {
  // RFC 8058 one-click POST target.
  app.post('/email/unsubscribe/:token', async (req, res) => {
    const result = await applyUnsubscribe(req.params.token)
    // Always 200 for a syntactically handled request; idempotent.
    res.status(200).send(result.ok ? 'You have been unsubscribed.' : 'Unsubscribe link is invalid.')
  })

  // Human-facing confirmation (GET) — also performs unsubscribe for accessibility.
  app.get('/email/unsubscribe/:token', async (req, res) => {
    const result = await applyUnsubscribe(req.params.token)
    res
      .status(result.ok ? 200 : 400)
      .type('html')
      .send(
        result.ok
          ? '<p>You have been unsubscribed from Vortex Athletics marketing emails. Account and security emails are unaffected.</p>'
          : '<p>This unsubscribe link is invalid or expired.</p>',
      )
  })
}
