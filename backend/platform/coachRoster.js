/**
 * Coach roster resolution via scheduling signups (offerings/class times).
 */

import { resolveProgramsSchema } from '../programs/schema.js'

let coachAssignmentSchemaPromise = null

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const COACH_ASSIGN_LEVEL_LABELS = {
  programs_top: 'Program',
  class_event: 'Class',
  scheduling_class: 'Scheduling class',
  offering: 'Offering',
  time_slot: 'Timeslot',
}

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function formatTimeSlotLabel(row) {
  const parts = []
  if (row.specific_date) parts.push(String(row.specific_date))
  else if (row.day_of_week != null) parts.push(DAY_NAMES[row.day_of_week] || `Day ${row.day_of_week}`)
  if (row.start_time) parts.push(String(row.start_time).slice(0, 5))
  if (row.end_time) parts.push(`–${String(row.end_time).slice(0, 5)}`)
  return parts.join(' ').trim() || `Slot ${row.id}`
}

/** Applies migration 030/031 columns/indexes when DB has not run SQL migrations yet. */
export async function ensureCoachClassAssignmentSchema(pool) {
  if (!coachAssignmentSchemaPromise) {
    coachAssignmentSchemaPromise = applyCoachClassAssignmentSchema(pool).catch((err) => {
      coachAssignmentSchemaPromise = null
      throw err
    })
  }
  return coachAssignmentSchemaPromise
}

async function applyCoachClassAssignmentSchema(pool) {
  await pool.query(`
    ALTER TABLE coach_class_assignment
      ADD COLUMN IF NOT EXISTS scheduling_form_id BIGINT REFERENCES scheduling_form(id) ON DELETE CASCADE
  `)
  await pool.query(`
    ALTER TABLE coach_class_assignment
      ADD COLUMN IF NOT EXISTS programs_id BIGINT
  `)
  await pool.query(`
    ALTER TABLE coach_class_assignment
      ADD COLUMN IF NOT EXISTS scheduling_offering_id BIGINT REFERENCES scheduling_offering(id) ON DELETE CASCADE
  `)
  await pool.query(`
    ALTER TABLE coach_class_assignment
      ADD COLUMN IF NOT EXISTS scheduling_time_slot_id BIGINT REFERENCES scheduling_time_slot(id) ON DELETE CASCADE
  `)
  await pool.query(`
    ALTER TABLE coach_class_assignment
      DROP CONSTRAINT IF EXISTS coach_class_assignment_check
  `)
  await pool.query(`
    ALTER TABLE coach_class_assignment
      DROP CONSTRAINT IF EXISTS coach_class_assignment_target_check
  `)
  // Categories were removed: drop the legacy scheduling_category_id target.
  // Delete any category-only assignments first so the rebuilt target check
  // (which no longer permits a category-only target) can be applied.
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'coach_class_assignment' AND column_name = 'scheduling_category_id'
      ) THEN
        DROP INDEX IF EXISTS ux_coach_assignment_category;
        DROP INDEX IF EXISTS idx_coach_assignment_category;
        DELETE FROM coach_class_assignment
        WHERE scheduling_category_id IS NOT NULL
          AND programs_id IS NULL
          AND program_id IS NULL
          AND scheduling_form_id IS NULL
          AND scheduling_offering_id IS NULL
          AND scheduling_time_slot_id IS NULL;
        ALTER TABLE coach_class_assignment DROP COLUMN scheduling_category_id;
      END IF;
    END $$;
  `)
  try {
    await pool.query(`
      ALTER TABLE coach_class_assignment
        ADD CONSTRAINT coach_class_assignment_target_check
        CHECK (
          programs_id IS NOT NULL
          OR program_id IS NOT NULL
          OR scheduling_form_id IS NOT NULL
          OR scheduling_offering_id IS NOT NULL
          OR scheduling_time_slot_id IS NOT NULL
        )
    `)
  } catch (err) {
    if (!/already exists/i.test(String(err.message))) throw err
  }
  await pool.query(`
    ALTER TABLE coach_class_assignment
      DROP CONSTRAINT IF EXISTS coach_class_assignment_coach_user_id_program_id_class_iteration_id_key
  `)
  await pool.query(`DROP INDEX IF EXISTS ux_coach_class_assignment_program_only`)
  await pool.query(`DROP INDEX IF EXISTS ux_coach_class_assignment_scheduling_form`)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_coach_assignment_programs_top
      ON coach_class_assignment (coach_user_id, programs_id)
      WHERE programs_id IS NOT NULL
        AND program_id IS NULL
        AND scheduling_form_id IS NULL
        AND scheduling_offering_id IS NULL
        AND scheduling_time_slot_id IS NULL
  `)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_coach_assignment_class_event
      ON coach_class_assignment (coach_user_id, program_id)
      WHERE program_id IS NOT NULL
        AND programs_id IS NULL
        AND scheduling_form_id IS NULL
        AND scheduling_offering_id IS NULL
        AND scheduling_time_slot_id IS NULL
  `)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_coach_assignment_scheduling_form
      ON coach_class_assignment (coach_user_id, scheduling_form_id)
      WHERE scheduling_form_id IS NOT NULL
        AND scheduling_offering_id IS NULL
        AND scheduling_time_slot_id IS NULL
  `)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_coach_assignment_offering
      ON coach_class_assignment (coach_user_id, scheduling_offering_id)
      WHERE scheduling_offering_id IS NOT NULL
        AND scheduling_time_slot_id IS NULL
  `)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS ux_coach_assignment_time_slot
      ON coach_class_assignment (coach_user_id, scheduling_time_slot_id)
      WHERE scheduling_time_slot_id IS NOT NULL
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_coach_class_assignment_scheduling_form
      ON coach_class_assignment (scheduling_form_id)
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_coach_assignment_programs_id ON coach_class_assignment (programs_id)
  `)
}

/** Hierarchical drill-down for admin coach assignment (program → class → form → offering → timeslot). */
export async function queryCoachAssignmentDrilldown(pool, facilityId, filters = {}) {
  const fid = Number(facilityId)
  if (!Number.isFinite(fid)) {
    return { currentLevel: 'programs_top', levelLabel: COACH_ASSIGN_LEVEL_LABELS.programs_top, path: [], options: [] }
  }

  const schema = await resolveProgramsSchema(pool)
  const fk = schema.programFkColumn
  const programsId = num(filters.programsId)
  const classEventId = num(filters.classEventId)
  const formId = num(filters.formId)
  const offeringId = num(filters.offeringId)
  const path = []

  const mapOption = (row, level, hasChildren) => ({
    id: Number(row.id),
    label: row.label,
    level,
    hasChildren,
  })

  if (programsId != null) {
    const r = await pool.query(
      `SELECT id, display_name AS label FROM ${schema.programsTable} WHERE id = $1`,
      [programsId],
    )
    if (r.rows[0]) path.push({ level: 'programs_top', id: Number(r.rows[0].id), label: r.rows[0].label })
  }
  if (classEventId != null) {
    const r = await pool.query(
      `SELECT id, display_name AS label FROM program WHERE id = $1 AND facility_id = $2`,
      [classEventId, fid],
    )
    if (r.rows[0]) path.push({ level: 'class_event', id: Number(r.rows[0].id), label: r.rows[0].label })
  }
  if (formId != null) {
    const r = await pool.query(
      `SELECT id, title AS label FROM scheduling_form WHERE id = $1 AND deleted_at IS NULL`,
      [formId],
    )
    if (r.rows[0]) path.push({ level: 'scheduling_class', id: Number(r.rows[0].id), label: r.rows[0].label })
  }
  if (offeringId != null) {
    const r = await pool.query(
      `SELECT id, COALESCE(label, 'Offering ' || id::text) AS label FROM scheduling_offering WHERE id = $1`,
      [offeringId],
    )
    if (r.rows[0]) path.push({ level: 'offering', id: Number(r.rows[0].id), label: r.rows[0].label })
  }

  if (programsId == null) {
    const r = await pool.query(
      `
        SELECT id, display_name AS label
        FROM ${schema.programsTable}
        WHERE (facility_id = $1 OR facility_id IS NULL)
          AND COALESCE(archived, false) = FALSE
        ORDER BY display_name
      `,
      [fid],
    )
    const options = []
    for (const row of r.rows) {
      const child = await pool.query(
        `SELECT 1 FROM program p WHERE p.${fk} = $1 AND p.facility_id = $2 AND COALESCE(p.archived, false) = FALSE LIMIT 1`,
        [row.id, fid],
      )
      options.push(mapOption(row, 'programs_top', child.rows.length > 0))
    }
    return {
      currentLevel: 'programs_top',
      levelLabel: COACH_ASSIGN_LEVEL_LABELS.programs_top,
      path,
      options,
    }
  }

  if (classEventId == null) {
    const r = await pool.query(
      `
        SELECT id, display_name AS label
        FROM program p
        WHERE p.${fk} = $1 AND p.facility_id = $2 AND COALESCE(p.archived, false) = FALSE
        ORDER BY display_name
      `,
      [programsId, fid],
    )
    const options = []
    for (const row of r.rows) {
      const form = await pool.query(
        `SELECT 1 FROM scheduling_form sf WHERE sf.program_id = $1 AND sf.deleted_at IS NULL LIMIT 1`,
        [row.id],
      )
      options.push(mapOption(row, 'class_event', form.rows.length > 0))
    }
    return {
      currentLevel: 'class_event',
      levelLabel: COACH_ASSIGN_LEVEL_LABELS.class_event,
      path,
      options,
    }
  }

  if (formId == null) {
    const r = await pool.query(
      `
        SELECT sf.id, sf.title AS label
        FROM scheduling_form sf
        WHERE sf.program_id = $1 AND sf.deleted_at IS NULL AND COALESCE(sf.is_active, TRUE) = TRUE
        ORDER BY sf.title
      `,
      [classEventId],
    )
    const options = []
    for (const row of r.rows) {
      const off = await pool.query(`SELECT 1 FROM scheduling_offering WHERE form_id = $1 LIMIT 1`, [row.id])
      options.push(mapOption(row, 'scheduling_class', off.rows.length > 0))
    }
    if (options.length > 0) {
      return {
        currentLevel: 'scheduling_class',
        levelLabel: COACH_ASSIGN_LEVEL_LABELS.scheduling_class,
        path,
        options,
      }
    }
    // Fall through to offerings on class without explicit form row
  }

  const resolvedFormId = formId ?? (
    await pool.query(
      `SELECT id FROM scheduling_form WHERE program_id = $1 AND deleted_at IS NULL ORDER BY title, id LIMIT 1`,
      [classEventId],
    )
  ).rows[0]?.id

  if (!resolvedFormId) {
    return {
      currentLevel: 'scheduling_class',
      levelLabel: COACH_ASSIGN_LEVEL_LABELS.scheduling_class,
      path,
      options: [],
    }
  }

  const effectiveFormId = Number(resolvedFormId)

  if (formId == null && offeringId == null) {
    if (!path.some((p) => p.level === 'scheduling_class')) {
      const fr = await pool.query(`SELECT id, title AS label FROM scheduling_form WHERE id = $1`, [effectiveFormId])
      if (fr.rows[0]) {
        path.push({ level: 'scheduling_class', id: Number(fr.rows[0].id), label: fr.rows[0].label })
      }
    }
  }

  if (offeringId == null) {
    const offerings = await pool.query(
      `
        SELECT o.id, COALESCE(o.label, 'Offering ' || o.id::text) AS label
        FROM scheduling_offering o
        WHERE o.form_id = $1
        ORDER BY label
      `,
      [effectiveFormId],
    )
    const options = []
    for (const row of offerings.rows) {
      const slot = await pool.query(
        `
          SELECT 1 FROM scheduling_time_slot ts
          JOIN scheduling_slot_group sg ON sg.id = ts.slot_group_id
          WHERE sg.offering_id = $1
          LIMIT 1
        `,
        [row.id],
      )
      options.push(mapOption(row, 'offering', slot.rows.length > 0))
    }
    return {
      currentLevel: 'offering',
      levelLabel: COACH_ASSIGN_LEVEL_LABELS.offering,
      path,
      options,
    }
  }

  const slots = await pool.query(
    `
      SELECT DISTINCT ts.id, ts.day_of_week, ts.specific_date, ts.start_time, ts.end_time
      FROM scheduling_time_slot ts
      JOIN scheduling_slot_group sg ON sg.id = ts.slot_group_id
      WHERE sg.offering_id = $1 AND COALESCE(ts.is_active, TRUE) = TRUE
      ORDER BY ts.day_of_week NULLS LAST, ts.specific_date NULLS LAST, ts.start_time, ts.id
    `,
    [offeringId],
  )
  return {
    currentLevel: 'time_slot',
    levelLabel: COACH_ASSIGN_LEVEL_LABELS.time_slot,
    path,
    options: slots.rows.map((row) => mapOption({ id: row.id, label: formatTimeSlotLabel(row) }, 'time_slot', false)),
  }
}

/** Validate and normalize coach assignment payload for INSERT. */
export async function resolveCoachAssignmentPayload(pool, facilityId, body) {
  const schema = await resolveProgramsSchema(pool)
  const fk = schema.programFkColumn
  const targetLevel = String(body?.targetLevel || '').trim()
  const programsId = num(body?.programsId)
  const classEventId = num(body?.classEventId ?? body?.programId)
  const formId = num(body?.schedulingFormId)
  const offeringId = num(body?.schedulingOfferingId)
  const timeSlotId = num(body?.schedulingTimeSlotId)

  const empty = {
    programs_id: null,
    program_id: null,
    scheduling_form_id: null,
    scheduling_offering_id: null,
    scheduling_time_slot_id: null,
  }

  async function assertTopProgram(id) {
    const r = await pool.query(
      `SELECT id FROM ${schema.programsTable} WHERE id = $1 AND COALESCE(archived, false) = FALSE`,
      [id],
    )
    if (!r.rows[0]) throw new Error('Program not found.')
  }

  async function assertClassEvent(id, expectedProgramsId) {
    const r = await pool.query(
      `SELECT id, ${fk} AS programs_id FROM program WHERE id = $1 AND facility_id = $2`,
      [id, facilityId],
    )
    if (!r.rows[0]) throw new Error('Class not found.')
    if (expectedProgramsId != null && Number(r.rows[0].programs_id) !== expectedProgramsId) {
      throw new Error('Class does not belong to the selected program.')
    }
    return Number(r.rows[0].programs_id)
  }

  async function assertForm(id, expectedClassEventId) {
    const r = await pool.query(
      `SELECT id, program_id FROM scheduling_form WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    )
    if (!r.rows[0]) throw new Error('Scheduling class not found.')
    if (expectedClassEventId != null && Number(r.rows[0].program_id) !== expectedClassEventId) {
      throw new Error('Scheduling class does not belong to the selected class.')
    }
    return Number(r.rows[0].program_id)
  }

  if (targetLevel === 'time_slot') {
    if (timeSlotId == null) throw new Error('Timeslot is required.')
    const r = await pool.query(
      `
        SELECT ts.id, ts.form_id, sg.offering_id
        FROM scheduling_time_slot ts
        JOIN scheduling_slot_group sg ON sg.id = ts.slot_group_id
        LEFT JOIN scheduling_offering o ON o.id = sg.offering_id
        WHERE ts.id = $1
      `,
      [timeSlotId],
    )
    if (!r.rows[0]) throw new Error('Timeslot not found.')
    const row = r.rows[0]
    const resolvedClassEventId = await assertForm(Number(row.form_id), classEventId)
    if (classEventId != null && resolvedClassEventId !== classEventId) throw new Error('Timeslot does not match selected class.')
    return {
      ...empty,
      program_id: resolvedClassEventId,
      scheduling_form_id: Number(row.form_id),
      scheduling_offering_id: row.offering_id != null ? Number(row.offering_id) : null,
      scheduling_time_slot_id: timeSlotId,
    }
  }

  if (targetLevel === 'offering') {
    if (offeringId == null) throw new Error('Offering is required.')
    const r = await pool.query(
      `SELECT id, form_id FROM scheduling_offering WHERE id = $1`,
      [offeringId],
    )
    if (!r.rows[0]) throw new Error('Offering not found.')
    const resolvedClassEventId = await assertForm(Number(r.rows[0].form_id), classEventId)
    return {
      ...empty,
      program_id: resolvedClassEventId,
      scheduling_form_id: Number(r.rows[0].form_id),
      scheduling_offering_id: offeringId,
    }
  }

  if (targetLevel === 'scheduling_class') {
    if (formId == null) throw new Error('Scheduling class is required.')
    const resolvedClassEventId = await assertForm(formId, classEventId)
    return {
      ...empty,
      program_id: resolvedClassEventId,
      scheduling_form_id: formId,
    }
  }

  if (targetLevel === 'class_event') {
    if (classEventId == null) throw new Error('Class is required.')
    await assertClassEvent(classEventId, programsId)
    return { ...empty, program_id: classEventId }
  }

  if (targetLevel === 'programs_top') {
    if (programsId == null) throw new Error('Program is required.')
    await assertTopProgram(programsId)
    return { ...empty, programs_id: programsId }
  }

  throw new Error('Invalid assignment target level.')
}

/** Resolve program.id for a scheduling form in coach assignment flows. */
export async function resolveSchedulingFormAssignmentProgramId(pool, schedulingFormId, facilityId) {
  const schema = await resolveProgramsSchema(pool)
  const fk = schema.programFkColumn
  const programsLink = schema.hasSchedulingProgramsLink
    ? `OR (
        sf.program_id IS NULL
        AND sf.programs_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM program p WHERE p.${fk} = sf.programs_id AND p.facility_id = $2)
      )`
    : ''
  const resolvedSql = programsLink
    ? `COALESCE(
        sf.program_id,
        (SELECT p.id FROM program p
         WHERE p.${fk} = sf.programs_id AND p.facility_id = $2
         ORDER BY p.display_name, p.id
         LIMIT 1)
      )`
    : 'sf.program_id'
  const r = await pool.query(
    `
      SELECT ${resolvedSql} AS program_id
      FROM scheduling_form sf
      WHERE sf.id = $1
        AND sf.deleted_at IS NULL
        AND (
          EXISTS (SELECT 1 FROM program p WHERE p.id = sf.program_id AND p.facility_id = $2)
          ${programsLink}
        )
    `,
    [schedulingFormId, facilityId],
  )
  if (!r.rows[0]?.program_id) return null
  return Number(r.rows[0].program_id)
}

export async function getCoachClassAssignment(pool, assignmentId, coachUserId) {
  const r = await pool.query(
    `SELECT * FROM coach_class_assignment WHERE id = $1 AND coach_user_id = $2`,
    [assignmentId, coachUserId],
  )
  return r.rows[0] ?? null
}

/** SQL match: scheduling signup satisfies assignment scope (parameterized). */
function rosterSignupMatchSql({
  programFkColumn,
  includeProgramsLink,
  programsIdx,
  programIdx,
  formIdx,
  offeringIdx,
  timeSlotIdx,
}) {
  const programsTopMatch = includeProgramsLink
    ? `(sf.programs_id = $${programsIdx} OR EXISTS (
        SELECT 1 FROM program px WHERE px.id = sf.program_id AND px.${programFkColumn} = $${programsIdx}
      ))`
    : `EXISTS (
        SELECT 1 FROM program px WHERE px.id = sf.program_id AND px.${programFkColumn} = $${programsIdx}
      )`

  return `
    (
      ($${timeSlotIdx}::bigint IS NOT NULL AND s.time_slot_id = $${timeSlotIdx})
      OR (
        $${timeSlotIdx}::bigint IS NULL
        AND $${offeringIdx}::bigint IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM scheduling_time_slot ts
          JOIN scheduling_slot_group sg ON sg.id = ts.slot_group_id
          WHERE ts.id = s.time_slot_id AND sg.offering_id = $${offeringIdx}
        )
      )
      OR (
        $${timeSlotIdx}::bigint IS NULL
        AND $${offeringIdx}::bigint IS NULL
        AND $${formIdx}::bigint IS NOT NULL
        AND s.form_id = $${formIdx}
      )
      OR (
        $${timeSlotIdx}::bigint IS NULL
        AND $${offeringIdx}::bigint IS NULL
        AND $${formIdx}::bigint IS NULL
        AND $${programIdx}::bigint IS NOT NULL
        AND sf.program_id = $${programIdx}
      )
      OR (
        $${timeSlotIdx}::bigint IS NULL
        AND $${offeringIdx}::bigint IS NULL
        AND $${formIdx}::bigint IS NULL
        AND $${programIdx}::bigint IS NULL
        AND $${programsIdx}::bigint IS NOT NULL
        AND ${programsTopMatch}
      )
    )
  `
}

/** SQL match for coach_class_assignment alias against scheduling_signup. */
export function coachAssignmentSignupMatchSql(ccaAlias, programFkColumn, includeProgramsLink) {
  const programsTopMatch = includeProgramsLink
    ? `(sf.programs_id = ${ccaAlias}.programs_id OR EXISTS (
        SELECT 1 FROM program px WHERE px.id = sf.program_id AND px.${programFkColumn} = ${ccaAlias}.programs_id
      ))`
    : `EXISTS (
        SELECT 1 FROM program px WHERE px.id = sf.program_id AND px.${programFkColumn} = ${ccaAlias}.programs_id
      )`

  return `
    (
      (${ccaAlias}.scheduling_time_slot_id IS NOT NULL AND s.time_slot_id = ${ccaAlias}.scheduling_time_slot_id)
      OR (
        ${ccaAlias}.scheduling_time_slot_id IS NULL
        AND ${ccaAlias}.scheduling_offering_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM scheduling_time_slot ts
          JOIN scheduling_slot_group sg ON sg.id = ts.slot_group_id
          WHERE ts.id = s.time_slot_id AND sg.offering_id = ${ccaAlias}.scheduling_offering_id
        )
      )
      OR (
        ${ccaAlias}.scheduling_time_slot_id IS NULL
        AND ${ccaAlias}.scheduling_offering_id IS NULL
        AND ${ccaAlias}.scheduling_form_id IS NOT NULL
        AND s.form_id = ${ccaAlias}.scheduling_form_id
      )
      OR (
        ${ccaAlias}.scheduling_time_slot_id IS NULL
        AND ${ccaAlias}.scheduling_offering_id IS NULL
        AND ${ccaAlias}.scheduling_form_id IS NULL
        AND ${ccaAlias}.program_id IS NOT NULL
        AND sf.program_id = ${ccaAlias}.program_id
      )
      OR (
        ${ccaAlias}.scheduling_time_slot_id IS NULL
        AND ${ccaAlias}.scheduling_offering_id IS NULL
        AND ${ccaAlias}.scheduling_form_id IS NULL
        AND ${ccaAlias}.program_id IS NULL
        AND ${ccaAlias}.programs_id IS NOT NULL
        AND ${programsTopMatch}
      )
    )
  `
}

function assignmentScopeEmpty(row) {
  return !row.programs_id
    && !row.program_id
    && !row.scheduling_form_id
    && !row.scheduling_offering_id
    && !row.scheduling_time_slot_id
}

/** Member IDs enrolled in a coach's program/class assignment (scheduling + legacy). */
export async function queryCoachRosterMemberIds(pool, assignment, facilityId) {
  const schema = await resolveProgramsSchema(pool)
  const row = assignment ?? {}
  if (assignmentScopeEmpty(row)) return []

  const programsId = row.programs_id != null ? Number(row.programs_id) : null
  const pid = row.program_id != null ? Number(row.program_id) : null
  const formId = row.scheduling_form_id != null ? Number(row.scheduling_form_id) : null
  const offeringId = row.scheduling_offering_id != null ? Number(row.scheduling_offering_id) : null
  const timeSlotId = row.scheduling_time_slot_id != null ? Number(row.scheduling_time_slot_id) : null

  const signupFilter = rosterSignupMatchSql({
    programFkColumn: schema.programFkColumn,
    includeProgramsLink: schema.hasSchedulingProgramsLink,
    programsIdx: 1,
    programIdx: 2,
    formIdx: 3,
    offeringIdx: 4,
    timeSlotIdx: 5,
  })

  const r = await pool.query(
    `
      SELECT DISTINCT m.id
      FROM scheduling_signup s
      JOIN scheduling_form sf ON sf.id = s.form_id AND sf.deleted_at IS NULL
      JOIN member m ON m.id = s.member_id
      WHERE m.facility_id = $6
        AND m.is_active = TRUE
        AND s.member_id IS NOT NULL
        AND s.orphaned_at IS NULL
        AND s.status IN ('confirmed', 'waitlisted')
        ${signupFilter}
    `,
    [programsId, pid, formId, offeringId, timeSlotId, facilityId],
  )
  return r.rows.map((row) => Number(row.id))
}

/** Full roster rows for coach UI (waivers, attendance notes). */
export async function queryCoachRosterMembers(pool, {
  programId,
  schedulingFormId,
  programsId,
  schedulingOfferingId,
  schedulingTimeSlotId,
  facilityId,
  assignmentId,
  coachUserId,
}) {
  const assignment = {
    programs_id: programsId,
    program_id: programId,
    scheduling_form_id: schedulingFormId,
    scheduling_offering_id: schedulingOfferingId,
    scheduling_time_slot_id: schedulingTimeSlotId,
  }
  const schema = await resolveProgramsSchema(pool)
  const programsTop = assignment.programs_id != null ? Number(assignment.programs_id) : null
  const pid = assignment.program_id != null ? Number(assignment.program_id) : null
  const formId = assignment.scheduling_form_id != null ? Number(assignment.scheduling_form_id) : null
  const offeringId = assignment.scheduling_offering_id != null ? Number(assignment.scheduling_offering_id) : null
  const timeSlotId = assignment.scheduling_time_slot_id != null ? Number(assignment.scheduling_time_slot_id) : null

  const signupFilter = rosterSignupMatchSql({
    programFkColumn: schema.programFkColumn,
    includeProgramsLink: schema.hasSchedulingProgramsLink,
    programsIdx: 1,
    programIdx: 2,
    formIdx: 3,
    offeringIdx: 4,
    timeSlotIdx: 5,
  })

  const r = await pool.query(
    `
      WITH roster_ids AS (
        SELECT DISTINCT m.id
        FROM scheduling_signup s
        JOIN scheduling_form sf ON sf.id = s.form_id AND sf.deleted_at IS NULL
        JOIN member m ON m.id = s.member_id
        WHERE m.facility_id = $6
          AND m.is_active = TRUE
          AND s.member_id IS NOT NULL
          AND s.orphaned_at IS NULL
          AND s.status IN ('confirmed', 'waitlisted')
          ${signupFilter}
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
        ON crn.assignment_id = $8
       AND crn.member_id = m.id
       AND crn.coach_user_id = $9
       AND crn.note_date = CURRENT_DATE
      ORDER BY m.last_name, m.first_name
    `,
    [programsTop, pid, formId, offeringId, timeSlotId, facilityId, assignmentId, coachUserId],
  )
  return r.rows
}

/** Members for plan_assignment when target_type = 'class' (target_id = coach_class_assignment.id). */
export async function getMembersForCoachClassTarget(pool, coachClassAssignmentId, facilityId) {
  await ensureCoachClassAssignmentSchema(pool)
  const a = await pool.query(`SELECT * FROM coach_class_assignment WHERE id = $1`, [coachClassAssignmentId])
  if (a.rows.length === 0) return []
  const ids = await queryCoachRosterMemberIds(pool, a.rows[0], facilityId)
  if (ids.length === 0) return []
  const members = await pool.query(
    `SELECT id, email, first_name FROM member WHERE id = ANY($1::bigint[]) AND facility_id = $2`,
    [ids, facilityId],
  )
  return members.rows
}

/** Coach user IDs linked to a member via program enrollment (scheduling + legacy). */
export async function queryCoachUserIdsForMember(pool, memberId, facilityId) {
  await ensureCoachClassAssignmentSchema(pool)
  const schema = await resolveProgramsSchema(pool)
  const signupMatch = coachAssignmentSignupMatchSql('cca', schema.programFkColumn, schema.hasSchedulingProgramsLink)
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
            AND ${signupMatch}
        )
      )
    `,
    [memberId, facilityId],
  )
  return r.rows.map((row) => Number(row.coach_user_id)).filter((id) => Number.isFinite(id))
}

/** All member IDs across coach's assigned classes (scheduling + legacy). */
export async function queryCoachAssignedMemberIds(pool, coachUserId, facilityId) {
  await ensureCoachClassAssignmentSchema(pool)
  const classes = await pool.query(`SELECT * FROM coach_class_assignment WHERE coach_user_id = $1`, [coachUserId])
  const idSet = new Set()
  for (const c of classes.rows) {
    const ids = await queryCoachRosterMemberIds(pool, c, facilityId)
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
