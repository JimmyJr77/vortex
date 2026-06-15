export const ENROLL_SITE_KEYS = ['athletics', 'gymnastics', 'basketball'] as const

export type EnrollSiteKey = (typeof ENROLL_SITE_KEYS)[number]

export const ENROLL_SITE_OPTIONS: ReadonlyArray<{ key: EnrollSiteKey; label: string }> = [
  { key: 'athletics', label: 'Show on vortexathletics.com/enroll' },
  { key: 'gymnastics', label: 'Show on vortex-gymnastics.com/enroll' },
  { key: 'basketball', label: 'Show on vortex-basketball.com/enroll' },
]

export const ALL_ENROLL_SITES: EnrollSiteKey[] = [...ENROLL_SITE_KEYS]

export const ENROLL_PATH = '/enroll'

export function isEnrollSiteKey(value: string): value is EnrollSiteKey {
  return (ENROLL_SITE_KEYS as readonly string[]).includes(value)
}

export function normalizeEnrollSites(
  sites: string[] | null | undefined,
  legacyActive?: boolean,
): EnrollSiteKey[] {
  if (Array.isArray(sites)) {
    return sites.filter(isEnrollSiteKey)
  }
  if (legacyActive) return [...ALL_ENROLL_SITES]
  return []
}

/** Read enroll sites from a program/form row; inactive rows always read as []. */
export function enrollSitesFromRecord(
  sites: string[] | null | undefined,
  active: boolean | undefined,
): EnrollSiteKey[] {
  if (active === false) return []
  if (Array.isArray(sites)) return sites.filter(isEnrollSiteKey)
  if (active) return [...ALL_ENROLL_SITES]
  return []
}
