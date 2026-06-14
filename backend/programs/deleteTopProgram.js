import { resolveProgramsSchema } from './schema.js'

/**
 * Permanently delete a top-level program and all child classes + scheduling data.
 */
export async function deleteTopProgramCascade(pool, topProgramId) {
  const schema = await resolveProgramsSchema(pool)
  const { programsTable, programFkColumn } = schema
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    const topRes = await client.query(`SELECT id FROM ${programsTable} WHERE id = $1`, [topProgramId])
    if (topRes.rows.length === 0) {
      await client.query('ROLLBACK')
      return { found: false, deletedClasses: 0 }
    }

    const childrenRes = await client.query(
      `SELECT id FROM program WHERE ${programFkColumn} = $1`,
      [topProgramId],
    )
    const classIds = childrenRes.rows.map((r) => Number(r.id))

    for (const classId of classIds) {
      await client.query('DELETE FROM program WHERE id = $1', [classId])
    }

    try {
      await client.query('DELETE FROM program_discipline_tag WHERE programs_id = $1', [topProgramId])
    } catch {
      /* discipline tags optional */
    }

    await client.query('DELETE FROM scheduling_form WHERE programs_id = $1', [topProgramId])

    const delRes = await client.query(
      `DELETE FROM ${programsTable} WHERE id = $1 RETURNING id`,
      [topProgramId],
    )
    if (delRes.rows.length === 0) {
      throw new Error('Program delete failed')
    }

    await client.query('COMMIT')
    return { found: true, deletedClasses: classIds.length }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
