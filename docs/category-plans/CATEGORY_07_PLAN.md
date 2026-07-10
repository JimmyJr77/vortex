# Category 7 — Progression lane validity — Implementation Plan

Full prerequisite → build → assessment matrix (2026-07-09). Scoped to Category 7 only.

## Executive summary

| Bucket | Count | Notes |
|--------|-------|-------|
| **Blocking MOP/MOS/MOR/KPI** | 22 | All automatable lane checks including graph, tenet, adjacency, telemetry |
| **Informational MOE** | 4 | Match method, integrity, coach review packet, lane stability (lagging) |
| **Manual MOE** | 4 | C7-MOE-01–04 via rubric + automated proxies where noted |
| **Synthetic KPI** | 1 | `category7_kpi` — 22 blocking ids + lane integrity factor |

**Assessment readiness:** All 25 metrics assessable; golden Test 3 strict **299/299 PASS**.

## KPI check ids (22 blocking)

`progression_lane_output`, `progression_lane_capacity`, `progression_lane_resilience`, `progression_lane_pattern_share`, `progression_lane_family_fallback`, `progression_lane_engine_parity`, `progression_lane_phase_allowlist`, `progression_primary_lane_precondition`, `progression_lane_profile_role`, `progression_forbidden_names`, `progression_forbidden_lane_pairs`, `progression_graph_edge_rate`, `progression_lane_tenet_alignment`, `progression_lane_phase_adjacency`, `progression_methodology_mismatch`, `progression_lane_pattern_priority_rate`, `progression_full_scored_fallback_rate`, `progression_equipment_continuity`, `progression_lane_deep_pool_rejects`, `progression_youth_age_fit`, `progression_lane_spam_guard`, `progression_lane_cue_lane_proxy`

## MOE check ids (4 informational)

`progression_lane_match_method`, `category7_moe_lane_integrity`, `category7_moe_pair_review_packet`, `progression_lane_stability`

## Data & engine builds

| Build | File | Unblocks |
|-------|------|----------|
| `coaching.exercise_progression` + seed | `229_coaching_exercise_progression.sql`, `seed-exercise-progression-graph.mjs` | C7-MOP-07 |
| Lane policy module | `progressionLanePolicy.js` | C7-MOP-06, 09, 11 |
| Pick metadata + lane rejects | `phaseAwarePrescription.js` | C7-MOP-05, 08, 12, 13, MOR-02 |
| Tenet loader + eval history | `evaluate-prescription-quality.mjs`, `evalHistory.js` | C7-MOE-06 |
| Strict golden thresholds | `golden-prescription-scenario.json` | C7-MOR-01, bands |

## 25-metric prerequisite status

| ID | check_id / artifact | Status |
|----|---------------------|--------|
| C7-MOP-01–04 | `progression_lane_*`, parity | Available |
| C7-MOP-05 | `progression_lane_match_method` on variant | Available |
| C7-MOP-06 | `progressionLanePolicy` + thresholds | Available |
| C7-MOP-07 | `progression_graph_edge_rate` | Available |
| C7-MOP-08 | `progression_lane_pattern_priority_rate` | Available |
| C7-MOP-09 | `progression_lane_tenet_alignment` | Available |
| C7-MOP-10 | `progression_methodology_mismatch` | Available |
| C7-MOP-11 | `progression_lane_phase_adjacency` | Available |
| C7-MOP-12 | `progression_full_scored_fallback_rate` | Available |
| C7-MOP-13 | `lane_reject_reasons` on `phase_fill` | Available |
| C7-MOP-14–15 | profile role, precondition | Available |
| C7-MOS-01 | phase allowlist | Available |
| C7-MOR-01–02 | forbidden names, deep pool | Available |
| C7-MOE-01 | `category7_moe_pair_review_packet` + `--moe-export` | Available |
| C7-MOE-02 | `progression_lane_cue_lane_proxy` | Available |
| C7-MOE-03 | `progression_lane_spam_guard` | Available |
| C7-MOE-04 | `progression_youth_age_fit` | Available |
| C7-MOE-05 | `progression_equipment_continuity` | Available |
| C7-MOE-06 | `progression_lane_stability` + history JSONL | Available |
| C7-KPI-01 | `category7_kpi` | Available |

## Verification

```bash
node --test backend/platform/__tests__/prescriptionQualityChecks.test.js
node scripts/seed-exercise-progression-graph.mjs
npm run needs-engine:eval
```

Golden Test 3: **299/299 PASS** (strict).

## Status

**Complete assessable implementation** (2026-07-09).
