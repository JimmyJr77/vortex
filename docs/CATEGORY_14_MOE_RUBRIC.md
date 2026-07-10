# Category 14 — MOE rubric (Exercise / movement avoids)

Manual assessments. **Not CI-blocking.**

## C14-MOE-01 — Avoids match coach intent

**Binary:** coach confirms every configured avoid (IDs, slugs, tokens, body regions) is absent from the prescription. Pass = Yes.

**Review packet:** `category14_moe_review_packet` (`avoid_config`, `prescribed_slugs`).

**Checklist:**

1. Each `avoidExerciseIds` / `avoidExerciseSlugs` entry is absent from primaries and per_split variants.
2. Body-region excludes are reflected — no item tagged the excluded region.
3. Coach would not substitute any prescribed item for an avoided movement on the floor.

---

## C14-MOE-05 — No hidden avoided movement

**Binary:** coach does not spot an avoided pattern under an alias name. Pass = 0 surprises.

**Automated proxy:** `exercise_avoid_leak`, `slug_stem_no_repeats`, `normalized_name_no_collisions`.

**Manual remainder:** coach scans prescribed names for semantic aliases of avoided movements.

---

## C14-MOE-06 — Soft diversity caps feel natural

**Likert ≥ 4/5:** pattern repetition limits and movement-family caps do not feel artificial.

**Review packet:** session `prescribed_slugs` + `category14_moe_movement_variety` family list.

---

## C14-MOE-07 — Avoid list explainable to athlete

**Binary:** coach can state excluded movements in plain language. Pass = Yes.

**Review packet:** `avoid_config` from `category14_moe_review_packet`.

---

## Automated informational MOE

| Check ID | Metric |
|----------|--------|
| `category14_moe_body_region_pruning` | C14-MOE-02 — no pool_empty when body_region excludes active |
| `category14_moe_movement_variety` | C14-MOE-03 — ≥ 5 distinct movement families session-wide |

Log manual scores with prefix `moe:cat14` in eval notes.
