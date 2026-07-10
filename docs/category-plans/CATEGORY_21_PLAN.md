# Category 21 — Warnings cleanliness — Implementation Plan

Full prerequisite → build → assessment matrix (2026-07-09). Scoped to Category 21 only.

## Executive summary

| Bucket | Count | Notes |
|--------|-------|-------|
| **Blocking MOP/MOS/MOR/KPI** | 17 | Age-fit + split warnings, taxonomy, orphans, MOS thresholds, MOR guards |
| **Informational MOE/MOS** | 7 | Stability streak, UI truncation, 422 contract, scaling coverage, review packet |
| **Manual MOE** | 4 | C21-MOE-01–03, C21-MOE-07 via `category21_moe_review_packet` + rubric |
| **Synthetic KPI** | 1 | `category21_kpi` — 17 blocking ids + composite fidelity formula |

**Assessment readiness:** All 29 metrics assessable; golden Test 3 strict **PASS**.

## KPI check ids (17 blocking)

`session_age_fit_warnings`, `split_variant_warnings`, `age_fit_warning_dimensions`, `warnings_split_scaling_required`, `warnings_split_missing_variant`, `age_fit_warnings_consistency`, `age_fit_false_session_cap_warnings`, `warnings_no_duplicate_strings`, `warnings_taxonomy_complete`, `warnings_session_caps_replay`, `warnings_to_primary_ratio`, `warnings_admitted_resolve_clean`, `warnings_missing_variant_orphans`, `warnings_scaled_guidance_complete`, `warnings_strict_thresholds_mos`, `warnings_missing_high_intent_mor`, `warnings_fatigue_classes`

## MOE check ids (7 informational)

`category21_moe_review_packet`, `category21_moe_warning_stability`, `category21_moe_warning_clean_streak`, `category21_moe_scaling_guidance_coverage`, `category21_moe_ui_truncation_policy`, `category21_moe_watch_points_parity`, `category21_mos_422_no_partial_warnings`

## 29-metric prerequisite status

| ID | Metric | Prerequisites | In app? | check_id | Evaluable? |
|----|--------|---------------|---------|----------|------------|
| C21-MOP-01 | Age-fit warning count | `age_fit_warnings[]`; strict threshold 0 | yes | `session_age_fit_warnings` | yes |
| C21-MOP-02 | Split variant warning count | `split_variant_warnings[]`; threshold ≤1 | yes | `split_variant_warnings` | yes |
| C21-MOP-03 | Overall difficulty warnings | parse `age_fit_warnings` overall cap | yes | `age_fit_warning_dimensions` | yes |
| C21-MOP-04 | Load dimension warnings | parse `age_fit_warnings` load cap | yes | `age_fit_warning_dimensions` | yes |
| C21-MOP-05 | Technical dimension warnings | parse `age_fit_warnings` technical cap | yes | `age_fit_warning_dimensions` | yes |
| C21-MOP-06 | Scaling-required warnings | `coach scaling required` in split warnings | yes | `warnings_split_scaling_required` | yes |
| C21-MOP-07 | Missing variant warnings | `no suitable variant found` in split warnings | yes | `warnings_split_missing_variant` | yes |
| C21-MOP-08 | Warnings only on non-good primaries | join items + warnings on exercise name | yes | `age_fit_warnings_consistency` | yes |
| C21-MOP-09 | False session-cap warnings | split-good replay vs session cap 6 | yes | `age_fit_false_session_cap_warnings` | yes |
| C21-MOP-10 | Duplicate warning strings | unique ratio on combined arrays | yes | `warnings_no_duplicate_strings` | yes |
| C21-MOP-11 | Warning severity taxonomy | classify all warning strings | yes | `warnings_taxonomy_complete` | yes |
| C21-MOP-12 | Session caps only post-build | `ageFitWarnings(difficulty, sessionCaps)` replay | yes | `warnings_session_caps_replay` | yes |
| C21-MOP-13 | Warning-to-primary ratio | `len(age_fit_warnings)/primaries` | yes | `warnings_to_primary_ratio` | yes |
| C21-MOP-14 | Split-good items warned | same as C21-MOP-09 | yes | `age_fit_false_session_cap_warnings` | yes |
| C21-MOP-15 | splitCandidateAcceptable blocks warnings | `split_resolve_warnings` on admitted items | yes | `warnings_admitted_resolve_clean` | yes |
| C21-MOP-16 | Missing variant rows without warning | `per_split` missing + split warnings | yes | `warnings_missing_variant_orphans` | yes |
| C21-MOP-17 | Scaled variant without guidance | `per_split` scaled + `scaling_guidance` | yes | `warnings_scaled_guidance_complete` | yes |
| C21-MOP-18 | UI warning truncation | NeedsEnginePanel slice limits | yes | `category21_moe_ui_truncation_policy` | yes (info) |
| C21-MOP-19 | Watch_points parity | UI `watch_points` vs Rx slice(0,5) | yes | `category21_moe_watch_points_parity` | yes (info) |
| C21-MOS-01 | Strict warning thresholds | `maxAgeFitWarnings:0`, `maxSplitVariantWarnings:1` | yes | `warnings_strict_thresholds_mos` | yes |
| C21-MOS-02 | Warning arrays on success only | 422 responses omit partial warnings | partial | `category21_mos_422_no_partial_warnings` | yes (info) |
| C21-MOR-01 | Warning masks safety stop | missing variant on high-intent primaries | yes | `warnings_missing_high_intent_mor` | yes (P0) |
| C21-MOR-02 | Warning fatigue | distinct taxonomy classes ≤2 | yes | `warnings_fatigue_classes` | yes |
| C21-MOE-01 | Coach ignores warnings safely | counts = 0 binary pass | yes | `category21_moe_review_packet` | partial (manual) |
| C21-MOE-02 | Warnings actionable | coach scaling/swap review | yes | `category21_moe_review_packet` | partial (manual) |
| C21-MOE-03 | UI warning noise acceptable | coach Likert on warning panel | yes | `category21_moe_review_packet` | partial (manual) |
| C21-MOE-04 | No warning flakiness (lagging) | eval history pair stability 5/5 | yes | `category21_moe_warning_stability` | yes (info) |
| C21-MOE-05 | Athlete-facing clarity | scaling_guidance on warned scaled rows | yes | `category21_moe_scaling_guidance_coverage` | yes (info) |
| C21-MOE-06 | Warning-free strict streak | 0 age + ≤1 split in 5/5 strict passes | yes | `category21_moe_warning_clean_streak` | yes (info) |
| C21-MOE-07 | False-positive trust | coach vs parser when warnings present | yes | `category21_moe_review_packet` | partial (manual) |
| C21-KPI-01 | Warning cleanliness index | blocking pass rate + composite | yes | `category21_kpi` | yes |

## Verification

```bash
node --test backend/platform/__tests__/prescriptionQualityChecks.test.js
npm run needs-engine:eval
```

Golden Test 3: strict **PASS**.

## Status

**Complete assessable implementation** (2026-07-09).
