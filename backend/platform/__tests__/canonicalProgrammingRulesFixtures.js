import { canonicalProgrammingRuleSourceHash } from '../canonicalProgrammingRulesContract.js'
import { canonicalProgrammingReviewRubric } from '../canonicalProgrammingRuleReview.js'
import { executionActivity } from './workoutProgrammingExecutionFixtures.js'
import { rosterRequest, evidenceFixtures, evidencePool } from './workoutAthleteEvidenceFixtures.js'
import { withCoachingLibrarySnapshot } from '../coachingLibraryContext.js'
import { loadWorkoutAthleteEvidence } from '../workoutAthleteEvidence.js'
import { SCOPE } from './workoutProgrammingLibrarianFixtures.js'

// Synthetic approved mappings only. This helper never writes a library record.
export function attachRules(card, programming, rules, bindings) {
  card.approvedBy = '7'
  card.programming = { ...programming, executionRules: { schemaVersion: '1.0.0', rules,
    bindings: Object.entries(bindings).map(([field, ruleIds]) => ({ field, ruleIds,
      sourceHash: canonicalProgrammingRuleSourceHash(programming, field), interpretation: 'Synthetic reviewed interpretation for deterministic contract testing.' })) } }
  const stamp = canonicalProgrammingReviewRubric({ variants: [{ id: card.variantId, programming: card.programming }] })
  card.programmingRulesReview = { reviewId: '9001', reviewedCardVersion: card.cardVersion,
    reviewerUserId: String(card.approvedBy), sourceHash: stamp.programmingExecutionRules.byVariant[card.variantId] }
  return card
}
export const landingRule = (patch = {}) => ({ id: 'landing-control', type: 'athlete_observation', prerequisite: 'controlled_landing',
  purpose: 'current_readiness', providesFact: 'deceleration_ready', sourceKind: 'skill_progress', selector: { exerciseId: '1' },
  field: 'score', operator: 'gte', value: 4, scaleMaximum: 5, maxAgeDays: 0, requireCoachObservation: true, ...patch })
export async function ruleFixtures(componentKey = 'strength') {
  const base = rosterRequest()
  const request = rosterRequest({ logistics: { ...base.logistics, sessionStartsAt: '2026-09-12T20:00:00Z' },
    athletes: [{ ...base.athletes[0], evidenceReferences: ['101', '102'].map((memberId, index) => ({ kind: 'skill_progress', id: String(71 + index), memberId })) }] })
  const source = evidenceFixtures()
  source['skill_progress:explicit'] = ['101', '102'].map((member_id, index) => ({ id: String(71 + index), member_id,
    observed_at: '2026-09-12T13:00:00.000000Z', source_count: 1,
    data: { exerciseId: '1', score: 4, maxScore: 5, coachUserId: '7', sourceType: 'skill_observation' } }))
  source['completion_log:history'][0].data.exerciseId = '1'
  const reload = () => withCoachingLibrarySnapshot(evidencePool(source), SCOPE, (client, scope) => loadWorkoutAthleteEvidence(client, scope, request))
  const activity = executionActivity(componentKey, 1, request)
  attachRules(activity.card, { prerequisites: ['controlled_landing'], uncertaintyPolicy: 'Require observed controlled landing for every athlete today.' },
    [landingRule()], { prerequisites: ['landing-control'], uncertaintyPolicy: ['landing-control'] })
  return { activity, request, source, reload, athleteEvidence: await reload() }
}
