#!/usr/bin/env node
/**
 * Apply coaching library migrations 096–144 (exercises, programming methods, backfills).
 * Use when boot migrations were skipped due to initTables filename drift or a mid-batch abort.
 *
 *   cd backend && node scripts/repair-coaching-library.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const migrationsDir = path.join(__dirname, '..', 'migrations')

dotenv.config({ path: path.join(__dirname, '..', '.env') })
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })
dotenv.config({ path: path.join(__dirname, '../../.env') })
dotenv.config({ path: path.join(__dirname, '../../.env.local') })

const LIBRARY_MIGRATIONS = [
  '096_coaching_prepare_access_subroles.sql',
  '097_coaching_prepare_access_seed.sql',
  '098_coaching_prepare_access_foundation_cards.sql',
  '099_coaching_prepare_access_content_support.sql',
  '100_coaching_prepare_access_upper_body_cards.sql',
  '101_coaching_prepare_access_lower_leg_cards.sql',
  '102_coaching_prepare_access_hip_access_cards.sql',
  '103_coaching_prepare_access_activation_cards.sql',
  '104_coaching_skill_phase_infrastructure.sql',
  '105_coaching_skill_movement_intelligence_seed.sql',
  '106_coaching_skill_shape_cards.sql',
  '107_coaching_skill_tumbling_cards.sql',
  '108_coaching_skill_sprint_cards.sql',
  '109_coaching_skill_balance_cards.sql',
  '110_coaching_skill_perception_cards.sql',
  '111_coaching_output_phase_infrastructure.sql',
  '112_coaching_output_seed.sql',
  '113_coaching_output_acceleration_cards.sql',
  '114_coaching_output_max_velocity_cards.sql',
  '115_coaching_output_elastic_cards.sql',
  '116_coaching_education_dedupe_framework.sql',
  '117_coaching_output_jump_power_cards.sql',
  '118_coaching_output_decel_cod_cards.sql',
  '119_coaching_output_reactive_tumbling_cards.sql',
  '120_coaching_capacity_phase_infrastructure.sql',
  '121_coaching_capacity_seed.sql',
  '122_coaching_capacity_squat_cards.sql',
  '123_coaching_capacity_hinge_cards.sql',
  '124_coaching_capacity_push_cards.sql',
  '125_coaching_capacity_pull_cards.sql',
  '126_coaching_capacity_carry_cards.sql',
  '127_coaching_capacity_tissue_cards.sql',
  '128_coaching_control_resilience_phase_infrastructure.sql',
  '129_coaching_control_resilience_seed.sql',
  '130_coaching_control_landing_cards.sql',
  '131_coaching_control_single_leg_cards.sql',
  '132_coaching_control_trunk_cards.sql',
  '133_coaching_control_scapular_cards.sql',
  '134_coaching_control_slow_eccentric_cards.sql',
  '135_coaching_library_facility_backfill.sql',
  '136_rename_fitness_repeatability_to_sustained_capacity.sql',
  '137_rename_session_phase_labels.sql',
  '138_coaching_programming_library_infrastructure.sql',
  '139_coaching_workout_block_programming_method.sql',
  '141_coaching_programming_library_seed.sql',
  '144_coaching_programming_library_facility_backfill.sql',
]

function resolveSsl(connectionString) {
  if (process.env.DATABASE_SSL === 'false') return false
  if (process.env.NODE_ENV === 'production') return { rejectUnauthorized: false }
  const value = String(connectionString || '')
  if (/render\.com|neon\.tech|supabase\.co|rds\.amazonaws\.com/i.test(value)) {
    return { rejectUnauthorized: false }
  }
  return false
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || process.env.EXTERNAL_DB_URL || process.env.DB_URL,
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'vortex_athletics',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
  ssl: resolveSsl(process.env.DATABASE_URL || process.env.EXTERNAL_DB_URL || process.env.DB_URL),
})

function isBenign(message) {
  return /already exists|duplicate key value violates unique constraint/i.test(String(message || ''))
}

async function printCounts(label) {
  const byPhase = await pool.query(`
    SELECT COALESCE(primary_phase_key, '(null)') AS phase, COUNT(*)::int AS n
    FROM coaching.exercise
    WHERE archived = FALSE
    GROUP BY 1
    ORDER BY 1
  `)
  const total = await pool.query(`
    SELECT COUNT(*)::int AS n FROM coaching.exercise WHERE archived = FALSE
  `)
  const programming = await pool.query(`
    SELECT facility_id, COUNT(*)::int AS n
    FROM coaching.programming_method
    WHERE archived = FALSE
    GROUP BY 1
    ORDER BY 1
  `)
  console.log(`\n${label}`)
  for (const row of byPhase.rows) console.log(`  exercise ${row.phase}: ${row.n}`)
  console.log(`  exercise TOTAL: ${total.rows[0].n}`)
  if (programming.rows.length === 0) {
    console.log('  programming methods: 0 (seed 141 may not have run)')
  } else {
    for (const row of programming.rows) console.log(`  programming facility ${row.facility_id}: ${row.n}`)
  }
}

async function main() {
  await printCounts('Before repair:')

  // Constraint + key sync must run before seeds that insert canonical phase keys.
  for (const file of [
    '142_coaching_session_phase_dedupe.sql',
    '143_coaching_exercise_phase_key_constraint_sync.sql',
  ]) {
    const migrationPath = path.join(migrationsDir, file)
    process.stdout.write(`Applying ${file}... `)
    try {
      await pool.query(fs.readFileSync(migrationPath, 'utf8'))
      console.log('ok')
    } catch (err) {
      if (isBenign(err.message)) console.log('ok (idempotent skip)')
      else { console.log('FAILED'); console.error(err.message); process.exitCode = 1 }
    }
  }

  for (const file of LIBRARY_MIGRATIONS) {
    const migrationPath = path.join(migrationsDir, file)
    if (!fs.existsSync(migrationPath)) {
      console.error(`Missing migration file: ${file}`)
      process.exitCode = 1
      continue
    }
    const sql = fs.readFileSync(migrationPath, 'utf8')
    process.stdout.write(`Applying ${file}... `)
    try {
      await pool.query(sql)
      console.log('ok')
    } catch (err) {
      if (isBenign(err.message)) {
        console.log('ok (idempotent skip)')
      } else {
        console.log('FAILED')
        console.error(err.message)
        process.exitCode = 1
      }
    }
  }

  await printCounts('After repair:')
  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
