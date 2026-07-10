# Category 3 — Implementation Prompt

You are a **process engineer + backend implementer** for the Vortex Needs Engine quality system.

### Objective

For **Category 3 — Restore phase** only, produce an **implementation plan** that closes the gap between **measurement prerequisites** and **runnable MOP/MOE/MOR/KPI assessments**.

The plan must specify what to **build, wire, or instrument** so each Category 3 metric can actually be measured — not just whether it passes today.

### Prerequisite-first workflow (Phase 0 before wiring)

**Do not assume prior wiring is correct.** For each of the 26 Category 3 metrics:

1. Read the metric row + `**C3-*-##** — Requires:` bullets in [`docs/NEEDS_ENGINE_QUALITY_CHECK.md`](../NEEDS_ENGINE_QUALITY_CHECK.md).
2. Classify prerequisites per layer as **Available | Partial | Missing | TBD** against live code:
   - Prescription output (`result.blocks` restore block)
   - Constraint report (`empty_phase_reasons`, `equipment_avoid`)
   - Eval context (`scripts/evaluate-prescription-quality.mjs` → `loadPrescriptionContext`)
   - Policy replay ([`restoreSelectionPolicy.js`](../../backend/platform/restoreSelectionPolicy.js))
   - Equipment audit ([`equipmentAvoidPolicy.js`](../../backend/platform/equipmentAvoidPolicy.js))
Sustained conditioning focus context (`hasSustainedConditioningFocus` on `sustained_capacity`)
3. Only after Phase 0 audit: write the full matrix in [`CATEGORY_03_PLAN.md`](CATEGORY_03_PLAN.md):

   | Metric | Prerequisites | Prerequisite status | Build / instrument | Existing hook | Gap | Assessment action | check_id | Blocking? |

4. Implement builds marked **Partial | Missing** before adding new assessment checks.
5. Cross-check every id in `CATEGORY3_KPI_CHECK_IDS` against checks **actually emitted** on golden `npm run needs-engine:eval` — flag orphans and duplicates.

### Primary references (read first)

1. [`docs/NEEDS_ENGINE_QUALITY_CHECK.md`](../NEEDS_ENGINE_QUALITY_CHECK.md) — Category 3 metric table + Measurement prerequisites
2. [`backend/platform/prescriptionQualityChecks.js`](../../backend/platform/prescriptionQualityChecks.js) — existing strict checks (`restore_*`, `no_progression_restore`)
3. [`backend/platform/categoryQualityEvaluators.js`](../../backend/platform/categoryQualityEvaluators.js) — `evaluateCategory3Restore`, `CATEGORY3_KPI_CHECK_IDS`
4. [`backend/platform/restoreSelectionPolicy.js`](../../backend/platform/restoreSelectionPolicy.js) — `restoreCandidateExcluded`, `EXCLUDED_METHODOLOGY_KEYS`, `RESTORE_BOOST_SLOTS`
5. [`scripts/evaluate-prescription-quality.mjs`](../../scripts/evaluate-prescription-quality.mjs) — golden eval CLI + eval context
6. [`scripts/golden-prescription-scenario.json`](../../scripts/golden-prescription-scenario.json) — Test 3 frozen body

### Category boundary

- Implement **only** Category 3 metrics (`C3-MOP-*`, `C3-MOE-*`, `C3-MOR-*`, `C3-KPI-*`).
- Reuse existing global checks where they already satisfy a metric; register the check id in `CATEGORY3_KPI_CHECK_IDS`.
- MOE metrics without full telemetry: add **informational** checks (`detail.informational: true`) — non-blocking.
- Mark **TBD** metrics as informational stubs with `detail.tbd: true` — do not block strict eval.
- Manual MOE (C3-MOE-06, C3-MOE-08): document in [`CATEGORY_3_MOE_RUBRIC.md`](../CATEGORY_3_MOE_RUBRIC.md) only.

### Deliverables

1. **Phase 0 audit** — prerequisite status counts + full matrix in `CATEGORY_03_PLAN.md`
2. **`evaluateCategory3Restore()`** — new automatable checks + informational MOE
3. **`CATEGORY3_KPI_CHECK_IDS`** + **`computeCategory3Kpi()`** — aggregate excluding informational/TBD
4. Wire via **`runCategoryEvaluators()`** when `context.expectedBody` is set
5. Unit tests: all KPI ids present on golden mock; one failure path (e.g. restore not last → `restore_block_last`)
6. Update Category 3 **Auto** column + strict-evaluator map in `NEEDS_ENGINE_QUALITY_CHECK.md`
7. Engine backlog row for C3-MOE-03 arousal taxonomy if still TBD

### Implementation pattern

```text
Phase 0 audit     → prerequisite matrix (Available/Partial/Missing/TBD)
Prerequisite build → eval context, policy exports, equipment audit scope
Post-prescribe MOP → strict blocking checks (legacy restore_* + cat3 evaluator)
Informational MOE  → category3_moe_* (always ok: true, detail.informational)
TBD stubs          → avoid; use informational MOE proxies (e.g. `category3_moe_arousal_downshift`)
KPI aggregate      → category3_kpi over CATEGORY3_KPI_CHECK_IDS (blocking only)
```

### Verification

```bash
node --test backend/platform/__tests__/prescriptionQualityChecks.test.js
npm run needs-engine:eval
```

Golden Test 3 must remain **ALL PASS** after Category 3 wiring. All 19 `CATEGORY3_KPI_CHECK_IDS` must appear in eval output when `expectedBody` is set.

---
