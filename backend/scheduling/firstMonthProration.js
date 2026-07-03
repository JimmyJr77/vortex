import { expandCalendarRange } from './calendarExpansion.js'

// First-month proration: billing cycles renew on the 1st of the month, and the
// first (partial) month is charged as netMonthly * min(remainingSessions, 4) / 4,
// where remainingSessions counts the class's real calendar occurrences from the
// signup date through the end of the current month.

export const CLASSES_PER_MONTH = 4

/** How far ahead to look for a class's first occurrence when none remain this month. */
const FUTURE_START_HORIZON_MONTHS = 18

function pad2(n) {
  return String(n).padStart(2, '0')
}

/** Server-local date as YYYY-MM-DD. Single hook for a future facility-timezone swap. */
export function todayDateOnly(now = new Date()) {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
}

export function monthBounds(dateStr) {
  const [y, m] = dateStr.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  return {
    monthStart: `${y}-${pad2(m)}-01`,
    monthEnd: `${y}-${pad2(m)}-${pad2(lastDay)}`,
  }
}

export function firstOfMonth(dateStr) {
  const [y, m] = dateStr.split('-').map(Number)
  return `${y}-${pad2(m)}-01`
}

export function firstOfNextMonth(dateStr) {
  const [y, m] = dateStr.split('-').map(Number)
  const nextY = m === 12 ? y + 1 : y
  const nextM = m === 12 ? 1 : m + 1
  return `${nextY}-${pad2(nextM)}-01`
}

function addMonths(dateStr, months) {
  const [y, m] = dateStr.split('-').map(Number)
  const total = y * 12 + (m - 1) + months
  return `${Math.floor(total / 12)}-${pad2((total % 12) + 1)}-01`
}

function rowsForGroup(calendarRows, slotGroupId) {
  if (slotGroupId == null) return []
  return calendarRows.filter((r) => Number(r.slot_group_id) === Number(slotGroupId))
}

function occurrenceDatesInRange(rows, { startDate, endDate, timeSlotId = null }) {
  const expanded = expandCalendarRange({ startDate, endDate, rows, site: 'athletics' })
  let events = expanded.events || []
  if (timeSlotId != null) {
    events = events.filter((e) => Number(e.timeSlotId) === Number(timeSlotId))
  }
  return events.map((e) => e.date).sort()
}

/** Occurrences of a slot from `fromDate` (inclusive) through the end of that month. */
export function remainingOccurrencesInMonth(calendarRows, { slotGroupId, timeSlotId = null, fromDate }) {
  const rows = rowsForGroup(calendarRows, slotGroupId)
  if (rows.length === 0) return 0
  const { monthEnd } = monthBounds(fromDate)
  return occurrenceDatesInRange(rows, { startDate: fromDate, endDate: monthEnd, timeSlotId }).length
}

/** Earliest scheduled occurrence on or after `fromDate`, within the search horizon. */
export function firstOccurrenceOnOrAfter(calendarRows, { slotGroupId, timeSlotId = null, fromDate }) {
  const rows = rowsForGroup(calendarRows, slotGroupId)
  if (rows.length === 0) return null
  const searchEnd = addMonths(fromDate, FUTURE_START_HORIZON_MONTHS)
  const dates = occurrenceDatesInRange(rows, { startDate: fromDate, endDate: searchEnd, timeSlotId })
  return dates[0] ?? null
}

/** @deprecated use firstOccurrenceOnOrAfter */
export function nextOccurrenceAfterMonth(calendarRows, { slotGroupId, timeSlotId = null, fromDate }) {
  return firstOccurrenceOnOrAfter(calendarRows, {
    slotGroupId,
    timeSlotId,
    fromDate: firstOfNextMonth(fromDate),
  })
}

function isTbd(rows) {
  return rows.length > 0 && rows.every((r) => Boolean(r.dates_tbd) || Boolean(r.sg_dates_tbd))
}

/**
 * Proration decision for one signup line.
 *
 * Returns:
 * - remainingClasses: billable class count for the first service month (current month
 *   when classes remain now, otherwise the month the schedule begins)
 * - ratio: fraction of the monthly rate due for that first month (0..1)
 * - classStartsFutureMonth: true when the first service month is after the signup month
 * - firstBillDate: when the next full monthly bill posts (always a 1st of month)
 * - firstServicePeriodStart/End: service window covered by the first prorated charge
 */
export function prorationForLine(calendarRows, { slotGroupId, timeSlotId = null, fromDate }) {
  const rows = rowsForGroup(calendarRows, slotGroupId)
  const fallback = {
    remainingClasses: null,
    ratio: 1,
    classStartsFutureMonth: false,
    firstBillDate: firstOfNextMonth(fromDate),
    firstServicePeriodStart: fromDate,
    firstServicePeriodEnd: monthBounds(fromDate).monthEnd,
  }
  // No schedule data or dates TBD: proration is unknowable, charge the full month.
  if (rows.length === 0 || isTbd(rows)) return fallback

  const signupMonthStart = firstOfMonth(fromDate)
  const remainingThisMonth = remainingOccurrencesInMonth(calendarRows, { slotGroupId, timeSlotId, fromDate })
  if (remainingThisMonth > 0) {
    const { monthEnd } = monthBounds(fromDate)
    return {
      remainingClasses: remainingThisMonth,
      ratio: Math.min(remainingThisMonth, CLASSES_PER_MONTH) / CLASSES_PER_MONTH,
      classStartsFutureMonth: false,
      firstBillDate: firstOfNextMonth(fromDate),
      firstServicePeriodStart: fromDate,
      firstServicePeriodEnd: monthEnd,
    }
  }

  const firstDate = firstOccurrenceOnOrAfter(calendarRows, { slotGroupId, timeSlotId, fromDate })
  if (!firstDate) {
    return {
      remainingClasses: 0,
      ratio: 0,
      classStartsFutureMonth: false,
      firstBillDate: firstOfNextMonth(fromDate),
      firstServicePeriodStart: fromDate,
      firstServicePeriodEnd: monthBounds(fromDate).monthEnd,
    }
  }

  const { monthEnd: firstMonthEnd } = monthBounds(firstDate)
  const firstMonthRemaining = occurrenceDatesInRange(rows, {
    startDate: firstDate,
    endDate: firstMonthEnd,
    timeSlotId,
  }).length
  if (firstMonthRemaining <= 0) {
    return {
      remainingClasses: 0,
      ratio: 0,
      classStartsFutureMonth: firstOfMonth(firstDate) > signupMonthStart,
      firstBillDate: firstOfMonth(firstDate),
      firstServicePeriodStart: firstDate,
      firstServicePeriodEnd: firstMonthEnd,
    }
  }

  const firstServiceMonthStart = firstOfMonth(firstDate)
  const classStartsFutureMonth = firstServiceMonthStart > signupMonthStart
  return {
    remainingClasses: firstMonthRemaining,
    ratio: Math.min(firstMonthRemaining, CLASSES_PER_MONTH) / CLASSES_PER_MONTH,
    classStartsFutureMonth,
    // Future-start enrollments bill the full month on the 1st of the service month;
    // ongoing mid-month signups bill the prorated remainder now and renew on the next 1st.
    firstBillDate: classStartsFutureMonth ? firstServiceMonthStart : firstOfNextMonth(fromDate),
    firstServicePeriodStart: firstDate,
    firstServicePeriodEnd: firstMonthEnd,
  }
}
