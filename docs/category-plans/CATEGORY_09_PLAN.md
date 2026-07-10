# Category 9 — Progression difficulty climb — Implementation Plan

Full prerequisite → build → assessment matrix (2026-07-09). Scoped to Category 9 only.

## Executive summary

| Bucket | Count | Notes |
|--------|-------|-------|
| **Blocking MOP/MOS/MOR/KPI** | 13 | Strict gates on delta, cap, fit, load, youth safety |
| **Informational MOE / band MOP** | 13 | Delta bands, headroom, highest-D proxy, coach review packet |
| **Manual MOE** | 2 | C9-MOE-01, C9-MOE-03 via rubric + automated proxies |
| **Synthetic KPI** | 1 | `category9_kpi` — 12 blocking ids + climb index in detail |

**Assessment readiness:** All 26 metrics assessable; Category 9 checks **PASS** on golden Test 3 strict eval.

## KPI check ids (12 blocking)

`progression_difficulty_output`, `progression_difficulty_capacity`, `progression_difficulty_resilience`, `progression_no_downgrade`, `progression_delta_ceiling`, `progression_within_split_cap`, `progression_fits_caps_good`, `progression_load_climb_capacity`, `progression_cap_proximity`, `progression_stretch_fit_zero`, `progression_primary_difficulty_mos`, `progression_unsafe_youth_delta`

## MOE check ids (13 informational)

`progression_delta_floor`, `progression_technical_climb`, `progression_gap_to_cap`, `progression_headroom_rate`, `progression_highest_d_first_proxy`, `progression_delta_by_phase`, `progression_delta_distribution_band`, `progression_split_separation`, `category9_moe_climb_review_packet`, `category9_moe_rpe_proxy`, `category9_moe_speed_dimension_climb`, `category9_moe_cap_exploit`, `category9_moe_climb_credible`

## 26-metric prerequisite status

| ID | Metric | Prerequisites | In app? | check_id | Evaluable? |
|----|--------|---------------|---------|----------|------------|
| C9-MOP-01 | Overall D delta | primary + progression `difficulty.overall` on Split 2 | yes | `progression_difficulty_*` | yes |
| C9-MOP-02 | Minimum delta floor | all progression deltas; Output/Capacity filter | yes | `progression_delta_floor` | yes (info) |
| C9-MOP-03 | Maximum delta ceiling | all deltas; max 4 | yes | `progression_delta_ceiling` | yes |
| C9-MOP-04 | Progression within split cap | progression D; Split 2 cap | yes | `progression_within_split_cap` | yes |
| C9-MOP-05 | progressionFitsCaps good | `classifyAgeFit` on Split 2 | yes | `progression_fits_caps_good` | yes |
| C9-MOP-06 | Technical D climb | primary + progression `difficulty.technical` | yes | `progression_technical_climb` | yes (info) |
| C9-MOP-07 | Load D climb (Capacity) | Capacity phase; `difficulty.load` | yes | `progression_load_climb_capacity` | yes |
| C9-MOP-08 | Cap proximity | Split 2 progression D / cap 10 | yes | `progression_cap_proximity` | yes |
| C9-MOP-09 | No downgrade progressions | D ≤ primary D count | yes | `progression_no_downgrade` | yes |
| C9-MOP-10 | Progression gap to cap | cap − progression D mean | yes | `progression_gap_to_cap` | yes (info) |
| C9-MOP-11 | Primary headroom rate | primary D; split2 cap | yes | `progression_headroom_rate` | yes (info) |
| C9-MOP-12 | Highest-D-first sort | pick replay / headroom proxy | yes | `progression_highest_d_first_proxy` | yes (info) |
| C9-MOP-13 | Mean delta by phase | deltas by `phase_key`; session objective | yes | `progression_delta_by_phase` | yes (info) |
| C9-MOP-14 | Delta distribution band | deltas in [1,3] | yes | `progression_delta_distribution_band` | yes (info) |
| C9-MOP-15 | Split 1 vs Split 2 separation | same item split1 vs split2 prog D | yes | `progression_split_separation` | yes (info) |
| C9-MOP-16 | Stretch progression on Split 2 | `classifyAgeFit === stretch` | yes | `progression_stretch_fit_zero` | yes |
| C9-MOS-01 | Primary difficulty present | `primary.difficulty.overall` | yes | `progression_primary_difficulty_mos` | yes |
| C9-MOR-01 | Unsafe delta jump (youth) | delta > 4; ageMax ≤ 14 | yes | `progression_unsafe_youth_delta` | yes |
| C9-MOR-02 | Progression at cap with stretch | stretch fit on Split 2 | yes | `progression_stretch_fit_zero` | yes |
| C9-MOE-01 | “One step up” perception | delta list; coach rubric | yes | `category9_moe_climb_review_packet` | partial |
| C9-MOE-02 | Split 2 RPE appropriate | field RPE 11–14 | yes | `category9_moe_rpe_proxy` | yes (info) |
| C9-MOE-03 | No safety regressions | coach safety review | yes | `category9_moe_climb_review_packet` | partial |
| C9-MOE-04 | Dimension climb speed intent | Output technical/load climb | yes | `category9_moe_speed_dimension_climb` | yes (info) |
| C9-MOE-05 | Exploits cap 10 | count D ≥ 7 | yes | `category9_moe_cap_exploit` | yes (info) |
| C9-MOE-06 | Climb credible on floor | coach keep rate | yes | `category9_moe_climb_credible` | yes (info) |
| C9-KPI-01 | Climb quality index | composite in `category9_kpi` detail | yes | `category9_kpi` | yes |

## Verification

```bash
node --test backend/platform/__tests__/prescriptionQualityChecks.test.js
npm run needs-engine:eval
```

Golden Test 3: Category 9 checks **PASS** (strict).

## Status

**Complete assessable implementation** (2026-07-09).
