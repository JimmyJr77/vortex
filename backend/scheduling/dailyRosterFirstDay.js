import { expandCalendarRange } from './calendarExpansion.js'

function dateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null
}

/**
 * Mark the first scheduled day of each member's enrollment in its class.
 * Input dates are PostgreSQL date strings, not signup creation timestamps.
 * Expand the complete interval through the report date so a distant offering
 * start is supported without imposing a fixed look-ahead horizon.
 */
export function firstDayBySignup(calendarRows, signups, reportDate) {
  const result = new Map(signups.map(signup => [Number(signup.id), false]))
  if (!dateOnly(reportDate)) return result
  const groups = new Map()
  for (const row of calendarRows) {
    const key = `${Number(row.form_id)}:${Number(row.slot_group_id)}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  const firstDates = new Map()
  for (const signup of signups) {
    const startDate = dateOnly(signup.enrollment_start_date)
    if (signup.member_id == null || !startDate || startDate > reportDate
      || signup.form_id == null || signup.slot_group_id == null) continue
    const groupKey = `${Number(signup.form_id)}:${Number(signup.slot_group_id)}`
    const rows = groups.get(groupKey)
    if (!rows?.length) continue
    const cacheKey = `${groupKey}:${startDate}`
    if (!firstDates.has(cacheKey)) {
      // Keep every slot in expansion: selecting only one slot beforehand would
      // turn an A/B rotation into a weekly schedule for that selected letter.
      const { events } = expandCalendarRange({ startDate, endDate: reportDate, rows })
      const dates = new Map()
      for (const event of events) {
        if (!event.formActive || !event.classActive || !event.slotGroupActive || !event.slotActive) continue
        if (!dates.has(null)) dates.set(null, event.date)
        if (!dates.has(event.timeSlotId)) dates.set(event.timeSlotId, event.date)
      }
      firstDates.set(cacheKey, dates)
    }
    const slot = signup.time_slot_id == null ? null : Number(signup.time_slot_id)
    result.set(Number(signup.id), firstDates.get(cacheKey).get(slot) === reportDate)
  }
  return result
}
