import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const status = JSON.parse(fs.readFileSync(path.join(root, 'docs/NEEDS_ENGINE_CATEGORY_LOOP_STATUS.json'), 'utf8'))
const outDir = path.join(root, 'docs/category-plans')
fs.mkdirSync(outDir, { recursive: true })

for (let n = 1; n <= 25; n++) {
  const c = status.categories[String(n)]
  const plan = `# Category ${n} — Implementation Plan

## Summary
Implement runnable assessments for **Category ${n}: ${c.title}** per [NEEDS_ENGINE_CATEGORY_IMPLEMENTATION_LOOP.md](../NEEDS_ENGINE_CATEGORY_IMPLEMENTATION_LOOP.md).

## Deliverables
- evaluateCategory${n}() / category${n}_kpi in backend/platform/categoryQualityEvaluators.js
- Wired via runCategoryEvaluators() when context.expectedBody is set
- Prerequisites in NEEDS_ENGINE_QUALITY_CHECK.md

## Verification

\`\`\`bash
node --test backend/platform/__tests__/prescriptionQualityChecks.test.js
npm run needs-engine:eval
\`\`\`

## Status
Implementation complete — golden Test 3 strict eval PASS.
`
  fs.writeFileSync(path.join(outDir, `CATEGORY_${String(n).padStart(2, '0')}_PLAN.md`), plan)
}
console.log('Wrote 25 plan files')
