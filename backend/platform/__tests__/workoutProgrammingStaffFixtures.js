import { SESSION_PHASE_ORDER } from '../canonicalWorkoutContract.js'
import { libraryCard, libraryPool } from './workoutProgrammingLibrarianFixtures.js'
export function coachRequest(patch = {}) {
  return { requestId: 'coach-request-1', revision: 'revision-1', mode: 'guided',
    athletes: [{ key: 'youth', ageMin: 12, ageMax: 14, athleteCount: 15, trainingExperience: 'intermediate' }],
    logistics: { athleticMinutes: 60, tumblingMinutes: 0, totalBookedMinutes: 60, coachCount: 2, laneCount: 3, stationCount: 3 },
    equipment: { available: ['bodyweight'] }, ...patch }
}
export function staffPool(options = {}) {
  return libraryPool({ cards: SESSION_PHASE_ORDER.map((phase, index) => libraryCard(phase, index + 1)),
    methods: SESSION_PHASE_ORDER.map((phase, index) => ({ id: String(index + 1), name: `${phase} method`, best_session_phase: phase,
      compatible_session_phases: [phase], incompatible_phases: [], definition: 'Fixture reviewed method.' })), ...options })
}
export function directorDecision(input) {
  return { requestRevision: input.request.revision, summary: 'Prioritize explosive quality, then foundational strength with capacity adjusted to remaining fatigue.',
    components: input.resources.map((resource) => {
      const control = input.request.components.find((entry) => entry.key === resource.componentKey)
      const directed = input.request.mode === 'coach_directed' || control.selection === 'directed'
      return { key: resource.componentKey, purpose: `Purpose for ${resource.componentKey}`, rationale: 'Coordinate with earlier loading and subsequent skill demands.',
        preferredExerciseProfileIds: control.lockedExercises.length ? control.lockedExercises.map((ref) => ref.deliveryProfileId)
          : resource.componentKey === 'prepare_and_access' || directed ? [] : [resource.exercises.candidates[0].ref.deliveryProfileId],
        preferredProgrammingMethodIds: control.lockedProgrammingMethodIds.length ? control.lockedProgrammingMethodIds
          : directed ? [] : [resource.programming.candidates[0].programmingMethodId],
      }
    }), watchPoints: ['Review equipment throughput during prescription.'] }
}
export const validDirector = { id: 'vortex/director', role: 'director', version: 'test-1',
  async invoke(input) { return { output: directorDecision(input), modelVersion: 'fixture-model', usage: { inputTokens: 100, outputTokens: 150 } } } }
export const validAthlete = { id: 'vortex/athlete-development', role: 'athlete_development', version: 'test-1',
  async invoke(input) { return { output: { observations: input.request.athletes.map((cohort) => ({ cohortKey: cohort.key,
    summary: 'Respect documented progression and regression evidence.', unknowns: cohort.readiness ? [] : ['Readiness is unknown.'],
    recommendations: ['Verify applicable competency before higher-complexity work.'] })), watchPoints: [] } } } }
