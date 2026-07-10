# Category 11 — Difficulty cap utilization — Implementation Plan

Full prerequisite → build → assessment matrix (2026-07-09). Scoped to Category 11 only.

## Executive summary

| Bucket | Count | Notes |
|--------|-------|-------|
| **Blocking MOP/MOS/MOR/KPI** | 8 | Policy + credibility gates (`CATEGORY11_KPI_CHECK_IDS`) |
| **Informational MOP (util bands)** | 17 | Aspirational thresholds via `ok_band` on prescription replay |
| **Informational MOP (telemetry proxy)** | 4 | Proximity bonus, pool size, stability, correlation proxies |
| **Informational MOE** | 7 | Automated headroom / arc / band proxies |
| **Manual MOE** | 3 | C11-MOE-01, 06, 09 via rubric + review packet |
| **Synthetic KPI** | 1 | `category11_kpi` — blocking ids + util band index in detail |

**Assessment readiness:** All 36 metrics assessable; golden Test 3 strict **634/634 PASS**.

## KPI check ids (6 blocking)

`pool_cap_max_of_splits`, `session_cap_resolvable`, `primary_over_cap_count`, `split_overrides_consistent`, `prepare_mi_no_over_cap`, `cap_sandbagging_credibility`

## Util check ids (17 informational bands)

`session_mean_d_utilization`, `output_mean_d_pool_cap`, `capacity_mean_d_pool_cap`, `resilience_mean_d_pool_cap`, `split1_mean_d_utilization`, `split2_mean_d_utilization`, `high_intent_near_cap_rate`, `sandbagging_per_phase`, `progression_cap_utilization`, `restore_under_utilization`, `prepare_mi_cap_discipline`, `prepare_mi_low_d_expectation`, `technical_cap_utilization`, `load_cap_utilization`, `cap_headroom_median`, `split_utilization_gap`, `progression_headroom_to_cap`

## MOE / telemetry check ids (11 informational)

`category11_moe_session_headroom`, `category11_moe_split2_exploited`, `category11_moe_output_power_band`, `category11_moe_no_timid_high_intent`, `category11_moe_objective_cap_alignment`, `category11_moe_younger_split_completable`, `category11_moe_difficulty_arc`, `category11_moe_field_rpe`, `category11_moe_builder_edit_signal`, `category11_moe_review_packet`, `proximity_bonus_lift_proxy`, `near_cap_pool_size_proxy`, `cap_utilization_stability`, `proximity_bonus_correlation_proxy`

## 36-metric prerequisite status

| ID | Metric | Prerequisites | In app? | check_id | Evaluable? |
|----|--------|---------------|---------|----------|------------|
| C11-MOP-01 | Session mean D / session cap | primaries + session cap | yes | `session_mean_d_utilization` | yes (info) |
| C11-MOP-02 | Output mean D / pool cap | Output + poolCap; Split2 when splits | yes | `output_mean_d_pool_cap` | yes (info) |
| C11-MOP-03 | Capacity mean D / pool cap | Capacity + poolCap | yes | `capacity_mean_d_pool_cap` | yes (info) |
| C11-MOP-04 | Resilience mean D / pool cap | Resilience + poolCap | yes | `resilience_mean_d_pool_cap` | yes (info) |
| C11-MOP-05 | Split 1 utilization | Split 1 per_split D / cap 6 | yes | `split1_mean_d_utilization` | yes (info) |
| C11-MOP-06 | Split 2 utilization | Split 2 per_split D / cap 10 | yes | `split2_mean_d_utilization` | yes (info) |
| C11-MOP-07 | High-intent near-cap rate | Output/Capacity/Resilience D vs cap−1 | yes | `high_intent_near_cap_rate` | yes (info) |
| C11-MOP-08 | Sandbagging count | Output/Capacity D ≤ cap−3 per phase | yes | `sandbagging_per_phase` | yes (info) |
| C11-MOP-09 | Proximity bonus lift | `difficultyProximityBonus` on selected primaries | yes | `proximity_bonus_lift_proxy` | yes (info) |
| C11-MOP-10 | Pool cap = max-of-splits | mergeCapsMax replay | yes | `pool_cap_max_of_splits` | yes |
| C11-MOP-11 | Progression cap utilization | Split 2 progression D / cap 10 | yes | `progression_cap_utilization` | yes (info) |
| C11-MOP-12 | Restore under-utilization | Restore mean D / session cap | yes | `restore_under_utilization` | yes (info) |
| C11-MOP-13 | Prepare/MI cap discipline | D ≤ session cap + age_fit | yes | `prepare_mi_cap_discipline` | yes (info) |
| C11-MOP-14 | Technical cap utilization | technical D / maxTechnical | yes | `technical_cap_utilization` | yes (info) |
| C11-MOP-15 | Load cap utilization | load D / maxLoad on Capacity | yes | `load_cap_utilization` | yes (info) |
| C11-MOP-16 | Cap headroom median | (poolCap − D) median Output/Capacity | yes | `cap_headroom_median` | yes (info) |
| C11-MOP-17 | Near-cap pool size | Output pool_size + near-cap count | yes | `near_cap_pool_size_proxy` | yes (info) |
| C11-MOP-18 | Utilization stability | eval history `cat11OutputPoolUtil` σ | yes | `cap_utilization_stability` | yes (info) |
| C11-MOP-19 | Split utilization gap | Split2 util − Split1 util | yes | `split_utilization_gap` | yes (info) |
| C11-MOP-20 | Progression headroom | split2_cap − progression D mean | yes | `progression_headroom_to_cap` | yes (info) |
| C11-MOP-21 | MI/Prepare low-D | Prepare/MI mean D / session cap | yes | `prepare_mi_low_d_expectation` | yes (info) |
| C11-MOP-22 | Proximity bonus correlation | high-bonus share proxy | yes | `proximity_bonus_correlation_proxy` | yes (info) |
| C11-MOS-01 | Caps resolvable | finite maxOverall on profile | yes | `session_cap_resolvable` | yes |
| C11-MOS-02 | Split overrides consistent | difficultyOverride 1–10 ≥ session cap | yes | `split_overrides_consistent` | yes |
| C11-MOE-01 | Session headroom feel | coach Likert | yes | `category11_moe_review_packet` | partial (manual) |
| C11-MOE-02 | Split 2 exploited | Split2 vs Split1 mean D | yes | `category11_moe_split2_exploited` | yes (info) |
| C11-MOE-03 | Output power band | Split2 Output D 5–8 | yes | `category11_moe_output_power_band` | yes (info) |
| C11-MOE-04 | No timid high-intent | low-D share Output/Capacity | yes | `category11_moe_no_timid_high_intent` | yes (info) |
| C11-MOE-05 | Objective alignment | speed_priority Output ≥ Capacity | yes | `category11_moe_objective_cap_alignment` | yes (info) |
| C11-MOE-06 | Field RPE | survey Split 2 progressions | yes | `category11_moe_field_rpe` | partial (manual) |
| C11-MOE-07 | Younger split completable | Split1 util + coach review | yes | `category11_moe_younger_split_completable` | yes (info) |
| C11-MOE-08 | Difficulty arc | Prepare→Output→Restore ordering | yes | `category11_moe_difficulty_arc` | yes (info) |
| C11-MOE-09 | Builder edit signal | edit telemetry lagging | yes | `category11_moe_builder_edit_signal` | partial (manual) |
| C11-MOR-01 | Over-cap primaries | age_fit over_cap | yes | `primary_over_cap_count` | yes |
| C11-MOR-02 | Cap sandbagging credibility | both Output+Capacity < 50% poolCap | yes | `cap_sandbagging_credibility` | yes |
| C11-KPI-01 | Cap utilization index | blocking + util band index | yes | `category11_kpi` | yes |

## Data & engine builds

| Build | File | Unblocks |
|-------|------|----------|
| `evaluateCategory11CapUtil` | `categoryEvaluatorsExtended.js` | All C11 metrics |
| Eval history output util | `evalHistory.js`, `evaluate-prescription-quality.mjs` | C11-MOP-18 |
| MOE rubric | `docs/CATEGORY_11_MOE_RUBRIC.md` | C11-MOE-01, 06, 09 |

## Verification

```bash
node --test backend/platform/__tests__/prescriptionQualityChecks.test.js
npm run needs-engine:eval
```

Golden Test 3: **634/634 PASS** (strict).

## Status

**Complete assessable implementation** (2026-07-09).
