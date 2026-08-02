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
const RESEARCH_BATCH_BUILDER_SOURCE = readFileSync(
  new URL('../../scripts/build-canonical-research-batch.mjs', import.meta.url),
  'utf8',
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

test('single-leg hop and pogo packets preserve direction-specific cards, exact terminal contacts, and human media gates', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  const batch = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'batches/single-leg-hop-pogo-identity.v1.json'),
    'utf8',
  ))
  const cardNames = new Map([
    ['single-leg-vertical-hop-to-stick', 'Single-Leg Vertical Hop to Stick'],
    ['single-leg-forward-hop-to-stick', 'Single-Leg Forward Hop to Stick'],
    ['single-leg-pogo', 'Single-Leg Pogo'],
    ['single-leg-hop-to-stick', 'Single-Leg Hop to Stick (Unresolved Legacy)'],
    ['single-leg-pogo-hold-stick', 'Single-Leg Pogo Hold-Stick (Unresolved Legacy)'],
  ])

  const packets = new Map()
  for (const cardSpec of batch.cards) {
    const archived = cardSpec.slug === 'single-leg-hop-to-stick'
      || cardSpec.slug === 'single-leg-pogo-hold-stick'
    const result = buildResearchPacketFromBatch({
      facilityId: batch.facilityId,
      researchVersion: batch.researchVersion,
      sharedEvidence: batch.sharedEvidence,
      sourceRegistry: registryDocument.sources,
      cardSpec,
      currentCard: {
        slug: cardSpec.slug,
        canonicalName: cardNames.get(cardSpec.slug),
        familyKey: archived ? 'unresolved_identity' : 'single_leg_hop_or_pogo',
        snapshot: {
          capturedAt: batch.snapshotAt,
          cardVersion: archived ? 2 : (cardSpec.slug === 'single-leg-pogo' ? 4 : 1),
          status: archived ? 'archived' : 'review',
        },
      },
      mediaCandidates: [],
    })
    assert.equal(result.validation.valid, true)
    assert.equal(result.packet.evidence.length, REQUIRED_RESEARCH_SECTIONS.length)
    assert.ok(result.packet.mediaCandidates.length >= 3)
    assert.ok(result.packet.mediaCandidates.length <= 5)
    assert.ok(result.packet.mediaCandidates.every((candidate) => (
      (candidate.reviewStatus ?? 'candidate') === 'candidate'
        && candidate.linkStatus === 'healthy'
        && candidate.embeddingAllowed === true
        && (candidate.exactVariantMatch ?? null) === null
        && !Object.hasOwn(candidate, 'demonstrationQualityScore')
        && !Object.hasOwn(candidate, 'reviewerUserId')
        && !Object.hasOwn(candidate, 'reviewedAt')
    )))
    assert.doesNotMatch(
      JSON.stringify(result.packet),
      /"(?:exerciseSkillLevel|skillLevel|skill_level|minimumSkillLevel|minimum_skill_level|proficiencyLevel|proficiency_level|proficiencyClassification)"/,
    )
    packets.set(cardSpec.slug, result.packet)
  }

  const vertical = packets.get('single-leg-vertical-hop-to-stick')
  assert.deepEqual(vertical.assessmentSummary.proposedDifficulty, {
    technicalComplexity: 42,
    absoluteLoadDemand: 40,
    baseOverallDifficulty: 42,
    formula: 'max(technicalComplexity, absoluteLoadDemand)',
  })
  assert.match(vertical.assessmentSummary.identity, /primarily upward/i)

  const forward = packets.get('single-leg-forward-hop-to-stick')
  assert.equal(forward.assessmentSummary.proposedDifficulty.baseOverallDifficulty, 44)
  assert.deepEqual(
    forward.assessmentSummary.variantDifficultyCandidates.map((variant) => (
      [variant.variantKey, variant.exerciseComplexity, variant.physicalDifficulty]
    )),
    [
      ['stationary-low-amplitude-forward-same-leg-stick', 44, 42],
      ['stationary-moderate-distance-forward-same-leg-stick', 50, 50],
    ],
  )

  const pogo = packets.get('single-leg-pogo')
  assert.match(pogo.assessmentSummary.identity, /two or more same-leg/i)
  assert.deepEqual(pogo.assessmentSummary.variantDifficultyCandidates, [{
    variantKey: 'stationary-low-amplitude-to-terminal-stick',
    exerciseComplexity: 50,
    physicalDifficulty: 56,
    overallDifficulty: 56,
  }])

  for (const slug of ['single-leg-hop-to-stick', 'single-leg-pogo-hold-stick']) {
    const source = packets.get(slug)
    assert.equal(Object.hasOwn(source.assessmentSummary, 'proposedDifficulty'), false)
    assert.match(source.assessmentSummary.difficultyDecision, /Do not score/)
    assert.equal(source.assessmentSummary.identityDecision.humanReviewRequired, true)
  }
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

test('Cossack packets preserve exact implement variants and quarantine unresolved reach and wall-toss protocols', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  const batch = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'batches/cossack-squat-family.v1.json'),
    'utf8',
  ))

  const packets = batch.cards.map((cardSpec) => buildResearchPacketFromBatch({
    facilityId: batch.facilityId,
    researchVersion: batch.researchVersion,
    sharedEvidence: batch.sharedEvidence,
    sourceRegistry: registryDocument.sources,
    cardSpec,
    currentCard: {
      slug: cardSpec.slug,
      canonicalName: cardSpec.slug === 'cossack-squat'
        ? 'Cossack Squat'
        : 'Cossack Shift to Wall Ball Toss',
      familyKey: 'Frontal-plane squat',
      snapshot: {
        capturedAt: batch.snapshotAt,
        cardVersion: 1,
        status: 'review',
      },
    },
    mediaCandidates: [],
  }))

  for (const result of packets) {
    assert.equal(result.validation.valid, true)
    assert.equal(result.packet.evidence.length, REQUIRED_RESEARCH_SECTIONS.length)
    assert.equal(result.packet.mediaCandidates.length, 5)
    assert.ok(result.packet.mediaCandidates.every((candidate) => (
      candidate.reviewStatus !== 'approved'
        && candidate.linkStatus === 'unverified'
        && candidate.embeddingAllowed === false
        && (candidate.exactVariantMatch ?? null) === null
        && candidate.externalVerification === null
    )))
  }

  const cossack = packets[0].packet
  assert.equal(cossack.alternateAssessments.length, 15)
  assert.equal(cossack.assessmentSummary.proposedDifficulty.baseOverallDifficulty, 48)
  assert.equal(cossack.assessmentSummary.variantDifficultyCandidates.length, 13)
  assert.ok(cossack.assessmentSummary.variantDifficultyCandidates.some((variant) => (
    variant.variantKey === 'reach-overlay'
      && variant.identityQuarantine === true
  )))
  assert.ok(cossack.assessmentSummary.variantDifficultyCandidates.some((variant) => (
    variant.variantKey === 'loaded-unspecified-implement'
      && variant.identityQuarantine === true
      && variant.scoreDeferred === true
  )))

  const wallToss = packets[1].packet
  assert.equal(wallToss.alternateAssessments.length, 7)
  assert.match(
    wallToss.assessmentSummary.identity,
    /throw direction, target height, ball path, rebound behavior, reception, reset/i,
  )
  assert.match(
    wallToss.assessmentSummary.proposedDosage.publicationBlock,
    /No dose is production-authorized/i,
  )
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

test('hang family batch keeps passive, active, and dynamic scapular identities distinct', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  const batch = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'batches/hang-scapular-control-family.v1.json'),
    'utf8',
  ))
  const expected = new Map([
    ['dead-hang', {
      difficulty: [18, 52, 52],
      movementPatterns: ['hang', 'brace'],
      variantKeys: ['baseline', 'foot-assisted', 'band-assisted', 'ring', 'weighted', 'single-arm'],
    }],
    ['active-hang', {
      difficulty: [28, 58, 58],
      movementPatterns: ['hang', 'pull', 'brace'],
      variantKeys: ['baseline', 'foot-assisted', 'band-assisted', 'ring', 'weighted', 'single-arm'],
    }],
    ['scapular-pull-up', {
      difficulty: [38, 62, 62],
      movementPatterns: ['hang', 'pull', 'brace'],
      variantKeys: ['baseline', 'foot-assisted', 'band-assisted', 'ring', 'weighted', 'single-arm'],
    }],
  ])

  assert.equal(Object.hasOwn(registryDocument.sources, 'crossfit_active_shoulders_hanging'), false)
  assert.equal(batch.cards.length, 3)
  for (const cardSpec of batch.cards) {
    const expectedCard = expected.get(cardSpec.slug)
    const result = buildResearchPacketFromBatch({
      facilityId: batch.facilityId,
      researchVersion: batch.researchVersion,
      sharedEvidence: batch.sharedEvidence,
      sourceRegistry: registryDocument.sources,
      cardSpec,
      currentCard: {
        slug: cardSpec.slug,
        canonicalName: cardSpec.slug === 'dead-hang'
          ? 'Dead Hang'
          : cardSpec.slug === 'active-hang'
            ? 'Active Hang'
            : 'Scapular Pull-Up',
        familyKey: 'Straight-arm hanging and scapular control',
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
    const [technical, physical, overall] = expectedCard.difficulty
    assert.equal(result.packet.assessmentSummary.proposedDifficulty.technicalComplexity, technical)
    assert.equal(result.packet.assessmentSummary.proposedDifficulty.absoluteLoadDemand, physical)
    assert.equal(result.packet.assessmentSummary.proposedDifficulty.baseOverallDifficulty, overall)
    assert.deepEqual(
      result.packet.assessmentSummary.proposedTaxonomy.movementPatterns,
      expectedCard.movementPatterns,
    )
    assert.deepEqual(
      result.packet.assessmentSummary.variantDifficultyCandidates.map((variant) => variant.variantKey),
      expectedCard.variantKeys,
    )
    assert.ok(result.packet.assessmentSummary.variantDifficultyCandidates.every((variant) => (
      variant.derivedOverallDifficulty === Math.max(
        variant.exerciseComplexity,
        variant.physicalDifficulty,
      )
    )))
    assert.doesNotMatch(JSON.stringify(cardSpec), /"(?:skillLevel|skill_level|minimumSkillLevel|minimum_skill_level)"/)
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
  }

  const dead = batch.cards.find((card) => card.slug === 'dead-hang')
  const active = batch.cards.find((card) => card.slug === 'active-hang')
  const scapular = batch.cards.find((card) => card.slug === 'scapular-pull-up')
  assert.match(dead.assessmentSummary.identity, /passive/i)
  assert.match(active.assessmentSummary.identity, /isometric/i)
  assert.match(scapular.assessmentSummary.identity, /dynamic/i)
  assert.ok(dead.alternateAssessments.some((alternate) => (
    alternate.name === 'Active Hang' && alternate.classification === 'new_definition'
  )))
  assert.ok(active.alternateAssessments.some((alternate) => (
    alternate.name === 'Dead Hang' && alternate.classification === 'new_definition'
  )))
  assert.ok(scapular.alternateAssessments.some((alternate) => (
    alternate.name === 'Active Hang' && alternate.classification === 'new_definition'
  )))
})

test('hanging leg-raise batch consolidates knee angle and tempo as difficulty-scored variants', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  const batch = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'batches/hanging-leg-raise-family.v1.json'),
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
      canonicalName: 'Hanging Leg Raise',
      familyKey: 'Hanging hip flexion and trunk control',
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
  assert.equal(result.packet.alternateAssessments.length, 17)
  assert.deepEqual(
    {
      technical: result.packet.assessmentSummary.proposedDifficulty.technicalComplexity,
      physical: result.packet.assessmentSummary.proposedDifficulty.absoluteLoadDemand,
      overall: result.packet.assessmentSummary.proposedDifficulty.baseOverallDifficulty,
    },
    { technical: 42, physical: 62, overall: 62 },
  )
  assert.ok(result.packet.assessmentSummary.variantDifficultyCandidates.every((variant) => (
    variant.derivedOverallDifficulty === Math.max(
      variant.exerciseComplexity,
      variant.physicalDifficulty,
    )
  )))
  assert.ok(cardSpec.alternateAssessments.some((alternate) => (
    alternate.name === 'Tuck Hanging Knee Raise'
      && alternate.classification === 'same_identity'
  )))
  assert.ok(cardSpec.alternateAssessments.some((alternate) => (
    alternate.name === 'Hanging Straight-Leg Raise'
      && alternate.classification === 'new_variant'
  )))
  assert.ok(cardSpec.alternateAssessments.some((alternate) => (
    alternate.name === 'Hanging Knee Raise Eccentric Lower'
      && alternate.classification === 'new_variant'
  )))
  assert.ok(cardSpec.alternateAssessments.some((alternate) => (
    alternate.name === 'Kipping Hanging Knee Raise'
      && alternate.classification === 'new_definition'
  )))
  assert.ok(result.packet.mediaCandidates.every((candidate) => (
    candidate.linkStatus === 'unverified'
      && candidate.embeddingAllowed === false
      && candidate.externalVerification === null
  )))
})

test('L-sit batch separates push support from hanging support without exercise skill levels', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  const batch = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'batches/l-sit-support-and-hanging-family.v1.json'),
    'utf8',
  ))
  const expected = new Map([
    ['l-sit', { name: 'L-Sit', family: 'Straight-arm support compression hold', scores: [58, 68, 68], alternates: 11 }],
    ['hanging-l-sit', { name: 'Hanging L-Sit', family: 'Static hanging compression hold', scores: [50, 68, 68], alternates: 8 }],
  ])

  assert.equal(batch.cards.length, 2)
  for (const cardSpec of batch.cards) {
    const card = expected.get(cardSpec.slug)
    const result = buildResearchPacketFromBatch({
      facilityId: batch.facilityId,
      researchVersion: batch.researchVersion,
      sharedEvidence: batch.sharedEvidence,
      sourceRegistry: registryDocument.sources,
      cardSpec,
      currentCard: {
        slug: cardSpec.slug,
        canonicalName: card.name,
        familyKey: card.family,
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
    assert.equal(result.packet.alternateAssessments.length, card.alternates)
    assert.deepEqual(
      [
        result.packet.assessmentSummary.proposedDifficulty.technicalComplexity,
        result.packet.assessmentSummary.proposedDifficulty.absoluteLoadDemand,
        result.packet.assessmentSummary.proposedDifficulty.baseOverallDifficulty,
      ],
      card.scores,
    )
    assert.ok(result.packet.assessmentSummary.variantDifficultyCandidates.every((variant) => (
      variant.derivedOverallDifficulty === Math.max(
        variant.exerciseComplexity,
        variant.physicalDifficulty,
      )
    )))
    assert.ok(result.packet.mediaCandidates.every((candidate) => (
      candidate.linkStatus === 'unverified'
        && candidate.embeddingAllowed === false
        && candidate.externalVerification === null
        && !Object.hasOwn(candidate, 'exactVariantMatch')
        && !Object.hasOwn(candidate, 'reviewerUserId')
        && !Object.hasOwn(candidate, 'reviewedAt')
    )))
  }

  const support = batch.cards.find((card) => card.slug === 'l-sit')
  const hanging = batch.cards.find((card) => card.slug === 'hanging-l-sit')
  assert.match(support.assessmentSummary.identity, /straight-arm push support/i)
  assert.match(hanging.assessmentSummary.identity, /suspended by both hands/i)
  assert.ok(support.alternateAssessments.some((alternate) => (
    alternate.name === 'Tuck L-Sit Hold'
      && alternate.classification === 'new_variant'
  )))
  assert.ok(support.alternateAssessments.some((alternate) => (
    alternate.name === 'Hanging L-Sit'
      && alternate.classification === 'new_definition'
  )))
  assert.ok(hanging.alternateAssessments.some((alternate) => (
    alternate.name === 'Support L-Sit'
      && alternate.classification === 'new_definition'
  )))
  assert.ok(hanging.alternateAssessments.some((alternate) => (
    alternate.name === 'Hanging Leg Raise'
      && alternate.classification === 'new_definition'
  )))
})

test('support-compression batch separates exercise identities while leaving proficiency to skill cards', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  const batch = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'batches/support-compression-v-sit-manna-family.v1.json'),
    'utf8',
  ))
  const expected = new Map([
    ['straddle-compression-lift', {
      name: 'Seated Compression Lift',
      family: 'Grounded dynamic compression lift',
      scores: [40, 46, 46],
      variantKeys: ['bent-knee', 'single-leg-pike', 'pike', 'baseline'],
    }],
    ['v-sit', {
      name: 'V-Sit',
      family: 'High straight-arm support compression hold',
      scores: [72, 80, 80],
      variantKeys: ['baseline', 'straddle', 'ring-support'],
    }],
    ['manna-hold', {
      name: 'Manna Hold',
      family: 'Extreme straight-arm support compression hold',
      scores: [88, 94, 94],
      variantKeys: ['baseline'],
    }],
  ])

  assert.equal(batch.cards.length, 3)
  for (const cardSpec of batch.cards) {
    const card = expected.get(cardSpec.slug)
    const result = buildResearchPacketFromBatch({
      facilityId: batch.facilityId,
      researchVersion: batch.researchVersion,
      sharedEvidence: batch.sharedEvidence,
      sourceRegistry: registryDocument.sources,
      cardSpec,
      currentCard: {
        slug: cardSpec.slug,
        canonicalName: card.name,
        familyKey: card.family,
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
    assert.equal(result.packet.alternateAssessments.length, 8)
    assert.deepEqual(
      [
        result.packet.assessmentSummary.proposedDifficulty.technicalComplexity,
        result.packet.assessmentSummary.proposedDifficulty.absoluteLoadDemand,
        result.packet.assessmentSummary.proposedDifficulty.baseOverallDifficulty,
      ],
      card.scores,
    )
    assert.deepEqual(
      result.packet.assessmentSummary.variantDifficultyCandidates
        .map((variant) => variant.variantKey),
      card.variantKeys,
    )
    assert.ok(result.packet.assessmentSummary.variantDifficultyCandidates.every((variant) => (
      variant.derivedOverallDifficulty === Math.max(
        variant.exerciseComplexity,
        variant.physicalDifficulty,
      )
    )))
    assert.ok(result.packet.mediaCandidates.every((candidate) => (
      candidate.linkStatus === 'unverified'
        && candidate.embeddingAllowed === false
        && candidate.externalVerification === null
        && !Object.hasOwn(candidate, 'exactVariantMatch')
        && !Object.hasOwn(candidate, 'reviewerUserId')
        && !Object.hasOwn(candidate, 'reviewedAt')
    )))
  }

  const compression = batch.cards.find((card) => card.slug === 'straddle-compression-lift')
  const vSit = batch.cards.find((card) => card.slug === 'v-sit')
  const manna = batch.cards.find((card) => card.slug === 'manna-hold')
  assert.match(compression.assessmentSummary.identity, /grounded dynamic compression/i)
  assert.match(vSit.assessmentSummary.identity, /clearly above horizontal/i)
  assert.match(manna.assessmentSummary.identity, /hips rise toward or above the shoulder line/i)
  assert.ok(compression.alternateAssessments.some((alternate) => (
    alternate.name === 'L-Sit'
      && alternate.classification === 'new_definition'
  )))
  assert.ok(vSit.alternateAssessments.some((alternate) => (
    alternate.name === 'Manna Hold'
      && alternate.classification === 'new_definition'
  )))
  assert.ok(manna.alternateAssessments.some((alternate) => (
    alternate.name === 'Spotted Manna Hold'
      && alternate.classification === 'modifier_annotation'
  )))
})

test('depth and box ordered-sequence batch preserves order-specific identities and difficulty-only scoring', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  const batch = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'batches/depth-box-order-sequences.v1.json'),
    'utf8',
  ))
  const expected = new Map([
    ['depth-drop-to-box-jump', {
      name: 'Depth Drop to Box Jump',
      family: 'Box/depth ordered sequence',
      scores: [[64, 58, 64], [68, 58, 68]],
      media: 3,
      alternates: 11,
      duplicateName: 'Depth Jump to Box Jump',
      reversedName: 'Box Jump to Depth Drop',
    }],
    ['box-jump-to-depth-drop', {
      name: 'Box Jump to Depth Drop',
      family: 'Box/depth ordered sequence',
      scores: [[58, 54, 58], [62, 54, 62]],
      media: 4,
      alternates: 10,
      duplicateName: 'Box Jump with Altitude Landing',
      reversedName: 'Depth Drop to Box Jump',
    }],
  ])

  assert.ok(registryDocument.sources.nsca_basketball_depth_jump_to_box)
  assert.ok(registryDocument.sources.smitley_box_jump_depth_drop_sequences)
  assert.equal(batch.cards.length, 2)

  for (const cardSpec of batch.cards) {
    const card = expected.get(cardSpec.slug)
    const result = buildResearchPacketFromBatch({
      facilityId: batch.facilityId,
      researchVersion: batch.researchVersion,
      sharedEvidence: batch.sharedEvidence,
      sourceRegistry: registryDocument.sources,
      cardSpec,
      currentCard: {
        slug: cardSpec.slug,
        canonicalName: card.name,
        familyKey: card.family,
        snapshot: {
          capturedAt: batch.snapshotAt,
          cardVersion: 2,
          status: 'review',
        },
      },
      mediaCandidates: [],
    })

    assert.equal(result.validation.valid, true)
    assert.equal(result.packet.evidence.length, REQUIRED_RESEARCH_SECTIONS.length)
    assert.equal(result.packet.mediaCandidates.length, card.media)
    assert.equal(result.packet.alternateAssessments.length, card.alternates)
    assert.deepEqual(
      result.packet.assessmentSummary.variantDifficultyCandidates.map((variant) => [
        variant.exerciseComplexity,
        variant.physicalDifficulty,
        variant.derivedOverallDifficulty,
      ]),
      card.scores,
    )
    assert.ok(result.packet.assessmentSummary.variantDifficultyCandidates.every((variant) => (
      variant.derivedOverallDifficulty === Math.max(
        variant.exerciseComplexity,
        variant.physicalDifficulty,
      )
    )))
    assert.doesNotMatch(
      JSON.stringify(cardSpec),
      /"(?:skillLevel|skill_level|minimumSkillLevel|minimum_skill_level)"/,
    )
    assert.ok(cardSpec.alternateAssessments.some((alternate) => (
      alternate.name === card.duplicateName
        && alternate.classification === 'same_identity'
    )))
    assert.ok(cardSpec.alternateAssessments.some((alternate) => (
      alternate.name === card.reversedName
        && alternate.classification === 'new_definition'
    )))
    assert.ok(result.packet.mediaCandidates.every((candidate) => (
      candidate.linkStatus === 'unverified'
        && candidate.embeddingAllowed === false
        && candidate.externalVerification === null
        && !Object.hasOwn(candidate, 'exactVariantMatch')
        && !Object.hasOwn(candidate, 'reviewerUserId')
        && !Object.hasOwn(candidate, 'reviewedAt')
    )))
  }
})

test('kneeling chest-pass batch quarantines ambiguous sources and scores exact stance/catch variants', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  const batch = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'batches/kneeling-medicine-ball-chest-pass-family.v1.json'),
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
      canonicalName: 'Kneeling Medicine Ball Chest Pass',
      familyKey: 'Kneeling medicine-ball horizontal chest pass',
      snapshot: {
        capturedAt: batch.snapshotAt,
        cardVersion: 2,
        status: 'review',
      },
    },
    mediaCandidates: [],
  })

  assert.ok(registryDocument.sources.nsca_tall_kneeling_medicine_ball_chest_throw)
  assert.ok(registryDocument.sources.ace_kneeling_power_ball_pass)
  assert.equal(result.validation.valid, true)
  assert.equal(result.packet.evidence.length, REQUIRED_RESEARCH_SECTIONS.length)
  assert.equal(result.packet.mediaCandidates.length, 5)
  assert.equal(result.packet.alternateAssessments.length, 12)
  assert.deepEqual(
    result.packet.assessmentSummary.variantDifficultyCandidates.map((variant) => [
      variant.variantKey,
      variant.exerciseComplexity,
      variant.physicalDifficulty,
      variant.derivedOverallDifficulty,
    ]),
    [
      ['tall-kneeling-throw-only', 34, 38, 38],
      ['tall-kneeling-rebound-catch', 42, 42, 42],
      ['half-kneeling-throw-only', 42, 38, 42],
      ['half-kneeling-rebound-catch', 48, 42, 48],
    ],
  )
  assert.ok(result.packet.assessmentSummary.variantDifficultyCandidates.every((variant) => (
    variant.derivedOverallDifficulty === Math.max(
      variant.exerciseComplexity,
      variant.physicalDifficulty,
    )
  )))
  assert.doesNotMatch(
    JSON.stringify(cardSpec),
    /"(?:skillLevel|skill_level|minimumSkillLevel|minimum_skill_level)"/,
  )
  assert.ok(cardSpec.assessmentSummary.currentCardFindings.some((finding) => (
    /must remain archived, nonselectable provenance/i.test(finding)
  )))
  for (const duplicateName of [
    'Tall-Kneeling Medicine Ball Chest Pass',
    'Tall-Kneeling Chest Pass to Wall',
    'Half-Kneeling Chest Pass to Wall',
  ]) {
    assert.ok(cardSpec.alternateAssessments.some((alternate) => (
      alternate.name === duplicateName
        && alternate.classification === 'same_identity'
    )))
  }
  assert.ok(cardSpec.alternateAssessments.some((alternate) => (
    alternate.name === 'Half-Kneeling Medicine Ball Chest Pass'
      && alternate.classification === 'new_variant'
  )))
  assert.ok(cardSpec.alternateAssessments.some((alternate) => (
    alternate.name === 'Standing Medicine Ball Chest Pass'
      && alternate.classification === 'new_definition'
  )))
  assert.ok(result.packet.mediaCandidates.every((candidate) => (
    candidate.linkStatus === 'unverified'
      && candidate.embeddingAllowed === false
      && candidate.externalVerification === null
      && !Object.hasOwn(candidate, 'exactVariantMatch')
      && !Object.hasOwn(candidate, 'reviewerUserId')
      && !Object.hasOwn(candidate, 'reviewedAt')
  )))
})

test('rotational wall-throw batch consolidates target aliases and scores exact return variants', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  const batch = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'batches/medicine-ball-rotational-wall-throw-family.v1.json'),
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
      canonicalName: 'Medicine Ball Rotational Throw',
      familyKey: 'Standing medicine-ball rotational wall projection',
      snapshot: {
        capturedAt: batch.snapshotAt,
        cardVersion: 2,
        status: 'review',
      },
    },
    mediaCandidates: [],
  })

  assert.ok(registryDocument.sources.nsca_standing_rotational_wall_toss)
  assert.ok(registryDocument.sources.ace_lateral_wall_ball)
  assert.ok(registryDocument.sources.trunk_rotator_strength_rotational_throw)
  assert.equal(result.validation.valid, true)
  assert.equal(result.packet.evidence.length, REQUIRED_RESEARCH_SECTIONS.length)
  assert.equal(result.packet.mediaCandidates.length, 5)
  assert.equal(result.packet.alternateAssessments.length, 12)
  assert.deepEqual(
    result.packet.assessmentSummary.variantDifficultyCandidates.map((variant) => [
      variant.variantKey,
      variant.exerciseComplexity,
      variant.physicalDifficulty,
      variant.derivedOverallDifficulty,
    ]),
    [
      ['athletic-stance-wall-throw-only', 42, 46, 46],
      ['athletic-stance-wall-rebound-catch', 50, 48, 50],
    ],
  )
  assert.ok(result.packet.assessmentSummary.variantDifficultyCandidates.every((variant) => (
    variant.derivedOverallDifficulty === Math.max(
      variant.exerciseComplexity,
      variant.physicalDifficulty,
    )
  )))
  assert.doesNotMatch(
    JSON.stringify(cardSpec),
    /"(?:skillLevel|skill_level|minimumSkillLevel|minimum_skill_level)"/,
  )
  assert.ok(cardSpec.assessmentSummary.currentCardFindings.some((finding) => (
    /must remain archived, nonselectable provenance/i.test(finding)
  )))
  assert.ok(cardSpec.alternateAssessments.some((alternate) => (
    alternate.name === 'Medicine Ball Rotational Wall Throw'
      && alternate.classification === 'same_identity'
  )))
  assert.ok(cardSpec.alternateAssessments.some((alternate) => (
    alternate.name === 'Rotational Wall Throw — Rebound and Catch'
      && alternate.classification === 'new_variant'
  )))
  assert.ok(cardSpec.alternateAssessments.some((alternate) => (
    alternate.name === 'Medicine Ball Rotational Slam'
      && alternate.classification === 'new_definition'
  )))
  assert.ok(result.packet.mediaCandidates.every((candidate) => (
    candidate.linkStatus === 'unverified'
      && candidate.embeddingAllowed === false
      && candidate.externalVerification === null
      && !Object.hasOwn(candidate, 'exactVariantMatch')
      && !Object.hasOwn(candidate, 'reviewerUserId')
      && !Object.hasOwn(candidate, 'reviewedAt')
  )))
})

test('shuffle rotational-throw batch consolidates aliases and scores only complexity and physical demand', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  const batch = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'batches/shuffle-rotational-medicine-ball-throw-family.v1.json'),
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
      canonicalName: 'Shuffle-to-Rotational Medicine Ball Throw',
      familyKey: 'Lateral shuffle to rotational medicine-ball wall projection',
      snapshot: {
        capturedAt: batch.snapshotAt,
        cardVersion: 2,
        status: 'review',
      },
    },
    mediaCandidates: [],
  })

  assert.ok(registryDocument.sources.muscle_strength_shuffle_rotational_throw)
  assert.ok(registryDocument.sources.nsca_alactic_explosive_medicine_ball)
  assert.equal(result.validation.valid, true)
  assert.equal(result.packet.evidence.length, REQUIRED_RESEARCH_SECTIONS.length)
  assert.equal(result.packet.mediaCandidates.length, 5)
  assert.equal(result.packet.alternateAssessments.length, 12)
  assert.deepEqual(
    result.packet.assessmentSummary.variantDifficultyCandidates.map((variant) => [
      variant.variantKey,
      variant.exerciseComplexity,
      variant.physicalDifficulty,
      variant.derivedOverallDifficulty,
    ]),
    [
      ['lateral-shuffle-wall-throw-only', 56, 52, 56],
      ['lateral-shuffle-wall-rebound-catch', 64, 54, 64],
    ],
  )
  assert.ok(result.packet.assessmentSummary.variantDifficultyCandidates.every((variant) => (
    variant.derivedOverallDifficulty === Math.max(
      variant.exerciseComplexity,
      variant.physicalDifficulty,
    )
  )))
  assert.doesNotMatch(
    JSON.stringify(cardSpec),
    /"(?:skillLevel|skill_level|minimumSkillLevel|minimum_skill_level)"/,
  )
  assert.ok(cardSpec.alternateAssessments.some((alternate) => (
    alternate.name === 'Med Ball Shuffle-to-Rotation Throw'
      && alternate.classification === 'same_identity'
  )))
  assert.ok(cardSpec.alternateAssessments.some((alternate) => (
    alternate.name === 'Reactive Shuffle-to-Rotational Throw'
      && alternate.classification === 'modifier_annotation'
  )))
  assert.ok(cardSpec.alternateAssessments.some((alternate) => (
    alternate.name === 'Lateral Bound to Rotational Throw'
      && alternate.classification === 'new_definition'
  )))
  assert.ok(result.packet.mediaCandidates.every((candidate) => (
    candidate.linkStatus === 'unverified'
      && candidate.embeddingAllowed === false
      && candidate.externalVerification === null
      && !Object.hasOwn(candidate, 'exactVariantMatch')
      && !Object.hasOwn(candidate, 'reviewerUserId')
      && !Object.hasOwn(candidate, 'reviewedAt')
  )))
})

test('box-jump single-leg-landing batch consolidates identity and scores exact takeoff variants', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  const batch = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'batches/box-jump-single-leg-landing-family.v1.json'),
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
      canonicalName: 'Box Jump to Single-Leg Landing',
      familyKey: 'Standing vertical box jump to single-leg box landing',
      snapshot: {
        capturedAt: batch.snapshotAt,
        cardVersion: 2,
        status: 'review',
      },
    },
    mediaCandidates: [],
  })

  assert.ok(registryDocument.sources.nsca_box_jump_unilateral_landing_progression)
  assert.ok(registryDocument.sources.unilateral_bilateral_landing_biomechanics)
  assert.ok(registryDocument.sources.unilateral_bilateral_plyometric_meta_analysis)
  assert.equal(result.validation.valid, true)
  assert.equal(result.packet.evidence.length, REQUIRED_RESEARCH_SECTIONS.length)
  assert.equal(result.packet.mediaCandidates.length, 5)
  assert.equal(result.packet.alternateAssessments.length, 12)
  assert.deepEqual(
    result.packet.assessmentSummary.variantDifficultyCandidates.map((variant) => [
      variant.variantKey,
      variant.exerciseComplexity,
      variant.physicalDifficulty,
      variant.derivedOverallDifficulty,
    ]),
    [
      ['bilateral-takeoff-single-leg-landing', 62, 60, 62],
      ['same-leg-unilateral-takeoff-and-landing', 74, 72, 74],
    ],
  )
  assert.ok(result.packet.assessmentSummary.variantDifficultyCandidates.every((variant) => (
    variant.derivedOverallDifficulty === Math.max(
      variant.exerciseComplexity,
      variant.physicalDifficulty,
    )
  )))
  assert.doesNotMatch(
    JSON.stringify(cardSpec),
    /"(?:skillLevel|skill_level|minimumSkillLevel|minimum_skill_level)"/,
  )
  assert.ok(cardSpec.alternateAssessments.some((alternate) => (
    alternate.name === 'Single-Leg Box Jump to Single-Leg Landing'
      && alternate.classification === 'same_identity'
  )))
  assert.ok(cardSpec.alternateAssessments.some((alternate) => (
    alternate.name === 'Same-Leg Single-Leg Box Jump and Landing'
      && alternate.classification === 'new_variant'
  )))
  assert.ok(cardSpec.alternateAssessments.some((alternate) => (
    alternate.name === 'Continuous Rebound Single-Leg Box Jump'
      && alternate.classification === 'new_definition'
  )))
  assert.ok(result.packet.mediaCandidates.every((candidate) => (
    candidate.linkStatus === 'unverified'
      && candidate.embeddingAllowed === false
      && candidate.externalVerification === null
      && !Object.hasOwn(candidate, 'exactVariantMatch')
      && !Object.hasOwn(candidate, 'reviewerUserId')
      && !Object.hasOwn(candidate, 'reviewedAt')
  )))
})

test('single-leg lateral hop-stick batch treats the line as a target and scores amplitude variants', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  const batch = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'batches/single-leg-lateral-hop-stick-family.v1.json'),
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
      canonicalName: 'Single-Leg Lateral Hop to Stick',
      familyKey: 'Ipsilateral single-leg lateral hop to terminal stick',
      snapshot: {
        capturedAt: batch.snapshotAt,
        cardVersion: 2,
        status: 'review',
      },
    },
    mediaCandidates: [],
  })

  assert.ok(registryDocument.sources.nsca_lateral_line_hop_variations)
  assert.ok(registryDocument.sources.emory_single_leg_lateral_line_jump_hold)
  assert.ok(registryDocument.sources.lateral_single_leg_hop_balance_study)
  assert.equal(result.validation.valid, true)
  assert.equal(result.packet.evidence.length, REQUIRED_RESEARCH_SECTIONS.length)
  assert.equal(result.packet.mediaCandidates.length, 5)
  assert.equal(result.packet.alternateAssessments.length, 12)
  assert.deepEqual(
    result.packet.assessmentSummary.variantDifficultyCandidates.map((variant) => [
      variant.variantKey,
      variant.exerciseComplexity,
      variant.physicalDifficulty,
      variant.derivedOverallDifficulty,
    ]),
    [
      ['low-amplitude-control', 42, 36, 42],
      ['distance-output', 50, 48, 50],
    ],
  )
  assert.ok(result.packet.assessmentSummary.variantDifficultyCandidates.every((variant) => (
    variant.derivedOverallDifficulty === Math.max(
      variant.exerciseComplexity,
      variant.physicalDifficulty,
    )
  )))
  assert.doesNotMatch(
    JSON.stringify(cardSpec),
    /"(?:skillLevel|skill_level|minimumSkillLevel|minimum_skill_level)"/,
  )
  assert.ok(cardSpec.alternateAssessments.some((alternate) => (
    alternate.name === 'Lateral Line Hop to Single-Leg Stick'
      && alternate.classification === 'same_identity'
  )))
  assert.ok(cardSpec.alternateAssessments.some((alternate) => (
    alternate.name === 'Continuous Single-Leg Lateral Line Hops'
      && alternate.classification === 'new_definition'
  )))
  assert.ok(cardSpec.alternateAssessments.some((alternate) => (
    alternate.name === 'Skater Bound to Stick'
      && alternate.classification === 'new_definition'
  )))
  assert.ok(result.packet.mediaCandidates.every((candidate) => (
    candidate.linkStatus === 'unverified'
      && candidate.embeddingAllowed === false
      && candidate.externalVerification === null
      && !Object.hasOwn(candidate, 'exactVariantMatch')
      && !Object.hasOwn(candidate, 'reviewerUserId')
      && !Object.hasOwn(candidate, 'reviewedAt')
  )))
})

test('dead-bug pullover batch consolidates implement labels and scores exact resistance and leg-action variants', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  const batch = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'batches/dead-bug-pullover-family.v1.json'),
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
      canonicalName: 'Dead Bug Pullover',
      familyKey: 'Loaded supine anti-extension pullover',
      snapshot: {
        capturedAt: batch.snapshotAt,
        cardVersion: 2,
        status: 'review',
      },
    },
    mediaCandidates: [],
  })

  assert.ok(registryDocument.sources.nasm_dead_bug_instruction)
  assert.ok(registryDocument.sources.dying_bug_trunk_emg_progression)
  assert.ok(registryDocument.sources.dead_bug_limb_and_speed_emg)
  assert.equal(result.validation.valid, true)
  assert.equal(result.packet.evidence.length, REQUIRED_RESEARCH_SECTIONS.length)
  assert.equal(result.packet.mediaCandidates.length, 5)
  assert.equal(result.packet.alternateAssessments.length, 12)
  assert.deepEqual(
    result.packet.assessmentSummary.variantDifficultyCandidates.map((variant) => [
      variant.variantKey,
      variant.exerciseComplexity,
      variant.physicalDifficulty,
      variant.derivedOverallDifficulty,
    ]),
    [
      ['dumbbell-tabletop-hold', 34, 30, 34],
      ['medicine-ball-tabletop-hold', 32, 28, 32],
      ['band-tabletop-hold', 36, 30, 36],
      ['dumbbell-contralateral-leg-extension', 46, 40, 46],
      ['band-contralateral-leg-extension', 48, 40, 48],
    ],
  )
  assert.ok(result.packet.assessmentSummary.variantDifficultyCandidates.every((variant) => (
    variant.derivedOverallDifficulty === Math.max(
      variant.exerciseComplexity,
      variant.physicalDifficulty,
    )
  )))
  assert.doesNotMatch(
    JSON.stringify(cardSpec),
    /"(?:skillLevel|skill_level|minimumSkillLevel|minimum_skill_level)"/,
  )
  assert.ok(cardSpec.alternateAssessments.some((alternate) => (
    alternate.name === 'Dumbbell Dead Bug Pullover'
      && alternate.classification === 'same_identity'
  )))
  assert.ok(cardSpec.alternateAssessments.some((alternate) => (
    alternate.name === 'Dead Bug Pullover with Exhale'
      && alternate.classification === 'modifier_annotation'
  )))
  assert.ok(cardSpec.alternateAssessments.some((alternate) => (
    alternate.name === 'Dead Bug Band Pulldown with Rotation Resist'
      && alternate.classification === 'new_definition'
  )))
  assert.ok(result.packet.mediaCandidates.every((candidate) => (
    candidate.linkStatus === 'unverified'
      && candidate.embeddingAllowed === false
      && candidate.externalVerification === null
      && !Object.hasOwn(candidate, 'exactVariantMatch')
      && !Object.hasOwn(candidate, 'reviewerUserId')
      && !Object.hasOwn(candidate, 'reviewedAt')
  )))
})

test('Romanian-deadlift batch consolidates implement cards and keeps stance or added actions separate', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  const batch = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'batches/romanian-deadlift-family.v1.json'),
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
      canonicalName: 'Romanian Deadlift',
      familyKey: 'Loaded bilateral Romanian deadlift',
      snapshot: {
        capturedAt: batch.snapshotAt,
        cardVersion: 2,
        status: 'review',
      },
    },
    mediaCandidates: [],
  })

  assert.ok(registryDocument.sources.nsca_romanian_deadlift_technique)
  assert.ok(registryDocument.sources.romanian_deadlift_joint_kinetics_emg)
  assert.ok(registryDocument.sources.eccentric_romanian_deadlift_hamstring_adaptation)
  assert.equal(result.validation.valid, true)
  assert.equal(result.packet.evidence.length, REQUIRED_RESEARCH_SECTIONS.length)
  assert.equal(result.packet.mediaCandidates.length, 5)
  assert.equal(result.packet.alternateAssessments.length, 12)
  assert.deepEqual(
    result.packet.assessmentSummary.variantDifficultyCandidates.map((variant) => [
      variant.variantKey,
      variant.exerciseComplexity,
      variant.physicalDifficulty,
      variant.derivedOverallDifficulty,
    ]),
    [
      ['barbell-standard-tempo', 42, 58, 58],
      ['dumbbell-standard-tempo', 38, 48, 48],
      ['single-kettlebell-standard-tempo', 36, 42, 42],
      ['double-kettlebell-standard-tempo', 40, 52, 52],
      ['sandbag-front-hold-standard-tempo', 40, 50, 50],
      ['landmine-two-hand-standard-tempo', 42, 54, 54],
      ['barbell-slow-eccentric', 48, 60, 60],
      ['dumbbell-slow-eccentric', 44, 52, 52],
    ],
  )
  assert.ok(result.packet.assessmentSummary.variantDifficultyCandidates.every((variant) => (
    variant.derivedOverallDifficulty === Math.max(
      variant.exerciseComplexity,
      variant.physicalDifficulty,
    )
  )))
  assert.doesNotMatch(
    JSON.stringify(cardSpec),
    /"(?:skillLevel|skill_level|minimumSkillLevel|minimum_skill_level)"/,
  )
  assert.ok(cardSpec.alternateAssessments.some((alternate) => (
    alternate.name === 'Dumbbell Romanian Deadlift'
      && alternate.classification === 'same_identity'
  )))
  assert.ok(cardSpec.alternateAssessments.some((alternate) => (
    alternate.name === 'Romanian Deadlift Eccentric'
      && alternate.classification === 'new_variant'
  )))
  assert.ok(cardSpec.alternateAssessments.some((alternate) => (
    alternate.name === 'Romanian Deadlift to Row'
      && alternate.classification === 'new_definition'
  )))
  assert.ok(result.packet.mediaCandidates.every((candidate) => (
    candidate.linkStatus === 'unverified'
      && candidate.embeddingAllowed === false
      && candidate.externalVerification === null
      && !Object.hasOwn(candidate, 'exactVariantMatch')
      && !Object.hasOwn(candidate, 'reviewerUserId')
      && !Object.hasOwn(candidate, 'reviewedAt')
  )))
})

test('front-foot-elevated split-squat batch consolidates implements and preserves support boundaries', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  const batch = JSON.parse(readFileSync(
    path.join(
      RESEARCH_ROOT,
      'batches/front-foot-elevated-split-squat-family.v1.json',
    ),
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
      canonicalName: 'Front-Foot-Elevated Split Squat',
      familyKey: 'Front-foot-elevated stationary split squat',
      snapshot: {
        capturedAt: batch.snapshotAt,
        cardVersion: 2,
        status: 'review',
      },
    },
    mediaCandidates: [],
  })

  assert.ok(registryDocument.sources.front_foot_elevated_split_squat_clinical_framework)
  assert.ok(registryDocument.sources.split_squat_joint_angles_loading)
  assert.ok(registryDocument.sources.split_squat_step_length_biomechanics)
  assert.equal(result.validation.valid, true)
  assert.equal(result.packet.evidence.length, REQUIRED_RESEARCH_SECTIONS.length)
  assert.equal(result.packet.mediaCandidates.length, 5)
  assert.equal(result.packet.alternateAssessments.length, 12)
  assert.deepEqual(
    result.packet.assessmentSummary.variantDifficultyCandidates.map((variant) => [
      variant.variantKey,
      variant.exerciseComplexity,
      variant.physicalDifficulty,
      variant.derivedOverallDifficulty,
    ]),
    [
      ['bodyweight-standard-tempo', 38, 32, 38],
      ['supported-bodyweight-standard-tempo', 32, 28, 32],
      ['two-dumbbell-suitcase-standard-tempo', 42, 50, 50],
      ['single-dumbbell-contralateral-standard-tempo', 46, 44, 46],
      ['single-dumbbell-ipsilateral-standard-tempo', 44, 44, 44],
      ['sandbag-front-hold-standard-tempo', 42, 48, 48],
    ],
  )
  assert.ok(result.packet.assessmentSummary.variantDifficultyCandidates.every((variant) => (
    variant.derivedOverallDifficulty === Math.max(
      variant.exerciseComplexity,
      variant.physicalDifficulty,
    )
  )))
  assert.doesNotMatch(
    JSON.stringify(cardSpec),
    /"(?:skillLevel|skill_level|minimumSkillLevel|minimum_skill_level)"/,
  )
  assert.ok(cardSpec.alternateAssessments.some((alternate) => (
    alternate.name === 'Front-Foot-Elevated Dumbbell Split Squat'
      && alternate.classification === 'same_identity'
  )))
  assert.ok(cardSpec.alternateAssessments.some((alternate) => (
    alternate.name === 'Supported Front-Foot-Elevated Split Squat'
      && alternate.classification === 'new_variant'
  )))
  assert.ok(cardSpec.alternateAssessments.some((alternate) => (
    alternate.name === 'Rear-Foot-Elevated Split Squat'
      && alternate.classification === 'new_definition'
  )))
  assert.ok(result.packet.mediaCandidates.every((candidate) => (
    candidate.linkStatus === 'healthy'
      && candidate.embeddingAllowed === true
      && candidate.externalVerification?.method === 'youtube_oembed'
      && !Object.hasOwn(candidate, 'exactVariantMatch')
      && !Object.hasOwn(candidate, 'reviewerUserId')
      && !Object.hasOwn(candidate, 'reviewedAt')
  )))
})

test('half-kneeling single-arm press batch consolidates implements while preserving press-path boundaries', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  const batch = JSON.parse(readFileSync(
    path.join(
      RESEARCH_ROOT,
      'batches/half-kneeling-single-arm-press-family.v1.json',
    ),
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
      canonicalName: 'Half-Kneeling Single-Arm Press',
      familyKey: 'Half-kneeling single-arm vertical press',
      snapshot: {
        capturedAt: batch.snapshotAt,
        cardVersion: 2,
        status: 'review',
      },
    },
    mediaCandidates: [],
  })

  assert.ok(registryDocument.sources.nsca_foundations_single_arm_half_kneeling_press)
  assert.ok(registryDocument.sources.unilateral_dumbbell_press_core_emg)
  assert.ok(registryDocument.sources.dumbbell_kettlebell_overhead_press_emg)
  assert.equal(result.validation.valid, true)
  assert.equal(result.packet.evidence.length, REQUIRED_RESEARCH_SECTIONS.length)
  assert.equal(result.packet.mediaCandidates.length, 5)
  assert.equal(result.packet.alternateAssessments.length, 12)
  assert.deepEqual(
    result.packet.assessmentSummary.variantDifficultyCandidates.map((variant) => [
      variant.variantKey,
      variant.exerciseComplexity,
      variant.physicalDifficulty,
      variant.derivedOverallDifficulty,
    ]),
    [
      ['dumbbell-ipsilateral-to-down-knee-standard', 44, 44, 44],
      ['dumbbell-contralateral-to-down-knee-standard', 46, 44, 46],
      ['kettlebell-ipsilateral-to-down-knee-standard', 46, 46, 46],
      ['kettlebell-contralateral-to-down-knee-standard', 48, 46, 48],
      ['band-low-anchor-ipsilateral-to-down-knee-standard', 44, 38, 44],
      ['band-low-anchor-contralateral-to-down-knee-standard', 46, 38, 46],
    ],
  )
  assert.ok(result.packet.assessmentSummary.variantDifficultyCandidates.every((variant) => (
    variant.derivedOverallDifficulty === Math.max(
      variant.exerciseComplexity,
      variant.physicalDifficulty,
    )
  )))
  assert.doesNotMatch(
    JSON.stringify(cardSpec),
    /"(?:skillLevel|skill_level|minimumSkillLevel|minimum_skill_level)"/,
  )
  assert.ok(cardSpec.alternateAssessments.some((alternate) => (
    alternate.name === 'Half-Kneeling Kettlebell Press'
      && alternate.classification === 'same_identity'
  )))
  assert.ok(cardSpec.alternateAssessments.some((alternate) => (
    alternate.name === 'Bottom-Up Kettlebell Half-Kneeling Press'
      && alternate.classification === 'new_variant'
  )))
  assert.ok(cardSpec.alternateAssessments.some((alternate) => (
    alternate.name === 'Half-Kneeling One-Arm Landmine Press'
      && alternate.classification === 'new_definition'
  )))
  assert.ok(result.packet.mediaCandidates.every((candidate) => (
    candidate.linkStatus === 'healthy'
      && candidate.embeddingAllowed === true
      && candidate.externalVerification?.method === 'youtube_oembed'
      && !Object.hasOwn(candidate, 'exactVariantMatch')
      && !Object.hasOwn(candidate, 'reviewerUserId')
      && !Object.hasOwn(candidate, 'reviewedAt')
  )))
})

test('overhead medicine-ball projection batch preserves forward and backward identities without skill levels', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  const batch = JSON.parse(readFileSync(
    path.join(
      RESEARCH_ROOT,
      'batches/overhead-medicine-ball-projection-family.v1.json',
    ),
    'utf8',
  ))

  assert.ok(registryDocument.sources.ace_forward_overhead_medicine_ball_throw)
  assert.ok(registryDocument.sources.functional_performance_backward_overhead_throw)
  assert.ok(registryDocument.sources.forward_backward_medicine_ball_protocols)
  assert.ok(registryDocument.sources.overhead_medicine_ball_load_velocity)
  assert.equal(batch.cards.length, 2)

  const expectedVariants = new Map([
    ['medicine-ball-overhead-throw', [
      ['stationary-forward-distance', 48, 42, 48],
      ['step-through-forward-wall-throw-only', 54, 44, 54],
    ]],
    ['medicine-ball-overhead-back-throw', [
      ['countermovement-backward-distance', 50, 54, 54],
      ['no-countermovement-backward-distance', 48, 50, 50],
    ]],
  ])

  for (const cardSpec of batch.cards) {
    const result = buildResearchPacketFromBatch({
      facilityId: batch.facilityId,
      researchVersion: batch.researchVersion,
      sharedEvidence: batch.sharedEvidence,
      sourceRegistry: registryDocument.sources,
      cardSpec,
      currentCard: {
        slug: cardSpec.slug,
        canonicalName: cardSpec.slug === 'medicine-ball-overhead-throw'
          ? 'Medicine Ball Overhead Throw'
          : 'Medicine Ball Overhead Back Throw',
        familyKey: 'overhead_medicine_ball_projection',
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
    assert.equal(result.packet.alternateAssessments.length, 6)
    assert.deepEqual(
      cardSpec.assessmentSummary.proposedVariantPlan.map((variant) => [
        variant.variantKey,
        variant.exerciseComplexity,
        variant.physicalDifficulty,
        variant.overallDifficulty,
      ]),
      expectedVariants.get(cardSpec.slug),
    )
    assert.ok(cardSpec.assessmentSummary.proposedVariantPlan.every((variant) => (
      variant.overallDifficulty === Math.max(
        variant.exerciseComplexity,
        variant.physicalDifficulty,
      )
    )))
    assert.equal(cardSpec.assessmentSummary.identityDecision.decision, 'distinct_exercises')
    assert.doesNotMatch(
      JSON.stringify(cardSpec),
      /"(?:skillLevel|skill_level|minimumSkillLevel|minimum_skill_level)"/,
    )
    assert.ok(result.packet.mediaCandidates.every((candidate) => (
      candidate.linkStatus === 'healthy'
        && candidate.embeddingAllowed === true
        && candidate.externalVerification?.method === 'youtube_oembed'
        && !Object.hasOwn(candidate, 'exactVariantMatch')
        && !Object.hasOwn(candidate, 'reviewerUserId')
        && !Object.hasOwn(candidate, 'reviewedAt')
    )))
  }
})

test('remaining identity-boundary batches are complete, difficulty-only, and candidate media stays human-gated', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  const batchFiles = [
    'dead-bug-press-boundary.v1.json',
    'bilateral-lateral-jump-stick-boundary.v1.json',
    'countermovement-medicine-ball-projection-boundary.v1.json',
  ]
  const expectedSlugs = new Set([
    'dead-bug-wall-press',
    'medicine-ball-dead-bug-press',
    'lateral-hop-to-stick',
    'medicine-ball-chest-pass',
    'med-ball-countermovement-rotational-throw',
  ])
  const seenSlugs = new Set()

  for (const batchFile of batchFiles) {
    const batch = JSON.parse(readFileSync(
      path.join(RESEARCH_ROOT, 'batches', batchFile),
      'utf8',
    ))
    assert.equal(batch.researchVersion, '2026-07-26.42')

    for (const cardSpec of batch.cards) {
      seenSlugs.add(cardSpec.slug)
      const result = buildResearchPacketFromBatch({
        facilityId: batch.facilityId,
        researchVersion: batch.researchVersion,
        sharedEvidence: batch.sharedEvidence,
        sourceRegistry: registryDocument.sources,
        cardSpec,
        currentCard: {
          slug: cardSpec.slug,
          canonicalName: cardSpec.slug,
          familyKey: 'researched_identity_boundary',
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
      assert.equal(result.packet.alternateAssessments.length, 6)
      assert.ok(cardSpec.assessmentSummary.proposedVariantPlan.every((variant) => (
        variant.overallDifficulty === Math.max(
          variant.exerciseComplexity,
          variant.physicalDifficulty,
        )
      )))
      assert.doesNotMatch(
        JSON.stringify(cardSpec),
        /"(?:exerciseSkillLevel|skillLevel|skill_level|minimumSkillLevel|minimum_skill_level)"/,
      )
      assert.ok(result.packet.mediaCandidates.every((candidate) => (
        candidate.linkStatus === 'healthy'
          && candidate.embeddingAllowed === true
          && candidate.externalVerification?.method === 'youtube_oembed'
          && !Object.hasOwn(candidate, 'reviewStatus')
          && !Object.hasOwn(candidate, 'exactVariantMatch')
          && !Object.hasOwn(candidate, 'reviewerUserId')
          && !Object.hasOwn(candidate, 'reviewedAt')
      )))
    }
  }

  assert.deepEqual(seenSlugs, expectedSlugs)
})

test('Pallof press and step-out batch consolidates modifiers, preserves action boundaries, and keeps media human-gated', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  const batch = JSON.parse(readFileSync(
    path.join(
      RESEARCH_ROOT,
      'batches/pallof-press-step-out-family.v1.json',
    ),
    'utf8',
  ))

  for (const sourceKey of [
    'nasm_progressive_core_training',
    'nsca_foundations_fitness_programming',
    'pallof_band_test_reliability',
    'pallof_body_position_postural_control',
    'axial_torque_trunk_emg',
  ]) {
    assert.ok(registryDocument.sources[sourceKey])
  }
  assert.equal(batch.researchVersion, '2026-07-26.43')
  assert.equal(batch.cards.length, 2)

  const expectedVariants = new Map([
    ['pallof-press-pallof-hold', [
      ['standing-band-repetition', 28, 24, 28],
      ['standing-cable-repetition', 30, 28, 30],
      ['standing-cable-isometric-hold', 32, 30, 32],
      ['half-kneeling-band-repetition', 34, 26, 34],
      ['tall-kneeling-band-isometric-hold', 36, 28, 36],
      ['split-stance-cable-isometric-hold', 38, 32, 38],
      ['standing-cable-four-second-return', 34, 30, 34],
      ['partner-anchored-band-isometric-hold', 36, 26, 36],
    ]],
    ['pallof-press-step-out', [
      ['band-hands-at-chest-step-out', 36, 28, 36],
      ['band-arms-extended-step-out', 42, 32, 42],
      ['cable-hands-at-chest-step-out', 38, 32, 38],
      ['cable-arms-extended-step-out', 44, 36, 44],
    ]],
  ])

  for (const cardSpec of batch.cards) {
    const result = buildResearchPacketFromBatch({
      facilityId: batch.facilityId,
      researchVersion: batch.researchVersion,
      sharedEvidence: batch.sharedEvidence,
      sourceRegistry: registryDocument.sources,
      cardSpec,
      currentCard: {
        slug: cardSpec.slug,
        canonicalName: cardSpec.slug === 'pallof-press-pallof-hold'
          ? 'Pallof Press'
          : 'Pallof Step-Out',
        familyKey: 'side_anchored_anti_rotation',
        snapshot: {
          capturedAt: batch.snapshotAt,
          cardVersion: 2,
          status: 'review',
        },
      },
      mediaCandidates: [],
    })

    assert.equal(result.validation.valid, true)
    assert.equal(result.packet.evidence.length, REQUIRED_RESEARCH_SECTIONS.length)
    assert.equal(result.packet.mediaCandidates.length, 5)
    assert.equal(result.packet.alternateAssessments.length, 10)
    assert.deepEqual(
      cardSpec.assessmentSummary.proposedVariantPlan.map((variant) => [
        variant.variantKey,
        variant.exerciseComplexity,
        variant.physicalDifficulty,
        variant.overallDifficulty,
      ]),
      expectedVariants.get(cardSpec.slug),
    )
    assert.ok(cardSpec.assessmentSummary.proposedVariantPlan.every((variant) => (
      variant.overallDifficulty === Math.max(
        variant.exerciseComplexity,
        variant.physicalDifficulty,
      )
    )))
    assert.equal(
      cardSpec.assessmentSummary.identityDecision.decision,
      'distinct_exercises',
    )
    assert.doesNotMatch(
      JSON.stringify(cardSpec),
      /"(?:exerciseSkillLevel|skillLevel|skill_level|minimumSkillLevel|minimum_skill_level|proficiencyLevel|proficiency_level)"/,
    )
    assert.ok(result.packet.mediaCandidates.every((candidate) => (
      candidate.linkStatus === 'healthy'
        && candidate.embeddingAllowed === true
        && candidate.externalVerification?.method === 'youtube_oembed'
        && !Object.hasOwn(candidate, 'reviewStatus')
        && !Object.hasOwn(candidate, 'exactVariantMatch')
        && !Object.hasOwn(candidate, 'reviewerUserId')
        && !Object.hasOwn(candidate, 'reviewedAt')
    )))
  }

  const press = batch.cards.find((card) => (
    card.slug === 'pallof-press-pallof-hold'
  ))
  const stepOut = batch.cards.find((card) => (
    card.slug === 'pallof-press-step-out'
  ))
  assert.ok(press.alternateAssessments.some((alternate) => (
    alternate.name === 'Pallof Press with March'
      && alternate.classification === 'new_definition'
  )))
  assert.ok(press.alternateAssessments.some((alternate) => (
    alternate.name === 'Half-Kneeling Pallof Press'
      && alternate.classification === 'new_variant'
  )))
  assert.ok(stepOut.alternateAssessments.some((alternate) => (
    alternate.name === 'Mini-Band Lateral Walk'
      && alternate.classification === 'new_definition'
  )))
  assert.ok(stepOut.alternateAssessments.some((alternate) => (
    alternate.name === 'Arms-Extended Pallof Walkout'
      && alternate.classification === 'new_variant'
  )))
})

test('Stir-the-Pot batch consolidates the redundant plank label and scores exact support and circle variants', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  const batch = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'batches/stir-the-pot-family.v1.json'),
    'utf8',
  ))
  const [cardSpec] = batch.cards

  for (const sourceKey of [
    'ace_stir_the_pot',
    'gym_ball_trunk_emg',
    'unstable_surface_emg_meta_analysis',
    'unstable_closed_chain_shoulder_meta_analysis',
  ]) {
    assert.ok(registryDocument.sources[sourceKey])
  }

  const result = buildResearchPacketFromBatch({
    facilityId: batch.facilityId,
    researchVersion: batch.researchVersion,
    sharedEvidence: batch.sharedEvidence,
    sourceRegistry: registryDocument.sources,
    cardSpec,
    currentCard: {
      slug: 'stir-the-pot',
      canonicalName: 'Stir-the-Pot',
      familyKey: 'stability_ball_circular_plank_control',
      snapshot: {
        capturedAt: batch.snapshotAt,
        cardVersion: 2,
        status: 'review',
      },
    },
    mediaCandidates: [],
  })

  assert.equal(result.validation.valid, true)
  assert.equal(result.packet.evidence.length, REQUIRED_RESEARCH_SECTIONS.length)
  assert.equal(result.packet.mediaCandidates.length, 4)
  assert.equal(result.packet.alternateAssessments.length, 10)
  assert.equal(
    cardSpec.assessmentSummary.identityDecision.decision,
    'duplicate_consolidated',
  )
  assert.deepEqual(
    cardSpec.assessmentSummary.proposedVariantPlan.map((variant) => [
      variant.variantKey,
      variant.exerciseComplexity,
      variant.physicalDifficulty,
      variant.overallDifficulty,
    ]),
    [
      ['knee-supported-small-circles', 32, 24, 32],
      ['toe-supported-small-circles', 42, 34, 42],
      ['toe-supported-large-circles', 48, 40, 48],
    ],
  )
  assert.ok(cardSpec.assessmentSummary.proposedVariantPlan.every((variant) => (
    variant.overallDifficulty === Math.max(
      variant.exerciseComplexity,
      variant.physicalDifficulty,
    )
  )))
  assert.doesNotMatch(
    JSON.stringify(cardSpec),
    /"(?:exerciseSkillLevel|skillLevel|skill_level|minimumSkillLevel|minimum_skill_level|proficiencyLevel|proficiency_level)"/,
  )
  assert.ok(result.packet.mediaCandidates.every((candidate) => (
    candidate.linkStatus === 'healthy'
      && candidate.embeddingAllowed === true
      && candidate.externalVerification?.method === 'youtube_oembed'
      && !Object.hasOwn(candidate, 'reviewStatus')
      && !Object.hasOwn(candidate, 'exactVariantMatch')
      && !Object.hasOwn(candidate, 'reviewerUserId')
      && !Object.hasOwn(candidate, 'reviewedAt')
  )))
  assert.ok(cardSpec.alternateAssessments.some((alternate) => (
    alternate.name === 'Stir-the-Pot Plank'
      && alternate.classification === 'same_identity'
  )))
  assert.ok(cardSpec.alternateAssessments.some((alternate) => (
    alternate.name === 'Stability-Ball Roll-Out'
      && alternate.classification === 'new_definition'
  )))
})

test('static-control collision batch consolidates three exact synonyms and preserves candidate-only media gates', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  const batch = JSON.parse(readFileSync(
    path.join(
      RESEARCH_ROOT,
      'batches/static-control-identity-collisions.v1.json',
    ),
    'utf8',
  ))

  for (const sourceKey of [
    'ace_thread_the_needle',
    'thoracic_exercise_prescription_review',
    'single_leg_balance_training_review',
    'foot_strength_athletes_review',
    'split_squat_joint_angles_loading',
    'split_squat_step_length_biomechanics',
    'isometric_training_adaptations_review',
  ]) {
    assert.ok(registryDocument.sources[sourceKey])
  }

  const expected = new Map([
    ['quadruped-thread-the-needle', [
      ['quadruped-thread-and-open', 28, 14, 28],
      ['heel-sit-thread-and-open', 34, 16, 34],
    ]],
    ['single-leg-balance-hold-tripod-foot', [
      ['supported-eyes-open', 22, 18, 22],
      ['unsupported-eyes-open', 34, 24, 34],
      ['unsupported-eyes-closed', 52, 28, 52],
    ]],
    ['split-squat-isometric-hold', [
      ['supported-bodyweight-mid-range', 26, 32, 32],
      ['unsupported-bodyweight-mid-range', 36, 42, 42],
      ['goblet-loaded-mid-range', 44, 58, 58],
    ]],
  ])

  assert.equal(batch.researchVersion, '2026-07-27.45')
  assert.equal(batch.cards.length, 3)
  for (const cardSpec of batch.cards) {
    const result = buildResearchPacketFromBatch({
      facilityId: batch.facilityId,
      researchVersion: batch.researchVersion,
      sharedEvidence: batch.sharedEvidence,
      sourceRegistry: registryDocument.sources,
      cardSpec,
      currentCard: {
        slug: cardSpec.slug,
        canonicalName: cardSpec.slug,
        familyKey: 'static_control_candidate',
        snapshot: {
          capturedAt: batch.snapshotAt,
          cardVersion: 2,
          status: 'review',
        },
      },
      mediaCandidates: [],
    })

    assert.equal(result.validation.valid, true)
    assert.equal(result.packet.evidence.length, REQUIRED_RESEARCH_SECTIONS.length)
    assert.equal(result.packet.mediaCandidates.length, 4)
    assert.equal(
      cardSpec.assessmentSummary.identityDecision.decision,
      'duplicate_consolidated',
    )
    assert.deepEqual(
      cardSpec.assessmentSummary.variantDifficultyCandidates.map((variant) => [
        variant.variantKey,
        variant.exerciseComplexity,
        variant.physicalDifficulty,
        variant.derivedOverallDifficulty,
      ]),
      expected.get(cardSpec.slug),
    )
    assert.ok(
      cardSpec.assessmentSummary.variantDifficultyCandidates.every((variant) => (
        variant.derivedOverallDifficulty === Math.max(
          variant.exerciseComplexity,
          variant.physicalDifficulty,
        )
      )),
    )
    assert.doesNotMatch(
      JSON.stringify(cardSpec),
      /"(?:exerciseSkillLevel|skillLevel|skill_level|minimumSkillLevel|minimum_skill_level|proficiencyLevel|proficiency_level|proficiencyClassification)"/,
    )
    assert.ok(result.packet.mediaCandidates.every((candidate) => (
      candidate.linkStatus === 'healthy'
        && candidate.embeddingAllowed === false
        && candidate.externalVerification?.method === 'youtube_oembed'
        && !Object.hasOwn(candidate, 'reviewStatus')
        && !Object.hasOwn(candidate, 'exactVariantMatch')
        && !Object.hasOwn(candidate, 'reviewerUserId')
        && !Object.hasOwn(candidate, 'reviewedAt')
    )))
  }

  const quadruped = batch.cards.find((card) => (
    card.slug === 'quadruped-thread-the-needle'
  ))
  const balance = batch.cards.find((card) => (
    card.slug === 'single-leg-balance-hold-tripod-foot'
  ))
  const splitSquat = batch.cards.find((card) => (
    card.slug === 'split-squat-isometric-hold'
  ))
  assert.ok(quadruped.alternateAssessments.some((alternate) => (
    alternate.name === 'Quadruped Thread-the-Needle Rotation'
      && alternate.classification === 'same_identity'
  )))
  assert.ok(balance.alternateAssessments.some((alternate) => (
    alternate.name === 'Single-Leg Balance Reach Clock'
      && alternate.classification === 'new_definition'
  )))
  assert.ok(splitSquat.alternateAssessments.some((alternate) => (
    alternate.name === 'Rear-Foot-Elevated Split Squat Isometric'
      && alternate.classification === 'new_definition'
  )))
})

test('reactive landing and pogo batch consolidates nine definitions while preserving mechanical boundaries', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  const batch = JSON.parse(readFileSync(
    path.join(
      RESEARCH_ROOT,
      'batches/reactive-landing-pogo-identity.v1.json',
    ),
    'utf8',
  ))

  for (const sourceKey of [
    'landing_intervention_systematic_review',
    'landing_feedback_systematic_review',
    'agility_perception_action_meta_analysis',
    'change_direction_training_scoping_review',
    'horizontal_deceleration_review',
    'unilateral_hopping_leg_stiffness',
    'plyometric_lower_limb_stiffness_meta_analysis',
  ]) {
    assert.ok(registryDocument.sources[sourceKey])
  }

  const expected = new Map([
    ['snap-down-to-stick', [
      ['bilateral-tall-reach-stick', 32, 22, 32],
    ]],
    ['mirror-shuffle', [
      ['partner-lateral-leader-follower', 58, 40, 58],
    ]],
    ['sprint-to-stick-deceleration', [
      ['five-yard-planned-stick', 48, 54, 54],
      ['seven-to-ten-yard-planned-stick', 56, 68, 68],
    ]],
    ['single-leg-pogo', [
      ['supported-stationary-low-amplitude', 34, 40, 40],
      ['stationary-low-amplitude', 46, 54, 54],
      ['linear-forward-traveling', 58, 64, 64],
      ['lateral-line', 62, 66, 66],
    ]],
  ])

  assert.equal(batch.researchVersion, '2026-07-27.46')
  assert.equal(batch.cards.length, 4)
  for (const cardSpec of batch.cards) {
    const result = buildResearchPacketFromBatch({
      facilityId: batch.facilityId,
      researchVersion: batch.researchVersion,
      sharedEvidence: batch.sharedEvidence,
      sourceRegistry: registryDocument.sources,
      cardSpec,
      currentCard: {
        slug: cardSpec.slug,
        canonicalName: cardSpec.slug,
        familyKey: 'reactive_landing_pogo_candidate',
        snapshot: {
          capturedAt: batch.snapshotAt,
          cardVersion: 2,
          status: 'review',
        },
      },
      mediaCandidates: [],
    })

    assert.equal(result.validation.valid, true)
    assert.equal(result.packet.evidence.length, REQUIRED_RESEARCH_SECTIONS.length)
    assert.equal(result.packet.mediaCandidates.length, 4)
    assert.equal(
      cardSpec.assessmentSummary.identityDecision.decision,
      'duplicate_consolidated',
    )
    assert.deepEqual(
      cardSpec.assessmentSummary.variantDifficultyCandidates.map((variant) => [
        variant.variantKey,
        variant.exerciseComplexity,
        variant.physicalDifficulty,
        variant.derivedOverallDifficulty,
      ]),
      expected.get(cardSpec.slug),
    )
    assert.ok(
      cardSpec.assessmentSummary.variantDifficultyCandidates.every((variant) => (
        variant.derivedOverallDifficulty === Math.max(
          variant.exerciseComplexity,
          variant.physicalDifficulty,
        )
      )),
    )
    assert.doesNotMatch(
      JSON.stringify(cardSpec),
      /"(?:exerciseSkillLevel|skillLevel|skill_level|minimumSkillLevel|minimum_skill_level|proficiencyLevel|proficiency_level|proficiencyClassification)"/,
    )
    assert.ok(result.packet.mediaCandidates.every((candidate) => (
      candidate.linkStatus === 'healthy'
        && candidate.embeddingAllowed === false
        && candidate.externalVerification?.method === 'youtube_oembed'
        && !Object.hasOwn(candidate, 'reviewStatus')
        && !Object.hasOwn(candidate, 'exactVariantMatch')
        && !Object.hasOwn(candidate, 'reviewerUserId')
        && !Object.hasOwn(candidate, 'reviewedAt')
    )))
  }

  const snapDown = batch.cards.find((card) => (
    card.slug === 'snap-down-to-stick'
  ))
  const mirror = batch.cards.find((card) => card.slug === 'mirror-shuffle')
  const sprint = batch.cards.find((card) => (
    card.slug === 'sprint-to-stick-deceleration'
  ))
  const pogo = batch.cards.find((card) => card.slug === 'single-leg-pogo')
  assert.ok(snapDown.alternateAssessments.some((alternate) => (
    alternate.name === 'Drop Squat to Stick'
      && alternate.classification === 'new_definition'
  )))
  assert.ok(mirror.alternateAssessments.some((alternate) => (
    alternate.name === 'Lateral Shuffle Mechanics Walkthrough'
      && alternate.classification === 'new_definition'
  )))
  assert.ok(sprint.alternateAssessments.some((alternate) => (
    alternate.name === 'Seven-to-Ten-Yard Planned Sprint-to-Stick'
      && alternate.classification === 'new_variant'
  )))
  assert.equal(
    pogo.assessmentSummary.distinctIdentityDecision.decision,
    'distinct_exercises',
  )
  assert.ok(pogo.alternateAssessments.some((alternate) => (
    alternate.name === 'Single-Leg Pogo Hold-to-Hop'
      && alternate.classification === 'new_definition'
  )))
})

test('reactive hop-to-cut and seated overhead press packets preserve exact variants and human media gates', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  const cases = [
    {
      filename: 'reactive-hop-to-cut-family.v1.json',
      canonicalName: 'Reactive Hop-to-Cut',
      expectedMedia: 3,
      expectedVariants: [
        ['bilateral-hop-reactive-45-cut', 64, 54, 64],
        ['bilateral-hop-reactive-90-cut', 72, 62, 72],
      ],
      consolidatedSource: 'reactive-45-degree-hop-to-cut',
    },
    {
      filename: 'seated-overhead-press-family.v1.json',
      canonicalName: 'Seated Overhead Press',
      expectedMedia: 5,
      expectedVariants: [
        ['barbell-unsupported-pronated', 50, 58, 58],
        ['barbell-back-supported-pronated', 44, 60, 60],
        ['dumbbell-back-supported-neutral', 46, 50, 50],
        ['dumbbell-back-supported-pronated', 48, 52, 52],
      ],
      consolidatedSource: 'seated-dumbbell-overhead-press',
    },
  ]

  for (const item of cases) {
    const batch = JSON.parse(readFileSync(
      path.join(RESEARCH_ROOT, 'batches', item.filename),
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
        canonicalName: item.canonicalName,
        familyKey: 'candidate_family',
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
    assert.equal(result.packet.mediaCandidates.length, item.expectedMedia)
    assert.equal(
      cardSpec.assessmentSummary.identityDecision.consolidatedSource,
      item.consolidatedSource,
    )
    assert.deepEqual(
      cardSpec.assessmentSummary.proposedVariantPlan.map((variant) => [
        variant.variantKey,
        variant.exerciseComplexity,
        variant.physicalDifficulty,
        variant.overallDifficulty,
      ]),
      item.expectedVariants,
    )
    assert.ok(
      cardSpec.assessmentSummary.proposedVariantPlan.every((variant) => (
        variant.overallDifficulty === Math.max(
          variant.exerciseComplexity,
          variant.physicalDifficulty,
        )
      )),
    )
    assert.doesNotMatch(
      JSON.stringify(cardSpec),
      /"(?:exerciseSkillLevel|skillLevel|skill_level|minimumSkillLevel|minimum_skill_level|proficiencyLevel|proficiency_level|proficiencyClassification)"/,
    )
    assert.ok(result.packet.mediaCandidates.every((candidate) => (
      candidate.linkStatus === 'healthy'
        && candidate.embeddingAllowed === true
        && candidate.externalVerification?.method === 'youtube_oembed'
        && !Object.hasOwn(candidate, 'reviewStatus')
        && !Object.hasOwn(candidate, 'exactVariantMatch')
        && !Object.hasOwn(candidate, 'reviewerUserId')
        && !Object.hasOwn(candidate, 'reviewedAt')
    )))
  }
})

test('hip thrust packet separates glute bridges, preserves exact variants, and has no exercise skill levels', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  const batch = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'batches', 'hip-thrust-family.v1.json'),
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
      canonicalName: 'Hip Thrust',
      familyKey: 'hip_extension',
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
  assert.deepEqual(
    cardSpec.assessmentSummary.identityDecision.consolidatedSources,
    [
      'band-hip-thrust',
      'barbell-hip-thrust',
      'hip-thrust-loaded-glute-bridge',
      'sandbag-hip-thrust-strength',
      'single-leg-hip-thrust',
    ],
  )
  assert.deepEqual(
    cardSpec.assessmentSummary.proposedVariantPlan.map((variant) => [
      variant.variantKey,
      variant.exerciseComplexity,
      variant.physicalDifficulty,
      variant.overallDifficulty,
    ]),
    [
      ['bodyweight-bilateral-upper-back-supported', 38, 30, 38],
      ['barbell-bilateral-upper-back-supported', 48, 62, 62],
      ['band-bilateral-upper-back-supported', 44, 46, 46],
      ['dumbbell-bilateral-upper-back-supported', 42, 44, 44],
      ['kettlebell-bilateral-upper-back-supported', 42, 44, 44],
      ['plate-bilateral-upper-back-supported', 42, 42, 42],
      ['sandbag-bilateral-upper-back-supported', 46, 50, 50],
      ['bodyweight-single-leg-upper-back-supported', 58, 48, 58],
    ],
  )
  assert.ok(
    cardSpec.assessmentSummary.proposedVariantPlan.every((variant) => (
      variant.overallDifficulty === Math.max(
        variant.exerciseComplexity,
        variant.physicalDifficulty,
      )
    )),
  )
  assert.ok(cardSpec.alternateAssessments.some((alternate) => (
    alternate.name === 'Barbell Glute Bridge'
      && alternate.classification === 'new_definition'
  )))
  assert.deepEqual(
    cardSpec.assessmentSummary.identityDecision.humanReviewBoundaries,
    ['feet-elevated-hip-thrust', 'hip-thrust-eccentric-lower'],
  )
  assert.doesNotMatch(
    JSON.stringify(cardSpec),
    /"(?:exerciseSkillLevel|skillLevel|skill_level|minimumSkillLevel|minimum_skill_level|proficiencyLevel|proficiency_level|proficiencyClassification)"/,
  )
  assert.ok(result.packet.mediaCandidates.every((candidate) => (
    candidate.linkStatus === 'healthy'
      && candidate.embeddingAllowed === true
      && candidate.externalVerification?.method === 'youtube_oembed'
      && !Object.hasOwn(candidate, 'reviewStatus')
      && !Object.hasOwn(candidate, 'exactVariantMatch')
      && !Object.hasOwn(candidate, 'reviewerUserId')
      && !Object.hasOwn(candidate, 'reviewedAt')
  )))
})

test('ball-drop chase-and-catch packet preserves ordered actions and difficulty-only variants', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  const batch = JSON.parse(readFileSync(
    path.join(
      RESEARCH_ROOT,
      'batches',
      'ball-drop-chase-catch-family.v1.json',
    ),
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
      canonicalName: 'Ball Drop Reaction Sprint',
      familyKey: 'Reactive Start & Chase',
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
  assert.equal(result.packet.alternateAssessments.length, 12)
  assert.deepEqual(
    cardSpec.assessmentSummary.proposedVariantPlan.map((variant) => [
      variant.variantKey,
      variant.exerciseComplexity,
      variant.physicalDifficulty,
      variant.overallDifficulty,
    ]),
    [
      ['tennis-ball-partner-drop-catch', 48, 52, 52],
      ['reaction-ball-partner-drop-secure', 60, 54, 60],
    ],
  )
  assert.ok(
    cardSpec.assessmentSummary.proposedVariantPlan.every((variant) => (
      variant.overallDifficulty === Math.max(
        variant.exerciseComplexity,
        variant.physicalDifficulty,
      )
    )),
  )
  assert.deepEqual(
    cardSpec.assessmentSummary.identityDecision.distinctBoundaries,
    [
      'ball-drop-point-and-sprint-cone-reaction',
      'reaction-ball-drop-to-hop-and-go',
      'ball-drop-sprint-plus-direction-cue',
      'reaction-ball-drop-catch-to-cut',
      'gate-reaction-drill',
    ],
  )
  assert.doesNotMatch(
    JSON.stringify(cardSpec),
    /"(?:exerciseSkillLevel|skillLevel|skill_level|minimumSkillLevel|minimum_skill_level|proficiencyLevel|proficiency_level|proficiencyClassification)"/,
  )
  assert.ok(result.packet.mediaCandidates.every((candidate) => (
    candidate.linkStatus === 'healthy'
      && candidate.embeddingAllowed === true
      && candidate.externalVerification?.method === 'youtube_oembed'
      && !Object.hasOwn(candidate, 'reviewStatus')
      && !Object.hasOwn(candidate, 'exactVariantMatch')
      && !Object.hasOwn(candidate, 'reviewerUserId')
      && !Object.hasOwn(candidate, 'reviewedAt')
  )))
})

test('alternating-bounds packet consolidates aliases into difficulty-only exact variants', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  const batch = JSON.parse(readFileSync(
    path.join(
      RESEARCH_ROOT,
      'batches',
      'alternating-bounds-family.v1.json',
    ),
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
      canonicalName: 'Alternating Bounds',
      familyKey: 'Alternating unilateral horizontal multi-step bound',
      snapshot: {
        capturedAt: batch.snapshotAt,
        cardVersion: 2,
        status: 'review',
      },
    },
    mediaCandidates: [],
  })

  assert.equal(result.validation.valid, true)
  assert.equal(result.packet.evidence.length, REQUIRED_RESEARCH_SECTIONS.length)
  assert.equal(result.packet.mediaCandidates.length, 5)
  assert.equal(result.packet.alternateAssessments.length, 12)
  assert.deepEqual(
    cardSpec.assessmentSummary.proposedVariantPlan.map((variant) => [
      variant.variantKey,
      variant.exerciseComplexity,
      variant.physicalDifficulty,
      variant.overallDifficulty,
    ]),
    [
      ['traditional-height-distance', 58, 62, 62],
      ['sprint-bound-distance', 66, 68, 68],
    ],
  )
  assert.ok(
    cardSpec.assessmentSummary.proposedVariantPlan.every((variant) => (
      variant.overallDifficulty === Math.max(
        variant.exerciseComplexity,
        variant.physicalDifficulty,
      )
    )),
  )
  assert.deepEqual(
    cardSpec.assessmentSummary.identityDecision.consolidatedSources,
    [
      'alternate-bounds-for-height-and-distance',
      'alternating-bounds',
      'alternating-bounds-for-height',
    ],
  )
  assert.deepEqual(
    cardSpec.assessmentSummary.identityDecision.alreadyConsolidatedSources,
    ['alternating-bounds-for-distance'],
  )
  assert.doesNotMatch(
    JSON.stringify(cardSpec),
    /"(?:exerciseSkillLevel|skillLevel|skill_level|minimumSkillLevel|minimum_skill_level|proficiencyLevel|proficiency_level|proficiencyClassification)"/,
  )
  assert.ok(result.packet.mediaCandidates.every((candidate) => (
    candidate.linkStatus === 'healthy'
      && candidate.embeddingAllowed === true
      && candidate.externalVerification?.method === 'youtube_oembed'
      && !Object.hasOwn(candidate, 'reviewStatus')
      && !Object.hasOwn(candidate, 'exactVariantMatch')
      && !Object.hasOwn(candidate, 'reviewerUserId')
      && !Object.hasOwn(candidate, 'reviewedAt')
  )))
})

test('split-squat packets preserve the rear-support boundary and difficulty-only exact variants', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  const batch = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'batches', 'split-squat-family.v1.json'),
    'utf8',
  ))
  const expected = new Map([
    ['split-squat', [
      ['supported-bodyweight-standard', 28, 26, 28],
      ['bodyweight-standard', 34, 32, 34],
      ['two-dumbbell-suitcase', 42, 48, 48],
      ['barbell-back-rack', 52, 62, 62],
      ['single-kettlebell-front-rack', 46, 46, 46],
      ['double-kettlebell-front-rack', 50, 56, 56],
      ['sandbag-front-hold', 44, 50, 50],
      ['bodyweight-slow-eccentric-pause', 44, 42, 44],
    ]],
    ['bulgarian-split-squat', [
      ['supported-bodyweight-rear-foot-elevated', 36, 36, 36],
      ['bodyweight-rear-foot-elevated', 44, 42, 44],
      ['two-dumbbell-suitcase-rear-foot-elevated', 50, 54, 54],
      ['barbell-back-rack-rear-foot-elevated', 60, 68, 68],
      ['single-kettlebell-goblet-rear-foot-elevated', 52, 52, 52],
      ['bodyweight-slow-eccentric-pause-rear-foot-elevated', 52, 50, 52],
    ]],
  ])

  assert.equal(registryDocument.registryVersion, '2026-08-02.84')
  for (const sourceKey of [
    'split_squat_step_length_biomechanics',
    'unilateral_barbell_exercise_activation',
    'rfess_rear_leg_moment',
    'rfess_strength_symmetry_validity',
    'acsm_resistance_training_position_stand_2026',
    'resistance_prescription_network_meta_analysis',
  ]) {
    assert.ok(registryDocument.sources[sourceKey])
  }
  assert.equal(batch.researchVersion, '2026-07-27.53')
  assert.equal(batch.cards.length, 2)
  for (const cardSpec of batch.cards) {
    const result = buildResearchPacketFromBatch({
      facilityId: batch.facilityId,
      researchVersion: batch.researchVersion,
      sharedEvidence: batch.sharedEvidence,
      sourceRegistry: registryDocument.sources,
      cardSpec,
      currentCard: {
        slug: cardSpec.slug,
        canonicalName: cardSpec.slug === 'split-squat'
          ? 'Split Squat'
          : 'Rear-Foot-Elevated Split Squat',
        familyKey: cardSpec.slug === 'split-squat'
          ? 'stationary_split_stance_squat'
          : 'rear_foot_elevated_stationary_split_squat',
        snapshot: {
          capturedAt: batch.snapshotAt,
          cardVersion: 2,
          status: 'review',
        },
      },
      mediaCandidates: [],
    })

    assert.equal(result.validation.valid, true)
    assert.equal(result.packet.evidence.length, REQUIRED_RESEARCH_SECTIONS.length)
    assert.equal(result.packet.mediaCandidates.length, 5)
    assert.equal(result.packet.alternateAssessments.length, 12)
    assert.deepEqual(
      cardSpec.assessmentSummary.proposedVariantPlan.map((variant) => [
        variant.variantKey,
        variant.exerciseComplexity,
        variant.physicalDifficulty,
        variant.overallDifficulty,
      ]),
      expected.get(cardSpec.slug),
    )
    assert.ok(
      cardSpec.assessmentSummary.proposedVariantPlan.every((variant) => (
        variant.overallDifficulty === Math.max(
          variant.exerciseComplexity,
          variant.physicalDifficulty,
        )
      )),
    )
    assert.doesNotMatch(
      JSON.stringify(cardSpec),
      /"(?:exerciseSkillLevel|skillLevel|skill_level|minimumSkillLevel|minimum_skill_level|proficiencyLevel|proficiency_level|proficiencyClassification)"/,
    )
    assert.ok(result.packet.mediaCandidates.every((candidate) => (
      candidate.linkStatus === 'healthy'
        && candidate.embeddingAllowed === true
        && candidate.externalVerification?.method === 'youtube_oembed'
        && !Object.hasOwn(candidate, 'reviewStatus')
        && !Object.hasOwn(candidate, 'exactVariantMatch')
        && !Object.hasOwn(candidate, 'reviewerUserId')
        && !Object.hasOwn(candidate, 'reviewedAt')
    )))
  }

  const splitSquat = batch.cards.find((card) => card.slug === 'split-squat')
  const rearFootElevated = batch.cards.find((card) => (
    card.slug === 'bulgarian-split-squat'
  ))
  assert.ok(splitSquat.alternateAssessments.some((alternate) => (
    alternate.name === 'Rear-Foot-Elevated Split Squat'
      && alternate.classification === 'new_definition'
  )))
  assert.ok(rearFootElevated.alternateAssessments.some((alternate) => (
    alternate.name === 'Floor-Based Split Squat'
      && alternate.classification === 'new_definition'
  )))
})

test('hamstring slider curl research batch preserves exact variants, difficulty-only scoring, and candidate-only media', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  const batch = JSON.parse(readFileSync(
    path.join(
      RESEARCH_ROOT,
      'batches/hamstring-slider-curl-family.v1.json',
    ),
    'utf8',
  ))

  for (const sourceKey of [
    'supine_sliding_leg_curl_emg_2025',
    'hamstring_force_stretch_eccentric_slider_2026',
    'hamstring_exercise_selection_activation',
    'acsm_resistance_training_position_stand_2026',
    'resistance_prescription_network_meta_analysis',
  ]) {
    assert.ok(registryDocument.sources[sourceKey])
  }
  assert.equal(batch.researchVersion, '2026-07-27.54')
  assert.equal(batch.cards.length, 1)

  const cardSpec = batch.cards[0]
  const result = buildResearchPacketFromBatch({
    facilityId: batch.facilityId,
    researchVersion: batch.researchVersion,
    sharedEvidence: batch.sharedEvidence,
    sourceRegistry: registryDocument.sources,
    cardSpec,
    currentCard: {
      slug: cardSpec.slug,
      canonicalName: 'Hamstring Slider Curl',
      familyKey: 'supine_sliding_knee_flexion_curl',
      snapshot: {
        capturedAt: batch.snapshotAt,
        cardVersion: 2,
        status: 'review',
      },
    },
    mediaCandidates: [],
  })

  assert.equal(result.validation.valid, true)
  assert.equal(result.packet.evidence.length, REQUIRED_RESEARCH_SECTIONS.length)
  assert.equal(result.packet.mediaCandidates.length, 5)
  assert.equal(result.packet.alternateAssessments.length, 11)
  assert.deepEqual(
    cardSpec.assessmentSummary.proposedVariantPlan.map((variant) => [
      variant.variantKey,
      variant.exerciseComplexity,
      variant.physicalDifficulty,
      variant.overallDifficulty,
    ]),
    [
      ['bilateral-short-range-bridge-reset', 28, 32, 32],
      ['bilateral-full-cycle', 34, 44, 44],
      ['bilateral-eccentric-only-reset-down', 38, 48, 48],
      ['alternating-full-cycle', 44, 52, 52],
      ['single-leg-full-cycle', 50, 62, 62],
      ['single-leg-eccentric-only-assisted-return', 52, 66, 66],
    ],
  )
  assert.ok(
    cardSpec.assessmentSummary.proposedVariantPlan.every((variant) => (
      variant.overallDifficulty === Math.max(
        variant.exerciseComplexity,
        variant.physicalDifficulty,
      )
    )),
  )
  assert.doesNotMatch(
    JSON.stringify(cardSpec),
    /"(?:exerciseSkillLevel|skillLevel|skill_level|minimumSkillLevel|minimum_skill_level|proficiencyLevel|proficiency_level|proficiencyClassification)"/,
  )
  assert.ok(result.packet.mediaCandidates.every((candidate) => (
    candidate.linkStatus === 'healthy'
      && candidate.embeddingAllowed === true
      && candidate.externalVerification?.method === 'youtube_oembed'
      && !Object.hasOwn(candidate, 'reviewStatus')
      && !Object.hasOwn(candidate, 'exactVariantMatch')
      && !Object.hasOwn(candidate, 'reviewerUserId')
      && !Object.hasOwn(candidate, 'reviewedAt')
  )))
})

test('landmine press research batch consolidates exact standing variants and leaves every approval human-gated', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  const batch = JSON.parse(readFileSync(
    path.join(
      RESEARCH_ROOT,
      'batches/landmine-press-family.v1.json',
    ),
    'utf8',
  ))

  assert.equal(registryDocument.registryVersion, '2026-08-02.84')
  for (const sourceKey of [
    'nsca_landmine_press_implementation',
    'landmine_press_kinematics_2026',
    'acsm_resistance_training_position_stand_2026',
    'resistance_prescription_network_meta_analysis',
  ]) {
    assert.ok(registryDocument.sources[sourceKey])
  }
  assert.equal(batch.researchVersion, '2026-07-27.55')
  assert.equal(batch.cards.length, 1)

  const cardSpec = batch.cards[0]
  const result = buildResearchPacketFromBatch({
    facilityId: batch.facilityId,
    researchVersion: batch.researchVersion,
    sharedEvidence: batch.sharedEvidence,
    sourceRegistry: registryDocument.sources,
    cardSpec,
    currentCard: {
      slug: cardSpec.slug,
      canonicalName: 'Landmine Press',
      familyKey: 'Shoulder-friendly pressing strength',
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
  assert.equal(result.packet.alternateAssessments.length, 12)
  assert.deepEqual(
    cardSpec.assessmentSummary.variantDifficultyCandidates.map((variant) => [
      variant.variantKey,
      variant.exerciseComplexity,
      variant.physicalDifficulty,
      variant.derivedOverallDifficulty,
    ]),
    [
      ['single-arm-square-stance-sleeve-grip-strict', 46, 44, 46],
      ['single-arm-split-stance-sleeve-grip-strict', 44, 46, 46],
      ['two-hand-square-stance-sleeve-grip-strict', 38, 44, 44],
      ['two-hand-square-stance-neutral-handle-strict', 40, 48, 48],
      ['two-hand-square-stance-ball-grip-strict', 44, 48, 48],
    ],
  )
  assert.ok(
    cardSpec.assessmentSummary.variantDifficultyCandidates.every((variant) => (
      variant.derivedOverallDifficulty === Math.max(
        variant.exerciseComplexity,
        variant.physicalDifficulty,
      )
    )),
  )
  assert.ok(cardSpec.alternateAssessments.some((alternate) => (
    alternate.name === 'Two-Hand Landmine Press'
      && alternate.classification === 'new_variant'
      && alternate.distinguishingDimensions.variantKey
        === 'two-hand-square-stance-sleeve-grip-strict'
  )))
  assert.ok(cardSpec.alternateAssessments.some((alternate) => (
    alternate.name === 'Half-Kneeling One-Arm Landmine Press'
      && alternate.classification === 'new_definition'
  )))
  assert.doesNotMatch(
    JSON.stringify(cardSpec),
    /"(?:exerciseSkillLevel|skillLevel|skill_level|minimumSkillLevel|minimum_skill_level|proficiencyLevel|proficiency_level|proficiencyClassification)"/,
  )
  assert.ok(result.packet.mediaCandidates.every((candidate) => (
    candidate.linkStatus === 'healthy'
      && candidate.embeddingAllowed === true
      && candidate.externalVerification?.method === 'youtube_oembed'
      && !Object.hasOwn(candidate, 'reviewStatus')
      && !Object.hasOwn(candidate, 'exactVariantMatch')
      && !Object.hasOwn(candidate, 'reviewerUserId')
      && !Object.hasOwn(candidate, 'reviewedAt')
  )))
})

test('one-arm landmine base packets complete exact cards while keeping Arc Press identity-quarantined', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  const batch = JSON.parse(readFileSync(
    path.join(
      RESEARCH_ROOT,
      'batches/one-arm-landmine-base-family.v1.json',
    ),
    'utf8',
  ))
  const expectedDifficulty = new Map([
    ['half-kneeling-one-arm-landmine-press', [
      ['working-arm-ipsilateral-to-down-knee-strict', 48, 46, 48],
      ['working-arm-contralateral-to-down-knee-strict', 50, 46, 50],
    ]],
    ['tall-kneeling-one-arm-landmine-press', [
      ['single-arm-tall-kneeling-sleeve-grip-strict', 50, 46, 50],
      ['two-hand-tall-kneeling-sleeve-grip-strict', 44, 46, 46],
    ]],
    ['one-arm-landmine-floor-press', [
      ['single-arm-supine-floor-supported-strict', 44, 52, 52],
      ['two-hand-supine-floor-supported-strict', 42, 50, 50],
    ]],
    ['one-arm-landmine-z-press', [
      ['single-arm-long-sit-legs-together-strict', 52, 46, 52],
      ['single-arm-long-sit-straddle-strict', 50, 46, 50],
    ]],
    ['one-arm-landmine-arc-press', [
      ['provisional-half-kneeling-arc-press', 54, 42, 54],
      ['provisional-tall-kneeling-arc-press', 56, 42, 56],
      ['provisional-standing-arc-press', 54, 44, 54],
    ]],
  ])

  assert.equal(registryDocument.registryVersion, '2026-08-02.84')
  for (const sourceKey of [
    'nsca_landmine_press_implementation',
    'landmine_press_kinematics_2026',
    'institute_of_motion_landmine_arc_press',
    'nifs_landmine_press_options',
    'bench_press_range_of_motion_kinematics',
    'acsm_resistance_training_position_stand_2026',
    'resistance_prescription_network_meta_analysis',
  ]) {
    assert.ok(registryDocument.sources[sourceKey])
  }
  assert.equal(batch.researchVersion, '2026-07-27.56')
  assert.equal(batch.cards.length, 5)

  for (const cardSpec of batch.cards) {
    const result = buildResearchPacketFromBatch({
      facilityId: batch.facilityId,
      researchVersion: batch.researchVersion,
      sharedEvidence: batch.sharedEvidence,
      sourceRegistry: registryDocument.sources,
      cardSpec,
      currentCard: {
        slug: cardSpec.slug,
        canonicalName: cardSpec.slug
          .split('-')
          .map((word) => word[0].toUpperCase() + word.slice(1))
          .join(' '),
        familyKey: 'one_arm_landmine_base_family',
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
    assert.equal(result.packet.alternateAssessments.length, 6)
    assert.deepEqual(
      cardSpec.assessmentSummary.variantDifficultyCandidates.map((variant) => [
        variant.variantKey,
        variant.exerciseComplexity,
        variant.physicalDifficulty,
        variant.derivedOverallDifficulty,
      ]),
      expectedDifficulty.get(cardSpec.slug),
    )
    assert.ok(
      cardSpec.assessmentSummary.variantDifficultyCandidates.every((variant) => (
        variant.derivedOverallDifficulty === Math.max(
          variant.exerciseComplexity,
          variant.physicalDifficulty,
        )
      )),
    )
    assert.doesNotMatch(
      JSON.stringify(cardSpec),
      /"(?:exerciseSkillLevel|skillLevel|skill_level|minimumSkillLevel|minimum_skill_level|proficiencyLevel|proficiency_level|proficiencyClassification)"/,
    )
    assert.ok(result.packet.mediaCandidates.every((candidate) => (
      candidate.linkStatus === 'healthy'
        && candidate.embeddingAllowed === true
        && candidate.externalVerification?.method === 'youtube_oembed'
        && !Object.hasOwn(candidate, 'reviewStatus')
        && !Object.hasOwn(candidate, 'exactVariantMatch')
        && !Object.hasOwn(candidate, 'reviewerUserId')
        && !Object.hasOwn(candidate, 'reviewedAt')
    )))
  }

  const arcCard = batch.cards.find((card) => (
    card.slug === 'one-arm-landmine-arc-press'
  ))
  assert.equal(
    arcCard.assessmentSummary.proposedDeliveryProfiles[0]
      .dosage.selectionStatus,
    'blocked_pending_identity_review',
  )
  assert.match(arcCard.assessmentSummary.identity, /not yet established/)
  assert.ok(arcCard.mediaCandidates.every((candidate) => (
    /pending|unresolved|review/i.test(candidate.notes)
  )))
})

test('landmine explosive press packets consolidate hand count while preserving action boundaries', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  const batch = JSON.parse(readFileSync(
    path.join(
      RESEARCH_ROOT,
      'batches/landmine-explosive-press-family.v1.json',
    ),
    'utf8',
  ))
  const expectedDifficulty = new Map([
    ['one-arm-landmine-push-press', [
      ['unilateral-square-stance-dip-drive', 56, 52, 56],
      ['unilateral-split-stance-dip-drive', 60, 52, 60],
      ['bilateral-square-stance-dip-drive', 52, 56, 56],
    ]],
    ['one-arm-landmine-split-jerk', [
      ['working-arm-ipsilateral-to-lead-leg-split-jerk', 68, 60, 68],
      ['working-arm-contralateral-to-lead-leg-split-jerk', 72, 60, 72],
    ]],
    ['landmine-squat-to-press', [
      ['bilateral-continuous-squat-to-press', 58, 60, 60],
      ['unilateral-continuous-squat-to-press', 62, 58, 62],
    ]],
  ])
  const expectedMedia = new Map([
    ['one-arm-landmine-push-press', 5],
    ['one-arm-landmine-split-jerk', 3],
    ['landmine-squat-to-press', 3],
  ])

  assert.equal(registryDocument.registryVersion, '2026-08-02.84')
  for (const sourceKey of [
    'nsca_landmine_press_implementation',
    'landmine_press_kinematics_2026',
    'push_press_jerk_kinetics',
    'nsca_push_jerk_technique',
    'ace_squat_to_overhead_press',
    'breaking_muscle_landmine_push_press',
    'acsm_resistance_training_position_stand_2026',
    'resistance_prescription_network_meta_analysis',
  ]) {
    assert.ok(registryDocument.sources[sourceKey])
  }
  assert.equal(batch.researchVersion, '2026-07-31.57')
  assert.equal(batch.cards.length, 3)

  for (const cardSpec of batch.cards) {
    const result = buildResearchPacketFromBatch({
      facilityId: batch.facilityId,
      researchVersion: batch.researchVersion,
      sharedEvidence: batch.sharedEvidence,
      sourceRegistry: registryDocument.sources,
      cardSpec,
      currentCard: {
        slug: cardSpec.slug,
        canonicalName: cardSpec.slug === 'one-arm-landmine-push-press'
          ? 'Landmine Push Press'
          : cardSpec.slug
            .split('-')
            .map((word) => word[0].toUpperCase() + word.slice(1))
            .join(' '),
        familyKey: 'landmine_explosive_press_family',
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
    assert.equal(
      result.packet.mediaCandidates.length,
      expectedMedia.get(cardSpec.slug),
    )
    assert.equal(result.packet.alternateAssessments.length, 6)
    assert.deepEqual(
      cardSpec.assessmentSummary.variantDifficultyCandidates.map((variant) => [
        variant.variantKey,
        variant.exerciseComplexity,
        variant.physicalDifficulty,
        variant.derivedOverallDifficulty,
      ]),
      expectedDifficulty.get(cardSpec.slug),
    )
    assert.ok(
      cardSpec.assessmentSummary.variantDifficultyCandidates.every((variant) => (
        variant.derivedOverallDifficulty === Math.max(
          variant.exerciseComplexity,
          variant.physicalDifficulty,
        )
      )),
    )
    assert.doesNotMatch(
      JSON.stringify(cardSpec),
      /"(?:exerciseSkillLevel|skillLevel|skill_level|minimumSkillLevel|minimum_skill_level|proficiencyLevel|proficiency_level|proficiencyClassification)"/,
    )
    assert.ok(result.packet.mediaCandidates.every((candidate) => (
      candidate.linkStatus === 'unverified'
        && candidate.embeddingAllowed === false
        && candidate.externalVerification === null
        && !Object.hasOwn(candidate, 'reviewStatus')
        && !Object.hasOwn(candidate, 'exactVariantMatch')
        && !Object.hasOwn(candidate, 'reviewerUserId')
        && !Object.hasOwn(candidate, 'reviewedAt')
    )))
  }

  const pushPress = batch.cards.find((card) => (
    card.slug === 'one-arm-landmine-push-press'
  ))
  assert.ok(pushPress.alternateAssessments.some((alternate) => (
    alternate.name === 'Bilateral Landmine Push Press'
      && alternate.classification === 'new_variant'
      && alternate.distinguishingDimensions.legacySourceSlug
        === 'two-hand-landmine-push-press'
  )))
  assert.ok(batch.cards.every((card) => (
    card.mediaCandidates.length >= 3 && card.mediaCandidates.length <= 5
  )))
})

test('landmine squat and lunge packets preserve support, foot-motion, and action-order boundaries', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  const batch = JSON.parse(readFileSync(
    path.join(
      RESEARCH_ROOT,
      'batches/landmine-squat-lunge-family.v1.json',
    ),
    'utf8',
  ))
  const expectedDifficulty = new Map([
    ['landmine-front-squat', [
      ['bilateral-central-chest-sleeve-front-squat', 48, 58, 58],
      ['unilateral-shoulder-rack-front-squat', 56, 56, 56],
    ]],
    ['landmine-hack-squat', [
      ['shoulder-supported-away-facing-hack-squat', 54, 64, 64],
    ]],
    ['landmine-split-squat', [
      ['ipsilateral-shoulder-rack-stationary-split-squat', 58, 58, 58],
      ['contralateral-shoulder-rack-stationary-split-squat', 62, 58, 62],
      ['two-hand-neutral-handle-stationary-split-squat', 54, 62, 62],
    ]],
    ['landmine-reverse-lunge-to-press', [
      ['working-arm-ipsilateral-to-step-back-leg-drive-to-press', 66, 58, 66],
      ['working-arm-contralateral-to-step-back-leg-drive-to-press', 70, 58, 70],
    ]],
  ])
  const expectedMedia = new Map([
    ['landmine-front-squat', 5],
    ['landmine-hack-squat', 3],
    ['landmine-split-squat', 3],
    ['landmine-reverse-lunge-to-press', 3],
  ])

  assert.equal(registryDocument.registryVersion, '2026-08-02.84')
  for (const sourceKey of [
    'landmine_squat_muscle_activity_kinetics',
    'acsm_landmine_squat_exercise',
    'lower_limb_joint_kinetics_reverse_lunge',
    'army_landmine_rear_lunge_press',
    'breaking_muscle_landmine_lower_body',
    'split_squat_step_length_biomechanics',
    'acsm_resistance_training_position_stand_2026',
    'resistance_prescription_network_meta_analysis',
  ]) {
    assert.ok(registryDocument.sources[sourceKey])
  }
  assert.equal(batch.researchVersion, '2026-07-31.58')
  assert.equal(batch.cards.length, 4)

  for (const cardSpec of batch.cards) {
    const result = buildResearchPacketFromBatch({
      facilityId: batch.facilityId,
      researchVersion: batch.researchVersion,
      sharedEvidence: batch.sharedEvidence,
      sourceRegistry: registryDocument.sources,
      cardSpec,
      currentCard: {
        slug: cardSpec.slug,
        canonicalName: cardSpec.slug
          .split('-')
          .map((word) => word[0].toUpperCase() + word.slice(1))
          .join(' '),
        familyKey: 'landmine_squat_lunge_family',
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
    assert.equal(
      result.packet.mediaCandidates.length,
      expectedMedia.get(cardSpec.slug),
    )
    assert.equal(result.packet.alternateAssessments.length, 6)
    assert.deepEqual(
      cardSpec.assessmentSummary.variantDifficultyCandidates.map((variant) => [
        variant.variantKey,
        variant.exerciseComplexity,
        variant.physicalDifficulty,
        variant.derivedOverallDifficulty,
      ]),
      expectedDifficulty.get(cardSpec.slug),
    )
    assert.ok(
      cardSpec.assessmentSummary.variantDifficultyCandidates.every((variant) => (
        variant.derivedOverallDifficulty === Math.max(
          variant.exerciseComplexity,
          variant.physicalDifficulty,
        )
      )),
    )
    assert.doesNotMatch(
      JSON.stringify(cardSpec),
      /"(?:exerciseSkillLevel|skillLevel|skill_level|minimumSkillLevel|minimum_skill_level|proficiencyLevel|proficiency_level|proficiencyClassification)"/,
    )
    assert.ok(result.packet.mediaCandidates.every((candidate) => (
      candidate.linkStatus === 'unverified'
        && candidate.embeddingAllowed === false
        && candidate.externalVerification === null
        && !Object.hasOwn(candidate, 'reviewStatus')
        && !Object.hasOwn(candidate, 'exactVariantMatch')
        && !Object.hasOwn(candidate, 'reviewerUserId')
        && !Object.hasOwn(candidate, 'reviewedAt')
    )))
  }

  const splitSquat = batch.cards.find((card) => (
    card.slug === 'landmine-split-squat'
  ))
  assert.ok(splitSquat.assessmentSummary.currentCardFindings.some((finding) => (
    /Migration 369/.test(finding) && /quarantines/.test(finding)
  )))
  assert.ok(splitSquat.alternateAssessments.some((alternate) => (
    alternate.name === 'Two-Hand Neutral-Handle Landmine Split Squat'
      && alternate.classification === 'new_variant'
      && alternate.distinguishingDimensions.legacySourceSlug
        === 'landmine-handle-grip-split-squat'
  )))

  const reverseLungePress = batch.cards.find((card) => (
    card.slug === 'landmine-reverse-lunge-to-press'
  ))
  assert.ok(reverseLungePress.alternateAssessments.some((alternate) => (
    alternate.name === 'Bilateral Rear Lunge While Pressing'
      && alternate.classification === 'new_definition'
      && alternate.distinguishingDimensions.status
        === 'proposal_only_human_review_required'
  )))
  assert.ok(batch.cards.every((card) => (
    card.mediaCandidates.length >= 3 && card.mediaCandidates.length <= 5
  )))
})

test('hill sprint acceleration packet separates grade identity, start variants, and physical difficulty', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  const batch = JSON.parse(readFileSync(
    path.join(
      RESEARCH_ROOT,
      'batches/hill-sprint-acceleration-family.v1.json',
    ),
    'utf8',
  ))
  const cardSpec = batch.cards[0]
  const result = buildResearchPacketFromBatch({
    facilityId: batch.facilityId,
    researchVersion: batch.researchVersion,
    sharedEvidence: batch.sharedEvidence,
    sourceRegistry: registryDocument.sources,
    cardSpec,
    currentCard: {
      slug: cardSpec.slug,
      canonicalName: 'Hill Sprint Acceleration',
      familyKey: 'incline_resisted_acceleration',
      snapshot: {
        capturedAt: batch.snapshotAt,
        cardVersion: 1,
        status: 'review',
      },
    },
    mediaCandidates: [],
  })

  assert.equal(registryDocument.registryVersion, '2026-08-02.84')
  for (const sourceKey of [
    'uphill_sprint_slope_kinematics',
    'resisted_sprint_acceleration_meta_analysis',
    'uphill_running_energy_resistance',
  ]) {
    assert.ok(registryDocument.sources[sourceKey])
  }
  assert.equal(batch.researchVersion, '2026-08-01.1')
  assert.equal(batch.cards.length, 1)
  assert.equal(result.validation.valid, true)
  assert.equal(result.packet.evidence.length, REQUIRED_RESEARCH_SECTIONS.length)
  assert.equal(result.packet.mediaCandidates.length, 3)
  assert.equal(result.packet.alternateAssessments.length, 7)
  assert.deepEqual(cardSpec.assessmentSummary.proposedDifficulty, {
    technicalComplexity: 52,
    absoluteLoadDemand: 72,
    coordinationDemand: 60,
    supervisionDemand: 62,
    failureConsequence: 66,
    impact: 56,
    workCapacityDemand: 48,
    baseOverallDifficulty: 72,
  })
  assert.match(
    cardSpec.assessmentSummary.identity,
    /measured, uniform, traction-safe positive grade/,
  )
  assert.match(
    cardSpec.assessmentSummary.programmingDecision,
    /two-point and controlled falling-start variants/,
  )
  assert.ok(cardSpec.alternateAssessments.some((alternate) => (
    alternate.name === 'Long Hill Sprint Conditioning'
      && alternate.classification === 'new_definition'
  )))
  assert.ok(cardSpec.alternateAssessments.some((alternate) => (
    alternate.name === 'Falling-Start Hill Sprint'
      && alternate.classification === 'new_variant'
  )))
  assert.ok(result.packet.mediaCandidates.every((candidate) => (
    candidate.linkStatus === 'unverified'
      && candidate.embeddingAllowed === false
      && candidate.externalVerification === null
      && !Object.hasOwn(candidate, 'reviewStatus')
      && !Object.hasOwn(candidate, 'exactVariantMatch')
      && !Object.hasOwn(candidate, 'reviewerUserId')
      && !Object.hasOwn(candidate, 'reviewedAt')
  )))
  assert.doesNotMatch(
    JSON.stringify(cardSpec),
    /"(?:exerciseSkillLevel|skillLevel|skill_level|minimumSkillLevel|minimum_skill_level|proficiencyLevel|proficiency_level|proficiencyClassification)"/,
  )
})

test('through-legs wall throw packet preserves throw-turn-catch order and quarantines adjacent media', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  const batch = JSON.parse(readFileSync(
    path.join(
      RESEARCH_ROOT,
      'batches/through-legs-wall-throw-180-turn-catch.v1.json',
    ),
    'utf8',
  ))
  const cardSpec = batch.cards[0]
  const result = buildResearchPacketFromBatch({
    facilityId: batch.facilityId,
    researchVersion: batch.researchVersion,
    sharedEvidence: batch.sharedEvidence,
    sourceRegistry: registryDocument.sources,
    cardSpec,
    currentCard: {
      slug: cardSpec.slug,
      canonicalName: 'Through-the-Legs Wall Throw, 180° Turn and Catch',
      familyKey: 'throw_turn_catch_coordination',
      snapshot: {
        capturedAt: batch.snapshotAt,
        cardVersion: 1,
        status: 'review',
      },
    },
    mediaCandidates: [],
  })

  assert.equal(batch.researchVersion, '2026-08-01.2')
  assert.equal(batch.cards.length, 1)
  assert.equal(result.validation.valid, true)
  assert.equal(result.packet.evidence.length, REQUIRED_RESEARCH_SECTIONS.length)
  assert.equal(result.packet.mediaCandidates.length, 3)
  assert.equal(result.packet.alternateAssessments.length, 6)
  assert.equal(
    cardSpec.assessmentSummary.proposedTaxonomy.sequence,
    'throw_to_wall__stand_and_turn_180__reacquire__two_hand_catch',
  )
  assert.deepEqual(cardSpec.assessmentSummary.proposedDifficulty, {
    technicalComplexity: 68,
    absoluteLoadDemand: 30,
    coordinationDemand: 82,
    supervisionDemand: 72,
    failureConsequence: 58,
    impact: 16,
    workCapacityDemand: 24,
    baseOverallDifficulty: 68,
  })
  assert.ok(cardSpec.assessmentSummary.currentCardFindings.some((finding) => (
    /legacy 180-Turn Wall Ball Catch-and-Throw reverses the order/i.test(finding)
  )))
  assert.ok(result.packet.mediaCandidates.every((candidate) => (
    candidate.linkStatus === 'unverified'
      && candidate.embeddingAllowed === false
      && candidate.externalVerification === null
      && !Object.hasOwn(candidate, 'exactVariantMatch')
  )))
  assert.ok(cardSpec.alternateAssessments.some((alternate) => (
    alternate.name === 'Scaled Through-the-Legs Wall Throw, Turn and Catch Rehearsal'
      && alternate.classification === 'new_variant'
      && alternate.distinguishingDimensions.protocol === 'non_standardized_rehearsal'
  )))
})

test('two-hand landmine arc packet separates the false one-arm lineage and preserves only automated embed health', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  const batch = JSON.parse(readFileSync(
    path.join(
      RESEARCH_ROOT,
      'batches/two-hand-landmine-shoulder-to-shoulder-arc-press.v1.json',
    ),
    'utf8',
  ))
  const cardSpec = batch.cards[0]
  const result = buildResearchPacketFromBatch({
    facilityId: batch.facilityId,
    researchVersion: batch.researchVersion,
    sharedEvidence: batch.sharedEvidence,
    sourceRegistry: registryDocument.sources,
    cardSpec,
    currentCard: {
      slug: cardSpec.slug,
      canonicalName: 'Two-Hand Landmine Shoulder-to-Shoulder Arc Press',
      familyKey: 'two_hand_landmine_shoulder_to_shoulder_arc',
      snapshot: {
        capturedAt: batch.snapshotAt,
        cardVersion: 1,
        status: 'review',
      },
    },
    mediaCandidates: [],
  })

  assert.equal(batch.researchVersion, '2026-08-01.3')
  assert.equal(result.validation.valid, true)
  assert.equal(result.packet.evidence.length, REQUIRED_RESEARCH_SECTIONS.length)
  assert.equal(result.packet.mediaCandidates.length, 5)
  assert.equal(result.packet.alternateAssessments.length, 8)
  assert.equal(
    cardSpec.assessmentSummary.proposedTaxonomy.sequence,
    'one_shoulder_rack__up_and_across_arc__opposite_shoulder_rack',
  )
  for (const difficulty of [
    cardSpec.assessmentSummary.proposedDifficulty,
    ...cardSpec.assessmentSummary.variantDifficultyCandidates,
  ]) {
    assert.equal(
      difficulty.baseOverallDifficulty,
      Math.max(difficulty.technicalComplexity, difficulty.absoluteLoadDemand),
    )
  }
  assert.ok(result.packet.mediaCandidates.every((candidate) => (
    candidate.linkStatus === 'healthy'
      && candidate.embeddingAllowed === true
      && candidate.externalVerification?.method === 'youtube_oembed'
      && !Object.hasOwn(candidate, 'exactVariantMatch')
      && !Object.hasOwn(candidate, 'reviewerUserId')
      && !Object.hasOwn(candidate, 'reviewedAt')
  )))
  assert.ok(cardSpec.alternateAssessments.some((alternate) => (
    alternate.name === 'One-Arm Eccentric Landmine Press'
      && alternate.classification === 'modifier_annotation'
      && alternate.distinguishingDimensions.legacyExerciseId === 1414
  )))
  assert.ok(cardSpec.alternateAssessments.some((alternate) => (
    alternate.name === 'Rotational Landmine Rainbow'
      && alternate.classification === 'new_definition'
  )))
  assert.doesNotMatch(
    JSON.stringify(cardSpec),
    /"(?:exerciseSkillLevel|skillLevel|skill_level|minimumSkillLevel|minimum_skill_level|proficiencyLevel|proficiency_level|proficiencyClassification)"/,
  )
})

test('wall-lean single-leg pogo packet retires ambiguous labels and preserves exact contact accounting', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  const batch = JSON.parse(readFileSync(
    path.join(
      RESEARCH_ROOT,
      'batches/wall-lean-single-leg-pogo-variant.v1.json',
    ),
    'utf8',
  ))
  const cardSpec = batch.cards[0]
  const result = buildResearchPacketFromBatch({
    facilityId: batch.facilityId,
    researchVersion: batch.researchVersion,
    sharedEvidence: batch.sharedEvidence,
    sourceRegistry: registryDocument.sources,
    cardSpec,
    currentCard: {
      slug: cardSpec.slug,
      canonicalName: 'Single-Leg Pogo',
      familyKey: 'repeated_unilateral_ankle_dominant_pogo',
      snapshot: {
        capturedAt: batch.snapshotAt,
        cardVersion: 2,
        status: 'review',
      },
    },
    mediaCandidates: [],
  })

  assert.equal(batch.researchVersion, '2026-08-01.4')
  assert.equal(batch.outputDirectory, '../generated/wall-lean-single-leg-pogo-variant')
  assert.equal(result.validation.valid, true)
  assert.equal(result.packet.evidence.length, REQUIRED_RESEARCH_SECTIONS.length)
  assert.equal(result.packet.mediaCandidates.length, 5)
  assert.equal(result.packet.alternateAssessments.length, 9)
  assert.equal(
    cardSpec.assessmentSummary.proposedTaxonomy.sequence,
    'establish_wall_lean__raise_nonworking_thigh__repeat_same_leg_contacts__controlled_reset__change_side',
  )
  assert.equal(
    cardSpec.assessmentSummary.proposedDosage.measurement,
    'count_each_landing_contact_and_record_actual_contacts_per_side_not_round_trips_or_time_alone',
  )
  for (const difficulty of [
    cardSpec.assessmentSummary.proposedDifficulty,
    ...cardSpec.assessmentSummary.variantDifficultyCandidates,
  ]) {
    assert.equal(
      difficulty.baseOverallDifficulty ?? difficulty.derivedOverallDifficulty,
      Math.max(
        difficulty.technicalComplexity ?? difficulty.exerciseComplexity,
        difficulty.absoluteLoadDemand ?? difficulty.physicalDifficulty,
      ),
    )
  }
  assert.ok(result.packet.mediaCandidates.every((candidate) => (
    candidate.linkStatus === 'healthy'
      && candidate.embeddingAllowed === true
      && candidate.externalVerification?.method === 'youtube_oembed'
      && !Object.hasOwn(candidate, 'exactVariantMatch')
      && !Object.hasOwn(candidate, 'reviewerUserId')
      && !Object.hasOwn(candidate, 'reviewedAt')
  )))
  assert.ok(cardSpec.alternateAssessments.some((alternate) => (
    alternate.name === 'Wall-Supported Alternating Stride Pogo'
      && alternate.classification === 'new_definition'
  )))
  assert.ok(cardSpec.alternateAssessments.some((alternate) => (
    alternate.name === 'Contact Count, Cadence, Low Amplitude, Rest, or Starting Side'
      && alternate.classification === 'modifier_annotation'
  )))
  assert.doesNotMatch(
    JSON.stringify(cardSpec),
    /"(?:exerciseSkillLevel|skillLevel|skill_level|minimumSkillLevel|minimum_skill_level|proficiencyLevel|proficiency_level|proficiencyClassification)"/,
  )
})

test('opposite-leg bound packets preserve direction as a hard identity boundary', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  const batch = JSON.parse(readFileSync(
    path.join(
      RESEARCH_ROOT,
      'batches/opposite-leg-bound-stick-direction-family.v1.json',
    ),
    'utf8',
  ))

  assert.equal(batch.researchVersion, '2026-08-01.5')
  assert.equal(
    batch.outputDirectory,
    '../generated/opposite-leg-bound-stick-direction-family',
  )
  assert.equal(batch.cards.length, 2)

  const expected = new Map([
    ['bound-to-stick', {
      canonicalName: 'Bound to Stick',
      direction: 'forward',
      sequence: 'declared_support_leg__forward_flight__opposite_leg_landing__terminal_hold__full_reset',
      difficulty: [56, 64, 64],
    }],
    ['lateral-bound', {
      canonicalName: 'Lateral Bound',
      direction: 'lateral',
      sequence: 'declared_support_leg__lateral_flight__opposite_leg_landing__terminal_hold__full_reset',
      difficulty: [60, 66, 66],
    }],
  ])

  for (const cardSpec of batch.cards) {
    const expectedCard = expected.get(cardSpec.slug)
    const result = buildResearchPacketFromBatch({
      facilityId: batch.facilityId,
      researchVersion: batch.researchVersion,
      sharedEvidence: batch.sharedEvidence,
      sourceRegistry: registryDocument.sources,
      cardSpec,
      currentCard: {
        slug: cardSpec.slug,
        canonicalName: expectedCard.canonicalName,
        familyKey: 'legacy_bound_family',
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
    assert.equal(result.packet.alternateAssessments.length, 9)
    assert.equal(
      cardSpec.assessmentSummary.proposedTaxonomy.sequence,
      expectedCard.sequence,
    )
    assert.equal(
      cardSpec.assessmentSummary.proposedTaxonomy.intent.includes(expectedCard.direction),
      true,
    )
    assert.deepEqual(
      [
        cardSpec.assessmentSummary.proposedDifficulty.technicalComplexity,
        cardSpec.assessmentSummary.proposedDifficulty.absoluteLoadDemand,
        cardSpec.assessmentSummary.proposedDifficulty.baseOverallDifficulty,
      ],
      expectedCard.difficulty,
    )
    assert.ok(cardSpec.assessmentSummary.variantDifficultyCandidates.every((variant) => (
      variant.derivedOverallDifficulty === Math.max(
        variant.exerciseComplexity,
        variant.physicalDifficulty,
      )
    )))
    assert.ok(result.packet.mediaCandidates.every((candidate) => (
      candidate.linkStatus === 'healthy'
        && candidate.embeddingAllowed === true
        && candidate.externalVerification?.method === 'youtube_oembed'
        && !Object.hasOwn(candidate, 'exactVariantMatch')
        && !Object.hasOwn(candidate, 'reviewerUserId')
        && !Object.hasOwn(candidate, 'reviewedAt')
    )))
    assert.ok(cardSpec.alternateAssessments.some((alternate) => (
      alternate.classification === 'new_definition'
        && alternate.distinguishingDimensions.landingSide === 'same_leg'
    )))
    assert.doesNotMatch(
      JSON.stringify(cardSpec),
      /"(?:exerciseSkillLevel|skillLevel|skill_level|minimumSkillLevel|minimum_skill_level|proficiencyLevel|proficiency_level|proficiencyClassification)"/,
    )
  }
})

test('single-leg line-hop packet quarantines the undefined identity and preserves adjacent media only', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  const batch = JSON.parse(readFileSync(
    path.join(
      RESEARCH_ROOT,
      'batches/single-leg-line-hop-identity-quarantine.v1.json',
    ),
    'utf8',
  ))
  const cardSpec = batch.cards[0]
  const result = buildResearchPacketFromBatch({
    facilityId: batch.facilityId,
    researchVersion: batch.researchVersion,
    sharedEvidence: batch.sharedEvidence,
    sourceRegistry: registryDocument.sources,
    cardSpec,
    currentCard: {
      slug: cardSpec.slug,
      canonicalName: 'Single-Leg Line Hop and Stick',
      familyKey: 'Single-Leg Elastic Control',
      snapshot: {
        capturedAt: batch.snapshotAt,
        cardVersion: 1,
        status: 'review',
      },
    },
    mediaCandidates: [],
  })

  assert.equal(batch.researchVersion, '2026-08-01.6')
  assert.equal(result.validation.valid, true)
  assert.equal(result.packet.evidence.length, REQUIRED_RESEARCH_SECTIONS.length)
  assert.equal(result.packet.mediaCandidates.length, 3)
  assert.equal(result.packet.alternateAssessments.length, 7)
  assert.equal(
    Object.hasOwn(cardSpec.assessmentSummary, 'proposedDifficulty'),
    false,
  )
  assert.match(
    cardSpec.assessmentSummary.difficultyDecision,
    /Do not score exercise complexity or physical difficulty/,
  )
  assert.match(
    cardSpec.assessmentSummary.programmingDecision,
    /Archive the canonical and legacy card as nonprescribable/,
  )
  assert.ok(result.packet.mediaCandidates.every((candidate) => (
    candidate.linkStatus === 'healthy'
      && candidate.embeddingAllowed === true
      && candidate.externalVerification?.method === 'youtube_oembed'
      && !Object.hasOwn(candidate, 'exactVariantMatch')
      && !Object.hasOwn(candidate, 'reviewerUserId')
      && !Object.hasOwn(candidate, 'reviewedAt')
  )))
  assert.ok(cardSpec.alternateAssessments.some((alternate) => (
    alternate.name === 'Same-Leg Lateral Line Hop to Stick'
      && alternate.distinguishingDimensions.possibleMapping
        === 'single-leg-lateral-hop-to-stick'
  )))
  assert.ok(cardSpec.alternateAssessments.some((alternate) => (
    alternate.name === 'Single-Leg Line Hop to Reacceleration'
      && alternate.classification === 'new_definition'
  )))
  assert.doesNotMatch(
    JSON.stringify(cardSpec),
    /"(?:exerciseSkillLevel|skillLevel|skill_level|minimumSkillLevel|minimum_skill_level|proficiencyLevel|proficiency_level|proficiencyClassification)"/,
  )
})

test('overhead-press eccentric packets retire the mixed-base source and add explicit full-cycle tempo variants', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  const batch = JSON.parse(readFileSync(
    path.join(
      RESEARCH_ROOT,
      'batches/overhead-press-eccentric-consolidation.v1.json',
    ),
    'utf8',
  ))

  assert.equal(batch.researchVersion, '2026-08-01.7')
  assert.equal(
    batch.outputDirectory,
    '../generated/overhead-press-eccentric-consolidation',
  )
  assert.equal(batch.cards.length, 3)

  const currentCards = new Map([
    ['strict-overhead-press', {
      canonicalName: 'Strict Overhead Press',
      familyKey: 'Vertical push strength',
      cardVersion: 1,
      mediaCount: 5,
      alternateCount: 8,
      active: true,
    }],
    ['seated-barbell-overhead-press', {
      canonicalName: 'Seated Overhead Press',
      familyKey: 'seated_bilateral_strict_overhead_press',
      cardVersion: 2,
      mediaCount: 5,
      alternateCount: 8,
      active: true,
    }],
    ['dumbbell-overhead-press-eccentric', {
      canonicalName: 'Dumbbell Overhead Press Eccentric',
      familyKey: 'Loaded vertical press negative',
      cardVersion: 1,
      mediaCount: 3,
      alternateCount: 7,
      active: false,
    }],
  ])

  for (const cardSpec of batch.cards) {
    const expected = currentCards.get(cardSpec.slug)
    const result = buildResearchPacketFromBatch({
      facilityId: batch.facilityId,
      researchVersion: batch.researchVersion,
      sharedEvidence: batch.sharedEvidence,
      sourceRegistry: registryDocument.sources,
      cardSpec,
      currentCard: {
        slug: cardSpec.slug,
        canonicalName: expected.canonicalName,
        familyKey: expected.familyKey,
        snapshot: {
          capturedAt: batch.snapshotAt,
          cardVersion: expected.cardVersion,
          status: 'review',
        },
      },
      mediaCandidates: [],
    })

    assert.equal(result.validation.valid, true)
    assert.equal(result.packet.evidence.length, REQUIRED_RESEARCH_SECTIONS.length)
    assert.equal(result.packet.mediaCandidates.length, expected.mediaCount)
    assert.equal(result.packet.alternateAssessments.length, expected.alternateCount)
    assert.ok(result.packet.mediaCandidates.every((candidate) => (
      candidate.linkStatus === 'healthy'
        && candidate.embeddingAllowed === true
        && candidate.externalVerification?.method === 'youtube_oembed'
        && !Object.hasOwn(candidate, 'exactVariantMatch')
        && !Object.hasOwn(candidate, 'reviewerUserId')
        && !Object.hasOwn(candidate, 'reviewedAt')
    )))
    assert.doesNotMatch(
      JSON.stringify(cardSpec),
      /"(?:exerciseSkillLevel|skillLevel|skill_level|minimumSkillLevel|minimum_skill_level|proficiencyLevel|proficiency_level|proficiencyClassification)"/,
    )

    if (expected.active) {
      const proposed = cardSpec.assessmentSummary.proposedDifficulty
      assert.equal(
        proposed.baseOverallDifficulty,
        Math.max(proposed.technicalComplexity, proposed.absoluteLoadDemand),
      )
      assert.ok(cardSpec.assessmentSummary.proposedVariantPlan.every((variant) => (
        variant.overallDifficulty === Math.max(
          variant.exerciseComplexity,
          variant.physicalDifficulty,
        )
      )))
      assert.ok(cardSpec.assessmentSummary.proposedVariantPlan.some((variant) => (
        variant.variantKey.endsWith('eccentric-4-6')
      )))
    } else {
      assert.equal(
        Object.hasOwn(cardSpec.assessmentSummary, 'proposedDifficulty'),
        false,
      )
      assert.match(
        cardSpec.assessmentSummary.difficultyDecision,
        /Do not score exercise complexity or physical difficulty/,
      )
      assert.equal(
        cardSpec.assessmentSummary.identityDecision.resolution,
        'retire_ambiguous_source_without_direct_consolidation',
      )
    }
  }
})

test('standing kettlebell strict-press packets separate the exact standing variant from mixed-base legacy lineage', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  const batch = JSON.parse(readFileSync(
    path.join(
      RESEARCH_ROOT,
      'batches/standing-kettlebell-strict-press-identity.v1.json',
    ),
    'utf8',
  ))

  assert.equal(batch.researchVersion, '2026-08-01.8')
  assert.equal(
    batch.outputDirectory,
    '../generated/standing-kettlebell-strict-press-identity',
  )
  assert.equal(batch.cards.length, 2)

  const expectedCards = new Map([
    ['strict-overhead-press', {
      canonicalName: 'Standing Strict Overhead Press',
      familyKey: 'standing_bilateral_strict_free_weight_overhead_press',
      cardVersion: 2,
      mediaCount: 5,
      alternateCount: 8,
      active: true,
    }],
    ['kettlebell-strict-press', {
      canonicalName: 'Kettlebell Strict Press',
      familyKey: 'Vertical push strength',
      cardVersion: 1,
      mediaCount: 3,
      alternateCount: 7,
      active: false,
    }],
  ])

  for (const cardSpec of batch.cards) {
    const expected = expectedCards.get(cardSpec.slug)
    const result = buildResearchPacketFromBatch({
      facilityId: batch.facilityId,
      researchVersion: batch.researchVersion,
      sharedEvidence: batch.sharedEvidence,
      sourceRegistry: registryDocument.sources,
      cardSpec,
      currentCard: {
        slug: cardSpec.slug,
        canonicalName: expected.canonicalName,
        familyKey: expected.familyKey,
        snapshot: {
          capturedAt: batch.snapshotAt,
          cardVersion: expected.cardVersion,
          status: 'review',
        },
      },
      mediaCandidates: [],
    })

    assert.equal(result.validation.valid, true)
    assert.equal(result.packet.evidence.length, REQUIRED_RESEARCH_SECTIONS.length)
    assert.equal(result.packet.mediaCandidates.length, expected.mediaCount)
    assert.equal(result.packet.alternateAssessments.length, expected.alternateCount)
    assert.ok(result.packet.mediaCandidates.every((candidate) => (
      candidate.linkStatus === 'healthy'
        && candidate.embeddingAllowed === true
        && candidate.externalVerification?.method === 'youtube_oembed'
        && !Object.hasOwn(candidate, 'exactVariantMatch')
        && !Object.hasOwn(candidate, 'reviewerUserId')
        && !Object.hasOwn(candidate, 'reviewedAt')
    )))
    assert.doesNotMatch(
      JSON.stringify(cardSpec),
      /"(?:exerciseSkillLevel|skillLevel|skill_level|minimumSkillLevel|minimum_skill_level|proficiencyLevel|proficiency_level|proficiencyClassification)"/,
    )

    if (expected.active) {
      const proposed = cardSpec.assessmentSummary.proposedDifficulty
      assert.equal(
        proposed.baseOverallDifficulty,
        Math.max(proposed.technicalComplexity, proposed.absoluteLoadDemand),
      )
      assert.deepEqual(
        cardSpec.assessmentSummary.proposedVariantPlan,
        [{
          variantKey: 'double-kettlebell-standing-neutral-rack',
          exerciseComplexity: 62,
          physicalDifficulty: 60,
          overallDifficulty: 62,
        }],
      )
    } else {
      assert.equal(
        Object.hasOwn(cardSpec.assessmentSummary, 'proposedDifficulty'),
        false,
      )
      assert.match(
        cardSpec.assessmentSummary.difficultyDecision,
        /Do not score exercise complexity or physical difficulty/,
      )
      assert.equal(
        cardSpec.assessmentSummary.identityDecision.resolution,
        'retire_ambiguous_source_without_direct_consolidation',
      )
    }
  }
})

test('line-pogo packets complete exact directions and quarantine ambiguous source labels', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  const batch = JSON.parse(readFileSync(
    path.join(
      RESEARCH_ROOT,
      'batches/line-pogo-identity-completion.v1.json',
    ),
    'utf8',
  ))

  assert.equal(batch.researchVersion, '2026-08-01.9')
  assert.equal(
    batch.outputDirectory,
    '../generated/line-pogo-identity-completion',
  )
  assert.equal(batch.cards.length, 5)

  const expectedCards = new Map([
    ['lateral-line-pogo', {
      canonicalName: 'Lateral Line Pogo',
      familyKey: 'bilateral_directional_line_pogo',
      mediaCount: 5,
      alternateCount: 8,
      active: true,
      variantKey: 'two-foot-side-to-side-low-amplitude',
      complexity: 44,
    }],
    ['line-pogo-forward-back', {
      canonicalName: 'Forward-Backward Line Pogo',
      familyKey: 'bilateral_directional_line_pogo',
      mediaCount: 5,
      alternateCount: 8,
      active: true,
      variantKey: 'two-foot-forward-back-low-amplitude',
      complexity: 46,
    }],
    ['line-pogo-hops', {
      canonicalName: 'Line Pogo Hops',
      familyKey: 'unresolved_line_hop_identity_quarantine',
      mediaCount: 3,
      alternateCount: 7,
      active: false,
    }],
    ['line-hops', {
      canonicalName: 'Line Hops',
      familyKey: 'unresolved_line_hop_identity_quarantine',
      mediaCount: 3,
      alternateCount: 7,
      active: false,
    }],
    ['forward-back-line-hops', {
      canonicalName: 'Forward-Back Line Hops',
      familyKey: 'unresolved_line_hop_identity_quarantine',
      mediaCount: 3,
      alternateCount: 7,
      active: false,
    }],
  ])

  for (const cardSpec of batch.cards) {
    const expected = expectedCards.get(cardSpec.slug)
    const result = buildResearchPacketFromBatch({
      facilityId: batch.facilityId,
      researchVersion: batch.researchVersion,
      sharedEvidence: batch.sharedEvidence,
      sourceRegistry: registryDocument.sources,
      cardSpec,
      currentCard: {
        slug: cardSpec.slug,
        canonicalName: expected.canonicalName,
        familyKey: expected.familyKey,
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
    assert.equal(result.packet.mediaCandidates.length, expected.mediaCount)
    assert.equal(result.packet.alternateAssessments.length, expected.alternateCount)
    assert.ok(result.packet.mediaCandidates.every((candidate) => (
      candidate.linkStatus === 'healthy'
        && candidate.embeddingAllowed === true
        && candidate.externalVerification?.method === 'youtube_oembed'
        && !Object.hasOwn(candidate, 'exactVariantMatch')
        && !Object.hasOwn(candidate, 'reviewerUserId')
        && !Object.hasOwn(candidate, 'reviewedAt')
    )))
    assert.doesNotMatch(
      JSON.stringify(cardSpec),
      /"(?:exerciseSkillLevel|skillLevel|skill_level|minimumSkillLevel|minimum_skill_level|proficiencyLevel|proficiency_level|proficiencyClassification)"/,
    )

    if (expected.active) {
      const proposed = cardSpec.assessmentSummary.proposedDifficulty
      assert.equal(proposed.absoluteLoadDemand, 48)
      assert.equal(
        proposed.baseOverallDifficulty,
        Math.max(proposed.technicalComplexity, proposed.absoluteLoadDemand),
      )
      assert.deepEqual(
        cardSpec.assessmentSummary.proposedVariantPlan,
        [{
          variantKey: expected.variantKey,
          exerciseComplexity: expected.complexity,
          physicalDifficulty: 48,
          overallDifficulty: 48,
        }],
      )
    } else {
      assert.equal(
        Object.hasOwn(cardSpec.assessmentSummary, 'proposedDifficulty'),
        false,
      )
      assert.match(
        cardSpec.assessmentSummary.difficultyDecision,
        /Do not score/,
      )
      assert.equal(
        cardSpec.assessmentSummary.identityDecision.resolution,
        'retire_ambiguous_source_without_direct_consolidation',
      )
    }
  }
})

test('quarter-turn packets separate exact foot contracts and retire ambiguous source labels', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  const batch = JSON.parse(readFileSync(
    path.join(
      RESEARCH_ROOT,
      'batches/quarter-turn-jump-hop-identity.v1.json',
    ),
    'utf8',
  ))

  assert.equal(batch.researchVersion, '2026-08-01.10')
  assert.equal(batch.includeArchived, true)
  assert.match(
    RESEARCH_BATCH_BUILDER_SOURCE,
    /definition\.status!='archived' OR \$3::boolean/,
  )
  assert.equal(
    batch.outputDirectory,
    '../generated/quarter-turn-jump-hop-identity',
  )
  assert.equal(batch.cards.length, 4)

  const expectedCards = new Map([
    ['two-foot-quarter-turn-jump-to-stick', {
      canonicalName: 'Two-Foot Quarter-Turn Jump to Stick',
      familyKey: 'quarter_turn_jump_landing_control',
      mediaCount: 5,
      alternateCount: 8,
      active: true,
      variantKey: 'stationary-two-foot-quarter-turn-two-foot-stick',
      complexity: 58,
      physical: 56,
      overall: 58,
    }],
    ['single-leg-quarter-turn-hop-to-stick', {
      canonicalName: 'Single-Leg Quarter-Turn Hop to Stick',
      familyKey: 'quarter_turn_hop_landing_control',
      mediaCount: 5,
      alternateCount: 8,
      active: true,
      variantKey: 'stationary-same-leg-quarter-turn-stick',
      complexity: 68,
      physical: 64,
      overall: 68,
    }],
    ['90-degree-hop-to-stick', {
      canonicalName: '90-Degree Hop to Stick',
      familyKey: 'unresolved_quarter_turn_jump_hop_identity',
      mediaCount: 3,
      alternateCount: 7,
      active: false,
    }],
    ['90-degree-jump-turn-to-stick', {
      canonicalName: '90-Degree Jump Turn to Stick',
      familyKey: 'unresolved_quarter_turn_jump_hop_identity',
      mediaCount: 3,
      alternateCount: 7,
      active: false,
    }],
  ])

  for (const cardSpec of batch.cards) {
    const expected = expectedCards.get(cardSpec.slug)
    const result = buildResearchPacketFromBatch({
      facilityId: batch.facilityId,
      researchVersion: batch.researchVersion,
      sharedEvidence: batch.sharedEvidence,
      sourceRegistry: registryDocument.sources,
      cardSpec,
      currentCard: {
        slug: cardSpec.slug,
        canonicalName: expected.canonicalName,
        familyKey: expected.familyKey,
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
    assert.equal(result.packet.mediaCandidates.length, expected.mediaCount)
    assert.equal(result.packet.alternateAssessments.length, expected.alternateCount)
    assert.ok(result.packet.mediaCandidates.every((candidate) => (
      candidate.linkStatus === 'healthy'
        && candidate.embeddingAllowed === true
        && candidate.externalVerification?.method === 'youtube_oembed'
        && !Object.hasOwn(candidate, 'exactVariantMatch')
        && !Object.hasOwn(candidate, 'reviewerUserId')
        && !Object.hasOwn(candidate, 'reviewedAt')
    )))
    assert.doesNotMatch(
      JSON.stringify(cardSpec),
      /"(?:exerciseSkillLevel|skillLevel|skill_level|minimumSkillLevel|minimum_skill_level|proficiencyLevel|proficiency_level|proficiencyClassification)"/,
    )

    if (expected.active) {
      const proposed = cardSpec.assessmentSummary.proposedDifficulty
      assert.equal(
        proposed.baseOverallDifficulty,
        Math.max(proposed.technicalComplexity, proposed.absoluteLoadDemand),
      )
      assert.deepEqual(
        cardSpec.assessmentSummary.proposedVariantPlan,
        [{
          variantKey: expected.variantKey,
          exerciseComplexity: expected.complexity,
          physicalDifficulty: expected.physical,
          overallDifficulty: expected.overall,
        }],
      )
    } else {
      assert.equal(
        Object.hasOwn(cardSpec.assessmentSummary, 'proposedDifficulty'),
        false,
      )
      assert.match(
        cardSpec.assessmentSummary.difficultyDecision,
        /Do not/,
      )
      assert.equal(
        cardSpec.assessmentSummary.identityDecision.resolution,
        'retire_ambiguous_source_without_direct_consolidation',
      )
    }
  }
})

test('scoop-toss packets preserve forward and rotational identities and quarantine the vague source', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  const batch = JSON.parse(readFileSync(
    path.join(
      RESEARCH_ROOT,
      'batches/scoop-toss-forward-rotational-identity.v1.json',
    ),
    'utf8',
  ))

  assert.equal(batch.researchVersion, '2026-08-01.11')
  assert.equal(batch.includeArchived, true)
  assert.equal(
    batch.outputDirectory,
    '../generated/scoop-toss-forward-rotational-identity',
  )
  assert.equal(batch.cards.length, 3)

  const expectedCards = new Map([
    ['medicine-ball-scoop-toss', {
      canonicalName: 'Forward Medicine Ball Scoop Toss',
      familyKey: 'forward_medicine_ball_scoop_projection',
      mediaCount: 5,
      alternateCount: 8,
      active: true,
      variantKey: 'standing-two-hand-forward-free-flight-scoop-toss',
      complexity: 50,
      physical: 32,
      overall: 50,
      resolution: 'retain_and_complete_exact_forward_scoop_definition',
    }],
    ['medicine-ball-rotational-throw', {
      canonicalName: 'Medicine Ball Rotational Throw',
      familyKey: 'standing_medicine_ball_rotational_wall_projection',
      mediaCount: 5,
      alternateCount: 8,
      active: true,
      variantKey: 'static-side-on-two-hand-rotational-scoop-throw-only',
      complexity: 58,
      physical: 34,
      overall: 58,
      resolution: 'add_controlled_scoop_release_variant_to_existing_rotational_throw',
    }],
    ['countermovement-medicine-ball-scoop-toss', {
      canonicalName: 'Countermovement Medicine Ball Scoop Toss',
      familyKey: 'unresolved_scoop_toss_direction_and_release',
      mediaCount: 3,
      alternateCount: 7,
      active: false,
      resolution: 'retire_ambiguous_source_without_direct_consolidation',
    }],
  ])

  for (const cardSpec of batch.cards) {
    const expected = expectedCards.get(cardSpec.slug)
    const result = buildResearchPacketFromBatch({
      facilityId: batch.facilityId,
      researchVersion: batch.researchVersion,
      sharedEvidence: batch.sharedEvidence,
      sourceRegistry: registryDocument.sources,
      cardSpec,
      currentCard: {
        slug: cardSpec.slug,
        canonicalName: expected.canonicalName,
        familyKey: expected.familyKey,
        snapshot: {
          capturedAt: batch.snapshotAt,
          cardVersion: 2,
          status: expected.active ? 'review' : 'archived',
        },
      },
      mediaCandidates: [],
    })

    assert.equal(result.validation.valid, true)
    assert.equal(result.packet.evidence.length, REQUIRED_RESEARCH_SECTIONS.length)
    assert.equal(result.packet.mediaCandidates.length, expected.mediaCount)
    assert.equal(result.packet.alternateAssessments.length, expected.alternateCount)
    assert.ok(result.packet.mediaCandidates.every((candidate) => (
      candidate.linkStatus === 'healthy'
        && candidate.embeddingAllowed === true
        && candidate.externalVerification?.method === 'youtube_oembed'
        && !Object.hasOwn(candidate, 'exactVariantMatch')
        && !Object.hasOwn(candidate, 'demonstrationQualityScore')
        && !Object.hasOwn(candidate, 'reviewerUserId')
        && !Object.hasOwn(candidate, 'reviewedAt')
    )))
    assert.equal(
      cardSpec.assessmentSummary.identityDecision.resolution,
      expected.resolution,
    )
    assert.doesNotMatch(
      JSON.stringify(cardSpec),
      /"(?:exerciseSkillLevel|skillLevel|skill_level|minimumSkillLevel|minimum_skill_level|proficiencyLevel|proficiency_level|proficiencyClassification)"/,
    )

    if (expected.active) {
      const proposed = cardSpec.assessmentSummary.proposedDifficulty
      assert.equal(proposed.technicalComplexity, expected.complexity)
      assert.equal(proposed.absoluteLoadDemand, expected.physical)
      assert.equal(
        proposed.baseOverallDifficulty,
        Math.max(proposed.technicalComplexity, proposed.absoluteLoadDemand),
      )
      assert.deepEqual(
        cardSpec.assessmentSummary.proposedVariantPlan,
        [{
          variantKey: expected.variantKey,
          exerciseComplexity: expected.complexity,
          physicalDifficulty: expected.physical,
          overallDifficulty: expected.overall,
        }],
      )
    } else {
      assert.equal(
        Object.hasOwn(cardSpec.assessmentSummary, 'proposedDifficulty'),
        false,
      )
      assert.match(cardSpec.assessmentSummary.difficultyDecision, /Do not score/)
      assert.equal(cardSpec.assessmentSummary.identityDecision.humanReviewRequired, true)
    }
  }
})

test('lateral low-hurdle packets separate bilateral and same-leg cards and quarantine the vague source', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  const batch = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'batches/lateral-low-hurdle-stick-identity.v1.json'),
    'utf8',
  ))
  const expectedCards = new Map([
    ['bilateral-lateral-low-hurdle-jump-to-stick', {
      canonicalName: 'Bilateral Lateral Low-Hurdle Jump to Stick',
      familyKey: 'bilateral_lateral_low_hurdle_clearance_to_terminal_stick',
      cardVersion: 1,
      mediaCount: 5,
      alternateCount: 9,
      active: true,
      variantKey: 'stationary-two-foot-single-lateral-low-hurdle-clearance-to-two-foot-stick',
      complexity: 48,
      physical: 44,
      overall: 48,
      resolution: 'author_exact_bilateral_low_hurdle_definition_without_source_mapping',
    }],
    ['single-leg-lateral-low-hurdle-hop-to-stick', {
      canonicalName: 'Single-Leg Lateral Low-Hurdle Hop to Stick',
      familyKey: 'ipsilateral_single_leg_lateral_low_hurdle_clearance_to_terminal_stick',
      cardVersion: 1,
      mediaCount: 5,
      alternateCount: 9,
      active: true,
      variantKey: 'stationary-same-leg-single-lateral-low-hurdle-clearance-to-same-leg-stick',
      complexity: 60,
      physical: 52,
      overall: 60,
      resolution: 'author_exact_same_leg_low_hurdle_definition_without_source_mapping',
    }],
    ['low-hurdle-lateral-hop-to-stick', {
      canonicalName: 'Low-Hurdle Lateral Hop to Stick (Unresolved Legacy)',
      familyKey: 'unresolved_lateral_low_hurdle_support_and_landing_identity',
      cardVersion: 2,
      mediaCount: 3,
      alternateCount: 7,
      active: false,
      resolution: 'retire_ambiguous_source_without_direct_consolidation',
    }],
  ])

  for (const cardSpec of batch.cards) {
    const expected = expectedCards.get(cardSpec.slug)
    const result = buildResearchPacketFromBatch({
      facilityId: batch.facilityId,
      researchVersion: batch.researchVersion,
      sharedEvidence: batch.sharedEvidence,
      sourceRegistry: registryDocument.sources,
      cardSpec,
      currentCard: {
        slug: cardSpec.slug,
        canonicalName: expected.canonicalName,
        familyKey: expected.familyKey,
        snapshot: {
          capturedAt: batch.snapshotAt,
          cardVersion: expected.cardVersion,
          status: expected.active ? 'review' : 'archived',
        },
      },
      mediaCandidates: [],
    })

    assert.equal(result.validation.valid, true)
    assert.equal(result.packet.evidence.length, REQUIRED_RESEARCH_SECTIONS.length)
    assert.equal(result.packet.mediaCandidates.length, expected.mediaCount)
    assert.equal(result.packet.alternateAssessments.length, expected.alternateCount)
    assert.ok(result.packet.mediaCandidates.every((candidate) => (
      candidate.linkStatus === 'healthy'
        && candidate.embeddingAllowed === true
        && candidate.externalVerification?.method === 'youtube_oembed'
        && !Object.hasOwn(candidate, 'exactVariantMatch')
        && !Object.hasOwn(candidate, 'demonstrationQualityScore')
        && !Object.hasOwn(candidate, 'reviewerUserId')
        && !Object.hasOwn(candidate, 'reviewedAt')
    )))
    assert.equal(
      cardSpec.assessmentSummary.identityDecision.resolution,
      expected.resolution,
    )
    assert.doesNotMatch(
      JSON.stringify(cardSpec),
      /"(?:exerciseSkillLevel|skillLevel|skill_level|minimumSkillLevel|minimum_skill_level|proficiencyLevel|proficiency_level|proficiencyClassification)"/,
    )

    if (expected.active) {
      const proposed = cardSpec.assessmentSummary.proposedDifficulty
      assert.equal(proposed.technicalComplexity, expected.complexity)
      assert.equal(proposed.absoluteLoadDemand, expected.physical)
      assert.equal(
        proposed.baseOverallDifficulty,
        Math.max(proposed.technicalComplexity, proposed.absoluteLoadDemand),
      )
      assert.deepEqual(
        cardSpec.assessmentSummary.proposedVariantPlan,
        [{
          variantKey: expected.variantKey,
          exerciseComplexity: expected.complexity,
          physicalDifficulty: expected.physical,
          overallDifficulty: expected.overall,
        }],
      )
    } else {
      assert.equal(
        Object.hasOwn(cardSpec.assessmentSummary, 'proposedDifficulty'),
        false,
      )
      assert.match(cardSpec.assessmentSummary.difficultyDecision, /Do not score/)
      assert.equal(cardSpec.assessmentSummary.identityDecision.humanReviewRequired, true)
    }
  }
})

test('rotational bound and broad-jump packets preserve exact support contracts and quarantine both vague sources', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  const batch = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'batches/rotational-bound-broad-identity.v1.json'),
    'utf8',
  ))
  assert.equal(batch.researchVersion, '2026-08-02.13')
  assert.equal(batch.includeArchived, true)
  assert.equal(
    batch.outputDirectory,
    '../generated/rotational-bound-broad-identity',
  )
  assert.equal(batch.cards.length, 4)

  const expectedCards = new Map([
    ['opposite-leg-90-degree-rotational-bound-to-stick', {
      canonicalName: 'Opposite-Leg 90-Degree Rotational Bound to Stick',
      familyKey: 'opposite_leg_forward_diagonal_quarter_turn_bound_to_terminal_stick',
      cardVersion: 1,
      mediaCount: 5,
      alternateCount: 9,
      active: true,
      variantKey: 'stationary-opposite-leg-forward-diagonal-bound-90-degree-whole-body-turn-to-stick',
      complexity: 68,
      physical: 66,
      overall: 68,
      resolution: 'author_exact_opposite_leg_rotational_bound_without_source_mapping',
    }],
    ['bilateral-90-degree-rotational-broad-jump-to-stick', {
      canonicalName: 'Bilateral 90-Degree Rotational Broad Jump to Stick',
      familyKey: 'bilateral_forward_diagonal_quarter_turn_broad_jump_to_terminal_stick',
      cardVersion: 1,
      mediaCount: 5,
      alternateCount: 9,
      active: true,
      variantKey: 'stationary-bilateral-forward-diagonal-broad-jump-90-degree-whole-body-turn-to-bilateral-stick',
      complexity: 64,
      physical: 60,
      overall: 64,
      resolution: 'author_exact_bilateral_rotational_broad_jump_without_source_mapping',
    }],
    ['rotational-bound-to-stick', {
      canonicalName: 'Rotational Bound to Stick (Unresolved Legacy)',
      familyKey: 'unresolved_rotational_bound_support_angle_contact_identity',
      cardVersion: 2,
      mediaCount: 3,
      alternateCount: 7,
      active: false,
      resolution: 'retire_ambiguous_source_without_direct_consolidation',
    }],
    ['rotational-broad-jump-to-stick', {
      canonicalName: 'Rotational Broad Jump to Stick (Unresolved Legacy)',
      familyKey: 'unresolved_rotational_broad_jump_support_angle_contact_identity',
      cardVersion: 2,
      mediaCount: 3,
      alternateCount: 7,
      active: false,
      resolution: 'retire_ambiguous_source_without_direct_consolidation',
    }],
  ])

  for (const cardSpec of batch.cards) {
    const expected = expectedCards.get(cardSpec.slug)
    const result = buildResearchPacketFromBatch({
      facilityId: batch.facilityId,
      researchVersion: batch.researchVersion,
      sharedEvidence: batch.sharedEvidence,
      sourceRegistry: registryDocument.sources,
      cardSpec,
      currentCard: {
        slug: cardSpec.slug,
        canonicalName: expected.canonicalName,
        familyKey: expected.familyKey,
        snapshot: {
          capturedAt: batch.snapshotAt,
          cardVersion: expected.cardVersion,
          status: expected.active ? 'review' : 'archived',
        },
      },
      mediaCandidates: [],
    })

    assert.equal(result.validation.valid, true)
    assert.equal(result.packet.evidence.length, REQUIRED_RESEARCH_SECTIONS.length)
    assert.equal(result.packet.mediaCandidates.length, expected.mediaCount)
    assert.equal(result.packet.alternateAssessments.length, expected.alternateCount)
    assert.ok(result.packet.mediaCandidates.every((candidate) => (
      candidate.linkStatus === 'healthy'
        && candidate.embeddingAllowed === true
        && candidate.externalVerification?.method === 'youtube_oembed'
        && !Object.hasOwn(candidate, 'exactVariantMatch')
        && !Object.hasOwn(candidate, 'demonstrationQualityScore')
        && !Object.hasOwn(candidate, 'reviewerUserId')
        && !Object.hasOwn(candidate, 'reviewedAt')
    )))
    assert.equal(
      cardSpec.assessmentSummary.identityDecision.resolution,
      expected.resolution,
    )
    assert.doesNotMatch(
      JSON.stringify(cardSpec),
      /"(?:exerciseSkillLevel|skillLevel|skill_level|minimumSkillLevel|minimum_skill_level|proficiencyLevel|proficiency_level|proficiencyClassification)"/,
    )

    if (expected.active) {
      const proposed = cardSpec.assessmentSummary.proposedDifficulty
      assert.equal(proposed.technicalComplexity, expected.complexity)
      assert.equal(proposed.absoluteLoadDemand, expected.physical)
      assert.equal(
        proposed.baseOverallDifficulty,
        Math.max(proposed.technicalComplexity, proposed.absoluteLoadDemand),
      )
      assert.deepEqual(
        cardSpec.assessmentSummary.proposedVariantPlan,
        [{
          variantKey: expected.variantKey,
          exerciseComplexity: expected.complexity,
          physicalDifficulty: expected.physical,
          overallDifficulty: expected.overall,
        }],
      )
    } else {
      assert.equal(
        Object.hasOwn(cardSpec.assessmentSummary, 'proposedDifficulty'),
        false,
      )
      assert.match(cardSpec.assessmentSummary.difficultyDecision, /Do not score/)
      assert.equal(cardSpec.assessmentSummary.identityDecision.humanReviewRequired, true)
    }
  }
})

test('Cossack audit sources distinguish direct technique from adjacent biomechanics', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  assert.equal(registryDocument.registryVersion, '2026-08-02.84')

  const wideStance = registryDocument.sources.wide_stance_foot_angle_squat_biomechanics
  assert.equal(wideStance.url, 'https://pubmed.ncbi.nlm.nih.gov/30026952/')
  assert.equal(wideStance.kind, 'peer_reviewed_research')
  assert.match(wideStance.title, /stance widths, foot placement angles/i)

  const directTechnique = registryDocument.sources.monash_cossack_squat_technique
  assert.equal(
    directTechnique.url,
    'https://www.monash.edu/__data/assets/pdf_file/0020/2534141/Cossack-Squat.pdf',
  )
  assert.equal(directTechnique.publisher, 'Monash University')
  assert.equal(directTechnique.kind, 'professional_standard')

  for (const source of [wideStance, directTechnique]) {
    assert.ok(source.evidenceQuality >= 1 && source.evidenceQuality <= 100)
  }
})

test('Floor Press sources separate direct technique, floor-specific testing, and adjacent bench evidence', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  assert.equal(registryDocument.registryVersion, '2026-08-02.84')

  const floorTest = registryDocument.sources.isometric_floor_press_validity
  assert.equal(floorTest.url, 'https://pubmed.ncbi.nlm.nih.gov/42367017/')
  assert.match(floorTest.title, /Isometric Floor Press/i)
  assert.equal(floorTest.kind, 'peer_reviewed_research')

  const range = registryDocument.sources.bench_press_range_sticking_region
  const excitation = registryDocument.sources.bench_press_range_muscle_excitation
  const grip = registryDocument.sources.bench_press_grip_width_emg
  for (const source of [range, excitation, grip]) {
    assert.equal(source.kind, 'peer_reviewed_research')
    assert.ok(source.evidenceQuality >= 80)
  }

  const nasm = registryDocument.sources.nasm_kettlebell_floor_press_technique
  const barbend = registryDocument.sources.barbend_floor_press_technique
  assert.equal(nasm.publisher, 'National Academy of Sports Medicine')
  assert.equal(nasm.kind, 'expert_instruction')
  assert.equal(barbend.url, 'https://barbend.com/floor-press/')
  assert.equal(barbend.kind, 'expert_instruction')
})

test('Rotational Ball Slam sources separate direct technique from adjacent power evidence', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  assert.equal(registryDocument.registryVersion, '2026-08-02.84')

  const ace = registryDocument.sources.ace_rotational_slam
  assert.equal(
    ace.url,
    'https://www.acefitness.org/resources/everyone/exercise-library/287/rotational-slam/',
  )
  assert.equal(ace.kind, 'expert_instruction')

  const army = registryDocument.sources.army_h2f_rainbow_slam_technique
  assert.match(army.url, /ATP%207-22\.02%20AT%20Training\.pdf$/)
  assert.equal(army.publisher, 'United States Army')
  assert.equal(army.kind, 'professional_standard')

  const validity = registryDocument.sources.medicine_ball_rotational_power_validity
  const trunk = registryDocument.sources.trunk_rotator_strength_rotational_throw
  const meta = registryDocument.sources.upper_body_plyometric_meta_analysis
  for (const source of [validity, trunk, meta]) {
    assert.equal(source.kind, 'peer_reviewed_research')
    assert.ok(source.evidenceQuality >= 80)
  }
})

test('One-Arm Row sources separate exact variant technique from adjacent row biomechanics', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  assert.equal(registryDocument.registryVersion, '2026-08-02.84')

  const ace = registryDocument.sources.ace_single_arm_row_technique
  assert.equal(
    ace.url,
    'https://www.acefitness.org/resources/everyone/exercise-library/126/single-arm-row/',
  )
  assert.equal(ace.kind, 'expert_instruction')

  const nsca = registryDocument.sources.nsca_single_arm_bent_over_row_technique
  assert.equal(nsca.publisher, 'National Strength and Conditioning Association')
  assert.equal(nsca.kind, 'professional_standard')

  const landmine = registryDocument.sources.nsca_landmine_row_technique
  assert.equal(landmine.url, 'https://doi.org/10.1519/SSC.0000000000000751')
  assert.equal(landmine.kind, 'peer_reviewed_research')

  const kettlebell = registryDocument.sources.ace_bent_over_kettlebell_row
  const suitcase = registryDocument.sources.onnit_landmine_suitcase_row
  assert.equal(kettlebell.kind, 'expert_instruction')
  assert.equal(suitcase.kind, 'expert_instruction')

  const adjacent = registryDocument.sources.row_variation_trunk_spine_load
  assert.equal(adjacent.url, 'https://pubmed.ncbi.nlm.nih.gov/19620925/')
  assert.equal(adjacent.kind, 'peer_reviewed_research')
  assert.ok(adjacent.evidenceQuality >= 80)
})

test('Push-Up sources replace the unrelated calf-raise PMID with direct variant evidence', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  assert.equal(registryDocument.registryVersion, '2026-08-02.84')

  const technique = registryDocument.sources.nasm_push_up_technique
  assert.equal(
    technique.url,
    'https://www.nasm.org/resource-center/exercise-library/push-up',
  )
  assert.equal(technique.kind, 'expert_instruction')

  const systematic = registryDocument.sources.pushup_kinetics_systematic_review
  assert.equal(systematic.url, 'https://pubmed.ncbi.nlm.nih.gov/30284496/')
  assert.match(systematic.title, /systematic review/i)
  assert.equal(systematic.kind, 'peer_reviewed_research')

  const elevation = registryDocument.sources.pushup_elevation_kinetics
  assert.equal(elevation.url, 'https://pubmed.ncbi.nlm.nih.gov/21873902/')
  assert.match(elevation.title, /variations of push-ups/i)

  const suspension = registryDocument.sources.pushup_suspension_torso_activation
  const instability = registryDocument.sources.pushup_stable_unstable_activation
  const handPosition = registryDocument.sources.pushup_hand_position_activation
  for (const source of [systematic, elevation, suspension, instability, handPosition]) {
    assert.equal(source.kind, 'peer_reviewed_research')
    assert.ok(source.evidenceQuality >= 80)
  }

  assert.notEqual(
    elevation.url,
    'https://pubmed.ncbi.nlm.nih.gov/38156065/',
    'PMID 38156065 is calf-raise evidence, not Push-Up evidence',
  )
})

test('Reverse Lunge evidence separates direct reverse-step kinetics from adjacent lunge loading studies', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  assert.equal(registryDocument.registryVersion, '2026-08-02.84')

  const direct = registryDocument.sources.reverse_lunge_joint_kinetics
  assert.equal(direct.url, 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4641539/')
  assert.match(direct.title, /Joint Kinetics and Kinematics/i)
  assert.equal(direct.kind, 'peer_reviewed_research')
  assert.ok(direct.evidenceQuality >= 85)

  const loading = registryDocument.sources.lunge_loading_device_activation
  const distribution = registryDocument.sources.lunge_load_distribution_trunk_activation
  const trunk = registryDocument.sources.lunge_trunk_position_activation
  for (const source of [loading, distribution, trunk]) {
    assert.equal(source.kind, 'peer_reviewed_research')
    assert.ok(source.evidenceQuality >= 80)
  }

  const instruction = registryDocument.sources.ace_dumbbell_reverse_lunge_instruction
  assert.equal(instruction.publisher, 'American Council on Exercise')
  assert.equal(instruction.kind, 'expert_instruction')
})

test('Lateral Lunge evidence separates direct step-out biomechanics from adjacent technique and compound instruction', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  assert.equal(registryDocument.registryVersion, '2026-08-02.84')

  const olderAdults = registryDocument.sources.lateral_lunge_older_adult_biomechanics
  const healthy = registryDocument.sources.lateral_lunge_healthy_biomechanics
  const patellofemoral = registryDocument.sources.side_lunge_patellofemoral_loading
  for (const source of [olderAdults, healthy, patellofemoral]) {
    assert.equal(source.kind, 'peer_reviewed_research')
    assert.ok(source.evidenceQuality >= 80)
  }
  assert.equal(
    patellofemoral.url,
    'https://pmc.ncbi.nlm.nih.gov/articles/PMC8805090/',
  )
  assert.match(patellofemoral.title, /Forward and Side Lunge/i)

  const technique = registryDocument.sources.nsca_lunge_technique_and_modifications
  assert.equal(technique.publisher, 'National Strength and Conditioning Association')
  assert.equal(technique.kind, 'professional_standard')

  const compound = registryDocument.sources.ace_double_dumbbell_lateral_lunge_instruction
  assert.equal(compound.publisher, 'American Council on Exercise')
  assert.equal(compound.kind, 'expert_instruction')
  assert.equal(
    registryDocument.sources.monash_cossack_squat_technique.publisher,
    'Monash University',
    'Cossack evidence remains adjacent and must not be treated as a step-out Lateral Lunge source',
  )
})

test('Suitcase Carry evidence distinguishes unilateral locomotion, static holds, gait mechanics, and adjacent strongman tasks', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  assert.equal(registryDocument.registryVersion, '2026-08-02.84')

  const activation = registryDocument.sources.loaded_carry_muscle_activation
  assert.equal(activation.url, 'https://pubmed.ncbi.nlm.nih.gov/38665162/')
  assert.equal(activation.kind, 'peer_reviewed_research')
  assert.ok(activation.evidenceQuality >= 85)
  assert.match(activation.title, /Loaded Carry Movement Pattern/i)

  const gait = registryDocument.sources.unilateral_weight_walking_hip_trunk
  const posture = registryDocument.sources.unilateral_weight_postural_gait
  for (const source of [gait, posture]) {
    assert.equal(source.kind, 'peer_reviewed_research')
    assert.ok(source.evidenceQuality >= 75)
  }
  assert.match(gait.title, /Walking With and Without Unilateral Weight/i)

  const strongman = registryDocument.sources.strongman_biomechanics_systematic_review
  assert.equal(strongman.kind, 'peer_reviewed_research')
  assert.ok(strongman.evidenceQuality >= 90)
  assert.match(strongman.title, /Systematic Review/i)
})

test('Bent-Knee Soleus Raise evidence separates knee-position adaptation, tendon loading, acute response, selectivity limits, and exact technique', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  assert.equal(registryDocument.registryVersion, '2026-08-02.84')

  const hypertrophy = registryDocument.sources.bent_knee_calf_raise_hypertrophy_knee_position
  assert.equal(
    hypertrophy.url,
    'https://pmc.ncbi.nlm.nih.gov/articles/PMC10753835/',
  )
  assert.equal(hypertrophy.kind, 'peer_reviewed_research')
  assert.ok(hypertrophy.evidenceQuality >= 85)
  assert.match(hypertrophy.title, /standing versus seated calf-raise/i)

  const tendon = registryDocument.sources.heel_raise_achilles_loading_hierarchy
  assert.equal(tendon.url, 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5343533/')
  assert.equal(tendon.kind, 'peer_reviewed_research')
  assert.ok(tendon.evidenceQuality >= 85)

  const swelling = registryDocument.sources.bent_leg_calf_raise_acute_swelling
  const selectivity = registryDocument.sources.heel_raise_knee_flexion_activity_selectivity
  for (const source of [swelling, selectivity]) {
    assert.equal(source.kind, 'peer_reviewed_research')
    assert.ok(source.evidenceQuality >= 80)
  }
  assert.equal(swelling.url, 'https://pubmed.ncbi.nlm.nih.gov/37015022/')
  assert.equal(selectivity.url, 'https://pubmed.ncbi.nlm.nih.gov/22190157/')

  const technique = registryDocument.sources.nsca_bent_knee_calf_raise_technique
  assert.equal(technique.publisher, 'National Strength and Conditioning Association')
  assert.equal(technique.kind, 'professional_standard')
  assert.match(technique.url, /ptq-8\.4\.3-how-to-improve-ankle-dorsiflexion/)
})

test('Back Squat evidence separates bar position, stance, depth, loading, adaptation, and rack safety limits', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  assert.equal(registryDocument.registryVersion, '2026-08-02.84')

  const barPosition = registryDocument.sources.back_squat_high_low_3rm_biomechanics
  assert.equal(barPosition.url, 'https://pubmed.ncbi.nlm.nih.gov/38900172/')
  assert.equal(barPosition.kind, 'peer_reviewed_research')
  assert.ok(barPosition.evidenceQuality >= 88)

  const stance = registryDocument.sources.back_squat_bar_position_stance_biomechanics
  const moments = registryDocument.sources.back_squat_depth_load_support_moments
  const knee = registryDocument.sources.back_squat_knee_kinetics_depth_load
  const adaptation = registryDocument.sources.squat_training_depth_muscle_volume
  for (const source of [stance, moments, knee, adaptation]) {
    assert.equal(source.kind, 'peer_reviewed_research')
    assert.ok(source.evidenceQuality >= 85)
  }
  assert.equal(stance.url, 'https://pubmed.ncbi.nlm.nih.gov/34541522/')
  assert.equal(moments.url, 'https://pubmed.ncbi.nlm.nih.gov/38036316/')
  assert.equal(knee.url, 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4064719/')
  assert.equal(adaptation.url, 'https://pubmed.ncbi.nlm.nih.gov/31230110/')

  const safety = registryDocument.sources.nsca_basics_strength_conditioning
  assert.equal(safety.publisher, 'National Strength and Conditioning Association')
  assert.equal(safety.kind, 'professional_standard')
  assert.match(safety.url, /basics_of_strength_and_conditioning_manual\.pdf/)
})

test('Box Jump evidence distinguishes propulsion, elevated landing, height, arm policy, and source limitations', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  assert.equal(registryDocument.registryVersion, '2026-08-02.84')

  const comparison = registryDocument.sources.countermovement_hurdle_box_jump_comparison
  assert.equal(comparison.url, 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10204452/')
  assert.equal(comparison.kind, 'peer_reviewed_research')
  assert.ok(comparison.evidenceQuality >= 85)
  assert.match(comparison.title, /Countermovement, Hurdle, and Box Jumps/i)

  const height = registryDocument.sources.box_jump_height_performance_study
  const arms = registryDocument.sources.arm_swing_countermovement_jump_study
  for (const source of [height, arms]) {
    assert.equal(source.kind, 'peer_reviewed_research')
    assert.ok(source.evidenceQuality >= 80)
  }
  assert.equal(height.url, 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11166134/')
  assert.equal(arms.url, 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5260575/')

  const nasm = registryDocument.sources.nasm_box_jump_instruction
  assert.equal(nasm.url, 'https://www.nasm.org/resource-center/exercise-library/box-jumps')
  assert.equal(nasm.kind, 'expert_instruction')
  assert.equal(nasm.publisher, 'National Academy of Sports Medicine')

  const instruction = registryDocument.sources.nsca_basics_strength_conditioning
  assert.equal(instruction.kind, 'professional_standard')
  assert.equal(instruction.publisher, 'National Strength and Conditioning Association')
})

test('Depth Jump evidence separates countermovement height strategy from bounce contact strategy and height-only dosing', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  assert.equal(registryDocument.registryVersion, '2026-08-02.84')

  const technique = registryDocument.sources.drop_jump_technique_rsi_study
  assert.equal(technique.url, 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5260527/')
  assert.equal(technique.kind, 'peer_reviewed_research')
  assert.ok(technique.evidenceQuality >= 85)
  assert.match(technique.title, /drop jump technique/i)

  const methodology = registryDocument.sources.drop_jump_training_methodology_review
  assert.equal(methodology.url, 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10160442/')
  assert.equal(methodology.kind, 'peer_reviewed_research')
  assert.ok(methodology.evidenceQuality >= 89)
  assert.match(methodology.title, /volume and intensity of drop jump training/i)

  const metaAnalysis = registryDocument.sources.reactive_strength_plyometric_meta_analysis
  assert.equal(metaAnalysis.kind, 'peer_reviewed_research')
  assert.ok(metaAnalysis.evidenceQuality >= 90)

  const landing = registryDocument.sources.landing_intervention_systematic_review
  const feedback = registryDocument.sources.landing_feedback_systematic_review
  for (const source of [landing, feedback]) {
    assert.equal(source.kind, 'peer_reviewed_research')
    assert.ok(source.evidenceQuality >= 85)
  }
})

test('Nordic Hamstring evidence separates variation mechanics, angle-specific isometrics, programme outcomes, and uncertain dose response', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  assert.equal(registryDocument.registryVersion, '2026-08-02.84')

  const variation = registryDocument.sources.nordic_hamstring_variation_kinematics_emg
  assert.equal(variation.url, 'https://pubmed.ncbi.nlm.nih.gov/31644582/')
  assert.equal(variation.kind, 'peer_reviewed_research')
  assert.ok(variation.evidenceQuality >= 80)
  assert.match(variation.title, /variations in Nordic hamstring exercise/i)

  const angles = registryDocument.sources.nordic_hamstring_isometric_angle_emg
  assert.equal(angles.url, 'https://pubmed.ncbi.nlm.nih.gov/38439779/')
  assert.equal(angles.kind, 'peer_reviewed_research')
  assert.ok(angles.evidenceQuality >= 80)
  assert.match(angles.title, /Knee and Hip Angles/i)

  const volume = registryDocument.sources.nordic_hamstring_intervention_volume_meta_analysis
  const injury = registryDocument.sources.nordic_hamstring_injury_program_meta_analysis
  const dose = registryDocument.sources.nordic_hamstring_strength_dose_response_meta_regression
  for (const source of [volume, injury, dose]) {
    assert.equal(source.kind, 'peer_reviewed_research')
    assert.ok(source.evidenceQuality >= 90)
  }
  assert.equal(volume.url, 'https://pubmed.ncbi.nlm.nih.gov/31502142/')
  assert.equal(injury.url, 'https://pubmed.ncbi.nlm.nih.gov/30808663/')
  assert.equal(dose.url, 'https://pubmed.ncbi.nlm.nih.gov/40991853/')
  assert.match(injury.title, /programmes/i)
  assert.match(dose.title, /Meta-Regression/i)
})

test('Front Plank evidence separates exact lever and tension variants from tests, surface changes, and unsupported transfer claims', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  assert.equal(registryDocument.registryVersion, '2026-08-02.84')

  const lever = registryDocument.sources.front_plank_long_lever_posterior_tilt_emg
  assert.equal(lever.url, 'https://pubmed.ncbi.nlm.nih.gov/25325773/')
  assert.equal(lever.kind, 'peer_reviewed_research')
  assert.ok(lever.evidenceQuality >= 80)
  assert.match(lever.title, /long lever and posterior tilt/i)

  const test = registryDocument.sources.prone_bridge_performance_validity_reliability
  assert.equal(test.url, 'https://pubmed.ncbi.nlm.nih.gov/29861239/')
  assert.equal(test.kind, 'peer_reviewed_research')
  assert.ok(test.evidenceQuality >= 80)
  assert.match(test.title, /validity, and reliability/i)

  const systematic = registryDocument.sources.core_muscle_activity_systematic_review
  const surfaces = registryDocument.sources.stable_unstable_surface_emg_meta_analysis
  for (const source of [systematic, surfaces]) {
    assert.equal(source.kind, 'peer_reviewed_research')
    assert.ok(source.evidenceQuality >= 90)
  }

  const prone = registryDocument.sources.prone_reverse_static_plank_core_emg
  const hip = registryDocument.sources.plank_isometric_hip_adduction_abduction_emg
  assert.equal(prone.url, 'https://pubmed.ncbi.nlm.nih.gov/35370773/')
  assert.equal(hip.url, 'https://pubmed.ncbi.nlm.nih.gov/27630435/')
  assert.equal(prone.kind, 'peer_reviewed_research')
  assert.equal(hip.kind, 'peer_reviewed_research')
})

test('Kettlebell Swing evidence separates exact technique, hand count, load, fatigue, and overhead style boundaries', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  assert.equal(registryDocument.registryVersion, '2026-08-02.84')

  const technique = registryDocument.sources.ace_two_hand_kettlebell_swing_technique
  assert.equal(
    technique.url,
    'https://www.acefitness.org/continuing-education/certified/january-2025/8788/the-ace-do-it-better-series-the-two-handed-kettlebell-swing/',
  )
  assert.equal(technique.kind, 'professional_standard')
  assert.ok(technique.evidenceQuality >= 80)
  assert.match(technique.title, /Two-handed Kettlebell Swing/i)

  const expectedResearch = new Map([
    ['kettlebell_swing_back_hip_spine_loads', 'https://pubmed.ncbi.nlm.nih.gov/21997449/'],
    ['two_single_hand_kettlebell_swing_emg_kinematics', 'https://pubmed.ncbi.nlm.nih.gov/26618061/'],
    ['kettlebell_mass_lower_body_joint_kinetics', 'https://pubmed.ncbi.nlm.nih.gov/32131695/'],
    ['kettlebell_swing_mechanical_demands', 'https://pubmed.ncbi.nlm.nih.gov/22207261/'],
    ['kettlebell_swing_style_kinematics_kinetics', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5455182/'],
    ['kettlebell_swing_fatigue_biomechanics', 'https://pubmed.ncbi.nlm.nih.gov/37126368/'],
    ['overhead_kettlebell_swing_load_kinetics', 'https://pubmed.ncbi.nlm.nih.gov/36548500/'],
  ])
  for (const [sourceKey, url] of expectedResearch) {
    const source = registryDocument.sources[sourceKey]
    assert.equal(source.url, url)
    assert.equal(source.kind, 'peer_reviewed_research')
    assert.ok(source.evidenceQuality >= 82)
  }
  assert.match(
    registryDocument.sources.kettlebell_swing_style_kinematics_kinetics.title,
    /differ between kettlebell swing styles/i,
  )
  assert.match(
    registryDocument.sources.kettlebell_swing_fatigue_biomechanics.title,
    /effects of fatigue/i,
  )
  assert.match(
    registryDocument.sources.overhead_kettlebell_swing_load_kinetics.title,
    /Overhead Swings/i,
  )
})

test('Pull-Up evidence separates grip variants, strict identity, loading, fatigue, and kipping boundaries', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  assert.equal(registryDocument.registryVersion, '2026-08-02.84')

  const instruction = registryDocument.sources.ace_pull_up_instruction
  assert.equal(
    instruction.url,
    'https://www.acefitness.org/resources/everyone/exercise-library/191/pull-ups/',
  )
  assert.equal(instruction.publisher, 'American Council on Exercise')
  assert.equal(instruction.kind, 'expert_instruction')
  assert.ok(instruction.evidenceQuality >= 75)

  const expectedResearch = new Map([
    ['pull_up_chin_up_emg_elbow_motion', 'https://pubmed.ncbi.nlm.nih.gov/21068680/'],
    ['pull_up_grip_variation_emg', 'https://pubmed.ncbi.nlm.nih.gov/28011412/'],
    ['pullup_scapular_kinematics', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4916995/'],
    ['pull_up_spine_load_technique', 'https://pubmed.ncbi.nlm.nih.gov/25066518/'],
    ['pull_up_load_force_power_velocity', 'https://pubmed.ncbi.nlm.nih.gov/28253041/'],
    ['pull_up_velocity_loss_training', 'https://pubmed.ncbi.nlm.nih.gov/32213783/'],
    ['dynamic_isometric_pull_up_fatigue', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4633265/'],
    ['strict_kipping_pull_up_kinematics', 'https://pubmed.ncbi.nlm.nih.gov/29768093/'],
  ])
  for (const [sourceKey, url] of expectedResearch) {
    const source = registryDocument.sources[sourceKey]
    assert.equal(source.url, url)
    assert.equal(source.kind, 'peer_reviewed_research')
    assert.ok(source.evidenceQuality >= 80)
  }

  assert.match(
    registryDocument.sources.pull_up_grip_variation_emg.title,
    /pull-up variations/i,
  )
  assert.match(
    registryDocument.sources.strict_kipping_pull_up_kinematics.title,
    /kipping action/i,
  )
  assert.notEqual(
    registryDocument.sources.pull_up_chin_up_emg_elbow_motion.url,
    'https://pubmed.ncbi.nlm.nih.gov/38156065/',
    'PMID 38156065 is calf-raise evidence, not Pull-Up evidence',
  )
})

test('Hollow Body Hold evidence separates the exact static shape from abdominal hollowing, dynamic pullovers, and moving hollow drills', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  assert.equal(registryDocument.registryVersion, '2026-08-02.84')

  const instruction = registryDocument.sources.crossfit_gymnastics_hollow_body_guide
  assert.equal(
    instruction.url,
    'https://assets.crossfit.com/pdfs/seminars/SMERefs/Gymnastics/GymnasticsCourse_SeminarGuide.pdf',
  )
  assert.equal(instruction.publisher, 'CrossFit')
  assert.equal(instruction.kind, 'professional_standard')
  assert.ok(instruction.evidenceQuality >= 80)
  assert.match(instruction.title, /Gymnastics Training Guide/i)

  const expectedResearch = new Map([
    ['pelvic_tilt_hollowing_unsupported_leg_emg', 'https://pubmed.ncbi.nlm.nih.gov/15085209/'],
    ['straight_leg_raise_pelvic_control_emg', 'https://pubmed.ncbi.nlm.nih.gov/23127994/'],
    ['bilateral_leg_lift_abdominal_hip_flexor_emg', 'https://pubmed.ncbi.nlm.nih.gov/9118976/'],
    ['double_leg_lowering_emg_kinetics', 'https://pubmed.ncbi.nlm.nih.gov/26467996/'],
    ['dynamic_pullover_pectoralis_lat_emg', 'https://pubmed.ncbi.nlm.nih.gov/21975179/'],
    ['graded_isometric_trunk_force_variability', 'https://pubmed.ncbi.nlm.nih.gov/18443772/'],
  ])
  for (const [sourceKey, url] of expectedResearch) {
    const source = registryDocument.sources[sourceKey]
    assert.equal(source.url, url)
    assert.equal(source.kind, 'peer_reviewed_research')
    assert.ok(source.evidenceQuality >= 80)
  }

  assert.match(
    registryDocument.sources.dynamic_pullover_pectoralis_lat_emg.title,
    /pullover exercise/i,
  )
  assert.notEqual(
    registryDocument.sources.pelvic_tilt_hollowing_unsupported_leg_emg.url,
    'https://pubmed.ncbi.nlm.nih.gov/32707142/',
    'PMID 32707142 is prone-CPR evidence, not Hollow Body Hold evidence',
  )
  assert.notEqual(
    registryDocument.sources.dynamic_pullover_pectoralis_lat_emg.url,
    'https://pubmed.ncbi.nlm.nih.gov/19620925/',
    'PMID 19620925 is rowing evidence, not Hollow Body Hold or pullover evidence',
  )
})

test('Handstand Hold evidence separates unsupported balance, wall support, entry, pressing, and dynamic action boundaries', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  assert.equal(registryDocument.registryVersion, '2026-08-02.84')

  const professional = registryDocument.sources.crossfit_handstand_coaching_guide
  assert.equal(
    professional.url,
    'https://www.crossfit.com/wp-content/uploads/2025/10/11104218/How-to-Coach-CrossFit-Gymnastics.pdf',
  )
  assert.equal(professional.publisher, 'CrossFit')
  assert.equal(professional.kind, 'professional_standard')
  assert.ok(professional.evidenceQuality >= 80)

  const governingBody = registryDocument.sources.usa_gymnastics_jumpstart_handstand_test
  assert.equal(
    governingBody.url,
    'https://static.usagym.org/PDFs/T%26T/JumpStart/testing23/process.pdf',
  )
  assert.equal(governingBody.publisher, 'USA Gymnastics')
  assert.equal(governingBody.kind, 'governing_body')
  assert.ok(governingBody.evidenceQuality >= 85)

  const expectedResearch = new Map([
    ['handstand_biomechanics_systematic_review', 'https://pubmed.ncbi.nlm.nih.gov/41473027/'],
    ['handstand_postural_control_emg', 'https://pubmed.ncbi.nlm.nih.gov/29471194/'],
    ['handstand_palmar_pressure_distribution', 'https://pubmed.ncbi.nlm.nih.gov/39508479/'],
    ['novice_handstand_shoulder_tests', 'https://pubmed.ncbi.nlm.nih.gov/38739595/'],
    ['handstand_stabilometric_experience', 'https://pubmed.ncbi.nlm.nih.gov/31197281/'],
    ['handstand_bidirectional_balance_control', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7801474/'],
    ['handstand_neck_angle_variability', 'https://pubmed.ncbi.nlm.nih.gov/40980972/'],
  ])
  for (const [sourceKey, url] of expectedResearch) {
    const source = registryDocument.sources[sourceKey]
    assert.equal(source.url, url)
    assert.equal(source.kind, 'peer_reviewed_research')
    assert.ok(source.evidenceQuality >= 84)
    assert.notEqual(
      source.url,
      'https://pubmed.ncbi.nlm.nih.gov/32707142/',
      'PMID 32707142 is prone-CPR evidence, not Handstand Hold evidence',
    )
  }
  assert.match(
    registryDocument.sources.handstand_biomechanics_systematic_review.title,
    /systematic review/i,
  )
  assert.match(
    registryDocument.sources.handstand_neck_angle_variability.title,
    /Neck Angle/i,
  )
})

test('Cartwheel hand-placement line-drill evidence separates direct instruction, loading, learning, and media-only claims', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  assert.equal(registryDocument.registryVersion, '2026-08-02.84')
  assert.equal(Object.keys(registryDocument.sources).length, 357)

  const expectedSources = new Map([
    ['safe_gymnastics_cartwheel_markers', {
      url: 'https://is.muni.cz/do/fsps/e-learning/safe_gymnastics_4all/pages_en/floor_12_cartwheel.html',
      kind: 'professional_standard',
      publisher: 'Masaryk University Faculty of Sports Studies',
      minimumQuality: 82,
    }],
    ['usasf_cartwheel_pt14', {
      url: 'https://resources.usasfmembers.net/wp-content/uploads/2020/09/02-PreSchool-FUNdamentals-Tumbling-PT14.pdf',
      kind: 'governing_body',
      publisher: 'U.S. All Star Federation',
      minimumQuality: 82,
    }],
    ['cartwheel_roundoff_hand_position_loads', {
      url: 'https://pubmed.ncbi.nlm.nih.gov/29343188/',
      kind: 'peer_reviewed_research',
      publisher: 'European Journal of Sport Science',
      minimumQuality: 91,
    }],
    ['cartwheel_skill_complexity_upper_limb_loading', {
      url: 'https://doi.org/10.1080/14763141.2021.1876755',
      kind: 'peer_reviewed_research',
      publisher: 'Sports Biomechanics',
      minimumQuality: 89,
    }],
    ['foundation_tumbling_upper_lower_impact', {
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11235812/',
      kind: 'peer_reviewed_research',
      publisher: 'Sports Biomechanics',
      minimumQuality: 90,
    }],
    ['cartwheel_alternating_blocked_practice', {
      url: 'https://pubmed.ncbi.nlm.nih.gov/12929780/',
      kind: 'peer_reviewed_research',
      publisher: 'Perceptual and Motor Skills',
      minimumQuality: 84,
    }],
    ['cartwheel_manual_guidance_acquisition', {
      url: 'https://www.ijsp-online.com/abstract/view/41/255',
      kind: 'peer_reviewed_research',
      publisher: 'International Journal of Sport Psychology',
      minimumQuality: 82,
    }],
    ['cartwheel_floor_tape_learning', {
      url: 'https://doi.org/10.26858/cpjok.v18i1.524',
      kind: 'peer_reviewed_research',
      publisher: 'Competitor: Jurnal Pendidikan Kepelatihan Olahraga',
      minimumQuality: 68,
    }],
  ])
  for (const [sourceKey, expected] of expectedSources) {
    const source = registryDocument.sources[sourceKey]
    assert.ok(source, `missing Cartwheel source ${sourceKey}`)
    assert.equal(source.url, expected.url)
    assert.equal(source.kind, expected.kind)
    assert.equal(source.publisher, expected.publisher)
    assert.ok(source.evidenceQuality >= expected.minimumQuality)
  }

  assert.match(
    registryDocument.sources.safe_gymnastics_cartwheel_markers.title,
    /Cartwheel/i,
  )
  assert.match(
    registryDocument.sources.cartwheel_roundoff_hand_position_loads.title,
    /Elbow and wrist joint loading/i,
  )
  assert.match(
    registryDocument.sources.cartwheel_skill_complexity_upper_limb_loading.title,
    /skill complexity/i,
  )
  assert.match(
    registryDocument.sources.cartwheel_floor_tape_learning.title,
    /Floor Tape Media/i,
  )
})

test('Back Bridge evidence separates static support identity from dynamic entries, kickovers, walkovers, and universal safety claims', () => {
  const registryDocument = JSON.parse(readFileSync(
    path.join(RESEARCH_ROOT, 'source-registry.v1.json'),
    'utf8',
  ))
  assert.equal(registryDocument.registryVersion, '2026-08-02.84')
  assert.equal(Object.keys(registryDocument.sources).length, 357)

  const expectedSources = new Map([
    ['bridge_spine_hyperextension_review', {
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4769315/',
      kind: 'peer_reviewed_research',
      publisher: 'Sports Medicine - Open',
      minimumQuality: 92,
    }],
    ['gymnast_spinal_rom_back_pain_dynamic_skills', {
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7225801/',
      kind: 'peer_reviewed_research',
      publisher: 'Journal of Athletic Training',
      minimumQuality: 88,
    }],
    ['back_walkover_hip_extension_lumbar_lordosis', {
      url: 'https://www.tandfonline.com/doi/full/10.1080/10255842.2020.1812841',
      kind: 'peer_reviewed_research',
      publisher: 'Computer Methods in Biomechanics and Biomedical Engineering',
      minimumQuality: 72,
    }],
    ['young_gymnast_back_bridge_flexibility', {
      url: 'https://www.apunts.org/en-control-flexibilitat-joves-gimnastes-competicio-articulo-resumen-S1886658110000617',
      kind: 'peer_reviewed_research',
      publisher: 'Apunts Sports Medicine',
      minimumQuality: 78,
    }],
    ['canjump_back_bridge_foundations_manual', {
      url: 'https://www.gymbc.org/media/o4opcs3u/gbc-canjump-manual-1.pdf',
      kind: 'governing_body',
      publisher: 'Gymnastics Canada / Gymnastics BC',
      minimumQuality: 82,
    }],
    ['gymnastics_ontario_mag_back_bridge_rules', {
      url: 'https://www.gymnasticsontario.ca/wp-content/uploads/2014/12/2015-16-MAG-ON-Prov-L12and3-Rules-Nov20152.pdf',
      kind: 'governing_body',
      publisher: 'Gymnastics Ontario',
      minimumQuality: 82,
    }],
    ['gymnastics_ontario_elite_pathways_back_bridge_rules', {
      url: 'https://www.gymnasticsontario.ca/wp-content/uploads/2014/12/2016-17-Section-I-Technical-Rules-and-Regulations.pdf',
      kind: 'governing_body',
      publisher: 'Gymnastics Ontario',
      minimumQuality: 82,
    }],
    ['british_gymnastics_bridge_action_boundaries', {
      url: 'https://mybg.british-gymnastics.org/store/downloadPublic?f=e810bf6f-df1b-4828-957d-6ddafe28f4c6.pdf&t=email',
      kind: 'governing_body',
      publisher: 'British Gymnastics',
      minimumQuality: 84,
    }],
    ['ssep_gymnastics_bridge_instruction', {
      url: 'https://ssep.com.au/how-to-correctly-perform-a-gymnastics-bridge/',
      kind: 'expert_instruction',
      publisher: 'Sydney Sports and Exercise Physiology',
      minimumQuality: 74,
    }],
  ])

  for (const [sourceKey, expected] of expectedSources) {
    const source = registryDocument.sources[sourceKey]
    assert.ok(source, `missing Back Bridge source ${sourceKey}`)
    assert.equal(source.url, expected.url)
    assert.equal(source.kind, expected.kind)
    assert.equal(source.publisher, expected.publisher)
    assert.ok(source.evidenceQuality >= expected.minimumQuality)
  }

  assert.match(
    registryDocument.sources.bridge_spine_hyperextension_review.title,
    /Stretching the Spines of Gymnasts/i,
  )
  assert.match(
    registryDocument.sources.back_walkover_hip_extension_lumbar_lordosis.title,
    /preliminary study/i,
  )
  assert.match(
    registryDocument.sources.british_gymnastics_bridge_action_boundaries.title,
    /Rules 2026/i,
  )
})
