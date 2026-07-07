/**
 * Apply canonical coaching constraints before the boot migration loop.
 * Prevents legacy infrastructure migrations from shrinking exercise_phase_subrole_check.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let bootRepairPromise = null

export async function applyCoachingBootConstraints(pool) {
  const migrationPath = path.join(__dirname, '..', 'migrations', '228_coaching_boot_constraint_canonical.sql')
  const sql = fs.readFileSync(migrationPath, 'utf8')
  await pool.query(sql)
  console.log('[applyCoachingBootConstraints] Canonical coaching constraints ready')
}

export async function ensureCoachingBootConstraints(pool) {
  if (!bootRepairPromise) {
    bootRepairPromise = applyCoachingBootConstraints(pool).catch((err) => {
      bootRepairPromise = null
      throw err
    })
  }
  return bootRepairPromise
}
