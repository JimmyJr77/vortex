# Category 13 — Equipment — Avoid — MOE rubric

Manual Measures of Effectiveness for Category 13. Automated MOP/MOR checks run in strict eval; these MOE items require coach review.

## When to use

After `npm run needs-engine:eval` passes blocking checks, a coach reviews the prescription with knowledge of **which equipment was avoided** (`equipmentAvoidIds` / snapshot `equipmentAvoid`).

## C13-MOE-01 — Coach trust in avoid

| Field | Value |
|-------|--------|
| Scale | Binary pass/fail |
| Pass | No surprise box/bar/platform drills when that gear was avoided |
| Reviewer | Coach familiar with facility layout and session intent |

**Prompt:** Would you be surprised by any prescribed drill that clearly requires avoided equipment (plyo box, pull-up bar, etc.)?

## C13-MOE-03 — Semantic avoid credible

| Field | Value |
|-------|--------|
| Scale | % agreement on excluded samples |
| Pass | ≥ 90% of `equipment_avoid.sample_names` clearly require avoided gear |
| Context | Review packet sample list |

**Prompt:** For each excluded exercise name in the report, does it obviously need the avoided equipment?

## C13-MOE-05 — Facility layout trust

| Field | Value |
|-------|--------|
| Scale | Binary pass/fail |
| Pass | No drills requiring avoided plyo-box setup when box avoided |
| Context | Box avoid id 3 (Test 3 regression instance) |

**Prompt:** Can this session run without setting up avoided equipment stations?

## C13-MOE-06 — Avoid rationale explainable

| Field | Value |
|-------|--------|
| Scale | % agreement on samples |
| Pass | ≥ 80% — coach can name why each excluded sample required avoided gear |
| Context | `category13_moe_review_packet` sample_names |

**Prompt:** Without looking at tags, can you explain why each listed exclusion belongs on the avoid list?

## Automated signals (non-blocking)

| check_id | Metric | Notes |
|----------|--------|-------|
| `prescription_equipment_avoid_clean` | C13-MOP-01, C13-MOR-01 | Full prescription audit — 0 violations |
| `restore_not_box_avoid_false_positive` | C13-MOP-05, C13-MOR-02 | Box Breathing not in avoid samples |
| `semantic_avoid_false_negative` | C13-MOR-03 | Prescribed slug/name matches avoid patterns |
| `category13_moe_breathing_available` | C13-MOE-02 | ≥ 1 breathing drill in Restore when box avoided |
| `category13_moe_pattern_diversity` | C13-MOE-04 | Distinct movement patterns in prescribed set |
| `equipment_avoid_semantic_precision` | C13-MOP-18 | Sample whitelist false-positive proxy |
| `category13_moe_review_packet` | C13-MOE-01, 03, 05, 06 | Avoid context + samples for coach rubric |

## Recording

Log reviewer id, date, session requirements id, and scores. Prefix manual notes `moe:cat13`.
