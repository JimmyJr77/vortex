import type { FlipFitCardMatchStatus, FlipFitExerciseCard } from './flipFitProgram'

export interface FlipFitCardReference {
  programCardKey: string
  canonicalDefinitionId: string | null
  canonicalDisplayName: string | null
  canonicalStatus: string | null
  matchStatus: FlipFitCardMatchStatus
  matchReason: string
  matchScore: number | null
  payloadHash: string
  updatedAt: string | null
}

export interface FlipFitCardReconciliationResult {
  cards: FlipFitCardReference[]
  counts: Record<FlipFitCardMatchStatus, number>
}

export function effectiveFlipFitCardStatus(
  card: FlipFitExerciseCard,
  references: ReadonlyMap<string, FlipFitCardReference>,
) {
  return references.get(card.id)?.matchStatus ?? card.matchStatus
}

export function flipFitReferenceCounts(
  cards: FlipFitExerciseCard[],
  references: ReadonlyMap<string, FlipFitCardReference>,
) {
  const counts: Record<FlipFitCardMatchStatus, number> = {
    reused: 0,
    alias: 0,
    new: 0,
    review: 0,
  }
  for (const card of cards) counts[effectiveFlipFitCardStatus(card, references)] += 1
  return counts
}
