import { quarantineAiExerciseCardDraft } from '../canonicalAiCardDraft.js'
import { proposalRegistry, syntheticGapDraft } from './workoutExerciseProposalFixtures.js'

export function stagedSourceFixture(state) {
  const row = state.rows.find((entry) => entry.phase_key === 'output')
  const raw = syntheticGapDraft({ phaseKey: row.phase_key, unmetDemand: { canonicalName: row.canonical_name, familyKey: row.family_key,
    movementPatterns: row.movement_patterns, bodyRegions: row.body_regions, requiredEquipment: row.required_equipment } })
  raw.slug = row.slug; raw.variants[0].variantKey = row.variant_key; raw.variants[0].profiles[0].profileKey = row.profile_key
  const card = quarantineAiExerciseCardDraft(raw, { modelVersion: 'synthetic-source-only' }).draft
  return { ...card, id: row.definition_id, cardVersion: 1, status: 'published', createdBy: 7, approvedBy: 8, reviewedBy: 8,
    updatedAt: new Date('2026-01-01T00:00:00Z'), reviews: [], revisions: [], relationships: [], mediaReview: null,
    variants: [{ ...card.variants[0], id: row.variant_id, status: 'published', profiles: [{ ...card.variants[0].profiles[0], id: row.profile_id, status: 'published' }] }] }
}

export function stagedProposalRegistry(state) {
  const row = state.rows.find((entry) => entry.phase_key === 'output')
  return proposalRegistry({ judge(output) {
    output.proposedKind = 'missing_delivery_profile'; output.targetDefinitionId = row.definition_id; output.targetVariantId = row.variant_id
    output.alternatives.find((entry) => entry.definitionId === row.definition_id).disposition = 'missing_delivery_profile'
  } }).registry
}
