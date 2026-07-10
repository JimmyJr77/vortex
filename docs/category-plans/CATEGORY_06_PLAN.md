# Category 6 — Split progressions — Implementation Plan

Full prerequisite → build → assessment matrix per Category 6 re-audit (2026-07-08, fleshed out for full MOP/MOE/MOR assessment). Scoped to Category 6 only.

## Executive summary

| Bucket | Count | Notes |
|--------|-------|-------|
| **Blocking MOP/MOS/MOR** | 23 | 19 prior + `progression_good_fit_only`, `progression_pick_warnings_clean`, `progression_phase_ids_parity`, `progression_scaled_warning_conflict` |
| **Informational MOE/MOP** | 9 | Coverage, eligibility, unassigned rates, arc, pool rejects, yield factor |
| **Manual MOE** | 2 | C6-MOE-01, 05 → [`CATEGORY_6_MOE_RUBRIC.md`](../CATEGORY_6_MOE_RUBRIC.md) |
| **TBD** | 1 | C6-MOE-06 builder edit telemetry |
| **Synthetic KPI** | 1 | `category6_kpi` — blocking pass-rate on 23 ids **and** weighted yield ≥ 85% when telemetry present |
| **Delegated to Cat 7–9** | 6 | Lane, reuse, ΔD via strict checks in KPI |

**Assessment readiness:** Every metric row has prerequisite status → build action → `check_id` → blocking vs informational. Engine exports progression telemetry on `constraint_report.phase_fill`; evaluator replays from output when telemetry absent.

## Prerequisite layer status

| Layer | Status | Cat 6 dependency |
|-------|--------|------------------|
| Session requirements (`audienceSplits[]` ≥ 2) | Available | C6-MOS-02 |
| Prescription output (`per_split`, `split_fallback_used`, `split_resolve_warnings`) | **Built** | C6-MOP-12, 14, 16 |
| Engine progression telemetry | **Built** | C6-MOP-06/07/17 on `phase_fill` |
| Strict evaluator | Available | C6-MOP-03–05, low-intent `no_progression_*` |
| Eval context | Available | C6-MOP-15, 18–19 |
| Body-driven split labels | **Built** | C6-MOP-02, 08, 09 |

## Full metric matrix (30 metrics)

| Metric | check_id | Blocking? | Status |
|--------|----------|-----------|--------|
| C6-MOP-01 | `progression_phase_allowlist` | yes | Built |
| C6-MOP-02 | `split2_total_progressions` | yes | Built |
| C6-MOP-03 | `split2_progressions_output` | yes | Strict |
| C6-MOP-04 | `split2_progressions_capacity` | yes | Strict |
| C6-MOP-05 | `split2_progressions_resilience` | yes | Strict |
| C6-MOP-06 | `progression_eligibility_rate` | info | Built (engine + output replay) |
| C6-MOP-07 | `progression_coverage_output`, `progression_coverage_capacity` | info* | Built — *informational until golden ≥60% |
| C6-MOP-08 | `split1_no_progressions` | yes | Cat5/cat6 |
| C6-MOP-09 | `split2_progressions_label_only` | yes | Built (cap-driven) |
| C6-MOP-10 | `progression_headroom_valid` | yes | Built |
| C6-MOP-11 | `progression_good_fit_only` | yes | Built (output + eligibility replay) |
| C6-MOP-12 | `progression_pick_warnings_clean` | yes | Built (`split_resolve_warnings` on items) |
| C6-MOP-13 | `progression_relax_split_off` | yes | Built |
| C6-MOP-14 | `split_fallback_used_rate` | yes | Built |
| C6-MOP-15 | `progression_slug_unique` | yes | Built |
| C6-MOP-16 | `progression_primary_id_distinct` | yes | Built |
| C6-MOP-17 | `progression_phase_ids_parity` | yes | Built (`phase_progression_ids` on phase_fill) |
| C6-MOP-18 | `progression_scaling_guidance_rate` | yes | Built + engine fallback |
| C6-MOP-19 | `progression_phase_profile_role` | conditional | Built when profiles loaded |
| C6-MOS-01 | `split_cap_differential` | yes | Built |
| C6-MOS-02 | `audience_splits_active` | yes | Built |
| C6-MOR-01 | `progression_scaled_warning_conflict` | yes | Built |
| C6-MOR-02 | `progression_eligible_unassigned_output`, `progression_eligible_unassigned_capacity` | info* | Built — *informational until golden ≤20% |
| C6-MOE-01 | — | MOE | [`CATEGORY_6_MOE_RUBRIC.md`](../CATEGORY_6_MOE_RUBRIC.md) |
| C6-MOE-02 | `category6_moe_progression_arc` | info | Built |
| C6-MOE-03 | `category6_moe_split2_policy` | info | Built |
| C6-MOE-04 | `category6_moe_pool_reject_signal` | info | Built |
| C6-MOE-05 | — | MOE | Rubric |
| C6-MOE-06 | `category6_tbd_builder_edits` | TBD | Stub |
| C6-KPI-01 | `category6_kpi` | yes | Weighted yield + blocking ids |

### KPI check ids (`CATEGORY6_KPI_CHECK_IDS` — 23 blocking)

`progression_phase_allowlist`, `no_progression_prepare_and_access`, `no_progression_movement_intelligence`, `no_progression_sustained_capacity`, `no_progression_restore`, `split2_progressions_output`, `split2_progressions_capacity`, `split2_progressions_resilience`, `split2_total_progressions`, `split1_no_progressions`, `split2_progressions_label_only`, `progression_headroom_valid`, `progression_primary_id_distinct`, `progression_slug_unique`, `split_fallback_used_rate`, `split_cap_differential`, `audience_splits_active`, `progression_relax_split_off`, `progression_scaling_guidance_rate`, `progression_good_fit_only`, `progression_pick_warnings_clean`, `progression_phase_ids_parity`, `progression_scaled_warning_conflict`

### MOE check ids (`CATEGORY6_MOE_CHECK_IDS` — 9 informational)

`category6_moe_progression_arc`, `category6_moe_split2_policy`, `category6_moe_pool_reject_signal`, `progression_eligibility_rate`, `progression_coverage_output`, `progression_coverage_capacity`, `progression_eligible_unassigned_output`, `progression_eligible_unassigned_capacity`, `category6_moe_progression_yield`

## Engine builds (Phase 0 complete)

| Build | File | Fields / behavior |
|-------|------|-------------------|
| Progression eligibility counters | `phaseAwarePrescription.js` | `progression_eligible`, `progression_assigned`, `progression_coverage` on `phase_fill` |
| Phase progression id export | `phaseAwarePrescription.js` | `phase_progression_ids` on `phase_fill` |
| Pick-time warning capture | `phaseAwarePrescription.js` | `split_resolve_warnings` on items |
| Scaling guidance fallback | `phaseAwarePrescription.js` | `resolveSplitScalingGuidance` |

## Engine backlog (promote informational → blocking)

| Metric | Golden signal (Test 3) | Action when engine improves |
|--------|--------------------------|------------------------------|
| C6-MOP-07 | Output coverage ~57% | Promote `progression_coverage_*` to KPI blocking |
| C6-MOR-02 | Output eligible-unassigned ~29% | Promote `progression_eligible_unassigned_*` to KPI blocking |
| C6-MOE-06 | No builder diff | Wire `category6_tbd_builder_edits` |

## Verification

```bash
node --test backend/platform/__tests__/prescriptionQualityChecks.test.js
npm run needs-engine:eval
```

Golden Test 3: **278/278 PASS**.

## Status

**Full MOP/MOE assessment ready** — all automatable metrics emit checks; manual MOE rubric published; coverage/unassigned informational until engine meets bands (2026-07-08).
