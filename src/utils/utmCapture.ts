import { publicAnalyticsPath } from './analyticsPaths'
import { getActiveConsent } from './consent'
import { getSessionId } from './visitorId'

const UTM_SESSION_KEY = 'vortex_utm'
export type UtmParams = { source?: string; medium?: string; campaign?: string; content?: string; term?: string }
type Attribution = { sessionId?: string; first: UtmParams; last: UtmParams; landingPath?: string }

export function parseUtmFromSearch(search: string): UtmParams {
  const params = new URLSearchParams(search)
  const utm: UtmParams = {}
  for (const key of ['source', 'medium', 'campaign', 'content', 'term'] as const) {
    const value = params.get(`utm_${key}`)?.trim()
    // Campaign labels only; reject common forms of personal data or full URLs.
    if (value && /^[\p{L}\p{N} _.,+()-]{1,100}$/u.test(value) && !/^\+?[\d ().-]{7,}$/.test(value)) {
      utm[key] = value
    }
  }
  return utm
}

let lastCapture = ''
let touch: Attribution = { first: {}, last: {} }

export function clearAttribution() {
  touch = { first: {}, last: {} }
  lastCapture = ''
  try { sessionStorage.removeItem(UTM_SESSION_KEY) } catch { /* storage may be unavailable */ }
}

export function getStoredUtm(sessionId: string): Attribution {
  if (touch.sessionId === sessionId) return touch
  try {
    const raw = sessionStorage.getItem(UTM_SESSION_KEY)
    if (raw) {
      const value = JSON.parse(raw) as Attribution
      if (value.sessionId === sessionId) return value
    }
  } catch { /* storage may be unavailable */ }
  return { first: {}, last: {} }
}

export function captureUtmFromLocation(path: string, search: string) {
  if (!getActiveConsent().analytics) return
  const sessionId = getSessionId(true)
  if (!sessionId) return
  const existing = getStoredUtm(sessionId)
  const capture = `${sessionId}:${path}:${search}`
  if (capture === lastCapture) return
  lastCapture = capture
  const incoming = parseUtmFromSearch(search)
  const hasCampaign = Object.keys(incoming).length > 0
  touch = {
    sessionId,
    landingPath: existing.landingPath ?? publicAnalyticsPath(path),
    first: Object.keys(existing.first).length ? existing.first : incoming,
    last: hasCampaign ? incoming : existing.last,
  }
  try { sessionStorage.setItem(UTM_SESSION_KEY, JSON.stringify(touch)) } catch { /* storage may be unavailable */ }
}

export function getAttributionPayload() {
  const consent = getActiveConsent()
  const sessionId = consent.analytics ? getSessionId(true) : null
  if (!sessionId) return {}
  const { first, last, landingPath } = getStoredUtm(sessionId)
  return {
    utmSource: last.source ?? first.source,
    utmMedium: last.medium ?? first.medium,
    utmCampaign: last.campaign ?? first.campaign,
    utmContent: last.content ?? first.content,
    utmTerm: last.term ?? first.term,
    landingPage: landingPath,
    hostname: window.location.hostname,
  }
}
