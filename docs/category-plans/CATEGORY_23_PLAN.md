# Category 23 — Sport & work mode — Implementation Plan

Full prerequisite → assessment matrix (2026-07-09). Scoped to Category 23 only.

## Executive summary

| Bucket | Count | Notes |
|--------|-------|-------|
| **Blocking MOP/MOS/MOR** | 15 | work_mode, programming_kind, sport context, objective/strengthIntent |
| **Informational MOP** | 6 | skill-mode guard, multiplier replay, demotion depth, beginner penalty, pool kind |
| **Informational MOE** | 6 | GPP proxy, speed objective, builder intent, A/B sport TBD, facility clarity, scoring stability |
| **Manual MOE** | 1 | C23-MOE-05 via review packet + coach rubric |
| **Synthetic KPI** | 1 | `category23_kpi` over `CATEGORY23_KPI_CHECK_IDS` (15 ids, 95% min) |

**Assessment readiness:** All 29 metrics assessable; golden Test 3 strict **PASS**.

## Prerequisite → assessment matrix (29 metrics)

| ID | Metric | Prerequisites | In app? | check_id | Evaluable? |
|----|--------|---------------|---------|----------|------------|
| C23-MOP-01 | Work mode echo | `workMode`, `result.work_mode` | yes | `work_mode_echo` | yes |
| C23-MOP-02 | Exercise kind filter | `programming_kind`, workMode exercise | yes | `exercise_kind_purity` | yes |
| C23-MOP-03 | No skill_drill leakage | exercise-mode primaries | yes | `exercise_kind_purity` | yes |
| C23-MOP-04 | Sport ID in prescribe body | `sportId`, `coaching.sport` | yes | `sport_id_preflight` | yes |
| C23-MOP-05 | Sport-specific penalty (fitness) | `SPORT_SPECIFIC_PATTERNS`, slugs | yes | `sport_specific_fitness_zero` | yes |
| C23-MOP-06 | Generic fitness boost rate | Output `sport_id == null` | yes | `generic_fitness_output_rate` | yes |
| C23-MOP-07 | Sport tag alignment | `exercise_tag` sport facet / `sport_id` | yes | `sport_id_alignment` | yes |
| C23-MOP-08 | Session objective in profile | `audience_profile.sessionObjective` | yes | `session_objective_echo` | yes |
| C23-MOP-09 | Strength intent flag | `strengthIntent` vs objective | yes | `audience_strength_intent` | yes |
| C23-MOP-10 | Skill mode regression guard | workMode skill SQL filter | yes | `category23_mop_skill_mode_guard` | yes (info) |
| C23-MOP-11 | Sport context on HIIT fallback | Sustained items + sport patterns | yes | `sustained_hiit_sport_context` | yes |
| C23-MOP-12 | Facility sport catalog | `sportId` FK | yes | `sport_id_preflight` | yes |
| C23-MOP-13 | sportContextMultiplier applied | multiplier replay on primaries | yes | `category23_mop_sport_multiplier` | yes (info) |
| C23-MOP-14 | Sport-specific demotion depth | Output rank vs generic | yes | `category23_mop_sport_demotion` | yes (info) |
| C23-MOP-15 | Wrong-sport_id demotion | Output top-5 `sport_id` | yes | `wrong_sport_id_output_top5` | yes |
| C23-MOP-16 | strengthIntent capacity boost off | speed_priority + strengthIntent false | yes | `category23_mop_strength_boost_off` | yes (info) |
| C23-MOP-17 | Skill/games other_kind path | `otherKind`, blocks | yes | `other_phase_fidelity` | yes |
| C23-MOP-18 | beginnerPenalty residual | INTERMEDIATE+ replay | yes | `category23_mop_beginner_penalty` | yes (info) |
| C23-MOP-19 | Candidate pool kind distribution | exercise-mode pool proxy | yes | `category23_mop_pool_kind_distribution` | yes (info) |
| C23-MOP-20 | Top Output picks generic | Output top-5 `sport_id null` | yes | `top_output_picks_generic` | yes |
| C23-MOP-21 | Football/baseball slug zero | slug/name regex | yes | `football_baseball_slug_zero` | yes |
| C23-MOS-01 | workMode valid enum | prescribe body | yes | `work_mode_valid_enum` | yes |
| C23-MOS-02 | sportId optional but valid | `coaching.sport` FK | yes | `sport_id_preflight` | yes |
| C23-MOR-01 | Sport drill in youth fitness MI | MI + fitness + ageMax ≤ 14 | yes | `sport_drill_youth_mi_mor` | yes |
| C23-MOR-02 | skill_drill in exercise mode primary | exercise-mode primaries | yes | `exercise_kind_purity` | yes |
| C23-MOE-01 | Session reads as fitness GPP | full Rx + coach rubric | yes | `category23_moe_fitness_gpp` | yes (info) |
| C23-MOE-02 | Speed objective reflected | Output speed patterns | yes | `category23_moe_speed_objective` | yes (info) |
| C23-MOE-03 | Work mode matches builder intent | exercise_kind_purity proxy | yes | `category23_moe_work_mode_builder` | yes (info) |
| C23-MOE-04 | Sport context future-proof | A/B sportId matrix | yes | `category23_moe_sport_ab` | partial (TBD) |
| C23-MOE-05 | Multi-sport facility clarity | UI + coach Likert | yes | `category23_moe_facility_clarity` | partial (manual) |
| C23-MOE-06 | Speed vs strength distinguishable | objective + strengthIntent | yes | `category23_moe_speed_vs_strength` | yes (info) |
| C23-MOE-07 | Sport scoring stable **(lagging)** | eval history top-3 Output slugs | yes | `category23_moe_scoring_stability` | yes (info) |
| C23-KPI-01 | Sport/work mode fidelity | blocking pass rate | yes | `category23_kpi` | yes |

## KPI check ids (15 blocking)

`work_mode_echo`, `exercise_kind_purity`, `sport_id_preflight`, `sport_specific_fitness_zero`, `generic_fitness_output_rate`, `sport_id_alignment`, `session_objective_echo`, `audience_strength_intent`, `sustained_hiit_sport_context`, `wrong_sport_id_output_top5`, `top_output_picks_generic`, `football_baseball_slug_zero`, `work_mode_valid_enum`, `sport_drill_youth_mi_mor`, `other_phase_fidelity`

## MOE check ids (14 informational)

`category23_mop_skill_mode_guard`, `category23_mop_sport_multiplier`, `category23_mop_sport_demotion`, `category23_mop_strength_boost_off`, `category23_mop_beginner_penalty`, `category23_mop_pool_kind_distribution`, `category23_moe_fitness_gpp`, `category23_moe_speed_objective`, `category23_moe_work_mode_builder`, `category23_moe_sport_ab`, `category23_moe_facility_clarity`, `category23_moe_speed_vs_strength`, `category23_moe_scoring_stability`, `category23_moe_review_packet`

## Verification

```bash
node --test backend/platform/__tests__/prescriptionQualityChecks.test.js
npm run needs-engine:eval
```

## Status

**Complete assessable implementation** (2026-07-09).
