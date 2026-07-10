#!/usr/bin/env node
/**
 * Seed coaching.exercise_progression with pattern-lane edges from the exercise library.
 * Run after migration 229: node scripts/seed-exercise-progression-graph.mjs
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { requireDatabaseUrl } from './resolveDatabaseUrl.js'

const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), '../backend/package.json'))
const pg = require('pg')

async function main() {
  const { connectionString } = requireDatabaseUrl()
  const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } })
  try {
    const res = await pool.query(`
      WITH progression_phase_exercises AS (
        SELECT DISTINCT e.id AS exercise_id, e.movement_family,
               d.overall AS difficulty_overall,
               ARRAY_AGG(DISTINCT sp.key) FILTER (WHERE sp.key IN ('output','capacity','resilience')) AS phase_keys
        FROM coaching.exercise e
        JOIN coaching.exercise_phase_profile epp ON epp.exercise_id = e.id
        JOIN coaching.session_phase sp ON sp.id = epp.phase_id
        LEFT JOIN coaching.exercise_difficulty_profile d ON d.exercise_id = e.id
        WHERE e.is_published = TRUE
          AND epp.role IN ('primary', 'secondary')
          AND sp.key IN ('output', 'capacity', 'resilience')
        GROUP BY e.id, e.movement_family, d.overall
      ),
      pattern_tags AS (
        SELECT exercise_id, facet_id AS pattern_id
        FROM coaching.exercise_tag
        WHERE facet_type = 'pattern'
      ),
      lane_edges AS (
        SELECT DISTINCT ON (p.exercise_id, g.exercise_id)
          p.exercise_id AS from_exercise_id,
          g.exercise_id AS to_exercise_id,
          CASE WHEN pp.pattern_id IS NOT NULL AND gp.pattern_id = pp.pattern_id THEN 'pattern' ELSE 'family' END AS edge_kind
        FROM progression_phase_exercises p
        JOIN progression_phase_exercises g ON p.exercise_id <> g.exercise_id
        JOIN coaching.exercise pe ON pe.id = p.exercise_id
        JOIN coaching.exercise ge ON ge.id = g.exercise_id
        LEFT JOIN pattern_tags pp ON pp.exercise_id = p.exercise_id
        LEFT JOIN pattern_tags gp ON gp.exercise_id = g.exercise_id
        WHERE COALESCE(g.difficulty_overall, 99) > COALESCE(p.difficulty_overall, 0) + 1
          AND p.phase_keys && g.phase_keys
          AND (
            (pp.pattern_id IS NOT NULL AND gp.pattern_id = pp.pattern_id)
            OR (
              pp.pattern_id IS NULL
              AND LOWER(COALESCE(pe.movement_family, '')) <> ''
              AND LOWER(pe.movement_family) = LOWER(ge.movement_family)
            )
          )
        ORDER BY p.exercise_id, g.exercise_id,
          CASE WHEN pp.pattern_id IS NOT NULL AND gp.pattern_id = pp.pattern_id THEN 0 ELSE 1 END
      )
      INSERT INTO coaching.exercise_progression (from_exercise_id, to_exercise_id, edge_kind)
      SELECT from_exercise_id, to_exercise_id, edge_kind
      FROM lane_edges
      ON CONFLICT (from_exercise_id, to_exercise_id) DO UPDATE SET edge_kind = EXCLUDED.edge_kind
      RETURNING from_exercise_id
    `)

    const countRes = await pool.query(`SELECT COUNT(*)::int AS n FROM coaching.exercise_progression`)
    console.log(`Seeded ${res.rowCount ?? 0} lane edges (total graph rows: ${countRes.rows[0]?.n ?? 0})`)
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
