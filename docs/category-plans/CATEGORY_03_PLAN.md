# Category 3 — Restore phase — Implementation Plan

Full prerequisite → assessment matrix (2026-07-09). Scoped to Category 3 only.

## Executive summary

| Bucket | Count | Notes |
|--------|-------|-------|
| **Blocking MOP/MOR** | 19 | 17 MOP + 1 MOR + 1 golden density (`restore_golden_item_count`) |
| **Blocking via strict tier** | 5 | `restore_non_empty`, `restore_no_pool_empty`, `restore_fill_band`, `no_progression_restore`, `restore_not_box_avoid_false_positive` |
| **Informational MOE** | 6 | C3-MOE-01–05, 07 automated; C3-MOE-03 proxy via `category3_moe_arousal_downshift` |
| **Manual MOE** | 2 | C3-MOE-06, C3-MOE-08 → `category3_moe_review_packet` + rubric |
| **Synthetic KPI** | 1 | `category3_kpi` over `CATEGORY3_KPI_CHECK_IDS` (19 ids) |

**Assessment readiness:** All 27 metrics assessable; golden Test 3 strict **PASS**.

## Prerequisite → assessment matrix (27 metrics)

| ID | Metric | Prerequisites | In app? | check_id | Evaluable? |
|----|--------|---------------|---------|----------|------------|
| C3-MOP-01 | Restore item count | restore block; `items.length`; dual threshold | yes | `restore_non_empty`, `restore_golden_item_count` | yes |
| C3-MOP-02 | Restore pool_empty | `empty_phase_reasons`; restore key | yes | `restore_no_pool_empty` | yes |
| C3-MOP-03 | Restore fill band | restore `target_minutes`, `estimated_minutes` | yes | `restore_fill_band` | yes |
| C3-MOP-04 | Restore profile role eligible | `exercise_phase_profile` for phase `restore` | yes | `restore_profile_role_valid` | yes |
| C3-MOP-05 | Restore order-slot coverage | profile `order_slot`; `RESTORE_BOOST_SLOTS` | yes | `restore_order_slot_boost` | yes |
| C3-MOP-06 | Restore impact ceiling | profile `impact_level` < 2 | yes | `restore_impact_ceiling` | yes |
| C3-MOP-07 | No output-primary in restore | `primary_phase_key` per item | yes | `restore_no_output_primary` | yes |
| C3-MOP-08 | Excluded methodology tags | methodology tags; `EXCLUDED_METHODOLOGY_KEYS` | yes | `restore_excluded_methodology` | yes |
| C3-MOP-09 | Restore difficulty band | `difficulty.overall`; session cap | yes | `restore_difficulty_band` | yes |
| C3-MOP-10 | Restore equipment avoid clean | equipment tags; expanded avoid IDs | yes | `restore_equipment_avoid_clean`, `restore_not_box_avoid_false_positive` | yes |
| C3-MOP-11 | Restore max items | `maxItemsForPhase('restore', minutes)` | yes | `restore_max_items` | yes |
| C3-MOP-12 | Restore block position | restore index === last | yes | `restore_block_last` | yes |
| C3-MOP-13 | No progression variants | restore `per_split[].variant_type` | yes | `no_progression_restore` | yes |
| C3-MOP-14 | Restore dose ceiling | `sets`, `work_seconds`, `reps` | yes | `restore_dose_ceiling` | yes |
| C3-MOP-15 | Restore slug uniqueness | primary slugs in restore | yes | `restore_slug_unique` | yes |
| C3-MOP-16 | Restore role avoid count | profile `role === 'avoid'` | yes | `restore_profile_role_valid` (role_avoid) | yes |
| C3-MOP-17 | Restore candidate policy pass | `restoreCandidateExcluded` replay | yes | `restore_candidate_policy_pass` | yes |
| C3-MOE-01 | Breathing content present | slug/tags breathing pattern | yes | `category3_moe_breathing` | yes (info) |
| C3-MOE-02 | Mobility / downregulation present | mobility tags/slug taxonomy | yes | `category3_moe_mobility` | yes (info) |
| C3-MOE-03 | Restore lowers arousal | slug/methodology/impact heuristics | yes | `category3_moe_arousal_downshift` | yes (info) |
| C3-MOE-04 | Restore complements session fatigue | Sustained conditioning focus + reset slugs | yes | `category3_moe_post_sustained_conditioning_reset` | yes (info) |
| C3-MOE-05 | Youth-appropriate restore | `work_seconds`; scaling on variants | yes | `category3_moe_youth_hold_ceiling` | yes (info) |
| C3-MOE-06 | Coach would keep restore block | coach reviewer | yes | `category3_moe_review_packet` | partial (manual) |
| C3-MOE-07 | Prepare–Restore bookend symmetry | Prepare + Restore tag overlap | yes | `category3_moe_bookend_overlap` | yes (info) |
| C3-MOE-08 | Post-conditioning downshift credible | coach Likert after HIIT Sustained | yes | `category3_moe_review_packet` | partial (manual) |
| C3-MOR-01 | High-arousal restore after conditioning | Sustained conditioning focus + methodology tags | yes | `restore_high_arousal_after_sustained_conditioning` | yes |
| C3-KPI-01 | Restore health index | pass rate on blocking ids | yes | `category3_kpi` | yes |

## KPI check ids (19 blocking)

`restore_non_empty`, `restore_no_pool_empty`, `restore_fill_band`, `restore_not_box_avoid_false_positive`, `restore_equipment_avoid_clean`, `no_progression_restore`, `restore_golden_item_count`, `restore_block_last`, `restore_max_items`, `restore_profile_role_valid`, `restore_order_slot_boost`, `restore_impact_ceiling`, `restore_no_output_primary`, `restore_excluded_methodology`, `restore_difficulty_band`, `restore_dose_ceiling`, `restore_slug_unique`, `restore_candidate_policy_pass`, `restore_high_arousal_after_sustained_conditioning`

## MOE check ids (7 informational)

`category3_moe_breathing`, `category3_moe_mobility`, `category3_moe_post_sustained_conditioning_reset`, `category3_moe_youth_hold_ceiling`, `category3_moe_bookend_overlap`, `category3_moe_arousal_downshift`, `category3_moe_review_packet`

## C3-MOE-03 arousal proxy

`restoreArousalSignals()` replays `restoreSelectionPolicy.js` heuristics (high-arousal slug patterns, excluded methodology, neural exception, impact/ceiling, difficulty ≥ 6). Full intent/arousal facet taxonomy remains engine backlog (§10.9).

## Verification

```bash
node --test backend/platform/__tests__/prescriptionQualityChecks.test.js
npm run needs-engine:eval
```

## Status

**Complete assessable implementation** (2026-07-09).
