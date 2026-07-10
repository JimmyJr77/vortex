# Category 7 — Prerequisite-backed implementation prompt

For **Category 7 — Progression lane validity** only: all 25 metrics fully assessable (2026-07-09).

## Boundary

| Category | Owns |
|----------|------|
| **7** Lane credibility | Pattern/family sharing, graph edges, tenet/adjacency, telemetry, MOE proxies |
| **6** | Progression presence (not lane depth) |
| **8–9** | Reuse and ΔD |

**Body-driven rule:** Lane pairs audited on **highest-cap split** labels from `audience_splits`.

## Target check_id routing (complete)

| Metric | check_id | Blocking? |
|--------|----------|-----------|
| C7-MOP-01–04 | `progression_lane_*`, parity | yes |
| C7-MOP-05 | `progression_lane_match_method` | info |
| C7-MOP-06–15 | see `CATEGORY7_KPI_CHECK_IDS` | yes |
| C7-MOR-01–02 | forbidden names, deep pool | yes |
| C7-MOE-01 | `category7_moe_pair_review_packet` | info + rubric |
| C7-MOE-02–05 | cue proxy, spam, youth, equipment | yes |
| C7-MOE-06 | `progression_lane_stability` | info (lagging) |
| C7-KPI-01 | `category7_kpi` | yes |

## Deliverables (done)

1. `evaluateCategory7Lane()` — 22 blocking + 4 informational checks
2. `progressionLanePolicy.js`, `evalHistory.js`, migration `229`
3. Engine telemetry on variants + `phase_fill.lane_reject_reasons`
4. Eval: `tenetKeyById`, history JSONL, `--moe-export`
5. [`CATEGORY_7_MOE_RUBRIC.md`](../CATEGORY_7_MOE_RUBRIC.md)
6. Unit tests (27) + golden **299/299 PASS**

## Verification

```bash
node --test backend/platform/__tests__/prescriptionQualityChecks.test.js
node scripts/seed-exercise-progression-graph.mjs
npm run needs-engine:eval
```
