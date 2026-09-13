/** Shared canonical load-index arithmetic. These are programming heuristics, not clinical measurements. */
const FATIGUE_BUDGET_FIELDS = Object.freeze([
  'grip',
  'localMuscle',
  'spinalLoading',
  'eccentricStress',
  'impactAccumulation',
  'technicalSensitivity',
])

function fatigueBudgetCost(card, phaseMinutes, durationMinutes, itemTarget) {
  const weight = phaseMinutes / Math.max(1, durationMinutes * itemTarget)
  const fatigue = card.fatigueProfile ?? {}
  const load = card.loadProfile ?? {}
  const weighted = (value) => Math.round(Math.max(1, Number(value ?? 1)) * weight * 100) / 100
  return {
    grip: weighted(fatigue.gripFatigue ?? load.gripDemand),
    localMuscle: weighted(fatigue.localMuscleFatigue),
    spinalLoading: weighted(load.spinalLoading),
    eccentricStress: weighted(load.eccentricStress),
    impactAccumulation: weighted(fatigue.impactAccumulation),
    technicalSensitivity: weighted(fatigue.technicalFatigueSensitivity),
  }
}

function addFatigueCost(total, cost) {
  return Object.fromEntries(FATIGUE_BUDGET_FIELDS.map((field) => [
    field,
    Math.round((Number(total[field] ?? 0) + Number(cost[field] ?? 0)) * 100) / 100,
  ]))
}

function fatigueBudgetBreaches(total, budgets) {
  return FATIGUE_BUDGET_FIELDS.filter((field) => Number(total[field] ?? 0) > Number(budgets[field]))
}

function weightedProfileCost(profile, fields, phaseMinutes, durationMinutes, itemTarget) {
  const weight = phaseMinutes / Math.max(1, durationMinutes * itemTarget)
  return Object.fromEntries(fields.map((field) => [
    field,
    Math.round(Math.max(1, Number(profile?.[field] ?? 1)) * weight * 100) / 100,
  ]))
}

function addBudgetCost(total, cost, fields) {
  return Object.fromEntries(fields.map((field) => [
    field,
    Math.round((Number(total[field] ?? 0) + Number(cost[field] ?? 0)) * 100) / 100,
  ]))
}

function budgetBreaches(total, budgets, fields) {
  return fields.filter((field) => Number(total[field] ?? 0) > Number(budgets[field]))
}

export { FATIGUE_BUDGET_FIELDS, fatigueBudgetCost, addFatigueCost, fatigueBudgetBreaches, weightedProfileCost, addBudgetCost, budgetBreaches }
