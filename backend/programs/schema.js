/** Resolves program taxonomy table/column names after unify migration. */

export async function resolveProgramsSchema(pool) {
  const tableCheck = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('programs', 'program_categories')
  `)
  const names = new Set(tableCheck.rows.map((r) => r.table_name))
  const programsTable = names.has('programs') ? 'programs' : 'program_categories'

  const colCheck = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'program'
      AND column_name IN ('programs_id', 'category_id')
  `)
  const cols = new Set(colCheck.rows.map((r) => r.column_name))
  const programFkColumn = cols.has('programs_id') ? 'programs_id' : 'category_id'

  const formColCheck = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'scheduling_form'
      AND column_name IN ('programs_id', 'program_id')
  `)
  const formCols = new Set(formColCheck.rows.map((r) => r.column_name))

  return {
    programsTable,
    programFkColumn,
    hasSchedulingProgramLink: formCols.has('program_id'),
    hasSchedulingProgramsLink: formCols.has('programs_id'),
  }
}

export async function hasProgramSchedulingColumns(pool, programsTable) {
  const colCheck = await pool.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_name = $1 AND column_name = 'scheduling_active' LIMIT 1`,
    [programsTable],
  )
  return colCheck.rows.length > 0
}

export function mapProgramRow(row, { hasSchedulingCols = false, hasDescription = true } = {}) {
  const base = {
    id: Number(row.id),
    name: row.name,
    displayName: row.display_name,
    description: hasDescription ? row.description : null,
    archived: row.archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
  if (!hasSchedulingCols) return base
  return {
    ...base,
    schedulingActive: Boolean(row.scheduling_active),
    schedulingSignupFields: row.scheduling_signup_fields ?? null,
    schedulingMandateWaiver: Boolean(row.scheduling_mandate_waiver),
    schedulingOverviewSavedAt: row.scheduling_overview_saved_at ?? null,
  }
}

export async function ensureProgramsSchedulingSchema(pool) {
  const fs = await import('fs')
  const path = await import('path')
  const { fileURLToPath } = await import('url')
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const migrationPath = path.join(__dirname, '../migrations/unify_programs_scheduling.sql')
  if (!fs.existsSync(migrationPath)) return
  const sql = fs.readFileSync(migrationPath, 'utf8')
  await pool.query(sql)
}

let disciplineTagsSchemaReady = false

export async function ensureDisciplineTagsSchema(pool) {
  if (disciplineTagsSchemaReady) return
  const fs = await import('fs')
  const path = await import('path')
  const { fileURLToPath } = await import('url')
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const migrationPath = path.join(__dirname, '../migrations/add_discipline_tags.sql')
  if (!fs.existsSync(migrationPath)) return
  const sql = fs.readFileSync(migrationPath, 'utf8')
  await pool.query(sql)
  disciplineTagsSchemaReady = true
}
