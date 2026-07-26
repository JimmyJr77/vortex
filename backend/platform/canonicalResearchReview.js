import { findExerciseSkillLevelPaths } from './exerciseCardSemantics.js'

export const REQUIRED_RESEARCH_SECTIONS = Object.freeze([
  'identity', 'taxonomy', 'anatomy', 'biomechanics', 'difficulty',
  'load_fatigue_recovery', 'constraints', 'dosage', 'instructions',
  'safety_stop_rules', 'programming', 'athlete_support', 'coach_support',
  'accessibility', 'alternates', 'media',
])

export const RESEARCH_SOURCE_KINDS = Object.freeze([
  'peer_reviewed_research', 'professional_standard', 'governing_body',
  'manufacturer_instruction', 'expert_instruction', 'internal_observation',
])

export const ALTERNATE_CLASSIFICATIONS = Object.freeze([
  'new_definition', 'new_variant', 'modifier_annotation', 'same_identity', 'reject',
])

const YOUTUBE_PATTERNS = [
  /youtube\.com\/watch\?(?:[^#]*&)?v=([A-Za-z0-9_-]{6,})/,
  /youtu\.be\/([A-Za-z0-9_-]{6,})/,
]

export function youtubeVideoId(url) {
  const value = String(url ?? '').trim()
  for (const pattern of YOUTUBE_PATTERNS) {
    const match = value.match(pattern)
    if (match) return match[1]
  }
  return null
}

export function youtubeEmbedUrl(url) {
  const id = youtubeVideoId(url)
  return id ? `https://www.youtube-nocookie.com/embed/${id}` : null
}

export function validateMediaCandidates(candidates) {
  const errors = []
  const normalized = []
  const ids = new Set()
  for (const [index, candidate] of (Array.isArray(candidates) ? candidates : []).entries()) {
    const url = String(candidate?.url ?? '').trim()
    const videoId = youtubeVideoId(url)
    if (!videoId) {
      errors.push({ path: `${index}.url`, message: 'A direct YouTube watch or youtu.be URL is required.' })
      continue
    }
    if (ids.has(videoId)) {
      errors.push({ path: `${index}.url`, message: 'Duplicate YouTube video ID.' })
      continue
    }
    ids.add(videoId)
    normalized.push({
      ...candidate,
      url,
      videoId,
      embedUrl: youtubeEmbedUrl(url),
      reviewStatus: candidate.reviewStatus ?? 'candidate',
      linkStatus: candidate.linkStatus ?? 'unverified',
    })
  }
  if (normalized.length < 3 || normalized.length > 5) {
    errors.push({ path: 'mediaCandidates', message: 'Each reviewed card needs 3–5 unique direct YouTube candidates.' })
  }
  return { valid: errors.length === 0, errors, normalized }
}

export function validateResearchPacket(packet, { requireAllSections = true } = {}) {
  const errors = []
  const evidence = Array.isArray(packet?.evidence) ? packet.evidence : []
  const sectionKeys = new Set()
  const evidenceKeys = new Set()
  if (!packet || typeof packet !== 'object') {
    return { valid: false, errors: [{ path: '', message: 'Research packet must be an object.' }] }
  }
  for (const path of findExerciseSkillLevelPaths(packet)) {
    errors.push({
      path,
      message: 'Exercise research cannot define a skill level; assess difficulty dimensions and readiness instead.',
    })
  }
  const proposedDifficulty = packet?.assessmentSummary?.proposedDifficulty
  if (proposedDifficulty && typeof proposedDifficulty === 'object') {
    const difficultyFields = [
      'technicalComplexity',
      'absoluteLoadDemand',
      'baseOverallDifficulty',
    ]
    for (const field of difficultyFields) {
      const score = Number(proposedDifficulty[field])
      if (!Number.isInteger(score) || score < 1 || score > 100) {
        errors.push({
          path: `assessmentSummary.proposedDifficulty.${field}`,
          message: 'Proposed exercise difficulty scores must be integers from 1 to 100.',
        })
      }
    }
    const technical = Number(proposedDifficulty.technicalComplexity)
    const physical = Number(proposedDifficulty.absoluteLoadDemand)
    const overall = Number(proposedDifficulty.baseOverallDifficulty)
    if (
      Number.isInteger(technical)
      && Number.isInteger(physical)
      && Number.isInteger(overall)
      && overall !== Math.max(technical, physical)
    ) {
      errors.push({
        path: 'assessmentSummary.proposedDifficulty.baseOverallDifficulty',
        message: 'Overall exercise difficulty must equal the maximum of technical complexity and physical/absolute-load difficulty; coordination, impact, and supervision remain separate dimensions.',
      })
    }
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(packet.slug ?? ''))) {
    errors.push({ path: 'slug', message: 'A canonical kebab-case slug is required.' })
  }
  for (const [index, item] of evidence.entries()) {
    const prefix = `evidence.${index}`
    if (!REQUIRED_RESEARCH_SECTIONS.includes(item?.sectionKey)) {
      errors.push({ path: `${prefix}.sectionKey`, message: 'Unknown research section.' })
    } else {
      sectionKeys.add(item.sectionKey)
    }
    if (!/^https:\/\//.test(String(item?.sourceUrl ?? ''))) {
      errors.push({ path: `${prefix}.sourceUrl`, message: 'An HTTPS source URL is required.' })
    }
    if (!RESEARCH_SOURCE_KINDS.includes(item?.sourceKind)) {
      errors.push({ path: `${prefix}.sourceKind`, message: 'Unknown research source kind.' })
    }
    if (!Array.isArray(item?.claims) || item.claims.length === 0
      || item.claims.some((claim) => !String(claim).trim())) {
      errors.push({ path: `${prefix}.claims`, message: 'At least one non-empty evidence claim is required.' })
    }
    const quality = Number(item?.evidenceQuality)
    if (!Number.isInteger(quality) || quality < 1 || quality > 100) {
      errors.push({ path: `${prefix}.evidenceQuality`, message: 'Evidence quality must be an integer from 1 to 100.' })
    }
    const evidenceKey = `${item?.sectionKey}\u0000${item?.sourceUrl}`
    if (evidenceKeys.has(evidenceKey)) {
      errors.push({ path: prefix, message: 'Duplicate section/source evidence record.' })
    }
    evidenceKeys.add(evidenceKey)
  }
  const missingCandidateSections = REQUIRED_RESEARCH_SECTIONS
    .filter((section) => !sectionKeys.has(section))
  if (requireAllSections && missingCandidateSections.length > 0) {
    errors.push({
      path: 'evidence',
      message: `Missing required research sections: ${missingCandidateSections.join(', ')}`,
    })
  }
  const media = validateMediaCandidates(packet.mediaCandidates)
  errors.push(...media.errors.map((error) => ({
    ...error,
    path: `mediaCandidates.${error.path}`,
  })))
  const alternates = Array.isArray(packet.alternateAssessments)
    ? packet.alternateAssessments
    : []
  if (alternates.length === 0) {
    errors.push({ path: 'alternateAssessments', message: 'At least one alternate-version assessment is required.' })
  }
  const alternateNames = new Set()
  for (const [index, alternate] of alternates.entries()) {
    const prefix = `alternateAssessments.${index}`
    const name = String(alternate?.name ?? '').trim().toLowerCase()
    if (!name) errors.push({ path: `${prefix}.name`, message: 'Alternate name is required.' })
    if (alternateNames.has(name)) errors.push({ path: `${prefix}.name`, message: 'Duplicate alternate name.' })
    alternateNames.add(name)
    if (!ALTERNATE_CLASSIFICATIONS.includes(alternate?.classification)) {
      errors.push({ path: `${prefix}.classification`, message: 'Unknown alternate classification.' })
    }
    if (!String(alternate?.rationale ?? '').trim()) {
      errors.push({ path: `${prefix}.rationale`, message: 'Classification rationale is required.' })
    }
    if (!alternate?.distinguishingDimensions
      || Array.isArray(alternate.distinguishingDimensions)
      || typeof alternate.distinguishingDimensions !== 'object') {
      errors.push({
        path: `${prefix}.distinguishingDimensions`,
        message: 'Distinguishing dimensions must be an object.',
      })
    }
  }
  return {
    valid: errors.length === 0,
    errors,
    sectionKeys: [...sectionKeys],
    missingCandidateSections,
    media: media.normalized,
  }
}

export function classifyAlternateVersion(base, alternate) {
  const changed = new Set(alternate?.changedDimensions ?? [])
  const identityChanges = ['movement_pattern', 'primary_joint_action', 'primary_training_stimulus']
  const variantChanges = [
    'stance', 'laterality', 'implement', 'load_position', 'range_of_motion',
    'tempo', 'support_level', 'surface_height', 'start_position',
  ]
  if (identityChanges.some((dimension) => changed.has(dimension))) return 'new_definition'
  if (variantChanges.some((dimension) => changed.has(dimension))) return 'new_variant'
  if (changed.size > 0) return 'modifier_annotation'
  return String(base?.name ?? '').trim().toLowerCase() === String(alternate?.name ?? '').trim().toLowerCase()
    ? 'same_identity'
    : 'modifier_annotation'
}

export function assessResearchPacket(packet) {
  const candidateSections = new Set((packet?.evidence ?? [])
    .filter((item) => ['candidate', 'reviewed'].includes(item.reviewStatus ?? 'candidate'))
    .map((item) => item.sectionKey))
  const reviewedSections = new Set((packet?.evidence ?? [])
    .filter((item) => item.reviewStatus === 'reviewed')
    .map((item) => item.sectionKey))
  const missingCandidateSections = REQUIRED_RESEARCH_SECTIONS
    .filter((section) => !candidateSections.has(section))
  const missingReviewedSections = REQUIRED_RESEARCH_SECTIONS
    .filter((section) => !reviewedSections.has(section))
  const media = validateMediaCandidates(packet?.mediaCandidates)
  const mediaApproved = media.valid && media.normalized.every((item) => (
    item.reviewStatus === 'approved'
    && item.linkStatus === 'healthy'
    && item.embeddingAllowed === true
    && item.exactVariantMatch === true
    && Number(item.demonstrationQualityScore) >= 80
    && item.reviewerUserId != null
    && item.reviewedAt != null
  ))
  const alternatesPresent = Array.isArray(packet?.alternateAssessments)
    && packet.alternateAssessments.length > 0
  const alternatesReviewed = Array.isArray(packet?.alternateAssessments)
    && packet.alternateAssessments.length > 0
    && packet.alternateAssessments.every((item) => ['reviewed', 'approved'].includes(item.reviewStatus))
  const readyForHumanReview = missingCandidateSections.length === 0
    && media.valid
    && alternatesPresent
  const readyForPublication = missingReviewedSections.length === 0
    && mediaApproved
    && alternatesReviewed
  return {
    ready: readyForPublication,
    readyForHumanReview,
    readyForPublication,
    missingSections: missingReviewedSections,
    missingCandidateSections,
    missingReviewedSections,
    media,
    mediaApproved,
    alternatesPresent,
    alternatesReviewed,
    humanReviewRequired: !readyForPublication,
  }
}

export async function loadCanonicalResearchQueue(pool, facilityId, { limit = 100, offset = 0 } = {}) {
  const result = await pool.query(
    `SELECT
       d.id, d.slug, d.canonical_name, d.card_version, d.status,
       COUNT(DISTINCT e.section_key) FILTER (
         WHERE e.review_status IN ('candidate','reviewed')
       )::int AS candidate_sections,
       COUNT(DISTINCT e.section_key) FILTER (WHERE e.review_status='reviewed')::int AS reviewed_sections,
       COUNT(DISTINCT m.video_id) FILTER (
         WHERE m.review_status IN ('candidate','shortlisted','approved')
       )::int AS media_candidates,
       COUNT(DISTINCT m.video_id) FILTER (
         WHERE m.review_status IN ('candidate','shortlisted','approved')
           AND m.link_status='healthy'
           AND m.embedding_allowed IS TRUE
       )::int AS embeddable_media_candidates,
       COUNT(DISTINCT a.id) FILTER (
         WHERE a.review_status IN ('candidate','reviewed','approved')
       )::int AS candidate_alternates,
       COUNT(DISTINCT a.id) FILTER (
         WHERE a.review_status IN ('reviewed','approved')
       )::int AS reviewed_alternates
     FROM coaching.exercise_definition_v1 d
     LEFT JOIN coaching.exercise_section_evidence_v1 e
       ON e.definition_id=d.id AND e.reviewed_card_version=d.card_version
     LEFT JOIN coaching.exercise_media_candidate_v1 m
       ON m.definition_id=d.id AND m.reviewed_card_version=d.card_version
     LEFT JOIN coaching.exercise_alternate_assessment_v1 a
       ON a.definition_id=d.id AND a.reviewed_card_version=d.card_version
     WHERE d.facility_id=$1 AND d.status!='archived'
     GROUP BY d.id
     ORDER BY
       COUNT(DISTINCT e.section_key) FILTER (WHERE e.review_status='reviewed'),
       COUNT(DISTINCT m.video_id) FILTER (
         WHERE m.review_status IN ('candidate','shortlisted','approved')
       ),
       d.canonical_name
     LIMIT $2 OFFSET $3`,
    [facilityId, Math.min(Math.max(Number(limit) || 100, 1), 500), Math.max(Number(offset) || 0, 0)],
  )
  return result.rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    canonicalName: row.canonical_name,
    cardVersion: Number(row.card_version),
    status: row.status,
    candidateSections: Number(row.candidate_sections),
    reviewedSections: Number(row.reviewed_sections),
    requiredSections: REQUIRED_RESEARCH_SECTIONS.length,
    mediaCandidates: Number(row.media_candidates),
    embeddableMediaCandidates: Number(row.embeddable_media_candidates),
    candidateAlternates: Number(row.candidate_alternates),
    reviewedAlternates: Number(row.reviewed_alternates),
    readyForHumanReview: Number(row.candidate_sections) === REQUIRED_RESEARCH_SECTIONS.length
      && Number(row.embeddable_media_candidates) >= 3
      && Number(row.embeddable_media_candidates) <= 5
      && Number(row.candidate_alternates) > 0,
  }))
}
