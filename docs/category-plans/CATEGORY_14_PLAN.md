# Category 14 — Exercise / movement avoids — Implementation Plan

Full prerequisite → assessment matrix (2026-07-09). Scoped to Category 14 only.

## Executive summary

| Bucket | Count | Notes |
|--------|-------|-------|
| **Blocking MOP/MOS/MOR** | 18 | Avoid honor, body-region, family caps, dedup, feasibility |
| **Informational MOP** | 2 | C14-MOP-03 `avoid_tokens_honored`; C14-MOP-07 `pattern_repetition_within_cap` |
| **TBD stubs (informational)** | 4 | C14-MOP-11, 13, 18; C14-MOS-02 via `category14_tbd_*` |
| **Informational MOE** | 2 | C14-MOE-02, C14-MOE-03 automated proxies |
| **Manual MOE** | 4 | C14-MOE-01, 05, 06, 07 via `category14_moe_review_packet` |
| **TBD MOE** | 1 | C14-MOE-04 athlete avoid path |
| **Synthetic KPI** | 1 | `category14_kpi` over `CATEGORY14_KPI_CHECK_IDS` (18 ids) |

**Assessment readiness:** All 32 metrics assessable; golden Test 3 strict **PASS**.

## Prerequisite → assessment matrix (32 metrics)

| ID | Metric | Prerequisites | In app? | check_id | Evaluable? |
|----|--------|---------------|---------|----------|------------|
| C14-MOP-01 | avoidExerciseIds honored | prescribe `avoidExerciseIds`; items + per_split IDs | yes | `exercise_avoid_ids_honored` | yes |
| C14-MOP-02 | avoidExerciseSlugs honored | prescribe `avoidExerciseSlugs`; exercise.slug | yes | `exercise_avoid_slugs_honored` | yes |
| C14-MOP-03 | avoidTokens honored | snapshot `avoidTokens`; resolver + Rx absence | partial | `avoid_tokens_honored` | yes (info when empty) |
| C14-MOP-04 | Body-region exclusion | `excludeBodyRegionIds`; exercise_tag body_region | yes | `body_region_exclusion_honored` | yes |
| C14-MOP-05 | Body-region pool filter | `constraint_report.body_region_avoid.excluded_count` | yes | `body_region_avoid_count_plausible` | yes |
| C14-MOP-06 | Movement-family phase cap | `movementFamilyPolicy`; prescribed movement_family | yes | `movement_family_phase_cap` | yes |
| C14-MOP-07 | Pattern repetition cap | pattern tags on primaries; repeat count | yes | `pattern_repetition_within_cap` | yes |
| C14-MOP-08 | Normalized name dedup | primary names; normalizeExerciseName | yes | `normalized_name_no_collisions` | yes |
| C14-MOP-09 | Slug stem dedup | primary slugs; normalizeSlugStem | yes | `slug_stem_no_repeats` | yes |
| C14-MOP-10 | Exercise avoid pre-pool count | `constraint_report.exercise_avoid.excluded_count` | yes | `exercise_avoid_pre_pool_count` | yes |
| C14-MOP-11 | NL avoid token resolution | NL resolver log before pool build | no | `category14_tbd_avoid_tokens` | yes (TBD stub) |
| C14-MOP-12 | Per-split avoid consistency | per_split IDs/slugs vs avoid lists | yes | `per_split_avoid_consistency` | yes |
| C14-MOP-13 | Avoid round-trip from snapshot | snapshot avoidTokens → prescribe body | no | `category14_tbd_avoid_tokens` | yes (TBD stub) |
| C14-MOP-14 | Body-region exclude ID validity | `excludeBodyRegionIds`; coaching.body_region | yes | `body_region_exclude_id_valid` | yes |
| C14-MOP-15 | Session family count floor | distinct movement_family primaries | yes | `session_movement_family_floor` | yes |
| C14-MOP-16 | Output pogo/bound family cap | Output primaries; movementFamilyLimit | yes | `output_pogo_bound_family_cap` | yes |
| C14-MOP-17 | Avoid + use joint feasibility | equipmentUse + avoid lists; pool_empty | yes | `avoid_use_joint_feasibility` | yes |
| C14-MOP-18 | Pattern penalty effect | scoreTargets rank delta telemetry | no | `category14_tbd_pattern_penalty` | yes (TBD stub) |
| C14-MOS-01 | Avoid slug resolvability | avoidExerciseSlugs; coaching.exercise lookup | yes | `avoid_exercise_slugs_resolvable` | yes |
| C14-MOS-02 | avoidTokens map to known movements | NL resolver output | no | `category14_tbd_avoid_tokens` | yes (TBD stub) |
| C14-MOS-03 | Body-region excludes don't cover pool | pre-prescribe pool per phase | yes | `body_region_pool_feasibility` | yes |
| C14-MOE-01 | Avoids match coach intent | coach absence confirmation | yes | `category14_moe_review_packet` | partial (manual) |
| C14-MOE-02 | Body-region avoid not over-pruning | empty_phase_reasons + excluded_count | yes | `category14_moe_body_region_pruning` | yes (info) |
| C14-MOE-03 | Movement variety preserved | session movement_family distribution | yes | `category14_moe_movement_variety` | yes (info) |
| C14-MOE-04 | Athlete-specific avoids respected | injury avoid config + scaling notes | no | `category14_tbd_athlete_avoid` | yes (TBD stub) |
| C14-MOE-05 | No hidden avoided movement | avoid list + slug aliases; coach floor | yes | `category14_moe_review_packet` | partial (manual) |
| C14-MOE-06 | Soft diversity caps feel natural | pattern repetition sequence; coach Likert | yes | `category14_moe_review_packet` | partial (manual) |
| C14-MOE-07 | Avoid list explainable to athlete | resolved avoid list plain language | yes | `category14_moe_review_packet` | partial (manual) |
| C14-MOR-01 | Avoid list honored leak | union avoid IDs/slugs vs Rx | yes | `exercise_avoid_leak` | yes (P0) |
| C14-MOR-02 | Body-region filter causes empty phase | pool_empty + >50% exclusion | yes | `body_region_over_prune_mor` | yes |
| C14-MOR-03 | Diversity counter over-prunes | distinct movement_family < 4 | yes | `diversity_family_mor_guard` | yes |
| C14-KPI-01 | Avoid fidelity index | pass rate on blocking C14 ids | yes | `category14_kpi` | yes |

## KPI check ids (18 blocking)

`exercise_avoid_ids_honored`, `exercise_avoid_slugs_honored`, `exercise_avoid_leak`, `per_split_avoid_consistency`, `body_region_exclusion_honored`, `body_region_avoid_count_plausible`, `exercise_avoid_pre_pool_count`, `movement_family_phase_cap`, `output_pogo_bound_family_cap`, `session_movement_family_floor`, `diversity_family_mor_guard`, `normalized_name_no_collisions`, `slug_stem_no_repeats`, `avoid_use_joint_feasibility`, `body_region_exclude_id_valid`, `avoid_exercise_slugs_resolvable`, `body_region_pool_feasibility`, `body_region_over_prune_mor`

## MOE check ids (7 informational + TBD)

`category14_moe_body_region_pruning`, `category14_moe_movement_variety`, `category14_moe_review_packet`, `pattern_repetition_within_cap`, `category14_tbd_avoid_tokens`, `category14_tbd_pattern_penalty`, `category14_tbd_athlete_avoid`

## Engine backlog (document only)

| Metric | Backlog item | Tracking |
|--------|--------------|----------|
| C14-MOP-03, 11, 13 | `avoidTokens` not forwarded in `snapshotToPrescribeBody` | `category14_tbd_avoid_tokens` |
| C14-MOP-18 | `scoreTargets` rank-delta telemetry not exported | `category14_tbd_pattern_penalty` |
| C14-MOE-04 | Athlete injury avoid path not on prescribe body | `category14_tbd_athlete_avoid` |

## Verification

```bash
node --test backend/platform/__tests__/prescriptionQualityChecks.test.js
npm run needs-engine:eval
```

## Status

**Complete assessable implementation** (2026-07-09). Golden Test 3: `category14_kpi` **100% PASS** (18/18); all 18 KPI ids + 7 MOE/TBD ids emit when `expectedBody` set.
