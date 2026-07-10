# Category 5 — Age splits — Implementation Plan

Full prerequisite → assessment matrix (2026-07-09). Scoped to Category 5 only.

## Executive summary

| Bucket | Count | Notes |
|--------|-------|-------|
| **Blocking MOP/MOS/MOR** | 24 | Parity, caps, adherence, progressions (strict + cat5 evaluator) |
| **Informational MOP** | 3 | C5-MOP-05, C5-MOP-07, C5-MOP-17, C5-MOP-20 (engine-gap or telemetry) |
| **Informational MOE** | 5 | C5-MOE-01–02, 04, 06–07 automated; C5-MOE-05 review packet |
| **Manual MOE** | 1 | C5-MOE-05 → [`CATEGORY_5_MOE_RUBRIC.md`](../CATEGORY_5_MOE_RUBRIC.md) |
| **Partial MOE** | 1 | C5-MOE-03 delegates lane signal to Cat 7 `progression_lane_*` |
| **Synthetic KPI** | 1 | `category5_kpi` over `CATEGORY5_KPI_CHECK_IDS` (24 blocking ids) |

**Assessment readiness:** All 31 metrics assessable; golden Test 3 strict **PASS**.

## Prerequisite → assessment matrix (31 metrics)

| ID | Metric | Prerequisites | In app? | check_id | Evaluable? |
|----|--------|---------------|---------|----------|------------|
| C5-MOP-01 | Split count | body + result `audience_splits` lengths | yes | `audience_split_count_parity` | yes |
| C5-MOP-02 | Split label match | split `label` on body and result | yes | `split_label_parity` | yes |
| C5-MOP-03 | Split age band match | per-split `ageMin`, `ageMax` body vs result | yes | `split_age_band_parity` | yes |
| C5-MOP-04 | Split difficulty override | `difficultyOverride` → `caps.maxOverall` | yes | `split_cap_parity` | yes |
| C5-MOP-05 | Per-item variant completeness | `len(per_split) === split_count` | yes | `per_split_completeness` | yes (info) |
| C5-MOP-06 | No missing variants | count `variant_type === 'missing'` | yes | `split_missing_variant_count` | yes |
| C5-MOP-07 | Variant type distribution | counts by `blocks[].phase_key` | yes | `split_variant_distribution_{phase}` | yes (info) |
| C5-MOP-08 | Split 2 progressions (Output) | Split 2 progressions in Output | yes | `split2_progressions_output` | yes |
| C5-MOP-09 | Split 2 progressions (Capacity) | Split 2 progressions in Capacity | yes | `split2_progressions_capacity` | yes |
| C5-MOP-10 | Split 2 progressions (Resilience) | Split 2 progressions in Resilience | yes | `split2_progressions_resilience` | yes |
| C5-MOP-11 | Progression reuse per phase | same progression `exercise_id` ≤ 1 per phase | yes | `progression_reuse_{phase}` | yes |
| C5-MOP-12 | Progression difficulty delta | progression D > primary D per phase | yes | `progression_difficulty_{phase}` | yes |
| C5-MOP-13 | Split variant warning count | `len(split_variant_warnings)` | yes | `split_variant_warnings` | yes |
| C5-MOP-14 | Split 1 cap adherence | Split 1 variants within cap + stretch | yes | `split1_cap_adherence` | yes |
| C5-MOP-15 | Split 2 cap adherence | Split 2 variants D ≤ split cap | yes | `split2_cap_adherence` | yes |
| C5-MOP-16 | Split age band coverage | union of splits covers session ages | yes | `split_age_coverage` | yes |
| C5-MOP-17 | Split ordering | younger split ends before older (non-overlap) | yes | `split_younger_first_order` | yes (info on overlap) |
| C5-MOP-18 | Split cap dimensions | numeric override sets equal overall/technical/load | yes | `split_cap_dimensions_parity` | yes |
| C5-MOP-19 | per_split label match | each `per_split[].split_label` ∈ split labels | yes | `per_split_label_valid` | yes |
| C5-MOP-20 | Split 1 zero progressions | progressions on Split 1 label | yes | `split1_no_progressions` | yes (info) |
| C5-MOP-21 | scaling_guidance by variant | same/scaled with non-empty `scaling_guidance` | yes | `split_scaling_guidance_rate` | yes |
| C5-MOP-22 | per_split difficulty_cap echo | `difficulty_cap === split.caps.maxOverall` | yes | `per_split_difficulty_cap_echo` | yes |
| C5-MOS-01 | Split definitions valid | valid ages, numeric override, unique labels | yes | `audience_splits_mos_valid` | yes |
| C5-MOE-01 | Splits meaningfully different | ≥ 30% items differ Split1 vs Split2 | yes | `split_differentiation_moe` | yes (info) |
| C5-MOE-02 | Split 2 exploits higher cap | mean D Split2 > Split1 in Output/Capacity | yes | `split2_cap_exploitation_moe` | yes (info) |
| C5-MOE-03 | Progressions coach-credible | ≥ 80% same movement lane | partial | `progression_lane_*` (Cat 7) | partial |
| C5-MOE-04 | Scaling notes split-specific | guidance differs when same variant | yes | `split_scaling_guidance_diff_moe` | yes (info) |
| C5-MOE-05 | One session, two groups workable | coach runs both groups without rewrite | yes | `category5_moe_review_packet` | partial (manual) |
| C5-MOE-06 | Substituted rate bounded (Split 1) | Split 1 substituted ≤ 25% | yes | `split1_substituted_rate_moe` | yes (info) |
| C5-MOE-07 | Same/scaled dominates younger split | Split 1 same+scaled ≥ 60% | yes | `split1_same_scaled_share_moe` | yes (info) |
| C5-MOR-01 | Missing variant on high-intent item | `missing` in Output/Capacity/Resilience | yes | `split_missing_high_intent` | yes |
| C5-KPI-01 | Split fidelity index | pass rate on blocking C5 ids | yes | `category5_kpi` | yes |

## KPI check ids (24 blocking)

`audience_splits_mos_valid`, `audience_split_count_parity`, `split_label_parity`, `split_age_band_parity`, `split_cap_parity`, `split_cap_dimensions_parity`, `per_split_label_valid`, `per_split_difficulty_cap_echo`, `split1_cap_adherence`, `split2_cap_adherence`, `split_missing_variant_count`, `split_missing_high_intent`, `split_scaling_guidance_rate`, `split_age_coverage`, `split_variant_warnings`, `split2_progressions_output`, `split2_progressions_capacity`, `split2_progressions_resilience`, `progression_reuse_output`, `progression_reuse_capacity`, `progression_reuse_resilience`, `progression_difficulty_output`, `progression_difficulty_capacity`, `progression_difficulty_resilience`

## MOE check ids (6 informational)

`split_differentiation_moe`, `split2_cap_exploitation_moe`, `split_scaling_guidance_diff_moe`, `split1_substituted_rate_moe`, `split1_same_scaled_share_moe`, `category5_moe_review_packet`

## Engine backlog (document only)

| Metric | Backlog item | Tracking |
|--------|--------------|----------|
| C5-MOP-05 | `resolvePerSplitVariants` may not fill all `per_split` slots on some sessions | `per_split_completeness` informational |
| C5-MOP-20 | Split 1 progression policy not enforced on all golden paths | `split1_no_progressions` informational |

## Verification

```bash
node --test backend/platform/__tests__/prescriptionQualityChecks.test.js
npm run needs-engine:eval
```

## Status

**Complete assessable implementation** (2026-07-09). Golden Test 3 strict PASS; all 24 KPI ids + 6 MOE ids emit when splits active.
