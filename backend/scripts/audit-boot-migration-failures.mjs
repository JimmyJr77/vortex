#!/usr/bin/env node
/**
 * Audit production DB for boot-time migration failure patterns.
 * Usage: node scripts/audit-boot-migration-failures.mjs
 */
import pg from 'pg'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const cs = process.env.DATABASE_URL || process.env.EXTERNAL_DB_URL || process.env.DB_URL
if (!cs) {
  console.error('No DATABASE_URL / DB_URL in backend/.env.local')
  process.exit(1)
}

const pool = new pg.Pool({
  connectionString: cs,
  ssl: /render\.com|neon|supabase|rds\.amazonaws/i.test(cs) ? { rejectUnauthorized: false } : false,
})

async function q(sql, params) {
  const r = await pool.query(sql, params)
  return r.rows
}

async function main() {
  console.log('=== Schema objects ===')
  const tables = await q(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'coaching'
      AND table_name IN (
        'coach_phase_template', 'coach_needs_engine_requirements',
        'exercise_difficulty_profile', 'exercise_phase_profile'
      )
    ORDER BY 1
  `)
  console.log('Key tables:', tables.map((r) => r.table_name).join(', ') || '(none)')

  const cols = await q(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'coaching' AND table_name = 'exercise_difficulty_profile'
    ORDER BY ordinal_position
  `)
  console.log('exercise_difficulty_profile columns:', cols.map((r) => r.column_name).join(', '))

  const constraints = await q(`
    SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conrelid = 'coaching.exercise'::regclass
      AND conname LIKE '%subrole%'
  `)
  console.log('\n=== exercise subrole constraint ===')
  for (const c of constraints) console.log(c.conname, ':', c.def)

  console.log('\n=== Distinct phase_subrole values (non-null) ===')
  const subroles = await q(`
    SELECT phase_subrole, COUNT(*)::int AS n
    FROM coaching.exercise WHERE archived = FALSE AND phase_subrole IS NOT NULL
    GROUP BY 1 ORDER BY n DESC LIMIT 40
  `)
  for (const r of subroles) console.log(`  ${r.phase_subrole}: ${r.n}`)

  console.log('\n=== Invalid subroles vs migration 217 (latest known full list) ===')
  const invalid = await q(`
    WITH allowed(subrole) AS (VALUES
      ('raise'), ('mobilize'), ('activate'), ('integrate'), ('potentiate_bridge'),
      ('shape_position_intelligence'), ('rotation_inversion_tumbling_foundations'),
      ('locomotion_sprint_mechanics'), ('balance_coordination_rhythm'),
      ('perception_action_reactive_movement'),
      ('acceleration'), ('max_velocity'), ('elastic_rebound'), ('jump_power'),
      ('deceleration_cod'), ('reactive_tumbling'),
      ('squat'), ('hinge'), ('push'), ('pull'), ('carry'), ('tissue'),
      ('breathing_downshift'), ('mobilize_restore'), ('mobilize'), ('post_workout'),
      ('agility_lateral'), ('agility_reactive'), ('speed_quick_release'),
      ('loaded_strength'), ('kettlebell'), ('balance'), ('bodyweight_strength'),
      ('coordination'), ('core_control'), ('explosiveness'), ('eccentric'),
      ('calisthenics'), ('isometrics'), ('mobility'), ('neural'), ('plyometrics'),
      ('sandbag'), ('resistance_band'), ('jump_height'), ('jump_distance'),
      ('reaction_time'), ('wall_ball'), ('throwing'), ('kicking'), ('landmine'),
      ('rotational_power'), ('high_impact'), ('box_jump'), ('cone_drill'),
      ('ladder'), ('integrated_workout'), ('game'), ('sustained_hiit'),
      ('restore'), ('conditioning'), ('skill_drill'), ('warmup'), ('cooldown')
    )
    SELECT e.phase_subrole, COUNT(*)::int AS n
    FROM coaching.exercise e
    WHERE e.archived = FALSE AND e.phase_subrole IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM allowed a WHERE a.subrole = e.phase_subrole)
    GROUP BY 1 ORDER BY n DESC
  `)
  if (invalid.length === 0) console.log('  (none — all subroles in sample allow-list)')
  else for (const r of invalid) console.log(`  INVALID: ${r.phase_subrole} (${r.n})`)

  console.log('\n=== phase_subrole_check would fail? (if constraint exists) ===')
  try {
    const test = await q(`
      SELECT COUNT(*)::int AS violating
      FROM coaching.exercise e
      WHERE e.archived = FALSE AND e.phase_subrole IS NOT NULL
        AND NOT (
          e.phase_subrole IN (
            SELECT unnest(enum_range(NULL::text)) FROM (SELECT 1) x
          )
        )
    `)
    console.log('  (skipped — dynamic check below)')
  } catch {
    /* ignore */
  }

  // Try to detect rows that would block ADD CONSTRAINT from 104 alone
  const block104 = await q(`
    SELECT e.phase_subrole, COUNT(*)::int AS n
    FROM coaching.exercise e
    WHERE e.archived = FALSE AND e.phase_subrole IS NOT NULL
      AND e.phase_subrole NOT IN (
        'raise', 'mobilize', 'activate', 'integrate', 'potentiate_bridge',
        'shape_position_intelligence', 'rotation_inversion_tumbling_foundations',
        'locomotion_sprint_mechanics', 'balance_coordination_rhythm',
        'perception_action_reactive_movement'
      )
    GROUP BY 1 ORDER BY n DESC LIMIT 20
  `)
  console.log('Rows NOT in migration-104-only allow-list (would block 104 constraint):')
  for (const r of block104) console.log(`  ${r.phase_subrole}: ${r.n}`)

  console.log('\n=== intensity_ceiling violations ===')
  const intensity = await q(`
    SELECT p.intensity_ceiling, COUNT(*)::int AS n
    FROM coaching.exercise_phase_profile p
    WHERE p.intensity_ceiling IS NOT NULL
      AND p.intensity_ceiling NOT IN ('low', 'moderate', 'high', 'max')
    GROUP BY 1
  `)
  if (intensity.length === 0) console.log('  (none)')
  else for (const r of intensity) console.log(`  ${r.intensity_ceiling}: ${r.n}`)

  console.log('\n=== volume_unit violations ===')
  const vol = await q(`
    SELECT d.volume_unit, COUNT(*)::int AS n
    FROM coaching.exercise_dosage_profile d
    WHERE d.volume_unit IS NOT NULL
      AND d.volume_unit NOT IN ('reps', 'seconds', 'meters', 'yards', 'feet', 'steps', 'contacts', 'rounds', 'calories', 'miles', 'kilometers')
    GROUP BY 1
  `)
  if (vol.length === 0) console.log('  (none)')
  else for (const r of vol) console.log(`  ${r.volume_unit}: ${r.n}`)

  console.log('\n=== Library coverage ===')
  const lib = await q(`
    SELECT
      (SELECT COUNT(*)::int FROM coaching.exercise WHERE archived = FALSE) AS exercises,
      (SELECT COUNT(*)::int FROM coaching.exercise_difficulty_profile) AS difficulty_profiles,
      (SELECT COUNT(*)::int FROM coaching.exercise_phase_profile) AS phase_profiles,
      (SELECT COUNT(*)::int FROM coaching.education_content) AS education,
      (SELECT COUNT(*)::int FROM coaching.exercise WHERE archived = FALSE AND primary_phase_key = 'restore') AS restore_primary
  `)
  console.log(lib[0])

  console.log('\n=== Needs Engine tables ===')
  const ne = await q(`
    SELECT
      to_regclass('coaching.coach_phase_template') AS phase_template,
      to_regclass('coaching.coach_needs_engine_requirements') AS requirements
  `)
  console.log(ne[0])

  console.log('\n=== Sample slugs from failed seed families (may be missing) ===')
  const samples = [
    'wall-ball-chest-pass', 'medicine-ball-slam', 'box-jump-approach',
    'reaction-ball-drop', 'rotational-med-ball-throw', 'pairs-resisted-sprint'
  ]
  for (const slug of samples) {
    const rows = await q(`SELECT id, slug, primary_phase_key, phase_subrole FROM coaching.exercise WHERE slug = $1`, [slug])
    console.log(`  ${slug}:`, rows[0] ? `id=${rows[0].id} phase=${rows[0].primary_phase_key} subrole=${rows[0].phase_subrole}` : 'MISSING')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => pool.end())
