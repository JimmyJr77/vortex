# Needs Engine Eval Verdict

Structured verdict model for prescription quality evaluation (Plan 5).

## Status values

| Status | Meaning |
|--------|---------|
| `PASS` | All P0/P1 hard requirements pass via hard-gate-eligible checks |
| `REPAIRABLE_FAIL` | Hard violations with structured `repair_plan` |
| `UNSATISFIABLE` | Contradictory or unmeetable requirements (preflight) |
| `SYSTEM_FAIL` | Metrics schema, unsatisfied mapping, stale output, parse errors |

## Hard-gate rule

A PASS may not depend on partial, manual, TBD, no, yes(info), yes(TBD stub), missing-app, or KPI-only metrics.

## Example PASS (truncated)

```json
{
  "status": "PASS",
  "pass": true,
  "attempt": 1,
  "input_hash": "a1b2c3d4e5f67890",
  "output_hash": "f0e1d2c3b4a59687",
  "evaluator_version": "1.0.0",
  "evaluated_after_last_repair": true,
  "blocking_failures": [],
  "advisory_findings": [],
  "passed_requirements": ["REQ-001", "REQ-002", "REQ-003"],
  "requirement_trace": [
    {
      "requirement_id": "REQ-001",
      "field": "durationMinutes",
      "priority": "P0",
      "hard_gate": true,
      "status": "pass",
      "mapped_checks": ["phase_plan_minute_sum_mos", "session_minutes_sum"],
      "eligible_checks": ["phase_plan_minute_sum_mos", "session_minutes_sum", "phase_minutes_exact"],
      "failed_checks": [],
      "evidence_paths": ["body.durationMinutes"],
      "source": "user"
    }
  ],
  "locked_paths": ["body.phasePlan", "result.blocks"],
  "repair_plan": null
}
```

## Example REPAIRABLE_FAIL (truncated)

```json
{
  "status": "REPAIRABLE_FAIL",
  "pass": false,
  "attempt": 1,
  "blocking_failures": [
    {
      "requirement_id": "REQ-008",
      "severity": "P0",
      "check_id": "prescription_equipment_avoid_clean",
      "message": "Barbell primary violates equipment avoid",
      "evidence_path": "result.blocks",
      "repair_action": {
        "type": "replace_exercise",
        "phase_key": "capacity",
        "item_path": "blocks[3].items[0]",
        "preserve_minutes": true,
        "preserve_phase_intent": true,
        "constraints": { "check_id": "prescription_equipment_avoid_clean" }
      }
    }
  ],
  "repair_plan": [
    {
      "type": "replace_exercise",
      "phase_key": "capacity",
      "preserve_minutes": true,
      "preserve_phase_intent": true
    }
  ]
}
```

## Example UNSATISFIABLE (truncated)

```json
{
  "status": "UNSATISFIABLE",
  "pass": false,
  "attempt": 0,
  "blocking_failures": [
    {
      "check_id": "equipment_use_avoid_overlap",
      "message": "equipmentUseIds and equipmentAvoidIds overlap: 3",
      "evidence_path": "body.equipmentUseIds"
    }
  ],
  "suggested_relaxations": [
    {
      "field": "equipmentAvoidIds",
      "suggestion": "Remove overlapping IDs from avoid list: 3"
    }
  ]
}
```

## CLI usage

```bash
# Legacy flat checks + verdict in JSON
npm run needs-engine:eval -- --json

# Full repair loop (max 3 attempts)
npm run needs-engine:eval -- --json --repair-loop
```

Exit codes: `0` PASS, `1` REPAIRABLE_FAIL, `2` SYSTEM_FAIL/setup, `3` UNSATISFIABLE.

## Modules

- `backend/platform/requirementsContract.js` — compile prescribe body → requirements
- `backend/platform/checkMappingRegistry.js` — requirement → check_id map
- `backend/platform/hardGateEligibility.js` — eligible metric filter
- `backend/platform/evaluatorVerdict.js` — verdict builder
- `backend/platform/preflightSatisfiability.js` — pre-generation checks
- `backend/platform/prescriptionRepairLoop.js` — bounded repair orchestrator
