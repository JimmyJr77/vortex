#!/usr/bin/env node
/**
 * Golden-scenario Needs Engine quality evaluator.
 *
 * Usage:
 *   DATABASE_URL=... node scripts/evaluate-prescription-quality.mjs [--json] [--repair-loop] [--tier=strict|baseline]
 *
 * Exit 0 = PASS. Exit 1 = REPAIRABLE_FAIL. Exit 2 = setup/SYSTEM_FAIL. Exit 3 = UNSATISFIABLE.
 * Without --repair-loop, legacy flat-check mode still runs; --json includes verdict when available.
 *
 * Tiers:
 *   strict   — near-perfection gates (default; used by quality loop)
 *   baseline — Round 2 structural gates only
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  DEFAULT_BASELINE_THRESHOLDS,
  DEFAULT_STRICT_THRESHOLDS,
  collectExerciseIds,
  evaluatePrescriptionQuality,
  validatePrescribeBodyMOS,
  computeCategory1Kpi,
} from '../backend/platform/prescriptionQualityChecks.js'
import { loadPhaseProfiles, loadDifficultyProfiles, loadSafetyProfiles } from '../backend/platform/exerciseProgramming.js'
import { expandEquipmentAvoidIds, effectiveEquipmentAvoidIds, loadBodyweightEquipmentIds, equipmentUsePolicyFromBody } from '../backend/platform/equipmentAvoidPolicy.js'
import { loadSavedRequirementsBody } from './needsEngineSnapshotToPrescribeBody.js'
import { requireDatabaseUrl } from './resolveDatabaseUrl.js'
import {
  appendEvalHistory,
  collectCat7PairKeys,
  collectCat8ProgressionIds,
  computeLaneStability,
  computeFillStability,
  computeChronicUnderfill,
  computeCapUtilStability,
  computeAgeFitWarningStability,
  computeStretchVariantWarningStability,
  computeWarningPairStability,
  computeWarningCleanStreak,
  computeReuseStability,
  computePoolEmptyStability,
  computeSplitRejectChronic,
  computeHiitFallbackChronic,
  computeGoldenFeasibilityStability,
  computeDoseStability,
  collectPhaseEstimatedMinutes,
  collectCat23OutputTopSlugs,
  computeSportScoringStability,
  readEvalHistory,
  DEFAULT_HISTORY_PATH,
} from '../backend/platform/evalHistory.js'
import { collectHighestCapProgressionPairs, computeCat11OutputPoolUtil } from '../backend/platform/categoryEvaluatorsExtended.js'
import { buildEvaluatorVerdict, verdictExitCode, stableHash } from '../backend/platform/evaluatorVerdict.js'
import { runPrescriptionEvalLoop } from '../backend/platform/prescriptionRepairLoop.js'
import { runPreflight } from '../backend/platform/preflightSatisfiability.js'

const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), '../backend/package.json'))
const pg = require('pg')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const metricsCatalogPath = path.join(__dirname, '../docs/NEEDS_ENGINE_CATEGORY_METRICS.json')
const metricsCatalog = fs.existsSync(metricsCatalogPath)
  ? JSON.parse(fs.readFileSync(metricsCatalogPath, 'utf8'))
  : null
const scenarioPath = path.join(__dirname, 'golden-prescription-scenario.json')
const scenario = JSON.parse(fs.readFileSync(scenarioPath, 'utf8'))

function parseTier(argv) {
  const flag = argv.find((a) => a.startsWith('--tier='))
  if (!flag) return 'strict'
  const tier = flag.split('=')[1]
  if (tier !== 'strict' && tier !== 'baseline') {
    console.error(`Unknown tier "${tier}". Use strict or baseline.`)
    process.exit(2)
  }
  return tier
}

function mergeThresholds(tier, scenarioThresholds = {}) {
  const base = tier === 'baseline' ? DEFAULT_BASELINE_THRESHOLDS : DEFAULT_STRICT_THRESHOLDS
  return { ...base, ...scenarioThresholds, tier }
}

async function resolveScenarioBody(pool, body) {
  const resolved = { ...body }

  if (body.sportKey) {
    const sport = await pool.query(`SELECT id FROM coaching.sport WHERE key = $1 LIMIT 1`, [body.sportKey])
    if (sport.rows[0]?.id) resolved.sportId = Number(sport.rows[0].id)
  }

  if (Array.isArray(body.equipmentUseKeys) && body.equipmentUseKeys.length > 0) {
    const eq = await pool.query(
      `SELECT id FROM coaching.equipment WHERE key = ANY($1::text[])`,
      [body.equipmentUseKeys],
    )
    resolved.equipmentUseIds = eq.rows.map((r) => Number(r.id))
  }

  if (Array.isArray(body.equipmentAvoidKeys) && body.equipmentAvoidKeys.length > 0) {
    const eq = await pool.query(
      `SELECT id FROM coaching.equipment WHERE key = ANY($1::text[])`,
      [body.equipmentAvoidKeys],
    )
    resolved.equipmentAvoidIds = eq.rows.map((r) => Number(r.id))
  }

  delete resolved.sportKey
  delete resolved.equipmentUseKeys
  delete resolved.equipmentAvoidKeys
  return resolved
}

async function loadScalingProfiles(pool, exerciseIds) {
  if (exerciseIds.length === 0) return new Map()
  const res = await pool.query(
    `SELECT exercise_id, cohort_key, load_guidance
     FROM coaching.exercise_scaling_profile
     WHERE exercise_id = ANY($1::bigint[])`,
    [exerciseIds],
  )
  const map = new Map()
  for (const row of res.rows) {
    const id = Number(row.exercise_id)
    const entry = map.get(id) ?? []
    entry.push(row)
    map.set(id, entry)
  }
  return map
}

async function loadProgressionGraph(pool, exerciseIds) {
  const map = new Map()
  if (!exerciseIds.length) return map
  try {
    const res = await pool.query(
      `SELECT from_exercise_id, to_exercise_id FROM coaching.exercise_progression
       WHERE from_exercise_id = ANY($1::bigint[]) OR to_exercise_id = ANY($1::bigint[])`,
      [exerciseIds],
    )
    for (const row of res.rows) {
      const from = Number(row.from_exercise_id)
      const to = Number(row.to_exercise_id)
      const entry = map.get(from) ?? new Set()
      entry.add(to)
      map.set(from, entry)
    }
  } catch {
    return map
  }
  return map
}

async function loadTenetKeyById(pool) {
  try {
    const res = await pool.query(`SELECT id, key FROM coaching.tenet`)
    return new Map(res.rows.map((r) => [Number(r.id), r.key]))
  } catch {
    return new Map()
  }
}

async function loadIntentKeyById(pool) {
  try {
    const res = await pool.query(`SELECT id, key FROM coaching.exercise_intent`)
    return new Map(res.rows.map((r) => [Number(r.id), r.key]))
  } catch {
    return new Map()
  }
}

/** Category 16 (C16-MOP-13): phase_key → Set of order-slot keys in that phase's taxonomy. */
async function loadPhaseOrderSlotKeysByPhase(pool) {
  try {
    const res = await pool.query(
      `SELECT pos.key, sp.key AS phase_key
       FROM coaching.phase_order_slot pos
       JOIN coaching.session_phase sp ON sp.id = pos.phase_id`,
    )
    const map = new Map()
    for (const row of res.rows) {
      const set = map.get(row.phase_key) ?? new Set()
      set.add(row.key)
      map.set(row.phase_key, set)
    }
    return map
  } catch {
    return new Map()
  }
}

async function loadPrescriptionContext(pool, result) {
  const exerciseIds = collectExerciseIds(result)
  if (exerciseIds.length === 0) {
    return {
      tagMap: new Map(),
      exerciseById: new Map(),
      equipmentKeyById: new Map(),
      phaseProfileMap: new Map(),
      methodologyKeyById: new Map(),
      difficultyByExerciseId: new Map(),
      scalingProfileByExerciseId: new Map(),
      progressionGraphEdges: new Map(),
      tenetKeyById: new Map(),
      safetyProfileByExerciseId: new Map(),
      sportIdByKey: new Map(),
      intentKeyById: new Map(),
      phaseOrderSlotKeysByPhase: new Map(),
    }
  }

  const [exercises, tags, equipment, methodology, phaseProfileMap, difficultyByExerciseId, scalingProfileByExerciseId, progressionGraphEdges, tenetKeyById, safetyProfileByExerciseId, sportRows, intentKeyById, phaseOrderSlotKeysByPhase] = await Promise.all([
    pool.query(
      `SELECT id, slug, name, movement_family, primary_phase_key, phase_subrole, primary_order_slot, skill_level, sport_id, programming_kind
       FROM coaching.exercise WHERE id = ANY($1::bigint[])`,
      [exerciseIds],
    ),
    pool.query(
      `SELECT exercise_id, facet_type, facet_id, weight FROM coaching.exercise_tag WHERE exercise_id = ANY($1::bigint[])`,
      [exerciseIds],
    ),
    pool.query(`SELECT id, key FROM coaching.equipment`),
    pool.query(`SELECT id, key FROM coaching.methodology`),
    loadPhaseProfiles(pool, exerciseIds),
    loadDifficultyProfiles(pool, exerciseIds),
    loadScalingProfiles(pool, exerciseIds),
    loadProgressionGraph(pool, exerciseIds),
    loadTenetKeyById(pool),
    loadSafetyProfiles(pool, exerciseIds),
    pool.query(`SELECT id, key FROM coaching.sport`).catch(() => ({ rows: [] })),
    loadIntentKeyById(pool),
    loadPhaseOrderSlotKeysByPhase(pool),
  ])

  const exerciseById = new Map(exercises.rows.map((r) => [Number(r.id), r]))
  const equipmentKeyById = new Map(equipment.rows.map((r) => [Number(r.id), r.key]))
  const tagMap = new Map()
  for (const row of tags.rows) {
    const key = String(row.exercise_id)
    const entry = tagMap.get(key) ?? []
    entry.push({
      facetType: row.facet_type,
      facetId: Number(row.facet_id),
      weight: row.weight,
    })
    tagMap.set(key, entry)
  }

  const methodologyKeyById = new Map(methodology.rows.map((r) => [Number(r.id), r.key]))
  const sportIdByKey = new Map(sportRows.rows.map((r) => [r.key, Number(r.id)]))

  return {
    tagMap,
    exerciseById,
    equipmentKeyById,
    phaseProfileMap,
    methodologyKeyById,
    difficultyByExerciseId,
    scalingProfileByExerciseId,
    progressionGraphEdges,
    tenetKeyById,
    safetyProfileByExerciseId,
    sportIdByKey,
    intentKeyById,
    phaseOrderSlotKeysByPhase,
  }
}

function resolveSportKeyFromSportId(sportId, sportIdByKey) {
  const id = Number(sportId)
  if (!Number.isFinite(id)) return null
  for (const [key, rowId] of sportIdByKey) {
    if (Number(rowId) === id) return key
  }
  return null
}

async function validateSportIdPreflight(pool, body) {
  const checks = []
  const sportId = body?.sportId
  if (sportId == null || !Number.isFinite(Number(sportId))) {
    return { checks, ok: true, sportId: null }
  }
  const row = await pool.query(`SELECT id FROM coaching.sport WHERE id = $1 LIMIT 1`, [Number(sportId)])
  if (!row.rows[0]) {
    checks.push({
      id: 'sport_id_preflight',
      ok: false,
      severity: 'P1',
      message: `sportId ${sportId} not found in coaching.sport`,
    })
    return { checks, ok: false, sportId: Number(sportId) }
  }
  checks.push({
    id: 'sport_id_preflight',
    ok: true,
    severity: 'ok',
    message: `sportId ${sportId} resolves in coaching.sport`,
  })
  return { checks, ok: true, sportId: Number(sportId) }
}

function mergeEvaluation(mosChecks, sportChecks, evaluation) {
  const allChecks = [...mosChecks, ...sportChecks, ...evaluation.checks]
  const failed = allChecks.filter((c) => !c.ok)
  const p0Failed = failed.filter((c) => c.severity === 'P0')
  return {
    ...evaluation,
    checks: allChecks,
    passed: allChecks.filter((c) => c.ok).length,
    failed,
    p0Failed,
    ok: failed.length === 0,
  }
}

async function enrichEvalContext(pool, body, ctx) {
  const avoidIds = effectiveEquipmentAvoidIds(body)
  if (avoidIds.length > 0) {
    const expanded = await expandEquipmentAvoidIds(pool, avoidIds)
    ctx.expandedAvoidEquipIds = expanded.expandedIds
    ctx.equipmentAvoidKeys = expanded.avoidKeys ?? []
  } else {
    ctx.expandedAvoidEquipIds = new Set()
    ctx.equipmentAvoidKeys = []
  }

  if (equipmentUsePolicyFromBody(body) === 'use_only' && (body.equipmentUseIds ?? body.equipment_use_ids ?? []).length > 0) {
    ctx.bodyweightEquipIds = await loadBodyweightEquipmentIds(pool)
  } else {
    ctx.bodyweightEquipIds = new Set()
  }

  try {
    const bodyRegion = await pool.query(`SELECT id FROM coaching.body_region`)
    ctx.bodyRegionFacetIds = new Set(bodyRegion.rows.map((r) => Number(r.id)))
  } catch {
    ctx.bodyRegionFacetIds = new Set()
  }

  const avoidSlugs = (body.avoidExerciseSlugs ?? body.avoid_exercise_slugs ?? []).map(String).filter(Boolean)
  if (avoidSlugs.length > 0) {
    const slugRows = await pool.query(
      `SELECT slug FROM coaching.exercise WHERE slug = ANY($1::text[]) AND archived = FALSE`,
      [avoidSlugs],
    )
    const found = new Set(slugRows.rows.map((r) => String(r.slug).toLowerCase()))
    ctx.avoidSlugExists = new Map(avoidSlugs.map((s) => [String(s).toLowerCase(), found.has(String(s).toLowerCase())]))
  } else {
    ctx.avoidSlugExists = new Map()
  }
  return ctx
}

async function main() {
  const jsonOut = process.argv.includes('--json')
  const repairLoop = process.argv.includes('--repair-loop')
  const tier = parseTier(process.argv)
  const { connectionString, source: dbSource } = requireDatabaseUrl()

  const thresholds = mergeThresholds(tier, scenario.thresholds?.[tier] ?? scenario.thresholds ?? {})

  const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } })
  try {
    const facilityRow = await pool.query(scenario.facilityQuery)
    const facilityId = Number(facilityRow.rows[0]?.id)
    if (!facilityId) {
      console.error('No facility found')
      process.exit(2)
    }

    let body
    let requirementsSnapshot = scenario.snapshot ?? scenario.requirements ?? null
    let requirementsSource = 'golden-prescription-scenario.json body'
    if (scenario.savedRequirementsName) {
      try {
        const loaded = await loadSavedRequirementsBody(pool, scenario.savedRequirementsName)
        body = loaded.body
        requirementsSnapshot = loaded.snapshot
        requirementsSource = `coaching.coach_needs_engine_requirements "${loaded.savedName}" (id ${loaded.savedId}, updated ${loaded.savedUpdatedAt})`
      } catch (err) {
        console.warn(`Could not load saved requirements "${scenario.savedRequirementsName}": ${err.message}`)
        console.warn('Falling back to frozen scenario.body')
        body = await resolveScenarioBody(pool, scenario.body)
      }
    } else {
      body = await resolveScenarioBody(pool, scenario.body)
    }

    const mos = validatePrescribeBodyMOS(body)
    if (!mos.ok) {
      console.error('Prescribe body MOS validation failed:')
      for (const c of mos.checks.filter((x) => !x.ok)) {
        console.error(`  - [${c.id}] ${c.message}`)
      }
      process.exit(2)
    }

    const sportPreflight = await validateSportIdPreflight(pool, body)

    const prescribePath = path.join(__dirname, '../backend/platform/phaseAwarePrescription.js')
    const { runPhaseAwarePrescription } = await import(pathToFileURL(prescribePath).href)

    let result
    let loopOutcome = null
    let verdict = null

    if (repairLoop) {
      loopOutcome = await runPrescriptionEvalLoop(pool, facilityId, body, {
        maxAttempts: 3,
        thresholds,
        metricsCatalog,
        prescribe: () => runPhaseAwarePrescription(pool, facilityId, body),
        loadContext: async (p, res, b) => {
          const ctx = await loadPrescriptionContext(p, res)
          ctx.sessionAgeMax = b.ageMax ?? b.age_max ?? res.audience_profile?.ageMax
          ctx.expectedBody = b
          ctx.snapshot = requirementsSnapshot
          ctx.thresholds = thresholds
          ctx.evalInfraOk = true
          await enrichEvalContext(p, b, ctx)
          return ctx
        },
        evaluate: (res, th, ctx) => {
          let evaluation = evaluatePrescriptionQuality(res, th, ctx)
          evaluation = mergeEvaluation(mos.checks, sportPreflight.checks, evaluation)
          const cat1Kpi = computeCategory1Kpi(evaluation.checks, { minRate: th.category1KpiMinRate ?? 0.95 })
          const kpiIdx = evaluation.checks.findIndex((c) => c.id === 'category1_kpi')
          if (kpiIdx >= 0) evaluation.checks[kpiIdx] = cat1Kpi
          else evaluation.checks.push(cat1Kpi)
          evaluation.failed = evaluation.checks.filter((c) => !c.ok)
          evaluation.ok = evaluation.failed.length === 0
          return evaluation
        },
      })
      result = loopOutcome.result
      verdict = loopOutcome.verdict
    } else {
      result = await runPhaseAwarePrescription(pool, facilityId, body)
    }

    const context = await loadPrescriptionContext(pool, result)
    context.sessionAgeMax = body.ageMax ?? body.age_max ?? result.audience_profile?.ageMax
    context.expectedBody = body
    context.snapshot = requirementsSnapshot
    context.thresholds = thresholds
    context.dbSource = dbSource
    context.facilityId = facilityId
    context.requirementsSource = requirementsSource
    context.evalInfraOk = true

    await enrichEvalContext(pool, body, context)

    const effectiveSplits = (result.audience_splits ?? []).length > 0
      ? result.audience_splits
      : (body.audienceSplits ?? []).map((s) => ({
          label: s.label,
          caps: { maxOverall: s.difficultyOverride ?? s.difficulty_override },
        }))
    const cat7Pairs = collectHighestCapProgressionPairs(result, effectiveSplits)
    const cat7PairKeys = collectCat7PairKeys(cat7Pairs)
    const cat8ProgressionIds = collectCat8ProgressionIds(cat7Pairs)
    const history = readEvalHistory()
    context.laneStability = computeLaneStability(history, scenario.name, {
      tier,
      minRuns: thresholds.minLaneStabilityRuns ?? 5,
    })
    context.reuseStability = computeReuseStability(history, scenario.name, {
      tier,
      minRuns: thresholds.minReuseStabilityRuns ?? 5,
    })
    context.fillStability = computeFillStability(history, scenario.name, {
      tier,
      minRuns: thresholds.minFillStabilityRuns ?? 5,
      maxStdPct: thresholds.maxFillStabilityStdPct ?? 3,
    })
    context.chronicUnderfill = computeChronicUnderfill(history, scenario.name, {
      tier,
      minRuns: thresholds.minChronicUnderfillRuns ?? 5,
      threshold: thresholds.chronicUnderfillPct ?? 70,
    })
    context.capUtilStability = computeCapUtilStability(history, scenario.name, {
      tier,
      minRuns: thresholds.minCapUtilStabilityRuns ?? 5,
      maxStd: thresholds.maxCapUtilStabilityStd ?? 0.05,
    })
    const cat11OutputPoolUtil = computeCat11OutputPoolUtil(result)
    context.ageFitWarningStability = computeAgeFitWarningStability(history, scenario.name, {
      tier,
      minRuns: thresholds.minAgeFitWarningStabilityRuns ?? 5,
    })
    context.stretchVariantWarningStability = computeStretchVariantWarningStability(history, scenario.name, {
      tier,
      minRuns: thresholds.minStretchWarningStabilityRuns ?? 5,
    })
    context.warningPairStability = computeWarningPairStability(history, scenario.name, {
      tier,
      minRuns: thresholds.minWarningPairStabilityRuns ?? 5,
    })
    context.warningCleanStreak = computeWarningCleanStreak(history, scenario.name, {
      tier,
      minRuns: thresholds.minWarningCleanStreakRuns ?? 5,
      maxSplitWarnings: thresholds.maxSplitVariantWarnings ?? 1,
    })
    context.poolEmptyStability = computePoolEmptyStability(history, scenario.name, {
      tier,
      minRuns: thresholds.minPoolEmptyStabilityRuns ?? 5,
    })
    context.splitRejectChronic = computeSplitRejectChronic(history, scenario.name, {
      tier,
      minRuns: thresholds.minSplitRejectChronicRuns ?? 5,
    })
    context.goldenFeasibilityStability = computeGoldenFeasibilityStability(history, scenario.name, {
      tier,
      minRuns: thresholds.minGoldenFeasibilityRuns ?? 5,
    })
    context.hiitFallbackChronic = computeHiitFallbackChronic(history, scenario.name, {
      tier,
      minRuns: thresholds.minHiitFallbackChronicRuns ?? 5,
    })
    try {
      const pubRow = await pool.query(
        `SELECT COUNT(*)::int AS n FROM coaching.exercise WHERE archived = FALSE AND programming_kind = 'exercise'`,
      )
      context.publishedExerciseCount = Number(pubRow.rows[0]?.n ?? 0)
    } catch {
      context.publishedExerciseCount = null
    }
    context.doseStability = computeDoseStability(history, scenario.name, {
      tier,
      minRuns: thresholds.minDoseStabilityRuns ?? 5,
    })
    const cat23OutputTopSlugs = collectCat23OutputTopSlugs(result, context.exerciseById)
    context.sportScoringStability = computeSportScoringStability(history, scenario.name, {
      tier,
      minRuns: thresholds.minSportScoringStabilityRuns ?? 5,
    })
    if (body.sportId != null && context.sportIdByKey) {
      context.sportKey = resolveSportKeyFromSportId(body.sportId, context.sportIdByKey)
    }
    let commitSha = null
    try {
      const { execSync } = await import('node:child_process')
      commitSha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
    } catch {
      commitSha = null
    }
    context.commitSha = commitSha
    let evaluation
    if (repairLoop && loopOutcome) {
      evaluation = {
        checks: loopOutcome.verdict.checks ?? [],
        failed: (loopOutcome.verdict.checks ?? []).filter((c) => !c.ok),
        passed: (loopOutcome.verdict.checks ?? []).filter((c) => c.ok).length,
        ok: loopOutcome.verdict.pass,
      }
      evaluation.p0Failed = evaluation.failed.filter((c) => c.severity === 'P0')
    } else {
      evaluation = evaluatePrescriptionQuality(result, thresholds, context)
      evaluation = mergeEvaluation(mos.checks, sportPreflight.checks, evaluation)

      const cat1Kpi = computeCategory1Kpi(evaluation.checks, { minRate: thresholds.category1KpiMinRate ?? 0.95 })
      const kpiIdx = evaluation.checks.findIndex((c) => c.id === 'category1_kpi')
      if (kpiIdx >= 0) evaluation.checks[kpiIdx] = cat1Kpi
      else evaluation.checks.push(cat1Kpi)
      evaluation.failed = evaluation.checks.filter((c) => !c.ok)
      evaluation.p0Failed = evaluation.failed.filter((c) => c.severity === 'P0')
      evaluation.passed = evaluation.checks.filter((c) => c.ok).length
      evaluation.ok = evaluation.failed.length === 0
    }

    if (!verdict) {
      const preflight = await runPreflight(body, pool, { metricsCatalog })
      verdict = buildEvaluatorVerdict({
        body,
        result,
        checks: evaluation.checks,
        metricsCatalog,
        attempt: repairLoop ? (loopOutcome?.attempts ?? 1) : 1,
        inputHash: stableHash(body),
        outputHash: stableHash({ blocks: result?.blocks }),
        evaluatedAfterLastRepair: true,
        preflight: preflight.ok ? null : preflight,
      })
      evaluation.ok = verdict.pass
    }

    const poolEmptyCount = (result.constraint_report?.empty_phase_reasons ?? [])
      .filter((r) => /pool_empty/i.test(String(r))).length
    let hiitFallbackCount = 0
    for (const block of result.blocks ?? []) {
      for (const item of block.items ?? []) {
        if (/relaxed sustained pool fill|HIIT fallback/i.test(String(item.selection_rationale ?? ''))) hiitFallbackCount += 1
      }
    }
    const splitRejectByPhase = (result.constraint_report?.phase_fill ?? []).map((f) => ({
      phase_key: f.phase_key,
      ratio: Number(f.pool_size ?? 0) > 0 ? Number(f.split_rejects ?? 0) / Number(f.pool_size) : 0,
    }))
    appendEvalHistory({
      ts: new Date().toISOString(),
      scenario: scenario.name,
      tier,
      ok: evaluation.ok,
      commit: commitSha,
      cat7PairKeys,
      cat8ProgressionIds,
      cat11OutputPoolUtil,
      phase_fill: result.constraint_report?.phase_fill ?? [],
      age_fit_warning_count: (result.age_fit_warnings ?? []).length,
      split_variant_warning_count: (result.split_variant_warnings ?? []).length,
      pool_empty_count: poolEmptyCount,
      hiit_fallback_count: hiitFallbackCount,
      split_reject_by_phase: splitRejectByPhase,
      failed_ids: evaluation.failed.map((f) => f.id),
      phase_estimated_minutes: collectPhaseEstimatedMinutes(result),
      cat23OutputTopSlugs,
    })

    const moeExportArg = process.argv.find((a) => a.startsWith('--moe-export='))
    const moeExportPath = moeExportArg
      ? moeExportArg.split('=').slice(1).join('=')
      : (process.argv.includes('--moe-export') ? path.join(__dirname, '../docs/cat7-moe-packet.json') : null)
    if (moeExportPath) {
      const cat7Packet = evaluation.checks.find((c) => c.id === 'category7_moe_pair_review_packet')
      const cat10Packet = evaluation.checks.find((c) => c.id === 'category10_moe_review_packet')
      fs.writeFileSync(moeExportPath, JSON.stringify({
        scenario: scenario.name,
        tier,
        generated_at: new Date().toISOString(),
        category7_pairs: cat7Packet?.detail?.pairs ?? [],
        category10_age_fit: cat10Packet?.detail ?? null,
      }, null, 2))
    }

    const report = {
      scenario: scenario.name,
      savedRequirementsName: scenario.savedRequirementsName ?? null,
      requirementsSource,
      tier,
      repair_loop: repairLoop,
      facilityId,
      prescribe_body: {
        sportId: body.sportId ?? null,
        workMode: body.workMode,
        durationMinutes: body.durationMinutes,
        sessionObjective: body.sessionObjective,
      },
      category1_kpi: evaluation.checks.find((c) => c.id === 'category1_kpi')?.detail ?? null,
      ok: evaluation.ok,
      verdict,
      passed: evaluation.passed,
      failed: evaluation.failed.length,
      p0_failures: evaluation.p0Failed.map((f) => f.id),
      failures: evaluation.failed,
      checks: evaluation.checks,
      repair_history: loopOutcome?.repair_history ?? null,
      constraint_report: result.constraint_report,
      age_fit_warnings: result.age_fit_warnings,
      split_variant_warnings: result.split_variant_warnings,
      block_summary: (result.blocks ?? []).map((b) => ({
        phase_key: b.phase_key,
        target_minutes: b.target_minutes,
        estimated_minutes: b.estimated_minutes,
        item_count: b.items?.length ?? 0,
        fill_pct: b.fill_pct,
      })),
    }

    if (jsonOut) {
      console.log(JSON.stringify(report, null, 2))
    } else {
      console.log(`Scenario: ${scenario.name}`)
      if (scenario.savedRequirementsName) {
        console.log(`Requirements: ${requirementsSource}`)
      }
      console.log(`Database: ${dbSource} (${dbSource === 'local' ? 'localhost' : 'remote'})`)
      console.log(`Tier: ${tier}`)
      console.log(`Result: ${verdict?.status ?? (evaluation.ok ? 'PASS' : 'FAIL')} (${evaluation.passed}/${evaluation.checks.length} checks)`)
      if (verdict?.requirement_trace?.length) {
        console.log(`Requirements traced: ${verdict.requirement_trace.length}; passed: ${verdict.passed_requirements?.length ?? 0}`)
      }
      if (evaluation.failed.length > 0) {
        console.log('\nFailures (fix in priority order — P0 first):')
        const ordered = [...evaluation.failed].sort((a, b) => {
          const rank = (s) => (s === 'P0' ? 0 : 1)
          return rank(a.severity) - rank(b.severity)
        })
        for (const f of ordered) {
          console.log(`  - [${f.severity ?? 'P1'}][${f.id}] ${f.message}`)
          if (f.detail) console.log(`    ${JSON.stringify(f.detail)}`)
        }
      }
      console.log('\nBlocks:')
      for (const b of report.block_summary) {
        console.log(`  ${b.phase_key}: ${b.estimated_minutes}m / ${b.target_minutes}m (${b.item_count} items, ${b.fill_pct ?? '?'}%)`)
      }
      if ((result.age_fit_warnings ?? []).length > 0) {
        console.log('\nAge-fit warnings:')
        for (const w of result.age_fit_warnings.slice(0, 5)) console.log(`  - ${w}`)
      }
    }

    process.exit(verdict ? verdictExitCode(verdict) : (evaluation.ok ? 0 : 1))
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(2)
})
