# Category 10 — Difficulty & age fit — Implementation Plan

Full prerequisite → build → assessment matrix (2026-07-09). Scoped to Category 10 only.

## Executive summary

| Bucket | Count | Notes |
|--------|-------|-------|
| **Blocking MOP/MOS/MOR/KPI** | 24 | Age-fit distribution, stretch policy, split caps, warnings, skill/attention gates |
| **Informational MOE** | 3 | Review packet, speed output D bands, warning stability (lagging) |
| **Manual MOE** | 5 | C10-MOE-01–05 via rubric + automated proxies |
| **Synthetic KPI** | 1 | `category10_kpi` — 24 blocking ids + composite fidelity formula |

**Assessment readiness:** All 31 metrics assessable; Category 10 checks **PASS** on golden Test 3 prescription.

## Prerequisite → assessment matrix (31 metrics)

| ID | Metric | Prerequisites | In app? | check_id | Evaluable? |
|----|--------|---------------|---------|----------|------------|
| C10-MOP-01 | Primary age_fit distribution | `items[].age_fit` | yes | `primary_age_fit_distribution` | yes |
| C10-MOP-02 | Stretch primaries high-intent | `NO_STRETCH_PRIMARY_PHASES`, items | yes | `stretch_primaries_*` | yes |
| C10-MOP-03 | Age-fit warning count | `age_fit_warnings[]` | yes | `session_age_fit_warnings` | yes |
| C10-MOP-04 | Warning by dimension | warning message strings | yes | `age_fit_warning_dimensions` | yes |
| C10-MOP-05 | Split 1 variant fit | Split 1 `per_split`, cap 6 | yes | `split1_cap_adherence` | yes |
| C10-MOP-06 | Split 2 variant fit | Split 2 `per_split`, cap 10 | yes | `split2_cap_adherence` | yes |
| C10-MOP-07 | False session-cap warnings | warnings + session/split caps | yes | `age_fit_false_session_cap_warnings` | yes |
| C10-MOP-08 | poolCapOverall max-of-splits | `mergeCapsMax`, split caps | yes | `audience_pool_cap_derivation` | yes |
| C10-MOP-09 | classifyPrimaryAgeFit split-good | difficulty + session/split caps | yes | `primary_age_fit_split_good_path` | yes |
| C10-MOP-10 | NO_STRETCH fill filter | high-intent items `age_fit` | yes | `stretch_primaries_*` | yes |
| C10-MOP-11 | Youngest-split gate | youngest split caps, primaries | yes | `youngest_split_gate` | yes |
| C10-MOP-12 | age_fit vs warnings consistency | items + warnings | yes | `age_fit_warnings_consistency` | yes |
| C10-MOP-13 | over_cap never selected | primaries `age_fit` | yes | `primary_over_cap_count` | yes |
| C10-MOP-14 | Skill level residuals | `exercise.skill_level`, youth session | yes | `skill_level_residuals` | yes |
| C10-MOP-15 | Recommended age overlap | `recommended_age_min/max` | yes | `audience_recommended_age_overlap` | yes |
| C10-MOP-16 | Attention demand MI ceiling | MI items, `attention_demand` | yes | `mi_attention_demand_ceiling` | yes |
| C10-MOP-17 | difficultyProximityBonus cap | poolCap vs session cap replay | yes | `pool_cap_proximity_bonus` | yes |
| C10-MOP-18 | scoreAgeDifficultyFit mean | primaries + pool caps | yes | `primary_age_fit_mean_score` | yes |
| C10-MOP-19 | Stretch allowed phases only | stretch by `phase_key` | yes | `stretch_allowed_phases_only` | yes |
| C10-MOS-01 | Session cap resolved | `resolveAudienceProfile`, ages 8–14 | yes | `audience_cap_overall` | yes |
| C10-MOS-02 | Split overrides applied | `audienceSplits`, result caps | yes | `split_cap_parity` | yes |
| C10-MOR-01 | over_cap primary admitted | primaries `over_cap` | yes | `primary_over_cap_count` | yes |
| C10-MOR-02 | Stretch in NO_STRETCH phase | high-intent stretch items | yes | `stretch_primaries_*` | yes |
| C10-MOE-01 | Right difficulty whole group | coach rubric | yes | `category10_moe_review_packet` | partial |
| C10-MOE-02 | Split 1 not overwhelmed | Split 1 variants + guidance | yes | `category10_moe_review_packet` | partial |
| C10-MOE-03 | Split 2 challenged | Split 2 progressions | yes | `category10_moe_review_packet` | partial |
| C10-MOE-04 | No stop-session safety | coach judgment | yes | `category10_moe_review_packet` | partial |
| C10-MOE-05 | UI age_fit badges accurate | coach checklist | yes | `category10_moe_review_packet` | partial |
| C10-MOE-06 | Difficulty supports speed objective | Output D bands by split | yes | `category10_moe_speed_output_bands` | yes |
| C10-MOE-07 | Warning flakiness (lagging) | eval history JSONL | yes | `age_fit_warning_stability` | partial |
| C10-KPI-01 | Age fit fidelity score | composite formula | yes | `category10_kpi` | yes |

## KPI check ids (24 blocking)

`primary_age_fit_distribution`, `stretch_primaries_prepare_and_access`, `stretch_primaries_movement_intelligence`, `stretch_primaries_output`, `stretch_primaries_capacity`, `stretch_primaries_resilience`, `session_age_fit_warnings`, `age_fit_warning_dimensions`, `split1_cap_adherence`, `split2_cap_adherence`, `age_fit_false_session_cap_warnings`, `audience_pool_cap_derivation`, `primary_age_fit_split_good_path`, `youngest_split_gate`, `age_fit_warnings_consistency`, `primary_over_cap_count`, `skill_level_residuals`, `audience_recommended_age_overlap`, `mi_attention_demand_ceiling`, `pool_cap_proximity_bonus`, `primary_age_fit_mean_score`, `stretch_allowed_phases_only`, `audience_cap_overall`, `split_cap_parity`

## MOE check ids (3 informational)

`category10_moe_review_packet`, `category10_moe_speed_output_bands`, `age_fit_warning_stability`

## Verification

```bash
node --test backend/platform/__tests__/prescriptionQualityChecks.test.js
npm run needs-engine:eval
```

Category 10 on golden Test 3 prescription: **category10_kpi PASS** (24/24 blocking, fidelity 100%).

## Status

**Complete assessable implementation** (2026-07-09).
