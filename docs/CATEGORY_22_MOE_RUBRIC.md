# Category 22 — Hard feasibility — MOE rubric

Manual Measures of Effectiveness for Category 22. Automated MOP/MOR checks run in strict eval; these MOE items require coach or engineer review.

## When to use

After `npm run needs-engine:eval` passes blocking checks, review the prescription and requirements for **hard feasibility** — whether the session can actually be run with the facility library and constraints.

Export context from `category22_moe_review_packet` (block summary, constraint_report keys, requirements source).

## C22-MOE-01 — Requirements satisfiable in principle

| Field | Value |
|-------|--------|
| Scale | Binary pass/fail |
| Pass | Test 3 constraints (equipment avoid, age caps, phase plan) are feasible for the facility library |
| Reviewer | Coach familiar with facility equipment and class format |

**Prompt:** Given the requirements snapshot, could this session be prescribed without relaxing equipment avoid, age caps, or phase minutes?

## C22-MOE-02 — Failure messages coach-readable

| Field | Value |
|-------|--------|
| Scale | Likert 1–5 (pass ≥ 4/5) |
| Pass | Forced 422 scenarios explain what to relax (equipment use, avoid violation) |
| Context | Fault injection: impossible `equipmentUseIds` or conflicting avoid |

**Prompt:** If prescribe fails with 422, does the error message tell you exactly which equipment or constraint to change?

## C22-MOE-05 — Engineer MTTR on prescribe fail

| Field | Value |
|-------|--------|
| Scale | Minutes to diagnose from 422 payload |
| Pass | ≤ 5 min mean time to identify root cause |
| Context | `details.unsatisfiable_equipment` or `details.violations` |

**Prompt:** From the 422 JSON alone, how long until you know whether to fix requirements vs library vs engine bug?

## Automated signals (non-blocking)

| check_id | Metric | Notes |
|----------|--------|-------|
| `feasibility_prescribe_success` | C22-MOP-01 | Success path proxy |
| `feasibility_output_nonempty` | C22-MOR-01 | No false success with empty Output |
| `feasibility_critical_phases_filled` | C22-MOE-03 | Output/Capacity/Resilience all have items |
| `feasibility_golden_stability` | C22-MOE-06 | 5/5 eval `ok` streak from history JSONL |
| `feasibility_unsatisfiable_equipment_payload` | C22-MOP-07 | Documented 422 shape |
| `feasibility_avoid_violation_payload` | C22-MOP-08 | Documented 422 shape |
| `feasibility_production_parity` | C22-MOR-03, C22-MOE-04 | TBD — buildId parity pending |
| `category22_moe_review_packet` | C22-MOE-01, 02, 05 | Block summary + error codes for review |

## Recording

Log reviewer id, date, requirements source, and scores. Prefix manual notes `moe:cat22`.
