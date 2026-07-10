# Category 7 — Progression lane validity — MOE rubric

Manual Measures of Effectiveness for Category 7. Blocking MOP/MOR checks run in strict eval; MOE items use automated proxies and/or coach review artifacts.

## When to use

After `npm run needs-engine:eval` passes blocking lane checks:

```bash
npm run needs-engine:eval
node scripts/evaluate-prescription-quality.mjs --moe-export docs/cat7-moe-packet.json
```

Review `category7_moe_pair_review_packet` pairs and log manual scores with prefix `moe:cat7` in eval notes.

## C7-MOE-01 — Coach recognizes “next step”

| Field | Value |
|-------|--------|
| Scale | % pairs approved |
| Pass | ≥ 85% |
| Automated artifact | `category7_moe_pair_review_packet` (`--moe-export`) |
| Proxy | `category7_moe_lane_integrity` = 100% |

**Prompt:** Does each progression feel like a logical next step in the same movement lane?

## C7-MOE-02 — Same coaching cue lane

| Field | Value |
|-------|--------|
| Scale | % pairs with same setup pattern |
| Pass | ≥ 90% |
| Blocking proxy | `progression_lane_cue_lane_proxy` (pattern-method ≥ 90% when primary has pattern) |
| Signal | `progression_lane_match_method` |

## C7-MOE-03 — No random hard exercise

| Field | Value |
|-------|--------|
| Pass | 0 unrelated progressions |
| Blocking proxy | `progression_lane_spam_guard` (lane + forbidden names/slugs) |

## C7-MOE-04 — Youth-appropriate progression

| Field | Value |
|-------|--------|
| Pass | 0 flags for 11–14 athletes |
| Blocking proxy | `progression_youth_age_fit` (`recommended_age_min` vs session `ageMax`) |
| Manual | Coach flags adult-only skills not captured in difficulty metadata |

## C7-MOE-05 — Equipment continuity

| Field | Value |
|-------|--------|
| Pass | ≥ 95% |
| Blocking check | `progression_equipment_continuity` |

## C7-MOE-06 — Lane stability (lagging)

| Field | Value |
|-------|--------|
| Pass | ≥ 80% stable pairs over 5 eval runs |
| Artifact | `docs/NEEDS_ENGINE_QUALITY_HISTORY.jsonl` (appended each eval) |
| Check | `progression_lane_stability` (informational until ≥5 runs) |

## Automated signals summary

| check_id | Metric | Role |
|----------|--------|------|
| `progression_lane_match_method` | C7-MOP-05 | Informational |
| `progression_graph_edge_rate` | C7-MOP-07 | Blocking |
| `progression_methodology_mismatch` | C7-MOP-10 | Blocking |
| `category7_moe_lane_integrity` | C7-KPI-01 factor | Informational |

## Recording

Log manual MOE scores alongside automated checks for regression triage:

```
moe:cat7 | C7-MOE-01=0.90 | C7-MOE-04=pass | strict PASS
```
