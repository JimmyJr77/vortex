import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

const STANDARD_HEADER = ['ID', 'Metric', 'Prerequisites', 'In app?', 'check_id', 'Evaluable?']
const QUALITY_HEADER = ['ID', 'Type', 'Metric', 'Measurement', 'Pass threshold', 'Source', 'Auto']
const TYPE_TOKENS = new Set(['MOP', 'MOS', 'MOE', 'MOR', 'KPI'])
const QUALITY_CHECK_CATEGORIES = new Set([6, 7])

const status = JSON.parse(
  fs.readFileSync(path.join(root, 'docs/NEEDS_ENGINE_CATEGORY_LOOP_STATUS.json'), 'utf8'),
)
const qualityDoc = fs.readFileSync(path.join(root, 'docs/NEEDS_ENGINE_QUALITY_CHECK.md'), 'utf8')

function splitTableRow(line) {
  return line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim())
}

function isSeparatorRow(cells) {
  return cells.every((cell) => /^:?-+:?$/.test(cell))
}

function normalizeCheckId(value) {
  return String(value ?? '').replace(/`/g, '').trim()
}

function splitCheckIds(checkId) {
  const normalized = normalizeCheckId(checkId)
  if (!normalized.includes(',')) {
    return { check_id: normalized }
  }
  const check_ids = normalized.split(',').map((s) => s.trim()).filter(Boolean)
  return { check_id: check_ids[0], check_ids }
}

function dropTypeColumn(cells) {
  if (cells.length >= 7 && TYPE_TOKENS.has(cells[1])) {
    return [cells[0], ...cells.slice(2)]
  }
  return cells
}

function rowToRecord(cells) {
  const normalized = dropTypeColumn(cells)
  if (normalized.length < 6) return null
  const [ID, Metric, Prerequisites, inApp, checkId, evaluable] = normalized.slice(0, 6)
  if (!/^C\d+-/.test(ID)) return null
  const checkFields = splitCheckIds(checkId)
  return {
    ID,
    Metric,
    Prerequisites,
    'In app?': inApp,
    ...checkFields,
    'Evaluable?': evaluable,
  }
}

function headerMatches(cells, expected) {
  if (cells.length !== expected.length) return false
  return expected.every((name, index) => cells[index] === name)
}

function parseQualityCheckRow(cells) {
  const normalized = dropTypeColumn(cells)
  if (normalized.length < 6) return null
  const [ID, Metric, _measurement, _passThreshold, source, auto] = normalized
  if (!/^C\d+-/.test(ID)) return null
  const inApp = auto === 'no' ? 'no' : auto === 'partial' ? 'partial' : 'yes'
  const checkFields = splitCheckIds(source)
  return {
    ID,
    Metric,
    Prerequisites: '',
    'In app?': inApp,
    ...checkFields,
    'Evaluable?': auto,
  }
}

function parseMarkdownTable(lines, expectedHeader, rowParser = rowToRecord) {
  const rows = []
  for (let i = 0; i < lines.length; i++) {
    const cells = splitTableRow(lines[i])
    if (!cells.length) continue
    if (headerMatches(cells, expectedHeader)) {
      for (let j = i + 1; j < lines.length; j++) {
        const rowCells = splitTableRow(lines[j])
        if (!rowCells.length) break
        if (isSeparatorRow(rowCells)) continue
        if (rowCells[0].startsWith('#') || rowCells[0].startsWith('##')) break
        const record = rowParser(rowCells)
        if (record) rows.push(record)
      }
      break
    }
  }
  return rows
}

export function parseStandardPlanMatrix(markdown) {
  return parseMarkdownTable(markdown.split('\n'), STANDARD_HEADER)
}

export function parseQualityCheckTable(markdown) {
  return parseMarkdownTable(markdown.split('\n'), QUALITY_HEADER, parseQualityCheckRow)
}

function parseRequiresMap(markdown) {
  const map = new Map()
  const re = /^\*\*(C\d+-[\w-]+)\*\*\s*—\s*Requires:\s*(.+)$/
  for (const line of markdown.split('\n')) {
    const match = line.match(re)
    if (match) map.set(match[1], match[2].trim())
  }
  return map
}

function extractPlanTitle(markdown, categoryNumber) {
  const match = markdown.match(/^#\s+Category\s+\d+\s+—\s+(.+?)\s+—/m)
  if (match) return match[1].trim()
  return status.categories[String(categoryNumber)]?.title ?? `Category ${categoryNumber}`
}

function applyPrereqFallback(metrics, requiresMap) {
  return metrics.map((metric) => {
    const fallback = requiresMap.get(metric.ID)
    if (!fallback) return metric
    const hasPrereq =
      metric.Prerequisites &&
      metric.Prerequisites !== '—' &&
      metric.Prerequisites !== '-'
    if (hasPrereq) return metric
    return { ...metric, Prerequisites: fallback }
  })
}

const requiresMap = parseRequiresMap(qualityDoc)
const categories = {}
const allMetrics = []

for (let n = 1; n <= 25; n++) {
  let metrics = []

  if (QUALITY_CHECK_CATEGORIES.has(n)) {
    const sectionRe = new RegExp(
      `### Category ${n} —[\\s\\S]*?(?=\\n---\\n|\\n### Category ${n + 1} —|$)`,
    )
    const section = qualityDoc.match(sectionRe)?.[0] ?? ''
    metrics = applyPrereqFallback(parseQualityCheckTable(section), requiresMap)
  } else {
    const planPath = path.join(
      root,
      'docs/category-plans',
      `CATEGORY_${String(n).padStart(2, '0')}_PLAN.md`,
    )
    const planMarkdown = fs.readFileSync(planPath, 'utf8')
    metrics = applyPrereqFallback(parseStandardPlanMatrix(planMarkdown), requiresMap).map((row) => {
      const checkFields = splitCheckIds(row.check_id)
      return { ...row, ...checkFields }
    })
  }

  const title =
    status.categories[String(n)]?.title ??
    extractPlanTitle(
      fs.readFileSync(
        path.join(root, 'docs/category-plans', `CATEGORY_${String(n).padStart(2, '0')}_PLAN.md`),
        'utf8',
      ),
      n,
    )

  categories[String(n)] = {
    title,
    metric_count: metrics.length,
    metrics,
  }

  for (const metric of metrics) {
    allMetrics.push({ category: n, ...metric })
  }
}

const output = {
  generated_at: new Date().toISOString(),
  source: [
    'docs/category-plans/CATEGORY_*_PLAN.md (primary for categories 1–5, 8–25)',
    'docs/NEEDS_ENGINE_QUALITY_CHECK.md (primary for categories 6–7; prerequisites for all)',
  ],
  total_metrics: allMetrics.length,
  categories,
  all_metrics: allMetrics,
}

const outPath = path.join(root, 'docs/NEEDS_ENGINE_CATEGORY_METRICS.json')
fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`)
console.log(`Wrote ${allMetrics.length} metrics to ${path.relative(root, outPath)}`)
