#!/usr/bin/env node
/**
 * Prints the next pending category from NEEDS_ENGINE_CATEGORY_LOOP_STATUS.json
 * and the filled implementation prompt. Use with an agent loop (see docs).
 *
 * Usage:
 *   node scripts/run-category-implementation-loop.mjs
 *   node scripts/run-category-implementation-loop.mjs --category=5
 *   node scripts/run-category-implementation-loop.mjs --all --dry-run
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const statusPath = path.join(root, 'docs/NEEDS_ENGINE_CATEGORY_LOOP_STATUS.json')
const loopDocPath = path.join(root, 'docs/NEEDS_ENGINE_CATEGORY_IMPLEMENTATION_LOOP.md')

function loadStatus() {
  return JSON.parse(fs.readFileSync(statusPath, 'utf8'))
}

function nextPending(status) {
  const n = status.current_category
  if (n && status.categories[String(n)]?.verified !== 'complete') {
    return { n, c: status.categories[String(n)] }
  }
  for (let i = 1; i <= 25; i++) {
    const c = status.categories[String(i)]
    if (c.verified !== 'complete') return { n: i, c }
  }
  return null
}

function fillPrompt(template, n, title) {
  return template
    .replace(/\{N\}/g, String(n))
    .replace(/\{TITLE\}/g, title)
}

function extractPromptTemplate(md) {
  const start = md.indexOf('## Master implementation prompt (template)')
  const end = md.indexOf('## One iteration (agent')
  if (start < 0 || end < 0) return null
  const section = md.slice(start, end)
  const dash = section.indexOf('\n---\n')
  return dash >= 0 ? section.slice(dash + 5).trim() : section
}

const args = process.argv.slice(2)
const categoryArg = args.find((a) => a.startsWith('--category='))
const all = args.includes('--all')
const dryRun = args.includes('--dry-run')

const status = loadStatus()
const loopDoc = fs.readFileSync(loopDocPath, 'utf8')
const template = extractPromptTemplate(loopDoc)

if (!template) {
  console.error('Could not extract prompt template from', loopDocPath)
  process.exit(2)
}

const targets = []
if (categoryArg) {
  const n = Number(categoryArg.split('=')[1])
  targets.push({ n, c: status.categories[String(n)] })
} else if (all) {
  for (let n = 1; n <= 25; n++) {
    targets.push({ n, c: status.categories[String(n)] })
  }
} else {
  const pending = nextPending(status)
  if (!pending) {
    console.log('Status: COMPLETE — all 25 categories finished.')
    process.exit(0)
  }
  targets.push(pending)
}

for (const { n, c } of targets) {
  console.log(`\n=== Category ${n}: ${c.title} ===`)
  console.log(`prerequisites=${c.prerequisites} prompt=${c.prompt} plan=${c.plan} implementation=${c.implementation} verified=${c.verified}`)
  if (dryRun) continue
  const prompt = fillPrompt(template, n, c.title)
  const outDir = path.join(root, 'docs/category-plans')
  fs.mkdirSync(outDir, { recursive: true })
  const promptPath = path.join(outDir, `CATEGORY_${String(n).padStart(2, '0')}_PROMPT.md`)
  fs.writeFileSync(promptPath, `# Category ${n} — Implementation Prompt\n\n${prompt}\n`)
  console.log(`Wrote ${promptPath}`)
  console.log('\nVerification:\n  node --test backend/platform/__tests__/prescriptionQualityChecks.test.js')
  console.log('  npm run needs-engine:eval')
}

if (!categoryArg && !all) {
  const pending = nextPending(status)
  if (!pending && targets.length === 1 && targets[0].n === 25) {
    console.log('\nAll categories complete.')
  }
}
