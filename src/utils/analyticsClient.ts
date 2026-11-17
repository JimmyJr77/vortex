import { getApiUrl } from './api'
import { CONSENT_CHANGED, getActiveConsent } from './consent'
import { getSessionId, getVisitorId, isStaffSession, refreshSessionCookie } from './visitorId'
import { clearAttribution, getStoredUtm } from './utmCapture'
import { trackGoogleEvent, trackGooglePageView } from './googleAnalytics'
import { analyticsReferrer, publicAnalyticsPath } from './analyticsPaths'

type TrackOptions = {
  properties?: Record<string, unknown>
  skipGoogle?: boolean
}

const pending: object[] = []
let flushTimer: ReturnType<typeof setTimeout> | undefined
let sending = false
let consentGeneration = 0
const MAX_BATCH = 8
const MAX_QUEUE = 80
const MAX_BEACON_BYTES = 8192
const BOOKING_CONFIRMATIONS_KEY = 'vortex:booking-confirmations'
const BOOKING_CONFIRMATION_TTL_MS = 90 * 24 * 60 * 60 * 1000

function newEventId(): string {
  if (crypto.randomUUID) return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 15) | 64
  bytes[8] = (bytes[8] & 63) | 128
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-')
}

export function trackEvent(eventName: string, path: string, options?: TrackOptions): string | undefined {
  if (typeof window === 'undefined' || isStaffSession()) return
  const consent = getActiveConsent()
  if (!consent.analytics) return
  const visitorId = getVisitorId(true)
  const sessionId = getSessionId(true)
  if (!visitorId || !sessionId) return
  refreshSessionCookie(true)

  const eventId = newEventId()
  const { last } = getStoredUtm(sessionId)
  pending.push({
    eventId,
    eventName,
    occurredAt: new Date().toISOString(),
    pagePath: publicAnalyticsPath(path),
    hostname: window.location.hostname.toLowerCase().replace(/^www\./, ''),
    visitorId,
    sessionId,
    referrer: analyticsReferrer(),
    consentAnalytics: true,
    consentMarketing: consent.marketing,
    properties: options?.properties ?? {},
    utm: Object.keys(last).length ? last : undefined,
  })
  if (pending.length > MAX_QUEUE) pending.splice(MAX_QUEUE)
  if (!options?.skipGoogle) trackGoogleEvent(eventName, path, options?.properties)

  if (pending.length >= MAX_BATCH) void flushEvents()
  else scheduleFlush()
  return eventId
}

/** Record a confirmed booking only once in this tab, even after a provider return/reload. */
export function trackConfirmation(name: string, path: string, id: string | number, properties?: Record<string, unknown>) {
  if (!id || !['string', 'number'].includes(typeof id)) return
  const key = `vortex:conversion:${name}:${id}`
  try {
    if (sessionStorage.getItem(key)) return
  } catch { /* storage can be unavailable */ }
  if (!trackEvent(name, path, { properties })) return
  try { sessionStorage.setItem(key, '1') } catch { /* storage can be unavailable */ }
  return true
}

/** Free trials and drop-ins share a booking ID, including after a payment return. */
export function trackBookingConfirmation(
  name: 'trial_confirmed' | 'drop_in_confirmed',
  path: string,
  id: number,
  properties?: Record<string, unknown>,
) {
  if (!Number.isSafeInteger(id) || id <= 0 || !getActiveConsent().analytics) return

  const record = () => {
    if (!getActiveConsent().analytics) return
    const now = Date.now()
    let confirmations: Record<string, number> = {}
    try {
      const saved = JSON.parse(localStorage.getItem(BOOKING_CONFIRMATIONS_KEY) ?? '{}')
      confirmations = Object.fromEntries(Object.entries(saved).filter((entry): entry is [string, number] =>
        typeof entry[1] === 'number' && entry[1] > now))
    } catch { /* fall back to tab storage */ }
    if (Object.hasOwn(confirmations, id) || !trackConfirmation(name, path, id, properties)) return
    confirmations[id] = now + BOOKING_CONFIRMATION_TTL_MS
    try { localStorage.setItem(BOOKING_CONFIRMATIONS_KEY, JSON.stringify(confirmations)) } catch { /* tab storage already recorded it */ }
  }

  // Serialize the read and write so simultaneous returns in different tabs cannot both count.
  if (navigator.locks) void navigator.locks.request(BOOKING_CONFIRMATIONS_KEY, record).catch(() => record())
  else record()
}

export function trackOutboundClickEvent(name: string, path: string, properties?: Record<string, unknown>) {
  trackEvent(name, path, { properties })
  void flushEvents({ useBeacon: true })
}

const programPaths = new Set([
  '/ninja', '/vortex-athletics', '/summer-athletic-training', '/fit-and-flip', '/gymnastics', '/adult-gymnastics', '/artistic-gymnastics',
  '/artistic-gymnastics-early', '/artistic-gymnastics-6-12', '/artistic-gymnastics-13-18', '/summer-camp-26',
  '/acro-gymnastics', '/rhythmic-gymnastics', '/trampoline-tumbling', '/aerobic-gymnastics',
])

export function trackPageViewEvent(path: string, deviceType: string): string | undefined {
  const eventId = trackEvent('page_view', path, { properties: { device_type: deviceType }, skipGoogle: true })
  if (!eventId) return
  if (programPaths.has(path)) trackEvent('program_page_view', path, { properties: { program_slug: path.slice(1) } })
  trackGooglePageView(path)
  return eventId
}

function clearFlushTimer() {
  if (flushTimer !== undefined) clearTimeout(flushTimer)
  flushTimer = undefined
}

function scheduleFlush(delay = 2000) {
  if (flushTimer !== undefined) return
  flushTimer = setTimeout(() => {
    flushTimer = undefined
    void flushEvents()
  }, delay)
}

function takeBatch() {
  const batch: object[] = []
  for (const ev of pending.slice(0, MAX_BATCH)) {
    const bytes = new Blob([JSON.stringify({ events: [...batch, ev] })]).size
    if (bytes > MAX_BEACON_BYTES && batch.length > 0) break
    batch.push(ev)
  }
  pending.splice(0, batch.length)
  return batch
}

export async function flushEvents({ useBeacon = false } = {}) {
  if (!getActiveConsent().analytics) {
    consentGeneration++
    clearFlushTimer()
    pending.length = 0
    return
  }
  if (!pending.length || (sending && !useBeacon)) return

  clearFlushTimer()
  const generation = consentGeneration
  const batch = takeBatch()
  const body = JSON.stringify({ events: batch })
  const url = `${getApiUrl()}/api/analytics/event`
  let retry = false
  if (!useBeacon) sending = true
  try {
    const blob = new Blob([body], { type: 'application/json' })
    if (!(useBeacon && blob.size <= MAX_BEACON_BYTES && navigator.sendBeacon?.(url, blob))) {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: useBeacon && blob.size <= MAX_BEACON_BYTES,
      })
      retry = response.status === 429 || response.status >= 500
    }
  } catch {
    retry = true
  } finally {
    if (!useBeacon) sending = false
  }
  if (generation !== consentGeneration) return
  if (retry && getActiveConsent().analytics) {
    pending.unshift(...batch)
    pending.splice(MAX_QUEUE)
  }
  if (pending.length && useBeacon && !retry) void flushEvents({ useBeacon: true })
  else if (pending.length) scheduleFlush(retry ? 15000 : 2000)
}

if (typeof window !== 'undefined') {
  window.addEventListener(CONSENT_CHANGED, () => {
    if (!getActiveConsent().analytics) {
      clearAttribution()
      try { localStorage.removeItem(BOOKING_CONFIRMATIONS_KEY) } catch { /* storage can be unavailable */ }
      void flushEvents()
    }
  })
}
