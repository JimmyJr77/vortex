#!/usr/bin/env node
/**
 * Golden-scenario Needs Engine quality evaluator.
 *
 * Usage:
 *   DATABASE_URL=... node scripts/evaluate-prescription-quality.mjs [--json] [--tier=strict|baseline]
 *
 * Exit 0 = all checks pass. Exit 1 = failures. Exit 2 = setup error.
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
} from '../backend/platform/prescriptionQualityChecks.js'
import { loadSavedRequirementsBody } from './needsEngineSnapshotToPrescribeBody.js'
import { requireDatabaseUrl } from './resolveDatabaseUrl.js'

const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), '../backend/package.json'))
const pg = require('pg')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
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

async function loadPrescriptionContext(pool, result) {
  const exerciseIds = collectExerciseIds(result)
  if (exerciseIds.length === 0) {
    return { tagMap: new Map(), exerciseById: new Map(), equipmentKeyById: new Map() }
  }

  const [exercises, tags, equipment] = await Promise.all([
    pool.query(
      `SELECT id, slug, name, movement_family FROM coaching.exercise WHERE id = ANY($1::bigint[])`,
      [exerciseIds],
    ),
    pool.query(
      `SELECT exercise_id, facet_type, facet_id, weight FROM coaching.exercise_tag WHERE exercise_id = ANY($1::bigint[])`,
      [exerciseIds],
    ),
    pool.query(`SELECT id, key FROM coaching.equipment`),
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

  return { tagMap, exerciseById, equipmentKeyById }
}

async function main() {
  const jsonOut = process.argv.includes('--json')
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
    let requirementsSource = 'golden-prescription-scenario.json body'
    if (scenario.savedRequirementsName) {
      try {
        const loaded = await loadSavedRequirementsBody(pool, scenario.savedRequirementsName)
        body = loaded.body
        requirementsSource = `coaching.coach_needs_engine_requirements "${loaded.savedName}" (id ${loaded.savedId}, updated ${loaded.savedUpdatedAt})`
      } catch (err) {
        console.warn(`Could not load saved requirements "${scenario.savedRequirementsName}": ${err.message}`)
        console.warn('Falling back to frozen scenario.body')
        body = await resolveScenarioBody(pool, scenario.body)
      }
    } else {
      body = await resolveScenarioBody(pool, scenario.body)
    }

    const prescribePath = path.join(__dirname, '../backend/platform/phaseAwarePrescription.js')
    const { runPhaseAwarePrescription } = await import(pathToFileURL(prescribePath).href)

    const result = await runPhaseAwarePrescription(pool, facilityId, body)
    const context = await loadPrescriptionContext(pool, result)
    context.sessionAgeMax = body.ageMax ?? body.age_max ?? result.audience_profile?.ageMax

    const evaluation = evaluatePrescriptionQuality(result, thresholds, context)

    const report = {
      scenario: scenario.name,
      savedRequirementsName: scenario.savedRequirementsName ?? null,
      requirementsSource,
      tier,
      facilityId,
      ok: evaluation.ok,
      passed: evaluation.passed,
      failed: evaluation.failed.length,
      p0_failures: evaluation.p0Failed.map((f) => f.id),
      failures: evaluation.failed,
      checks: evaluation.checks,
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
      console.log(`Result: ${evaluation.ok ? 'PASS' : 'FAIL'} (${evaluation.passed}/${evaluation.checks.length} checks)`)
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

    process.exit(evaluation.ok ? 0 : 1)
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(2)
})
