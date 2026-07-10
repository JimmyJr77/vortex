# Category 17 — Implementation Prompt

You are a **process engineer + backend implementer** for the Vortex Needs Engine quality system.

### Objective

For **Category 17 — Youth & safety gates** only, produce an **implementation plan** that closes the gap between **measurement prerequisites** and **runnable MOP/MOE/MOR/KPI assessments**.

The plan must specify what to **build, wire, or instrument** so each Category 17 metric can actually be measured — not just whether it passes today.

### Primary references (read first)

1. [`docs/NEEDS_ENGINE_QUALITY_CHECK.md`](docs/NEEDS_ENGINE_QUALITY_CHECK.md) — Category 17 metric table + Measurement prerequisites
2. [`backend/platform/prescriptionQualityChecks.js`](../backend/platform/prescriptionQualityChecks.js) — existing strict checks
3. [`backend/platform/categoryQualityEvaluators.js`](../backend/platform/categoryQualityEvaluators.js) — per-category evaluators
4. [`scripts/evaluate-prescription-quality.mjs`](../scripts/evaluate-prescription-quality.mjs) — golden eval CLI
5. [`scripts/golden-prescription-scenario.json`](../scripts/golden-prescription-scenario.json) — Test 3 frozen body

### Category boundary

- Implement **only** Category 17 metrics (`C17-MOP-*`, `C17-MOE-*`, `C17-MOS-*`, `C17-MOR-*`, `C17-KPI-*`).
- Reuse existing global checks where they already satisfy a metric; register the check id in `CATEGORY17_KPI_CHECK_IDS`.
- MOE metrics without telemetry: add **informational** checks (`informational: true` in detail) — non-blocking.
- Mark **TBD** metrics as informational stubs with `tbd: true` — do not block strict eval.

### Deliverables

1. **`evaluateCategory17()`** in `categoryQualityEvaluators.js` — new automatable checks
2. **`CATEGORY17_KPI_CHECK_IDS`** + **`computeCategory17Kpi()`** — weighted aggregate
3. Wire via **`runCategoryEvaluators()`** when `context.expectedBody` is set
4. Unit tests in `prescriptionQualityChecks.test.js` (happy path + one failure case if applicable)
5. Update Category 17 **Auto** column in `NEEDS_ENGINE_QUALITY_CHECK.md` for newly automated metrics
6. Optional: `docs/CATEGORY_17_MOE_RUBRIC.md` when ≥3 manual MOE metrics

### Implementation pattern (mirror Category 1)

```text
Pre-prescribe MOS  → validatePrescribeBodyMOS (Cat 1 MOS only)
Post-prescribe MOP → strict blocking checks
Informational MOE  → category17_moe_* checks (always ok: true, detail.informational)
KPI aggregate      → category17_kpi over CATEGORY17_KPI_CHECK_IDS
```

### Verification

```bash
node --test backend/platform/__tests__/prescriptionQualityChecks.test.js
npm run needs-engine:eval
```

Golden Test 3 must remain **ALL PASS** after Category 17 wiring.

---
