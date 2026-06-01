import type { StubSiteConfig } from '../config/stubSites'
import { HUB_URL } from '../config/stubSites'

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
