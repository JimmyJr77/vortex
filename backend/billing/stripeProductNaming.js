/**
 * Stripe Customer Portal product titles for per-class subscriptions.
 * Catalog products are shared across slots; dedicated names must include
 * class + day/time (+ athlete) so members can tell subscriptions apart.
 */

/** @param {{ classTitle?: string|null, scheduleLabel?: string|null, athleteName?: string|null }} parts */
export function formatPerClassStripeProductName({
  classTitle,
  scheduleLabel,
  athleteName,
} = {}) {
  const parts = [classTitle, scheduleLabel, athleteName]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
  return (parts.join(' · ') || 'Monthly class membership').slice(0, 200)
}

/** Prefer "Mondays 19:15–20:45" over "Monday 19:15–20:45" for recurring slots. */
export function pluralizeWeekdayLabel(scheduleLabel) {
  const label = String(scheduleLabel || '').trim()
  if (!label) return label
  return label
    .replace(/\bMonday\b/g, 'Mondays')
    .replace(/\bTuesday\b/g, 'Tuesdays')
    .replace(/\bWednesday\b/g, 'Wednesdays')
    .replace(/\bThursday\b/g, 'Thursdays')
    .replace(/\bFriday\b/g, 'Fridays')
    .replace(/\bSaturday\b/g, 'Saturdays')
    .replace(/\bSunday\b/g, 'Sundays')
}
