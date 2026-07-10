# Category 10 — Difficulty & age fit — MOE rubric

Manual Measures of Effectiveness for Category 10. Blocking MOP/MOR checks run in strict eval; MOE items use automated proxies and/or coach review artifacts.

## When to use

After `npm run needs-engine:eval` passes blocking age-fit checks:

```bash
npm run needs-engine:eval
node scripts/evaluate-prescription-quality.mjs --moe-export docs/cat10-moe-packet.json
```

Review `category10_moe_review_packet` items and log manual scores with prefix `moe:cat10` in eval notes.

## C10-MOE-01 — Right difficulty whole group

| Field | Value |
|-------|--------|
| Scale | Likert 1–5 |
| Pass | ≥ 4/5 |
| Automated artifact | `category10_moe_review_packet` (`--moe-export`) |
| Proxy | `primary_age_fit_distribution` good ≥ 85% |

**Prompt:** For a mixed 8–14 session, does the prescription feel appropriately challenging for the whole group?

## C10-MOE-02 — Split 1 not overwhelmed

| Field | Value |
|-------|--------|
| Pass | Binary — younger split completes with scaling notes only |
| Artifact | Split 1 `per_split` variants + `scaling_guidance` in review packet |
| Proxy | `split1_cap_adherence`, `youngest_split_gate` |

## C10-MOE-03 — Split 2 challenged

| Field | Value |
|-------|--------|
| Pass | Binary — older split engaged; progressions used |
| Proxy | `split2_cap_adherence`, Cat 6 progression coverage |

## C10-MOE-04 — No stop-session safety

| Field | Value |
|-------|--------|
| Pass | 0 coach pull mid-session |
| Proxy | `mi_attention_demand_ceiling`, `primary_over_cap_count` |

## C10-MOE-05 — UI age_fit badges accurate

| Field | Value |
|-------|--------|
| Pass | ≥ 90% coach agreement |
| Artifact | `category10_moe_review_packet` `age_fit` per item |

## C10-MOE-06 — Difficulty supports speed objective

| Field | Value |
|-------|--------|
| Pass | Output D bands: Split1 4–6, Split2 6–8 |
| Check | `category10_moe_speed_output_bands` (informational) |

## C10-MOE-07 — Warning flakiness (lagging)

| Field | Value |
|-------|--------|
| Pass | `age_fit_warnings` count identical 5/5 eval runs |
| Artifact | `docs/NEEDS_ENGINE_QUALITY_HISTORY.jsonl` (`age_fit_warning_count`) |
| Check | `age_fit_warning_stability` (informational until ≥5 runs) |

## Automated signals summary

| check_id | Metric | Role |
|----------|--------|------|
| `primary_age_fit_mean_score` | C10-MOP-18 | Blocking |
| `category10_moe_speed_output_bands` | C10-MOE-06 | Informational |
| `age_fit_warning_stability` | C10-MOE-07 | Informational |
| `category10_kpi` | C10-KPI-01 | Blocking composite |

## Recording

```
moe:cat10 | C10-MOE-01=4.5 | C10-MOE-02=pass | strict PASS
```
