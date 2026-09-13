import { assertIndependentReviewer, normalizeCanonicalMediaReviewInput, CANONICAL_MEDIA_REVIEW_DAYS,
  evaluateCanonicalCardReadiness, buildCanonicalCardTestPacket } from './canonicalCardAuthoring.js'
import { normalizeTaxonomyV2ReviewInput, normalizeTaxonomyV2Assignment, normalizeTaxonomyV2Decision } from './taxonomyV2.js'
import { canonicalProgrammingReviewRubric } from './canonicalProgrammingRuleReview.js'
import { canonicalCardControlledTaxonomyIssues } from './canonicalCardRepository.js'
import { programmingValueHash } from './workoutProgrammingRequest.js'
import { ProgrammingStaffError } from './programmingStaffRuntime.js'

const fail = (code, message) => { throw new ProgrammingStaffError(code, message) }
const object = (value) => value && typeof value === 'object' && !Array.isArray(value)
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const clone = (value) => JSON.parse(JSON.stringify(value))
const fields = {
  taxonomy: ['recordType', 'facetType', 'termKey', 'outcome'],
  media: ['url', 'exactVariantMatch', 'demonstrationQualityScore', 'linkStatus', 'reviewBasis'],
  card: ['decision', 'rubric'],
}

export function normalizeStagedCanonicalReviewInput(raw) {
  if (!object(raw) || !Object.hasOwn(fields, raw.kind) || !hash(raw.expectedEventHash)
    || Object.keys(raw).some((key) => !['kind', 'expectedEventHash', 'notes', ...fields[raw.kind]].includes(key))
    || typeof raw.notes !== 'string' || raw.notes.trim().length < 20 || raw.notes.length > 2000) {
    throw new TypeError('Provide a review kind, the current event hash and 20–2000 characters of observed evidence.')
  }
  if (raw.kind === 'taxonomy') {
    normalizeTaxonomyV2ReviewInput(raw)
    if (!['assignment', 'decision'].includes(raw.recordType) || typeof raw.facetType !== 'string' || !raw.facetType
      || raw.recordType === 'assignment' && (typeof raw.termKey !== 'string' || !raw.termKey)
      || raw.recordType === 'decision' && raw.termKey != null) throw new TypeError('Select one exact proposed taxonomy assignment or decision.')
  }
  if (raw.kind === 'media') {
    if (typeof raw.url !== 'string' || typeof raw.exactVariantMatch !== 'boolean' || typeof raw.demonstrationQualityScore !== 'number') {
      throw new TypeError('Provide the observed media URL, exact-match result and quality score.')
    }
    normalizeCanonicalMediaReviewInput({ approvedVideoUrl: raw.url.trim() }, raw)
  }
  if (raw.kind === 'card' && (!['approve', 'request_changes'].includes(raw.decision) || raw.rubric !== undefined && !object(raw.rubric))) {
    throw new TypeError('Choose approve or request_changes and use an object for the review rubric.')
  }
  return { ...clone(raw), notes: raw.notes.trim() }
}

export function stagedCanonicalCandidateHash(event) {
  return programmingValueHash({ facilityId: event.facilityId, stagedRevisionId: event.stagedRevisionId, definitionId: event.definitionId,
    origin: event.origin, source: event.source, target: event.target, card: event.card, contributorUserIds: event.contributorUserIds })
}

export function stagedCanonicalProfile(event, card = event.card) {
  const profile = card.variants.find((variant) => variant.id === event.target.variantId)?.profiles.find((entry) => entry.profileKey === event.target.profileKey)
  if (!profile) fail('canonical_revision_audit_conflict', 'The staged candidate no longer contains its exact proposed profile.')
  return profile
}

export function assertStagedIndependentReviewer(event, userId) {
  for (const author of new Set([event.sourceCard.createdBy, ...event.contributorUserIds])) {
    try { assertIndependentReviewer(author, userId, 'staged revision') }
    catch { fail('canonical_revision_independent_review', 'A different coach from the source author and every staged editor must review this revision.') }
  }
}

const subjectKey = (review) => review.kind === 'taxonomy'
  ? `taxonomy:${review.details.recordType}:${review.details.facetType}:${review.details.termKey ?? ''}` : review.kind
export const replaceStagedReviewEvidence = (previous, evidence) => [
  ...previous.filter((entry) => subjectKey(entry) !== subjectKey(evidence)), evidence,
]

function taxonomySubject(event, input) {
  const block = stagedCanonicalProfile(event).taxonomyV2 ?? { assignments: [], decisions: [] }
  const record = (input.recordType === 'assignment' ? block.assignments : block.decisions).find((entry) => entry.facetType === input.facetType
    && (input.recordType === 'decision' || entry.key === input.termKey))
  if (!record) throw new TypeError('Review an existing classification on the proposed profile; source classifications are fixed.')
  if (input.recordType === 'assignment') normalizeTaxonomyV2Assignment(record)
  else normalizeTaxonomyV2Decision(record)
  return record
}

/** Stored evidence is server-owned and tied to content, contributors and an immutable event. */
export function currentStagedReviewEvidence(event) {
  const candidateHash = stagedCanonicalCandidateHash(event)
  const evidence = event.reviewEvidence ?? []
  if (!Array.isArray(evidence)) fail('canonical_revision_audit_conflict', 'Invalid staged review evidence.')
  const seen = new Set()
  for (const review of evidence) {
    if (!object(review) || review.schemaVersion !== '1.0.0' || review.candidateHash !== candidateHash || !Object.hasOwn(fields, review.kind)
      || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(review.reviewEventId ?? '') || !/^[1-9][0-9]*$/.test(review.reviewerUserId ?? '')
      || !Number.isFinite(Date.parse(review.reviewedAt)) || typeof review.notes !== 'string' || review.notes.trim().length < 20 || !object(review.details)) {
      fail('canonical_revision_audit_conflict', 'Review evidence does not match the exact staged content.')
    }
    assertStagedIndependentReviewer(event, review.reviewerUserId)
    const key = subjectKey(review)
    if (seen.has(key)) fail('canonical_revision_audit_conflict', 'The staged revision contains conflicting current review records.')
    seen.add(key)
    if (review.kind === 'taxonomy') {
      if (!['assignment', 'decision'].includes(review.details.recordType)) fail('canonical_revision_audit_conflict', 'Invalid taxonomy review subject.')
      taxonomySubject(event, review.details)
      if (!['approved', 'rejected'].includes(review.details.outcome)) fail('canonical_revision_audit_conflict', 'Invalid taxonomy review evidence.')
    }
    if (review.kind === 'media') {
      normalizeCanonicalMediaReviewInput(event.card, { ...review.details, notes: review.notes })
      if (review.details.reviewedCardVersion !== event.card.cardVersion || !Number.isFinite(Date.parse(review.details.nextReviewAt))) {
        fail('canonical_revision_audit_conflict', 'Media review evidence does not match the proposed card version.')
      }
    }
    if (review.kind === 'card' && (!['approve', 'request_changes'].includes(review.details.decision) || !hash(review.details.evidenceHash))) {
      fail('canonical_revision_audit_conflict', 'Invalid card-version review evidence.')
    }
  }
  return evidence
}

/** Reuse canonical gates on a derived candidate; never mutate the unapproved candidate or live card. */
export async function evaluateStagedCanonicalReview(client, event, now = new Date()) {
  const evidence = currentStagedReviewEvidence(event)
  const candidateHash = stagedCanonicalCandidateHash(event)
  const evidenceHash = programmingValueHash(evidence.filter((entry) => entry.kind !== 'card').sort((a, b) => subjectKey(a).localeCompare(subjectKey(b))))
  const card = clone(event.card)
  const profile = stagedCanonicalProfile(event, card)
  const extraIssues = []
  for (const [kind, values] of Object.entries(profile.taxonomyV2 ?? {})) {
    if (!['assignments', 'decisions'].includes(kind)) continue
    for (const record of values) {
      const reviewed = evidence.find((entry) => entry.kind === 'taxonomy' && entry.details.recordType === (kind === 'assignments' ? 'assignment' : 'decision')
        && entry.details.facetType === record.facetType && (kind === 'decisions' || entry.details.termKey === record.key))
      record.reviewStatus = reviewed?.details.outcome ?? 'suggested'
      record.reviewedBy = reviewed?.reviewerUserId ?? null; record.reviewedAt = reviewed?.reviewedAt ?? null
      if (record.reviewStatus !== 'approved') extraIssues.push({ code: 'staged_taxonomy_review', path: `proposedProfile.taxonomyV2.${record.facetType}`,
        message: `The proposed ${record.facetType}${record.key ? `:${record.key}` : ''} ${kind === 'assignments' ? 'assignment' : 'decision'} requires independent approval.` })
    }
  }
  const subjects = [{ scope: 'definition', value: card }, ...card.variants.map((value) => ({ scope: 'variant', value })),
    ...card.variants.flatMap((variant) => variant.profiles.map((value) => ({ scope: 'delivery_profile', value })))]
  const assignments = [...new Map(subjects.flatMap(({ scope, value }) => (value.taxonomyV2?.assignments ?? []).map((entry) =>
    [`${scope}:${entry.facetType}:${entry.key}`, { subject_scope: scope, facet_type: entry.facetType, key: entry.key }]))).values()]
  const invalidTerms = []
  if (assignments.length) {
    const result = await client.query(`/* staged_revision_taxonomy_terms */ SELECT requested.subject_scope,term.facet_type,term.key
      FROM jsonb_to_recordset($1::jsonb) AS requested(subject_scope text,facet_type text,key text)
      JOIN coaching.taxonomy_term_v2 term ON term.facet_type=requested.facet_type AND term.key=requested.key
      WHERE term.status='active' AND requested.subject_scope=ANY(term.allowed_scopes)`, [JSON.stringify(assignments)])
    const controlled = new Set(result.rows.map((row) => `${row.subject_scope}:${row.facet_type}:${row.key}`))
    for (const entry of assignments) if (!controlled.has(`${entry.subject_scope}:${entry.facet_type}:${entry.key}`)) invalidTerms.push(entry)
  }
  for (const term of invalidTerms) extraIssues.push({ code: 'staged_taxonomy_term', path: `taxonomyV2.${term.subject_scope}`,
    message: `${term.facet_type}:${term.key} is unavailable for ${term.subject_scope} classification in the current registry.` })
  const media = evidence.find((entry) => entry.kind === 'media')
  const mediaReview = media && Date.parse(media.details.nextReviewAt) > now.getTime() && Date.parse(media.reviewedAt) <= now.getTime()
    ? { ...media.details, reviewerUserId: media.reviewerUserId, reviewedAt: media.reviewedAt } : null
  const invalidLegacy = await canonicalCardControlledTaxonomyIssues(client, card)
  const legacyKeys = Object.entries(invalidLegacy).flatMap(([key, values]) => values.map((value) => `${key}:${value}`))
  for (const key of legacyKeys) extraIssues.push({ code: 'invalid_taxonomy', path: 'taxonomy', message: `${key} is not in the current controlled vocabulary.` })
  const invalidTaxonomyKeys = [...invalidTerms.map((term) => `${term.subject_scope}:${term.facet_type}:${term.key}`), ...legacyKeys]
  const readiness = evaluateCanonicalCardReadiness(card, { mediaReview })
  readiness.issues.push(...extraIssues)
  readiness.ready = readiness.ready && !extraIssues.length && !invalidTaxonomyKeys.length
  const testPacket = buildCanonicalCardTestPacket(card, { mediaReview, relationships: event.sourceCard.relationships, invalidTaxonomyKeys })
  const review = evidence.find((entry) => entry.kind === 'card')
  const approval = event.state === 'review' && readiness.ready && testPacket.status !== 'failed' && review?.details.decision === 'approve'
    && review.details.evidenceHash === evidenceHash ? review : null
  return { candidateHash, evidenceHash, evidence, card, mediaReview, readiness, testPacket, approval }
}

export function createStagedCanonicalReviewEvidence(event, input, reviewerUserId, reviewEventId, evaluated, now = new Date()) {
  assertStagedIndependentReviewer(event, reviewerUserId)
  let details
  if (input.kind === 'taxonomy') {
    taxonomySubject(event, input)
    const { outcome } = normalizeTaxonomyV2ReviewInput(input)
    if (outcome === 'approved' && evaluated.readiness.issues.some((issue) => issue.code === 'staged_taxonomy_term' && issue.path === 'taxonomyV2.delivery_profile'
      && issue.message.startsWith(`${input.facetType}:${input.termKey} `))) throw new TypeError('Approve only a currently controlled delivery-profile taxonomy term.')
    details = { recordType: input.recordType, facetType: input.facetType, termKey: input.termKey ?? null, outcome }
  } else if (input.kind === 'media') {
    const { notes, ...observed } = normalizeCanonicalMediaReviewInput(event.card, input)
    details = { ...observed, reviewedCardVersion: event.card.cardVersion, nextReviewAt: new Date(now.getTime() + CANONICAL_MEDIA_REVIEW_DAYS * 86400000).toISOString() }
  } else {
    if (input.decision === 'approve' && (!evaluated.readiness.ready || evaluated.testPacket.status === 'failed')) {
      fail('canonical_revision_not_ready', 'Only a publication-ready staged card version can be approved. Resolve the current review findings first.')
    }
    details = { decision: input.decision, evidenceHash: evaluated.evidenceHash,
      rubric: input.decision === 'approve' ? canonicalProgrammingReviewRubric(evaluated.card, input.rubric ?? {}) : input.rubric ?? {} }
  }
  return { schemaVersion: '1.0.0', reviewEventId, candidateHash: evaluated.candidateHash, kind: input.kind,
    reviewerUserId, reviewedAt: now.toISOString(), notes: input.notes, details }
}
