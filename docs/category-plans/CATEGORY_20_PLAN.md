# Category 20 — Constraint report health — Implementation Plan

Full prerequisite → assessment matrix (2026-07-09). Scoped to Category 20 only.

## Executive summary

| Bucket | Count | Notes |
|--------|-------|-------|
| **Blocking MOP/MOS/MOR (P0)** | 4 | `no_empty_phases`, `all_blocks_nonempty`, `constraint_silent_pool_empty_mor`, `constraint_mislabeled_pool_empty_mor` |
| **Blocking MOP/MOS/MOR** | 18 | Schema, taxonomy, reconcile, skip/split ratios, avoid sub-reports |
| **Informational MOP** | 2 | C20-MOP-17 `constraint_hiit_fallback_logged`, C20-MOP-18 `constraint_split_fallback_rate` |
| **Informational MOE** | 2 | C20-MOE-02 underfill masking, C20-MOE-03 pool_empty stability |
| **TBD stubs (informational)** | 3 | C20-MOE-04/05/07 via `category20_tbd_*` |
| **Manual MOE** | 2 | C20-MOE-01, C20-MOE-06 via `category20_moe_review_packet` |
| **Lagging MOR/MOE** | 2 | C20-MOR-03 `constraint_chronic_split_rejects`, C20-MOE-03 eval history |
| **Synthetic KPI** | 1 | `category20_kpi` over `CATEGORY20_KPI_CHECK_IDS` (10 ids) |

**Assessment readiness:** All 34 metrics assessable; golden Test 3 strict **PASS**.

## Prerequisite → assessment matrix (34 metrics)

| ID | Metric | Prerequisites | In app? | check_id | Evaluable? |
|----|--------|---------------|---------|----------|------------|
| C20-MOP-01 | No pool_empty reasons | `empty_phase_reasons` | yes | `no_empty_phases` | yes (P0) |
| C20-MOP-02 | No zero-item phases | `blocks[].items` | yes | `all_blocks_nonempty` | yes (P0) |
| C20-MOP-03 | No severe underfill flags | `underfilled (< 50%)` pattern | yes | `constraint_no_severe_underfill` | yes |
| C20-MOP-04 | Phase fill rows complete | `phase_fill.length === blocks.length` | yes | `constraint_phase_fill_complete` | yes |
| C20-MOP-05 | Per-phase pool_size floor | Output/Capacity ≥5, Restore ≥3 | yes | `constraint_pool_size_floor` | yes |
| C20-MOP-06 | Skipped candidates ratio | `skipped_candidates/pool_size` per phase | yes | `constraint_skip_ratio_per_phase` | yes |
| C20-MOP-07 | Split reject ratio | `split_rejects/pool_size` when splits active | yes | `constraint_split_reject_ratio` | yes |
| C20-MOP-08 | all_candidates_filtered diagnosis | items>0 + high skips ≠ pool_empty | yes | `constraint_pool_empty_mislabel` | yes |
| C20-MOP-09 | Equipment avoid report present | `equipmentAvoidIds` configured | yes | `constraint_equipment_avoid_report` | yes |
| C20-MOP-10 | Exercise avoid report present | avoid IDs/slugs configured | yes | `constraint_exercise_avoid_report` | yes |
| C20-MOP-11 | Body region avoid report | `excludeBodyRegionIds` configured | yes | `constraint_body_region_avoid_report` | yes |
| C20-MOP-12 | Constraint report JSON valid | schema key checklist | yes | `constraint_report_schema` | yes |
| C20-MOP-13 | Reason taxonomy complete | `pool_empty`, `all_candidates_filtered`, `underfilled` | yes | `constraint_reason_taxonomy` | yes |
| C20-MOP-14 | phase_fill ↔ blocks reconcile | fill_pct Δ ≤ 1% | yes | `constraint_fill_pct_reconcile` | yes |
| C20-MOP-15 | pool_empty iff pool_size zero | zero pool → pool_empty reason | yes | `constraint_pool_empty_iff_zero` | yes |
| C20-MOP-16 | Zero items + pool_size > 0 | empty block → all_candidates_filtered | yes | `constraint_filtered_when_pool_positive` | yes |
| C20-MOP-17 | HIIT fallback contribution logged | `selection_rationale` relaxed-pool marker | yes | `constraint_hiit_fallback_logged` | yes (info) |
| C20-MOP-18 | split_fallback_used count | per-phase share; alert >30% | yes | `constraint_split_fallback_rate` | yes (info) |
| C20-MOP-19 | Parseable phase key in reasons | label/phase_key resolvable | yes | `constraint_reason_phase_key` | yes |
| C20-MOP-20 | Session aggregate skip ratio | sum(skipped)/sum(pool) | yes | `constraint_session_skip_ratio` | yes |
| C20-MOP-21 | High skips + low items flagged | skip>0.85 AND items≤2 | yes | `constraint_high_skip_low_items` | yes |
| C20-MOP-22 | Avoid sub-report consistency | excluded_count>0 OR explicit empty | yes | `constraint_avoid_subreport_consistency` | yes |
| C20-MOS-01 | constraint_report on success | HTTP 200 prescribe response | yes | `constraint_report_present` | yes |
| C20-MOE-01 | Engine failure explainable | coach/engineer readability | yes | `category20_moe_review_packet` | partial (manual) |
| C20-MOE-02 | No silent phase compromise | 1 item + fill<80% masking | yes | `category20_moe_underfill_masking` | yes (info) |
| C20-MOE-03 | Stable across eval runs | 0 pool_empty in 5/5 runs | yes | `category20_moe_pool_empty_stability` | yes (info) |
| C20-MOE-04 | Split rejects actionable | reject reason codes | no | `category20_tbd_split_reject_codes` | yes (TBD stub) |
| C20-MOE-05 | Pool depth supports iteration | library playbook | no | `category20_tbd_pool_playbook` | yes (TBD stub) |
| C20-MOE-06 | Root-cause time bounded | engineer <5 min diagnosis | yes | `category20_moe_review_packet` | partial (manual) |
| C20-MOE-07 | Filter cascade explainable | skip driver breakdown | no | `category20_tbd_skip_breakdown` | yes (TBD stub) |
| C20-MOR-01 | Silent pool_empty | pool_empty OR empty block w/o reason | yes | `constraint_silent_pool_empty_mor` | yes (P0) |
| C20-MOR-02 | Mislabeled filter failure | pool_empty when pool_size>0 | yes | `constraint_mislabeled_pool_empty_mor` | yes (P0) |
| C20-MOR-03 | Chronic high split_rejects | split_rejects/pool>0.5 in 3/5 runs | yes | `constraint_chronic_split_rejects` | yes (lagging) |
| C20-KPI-01 | Constraint report integrity index | C20-MOP-01–04, 13–16, MOR-01–02 | yes | `category20_kpi` | yes |

## KPI check ids (10 blocking)

`no_empty_phases`, `all_blocks_nonempty`, `constraint_no_severe_underfill`, `constraint_phase_fill_complete`, `constraint_reason_taxonomy`, `constraint_fill_pct_reconcile`, `constraint_pool_empty_iff_zero`, `constraint_filtered_when_pool_positive`, `constraint_silent_pool_empty_mor`, `constraint_mislabeled_pool_empty_mor`

## MOE check ids (6 informational + TBD)

`category20_moe_review_packet`, `category20_moe_underfill_masking`, `category20_moe_pool_empty_stability`, `category20_tbd_split_reject_codes`, `category20_tbd_pool_playbook`, `category20_tbd_skip_breakdown`

## Engine backlog (document only)

| Metric | Backlog item | Tracking |
|--------|--------------|----------|
| C20-MOE-04 | Split reject reason codes not in `constraint_report` | `category20_tbd_split_reject_codes` |
| C20-MOE-05 | Thin-pool library playbook not wired | `category20_tbd_pool_playbook` |
| C20-MOE-07 | Per-phase skip driver breakdown (`skip_reasons`) TBD | `category20_tbd_skip_breakdown` |

## Verification

```bash
node --test backend/platform/__tests__/prescriptionQualityChecks.test.js
npm run needs-engine:eval
```

## Status

**Complete assessable implementation** (2026-07-09). Golden Test 3 strict PASS; all 10 KPI ids + 6 MOE/TBD ids emit when `expectedBody` set.
