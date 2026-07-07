#!/usr/bin/env node
/**
 * Audit published exercise coverage for prescription (phase + tenet + skill band).
 * Usage: DATABASE_URL=... node scripts/audit-prescription-coverage.mjs
 */
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

const PHASES = ['prepare_and_access', 'movement_intelligence', 'output', 'capacity', 'resilience', 'sustained_capacity', 'restore']
const SKILL_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED']

async function main() {
  const client = await pool.connect()
  try {
    console.log('phase,skill_level,tenet_key,exercise_count')
    for (const phaseKey of PHASES) {
      for (const skill of SKILL_LEVELS) {
        const rows = await client.query(
          `
            SELECT t.key AS tenet_key, COUNT(DISTINCT e.id)::int AS exercise_count
            FROM coaching.tenet t
            LEFT JOIN coaching.exercise_tag et ON et.facet_type = 'tenet' AND et.facet_id = t.id
            LEFT JOIN coaching.exercise e ON e.id = et.exercise_id
              AND e.archived = FALSE AND e.is_published = TRUE
              AND (e.skill_level IS NULL OR e.skill_level = $2::public.skill_level)
            LEFT JOIN coaching.exercise_phase_profile p ON p.exercise_id = e.id
            LEFT JOIN coaching.session_phase sp ON sp.id = p.phase_id AND sp.key = $1
            WHERE p.role IN ('primary', 'secondary')
            GROUP BY t.key
            ORDER BY t.key
          `,
          [phaseKey, skill],
        )
        for (const row of rows.rows) {
          console.log(`${phaseKey},${skill},${row.tenet_key},${row.exercise_count}`)
        }
      }
    }
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
