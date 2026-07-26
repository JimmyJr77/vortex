#!/usr/bin/env node
import fs from 'node:fs'
import pg from 'pg'

import {
  validateResearchPacket,
} from '../platform/canonicalResearchReview.js'

const fileArg = process.argv.find((item) => item.startsWith('--file='))
if (!fileArg) {
  console.error('Usage: node import-canonical-research-packet.mjs --file=/absolute/packet.json [--write]')
  process.exit(2)
}
const filename = fileArg.slice('--file='.length)
const packet = JSON.parse(fs.readFileSync(filename, 'utf8'))
const validation = validateResearchPacket(packet)
if (!validation.valid) {
  console.error(JSON.stringify({ errors: validation.errors }, null, 2))
  process.exit(1)
}
if (!process.argv.includes('--write')) {
  console.log(JSON.stringify({
    status: 'valid_dry_run',
    slug: packet.slug,
    evidenceCount: packet.evidence.length,
    coveredSections: validation.sectionKeys.length,
    mediaCandidates: validation.media.length,
    alternateAssessments: packet.alternateAssessments.length,
  }, null, 2))
  process.exit(0)
}

const connectionString = process.env.DATABASE_URL || process.env.DB_URL || process.env.EXTERNAL_DB_URL
if (!connectionString) {
  console.error('Set DATABASE_URL, DB_URL, or EXTERNAL_DB_URL for --write.')
  process.exit(2)
}
const pool = new pg.Pool({
  connectionString,
  ssl: process.env.DATABASE_SSL === 'false' ? false : undefined,
})
const client = await pool.connect()
try {
  await client.query('BEGIN')
  const definitionResult = await client.query(
    `SELECT id, card_version FROM coaching.exercise_definition_v1
     WHERE facility_id=$1 AND slug=$2 AND status!='archived'`,
    [Number(packet.facilityId ?? 1), packet.slug],
  )
  if (definitionResult.rows.length !== 1) throw new Error(`Active canonical definition not found: ${packet.slug}`)
  const definition = definitionResult.rows[0]
  const protectedReviewResult = await client.query(
    `SELECT
       (
         SELECT COUNT(*) FROM coaching.exercise_section_evidence_v1 evidence
         WHERE evidence.definition_id=$1
           AND evidence.reviewed_card_version=$2
           AND evidence.review_status NOT IN ('candidate','superseded')
       )::int AS protected_evidence,
       (
         SELECT COUNT(*) FROM coaching.exercise_media_candidate_v1 media
         WHERE media.definition_id=$1
           AND media.reviewed_card_version=$2
           AND media.review_status NOT IN ('candidate','superseded')
       )::int AS protected_media,
       (
         SELECT COUNT(*) FROM coaching.exercise_alternate_assessment_v1 alternate
         WHERE alternate.definition_id=$1
           AND alternate.reviewed_card_version=$2
           AND alternate.review_status NOT IN ('candidate','superseded')
       )::int AS protected_alternates`,
    [definition.id, definition.card_version],
  )
  const protectedReview = protectedReviewResult.rows[0]
  if (Object.values(protectedReview).some((count) => Number(count) > 0)) {
    throw new Error(
      `Candidate import refused because card ${packet.slug} has human-reviewed current-version records: `
      + JSON.stringify(protectedReview),
    )
  }
  await Promise.all([
    client.query(
      `UPDATE coaching.exercise_section_evidence_v1
       SET review_status='superseded', updated_at=now()
       WHERE definition_id=$1 AND reviewed_card_version=$2
         AND review_status='candidate'`,
      [definition.id, definition.card_version],
    ),
    client.query(
      `UPDATE coaching.exercise_media_candidate_v1
       SET review_status='superseded', updated_at=now()
       WHERE definition_id=$1 AND reviewed_card_version=$2
         AND review_status='candidate'`,
      [definition.id, definition.card_version],
    ),
    client.query(
      `UPDATE coaching.exercise_alternate_assessment_v1
       SET review_status='superseded', updated_at=now()
       WHERE definition_id=$1 AND reviewed_card_version=$2
         AND review_status='candidate'`,
      [definition.id, definition.card_version],
    ),
  ])
  for (const evidence of packet.evidence) {
    await client.query(
      `INSERT INTO coaching.exercise_section_evidence_v1 (
         definition_id, reviewed_card_version, section_key, source_url,
         source_title, source_publisher, source_kind, claims_json,
         evidence_quality, review_status
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,'candidate')
       ON CONFLICT (definition_id, reviewed_card_version, section_key, source_url)
       DO UPDATE SET source_title=EXCLUDED.source_title,
         source_publisher=EXCLUDED.source_publisher,
         source_kind=EXCLUDED.source_kind,
         claims_json=EXCLUDED.claims_json,
         evidence_quality=EXCLUDED.evidence_quality,
         review_status='candidate', reviewer_user_id=NULL, reviewed_at=NULL,
         updated_at=now()`,
      [
        definition.id, definition.card_version, evidence.sectionKey, evidence.sourceUrl,
        evidence.sourceTitle ?? null, evidence.sourcePublisher ?? null,
        evidence.sourceKind, JSON.stringify(evidence.claims ?? []),
        evidence.evidenceQuality ?? null,
      ],
    )
  }
  for (const candidate of validation.media) {
    await client.query(
      `INSERT INTO coaching.exercise_media_candidate_v1 (
         definition_id, reviewed_card_version, url, embed_url, video_id,
         title, channel_name, review_status, link_status, discovery_method,
         source_query, notes
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,'candidate','unverified','manual_research',$8,$9)
       ON CONFLICT (definition_id, reviewed_card_version, video_id)
       DO UPDATE SET title=EXCLUDED.title, channel_name=EXCLUDED.channel_name,
         source_query=EXCLUDED.source_query, notes=EXCLUDED.notes,
         review_status='candidate', link_status='unverified',
         exact_variant_match=NULL, reviewer_user_id=NULL, reviewed_at=NULL,
         updated_at=now()`,
      [
        definition.id, definition.card_version, candidate.url, candidate.embedUrl,
        candidate.videoId, candidate.title ?? null, candidate.channelName ?? null,
        candidate.sourceQuery ?? null, candidate.notes ?? null,
      ],
    )
  }
  for (const alternate of packet.alternateAssessments) {
    await client.query(
      `INSERT INTO coaching.exercise_alternate_assessment_v1 (
         definition_id, reviewed_card_version, alternate_name, classification,
         rationale, distinguishing_dimensions, proposed_card_json, review_status
       ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,'candidate')
       ON CONFLICT (definition_id, reviewed_card_version, alternate_name)
       DO UPDATE SET classification=EXCLUDED.classification,
         rationale=EXCLUDED.rationale,
         distinguishing_dimensions=EXCLUDED.distinguishing_dimensions,
         proposed_card_json=EXCLUDED.proposed_card_json,
         review_status='candidate', reviewer_user_id=NULL, reviewed_at=NULL,
         updated_at=now()`,
      [
        definition.id, definition.card_version, alternate.name,
        alternate.classification, alternate.rationale,
        JSON.stringify(alternate.distinguishingDimensions ?? {}),
        JSON.stringify(alternate.proposedCard ?? null),
      ],
    )
  }
  await client.query('COMMIT')
  console.log(JSON.stringify({
    status: 'imported_as_candidates',
    definitionId: definition.id,
    cardVersion: Number(definition.card_version),
    evidenceCount: packet.evidence.length,
    mediaCandidates: validation.media.length,
    alternateAssessments: packet.alternateAssessments.length,
  }, null, 2))
} catch (error) {
  await client.query('ROLLBACK')
  console.error(error.message)
  process.exitCode = 1
} finally {
  client.release()
  await pool.end()
}
