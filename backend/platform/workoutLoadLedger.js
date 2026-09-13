import { FATIGUE_BUDGET_FIELDS, fatigueBudgetCost, addFatigueCost, fatigueBudgetBreaches,
  weightedProfileCost, addBudgetCost, budgetBreaches } from './canonicalLoadBudget.js'
import { WORKOUT_STRESS_BUDGET_FIELDS } from './canonicalWorkoutContract.js'
import { compositionConflictReasons } from './canonicalExerciseSelection.js'
import { SESSION_COMPONENT_ORDER } from './sessionComponentContract.js'
import { canonicalIntentForProgrammingComponent, immutableProgrammingValue, programmingValueHash } from './workoutProgrammingRequest.js'
import { resolveCanonicalProgrammingDose, ProgrammingPrescriptionError } from './canonicalProgrammingDose.js'

export const PROGRAMMING_LOAD_LEDGER_VERSION = '1.0.0'
// Fixed normalization prevents a longer booking, extra waves or empty reserve
// from making the same athlete dose appear cheaper. This is an exposure index
// over existing reviewed scores, not a physiological fatigue prediction.
export const LOAD_REFERENCE_ACTIVE_MINUTES = 60
const round = (value) => Math.round(value * 100) / 100
const remaining = (budgets, total) => Object.fromEntries(Object.keys(budgets).map((key) => [key, round(budgets[key] - (total[key] ?? 0))]))

/** Replay in execution order, including preparation once it is prescribed. */
export function evaluateProgrammingLoadSequence({ request, activities }) {
  if (!Array.isArray(activities) || activities.length > 100) throw new ProgrammingPrescriptionError('load_complexity_budget', 'A load sequence requires at most 100 activities')
  const intent = canonicalIntentForProgrammingComponent(request, 'strength')
  let fatigue = Object.fromEntries(FATIGUE_BUDGET_FIELDS.map((key) => [key, 0]))
  let stress = Object.fromEntries(WORKOUT_STRESS_BUDGET_FIELDS.map((key) => [key, 0]))
  let highImpactContacts = 0
  let lastComponentIndex = -1
  const selected = []
  const entries = []
  const issues = []
  for (const [executionIndex, entry] of activities.entries()) {
    const { activityId, componentKey, card, profile, method, dose } = entry
    const componentIndex = SESSION_COMPONENT_ORDER.indexOf(componentKey)
    if (componentIndex < lastComponentIndex || componentIndex < 0 || !request.components.some((component) => component.key === componentKey && component.budgetSeconds !== 0)) {
      issues.push({ code: 'component_sequence', activityId })
    }
    lastComponentIndex = componentIndex
    const resolved = resolveCanonicalProgrammingDose({ card, profile, method, request, componentKey,
      proposal: { sets: dose.sets, reps: dose.reps, workSeconds: dose.workSeconds, restSeconds: dose.restSeconds } })
    if (programmingValueHash(resolved) !== programmingValueHash(dose)) issues.push({ code: 'stale_or_modified_dose', activityId })
    const fatigueValues = {
      grip: card.fatigueProfile?.gripFatigue ?? card.loadProfile?.gripDemand,
      localMuscle: card.fatigueProfile?.localMuscleFatigue, spinalLoading: card.loadProfile?.spinalLoading,
      eccentricStress: card.loadProfile?.eccentricStress, impactAccumulation: card.fatigueProfile?.impactAccumulation,
      technicalSensitivity: card.fatigueProfile?.technicalFatigueSensitivity,
    }
    const missing = Object.entries({ ...fatigueValues, ...card.stressProfile }).filter(([key, value]) =>
      (FATIGUE_BUDGET_FIELDS.includes(key) || WORKOUT_STRESS_BUDGET_FIELDS.includes(key))
      && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100)).map(([key]) => key)
    for (const field of WORKOUT_STRESS_BUDGET_FIELDS) if (card.stressProfile?.[field] == null && !missing.includes(field)) missing.push(field)
    if (missing.length) issues.push({ code: 'unknown_load_metadata', activityId, fields: missing })
    const exposureMinutes = resolved.activeSecondsPerAthlete / 60
    const fatigueCost = fatigueBudgetCost(card, exposureMinutes, LOAD_REFERENCE_ACTIVE_MINUTES, 1)
    const stressCost = weightedProfileCost(card.stressProfile, WORKOUT_STRESS_BUDGET_FIELDS, exposureMinutes, LOAD_REFERENCE_ACTIVE_MINUTES, 1)
    const before = { fatigue: { ...fatigue }, stress: { ...stress }, highImpactContacts }
    fatigue = addFatigueCost(fatigue, fatigueCost)
    stress = addBudgetCost(stress, stressCost, WORKOUT_STRESS_BUDGET_FIELDS)
    highImpactContacts += resolved.highImpactContacts
    for (const field of fatigueBudgetBreaches(fatigue, intent.fatigueBudgets)) issues.push({ code: 'fatigue_budget_exceeded', activityId, field, actual: fatigue[field], cap: intent.fatigueBudgets[field] })
    for (const field of budgetBreaches(stress, intent.stressBudgets, WORKOUT_STRESS_BUDGET_FIELDS)) issues.push({ code: 'stress_budget_exceeded', activityId, field, actual: stress[field], cap: intent.stressBudgets[field] })
    if (highImpactContacts > intent.maxHighImpactContacts) issues.push({ code: 'high_impact_contact_cap', activityId, actual: highImpactContacts, cap: intent.maxHighImpactContacts })
    for (const reason of compositionConflictReasons(card, profile, profile.phaseKey, selected, executionIndex)) issues.push({ code: 'composition_conflict', activityId, reason })
    selected.push({ card, profile, phaseKey: profile.phaseKey, executionIndex })
    entries.push({ activityId, componentKey, doseHash: programmingValueHash(resolved), activeSecondsPerAthlete: resolved.activeSecondsPerAthlete,
      fatigueCost, stressCost, highImpactContacts: resolved.highImpactContacts, before,
      after: { fatigue: { ...fatigue }, stress: { ...stress }, highImpactContacts },
      remaining: { fatigue: remaining(intent.fatigueBudgets, fatigue), stress: remaining(intent.stressBudgets, stress), highImpactContacts: intent.maxHighImpactContacts - highImpactContacts },
    })
  }
  return immutableProgrammingValue({ schemaVersion: PROGRAMMING_LOAD_LEDGER_VERSION, referenceActiveMinutes: LOAD_REFERENCE_ACTIVE_MINUTES,
    interpretation: 'reviewed_score_exposure_index', status: issues.length ? 'REVISE' : 'PASS', issues, entries,
    totals: { fatigue, stress, highImpactContacts }, budgets: { fatigue: intent.fatigueBudgets, stress: intent.stressBudgets, highImpactContacts: intent.maxHighImpactContacts },
    validatedWorkout: false,
  })
}
