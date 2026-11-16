import { expandCalendarRange } from './calendarExpansion.js'

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
  offering.start_date AS calendar_offering_start, offering.end_date AS calendar_offering_end`

/** A booking identifies a group/date, so every active slot on that date must allow it. */
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
  }))
  const { events } = expandCalendarRange({ startDate, endDate, rows: calendarRows })
  const active = events.filter(event => event.slotActive)
  const blocked = new Set(active.filter(event => bySlot.get(event.timeSlotId).excluded_from_drop_ins)
    .map(event => `${event.slotGroupId}:${event.date}`))
  return active.map(event => ({
    row: bySlot.get(event.timeSlotId), date: event.date,
    excludedFromDropIns: blocked.has(`${event.slotGroupId}:${event.date}`),
  }))
}
