/**
 * Consolidation engine for the Classes <-> Scheduling model.
 *
 * Target invariant: ONE class = one `program` row + one `scheduling_form`.
 * All scheduling data (offerings, slot groups, time slots, signups) lives
 * under that single form. The Admin > Classes table, the Scheduling tab, and
 * the public /scheduling page each show one entry per class.
 *
 * This reverses the earlier "physical split" model, which created a separate
 * program row + form per category.
 *
 * Safety guarantees:
 *  - Scheduling rows (offerings, slot groups, time slots, signups) are only
 *    MOVED between forms by re-pointing `form_id`.
 *  - Child rows referencing a merged-away program (enrollments, iterations,
 *    etc.) are re-pointed to the canonical program before it is deleted.
 *  - Everything runs in a single transaction; on any error it rolls back.
 *  - Idempotent: once each class has a single program/form, re-running is a
 *    no-op.
 */

import { resolveProgramsSchema } from './schema.js'

const SCHEDULING_DATA_TABLES = [
  'scheduling_offering',
  'scheduling_slot_group',
  'scheduling_time_slot',
  'scheduling_signup',
]

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
 * the destination form already has a selected offering (one selected offering
 * per form).
 */
async function demoteConflictingSelectedOfferings(client, fromFormId, toFormId) {
  await client.query(
    `UPDATE scheduling_offering o
     SET is_selected = FALSE, updated_at = now()
     WHERE o.form_id = $1 AND o.is_selected = TRUE
       AND EXISTS (
         SELECT 1 FROM scheduling_offering c
         WHERE c.form_id = $2 AND c.is_selected = TRUE
       )`,
    [fromFormId, toFormId],
  )
}

/** Move all scheduling data from one form onto another. */
async function moveFormData(client, fromFormId, toFormId) {
  if (fromFormId === toFormId) return
  await demoteConflictingSelectedOfferings(client, fromFormId, toFormId)
  for (const tbl of SCHEDULING_DATA_TABLES) {
    await client.query(`UPDATE ${tbl} SET form_id = $1 WHERE form_id = $2`, [toFormId, fromFormId])
  }
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
