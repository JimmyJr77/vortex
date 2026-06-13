/**
 * Split "merged" classes created by the old Export to Programs & Classes flow.
 *
 * A merged class is a single `program` row whose scheduling form is linked to
 * more than one scheduling_category. The current export creates one class row
 * per category; this script retrofits existing merged rows to match:
 *   - The first category stays on the original row/form.
 *   - Each additional category becomes a new program row (same display_name,
 *     unique hidden internal name) with its own scheduling form linked to that
 *     one category, and is unlinked from the original form.
 *
 * Usage (from backend/):
 *   node scripts/split-merged-classes.mjs            # dry run, prints the plan
 *   node scripts/split-merged-classes.mjs --apply    # perform the split
 *
 * Run it against whichever database holds the merged rows, e.g. production:
 *   DATABASE_URL='postgres://...' node scripts/split-merged-classes.mjs --apply
 */
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pkg from 'pg'

const { Pool } = pkg
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envLocal = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envLocal)) dotenv.config({ path: envLocal })
else dotenv.config()

const APPLY = process.argv.includes('--apply')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DB_URL,
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'vortex_athletics',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

async function resolveFkColumn(client) {
  const colCheck = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'program' AND column_name IN ('programs_id', 'category_id')
  `)
  const cols = new Set(colCheck.rows.map((r) => r.column_name))
  return cols.has('programs_id') ? 'programs_id' : 'category_id'
}

async function uniqueInternalName(client, facilityId, category, baseName) {
  for (let attempt = 1; attempt <= 200; attempt++) {
    const candidate = attempt === 1 ? baseName : `${baseName}_${attempt}`
    const existing = await client.query(
      'SELECT 1 FROM program WHERE facility_id = $1 AND category = $2 AND name = $3 LIMIT 1',
      [facilityId, category, candidate],
    )
    if (existing.rows.length === 0) return candidate
  }
  throw new Error(`Could not derive a unique internal name from "${baseName}"`)
}

async function run() {
  const client = await pool.connect()
  try {
    const fkCol = await resolveFkColumn(client)

    const merged = await client.query(`
      SELECT p.id AS program_id, p.display_name, p.facility_id, p.category,
             p.${fkCol} AS parent_id, p.skill_level, p.age_min, p.age_max,
             p.description, p.skill_requirements, p.is_active,
             sf.id AS form_id, sf.description AS form_description,
             array_agg(sfc.category_id ORDER BY sfc.category_id) AS category_ids,
             array_agg(sc.name ORDER BY sfc.category_id) AS category_names
      FROM program p
      JOIN scheduling_form sf ON sf.program_id = p.id AND sf.deleted_at IS NULL
      JOIN scheduling_form_category sfc ON sfc.form_id = sf.id
      LEFT JOIN scheduling_category sc ON sc.id = sfc.category_id
      WHERE p.archived = FALSE
      GROUP BY p.id, sf.id
      HAVING count(sfc.category_id) > 1
      ORDER BY p.id
    `)

    if (merged.rows.length === 0) {
      console.log('No merged classes found. Nothing to do.')
      return
    }

    console.log(`Found ${merged.rows.length} merged class(es):`)
    for (const row of merged.rows) {
      console.log(
        `  program #${row.program_id} "${row.display_name}" (form #${row.form_id}) -> categories [${row.category_names.join(', ')}]`,
      )
    }

    if (!APPLY) {
      console.log('\nDry run only. Re-run with --apply to perform the split.')
      return
    }

    for (const row of merged.rows) {
      const [keepCategoryId, ...extraCategoryIds] = row.category_ids
      await client.query('BEGIN')
      try {
        // Keep only the first category on the original form.
        await client.query(
          'DELETE FROM scheduling_form_category WHERE form_id = $1 AND category_id <> $2',
          [row.form_id, keepCategoryId],
        )

        for (const categoryId of extraCategoryIds) {
          const baseName = row.display_name.toUpperCase().replace(/\s+/g, '_')
          const internalName = await uniqueInternalName(
            client,
            row.facility_id,
            row.category,
            baseName,
          )

          const inserted = await client.query(
            `INSERT INTO program
               (facility_id, category, ${fkCol}, name, display_name, skill_level,
                age_min, age_max, description, skill_requirements, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING id`,
            [
              row.facility_id,
              row.category,
              row.parent_id,
              internalName,
              row.display_name,
              row.skill_level,
              row.age_min,
              row.age_max,
              row.description,
              row.skill_requirements,
              row.is_active,
            ],
          )
          const newProgramId = inserted.rows[0].id

          const newForm = await client.query(
            `INSERT INTO scheduling_form (title, description, is_active, program_id)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [row.display_name, row.form_description, row.is_active, newProgramId],
          )
          const newFormId = newForm.rows[0].id

          await client.query(
            `INSERT INTO scheduling_form_category (form_id, category_id)
             VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [newFormId, categoryId],
          )

          console.log(
            `  split: program #${row.program_id} -> new program #${newProgramId} (form #${newFormId}) for category #${categoryId}`,
          )
        }

        await client.query('COMMIT')
      } catch (err) {
        await client.query('ROLLBACK')
        console.error(`Failed to split program #${row.program_id}:`, err.message)
        throw err
      }
    }

    console.log('\nDone. Merged classes have been split.')
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
