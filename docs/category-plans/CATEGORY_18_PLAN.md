# Category 18 — Stretch & over-cap primaries — Implementation Plan

Full prerequisite → assessment matrix (2026-07-09). Scoped to Category 18 only.

## Executive summary

| Bucket | Count | Notes |
|--------|-------|-------|
| **Blocking MOP/MOS/MOR** | 16 | Stretch policy, over-cap, replay, per_split caps, MOS caps |
| **Informational MOP** | 5 | Session stretch total, Split 1 stretch rate, near-cap alert, reject proxy, restore tolerance |
| **Informational MOE** | 4 | Badge proxy, Split 1 over-cap proxy, cap consistency, warning stability (lagging) |
| **Manual MOE** | 3 | C18-MOE-01, 04, 06 via `category18_moe_review_packet` |
| **Synthetic KPI** | 1 | `category18_kpi` over `CATEGORY18_KPI_CHECK_IDS` (9 blocking ids) |

**Assessment readiness:** All 29 metrics assessable; golden Test 3 strict **PASS**.

## Prerequisite → assessment matrix (29 metrics)

| ID | Metric | Prerequisites | In app? | check_id | Evaluable? |
|----|--------|---------------|---------|----------|------------|
| C18-MOP-01 | Stretch primaries Prepare | Prepare primaries; `items[].age_fit` | yes | `stretch_primaries_prepare_and_access` | yes |
| C18-MOP-02 | Stretch primaries MI | MI primaries; stretch count | yes | `stretch_primaries_movement_intelligence` | yes |
| C18-MOP-03 | Stretch primaries Output | Output primaries; stretch count | yes | `stretch_primaries_output` | yes |
| C18-MOP-04 | Stretch primaries Capacity | Capacity primaries; stretch count | yes | `stretch_primaries_capacity` | yes |
| C18-MOP-05 | Stretch primaries Resilience | Resilience primaries; stretch count | yes | `stretch_primaries_resilience` | yes |
| C18-MOP-06 | Over-cap primaries session-wide | all primaries; `age_fit === 'over_cap'` | yes | `primary_over_cap_count` | yes |
| C18-MOP-07 | Engine fill rejects stretch/over-cap | `NO_STRETCH_PRIMARY_PHASES`; prescribed `age_fit` | yes | `engine_no_stretch_over_cap_admitted` | yes |
| C18-MOP-08 | Split-good exception path | `classifyPrimaryAgeFit` replay; split-good context | yes | `primary_age_fit_split_good_path` | yes |
| C18-MOP-09 | Stretch allowed phases | stretch by phase; session-wide total | yes | `stretch_primary_session_total` | yes (info) |
| C18-MOP-10 | Stretch variant warnings | `split_variant_warnings` | yes | `split_variant_warnings` | yes |
| C18-MOP-11 | Primary fit at selection time | replay `classifyPrimaryAgeFit` per NO_STRETCH primary | yes | `stretch_primary_fit_replay` | yes |
| C18-MOP-12 | Stretch primaries Sustained | Sustained primaries; stretch count | yes | `stretch_primaries_sustained_capacity` | yes |
| C18-MOP-13 | Stretch primaries Restore | Restore primaries; low-intent tolerance | yes | `stretch_primaries_restore` | yes (info when ≤1) |
| C18-MOP-14 | Split 1 variant stretch rate | Split 1 `per_split` when primary `age_fit === 'good'` | yes | `split1_variant_stretch_rate` | yes (info) |
| C18-MOP-15 | hardDifficultyExclude interaction | `hardDifficultyExclude`; NO_STRETCH admission audit | yes | `hard_difficulty_exclude_stretch_reject` | yes |
| C18-MOP-16 | Near-cap primary rate (Output) | Output D ≥ cap−1; stretch warnings | yes | `output_near_cap_stretch_alert` | yes (info) |
| C18-MOP-17 | Stretch reject telemetry | post-hoc NO_STRETCH admission audit | partial | `stretch_reject_telemetry_proxy` | yes (info proxy) |
| C18-MOP-18 | Over-cap in per_split variants | variant D vs `difficulty_cap` | yes | `per_split_over_cap_count` | yes |
| C18-MOP-19 | Stretch–warning correlation | stretch items vs `age_fit_warnings` / split warnings | yes | `stretch_warning_correlation` | yes |
| C18-MOP-20 | Good-fit rate in NO_STRETCH phases | `age_fit === 'good'` share in Prepare/MI/Output/Capacity/Resilience | yes | `no_stretch_phase_good_fit_rate` | yes |
| C18-MOS-01 | Caps resolvable before stretch filter | `audience_profile.caps` numeric | yes | `audience_caps_numeric_mos` | yes |
| C18-MOS-02 | Split caps ≤ pool cap | split `caps.maxOverall` vs poolCap | yes | `split_caps_le_pool_cap_mos` | yes |
| C18-MOE-01 | Coach keeps stretch primaries | coach swap/downgrade audit | yes | `category18_moe_review_packet` | partial (manual) |
| C18-MOE-02 | Stretch badges trustworthy | UI `age_fit` vs warnings | yes | `category18_moe_stretch_badges_proxy` | yes (info) |
| C18-MOE-03 | Split 1 not assigned over-cap work | Split 1 per_split D vs cap | yes | `category18_moe_split1_overcap_proxy` | yes (info) |
| C18-MOE-04 | Strict bar protects session flow | coach cap-stop audit | yes | `category18_moe_review_packet` | partial (manual) |
| C18-MOE-05 | Caps feel consistent session-wide | difficulty arc per split | yes | `category18_moe_cap_consistency_proxy` | yes (info) |
| C18-MOE-06 | Split-good path transparent | scaling notes when split-good used | yes | `category18_moe_review_packet` | partial (manual) |
| C18-MOR-01 | Stretch primary in high-intent phase | stretch in Output/Capacity/Resilience | yes | `stretch_high_intent_mor` | yes (P0) |
| C18-MOR-02 | Over-cap primary admitted | `age_fit === 'over_cap'` | yes | `primary_over_cap_count` | yes |
| C18-MOR-03 | Chronic stretch warnings | `split_variant_warnings` spikes in eval history | yes | `stretch_variant_warning_stability` | yes (info lagging) |
| C18-KPI-01 | Stretch/over-cap discipline index | pass rate on blocking C18 ids | yes | `category18_kpi` | yes |

## KPI check ids (9 blocking)

`stretch_primaries_prepare_and_access`, `stretch_primaries_movement_intelligence`, `stretch_primaries_output`, `stretch_primaries_capacity`, `stretch_primaries_resilience`, `primary_over_cap_count`, `engine_no_stretch_over_cap_admitted`, `stretch_primary_fit_replay`, `stretch_high_intent_mor`

## MOE check ids (5 informational + review packet)

`category18_moe_review_packet`, `category18_moe_stretch_badges_proxy`, `category18_moe_split1_overcap_proxy`, `category18_moe_cap_consistency_proxy`, `stretch_variant_warning_stability`

## Engine backlog (document only)

| Metric | Backlog item | Tracking |
|--------|--------------|----------|
| C18-MOP-17 | `constraint_report.stretch_rejects` not exported from fill loop | `stretch_reject_telemetry_proxy` uses post-hoc admission audit |

## Verification

```bash
node --test backend/platform/__tests__/prescriptionQualityChecks.test.js
npm run needs-engine:eval
```

## Status

**Complete assessable implementation** (2026-07-09). Golden Test 3 strict PASS; all 9 KPI ids + 5 MOE ids emit when `expectedBody` set.
