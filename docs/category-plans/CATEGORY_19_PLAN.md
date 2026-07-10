# Category 19 — Session diversity — Implementation Plan

Full prerequisite → assessment matrix (2026-07-09). Scoped to Category 19 only.

## Executive summary

| Bucket | Count | Notes |
|--------|-------|-------|
| **Blocking MOP/MOS/MOR/KPI** | 9 | Slug/ID/family dedup, caps, adjacent repetition, over-dedup MOR |
| **Informational MOP** | 4 | C19-MOP-08 pattern repeat, C19-MOP-14 pogo band, C19-MOP-15 family rules, C19-MOP-21 skip ratio |
| **TBD stubs (informational)** | 2 | C19-MOP-16, C19-MOP-17 engine telemetry |
| **Informational MOE** | 5 | Pattern purpose, equipment variety, names, youth load, speed coherence |
| **Manual MOE** | 3 | C19-MOE-01, 02, 05 via `category19_moe_review_packet` |
| **Synthetic KPI** | 1 | `category19_kpi` over `CATEGORY19_KPI_CHECK_IDS` (9 blocking ids) |

**Assessment readiness:** All 33 metrics assessable; golden Test 3 strict **PASS**.

## Prerequisite → assessment matrix (33 metrics)

| ID | Metric | Prerequisites | In app? | check_id | Evaluable? |
|----|--------|---------------|---------|----------|------------|
| C19-MOP-01 | Duplicate primary slugs | primaries; `exercise.slug` | yes | `no_duplicate_session_slugs` | yes |
| C19-MOP-02 | Duplicate exercise IDs | session-wide `exercise_id` | yes | `no_duplicate_session_exercise_ids` | yes |
| C19-MOP-03 | Slug stem dedup | `normalizeSlugStem` on primaries | yes | `slug_stem_no_repeats` | yes |
| C19-MOP-04 | Normalized name dedup | `normalizeExerciseName` on primaries | yes | `normalized_name_no_collisions` | yes |
| C19-MOP-05 | Movement family session dedup | DB `movement_family` once session-wide | yes | `session_movement_family_once` | yes |
| C19-MOP-06 | Output family limit | `movementFamilyLimit('output')` | yes | `output_family_phase_cap` | yes |
| C19-MOP-07 | Prepare/Restore family limit | max 1 per inferred key | yes | `prepare_restore_family_cap` | yes |
| C19-MOP-08 | Pattern dedup per phase | primary pattern tag per item | yes | `phase_pattern_no_repeat` | yes (info) |
| C19-MOP-09 | Session pattern variety | distinct pattern facet_ids ≥ 8 on 120-min | yes | `session_pattern_variety` | yes |
| C19-MOP-10 | Distinct movement families | unique families ≥ 6 on 120-min | yes | `distinct_movement_families` | yes |
| C19-MOP-11 | Progression slug stem policy | progression vs primary slug/stem | yes | `progression_slug_stem_policy` | yes (info) |
| C19-MOP-12 | Used exercise ID set size | unique ids === primary count | yes | `used_exercise_ids_size` | yes |
| C19-MOP-13 | Adjacent-phase family repetition | consecutive block family share ≤ 1 pair | yes | `adjacent_phase_family_repetition` | yes |
| C19-MOP-14 | Output pogo utilization band | pogo count 1–2 on speed session | partial | `output_pogo_utilization_band` | yes (info) |
| C19-MOP-15 | Inferred family rule coverage | `FAMILY_RULES` matcher coverage | yes | `inferred_family_rule_coverage` | yes (info) |
| C19-MOP-16 | Pattern penalty applied | `usedPatterns` adjScore telemetry | no | `category19_tbd_pattern_penalty` | yes (TBD stub) |
| C19-MOP-17 | Relaxed pattern dedup flag | `allowRelaxedPatternDedup` pick count | no | `category19_tbd_relaxed_pattern_dedup` | yes (TBD stub) |
| C19-MOP-18 | Progression slug ≠ primary slug | per_split progression slugs | yes | `progression_slug_disjoint_primary` | yes (info) |
| C19-MOP-19 | Tenet tag diversity | distinct tenet facets ≥ 4 on 120-min | yes | `tenet_tag_diversity` | yes |
| C19-MOP-20 | Methodology tag diversity | distinct methodology keys ≥ 5 on 120-min | yes | `methodology_tag_diversity` | yes |
| C19-MOP-21 | Diversity-driven skip ratio | `skipped_candidates/pool_size` session aggregate | yes | `diversity_driven_skip_ratio` | yes (info) |
| C19-MOP-22 | Distinct exercise names | unique names ≥ 12 on 120-min Test 3 | yes | `distinct_exercise_names` | yes |
| C19-MOS-01 | movement_family populated | prescribed primaries with non-null field ≥ 80% | yes | `movement_family_mos_populated` | yes |
| C19-MOE-01 | Session feels varied | coach fatigue Likert | yes | `category19_moe_review_packet` | partial (manual) |
| C19-MOE-02 | Pattern repetition acceptable | coach purposeful-vs-spam | yes | `category19_moe_pattern_purpose` | yes (info) |
| C19-MOE-03 | Equipment variety | equipment tags across ≥ 3 phases | yes | `category19_moe_equipment_variety` | yes (info) |
| C19-MOE-04 | Athlete engagement | distinct names ≥ 12 | yes | `category19_moe_athlete_distinct_names` | yes (info) |
| C19-MOE-05 | Diversity vs focus tradeoff | coach Output coherence | yes | `category19_moe_review_packet` | partial (manual) |
| C19-MOE-06 | Cognitive load (youth) | pattern count + coach Likert | yes | `category19_moe_youth_cognitive_load` | yes (info) |
| C19-MOE-07 | Speed Output pattern coherence | jump/sprint/bound ≥ 50% Output | yes | `category19_moe_output_speed_coherence` | yes (info) |
| C19-MOR-01 | Over-dedup causing underfill | fill_pct < 70% AND skip > 0.85 | yes | `diversity_over_dedup_underfill` | yes |
| C19-MOR-02 | Monotony risk | patterns < 6 on 120-min | yes | `session_pattern_monotony` | yes |
| C19-KPI-01 | Diversity health index | pass rate on blocking C19 ids | yes | `category19_kpi` | yes |

## KPI check ids (9 blocking)

`no_duplicate_session_slugs`, `no_duplicate_session_exercise_ids`, `slug_stem_no_repeats`, `normalized_name_no_collisions`, `session_movement_family_once`, `output_family_phase_cap`, `prepare_restore_family_cap`, `adjacent_phase_family_repetition`, `diversity_over_dedup_underfill`

## MOE check ids (8 informational + TBD)

`category19_moe_review_packet`, `category19_moe_pattern_purpose`, `category19_moe_equipment_variety`, `category19_moe_athlete_distinct_names`, `category19_moe_youth_cognitive_load`, `category19_moe_output_speed_coherence`, `category19_tbd_pattern_penalty`, `category19_tbd_relaxed_pattern_dedup`

## Engine backlog (document only)

| Metric | Backlog item | Tracking |
|--------|--------------|----------|
| C19-MOP-16 | `usedPatterns` adjScore penalty not exported | `category19_tbd_pattern_penalty` |
| C19-MOP-17 | `allowRelaxedPatternDedup` pick flag not in constraint_report | `category19_tbd_relaxed_pattern_dedup` |
| C19-MOP-08 | Backfill may relax within-phase pattern dedup | `phase_pattern_no_repeat` informational |

## Verification

```bash
node --test backend/platform/__tests__/prescriptionQualityChecks.test.js
npm run needs-engine:eval
```

## Status

**Complete assessable implementation** (2026-07-09). Golden Test 3 strict PASS; all 9 KPI ids + 8 MOE/TBD ids emit when `expectedBody` set.
