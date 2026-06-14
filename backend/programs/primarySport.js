import { resolveProgramsSchema } from './schema.js'

export async function setProgramPrimarySport(pool, programsId, tagId) {
  const schema = await resolveProgramsSchema(pool)
  const table = schema.programsTable

  if (tagId != null) {
    const tagCheck = await pool.query('SELECT id FROM discipline_tag WHERE id = $1', [tagId])
    if (tagCheck.rows.length === 0) {
      const err = new Error('Discipline tag not found')
      err.statusCode = 400
      throw err
    }
  }

  await pool.query(
    `UPDATE ${table} SET primary_discipline_tag_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
    [tagId, programsId],
  )

  if (tagId != null) {
    await pool.query(
      'DELETE FROM program_discipline_tag WHERE programs_id = $1 AND tag_id = $2',
      [programsId, tagId],
    )
  }
}

export async function getProgramPrimarySportFields(pool, programsId) {
  const schema = await resolveProgramsSchema(pool)
  const result = await pool.query(
    `SELECT dt.id as "primarySportId", dt.name as "primarySportName"
     FROM ${schema.programsTable} p
     LEFT JOIN discipline_tag dt ON dt.id = p.primary_discipline_tag_id
     WHERE p.id = $1`,
    [programsId],
  )
  return result.rows[0] ?? { primarySportId: null, primarySportName: null }
}
