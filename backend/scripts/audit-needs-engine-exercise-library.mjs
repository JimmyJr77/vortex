#!/usr/bin/env node
import pg from 'pg'

const { Pool } = pg
const connectionString = process.env.DATABASE_URL || process.env.DB_URL || process.env.EXTERNAL_DB_URL
const facilityArg = process.argv.find((arg) => arg.startsWith('--facility='))
const facilityId = Number(facilityArg?.split('=')[1] ?? process.env.FACILITY_ID ?? 1)
const json = process.argv.includes('--json')
const profile = process.argv.includes('--profile')
const remoteTls = connectionString
  ? /render\.com|neon\.tech|supabase\.co|rds\.amazonaws\.com/i.test(connectionString)
  : false
const pool = new Pool(connectionString
  ? {
      connectionString,
      ssl: process.env.DATABASE_SSL === 'false'
        ? false
        : (process.env.DATABASE_SSL === 'true' || remoteTls ? { rejectUnauthorized: false } : undefined),
    }
  : {
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      database: process.env.DB_NAME ?? 'vortex_athletics',
      user: process.env.DB_USER ?? 'postgres',
      password: process.env.DB_PASSWORD,
    })

const difficultyTable = await pool.query(
  `SELECT to_regclass('coaching.exercise_difficulty_profile') IS NOT NULL AS exists`,
)
const difficultyIssueSql = difficultyTable.rows[0]?.exists
  ? `CASE WHEN NOT EXISTS (
      SELECT 1 FROM coaching.exercise_difficulty_profile x WHERE x.exercise_id = a.id
    ) THEN 'missing_difficulty' END`
  : `NULL::text`

const query = `
  WITH active AS (
    SELECT e.*
    FROM coaching.exercise e
    WHERE e.facility_id = $1 AND e.archived = FALSE AND e.is_published = TRUE
  ),
  phase_counts AS (
    SELECT exercise_id, count(*) AS count
    FROM coaching.exercise_phase_profile
    GROUP BY exercise_id
  ),
  dosage AS (
    SELECT DISTINCT ON (exercise_id)
      exercise_id, volume_unit, default_sets, default_reps, default_work_seconds,
      default_distance, default_contacts, default_rounds, default_rest_seconds,
      est_seconds_per_set
    FROM coaching.exercise_dosage_profile
    ORDER BY exercise_id, is_default DESC, id
  ),
  tag_counts AS (
    SELECT exercise_id,
      count(*) FILTER (WHERE facet_type = 'pattern') AS patterns,
      count(*) FILTER (WHERE facet_type = 'body_region') AS body_regions,
      count(*) FILTER (WHERE facet_type = 'equipment') AS equipment
    FROM coaching.exercise_tag
    GROUP BY exercise_id
  ),
  name_counts AS (
    SELECT lower(name) AS normalized_name, count(*) AS count
    FROM active
    GROUP BY lower(name)
  )
  SELECT
    a.id, a.slug, a.name,
    array_remove(ARRAY[
      CASE WHEN coalesce(pc.count, 0) = 0 THEN 'missing_phase_profile' END,
      CASE WHEN d.exercise_id IS NULL THEN 'missing_dosage_profile' END,
      CASE WHEN d.exercise_id IS NOT NULL AND d.default_sets IS NULL THEN 'missing_sets' END,
      CASE WHEN d.exercise_id IS NOT NULL
        AND d.default_reps IS NULL AND d.default_work_seconds IS NULL
        AND d.default_distance IS NULL AND d.default_contacts IS NULL AND d.default_rounds IS NULL
        AND NOT (d.volume_unit IN ('attempts', 'rounds') AND d.default_sets IS NOT NULL)
        THEN 'missing_volume' END,
      CASE WHEN d.exercise_id IS NOT NULL AND d.est_seconds_per_set IS NULL THEN 'missing_time_estimate' END,
      ${difficultyIssueSql},
      CASE WHEN coalesce(tc.patterns, 0) = 0 THEN 'missing_pattern' END,
      CASE WHEN coalesce(tc.body_regions, 0) = 0 THEN 'missing_body_region' END,
      CASE WHEN nullif(trim(a.card_summary), '') IS NULL THEN 'missing_card_summary' END,
      CASE WHEN nullif(trim(a.description), '') IS NULL THEN 'missing_description' END,
      CASE WHEN a.description ~* 'by targeting (adds|builds|prepares|links|develops|reinforces|trains|introduces|uses|improves|challenges)'
        THEN 'awkward_generated_description' END,
      CASE WHEN nc.count > 1 THEN 'duplicate_display_name' END
    ], NULL) AS issues
  FROM active a
  LEFT JOIN phase_counts pc ON pc.exercise_id = a.id
  LEFT JOIN dosage d ON d.exercise_id = a.id
  LEFT JOIN tag_counts tc ON tc.exercise_id = a.id
  JOIN name_counts nc ON nc.normalized_name = lower(a.name)
  ORDER BY a.slug
`

try {
  const result = await pool.query(query, [facilityId])
  const cards = result.rows.map((row) => ({
    id: Number(row.id),
    slug: row.slug,
    name: row.name,
    issues: row.issues ?? [],
  }))
  const issueCounts = {}
  for (const card of cards) {
    for (const issue of card.issues) issueCounts[issue] = (issueCounts[issue] ?? 0) + 1
  }
  const report = {
    facilityId,
    publishedExercises: cards.length,
    passingExercises: cards.filter((card) => card.issues.length === 0).length,
    failingExercises: cards.filter((card) => card.issues.length > 0).length,
    issueCounts,
    cards: cards.filter((card) => card.issues.length > 0),
  }
  if (profile) {
    const canonicalTable = await pool.query(
      `SELECT to_regclass('coaching.canonical_exercise_definition') IS NOT NULL AS exists`,
    )
    const canonicalCoverage = canonicalTable.rows[0]?.exists
      ? await pool.query(`
          SELECT count(*)::int AS count
          FROM coaching.exercise e
          JOIN coaching.canonical_exercise_definition c ON c.legacy_exercise_id = e.id
          WHERE e.facility_id = $1 AND e.archived = FALSE AND e.is_published = TRUE
            AND NOT EXISTS (
              SELECT 1 FROM coaching.exercise_difficulty_profile d WHERE d.exercise_id = e.id
            )
        `, [facilityId])
      : { rows: [{ count: 0 }] }
    const gapRows = await pool.query(`
      SELECT e.slug, e.name, e.skill_level, e.primary_phase_key,
        e.default_sets, e.default_reps, e.default_work_seconds, e.est_seconds_per_set,
        d.volume_unit, d.default_sets AS dosage_sets, d.default_reps AS dosage_reps,
        d.default_work_seconds AS dosage_work_seconds, d.default_distance,
        d.default_contacts, d.default_rounds, d.est_seconds_per_set AS dosage_est_seconds,
        array_agg(DISTINCT mp.key) FILTER (WHERE mp.key IS NOT NULL) AS patterns,
        array_agg(DISTINCT br.key) FILTER (WHERE br.key IS NOT NULL) AS body_regions
      FROM coaching.exercise e
      LEFT JOIN LATERAL (
        SELECT * FROM coaching.exercise_dosage_profile x
        WHERE x.exercise_id = e.id
        ORDER BY x.is_default DESC, x.id
        LIMIT 1
      ) d ON TRUE
      LEFT JOIN coaching.exercise_tag t ON t.exercise_id = e.id
      LEFT JOIN coaching.movement_pattern mp ON t.facet_type = 'pattern' AND mp.id = t.facet_id
      LEFT JOIN coaching.body_region br ON t.facet_type = 'body_region' AND br.id = t.facet_id
      WHERE e.facility_id = $1 AND e.archived = FALSE AND e.is_published = TRUE
        AND (
          NOT EXISTS (SELECT 1 FROM coaching.exercise_difficulty_profile x WHERE x.exercise_id = e.id)
          OR (d.exercise_id IS NOT NULL
            AND d.default_reps IS NULL AND d.default_work_seconds IS NULL
            AND d.default_distance IS NULL AND d.default_contacts IS NULL AND d.default_rounds IS NULL)
          OR NOT EXISTS (SELECT 1 FROM coaching.exercise_tag x WHERE x.exercise_id = e.id AND x.facet_type = 'pattern')
          OR NOT EXISTS (SELECT 1 FROM coaching.exercise_tag x WHERE x.exercise_id = e.id AND x.facet_type = 'body_region')
        )
      GROUP BY e.id, d.exercise_id, d.volume_unit, d.default_sets, d.default_reps,
        d.default_work_seconds, d.default_distance, d.default_contacts, d.default_rounds,
        d.est_seconds_per_set
      ORDER BY e.slug
    `, [facilityId])
    report.profile = {
      missingDifficultyWithCanonicalDefinition: Number(canonicalCoverage.rows[0]?.count ?? 0),
      gapRows: gapRows.rows,
    }
  }
  if (json) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    console.log(`Needs Engine exercise audit — facility ${facilityId}`)
    console.log(`Published: ${report.publishedExercises}`)
    console.log(`Passing: ${report.passingExercises}`)
    console.log(`Failing: ${report.failingExercises}`)
    for (const [issue, count] of Object.entries(issueCounts)) console.log(`  ${issue}: ${count}`)
    for (const card of report.cards) console.log(`  ${card.slug}: ${card.issues.join(', ')}`)
  }
  if (report.failingExercises > 0) process.exitCode = 1
} finally {
  await pool.end()
}
