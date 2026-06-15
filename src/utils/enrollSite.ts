import { resolveStubSite } from '../config/stubSites'
import { ENROLL_PATH, type EnrollSiteKey } from '../config/enrollSites'

export function getCurrentEnrollSiteKey(): EnrollSiteKey {
  if (typeof window === 'undefined') return 'athletics'

  const stub = resolveStubSite(window.location.hostname, window.location.search)
  if (stub?.key === 'gymnastics') return 'gymnastics'
  if (stub?.key === 'basketball') return 'basketball'

  return 'athletics'
}

/** Header / CTA enroll link for the current site (same-origin `/enroll`, site filter via hostname). */
export function getSiteEnrollHref(): string {
  if (typeof window === 'undefined') return ENROLL_PATH

  const { hostname, search } = window.location

  // Local dev preview uses ?sport=; preserve it when navigating to /enroll.
  if (import.meta.env.DEV && (hostname === 'localhost' || hostname === '127.0.0.1')) {
    const sport = new URLSearchParams(search).get('sport')
    if (sport) return `${ENROLL_PATH}?sport=${encodeURIComponent(sport)}`
  }

  return ENROLL_PATH
}
