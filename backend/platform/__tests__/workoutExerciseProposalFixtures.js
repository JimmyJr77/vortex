import { exerciseGapResearchFixtures } from './workoutExerciseGapFixtures.js'
import { createProgrammingStaffRegistry } from '../programmingStaffRuntime.js'
import { uuid } from './workoutProgrammingLibrarianFixtures.js'

export function syntheticGapDraft(gap) {
  return { canonicalName: gap.unmetDemand.canonicalName, displayName: gap.unmetDemand.canonicalName, slug: 'synthetic-gap-proposal',
    description: 'Synthetic proposed content for quarantine contract verification.', aliases: [], familyKey: gap.unmetDemand.familyKey ?? 'synthetic-family',
    movementPatterns: gap.unmetDemand.movementPatterns, bodyRegions: gap.unmetDemand.bodyRegions, requiredEquipment: gap.unmetDemand.requiredEquipment,
    optionalEquipment: [], contentConfidence: 80, scoringConfidence: 80,
    variants: [{ variantKey: 'synthetic-variant', displayName: 'Synthetic variant', difficulty: { technicalComplexity: 20, absoluteLoadDemand: 20,
      supervisionDemand: 20, failureConsequence: 10, impact: 5, workCapacityDemand: 20 }, profiles: [{
      profileKey: 'synthetic-profile', phaseKey: gap.phaseKey, purpose: 'Synthetic proposal for the researched delivery context.', phaseSuitability: 80, methodologyAlignment: 70,
      dosage: { setsMin: 1, setsMax: 2, repsMin: 3, repsMax: 6, workSeconds: 10, restSeconds: 60 },
      qualityGate: 'Stop when the observed movement quality changes.', stopRules: ['Stop at loss of movement quality.'],
      coachInstructions: 'Coach reviews every proposed instruction and dose before use.', athleteInstructions: 'Practice only as directed by your coach.',
      expectedAdaptation: 'Synthetic adaptation requiring independent coaching review.' }] }],
    assumptions: ['This content is a synthetic test proposal.'], uncertainties: ['This proposal has not received human approval.'] }
}

export function proposalRegistry({ judge = () => {}, creator = () => {}, duringCreator = () => {} } = {}) {
  const calls = []
  const registry = createProgrammingStaffRegistry([
    { id: 'vortex/director', role: 'director', version: 'synthetic-director', async invoke(input) {
      calls.push('director')
      const research = input.research
      const method = research.resources.programming.candidates[0]
      const output = { requestRevision: research.requestRevision, researchHash: research.researchHash,
        summary: 'Synthetic evidence supports a missing movement stimulus.', needAssessment: 'supported', needRationale: 'Synthetic appropriate demand for testing the proposal contracts.',
        questions: [], alternatives: research.relatedDefinitions.map((card) => ({ definitionId: card.id, cardVersion: card.cardVersion,
          disposition: 'different_movement', rationale: 'Synthetic reviewed difference in movement content and stimulus.' })),
        proposedKind: 'missing_movement', targetDefinitionId: null, targetVariantId: null, phaseKey: method.phaseKey, programmingMethodId: method.programmingMethodId }
      judge(output, input)
      return { output, modelVersion: 'synthetic-director', usage: { inputTokens: 50, outputTokens: 100 } }
    } },
    { id: 'vortex/exercise-creator', role: 'exercise_creator', version: 'synthetic-creator', async invoke(input, context) {
      calls.push('creator')
      await duringCreator(input, context)
      const draft = syntheticGapDraft(input.gap)
      const output = input.gap.target ? { profile: draft.variants[0].profiles[0], assumptions: draft.assumptions, uncertainties: draft.uncertainties } : draft
      creator(output, input)
      return { output, modelVersion: 'synthetic-creator', usage: { inputTokens: 200, outputTokens: 300 } }
    } },
  ])
  return { registry, calls }
}

export function proposalFixtures(patch = {}) {
  const source = exerciseGapResearchFixtures(patch)
  const rows = new Map()
  const audit = { rows, calls: [], failInsert: false, beforeInsert: null }
  const pool = { async connect() {
    const client = await source.pool.connect()
    const pending = new Map()
    return { async query(sql, params = []) {
      audit.calls.push({ sql, params })
      if (sql.startsWith('INSERT INTO coaching.exercise_card_ai_draft_audit_v1')) {
        await audit.beforeInsert?.()
        if (audit.failInsert) throw new Error('Synthetic audit write failure')
        const row = { id: uuid(80000 + rows.size + pending.size), created_at: new Date('2026-09-13T00:00:00Z'), facility_id: params[0], user_id: params[1],
          request_hash: params[2], model_version: params[3], status: params[4], draft_json: JSON.parse(params[5]),
          validation_errors_json: JSON.parse(params[6]), input_tokens: params[8], output_tokens: params[9] }
        pending.set(row.id, row)
        return { rows: [row] }
      }
      if (sql.includes('SELECT id,created_at,draft_json FROM coaching.exercise_card_ai_draft_audit_v1')) {
        const row = rows.get(params[0])
        return { rows: row?.facility_id === params[1] ? [row] : [] }
      }
      if (sql === 'COMMIT') for (const [key, value] of pending) rows.set(key, value)
      if (sql === 'ROLLBACK') pending.clear()
      return client.query(sql, params)
    }, release: (error) => client.release(error) }
  } }
  return { ...source, pool, audit, input: { request: source.request, componentKey: 'strength', need: source.need } }
}
