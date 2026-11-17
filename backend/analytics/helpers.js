import crypto from 'crypto'

export const ANALYTICS_POLICY_VERSION = '2026-06-01'

const reportDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
})
const reportOffset = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', timeZoneName: 'longOffset',
})
const calendarDate = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 86400000

function midnightAtFacility(day) {
  const probe = new Date(day + 'T05:00:00Z')
  if (!Number.isFinite(probe.getTime()) || probe.toISOString().slice(0, 10) !== day) return new Date(NaN)
  // US daylight saving changes occur after midnight. 05:00 UTC is before either change.
  const offset = reportOffset.formatToParts(probe).find(({ type }) => type === 'timeZoneName').value.slice(3)
  return new Date(day + 'T00:00:00' + offset)
}

export function parseDateRange(query) {
  const toDay = typeof query.to === 'string' && calendarDate.test(query.to) ? query.to : null
  let to = query.to ? new Date(query.to) : new Date()
  if (!Number.isFinite(to.getTime())) return null
  if (!query.to || toDay) {
    const day = toDay || reportDay.format(to)
    if (!Number.isFinite(midnightAtFacility(day).getTime())) return null
    const tomorrow = new Date(Date.parse(day + 'T00:00:00Z') + DAY_MS).toISOString().slice(0, 10)
    to = new Date(midnightAtFacility(tomorrow).getTime() - 1)
  }

  const fallbackFrom = new Date(Date.parse(reportDay.format(to) + 'T00:00:00Z') - 29 * DAY_MS)
  const from = query.from
    ? calendarDate.test(query.from) ? midnightAtFacility(query.from) : new Date(query.from)
    : midnightAtFacility(fallbackFrom.toISOString().slice(0, 10))
  return Number.isFinite(from.getTime()) && from <= to ? { from, to } : null
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
