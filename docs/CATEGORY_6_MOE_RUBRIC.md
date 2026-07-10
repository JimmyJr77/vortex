# Category 6 — Split progressions — MOE rubric

Manual Measures of Effectiveness for Category 6. Automated MOP/MOR checks run in strict eval; these MOE items require coach review or remain informational until engine telemetry meets pass bands.

## When to use

After `npm run needs-engine:eval` passes blocking checks, review progression assignments on the **highest-cap audience split** in context of the full prescribe body (age splits, caps, session objective).

## C6-MOE-01 — Progressions intentional, not filler

| Field | Value |
|-------|--------|
| Scale | % of progression pairs adding clear value |
| Pass | ≥ 80% |
| Reviewer | Coach familiar with older-split athletes |

**Prompt:** For each highest-cap split progression, does the progression exercise meaningfully increase challenge vs the primary (not a random harder exercise)?

## C6-MOE-05 — Athlete-executable progressions

| Field | Value |
|-------|--------|
| Scale | Binary pass/fail per progression |
| Pass | Coach can regress each progression in-session without new equipment |
| Context | Same session equipment and time budget |

**Prompt:** Could every assigned progression be safely attempted or regressed on the floor today?

## Automated signals (non-blocking)

Use alongside manual scores:

| check_id | Metric | Pass band |
|----------|--------|-----------|
| `progression_eligibility_rate` | C6-MOP-06 | Informational — eligible primaries / progression-phase items |
| `progression_coverage_output` | C6-MOP-07 | ≥ 60% when `pool_size ≥ 5` (informational on golden until engine gap closed) |
| `progression_coverage_capacity` | C6-MOP-07 | ≥ 60% when `pool_size ≥ 5` |
| `progression_eligible_unassigned_output` | C6-MOR-02 | ≤ 20% eligible miss when `pool_size ≥ 3` |
| `progression_eligible_unassigned_capacity` | C6-MOR-02 | ≤ 20% eligible miss |
| `category6_moe_progression_yield` | C6-KPI-01 factor | Session coverage ≥ 60% informational band |
| `category6_moe_split2_policy` | C6-MOE-03 | Split-2 progressions > 0; younger split = 0 |
| `category6_moe_progression_arc` | C6-MOE-02 | 0 progressions outside Output/Capacity/Resilience |
| `category6_moe_pool_reject_signal` | C6-MOE-04 | `split_rejects` from `constraint_report.phase_fill` |

## TBD (builder telemetry)

| Metric | Notes |
|--------|-------|
| C6-MOE-06 | `category6_tbd_builder_edits` — coach replaces progression before send-to-builder |

## Recording

Log manual MOE scores in eval history or coach QA sheet; reference automated `category6_moe_*` checks for regression triage.
