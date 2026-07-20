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
