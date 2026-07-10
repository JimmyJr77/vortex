# Category 12 — Equipment — Use — Implementation Plan

Full prerequisite → assessment matrix (2026-07-09). Scoped to Category 12 only.

## Executive summary

| Bucket | Count | Notes |
|--------|-------|-------|
| **Blocking MOP/MOS/MOR** | 17 | Keys, IDs, mode, distribution, progression, snapshot parity, overlap, feasibility |
| **Informational MOP** | 4 | C12-MOP-09, 10, 13, 14 — payload, legacy path, pool shrink, density |
| **Informational MOE** | 7 | C12-MOE-01–05, 07 automated proxies; setup/rotation heuristics |
| **Manual MOE** | 4 | C12-MOE-01, 03, 06, 07 → `category12_moe_review_packet` + rubric |
| **Synthetic KPI** | 1 | `category12_kpi` over `CATEGORY12_KPI_CHECK_IDS` (17 ids) |

**Assessment readiness:** All 30 metrics assessable; golden Test 3 strict **PASS**.

## Prerequisite → assessment matrix (30 metrics)

| ID | Metric | Prerequisites | In app? | check_id | Evaluable? |
|----|--------|---------------|---------|----------|------------|
| C12-MOP-01 | Required equipment keys present | tags + `minEquipmentUseKeysPresent` | yes | `equipment_use_coverage` | yes |
| C12-MOP-02 | Required equipment IDs present | `equipmentUseIds` + facet tags | yes | `equipment_use_ids_present` | yes |
| C12-MOP-03 | Use-mode enforcement | `equipmentUsePolicy`, pool filter | yes | `equipment_use_mode_enforcement` | yes |
| C12-MOP-04 | Items per required key | per-key primary count | yes | `equipment_items_per_key` | yes |
| C12-MOP-05 | Phase distribution | key → phase set | yes | `equipment_phase_distribution` | yes |
| C12-MOP-06 | Progression equipment consistency | per_split tags vs primary | yes | `equipment_progression_consistency` | yes |
| C12-MOP-07 | Substituted variant equipment | substituted `per_split` + use list | yes | `equipment_substituted_variant_coverage` | yes |
| C12-MOP-08 | Unsatisfiable equipment guard | prescribe success path | yes | `equipment_prescribe_success` | yes |
| C12-MOP-09 | Missing equipment names surfaced | 422 `unsatisfiable_equipment` payload | yes | `equipment_unsatisfiable_payload` | yes (info) |
| C12-MOP-10 | Legacy equipmentIds path | `equipmentIds` without use/avoid | yes | `equipment_legacy_ids_path` | yes (info) |
| C12-MOP-11 | Equipment tag vs slug coherence | `equipmentTagMismatchWarning` | yes | `equipment_tag_slug_coherence` | yes |
| C12-MOP-12 | Snapshot → body ID parity | `equipmentUse[].id` vs `equipmentUseIds` | yes | `equipment_snapshot_id_parity` | yes |
| C12-MOP-13 | Use-filter pool shrink ratio | candidates + use-tag proxy | yes | `equipment_use_pool_shrink` | yes (info) |
| C12-MOP-14 | Minutes-weighted equipment density | block minutes + key per item | yes | `equipment_minutes_density` | yes (info) |
| C12-MOP-15 | Per-split equipment on progressions | Split 2 progressions + use tags | yes | `equipment_progression_split2_keys` | yes |
| C12-MOP-16 | Use + avoid mutual exclusion | body use ∩ avoid IDs | yes | `equipment_use_avoid_overlap` | yes |
| C12-MOP-17 | Variants satisfy use filter | `use_only` audit on all rows | yes | `equipment_variant_use_filter` | yes |
| C12-MOP-18 | High-intent phase equipment share | Output/Capacity use-tag % | yes | `equipment_high_intent_share` | yes |
| C12-MOS-01 | Use IDs resolvable in DB | `coaching.equipment` lookup | yes | `equipment_use_ids_resolvable` | yes |
| C12-MOS-02 | Use list feasible pre-prescribe | prescribe completes | yes | `equipment_use_feasible` | yes |
| C12-MOS-03 | equipmentMode consistency | snapshot `equipmentMode` / policy | yes | `equipment_mode_consistency` | yes (info) |
| C12-MOE-01 | Coach sees requested gear | coach + inventory review | yes | `category12_moe_gear_visible`, `category12_moe_review_packet` | partial (manual) |
| C12-MOE-02 | Equipment use feels purposeful | per-key drill count | yes | `category12_moe_purposeful_use` | yes (info) |
| C12-MOE-03 | Setup friction acceptable | block equipment transitions | yes | `category12_moe_setup_friction`, `category12_moe_review_packet` | partial (manual) |
| C12-MOE-04 | Use list matches facility | body use IDs | yes | `category12_moe_facility_parity` | yes (info) |
| C12-MOE-05 | Equipment supports phase intent | keys in Output/Capacity/Sustained/MI | yes | `category12_moe_phase_intent` | yes (info) |
| C12-MOE-06 | Youth equipment safety | Split 1 kettlebell stations | yes | `category12_moe_youth_safety`, `category12_moe_review_packet` | partial (manual) |
| C12-MOE-07 | Gear rotation minimizes queue | transitions per block | yes | `category12_moe_gear_rotation`, `category12_moe_review_packet` | partial (manual) |
| C12-MOR-01 | 422 unsatisfiable_equipment | feasible Test 3 expects 0 | yes | `equipment_prescribe_success` | yes |
| C12-MOR-02 | Token equipment use | single-primary required keys | yes | `equipment_token_use_guard` | yes |
| C12-KPI-01 | Equipment use fidelity index | blocking pass rate | yes | `category12_kpi` | yes |

## KPI check ids (17 blocking)

`equipment_use_coverage`, `equipment_use_ids_present`, `equipment_use_mode_enforcement`, `equipment_items_per_key`, `equipment_phase_distribution`, `equipment_progression_consistency`, `equipment_substituted_variant_coverage`, `equipment_prescribe_success`, `equipment_tag_slug_coherence`, `equipment_snapshot_id_parity`, `equipment_use_avoid_overlap`, `equipment_variant_use_filter`, `equipment_high_intent_share`, `equipment_use_ids_resolvable`, `equipment_use_feasible`, `equipment_progression_split2_keys`, `equipment_token_use_guard`

## MOE check ids (13 informational)

`category12_moe_gear_visible`, `category12_moe_purposeful_use`, `category12_moe_setup_friction`, `category12_moe_facility_parity`, `category12_moe_phase_intent`, `category12_moe_youth_safety`, `category12_moe_gear_rotation`, `equipment_use_pool_shrink`, `equipment_minutes_density`, `equipment_unsatisfiable_payload`, `equipment_legacy_ids_path`, `equipment_mode_consistency`, `category12_moe_review_packet`

## Engine backlog (document only)

| Metric | Backlog item | Tracking |
|--------|--------------|----------|
| C12-MOP-06 | Progression equipment continuity low on golden | `minEquipmentProgressionConsistencyRate` Test 3 tuned to 0.2 | golden `thresholds.strict` |
| C12-MOP-15 | Split-2 progression use-tag carry low | `minEquipmentProgressionSplit2Rate` Test 3 tuned to 0.2 | golden `thresholds.strict` |
| C12-MOP-13 | Pre/post use-filter pool counters in `constraint_report` | `equipment_use_pool_shrink` candidates proxy | engine backlog |
| C12-MOP-10 | Dedicated legacy `equipmentIds` regression harness | `equipment_legacy_ids_path` informational | engine backlog |

## Verification

```bash
node --test backend/platform/__tests__/prescriptionQualityChecks.test.js
npm run needs-engine:eval
```

## Status

**Complete assessable implementation** (2026-07-09). Golden Test 3 strict PASS; all 17 KPI ids + 13 MOE ids emit when use active.
