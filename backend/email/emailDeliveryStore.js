/**
 * Suppression list + delivery log access.
 *
 * The mail layer is called from many places that do not hold a pg Pool. To avoid
 * threading a pool through every call site, the server registers the pool once at
 * startup via `registerEmailPool(pool)`. When no pool is registered (e.g. unit tests),
 * all functions degrade gracefully to no-ops / "not suppressed".
 */

import crypto from 'crypto'
import { normalizeEmail, emailDomain } from './emailAddress.js'
import { STREAM_MARKETING } from './emailCategories.js'

let _pool = null

export function registerEmailPool(pool) {
  _pool = pool
}

export function hasEmailPool() {
  return Boolean(_pool)
}

export function hashEmail(email) {
  return crypto.createHash('sha256').update(normalizeEmail(email)).digest('hex')
}

/**
 * Is this address suppressed for the given stream?
 * A 'global' suppression blocks everything; a 'marketing' suppression blocks only
 * marketing. Account-security/transactional mail ignores marketing-only suppressions.
 */
export async function isSuppressed(email, stream) {
  if (!_pool) return { suppressed: false }
  const normalized = normalizeEmail(email)
  try {
    const res = await _pool.query(
      `SELECT scope, reason FROM email_suppression
       WHERE LOWER(email) = LOWER($1) AND released_at IS NULL`,
      [normalized],
    )
    for (const row of res.rows) {
      if (row.scope === 'global') return { suppressed: true, scope: 'global', reason: row.reason }
      if (row.scope === STREAM_MARKETING && stream === STREAM_MARKETING) {
        return { suppressed: true, scope: 'marketing', reason: row.reason }
      }
    }
    return { suppressed: false }
  } catch (err) {
    console.warn('[emailDeliveryStore] isSuppressed query failed:', err?.message || err)
    return { suppressed: false }
  }
}

export async function addSuppression(email, { scope = 'global', reason, source = 'system', detail = null } = {}) {
  if (!_pool) return { ok: false, skipped: true }
  const normalized = normalizeEmail(email)
  try {
    await _pool.query(
      `INSERT INTO email_suppression (email, scope, reason, source, detail)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (LOWER(email), scope) WHERE released_at IS NULL DO NOTHING`,
      [normalized, scope, reason, source, detail],
    )
    return { ok: true }
  } catch (err) {
    console.warn('[emailDeliveryStore] addSuppression failed:', err?.message || err)
    return { ok: false }
  }
}

/** Release a suppression (e.g. staff confirms a genuinely mistyped address was fixed). */
export async function releaseSuppression(email, { scope = 'global', releasedBy = 'staff' } = {}) {
  if (!_pool) return { ok: false, skipped: true }
  try {
    await _pool.query(
      `UPDATE email_suppression
         SET released_at = now(), released_by = $3
       WHERE LOWER(email) = LOWER($1) AND scope = $2 AND released_at IS NULL`,
      [normalizeEmail(email), scope, releasedBy],
    )
    return { ok: true }
  } catch (err) {
    console.warn('[emailDeliveryStore] releaseSuppression failed:', err?.message || err)
    return { ok: false }
  }
}

/**
 * Count recent sends of a category to one address (for cooldown / daily cap).
 * @returns {{ count: number, lastAt: Date | null }}
 */
export async function recentSendStats(email, category, sinceMs) {
  if (!_pool) return { count: 0, lastAt: null }
  try {
    const res = await _pool.query(
      `SELECT COUNT(*)::int AS count, MAX(created_at) AS last_at
       FROM email_delivery
       WHERE recipient_hash = $1 AND category = $2
         AND created_at >= now() - ($3::bigint * interval '1 millisecond')
         AND status NOT IN ('suppressed', 'failed')`,
      [hashEmail(email), category, Math.max(0, Math.floor(sinceMs))],
    )
    const row = res.rows[0] || {}
    return { count: Number(row.count) || 0, lastAt: row.last_at ? new Date(row.last_at) : null }
  } catch (err) {
    console.warn('[emailDeliveryStore] recentSendStats failed:', err?.message || err)
    return { count: 0, lastAt: null }
  }
}

/**
 * Record a delivery attempt. Returns the row id (or null). Honors idempotency_key:
 * if a row with the same key exists, returns its id without inserting again.
 */
export async function recordDelivery({
  facilityId = null,
  memberId = null,
  invitationId = null,
  category,
  stream,
  templateVersion = null,
  provider = 'smtp:gmail',
  providerMessageId = null,
  email,
  status = 'queued',
  smtpCode = null,
  providerReason = null,
  idempotencyKey = null,
}) {
  if (!_pool) return { id: null, skipped: true }
  try {
    if (idempotencyKey) {
      const existing = await _pool.query(
        `SELECT id FROM email_delivery WHERE idempotency_key = $1`,
        [idempotencyKey],
      )
      if (existing.rows[0]) return { id: existing.rows[0].id, duplicate: true }
    }
    const res = await _pool.query(
      `INSERT INTO email_delivery (
         facility_id, member_id, invitation_id, category, stream, template_version,
         provider, provider_message_id, recipient_domain, recipient_hash, status,
         attempt_count, smtp_code, provider_reason, idempotency_key, accepted_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 1, $12, $13, $14,
         CASE WHEN $11 = 'accepted' THEN now() ELSE NULL END
       )
       RETURNING id`,
      [
        facilityId, memberId, invitationId, category, stream, templateVersion,
        provider, providerMessageId, emailDomain(email), hashEmail(email), status,
        truncate(smtpCode, 32), truncate(providerReason, 240), idempotencyKey,
      ],
    )
    return { id: res.rows[0]?.id ?? null }
  } catch (err) {
    console.warn('[emailDeliveryStore] recordDelivery failed:', err?.message || err)
    return { id: null }
  }
}

export async function updateDeliveryStatus(id, status, { smtpCode = null, providerReason = null } = {}) {
  if (!_pool || !id) return
  try {
    await _pool.query(
      `UPDATE email_delivery
         SET status = $2,
             smtp_code = COALESCE($3, smtp_code),
             provider_reason = COALESCE($4, provider_reason),
             attempt_count = attempt_count + 1,
             updated_at = now(),
             accepted_at  = CASE WHEN $2 = 'accepted'  THEN now() ELSE accepted_at  END,
             bounced_at   = CASE WHEN $2 = 'bounced'   THEN now() ELSE bounced_at   END,
             complained_at= CASE WHEN $2 = 'complaint' THEN now() ELSE complained_at END
       WHERE id = $1`,
      [id, status, truncate(smtpCode, 32), truncate(providerReason, 240)],
    )
  } catch (err) {
    console.warn('[emailDeliveryStore] updateDeliveryStatus failed:', err?.message || err)
  }
}

function truncate(value, max) {
  if (value == null) return null
  const s = String(value)
  return s.length > max ? s.slice(0, max) : s
}
