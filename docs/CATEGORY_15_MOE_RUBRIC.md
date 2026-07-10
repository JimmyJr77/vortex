# Category 15 — Phase intent alignment — MOE rubric

Manual Measures of Effectiveness for Category 15. Automated MOP/MOR checks run in strict eval; these MOE items require coach review.

## When to use

After `npm run needs-engine:eval` passes blocking checks, a coach reviews focused phases (Output Speed w6, Sustained HIIT w5 on Test 3) using `category15_moe_review_packet`.

## C15-MOE-01 — Output reads as speed/power

| Field | Value |
|-------|--------|
| Scale | Likert 1–5 |
| Pass | ≥ 4/5 |
| Context | Output block items + Speed tenet focus |

**Prompt:** Does the Output block feel like speed/power work, not generic conditioning?

## C15-MOE-02 — Sustained reads as HIIT

| Field | Value |
|-------|--------|
| Scale | Binary pass/fail |
| Pass | Sustained block is conditioning intervals, not skill practice |
| Context | Sustained HIIT methodology focus |

**Prompt:** Is Sustained clearly HIIT/conditioning rather than technical skill rehearsal?

## C15-MOE-03 — Phases without focus still coherent

| Field | Value |
|-------|--------|
| Scale | Binary pass/fail |
| Pass | Capacity/Resilience content fits phase labels without explicit focus |
| Context | Unfocused phase blocks |

**Prompt:** Do Capacity and Resilience still read as their phase labels without explicit focus targets?

## C15-MOE-07 — Coach can explain phase “why”

| Field | Value |
|-------|--------|
| Scale | Binary pass/fail |
| Pass | Coach names focus facet in ≤ 15s per focused phase |
| Context | `category15_moe_review_packet` focus_targets |

**Prompt:** Can you name the focus facet driving Output and Sustained in one sentence each?

## C15-MOE-08 — Sustained does not duplicate Output

| Field | Value |
|-------|--------|
| Scale | Binary pass/fail |
| Pass | Sustained conditioning distinct from Output power work |
| Context | Output + Sustained items side-by-side |

**Prompt:** Is Sustained clearly different from Output (not the same drills repackaged)?

## C15-MOE-09 — Focused phase time feels earned

| Field | Value |
|-------|--------|
| Scale | Likert 1–5 |
| Pass | ≥ 4/5 for Output 40m block |
| Context | Speed-focused Output minutes |

**Prompt:** Does the Output block earn its time with speed intent, without filler?

## Automated signals (non-blocking)

| check_id | Metric | Notes |
|----------|--------|-------|
| `output_speed_tenet_match` | C15-MOP-02 | ≥ 70% Output primaries carry Speed tenet tag |
| `output_focus_score_honored` | C15-MOP-03 | scoreTargets replay positive on Output picks |
| `sustained_hiit_methodology_share` | C15-MOP-04 | ≥ 80% Sustained primaries HIIT-tagged |
| `category15_moe_focus_weight_drives` | C15-MOE-04 | Weight vs tag-frequency Spearman proxy |
| `category15_moe_methodology_label` | C15-MOE-05 | facetId 1169 → `hiit` key resolution |
| `category15_moe_session_objective_synergy` | C15-MOE-06 | speed_priority + speed pattern dominance |
| `category15_moe_review_packet` | C15-MOE-01, 02, 03, 07, 08, 09 | Focused phases + items for coach rubric |

## Recording

Log reviewer id, date, session requirements id, and scores. Prefix manual notes `moe:cat15`.
