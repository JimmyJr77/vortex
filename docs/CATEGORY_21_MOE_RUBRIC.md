# Category 21 — Warnings cleanliness — MOE rubric

Manual Measures of Effectiveness for Category 21. Blocking MOP/MOR checks run in strict eval; MOE items use automated proxies and/or coach review artifacts.

## When to use

After `npm run needs-engine:eval` passes blocking warning checks:

```bash
npm run needs-engine:eval
node scripts/evaluate-prescription-quality.mjs --moe-export docs/cat21-moe-packet.json
```

Review `category21_moe_review_packet` items and log manual scores with prefix `moe:cat21` in eval notes.

## C21-MOE-01 — Coach ignores warnings safely

| Field | Value |
|-------|--------|
| Pass | Binary — coach can run session without heeding warnings when counts = 0 |
| Automated artifact | `category21_moe_review_packet` |
| Proxy | `session_age_fit_warnings`, `split_variant_warnings` both pass |

**Prompt:** With zero warnings on Test 3, would you run this session without extra coach prep?

## C21-MOE-02 — Warnings actionable

| Field | Value |
|-------|--------|
| Pass | ≥ 90% of warning strings imply clear scaling or swap |
| Artifact | `category21_moe_review_packet` warning texts + taxonomy |
| Proxy | `warnings_taxonomy_complete`, `warnings_scaled_guidance_complete` |

## C21-MOE-03 — UI warning noise acceptable

| Field | Value |
|-------|--------|
| Scale | Likert 1–5 |
| Pass | ≥ 4/5 |
| Artifact | `category21_moe_ui_truncation_policy`, NeedsEnginePanel audience_notes / watch_points |
| Proxy | ≤5 age-fit + ≤5 split warnings surfaced |

## C21-MOE-04 — No warning flakiness (lagging)

| Field | Value |
|-------|--------|
| Pass | `(age_fit_count, split_count)` pair identical 5/5 eval runs |
| Artifact | `docs/NEEDS_ENGINE_QUALITY_HISTORY.jsonl` |
| Check | `category21_moe_warning_stability` (informational until ≥5 runs) |

## C21-MOE-05 — Athlete-facing clarity

| Field | Value |
|-------|--------|
| Pass | ≥ 80% of warned scaled variants have athlete-usable `scaling_guidance` |
| Check | `category21_moe_scaling_guidance_coverage` (informational) |

## C21-MOE-06 — Warning-free strict streak

| Field | Value |
|-------|--------|
| Pass | 0 age-fit + ≤1 split warnings in 5/5 consecutive strict passes |
| Check | `category21_moe_warning_clean_streak` (informational until ≥5 passes) |

## C21-MOE-07 — False-positive trust

| Field | Value |
|-------|--------|
| Pass | ≥ 90% coach agreement when warnings present |
| Artifact | `category21_moe_review_packet` + parser taxonomy |
| Proxy | `age_fit_false_session_cap_warnings` = 0 |

## Automated signals summary

| check_id | Metric | Role |
|----------|--------|------|
| `category21_moe_warning_stability` | C21-MOE-04 | Informational |
| `category21_moe_warning_clean_streak` | C21-MOE-06 | Informational |
| `category21_moe_scaling_guidance_coverage` | C21-MOE-05 | Informational |
| `category21_moe_ui_truncation_policy` | C21-MOP-18 | Informational |
| `category21_moe_watch_points_parity` | C21-MOP-19 | Informational |
| `category21_moe_review_packet` | C21-MOE-01–03, 07 | Manual review |
| `category21_kpi` | C21-KPI-01 | Blocking composite |

## Recording

Log manual MOE outcomes in coach review notes or append to eval history with `moe:cat21:<metric-id>:<score>`.
