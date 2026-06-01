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
}
