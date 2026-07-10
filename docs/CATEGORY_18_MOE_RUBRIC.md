# Category 18 — Stretch & over-cap primaries — MOE rubric

Manual Measures of Effectiveness for Category 18. Blocking MOP/MOR checks run in strict eval; MOE items use automated proxies and/or coach review artifacts.

## When to use

After `npm run needs-engine:eval` passes blocking stretch/over-cap checks:

```bash
npm run needs-engine:eval
```

Review `category18_moe_review_packet` items and log manual scores with prefix `moe:cat18` in eval notes.

## C18-MOE-01 — Coach does not need to swap stretch items

| Field | Value |
|-------|--------|
| Pass | ≥ 95% primaries kept without difficulty downgrade |
| Artifact | `category18_moe_review_packet` items + `age_fit` |
| Proxy | `no_stretch_phase_good_fit_rate` ≥ 95% |

**Prompt:** Would you run this session without swapping stretch-tagged primaries for easier variants?

## C18-MOE-02 — Stretch badges trustworthy

| Field | Value |
|-------|--------|
| Pass | ≥ 90% coach agreement with UI stretch labels |
| Check | `category18_moe_stretch_badges_proxy` (informational) |
| Artifact | `age_fit` per item vs coach judgment |

## C18-MOE-03 — Split 1 not assigned over-cap work

| Field | Value |
|-------|--------|
| Pass | Binary — younger split completes with scaling notes only |
| Check | `category18_moe_split1_overcap_proxy` (informational) |
| Proxy | `per_split_over_cap_count` === 0, `split1_cap_adherence` (Cat 5) |

## C18-MOE-04 — Strict bar protects session flow

| Field | Value |
|-------|--------|
| Pass | 0 coach cap stops mid-session in Output/Capacity |
| Artifact | `category18_moe_review_packet` stretch_summary |
| Proxy | `stretch_high_intent_mor`, `engine_no_stretch_over_cap_admitted` |

## C18-MOE-05 — Caps feel consistent session-wide

| Field | Value |
|-------|--------|
| Scale | Likert 1–5 |
| Pass | ≥ 4/5 |
| Check | `category18_moe_cap_consistency_proxy` (informational) |

**Prompt:** Does difficulty progression feel logical across phases for each split?

## C18-MOE-06 — Split-good path transparent

| Field | Value |
|-------|--------|
| Pass | Binary when split-good path used — coach understands scaling notes |
| Artifact | `scaling_guidance` in review packet |
| Proxy | `primary_age_fit_split_good_path` |

## C18-MOR-03 — Warning flakiness (lagging)

| Field | Value |
|-------|--------|
| Pass | `split_variant_warnings` count ≤ 2 in at least 3/5 eval runs |
| Artifact | `docs/NEEDS_ENGINE_QUALITY_HISTORY.jsonl` (`split_variant_warning_count`) |
| Check | `stretch_variant_warning_stability` (informational until ≥5 runs) |

## Automated signals summary

| check_id | Metric | Role |
|----------|--------|------|
| `stretch_high_intent_mor` | C18-MOR-01 | Blocking (P0) |
| `category18_moe_stretch_badges_proxy` | C18-MOE-02 | Informational |
| `category18_moe_split1_overcap_proxy` | C18-MOE-03 | Informational |
| `category18_moe_cap_consistency_proxy` | C18-MOE-05 | Informational |
| `stretch_variant_warning_stability` | C18-MOR-03 | Informational |
| `category18_kpi` | C18-KPI-01 | Blocking composite |

## Recording

```
moe:cat18 | C18-MOE-01=pass | C18-MOE-05=4.5 | strict PASS
```
