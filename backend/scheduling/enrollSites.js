export const ENROLL_SITE_KEYS = ['athletics', 'gymnastics', 'basketball']

export const ALL_ENROLL_SITES = [...ENROLL_SITE_KEYS]

export function isEnrollSiteKey(value) {
  return ENROLL_SITE_KEYS.includes(value)
}

export function normalizeEnrollSites(raw, legacyActive) {
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.filter(isEnrollSiteKey)
  }
  if (legacyActive) return [...ALL_ENROLL_SITES]
  return []
}

export function rowVisibleOnEnrollSite(rawSites, legacyActive, site) {
  if (!legacyActive) return false
  const sites = normalizeEnrollSites(rawSites, true)
  return sites.includes(site)
}

/** SQL fragment: row visible on enroll site bound to $siteParam (e.g. '$1'). */
export function enrollSiteVisibleSql({ sitesColumn, legacyColumn, siteParam }) {
  return `(
    (
      COALESCE(array_length(${sitesColumn}, 1), 0) > 0
      AND ${sitesColumn} @> ARRAY[${siteParam}]::text[]
    )
    OR (
      COALESCE(array_length(${sitesColumn}, 1), 0) = 0
      AND COALESCE(${legacyColumn}, FALSE) = TRUE
    )
  )`
}
