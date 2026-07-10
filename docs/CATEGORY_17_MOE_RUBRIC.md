# Category 17 — Youth & safety gates — MOE rubric

Manual Measures of Effectiveness for Category 17. Automated MOP/MOR checks run in strict eval; these MOE items require coach review.

## When to use

After `npm run needs-engine:eval` passes blocking checks, a coach reviews the prescription for an **8–14 age-band session** (Test 3: ages 8–14, INTERMEDIATE skill).

## C17-MOE-01 — Parent/coach safety confidence

| Field | Value |
|-------|--------|
| Scale | Binary pass/fail |
| Pass | Coach would run session without safety edits for 8–14 |
| Reviewer | Coach familiar with youth programming |

**Prompt:** Would you run this session as prescribed for an 8–14 group without removing or swapping drills for safety?

## C17-MOE-02 — No adult-only skills surfaced

| Field | Value |
|-------|--------|
| Scale | Count of flagged exercises |
| Pass | 0 exercises requiring mature shoulder/wrist capacity |
| Context | Review packet item list |

**Prompt:** Are any prescribed drills clearly adult-only (heavy overhead loading, long unsupported handstand work, etc.)?

## C17-MOE-04 — Fatigue appropriate for youth 120-min

| Field | Value |
|-------|--------|
| Scale | Likert 1–5 |
| Pass | ≥ 4/5 — volume not reckless for 8–14 |
| Context | Block minutes from prescription |

**Prompt:** For a 120-minute youth session, is the high-intent volume (Output + Capacity + Resilience + Sustained) appropriate?

## C17-MOE-05 — Inversions policy clarity

| Field | Value |
|-------|--------|
| Scale | Binary pass/fail |
| Pass | Documented exceptions (wall-facing hold in Resilience) match coach expectation |
| Context | `youth_resilience_wall_handstand` check result |

**Prompt:** If any wall-handstand work appears in Resilience, does it match your facility's youth inversion policy?

## C17-MOE-07 — Split 1 coachable without regressions

| Field | Value |
|-------|--------|
| Scale | Binary pass/fail |
| Pass | Coach can run Split 1 track with scaling notes only (no wholesale swaps) |
| Context | `split1_cap_adherence`, `youth_scaling_guidance_rate` |

**Prompt:** Can you coach the younger split (8–10) using per_split scaling notes without replacing most primaries?

## C17-MOE-08 — Attention demand matches supervision

| Field | Value |
|-------|--------|
| Scale | Likert 1–5 |
| Pass | ≥ 4/5 — MI complexity fits typical 8–14 supervision ratio |
| Context | MI items in review packet with attention_demand values |

**Prompt:** Does Movement Intelligence complexity match what you can supervise with your typical coach:athlete ratio?

## Automated signals (non-blocking)

| check_id | Metric | Notes |
|----------|--------|-------|
| `mi_no_handstand_youth` | C17-MOP-01, C17-MOR-01 | 0 handstand/inversion in MI when ageMax < 15 |
| `youth_mi_pool_filter` | C17-MOP-02 | Engine pool filter proof via 0 MI inversions |
| `mi_attention_demand_ceiling` | C17-MOP-05 | MI attention_demand < 8 for ageMax ≤ 14 |
| `youth_prepare_mi_impact_ceiling` | C17-MOP-11 | Prepare/MI impact_level < 3 |
| `youth_mi_load_ceiling` | C17-MOP-15 | MI load < 6 for ageMax ≤ 14 |
| `youth_sport_context_multiplier` | C17-MOP-12 | No inversion boost under fitness sportKey |
| `youth_contraindication_rate` | C17-MOP-14, C17-MOE-06 | ≥ 70% technical ≥ 6 items have contraindications |
| `youth_scaling_guidance_rate` | C17-MOE-03 | ≥ 80% challenging items have scaling_guidance |
| `youth_mi_neural_methodology` | C17-MOP-09 | MI neural tag count (target 0; informational) |
| `youth_split1_output_plyo_density` | C17-MOP-22 | Split 1 Output plyo density (target ≤ 3; informational) |
| `category17_moe_review_packet` | C17-MOE-01, 02, 04, 05, 07, 08 | Youth context + item list for coach rubric |

## Recording

Log reviewer id, date, session requirements id, and scores. Prefix manual notes `moe:cat17`.
