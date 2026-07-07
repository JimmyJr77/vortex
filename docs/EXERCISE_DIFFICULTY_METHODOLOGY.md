# Exercise Difficulty Methodology (Product of Record)

Canonical rules for scoring the coaching exercise library. Implemented in [`backend/platform/exerciseDifficultyReview.js`](../backend/platform/exerciseDifficultyReview.js). Related policy: [`ageDifficultyPolicy.js`](../backend/platform/ageDifficultyPolicy.js).

**Related:** [EXERCISE_CARD_SPEC.md](EXERCISE_CARD_SPEC.md) · [DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md) §4.5

---

## 1. Two axes + overall

| Field | Range | Meaning |
|-------|-------|---------|
| **Technical** | 1–10 | Movement pattern complexity and coordination — **not** session intensity or fatigue |
| **Load** | 1–10 | Inherent resistance demand: external implement floor **or** relative bodyweight / stability demand |
| **Overall** | 1–10 | `max(technical, load)` — used for filters, sorting, and age recommendations |

**Complexity was removed** (migration 214). There is no third axis.

---

## 2. Programming kind: exercise vs skill_drill

| Kind | Used in | Age gating | Difficulty gates |
|------|---------|------------|------------------|
| **`exercise`** | Workouts, strength blocks, conditioning | Yes — `recommended_age_min` from overall | Load + technical caps per audience |
| **`skill_drill`** | Skill acquisition, shape/line drills, class level matching | **No** age min | Athlete / class **skill level** only |

### Classification rules

- **Skill drills:** pure skill acquisition — hand-placement drills, line/shape drills, wall handstand **holds**, isolated tumbling shape/entry work **without** a workout finish (lunge, stick, rebound, locomotor layer).
- **Exercises:** workouts and conditioning — loaded lifts, calisthenics, locomotor/skipping, integrated drills that combine a skill with a **workout element** (lunge finish, snap-down to stick, catch under balance/fatigue), milestone rep tests (see §8).
- **Skill component ≠ skill drill:** catching a ball is a skill; catching on a BOSU while balancing is an **exercise**. Cartwheel finish **lunge**, round-off rebound **to stick**, and skipping rhythm drill are **exercises** — they belong in workouts with age gating, not skill-only class matching.
- **Do not conflate:** `wall-handstand-push-up` is an **exercise**; `wall-handstand-hold` / `handstand-hold` (freestanding prep) are **skill_drills**.

Classifier: [`exerciseProgrammingKind.js`](../backend/platform/exerciseProgrammingKind.js).

---

## 3. Load scoring

### 3.1 External implements (floor values)

Minimum load when the pattern requires external weight (typical teen working weight):

| Implement | Load floor |
|-----------|------------|
| Barbell (squat, deadlift, clean, snatch, bench, press) | 5 |
| Atlas stone, sandbag, heavy carries | 5 |
| Kettlebell, dumbbell, medicine ball | 4 |
| Cable / lat pulldown / leg press | 3 |
| Light band / PVC assist only | 2 |

`heavy`, `max`, `1RM`, etc. add +2 load (capped at 10).

### 3.2 Relative bodyweight ladder (bilateral baseline)

When resistance is primarily bodyweight, use pattern families — **not** load 1 for everything:

| Pattern (bilateral) | Load | Technical |
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

**Pull-up ranks above dip** on the BW ladder (greater relative demand for most athletes).

### 3.3 Unilateral variants

Single-leg, single-arm, archer, and one-arm variants are **harder than bilateral** — the same total body mass is borne by one limb.

- **+2 load** vs the bilateral family baseline.
- **Technical unchanged** (same movement pattern class).
- Pistol squat already encodes unilateral demand in its baseline — do not double-apply.

Examples:

- Single-leg nordic > bilateral nordic (L8 → L10 capped).
- Archer / one-arm push-up > push-up (L3 → L5).
- Single-arm pull-up > pull-up (L6 → L8).

### 3.4 Stability medium (rings)

Rings add **load**, not technical, vs a fixed bar:

- **+1 load** for ring dip, ring push-up, ring pull-up, etc.
- Support holds on rings are low-load stability prep (L2–3).

### 3.5 Assisted tiers

Band-assisted, partner-assisted, or spotter-assisted versions **reduce load** when assistance is meaningful for that pattern:

- **−3 load** (minimum 1).
- Applies to: pull-ups, dips, push-ups, muscle-ups, nordics, pistols, bench press with spot, HSPU progressions.
- **Does not apply** to patterns where “assist” is not a standard scaling path (e.g. hang clean, snatch — assistance is coaching, not load reduction).

### 3.6 Eccentric / negative-only

Eccentric-only or negative-only variants are **lighter load** than full ROM:

- **−2 load** from the full-ROM family (e.g. full nordic L8 → negative L6; full pull-up L6 → negative L4).

Tempo eccentrics on otherwise full-ROM reps use a smaller regression (−1 load) when the name indicates a regression (incline / knee push-up).

### 3.7 Regressions (same technical)

Knee push-up, incline push-up, wall push-up: **−1 load**, **technical unchanged** vs standard push-up.

---

## 4. Technical scoring

Technical reflects **pattern mastery only**:

- **Not** increased for rings vs bar.
- **Not** decreased for knee / incline regressions (same pattern family).
- **Not** changed by band or partner assist (assist affects load only).

Examples:

| Movement | Technical |
|----------|-----------|
| Push-up, knee push-up, incline push-up | 4 |
| Pull-up, assisted pull-up | 4 |
| Nordic curl | 3 |
| Muscle-up | 8 |
| Hang clean / snatch | 7 |
| Sprint start | 4 |

Skill drills use target **skill level** (BEGINNER → 4, INTERMEDIATE → 6, ADVANCED → 8) with adjustments for prep vs full skill.

---

## 5. Recommended age minimum

For **`exercise`** items only:

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

High-load / low-technical patterns (e.g. nordic L8 / T3 → overall 8 → age 13+) must **not** show “6+” from load alone without overall reflecting the demand.

**Skill drills:** `recommended_age_min = null`.

---

## 6. Attention demand

Derived from `max(technical, load)`:

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

Some **exercises** double as achievement milestones (1 pull-up, 60 s plank, 2× BW squat, sub-5 s 40 yd dash, etc.). They remain `programming_kind = exercise` with difficulty scored by the same T/L rules. A dedicated milestone flag may be added later; until then, treat them as normal library exercises with accurate load/technical.

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
