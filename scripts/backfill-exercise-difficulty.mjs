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
import { computeOverallDifficulty } from '../backend/platform/ageDifficultyPolicy.js'

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

function coordinationScore(text) {
  const s = String(text || '').toLowerCase()
  if (!s) return 2
  if (s.includes('high')) return 7
  if (s.includes('moderate_to_high') || s.includes('moderate to high')) return 6
  if (s.includes('moderate')) return 4
  if (s.includes('low')) return 2
  return 3
}

function skillFloor(skill) {
  if (skill === 'ADVANCED') return 7
  if (skill === 'INTERMEDIATE') return 5
  if (skill === 'BEGINNER') return 3
  if (skill === 'EARLY_STAGE') return 2
  return 2
}

function slugHeuristic(slug) {
  const s = String(slug || '').toLowerCase()
  let bump = 0
  if (/plyo|depth-drop|hurdle|sprint-max|tumbling|round-off|handstand/.test(s)) bump += 2
  if (/coordination|reactive|decision|catch|partner/.test(s)) bump += 1
  if (/breathing|cars|mobilize|9090|crocodile/.test(s)) bump -= 1
  return bump
}

function deriveDifficulty(row, primaryPhase, regimen, safety, req) {
  const tc = Number(primaryPhase?.technical_complexity) || 2
  let technical = Math.min(10, Math.max(1, tc * 2))
  let load = Math.min(10, Math.max(1, Number(primaryPhase?.fatigue_cost) || 2))
  let complexity = coordinationScore(req.coordination_demand)

  const impact = Number(req.impact_level ?? primaryPhase?.impact_level ?? safety?.impact_level ?? 0)
  if (impact >= 3) load = Math.min(10, load + 2)
  if (impact >= 4) load = Math.min(10, load + 1)

  if (regimen?.counts_as_high_intensity) load = Math.min(10, load + 2)
  if (regimen?.counts_as_high_impact) load = Math.min(10, load + 1)

  if (row.participant_structure === 'pairs' || row.participant_structure === 'group') {
    complexity = Math.min(10, complexity + 2)
  }

  const floor = skillFloor(row.skill_level)
  technical = Math.max(technical, floor)
  load = Math.max(load, Math.max(1, floor - 1))
  complexity = Math.max(complexity, Math.max(1, floor - 1))

  const bump = slugHeuristic(row.slug)
  technical = Math.min(10, Math.max(1, technical + bump))
  load = Math.min(10, Math.max(1, load + Math.floor(bump / 2)))
  complexity = Math.min(10, Math.max(1, complexity + Math.floor(bump / 2)))

  const overall = computeOverallDifficulty(technical, load, complexity)
  const attention = complexity >= 7 ? 'high' : complexity >= 4 ? 'moderate' : 'low'

  return {
    technical,
    load,
    complexity,
    overall,
    recommended_age_min: row.age_min ?? safety?.minimum_age_recommended ?? null,
    recommended_age_max: row.age_max ?? null,
    attention_demand: attention,
    notes: `derived from tc=${tc}, fatigue=${primaryPhase?.fatigue_cost ?? '?'}`,
    source: 'derived',
  }
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
    if (existing.rows[0]?.source === 'reviewed') {
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
    const diff = deriveDifficulty(
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
        WHERE coaching.exercise_difficulty_profile.source != 'reviewed'`,
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
