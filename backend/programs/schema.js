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
  const schedulingActive = Boolean(row.scheduling_active)
  const schedulingEnrollSites = schedulingActive
    ? Array.isArray(row.scheduling_enroll_sites) && row.scheduling_enroll_sites.length > 0
      ? row.scheduling_enroll_sites
      : ['athletics', 'gymnastics', 'basketball']
    : []
  return {
    ...base,
    schedulingActive,
    schedulingEnrollSites,
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

let primaryDisciplineTagReady = false

export async function ensurePrimaryDisciplineTagColumn(pool) {
  if (primaryDisciplineTagReady) return
  await ensureDisciplineTagsSchema(pool)
  const fs = await import('fs')
  const path = await import('path')
  const { fileURLToPath } = await import('url')
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const migrationPath = path.join(__dirname, '../migrations/add_primary_discipline_tag.sql')
  if (!fs.existsSync(migrationPath)) return
  const sql = fs.readFileSync(migrationPath, 'utf8')
  await pool.query(sql)
  primaryDisciplineTagReady = true
}

let programPricingReady = false

export async function ensureProgramPricingColumns(pool) {
  if (programPricingReady) return
  const fs = await import('fs')
  const path = await import('path')
  const { fileURLToPath } = await import('url')
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const migrationPath = path.join(__dirname, '../migrations/add_program_pricing_defaults.sql')
  if (!fs.existsSync(migrationPath)) return
  const sql = fs.readFileSync(migrationPath, 'utf8')
  await pool.query(sql)
  programPricingReady = true

  const costOptionsPath = path.join(__dirname, '../migrations/048_program_pricing_cost_options.sql')
  if (fs.existsSync(costOptionsPath)) {
    await pool.query(fs.readFileSync(costOptionsPath, 'utf8'))
  }

  const multiClassPassPath = path.join(__dirname, '../migrations/049_multi_class_pass.sql')
  if (fs.existsSync(multiClassPassPath)) {
    await pool.query(fs.readFileSync(multiClassPassPath, 'utf8'))
  }
}

let discountEngineReady = false

async function runDiscountMigrationFile(pool, migrationsDir, filename) {
  const fs = await import('fs')
  const path = await import('path')
  const migrationPath = path.join(migrationsDir, filename)
  if (!fs.existsSync(migrationPath)) return
  await pool.query(fs.readFileSync(migrationPath, 'utf8'))
}

/** Applies the discount/promo engine schema (cost cadence, rules, tiers, ledger, caps). */
export async function ensureDiscountEngineSchema(pool) {
  await ensureProgramPricingColumns(pool)
  await ensurePrimaryDisciplineTagColumn(pool)
  const fs = await import('fs')
  const path = await import('path')
  const { fileURLToPath } = await import('url')
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const migrationsDir = path.join(__dirname, '../migrations')

  // Legacy column backfill before base migrations create indexes on discount_rule.
  await runDiscountMigrationFile(pool, migrationsDir, 'patch_discount_rule_legacy_columns.sql')

  if (!discountEngineReady) {
    const migrationPath = path.join(migrationsDir, 'add_discount_engine.sql')
    if (!fs.existsSync(migrationPath)) return
    const sql = fs.readFileSync(migrationPath, 'utf8')
    await pool.query(sql)
    const promoCodesPath = path.join(migrationsDir, 'add_program_pricing_promo_codes.sql')
    if (fs.existsSync(promoCodesPath)) {
      await pool.query(fs.readFileSync(promoCodesPath, 'utf8'))
    }
    const additionalFeesPath = path.join(migrationsDir, 'add_additional_fees.sql')
    if (fs.existsSync(additionalFeesPath)) {
      await pool.query(fs.readFileSync(additionalFeesPath, 'utf8'))
    }
    discountEngineReady = true
  }

  // Idempotent patches — re-run after base schema exists (handles hot deploys).
  await runDiscountMigrationFile(pool, migrationsDir, 'add_discount_tier_eligibility.sql')
  await runDiscountMigrationFile(pool, migrationsDir, 'add_spend_volume_discount_type.sql')
  await runDiscountMigrationFile(pool, migrationsDir, 'remove_baked_system_discount_rules.sql')
}
