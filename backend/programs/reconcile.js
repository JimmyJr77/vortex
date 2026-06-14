/**
 * Consolidation engine for the Classes <-> Scheduling model.
 *
 * Target invariant: ONE class = one `program` row + one `scheduling_form`.
 * A class's category "variations" live entirely under that single form
 * (scheduling_form_category links plus the `category_id` on offerings / slot
 * groups / time slots / signups). The Admin > Classes table fans those
 * categories out into one row per (class x category); the Scheduling tab and
 * the public /scheduling page show one entry per class.
 *
 * This reverses the earlier "physical split" model, which created a separate
 * program row + form per category.
 *
 * Safety guarantees:
 *  - Scheduling rows (offerings, slot groups, time slots, signups) are only
 *    MOVED between forms by re-pointing `form_id`; their `category_id` is
 *    preserved, so the categories simply coexist under the canonical form.
 *  - Child rows referencing a merged-away program (enrollments, iterations,
 *    etc.) are re-pointed to the canonical program before it is deleted.
 *  - Everything runs in a single transaction; on any error it rolls back.
 *  - Idempotent: once each class has a single program/form, re-running is a
 *    no-op.
 */

import { resolveProgramsSchema } from './schema.js'
import { ensureNoCategoryCategory, resolveSchedulingCategoryId } from './noCategory.js'

const SCHEDULING_DATA_TABLES = [
  'scheduling_offering',
  'scheduling_slot_group',
  'scheduling_time_slot',
  'scheduling_signup',
]

async function tableColumns(client, tableName) {
  const res = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
    [tableName],
  )
  return new Set(res.rows.map((r) => r.column_name))
}

/** Tables (other than scheduling_form) with a FK column pointing at program(id). */
async function programChildTables(client) {
  const res = await client.query(`
    SELECT tc.table_name AS table_name, kcu.column_name AS column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'program'
      AND ccu.column_name = 'id'
  `)
  return res.rows
    .filter((r) => r.table_name !== 'scheduling_form')
    .map((r) => ({ table: r.table_name, column: r.column_name }))
}

/**
 * Demote `is_selected` on offerings being moved from one form to another when
 * the destination form already has a selected offering for the same category
 * (respecting the two partial unique indexes, including the NULL-category one).
 */
async function demoteConflictingSelectedOfferings(client, fromFormId, toFormId) {
  await client.query(
    `UPDATE scheduling_offering o
     SET is_selected = FALSE, updated_at = now()
     WHERE o.form_id = $1 AND o.is_selected = TRUE
       AND EXISTS (
         SELECT 1 FROM scheduling_offering c
         WHERE c.form_id = $2 AND c.is_selected = TRUE
           AND c.category_id IS NOT DISTINCT FROM o.category_id
       )`,
    [fromFormId, toFormId],
  )
}

/** Move all scheduling data + category links from one form onto another. */
async function moveFormData(client, fromFormId, toFormId) {
  if (fromFormId === toFormId) return
  await demoteConflictingSelectedOfferings(client, fromFormId, toFormId)
  for (const tbl of SCHEDULING_DATA_TABLES) {
    await client.query(`UPDATE ${tbl} SET form_id = $1 WHERE form_id = $2`, [toFormId, fromFormId])
  }
  await client.query(
    `INSERT INTO scheduling_form_category (form_id, category_id)
     SELECT $1, category_id FROM scheduling_form_category WHERE form_id = $2
     ON CONFLICT DO NOTHING`,
    [toFormId, fromFormId],
  )
  await client.query('DELETE FROM scheduling_form_category WHERE form_id = $1', [fromFormId])
}

/**
 * Merge duplicate `program` rows that share the same parent + display name back
 * into a single canonical class, moving all scheduling data onto the canonical
 * form.
 *
 * @param {import('pg').Pool} pool
 * @param {{ parentProgramId?: number|null, programId?: number|null }} [opts]
 * @returns {Promise<{ groups: number, merged: number, formsMerged: number, removed: number }>}
 */
export async function consolidateClasses(pool, opts = {}) {
  const { parentProgramId = null, programId = null } = opts
  const schema = await resolveProgramsSchema(pool)
  const fkCol = schema.programFkColumn

  const client = await pool.connect()
  const stats = { groups: 0, merged: 0, formsMerged: 0, removed: 0 }
  try {
    await client.query('BEGIN')
    await ensureNoCategoryCategory(client)

    const childTables = await programChildTables(client)

    // Limit the set of (parent, display_name) groups we touch.
    const params = []
    let scopeWhere = 'p.archived = FALSE'
    if (programId != null) {
      params.push(programId)
      scopeWhere += ` AND p.${fkCol} = (SELECT ${fkCol} FROM program WHERE id = $${params.length})
                      AND p.display_name = (SELECT display_name FROM program WHERE id = $${params.length})`
    } else if (parentProgramId != null) {
      params.push(parentProgramId)
      scopeWhere += ` AND p.${fkCol} = $${params.length}`
    }

    const groupsRes = await client.query(
      `SELECT p.${fkCol} AS parent_id, p.display_name,
              array_agg(p.id ORDER BY p.id) AS program_ids
       FROM program p
       WHERE ${scopeWhere}
       GROUP BY p.${fkCol}, p.display_name
       HAVING COUNT(*) > 1
       ORDER BY p.${fkCol}, p.display_name`,
      params,
    )

    for (const group of groupsRes.rows) {
      stats.groups += 1
      const programIds = group.program_ids.map((id) => Number(id))
      const canonicalProgramId = programIds[0]
      const siblingProgramIds = programIds.slice(1)

      // All live forms belonging to any program in this group.
      const formsRes = await client.query(
        `SELECT id, program_id FROM scheduling_form
         WHERE program_id = ANY($1::bigint[]) AND deleted_at IS NULL
         ORDER BY id`,
        [programIds],
      )
      const formIds = formsRes.rows.map((r) => Number(r.id))

      let canonicalFormId = formIds[0] ?? null
      if (canonicalFormId != null) {
        // Make sure the canonical form belongs to the canonical program.
        await client.query(
          'UPDATE scheduling_form SET program_id = $1 WHERE id = $2',
          [canonicalProgramId, canonicalFormId],
        )
        // Fold every other live form into the canonical one.
        for (const formId of formIds.slice(1)) {
          await moveFormData(client, formId, canonicalFormId)
          await client.query(
            'UPDATE scheduling_form SET deleted_at = now(), is_active = FALSE, updated_at = now() WHERE id = $1',
            [formId],
          )
          stats.formsMerged += 1
        }
        // Keep the canonical form title in sync with the class display name.
        await client.query(
          `UPDATE scheduling_form sf
           SET title = p.display_name, updated_at = now()
           FROM program p
           WHERE sf.id = $1 AND p.id = $2 AND sf.title IS DISTINCT FROM p.display_name`,
          [canonicalFormId, canonicalProgramId],
        )
      }

      // Re-point child rows of sibling programs to the canonical program so we
      // never lose enrollments / iterations when removing the duplicate row.
      if (siblingProgramIds.length > 0) {
        for (const { table, column } of childTables) {
          await client.query(
            `UPDATE ${table} SET ${column} = $1 WHERE ${column} = ANY($2::bigint[])`,
            [canonicalProgramId, siblingProgramIds],
          )
        }
        // Deleting the sibling programs cascades to their (now empty) forms.
        const removed = await client.query(
          'DELETE FROM program WHERE id = ANY($1::bigint[]) RETURNING id',
          [siblingProgramIds],
        )
        stats.removed += removed.rowCount
        stats.merged += 1
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

/**
 * Backwards-compatible alias. The historical name `reconcileClasses` now runs
 * the consolidation engine (the split behavior was removed).
 */
export async function reconcileClasses(pool, opts = {}) {
  return consolidateClasses(pool, opts)
}

async function resolveClassFormId(client, programId) {
  const res = await client.query(
    'SELECT id FROM scheduling_form WHERE program_id = $1 AND deleted_at IS NULL ORDER BY id LIMIT 1',
    [programId],
  )
  return res.rows[0]?.id ?? null
}

/** Is `categoryId` still referenced by any scheduling data on the form? */
async function categoryStillUsed(client, formId, categoryId) {
  if (categoryId == null) return false
  const res = await client.query(
    `SELECT 1 FROM (
       SELECT category_id FROM scheduling_offering WHERE form_id = $1
       UNION ALL SELECT category_id FROM scheduling_slot_group WHERE form_id = $1
       UNION ALL SELECT category_id FROM scheduling_time_slot WHERE form_id = $1
       UNION ALL SELECT category_id FROM scheduling_signup WHERE form_id = $1
     ) x WHERE category_id = $2 LIMIT 1`,
    [formId, categoryId],
  )
  return res.rows.length > 0
}

/**
 * Re-point a single category "variation" of a class to a different category,
 * moving only the scheduling data tagged with `fromCategoryId`. `null` means
 * the "No Category" variation (uncategorized data).
 *
 * @param {import('pg').Pool} pool
 * @param {number} programId
 * @param {number|null} fromCategoryId
 * @param {number|null} toCategoryId
 */
export async function reassignVariationCategory(pool, programId, fromCategoryId, toCategoryId) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const noCategoryId = await ensureNoCategoryCategory(client)

    const fromOff = fromCategoryId == null || fromCategoryId === noCategoryId ? null : Number(fromCategoryId)
    const toOff = toCategoryId == null || toCategoryId === noCategoryId ? null : Number(toCategoryId)
    // scheduling_signup.category_id is NOT NULL — use the system id for "none".
    const fromSignup = fromOff == null ? noCategoryId : fromOff
    const toSignup = toOff == null ? noCategoryId : toOff

    const formId = await resolveClassFormId(client, programId)
    if (formId != null && fromOff !== toOff) {
      // Avoid violating the selected-offering unique index when the target
      // category already has a selected offering.
      await client.query(
        `UPDATE scheduling_offering o
         SET is_selected = FALSE, updated_at = now()
         WHERE o.form_id = $1 AND o.is_selected = TRUE
           AND o.category_id IS NOT DISTINCT FROM $2
           AND EXISTS (
             SELECT 1 FROM scheduling_offering c
             WHERE c.form_id = $1 AND c.is_selected = TRUE
               AND c.category_id IS NOT DISTINCT FROM $3
           )`,
        [formId, fromOff, toOff],
      )
      for (const tbl of ['scheduling_offering', 'scheduling_slot_group', 'scheduling_time_slot']) {
        await client.query(
          `UPDATE ${tbl} SET category_id = $1 WHERE form_id = $2 AND category_id IS NOT DISTINCT FROM $3`,
          [toOff, formId, fromOff],
        )
      }
      await client.query(
        'UPDATE scheduling_signup SET category_id = $1 WHERE form_id = $2 AND category_id = $3',
        [toSignup, formId, fromSignup],
      )

      // Maintain the form-category links.
      if (toOff != null) {
        await client.query(
          'INSERT INTO scheduling_form_category (form_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [formId, toOff],
        )
      }
      if (fromOff != null && !(await categoryStillUsed(client, formId, fromOff))) {
        await client.query(
          'DELETE FROM scheduling_form_category WHERE form_id = $1 AND category_id = $2',
          [formId, fromOff],
        )
      }
    }

    await client.query('COMMIT')
    return { programId, formId, fromCategoryId: fromOff, toCategoryId: toOff }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/**
 * Add a new category "variation" to a class by linking the category to its form.
 * Creates a new Admin > Classes row (the category now appears under the class).
 *
 * @param {import('pg').Pool} pool
 * @param {number} programId
 * @param {number|null} categoryId  null = "No Category" (no-op link)
 */
export async function addVariationCategory(pool, programId, categoryId) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const noCategoryId = await ensureNoCategoryCategory(client)
    const formId = await resolveClassFormId(client, programId)
    const realCategoryId = categoryId == null || categoryId === noCategoryId ? null : Number(categoryId)
    if (formId != null && realCategoryId != null) {
      await client.query(
        'INSERT INTO scheduling_form_category (form_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [formId, realCategoryId],
      )
    }
    await client.query('COMMIT')
    return { programId, formId, categoryId: realCategoryId }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

/**
 * Legacy single-category setter, retained for the existing
 * PUT /api/admin/programs/:id/scheduling-category route. Re-points ALL of the
 * class form's scheduling data to one category (or "No Category").
 */
export async function setProgramSchedulingCategory(pool, programId, newCategoryId) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const noCategoryId = await ensureNoCategoryCategory(client)
    const resolvedCategoryId = await resolveSchedulingCategoryId(client, newCategoryId)
    const schedulingDataCategoryId = resolvedCategoryId === noCategoryId ? null : resolvedCategoryId

    const formId = await resolveClassFormId(client, programId)

    await client.query('UPDATE program SET scheduling_category_id = $1 WHERE id = $2', [resolvedCategoryId, programId])

    if (formId != null) {
      for (const tbl of ['scheduling_offering', 'scheduling_slot_group', 'scheduling_time_slot']) {
        await client.query(`UPDATE ${tbl} SET category_id = $1 WHERE form_id = $2`, [schedulingDataCategoryId, formId])
      }
      await client.query('UPDATE scheduling_signup SET category_id = $1 WHERE form_id = $2', [resolvedCategoryId, formId])
      if (schedulingDataCategoryId == null) {
        await client.query('DELETE FROM scheduling_form_category WHERE form_id = $1', [formId])
      } else {
        await client.query('DELETE FROM scheduling_form_category WHERE form_id = $1 AND category_id <> $2', [formId, schedulingDataCategoryId])
        await client.query(
          'INSERT INTO scheduling_form_category (form_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [formId, schedulingDataCategoryId],
        )
      }
    }

    await client.query('COMMIT')
    return { programId, schedulingCategoryId: resolvedCategoryId, formId }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
