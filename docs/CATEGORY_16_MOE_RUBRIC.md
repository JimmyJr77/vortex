# Category 16 — Phase-appropriate primaries — MOE rubric

Manual Measures of Effectiveness for Category 16. Automated MOP/MOR checks run in strict eval; these MOE items require coach review of the `category16_moe_review_packet` (per-phase item list with `primary_phase_key` and difficulty).

## When to use

After `npm run needs-engine:eval` passes blocking checks, a coach reviews each phase block against its label and intended intensity role.

## C16-MOE-01 — Prepare reads as warmup

| Field | Value |
|-------|--------|
| Scale | Likert ≥ 4/5 |
| Pass | Prepare block is activation/mobility/rudiments — not main workout content |
| Proxy | `category16_moe_prepare_warmup` (max difficulty within cap, no high-arousal tags) |

**Prompt:** Would you run this Prepare block as-is to warm a group up, without cutting anything as "too much, too early"?

## C16-MOE-02 — MI reads as movement quality

| Field | Value |
|-------|--------|
| Scale | Binary pass/fail |
| Pass | MI block is coordination/skill work — not max strength or HIIT |
| Proxy | `category16_moe_mi_quality` (no HIIT tags, load ≤ 5) |

**Prompt:** Does each MI item train movement quality rather than output or conditioning?

## C16-MOE-03 — High-intent block intent clear

| Field | Value |
|-------|--------|
| Scale | Binary pass per phase (Output / Capacity / Resilience) |
| Pass | Each high-intent block has coherent exercise types for its label |
| Context | Review packet `phases[].items[].primary_phase_key` |

**Prompt:** Reading only the exercise list, could you name each block's phase correctly?

## C16-MOE-05 — Restore is downshift only

| Field | Value |
|-------|--------|
| Scale | Binary pass/fail |
| Pass | No accidental work sets in Restore |
| Proxy | `category3_moe_arousal_downshift` (Cat 3) + `restore_excluded_methodology` |

**Prompt:** Would any Restore item raise heart rate or require coaching effort inconsistent with a cooldown?

## C16-MOE-06 — Fatigue arc readable

| Field | Value |
|-------|--------|
| Scale | Binary pass/fail |
| Pass | Intensity rises Prepare → Output/Capacity peak, then Sustained → Restore downshift |
| Proxy | `category16_moe_fatigue_arc` (mean-difficulty arc) |

**Prompt:** Does the session's energy curve make sense run top-to-bottom, with no mid-session dead spot or late spike?

## C16-MOE-08 — Phase labels match floor execution

| Field | Value |
|-------|--------|
| Scale | Binary pass/fail |
| Pass | Coach would run blocks in prescribed order without relabeling any block |
| Context | Review packet phase order + labels |

**Prompt:** Would you rename or reorder any block before putting this on the whiteboard?

## Automated signals (non-blocking)

| check_id | Metric | Notes |
|----------|--------|-------|
| `category16_moe_prepare_warmup` | C16-MOE-01 | Prepare max difficulty + arousal tag proxy |
| `category16_moe_mi_quality` | C16-MOE-02 | MI HIIT-tag / load proxy |
| `category16_moe_sustained_conditioning` | C16-MOE-04 | Strict conditioning eligibility share (fully automated) |
| `category16_moe_fatigue_arc` | C16-MOE-06 | Prepare < peak > Restore mean-difficulty arc |
| `category16_moe_prepare_output_bridge` | C16-MOE-07 | ≥ 1 shared pattern/family bridge (fully automated) |
| `category16_moe_review_packet` | C16-MOE-01, 02, 03, 05, 06, 08 | Per-phase items + primary_phase_key + difficulty for coach rubric |

## Recording

Log reviewer id, date, session requirements id, and scores. Prefix manual notes `moe:cat16`.
