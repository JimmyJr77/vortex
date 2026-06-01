import crypto from 'crypto'

export const ANALYTICS_POLICY_VERSION = '2026-06-01'

const PII_PROPERTY_KEYS = new Set([
  'email',
  'firstName',
  'first_name',
  'lastName',
  'last_name',
  'phone',
  'message',
  'childAge',
  'child_age',
  'childAges',
  'child_ages',
  'athleteAge',
  'athlete_age',
])

export function parseDateRange(query) {
  const to = query.to ? new Date(query.to) : new Date()
  const from = query.from
    ? new Date(query.from)
    : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return null
  }
  to.setHours(23, 59, 59, 999)
  from.setHours(0, 0, 0, 0)
  return { from, to }
}

export function stripEventProperties(properties) {
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
    return {}
  }
  const clean = {}
  for (const [key, value] of Object.entries(properties)) {
    if (PII_PROPERTY_KEYS.has(key)) continue
    if (typeof value === 'string' && value.length > 500) continue
    clean[key] = value
  }
  return clean
}

export function hashEmail(email) {
  if (!email) return null
  const normalized = String(email).trim().toLowerCase()
  return crypto.createHash('sha256').update(normalized).digest('hex')
}

export function normalizeLeadStatus(row) {
  if (row.lead_status) return row.lead_status
  if (row.contacted) return 'contacted'
  return 'new'
}

export function hostnameFilterClause(query, paramIndex, alias = '') {
  const host = query.hostname
  if (!host || host === 'all') return { clause: '', params: [], nextIndex: paramIndex }
  const col = alias ? `${alias}hostname` : 'hostname'
  return {
    clause: ` AND ${col} = $${paramIndex}`,
    params: [host],
    nextIndex: paramIndex + 1,
  }
}

export async function logAudit(pool, { adminUserId, action, details }) {
  try {
    await pool.query(
      `INSERT INTO audit_log (admin_user_id, action, details) VALUES ($1, $2, $3)`,
      [adminUserId ?? null, action, details ? JSON.stringify(details) : null],
    )
  } catch (e) {
    console.warn('[audit_log]', e.message)
  }
}

export async function upsertVisitorSession(pool, event) {
  const {
    sessionId,
    visitorId,
    pagePath,
    hostname,
    referrer,
    utm,
    isStaff,
    occurredAt,
  } = event

  const existing = await pool.query(
    `SELECT id, landing_path, utm_source FROM visitor_sessions WHERE session_id = $1`,
    [sessionId],
  )

  if (existing.rows.length === 0) {
    await pool.query(
      `INSERT INTO visitor_sessions (
        session_id, visitor_id, started_at, landing_path, referrer,
        utm_source, utm_medium, utm_campaign, hostname, is_staff
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        sessionId,
        visitorId,
        occurredAt,
        pagePath,
        referrer || null,
        utm?.source || null,
        utm?.medium || null,
        utm?.campaign || null,
        hostname || null,
        !!isStaff,
      ],
    )
    return
  }

  await pool.query(
    `UPDATE visitor_sessions SET ended_at = $2, updated_at = now() WHERE session_id = $1`,
    [sessionId, occurredAt],
  )
}

export async function recordUtmAttribution(pool, {
  visitorId,
  inquiryId,
  touchType,
  utm,
  landingPage,
}) {
  if (!utm && !landingPage) return
  await pool.query(
    `INSERT INTO utm_attribution (
      visitor_id, inquiry_id, touch_type, source, medium, campaign, content, term, landing_page, click_ids
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      visitorId || null,
      inquiryId || null,
      touchType,
      utm?.source || null,
      utm?.medium || null,
      utm?.campaign || null,
      utm?.content || null,
      utm?.term || null,
      landingPage || null,
      utm?.clickIds ? JSON.stringify(utm.clickIds) : null,
    ],
  )
}
