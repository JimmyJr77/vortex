# Category 15 — Phase intent alignment — Implementation Plan

Full prerequisite → assessment matrix (2026-07-09). Scoped to Category 15 only.

## Executive summary

| Bucket | Count | Notes |
|--------|-------|-------|
| **Blocking MOP/MOR** | 8 | `output_speed_tenet_match`, `output_focus_score_honored`, `sustained_hiit_*`, `hiit_not_leaked_*`, `focus_weight_ignored` |
| **Blocking MOP (delegated Cat 1)** | 2 | `focus_targets_count_parity`, `focus_targets_field_parity` |
| **Blocking MOR** | 3 | `focus_targets_dropped`, `hiit_in_low_intent_phases`, `focus_weight_ignored` |
| **Informational MOP** | 12 | Score spread, rank ρ, physiology, interval structure, bleed, transform, pool depth |
| **Informational MOE** | 3 | Weight drive, methodology label, objective synergy |
| **Manual MOE** | 6 | C15-MOE-01, 02, 03, 07, 08, 09 → `category15_moe_review_packet` + rubric |
| **Synthetic KPI** | 1 | `category15_kpi` over `CATEGORY15_KPI_CHECK_IDS` (11 ids) |

**Assessment readiness:** All 37 metrics assessable; golden Test 3 strict **PASS**.

## Prerequisite → assessment matrix (37 metrics)

| ID | Metric | Prerequisites | In app? | check_id | Evaluable? |
|----|--------|---------------|---------|----------|------------|
| C15-MOP-01 | Focus target count per phase | phasePlan + blocks focus_targets | yes | `focus_targets_count_parity` | yes |
| C15-MOP-02 | Output tenet match (Speed) | Output primaries + tenet facet_id 3 | yes | `output_speed_tenet_match` | yes |
| C15-MOP-03 | Output focus weight honored | scoreTargets replay on Output focus | yes | `output_focus_score_honored` | yes |
| C15-MOP-04 | Sustained HIIT methodology | Sustained primaries + methodology 1169/hiit | yes | `sustained_hiit_methodology_share` | yes |
| C15-MOP-05 | Sustained strict HIIT gate | `sustainedCapacityCandidateEligible` per item | yes | `sustained_strict_hiit_gate` | yes |
| C15-MOP-06 | HIIT not leaked to other phases | Non-Sustained primaries + hiit tag | yes | `hiit_not_leaked_other_phases` | yes |
| C15-MOP-07 | Order slot alignment | order_slot focus + `matchesOrderSlot` | yes | `category15_mop_order_slot_alignment` | yes (info) |
| C15-MOP-08 | Physiology focus alignment | physiology facet in focus + tags | yes | `category15_mop_physiology_focus_*` | yes (info) |
| C15-MOP-09 | Phase profile role match | exercise_phase_profile role per phase | yes | `category15_mop_phase_profile_role` | yes |
| C15-MOP-10 | Empty-focus phase appropriateness | unfocused phases + profile role ≠ avoid | yes | `category15_mop_empty_focus_appropriate` | yes (info) |
| C15-MOP-11 | Focus target score spread | top-quartile vs median scoreTargets | yes | `category15_mop_score_spread` | yes (info) |
| C15-MOP-12 | Sustained fill with HIIT focus | phase_fill sustained + HIIT weight | yes | `category15_mop_sustained_fill_hiit` | yes (info) |
| C15-MOP-13 | Output minutes vs focus weight | Output target_minutes / session total | yes | `category15_mop_output_minutes_share` | yes (info) |
| C15-MOP-14 | Focus facet ID round-trip | phasePlan vs blocks focus_targets fields | yes | `focus_targets_field_parity` | yes |
| C15-MOP-15 | Session vs phase scoring | sessionTargets vs phaseTargets replay | yes | `category15_mop_session_vs_phase_scoring` | yes (info) |
| C15-MOP-16 | Weighted facet frequency | Output Speed tag share | yes | `output_speed_tenet_frequency` | yes |
| C15-MOP-17 | Focus rank correlation | selection order vs scoreTargets ρ | yes | `category15_mop_focus_rank_correlation` | yes (info) |
| C15-MOP-18 | Methodology key resolution | facetId 1169 → hiit via methodologyKeyById | yes | `category15_mop_methodology_key_resolution` | yes |
| C15-MOP-19 | Tenet tag diversity under focus | distinct pattern tags in Output | yes | `category15_mop_tenet_pattern_diversity` | yes (info) |
| C15-MOP-20 | Unfocused phase objective bleed | Capacity/Resilience Speed tags when only Output focused | yes | `category15_mop_objective_bleed` | yes (info) |
| C15-MOP-21 | Sustained interval structure | programming_kind interval-compatible | yes | `category15_mop_sustained_interval_structure` | yes (info) |
| C15-MOP-22 | Focus loss at prescribe transform | phasePlan focusTargets field completeness | yes | `category15_mop_focus_transform_preserved` | yes |
| C15-MOS-01 | Focus facet resolvable | facetId + facetType + key maps | yes | `category15_mos_focus_resolvable` | yes |
| C15-MOS-02 | Focus weight in valid range | weight 1–10 per focus target | yes | `category15_mos_focus_weight_range` | yes |
| C15-MOS-03 | HIIT methodology pool non-empty | sustained phase_fill pool_size ≥ 2 | yes | `category15_mos_hiit_pool_depth` | yes |
| C15-MOE-01 | Output reads as speed/power | coach Likert on Output block | yes | `category15_moe_review_packet` | partial (manual) |
| C15-MOE-02 | Sustained reads as HIIT | coach conditioning judgment | yes | `category15_moe_review_packet` | partial (manual) |
| C15-MOE-03 | Phases without focus coherent | coach unfocused-phase rubric | yes | `category15_moe_review_packet` | partial (manual) |
| C15-MOE-04 | Focus weight drives selection | weight vs tag-frequency ρ | yes | `category15_moe_focus_weight_drives` | yes (info) |
| C15-MOE-05 | Methodology label clarity | facetId 1169 → HIIT label proxy | yes | `category15_moe_methodology_label` | yes (info) |
| C15-MOE-06 | Session objective + focus synergy | speed_priority + speed pattern share | yes | `category15_moe_session_objective_synergy` | yes (info) |
| C15-MOE-07 | Coach can explain phase why | timed focus explanation | yes | `category15_moe_review_packet` | partial (manual) |
| C15-MOE-08 | Sustained distinct from Output | coach distinctness judgment | yes | `category15_moe_review_packet` | partial (manual) |
| C15-MOE-09 | Focused phase time feels earned | Output filler Likert | yes | `category15_moe_review_packet` | partial (manual) |
| C15-MOR-01 | Focus targets dropped silently | plan focus vs empty block focus | yes | `focus_targets_dropped` | yes |
| C15-MOR-02 | HIIT methodology in Prepare/MI | hiit tag in low-intent phases | yes | `hiit_in_low_intent_phases` | yes |
| C15-MOR-03 | Focus weight ignored | weight ≥ 5 but < 50% positive scoreTargets | yes | `focus_weight_ignored` | yes |
| C15-KPI-01 | Phase intent fidelity index | blocking pass rate ≥ 85% | yes | `category15_kpi` | yes |

## KPI check ids (11 blocking)

`focus_targets_count_parity`, `focus_targets_field_parity`, `output_speed_tenet_match`, `output_focus_score_honored`, `sustained_hiit_methodology_share`, `sustained_strict_hiit_gate`, `hiit_not_leaked_other_phases`, `output_speed_tenet_frequency`, `focus_targets_dropped`, `hiit_in_low_intent_phases`, `focus_weight_ignored`

## MOE check ids (4 informational + review packet)

`category15_moe_focus_weight_drives`, `category15_moe_methodology_label`, `category15_moe_session_objective_synergy`, `category15_moe_review_packet`

## Engine backlog (document only)

| Metric | Backlog item | Tracking |
|--------|--------------|----------|
| C15-MOP-15 | Per-pick dual scoreTargets telemetry in engine | `category15_mop_session_vs_phase_scoring` replay proxy |
| C15-MOP-17 | Selection-order replay log from engine | Spearman ρ on item order vs score |
| C15-MOS-03 | Pre-fill candidate pool probe | `phase_fill.pool_size` proxy |
| C15-MOE-05 | UI methodology label display | `category15_moe_methodology_label` key-resolution proxy |

## Verification

```bash
node --test backend/platform/__tests__/prescriptionQualityChecks.test.js
npm run needs-engine:eval
```

## Status

**Complete assessable implementation** (2026-07-09). Golden Test 3 strict PASS; all 11 KPI ids + 4 MOE ids emit when focus configured.
