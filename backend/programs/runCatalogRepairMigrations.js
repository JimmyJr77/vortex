import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const REPAIR_MIGRATIONS = [
  '237_remove_recreated_legacy_classes.sql',
  '238_repair_scheduling_form_program_activation.sql',
  '239_align_active_classes_with_public_enrollment.sql',
]

/** Run targeted catalog data repairs once on hosts whose start command does not run migrations. */
export async function runCatalogRepairMigrations(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id BIGSERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      checksum TEXT,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  for (const filename of REPAIR_MIGRATIONS) {
    const alreadyApplied = await pool.query(
      'SELECT 1 FROM schema_migrations WHERE filename = $1 LIMIT 1',
      [filename],
    )
    if (alreadyApplied.rows.length > 0) continue

    const migrationPath = path.join(__dirname, '..', 'migrations', filename)
    const sql = fs.readFileSync(migrationPath, 'utf8')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query(
        `INSERT INTO schema_migrations (filename) VALUES ($1)
         ON CONFLICT (filename) DO NOTHING`,
        [filename],
      )
      await client.query('COMMIT')
      console.log(`[programs] Applied catalog repair migration: ${filename}`)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
}
