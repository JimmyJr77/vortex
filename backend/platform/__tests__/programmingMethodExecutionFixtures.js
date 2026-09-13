import { executionActivity, executionRequest, executionPlan } from './workoutProgrammingExecutionFixtures.js'
import { resolveCanonicalProgrammingDose } from '../canonicalProgrammingDose.js'
import { PROGRAMMING_METHODS } from '../../../scripts/data/programming-methods-top50.mjs'

export function fixedClockFixture(type = 'work_rest_interval') {
  const base = executionRequest()
  const request = executionRequest({ logistics: { ...base.logistics, timerAvailable: true, clearRunoutConfirmed: true },
    components: base.components.map((entry) => entry.key === 'capacity_competition' ? { ...entry, budgetSeconds: 1200 } : entry) })
  const activity = executionActivity('capacity_competition', 20, request)
  activity.method.programming_type = type
  activity.method.prescriptions = [{ id: '120', profile_name: 'intermediate', training_experience: null,
    default_total_minutes: 8, default_rounds: null, default_work_seconds: 20, default_rest_seconds: 40, default_rpe_min: 5, default_rpe_max: 6 }]
  activity.method.work_rest_structure = { default_prescription: { intermediate: { minutes: 8, work_target_seconds: 20, rest_target_seconds: 40 } } }
  activity.method.workout_builder_rules = { requires_timer: true, requires_lanes: true, requires_clear_runout: true }
  activity.profile.timeModel = { setupSeconds: 0, demonstrationSeconds: 0, transitionSeconds: 0, resetSeconds: 0, cleanupSeconds: 0 }
  activity.profile.dosage = { sets: 3, setsMin: 1, setsMax: 8, reps: null, workSeconds: 20, restSeconds: 40, contactsPerSet: 0 }
  activity.dose = resolveCanonicalProgrammingDose({ ...activity, request })
  const component = executionPlan(request).components.find((entry) => entry.key === 'capacity_competition')
  return { request, activity, component }
}

/** Seed-source fixture only; production continues to hydrate rows from the database. */
export function seedMethod(slug) {
  const source = structuredClone(PROGRAMMING_METHODS.find((method) => method.slug === slug))
  return { ...source, id: '900',
    prescriptions: source.prescriptions.map((entry, i) => ({ ...entry, id: String(901 + i), training_experience: null })),
    phase_profiles: source.phase_profiles.map((entry) => ({ phaseKey: entry.phase_key, role: entry.role })),
    quality_standards: source.quality_standards.map((standard) => ({ standard, severity: 'required' })),
    stop_rules: source.stop_rules.map((stopRule) => ({ stopRule, severity: 'stop' })),
    validator_rules: source.validator_rules.map((entry) => ({ ruleKey: entry.rule_key, conditionJson: entry.condition_json, message: entry.message, severity: entry.severity })),
    exercise_compat_rows: Object.entries(source.exercise_compatibility).flatMap(([key, types]) => types.map((exercise_type) => ({ exercise_type,
      compatibility_type: { compatible_exercise_types: 'compatible', avoid_exercise_types: 'avoid', conditional_exercise_types: 'conditional' }[key],
      facet_type: null, facet_key: null, constraints: [] }))),
  }
}
