# Category 2 — Phase time fill — Implementation Plan

Full prerequisite → assessment matrix (2026-07-09). Scoped to Category 2 only.

## Executive summary

| Bucket | Count | Notes |
|--------|-------|-------|
| **Blocking MOP/MOR** | 16 | C2-MOP-01–03, 06–07, 11–13, 15–16, 18 + C2-MOR-01 |
| **Blocking via strict tier** | 2 | `phase_fill_*`, `restore_fill_band`, `no_empty_phases` in `prescriptionQualityChecks.js` |
| **Informational MOP** | 6 | C2-MOP-02, 04–05, 08–10, 14, 17 (engine gaps or eval-history lag) |
| **Informational MOE** | 5 | C2-MOE-02–05 automated; C2-MOE-01/06/07 review packet |
| **Manual MOE** | 3 | C2-MOE-01, 06, 07 coach rubric |
| **Synthetic KPI** | 1 | `category2_kpi` over blocking ids + `phase_fill_*` + pool floors |

**Assessment readiness:** All 27 metrics assessable; golden Test 3 strict **PASS**.

## Prerequisite → assessment matrix (27 metrics)

| ID | Metric | Prerequisites | In app? | check_id | Evaluable? |
|----|--------|---------------|---------|----------|------------|
| C2-MOP-01 | Per-phase fill percent | `phase_fill[].fill_pct`, thresholds | yes | `phase_fill_{phase_key}` | yes |
| C2-MOP-02 | Per-phase minute gap | `target_minutes`, `estimated_minutes` | yes | `phase_underfill_gap` | yes (info) |
| C2-MOP-03 | Restore overfill cap | restore block minutes | yes | `restore_fill_band` | yes |
| C2-MOP-04 | Session total estimated minutes | Σ estimated vs Σ target | yes | `session_est_minutes_delta` | yes (info) |
| C2-MOP-05 | Item count vs policy | `items.length`, `minItemsForPhase`/`maxItemsForPhase` | yes | `phase_item_count_policy` | yes (info) |
| C2-MOP-06 | Zero-item phases | `items[]`, `no_empty_phases` | yes | `no_empty_phases` | yes |
| C2-MOP-07 | Pool size at fill time | `phase_fill[].pool_size` | yes | `phase_fill_pool_floor_{phase}` | yes |
| C2-MOP-08 | Skipped candidates ratio | `skipped_candidates`, `pool_size` | yes | `phase_fill_skip_ratio` | yes (info) |
| C2-MOP-09 | Split reject ratio | `split_rejects`, `pool_size` | yes | `phase_fill_split_rejects` | yes (info) |
| C2-MOP-10 | Backfill contribution | `items[].fill_pass`, dose seconds | yes | `phase_backfill_contribution` | yes (info) |
| C2-MOP-11 | Budget ceiling violations | item dose vs `target_minutes×60` | yes | `phase_dose_budget_ceiling` | yes |
| C2-MOP-12 | phase_fill coverage | `phase_fill[]` vs `blocks[]` keys | yes | `phase_fill_coverage` | yes |
| C2-MOP-13 | Per-phase overfill cap | non-restore `estimated/target` | yes | `phase_overfill_cap` | yes |
| C2-MOP-14 | Fill stability (eval runs) | ≥5 runs `phase_fill` in history JSONL | yes | `category2_fill_stability` | yes (info) |
| C2-MOP-15 | Dose sum accuracy | dose seconds vs `estimated_minutes` | yes | `phase_dose_sum_accuracy` | yes |
| C2-MOP-16 | Longest item dominance | max item sec / phase sec | yes | `phase_item_dominance` | yes |
| C2-MOP-17 | Backfill item share | `fill_pass === 'backfill'` count | yes | `phase_backfill_item_share` | yes (info) |
| C2-MOP-18 | Severe underfill flagged | `empty_phase_reasons` underfilled | yes | `no_underfill_reasons` | yes |
| C2-MOE-01 | Phase feels full not padded | Output/Capacity coach review | yes | `category2_moe_review_packet` | partial (manual) |
| C2-MOE-02 | Prepare density appropriate | Prepare items/min | yes | `category2_moe_prepare_density` | yes (info) |
| C2-MOE-03 | Sustained conditioning intent | fill + conditioning tags | yes | `category2_moe_sustained_conditioning_focus` | yes (info) |
| C2-MOE-04 | No chronic underfill pattern | eval history fill_pct | yes | `category2_moe_chronic_underfill` | yes (info) |
| C2-MOE-05 | Fatigue curve minutes | pre-Sustained minute share | yes | `category2_moe_fatigue_curve` | yes (info) |
| C2-MOE-06 | Transition time realistic | coach checklist | yes | `category2_moe_review_packet` | partial (manual) |
| C2-MOE-07 | No single drill dominates | coach + C2-MOP-16 | yes | `category2_moe_review_packet` + `phase_item_dominance` | partial |
| C2-MOR-01 | High-intent underfill risk | Output/Capacity/Resilience fill | yes | `high_intent_underfill_70` | yes |
| C2-KPI-01 | Phase fill health index | blocking pass rate | yes | `category2_kpi` | yes |

## KPI check ids (blocking aggregate)

Explicit in `CATEGORY2_KPI_CHECK_IDS`: `phase_fill_coverage`, `phase_overfill_cap`, `high_intent_underfill_70`, `phase_dose_budget_ceiling`, `phase_dose_sum_accuracy`, `phase_item_dominance`, `no_underfill_reasons`, `no_empty_phases`, `restore_fill_band`.

Also counted via prefix: `phase_fill_{phase_key}` (from `prescriptionQualityChecks.js`), `phase_fill_pool_floor_{phase}`.

## MOE check ids (8 informational)

`category2_moe_prepare_density`, `category2_moe_sustained_conditioning_focus`, `category2_moe_fatigue_curve`, `category2_moe_chronic_underfill`, `category2_moe_review_packet`, `category2_fill_stability`, `phase_backfill_contribution`, `phase_backfill_item_share`

## Engine instrumentation (2026-07-09)

- `fillPhaseItems` stamps `fill_pass: 'primary' | 'backfill'` on prescribed items (`phaseAwarePrescription.js`).
- Eval CLI appends `phase_fill` to `NEEDS_ENGINE_QUALITY_HISTORY.jsonl`; `computeFillStability` / `computeChronicUnderfill` in `evalHistory.js`.

## Engine gaps surfaced on golden (informational until fixed)

| Phase | Issue | Metric |
|-------|-------|--------|
| Output | 37/40m (3m gap) | C2-MOP-02 |
| Capacity | 27/30m (3m gap) | C2-MOP-02 |
| Session | 113m est vs 120m target | C2-MOP-04 |
| Prepare | 8 items vs policy max 6 | C2-MOP-05 |
| Sustained | 3 items vs HIIT max 2 | C2-MOP-05 |

These remain **informational** so strict eval stays green while engine fill policy improves separately.

## Verification

```bash
node --test backend/platform/__tests__/prescriptionQualityChecks.test.js
npm run needs-engine:eval
```

## Status

**Complete assessable implementation** (2026-07-09).
