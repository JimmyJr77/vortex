import { useEffect, useRef, useSyncExternalStore } from 'react'
import { useLocation } from 'react-router-dom'
import { flushEvents, trackEvent, trackOutboundClickEvent, trackPageViewEvent } from '../../utils/analyticsClient'
import { publicAnalyticsPath } from '../../utils/analyticsPaths'
import { CONSENT_CHANGED, getActiveConsent } from '../../utils/consent'
import { PORTAL_SESSION_CHANGED } from '../../utils/portalSession'
import { captureUtmFromLocation } from '../../utils/utmCapture'
import { isStaffSession } from '../../utils/visitorId'

const initialPath = typeof window === 'undefined' ? '' : publicAnalyticsPath(window.location.pathname)
const idleLimit = 30_000
const milestones = [25, 50, 75, 90, 100]
let vitalsStarted = false

function subscribeEligibility(update: () => void) {
  const events = [CONSENT_CHANGED, PORTAL_SESSION_CHANGED, 'storage']
  events.forEach(event => window.addEventListener(event, update))
  return () => events.forEach(event => window.removeEventListener(event, update))
}

function canTrack() {
  return getActiveConsent().analytics && !isStaffSession()
}

function deviceType() {
  if (/iPad|Tablet/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
    (/Android/i.test(navigator.userAgent) && !/Mobile/i.test(navigator.userAgent))) return 'tablet'
  return /Mobi|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
}

function observeVitals(path: string, id: string, device: string, isCurrent: () => boolean) {
  // Browser Web Vitals belong to the document's initial navigation, not an SPA route.
  if (vitalsStarted || path !== initialPath) return
  vitalsStarted = true
  void import('web-vitals').then(({ onCLS, onFCP, onINP, onLCP, onTTFB }) => {
    const report = ({ name, value, navigationType }: { name: string; value: number; navigationType: string }) => {
      if (!isCurrent() || navigationType === 'back-forward-cache' || !Number.isFinite(value) || value < 0) return
      trackEvent('web_vital', path, {
        properties: { name, value: Math.round(value * 1000) / 1000, device_type: device, page_view_id: id },
        skipGoogle: true,
      })
    }
    const options = { reportAllChanges: true }
    onCLS(report, options)
    onINP(report, options)
    onLCP(report, options)
    onFCP(report)
    onTTFB(report)
  }).catch(() => { /* performance reporting is optional */ })
}

function trackClick(event: MouseEvent, path: string) {
  if (!(event.target instanceof Element)) return
  const tagged = event.target.closest<HTMLElement>('[data-analytics-cta]')
  const target = tagged?.dataset.analyticsCta
  if (target) trackEvent('cta_click', path, { properties: { target, section: tagged?.dataset.analyticsSection } })

  const link = event.target.closest<HTMLAnchorElement>('a[href]')
  const href = link?.getAttribute('href')
  if (!href) return
  if (/^tel:/i.test(href)) return trackOutboundClickEvent('phone_click', path, { target: 'phone' })
  if (/^mailto:/i.test(href)) return trackOutboundClickEvent('email_click', path, { target: 'email' })
  let url: URL
  try { url = new URL(href, window.location.href) } catch { return }
  if (!['https:', 'http:'].includes(url.protocol)) return
  if (link?.hasAttribute('data-analytics-directions') || /^maps\.google\.|^maps\.app\.goo\.gl$/.test(url.hostname)
    || ((url.hostname === 'www.google.com' || url.hostname === 'google.com') && url.pathname.startsWith('/maps'))) {
    return trackOutboundClickEvent('directions_click', path, { target: 'directions' })
  }
  if (url.origin !== window.location.origin) {
    trackOutboundClickEvent('outbound_click', path, { target: url.hostname })
  }
}

export default function PublicSiteAnalytics({ disabled = false }: { disabled?: boolean }) {
  const { pathname, search } = useLocation()
  const allowed = useSyncExternalStore(subscribeEligibility, canTrack, () => false) && !disabled
  const path = publicAnalyticsPath(pathname)
  const currentView = useRef<string | null>(null)
  const leftInitialRoute = useRef(false)

  useEffect(() => {
    if (path !== initialPath) leftInitialRoute.current = true
  }, [path])

  useEffect(() => {
    if (allowed) captureUtmFromLocation(path, search)
  }, [allowed, path, search])

  useEffect(() => {
    if (!allowed) return
    let teardown: (() => void) | undefined
    // Wait for the committed route and avoid a duplicate view from development StrictMode.
    const start = window.requestAnimationFrame(() => {
      const device = deviceType()
      const id = trackPageViewEvent(path, device)
      if (!id) return
      currentView.current = id
      if (!leftInitialRoute.current) observeVitals(path, id, device, () => currentView.current === id)

      let accumulated = 0
      let reported = 0
      let lastActivity = performance.now()
      let intervalStart: number | null = document.hidden ? null : lastActivity
      let scrollFrame = 0
      let milestoneIndex = 0

      const accumulate = (now: number) => {
        if (intervalStart === null) return
        accumulated += Math.max(0, Math.min(now, lastActivity + idleLimit) - intervalStart)
        intervalStart = now
      }
      const reportEngagement = () => {
        accumulate(performance.now())
        if (accumulated - reported < 1000) return
        reported = accumulated
        trackEvent('page_engagement', path, {
          properties: { engaged_ms: Math.round(accumulated), page_view_id: id },
          skipGoogle: true,
        })
      }
      const activity = () => {
        if (document.hidden) return
        const now = performance.now()
        accumulate(now)
        intervalStart ??= now
        lastActivity = now
      }
      const scroll = () => {
        activity()
        if (scrollFrame || document.hidden) return
        scrollFrame = requestAnimationFrame(() => {
          scrollFrame = 0
          const range = document.documentElement.scrollHeight - window.innerHeight
          if (range <= 0) return
          const percent = ((window.scrollY + 1) / range) * 100
          while (milestoneIndex < milestones.length && milestones[milestoneIndex] <= percent) {
            trackEvent('scroll_depth', path, {
              properties: { percent: milestones[milestoneIndex++], page_view_id: id },
              skipGoogle: true,
            })
          }
        })
      }

      const click = (event: MouseEvent) => trackClick(event, path)
      const hide = () => {
        reportEngagement()
        intervalStart = null
        void flushEvents({ useBeacon: true })
      }
      const visibility = () => { if (document.hidden) hide(); else activity() }
      // Keep the flush after performance observers' visibility handlers as well.
      const pageHide = () => hide()
      document.addEventListener('click', click, true)
      document.addEventListener('pointerdown', activity, { passive: true })
      document.addEventListener('keydown', activity)
      window.addEventListener('scroll', scroll, { passive: true })
      document.addEventListener('visibilitychange', visibility)
      window.addEventListener('pagehide', pageHide)
      window.addEventListener('pageshow', activity)
      const heartbeat = window.setInterval(reportEngagement, 15_000)
      teardown = () => {
        reportEngagement()
        currentView.current = null
        clearInterval(heartbeat)
        cancelAnimationFrame(scrollFrame)
        document.removeEventListener('click', click, true)
        document.removeEventListener('pointerdown', activity)
        document.removeEventListener('keydown', activity)
        window.removeEventListener('scroll', scroll)
        document.removeEventListener('visibilitychange', visibility)
        window.removeEventListener('pagehide', pageHide)
        window.removeEventListener('pageshow', activity)
      }
    })
    return () => {
      window.cancelAnimationFrame(start)
      teardown?.()
    }
  }, [allowed, path])

  return null
}
