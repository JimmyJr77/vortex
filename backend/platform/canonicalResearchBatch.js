import { validateResearchPacket } from './canonicalResearchReview.js'

function replaceVariables(value, variables) {
  if (typeof value === 'string') {
    return value.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (_match, key) => (
      variables[key] == null ? `{{${key}}}` : String(variables[key])
    ))
  }
  if (Array.isArray(value)) return value.map((item) => replaceVariables(item, variables))
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, replaceVariables(item, variables)]),
    )
  }
  return value
}

export function compileResearchEvidence(sharedEvidence, cardEvidence, sourceRegistry, variables = {}) {
  const bySection = new Map()
  for (const entry of [...(sharedEvidence ?? []), ...(cardEvidence ?? [])]) {
    bySection.set(entry.sectionKey, entry)
  }
  return [...bySection.values()].map((entry) => {
    const source = sourceRegistry?.[entry.sourceKey]
    if (!source) throw new RangeError(`Unknown research source key: ${entry.sourceKey}`)
    return replaceVariables({
      sectionKey: entry.sectionKey,
      sourceUrl: source.url,
      sourceTitle: source.title,
      sourcePublisher: source.publisher,
      sourceKind: source.kind,
      evidenceQuality: entry.evidenceQuality ?? source.evidenceQuality,
      claims: entry.claims,
    }, variables)
  })
}

export function buildResearchPacketFromBatch({
  facilityId,
  researchVersion,
  sharedEvidence,
  sourceRegistry,
  cardSpec,
  currentCard,
  mediaCandidates,
}) {
  const variables = {
    slug: currentCard.slug,
    canonicalName: currentCard.canonicalName,
    familyKey: currentCard.familyKey,
  }
  const evidence = compileResearchEvidence(
    sharedEvidence,
    cardSpec.evidence,
    sourceRegistry,
    variables,
  )
  const selectedMediaCandidates = Array.isArray(cardSpec.mediaCandidates)
    ? replaceVariables(cardSpec.mediaCandidates, variables)
    : mediaCandidates
  const packet = {
    facilityId,
    slug: currentCard.slug,
    researchVersion,
    assessmentSummary: replaceVariables({
      ...cardSpec.assessmentSummary,
      currentCardSnapshot: currentCard.snapshot,
    }, variables),
    evidence,
    mediaCandidates: selectedMediaCandidates.slice(0, 5).map((candidate) => ({
      url: candidate.url,
      title: candidate.title ?? null,
      channelName: candidate.channelName ?? null,
      sourceQuery: candidate.sourceQuery ?? 'family research candidate',
      linkStatus: candidate.linkStatus ?? 'unverified',
      embeddingAllowed: candidate.embeddingAllowed === true,
      externalVerification: candidate.externalVerification ?? null,
      notes: candidate.notes
        ?? 'Candidate discovered for human review; availability, embedding, exact-version match, content, accessibility, and demonstration quality remain pending.',
    })),
    alternateAssessments: replaceVariables(cardSpec.alternateAssessments, variables),
  }
  return {
    packet,
    validation: validateResearchPacket(packet),
  }
}
