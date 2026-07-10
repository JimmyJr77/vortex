# Category 2 — Implementation Prompt

You are a **process engineer + backend implementer** for the Vortex Needs Engine quality system.

### Objective

For **Category 2 — Phase time fill** only, produce an **implementation plan** that closes the gap between **measurement prerequisites** and **runnable MOP/MOE/MOR/KPI assessments**.

The plan must specify what to **build, wire, or instrument** so each Category 2 metric can actually be measured — not just whether it passes today.

### Primary references (read first)

1. [`docs/NEEDS_ENGINE_QUALITY_CHECK.md`](docs/NEEDS_ENGINE_QUALITY_CHECK.md) — Category 2 metric table + Measurement prerequisites
2. [`backend/platform/prescriptionQualityChecks.js`](../backend/platform/prescriptionQualityChecks.js) — existing strict checks
3. [`backend/platform/categoryQualityEvaluators.js`](../backend/platform/categoryQualityEvaluators.js) — per-category evaluators
4. [`scripts/evaluate-prescription-quality.mjs`](../scripts/evaluate-prescription-quality.mjs) — golden eval CLI
5. [`scripts/golden-prescription-scenario.json`](../scripts/golden-prescription-scenario.json) — Test 3 frozen body

### Category boundary

- Implement **only** Category 2 metrics (`C2-MOP-*`, `C2-MOE-*`, `C2-MOS-*`, `C2-MOR-*`, `C2-KPI-*`).
- Reuse existing global checks where they already satisfy a metric; register the check id in `CATEGORY2_KPI_CHECK_IDS`.
- MOE metrics without telemetry: add **informational** checks (`informational: true` in detail) — non-blocking.
- Mark **TBD** metrics as informational stubs with `tbd: true` — do not block strict eval.

### Deliverables

1. **`evaluateCategory2()`** in `categoryQualityEvaluators.js` — new automatable checks
2. **`CATEGORY2_KPI_CHECK_IDS`** + **`computeCategory2Kpi()`** — weighted aggregate
3. Wire via **`runCategoryEvaluators()`** when `context.expectedBody` is set
4. Unit tests in `prescriptionQualityChecks.test.js` (happy path + one failure case if applicable)
5. Update Category 2 **Auto** column in `NEEDS_ENGINE_QUALITY_CHECK.md` for newly automated metrics
6. Optional: `docs/CATEGORY_2_MOE_RUBRIC.md` when ≥3 manual MOE metrics

### Implementation pattern (mirror Category 1)

```text
Pre-prescribe MOS  → validatePrescribeBodyMOS (Cat 1 MOS only)
Post-prescribe MOP → strict blocking checks
Informational MOE  → category2_moe_* checks (always ok: true, detail.informational)
KPI aggregate      → category2_kpi over CATEGORY2_KPI_CHECK_IDS
```

### Verification

```bash
node --test backend/platform/__tests__/prescriptionQualityChecks.test.js
npm run needs-engine:eval
```

Golden Test 3 must remain **ALL PASS** after Category 2 wiring.

---
