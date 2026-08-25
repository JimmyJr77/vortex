/**
 * Family enrollment rows for the member portal — one row per scheduling signup.
 */

import {
  applyEnrollmentTaxonomy,
  buildEnrollmentContextLine,
  loadEnrollmentTaxonomyByFormIds,
  loadGroupDisplayLabels,
  resolveEnrollmentOfferingDisplay,
  slotLabelForSignupRow,
} from '../scheduling/slotDisplayLabel.js'

export async function queryFamilyMemberEnrollments(pool, memberIds, { skipDueCancellations = false } = {}) {
  if (!memberIds?.length) return []

  if (!skipDueCancellations) {
    try {
      const { processDueEnrollmentCancellations } = await import('../scheduling/memberEnrollmentCancel.js')
      await processDueEnrollmentCancellations(pool)
    } catch (err) {
      console.warn('[memberEnrollments] process due cancellations:', err?.message ?? err)
    }
  }

  const { resolveProgramsSchema, ensurePrimaryDisciplineTagColumn } = await import('../programs/schema.js')
  await ensurePrimaryDisciplineTagColumn(pool)
  const schema = await resolveProgramsSchema(pool)
  const programsTable = schema.programsTable
  const programFkColumn = schema.programFkColumn

  const schedulingResult = await pool.query(
    `
      SELECT
        s.id,
        s.member_id,
        s.form_id,
        s.status,
        s.created_at,
        s.cancel_effective_date,
        s.cancel_requested_at,
        m.first_name AS member_first_name,
        m.last_name AS member_last_name,
        COALESCE(class_p.display_name, class_p.name, sf.title) AS class_name,
        COALESCE(sf.programs_id, class_p.${programFkColumn}) AS program_id,
        COALESCE(pr.display_name, pr.name) AS program_name,
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
        sf.end_date AS form_end_date,
        CASE
          WHEN one_time.id IS NOT NULL THEN 'one_time'
          WHEN sg.offering_id IS NOT NULL THEN 'temporary_block'
          ELSE 'monthly'
        END AS enrollment_type,
        CASE WHEN one_time.id IS NOT NULL THEN 'one_time' ELSE 'recurring' END AS billing_type
      FROM scheduling_signup s
      JOIN member m ON m.id = s.member_id
      JOIN scheduling_form sf ON sf.id = s.form_id AND sf.deleted_at IS NULL
      JOIN scheduling_slot_group sg ON sg.id = s.slot_group_id
      LEFT JOIN scheduling_offering o ON o.id = sg.offering_id
      LEFT JOIN scheduling_time_slot ts ON ts.id = s.time_slot_id
      LEFT JOIN program class_p ON class_p.id = sf.program_id
      LEFT JOIN ${programsTable} pr ON pr.id = COALESCE(sf.programs_id, class_p.${programFkColumn})
      LEFT JOIN discipline_tag sport_dt ON sport_dt.id = pr.primary_discipline_tag_id
      LEFT JOIN LATERAL (
        SELECT c.id
          FROM billing_charge c
         WHERE c.source_type = 'scheduling_signup'
           AND c.source_id = s.id::text
           AND c.billing_interval = 'one_time'
         ORDER BY c.id DESC LIMIT 1
      ) one_time ON TRUE
      WHERE s.member_id = ANY($1::bigint[])
        AND s.orphaned_at IS NULL
      ORDER BY class_name, m.last_name, m.first_name, s.id
    `,
    [memberIds],
  )

  const groupIds = schedulingResult.rows
    .filter((row) => row.time_slot_id == null && row.slot_group_id != null)
    .map((row) => Number(row.slot_group_id))
  const { labels: groupLabels, rowsByGroupId } = await loadGroupDisplayLabels(pool, groupIds)

  const formIds = schedulingResult.rows.map((row) => Number(row.form_id))
  const taxonomyByFormId = await loadEnrollmentTaxonomyByFormIds(pool, formIds)

  const schedulingRows = schedulingResult.rows.map((row) => {
    const offering = resolveEnrollmentOfferingDisplay(row)
    const taxonomy = taxonomyByFormId.get(Number(row.form_id))
    const programName = taxonomy?.programName ?? (row.program_name || null)
    const sportName = taxonomy?.sportName ?? (row.sport_name || null)
    const className = taxonomy?.className ?? (row.class_name || 'Class')
    const classContextLine =
      taxonomy?.classContextLine ??
      (buildEnrollmentContextLine({
        sportName,
        programName,
        className,
      }) ||
        className)
    return applyEnrollmentTaxonomy(
      {
        id: Number(row.id),
        member_id: Number(row.member_id),
        member_first_name: row.member_first_name || '',
        member_last_name: row.member_last_name || '',
        class_name: className,
        sport_name: sportName,
        program_name: programName,
        class_context_line: classContextLine,
        program_id:
          taxonomy?.programId ??
          (row.program_id != null ? Number(row.program_id) : null),
        form_id: Number(row.form_id),
        slot_group_id: row.slot_group_id != null ? Number(row.slot_group_id) : null,
        time_slot_id: row.time_slot_id != null ? Number(row.time_slot_id) : null,
        offering_id: row.offering_id != null ? Number(row.offering_id) : null,
        slot_label: slotLabelForSignupRow(row, groupLabels, rowsByGroupId),
        offering_label: offering.offering_label,
        offering_start_date: offering.offering_start_date,
        offering_end_date: offering.offering_end_date,
        offering_dates: offering.offering_dates,
        status: row.status,
        cancel_effective_date: row.cancel_effective_date
          ? String(row.cancel_effective_date).slice(0, 10)
          : null,
        cancel_requested_at: row.cancel_requested_at ?? null,
        created_at: row.created_at,
        enrollment_type: row.enrollment_type,
        enrollmentType: row.enrollment_type,
        attendance_date: row.schedule_mode === 'date' && row.specific_date
          ? String(row.specific_date).slice(0, 10)
          : null,
        attendanceDate: row.schedule_mode === 'date' && row.specific_date
          ? String(row.specific_date).slice(0, 10)
          : null,
        billing_type: row.billing_type,
        billingType: row.billing_type,
        source: 'scheduling',
      },
      taxonomy,
    )
  })

  const dropInResult = await pool.query(
    `SELECT d.id, d.member_id, d.form_id, d.slot_group_id, d.class_date,
            d.status, d.created_at, d.amount_cents, d.benefit_type,
            m.first_name AS member_first_name, m.last_name AS member_last_name,
            COALESCE(NULLIF(TRIM(class_p.display_name), ''), NULLIF(TRIM(sf.title), ''), 'Class') AS class_name,
            COALESCE(sf.programs_id, class_p.${programFkColumn}) AS program_id,
            COALESCE(NULLIF(TRIM(pr.display_name), ''), NULLIF(TRIM(pr.name), '')) AS program_name,
            sport_dt.name AS sport_name,
            sg.offering_id,
            o.label AS offering_label, o.start_date AS offering_start_date, o.end_date AS offering_end_date,
            occurrence.start_time, occurrence.end_time
       FROM drop_in_registration d
       JOIN member m ON m.id = d.member_id
       JOIN scheduling_form sf ON sf.id = d.form_id AND sf.deleted_at IS NULL
       JOIN scheduling_slot_group sg ON sg.id = d.slot_group_id
       LEFT JOIN scheduling_offering o ON o.id = sg.offering_id
       LEFT JOIN program class_p ON class_p.id = sf.program_id
       LEFT JOIN ${programsTable} pr ON pr.id = COALESCE(sf.programs_id, class_p.${programFkColumn})
       LEFT JOIN discipline_tag sport_dt ON sport_dt.id = pr.primary_discipline_tag_id
       LEFT JOIN LATERAL (
         SELECT ts.start_time, ts.end_time
           FROM scheduling_time_slot ts
          WHERE ts.slot_group_id = d.slot_group_id
            AND (ts.specific_date = d.class_date OR (ts.specific_date IS NULL AND ts.day_of_week = EXTRACT(DOW FROM d.class_date)::int))
          ORDER BY (ts.specific_date IS NOT NULL) DESC, ts.start_time LIMIT 1
       ) occurrence ON TRUE
      WHERE d.member_id = ANY($1::bigint[])
      ORDER BY d.class_date DESC, d.id DESC`,
    [memberIds],
  )

  const formatTime = (value) => value ? String(value).slice(0, 5) : ''
  const dropInRows = dropInResult.rows.map((row) => {
    const taxonomy = taxonomyByFormId.get(Number(row.form_id))
    const className = taxonomy?.className ?? row.class_name
    const programName = taxonomy?.programName ?? (row.program_name || null)
    const sportName = taxonomy?.sportName ?? (row.sport_name || null)
    const attendanceDate = String(row.class_date).slice(0, 10)
    return applyEnrollmentTaxonomy({
      id: Number(row.id),
      member_id: Number(row.member_id),
      member_first_name: row.member_first_name || '',
      member_last_name: row.member_last_name || '',
      class_name: className,
      sport_name: sportName,
      program_name: programName,
      class_context_line: buildEnrollmentContextLine({ sportName, programName, className }) || className,
      program_id: taxonomy?.programId ?? (row.program_id != null ? Number(row.program_id) : null),
      form_id: Number(row.form_id),
      slot_group_id: Number(row.slot_group_id),
      time_slot_id: null,
      offering_id: row.offering_id != null ? Number(row.offering_id) : null,
      offering_label: row.offering_label || 'Single-day enrollment',
      offering_start_date: attendanceDate,
      offering_end_date: attendanceDate,
      offering_dates: attendanceDate,
      slot_label: [attendanceDate, [formatTime(row.start_time), formatTime(row.end_time)].filter(Boolean).join('–')].filter(Boolean).join(' · '),
      status: row.status,
      created_at: row.created_at,
      enrollment_type: 'drop_in',
      enrollmentType: 'drop_in',
      attendance_date: attendanceDate,
      attendanceDate,
      billing_type: 'one_time',
      billingType: 'one_time',
      amount_cents: Number(row.amount_cents || 0),
      benefit_type: row.benefit_type,
      source: 'drop_in',
    }, taxonomy)
  })

  return [...schedulingRows, ...dropInRows]
}
