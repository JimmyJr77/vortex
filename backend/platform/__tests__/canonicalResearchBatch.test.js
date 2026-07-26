import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  buildResearchPacketFromBatch,
  compileResearchEvidence,
} from '../canonicalResearchBatch.js'
import { REQUIRED_RESEARCH_SECTIONS } from '../canonicalResearchReview.js'

const RESEARCH_ROOT = fileURLToPath(
  new URL('../../../scripts/data/canonical-research/', import.meta.url),
)

const sources = {
  standard: {
    url: 'https://example.com/standard',
    title: 'Standard',
    publisher: 'Example',
    kind: 'professional_standard',
    evidenceQuality: 80,
  },
}

test('family evidence compiles registered provenance and card-specific section overrides', () => {
  const evidence = compileResearchEvidence(
    [
      { sectionKey: 'identity', sourceKey: 'standard', claims: ['{{canonicalName}} shared'] },
      { sectionKey: 'difficulty', sourceKey: 'standard', claims: ['shared difficulty'] },
    ],
    [{ sectionKey: 'difficulty', sourceKey: 'standard', claims: ['card difficulty'] }],
    sources,
    { canonicalName: 'Falling Start' },
  )
  assert.equal(evidence.length, 2)
  assert.deepEqual(evidence.find((item) => item.sectionKey === 'identity').claims, ['Falling Start shared'])
  assert.deepEqual(evidence.find((item) => item.sectionKey === 'difficulty').claims, ['card difficulty'])
  assert.throws(
    () => compileResearchEvidence(
      [{ sectionKey: 'identity', sourceKey: 'missing', claims: ['x'] }],
      [],
      sources,
    ),
    /Unknown research source/,
  )
})

test('family packet remains candidate-only and must satisfy full packet validation', () => {
  const sharedEvidence = REQUIRED_RESEARCH_SECTIONS.map((sectionKey) => ({
    sectionKey,
    sourceKey: 'standard',
    claims: [`Evidence for ${sectionKey}`],
  }))
  const result = buildResearchPacketFromBatch({
    facilityId: 1,
    researchVersion: '2026-07-25.1',
    sharedEvidence,
    sourceRegistry: sources,
    cardSpec: {
      assessmentSummary: { identity: '{{canonicalName}} identity' },
      alternateAssessments: [{
        name: 'Alternate',
        classification: 'new_variant',
        rationale: 'Changes the start position.',
        distinguishingDimensions: { startPosition: 'alternate' },
      }],
    },
    currentCard: {
      slug: 'falling-start',
      canonicalName: 'Falling Start',
      familyKey: 'Acceleration',
      snapshot: { cardVersion: 1 },
    },
    mediaCandidates: ['aaa111BBB22', 'ccc333DDD44', 'eee555FFF66'].map((id) => ({
      url: `https://www.youtube.com/watch?v=${id}`,
    })),
  })
  assert.equal(result.validation.valid, true)
  assert.equal(result.packet.assessmentSummary.identity, 'Falling Start identity')
  assert.equal(result.packet.mediaCandidates.some((candidate) => candidate.reviewStatus === 'approved'), false)
})

test('family batch can supply manual media candidates without fabricating verification', () => {
  const sharedEvidence = REQUIRED_RESEARCH_SECTIONS.map((sectionKey) => ({
    sectionKey,
    sourceKey: 'standard',
    claims: [`Evidence for ${sectionKey}`],
  }))
  const suppliedCandidates = ['aaa111BBB22', 'ccc333DDD44', 'eee555FFF66'].map((id) => ({
    url: `https://www.youtube.com/watch?v=${id}`,
    title: '{{canonicalName}} candidate',
    sourceQuery: '{{canonicalName}} exact exercise',
  }))
  const result = buildResearchPacketFromBatch({
    facilityId: 1,
    researchVersion: '2026-07-25.2',
    sharedEvidence,
    sourceRegistry: sources,
    cardSpec: {
      assessmentSummary: { identity: 'Flying sprint' },
      mediaCandidates: suppliedCandidates,
      alternateAssessments: [{
        name: 'Alternate',
        classification: 'modifier_annotation',
        rationale: 'Changes dosage only.',
        distinguishingDimensions: { distance: '20_meters' },
      }],
    },
    currentCard: {
      slug: 'flying-10',
      canonicalName: 'Flying 10',
      familyKey: 'Max velocity',
      snapshot: { cardVersion: 1 },
    },
    mediaCandidates: [],
  })

  assert.equal(result.validation.valid, true)
  assert.equal(result.packet.mediaCandidates.length, 3)
  assert.equal(result.packet.mediaCandidates[0].title, 'Flying 10 candidate')
  assert.equal(result.packet.mediaCandidates[0].linkStatus, 'unverified')
  assert.equal(result.packet.mediaCandidates[0].embeddingAllowed, false)
  assert.equal(result.packet.mediaCandidates[0].externalVerification, null)
})

test('adductor rock-back family packet preserves unresolved variants and human media gates', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  const batch = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'batches/adductor-rockback-family.v1.json'),
    'utf8',
  ))
  const [cardSpec] = batch.cards
  const result = buildResearchPacketFromBatch({
    facilityId: batch.facilityId,
    researchVersion: batch.researchVersion,
    sharedEvidence: batch.sharedEvidence,
    sourceRegistry: registryDocument.sources,
    cardSpec,
    currentCard: {
      slug: cardSpec.slug,
      canonicalName: 'Adductor Rockback',
      familyKey: 'Hip mobility',
      snapshot: {
        capturedAt: batch.snapshotAt,
        cardVersion: 1,
        status: 'review',
      },
    },
    mediaCandidates: [],
  })

  assert.equal(result.validation.valid, true)
  assert.equal(result.packet.evidence.length, REQUIRED_RESEARCH_SECTIONS.length)
  assert.equal(result.packet.mediaCandidates.length, 5)
  assert.equal(result.packet.alternateAssessments.length, 11)
  assert.equal(result.packet.assessmentSummary.proposedDifficulty.baseOverallDifficulty, 26)
  assert.ok(result.packet.assessmentSummary.variantDifficultyCandidates.some((variant) => (
    variant.variantKey === 'reach-overlay-unresolved'
      && variant.identityQuarantine === true
      && variant.scoreDeferred === true
  )))
  assert.ok(result.packet.assessmentSummary.variantDifficultyCandidates.some((variant) => (
    variant.variantKey === 'half-kneeling-kicking-access'
      && variant.identityQuarantine === true
      && variant.scoreDeferred === true
  )))
  assert.ok(result.packet.mediaCandidates.every((candidate) => (
    candidate.linkStatus === 'unverified'
      && candidate.embeddingAllowed === false
      && candidate.externalVerification === null
  )))
  assert.ok(result.packet.mediaCandidates.every((candidate) => (
    !Object.hasOwn(candidate, 'exactVariantMatch')
      && !Object.hasOwn(candidate, 'reviewerUserId')
      && !Object.hasOwn(candidate, 'reviewedAt')
  )))
})
