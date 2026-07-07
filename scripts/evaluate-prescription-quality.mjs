#!/usr/bin/env node
/**
 * Golden-scenario Needs Engine quality evaluator.
 * Usage: DATABASE_URL=... node scripts/evaluate-prescription-quality.mjs [--json]
 *
 * Exit 0 = all checks pass. Exit 1 = one or more failures (details on stdout).
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), '../backend/package.json'))
const pg = require('pg')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const scenarioPath = path.join(__dirname, 'golden-prescription-scenario.json')
const scenario = JSON.parse(fs.readFileSync(scenarioPath, 'utf8'))

const LOW_INTENT_PHASES = new Set(['prepare_and_access', 'movement_intelligence', 'restore', 'sustained_capacity'])
const PROGRESSION_PHASES = new Set(['output', 'capacity', 'resilience'])

function fail(checks, id, message, detail = null) {
  checks.push({ id, ok: false, message, detail })
}

function pass(checks, id, message, detail = null) {
  checks.push({ id, ok: true, message, detail })
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

function blockByKey(result, phaseKey) {
  return result.blocks?.find((b) => b.phase_key === phaseKey)
}

function allPerSplitVariants(block) {
  const variants = []
  for (const item of block?.items ?? []) {
    for (const v of item.per_split ?? item.split_alternates_json ?? []) {
      variants.push({ item, variant: v })
    }
  }
  return variants
}

function evaluateResult(result, thresholds) {
  const checks = []

  const restoreBlock = blockByKey(result, 'restore')
  const restoreItems = restoreBlock?.items ?? []
  const restoreTarget = restoreBlock?.target_minutes ?? 4
  const restoreEst = restoreBlock?.estimated_minutes ?? 0

  if (restoreItems.length === 0) {
    fail(checks, 'restore_non_empty', 'Restore phase must contain at least one exercise')
  } else {
    pass(checks, 'restore_non_empty', `Restore has ${restoreItems.length} item(s)`)
  }

  const restoreEmptyReason = (result.constraint_report?.empty_phase_reasons ?? [])
    .some((r) => /restore/i.test(r) && /pool_empty|no exercises/i.test(r))
  if (restoreEmptyReason) {
    fail(checks, 'restore_no_pool_empty', 'Restore must not report pool_empty')
  } else {
    pass(checks, 'restore_no_pool_empty', 'Restore has no pool_empty reason')
  }

  const restoreFillPct = restoreTarget > 0 ? Math.round((restoreEst / restoreTarget) * 100) : 100
  if (restoreEst > restoreTarget * (thresholds.restoreMaxOverfillPct / 100)) {
    fail(checks, 'restore_within_budget', `Restore over budget: ${restoreEst}m / ${restoreTarget}m (${restoreFillPct}%)`)
  } else {
    pass(checks, 'restore_within_budget', `Restore within budget: ${restoreEst}m / ${restoreTarget}m`)
  }

  for (const phaseKey of LOW_INTENT_PHASES) {
    const block = blockByKey(result, phaseKey)
    if (!block) continue
    const bad = allPerSplitVariants(block).filter(({ variant }) => variant.variant_type === 'progression')
    if (bad.length > 0) {
      fail(
        checks,
        `no_progression_${phaseKey}`,
        `${phaseKey} must not use Progression variants`,
        bad.slice(0, 3).map(({ item, variant }) => `${item.exercise_name} → ${variant.exercise_name}`),
      )
    } else {
      pass(checks, `no_progression_${phaseKey}`, `${phaseKey} has no Progression variants`)
    }
  }

  const avoidSamples = result.constraint_report?.equipment_avoid?.sample_names ?? []
  const boxBreathingExcluded = avoidSamples.some((n) => /box breathing/i.test(String(n)))
  if (boxBreathingExcluded) {
    fail(checks, 'restore_not_box_avoid_false_positive', 'Box Breathing Hold must not appear in equipment-avoid samples when avoiding plyo box')
  } else {
    pass(checks, 'restore_not_box_avoid_false_positive', 'No box-breathing false positive in avoid samples')
  }

  for (const fill of result.constraint_report?.phase_fill ?? []) {
    if (fill.phase_key === 'restore') continue
    if ((fill.fill_pct ?? 0) < thresholds.minPhaseFillPct) {
      fail(
        checks,
        `phase_fill_${fill.phase_key}`,
        `${fill.phase_key} underfilled: ${fill.fill_pct}% (min ${thresholds.minPhaseFillPct}%)`,
      )
    } else {
      pass(checks, `phase_fill_${fill.phase_key}`, `${fill.phase_key} fill ${fill.fill_pct}%`)
    }
  }

  const prepareBlock = blockByKey(result, 'prepare_and_access')
  const stretchInPrepare = (prepareBlock?.items ?? []).filter((it) => it.age_fit === 'stretch').length
  if (stretchInPrepare > thresholds.maxStretchPrimariesInPrepare) {
    fail(checks, 'prepare_no_stretch_primaries', `Prepare has ${stretchInPrepare} stretch primary item(s)`)
  } else {
    pass(checks, 'prepare_no_stretch_primaries', 'Prepare has no stretch primaries')
  }

  let split2Progressions = 0
  for (const phaseKey of thresholds.requireSplit2ProgressionInPhases ?? []) {
    const block = blockByKey(result, phaseKey)
    for (const { item, variant } of allPerSplitVariants(block)) {
      const isSplit2 = /split 2|11-14|11–14/i.test(String(variant.split_label ?? ''))
      if (isSplit2 && variant.variant_type === 'progression') {
        split2Progressions += 1
      }
    }
  }
  if (split2Progressions < (thresholds.minSplit2ProgressionCount ?? 1)) {
    fail(
      checks,
      'split2_has_progressions',
      `Expected ≥${thresholds.minSplit2ProgressionCount} Split 2 Progression in output/capacity; got ${split2Progressions}`,
    )
  } else {
    pass(checks, 'split2_has_progressions', `Split 2 progressions in output/capacity: ${split2Progressions}`)
  }

  const passed = checks.filter((c) => c.ok).length
  const failed = checks.filter((c) => !c.ok)
  return { checks, passed, failed, ok: failed.length === 0 }
}

async function main() {
  const jsonOut = process.argv.includes('--json')
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('DATABASE_URL is required')
    process.exit(2)
  }

  const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } })
  try {
    const facilityRow = await pool.query(scenario.facilityQuery)
    const facilityId = Number(facilityRow.rows[0]?.id)
    if (!facilityId) {
      console.error('No facility found')
      process.exit(2)
    }

    const body = await resolveScenarioBody(pool, scenario.body)
    const prescribePath = path.join(__dirname, '../backend/platform/phaseAwarePrescription.js')
    const { runPhaseAwarePrescription } = await import(pathToFileURL(prescribePath).href)

    const result = await runPhaseAwarePrescription(pool, facilityId, body)
    const evaluation = evaluateResult(result, scenario.thresholds)

    const report = {
      scenario: scenario.name,
      facilityId,
      ok: evaluation.ok,
      passed: evaluation.passed,
      failed: evaluation.failed.length,
      failures: evaluation.failed,
      checks: evaluation.checks,
      constraint_report: result.constraint_report,
      block_summary: (result.blocks ?? []).map((b) => ({
        phase_key: b.phase_key,
        target_minutes: b.target_minutes,
        estimated_minutes: b.estimated_minutes,
        item_count: b.items?.length ?? 0,
      })),
    }

    if (jsonOut) {
      console.log(JSON.stringify(report, null, 2))
    } else {
      console.log(`Scenario: ${scenario.name}`)
      console.log(`Result: ${evaluation.ok ? 'PASS' : 'FAIL'} (${evaluation.passed}/${evaluation.checks.length} checks)`)
      if (evaluation.failed.length > 0) {
        console.log('\nFailures:')
        for (const f of evaluation.failed) {
          console.log(`  - [${f.id}] ${f.message}`)
          if (f.detail) console.log(`    ${JSON.stringify(f.detail)}`)
        }
      }
      console.log('\nBlocks:')
      for (const b of report.block_summary) {
        console.log(`  ${b.phase_key}: ${b.estimated_minutes}m / ${b.target_minutes}m (${b.item_count} items)`)
      }
    }

    process.exit(evaluation.ok ? 0 : 1)
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(2)
})
