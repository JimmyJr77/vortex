# Category 17 — Youth & safety gates — Implementation Plan

Full prerequisite → assessment matrix (2026-07-09). Scoped to Category 17 only.

## Executive summary

| Bucket | Count | Notes |
|--------|-------|-------|
| **Blocking MOP/MOS/MOR** | 21 | Handstand gates, age filters, impact/attention/load ceilings, split1 cap, medical clearance |
| **Informational MOP** | 4 | Sport-context multiplier, beginner penalty, neural MI, plyo density |
| **Informational MOE** | 3 | Contraindication rate, scaling guidance rate, review packet |
| **Manual MOE** | 5 | C17-MOE-01, 02, 04, 05, 06, 07, 08 via rubric + automated proxies |
| **Synthetic KPI** | 1 | `category17_kpi` over `CATEGORY17_KPI_CHECK_IDS` (23 ids, 100% min) |

**Assessment readiness:** All 31 metrics assessable; golden Test 3 strict **PASS**.

## Prerequisite → assessment matrix (31 metrics)

| ID | Metric | Prerequisites | In app? | check_id | Evaluable? |
|----|--------|---------------|---------|----------|------------|
| C17-MOP-01 | MI handstand/inversion block (eval) | MI primaries, slug patterns, ageMax | yes | `mi_no_handstand_youth` | yes |
| C17-MOP-02 | MI handstand pool filter (engine) | prescribe ageMax, MI items | yes | `youth_mi_pool_filter` | yes |
| C17-MOP-03 | Recommended age min filter | difficulty profiles, session ageMax | yes | `youth_recommended_age_min` | yes |
| C17-MOP-04 | Recommended age max filter | difficulty profiles, session ageMin | yes | `youth_recommended_age_max` | yes |
| C17-MOP-05 | Attention demand MI ceiling | MI primaries, attention_demand, ageMax ≤ 14 | yes | `mi_attention_demand_ceiling` | yes |
| C17-MOP-06 | Beginner excluded slugs | skillLevel, BEGINNER_EXCLUDED_SLUG_PATTERNS | yes | `youth_beginner_excluded_slugs` | yes |
| C17-MOP-07 | Youth scaling cohort | audience_profile.scalingCohort, 8–14 band | yes | `youth_scaling_cohort` | yes |
| C17-MOP-08 | High technical complexity cap | MI primaries, technical ≥ 8 share | yes | `youth_mi_technical_share` | yes |
| C17-MOP-09 | Neural methodology in MI youth | MI items, methodology neural tag | yes | `youth_mi_neural_methodology` | yes |
| C17-MOP-10 | Inversion in non-MI phases | all phases, Resilience wall-hold allowlist | yes | `youth_inversion_non_mi` | yes |
| C17-MOP-11 | Impact level youth ceiling | Prepare/MI phase profiles, impact ≥ 3 | yes | `youth_prepare_mi_impact_ceiling` | yes |
| C17-MOP-12 | Sport-context youth multiplier | sportContextMultiplier, sportKey fitness | yes | `youth_sport_context_multiplier` | yes (info) |
| C17-MOP-13 | Medical clearance gate | exercise_safety_profile, youth 8–14 | yes | `youth_medical_clearance` | yes |
| C17-MOP-14 | Contraindication surfacing | safety profile, technical ≥ 6 | yes | `youth_contraindication_rate` | yes (info) |
| C17-MOP-15 | MI load dimension ceiling | MI primaries, load ≥ 6, ageMax ≤ 14 | yes | `youth_mi_load_ceiling` | yes |
| C17-MOP-16 | Gymnastics exception scope | sportKey, handstand block bypass | yes | `youth_gymnastics_handstand_scope` | yes |
| C17-MOP-17 | Split 1 max variant D | per_split overall, split1 cap | yes | `split1_cap_adherence` | yes |
| C17-MOP-18 | ADVANCED skill_level in youth Rx | exercise.skill_level, ageMax ≤ 14 | yes | `youth_advanced_skill_level` | yes |
| C17-MOP-19 | Beginner penalty path inactive | beginnerAppropriatenessPenalty, skillLevel | yes | `youth_beginner_penalty_inactive` | yes (info) |
| C17-MOP-20 | Resilience wall-handstand exception | controlResilienceValidation slug allowlist | yes | `youth_resilience_wall_handstand` | yes |
| C17-MOP-21 | High-intent minutes × youth factor | block minutes, ageMax ≤ 12 | yes | `youth_high_intent_minutes` | yes |
| C17-MOP-22 | Plyo density in Output (younger split) | Split 1 Output, plyo/jump tags | yes | `youth_split1_output_plyo_density` | yes |
| C17-MOS-01 | Age inputs valid pre-gate | ageMin, ageMax ordering | yes | `youth_age_inputs_valid` | yes |
| C17-MOS-02 | Scaling cohort resolvable | age + skillLevel → scalingCohort | yes | `youth_scaling_cohort_resolvable` | yes |
| C17-MOE-01 | Parent/coach safety confidence | full youth prescription | yes | `category17_moe_review_packet` | partial (manual) |
| C17-MOE-02 | No adult-only skills surfaced | prescribed items + coach audit | yes | `category17_moe_review_packet` | partial (manual) |
| C17-MOE-03 | Scaling notes sufficient for youth | per_split scaling_guidance | yes | `youth_scaling_guidance_rate` | yes (info) |
| C17-MOE-04 | Fatigue appropriate for youth 120-min | block minutes + coach Likert | yes | `category17_moe_review_packet` | partial (manual) |
| C17-MOE-05 | Inversions policy clarity | C17-MOP-20 + policy doc | yes | `category17_moe_review_packet` | partial (manual) |
| C17-MOE-06 | Contraindications coach-visible | safety profile + UI path | yes | `youth_contraindication_rate` | yes (info) |
| C17-MOE-07 | Split 1 coachable without regressions | scaling notes + C17-MOP-17 | yes | `category17_moe_review_packet` | partial (manual) |
| C17-MOE-08 | Attention demand matches supervision | MI complexity + coach Likert | yes | `category17_moe_review_packet` | partial (manual) |
| C17-MOR-01 | Handstand/inversion in MI (youth) | MI primaries, ageMax < 15 | yes | `mi_no_handstand_youth` | yes |
| C17-MOR-02 | Split 1 over-cap variant | per_split overall > split1 cap | yes | `split1_cap_adherence` | yes |
| C17-MOR-03 | Attention demand spike in MI | attention_demand ≥ 9 | yes | `mi_attention_demand_spike` | yes |
| C17-MOR-04 | Unsupervised high-risk skill | spotting/inversion + scaling_guidance | yes | `youth_unsupervised_high_risk` | yes |
| C17-KPI-01 | Youth safety gate index | blocking pass rate | yes | `category17_kpi` | yes |

## KPI check ids (21 blocking)

`mi_no_handstand_youth`, `youth_mi_pool_filter`, `youth_recommended_age_min`, `youth_recommended_age_max`, `mi_attention_demand_ceiling`, `youth_beginner_excluded_slugs`, `youth_scaling_cohort`, `youth_mi_technical_share`, `youth_inversion_non_mi`, `youth_prepare_mi_impact_ceiling`, `youth_medical_clearance`, `youth_mi_load_ceiling`, `youth_gymnastics_handstand_scope`, `split1_cap_adherence`, `youth_advanced_skill_level`, `youth_resilience_wall_handstand`, `youth_high_intent_minutes`, `youth_age_inputs_valid`, `youth_scaling_cohort_resolvable`, `mi_attention_demand_spike`, `youth_unsupervised_high_risk`

## MOE check ids (7 informational)

`youth_sport_context_multiplier`, `youth_beginner_penalty_inactive`, `youth_contraindication_rate`, `youth_scaling_guidance_rate`, `youth_mi_neural_methodology`, `youth_split1_output_plyo_density`, `category17_moe_review_packet`

## Data & engine builds

| Build | File | Unblocks |
|-------|------|----------|
| Youth MI slug filter | `phaseAwarePrescription.js` | C17-MOP-01–02 |
| Beginner exclusion policy | `beginnerExclusionPolicy.js` | C17-MOP-06, C17-MOP-16, C17-MOP-19 |
| Safety profile loader | `exerciseProgramming.js` `loadSafetyProfiles` | C17-MOP-13–14, C17-MOR-04 |
| Sport context multiplier | `sportContextPolicy.js` | C17-MOP-12 |
| Resilience wall-handstand allowlist | `controlResilienceValidation.js` | C17-MOP-10, C17-MOP-20 |
| Eval context wiring | `evaluate-prescription-quality.mjs` | safety profiles, sportIdByKey |

## Verification

```bash
node --test backend/platform/__tests__/prescriptionQualityChecks.test.js
npm run needs-engine:eval
```

Golden Test 3 strict PASS.

## Status

**Complete assessable implementation** (2026-07-09).
