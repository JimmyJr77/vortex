import { getApiUrl } from './api'
import { getActiveConsent } from './consent'
import { getSessionId, getVisitorId, isStaffSession, refreshSessionCookie } from './visitorId'
import { getStoredUtm } from './utmCapture'
import { trackGoogleEvent, trackGooglePageView } from './googleAnalytics'

type TrackOptions = {
  properties?: Record<string, unknown>
  skipGoogle?: boolean
}

const pending: object[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null

/** Browsers cap total in-flight keepalive/beacon data at 64KB (shared with Cloudflare RUM, etc.). */
const MAX_BEACON_BYTES = 8192
const MAX_PENDING_BEFORE_FLUSH = 8

type FlushOptions = {
  /** Use keepalive transport (page unload). Omit for normal background flush via fetch. */
  useBeacon?: boolean
}

const newEventId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

const buildEvent = (eventName: string, pagePath: string, options?: TrackOptions) => {
  const consent = getActiveConsent()
  const allowAnalytics = consent.analytics
  const visitorId = getVisitorId(allowAnalytics) || 'anonymous'
  const sessionId = getSessionId(allowAnalytics) || visitorId
  if (allowAnalytics) refreshSessionCookie(true)

  const { last } = getStoredUtm()

  return {
    eventId: newEventId(),
    eventName,
    occurredAt: new Date().toISOString(),
    pagePath,
    hostname: typeof window !== 'undefined' ? window.location.hostname : '',
    visitorId,
    sessionId,
    referrer: typeof document !== 'undefined' ? document.referrer || undefined : undefined,
    consentAnalytics: allowAnalytics,
    consentMarketing: consent.marketing,
    isStaff: isStaffSession(),
    properties: options?.properties ?? {},
    utm: Object.keys(last).length ? last : undefined,
  }
}

export const trackEvent = (eventName: string, pagePath: string, options?: TrackOptions) => {
  const consent = getActiveConsent()
  const ev = buildEvent(eventName, pagePath, options)
  pending.push(ev)

  if (consent.analytics && !options?.skipGoogle) {
    trackGoogleEvent(eventName, options?.properties)
  }

  if (pending.length >= MAX_PENDING_BEFORE_FLUSH) {
    void flushEvents()
  } else {
    scheduleFlush()
  }
}

/** Track an outbound link click and flush immediately so the event survives navigation. */
export const trackOutboundClickEvent = (
  eventName: string,
  pagePath: string,
  properties?: Record<string, unknown>,
) => {
  trackEvent(eventName, pagePath, { properties })
  void flushEvents({ useBeacon: true })
}

export const trackPageViewEvent = (path: string, options?: { googleAnalytics?: boolean }) => {
  const consent = getActiveConsent()
  trackEvent('page_view', path, { skipGoogle: true })

  const programPaths = [
    '/ninja',
    '/vortex-athletics',
    '/summer-athletic-training',
    '/strength-conditioning',
    '/gymnastics',
    '/artistic-gymnastics',
    '/artistic-gymnastics-early',
    '/artistic-gymnastics-6-12',
    '/artistic-gymnastics-13-18',
    '/summer-camp-26',
    '/acro-gymnastics',
    '/rhythmic-gymnastics',
    '/trampoline-tumbling',
    '/aerobic-gymnastics',
    '/enroll',
    '/scheduling',
  ]
  if (programPaths.some((p) => path === p || path.startsWith(`${p}/`))) {
    trackEvent('program_page_view', path, {
      properties: { program_slug: path.split('/').filter(Boolean)[0] },
    })
  }

  if (options?.googleAnalytics !== false && consent.analytics) {
    trackGooglePageView(path)
  }
}

const scheduleFlush = () => {
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    void flushEvents()
  }, 2000)
}

function takeBeaconBatch(events: object[]): object[] {
  const batch: object[] = []
  for (const ev of events) {
    const candidate = [...batch, ev]
    const size = JSON.stringify({ events: candidate }).length
    if (size > MAX_BEACON_BYTES && batch.length > 0) break
    batch.push(ev)
    if (size >= MAX_BEACON_BYTES) break
  }
  return batch
}

export const flushEvents = async (options?: FlushOptions) => {
  if (!pending.length) return
  const consent = getActiveConsent()

  const useBeacon = options?.useBeacon === true
  let batch: object[]
  if (useBeacon) {
    batch = takeBeaconBatch(pending)
    pending.splice(0, batch.length)
  } else {
    batch = pending.splice(0, pending.length)
  }

  if (!batch.length) return

  if (!consent.analytics && batch.every((e: { consentAnalytics?: boolean }) => !e.consentAnalytics)) {
    return
  }

  const body = JSON.stringify({ events: batch })
  const url = `${getApiUrl()}/api/analytics/event`

  try {
    if (useBeacon && navigator.sendBeacon && body.length <= MAX_BEACON_BYTES) {
      const ok = navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))
      if (ok) {
        if (pending.length > 0) void flushEvents({ useBeacon: true })
        return
      }
    }
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: useBeacon,
    })
    if (useBeacon && pending.length > 0) void flushEvents({ useBeacon: true })
  } catch (e) {
    console.warn('[analytics] flush failed', e)
    pending.unshift(...batch)
  }
}
