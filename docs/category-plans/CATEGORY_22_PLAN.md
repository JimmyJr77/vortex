# Category 22 — Hard feasibility — Implementation Plan

Full prerequisite → assessment matrix (2026-07-09). Scoped to Category 22 only.

## Executive summary

| Bucket | Count | Notes |
|--------|-------|-------|
| **Blocking MOP/MOR (P0)** | 4 | `feasibility_prescribe_success`, `feasibility_output_nonempty`, no 422 errors |
| **Blocking MOP/MOS/MOR** | 8 | Blocks, phases, constraint_report, critical phases, requirements parse |
| **Informational MOP** | 11 | 422 payload contracts, engine order, eval infra, exit code taxonomy |
| **Informational MOE** | 7 | Golden stability (lagging), DB precedence, production parity TBD |
| **Manual MOE** | 3 | C22-MOE-01, 02, 05 → `category22_moe_review_packet` + rubric |
| **Synthetic KPI** | 1 | `category22_kpi` over `CATEGORY22_KPI_CHECK_IDS` (12 ids, minRate 1.0) |

**Assessment readiness:** All 32 metrics assessable; golden Test 3 strict **PASS**.

## Prerequisite → assessment matrix (32 metrics)

| ID | Metric | Prerequisites | In app? | check_id | Evaluable? |
|----|--------|---------------|---------|----------|------------|
| C22-MOP-01 | HTTP success | prescribe result with `blocks[]` | yes | `feasibility_prescribe_success` | yes |
| C22-MOP-02 | No 422 unsatisfiable equipment | success path (no throw) | yes | `feasibility_no_unsatisfiable_equipment` | yes |
| C22-MOP-03 | No 422 violates equipment avoid | success path | yes | `feasibility_no_equipment_avoid_violation` | yes |
| C22-MOP-04 | No 500 prescription crash | eval completes | yes | `feasibility_no_crash` | yes |
| C22-MOP-05 | Blocks array non-empty | `blocks[]`, `phase_count_match` | yes | `all_blocks_nonempty`, `phase_count_match` | yes |
| C22-MOP-06 | Constraint report present | `result.constraint_report` | yes | `constraint_report_present` | yes |
| C22-MOP-07 | Unsatisfiable equipment payload | PrescriptionError + coachPortalRoutes | yes | `feasibility_unsatisfiable_equipment_payload` | yes (info) |
| C22-MOP-08 | Avoid violation payload | PrescriptionError details | yes | `feasibility_avoid_violation_payload` | yes (info) |
| C22-MOP-09 | Evaluator hard pass | strict eval `ok === true` | yes | `category22_kpi` | yes |
| C22-MOP-10 | DB connectivity | `resolveDatabaseUrl`, prescribe completes | yes | `feasibility_db_connectivity` | yes |
| C22-MOP-11 | Golden scenario load | `golden-prescription-scenario.json` | yes | `feasibility_golden_scenario_loaded` | yes |
| C22-MOP-12 | Eval exit code taxonomy | eval script 0/1/2 | yes | `feasibility_eval_exit_code` | yes (info) |
| C22-MOP-13 | Facility ID resolution | scenario `facilityQuery` | yes | `feasibility_facility_id_resolved` | yes |
| C22-MOP-14 | Use-equipment check timing | post-fill throw site | yes | `feasibility_engine_post_fill_order` | yes (info) |
| C22-MOP-15 | Avoid audit timing | post-build `auditPrescriptionEquipmentAvoid` | yes | `feasibility_engine_post_fill_order` | yes (info) |
| C22-MOP-16 | No partial blocks on 422 | API contract | yes | `feasibility_422_no_partial_blocks` | yes (info) |
| C22-MOP-17 | PrescriptionError code registry | `PRESCRIPTION_ERROR_CODES` | yes | `prescription_error_codes_registered` | yes |
| C22-MOP-18 | Saved requirements row fallback | eval `requirementsSource` | yes | `feasibility_requirements_source` | yes (info) |
| C22-MOP-19 | Constraint report with warnings | 200 + warnings path | yes | `feasibility_constraint_report_with_warnings` | yes |
| C22-MOS-01 | Requirements JSON parseable | `phasePlan`, `durationMinutes` | yes | `feasibility_requirements_parseable` | yes |
| C22-MOS-02 | Equipment Use IDs exist | `equipmentKeyById` | yes | `feasibility_equipment_use_ids_resolvable` | yes |
| C22-MOS-03 | Equipment Avoid IDs exist | expanded avoid context | yes | `feasibility_equipment_avoid_ids_resolvable` | yes |
| C22-MOR-01 | False success empty Output | Output `items.length` | yes | `feasibility_output_nonempty` | yes |
| C22-MOR-02 | Stale DATABASE_URL | `resolveDatabaseUrl` precedence | yes | `feasibility_db_url_precedence` | yes (info) |
| C22-MOR-03 | Production deploy drift | Render buildId | yes | `feasibility_production_parity` | partial (TBD) |
| C22-MOE-01 | Requirements satisfiable | coach/content audit | yes | `category22_moe_review_packet` | partial (manual) |
| C22-MOE-02 | Failure messages coach-readable | fault injection | yes | `category22_moe_failure_readability` | partial (manual) |
| C22-MOE-03 | No silent partial failure | critical phase items | yes | `feasibility_critical_phases_filled` | yes |
| C22-MOE-04 | Production parity | Render/local eval | yes | `feasibility_production_parity` | partial (TBD) |
| C22-MOE-05 | Engineer MTTR on prescribe fail | fault injection | yes | `category22_moe_mttr` | partial (manual) |
| C22-MOE-06 | Golden always satisfiable (lagging) | eval history `ok` streak | yes | `feasibility_golden_stability` | yes (info) |
| C22-KPI-01 | Hard feasibility index | blocking pass rate | yes | `category22_kpi` | yes |

## KPI check ids (12 blocking)

`feasibility_prescribe_success`, `feasibility_no_unsatisfiable_equipment`, `feasibility_no_equipment_avoid_violation`, `all_blocks_nonempty`, `no_empty_phases`, `phase_count_match`, `session_minutes_sum`, `constraint_report_present`, `feasibility_output_nonempty`, `feasibility_critical_phases_filled`, `prescription_error_codes_registered`, `feasibility_requirements_parseable`

## MOE check ids (12 informational / manual)

`category22_moe_review_packet`, `category22_moe_failure_readability`, `category22_moe_mttr`, `feasibility_golden_stability`, `feasibility_production_parity`, `feasibility_unsatisfiable_equipment_payload`, `feasibility_avoid_violation_payload`, `feasibility_422_no_partial_blocks`, `feasibility_engine_post_fill_order`, `feasibility_db_url_precedence`, `feasibility_requirements_source`, `feasibility_constraint_report_with_warnings`

## Verification

```bash
node --test backend/platform/__tests__/prescriptionQualityChecks.test.js
npm run needs-engine:eval
```

## Status

**Complete assessable implementation** (2026-07-09). Golden Test 3 strict PASS; all 12 KPI ids + 12 MOE ids emit when `expectedBody` set.
