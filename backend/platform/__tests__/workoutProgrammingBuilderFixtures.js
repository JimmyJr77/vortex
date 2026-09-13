import { executionActivity, executionRequest } from './workoutProgrammingExecutionFixtures.js'
import { libraryPool } from './workoutProgrammingLibrarianFixtures.js'
import { validDirector, validAthlete } from './workoutProgrammingStaffFixtures.js'
import { createProgrammingStaffRegistry } from '../programmingStaffRuntime.js'

export function compositionFixtures() {
  const request = executionRequest()
  const activities = []
  let index = 0
  for (const key of ['prepare_and_access', 'explosiveness', 'strength', 'capacity_competition', 'body_control']) {
    for (let n = 0; n < (key === 'capacity_competition' ? 1 : 3); n += 1) {
      const activity = executionActivity(key, ++index, request)
      if (key === 'prepare_and_access') {
        activity.profile.dosage = { sets: 1, setsMin: 1, setsMax: 1, reps: null, workSeconds: n === 0 ? 100 : 20, restSeconds: 10, contactsPerSet: 0 }
        activity.profile.timeModel = { setupSeconds: 5, demonstrationSeconds: 10, transitionSeconds: 5, resetSeconds: 2, cleanupSeconds: 5 }
        activity.profile.logistics.stationCapacity = 15
        activity.card.environment.stationCapacity = 15
      }
      activity.method.prescriptions[0].default_rounds = activity.profile.dosage.sets
      activity.method.prescriptions[0].default_work_seconds = activity.profile.dosage.workSeconds
      activity.method.prescriptions[0].default_rest_seconds = activity.profile.dosage.restSeconds
      activity.method.programming_type = 'straight_sets'
      activity.method.name = `${key} reviewed method ${index}`
      activity.card.displayName = `${key} reviewed drill ${index}`
      // Synthetic low-risk fixture explicitly declares no individual prerequisites.
      // Missing metadata in real library records must not be treated as this declaration.
      activity.card.programming = { prerequisites: [] }
      activities.push(activity)
    }
  }
  const options = {
    cards: activities.map((entry) => entry.card), methods: activities.map((entry) => entry.method),
    profiles: activities.map((entry) => ({ programming_method_id: entry.method.id, phase_key: entry.profile.phaseKey, role: 'primary', fit_weight: 5 })),
    prescriptions: activities.flatMap((entry) => entry.method.prescriptions.map((profile) => ({ ...profile, programming_method_id: entry.method.id }))),
    methodStopRules: activities.flatMap((entry) => entry.method.stop_rules.map((rule) => ({ programming_method_id: entry.method.id, stop_rule: rule.stopRule }))),
  }
  return { request, activities, options, pool: (patch = {}) => libraryPool({ ...options, ...patch }) }
}
export const validBuilder = { id: 'vortex/session-builder', role: 'session_builder', version: 'test-1', async invoke(input) {
  return { output: { requestRevision: input.request.revision, summary: 'Quality explosive work, complementary strength, and capacity bounded by remaining readiness.', watchPoints: [],
    components: input.components.map((component) => ({ key: component.key,
      selections: component.candidates.slice(0, component.key === 'capacity_competition' ? 1 : 3).map((candidate) => ({
        deliveryProfileId: candidate.deliveryProfileId, programmingMethodId: candidate.methodIds.find((id) => component.methods.find((method) => method.id === id)?.prescriptions.some((rx) =>
          rx.default_work_seconds === candidate.dosage.workSeconds && rx.default_rest_seconds === candidate.dosage.restSeconds)) ?? candidate.methodIds[0],
        rationale: 'Deliver a complementary reviewed stimulus with appropriate recovery.',
      })), reserve: { purpose: 'recovery', rationale: 'Use the remaining window for observed recovery, feedback and readiness before the next component.' },
    })),
  } }
} }
export const validPrepare = { id: 'vortex/prepare-access', role: 'prepare_access', version: 'test-1', async invoke(input) {
  const component = input.components[0]
  const demandId = input.demand.exposures.find((entry) => entry.componentKey === 'explosiveness').demandId
  return { output: { requestRevision: input.request.revision, downstreamHash: input.demand.downstreamHash,
    summary: 'Familiar Vortex base followed by mechanics rehearsal and a progressive explosive bridge.', watchPoints: [],
    selections: component.candidates.slice(0, 3).map((candidate, index) => ({ deliveryProfileId: candidate.deliveryProfileId,
      programmingMethodId: candidate.methodIds.find((id) => component.methods.find((method) => method.id === id)?.prescriptions.some((rx) =>
        rx.default_work_seconds === candidate.dosage.workSeconds && rx.default_rest_seconds === candidate.dosage.restSeconds)) ?? candidate.methodIds[0],
      role: ['base', 'position_rehearsal', 'progressive_bridge'][index],
      purposes: index === 0 ? ['raise', 'mobilize', 'activate'] : index === 1 ? ['integrate'] : ['potentiate_bridge'],
      addressesDemandIds: index ? [demandId] : [], rationale: 'Canonical movement metadata matches the selected downstream demand.',
    })),
  } }
} }
export const compositionRegistry = (extra = []) => createProgrammingStaffRegistry([validDirector, validAthlete, validBuilder, validPrepare, ...extra])
