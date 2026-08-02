#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

import { buildResearchPacketFromBatch } from '../platform/canonicalResearchBatch.js'

const fileArg = process.argv.find((item) => item.startsWith('--file='))
if (!fileArg) {
  console.error('Usage: node build-canonical-research-batch.mjs --file=/absolute/batch.json [--write]')
  process.exit(2)
}
const filename = path.resolve(fileArg.slice('--file='.length))
const batch = JSON.parse(fs.readFileSync(filename, 'utf8'))
const registryFilename = path.resolve(
  path.dirname(filename),
  batch.sourceRegistry ?? '../source-registry.v1.json',
)
const registryDocument = JSON.parse(fs.readFileSync(registryFilename, 'utf8'))
const sourceRegistry = registryDocument.sources ?? registryDocument
const connectionString = process.env.DATABASE_URL || process.env.DB_URL || process.env.EXTERNAL_DB_URL
if (!connectionString) {
  console.error('Set DATABASE_URL, DB_URL, or EXTERNAL_DB_URL.')
  process.exit(2)
}
if (!Array.isArray(batch.cards) || batch.cards.length === 0) {
  console.error('Batch must contain at least one card specification.')
  process.exit(2)
}
if (!batch.snapshotAt || Number.isNaN(Date.parse(batch.snapshotAt))) {
  console.error('Batch must contain a stable ISO snapshotAt timestamp.')
  process.exit(2)
}

const facilityId = Number(batch.facilityId ?? process.env.FACILITY_ID ?? 1)
const slugs = batch.cards.map((card) => card.slug)
const pool = new pg.Pool({
  connectionString,
  ssl: process.env.DATABASE_SSL === 'false' ? false : undefined,
})

try {
  const result = await pool.query(
    `SELECT
       definition.id,
       definition.slug,
       definition.canonical_name,
       definition.description,
       definition.family_key,
       definition.card_version,
       definition.status,
       definition.movement_patterns,
       definition.body_regions,
       definition.required_equipment,
       definition.optional_equipment,
       definition.environment_json,
       definition.population_json,
       variant.difficulty_json,
       variant.load_profile_json,
       variant.fatigue_profile_json,
       COALESCE(
         jsonb_agg(
           DISTINCT jsonb_build_object(
             'url', media.url,
             'title', media.title,
             'channelName', media.channel_name,
             'sourceQuery', media.source_query,
             'notes', media.notes,
             'linkStatus', media.link_status,
             'embeddingAllowed', media.embedding_allowed,
             'externalVerification', jsonb_build_object(
               'method', CASE
                 WHEN media.discovery_method='youtube_api' THEN 'youtube_api'
                 ELSE 'youtube_oembed'
               END,
               'verifiedAt', media.updated_at
             ),
             'videoId', media.video_id
           )
         ) FILTER (
           WHERE media.id IS NOT NULL
             AND media.review_status IN ('candidate','shortlisted','approved')
             AND media.link_status='healthy'
             AND media.embedding_allowed IS TRUE
         ),
         '[]'::jsonb
       ) AS media_candidates
     FROM coaching.exercise_definition_v1 definition
     LEFT JOIN coaching.exercise_variant_v1 variant
       ON variant.definition_id=definition.id
      AND variant.variant_key='baseline'
     LEFT JOIN coaching.exercise_media_candidate_v1 media
       ON media.definition_id=definition.id
      AND media.reviewed_card_version=definition.card_version
     WHERE definition.facility_id=$1
       AND (definition.status!='archived' OR $3::boolean)
       AND definition.slug=ANY($2::text[])
     GROUP BY definition.id, variant.id
     ORDER BY definition.canonical_name`,
    [facilityId, slugs, batch.includeArchived === true],
  )
  const currentBySlug = new Map(result.rows.map((row) => [row.slug, row]))
  const built = []
  for (const cardSpec of batch.cards) {
    const row = currentBySlug.get(cardSpec.slug)
    if (!row) {
      built.push({ slug: cardSpec.slug, valid: false, errors: [{ message: 'Active canonical card not found.' }] })
      continue
    }
    const currentCard = {
      slug: row.slug,
      canonicalName: row.canonical_name,
      familyKey: row.family_key,
      snapshot: {
        capturedAt: batch.snapshotAt,
        cardVersion: Number(row.card_version),
        status: row.status,
        description: row.description,
        familyKey: row.family_key,
        movementPatterns: row.movement_patterns,
        bodyRegions: row.body_regions,
        requiredEquipment: row.required_equipment,
        optionalEquipment: row.optional_equipment,
        environment: row.environment_json,
        population: row.population_json,
        difficulty: row.difficulty_json ?? {},
        loadProfile: row.load_profile_json ?? {},
        fatigueProfile: row.fatigue_profile_json ?? {},
      },
    }
    const { packet, validation } = buildResearchPacketFromBatch({
      facilityId,
      researchVersion: batch.researchVersion,
      sharedEvidence: batch.sharedEvidence,
      sourceRegistry,
      cardSpec,
      currentCard,
      mediaCandidates: row.media_candidates,
    })
    built.push({
      slug: cardSpec.slug,
      valid: validation.valid,
      errors: validation.errors,
      packet,
    })
  }
  const invalid = built.filter((item) => !item.valid)
  if (invalid.length > 0) {
    console.error(JSON.stringify({
      status: 'invalid_batch',
      batchKey: batch.batchKey,
      invalid: invalid.map(({ slug, errors }) => ({ slug, errors })),
    }, null, 2))
    process.exitCode = 1
  } else if (process.argv.includes('--write')) {
    const outputDirectory = path.resolve(
      path.dirname(filename),
      batch.outputDirectory ?? '../generated',
    )
    fs.mkdirSync(outputDirectory, { recursive: true })
    for (const item of built) {
      fs.writeFileSync(
        path.join(outputDirectory, `${item.slug}.v1.json`),
        `${JSON.stringify(item.packet, null, 2)}\n`,
      )
    }
    fs.writeFileSync(
      path.join(outputDirectory, `${batch.batchKey}.manifest.json`),
      `${JSON.stringify({
        batchKey: batch.batchKey,
        researchVersion: batch.researchVersion,
        generatedAt: batch.snapshotAt,
        cards: built.map((item) => ({
          slug: item.slug,
          evidenceSections: item.packet.evidence.length,
          mediaCandidates: item.packet.mediaCandidates.length,
          alternateAssessments: item.packet.alternateAssessments.length,
        })),
      }, null, 2)}\n`,
    )
    console.log(JSON.stringify({
      status: 'generated',
      batchKey: batch.batchKey,
      outputDirectory,
      cards: built.length,
    }, null, 2))
  } else {
    console.log(JSON.stringify({
      status: 'valid_dry_run',
      batchKey: batch.batchKey,
      cards: built.map((item) => ({
        slug: item.slug,
        evidenceSections: item.packet.evidence.length,
        mediaCandidates: item.packet.mediaCandidates.length,
        alternateAssessments: item.packet.alternateAssessments.length,
      })),
    }, null, 2))
  }
} finally {
  await pool.end()
}
