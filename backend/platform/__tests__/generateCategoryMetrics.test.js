import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  parseStandardPlanMatrix,
  parseQualityCheckTable,
} from '../../../scripts/generate-category-metrics.mjs'
import { validateCategoryMetrics } from '../categoryMetricsSchema.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '../../..')

test('parseStandardPlanMatrix drops 7-column type token safety net', () => {
  const md = `
| ID | Metric | Prerequisites | In app? | check_id | Evaluable? |
|----|--------|---------------|---------|----------|------------|
| C20-MOP-01 | MOP | No pool_empty reasons | \`empty_phase_reasons\` | yes | \`no_empty_phases\` | yes (P0) |
`
  const rows = parseStandardPlanMatrix(md)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].Metric, 'No pool_empty reasons')
  assert.equal(rows[0].check_id, 'no_empty_phases')
  assert.equal(rows[0]['In app?'], 'yes')
})

test('parseStandardPlanMatrix splits compound check_id into check_ids array', () => {
  const md = `
| ID | Metric | Prerequisites | In app? | check_id | Evaluable? |
|----|--------|---------------|---------|----------|------------|
| C6-MOP-07 | Progression coverage | x | yes | \`progression_coverage_output, progression_coverage_capacity\` | yes |
`
  const rows = parseStandardPlanMatrix(md)
  assert.equal(rows[0].check_id, 'progression_coverage_output')
  assert.deepEqual(rows[0].check_ids, ['progression_coverage_output', 'progression_coverage_capacity'])
})

test('generator output validates with zero schema violations', () => {
  const jsonPath = path.join(root, 'docs/NEEDS_ENGINE_CATEGORY_METRICS.json')
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
  assert.equal(Object.keys(data.categories).length, 25)
  const result = validateCategoryMetrics(data)
  assert.equal(result.total, 785)
  assert.equal(result.ok, true, result.violations.slice(0, 8).join('\n'))
})
