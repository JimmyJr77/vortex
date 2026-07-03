/**
 * Family enrollment rows for the member portal — one row per scheduling slot
 * (scheduling_signup), with legacy member_program rows when no signup exists.
 */

import {
  buildEnrollmentContextLine,
  loadGroupDisplayLabels,
  resolveEnrollmentOfferingDisplay,
  slotLabelForSignupRow,
} from '../scheduling/slotDisplayLabel.js'

function parseSelectedDays(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function formatLegacySlotLabel(selectedDays, daysPerWeek) {
  if (selectedDays.length > 0) return selectedDays.join(', ')
  if (daysPerWeek != null) return `${daysPerWeek} day${Number(daysPerWeek) === 1 ? '' : 's'}/week`
  return '—'
}

export async function queryFamilyMemberEnrollments(pool, memberIds) {
  if (!memberIds?.length) return []

  const { resolveProgramsSchema, ensurePrimaryDisciplineTagColumn } = await import('../programs/schema.js')
  await ensurePrimaryDisciplineTagColumn(pool)
  const schema = await resolveProgramsSchema(pool)
  const programsTable = schema.programsTable

  const schedulingResult = await pool.query(
    `
      SELECT
        s.id,
        s.member_id,
        s.form_id,
        s.status,
        s.created_at,
        m.first_name AS member_first_name,
        m.last_name AS member_last_name,
        sf.title AS class_name,
        COALESCE(sf.program_id, sf.programs_id) AS program_id,
        prog.display_name AS program_name,
        prog.name AS program_name_fallback,
        sport_dt.name AS sport_name,
        s.slot_group_id,
        s.time_slot_id,
        sg.offering_id,
        ts.week_letter,
        ts.schedule_mode,
        ts.specific_date,
        ts.day_of_week,
        ts.start_time,
        ts.end_time,
        o.label AS offering_label,
        o.start_date AS offering_start_date,
        o.end_date AS offering_end_date,
        sg.active_start AS group_active_start,
        sg.active_end AS group_active_end,
        sg.dates_tbd AS group_dates_tbd,
        sf.start_date AS form_start_date,
        sf.end_date AS form_end_date
      FROM scheduling_signup s
      JOIN member m ON m.id = s.member_id
      JOIN scheduling_form sf ON sf.id = s.form_id AND sf.deleted_at IS NULL
      JOIN scheduling_slot_group sg ON sg.id = s.slot_group_id
      LEFT JOIN scheduling_offering o ON o.id = sg.offering_id
      LEFT JOIN scheduling_time_slot ts ON ts.id = s.time_slot_id
      LEFT JOIN ${programsTable} prog ON prog.id = COALESCE(sf.program_id, sf.programs_id)
      LEFT JOIN discipline_tag sport_dt ON sport_dt.id = prog.primary_discipline_tag_id
      WHERE s.member_id = ANY($1::bigint[])
        AND s.orphaned_at IS NULL
        AND s.status IN ('confirmed', 'waitlisted')
      ORDER BY sf.title, m.last_name, m.first_name, s.id
    `,
    [memberIds],
  )

  const groupIds = schedulingResult.rows
    .filter((row) => row.time_slot_id == null && row.slot_group_id != null)
    .map((row) => Number(row.slot_group_id))
  const groupLabels = await loadGroupDisplayLabels(pool, groupIds)

  const schedulingRows = schedulingResult.rows.map((row) => {
    const offering = resolveEnrollmentOfferingDisplay(row)
    const programName = row.program_name || row.program_name_fallback || null
    const sportName = row.sport_name || null
    const className = row.class_name || 'Class'
    const classContextLine =
      buildEnrollmentContextLine({
        sportName,
        programName,
        className,
      }) || className
    return {
      id: Number(row.id),
      member_id: Number(row.member_id),
      member_first_name: row.member_first_name || '',
      member_last_name: row.member_last_name || '',
      class_name: className,
      sport_name: sportName,
      program_name: programName,
      class_context_line: classContextLine,
      program_id: row.program_id != null ? Number(row.program_id) : null,
      form_id: Number(row.form_id),
      slot_group_id: row.slot_group_id != null ? Number(row.slot_group_id) : null,
      time_slot_id: row.time_slot_id != null ? Number(row.time_slot_id) : null,
      offering_id: row.offering_id != null ? Number(row.offering_id) : null,
      slot_label: slotLabelForSignupRow(row, groupLabels),
      offering_label: offering.offering_label,
      offering_start_date: offering.offering_start_date,
      offering_end_date: offering.offering_end_date,
      offering_dates: offering.offering_dates,
      status: row.status,
      created_at: row.created_at,
      source: 'scheduling',
    }
  })

  let legacyRows = []
  try {
    const legacyResult = await pool.query(
      `
        SELECT
          mp.id,
          mp.member_id,
          mp.program_id,
          mp.days_per_week,
          mp.selected_days,
          mp.created_at,
          m.first_name AS member_first_name,
          m.last_name AS member_last_name,
          COALESCE(p.display_name, p.name, 'Class') AS class_name,
          COALESCE(p.display_name, p.name) AS program_name,
          sport_dt.name AS sport_name
        FROM member_program mp
        JOIN member m ON m.id = mp.member_id
        LEFT JOIN program p ON p.id = mp.program_id
        LEFT JOIN discipline_tag sport_dt ON sport_dt.id = p.primary_discipline_tag_id
        WHERE mp.member_id = ANY($1::bigint[])
          AND NOT EXISTS (
            SELECT 1
            FROM scheduling_signup ss
            JOIN scheduling_form sf ON sf.id = ss.form_id AND sf.deleted_at IS NULL
            WHERE ss.member_id = mp.member_id
              AND ss.orphaned_at IS NULL
              AND ss.status IN ('confirmed', 'waitlisted')
              AND (
                sf.program_id = mp.program_id
                OR sf.programs_id = mp.program_id
              )
          )
        ORDER BY class_name, m.last_name, m.first_name, mp.id
      `,
      [memberIds],
    )

    legacyRows = legacyResult.rows.map((row) => {
      const selectedDays = parseSelectedDays(row.selected_days)
      const programName = row.program_name || null
      const sportName = row.sport_name || null
      const className = row.class_name || 'Class'
      const classContextLine =
        buildEnrollmentContextLine({
          sportName,
          programName,
          className: programName && className === programName ? null : className,
        }) || className
      return {
        id: Number(row.id),
        member_id: Number(row.member_id),
        member_first_name: row.member_first_name || '',
        member_last_name: row.member_last_name || '',
        class_name: className,
        sport_name: sportName,
        program_name: programName,
        class_context_line: classContextLine,
        program_id: row.program_id != null ? Number(row.program_id) : null,
        form_id: null,
        slot_group_id: null,
        time_slot_id: null,
        offering_id: null,
        slot_label: formatLegacySlotLabel(selectedDays, row.days_per_week),
        offering_label: null,
        offering_start_date: null,
        offering_end_date: null,
        offering_dates: '—',
        status: 'enrolled',
        created_at: row.created_at,
        source: 'legacy',
        days_per_week: row.days_per_week,
        selected_days: selectedDays,
      }
    })
  } catch {
    legacyRows = []
  }

  return [...schedulingRows, ...legacyRows]
}
