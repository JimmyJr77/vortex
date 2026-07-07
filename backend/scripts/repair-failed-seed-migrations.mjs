#!/usr/bin/env node
/**
 * Re-run seed migrations that failed on boot (constraint shrink / type bugs).
 * Strips constraint-alter statements so 228 canonical constraints are preserved.
 *
 * Usage: node scripts/repair-failed-seed-migrations.mjs [--dry-run]
 */
import pg from 'pg'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { ensureCoachingBootConstraints } from '../platform/ensureCoachingBootConstraints.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const dryRun = process.argv.includes('--dry-run')

const cs = process.env.DATABASE_URL || process.env.EXTERNAL_DB_URL || process.env.DB_URL
if (!cs) {
  console.error('DATABASE_URL / DB_URL required in backend/.env.local')
  process.exit(1)
}

const FAILED_SEED_MIGRATIONS = [
  '145_coaching_agility_shiftiness_infrastructure_and_seed.sql',
  '165_coaching_calisthenics_infrastructure_and_seed.sql',
  '186_coaching_medicine_balls_slam_balls_infrastructure_and_seed.sql',
  '187_coaching_medicine_balls_slam_balls_cards.sql',
  '188_coaching_pairs_exercise_infrastructure_and_seed.sql',
  '190_coaching_reaction_time_reduction_infrastructure_and_seed.sql',
  '191_coaching_reaction_time_reduction_cards.sql',
  '192_coaching_wall_balls_infrastructure_and_seed.sql',
  '193_coaching_wall_balls_cards.sql',
  '196_coaching_kicking_athletes_infrastructure_and_seed.sql',
  '197_coaching_kicking_athletes_cards.sql',
  '200_coaching_rotational_power_infrastructure_and_seed.sql',
  '201_coaching_rotational_power_cards.sql',
  '208_coaching_box_jump_infrastructure_and_seed.sql',
  '209_coaching_box_jump_cards.sql',
  '210_coaching_cone_drill_exercise_library_infrastructure_and_seed.sql',
  '211_coaching_cone_drill_exercise_library_cards.sql',
  '183_coaching_jumping_height_cards.sql',
  '184_coaching_jumping_distance_infrastructure_and_seed.sql',
  '185_coaching_jumping_distance_cards.sql',
  '195_coaching_throwing_athletes_cards.sql',
]

function stripBootConstraintAlters(sql) {
  let out = sql
  const patterns = [
    /ALTER TABLE coaching\.exercise DROP CONSTRAINT IF EXISTS exercise_phase_subrole_check;\s*/gi,
    /ALTER TABLE coaching\.exercise ADD CONSTRAINT exercise_phase_subrole_check[\s\S]*?\);\s*/gi,
    /ALTER TABLE coaching\.exercise_safety_profile DROP CONSTRAINT IF EXISTS exercise_safety_profile_requires_coach_supervision_check;\s*/gi,
    /ALTER TABLE coaching\.exercise_safety_profile ADD CONSTRAINT exercise_safety_profile_requires_coach_supervision_check[\s\S]*?\);\s*/gi,
    /ALTER TABLE coaching\.exercise_phase_profile DROP CONSTRAINT IF EXISTS exercise_phase_profile_intensity_ceiling_check;\s*/gi,
    /ALTER TABLE coaching\.exercise_phase_profile ADD CONSTRAINT exercise_phase_profile_intensity_ceiling_check[\s\S]*?\);\s*/gi,
    /ALTER TABLE coaching\.exercise_dosage_profile DROP CONSTRAINT IF EXISTS exercise_dosage_profile_volume_unit_check;\s*/gi,
    /ALTER TABLE coaching\.exercise_dosage_profile ADD CONSTRAINT exercise_dosage_profile_volume_unit_check[\s\S]*?\);\s*/gi,
  ]
  for (const re of patterns) out = out.replace(re, '')
  return out
}

/** Migration 214 dropped complexity; strip from difficulty profile DML without touching technical_complexity. */
function stripComplexityFromDifficultySql(sql) {
  let out = sql
  out = out.replace(
    /(INSERT INTO coaching\.exercise_difficulty_profile\s*\(\s*)([\s\S]*?)(\s*\))/gi,
    (match, pre, cols, post) => {
      if (!/\bcomplexity\b/.test(cols)) return match
      const newCols = cols.split(',').map((c) => c.trim()).filter((c) => c !== 'complexity').join(', ')
      return `${pre}${newCols}${post}`
    },
  )
  out = out.replace(/\n\s*complexity = EXCLUDED\.complexity,?\s*\n/gi, '\n')
  out = out.replace(/,\s*m\.complexity\b/gi, '')
  out = out.replace(/m\.complexity,\s*/gi, '')
  out = out.replace(/\)\s*AS m\(([^)]*)\)/gi, (match, cols) => {
    if (!/\bcomplexity\b/.test(cols)) return match
    const newCols = cols.split(',').map((c) => c.trim()).filter((c) => c !== 'complexity').join(', ')
    return `) AS m(${newCols})`
  })
  out = out.replace(/SELECT e\.id, (\d+), (\d+), (\d+), (\d+),/g, 'SELECT e.id, $1, $2, $4,')
  out = out.replace(
    /\('([^']+)',\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),/g,
    "('$1', $2, $3, $5, $6,",
  )
  return out
}

function sanitizeSeedMigrationSql(sql) {
  return stripComplexityFromDifficultySql(stripBootConstraintAlters(sql))
}

const pool = new pg.Pool({
  connectionString: cs,
  ssl: /render\.com|neon|supabase|rds\.amazonaws/i.test(cs) ? { rejectUnauthorized: false } : false,
})

const migDir = path.join(__dirname, '..', 'migrations')
const results = []

try {
  await ensureCoachingBootConstraints(pool)
  console.log('Canonical constraints applied.\n')

  for (const file of FAILED_SEED_MIGRATIONS) {
    const filePath = path.join(migDir, file)
    if (!fs.existsSync(filePath)) {
      results.push({ file, status: 'missing' })
      continue
    }
    const sql = sanitizeSeedMigrationSql(fs.readFileSync(filePath, 'utf8'))
    if (dryRun) {
      console.log(`[dry-run] would run ${file} (${sql.length} chars)`)
      results.push({ file, status: 'dry-run' })
      continue
    }
    try {
      await pool.query(sql)
      console.log(`OK ${file}`)
      results.push({ file, status: 'ok' })
    } catch (err) {
      const msg = String(err.message || err)
      if (/already exists|duplicate key value violates unique constraint/i.test(msg)) {
        console.warn(`SKIP duplicate ${file}: ${msg.slice(0, 120)}`)
        results.push({ file, status: 'duplicate', error: msg })
      } else {
        console.error(`FAIL ${file}: ${msg}`)
        results.push({ file, status: 'fail', error: msg })
      }
    }
  }

  const after = await pool.query(`
    SELECT COUNT(*)::int AS exercises FROM coaching.exercise WHERE archived = FALSE
  `)
  console.log('\nExercise count:', after.rows[0].exercises)
  console.log('Summary:', results.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1
    return acc
  }, {}))
} finally {
  await pool.end()
}
