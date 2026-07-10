# Category 23 — Sport & work mode — MOE rubric

Manual Measures of Effectiveness for Category 23. Automated MOP/MOR checks run in strict eval; these MOE items require coach review or lagging eval history.

## When to use

After `npm run needs-engine:eval` passes blocking checks, review the prescription for **fitness GPP + exercise workMode** (Test 3: `sportId: 1`, `workMode: exercise`, `sessionObjective: speed_priority`).

## C23-MOE-01 — Session reads as fitness GPP

| Field | Value |
|-------|--------|
| Scale | Binary pass/fail |
| Pass | Coach: not football/baseball/sport-drill specific for fitness sport |
| Automated proxy | `sport_specific_fitness_zero`, `generic_fitness_output_rate` |

**Prompt:** Would you run this as a general fitness session without swapping sport-specific drills?

## C23-MOE-02 — Speed objective reflected

| Field | Value |
|-------|--------|
| Scale | Binary pass/fail |
| Pass | Output selections bias power/speed (not heavy strength) |
| Automated proxy | `category23_moe_speed_objective` |

**Prompt:** Does the Output block read as speed/power development for `speed_priority`?

## C23-MOE-03 — Work mode matches builder intent

| Field | Value |
|-------|--------|
| Scale | Binary pass/fail |
| Pass | Exercise mode → no skill_drill cleanup needed before send-to-builder |
| Automated proxy | `exercise_kind_purity`, `category23_moe_work_mode_builder` |

**Prompt:** In exercise mode, would you send this prescription to the builder without removing skill drills?

## C23-MOE-04 — Sport context future-proof (TBD)

| Field | Value |
|-------|--------|
| Scale | A/B sport matrix |
| Pass | Switching `sportId` materially changes picks |
| Status | Informational TBD stub — manual A/B runs required |

**Prompt:** When you change sport filter, do primary picks change in a way that matches coach expectation?

## C23-MOE-05 — Multi-sport facility clarity

| Field | Value |
|-------|--------|
| Scale | Likert 1–5 |
| Pass | ≥ 4/5 — coach understands sport filter effect in UI |
| Context | `sportId`, `sportKey` in review packet |

**Prompt:** Is it clear how the sport filter affects exercise selection in the Needs Engine UI?

## C23-MOE-06 — Speed vs strength session distinguishable

| Field | Value |
|-------|--------|
| Scale | Binary pass/fail |
| Pass | Side-by-side `speed_priority` vs `strength_priority` Output sets differ |
| Automated proxy | `category23_moe_speed_vs_strength` |

**Prompt:** Would a coach distinguish this speed session from a strength-priority session by Output picks alone?

## C23-MOE-07 — Sport scoring stable (lagging)

| Field | Value |
|-------|--------|
| Scale | 5/5 identical top-3 Output slugs |
| Pass | `category23_moe_scoring_stability` stable across eval history |
| Data | `NEEDS_ENGINE_QUALITY_HISTORY.jsonl` → `cat23OutputTopSlugs` |

**Prompt:** Are top Output picks stable across repeated golden eval runs?

## Automated signals (non-blocking)

| check_id | Metric | Notes |
|----------|--------|-------|
| `category23_mop_sport_multiplier` | C23-MOP-13 | Replay sportContextMultiplier ≠ 1 on primaries |
| `category23_mop_sport_demotion` | C23-MOP-14 | Sport-specific mean rank below generic |
| `category23_mop_beginner_penalty` | C23-MOP-18 | 0 penalty hits for INTERMEDIATE+ |
| `category23_moe_review_packet` | C23-MOE-01, 03, 05 | Item list + sport/work context for coach |
