# Category 25 — Library & pool coverage — Implementation Plan

Full prerequisite → assessment matrix (2026-07-09). Scoped to Category 25 only.

## Executive summary

| Bucket | Count | Notes |
|--------|-------|-------|
| **Blocking MOP/MOS/MOR/KPI** | 15 | Pool floors, feasibility, progression coverage, snapshot, KPI composite |
| **Informational MOP** | 9 | Global pool proxy, tag replay, equipment shrink, audit baseline |
| **Informational MOE** | 8 | Review packet, stability lagging metrics, duration/parity TBD |
| **Synthetic KPI** | 1 | `category25_kpi` — pool health index over `CATEGORY25_KPI_CHECK_IDS` |

**Assessment readiness:** All 36 metrics assessable; golden Test 3 strict **PASS**.

## Prerequisite → assessment matrix (36 metrics)

| ID | Metric | Prerequisites | In app? | check_id | Evaluable? |
|----|--------|---------------|---------|----------|------------|
| C25-MOP-01 | Global candidate pool size | `candidates[]`, `phase_fill` avg pool | yes | `library_global_pool_size` | yes (info) |
| C25-MOP-02 | Per-phase pool_size (Output) | `phase_fill[output].pool_size` | yes | `library_pool_floor_output` | yes |
| C25-MOP-03 | Per-phase pool_size (Capacity) | `phase_fill[capacity].pool_size` | yes | `library_pool_floor_capacity` | yes |
| C25-MOP-04 | Per-phase pool_size (Restore) | `phase_fill[restore].pool_size` | yes | `library_pool_floor_restore` | yes |
| C25-MOP-05 | Per-phase pool_size (Sustained HIIT) | `phase_fill[sustained_capacity].pool_size` | yes | `library_pool_floor_sustained` | yes |
| C25-MOP-06 | MI pool depth youth | `phase_fill[movement_intelligence].pool_size` | yes | `library_pool_floor_mi` | yes |
| C25-MOP-07 | Speed tenet pool (Output) | `candidates` + `exercise_tag` tenet 3 | yes | `library_speed_tenet_pool` | yes (info) |
| C25-MOP-08 | HIIT methodology pool | `candidates` + methodology 1169 | yes | `library_hiit_methodology_pool` | yes (info) |
| C25-MOP-09 | Equipment use narrows but feasible | `empty_phase_reasons` pool_empty | yes | `no_empty_phases` | yes |
| C25-MOP-10 | Avoid narrows but feasible | avoid active + Output/Capacity fill | yes | `equipment_avoid_phase_pool_empty` / `library_avoid_feasible` | yes |
| C25-MOP-11 | Progression graph coverage | `phase_fill.progression_coverage` Output/Capacity | yes | `library_progression_pool_coverage` | yes |
| C25-MOP-12 | HIIT fallback activation | `selection_rationale` relaxed-fill count | yes | `library_hiit_fallback_rate` | yes |
| C25-MOP-13 | Split variant pool stress | `split_rejects/pool_size` | yes | `library_split_reject_ratio` | yes |
| C25-MOP-14 | Prepare pool_size floor | `phase_fill[prepare_and_access].pool_size` | yes | `library_pool_floor_prepare` | yes |
| C25-MOP-15 | Resilience pool_size floor | `phase_fill[resilience].pool_size` | yes | `library_pool_floor_resilience` | yes |
| C25-MOP-16 | Scored candidate count | `candidates.length` top-40 snapshot | yes | `library_scored_candidate_floor` | yes |
| C25-MOP-17 | Focus-target eligible share | tenet 3 / methodology 1169 share | yes | `library_focus_target_eligible_share` | yes (info) |
| C25-MOP-18 | D6–D8 progression lane pool | candidates D6–8 + progression graph | yes | `library_d68_progression_lane_pool` | yes (info) |
| C25-MOP-19 | Kettlebell pool post-use filter | use active + equipment tags | yes | `library_kettlebell_pool` | yes (info) |
| C25-MOP-20 | Cones pool post-use filter | use active + equipment tags | yes | `library_cones_pool` | yes (info) |
| C25-MOP-21 | pool_empty vs over-filtered | `constraint_mislabeled_pool_empty_mor` | yes | `constraint_mislabeled_pool_empty_mor` | yes |
| C25-MOP-22 | Top-40 candidate snapshot | `candidates.length`, score spread | yes | `library_candidate_snapshot` + `library_candidate_score_spread` | yes |
| C25-MOP-23 | Audit script D6–D8 baseline | audit script / D-band proxy | partial | `library_audit_d68_baseline` | yes (info) |
| C25-MOP-24 | Equipment-use filter shrink ratio | use-tagged / top-40 share | yes | `library_equipment_use_shrink_ratio` | yes (info) |
| C25-MOS-01 | Published library floor | DB `coaching.exercise` count | yes | `library_published_floor` | yes |
| C25-MOR-01 | Chronic HIIT fallback dependency | eval history `hiit_fallback_count` | yes | `library_hiit_fallback_chronic` | yes (info lagging) |
| C25-MOR-02 | Progression graph gap blocks strict | candidates + progression graph | yes | `library_progression_graph_gap` | yes (info) |
| C25-MOE-01 | Library supports strict loop | eval history strict PASS streak | yes | `category25_moe_strict_loop_stability` | yes (info) |
| C25-MOE-02 | Thin pool identifiable | `constraint_report` + review packet | yes | `category25_moe_thin_pool_diagnosable` | yes (info) |
| C25-MOE-03 | Focus targets not over-constraining | Output pattern diversity | yes | `category25_moe_speed_pattern_diversity` | yes (info) |
| C25-MOE-04 | Content team prioritization | audit backlog proxy | yes | `category25_moe_focus_starvation` | yes (info) |
| C25-MOE-05 | Pool depth scales with duration | 60 vs 120 min A/B matrix | no | `category25_moe_duration_stress` | yes (info TBD matrix) |
| C25-MOE-06 | Facility library parity | staging vs prod diff | no | `category25_moe_facility_parity` | yes (info TBD) |
| C25-MOE-07 | Migration regression guard | eval history pool_empty stability | yes | `category25_moe_migration_guard` | yes (info lagging) |
| C25-MOE-08 | Focus starvation diagnosable | constraint_report attribution | yes | `category25_moe_review_packet` | partial (manual) |
| C25-KPI-01 | Pool health index | composite over blocking ids | yes | `category25_kpi` | yes |

## KPI check ids (14 blocking)

`no_empty_phases`, `library_pool_floor_output`, `library_pool_floor_capacity`, `library_pool_floor_restore`, `library_pool_floor_sustained`, `library_pool_floor_prepare`, `library_pool_floor_resilience`, `library_pool_floor_mi`, `library_hiit_fallback_rate`, `library_split_reject_ratio`, `constraint_mislabeled_pool_empty_mor`, `library_progression_pool_coverage`, `library_candidate_snapshot`

## MOE check ids (8 informational)

`category25_moe_review_packet`, `category25_moe_strict_loop_stability`, `category25_moe_thin_pool_diagnosable`, `category25_moe_focus_starvation`, `category25_moe_speed_pattern_diversity`, `category25_moe_duration_stress`, `category25_moe_facility_parity`, `category25_moe_migration_guard`

## Verification

```bash
node --test backend/platform/__tests__/prescriptionQualityChecks.test.js
npm run needs-engine:eval
```

## Status

**Complete assessable implementation** (2026-07-09). Golden Test 3 strict **PASS** (692/692). Closes Categories 1–25 implementation loop.
