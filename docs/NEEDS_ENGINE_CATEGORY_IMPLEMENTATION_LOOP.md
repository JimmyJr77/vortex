# Needs Engine — 25-Category Implementation Loop (sequential)

**One category per iteration.** Each category gets full context: every MOP/MOE/MOS/MOR/KPI is traced from prerequisite → existing hook → gap → implementation action.

Do **not** batch-implement multiple categories. Do **not** mark a category complete until its per-metric gap table, plan, hooks, and verification are done.

## Body-driven assessment rule (mandatory)

When implementing or documenting any category:

1. **Read gates from `expectedBody`** — age bands, splits, `focus_targets`, `sessionObjective`, caps — not from Test 3 literals baked into check code.
2. **Name checks after invariants** — e.g. `restore_high_arousal_after_sustained_conditioning`, not `after_hiit`; `sustainedRelaxedPoolFill`, not `hiitFallback`.
3. **Golden scenario = regression fixture** — cite Test 3 values in docs as *examples* under **Golden anchors**, not as the definition of the metric.
4. **Methodology taxonomy** — `hiit` may appear as a DB methodology key; policy functions use **`hasSustainedConditioningFocus()`** (conditioning methodology on Sustained `focus_targets`) so other conditioning methodologies work the same way.
5. **Do not skip structural rules per workout type** — e.g. when `audienceSplits` are active, every fill path must emit `per_split` regardless of Sustained conditioning focus.

Violations to flag in review: check ids or plan text that mention a single workout concept when the metric applies to any prescribe body with the same abstract prerequisites.

## Per-category phases (strict order)

| Phase | Output | Done when |
|-------|--------|-----------|
| **0. Prerequisites** | Bullets under each metric in `NEEDS_ENGINE_QUALITY_CHECK.md` | Every metric has `**C#-TYPE-##** — Requires: ...` |
| **1. Gap analysis** | Per-metric table in `CATEGORY_NN_PLAN.md` | Every metric row has: prerequisite, existing hook, gap, action |
| **2. Prompt** | `CATEGORY_NN_PROMPT.md` | Filled template scoped to category N only |
| **3. Plan** | Implementation phases in `CATEGORY_NN_PLAN.md` | Build / wire / instrument / MOE rubric / TBD backlog listed |
| **4. Implement** | Code + rubric + doc Auto column updates | Hooks live in named tools (see below) |
| **5. Wire** | `wired: true` in status JSON | Category evaluator runs in strict eval only when wired |
| **6. Verify** | Tests + `npm run needs-engine:eval` | Golden Test 3 PASS; category KPI reflects real checks |

## Required gap table (copy into every `CATEGORY_NN_PLAN.md`)

| Metric | Prerequisites (summary) | Existing hook | Gap | Action | Blocking? |
|--------|---------------------------|---------------|-----|--------|-----------|
| C#-MOP-01 | … | `check_id` or none | … | add evaluator / engine telemetry / MOE rubric | yes/no/info |

**Blocking** = fails strict eval when threshold missed. **info** = informational check (`detail.informational: true`). **MOE** = manual rubric doc. **TBD** = engine instrumentation backlog (document only).

## Tools to hook into

| Tool | Role |
|------|------|
| `backend/platform/prescriptionQualityChecks.js` | Legacy + Category 1 strict checks |
| `backend/platform/categoryQualityEvaluators.js` | Per-category evaluators (`evaluateCategoryN`) — **one file section per category, wired individually** |
| `backend/platform/phaseAwarePrescription.js` | Engine telemetry (`constraint_report`, item fields) |
| `scripts/evaluate-prescription-quality.mjs` | Golden eval CLI; passes `context.expectedBody` |
| `docs/CATEGORY_N_MOE_RUBRIC.md` | Manual MOE playbooks |
| `docs/NEEDS_ENGINE_QUALITY_CHECK.md` | Auto column + strict evaluator map updates |

## Wiring rule

Only categories with `"wired": true` in [`NEEDS_ENGINE_CATEGORY_LOOP_STATUS.json`](./NEEDS_ENGINE_CATEGORY_LOOP_STATUS.json) run in strict eval. Category 1 is always wired via `prescriptionQualityChecks.js`. Categories 2–25 wire incrementally.

```js
// categoryQualityEvaluators.js
export const WIRED_CATEGORIES = new Set([2]) // grows one at a time
```

## One iteration (agent — no user questions)

1. Read `current_category` from status JSON (lowest N where `verified !== complete`).
2. Load **only** that category's metric table + prerequisites from `NEEDS_ENGINE_QUALITY_CHECK.md`.
3. Search codebase for existing hooks (evaluator check ids, engine fields, policies).
4. Write gap table + plan + MOE rubric (if ≥3 MOE metrics).
5. Implement hooks; update Auto column for metrics that became automatable.
6. Set `wired: true`, run tests + eval, set all phases `complete` for N.
7. Set `current_category` to N+1. **Stop** — do not start N+1 in the same session unless user asked for batch.

## Status tracker

[`NEEDS_ENGINE_CATEGORY_LOOP_STATUS.json`](./NEEDS_ENGINE_CATEGORY_LOOP_STATUS.json)

**Stop condition:** all 25 categories: `verified: complete` and `wired: true` (except MOE-only metrics documented in rubrics).

## Runner

```bash
node scripts/run-category-implementation-loop.mjs   # shows current_category from status JSON
```

## Cursor `/loop` command

```
/loop
Run **one** Needs Engine category implementation iteration per docs/NEEDS_ENGINE_CATEGORY_IMPLEMENTATION_LOOP.md. Use current_category from NEEDS_ENGINE_CATEGORY_LOOP_STATUS.json. Complete phases 0–6 for that category only. Do not advance to the next category in the same run.
```

## Related

- [NEEDS_ENGINE_QUALITY_LOOP.md](./NEEDS_ENGINE_QUALITY_LOOP.md) — golden strict pass streak
- [NEEDS_ENGINE_QUALITY_CHECK.md](./NEEDS_ENGINE_QUALITY_CHECK.md) — metric catalog
