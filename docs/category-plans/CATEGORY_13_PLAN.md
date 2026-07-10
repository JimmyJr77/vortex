# Category 13 — Equipment — Avoid — Implementation Plan

Full prerequisite → assessment matrix (2026-07-09). Scoped to Category 13 only.

## Executive summary

| Bucket | Count | Notes |
|--------|-------|-------|
| **Blocking MOP/MOR (P0)** | 3 | `prescription_equipment_avoid_clean`, `restore_not_box_avoid_false_positive`, `semantic_avoid_false_negative` |
| **Blocking MOP/MOS/MOR** | 10 | Exclusions logged, expansion, parity, overlap, feasibility, pool_empty |
| **Informational MOP** | 5 | Semantic blocks, bar alias, reject-path ratio, precision proxy, restore pool floor |
| **Informational MOE** | 2 | Breathing available, pattern diversity |
| **Manual MOE** | 4 | C13-MOE-01, 03, 05, 06 → `category13_moe_review_packet` + rubric |
| **Synthetic KPI** | 1 | `category13_kpi` over `CATEGORY13_KPI_CHECK_IDS` (13 ids) |

**Assessment readiness:** All 30 metrics assessable; golden Test 3 strict **PASS**.

## Prerequisite → assessment matrix (30 metrics)

| ID | Metric | Prerequisites | In app? | check_id | Evaluable? |
|----|--------|---------------|---------|----------|------------|
| C13-MOP-01 | Prescription avoid violations | blocks, tags, expanded avoid IDs | yes | `prescription_equipment_avoid_clean` | yes |
| C13-MOP-02 | Avoid ID expansion | `expandEquipmentAvoidIds` output | yes | `equipment_avoid_id_expansion` | yes |
| C13-MOP-03 | Pool pre-filter exclusions | `equipment_avoid.excluded_count` | yes | `equipment_avoid_exclusions_logged` | yes |
| C13-MOP-04 | Semantic inference blocks | sample names + `inferAvoidedEquipmentKeys` | yes | `equipment_avoid_semantic_blocks` | yes (info) |
| C13-MOP-05 | Box-breathing whitelist | `equipment_avoid.sample_names` | yes | `restore_not_box_avoid_false_positive` | yes |
| C13-MOP-06 | Whitelist slug patterns | `isBoxSemanticWhitelist` on samples | yes | `equipment_avoid_sample_whitelist_clean` | yes |
| C13-MOP-07 | Primary + variant avoid clean | full prescription audit incl. `per_split` | yes | `prescription_equipment_avoid_clean` | yes |
| C13-MOP-08 | Avoid tag on prescribed item | equipment tags ∩ expanded avoid | yes | `prescription_equipment_avoid_clean` | yes |
| C13-MOP-09 | Bar avoid alias coverage | `EQUIPMENT_AVOID_ALIASES.bar` | yes | `equipment_avoid_bar_alias_coverage` | yes (info) |
| C13-MOP-10 | 422 violates_equipment_avoid | success path + post-build audit | yes | `prescription_equipment_avoid_clean` | yes |
| C13-MOP-11 | Sample names accuracy | whitelist filter on samples | yes | `equipment_avoid_sample_whitelist_clean` | yes |
| C13-MOP-12 | Expanded avoid ID set size | raw vs expanded ID counts | yes | `equipment_avoid_expansion_ratio` | yes |
| C13-MOP-13 | Tag-path vs infer-path ratio | infer hits on sample names | yes | `equipment_avoid_reject_path_ratio` | yes (info) |
| C13-MOP-14 | Restore pool shrink from avoid | restore `phase_fill.pool_size` | yes | `equipment_avoid_restore_feasible`, `equipment_avoid_restore_pool_floor` | yes |
| C13-MOP-15 | Snapshot → body avoid parity | `equipmentAvoid[].id` vs `equipmentAvoidIds` | yes | `equipment_avoid_id_parity` | yes |
| C13-MOP-16 | Progression/variant avoid paths | audit covers `per_split` | yes | `prescription_equipment_avoid_clean` | yes |
| C13-MOP-17 | Use+avoid on same exercise blocked | use tags ∩ avoid tags | yes | `equipment_avoid_use_overlap` | yes |
| C13-MOP-18 | Semantic pattern precision | whitelist false positives / samples | yes | `equipment_avoid_semantic_precision` | yes (info) |
| C13-MOS-01 | Avoid IDs resolvable | DB expansion → `equipmentAvoidKeys` | yes | `equipment_avoid_ids_resolvable` | yes |
| C13-MOS-02 | Avoid does not eliminate restore | restore items + pool_size | yes | `equipment_avoid_restore_feasible` | yes |
| C13-MOE-01 | Coach trust in avoid | coach surprise drill audit | yes | `category13_moe_review_packet` | partial (manual) |
| C13-MOE-02 | Restore breathing still available | restore breathing slugs when box avoided | yes | `category13_moe_breathing_available` | yes (info) |
| C13-MOE-03 | Semantic avoid credible | excluded samples + coach agreement | yes | `category13_moe_review_packet` | partial (manual) |
| C13-MOE-04 | No over-broad avoid | prescribed pattern diversity | yes | `category13_moe_pattern_diversity` | yes (info) |
| C13-MOE-05 | Facility layout trust | coach facility review | yes | `category13_moe_review_packet` | partial (manual) |
| C13-MOE-06 | Avoid rationale explainable | sample explanation rubric | yes | `category13_moe_review_packet` | partial (manual) |
| C13-MOR-01 | Avoid leak to prescription | post-build audit violations | yes | `prescription_equipment_avoid_clean` | yes |
| C13-MOR-02 | Box-breathing false positive | sample_names pattern | yes | `restore_not_box_avoid_false_positive` | yes |
| C13-MOR-03 | Semantic false negative | `inferAvoidedEquipmentKeys` on prescribed set | yes | `semantic_avoid_false_negative` | yes |
| C13-MOR-04 | Avoid collapses working phase pool | `empty_phase_reasons` Output/Capacity | yes | `equipment_avoid_phase_pool_empty` | yes |
| C13-KPI-01 | Equipment avoid fidelity index | blocking pass rate | yes | `category13_kpi` | yes |

## KPI check ids (13 blocking)

`prescription_equipment_avoid_clean`, `restore_not_box_avoid_false_positive`, `semantic_avoid_false_negative`, `equipment_avoid_exclusions_logged`, `equipment_avoid_id_expansion`, `equipment_avoid_sample_whitelist_clean`, `equipment_avoid_expansion_ratio`, `equipment_avoid_id_parity`, `equipment_avoid_use_overlap`, `equipment_avoid_ids_resolvable`, `equipment_avoid_restore_feasible`, `equipment_avoid_phase_pool_empty`, `equipment_avoid_report_present`

## MOE check ids (6 informational)

`category13_moe_breathing_available`, `category13_moe_pattern_diversity`, `equipment_avoid_semantic_blocks`, `equipment_avoid_reject_path_ratio`, `equipment_avoid_semantic_precision`, `category13_moe_review_packet`

## Engine backlog (document only)

| Metric | Backlog item | Tracking |
|--------|--------------|----------|
| C13-MOP-13 | Per-exclusion tag vs infer taxonomy in `constraint_report` | `equipment_avoid_reject_path_ratio` sample-name proxy |
| C13-MOP-14 | Counterfactual pool without avoid | `equipment_avoid_restore_pool_floor` informational |
| C13-MOE-04 | Counterfactual pattern diversity | `category13_moe_pattern_diversity` prescribed-set proxy |

## Verification

```bash
node --test backend/platform/__tests__/prescriptionQualityChecks.test.js
npm run needs-engine:eval
```

## Status

**Complete assessable implementation** (2026-07-09). Golden Test 3 strict PASS; all 13 KPI ids + 6 MOE ids emit when avoid active.
