# Category 1 — Session structure & phasing — Implementation Plan

Full prerequisite → assessment matrix (2026-07-09). Scoped to Category 1 only.

## Executive summary

| Bucket | Count | Notes |
|--------|-------|-------|
| **Blocking MOP/MOS** | 19 | C1-MOP-01–17 + C1-MOS-01–02 |
| **Blocking via eval merge** | 1 | C1-MOP-12 `sport_id_preflight` (included in `category1_kpi` after merge) |
| **Informational MOE** | 7 | C1-MOE-02–05, 08–09 automated; C1-MOE-01/07 review packet |
| **Manual MOE** | 2 | C1-MOE-01, C1-MOE-07 coach rubric |
| **Synthetic KPI** | 1 | `category1_kpi` over `CATEGORY1_KPI_CHECK_IDS` (20 ids) |

**Assessment readiness:** All 27 metrics assessable; golden Test 3 strict **PASS**.

## Prerequisite → assessment matrix (27 metrics)

| ID | Metric | Prerequisites | In app? | check_id | Evaluable? |
|----|--------|---------------|---------|----------|------------|
| C1-MOP-01 | Phase count match | `phasePlan[]`, `blocks[]` | yes | `phase_count_match` | yes |
| C1-MOP-02 | Phase key set equality | `phasePlan[].phaseKey`, `blocks[].phase_key` | yes | `phase_key_set_equality` | yes |
| C1-MOP-03 | Canonical phase order | `SESSION_PHASE_ORDER`, `blocks[].phase_key` | yes | `canonical_phase_order` | yes |
| C1-MOP-04 | Per-phase target minutes | `phasePlan[].minutes`, `blocks[].target_minutes` | yes | `phase_minutes_exact` | yes |
| C1-MOP-05 | Total session minutes | `durationMinutes`, Σ `target_minutes` | yes | `session_minutes_sum` | yes |
| C1-MOP-06 | Focus target count | `focusTargets` / `focus_targets` per phase | yes | `focus_targets_count_parity` | yes |
| C1-MOP-07 | Focus facet match | facetId, facetType, weight parity | yes | `focus_targets_field_parity` | yes |
| C1-MOP-08 | Pinned Prepare preserved | `pinned`, `blocks[0]`, Prepare minutes | yes | `pinned_prepare_first` | yes |
| C1-MOP-09 | Work mode match | `workMode`, `result.work_mode` | yes | `work_mode_echo` | yes |
| C1-MOP-10 | No orphan Other blocks | `phase_key === 'other'`, `other_kind` | yes | `no_orphan_other_blocks` | yes |
| C1-MOP-11 | Phase label fidelity | `plan.label`, `blocks[].label` | yes | `phase_label_parity` | yes |
| C1-MOP-12 | sportId accepted | `sportId`, `coaching.sport`, engine scoring path | yes | `sport_id_preflight` | yes |
| C1-MOP-13 | sessionObjective echo | body + `audience_profile.sessionObjective` | yes | `session_objective_echo` | yes |
| C1-MOP-14 | Focus weight sum sanity | Σ weights per phase 1–10 | yes | `focus_weight_sum_sanity` | yes |
| C1-MOP-15 | Other-phase fidelity | `otherKind`, `otherItemIds` when used | yes | `other_phase_fidelity` | yes |
| C1-MOP-16 | Block index order | `blocks` order vs `SESSION_PHASE_ORDER` | yes | `block_index_order` | yes |
| C1-MOP-17 | Phase rationales emitted | `phase_rationales.length === blocks.length` | yes | `phase_rationales_present` | yes |
| C1-MOS-01 | Requirements completeness | age, duration, phasePlan, objective, workMode, skillLevel | yes | `prescribe_body_mos_complete` | yes |
| C1-MOS-02 | phasePlan minute sum | Σ plan minutes = `durationMinutes` | yes | `phase_plan_minute_sum_mos` | yes |
| C1-MOE-01 | Vortex flow coherence | blocks sequence + coach rubric | yes | `category1_moe_review_packet` | partial (manual) |
| C1-MOE-02 | Phase minute proportions | plan minutes vs `buildPhasePlan` template | yes | `category1_moe_objective_template_proportions` | yes (info) |
| C1-MOE-03 | High-intent time dominance | Output+Capacity+Resilience+Sustained minutes | yes | `category1_moe_high_intent_ratio` | yes (info) |
| C1-MOE-04 | Prepare not overweighted | Prepare minutes / total | yes | `category1_moe_prepare_share` | yes (info) |
| C1-MOE-05 | Restore not skipped | Restore present and last block | yes | `category1_moe_restore_last` | yes (info) |
| C1-MOE-06 | Focus weight reflects intent | Output/Sustained weight ≥ 3 | yes | `focus_weight_intent_minimum` | yes |
| C1-MOE-07 | Session reads as one arc | Coach checklist | yes | `category1_moe_review_packet` | partial (manual) |
| C1-MOE-08 | MI proportion | MI minutes / total (speed 120m band) | yes | `category1_moe_mi_proportion` | yes (info) |
| C1-MOE-09 | Prepare–Restore bookend ratio | Restore / Prepare minutes | yes | `category1_moe_restore_prepare_ratio` | yes (info) |
| C1-KPI-01 | Structure fidelity index | Pass rate on blocking C1 ids | yes | `category1_kpi` | yes |

## KPI check ids (20 blocking)

`prescribe_body_mos_complete`, `phase_plan_minute_sum_mos`, `phase_count_match`, `phase_key_set_equality`, `canonical_phase_order`, `block_index_order`, `phase_minutes_exact`, `session_minutes_sum`, `focus_targets_count_parity`, `focus_targets_field_parity`, `pinned_prepare_first`, `work_mode_echo`, `no_orphan_other_blocks`, `phase_label_parity`, `session_objective_echo`, `focus_weight_sum_sanity`, `phase_rationales_present`, `focus_weight_intent_minimum`, `other_phase_fidelity`, `sport_id_preflight`

## MOE check ids (7 informational)

`category1_moe_high_intent_ratio`, `category1_moe_prepare_share`, `category1_moe_mi_proportion`, `category1_moe_restore_prepare_ratio`, `category1_moe_objective_template_proportions`, `category1_moe_restore_last`, `category1_moe_review_packet`

## Verification

```bash
node --test backend/platform/__tests__/prescriptionQualityChecks.test.js
npm run needs-engine:eval
```

## Status

**Complete assessable implementation** (2026-07-09).
