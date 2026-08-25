const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function integer(value, field, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new RangeError(`${field} must be an integer from ${min} to ${max}.`)
  }
  return parsed
}

function uuid(value, field) {
  const parsed = String(value ?? '')
  if (!UUID_PATTERN.test(parsed)) throw new TypeError(`${field} must be a UUID.`)
  return parsed
}

function decision(value, allowed, field = 'decision') {
  const parsed = String(value ?? '')
  if (!allowed.includes(parsed)) {
    throw new RangeError(`${field} must be one of: ${allowed.join(', ')}.`)
  }
  return parsed
}

function notFound(message) {
  const error = new Error(message)
  error.status = 404
  return error
}

const REQUIRED_RESEARCH_SECTIONS = Object.freeze([
  'identity', 'taxonomy', 'anatomy', 'biomechanics', 'difficulty',
  'load_fatigue_recovery', 'constraints', 'dosage', 'instructions',
  'safety_stop_rules', 'programming', 'athlete_support', 'coach_support',
  'accessibility', 'alternates', 'media',
])

function valueCount(items, predicate) {
  return items.filter(predicate).length
}

/**
 * Produces an intentionally non-authoritative review checklist. It makes
 * remaining human decisions visible without changing their status or treating
 * candidate research as approval.
 */
export function summarizeCanonicalResearchReview({ evidence, mediaCandidates, alternateAssessments }) {
  const evidenceRows = Array.isArray(evidence) ? evidence : []
  const mediaRows = Array.isArray(mediaCandidates) ? mediaCandidates : []
  const alternateRows = Array.isArray(alternateAssessments) ? alternateAssessments : []
  const reviewedEvidenceSections = new Set(evidenceRows
    .filter((item) => item.review_status === 'reviewed')
    .map((item) => item.section_key))
  const candidateEvidenceSections = new Set(evidenceRows
    .filter((item) => ['candidate', 'reviewed'].includes(item.review_status))
    .map((item) => item.section_key))
  const missingCandidateSections = REQUIRED_RESEARCH_SECTIONS
    .filter((section) => !candidateEvidenceSections.has(section))
  const pendingEvidenceSections = REQUIRED_RESEARCH_SECTIONS
    .filter((section) => !reviewedEvidenceSections.has(section))
  const approvedMedia = mediaRows.filter((item) => (
    item.review_status === 'approved'
    && item.link_status === 'healthy'
    && item.embedding_allowed === true
    && item.exact_variant_match === true
    && Number(item.demonstration_quality_score) >= 80
    && item.reviewer_user_id != null
    && item.reviewed_at != null
  ))
  const mediaAwaitingAccessibilityMetadata = mediaRows.filter((item) => (
    ['candidate', 'shortlisted', 'approved'].includes(item.review_status)
    && item.captions_available == null
  ))
  const reviewedAlternates = alternateRows.filter((item) => (
    ['reviewed', 'approved'].includes(item.review_status)
  ))
  const proposedNewDefinitions = alternateRows.filter((item) => (
    item.classification === 'new_definition'
  ))
  const explicitDefinitionPlans = proposedNewDefinitions.filter((item) => (
    String(item.proposed_card_json?.slug ?? '').trim()
    || String(item.distinguishing_dimensions?.targetDefinitionId ?? '').trim()
  ))
  const unresolvedTargetReferences = proposedNewDefinitions.filter((item) => (
    String(item.distinguishing_dimensions?.targetDefinitionId ?? '').trim()
    && item.distinguishing_dimensions?.targetDefinitionResolution !== 'active_current_definition'
  ))
  const unplannedNewDefinitions = proposedNewDefinitions.filter((item) => (
    !String(item.proposed_card_json?.slug ?? '').trim()
    && !String(item.distinguishing_dimensions?.targetDefinitionId ?? '').trim()
  ))
  const blockers = []
  if (missingCandidateSections.length) {
    blockers.push({ code: 'RESEARCH_CANDIDATES_INCOMPLETE', sections: missingCandidateSections })
  }
  if (pendingEvidenceSections.length) {
    blockers.push({ code: 'RESEARCH_REVIEW_PENDING', sections: pendingEvidenceSections })
  }
  if (mediaRows.length < 3 || mediaRows.length > 5 || approvedMedia.length !== mediaRows.length) {
    blockers.push({
      code: 'EXACT_MEDIA_REVIEW_PENDING',
      candidateCount: mediaRows.length,
      approvedCount: approvedMedia.length,
    })
  }
  if (reviewedAlternates.length !== alternateRows.length || alternateRows.length === 0) {
    blockers.push({
      code: 'ALTERNATE_REVIEW_PENDING',
      candidateCount: alternateRows.length,
      reviewedCount: reviewedAlternates.length,
    })
  }
  if (unplannedNewDefinitions.length || unresolvedTargetReferences.length) {
    blockers.push({
      code: 'NEW_DEFINITION_TRIAGE_PENDING',
      candidateCount: proposedNewDefinitions.length,
      unplannedCount: unplannedNewDefinitions.length,
      unresolvedTargetReferenceCount: unresolvedTargetReferences.length,
    })
  }
  if (mediaAwaitingAccessibilityMetadata.length) {
    blockers.push({
      code: 'MEDIA_ACCESSIBILITY_METADATA_PENDING',
      candidateCount: mediaAwaitingAccessibilityMetadata.length,
    })
  }
  return {
    humanReviewRequired: blockers.length > 0,
    readyForPublication: blockers.length === 0,
    blockers,
    evidence: {
      requiredSections: REQUIRED_RESEARCH_SECTIONS.length,
      candidateSections: candidateEvidenceSections.size,
      reviewedSections: reviewedEvidenceSections.size,
      missingCandidateSections,
      pendingEvidenceSections,
      rejectedRecords: valueCount(evidenceRows, (item) => item.review_status === 'rejected'),
    },
    media: {
      requiredMinimum: 3,
      allowedMaximum: 5,
      candidateCount: mediaRows.length,
      approvedCount: approvedMedia.length,
      pendingExactReviewCount: mediaRows.length - approvedMedia.length,
      accessibilityMetadataPendingCount: mediaAwaitingAccessibilityMetadata.length,
      rejectedCount: valueCount(mediaRows, (item) => item.review_status === 'rejected'),
    },
    alternates: {
      candidateCount: alternateRows.length,
      reviewedCount: reviewedAlternates.length,
      pendingReviewCount: alternateRows.length - reviewedAlternates.length,
      rejectedCount: valueCount(alternateRows, (item) => item.review_status === 'rejected'),
      proposedNewDefinitionCount: proposedNewDefinitions.length,
      newDefinitionWithDirectPlanCount: explicitDefinitionPlans.length,
      newDefinitionWithoutCardPlanCount: unplannedNewDefinitions.length,
      unresolvedTargetReferenceCount: unresolvedTargetReferences.length,
    },
  }
}

export async function loadCanonicalResearchReview(pool, facilityId, definitionId) {
  const cardId = uuid(definitionId, 'definitionId')
  const definition = await pool.query(
    `SELECT id, slug, canonical_name, display_name, card_version, status
     FROM coaching.exercise_definition_v1
     WHERE id=$1 AND facility_id=$2 AND status!='archived'`,
    [cardId, integer(facilityId, 'facilityId')],
  )
  if (definition.rows.length !== 1) throw notFound('Canonical card not found.')
  const card = definition.rows[0]
  const [evidence, media, alternates] = await Promise.all([
    pool.query(
      `SELECT *
       FROM coaching.exercise_section_evidence_v1
       WHERE definition_id=$1 AND reviewed_card_version=$2
       ORDER BY section_key, source_url`,
      [cardId, card.card_version],
    ),
    pool.query(
      `SELECT *
       FROM coaching.exercise_media_candidate_v1
       WHERE definition_id=$1 AND reviewed_card_version=$2
       ORDER BY
         CASE review_status
           WHEN 'approved' THEN 0 WHEN 'shortlisted' THEN 1
           WHEN 'candidate' THEN 2 WHEN 'rejected' THEN 3 ELSE 4
         END,
         demonstration_quality_score DESC NULLS LAST,
         video_id`,
      [cardId, card.card_version],
    ),
    pool.query(
      `SELECT *
       FROM coaching.exercise_alternate_assessment_v1
       WHERE definition_id=$1 AND reviewed_card_version=$2
       ORDER BY alternate_name`,
      [cardId, card.card_version],
    ),
  ])
  const review = {
    card,
    evidence: evidence.rows,
    mediaCandidates: media.rows,
    alternateAssessments: alternates.rows,
  }
  return {
    ...review,
    reviewChecklist: summarizeCanonicalResearchReview(review),
  }
}

export async function reviewCanonicalSectionEvidence(
  pool,
  facilityId,
  definitionId,
  evidenceId,
  reviewerUserId,
  input,
) {
  const reviewDecision = decision(input?.decision, ['reviewed', 'rejected'])
  const result = await pool.query(
    `UPDATE coaching.exercise_section_evidence_v1 evidence
     SET review_status=$6,
         reviewer_user_id=$5,
         reviewed_at=now(),
         updated_at=now()
     FROM coaching.exercise_definition_v1 definition
     WHERE evidence.id=$1
       AND evidence.definition_id=$2
       AND evidence.reviewed_card_version=$3
       AND definition.id=evidence.definition_id
       AND definition.facility_id=$4
       AND definition.status!='archived'
       AND definition.card_version=$3
     RETURNING evidence.*`,
    [
      uuid(evidenceId, 'evidenceId'),
      uuid(definitionId, 'definitionId'),
      integer(input?.expectedCardVersion, 'expectedCardVersion'),
      integer(facilityId, 'facilityId'),
      integer(reviewerUserId, 'reviewerUserId'),
      reviewDecision,
    ],
  )
  if (result.rows.length !== 1) {
    throw notFound('Current-version evidence record not found.')
  }
  return result.rows[0]
}

export async function reviewCanonicalMediaCandidate(
  pool,
  facilityId,
  definitionId,
  mediaCandidateId,
  reviewerUserId,
  input,
) {
  const reviewDecision = decision(input?.decision, ['shortlisted', 'approved', 'rejected'])
  const linkStatus = decision(
    input?.linkStatus,
    ['unverified', 'healthy', 'broken', 'embedding_disabled', 'mismatched'],
    'linkStatus',
  )
  const quality = input?.demonstrationQualityScore == null
    ? null
    : integer(input.demonstrationQualityScore, 'demonstrationQualityScore', { min: 1, max: 100 })
  const exactVariantMatch = input?.exactVariantMatch
  const embeddingAllowed = input?.embeddingAllowed
  if (reviewDecision === 'approved' && (
    linkStatus !== 'healthy'
    || exactVariantMatch !== true
    || embeddingAllowed !== true
    || quality == null
    || quality < 80
  )) {
    throw new RangeError(
      'Approval requires a healthy link, allowed embedding, exact variant match, and demonstration quality of at least 80.',
    )
  }
  const result = await pool.query(
    `UPDATE coaching.exercise_media_candidate_v1 media
     SET review_status=$6,
         link_status=$7,
         exact_variant_match=$8,
         embedding_allowed=$9,
         demonstration_quality_score=$10,
         captions_available=COALESCE($11, captions_available),
         reviewer_user_id=$5,
         reviewed_at=now(),
         next_review_at=CASE
           WHEN $6='approved' THEN now() + interval '90 days'
           ELSE next_review_at
         END,
         notes=CASE
           WHEN NULLIF(btrim($12), '') IS NULL THEN notes
           ELSE concat_ws(E'\\n', notes, 'Reviewer note: ' || btrim($12))
         END,
         updated_at=now()
     FROM coaching.exercise_definition_v1 definition
     WHERE media.id=$1
       AND media.definition_id=$2
       AND media.reviewed_card_version=$3
       AND definition.id=media.definition_id
       AND definition.facility_id=$4
       AND definition.status!='archived'
       AND definition.card_version=$3
     RETURNING media.*`,
    [
      uuid(mediaCandidateId, 'mediaCandidateId'),
      uuid(definitionId, 'definitionId'),
      integer(input?.expectedCardVersion, 'expectedCardVersion'),
      integer(facilityId, 'facilityId'),
      integer(reviewerUserId, 'reviewerUserId'),
      reviewDecision,
      linkStatus,
      typeof exactVariantMatch === 'boolean' ? exactVariantMatch : null,
      typeof embeddingAllowed === 'boolean' ? embeddingAllowed : null,
      quality,
      typeof input?.captionsAvailable === 'boolean' ? input.captionsAvailable : null,
      String(input?.notes ?? ''),
    ],
  )
  if (result.rows.length !== 1) {
    throw notFound('Current-version media candidate not found.')
  }
  return result.rows[0]
}

export async function reviewCanonicalAlternateAssessment(
  pool,
  facilityId,
  definitionId,
  alternateAssessmentId,
  reviewerUserId,
  input,
) {
  const reviewDecision = decision(input?.decision, ['reviewed', 'approved', 'rejected'])
  const result = await pool.query(
    `UPDATE coaching.exercise_alternate_assessment_v1 alternate
     SET review_status=$6,
         reviewer_user_id=$5,
         reviewed_at=now(),
         updated_at=now()
     FROM coaching.exercise_definition_v1 definition
     WHERE alternate.id=$1
       AND alternate.definition_id=$2
       AND alternate.reviewed_card_version=$3
       AND definition.id=alternate.definition_id
       AND definition.facility_id=$4
       AND definition.status!='archived'
       AND definition.card_version=$3
     RETURNING alternate.*`,
    [
      uuid(alternateAssessmentId, 'alternateAssessmentId'),
      uuid(definitionId, 'definitionId'),
      integer(input?.expectedCardVersion, 'expectedCardVersion'),
      integer(facilityId, 'facilityId'),
      integer(reviewerUserId, 'reviewerUserId'),
      reviewDecision,
    ],
  )
  if (result.rows.length !== 1) {
    throw notFound('Current-version alternate assessment not found.')
  }
  return result.rows[0]
}
