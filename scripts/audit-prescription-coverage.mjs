#!/usr/bin/env node
/**
 * Audit published exercise coverage for prescription by audience training
 * experience. Exercises are admitted by difficulty caps, never by a card-level
 * skill classification.
 * Usage: DATABASE_URL=... node scripts/audit-prescription-coverage.mjs
 */
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

const PHASES = ['prepare_and_access', 'movement_intelligence', 'output', 'capacity', 'resilience', 'sustained_capacity', 'restore']
const TRAINING_EXPERIENCE_CAPS = {
  BEGINNER: 5,
  INTERMEDIATE: 7,
  ADVANCED: 9,
}

function difficultyBucket(overall) {
  const d = Number(overall)
  if (!Number.isFinite(d)) return 'unknown'
  if (d <= 2) return 'D1-2'
  if (d <= 4) return 'D3-4'
  if (d <= 5) return 'D5'
  if (d <= 6) return 'D6'
  if (d <= 8) return 'D7-8'
  return 'D9-10'
}

async function main() {
  const client = await pool.connect()
  try {
    console.log('phase,training_experience,tenet_key,exercise_count')
    for (const phaseKey of PHASES) {
      for (const [experience, maxOverall] of Object.entries(TRAINING_EXPERIENCE_CAPS)) {
        const rows = await client.query(
          `
            SELECT t.key AS tenet_key, COUNT(DISTINCT e.id)::int AS exercise_count
            FROM coaching.tenet t
            LEFT JOIN coaching.exercise_tag et ON et.facet_type = 'tenet' AND et.facet_id = t.id
            LEFT JOIN coaching.exercise e ON e.id = et.exercise_id
              AND e.archived = FALSE AND e.is_published = TRUE
            LEFT JOIN coaching.exercise_difficulty_profile d ON d.exercise_id = e.id
            LEFT JOIN coaching.exercise_phase_profile p ON p.exercise_id = e.id
            LEFT JOIN coaching.session_phase sp ON sp.id = p.phase_id AND sp.key = $1
            WHERE p.role IN ('primary', 'secondary') AND d.overall <= $2
            GROUP BY t.key
            ORDER BY t.key
          `,
          [phaseKey, maxOverall],
        )
        for (const row of rows.rows) {
          console.log(`${phaseKey},${experience},${row.tenet_key},${row.exercise_count}`)
        }
      }
    }

    console.log('\nphase,training_experience,methodology_hiit_count,restore_primary_count')
    for (const phaseKey of ['sustained_capacity', 'restore']) {
      for (const [experience, maxOverall] of Object.entries(TRAINING_EXPERIENCE_CAPS)) {
        const hiit = await client.query(
          `
            SELECT COUNT(DISTINCT e.id)::int AS count
            FROM coaching.exercise e
            JOIN coaching.exercise_phase_profile p ON p.exercise_id = e.id
            JOIN coaching.session_phase sp ON sp.id = p.phase_id AND sp.key = $1
            JOIN coaching.exercise_tag et ON et.exercise_id = e.id AND et.facet_type = 'methodology'
            JOIN coaching.methodology m ON m.id = et.facet_id AND m.key = 'hiit'
            JOIN coaching.exercise_difficulty_profile d ON d.exercise_id = e.id
            WHERE e.archived = FALSE AND e.is_published = TRUE
              AND p.role IN ('primary', 'secondary')
              AND d.overall <= $2
          `,
          [phaseKey, maxOverall],
        )
        const restorePrimary = phaseKey === 'restore'
          ? await client.query(
              `
                SELECT COUNT(DISTINCT e.id)::int AS count
                FROM coaching.exercise e
                JOIN coaching.exercise_phase_profile p ON p.exercise_id = e.id
                JOIN coaching.session_phase sp ON sp.id = p.phase_id AND sp.key = 'restore'
                JOIN coaching.exercise_difficulty_profile d ON d.exercise_id = e.id
                WHERE e.archived = FALSE AND e.is_published = TRUE
                  AND e.primary_phase_key = 'restore'
                  AND p.role = 'primary'
                  AND d.overall <= $1
              `,
              [maxOverall],
            )
          : { rows: [{ count: 0 }] }
        console.log(`${phaseKey},${experience},${hiit.rows[0].count},${restorePrimary.rows[0].count}`)
      }
    }

    console.log('\nphase,training_experience,difficulty_bucket,exercise_count')
    for (const phaseKey of PHASES) {
      for (const [experience, maxOverall] of Object.entries(TRAINING_EXPERIENCE_CAPS)) {
        const rows = await client.query(
          `
            SELECT d.overall, COUNT(DISTINCT e.id)::int AS exercise_count
            FROM coaching.exercise e
            JOIN coaching.exercise_phase_profile p ON p.exercise_id = e.id
            JOIN coaching.session_phase sp ON sp.id = p.phase_id AND sp.key = $1
            LEFT JOIN coaching.exercise_difficulty_profile d ON d.exercise_id = e.id
            WHERE e.archived = FALSE AND e.is_published = TRUE
              AND e.programming_kind = 'exercise'
              AND p.role IN ('primary', 'secondary')
              AND d.overall <= $2
            GROUP BY d.overall
            ORDER BY d.overall NULLS LAST
          `,
          [phaseKey, maxOverall],
        )
        const bucketCounts = new Map()
        for (const row of rows.rows) {
          const bucket = difficultyBucket(row.overall)
          bucketCounts.set(bucket, (bucketCounts.get(bucket) ?? 0) + Number(row.exercise_count))
        }
        for (const bucket of ['D1-2', 'D3-4', 'D5', 'D6', 'D7-8', 'D9-10', 'unknown']) {
          const count = bucketCounts.get(bucket) ?? 0
          if (count > 0 || bucket === 'D6' || bucket === 'D7-8') {
            console.log(`${phaseKey},${experience},${bucket},${count}`)
          }
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
