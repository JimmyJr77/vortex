/**
 * Admin registrations overview — enrollments grouped by member or by class schedule line.
 */

import { queryFamilyMemberEnrollments } from '../platform/memberEnrollments.js'
import {
  loadGroupDisplayLabels,
  slotLabelForSignupRow,
  resolveEnrollmentOfferingDisplay,
  loadEnrollmentTaxonomyByFormIds,
  applyEnrollmentTaxonomy,
} from './slotDisplayLabel.js'
import { buildAdminMemberEnrollments } from './adminEnrollmentsView.js'
import { processDueEnrollmentCancellations } from './memberEnrollmentCancel.js'

/** Active members for the admin roster (portal accounts with is_active). */
export async function loadActiveMembers(pool) {
  const res = await pool.query(
    `
      SELECT id, first_name, last_name
      FROM member
      WHERE is_active = TRUE
      ORDER BY last_name, first_name, id
    `,
  )
  return res.rows.map((row) => ({
    id: Number(row.id),
    firstName: row.first_name || '',
    lastName: row.last_name || '',
  }))
}

/**
 * All active members with their current enrollments (member-portal shape).
 * @returns {Promise<{ members: Array<{ id, firstName, lastName, enrollments }> }>}
 */
export async function buildAdminEnrollmentsByMember(pool) {
  try {
    await processDueEnrollmentCancellations(pool)
  } catch (err) {
    console.warn('[adminRegistrationsOverview] process due cancellations:', err?.message ?? err)
  }

  const members = await loadActiveMembers(pool)
  if (!members.length) return { members: [] }

  const memberIds = members.map((m) => m.id)
  const allEnrollments = await queryFamilyMemberEnrollments(pool, memberIds)
  const byMemberId = new Map()
  for (const row of allEnrollments) {
    if (!byMemberId.has(row.member_id)) byMemberId.set(row.member_id, [])
    byMemberId.get(row.member_id).push(row)
  }

  return {
    members: members.map((member) => ({
      ...member,
      enrollments: byMemberId.get(member.id) ?? [],
    })),
  }
}

function registrationStatusLabel(counts) {
  const parts = []
  if (counts.confirmed > 0) parts.push(`${counts.confirmed} enrolled`)
  if (counts.waitlisted > 0) parts.push(`${counts.waitlisted} waitlisted`)
  if (counts.paused > 0) parts.push(`${counts.paused} paused`)
  if (counts.pendingCancel > 0) parts.push(`${counts.pendingCancel} cancelling`)
  if (parts.length === 0) return 'No enrollments'
  return parts.join(', ')
}

/**
 * Master table rows: one line per class offering schedule (form + slot group + time slot).
 */
export async function buildAdminClassRegistrationSummaries(pool) {
  const { resolveProgramsSchema, ensurePrimaryDisciplineTagColumn } = await import('../programs/schema.js')
  await ensurePrimaryDisciplineTagColumn(pool)
  const schema = await resolveProgramsSchema(pool)
  const programsTable = schema.programsTable
  const programFkColumn = schema.programFkColumn

  const linesRes = await pool.query(
    `
      SELECT
        sf.id AS form_id,
        sf.title AS form_title,
        sf.is_active AS form_active,
        sg.id AS slot_group_id,
        ts.id AS time_slot_id,
        ts.week_letter,
        ts.schedule_mode,
        ts.specific_date,
        ts.day_of_week,
        ts.start_time,
        ts.end_time,
        sg.offering_id,
        o.label AS offering_label,
        o.start_date AS offering_start_date,
        o.end_date AS offering_end_date,
        sg.active_start AS group_active_start,
        sg.active_end AS group_active_end,
        sg.dates_tbd AS group_dates_tbd,
        sf.start_date AS form_start_date,
        sf.end_date AS form_end_date,
        COALESCE(class_p.display_name, class_p.name, sf.title) AS class_name,
        COALESCE(sf.programs_id, class_p.${programFkColumn}) AS program_id,
        COALESCE(pr.display_name, pr.name) AS program_name,
        sport_dt.name AS sport_name,
        class_p.skill_level AS skill_level
      FROM scheduling_form sf
      JOIN scheduling_slot_group sg ON sg.form_id = sf.id
      LEFT JOIN scheduling_time_slot ts ON ts.slot_group_id = sg.id
      LEFT JOIN scheduling_offering o ON o.id = sg.offering_id
      LEFT JOIN program class_p ON class_p.id = sf.program_id
      LEFT JOIN ${programsTable} pr ON pr.id = COALESCE(sf.programs_id, class_p.${programFkColumn})
      LEFT JOIN discipline_tag sport_dt ON sport_dt.id = pr.primary_discipline_tag_id
      WHERE sf.deleted_at IS NULL
      ORDER BY sport_name NULLS LAST, program_name, class_name, offering_label, ts.day_of_week, ts.start_time
    `,
  )

  const formIds = [...new Set(linesRes.rows.map((r) => Number(r.form_id)))]
  const taxonomyByFormId = await loadEnrollmentTaxonomyByFormIds(pool, formIds)

  const groupIds = linesRes.rows
    .filter((r) => r.time_slot_id == null && r.slot_group_id != null)
    .map((r) => Number(r.slot_group_id))
  const { labels: groupLabels, rowsByGroupId } = await loadGroupDisplayLabels(pool, groupIds)

  const countsRes = await pool.query(
    `
      SELECT
        s.form_id,
        s.slot_group_id,
        s.time_slot_id,
        s.status,
        (s.cancel_effective_date IS NOT NULL) AS pending_cancel,
        COUNT(*)::int AS n
      FROM scheduling_signup s
      WHERE s.orphaned_at IS NULL
        AND s.archived_at IS NULL
        AND s.status IN ('confirmed', 'waitlisted', 'paused')
      GROUP BY s.form_id, s.slot_group_id, s.time_slot_id, s.status, pending_cancel
    `,
  )

  const countKey = (formId, slotGroupId, timeSlotId) =>
    `${formId}:${slotGroupId}:${timeSlotId ?? 'null'}`

  const countsByKey = new Map()
  for (const row of countsRes.rows) {
    const key = countKey(Number(row.form_id), Number(row.slot_group_id), row.time_slot_id != null ? Number(row.time_slot_id) : null)
    if (!countsByKey.has(key)) {
      countsByKey.set(key, { confirmed: 0, waitlisted: 0, paused: 0, pendingCancel: 0, total: 0 })
    }
    const bucket = countsByKey.get(key)
    const n = Number(row.n) || 0
    bucket.total += n
    if (row.pending_cancel) bucket.pendingCancel += n
    else if (row.status === 'confirmed') bucket.confirmed += n
    else if (row.status === 'waitlisted') bucket.waitlisted += n
    else if (row.status === 'paused') bucket.paused += n
  }

  const seen = new Set()
  const rows = []

  for (const line of linesRes.rows) {
    const formId = Number(line.form_id)
    const slotGroupId = Number(line.slot_group_id)
    const timeSlotId = line.time_slot_id != null ? Number(line.time_slot_id) : null
    const dedupeKey = `${formId}:${slotGroupId}:${timeSlotId ?? 'group'}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)

    const offering = resolveEnrollmentOfferingDisplay(line)
    const taxonomy = taxonomyByFormId.get(formId)
    const sportName = taxonomy?.sportName ?? (line.sport_name || null)
    const programName = taxonomy?.programName ?? (line.program_name || null)
    const className = taxonomy?.className ?? (line.class_name || line.form_title || 'Class')
    const schedule = slotLabelForSignupRow(line, groupLabels, rowsByGroupId)
    const counts = countsByKey.get(countKey(formId, slotGroupId, timeSlotId)) ?? {
      confirmed: 0,
      waitlisted: 0,
      paused: 0,
      pendingCancel: 0,
      total: 0,
    }

    rows.push(
      applyEnrollmentTaxonomy(
        {
          rowKey: dedupeKey,
          formId,
          slotGroupId,
          timeSlotId,
          sportName,
          programName,
          className,
          programId: taxonomy?.programId ?? (line.program_id != null ? Number(line.program_id) : null),
          skillLevel: line.skill_level ?? null,
          offeringLabel: offering.offering_label,
          offeringDates: offering.offering_dates,
          schedule,
          formActive: Boolean(line.form_active),
          enrollmentCount: counts.total,
          statusLabel: registrationStatusLabel(counts),
          counts,
        },
        taxonomy,
      ),
    )
  }

  return { rows }
}

/**
 * Admin enrollment rows for a specific class schedule line (drill-down roster).
 */
export async function buildAdminFormSlotEnrollments(pool, { formId, slotGroupId, timeSlotId = null }) {
  const signupRes = await pool.query(
    `
      SELECT s.id, s.member_id
      FROM scheduling_signup s
      WHERE s.form_id = $1
        AND s.slot_group_id = $2
        AND s.orphaned_at IS NULL
        AND s.archived_at IS NULL
        AND ($3::bigint IS NULL OR s.time_slot_id IS NULL OR s.time_slot_id = $3)
      ORDER BY s.id
    `,
    [formId, slotGroupId, timeSlotId],
  )

  const memberIds = [...new Set(signupRes.rows.map((r) => Number(r.member_id)).filter(Boolean))]
  const memberNameById = new Map()
  if (memberIds.length) {
    const namesRes = await pool.query(
      `SELECT id, first_name, last_name FROM member WHERE id = ANY($1::bigint[])`,
      [memberIds],
    )
    for (const row of namesRes.rows) {
      memberNameById.set(Number(row.id), {
        firstName: row.first_name || '',
        lastName: row.last_name || '',
      })
    }
  }

  const rows = []
  for (const signup of signupRes.rows) {
    const memberId = Number(signup.member_id)
    const result = await buildAdminMemberEnrollments(pool, memberId)
    const match = result.rows.find(
      (r) =>
        r.source === 'scheduling' &&
        r.id === Number(signup.id) &&
        (timeSlotId == null || r.time_slot_id == null || r.time_slot_id === timeSlotId),
    )
    if (!match) continue
    const names = memberNameById.get(memberId)
    rows.push({
      ...match,
      member_id: memberId,
      member_first_name: names?.firstName ?? '',
      member_last_name: names?.lastName ?? '',
    })
  }

  rows.sort((a, b) => {
    const ln = (a.member_last_name || '').localeCompare(b.member_last_name || '')
    if (ln !== 0) return ln
    return (a.member_first_name || '').localeCompare(b.member_first_name || '')
  })

  return { rows }
}
