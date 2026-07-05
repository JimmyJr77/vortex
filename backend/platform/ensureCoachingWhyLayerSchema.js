import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const WHY_LAYER_MIGRATIONS = [
  '078_coaching_session_phases.sql',
  '079_coaching_education_content.sql',
  '080_coaching_exercise_programming.sql',
  '081_coaching_exercise_backfill.sql',
  '082_coaching_workout_metadata.sql',
  '083_coaching_validation_rules.sql',
  '084_coaching_training_block.sql',
  '085_coaching_regimen_template.sql',
  '086_coaching_session_templates.sql',
  '087_coaching_phase_order_slot_education.sql',
]

function isBenignMigrationError(message) {
  const msg = String(message || '')
  return /already exists|duplicate key value violates unique constraint/i.test(msg)
}

async function tableExists(pool, schema, table) {
  const result = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2 LIMIT 1`,
    [schema, table],
  )
  return result.rows.length > 0
}

export async function getCoachingSchemaStatus(pool) {
  const checks = [
    ['session_phase', 'coaching.session_phase'],
    ['phase_order_slot', 'coaching.phase_order_slot'],
    ['education_content', 'coaching.education_content'],
    ['exercise_phase_profile', 'coaching.exercise_phase_profile'],
    ['regimen_template', 'coaching.regimen_template'],
    ['training_block_template', 'coaching.training_block_template'],
  ]
  const status = {}
  for (const [key, fq] of checks) {
    const [schema, table] = fq.split('.')
    status[key] = await tableExists(pool, schema, table)
  }
  status.ready = status.session_phase && status.exercise_phase_profile && status.regimen_template
  return status
}

/** Idempotent repair pass for Why Layer migrations — runs even when initPlatformTables aborted mid-batch. */
export async function ensureCoachingWhyLayerSchema(pool) {
  const migrationsDir = path.join(__dirname, '..', 'migrations')
  const failures = []

  for (const file of WHY_LAYER_MIGRATIONS) {
    const migrationPath = path.join(migrationsDir, file)
    if (!fs.existsSync(migrationPath)) {
      failures.push({ file, error: 'migration file missing' })
      continue
    }
    const sql = fs.readFileSync(migrationPath, 'utf8')
    try {
      await pool.query(sql)
    } catch (err) {
      if (isBenignMigrationError(err.message)) continue
      failures.push({ file, error: err.message })
      console.error(`[ensureCoachingWhyLayerSchema] ${file}:`, err.message)
    }
  }

  const status = await getCoachingSchemaStatus(pool)
  if (!status.ready) {
    console.warn('[ensureCoachingWhyLayerSchema] Coaching Why Layer schema incomplete:', status, failures)
  } else if (failures.length > 0) {
    console.warn('[ensureCoachingWhyLayerSchema] Partial failures (schema now ready):', failures)
  } else {
    console.log('[ensureCoachingWhyLayerSchema] Coaching Why Layer schema ready')
  }

  return { status, failures }
}
