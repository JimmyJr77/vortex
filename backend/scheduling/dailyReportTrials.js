import { resolveProgramsSchema } from '../programs/schema.js'
import { normalizePhoneNumber } from '../phoneNumbers.js'
import { expandCalendarRange } from './calendarExpansion.js'
import { buildGroupDisplayLabel, formatDateOnly } from './slotDisplayLabel.js'

/** Booked trials in the report's half-open registration window, regardless of class date. */
export async function loadDailyReportTrials(pool, { since, through }) {
  const schema = await resolveProgramsSchema(pool)
  const { rows } = await pool.query(
    `SELECT d.id, d.member_id, d.form_id, d.slot_group_id,
            d.class_date::text AS class_date, d.created_at AS registered_at, d.status,
            COALESCE(NULLIF(BTRIM(m.first_name), ''), NULLIF(BTRIM(d.first_name), ''), '') AS first_name,
            COALESCE(NULLIF(BTRIM(m.last_name), ''), NULLIF(BTRIM(d.last_name), ''), '') AS last_name,
            d.email, d.phone, p.is_trial_assessment,
            COALESCE(NULLIF(BTRIM(p.display_name), ''), NULLIF(BTRIM(p.name), ''),
                     NULLIF(BTRIM(sf.title), ''), 'Class') AS class_name,
            COALESCE(NULLIF(BTRIM(pr.display_name), ''), NULLIF(BTRIM(pr.name), '')) AS program_name
       FROM drop_in_registration d
       JOIN scheduling_form sf ON sf.id = d.form_id
       LEFT JOIN member m ON m.id = d.member_id
       LEFT JOIN program p ON p.id = sf.program_id
       LEFT JOIN ${schema.programsTable} pr ON pr.id = COALESCE(sf.programs_id, p.${schema.programFkColumn})
      WHERE d.benefit_type = 'free_trial'
        AND d.status IN ('confirmed', 'attended')
        AND d.created_at >= $1::timestamptz
        AND d.created_at < $2::timestamptz
      ORDER BY d.created_at DESC, d.id DESC`,
    [since, through],
  )
  if (!rows.length) return []

  const groupIds = [...new Set(rows.map(row => Number(row.slot_group_id)))]
  // Keep the same occurrence context as the roster calendar, including rotating
  // weeks and offering dates inherited by a group. A group-wide label could
  // otherwise describe another weekday instead of the reserved class date.
  // Inactive slots still define the A/B cycle; filter visibility after expansion.
  const { rows: slots } = await pool.query(
    `SELECT ts.*, sg.is_active AS sg_is_active,
            sg.active_start AS sg_active_start, sg.active_end AS sg_active_end,
            sg.dates_tbd AS sg_dates_tbd, sg.offering_id AS sg_offering_id,
            sg.inherits_offering_dates AS sg_inherits_offering_dates,
            sf.title AS form_title, sf.is_active AS form_is_active,
            sf.start_date AS form_start_date, sf.end_date AS form_end_date,
            p.is_active AS class_is_active,
            o.start_date AS offering_start_date, o.end_date AS offering_end_date,
            o.label AS offering_label
       FROM scheduling_time_slot ts
       JOIN scheduling_slot_group sg ON sg.id = ts.slot_group_id
       JOIN scheduling_form sf ON sf.id = ts.form_id
       LEFT JOIN program p ON p.id = sf.program_id
       LEFT JOIN scheduling_offering o ON o.id = sg.offering_id
      WHERE ts.slot_group_id = ANY($1::bigint[])
      ORDER BY ts.slot_group_id, ts.id`,
    [groupIds],
  )
  const labels = new Map()
  return rows.map(row => {
    const classDate = formatDateOnly(row.class_date)
    const key = `${row.form_id}:${row.slot_group_id}:${classDate}`
    if (!labels.has(key)) {
      const { events } = expandCalendarRange({
        startDate: classDate,
        endDate: classDate,
        rows: slots.filter(slot => Number(slot.slot_group_id) === Number(row.slot_group_id)),
      })
      labels.set(key, buildGroupDisplayLabel(events
        .filter(event => event.formId === Number(row.form_id)
          && event.formActive && event.classActive && event.slotGroupActive && event.slotActive)
        .map(event => ({ schedule_mode: 'date', specific_date: classDate,
          start_time: event.startTime, end_time: event.endTime }))))
    }
    return {
      id: Number(row.id),
      memberId: row.member_id == null ? null : Number(row.member_id),
      name: [row.first_name, row.last_name].map(value => String(value || '').trim()).filter(Boolean).join(' ') || 'Unnamed athlete',
      email: String(row.email || '').trim(),
      phone: normalizePhoneNumber(row.phone) ?? String(row.phone || '').trim(),
      className: row.class_name,
      programName: row.program_name || null,
      classDate,
      scheduleLabel: labels.get(key),
      registeredAt: row.registered_at,
      status: row.status,
      benefitType: 'free_trial',
      isTrialAssessment: row.is_trial_assessment === true,
    }
  })
}
