/**
 * Annual membership validity is anniversary-based: valid for 1 year after purchase.
 */

/** Format a Date as UTC 'YYYY-MM-DD'. */
export function toUtcDateString(date) {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return null
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Add one calendar year in UTC, clamping Feb 29 → Feb 28 when needed.
 * @param {Date|string} purchasedAt
 * @returns {Date|null}
 */
export function membershipRenewsOnFromPurchase(purchasedAt) {
  const start = purchasedAt instanceof Date ? purchasedAt : new Date(purchasedAt)
  if (Number.isNaN(start.getTime())) return null
  const y = start.getUTCFullYear() + 1
  const m = start.getUTCMonth()
  const day = start.getUTCDate()
  const dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  return new Date(Date.UTC(y, m, Math.min(day, dim)))
}

/** True while now is strictly before the renews-on anniversary. */
export function isMembershipValidThrough(purchasedAt, now = new Date()) {
  const renewsOn = membershipRenewsOnFromPurchase(purchasedAt)
  if (!renewsOn) return false
  const asOf = now instanceof Date ? now : new Date(now)
  return renewsOn.getTime() > asOf.getTime()
}

export const ANNUAL_MEMBERSHIP_SOURCE_TYPE = 'annual_membership'
export const ANNUAL_MEMBERSHIP_PRICING_KEY = 'annual_membership'
