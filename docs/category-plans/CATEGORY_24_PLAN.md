# Category 24 — Programming / block format — Implementation Plan

Full prerequisite → assessment matrix (2026-07-09). Scoped to Category 24 only.

## Executive summary

| Bucket | Count | Notes |
|--------|-------|-------|
| **Blocking MOP/MOR** | 13 | Dose fields, time reconciliation, rationale coverage, MOR breaches |
| **Informational MOP** | 10 | Youth sets, sustained shape, restore density, phase density, rest bands, scaling/education/default-dose proxies |
| **Informational MOE** | 6 | Automated proxies + dose stability (lagging) + builder TBD |
| **Manual MOE** | 5 | C24-MOE-01–03, 05–06 via review packet |
| **TBD (non-blocking)** | 2 | C24-MOP-12 builder programming_method; C24-MOE-04 builder EMOM |
| **Synthetic KPI** | 1 | `category24_kpi` — blocking pass rate + dose fidelity composite |

**Assessment readiness:** All 37 metrics assessable; golden Test 3 strict **PASS**.

## Prerequisite → assessment matrix (37 metrics)

| ID | Metric | Prerequisites | In app? | check_id | Evaluable? |
|----|--------|---------------|---------|----------|------------|
| C24-MOP-01 | Per-item sets present | `blocks[].items[].sets` numeric | yes | `item_sets_present` | yes |
| C24-MOP-02 | Per-item rest present | `rest_seconds` incl. 0 | yes | `item_rest_present` | yes |
| C24-MOP-03 | Time estimate derivable | `formatItemSeconds` vs `estimated_minutes` | yes | `format_time_reconciliation` | yes |
| C24-MOP-04 | Default sets sanity | youth fitness primaries sets 1–5 | yes | `format_youth_sets_sanity` | yes (info) |
| C24-MOP-05 | Rest = 0 honored | `rest_seconds === 0` → sets×work | yes | `format_rest_zero_honored` | yes |
| C24-MOP-06 | Work seconds timed dose | `work_seconds` in time model | yes | `format_work_seconds_timed` | yes |
| C24-MOP-07 | Sustained HIIT dose shape | Sustained interval structure | yes | `format_sustained_hiit_shape` | yes (info) |
| C24-MOP-08 | Restore low density | Restore sets≤2 or work≤60 | yes | `format_restore_low_density` | yes (info) |
| C24-MOP-09 | Selection rationale present | `selection_rationale` ≥95% | yes | `selection_rationale_coverage` | yes |
| C24-MOP-10 | Placement rationale present | `placement_rationale` ≥90% | yes | `placement_rationale_coverage` | yes |
| C24-MOP-11 | Relaxed sustained pool fill label | relaxed-fill marker in rationale | yes | `format_relaxed_pool_marker` | yes |
| C24-MOP-12 | Block programming_method (builder) | post-builder assignability | partial | `format_builder_programming_method` | yes (TBD) |
| C24-MOP-13 | est_seconds_per_set present | field or derivable from work | yes | `format_est_seconds_coverage` | yes (info) |
| C24-MOP-14 | Reps vs timed dose coherence | no reps+work_seconds conflict | yes | `item_reps_work_coherence` | yes (info) |
| C24-MOP-15 | Phase dose density | sum(itemSec)/target_min 0.85–1.10 | yes | `format_phase_dose_density` | yes (info) |
| C24-MOP-16 | Output rest adequacy | Output rest≥20s for power | yes | `format_output_rest_adequacy` | yes (info) |
| C24-MOP-17 | Capacity rest vs load | load≥6 → rest≥45s | yes | `format_capacity_rest_vs_load` | yes (info) |
| C24-MOP-18 | scaling_rationale present | scaling_rationale or per_split guidance | yes | `format_scaling_rationale_rate` | yes (info) |
| C24-MOP-19 | split_fallback_used flag | activation rate | yes | `format_split_fallback_rate` | yes (info) |
| C24-MOP-20 | Score field populated | numeric `score` 100% | yes | `item_score_populated` | yes |
| C24-MOP-21 | phase_fit on items | `phase_fit` ≥95% | yes | `item_phase_fit_present` | yes |
| C24-MOP-22 | Education-backed rationale | non-generic selection_rationale | yes | `format_education_rationale_rate` | yes (info) |
| C24-MOP-23 | Default dose matches card | sets/rest vs exercise defaults | yes | `format_default_dose_match` | yes (info) |
| C24-MOS-01 | Exercise card default dose complete | prescribed exercise default dose | yes | `format_library_dose_mos` | yes (info) |
| C24-MOR-01 | Dose-time reconciliation breach | phase error >20% | yes | `format_dose_reconciliation_mor` | yes |
| C24-MOR-02 | Oversize single item dominates | one item >50% phase sec (non-Sustained) | yes | `format_item_dominance_mor` | yes |
| C24-MOE-01 | Dose feels coachable | coach session-run rubric | yes | `category24_moe_review_packet` | partial (manual) |
| C24-MOE-02 | Sustained format matches HIIT intent | interval structure proxy | yes | `category24_moe_sustained_hiit` | yes (info) |
| C24-MOE-03 | Restore format is recovery | low-density proxy | yes | `category24_moe_restore_recovery` | yes (info) |
| C24-MOE-04 | EMOM/interval assignment (builder) | builder QA | partial | `category24_moe_builder_programming` | yes (TBD) |
| C24-MOE-05 | Phase-appropriate programming type | builder phase-type QA | partial | `category24_moe_builder_programming` | yes (TBD) |
| C24-MOE-06 | Youth rest not rushed | Output rest adequacy proxy | yes | `category24_moe_output_rest_youth` | yes (info) |
| C24-MOE-07 | Dose stability (lagging) | eval history phase_estimated_minutes | yes | `category24_dose_stability` | yes (info) |
| C24-KPI-01 | Dose fidelity index | composite over blocking + fidelity formula | yes | `category24_kpi` | yes |

## KPI check ids (13 blocking)

`item_sets_present`, `item_rest_present`, `format_time_reconciliation`, `item_score_populated`, `item_phase_fit_present`, `selection_rationale_coverage`, `placement_rationale_coverage`, `format_relaxed_pool_marker`, `format_dose_reconciliation_mor`, `format_item_dominance_mor`, `format_rest_zero_honored`, `format_work_seconds_timed`

Composite formula (C24-KPI-01): `dose_field_completeness × time_reconciliation × rationale_coverage` (min 0.90)

## MOE check ids (19 informational + review packet)

`category24_moe_review_packet`, `category24_moe_sustained_hiit`, `category24_moe_restore_recovery`, `category24_moe_output_rest_youth`, `category24_moe_builder_programming`, `category24_dose_stability`, `format_youth_sets_sanity`, `format_sustained_hiit_shape`, `format_restore_low_density`, `format_phase_dose_density`, `format_est_seconds_coverage`, `format_output_rest_adequacy`, `format_capacity_rest_vs_load`, `format_scaling_rationale_rate`, `format_split_fallback_rate`, `format_default_dose_match`, `format_education_rationale_rate`, `format_library_dose_mos`, `format_builder_programming_method`

## Engine instrumentation (2026-07-09)

- `evaluateCategory24Format()` in `categoryEvaluatorsExtended.js` — shared `formatItemSeconds()` (mirrors `itemSecondsFromExercise`).
- Eval CLI appends `phase_estimated_minutes` to `NEEDS_ENGINE_QUALITY_HISTORY.jsonl`; `computeDoseStability()` in `evalHistory.js`.

## Engine gaps surfaced on golden (informational until fixed)

| Issue | Metric |
|-------|--------|
| Engine stamps both `default_reps` and `default_work_seconds` on many cards | C24-MOP-14 |

These remain **informational** so strict eval stays green while dose-field policy improves separately.

## Verification

```bash
node --test backend/platform/__tests__/prescriptionQualityChecks.test.js
npm run needs-engine:eval
```

## Status

**Complete assessable implementation** (2026-07-09). Golden Test 3 strict PASS.
