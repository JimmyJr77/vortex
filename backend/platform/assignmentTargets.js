/**
 * Plan assignment target resolution: members who receive an assignment
 * and labeled options for coach Assign UI.
 */

import { getMembersForCoachClassTarget } from './coachRoster.js'

const ACTIVE_SIGNUP = `
  s.member_id IS NOT NULL
  AND s.orphaned_at IS NULL
  AND s.status IN ('confirmed', 'waitlisted')
`

/** Member IDs for a plan_assignment target (notifications, fan-out). */
export async function queryAssignmentTargetMemberIds(pool, { targetType, targetId, facilityId }) {
  const tid = Number(targetId)
  const fid = Number(facilityId)
  if (!Number.isFinite(tid) || !Number.isFinite(fid)) return []

  if (targetType === 'member') {
    const r = await pool.query(
      `SELECT id FROM member WHERE id = $1 AND facility_id = $2 AND is_active = TRUE`,
      [tid, fid],
    )
    return r.rows.map((row) => Number(row.id))
  }

  if (targetType === 'family') {
    const r = await pool.query(
      `SELECT id FROM member WHERE family_id = $1 AND facility_id = $2 AND is_active = TRUE`,
      [tid, fid],
    )
    return r.rows.map((row) => Number(row.id))
  }

  if (targetType === 'class') {
    const rows = await getMembersForCoachClassTarget(pool, tid, fid)
    return rows.map((row) => Number(row.id))
  }

  if (targetType === 'program') {
    const r = await pool.query(
      `
        SELECT DISTINCT m.id
        FROM member m
        WHERE m.facility_id = $2 AND m.is_active = TRUE
          AND (
            EXISTS (
              SELECT 1 FROM scheduling_signup s
              JOIN scheduling_form sf ON sf.id = s.form_id AND sf.deleted_at IS NULL
              WHERE s.member_id = m.id AND sf.program_id = $1 AND ${ACTIVE_SIGNUP}
            )
            OR EXISTS (
              SELECT 1 FROM member_program mp
              WHERE mp.member_id = m.id AND mp.program_id = $1
            )
          )
      `,
      [tid, fid],
    )
    return r.rows.map((row) => Number(row.id))
  }

  if (targetType === 'scheduling_class') {
    const r = await pool.query(
      `
        SELECT DISTINCT m.id
        FROM scheduling_signup s
        JOIN member m ON m.id = s.member_id
        WHERE m.facility_id = $2 AND m.is_active = TRUE
          AND s.form_id = $1 AND ${ACTIVE_SIGNUP}
      `,
      [tid, fid],
    )
    return r.rows.map((row) => Number(row.id))
  }

  if (targetType === 'category') {
    const r = await pool.query(
      `
        SELECT DISTINCT m.id
        FROM scheduling_signup s
        JOIN member m ON m.id = s.member_id
        WHERE m.facility_id = $2 AND m.is_active = TRUE
          AND s.category_id = $1 AND ${ACTIVE_SIGNUP}
      `,
      [tid, fid],
    )
    return r.rows.map((row) => Number(row.id))
  }

  if (targetType === 'offering') {
    const r = await pool.query(
      `
        SELECT DISTINCT m.id
        FROM scheduling_signup s
        JOIN member m ON m.id = s.member_id
        WHERE m.facility_id = $2 AND m.is_active = TRUE
          AND s.offering_id = $1 AND ${ACTIVE_SIGNUP}
      `,
      [tid, fid],
    )
    return r.rows.map((row) => Number(row.id))
  }

  if (targetType === 'primary_sport') {
    const r = await pool.query(
      `
        SELECT DISTINCT m.id
        FROM scheduling_signup s
        JOIN scheduling_form sf ON sf.id = s.form_id AND sf.deleted_at IS NULL
        JOIN member m ON m.id = s.member_id
        JOIN programs p ON p.id = sf.programs_id
        WHERE m.facility_id = $2 AND m.is_active = TRUE
          AND p.primary_discipline_tag_id = $1 AND ${ACTIVE_SIGNUP}
      `,
      [tid, fid],
    )
    return r.rows.map((row) => Number(row.id))
  }

  return []
}

/**
 * SQL fragment: member $memberIdx matches plan_assignment row aliased as `pa`.
 * Params: memberId at $memberIdx, familyId at $familyIdx (nullable).
 */
export function planAssignmentMemberMatchSql(memberIdx, familyIdx) {
  return `
    (pa.target_type = 'member' AND pa.target_id = $${memberIdx})
    OR (pa.target_type = 'family' AND $${familyIdx}::bigint IS NOT NULL AND pa.target_id = $${familyIdx})
    OR (pa.target_type = 'class' AND EXISTS (
      SELECT 1 FROM coach_class_assignment cca
      WHERE cca.id = pa.target_id
        AND (
          EXISTS (
            SELECT 1 FROM scheduling_signup s
            JOIN scheduling_form sf ON sf.id = s.form_id AND sf.deleted_at IS NULL
            WHERE s.member_id = $${memberIdx}
              AND s.orphaned_at IS NULL
              AND s.status IN ('confirmed', 'waitlisted')
              AND cca.program_id IS NOT NULL
              AND sf.program_id = cca.program_id
          )
          OR EXISTS (
            SELECT 1 FROM member_program mp
            WHERE mp.member_id = $${memberIdx}
              AND (
                (cca.class_iteration_id IS NOT NULL AND mp.iteration_id = cca.class_iteration_id)
                OR (cca.class_iteration_id IS NULL AND cca.program_id IS NOT NULL AND mp.program_id = cca.program_id)
              )
          )
        )
    ))
    OR (pa.target_type = 'program' AND (
      EXISTS (
        SELECT 1 FROM scheduling_signup s
        JOIN scheduling_form sf ON sf.id = s.form_id AND sf.deleted_at IS NULL
        WHERE s.member_id = $${memberIdx}
          AND s.orphaned_at IS NULL
          AND s.status IN ('confirmed', 'waitlisted')
          AND sf.program_id = pa.target_id
      )
      OR EXISTS (
        SELECT 1 FROM member_program mp
        WHERE mp.member_id = $${memberIdx} AND mp.program_id = pa.target_id
      )
    ))
    OR (pa.target_type = 'scheduling_class' AND EXISTS (
      SELECT 1 FROM scheduling_signup s
      WHERE s.member_id = $${memberIdx}
        AND s.form_id = pa.target_id
        AND s.orphaned_at IS NULL
        AND s.status IN ('confirmed', 'waitlisted')
    ))
    OR (pa.target_type = 'category' AND EXISTS (
      SELECT 1 FROM scheduling_signup s
      WHERE s.member_id = $${memberIdx}
        AND s.category_id = pa.target_id
        AND s.orphaned_at IS NULL
        AND s.status IN ('confirmed', 'waitlisted')
    ))
    OR (pa.target_type = 'offering' AND EXISTS (
      SELECT 1 FROM scheduling_signup s
      WHERE s.member_id = $${memberIdx}
        AND s.offering_id = pa.target_id
        AND s.orphaned_at IS NULL
        AND s.status IN ('confirmed', 'waitlisted')
    ))
    OR (pa.target_type = 'primary_sport' AND EXISTS (
      SELECT 1 FROM scheduling_signup s
      JOIN scheduling_form sf ON sf.id = s.form_id AND sf.deleted_at IS NULL
      JOIN programs p ON p.id = sf.programs_id
      WHERE s.member_id = $${memberIdx}
        AND p.primary_discipline_tag_id = pa.target_id
        AND s.orphaned_at IS NULL
        AND s.status IN ('confirmed', 'waitlisted')
    ))
  `
}

/** Labeled target options for coach Assign dropdown (facility-scoped). */
export async function queryAssignTargetOptions(pool, { type, facilityId }) {
  const fid = Number(facilityId)
  if (!Number.isFinite(fid)) return []

  if (type === 'primary_sport') {
    const r = await pool.query(
      `
        SELECT DISTINCT dt.id, dt.name AS label
        FROM discipline_tag dt
        JOIN programs p ON p.primary_discipline_tag_id = dt.id
        WHERE dt.facility_id = $1
        ORDER BY dt.name
      `,
      [fid],
    )
    return r.rows.map((row) => ({ id: Number(row.id), label: row.label }))
  }

  if (type === 'program') {
    const r = await pool.query(
      `
        SELECT id, display_name AS label
        FROM program
        WHERE facility_id = $1 AND is_active = TRUE
        ORDER BY display_name
      `,
      [fid],
    )
    return r.rows.map((row) => ({ id: Number(row.id), label: row.label }))
  }

  if (type === 'scheduling_class') {
    const r = await pool.query(
      `
        SELECT sf.id, sf.title AS label
        FROM scheduling_form sf
        LEFT JOIN program p ON p.id = sf.program_id
        LEFT JOIN programs top ON top.id = sf.programs_id
        WHERE sf.deleted_at IS NULL AND sf.is_active = TRUE
          AND (p.facility_id = $1 OR top.facility_id = $1)
        ORDER BY sf.title
      `,
      [fid],
    )
    return r.rows.map((row) => ({ id: Number(row.id), label: row.label }))
  }

  if (type === 'category') {
    const r = await pool.query(
      `
        SELECT DISTINCT sc.id, sc.name AS label
        FROM scheduling_category sc
        JOIN scheduling_form_category sfc ON sfc.category_id = sc.id
        JOIN scheduling_form sf ON sf.id = sfc.form_id AND sf.deleted_at IS NULL
        LEFT JOIN program p ON p.id = sf.program_id
        LEFT JOIN programs top ON top.id = sf.programs_id
        WHERE (p.facility_id = $1 OR top.facility_id = $1)
        ORDER BY sc.name
      `,
      [fid],
    )
    return r.rows.map((row) => ({ id: Number(row.id), label: row.label }))
  }

  if (type === 'offering') {
    const r = await pool.query(
      `
        SELECT o.id, COALESCE(o.label, sf.title) AS label
        FROM scheduling_offering o
        JOIN scheduling_form sf ON sf.id = o.form_id AND sf.deleted_at IS NULL
        LEFT JOIN program p ON p.id = sf.program_id
        LEFT JOIN programs top ON top.id = sf.programs_id
        WHERE (p.facility_id = $1 OR top.facility_id = $1)
        ORDER BY label
      `,
      [fid],
    )
    return r.rows.map((row) => ({ id: Number(row.id), label: row.label }))
  }

  return []
}
