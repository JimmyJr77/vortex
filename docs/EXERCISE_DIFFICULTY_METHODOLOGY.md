# Exercise Difficulty Methodology (Product of Record)

Canonical rules for scoring the coaching exercise library. Implemented in [`backend/platform/exerciseDifficultyReview.js`](../backend/platform/exerciseDifficultyReview.js). Related policy: [`ageDifficultyPolicy.js`](../backend/platform/ageDifficultyPolicy.js).

**Related:** [EXERCISE_CARD_SPEC.md](EXERCISE_CARD_SPEC.md) · [DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md) §4.5

---

## 1. Two axes + overall

| Field | Range | Meaning |
|-------|-------|---------|
| **Exercise complexity** (`technical`) | 1–10 | Coordination, sequencing, control, and decision demand — **not** an athlete skill level, session intensity, or fatigue |
| **Physical difficulty** (`load`) | 1–10 | Inherent resistance and force demand from relative bodyweight, leverage/stability, or external load |
| **Overall** | 1–10 | `max(technical, load)` — the greater of exercise complexity and physical difficulty, used for filters, sorting, and age recommendations |

The storage names `technical` and `load` are retained for compatibility. In
coach-facing language they mean **exercise complexity** and **physical
difficulty**. The older, separate `complexity` storage axis was removed in
migration 214; there is no third core difficulty axis. Coordination, impact,
supervision, fatigue sensitivity, and failure consequence remain distinct
canonical planning dimensions and do not change the two-axis overall formula.

---

## 2. Programming kind: exercise vs skill_drill

| Kind | Used in | Age gating | Difficulty gates |
|------|---------|------------|------------------|
| **`exercise`** | Workouts, strength blocks, conditioning | Yes — `recommended_age_min` from overall | Physical-difficulty + exercise-complexity caps per audience |
| **`skill_drill`** | Exercise-library drills linked to skill acquisition | Yes — `recommended_age_min` from overall | Physical-difficulty + exercise-complexity caps plus explicit readiness/prerequisite relationships |

`programming_kind` controls placement and intent; it does **not** assign a level
to an exercise card. Competitive/developmental levels exist only on dedicated
`coaching.skill` library cards. Workout audience training experience can tighten
difficulty caps, but it never becomes an exercise-card attribute.

### Classification rules

- **Skill-linked drills:** pure acquisition support — hand-placement drills, line/shape drills, wall handstand **holds**, isolated tumbling shape/entry work **without** a workout finish (lunge, stick, rebound, locomotor layer). They still receive exercise difficulty and age guidance.
- **Exercises:** workouts and conditioning — loaded lifts, calisthenics, locomotor/skipping, integrated drills that combine a skill with a **workout element** (lunge finish, snap-down to stick, catch under balance/fatigue), milestone rep tests (see §8).
- **Skill component ≠ skill drill:** catching a ball is a skill; catching on a BOSU while balancing is an **exercise**. Cartwheel finish **lunge**, round-off rebound **to stick**, and skipping rhythm drill are **exercises** — they belong in workouts with age gating, not skill-only class matching.
- **Do not conflate:** `wall-handstand-push-up` is an **exercise**; `wall-handstand-hold` / `handstand-hold` (freestanding prep) are **skill_drills**. The corresponding mastered/competitive skill belongs in `coaching.skill`, where level is valid.

Classifier: [`exerciseProgrammingKind.js`](../backend/platform/exerciseProgrammingKind.js).

---

## 3. Physical-difficulty scoring (`load` storage field)

### 3.1 External implements (floor values)

Minimum physical-difficulty score when the pattern requires external weight
(typical teen working weight):

| Implement | Load floor |
|-----------|------------|
| Barbell (squat, deadlift, clean, snatch, bench, press) | 5 |
| Atlas stone, sandbag, heavy carries | 5 |
| Kettlebell, dumbbell, medicine ball | 4 |
| Cable / lat pulldown / leg press | 3 |
| Light band / PVC assist only | 2 |

`heavy`, `max`, `1RM`, etc. add +2 physical difficulty (capped at 10).

### 3.2 Relative bodyweight ladder (bilateral baseline)

When resistance is primarily bodyweight, use pattern families — **not**
physical difficulty 1 for everything:

| Pattern (bilateral) | Physical | Complexity |
|---------------------|------|-----------|
| Nordic hamstring curl | 8 | 3 |
| Pull-up / chin-up | 6 | 4 |
| Dip (parallel / straight bar) | 5 | 4 |
| Push-up | 3 | 4 |
| Pike / box HSPU | 4 | 5 |
| Wall HSPU | 6 | 5 |
| Pistol squat (single-leg baseline) | 7 | 4 |
| Bodyweight squat | 2 | 4 |
| Sprint / locomotor | 1 | 4 |
| Prep / mobilize / breathing | 1 | 2 |

**Pull-up ranks above dip** on the BW ladder (greater relative physical demand
for most athletes).

### 3.3 Unilateral variants

Single-leg, single-arm, archer, and one-arm variants are **harder than bilateral** — the same total body mass is borne by one limb.

- **+2 physical difficulty** vs the bilateral family baseline.
- **Exercise complexity unchanged** when the coordination and sequencing
  demands are otherwise the same.
- Pistol squat already encodes unilateral demand in its baseline — do not double-apply.

Examples:

- Single-leg nordic > bilateral nordic (P8 → P10 capped).
- Archer / one-arm push-up > push-up (P3 → P5).
- Single-arm pull-up > pull-up (P6 → P8).

### 3.4 Stability medium (rings)

Rings add **physical difficulty**, not an athlete skill level, vs a fixed bar:

- **+1 physical difficulty** for ring dip, ring push-up, ring pull-up, etc.
- Support holds on rings are lower-physical-demand stability prep (P2–3).

### 3.5 Assisted tiers

Band-assisted, partner-assisted, or spotter-assisted versions **reduce physical
difficulty** when assistance is meaningful for that pattern:

- **−3 physical difficulty** (minimum 1).
- Applies to: pull-ups, dips, push-ups, muscle-ups, nordics, pistols, bench press with spot, HSPU progressions.
- **Does not apply** to patterns where “assist” is not a standard scaling path (e.g. hang clean, snatch — assistance is coaching, not load reduction).

### 3.6 Eccentric / negative-only

Eccentric-only or negative-only variants have lower concentric physical demand
than full ROM:

- **−2 physical difficulty** from the full-ROM family (e.g. full nordic P8 →
  negative P6; full pull-up P6 → negative P4).

Tempo eccentrics on otherwise full-ROM reps use a smaller regression (−1
physical difficulty) when the name indicates a regression (incline / knee
push-up).

### 3.7 Regressions (same technical)

Knee push-up, incline push-up, wall push-up: **−1 physical difficulty**,
**exercise complexity unchanged** vs standard push-up.

---

## 4. Exercise-complexity scoring (`technical` storage field)

Exercise complexity reflects the coordination, sequencing, control, and
decision demands of performing the exercise:

- It is **not** a label for the athlete or a class/competitive level.
- It is **not** automatically increased for rings vs bar when the movement
  solution is otherwise unchanged; ring instability is captured as physical
  difficulty and in stability/load profiles.
- It is **not** automatically decreased for knee/incline regressions when the
  coordination and sequencing pattern is unchanged.
- It is **not** changed by band or partner assistance unless the assistance
  materially simplifies the movement solution; assistance ordinarily changes
  physical difficulty.

Examples:

| Movement | Exercise complexity |
|----------|-----------|
| Push-up, knee push-up, incline push-up | 4 |
| Pull-up, assisted pull-up | 4 |
| Nordic curl | 3 |
| Muscle-up | 8 |
| Hang clean / snatch | 7 |
| Sprint start | 4 |

Skill-linked drills are scored from the exercise's actual coordination,
sequencing, balance, inversion, support, and decision demands, with physical
difficulty scored separately. They do not inherit a difficulty score from a
class or competitive skill level.

---

## 5. Recommended age minimum

For every exercise-library item, including `skill_drill` programming kinds:

```
recommended_age_min = f(overall)   where overall = max(technical, load)
```

| Overall | Age min |
|---------|---------|
| ≤ 2 | 6 |
| 3 | 6 |
| 4 | 7 |
| 5 | 9 |
| 6 | 10 |
| 7 | 12 |
| ≥ 8 | 13 |

High-physical / low-complexity patterns (e.g. nordic P8 / C3 → overall 8 → age
13+) must **not** show “6+” without overall reflecting the physical demand.

Age is guidance, not proof of readiness. Readiness checks, progressions,
supervision, pain/stop rules, and skill-library prerequisites remain controlling.

---

## 6. Attention demand

Derived from `max(technical, load)`, meaning the greater of exercise complexity
and physical difficulty:

| Peak | Attention |
|------|-----------|
| ≥ 8 | high |
| 5–7 | moderate |
| ≤ 4 | low |

---

## 7. Handstand card split

| Slug pattern | Kind | Notes |
|--------------|------|-------|
| `wall-handstand-push-up`, `box-pike-handstand-push-up`, `wall-handstand-negative-*` | exercise | Workout progressions |
| `wall-handstand-hold`, `chest-to-wall-handstand-hold`, `wall-handstand-line-hold`, `handstand-hold`, `handstand-kick-up-*` | skill_drill | Balance / line acquisition |

---

## 8. Milestone exercises (concept)

Some **exercises** double as achievement milestones (1 pull-up, 60 s plank, 2×
BW squat, sub-5 s 40 yd dash, etc.). They remain `programming_kind = exercise`
with difficulty scored by the same complexity/physical rules. A dedicated
milestone flag may be added later; until then, treat them as normal library
exercises with accurate physical-difficulty and exercise-complexity scores.

Examples: `muscle-up`, `pull-up-chin-up`, rep landmarks (`25-push-ups`), time landmarks (`60-second-plank`).

---

## 9. Review pipeline

1. Edit rules in `exerciseDifficultyReview.js`.
2. Run `node scripts/review-exercise-difficulty.mjs --dry-run` — inspect CSV.
3. Apply: `node scripts/review-exercise-difficulty.mjs` (upserts DB + writes migration).
4. Register new migration in `backend/platform/initTables.js`.

Export: [`docs/exercise-difficulty-review.csv`](exercise-difficulty-review.csv).

Per-exercise overrides live in `EXERCISE_DIFFICULTY_OVERRIDES` for exceptional cases only.

---

## 10. Changelog

| Date | Change |
|------|--------|
| 2026-07 | v3: BW load ladder, unilateral +2, ring +1, assist −3, eccentric −2, age from overall, HSPU kind split |
| 2026-07 | v2: Two-axis model; drop complexity; exercise vs skill_drill (migration 214–215) |
