/**
 * Progression lane policy — adjacency, forbidden pairs, tenet alignment, methodology gates.
 * Used by phaseAwarePrescription (pick) and category evaluators (assess).
 */

import { SESSION_PHASE_ORDER } from './phaseArchitect.js'

export const HIGH_AROUSAL_METHODOLOGY_KEYS = new Set(['hiit', 'plyometric', 'plyometrics', 'plyo'])

/** Substring pairs [primaryFamilyHint, progressionFamilyHint] — case-insensitive includes match */
export const DEFAULT_FORBIDDEN_LANE_PAIRS = [
  ['sprint', 'olympic'],
  ['sprint', 'weightlifting'],
  ['sprint', 'clean'],
  ['jump', 'olympic'],
]

export function phaseIndex(phaseKey) {
  return SESSION_PHASE_ORDER.indexOf(String(phaseKey ?? ''))
}

/** Same phase or adjacent on SESSION_PHASE_ORDER (C7-MOP-11). */
export function isPhaseAdjacent(phaseA, phaseB) {
  const a = String(phaseA ?? '')
  const b = String(phaseB ?? '')
  if (!a || !b) return false
  if (a === b) return true
  const ia = phaseIndex(a)
  const ib = phaseIndex(b)
  if (ia < 0 || ib < 0) return false
  return Math.abs(ia - ib) <= 1
}

export function mergeForbiddenLanePairs(thresholds = {}) {
  const extra = thresholds.forbiddenLaneFamilyPairs ?? []
  return [...DEFAULT_FORBIDDEN_LANE_PAIRS, ...extra]
}

export function isForbiddenLaneFamilyPair(primaryFamily, progFamily, forbiddenPairs = DEFAULT_FORBIDDEN_LANE_PAIRS) {
  const p = String(primaryFamily ?? '').toLowerCase()
  const g = String(progFamily ?? '').toLowerCase()
  if (!p || !g) return false
  for (const [a, b] of forbiddenPairs) {
    if (p.includes(String(a).toLowerCase()) && g.includes(String(b).toLowerCase())) return true
  }
  return false
}

/** C7-MOP-09 — Output speed tenet required when session objective is speed_priority. */
export function outputSpeedTenetRequired(body, phaseKey) {
  const objective = body?.sessionObjective ?? body?.session_objective ?? null
  return objective === 'speed_priority' && phaseKey === 'output'
}

export function tenetKeysForExercise(exerciseId, tagMap, tenetKeyById) {
  return (tagMap.get(String(exerciseId)) ?? [])
    .filter((t) => t.facetType === 'tenet')
    .map((t) => tenetKeyById.get(Number(t.facetId)))
    .filter(Boolean)
}

export function sharesTenetKey(primaryId, progId, tenetKey, tagMap, tenetKeyById) {
  const key = String(tenetKey ?? '').toLowerCase()
  if (!key) return false
  const primaryKeys = tenetKeysForExercise(primaryId, tagMap, tenetKeyById).map((k) => String(k).toLowerCase())
  const progKeys = tenetKeysForExercise(progId, tagMap, tenetKeyById).map((k) => String(k).toLowerCase())
  if (!primaryKeys.includes(key) && !progKeys.includes(key)) return false
  return primaryKeys.some((k) => progKeys.includes(k))
}

export function methodologyKeysForExercise(exerciseId, tagMap, methodologyKeyById) {
  return (tagMap.get(String(exerciseId)) ?? [])
    .filter((t) => t.facetType === 'methodology')
    .map((t) => methodologyKeyById.get(Number(t.facetId)))
    .filter(Boolean)
}

export function hasHighArousalMethodology(exerciseId, tagMap, methodologyKeyById) {
  return methodologyKeysForExercise(exerciseId, tagMap, methodologyKeyById)
    .some((k) => HIGH_AROUSAL_METHODOLOGY_KEYS.has(String(k).toLowerCase()))
}

export function emptyLaneRejectReasons() {
  return {
    lane_mismatch: 0,
    difficulty_gap: 0,
    over_cap: 0,
    profile_role: 0,
    reuse_excluded: 0,
    methodology: 0,
  }
}

export function mergeLaneRejectReasons(a, b) {
  const out = emptyLaneRejectReasons()
  for (const key of Object.keys(out)) {
    out[key] = Number(a?.[key] ?? 0) + Number(b?.[key] ?? 0)
  }
  return out
}
