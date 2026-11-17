import { STUB_HOSTS } from '../config/stubSites'
import { analyticsReferrer, publicAnalyticsPath } from './analyticsPaths'
import { getActiveConsent } from './consent'
import { getSessionId } from './visitorId'

const UTM_SESSION_KEY = 'vortex_utm'
export type UtmParams = { source?: string; medium?: string; campaign?: string; content?: string; term?: string }
type Attribution = { sessionId?: string; first: UtmParams; last: UtmParams; landingPath?: string; referrer?: string }
const VORTEX_HOSTS = ['vortexathletics.com', ...STUB_HOSTS]
const UTM_KEYS = ['source', 'medium', 'campaign', 'content', 'term'] as const
const GOOGLE_SOURCE = /^google(?:[ _-]?(?:ads|adwords))?$/i
const GOOGLE_PAID_MEDIUM = /^(?:cpc|ppc|cpm|cpv|display|paid(?:[ _-]?(?:search|display|video))?)$/i

export function acquisitionReferrer(origin?: string) {
  if (!origin) return undefined
  try {
    const url = new URL(origin)
    const excludedHosts = [...VORTEX_HOSTS, 'stripe.com', 'stripe.network', 'link.com']
    if (!['http:', 'https:'].includes(url.protocol) || excludedHosts.some(host =>
      url.hostname === host || url.hostname.endsWith(`.${host}`))) return undefined
    return url.origin
  } catch {
    return undefined
  }
}

export function parseUtmFromSearch(search: string): UtmParams {
  const params = new URLSearchParams(search)
  const utm: UtmParams = {}
  for (const key of UTM_KEYS) {
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
  const incoming = parseUtmFromSearch(search)
  const params = new URLSearchParams(search)
  const fromGoogleAd = ['gclid', 'gbraid', 'wbraid'].some(key => Boolean(params.get(key)?.trim()))
  if (fromGoogleAd && (!incoming.source || GOOGLE_SOURCE.test(incoming.source)) &&
    (!incoming.medium || GOOGLE_PAID_MEDIUM.test(incoming.medium))) {
    incoming.source ??= 'google'
    incoming.medium ??= 'cpc'
  }
  const safePath = publicAnalyticsPath(path)
  const capture = JSON.stringify([sessionId, safePath, incoming])
  if (capture === lastCapture) return
  // An SPA route keeps its document's original referrer after navigation.
  const referrer = lastCapture ? undefined : acquisitionReferrer(analyticsReferrer())
  lastCapture = capture
  const hasCampaign = Object.keys(incoming).length > 0
  const newTouch = Boolean(referrer) || (hasCampaign && UTM_KEYS.some(key => incoming[key] !== existing.last[key]))
  touch = {
    sessionId,
    landingPath: existing.landingPath ?? safePath,
    referrer: newTouch ? referrer : acquisitionReferrer(existing.referrer),
    first: Object.keys(existing.first).length ? existing.first : incoming,
    last: newTouch ? incoming : existing.last,
  }
  try { sessionStorage.setItem(UTM_SESSION_KEY, JSON.stringify(touch)) } catch { /* storage may be unavailable */ }
}

export function getAttributionPayload() {
  const consent = getActiveConsent()
  const sessionId = consent.analytics ? getSessionId(true) : null
  if (!sessionId) return {}
  const { last, landingPath } = getStoredUtm(sessionId)
  return {
    utmSource: last.source,
    utmMedium: last.medium,
    utmCampaign: last.campaign,
    utmContent: last.content,
    utmTerm: last.term,
    landingPage: landingPath,
    hostname: window.location.hostname,
  }
}
