# Category 12 — Equipment — Use — MOE rubric

Manual Measures of Effectiveness for Category 12. Automated MOP/MOR checks run in strict eval; these MOE items require coach review.

## When to use

After `npm run needs-engine:eval` passes blocking checks, a coach reviews equipment use across the **full prescribed session** with the facility inventory implied by `equipmentUseIds`.

## C12-MOE-01 — Coach can run session with listed gear only

| Field | Value |
|-------|--------|
| Scale | Binary pass/fail |
| Pass | Yes — no off-list implements required beyond bodyweight |
| Reviewer | Coach familiar with facility inventory |

**Prompt:** Could you run this session with only the listed equipment (kettlebell, jump rope, cones) plus bodyweight options?

**Automated signal:** `category12_moe_gear_visible`, `equipment_use_coverage`

## C12-MOE-03 — Setup friction acceptable

| Field | Value |
|-------|--------|
| Scale | Likert 1–5 |
| Pass | ≥ 4 |
| Context | Transitions between kettlebell, jump rope, and cones across blocks |

**Prompt:** Are gear transitions between blocks manageable without losing flow?

**Automated signal:** `category12_moe_setup_friction`, `category12_moe_gear_rotation`

## C12-MOE-06 — Youth equipment safety (ages 8–10)

| Field | Value |
|-------|--------|
| Scale | Binary pass/fail |
| Pass | Yes — no inappropriate load implements for Split 1 |
| Context | Split 1 kettlebell stations and scaling notes |

**Prompt:** Would you keep all Split 1 kettlebell work as written for 8–10 year olds?

**Automated signal:** `category12_moe_youth_safety`

## C12-MOE-07 — Gear rotation minimizes queue time

| Field | Value |
|-------|--------|
| Scale | Likert 1–5 |
| Pass | ≥ 4 |
| Context | ≤ 2 major equipment changes per 10-minute block |

**Prompt:** Does equipment rotation avoid long queues or chaotic setup between stations?

**Automated signal:** `category12_moe_gear_rotation`

## Automated informational MOE (non-blocking)

| check_id | Metric | Notes |
|----------|--------|-------|
| `category12_moe_purposeful_use` | C12-MOE-02 | ≥2 drills per required key |
| `category12_moe_facility_parity` | C12-MOE-04 | Prescribed use IDs echo body |
| `category12_moe_phase_intent` | C12-MOE-05 | ≥2 keys in Output/Capacity/Sustained/MI |
| `category12_moe_review_packet` | C12-MOE-01, 03, 06, 07 | Gear-by-phase packet for coach rubric |

## Recording

Log reviewer id, date, session requirements id, and scores. Use `category12_moe_review_packet` detail (`gear_by_phase`) as the review worksheet.
