#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

import { buildResearchPacketFromBatch } from '../platform/canonicalResearchBatch.js'
import { validateResearchPacket } from '../platform/canonicalResearchReview.js'

const arg = (name, fallback = null) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback
const batchFile = arg('batch')
const requestedSlugs = String(arg('slugs', '')).split(',').map((slug) => slug.trim()).filter(Boolean)
const write = process.argv.includes('--write')
const connectionString = process.env.DATABASE_URL || process.env.DB_URL

if (!batchFile || requestedSlugs.length === 0 || !connectionString) {
  throw new Error('Usage: DATABASE_URL=... node hydrate-canonical-research-packets.mjs --batch=/absolute/batch.json --slugs=slug-a,slug-b [--write]')
}

const resolvedBatchFile = path.resolve(batchFile)
const batch = JSON.parse(fs.readFileSync(resolvedBatchFile, 'utf8'))
const registryFile = path.resolve(path.dirname(resolvedBatchFile), batch.sourceRegistry ?? '../source-registry.v1.json')
const sourceRegistry = JSON.parse(fs.readFileSync(registryFile, 'utf8')).sources
const specs = new Map(batch.cards.map((card) => [card.slug, card]))
const pool = new pg.Pool({ connectionString, ssl: process.env.DATABASE_SSL === 'false' ? false : undefined })

try {
  for (const slug of requestedSlugs) {
    const spec = specs.get(slug)
    if (!spec) throw new Error(`Batch has no card for ${slug}.`)
    const result = await pool.query(
      `SELECT id, facility_id, card_version, canonical_name, family_key, status,
              description, movement_patterns, body_regions, required_equipment,
              optional_equipment, environment_json, population_json
       FROM coaching.exercise_definition_v1
       WHERE facility_id=$1 AND slug=$2`, [batch.facilityId ?? 1, slug],
    )
    const card = result.rows[0]
    if (!card || card.status !== 'review') throw new Error(`${slug} must be an unreviewed review card.`)
    const reviewedRows = await pool.query(
      `SELECT 'evidence' AS kind, id
         FROM coaching.exercise_section_evidence_v1
        WHERE definition_id=$1
          AND reviewed_card_version=$2
          AND (reviewer_user_id IS NOT NULL OR review_status NOT IN ('candidate', 'superseded'))
       UNION ALL
       SELECT 'alternate' AS kind, id
         FROM coaching.exercise_alternate_assessment_v1
        WHERE definition_id=$1
          AND reviewed_card_version=$2
          AND (reviewer_user_id IS NOT NULL OR review_status NOT IN ('candidate', 'superseded'))`,
      [card.id, card.card_version],
    )
    if (reviewedRows.rowCount > 0) {
      throw new Error(`${slug} has human-reviewed research records; refusing to overwrite them.`)
    }
    const { packet, validation } = buildResearchPacketFromBatch({
      facilityId: card.facility_id,
      researchVersion: batch.researchVersion,
      sharedEvidence: batch.sharedEvidence,
      sourceRegistry,
      cardSpec: spec,
      currentCard: {
        slug,
        canonicalName: card.canonical_name,
        familyKey: card.family_key,
        snapshot: {
          cardVersion: card.card_version, status: card.status, description: card.description,
          movementPatterns: card.movement_patterns, bodyRegions: card.body_regions,
          requiredEquipment: card.required_equipment, optionalEquipment: card.optional_equipment,
          environment: card.environment_json, population: card.population_json,
        },
      },
      mediaCandidates: [],
    })
    if (!validation.valid || !validateResearchPacket(packet).valid) throw new Error(`Invalid research packet for ${slug}.`)
    if (!write) {
      console.log(JSON.stringify({ slug, evidence: packet.evidence.length, alternates: packet.alternateAssessments.length, status: 'dry_run' }))
      continue
    }
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      for (const evidence of packet.evidence) {
        await client.query(
          `INSERT INTO coaching.exercise_section_evidence_v1
             (definition_id, reviewed_card_version, section_key, source_url, source_title, source_publisher, source_kind, claims_json, evidence_quality, review_status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'candidate')
           ON CONFLICT (definition_id, reviewed_card_version, section_key, source_url)
           DO UPDATE SET source_title=EXCLUDED.source_title, source_publisher=EXCLUDED.source_publisher,
             source_kind=EXCLUDED.source_kind, claims_json=EXCLUDED.claims_json,
             evidence_quality=EXCLUDED.evidence_quality, review_status='candidate', updated_at=now()`,
          [card.id, card.card_version, evidence.sectionKey, evidence.sourceUrl, evidence.sourceTitle,
            evidence.sourcePublisher, evidence.sourceKind, JSON.stringify(evidence.claims), evidence.evidenceQuality],
        )
      }
      for (const alternate of packet.alternateAssessments) {
        await client.query(
          `INSERT INTO coaching.exercise_alternate_assessment_v1
             (definition_id, reviewed_card_version, alternate_name, classification, rationale, distinguishing_dimensions, review_status)
           VALUES ($1,$2,$3,$4,$5,$6,'candidate')
           ON CONFLICT DO NOTHING`,
          [card.id, card.card_version, alternate.name, alternate.classification, alternate.rationale,
            JSON.stringify(alternate.distinguishingDimensions ?? {})],
        )
      }
      await client.query('COMMIT')
      console.log(JSON.stringify({ slug, evidence: packet.evidence.length, alternates: packet.alternateAssessments.length, status: 'hydrated' }))
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally { client.release() }
  }
} finally { await pool.end() }
