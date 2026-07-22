import { resolveStubSite } from '../config/stubSites'
import { ENROLL_PATH, type EnrollSiteKey } from '../config/enrollSites'

export function getCurrentEnrollSiteKey(): EnrollSiteKey {
  if (typeof window === 'undefined') return 'athletics'

  const stub = resolveStubSite(window.location.hostname, window.location.search)
  if (stub?.key === 'gymnastics') return 'gymnastics'
  if (stub?.key === 'basketball') return 'basketball'

  return 'athletics'
}

export type EnrollCatalogDefault =
  | { type: 'sport'; value: string }
  | { type: 'program'; value: string }

/** Initial catalog filter for each branded enroll page. Users can still change or clear it. */
export function getEnrollCatalogDefault(): EnrollCatalogDefault {
  const site = getCurrentEnrollSiteKey()
  if (site === 'gymnastics') return { type: 'sport', value: 'Gymnastics' }
  if (site === 'basketball') return { type: 'sport', value: 'Basketball' }
  return { type: 'program', value: 'Athleticism Accelerator' }
}

interface SiteEnrollHrefOptions {
  programName?: string
}

/** Header / CTA enroll link for the current site, with explicit initial catalog filters. */
export function getSiteEnrollHref(options: SiteEnrollHrefOptions = {}): string {
  if (typeof window === 'undefined') return ENROLL_PATH

  const { hostname, search } = window.location
  const params = new URLSearchParams()
  const site = getCurrentEnrollSiteKey()

  if (site === 'gymnastics') params.set('sportFilter', 'Gymnastics')
  if (site === 'basketball') params.set('sportFilter', 'Basketball')
  if (options.programName) params.set('program', options.programName)

  // Local dev preview uses ?sport=; preserve it when navigating to /enroll.
  if (import.meta.env.DEV && (hostname === 'localhost' || hostname === '127.0.0.1')) {
    const sport = new URLSearchParams(search).get('sport')
    if (sport) params.set('sport', sport)
  }

  const query = params.toString()
  return query ? `${ENROLL_PATH}?${query}` : ENROLL_PATH
}
