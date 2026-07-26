import test from 'node:test'
import assert from 'node:assert/strict'

import {
  assessResearchPacket,
  classifyAlternateVersion,
  REQUIRED_RESEARCH_SECTIONS,
  validateMediaCandidates,
  validateResearchPacket,
  youtubeEmbedUrl,
  youtubeVideoId,
  loadCanonicalResearchQueue,
} from '../canonicalResearchReview.js'

test('YouTube candidates require 3–5 unique direct videos and produce privacy-enhanced embeds', () => {
  const candidates = ['abc123DEF45', 'xyz987LMN00', 'qwe456RTY12'].map((id) => ({
    url: `https://www.youtube.com/watch?v=${id}`,
  }))
  const result = validateMediaCandidates(candidates)
  assert.equal(result.valid, true)
  assert.equal(youtubeVideoId('https://youtu.be/abc123DEF45'), 'abc123DEF45')
  assert.equal(youtubeEmbedUrl(candidates[0].url), 'https://www.youtube-nocookie.com/embed/abc123DEF45')
  assert.equal(validateMediaCandidates(candidates.slice(0, 2)).valid, false)
  assert.equal(validateMediaCandidates([...candidates, candidates[0]]).valid, false)
})

test('research queue distinguishes candidate completeness from reviewed completeness', async () => {
  const pool = {
    async query() {
      return { rows: [{
        id: 'card-1',
        slug: 'incline-push-up',
        canonical_name: 'Incline Push-Up',
        card_version: 2,
        status: 'review',
        candidate_sections: 16,
        reviewed_sections: 0,
        media_candidates: 5,
        embeddable_media_candidates: 5,
        candidate_alternates: 4,
        reviewed_alternates: 0,
      }] }
    },
  }
  const [card] = await loadCanonicalResearchQueue(pool, 1)
  assert.equal(card.readyForHumanReview, true)
  assert.equal(card.candidateSections, 16)
  assert.equal(card.reviewedSections, 0)
})

test('packet validation requires all controlled sections, source claims, media, and alternate decisions', () => {
  const evidence = REQUIRED_RESEARCH_SECTIONS.map((sectionKey) => ({
    sectionKey,
    sourceUrl: `https://example.com/${sectionKey}`,
    sourceKind: 'professional_standard',
    evidenceQuality: 80,
    claims: [`Evidence for ${sectionKey}`],
  }))
  const packet = {
    slug: 'incline-push-up',
    evidence,
    mediaCandidates: ['aaa111BBB22', 'ccc333DDD44', 'eee555FFF66'].map((id) => ({
      url: `https://youtu.be/${id}`,
    })),
    alternateAssessments: [{
      name: 'Wall Push-Up',
      classification: 'new_variant',
      rationale: 'Support height materially changes relative load.',
      distinguishingDimensions: { surfaceHeight: 'wall' },
    }],
  }
  assert.equal(validateResearchPacket(packet).valid, true)
  const incomplete = validateResearchPacket({ ...packet, evidence: evidence.slice(1) })
  assert.equal(incomplete.valid, false)
  assert.match(incomplete.errors.find((error) => error.path === 'evidence').message, /identity/)
})

test('research packets reject exercise skill-level fields', () => {
  const evidence = REQUIRED_RESEARCH_SECTIONS.map((sectionKey) => ({
    sectionKey,
    sourceUrl: `https://example.com/${sectionKey}`,
    sourceKind: 'professional_standard',
    evidenceQuality: 80,
    claims: [`Evidence for ${sectionKey}`],
  }))
  const result = validateResearchPacket({
    slug: 'incline-push-up',
    assessmentSummary: {
      proposedDifficulty: {
        technicalComplexity: 30,
        absoluteLoadDemand: 25,
        baseOverallDifficulty: 35,
        skillLevel: 'beginner',
      },
      legacyLabels: {
        'skill-level': 'intermediate',
        'Skill Level': 'advanced',
      },
    },
    evidence,
    mediaCandidates: ['aaa111BBB22', 'ccc333DDD44', 'eee555FFF66'].map((id) => ({
      url: `https://youtu.be/${id}`,
    })),
    alternateAssessments: [{
      name: 'Wall Push-Up',
      classification: 'new_variant',
      rationale: 'Support height materially changes relative load.',
      distinguishingDimensions: { surfaceHeight: 'wall' },
    }],
  })
  assert.equal(result.valid, false)
  assert.ok(result.errors.some((error) => error.path.endsWith('skillLevel')))
  assert.ok(result.errors.some((error) => error.path.endsWith('skill-level')))
  assert.ok(result.errors.some((error) => error.path.endsWith('Skill Level')))
})

test('research packets derive overall exercise difficulty from complexity and physical demand', () => {
  const evidence = REQUIRED_RESEARCH_SECTIONS.map((sectionKey) => ({
    sectionKey,
    sourceUrl: `https://example.com/${sectionKey}`,
    sourceKind: 'professional_standard',
    evidenceQuality: 80,
    claims: [`Evidence for ${sectionKey}`],
  }))
  const packet = {
    slug: 'incline-push-up',
    assessmentSummary: {
      proposedDifficulty: {
        technicalComplexity: 36,
        absoluteLoadDemand: 54,
        coordinationDemand: 72,
        supervisionDemand: 68,
        baseOverallDifficulty: 72,
      },
    },
    evidence,
    mediaCandidates: ['aaa111BBB22', 'ccc333DDD44', 'eee555FFF66'].map((id) => ({
      url: `https://youtu.be/${id}`,
    })),
    alternateAssessments: [{
      name: 'Wall Push-Up',
      classification: 'new_variant',
      rationale: 'Support height materially changes relative physical demand.',
      distinguishingDimensions: { surfaceHeight: 'wall' },
    }],
  }
  const invalid = validateResearchPacket(packet)
  assert.equal(invalid.valid, false)
  assert.match(
    invalid.errors.find((error) => (
      error.path === 'assessmentSummary.proposedDifficulty.baseOverallDifficulty'
    )).message,
    /maximum of technical complexity and physical/,
  )

  const valid = validateResearchPacket({
    ...packet,
    assessmentSummary: {
      proposedDifficulty: {
        ...packet.assessmentSummary.proposedDifficulty,
        baseOverallDifficulty: 54,
      },
    },
  })
  assert.equal(valid.valid, true)
})

test('alternate classification separates new identities, variants, and annotations', () => {
  assert.equal(classifyAlternateVersion({}, {
    changedDimensions: ['primary_joint_action'],
  }), 'new_definition')
  assert.equal(classifyAlternateVersion({}, {
    changedDimensions: ['implement', 'load_position'],
  }), 'new_variant')
  assert.equal(classifyAlternateVersion({}, {
    changedDimensions: ['coaching_cue'],
  }), 'modifier_annotation')
})

test('research packet stays human-gated until every section, media set, and alternate is reviewed', () => {
  const evidence = REQUIRED_RESEARCH_SECTIONS.map((sectionKey) => ({
    sectionKey,
    reviewStatus: 'reviewed',
  }))
  const mediaCandidates = ['aaa111BBB22', 'ccc333DDD44', 'eee555FFF66'].map((id) => ({
    url: `https://youtu.be/${id}`,
  }))
  const pendingPacket = assessResearchPacket({
    evidence,
    mediaCandidates,
    alternateAssessments: [{ reviewStatus: 'reviewed' }],
  })
  assert.equal(pendingPacket.readyForHumanReview, true)
  assert.equal(pendingPacket.readyForPublication, false)
  assert.equal(pendingPacket.humanReviewRequired, true)

  const packet = assessResearchPacket({
    evidence,
    mediaCandidates: mediaCandidates.map((candidate, index) => ({
      ...candidate,
      reviewStatus: 'approved',
      linkStatus: 'healthy',
      embeddingAllowed: true,
      exactVariantMatch: true,
      demonstrationQualityScore: 85 + index,
      reviewerUserId: 7,
      reviewedAt: '2026-07-25T12:00:00.000Z',
    })),
    alternateAssessments: [{ reviewStatus: 'reviewed' }],
  })
  assert.equal(packet.ready, true)
  assert.equal(packet.readyForPublication, true)
  assert.equal(packet.humanReviewRequired, false)
  assert.deepEqual(packet.missingSections, [])
})
