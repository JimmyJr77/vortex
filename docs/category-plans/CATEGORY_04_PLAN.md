# Category 4 — Audience profile — Implementation Plan

Full prerequisite → assessment matrix (2026-07-09). Scoped to Category 4 only.

## Executive summary

| Bucket | Count | Notes |
|--------|-------|-------|
| **Blocking MOP/MOR** | 17 | Replay `resolveAudienceProfile` vs `audience_profile`; age-fit; pool-cap; DB audits |
| **Blocking via Cat 1 strict** | 1 | C4-MOP-06 `session_objective_echo` |
| **Informational MOP** | 1 | C4-MOP-11 `audience_skill_level_adherence` |
| **Informational MOE** | 6 | C4-MOE-02, 03, 05, 06, 07 automated; C4-MOE-01/04 review packet |
| **Manual MOE** | 2 | C4-MOE-01, C4-MOE-04 → [`CATEGORY_4_MOE_RUBRIC.md`](../CATEGORY_4_MOE_RUBRIC.md) |
| **Synthetic KPI** | 1 | `category4_kpi` over 18 `CATEGORY4_KPI_CHECK_IDS` |

**Assessment readiness:** All 27 metrics assessable; golden Test 3 strict **PASS**.

## Prerequisite → assessment matrix (27 metrics)

| ID | Metric | Prerequisites | In app? | check_id | Evaluable? |
|----|--------|---------------|---------|----------|------------|
| C4-MOP-01 | Age min/max match | body + `audience_profile.ageMin/Max` | yes | `audience_age_range` | yes |
| C4-MOP-02 | Session cap overall | `caps.maxOverall` vs `AGE_BAND_POLICIES` | yes | `audience_cap_overall` | yes |
| C4-MOP-03 | Session cap technical/load | `maxTechnical`, `maxLoad` vs band | yes | `audience_cap_technical_load` | yes |
| C4-MOP-04 | Implied skill level | body `skillLevel` vs profile | yes | `audience_implied_skill_level` | yes |
| C4-MOP-05 | Scaling cohort | age + skill → cohort matrix | yes | `audience_scaling_cohort` | yes |
| C4-MOP-06 | Session objective echo | body + profile objective | yes | `session_objective_echo` | yes |
| C4-MOP-07 | Age band label | `ageBandLabel` vs age range | yes | `audience_age_band_label` | yes |
| C4-MOP-08 | Strength intent flag | `strengthIntent` vs objective | yes | `audience_strength_intent` | yes |
| C4-MOP-09 | Primary age_fit distribution | `items[].age_fit` | yes | `primary_age_fit_distribution` | yes |
| C4-MOP-10 | Age-fit warning count | `age_fit_warnings[]` | yes | `session_age_fit_warnings` | yes |
| C4-MOP-11 | Skill level filter adherence | exercise `skill_level` vs audience | yes | `audience_skill_level_adherence` | yes (info) |
| C4-MOP-12 | Recommended age overlap | `exercise_difficulty_profile` ages | yes | `audience_recommended_age_overlap` | yes |
| C4-MOP-13 | maxComplexity cap | `caps.maxComplexity` on profile | yes | `audience_max_complexity_cap` | yes |
| C4-MOP-14 | capsOverride propagation | body override → profile caps | yes | `audience_caps_override_propagation` | yes |
| C4-MOP-15 | Pool cap derivation | `mergeCapsMax(session, splits)` | yes | `audience_pool_cap_derivation` | yes |
| C4-MOP-16 | hardDifficultyExclude flag | profile flag vs `resolveHardDifficultyExclude` | yes | `audience_hard_difficulty_exclude` | yes |
| C4-MOP-17 | Objective–strength matrix | objective ↔ `strengthIntent` | yes | `audience_objective_strength_matrix` | yes |
| C4-MOS-01 | Audience inputs valid | age order, skill enum | yes | `audience_inputs_valid` | yes |
| C4-MOE-01 | Session difficulty feels right | coach Likert 8–14 | yes | `category4_moe_review_packet` | partial (manual) |
| C4-MOE-02 | Objective phase emphasis | Output minutes / total | yes | `category4_moe_output_emphasis` | yes (info) |
| C4-MOE-03 | Caps not wasted | mean primary D / session cap | yes | `category4_moe_cap_utilization` | yes (info) |
| C4-MOE-04 | Caps not exceeded in practice | coach safety judgment | yes | `category4_moe_review_packet` | partial (manual) |
| C4-MOE-05 | Scaling notes usable | `per_split[].scaling_guidance` rate | yes | `category4_moe_scaling_guidance` | yes (info) |
| C4-MOE-06 | Profile drives pool filtering | `phase_fill[].split_rejects` sum | yes | `category4_moe_pool_filter` | yes (info) |
| C4-MOE-07 | Youth safety margin (Split 1) | Split 1 cap − max variant D | yes | `category4_moe_split1_headroom` | yes (info) |
| C4-MOR-01 | over_cap primaries admitted | `age_fit === 'over_cap'` count | yes | `primary_over_cap_count` | yes |
| C4-KPI-01 | Audience fidelity index | blocking pass rate | yes | `category4_kpi` | yes |

## KPI check ids (18 blocking)

`audience_age_range`, `audience_cap_overall`, `audience_cap_technical_load`, `audience_max_complexity_cap`, `audience_implied_skill_level`, `audience_scaling_cohort`, `session_objective_echo`, `audience_age_band_label`, `audience_strength_intent`, `audience_objective_strength_matrix`, `primary_age_fit_distribution`, `session_age_fit_warnings`, `audience_recommended_age_overlap`, `audience_caps_override_propagation`, `audience_pool_cap_derivation`, `audience_hard_difficulty_exclude`, `primary_over_cap_count`, `audience_inputs_valid`

## MOE check ids (7 informational)

`category4_moe_output_emphasis`, `category4_moe_scaling_guidance`, `category4_moe_split1_headroom`, `category4_moe_cap_utilization`, `category4_moe_pool_filter`, `category4_moe_review_packet`, `audience_skill_level_adherence`

## Engine instrumentation (2026-07-09)

| Build | File | Change |
|-------|------|--------|
| maxComplexity emission | `ageDifficultyPolicy.js` | `AGE_BAND_POLICIES.maxComplexity`; included in `resolveAudienceProfile().caps` |
| hardDifficultyExclude surface | `phaseAwarePrescription.js` | `audience_profile.hardDifficultyExclude` via `resolveHardDifficultyExclude(body)` |
| Pool filter proxy | `categoryQualityEvaluators.js` | `category4_moe_pool_filter` sums `constraint_report.phase_fill[].split_rejects` |

## Verification

```bash
node --test backend/platform/__tests__/prescriptionQualityChecks.test.js
node --test backend/platform/__tests__/ageDifficultyPolicy.test.js
npm run needs-engine:eval
```

**Pass criteria:** Golden Test 3 strict ALL PASS; all 18 KPI ids emitted; `category4_kpi` ≥ 95% on blocking checks.

## Status

**Complete assessable implementation** (2026-07-09).
