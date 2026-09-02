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
import { processDueEnrollmentCancellations } from './memberEnrollmentCancel.js'

/**
 * Active members that currently have at least one non-orphaned scheduling signup
 * or drop-in registration (avoids shipping empty member sections).
 */
export async function loadMembersWithEnrollments(pool) {
  const res = await pool.query(
    `
      SELECT DISTINCT m.id, m.first_name, m.last_name
      FROM member m
      WHERE m.is_active = TRUE
        AND (
          EXISTS (
            SELECT 1 FROM scheduling_signup s
            WHERE s.member_id = m.id AND s.orphaned_at IS NULL
          )
          OR EXISTS (
            SELECT 1 FROM drop_in_registration d
            WHERE d.member_id = m.id
          )
        )
      ORDER BY m.last_name, m.first_name, m.id
    `,
  )
  return res.rows.map((row) => ({
    id: Number(row.id),
    firstName: row.first_name || '',
    lastName: row.last_name || '',
  }))
}

/**
 * Members with enrollments only (member-portal enrollment shape).
 * @returns {Promise<{ members: Array<{ id, firstName, lastName, enrollments }> }>}
 */
export async function buildAdminEnrollmentsByMember(pool) {
  try {
    await processDueEnrollmentCancellations(pool)
  } catch (err) {
    console.warn('[adminRegistrationsOverview] process due cancellations:', err?.message ?? err)
  }

  const members = await loadMembersWithEnrollments(pool)
  if (!members.length) return { members: [] }

  const memberIds = members.map((m) => m.id)
  const allEnrollments = await queryFamilyMemberEnrollments(pool, memberIds, {
    skipDueCancellations: true,
  })
  const byMemberId = new Map()
  for (const row of allEnrollments) {
    if (!byMemberId.has(row.member_id)) byMemberId.set(row.member_id, [])
    byMemberId.get(row.member_id).push(row)
  }

  return {
    members: members
      .map((member) => ({
        ...member,
        enrollments: byMemberId.get(member.id) ?? [],
      }))
      .filter((member) => member.enrollments.length > 0),
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
        sg.max_participants,
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
          enrollmentCount: counts.confirmed,
          maxParticipants: Number(line.max_participants) || 0,
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
 * Light roster rows for a class schedule line — no per-member pricing pipeline.
 */
export async function buildAdminFormSlotEnrollments(pool, { formId, slotGroupId, timeSlotId = null }) {
  const { resolveProgramsSchema, ensurePrimaryDisciplineTagColumn } = await import('../programs/schema.js')
  await ensurePrimaryDisciplineTagColumn(pool)
  const schema = await resolveProgramsSchema(pool)
  const programsTable = schema.programsTable
  const programFkColumn = schema.programFkColumn

  const signupRes = await pool.query(
    `
      SELECT
        s.id, s.member_id, s.form_id, s.status, s.created_at, s.enrollment_start_date,
        s.completed_at, s.paused_at,
        s.pause_effective_date, s.pause_mode,
        s.manual_discount_cents, s.manual_discount_pct, s.manual_discount_reason, s.manual_discount_rule_id,
        s.pricing_breakdown,
        s.slot_group_id, s.time_slot_id, sg.offering_id,
        m.first_name AS member_first_name,
        m.last_name AS member_last_name,
        m.family_id,
        COALESCE(class_p.display_name, class_p.name, sf.title) AS class_name,
        COALESCE(sf.programs_id, class_p.${programFkColumn}) AS program_id,
        COALESCE(pr.display_name, pr.name) AS program_name,
        sport_dt.name AS sport_name,
        ts.week_letter, ts.schedule_mode, ts.specific_date, ts.day_of_week, ts.start_time, ts.end_time,
        o.label AS offering_label, o.start_date AS offering_start_date, o.end_date AS offering_end_date,
        sg.active_start AS group_active_start, sg.active_end AS group_active_end, sg.dates_tbd AS group_dates_tbd,
        sf.start_date AS form_start_date, sf.end_date AS form_end_date
      FROM scheduling_signup s
      JOIN member m ON m.id = s.member_id
      JOIN scheduling_form sf ON sf.id = s.form_id AND sf.deleted_at IS NULL
      JOIN scheduling_slot_group sg ON sg.id = s.slot_group_id
      LEFT JOIN scheduling_offering o ON o.id = sg.offering_id
      LEFT JOIN scheduling_time_slot ts ON ts.id = s.time_slot_id
      LEFT JOIN program class_p ON class_p.id = sf.program_id
      LEFT JOIN ${programsTable} pr ON pr.id = COALESCE(sf.programs_id, class_p.${programFkColumn})
      LEFT JOIN discipline_tag sport_dt ON sport_dt.id = pr.primary_discipline_tag_id
      WHERE s.form_id = $1
        AND s.slot_group_id = $2
        AND s.orphaned_at IS NULL
        AND s.archived_at IS NULL
        AND s.status IN ('confirmed', 'waitlisted', 'paused')
        AND ($3::bigint IS NULL OR s.time_slot_id IS NULL OR s.time_slot_id = $3)
      ORDER BY m.last_name, m.first_name, s.id
    `,
    [formId, slotGroupId, timeSlotId],
  )

  if (!signupRes.rows.length) return { rows: [] }

  const signupIds = signupRes.rows.map((r) => Number(r.id))
  const subBySignupId = new Map()
  try {
    const subRes = await pool.query(
      `
        SELECT DISTINCT ON (source_id)
          source_id, monthly_amount_cents, discount_amount_cents, net_monthly_cents, status
        FROM billing_subscription
        WHERE source_type = 'scheduling_signup'
          AND source_id = ANY($1::text[])
        ORDER BY source_id, CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END, id DESC
      `,
      [signupIds.map(String)],
    )
    for (const r of subRes.rows) {
      subBySignupId.set(Number(r.source_id), r)
    }
  } catch {
    /* billing schema optional for roster display */
  }

  const groupIds = signupRes.rows
    .filter((row) => row.time_slot_id == null && row.slot_group_id != null)
    .map((row) => Number(row.slot_group_id))
  const { labels: groupLabels, rowsByGroupId } = await loadGroupDisplayLabels(pool, groupIds)
  const taxonomyByFormId = await loadEnrollmentTaxonomyByFormIds(
    pool,
    signupRes.rows.map((row) => Number(row.form_id)),
  )

  const rows = signupRes.rows.map((row) => {
    const offering = resolveEnrollmentOfferingDisplay(row)
    const taxonomy = taxonomyByFormId.get(Number(row.form_id))
    const programName = taxonomy?.programName ?? (row.program_name || null)
    const sportName = taxonomy?.sportName ?? (row.sport_name || null)
    const className = taxonomy?.className ?? (row.class_name || 'Class')
    const sub = subBySignupId.get(Number(row.id))
    const breakdown = row.pricing_breakdown
    const snapshotCents =
      breakdown && typeof breakdown === 'object'
        ? Number(breakdown.classCostCents ?? breakdown.class_cost_cents ?? 0) || null
        : null
    const classCostCents =
      snapshotCents ?? (sub != null ? Number(sub.monthly_amount_cents) : null) ?? 0
    const isPaused = row.status === 'paused'
    const manualCents = isPaused
      ? 0
      : row.manual_discount_cents != null
        ? Number(row.manual_discount_cents)
        : 0
    const baseNet = isPaused
      ? 0
      : sub != null
        ? Number(sub.net_monthly_cents)
        : classCostCents
    const adjustedCostCents = isPaused ? 0 : Math.max(0, baseNet - manualCents)
    const billingType =
      breakdown?.billingType === 'one_time' || breakdown?.billing_type === 'one_time'
        ? 'one_time'
        : 'recurring'
    const enrollmentType =
      billingType === 'one_time'
        ? 'one_time'
        : row.offering_id != null
          ? 'temporary_block'
          : 'monthly'
    const attendanceDate =
      row.schedule_mode === 'date' && row.specific_date
        ? String(row.specific_date).slice(0, 10)
        : null

    return applyEnrollmentTaxonomy(
      {
        id: Number(row.id),
        source: 'scheduling',
        member_id: Number(row.member_id),
        member_first_name: row.member_first_name || '',
        member_last_name: row.member_last_name || '',
        family_id: row.family_id != null ? Number(row.family_id) : null,
        sport_name: sportName,
        program_name: programName,
        class_name: className,
        program_id: taxonomy?.programId ?? (row.program_id != null ? Number(row.program_id) : null),
        form_id: Number(row.form_id),
        slot_group_id: row.slot_group_id != null ? Number(row.slot_group_id) : null,
        time_slot_id: row.time_slot_id != null ? Number(row.time_slot_id) : null,
        offering_id: row.offering_id != null ? Number(row.offering_id) : null,
        offering_label: offering.offering_label,
        offering_dates: offering.offering_dates,
        enrollment_start_date: row.enrollment_start_date
          ? String(row.enrollment_start_date).slice(0, 10)
          : null,
        schedule: slotLabelForSignupRow(row, groupLabels, rowsByGroupId),
        status: row.status,
        billing_status: sub?.status ?? null,
        class_cost_cents: classCostCents,
        adjusted_cost_cents: adjustedCostCents,
        manual_discount_cents: manualCents > 0 ? manualCents : null,
        manual_discount_pct: row.manual_discount_pct != null ? Number(row.manual_discount_pct) : null,
        manual_discount_reason: row.manual_discount_reason ?? null,
        manual_discount_rule_id:
          row.manual_discount_rule_id != null ? Number(row.manual_discount_rule_id) : null,
        pause_effective_date: row.pause_effective_date
          ? String(row.pause_effective_date).slice(0, 10)
          : null,
        pause_mode: row.pause_mode ?? null,
        completed_at: row.completed_at,
        created_at: row.created_at,
        enrollment_type: enrollmentType,
        enrollmentType,
        attendance_date: attendanceDate,
        attendanceDate,
        billing_type: billingType,
        billingType,
      },
      taxonomy,
    )
  })

  return { rows }
}
