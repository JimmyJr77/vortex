import { GA_MEASUREMENT_ID } from '../config/googleAnalytics'
import { STUB_HOSTS } from '../config/stubSites'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

const LINKER_DOMAINS = [
  'vortexathletics.com',
  'vortex-gymnastics.com',
  ...STUB_HOSTS,
]

/** Default deny until user consents (Consent Mode v2). */
export const initGoogleAnalyticsConsent = () => {
  if (typeof window.gtag !== 'function') return
  window.gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500,
  })
}

export const updateGoogleConsent = (analytics: boolean, marketing: boolean) => {
  if (typeof window.gtag !== 'function') return
  window.gtag('consent', 'update', {
    analytics_storage: analytics ? 'granted' : 'denied',
    ad_storage: marketing ? 'granted' : 'denied',
    ad_user_data: marketing ? 'granted' : 'denied',
    ad_personalization: marketing ? 'granted' : 'denied',
  })
}

/** Preserve client id when visitors move between Vortex domains (hub, gymnastics, stubs). */
export const initGoogleAnalyticsLinker = () => {
  if (typeof window.gtag !== 'function') return
  window.gtag('set', 'linker', { domains: LINKER_DOMAINS })
}

const isPreviewNoIndex = (): boolean => {
  const robots = document.querySelector('meta[name="robots"]')?.getAttribute('content') ?? ''
  return robots.includes('noindex')
}

/** Send a virtual page view for client-side route changes (SPA). */
export const trackGooglePageView = (path: string) => {
  if (typeof window.gtag !== 'function' || isPreviewNoIndex()) return

  const pagePath = path.startsWith('/') ? path : `/${path}`
  window.gtag('config', GA_MEASUREMENT_ID, {
    page_path: pagePath,
  })

  // Mirror the virtual page view into the dataLayer so GTM tags can fire on
  // SPA route changes via a Custom Event trigger on "spa_page_view".
  window.dataLayer?.push({
    event: 'spa_page_view',
    page_path: pagePath,
    page_location: window.location.origin + pagePath,
    page_title: document.title,
  })
}

export const trackGoogleEvent = (
  eventName: string,
  params?: Record<string, unknown>,
) => {
  if (typeof window.gtag !== 'function' || isPreviewNoIndex()) return
  window.gtag('event', eventName, params ?? {})
}

/**
 * Push a named event into the GTM dataLayer so container tags (Google Ads
 * conversions, remarketing, etc.) can fire on Custom Event triggers.
 * gtag('event', ...) calls are invisible to GTM triggers, so conversion-grade
 * events must go through here as well. Callers gate on analytics consent.
 */
export const pushGtmEvent = (eventName: string, params?: Record<string, unknown>) => {
  if (typeof window === 'undefined' || isPreviewNoIndex()) return
  window.dataLayer?.push({ event: eventName, ...(params ?? {}) })
}

const readCookie = (name: string): string | undefined => {
  if (typeof document === 'undefined') return undefined
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined
}

/** GA4 client id from the _ga cookie (e.g. "GA1.1.123.456" -> "123.456"). */
export const getGaClientId = (): string | undefined => {
  const raw = readCookie('_ga')
  if (!raw) return undefined
  const parts = raw.split('.')
  return parts.length >= 4 ? parts.slice(-2).join('.') : undefined
}

/**
 * GA4 session id from the property session cookie.
 *
 * Google currently emits both the older `GS1.1.<session>...` format and the
 * newer `GS2.1.s<session>$...` format. Supporting both keeps server-side
 * Measurement Protocol purchases joined to the originating browser session.
 */
export const getGaSessionId = (): string | undefined => {
  const raw = readCookie(`_ga_${GA_MEASUREMENT_ID.replace(/^G-/, '')}`)
  if (!raw) return undefined

  const gs2Session = raw.match(/(?:^|[.$])s(\d+)(?:\$|$)/)?.[1]
  if (gs2Session) return gs2Session

  const parts = raw.split('.')
  return parts.length >= 3 && /^\d+$/.test(parts[2]) ? parts[2] : undefined
}
