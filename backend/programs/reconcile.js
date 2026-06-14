/**
 * Reconcile / split engine for Classes <-> Scheduling category sync.
 *
 * Invariant after a run: every active `program` row (a class) maps to AT MOST
 * one scheduling category, stored in `program.scheduling_category_id`, and its
 * 1:1 scheduling form holds only that category's offerings / slot groups /
 * time slots / signups.
 *
 * Safety guarantees:
 *  - Scheduling rows (offerings, slot groups, time slots, signups) are only
 *    MOVED between forms by re-pointing `form_id`. They are never deleted.
 *  - Order is always read Scheduling -> write Classes.
 *  - Idempotent: once every row has <= 1 category, re-running is a no-op.
 *  - Never archives or deletes a `program` row. A row that ends up with no
 *    category simply becomes "No Category".
 */

import { resolveProgramsSchema } from './schema.js'

async function tableColumns(client, tableName) {
  const res = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
    [tableName],
  )
  return new Set(res.rows.map((r) => r.column_name))
}

async function uniqueInternalName(client, facilityId, category, baseName) {
  for (let attempt = 1; attempt <= 500; attempt++) {
    const candidate = attempt === 1 ? baseName : `${baseName}_${attempt}`
    const existing = await client.query(
      'SELECT 1 FROM program WHERE facility_id = $1 AND category = $2 AND name = $3 LIMIT 1',
      [facilityId, category, candidate],
    )
    if (existing.rows.length === 0) return candidate
  }
  throw new Error(`Could not derive a unique internal name from "${baseName}"`)
}

/** Distinct category ids touching a form (NULL excluded — "No Category"). */
async function distinctCategoryIds(client, formId) {
  const res = await client.query(
    `SELECT DISTINCT category_id FROM (
       SELECT category_id FROM scheduling_form_category WHERE form_id = $1
       UNION
       SELECT category_id FROM scheduling_offering WHERE form_id = $1 AND category_id IS NOT NULL
       UNION
       SELECT category_id FROM scheduling_slot_group WHERE form_id = $1 AND category_id IS NOT NULL
       UNION
       SELECT category_id FROM scheduling_time_slot WHERE form_id = $1 AND category_id IS NOT NULL
     ) x
     WHERE category_id IS NOT NULL
     ORDER BY category_id`,
    [formId],
  )
  return res.rows.map((r) => Number(r.category_id))
}

/**
 * @param {import('pg').Pool} pool
 * @param {{ parentProgramId?: number|null, programId?: number|null }} [opts]
 * @returns {Promise<{ scanned: number, split: number, created: number, assigned: number }>}
 */
export async function reconcileClasses(pool, opts = {}) {
  const { parentProgramId = null, programId = null } = opts
  const schema = await resolveProgramsSchema(pool)
  const fkCol = schema.programFkColumn

  const client = await pool.connect()
  const stats = { scanned: 0, split: 0, created: 0, assigned: 0 }
  try {
    await client.query('BEGIN')

    const programCols = await tableColumns(client, 'program')
    const formCols = await tableColumns(client, 'scheduling_form')
    const hasLevelId = programCols.has('level_id')
    const hasSkillReq = programCols.has('skill_requirements')

    // Columns to copy when cloning a scheduling form for a split category.
    // `title` is set explicitly to the class display name (not copied) so split
    // forms never inherit a stale title.
    const formCopyCandidates = [
      'description', 'start_date', 'end_date', 'is_active',
      'programs_id', 'mandate_waiver', 'signup_fields',
      'max_slots_per_user', 'slot_cost_monthly_cents', 'free_slots_per_user',
    ]
    const formCopyCols = formCopyCandidates.filter((c) => formCols.has(c))

    const params = []
    let where = 'sf.deleted_at IS NULL AND sf.program_id IS NOT NULL AND p.archived = FALSE'
    if (programId != null) {
      params.push(programId)
      where += ` AND p.id = $${params.length}`
    } else if (parentProgramId != null) {
      params.push(parentProgramId)
      where += ` AND p.${fkCol} = $${params.length}`
    }

    const classes = await client.query(
      `SELECT p.id AS program_id, p.facility_id, p.category, p.${fkCol} AS parent_id,
              p.display_name, p.skill_level, p.age_min, p.age_max, p.description,
              ${hasSkillReq ? 'p.skill_requirements,' : 'NULL AS skill_requirements,'}
              ${hasLevelId ? 'p.level_id,' : 'NULL::bigint AS level_id,'}
              p.is_active, p.scheduling_category_id,
              sf.id AS form_id
       FROM program p
       JOIN scheduling_form sf ON sf.program_id = p.id AND sf.deleted_at IS NULL
       WHERE ${where}
       ORDER BY p.id`,
      params,
    )
    stats.scanned = classes.rows.length

    for (const row of classes.rows) {
      const cats = await distinctCategoryIds(client, row.form_id)

      // 0 or 1 category: just make sure the mapping column matches. No split.
      if (cats.length <= 1) {
        const single = cats.length === 1 ? cats[0] : null
        const current = row.scheduling_category_id == null ? null : Number(row.scheduling_category_id)
        if (current !== single) {
          await client.query('UPDATE program SET scheduling_category_id = $1 WHERE id = $2', [single, row.program_id])
          stats.assigned += 1
        }
        if (single != null) {
          await normalizeFormCategory(client, row.form_id, single)
        }
        continue
      }

      // More than one category: keep one on the original row, split the rest.
      let keep = cats[0]
      const current = row.scheduling_category_id == null ? null : Number(row.scheduling_category_id)
      if (current != null && cats.includes(current)) keep = current
      const extras = cats.filter((c) => c !== keep)

      // Original row keeps `keep`.
      await client.query('UPDATE program SET scheduling_category_id = $1 WHERE id = $2', [keep, row.program_id])
      await normalizeFormCategory(client, row.form_id, keep)
      stats.split += 1

      for (const catId of extras) {
        const baseName = String(row.display_name || 'CLASS').toUpperCase().replace(/\s+/g, '_')
        const internalName = await uniqueInternalName(client, row.facility_id, row.category, baseName)

        const insertCols = ['facility_id', 'category', fkCol, 'name', 'display_name',
          'skill_level', 'age_min', 'age_max', 'description', 'is_active', 'scheduling_category_id']
        const insertVals = [row.facility_id, row.category, row.parent_id, internalName, row.display_name,
          row.skill_level, row.age_min, row.age_max, row.description, row.is_active, catId]
        if (hasSkillReq) { insertCols.splice(9, 0, 'skill_requirements'); insertVals.splice(9, 0, row.skill_requirements) }
        if (hasLevelId) { insertCols.push('level_id'); insertVals.push(row.level_id) }

        const placeholders = insertVals.map((_, i) => `$${i + 1}`).join(', ')
        const inserted = await client.query(
          `INSERT INTO program (${insertCols.join(', ')}) VALUES (${placeholders}) RETURNING id`,
          insertVals,
        )
        const newProgramId = inserted.rows[0].id
        stats.created += 1

        // Clone the form config for the new row; title follows the class name.
        const selectCols = formCopyCols.join(', ')
        const newForm = await client.query(
          `INSERT INTO scheduling_form (${formCopyCols.join(', ')}, program_id, title)
           SELECT ${selectCols}, $1, $2 FROM scheduling_form WHERE id = $3
           RETURNING id`,
          [newProgramId, row.display_name, row.form_id],
        )
        const newFormId = newForm.rows[0].id

        // MOVE this category's scheduling data to the new form (re-point only).
        for (const tbl of ['scheduling_offering', 'scheduling_slot_group', 'scheduling_time_slot', 'scheduling_signup']) {
          await client.query(
            `UPDATE ${tbl} SET form_id = $1 WHERE form_id = $2 AND category_id IS NOT DISTINCT FROM $3`,
            [newFormId, row.form_id, catId],
          )
        }

        // Move the form-category link.
        await client.query('DELETE FROM scheduling_form_category WHERE form_id = $1 AND category_id = $2', [row.form_id, catId])
        await normalizeFormCategory(client, newFormId, catId)
      }
    }

    await client.query('COMMIT')
    return stats
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/** Ensure the form's only form_category link is `categoryId`. */
async function normalizeFormCategory(client, formId, categoryId) {
  if (categoryId == null) {
    await client.query('DELETE FROM scheduling_form_category WHERE form_id = $1', [formId])
    return
  }
  await client.query('DELETE FROM scheduling_form_category WHERE form_id = $1 AND category_id <> $2', [formId, categoryId])
  await client.query(
    'INSERT INTO scheduling_form_category (form_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [formId, categoryId],
  )
}

/**
 * Bidirectional edit: re-point a single class row's form data to `newCategoryId`
 * (or NULL for "No Category"). Used by the Classes UI category dropdown.
 */
export async function setProgramSchedulingCategory(pool, programId, newCategoryId) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const formRes = await client.query(
      'SELECT id FROM scheduling_form WHERE program_id = $1 AND deleted_at IS NULL ORDER BY id LIMIT 1',
      [programId],
    )
    const formId = formRes.rows[0]?.id ?? null

    await client.query('UPDATE program SET scheduling_category_id = $1 WHERE id = $2', [newCategoryId, programId])

    if (formId != null) {
      // offering / slot_group / time_slot accept NULL category ("No Category").
      for (const tbl of ['scheduling_offering', 'scheduling_slot_group', 'scheduling_time_slot']) {
        await client.query(`UPDATE ${tbl} SET category_id = $1 WHERE form_id = $2`, [newCategoryId, formId])
      }
      // scheduling_signup.category_id is NOT NULL — only re-point to a real category.
      if (newCategoryId != null) {
        await client.query('UPDATE scheduling_signup SET category_id = $1 WHERE form_id = $2', [newCategoryId, formId])
      }
      await normalizeFormCategory(client, formId, newCategoryId)
    }

    await client.query('COMMIT')
    return { programId, schedulingCategoryId: newCategoryId, formId }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
