# Category 24 — MOE rubric (Programming / block format)

Manual assessments for coach-facing dose and block format quality. **Not CI-blocking.**

## C24-MOE-01 — Dose feels coachable

**Scale (Likert 1–5)** — per high-intent phase (Output, Capacity, Resilience)

| Score | Criteria |
|-------|----------|
| 5 | Sets/reps/rest are clear; coach can run block without rewriting |
| 4 | Minor tweak to rest or sets possible; still runnable |
| 3 | One item needs dose rewrite before coaching |
| 2 | Multiple items need rewrite; pacing unclear |
| 1 | Block unusable as prescribed |

**Pass:** ≥ 4/5 per reviewed phase

**Inputs:** `items[]` with sets, reps, work_seconds, rest_seconds; `selection_rationale`

**Automated signal:** `category24_moe_review_packet`, blocking `item_sets_present`, `item_rest_present`

---

## C24-MOE-02 — Sustained format matches HIIT intent

**Binary pass** — Sustained block

Coach would program intervals/rounds from prescribed items (sets × work or HIIT-tagged).

**Pass:** Yes

**Automated signal:** `category24_moe_sustained_hiit`, `format_sustained_hiit_shape` (≥2 interval-structure items)

---

## C24-MOE-03 — Restore format is recovery

**Binary pass** — Restore block

Breathing/mobility doses — not strength sets with long rest.

**Pass:** Yes

**Automated signal:** `category24_moe_restore_recovery`, `format_restore_low_density`

---

## C24-MOE-05 — Phase-appropriate programming type

**Checklist** — post-builder (when builder wired)

| Phase | Expected format | Actual | Pass? |
|-------|-----------------|--------|-------|
| Output | Power/speed sets | | ☐ |
| Restore | Breathing/mobility | | ☐ |
| Sustained | Intervals/rounds | | ☐ |

**Pass:** Output ≠ nasal-breathing block; Restore ≠ EMOM

**Automated signal:** `category24_moe_builder_programming` (TBD until builder telemetry)

---

## C24-MOE-06 — Youth rest not rushed

**Scale (Likert 1–5)** — Output block, youth 8–14

| Score | Criteria |
|-------|----------|
| 5 | Rest long enough for power quality on every item |
| 4 | One item borderline; still acceptable |
| 3 | Coach would add rest on multiple items |
| 2 | Power work rushed |
| 1 | Rest clearly inadequate for age group |

**Pass:** ≥ 4/5

**Automated signal:** `category24_moe_output_rest_youth`, `format_output_rest_adequacy`

---

## Automated informational MOE (eval script)

| Check ID | Metric | Notes |
|----------|--------|-------|
| `category24_moe_review_packet` | C24-MOE-01, 05, 06 | Item dose payload for coach rubric |
| `category24_moe_sustained_hiit` | C24-MOE-02 | Sustained interval item count |
| `category24_moe_restore_recovery` | C24-MOE-03 | Restore low-density compliance |
| `category24_moe_output_rest_youth` | C24-MOE-06 | Output rest ≥20s rate for youth |
| `category24_moe_builder_programming` | C24-MOE-04, 05 | TBD until builder step instrumented |
| `category24_dose_stability` | C24-MOE-07 | Per-phase estimated_minutes 5/5 identical |

Log manual scores in [`NEEDS_ENGINE_CATEGORY_LOOP.log`](NEEDS_ENGINE_CATEGORY_LOOP.log) with `moe:cat24` prefix.
