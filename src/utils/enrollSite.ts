import { resolveStubSite } from '../config/stubSites'
import { type EnrollSiteKey } from '../config/enrollSites'

export function getCurrentEnrollSiteKey(): EnrollSiteKey {
  if (typeof window === 'undefined') return 'athletics'

  const stub = resolveStubSite(window.location.hostname, window.location.search)
  if (stub?.key === 'gymnastics') return 'gymnastics'
  if (stub?.key === 'basketball') return 'basketball'

  return 'athletics'
}
