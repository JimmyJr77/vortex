import type { StubSiteConfig } from '../config/stubSites'
import { HUB_URL, STUB_SITES } from '../config/stubSites'
import { appendCrossDomainConsentId } from './crossDomainConsent'

const isLocalDevHost = (): boolean => {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  return host === 'localhost' || host === '127.0.0.1'
}

/** Production stub sport domain URL; localhost uses ?sport= for preview. */
export function getStubSportSiteUrl(sportKey: string, path = '/'): string {
  const entry = Object.values(STUB_SITES).find((s) => s.key === sportKey)
  if (!entry) return '/'

  const normalized = path.startsWith('/') ? path : `/${path}`

  if (import.meta.env.DEV && isLocalDevHost()) {
    if (normalized === '/') {
      return `/?sport=${sportKey}`
    }
    const separator = normalized.includes('?') ? '&' : '?'
    return `${normalized}${separator}sport=${sportKey}`
  }

  const base = `https://${entry.canonicalHost}`
  const url = normalized === '/' ? `${base}/` : `${base}${normalized}`
  return appendCrossDomainConsentId(url)
}

export const getSportBrandName = (sportLabel: string): string =>
  `Vortex ${sportLabel}`

/** Sport site home URL (production domain or current origin on that host). */
export const getSportHomeUrl = (config: StubSiteConfig): string => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname.replace(/^www\./, '')
    if (host === config.canonicalHost) {
      return `${window.location.origin}/`
    }
  }
  return `https://${config.canonicalHost}/`
}

export { HUB_URL }

export const SPORT_SITE_CONTEXT_KEY = 'vortex_sport_site'

export const setSportSiteContext = (sportKey: string): void => {
  localStorage.setItem(SPORT_SITE_CONTEXT_KEY, sportKey)
}

export const clearSportSiteContext = (): void => {
  localStorage.removeItem(SPORT_SITE_CONTEXT_KEY)
}
