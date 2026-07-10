# Category 9 — Progression difficulty climb — MOE rubric

Manual Measures of Effectiveness for Category 9. Blocking MOP/MOR checks run in strict eval; MOE items use automated proxies and/or coach review artifacts.

## When to use

After `npm run needs-engine:eval` passes Category 9 blocking checks:

```bash
npm run needs-engine:eval
node scripts/evaluate-prescription-quality.mjs --moe-export=docs/cat9-moe-packet.json
```

Review `category9_moe_climb_review_packet` pairs and log manual scores with prefix `moe:cat9` in eval notes.

## C9-MOE-01 — “One step up” perception

| Field | Value |
|-------|--------|
| Scale | % pairs where delta feels like one step up |
| Pass | ≥ 80% in ideal band 1–3 |
| Automated artifact | `category9_moe_climb_review_packet` |
| Proxy | `progression_delta_distribution_band` ≥ 80% in [1,3] |

**Prompt:** Does each progression feel like a single difficulty step from the primary — not timid, not reckless?

## C9-MOE-02 — Split 2 RPE appropriate

| Field | Value |
|-------|--------|
| Scale | Athletes 11–14 RPE 7–8 on progressions |
| Pass | ≥ 80% stations in band |
| Proxy | `category9_moe_rpe_proxy` (delta band + scaling_guidance) |
| Manual | Field RPE survey instrument — backlog |

## C9-MOE-03 — No safety regressions

| Field | Value |
|-------|--------|
| Pass | Coach would not remove progression for safety |
| Artifact | `category9_moe_climb_review_packet` |
| Blocking related | `progression_unsafe_youth_delta`, `progression_stretch_fit_zero` |

## C9-MOE-04 — Dimension climb matches speed intent

| Field | Value |
|-------|--------|
| Pass | Output progressions raise technical or load dimension |
| Proxy | `category9_moe_speed_dimension_climb` ≥ 80% |

## C9-MOE-05 — Exploits cap 10

| Field | Value |
|-------|--------|
| Pass | ≥ 2 progressions with overall D ≥ 7 |
| Proxy | `category9_moe_cap_exploit` |

## C9-MOE-06 — Climb credible on floor (lagging)

| Field | Value |
|-------|--------|
| Pass | Coach keeps ≥ 90% progressions without downgrade |
| Proxy | `category9_moe_climb_credible` from `progression_no_downgrade` |
| Manual | Builder edit telemetry — backlog |

## Automated signals summary

| check_id | Metric | Role |
|----------|--------|------|
| `progression_delta_floor` | C9-MOP-02 | Informational |
| `progression_technical_climb` | C9-MOP-06 | Informational |
| `progression_cap_proximity` | C9-MOP-08 | Blocking |
| `progression_gap_to_cap` | C9-MOP-10 | Informational |
| `category9_moe_climb_review_packet` | C9-MOE-01/03 | Informational + export |
| `category9_kpi` | C9-KPI-01 | Blocking aggregate + climb index detail |

## Recording

```
moe:cat9 | C9-MOE-01=0.85 | C9-MOE-03=pass | strict PASS
```
