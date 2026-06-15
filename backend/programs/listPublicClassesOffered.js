/**
 * Public classes-offered overview grouped by top-level program.
 */
export async function listPublicClassesOffered(pool) {
  const { resolveProgramsSchema } = await import('./schema.js')
  const schema = await resolveProgramsSchema(pool)

  const columnCheck = await pool.query(
    `
    SELECT column_name FROM information_schema.columns
    WHERE table_name = $1 AND column_name = 'description'
    `,
    [schema.programsTable],
  )
  const hasDescription = columnCheck.rows.length > 0

  const programsResult = await pool.query(
    `
    SELECT
      id,
      display_name AS "displayName",
      ${hasDescription ? 'description' : 'NULL AS description'}
    FROM ${schema.programsTable}
    WHERE archived = FALSE
    ORDER BY display_name ASC
    `,
  )

  const classesResult = await pool.query(
    `
    SELECT
      p.id,
      p.${schema.programFkColumn} AS "programsId",
      p.display_name AS "displayName",
      p.description,
      p.skill_level AS "skillLevel",
      p.age_min AS "ageMin",
      p.age_max AS "ageMax",
      p.skill_requirements AS "skillRequirements",
      sf.id AS "formId"
    FROM program p
    LEFT JOIN scheduling_form sf
      ON sf.program_id = p.id
      AND sf.deleted_at IS NULL
      AND sf.is_active = TRUE
    WHERE p.archived = FALSE
      AND p.is_active = TRUE
      AND p.${schema.programFkColumn} IS NOT NULL
    ORDER BY p.display_name ASC
    `,
  )

  const classesByProgram = new Map()
  for (const row of classesResult.rows) {
    const programsId = Number(row.programsId)
    if (!classesByProgram.has(programsId)) {
      classesByProgram.set(programsId, [])
    }
    const formId = row.formId != null ? Number(row.formId) : null
    classesByProgram.get(programsId).push({
      id: Number(row.id),
      displayName: row.displayName,
      description: row.description ?? null,
      skillLevel: row.skillLevel ?? null,
      ageMin: row.ageMin != null ? Number(row.ageMin) : null,
      ageMax: row.ageMax != null ? Number(row.ageMax) : null,
      skillRequirements: row.skillRequirements ?? null,
      formId,
      signupUrl: formId != null ? `/enroll?form=${formId}` : null,
    })
  }

  const programs = programsResult.rows
    .map((prog) => {
      const classes = classesByProgram.get(Number(prog.id)) ?? []
      if (classes.length === 0) return null
      return {
        id: Number(prog.id),
        displayName: prog.displayName,
        description: prog.description ?? null,
        classes,
      }
    })
    .filter(Boolean)

  return { programs }
}
