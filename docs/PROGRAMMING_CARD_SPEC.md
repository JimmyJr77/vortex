# Programming Card Specification

Canonical reference for **Programming Library** method cards — reusable formats that describe **HOW** work is organized (EMOM, intervals, circuits, repeat shuttles), distinct from **Exercise Library** cards that describe **WHAT** movement to perform.

**Related:** [DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md) §4.5 · [EXERCISE_CARD_SPEC.md](EXERCISE_CARD_SPEC.md) · API `GET /api/coach/programming-methods/:id/card` · [programmingMethodProgramming.js](../backend/platform/programmingMethodProgramming.js)

---

## 1. Four-layer model

| Layer | Question | Entity |
|-------|----------|--------|
| Exercise Library | WHAT movement? | `coaching.exercise` |
| **Programming Library** | HOW organized? | `coaching.programming_method` |
| Workout Builder | Combines phase + format + exercises | `coaching.workout` / `workout_block` |
| Training Program Library | WHEN across weeks? | `training_program` (later) |

**Hard rules**

- Exercise cards never become EMOM/AMRAP/circuits; they only describe movements.
- Programming cards never become saved workouts; `programming_method_example` rows are illustrative only (`disclaimer` required).
- Workouts are composed at build time: `phase_key` + `programming_method_id` + exercises + dosage overrides.

**Do not conflate** `coaching.methodology` (exercise tagging: Plyometrics, HIIT…) with `coaching.programming_method` (format/protocol: EMOM, Repeat Shuttle…). They interact in validation but are separate entities.

---

## 2. Card anatomy (storage + API sections)

| Section | Primary storage | Purpose |
|---------|-----------------|---------|
| Identity | `programming_method` | Name, slug, category, summaries, development goals |
| Classification | `programming_method` JSONB + phase profiles | Phase fit, energy system, fatigue profile, programming type |
| Education | `programming_method` prose columns | What / why / when / misuse |
| Work / Rest | `work_rest_structure` JSONB + prescription profiles | Default timing, RPE, rounds |
| Exercise compatibility | `exercise_compatibility` JSONB + child rows | compatible / conditional / avoid exercise types |
| Quality & stop rules | `programming_method_quality_standard`, `programming_method_stop_rule` | Gates with severity |
| Validator rules | `programming_method_validator_rule` | Method-specific `condition_json` |
| Examples | `programming_method_example` | Illustrative only — not saved workouts |
| Builder defaults | `workout_builder_rules` JSONB | Auto-fill Workout Builder block fields |

Unified API shape from `buildProgrammingCard`: `identity`, `classification`, `education`, `workRestStructure`, `exerciseCompatibility`, `scaling`, `progressionLogic`, `regressionLogic`, `qualityStandards[]`, `stopRules[]`, `validatorRules[]`, `exampleImplementations[]`, `workoutBuilderRules`, `phaseProfiles[]`, `prescriptions[]`.

---

## 3. Categories (A–N)

| Code | Display name | Primary phases | Risk notes |
|------|--------------|----------------|------------|
| A | Timed Work Capacity | Sustained Capacity, Capacity | Requires time cap + quality standard |
| B | Interval Training | Capacity, Sustained Capacity | Watch work:rest ratio vs skill level |
| C | HIIT | Sustained Capacity | High impact / skill risk under fatigue |
| D | EMOM / AMRAP / Density | Sustained Capacity, Capacity | EMOM work >45s leaves no rest |
| E | Circuit Training | Capacity, Sustained Capacity | Station transitions add chaos for beginners |
| F | Density Blocks | Sustained Capacity | Quality degradation is primary failure mode |
| G | Tempo Conditioning | Sustained Capacity, Restore (low) | Pacing discipline over max effort |
| H | Repeat Sprint / Shuttle | Output (prep), Sustained Capacity | Requires lanes + decel space |
| I | Aerobic Base / Zone 2 | Restore, Sustained Capacity (low) | Not for Output or fresh skill work |
| J | Mixed-Modal Conditioning | Sustained Capacity | Exercise selection drives risk |
| K | Partner / Team Relay | Sustained Capacity | Group management + fairness |
| L | Game-Based Conditioning | Sustained Capacity | Preferred for youth post-skill |
| M | Recovery / Restoration | Restore | Low fatigue, low complexity |
| N | Custom | Any (coach-defined) | Requires explicit stop rules |

DB `category` stores display string (e.g. `Timed Work Capacity`); `programming_type` stores machine key (e.g. `emom`, `repeat_shuttle`).

---

## 4. Exercise compatibility type enum

Used in `exercise_compatibility.compatible_exercise_types`, `conditional_exercise_types`, `avoid_exercise_types`:

`locomotion`, `shuttle`, `sprint`, `low_amplitude_elastic`, `jump_rope`, `bodyweight_strength`, `loaded_strength`, `carry`, `crawl`, `grip_hang`, `med_ball`, `low_skill_calisthenics`, `machine_cardio`, `mobility_flow`, `partner_drill`, `game`, `tumbling`, `advanced_skill`, `high_impact_plyometrics`

Workout Builder infers types from exercise metadata (`movement_family`, `phase_subrole`, `impact_level`) — see [programmingExerciseCompat.ts](../src/coach/programmingExerciseCompat.ts).

---

## 5. Energy system enum

`aerobic`, `glycolytic`, `alactic_repeat`, `mixed`, `recovery`, `local_muscular_endurance`, `grip_endurance`, `trunk_endurance`

Stored in `energy_system_focus TEXT[]`.

---

## 6. Interaction rules

### Programming ↔ Exercise

- Programming method constrains **which exercise types** are compatible; exercises supply movement detail, scaling, and phase fit.
- Workout Builder warns when selected exercises violate `avoid_exercise_types` or method validator rules ([programmingValidation.js](../backend/platform/programmingValidation.js)).
- Exercise `pairing_logic` still applies for ordering within a block; programming adds block-level pacing/density constraints.

### Programming ↔ Session Phase

- Each method has `best_session_phase` + `programming_method_phase_profile` rows (`primary` / `secondary` / `conditional` / `avoid`).
- Session phase order in workout validator remains canonical; programming adds **within-session placement** warnings (e.g. hard conditioning before Output).
- Canonical phase keys: `prepare_and_access`, `movement_intelligence`, `output`, `capacity`, `resilience`, `sustained_capacity`, `restore` — see [sessionPhaseKeys.js](../backend/platform/sessionPhaseKeys.js).

### Workout block columns (migration 139)

`programming_method_id`, `programming_method_slug`, `quality_standard`, `stop_rules_json`, `scoring_mode`, `station_count`, `density_target`, `work_seconds`, `rest_seconds`

---

## 7. Publish-ready checklist

`validateProgrammingMethodPublishReady` requires:

- Name, category, best session phase
- ≥3 quality standards, ≥3 stop rules
- ≥1 prescription profile (beginner / intermediate / advanced / youth / low_impact / group)

---

## 8. Example cards (reference JSON)

Three full reference implementations live in [scripts/data/programming-methods-top50.mjs](../scripts/data/programming-methods-top50.mjs) and seed migration `141`.

### 8.1 Timed Work Capacity Block (`timed-work-capacity-block`)

```json
{
  "identity": {
    "name": "Timed Work Capacity Block",
    "slug": "timed-work-capacity-block",
    "category": "Timed Work Capacity"
  },
  "classification": {
    "programmingType": "timed_work_capacity",
    "bestSessionPhase": "sustained_capacity",
    "fatigueProfile": {
      "fatigue_level": "moderate",
      "technical_risk_under_fatigue": "moderate"
    }
  },
  "workoutBuilderRules": {
    "default_duration_minutes": 10,
    "default_rounds": 4,
    "default_work_seconds": 30,
    "default_rest_seconds": 30,
    "default_cap_minutes": 10,
    "group_friendly": true,
    "requires_timer": true
  },
  "exerciseCompatibility": {
    "compatible_exercise_types": ["locomotion", "machine_cardio", "low_skill_calisthenics"],
    "avoid_exercise_types": ["advanced_skill", "tumbling", "high_impact_plyometrics"]
  }
}
```

### 8.2 EMOM (`emom`)

```json
{
  "identity": {
    "name": "EMOM",
    "slug": "emom",
    "category": "EMOM / AMRAP / Density"
  },
  "classification": {
    "programmingType": "emom",
    "bestSessionPhase": "sustained_capacity"
  },
  "workoutBuilderRules": {
    "default_rounds": 10,
    "default_work_seconds": 40,
    "default_rest_seconds": 20,
    "requires_timer": true,
    "group_friendly": true
  },
  "validatorRules": [
    {
      "ruleKey": "emom_no_rest_remaining",
      "message": "Estimated work per minute exceeds ~45s — reduce reps or complexity.",
      "severity": "warning"
    }
  ]
}
```

### 8.3 Repeat Shuttle Format (`repeat-shuttle-format`)

```json
{
  "identity": {
    "name": "Repeat Shuttle Format",
    "slug": "repeat-shuttle-format",
    "category": "Repeat Sprint / Shuttle"
  },
  "classification": {
    "programmingType": "repeat_shuttle",
    "bestSessionPhase": "sustained_capacity"
  },
  "workoutBuilderRules": {
    "requires_lanes": true,
    "requires_clear_runout": true,
    "group_friendly": false
  },
  "exerciseCompatibility": {
    "compatible_exercise_types": ["shuttle", "locomotion"],
    "avoid_exercise_types": ["tumbling", "advanced_skill"]
  },
  "validatorRules": [
    {
      "ruleKey": "missing_runout_space",
      "message": "Sprint/shuttle formats require clear lanes and safe deceleration space.",
      "severity": "error"
    }
  ]
}
```

---

## 9. API surface

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/coach/programming-methods` | `library.view` |
| GET | `/api/coach/programming-methods/:id` | `library.view` |
| GET | `/api/coach/programming-methods/:id/card` | `library.view` |
| POST | `/api/coach/programming-methods` | `library.manage` |
| PUT | `/api/coach/programming-methods/:id` | `library.manage` |
| DELETE | `/api/coach/programming-methods/:id` | `library.manage` (soft archive) |
| GET | `/api/coach/programming-taxonomy` | `library.view` |
| POST | `/api/coach/workout-builder/validate-programming-block` | `library.view` |
| POST | `/api/coach/needs-engine/prescribe-programming-method` | `library.view` |

Coach UI: [ProgrammingLibraryPanel.tsx](../src/components/coach/ProgrammingLibraryPanel.tsx), [ProgrammingDetailModal.tsx](../src/components/coach/ProgrammingDetailModal.tsx), Workout Builder programming method selector.

---

## 10. Global validator rules (workout-level)

Implemented in [programmingValidation.js](../backend/platform/programmingValidation.js) → `analyzeProgrammingPlacement`:

| Rule | Severity |
|------|----------|
| Hard conditioning before Output | strong_warning |
| Hard conditioning before Movement Intelligence | warning |
| AMRAP / HIIT without quality standard | warning |
| Method-specific rules from `programming_method_validator_rule` | per row |

Block-level checks: `validateProgrammingBlock` (EMOM rest, lanes/runout, high-risk exercises in fatigue formats).
