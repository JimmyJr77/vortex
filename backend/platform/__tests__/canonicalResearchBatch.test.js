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
