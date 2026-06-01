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

  scheduleFlush()
}

export const trackPageViewEvent = (path: string, options?: { googleAnalytics?: boolean }) => {
  const consent = getActiveConsent()
  trackEvent('page_view', path, { skipGoogle: true })

  const programPaths = [
    '/ninja',
    '/athleticism-accelerator',
    '/strength-conditioning',
    '/gymnastics',
    '/artistic-gymnastics',
    '/artistic-gymnastics-early',
    '/artistic-gymnastics-6-12',
    '/artistic-gymnastics-13-18',
    '/rhythmic-gymnastics',
    '/trampoline-tumbling',
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
    flushEvents()
  }, 2000)
}

export const flushEvents = async () => {
  if (!pending.length) return
  const batch = pending.splice(0, pending.length)
  const consent = getActiveConsent()
  if (!consent.analytics && batch.every((e: { consentAnalytics?: boolean }) => !e.consentAnalytics)) {
    return
  }

  const body = JSON.stringify({ events: batch })
  const url = `${getApiUrl()}/api/analytics/event`

  try {
    if (navigator.sendBeacon) {
      const ok = navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))
      if (ok) return
    }
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
  } catch (e) {
    console.warn('[analytics] flush failed', e)
    pending.unshift(...batch)
  }
}

// Remove crypto v4 import - I used crypto.randomUUID instead, fix the import at top