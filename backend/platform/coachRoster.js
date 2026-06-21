/**
 * Coach roster resolution: scheduling signups (offerings/class times) + legacy member_program.
 */

export async function getCoachClassAssignment(pool, assignmentId, coachUserId) {
  const r = await pool.query(
    `SELECT * FROM coach_class_assignment WHERE id = $1 AND coach_user_id = $2`,
    [assignmentId, coachUserId],
  )
  return r.rows[0] ?? null
}

function rosterSignupFilterSql(programIdx, formIdx, iterIdx) {
  return `
    AND (
      ($${formIdx}::bigint IS NOT NULL AND s.form_id = $${formIdx})
      OR (
        $${formIdx}::bigint IS NULL
        AND $${programIdx}::bigint IS NOT NULL
        AND sf.program_id = $${programIdx}
      )
    )
  `
}

function rosterMemberProgramFilterSql(programIdx, iterIdx) {
  return `
    AND (
      ($${iterIdx}::bigint IS NOT NULL AND mp.iteration_id = $${iterIdx})
      OR (
        $${iterIdx}::bigint IS NULL
        AND $${programIdx}::bigint IS NOT NULL
        AND mp.program_id = $${programIdx}
      )
      OR (
        $${programIdx}::bigint IS NULL
        AND $${iterIdx}::bigint IS NOT NULL
        AND mp.iteration_id = $${iterIdx}
      )
    )
  `
}

/** Member IDs enrolled in a coach's program/class assignment (scheduling + legacy). */
export async function queryCoachRosterMemberIds(pool, {
  programId,
  schedulingFormId,
  classIterationId,
  facilityId,
}) {
  const pid = programId != null ? Number(programId) : null
  const formId = schedulingFormId != null ? Number(schedulingFormId) : null
  const iterId = classIterationId != null ? Number(classIterationId) : null
  if (!pid && !formId && !iterId) return []

  const r = await pool.query(
    `
      WITH roster_ids AS (
        SELECT DISTINCT m.id
        FROM scheduling_signup s
        JOIN scheduling_form sf ON sf.id = s.form_id AND sf.deleted_at IS NULL
        JOIN member m ON m.id = s.member_id
        WHERE m.facility_id = $4
          AND m.is_active = TRUE
          AND s.member_id IS NOT NULL
          AND s.orphaned_at IS NULL
          AND s.status IN ('confirmed', 'waitlisted')
          ${rosterSignupFilterSql(1, 2, 3)}

        UNION

        SELECT DISTINCT m.id
        FROM member_program mp
        JOIN member m ON m.id = mp.member_id
        WHERE m.facility_id = $4
          AND m.is_active = TRUE
          ${rosterMemberProgramFilterSql(1, 3)}
      )
      SELECT id FROM roster_ids
    `,
    [pid, formId, iterId, facilityId],
  )
  return r.rows.map((row) => Number(row.id))
}

/** Full roster rows for coach UI (waivers, attendance notes). */
export async function queryCoachRosterMembers(pool, {
  programId,
  schedulingFormId,
  classIterationId,
  facilityId,
  assignmentId,
  coachUserId,
}) {
  const pid = programId != null ? Number(programId) : null
  const formId = schedulingFormId != null ? Number(schedulingFormId) : null
  const iterId = classIterationId != null ? Number(classIterationId) : null

  const r = await pool.query(
    `
      WITH roster_ids AS (
        SELECT DISTINCT m.id
        FROM scheduling_signup s
        JOIN scheduling_form sf ON sf.id = s.form_id AND sf.deleted_at IS NULL
        JOIN member m ON m.id = s.member_id
        WHERE m.facility_id = $4
          AND m.is_active = TRUE
          AND s.member_id IS NOT NULL
          AND s.orphaned_at IS NULL
          AND s.status IN ('confirmed', 'waitlisted')
          ${rosterSignupFilterSql(1, 2, 3)}

        UNION

        SELECT DISTINCT m.id
        FROM member_program mp
        JOIN member m ON m.id = mp.member_id
        WHERE m.facility_id = $4
          AND m.is_active = TRUE
          ${rosterMemberProgramFilterSql(1, 3)}
      )
      SELECT
        m.id,
        m.first_name,
        m.last_name,
        m.email,
        m.phone,
        m.has_completed_waivers,
        required_waivers.required_count,
        accepted_waivers.accepted_count,
        crn.attendance_status,
        crn.note
      FROM roster_ids rm
      JOIN member m ON m.id = rm.id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS required_count
        FROM waiver_template wt
        WHERE wt.facility_id = m.facility_id
          AND wt.active_from <= now()
          AND (wt.active_to IS NULL OR wt.active_to > now())
      ) required_waivers ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(DISTINCT mwa.waiver_template_id)::int AS accepted_count
        FROM member_waiver_acceptance mwa
        JOIN waiver_template wt ON wt.id = mwa.waiver_template_id
        WHERE mwa.member_id = m.id
          AND wt.active_from <= now()
          AND (wt.active_to IS NULL OR wt.active_to > now())
      ) accepted_waivers ON TRUE
      LEFT JOIN coach_roster_note crn
        ON crn.assignment_id = $5
       AND crn.member_id = m.id
       AND crn.coach_user_id = $6
       AND crn.note_date = CURRENT_DATE
      ORDER BY m.last_name, m.first_name
    `,
    [pid, formId, iterId, facilityId, assignmentId, coachUserId],
  )
  return r.rows
}

/** Members for plan_assignment when target_type = 'class' (target_id = coach_class_assignment.id). */
export async function getMembersForCoachClassTarget(pool, coachClassAssignmentId, facilityId) {
  const a = await pool.query(
    `SELECT program_id, scheduling_form_id, class_iteration_id FROM coach_class_assignment WHERE id = $1`,
    [coachClassAssignmentId],
  )
  if (a.rows.length === 0) return []
  const row = a.rows[0]
  const ids = await queryCoachRosterMemberIds(pool, {
    programId: row.program_id,
    schedulingFormId: row.scheduling_form_id,
    classIterationId: row.class_iteration_id,
    facilityId,
  })
  if (ids.length === 0) return []
  const members = await pool.query(
    `SELECT id, email, first_name FROM member WHERE id = ANY($1::bigint[]) AND facility_id = $2`,
    [ids, facilityId],
  )
  return members.rows
}

/** Coach user IDs linked to a member via program enrollment (scheduling + legacy). */
export async function queryCoachUserIdsForMember(pool, memberId, facilityId) {
  const r = await pool.query(
    `
      SELECT DISTINCT cca.coach_user_id
      FROM coach_class_assignment cca
      JOIN app_user au ON au.id = cca.coach_user_id
        AND au.facility_id = $2 AND au.is_active = TRUE
      WHERE (
        EXISTS (
          SELECT 1 FROM scheduling_signup s
          JOIN scheduling_form sf ON sf.id = s.form_id AND sf.deleted_at IS NULL
          WHERE s.member_id = $1
            AND s.orphaned_at IS NULL
            AND s.status IN ('confirmed', 'waitlisted')
            AND (
              (cca.scheduling_form_id IS NOT NULL AND s.form_id = cca.scheduling_form_id)
              OR (
                cca.scheduling_form_id IS NULL
                AND cca.program_id IS NOT NULL
                AND sf.program_id = cca.program_id
              )
            )
        )
        OR EXISTS (
          SELECT 1 FROM member_program mp
          WHERE mp.member_id = $1
            AND (
              (cca.class_iteration_id IS NOT NULL AND mp.iteration_id = cca.class_iteration_id)
              OR (
                cca.class_iteration_id IS NULL
                AND cca.program_id IS NOT NULL
                AND mp.program_id = cca.program_id
              )
            )
        )
      )
    `,
    [memberId, facilityId],
  )
  return r.rows.map((row) => Number(row.coach_user_id)).filter((id) => Number.isFinite(id))
}

/** All member IDs across coach's assigned classes (scheduling + legacy). */
export async function queryCoachAssignedMemberIds(pool, coachUserId, facilityId) {
  const classes = await pool.query(
    `SELECT program_id, scheduling_form_id, class_iteration_id FROM coach_class_assignment WHERE coach_user_id = $1`,
    [coachUserId],
  )
  const idSet = new Set()
  for (const c of classes.rows) {
    const ids = await queryCoachRosterMemberIds(pool, {
      programId: c.program_id,
      schedulingFormId: c.scheduling_form_id,
      classIterationId: c.class_iteration_id,
      facilityId,
    })
    for (const id of ids) idSet.add(id)
  }
  return [...idSet]
}

/** Member picker for coach UI: scope = my_classes | all */
export async function queryCoachMemberPickerList(pool, { coachUserId, facilityId, scope }) {
  let ids
  if (scope === 'all') {
    const r = await pool.query(
      `SELECT id FROM member WHERE facility_id = $1 AND is_active = TRUE`,
      [facilityId],
    )
    ids = r.rows.map((row) => Number(row.id))
  } else {
    ids = await queryCoachAssignedMemberIds(pool, coachUserId, facilityId)
  }
  if (ids.length === 0) return []
  const r = await pool.query(
    `SELECT id, first_name, last_name FROM member WHERE id = ANY($1::bigint[]) AND facility_id = $2 ORDER BY last_name, first_name`,
    [ids, facilityId],
  )
  return r.rows.map((m) => ({
    id: Number(m.id),
    name: `${m.first_name || ''} ${m.last_name || ''}`.trim() || `Member ${m.id}`,
  }))
}

/** Parent/guardian member IDs when the athlete is under 18. */
export async function queryMinorChildGuardianMemberIds(pool, childMemberId) {
  const r = await pool.query(
    `
      SELECT DISTINCT guardian_id AS id
      FROM (
        SELECT unnest(m.parent_guardian_ids) AS guardian_id
        FROM member m
        WHERE m.id = $1
          AND m.date_of_birth IS NOT NULL
          AND m.date_of_birth > (CURRENT_DATE - INTERVAL '18 years')
        UNION
        SELECT pga.parent_member_id AS guardian_id
        FROM parent_guardian_authority pga
        JOIN member child ON child.id = pga.child_member_id
        WHERE pga.child_member_id = $1
          AND pga.has_legal_authority = TRUE
          AND child.date_of_birth IS NOT NULL
          AND child.date_of_birth > (CURRENT_DATE - INTERVAL '18 years')
      ) guardians
      WHERE guardian_id IS NOT NULL
    `,
    [childMemberId],
  )
  return r.rows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id))
}
