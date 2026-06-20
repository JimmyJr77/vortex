/** Average weeks per calendar month (52 / 12). */
export const WEEKS_PER_MONTH = 52 / 12

/** Parse Postgres TIME / string into minutes from midnight. */
export function parseTimeToMinutes(time) {
  if (time == null) return 0
  if (time instanceof Date) {
    return time.getUTCHours() * 60 + time.getUTCMinutes() + time.getUTCSeconds() / 60
  }
  const str = String(time).trim()
  const parts = str.split(':').map((p) => Number(p))
  if (parts.length < 2 || parts.some((n) => Number.isNaN(n))) return 0
  return parts[0] * 60 + parts[1] + (parts[2] || 0) / 60
}

/** Session length in hours from start/end times (handles midnight crossover). */
export function sessionDurationHours(startTime, endTime) {
  const start = parseTimeToMinutes(startTime)
  let end = parseTimeToMinutes(endTime)
  if (end <= start) end += 24 * 60
  return Math.max(0, (end - start) / 60)
}

/** Recurring weekly hours for a single time-slot row. */
export function hoursPerWeekForTimeSlot(slot) {
  if (!slot || slot.is_active === false) return 0
  const duration = sessionDurationHours(slot.start_time, slot.end_time)
  if (duration <= 0) return 0

  const mode = slot.schedule_mode || 'day'
  if (mode === 'date') {
    // Date-mode rows bill per occurrence; weekly estimate is zero.
    return 0
  }
  return duration
}

/** Estimated billable hours per calendar month for one time-slot row. */
export function hoursPerMonthForTimeSlot(slot) {
  if (!slot || slot.is_active === false) return 0
  const duration = sessionDurationHours(slot.start_time, slot.end_time)
  if (duration <= 0) return 0

  const mode = slot.schedule_mode || 'day'
  if (mode === 'date') {
    // One occurrence per month on average for date-specific sessions.
    return duration
  }
  return hoursPerWeekForTimeSlot(slot) * WEEKS_PER_MONTH
}

/**
 * Hours per month for an enrollment in a slot group.
 * When timeSlotId is set, only that occurrence counts; otherwise all active slots in the group sum.
 */
export function hoursPerMonthForEnrollment(timeSlots, { timeSlotId = null } = {}) {
  const active = (timeSlots || []).filter((s) => s.is_active !== false)
  if (active.length === 0) return 0

  if (timeSlotId != null) {
    const match = active.find((s) => Number(s.id) === Number(timeSlotId))
    return match ? hoursPerMonthForTimeSlot(match) : 0
  }

  return active.reduce((sum, slot) => sum + hoursPerMonthForTimeSlot(slot), 0)
}

export async function loadTimeSlotsBySlotGroupIds(pool, slotGroupIds) {
  const ids = [...new Set(slotGroupIds.map((id) => Number(id)).filter((id) => Number.isFinite(id)))]
  if (ids.length === 0) return new Map()

  const res = await pool.query(
    `
    SELECT id, slot_group_id, schedule_mode, day_of_week, specific_date,
           start_time, end_time, is_active, active_start, active_end
    FROM scheduling_time_slot
    WHERE slot_group_id = ANY($1::int[]) AND is_active = TRUE
    ORDER BY slot_group_id, id
    `,
    [ids],
  )

  const byGroup = new Map()
  for (const row of res.rows) {
    const gid = Number(row.slot_group_id)
    if (!byGroup.has(gid)) byGroup.set(gid, [])
    byGroup.get(gid).push(row)
  }
  return byGroup
}

/** Monthly list price in cents for one slot enrollment given billable hours. */
export function monthlySlotCostCents(effectiveDbRow, hoursPerMonth) {
  const unit = effectiveDbRow?.cost_unit ?? 'per_month'
  const amountCents = Number(
    effectiveDbRow?.cost_amount_cents ?? effectiveDbRow?.slot_cost_monthly_cents ?? 0,
  )
  if (unit === 'per_hour') {
    return Math.round(amountCents * Math.max(0, Number(hoursPerMonth) || 0))
  }
  if (unit === 'per_week') {
    return Math.round(amountCents * WEEKS_PER_MONTH)
  }
  return amountCents
}

export function monthlySlotCostDollars(effectiveDbRow, hoursPerMonth) {
  return monthlySlotCostCents(effectiveDbRow, hoursPerMonth) / 100
}
