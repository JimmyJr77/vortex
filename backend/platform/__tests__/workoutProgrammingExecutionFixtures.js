import { normalizeCoachWorkoutRequest, allocateProgrammingComponentBudgets } from '../workoutProgrammingRequest.js'
import { normalizeSessionComponentPlan } from '../sessionComponentContract.js'
import { resolveCanonicalProgrammingDose } from '../canonicalProgrammingDose.js'
import { coachRequest } from './workoutProgrammingStaffFixtures.js'
import { libraryCard } from './workoutProgrammingLibrarianFixtures.js'

export function executionRequest(patch = {}) {
  const raw = coachRequest({ logistics: { ...coachRequest().logistics,
    space: { environment: 'indoor', floorAreaSquareFeet: 2000, laneLengthFeet: 100 } },
    equipment: { available: ['bodyweight', 'dumbbell'], quantities: { dumbbell: 6 } }, ...patch })
  return normalizeCoachWorkoutRequest(raw)
}
export function executionPlan(request) {
  const budgets = allocateProgrammingComponentBudgets(request)
  return normalizeSessionComponentPlan({ durationMinutes: request.logistics.totalBookedMinutes,
    equipment: { available: request.equipment.available, quantities: request.equipment.quantities, excluded: request.equipment.excluded },
    components: request.components.filter((entry) => budgets[entry.key] > 0).map((entry) => ({ key: entry.key, budgetSeconds: budgets[entry.key], equipment: entry.equipment })) })
}
export function executionActivity(componentKey = 'explosiveness', index = 1, request = executionRequest()) {
  const phaseKey = { prepare_and_access: 'prepare_and_access', explosiveness: 'output', strength: 'capacity', capacity_competition: 'sustained_capacity', body_control: 'movement_intelligence' }[componentKey]
  const card = libraryCard(phaseKey, index)
  card.fatigueProfile = { gripFatigue: 20, localMuscleFatigue: 30, impactAccumulation: 25, technicalFatigueSensitivity: 30 }
  card.loadProfile = { gripDemand: 20, spinalLoading: 20, eccentricStress: 30, landingContactsPerRep: componentKey === 'explosiveness' ? 1 : 0 }
  const profile = card.deliveryProfiles[0]
  profile.dosage = { sets: 3, setsMin: 1, setsMax: 3, reps: 6, workSeconds: 10, restSeconds: 60, contactsPerSet: componentKey === 'explosiveness' ? 6 : 0 }
  profile.timeModel = { setupSeconds: 20, demonstrationSeconds: 20, transitionSeconds: 20, resetSeconds: 5, cleanupSeconds: 15 }
  profile.logistics = { stationCapacity: 4 }
  const method = { id: String(index), best_session_phase: phaseKey, compatible_session_phases: [phaseKey], incompatible_phases: [],
    phase_profiles: [{ phaseKey, role: 'primary' }], fatigue_profile: { fatigue_level: 'moderate', technical_risk_under_fatigue: 'low' },
    workout_builder_rules: { requires_lanes: componentKey === 'explosiveness' },
    prescriptions: [{ id: String(index + 100), age_min: 5, age_max: 18, training_experience: 'all', default_rounds: 3,
      default_work_seconds: 10, default_rest_seconds: 60, default_rest_between_rounds_seconds: 0 }], stop_rules: [{ stopRule: 'End before quality declines.' }] }
  const dose = resolveCanonicalProgrammingDose({ card, profile, method, request, componentKey })
  return { activityId: `${componentKey}-${index}`, componentKey, card, profile, method, dose }
}
