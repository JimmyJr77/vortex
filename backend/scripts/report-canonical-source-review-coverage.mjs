#!/usr/bin/env node
import pg from 'pg'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

function argument(name, fallback = null) {
  const prefix = `--${name}=`
  const value = process.argv.find((item) => item.startsWith(prefix))
  return value ? value.slice(prefix.length) : fallback
}

const connectionString = process.env.DATABASE_URL || process.env.DB_URL || process.env.EXTERNAL_DB_URL
if (!connectionString) {
  console.error('Set DATABASE_URL, DB_URL, or EXTERNAL_DB_URL.')
  process.exit(2)
}

const facilityId = Number(argument('facility', process.env.FACILITY_ID || 1))
const json = process.argv.includes('--json')
const pool = new pg.Pool({ connectionString, ssl: process.env.DATABASE_SSL === 'false' ? false : undefined })
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const generatedDirectory = path.join(repositoryRoot, 'scripts', 'data', 'canonical-research', 'generated')
const packetsBySlug = new Map(
  fs.readdirSync(generatedDirectory)
    .filter((name) => name.endsWith('.v1.json'))
    .map((name) => {
      const slug = name.slice(0, -'.v1.json'.length)
      const packet = JSON.parse(fs.readFileSync(path.join(generatedDirectory, name), 'utf8'))
      return [slug, packet]
    }),
)
const packetSlugs = new Set(packetsBySlug.keys())

try {
  const [summary, archivedFamilies, archivedSources, archivedDispositionCoverage] = await Promise.all([
    pool.query(`
      SELECT
        count(DISTINCT e.id)::int AS legacy_exercises,
        count(DISTINCT source.legacy_exercise_id)::int AS mapped_sources,
        count(DISTINCT e.id) FILTER (WHERE source.legacy_exercise_id IS NULL)::int AS unmapped_sources,
        count(*) FILTER (WHERE definition.status='review')::int AS review_source_rows,
        count(*) FILTER (WHERE definition.status='archived')::int AS archived_source_rows,
        count(DISTINCT source.legacy_exercise_id) FILTER (WHERE definition.status='review')::int AS review_sources,
        count(DISTINCT source.legacy_exercise_id) FILTER (WHERE definition.status='archived')::int AS archived_sources
      FROM coaching.exercise e
      LEFT JOIN coaching.exercise_definition_source_v1 source ON source.legacy_exercise_id=e.id
      LEFT JOIN coaching.exercise_definition_v1 definition ON definition.id=source.definition_id AND definition.facility_id=$1
    `, [facilityId]),
    pool.query(`
      SELECT definition.family_key, count(*)::int AS source_rows, count(DISTINCT source.legacy_exercise_id)::int AS sources
      FROM coaching.exercise_definition_source_v1 source
      JOIN coaching.exercise_definition_v1 definition ON definition.id=source.definition_id
      WHERE definition.facility_id=$1 AND definition.status='archived'
      GROUP BY definition.family_key
      ORDER BY source_rows DESC, definition.family_key
      LIMIT 25
    `, [facilityId]),
    pool.query(`
      SELECT source.legacy_exercise_id, definition.slug, definition.canonical_name, definition.family_key
      FROM coaching.exercise_definition_source_v1 source
      JOIN coaching.exercise_definition_v1 definition ON definition.id=source.definition_id
      WHERE definition.facility_id=$1 AND definition.status='archived'
      ORDER BY source.legacy_exercise_id
    `, [facilityId]),
    pool.query(`
      WITH archived_source_state AS (
        SELECT
          source.legacy_exercise_id,
          bool_or(coalesce(definition.provenance_json ->> 'sourceDisposition', '') <> '')
            AS has_reviewed_disposition,
          bool_or(variant.variant_key LIKE 'identity-quarantine-%')
            AS has_identity_quarantine_variant
        FROM coaching.exercise_definition_source_v1 source
        JOIN coaching.exercise_definition_v1 definition ON definition.id=source.definition_id
        LEFT JOIN coaching.exercise_variant_v1 variant ON variant.definition_id=definition.id
        WHERE definition.facility_id=$1 AND definition.status='archived'
        GROUP BY source.legacy_exercise_id
      )
      SELECT
        count(*)::int AS archived_sources,
        count(*) FILTER (WHERE has_reviewed_disposition OR has_identity_quarantine_variant)::int
          AS archived_sources_with_reviewed_disposition,
        count(*) FILTER (WHERE NOT has_reviewed_disposition AND NOT has_identity_quarantine_variant)::int
          AS archived_sources_without_reviewed_disposition
      FROM archived_source_state
    `, [facilityId]),
  ])
  const packetReadySources = archivedSources.rows
    .filter((row) => packetSlugs.has(row.slug))
    .map((row) => {
      const assessment = packetsBySlug.get(row.slug)?.assessmentSummary ?? {}
      return {
        ...row,
        identitySummary: assessment.identity ?? null,
        programmingDecision: assessment.programmingDecision ?? null,
      }
    })
  const report = {
    facilityId,
    generatedAt: new Date().toISOString(),
    ...summary.rows[0],
    archivedSourcesWithLocalResearchPacket: packetReadySources.length,
    archivedSourcesWithoutLocalResearchPacket: archivedSources.rows.length - packetReadySources.length,
    archivedSourcesWithReviewedDisposition: archivedDispositionCoverage.rows[0].archived_sources_with_reviewed_disposition,
    archivedSourcesWithoutReviewedDisposition: archivedDispositionCoverage.rows[0].archived_sources_without_reviewed_disposition,
    nextResearchBackedArchivedSources: packetReadySources.slice(0, 50),
    archivedFamilies: archivedFamilies.rows,
    interpretation: 'Review-source coverage measures source rows mapped to active review definitions. Archived-source coverage is preserved lineage or an unresolved/nonselectable identity; it is not reviewed exercise content or publication approval.',
  }
  if (json) console.log(JSON.stringify(report, null, 2))
  else {
    console.log(`Canonical source review coverage — facility ${facilityId}`)
    for (const key of ['legacy_exercises', 'mapped_sources', 'unmapped_sources', 'review_source_rows', 'archived_source_rows', 'review_sources', 'archived_sources']) console.log(`${key}: ${report[key]}`)
    console.log('Largest archived source families:')
    for (const row of report.archivedFamilies) console.log(`  ${row.family_key || '(none)'}: ${row.source_rows}`)
  }
} finally {
  await pool.end()
}
