/**
 * Plan assignment target resolution: members who receive an assignment
 * and labeled options for coach Assign UI.
 */

import { getMembersForCoachClassTarget } from './coachRoster.js'
import { resolveProgramsSchema } from '../programs/schema.js'

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

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

const DRILL_LEVEL_LABELS = {
  primary_sport: 'Sport',
  program: 'Program',
  scheduling_class: 'Class',
  category: 'Category',
  offering: 'Offering',
}

/** Hierarchical drill-down for coach Assign → Class targeting. */
export async function queryAssignDrilldown(pool, facilityId, filters = {}) {
  const fid = Number(facilityId)
  if (!Number.isFinite(fid)) {
    return { currentLevel: 'primary_sport', levelLabel: 'Sport', path: [], options: [] }
  }

  const sportId = num(filters.sportId)
  const programId = num(filters.programId)
  const formId = num(filters.formId)
  const categoryId = num(filters.categoryId)
  const schema = await resolveProgramsSchema(pool)
  const path = []

  if (sportId != null) {
    const r = await pool.query(
      `SELECT id, name AS label FROM discipline_tag WHERE id = $1 AND facility_id = $2`,
      [sportId, fid],
    )
    if (r.rows[0]) {
      path.push({ level: 'primary_sport', id: Number(r.rows[0].id), label: r.rows[0].label })
    }
  }
  if (programId != null) {
    const r = await pool.query(
      `SELECT id, display_name AS label FROM program WHERE id = $1 AND facility_id = $2`,
      [programId, fid],
    )
    if (r.rows[0]) {
      path.push({ level: 'program', id: Number(r.rows[0].id), label: r.rows[0].label })
    }
  }
  if (formId != null) {
    const r = await pool.query(
      `SELECT id, title AS label FROM scheduling_form WHERE id = $1 AND deleted_at IS NULL`,
      [formId],
    )
    if (r.rows[0]) {
      path.push({ level: 'scheduling_class', id: Number(r.rows[0].id), label: r.rows[0].label })
    }
  }
  if (categoryId != null) {
    const r = await pool.query(`SELECT id, name AS label FROM scheduling_category WHERE id = $1`, [categoryId])
    if (r.rows[0]) {
      path.push({ level: 'category', id: Number(r.rows[0].id), label: r.rows[0].label })
    }
  }

  const mapOption = (row, level, hasChildren) => ({
    id: Number(row.id),
    label: row.label,
    level,
    hasChildren,
  })

  if (sportId == null) {
    const r = await pool.query(
      `
        SELECT DISTINCT dt.id, dt.name AS label
        FROM discipline_tag dt
        WHERE dt.facility_id = $1
          AND EXISTS (
            SELECT 1 FROM ${schema.programsTable} top
            WHERE top.primary_discipline_tag_id = dt.id
              AND (top.facility_id = $1 OR top.facility_id IS NULL)
          )
        ORDER BY dt.name
      `,
      [fid],
    )
    return {
      currentLevel: 'primary_sport',
      levelLabel: DRILL_LEVEL_LABELS.primary_sport,
      path,
      options: r.rows.map((row) => mapOption(row, 'primary_sport', true)),
    }
  }

  if (programId == null) {
    const r = await pool.query(
      `
        SELECT DISTINCT p.id, p.display_name AS label
        FROM program p
        LEFT JOIN ${schema.programsTable} top ON top.id = p.${schema.programFkColumn}
        WHERE p.facility_id = $1 AND p.is_active = TRUE
          AND top.primary_discipline_tag_id = $2
        ORDER BY p.display_name
      `,
      [fid, sportId],
    )
    const options = []
    for (const row of r.rows) {
      const child = await pool.query(
        `SELECT 1 FROM scheduling_form sf
         WHERE sf.program_id = $1 AND sf.deleted_at IS NULL AND sf.is_active = TRUE LIMIT 1`,
        [row.id],
      )
      options.push(mapOption(row, 'program', child.rows.length > 0))
    }
    return {
      currentLevel: 'program',
      levelLabel: DRILL_LEVEL_LABELS.program,
      path,
      options,
    }
  }

  if (formId == null) {
    const r = await pool.query(
      `
        SELECT sf.id, sf.title AS label
        FROM scheduling_form sf
        WHERE sf.program_id = $1 AND sf.deleted_at IS NULL AND sf.is_active = TRUE
        ORDER BY sf.title
      `,
      [programId],
    )
    const options = []
    for (const row of r.rows) {
      const cat = await pool.query(
        `SELECT 1 FROM scheduling_form_category WHERE form_id = $1 LIMIT 1`,
        [row.id],
      )
      const off = await pool.query(
        `SELECT 1 FROM scheduling_offering WHERE form_id = $1 LIMIT 1`,
        [row.id],
      )
      options.push(mapOption(row, 'scheduling_class', cat.rows.length > 0 || off.rows.length > 0))
    }
    return {
      currentLevel: 'scheduling_class',
      levelLabel: DRILL_LEVEL_LABELS.scheduling_class,
      path,
      options,
    }
  }

  if (categoryId == null) {
    const categories = await pool.query(
      `
        SELECT DISTINCT sc.id, sc.name AS label
        FROM scheduling_category sc
        JOIN scheduling_form_category sfc ON sfc.category_id = sc.id AND sfc.form_id = $1
        ORDER BY sc.name
      `,
      [formId],
    )
    if (categories.rows.length > 0) {
      const options = []
      for (const row of categories.rows) {
        const off = await pool.query(
          `SELECT 1 FROM scheduling_offering WHERE form_id = $1 AND category_id = $2 LIMIT 1`,
          [formId, row.id],
        )
        options.push(mapOption(row, 'category', off.rows.length > 0))
      }
      return {
        currentLevel: 'category',
        levelLabel: DRILL_LEVEL_LABELS.category,
        path,
        options,
      }
    }
  }

  const offerings = await pool.query(
    `
      SELECT o.id, COALESCE(o.label, 'Offering ' || o.id::text) AS label
      FROM scheduling_offering o
      WHERE o.form_id = $1
        AND ($2::bigint IS NULL OR o.category_id = $2 OR o.category_id IS NULL)
      ORDER BY label
    `,
    [formId, categoryId],
  )
  return {
    currentLevel: 'offering',
    levelLabel: DRILL_LEVEL_LABELS.offering,
    path,
    options: offerings.rows.map((row) => mapOption(row, 'offering', false)),
  }
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
