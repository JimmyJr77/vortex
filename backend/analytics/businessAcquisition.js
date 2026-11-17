import { sanitizeAnalyticsPath, sanitizeCampaign, sanitizeHostname, sanitizeReferrer } from './eventContract.js'

const recordKinds = new Set(['inquiry', 'drop_in', 'store_order', 'enrollment_checkout'])
const paymentOrInternalHost = /(?:^|\.)(?:stripe\.(?:com|network)|link\.com|vortexathletics\.com|vortex-(?:gymnastics|basketball|football|soccer|track|lacrosse?|conditioning|fit|athlete|reps)\.com)$/

export function acquisitionCampaign(raw) {
  const { source, medium, campaign } = sanitizeCampaign(raw)
  const stripPhone = (value) => value && !/^[0-9 .-]{7,}$/.test(value) ? value : null
  return { source: stripPhone(source), medium: stripPhone(medium), campaign: stripPhone(campaign) }
}

export function acquisitionReferrerHost(value) {
  const origin = sanitizeReferrer(value)
  if (!origin) return null
  const hostname = sanitizeHostname(new URL(origin).hostname)
  return hostname && !paymentOrInternalHost.test(hostname) ? hostname : null
}

export function normalizeBusinessAcquisition(raw) {
  if (!raw || typeof raw !== 'object') return null
  const { source, medium, campaign } = acquisitionCampaign(raw)
  const referrerHost = acquisitionReferrerHost(raw.referrer)
  const landingPath = sanitizeAnalyticsPath(raw.landingPath)
  if (!source && !medium && !campaign && !referrerHost && !landingPath) return null
  return { source, medium, campaign, referrerHost, landingPath }
}

/** Call against the pool or after committing a booking. Checkout must survive an analytics failure. */
export async function recordBusinessAcquisition(db, kind, id, raw) {
  const recordId = typeof id === 'number' && Number.isSafeInteger(id) ? String(id) : id
  if (!recordKinds.has(kind) || typeof recordId !== 'string' || !/^[1-9][0-9]{0,18}$/.test(recordId)) return false
  const touch = normalizeBusinessAcquisition(raw)
  if (!touch) return false
  try {
    const result = await db.query(`
      INSERT INTO business_acquisition (record_kind, record_id, source, medium, campaign, referrer_host, landing_path)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (record_kind, record_id) DO NOTHING`,
    [kind, recordId, touch.source, touch.medium, touch.campaign, touch.referrerHost, touch.landingPath])
    return result.rowCount === 1
  } catch (error) {
    console.warn('[business acquisition] could not store source:', error.code || 'unknown')
    return false
  }
}
