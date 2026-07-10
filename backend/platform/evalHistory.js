/**
 * Eval history for lagging MOE metrics (C7-MOE-06 lane stability, etc.).
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const DEFAULT_HISTORY_PATH = path.join(__dirname, '../../docs/NEEDS_ENGINE_QUALITY_HISTORY.jsonl')

/** Stable pair key for multiset comparison */
export function progressionPairKey(primaryId, progId, phaseKey) {
  return `${phaseKey}:${Number(primaryId)}->${Number(progId)}`
}

export function collectCat7PairKeys(pairs) {
  return (pairs ?? []).map((p) =>
    progressionPairKey(p.item?.exercise_id ?? p.primaryId, p.variant?.exercise_id ?? p.progId, p.phase_key ?? p.phaseKey),
  )
}

/** Sorted progression exercise_id multiset for C8-MOE-05 stability */
export function collectCat8ProgressionIds(pairs) {
  return (pairs ?? [])
    .map((p) => Number(p.variant?.exercise_id ?? p.progId))
    .filter(Number.isFinite)
    .sort((a, b) => a - b)
}

export function progressionMultisetKey(ids) {
  return (ids ?? []).join(',')
}

export function readEvalHistory(filePath = DEFAULT_HISTORY_PATH) {
  if (!fs.existsSync(filePath)) return []
  const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter((l) => l.trim())
  const rows = []
  for (const line of lines) {
    try {
      rows.push(JSON.parse(line))
    } catch {
      // skip corrupt lines
    }
  }
  return rows
}

export function appendEvalHistory(entry, filePath = DEFAULT_HISTORY_PATH) {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.appendFileSync(filePath, `${JSON.stringify(entry)}\n`, 'utf8')
}

/**
 * C7-MOE-06 — fraction of pair keys present in all runs (≥ minRuns).
 * Returns { stability, runCount, pairKeys } or null when insufficient history.
 */
export function computeLaneStability(history, scenario, { minRuns = 5, tier = 'strict' } = {}) {
  const rows = (history ?? []).filter(
    (r) => r.scenario === scenario && (r.tier ?? 'strict') === tier && Array.isArray(r.cat7PairKeys),
  )
  if (rows.length < minRuns) {
    return { stability: null, runCount: rows.length, minRuns, pairKeys: [] }
  }
  const recent = rows.slice(-minRuns)
  const keySets = recent.map((r) => new Set(r.cat7PairKeys))
  const intersection = new Set(keySets[0])
  for (let i = 1; i < keySets.length; i += 1) {
    for (const k of intersection) {
      if (!keySets[i].has(k)) intersection.delete(k)
    }
  }
  const union = new Set()
  for (const s of keySets) for (const k of s) union.add(k)
  const stability = union.size > 0 ? intersection.size / union.size : 1
  return { stability, runCount: recent.length, minRuns, pairKeys: [...intersection] }
}

/**
 * C8-MOE-05 — fraction of recent runs with identical progression id multiset (≥ minRuns).
 */
export function computeReuseStability(history, scenario, { minRuns = 5, tier = 'strict' } = {}) {
  const rows = (history ?? []).filter(
    (r) => r.scenario === scenario && (r.tier ?? 'strict') === tier && Array.isArray(r.cat8ProgressionIds),
  )
  if (rows.length < minRuns) {
    return { stability: null, runCount: rows.length, minRuns, multisetKey: null }
  }
  const recent = rows.slice(-minRuns)
  const keys = recent.map((r) => progressionMultisetKey(r.cat8ProgressionIds))
  const reference = keys[0]
  const stableCount = keys.filter((k) => k === reference).length
  const stability = stableCount / keys.length
  return { stability, runCount: recent.length, minRuns, multisetKey: reference, stableCount }
}

function stdDev(values) {
  if (values.length < 2) return 0
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((s, x) => s + (x - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

/**
 * C2-MOP-14 — per-phase fill_pct σ over consecutive strict eval runs (≤ maxStdPct).
 */
export function computeFillStability(history, scenario, { minRuns = 5, tier = 'strict', maxStdPct = 3 } = {}) {
  const rows = (history ?? []).filter(
    (r) => r.scenario === scenario && (r.tier ?? 'strict') === tier && Array.isArray(r.phase_fill),
  )
  if (rows.length < minRuns) {
    return { stable: null, runCount: rows.length, minRuns, perPhase: {} }
  }
  const recent = rows.slice(-minRuns)
  const phaseKeys = new Set()
  for (const r of recent) for (const f of r.phase_fill) phaseKeys.add(f.phase_key)

  const perPhase = {}
  let allStable = true
  for (const pk of phaseKeys) {
    const pcts = recent
      .map((r) => r.phase_fill.find((f) => f.phase_key === pk)?.fill_pct)
      .filter((x) => x != null)
    if (pcts.length < minRuns) {
      perPhase[pk] = { std: null, samples: pcts.length }
      allStable = null
      continue
    }
    const std = stdDev(pcts)
    perPhase[pk] = { std, mean: pcts.reduce((a, b) => a + b, 0) / pcts.length, samples: pcts.length }
    if (std > maxStdPct) allStable = false
  }
  if (allStable === null && Object.values(perPhase).every((p) => p.std == null)) {
    return { stable: null, runCount: recent.length, minRuns, perPhase }
  }
  return { stable: allStable !== false, runCount: recent.length, minRuns, perPhase, maxStdPct }
}

/**
 * C10-MOE-07 — age_fit_warnings count identical over consecutive strict eval runs.
 */
export function computeAgeFitWarningStability(history, scenario, { minRuns = 5, tier = 'strict' } = {}) {
  const rows = (history ?? []).filter(
    (r) => r.scenario === scenario && (r.tier ?? 'strict') === tier && Number.isFinite(r.age_fit_warning_count),
  )
  if (rows.length < minRuns) {
    return { stable: null, runCount: rows.length, minRuns, counts: [] }
  }
  const recent = rows.slice(-minRuns)
  const counts = recent.map((r) => r.age_fit_warning_count)
  const stable = counts.every((c) => c === counts[0])
  return { stable, runCount: recent.length, minRuns, counts }
}

/**
 * C21-MOE-04 — (age_fit_warnings, split_variant_warnings) count pair identical over consecutive strict runs.
 */
export function computeWarningPairStability(history, scenario, { minRuns = 5, tier = 'strict' } = {}) {
  const rows = (history ?? []).filter(
    (r) => r.scenario === scenario
      && (r.tier ?? 'strict') === tier
      && Number.isFinite(r.age_fit_warning_count)
      && Number.isFinite(r.split_variant_warning_count),
  )
  if (rows.length < minRuns) {
    return { stable: null, runCount: rows.length, minRuns, pairs: [], counts: [] }
  }
  const recent = rows.slice(-minRuns)
  const pairs = recent.map((r) => `${r.age_fit_warning_count}:${r.split_variant_warning_count}`)
  const stable = pairs.every((p) => p === pairs[0])
  return {
    stable,
    runCount: recent.length,
    minRuns,
    pairs,
    counts: recent.map((r) => ({
      age: r.age_fit_warning_count,
      split: r.split_variant_warning_count,
    })),
  }
}

/**
 * C21-MOE-06 — consecutive strict passes with 0 age-fit + ≤ maxSplit split warnings.
 */
export function computeWarningCleanStreak(history, scenario, { minRuns = 5, tier = 'strict', maxSplitWarnings = 1 } = {}) {
  const rows = (history ?? []).filter(
    (r) => r.scenario === scenario
      && (r.tier ?? 'strict') === tier
      && r.ok === true
      && Number.isFinite(r.age_fit_warning_count)
      && Number.isFinite(r.split_variant_warning_count),
  )
  if (rows.length < minRuns) {
    return { streak: null, clean: null, runCount: rows.length, minRuns, maxSplitWarnings, recent: [] }
  }
  const recent = rows.slice(-minRuns)
  const clean = recent.every(
    (r) => r.age_fit_warning_count === 0 && r.split_variant_warning_count <= maxSplitWarnings,
  )
  return {
    streak: clean ? minRuns : 0,
    clean,
    runCount: recent.length,
    minRuns,
    maxSplitWarnings,
    recent: recent.map((r) => ({
      age: r.age_fit_warning_count,
      split: r.split_variant_warning_count,
      ok: r.ok,
    })),
  }
}

/**
 * C18-MOR-03 — split_variant_warnings count spike detector (>2 in 3/5 eval runs).
 */
export function computeStretchVariantWarningStability(history, scenario, { minRuns = 5, tier = 'strict', spikeThreshold = 2, spikeRuns = 3 } = {}) {
  const rows = (history ?? []).filter(
    (r) => r.scenario === scenario && (r.tier ?? 'strict') === tier && Number.isFinite(r.split_variant_warning_count),
  )
  if (rows.length < minRuns) {
    return { stable: null, runCount: rows.length, minRuns, counts: [], spikeThreshold, spikeRuns }
  }
  const recent = rows.slice(-minRuns)
  const counts = recent.map((r) => r.split_variant_warning_count)
  const spikes = counts.filter((c) => c > spikeThreshold).length
  const stable = spikes < spikeRuns
  return { stable, runCount: recent.length, minRuns, counts, spikes, spikeThreshold, spikeRuns }
}

/**
 * C11-MOP-18 — std dev of output pool-cap utilization ratio over consecutive strict eval runs (≤ maxStd).
 */
export function computeCapUtilStability(history, scenario, { minRuns = 5, tier = 'strict', maxStd = 0.05 } = {}) {
  const rows = (history ?? []).filter(
    (r) => r.scenario === scenario && (r.tier ?? 'strict') === tier && typeof r.cat11OutputPoolUtil === 'number',
  )
  if (rows.length < minRuns) {
    return { stable: null, runCount: rows.length, minRuns, maxStd, values: [] }
  }
  const recent = rows.slice(-minRuns)
  const values = recent.map((r) => r.cat11OutputPoolUtil)
  const std = stdDev(values)
  return {
    stable: std <= maxStd,
    std,
    mean: values.reduce((a, b) => a + b, 0) / values.length,
    runCount: recent.length,
    minRuns,
    maxStd,
    values,
  }
}

/**
 * C20-MOE-03 — pool_empty count 0 in all of the last minRuns strict evals.
 */
export function computePoolEmptyStability(history, scenario, { minRuns = 5, tier = 'strict' } = {}) {
  const rows = (history ?? []).filter(
    (r) => r.scenario === scenario && (r.tier ?? 'strict') === tier && Number.isFinite(r.pool_empty_count),
  )
  if (rows.length < minRuns) {
    return { stable: null, runCount: rows.length, minRuns, counts: [] }
  }
  const recent = rows.slice(-minRuns)
  const counts = recent.map((r) => r.pool_empty_count)
  const stable = counts.every((c) => c === 0)
  return { stable, runCount: recent.length, minRuns, counts }
}

/**
 * C20-MOR-03 — phases with split_rejects/pool_size > threshold in ≥ minHits of last minRuns runs.
 */
export function computeSplitRejectChronic(history, scenario, {
  minRuns = 5,
  tier = 'strict',
  minHits = 3,
  threshold = 0.5,
} = {}) {
  const rows = (history ?? []).filter(
    (r) => r.scenario === scenario && (r.tier ?? 'strict') === tier && Array.isArray(r.split_reject_by_phase),
  )
  if (rows.length < minRuns) {
    return { chronic: null, runCount: rows.length, minRuns, phases: [] }
  }
  const recent = rows.slice(-minRuns)
  const phaseHits = new Map()
  for (const r of recent) {
    for (const entry of r.split_reject_by_phase) {
      if ((entry.ratio ?? 0) > threshold) {
        phaseHits.set(entry.phase_key, (phaseHits.get(entry.phase_key) ?? 0) + 1)
      }
    }
  }
  const chronicPhases = [...phaseHits.entries()].filter(([, hits]) => hits >= minHits)
  return {
    chronic: chronicPhases.length === 0,
    chronicPhases,
    runCount: recent.length,
    minRuns,
    minHits,
    threshold,
  }
}

/** Top-3 Output slug key for C23-MOE-07 stability tracking */
export function collectCat23OutputTopSlugs(result, exerciseById, topN = 3) {
  const output = (result.blocks ?? []).find((b) => b.phase_key === 'output')
  return (output?.items ?? [])
    .slice(0, topN)
    .map((item) => {
      const ex = exerciseById?.get(Number(item.exercise_id))
      return ex?.slug ?? String(item.exercise_id)
    })
}

export function outputSlugMultisetKey(slugs) {
  return (slugs ?? []).join('|')
}

/**
 * C23-MOE-07 — top-3 Output slugs identical across consecutive strict eval runs (5/5).
 */
export function computeSportScoringStability(history, scenario, { minRuns = 5, tier = 'strict' } = {}) {
  const rows = (history ?? []).filter(
    (r) => r.scenario === scenario && (r.tier ?? 'strict') === tier && Array.isArray(r.cat23OutputTopSlugs),
  )
  if (rows.length < minRuns) {
    return { stable: null, runCount: rows.length, minRuns, slugKeys: [] }
  }
  const recent = rows.slice(-minRuns)
  const keys = recent.map((r) => outputSlugMultisetKey(r.cat23OutputTopSlugs))
  const reference = keys[0]
  const stableCount = keys.filter((k) => k === reference).length
  const stable = stableCount === keys.length
  return { stable, runCount: recent.length, minRuns, slugKeys: keys, stableCount, reference }
}

export function computeChronicUnderfill(history, scenario, { minRuns = 5, tier = 'strict', threshold = 70 } = {}) {
  const rows = (history ?? []).filter(
    (r) => r.scenario === scenario && (r.tier ?? 'strict') === tier && Array.isArray(r.phase_fill),
  )
  if (rows.length < minRuns) {
    return { chronicPhases: null, runCount: rows.length, minRuns, threshold }
  }
  const recent = rows.slice(-minRuns)
  const underfillByPhase = new Map()
  for (const r of recent) {
    for (const f of r.phase_fill) {
      if ((f.fill_pct ?? 100) < threshold) {
        underfillByPhase.set(f.phase_key, (underfillByPhase.get(f.phase_key) ?? 0) + 1)
      }
    }
  }
  const chronicPhases = [...underfillByPhase.entries()].filter(([, count]) => count > 0)
  return {
    chronicPhases,
    chronicCount: chronicPhases.length,
    runCount: recent.length,
    minRuns,
    threshold,
  }
}

/**
 * C25-MOR-01 — HIIT relaxed-pool fallback count 0 in all of the last minRuns strict evals.
 */
export function computeHiitFallbackChronic(history, scenario, { minRuns = 5, tier = 'strict' } = {}) {
  const rows = (history ?? []).filter(
    (r) => r.scenario === scenario && (r.tier ?? 'strict') === tier && Number.isFinite(r.hiit_fallback_count),
  )
  if (rows.length < minRuns) {
    return { chronic: null, runCount: rows.length, minRuns, counts: [] }
  }
  const recent = rows.slice(-minRuns)
  const counts = recent.map((r) => r.hiit_fallback_count)
  const chronic = counts.every((c) => c === 0)
  return { chronic, runCount: recent.length, minRuns, counts }
}

export function computeGoldenFeasibilityStability(history, scenario, { minRuns = 5, tier = 'strict' } = {}) {
  const rows = (history ?? []).filter(
    (r) => r.scenario === scenario && (r.tier ?? 'strict') === tier,
  )
  if (rows.length < minRuns) {
    return { stable: null, runCount: rows.length, minRuns, failCount: null }
  }
  const recent = rows.slice(-minRuns)
  const failCount = recent.filter((r) => !r.ok).length
  return {
    stable: failCount === 0,
    runCount: recent.length,
    minRuns,
    failCount,
  }
}

/** Per-phase estimated_minutes snapshot for C24-MOE-07 stability tracking */
export function collectPhaseEstimatedMinutes(result) {
  return (result.blocks ?? []).map((b) => ({
    phase_key: b.phase_key,
    estimated_minutes: Number(b.estimated_minutes ?? 0),
  }))
}

export function phaseMinutesKey(entries) {
  return (entries ?? [])
    .slice()
    .sort((a, b) => String(a.phase_key).localeCompare(String(b.phase_key)))
    .map((e) => `${e.phase_key}:${e.estimated_minutes}`)
    .join('|')
}

/**
 * C24-MOE-07 — per-phase estimated_minutes identical over consecutive strict eval runs (5/5).
 */
export function computeDoseStability(history, scenario, { minRuns = 5, tier = 'strict' } = {}) {
  const rows = (history ?? []).filter(
    (r) => r.scenario === scenario && (r.tier ?? 'strict') === tier && Array.isArray(r.phase_estimated_minutes),
  )
  if (rows.length < minRuns) {
    return { stable: null, runCount: rows.length, minRuns, keys: [] }
  }
  const recent = rows.slice(-minRuns)
  const keys = recent.map((r) => phaseMinutesKey(r.phase_estimated_minutes))
  const reference = keys[0]
  const stableCount = keys.filter((k) => k === reference).length
  const stable = stableCount === keys.length
  return { stable, runCount: recent.length, minRuns, keys, stableCount, reference }
}
