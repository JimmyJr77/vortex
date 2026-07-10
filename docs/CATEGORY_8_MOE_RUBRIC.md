# Category 8 — Progression reuse — MOE rubric

Manual Measures of Effectiveness for Category 8. Blocking MOP/MOR checks run in strict eval; MOE items use automated proxies and/or coach review artifacts.

## When to use

After `npm run needs-engine:eval` passes blocking reuse checks:

```bash
npm run needs-engine:eval
node scripts/evaluate-prescription-quality.mjs --moe-export docs/cat8-moe-packet.json
```

Review `category8_moe_variety_review_packet` and `category8_moe_station_clarity_packet`; log manual scores with prefix `moe:cat8` in eval notes.

## C8-MOE-01 — Session variety perception

| Field | Value |
|-------|--------|
| Scale | Likert 1–5 |
| Pass | ≥ 4/5 |
| Automated artifact | `category8_moe_variety_review_packet` |
| Proxy | `progression_diversity_ratio` ≥ 70%; `progression_reuse_session_wide` ≤ 3 |

**Prompt:** Does the session avoid “one progression everywhere” — enough distinct progressions that stations feel varied?

## C8-MOE-02 — Unique pattern per progression slot

| Field | Value |
|-------|--------|
| Pass | ≥ 80% unique patterns in Output progressions |
| Automated check | `progression_unique_pattern_output` (informational) |

## C8-MOE-03 — Justified reuse

| Field | Value |
|-------|--------|
| Pass | Repeated progression only when pattern/family matches all primaries |
| Automated proxy | `progression_justified_reuse_proxy` |
| Related blocking | `progression_unrelated_pattern_reuse` |

## C8-MOE-04 — Athlete confusion risk

| Field | Value |
|-------|--------|
| Pass | Binary — coach can distinguish station instructions |
| Automated artifact | `category8_moe_station_clarity_packet` (scaling_guidance + names) |

## C8-MOE-05 — Reuse stability (lagging)

| Field | Value |
|-------|--------|
| Pass | ≥ 80% identical progression id multiset over 5 eval runs |
| Artifact | `docs/NEEDS_ENGINE_QUALITY_HISTORY.jsonl` (`cat8ProgressionIds`) |
| Check | `progression_reuse_stability` (informational until ≥5 runs) |

## Informational engine backlog (non-blocking)

| check_id | Metric | Notes |
|----------|--------|-------|
| `progression_primary_as_progression` | C8-MOP-08 | Session-wide primary→progression cross-use; promote when engine reservedIds tightened |
| `progression_reuse_pattern_per_phase` | C8-MOP-05 | Multiple Output primaries sharing pattern facet; log until pool supports stricter cap |

## Recording

```
moe:cat8 | C8-MOE-01=4 | C8-MOE-04=pass | strict PASS
```
