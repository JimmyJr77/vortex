#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

import {
  buildResearchPacketFromBatch,
} from '../platform/canonicalResearchBatch.js'
import {
  validateResearchPacket,
  youtubeVideoId,
} from '../platform/canonicalResearchReview.js'

const contractArg = process.argv.find((item) => item.startsWith('--contract='))
const outputArg = process.argv.find((item) => item.startsWith('--output='))
const packetOutputArg = process.argv.find((item) => item.startsWith('--packet-output='))
if (!contractArg || !outputArg) {
  console.error('Usage: node build-canonical-candidate-migration.mjs --contract=/absolute/contract.json --output=/absolute/migration.sql [--packet-output=/absolute/generated-directory] [--write]')
  process.exit(2)
}

const contractFilename = path.resolve(contractArg.slice('--contract='.length))
const outputFilename = path.resolve(outputArg.slice('--output='.length))
const packetOutputDirectory = packetOutputArg
  ? path.resolve(packetOutputArg.slice('--packet-output='.length))
  : null
const contract = JSON.parse(fs.readFileSync(contractFilename, 'utf8'))
const batchFilename = path.resolve(
  path.dirname(contractFilename),
  contract.batchFile ?? '../batches/foot-control-trio.v1.json',
)
const batch = JSON.parse(fs.readFileSync(batchFilename, 'utf8'))
const registryFilename = path.resolve(
  path.dirname(batchFilename),
  batch.sourceRegistry ?? '../source-registry.v1.json',
)
const sourceRegistry = JSON.parse(fs.readFileSync(registryFilename, 'utf8')).sources

if (!contract.migrationKey || !contract.researchVersion || !Array.isArray(contract.cards)
  || contract.cards.length === 0) {
  throw new Error('Contract requires migrationKey, researchVersion, and one or more cards.')
}
if (contract.researchVersion !== batch.researchVersion) {
  throw new Error('Contract research version ' + contract.researchVersion
    + ' does not match batch ' + batch.researchVersion + '.')
}

const batchBySlug = new Map(batch.cards.map((card) => [card.slug, card]))
function calibrationAnchor(score) {
  if (score >= 70) return 80
  if (score >= 50) return 60
  if (score >= 30) return 40
  return 20
}

function generatedCalibrations(card) {
  if (Array.isArray(card.calibrations)) return card.calibrations
  const dimensions = [
    ['baseOverallDifficulty', 'baseOverallDifficulty'],
    ['technicalComplexity', 'technicalComplexity'],
    ['supervisionDemand', 'supervisionDemand'],
    ['failureConsequence', 'failureConsequence'],
    ['impact', 'impact'],
    ['workCapacityDemand', 'workCapacityDemand'],
  ]
  return card.variants.flatMap((variant) => dimensions.map(([dimension, field]) => {
    const proposedScore = Number(variant.difficulty?.[field])
    if (!Number.isInteger(proposedScore)) {
      throw new Error('Missing candidate calibration score ' + field
        + ' for ' + variant.displayName + '.')
    }
    return {
      variantId: variant.id,
      dimension,
      proposedScore,
      anchorTier: calibrationAnchor(proposedScore),
      rationale: 'Candidate anchor generated from the exact '
        + variant.displayName
        + ' task contract. Independent human calibration remains required.',
    }
  }))
}

function expectedSnapshot(card) {
  const definition = card.definition
  const variant = card.variants[0]
  return {
    capturedAt: batch.snapshotAt,
    cardVersion: definition.cardVersion,
    status: 'review',
    description: definition.description,
    familyKey: definition.familyKey,
    movementPatterns: definition.movementPatterns,
    bodyRegions: definition.bodyRegions,
    requiredEquipment: definition.requiredEquipment,
    optionalEquipment: definition.optionalEquipment,
    variantKey: variant.key,
    environment: definition.environment,
    population: definition.population,
    difficulty: variant.difficulty,
    loadProfile: variant.loadProfile,
    fatigueProfile: variant.fatigueProfile,
  }
}

const builtCards = contract.cards.map((card) => {
  const batchCard = batchBySlug.get(card.definition?.slug)
  if (!batchCard) throw new Error('No batch card for ' + (card.definition?.slug ?? 'unknown') + '.')
  const { packet, validation } = buildResearchPacketFromBatch({
    facilityId: card.definition.facilityId ?? batch.facilityId ?? 1,
    researchVersion: batch.researchVersion,
    sharedEvidence: batch.sharedEvidence,
    sourceRegistry,
    cardSpec: batchCard,
    currentCard: {
      slug: card.definition.slug,
      canonicalName: card.definition.canonicalName,
      familyKey: card.definition.familyKey,
      snapshot: expectedSnapshot(card),
    },
    mediaCandidates: [],
  })
  if (!validation.valid) throw new Error(card.definition.slug
    + ' batch invalid: ' + JSON.stringify(validation.errors))
  const packetValidation = validateResearchPacket(packet)
  if (!packetValidation.valid) {
    throw new Error(card.definition.slug
      + ' generated packet invalid: ' + JSON.stringify(packetValidation.errors))
  }
  const media = packetValidation.media.map((candidate) => ({
    url: candidate.url,
    videoId: candidate.videoId ?? youtubeVideoId(candidate.url),
    title: candidate.title,
    channelName: candidate.channelName,
    sourceQuery: candidate.sourceQuery,
    notes: candidate.notes,
    linkStatus: candidate.linkStatus,
    embeddingAllowed: candidate.embeddingAllowed === true,
  }))
  const payload = {
    migrationKey: contract.migrationKey,
    researchVersion: contract.researchVersion,
    ...card,
    calibrations: generatedCalibrations(card),
    evidence: packet.evidence,
    media,
    alternates: packet.alternateAssessments,
  }
  return { payload, packet }
})
const payloads = builtCards.map(({ payload }) => payload)

const delimiter = (index) => 'card_' + (index + 1) + '_payload'
const sql = [
  '-- Generated by backend/scripts/build-canonical-candidate-migration.mjs from '
    + path.relative(process.cwd(), contractFilename) + '.',
  '-- Candidate-only canonical card payloads. Human review remains mandatory.',
  'DO $canonical_candidate_batch$',
  'BEGIN',
  ...payloads.map((payload, index) => (
    '  PERFORM coaching.apply_candidate_exercise_card_v1($'
      + delimiter(index) + '$' + JSON.stringify(payload)
      + '$' + delimiter(index) + '$::JSONB);'
  )),
  'END;',
  '$canonical_candidate_batch$;',
  '',
].join('\n')

if (process.argv.includes('--write')) {
  fs.mkdirSync(path.dirname(outputFilename), { recursive: true })
  fs.writeFileSync(outputFilename, sql)
  if (packetOutputDirectory) {
    fs.mkdirSync(packetOutputDirectory, { recursive: true })
    for (const { packet } of builtCards) {
      fs.writeFileSync(
        path.join(packetOutputDirectory, packet.slug + '.v1.json'),
        JSON.stringify(packet, null, 2) + '\n',
      )
    }
    fs.writeFileSync(
      path.join(packetOutputDirectory, contract.migrationKey + '.manifest.json'),
      JSON.stringify({
        migrationKey: contract.migrationKey,
        researchVersion: contract.researchVersion,
        generatedAt: batch.snapshotAt,
        cards: builtCards.map(({ packet }) => ({
          slug: packet.slug,
          evidenceSections: packet.evidence.length,
          mediaCandidates: packet.mediaCandidates.length,
          alternateAssessments: packet.alternateAssessments.length,
          cardVersion: packet.assessmentSummary.currentCardSnapshot.cardVersion,
        })),
      }, null, 2) + '\n',
    )
  }
  console.log(JSON.stringify({
    status: 'generated',
    migrationKey: contract.migrationKey,
    output: outputFilename,
    packetOutputDirectory,
    cards: payloads.map((payload) => ({
      slug: payload.definition.slug,
      evidence: payload.evidence.length,
      media: payload.media.length,
      alternates: payload.alternates.length,
    })),
  }, null, 2))
} else {
  console.log(JSON.stringify({
    status: 'valid_dry_run',
    migrationKey: contract.migrationKey,
    cards: payloads.map((payload) => ({
      slug: payload.definition.slug,
      evidence: payload.evidence.length,
      media: payload.media.length,
      alternates: payload.alternates.length,
    })),
  }, null, 2))
}
