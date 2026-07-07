#!/usr/bin/env node
/**
 * Derive and upsert exercise_difficulty_profile for all published exercises.
 * Writes docs/exercise-difficulty-review.csv for human review.
 *
 *   node scripts/backfill-exercise-difficulty.mjs
 *   node scripts/backfill-exercise-difficulty.mjs --dry-run
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'
import dotenv from 'dotenv'
import { deriveExerciseDifficulty } from '../backend/platform/exerciseDifficultyDerivation.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

dotenv.config({ path: path.join(root, 'backend', '.env') })
dotenv.config({ path: path.join(root, 'backend', '.env.local') })
dotenv.config({ path: path.join(root, '.env') })
dotenv.config({ path: path.join(root, '.env.local') })

const dryRun = process.argv.includes('--dry-run')

function parseJson(val) {
  if (val == null) return {}
  if (typeof val === 'object') return val
  try { return JSON.parse(val) } catch { return {} }
}

function resolveSsl(connectionString) {
  if (process.env.DATABASE_SSL === 'false') return false
  if (process.env.NODE_ENV === 'production') return { rejectUnauthorized: false }
  const value = String(connectionString || '')
  if (/render\.com|neon\.tech|supabase\.co|rds\.amazonaws\.com/i.test(value)) {
    return { rejectUnauthorized: false }
  }
  return false
}

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('DATABASE_URL required')
    process.exit(1)
  }
  const pool = new pg.Pool({ connectionString, ssl: resolveSsl(connectionString) })

  try {
    await pool.query(fs.readFileSync(path.join(root, 'backend/migrations/202_coaching_exercise_difficulty_profile.sql'), 'utf8'))
  } catch (err) {
    if (!/already exists/i.test(String(err.message))) console.warn('[migration]', err.message)
  }

  const exercises = await pool.query(`
    SELECT e.id, e.slug, e.name, e.skill_level, e.age_min, e.age_max, e.participant_structure,
           e.movement_requirements
    FROM coaching.exercise e
    WHERE e.archived = FALSE
    ORDER BY e.slug
  `)

  const csvRows = ['slug,name,technical,load,complexity,overall,recommended_age_min,attention_demand,source,notes']
  let upserted = 0
  let skipped = 0

  for (const row of exercises.rows) {
    const existing = await pool.query(
      `SELECT source FROM coaching.exercise_difficulty_profile WHERE exercise_id = $1`,
      [row.id],
    )
    if (existing.rows[0]?.source === 'reviewed' || existing.rows[0]?.source === 'authored') {
      skipped++
      continue
    }

    const [phaseRes, regimenRes, safetyRes] = await Promise.all([
      pool.query(
        `SELECT technical_complexity, fatigue_cost, impact_level, role
         FROM coaching.exercise_phase_profile p
         JOIN coaching.session_phase sp ON sp.id = p.phase_id
         WHERE p.exercise_id = $1
         ORDER BY CASE WHEN p.role = 'primary' THEN 0 WHEN p.role = 'secondary' THEN 1 ELSE 2 END, p.fit_weight DESC
         LIMIT 1`,
        [row.id],
      ),
      pool.query(`SELECT * FROM coaching.exercise_regimen_rule WHERE exercise_id = $1`, [row.id]),
      pool.query(`SELECT * FROM coaching.exercise_safety_profile WHERE exercise_id = $1`, [row.id]),
    ])

    const req = parseJson(row.movement_requirements)
    const diff = deriveExerciseDifficulty(
      row,
      phaseRes.rows[0] ?? null,
      regimenRes.rows[0] ?? null,
      safetyRes.rows[0] ?? null,
      req,
    )

    csvRows.push([
      row.slug,
      `"${String(row.name).replace(/"/g, '""')}"`,
      diff.technical,
      diff.load,
      diff.complexity,
      diff.overall,
      diff.recommended_age_min ?? '',
      diff.attention_demand,
      diff.source,
      `"${String(diff.notes).replace(/"/g, '""')}"`,
    ].join(','))

    if (!dryRun) {
      await pool.query(
        `INSERT INTO coaching.exercise_difficulty_profile (
          exercise_id, technical, load, complexity, overall,
          recommended_age_min, recommended_age_max, attention_demand, notes, source, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
        ON CONFLICT (exercise_id) DO UPDATE SET
          technical = EXCLUDED.technical,
          load = EXCLUDED.load,
          complexity = EXCLUDED.complexity,
          overall = EXCLUDED.overall,
          recommended_age_min = EXCLUDED.recommended_age_min,
          recommended_age_max = EXCLUDED.recommended_age_max,
          attention_demand = EXCLUDED.attention_demand,
          notes = EXCLUDED.notes,
          source = EXCLUDED.source,
          updated_at = now()
        WHERE coaching.exercise_difficulty_profile.source NOT IN ('reviewed', 'authored')`,
        [
          row.id,
          diff.technical,
          diff.load,
          diff.complexity,
          diff.overall,
          diff.recommended_age_min,
          diff.recommended_age_max,
          diff.attention_demand,
          diff.notes,
          diff.source,
        ],
      )
      upserted++
    }
  }

  const csvPath = path.join(root, 'docs/exercise-difficulty-review.csv')
  fs.mkdirSync(path.dirname(csvPath), { recursive: true })
  fs.writeFileSync(csvPath, csvRows.join('\n') + '\n')

  console.log(`${dryRun ? '[dry-run] ' : ''}Processed ${exercises.rows.length} exercises; upserted ${upserted}; skipped reviewed ${skipped}`)
  console.log(`Review CSV: ${csvPath}`)
  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
