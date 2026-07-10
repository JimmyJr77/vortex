# Category 19 — MOE rubric (Session diversity)

Manual assessments. **Not CI-blocking.**

## C19-MOE-01 — Session feels varied

**Likert ≥ 4/5:** coach confirms athletes are not repeating the same drill in a fatiguing way.

**Review packet:** `category19_moe_review_packet` (`phases`, `pattern_count`, `distinct_names`).

**Checklist:**

1. Scan prescribed exercise names — no obvious duplicate-feeling drills across non-adjacent phases.
2. Progression variants feel like intentional steps up, not reruns.
3. Coach would run this session without swapping items for variety alone.

---

## C19-MOE-02 — Pattern repetition acceptable

**Binary pass:** repeated patterns (e.g. two jump drills) feel purposeful, not spam.

**Automated proxy:** `category19_moe_pattern_purpose` (`pattern_count`, `ok_band`).

**Manual remainder:** coach judges whether within-phase pattern repeats (see `phase_pattern_no_repeat`) serve a coaching goal.

---

## C19-MOE-05 — Diversity vs focus tradeoff

**Binary pass:** Output block still feels coherent for `sessionObjective` despite dedup rules.

**Review packet:** `category19_moe_review_packet` + `category19_moe_output_speed_coherence`.

**Checklist:**

1. Speed Output still reads as speed/power despite family caps.
2. Dedup rules did not produce a random grab-bag in high-intent phases.
3. Coach can explain why each Output item belongs in a speed session.

---

## Automated informational MOE

| Check ID | Metric |
|----------|--------|
| `category19_moe_equipment_variety` | C19-MOE-03 — equipment tags across ≥ 3 phases |
| `category19_moe_athlete_distinct_names` | C19-MOE-04 — ≥ 12 distinct movement names |
| `category19_moe_youth_cognitive_load` | C19-MOE-06 — pattern count proxy for 8–14 band |
| `category19_moe_output_speed_coherence` | C19-MOE-07 — ≥ 50% Output jump/sprint/bound dominance |

Log manual scores with prefix `moe:cat19` in eval notes.
