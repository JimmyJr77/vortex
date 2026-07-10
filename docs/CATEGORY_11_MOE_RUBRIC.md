# Category 11 — Difficulty cap utilization — MOE rubric

Manual Measures of Effectiveness for Category 11. Blocking MOP/MOR checks run in strict eval; MOE items use automated proxies and/or coach review artifacts.

## When to use

After `npm run needs-engine:eval` passes blocking cap-utilization checks, review `category11_moe_review_packet` in eval JSON for session cap, pool cap, and per-phase utilization context.

## C11-MOE-01 — Session uses allowed headroom

| Field | Value |
|-------|--------|
| Scale | Likert 1–5 |
| Pass | ≥ 4 |
| Automated artifact | `category11_moe_session_headroom`, `category11_moe_review_packet` |
| Proxy | `session_mean_d_utilization` ok_band ≥ 70% |

**Prompt:** Does the session feel like it uses the allowed difficulty budget without reckless overload for the youngest athletes?

## C11-MOE-06 — Athlete RPE matches cap design

| Field | Value |
|-------|--------|
| Scale | Field RPE 6–8 on Split 2 progressions |
| Pass | ≥ 80% stations in band |
| Automated artifact | `category11_moe_field_rpe` (manual checklist) |
| Proxy | `progression_cap_utilization` ok_band ≥ 75% |

**Prompt:** On Split 2 progressions, do athletes report RPE 6–8 (challenged but repeatable)?

## C11-MOE-09 — Coach does not downgrade difficulty post-gen (lagging)

| Field | Value |
|-------|--------|
| Pass | Coach raises D as often as lowers D after generation |
| Artifact | Builder edit telemetry — **pending** |
| Check | `category11_moe_builder_edit_signal` (informational until telemetry wired) |

## Automated signals summary

| check_id | Metric | Role |
|----------|--------|------|
| `category11_moe_split2_exploited` | C11-MOE-02 | Informational |
| `category11_moe_output_power_band` | C11-MOE-03 | Informational |
| `category11_moe_no_timid_high_intent` | C11-MOE-04 | Informational |
| `category11_moe_objective_cap_alignment` | C11-MOE-05 | Informational |
| `category11_moe_younger_split_completable` | C11-MOE-07 | Informational |
| `category11_moe_difficulty_arc` | C11-MOE-08 | Informational |
| `cap_utilization_stability` | C11-MOP-18 | Informational (lagging) |

## Recording

Log manual MOE scores alongside automated checks:

```
moe:cat11 | C11-MOE-01=4 | C11-MOE-06=pass | strict PASS
```
