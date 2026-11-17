import { expandCalendarRange } from './calendarExpansion.js'

const dropInExclusion = 'COALESCE(ts.exclude_from_drop_ins, p.exclude_from_drop_ins, top.exclude_from_drop_ins, FALSE)'
export const DROP_IN_POLICY_COLUMNS = `
  ${dropInExclusion} AS excluded_from_drop_ins,
  COALESCE(ts.allow_free_trials, NOT ${dropInExclusion}) AS allows_free_trial`

// Keep all sibling rows, including inactive/excluded slots, until calendar
// expansion has resolved rotations. These aliases avoid changing pricing data.
export const DROP_IN_CALENDAR_COLUMNS = `
  ts.id AS calendar_slot_id, sg.id AS calendar_group_id,
  ts.schedule_mode AS calendar_schedule_mode, ts.week_letter AS calendar_week_letter,
  ts.is_active AS calendar_slot_active, ts.dates_tbd AS calendar_slot_tbd,
  ts.active_start AS calendar_slot_start, ts.active_end AS calendar_slot_end,
  sg.active_start AS calendar_group_start, sg.active_end AS calendar_group_end,
  sg.dates_tbd AS calendar_group_tbd, sg.inherits_offering_dates AS calendar_inherits_offering,
  sg.offering_id AS calendar_offering_id,
  sf.start_date AS calendar_form_start, sf.end_date AS calendar_form_end,
  offering.start_date AS calendar_offering_start, offering.end_date AS calendar_offering_end,
  ARRAY(SELECT cancelled.occurrence_date::text
          FROM scheduling_occurrence_cancellation cancelled
         WHERE cancelled.time_slot_id = ts.id) AS calendar_cancelled_dates`

/** A booking identifies a group/date, so every available slot must allow the requested booking type. */
export function dropInOccurrences(rows, startDate, endDate = startDate) {
  const bySlot = new Map(rows.map(row => [Number(row.calendar_slot_id), row]))
  const calendarRows = rows.map(row => ({
    id: row.calendar_slot_id, slot_group_id: row.calendar_group_id, form_id: row.form_id,
    schedule_mode: row.calendar_schedule_mode, week_letter: row.calendar_week_letter,
    day_of_week: row.day_of_week, specific_date: row.specific_date,
    start_time: row.start_time, end_time: row.end_time,
    active_start: row.calendar_slot_start ?? row.calendar_group_start,
    active_end: row.calendar_slot_end ?? row.calendar_group_end,
    dates_tbd: Boolean(row.calendar_slot_tbd || row.calendar_group_tbd),
    sg_active_start: row.calendar_group_start, sg_active_end: row.calendar_group_end,
    sg_dates_tbd: row.calendar_group_tbd, sg_inherits_offering_dates: row.calendar_inherits_offering,
    offering_id: row.calendar_offering_id, sg_offering_id: row.calendar_offering_id,
    offering_start_date: row.calendar_offering_start, offering_end_date: row.calendar_offering_end,
    form_start_date: row.calendar_form_start, form_end_date: row.calendar_form_end,
    is_active: row.calendar_slot_active, sg_is_active: true, form_is_active: true, class_is_active: true,
    cancelled_dates: row.calendar_cancelled_dates,
  }))
  const { events } = expandCalendarRange({ startDate, endDate, rows: calendarRows })
  const active = events.filter(event => event.slotActive).map(event => {
    const row = bySlot.get(event.timeSlotId)
    return {
      row, date: event.date, key: `${event.slotGroupId}:${event.date}`,
      cancelled: event.isCancelled,
    }
  })
  const dropInBlocked = new Set()
  const trialBlocked = new Set()
  for (const { key, row, cancelled } of active) {
    if (cancelled) continue
    if (row.excluded_from_drop_ins) dropInBlocked.add(key)
    if (!(row.allows_free_trial ?? !row.excluded_from_drop_ins)) trialBlocked.add(key)
  }
  return active.map(({ row, date, key, cancelled }) => ({
    row, date, cancelled, excludedFromDropIns: dropInBlocked.has(key), allowsFreeTrial: !trialBlocked.has(key),
  }))
}

export async function loadDropInDateAvailability(db, slotGroupId, date) {
  const { rows } = await db.query(`
    SELECT ${DROP_IN_CALENDAR_COLUMNS}, sf.id AS form_id,
           ts.day_of_week, ts.specific_date, ts.start_time, ts.end_time, ${DROP_IN_POLICY_COLUMNS}
      FROM scheduling_slot_group sg
      JOIN scheduling_time_slot ts ON ts.slot_group_id = sg.id
      JOIN scheduling_form sf ON sf.id = sg.form_id
      JOIN program p ON p.id = sf.program_id
      LEFT JOIN programs top ON top.id = COALESCE(sf.programs_id, p.programs_id)
      LEFT JOIN scheduling_offering offering ON offering.id = sg.offering_id
     WHERE sg.id = $1`, [slotGroupId])
  const occurrences = dropInOccurrences(rows, date)
  const available = occurrences.filter(item => !item.cancelled)
  const allowsDropIn = available.some(item => !item.excludedFromDropIns)
  return {
    cancelled: !allowsDropIn && occurrences.some(item => item.cancelled),
    allowsDropIn,
    allowsFreeTrial: available.some(item => item.allowsFreeTrial),
  }
}
