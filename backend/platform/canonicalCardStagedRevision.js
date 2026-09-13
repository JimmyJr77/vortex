import { randomUUID } from 'node:crypto'
import { loadCanonicalCard, canonicalCardControlledTaxonomyIssues, withCanonicalCardTransaction } from './canonicalCardRepository.js'
import { validateCanonicalCardDraft, evaluateCanonicalCardReadiness, buildCanonicalCardTestPacket } from './canonicalCardAuthoring.js'
import { libraryScopeId, withCoachingLibrarySnapshot } from './coachingLibraryContext.js'
import { immutableProgrammingValue, programmingValueHash } from './workoutProgrammingRequest.js'
import { ProgrammingStaffError } from './programmingStaffRuntime.js'
import { exerciseCardDraftSchema, canonicalAiDraftOutputContract } from './canonicalAiCardDraftContract.js'

const workflow = 'canonical_card_staged_revision_v1'
const fail = (code, message) => { throw new ProgrammingStaffError(code, message) }
const clone = (value) => JSON.parse(JSON.stringify(value))
const uuid = (value) => {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new TypeError('A staged revision UUID is required')
  return value.toLowerCase()
}

/** Exclude derived reports and revision events so staging cannot invalidate its own source. */
export function canonicalStagedSourceCard(raw) {
  const { readiness, testPacket, duplicateCandidates, revisions, ...card } = clone(raw)
  const ordered = (rows) => [...rows].sort((left, right) => String(left.id ?? programmingValueHash(left)).localeCompare(String(right.id ?? programmingValueHash(right))))
  // Evidence and taxonomy records are sets. SQL joins may return equal-sort-key
  // rows in a different order even when their content is unchanged.
  for (const key of ['reviews', 'relationships']) if (card[key]) card[key] = ordered(card[key])
  for (const subject of [card, ...(card.variants ?? []), ...(card.variants ?? []).flatMap((variant) => variant.profiles)]) {
    if (subject.taxonomyV2) for (const kind of ['assignments', 'decisions']) {
      if (subject.taxonomyV2[kind]) subject.taxonomyV2[kind] = ordered(subject.taxonomyV2[kind])
    }
  }
  return card
}

function unreviewedProfile(raw, actorUserId) {
  const profile = clone(raw)
  if (profile.taxonomyV2) for (const kind of ['assignments', 'decisions']) {
    profile.taxonomyV2[kind] = (profile.taxonomyV2[kind] ?? []).map((entry) => ({ ...entry, id: null,
      reviewStatus: 'suggested', createdBy: actorUserId, reviewedBy: null, reviewedAt: null,
      provenance: { sourceType: 'canonical_staged_revision', proposedBy: actorUserId, approvalCreated: false, humanReviewRequired: true } }))
  }
  return profile
}

function candidateCard(source, target, rawProfile, actorUserId) {
  if (source.status !== 'published' || !Number.isInteger(source.cardVersion) || source.cardVersion < 1) {
    fail('canonical_revision_source_changed', 'Stage a revision against an exact published canonical card version.')
  }
  const variant = source.variants.find((entry) => entry.id === target.variantId)
  if (!variant || variant.status !== 'published') fail('canonical_revision_source_changed', 'The exact published source variant is unavailable.')
  if (variant.profiles.some((entry) => entry.profileKey === target.profileKey || entry.phaseKey === target.phaseKey)) {
    fail('canonical_revision_profile_conflict', 'The source already has this profile key or delivery phase. Review its existing profiles.')
  }
  if (rawProfile.id != null || rawProfile.profileKey !== target.profileKey || rawProfile.phaseKey !== target.phaseKey || rawProfile.role !== 'primary') {
    throw new TypeError('Retain the staged profile identity, phase and primary role')
  }
  const draft = { ...clone(source), cardVersion: source.cardVersion + 1, status: 'draft', reviewedBy: null, approvedBy: null,
    mediaReview: null, reviews: [], variants: source.variants.map((entry) => entry.id === target.variantId
      ? { ...clone(entry), profiles: [...clone(entry.profiles), unreviewedProfile(rawProfile, actorUserId)] } : clone(entry)) }
  const validation = validateCanonicalCardDraft(draft)
  if (!validation.valid) throw Object.assign(new TypeError('The staged canonical profile is invalid.'), { details: validation })
  // Normalize only the new profile; all existing card/variant/profile data remains exact.
  const profile = validation.normalized.variants.find((entry) => entry.id === target.variantId).profiles.at(-1)
  const dose = profile.dosage
  if (!Array.isArray(dose.sets) || dose.sets.length !== 2 || dose.sets.some((value) => !Number.isInteger(value) || value < 1) || dose.sets[0] > dose.sets[1]
    || dose.reps != null && (!Array.isArray(dose.reps) || dose.reps.length !== 2 || dose.reps.some((value) => !Number.isInteger(value) || value < 1) || dose.reps[0] > dose.reps[1])
    || dose.workSeconds != null && (!Number.isInteger(dose.workSeconds) || dose.workSeconds < 1)
    || dose.reps == null && dose.workSeconds == null || !Number.isInteger(dose.restSeconds) || dose.restSeconds < 0) {
    throw new TypeError('Use ordered positive set/repetition ranges, repetitions or work time, and nonnegative rest time')
  }
  // Use the existing proposal dose bounds, expressed through the same shared
  // schema parser, rather than introduce a separate set of staging limits.
  const doseSchema = exerciseCardDraftSchema({ movementPatterns: [], bodyRegions: [], equipment: [] }).properties.variants.items.properties.profiles.items.properties.dosage
  canonicalAiDraftOutputContract(doseSchema).parseOutput({ setsMin: dose.sets[0], setsMax: dose.sets[1],
    repsMin: dose.reps?.[0] ?? null, repsMax: dose.reps?.[1] ?? null, workSeconds: dose.workSeconds ?? null, restSeconds: dose.restSeconds })
  draft.variants.find((entry) => entry.id === target.variantId).profiles.splice(-1, 1, profile)
  return draft
}

async function evaluateCandidate(client, source, card) {
  const taxonomy = await canonicalCardControlledTaxonomyIssues(client, card)
  if (Object.values(taxonomy).some((keys) => keys.length)) throw new TypeError('The staged revision contains uncontrolled taxonomy keys')
  // A new card version requires its own media evidence. Source approvals are
  // retained in the baseline for audit, but never promoted into staged approval.
  return { readiness: evaluateCanonicalCardReadiness(card, { mediaReview: null }),
    testPacket: buildCanonicalCardTestPacket(card, { mediaReview: null, relationships: source.relationships, invalidTaxonomyKeys: [] }) }
}

function parseEvent(row, scope) {
  if (!row) return null
  if (row.snapshot_json?.workflow !== workflow) fail('canonical_revision_audit_conflict', 'This staged revision uses an unsupported or damaged event contract.')
  const { contentHash, ...content } = row.snapshot_json
  if (content.schemaVersion !== '1.0.0' || content.facilityId !== scope.facilityId || content.eventId !== String(row.id)
    || content.stagedRevisionId !== String(row.staged_revision_id) || content.definitionId !== String(row.definition_id)
    || content.source.cardVersion !== Number(row.source_card_version) || content.state !== row.to_status || content.action !== row.action
    || row.actor_user_id != null && content.actorUserId !== String(row.actor_user_id)
    || programmingValueHash(content) !== contentHash || programmingValueHash(content.sourceCard) !== content.source.contentHash) {
    fail('canonical_revision_audit_conflict', 'The staged revision does not match its immutable source and event history.')
  }
  return immutableProgrammingValue({ ...row.snapshot_json, revisionNumber: Number(row.revision_number), createdAt: new Date(row.created_at).toISOString() })
}

export async function readStagedCanonicalRevisionInTransaction(client, scope, stagedRevisionId) {
  const id = uuid(stagedRevisionId)
  const result = await client.query(`SELECT * FROM coaching.exercise_card_revision_v1
    WHERE facility_id=$1 AND staged_revision_id=$2 ORDER BY revision_number DESC LIMIT 1`, [scope.facilityId, id])
  return parseEvent(result.rows[0], scope)
}

export async function findStagedCanonicalRevisionForProposal(client, scope, draftAuditId, proposalHash) {
  const result = await client.query(`SELECT * FROM coaching.exercise_card_revision_v1
    WHERE facility_id=$1 AND staged_revision_id IS NOT NULL AND snapshot_json #>> '{origin,draftAuditId}'=$2
    ORDER BY revision_number DESC LIMIT 1`, [scope.facilityId, uuid(draftAuditId)])
  const event = parseEvent(result.rows[0], scope)
  if (event && event.origin.proposalHash !== proposalHash) fail('canonical_revision_audit_conflict', 'This staged revision references different proposal content.')
  return event
}

async function appendEvent(client, content, fromStatus, changeSummary) {
  const envelope = { ...content, contentHash: programmingValueHash(content) }
  const result = await client.query(`INSERT INTO coaching.exercise_card_revision_v1 (
    id,definition_id,facility_id,revision_number,action,from_status,to_status,snapshot_json,change_summary,actor_user_id,staged_revision_id,source_card_version)
    SELECT $1,$2,$3,COALESCE(MAX(revision_number),0)+1,$4,$5,$6,$7::jsonb,$8,$9,$10,$11
    FROM coaching.exercise_card_revision_v1 WHERE definition_id=$2 RETURNING *`,
  [content.eventId, content.definitionId, content.facilityId, content.action, fromStatus, content.state, JSON.stringify(envelope), changeSummary,
    content.actorUserId, content.stagedRevisionId, content.source.cardVersion])
  return parseEvent(result.rows[0], { facilityId: content.facilityId })
}

/** Internal: the caller must freshly verify the server-recorded ExerciseGap in this transaction. */
export async function stageCanonicalDeliveryProfileInTransaction(client, scope, sourceCard, proposal, origin) {
  if (proposal.kind !== 'delivery_profile' || sourceCard.id !== proposal.target.exerciseCardId || sourceCard.cardVersion !== proposal.target.cardVersion) {
    fail('canonical_revision_source_changed', 'The proposal must target this exact source card and version.')
  }
  const source = canonicalStagedSourceCard(sourceCard)
  const target = { variantId: proposal.target.variantId, profileKey: proposal.profile.profileKey, phaseKey: proposal.profile.phaseKey }
  const card = candidateCard(source, target, proposal.profile, scope.userId)
  const reports = await evaluateCandidate(client, source, card)
  const id = randomUUID()
  return appendEvent(client, { schemaVersion: '1.0.0', workflow, stagedRevisionId: id, eventId: id, parentEventId: null,
    definitionId: source.id, facilityId: scope.facilityId, source: { cardVersion: source.cardVersion, contentHash: programmingValueHash(source) }, sourceCard: source,
    target, origin, card, ...reports, state: 'draft', action: 'revision_staged', actorUserId: scope.userId, contributorUserIds: [scope.userId],
    humanReviewRequired: true, libraryApprovalGranted: false }, source.status, 'Staged a proposed delivery profile for human review; the published card is unchanged.')
}

async function liveSource(client, scope, event) {
  const source = await loadCanonicalCard(client, scope.facilityId, event.definitionId, client)
  return { source, matches: !!source && source.status === 'published'
    && programmingValueHash(canonicalStagedSourceCard(source)) === event.source.contentHash }
}

export async function loadStagedCanonicalRevision(pool, context, id) {
  uuid(id)
  return withCoachingLibrarySnapshot(pool, context, async (client, scope) => {
    const event = await readStagedCanonicalRevisionInTransaction(client, scope, id)
    if (!event) return null
    const live = await liveSource(client, scope, event)
    return immutableProgrammingValue({ event, sourceMatches: live.matches,
      liveSourceVersion: live.source?.cardVersion ?? null, liveSourceStatus: live.source?.status ?? null })
  })
}

const profileFields = new Set(['id', 'profileKey', 'phaseKey', 'role', 'purpose', 'phaseSuitability', 'methodologyAlignment', 'objectiveRelevance', 'dosage',
  'qualityGate', 'stopRules', 'coachInstructions', 'athleteInstructions', 'expectedAdaptation', 'equipmentRequired', 'logistics', 'timeModel', 'doseScaling',
  'measurement', 'supportPrompts', 'taxonomyV2'])

export function normalizeStagedCanonicalRevisionChange(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).some((key) => !['expectedEventHash', 'action', 'profile', 'changeSummary'].includes(key))
    || typeof raw.expectedEventHash !== 'string' || !/^[a-f0-9]{64}$/.test(raw.expectedEventHash)
    || !['edit', 'submit', 'return', 'archive'].includes(raw.action) || typeof raw.changeSummary !== 'string' || raw.changeSummary.trim().length < 10 || raw.changeSummary.length > 2000) {
    throw new TypeError('Provide the current event hash, an allowed revision action and a change summary of 10–2000 characters')
  }
  if (raw.action === 'edit') {
    if (!raw.profile || typeof raw.profile !== 'object' || Array.isArray(raw.profile) || Object.keys(raw.profile).some((key) => !profileFields.has(key))) {
      throw new TypeError('Edit only the proposed canonical delivery profile fields')
    }
  } else if (raw.profile !== undefined) throw new TypeError('Only an edit action accepts profile content')
  return clone(raw)
}

/** Human changes append immutable staged events; no canonical definition/profile is written. */
export async function changeStagedCanonicalRevision(pool, context, id, rawInput) {
  uuid(id)
  const input = normalizeStagedCanonicalRevisionChange(rawInput)
  const scope = { facilityId: libraryScopeId(context.facilityId, 'facilityId'), userId: libraryScopeId(context.userId, 'userId') }
  try { return await withCanonicalCardTransaction(pool, scope.facilityId, async (client) => {
    const current = await readStagedCanonicalRevisionInTransaction(client, scope, id)
    if (!current) return null
    if (current.contentHash !== input.expectedEventHash) fail('canonical_revision_conflict', 'The staged revision changed. Reopen it before continuing.')
    if (current.state === 'archived' || input.action === 'submit' && current.state !== 'draft' || input.action === 'return' && current.state !== 'review') {
      fail('canonical_revision_transition', 'This action is unavailable in the current staged revision state.')
    }
    const live = await liveSource(client, scope, current)
    if (!live.matches && input.action !== 'archive') fail('canonical_revision_source_changed', 'The published source changed. Research the current card before revising this proposal.')
    const { contentHash, revisionNumber, createdAt, ...previous } = current
    const card = input.action === 'edit' ? candidateCard(current.sourceCard, current.target, input.profile, scope.userId) : current.card
    const reports = input.action === 'edit' || input.action === 'submit' ? await evaluateCandidate(client, current.sourceCard, card)
      : { readiness: current.readiness, testPacket: current.testPacket }
    const state = input.action === 'archive' ? 'archived' : input.action === 'submit' ? 'review' : 'draft'
    return appendEvent(client, { ...previous, eventId: randomUUID(), parentEventId: current.eventId, card, ...reports, state,
      action: { edit: 'revision_edited', submit: 'revision_submitted', return: 'revision_returned', archive: 'revision_archived' }[input.action],
      actorUserId: scope.userId, contributorUserIds: input.action === 'edit' ? [...new Set([...current.contributorUserIds, scope.userId])] : current.contributorUserIds },
    current.state, input.changeSummary.trim())
  }, { repeatableRead: true }) } catch (error) {
    if (['40001', '23505'].includes(error.code)) fail('canonical_revision_conflict', 'The staged revision changed concurrently. Reopen it before continuing.')
    throw error
  }
}
