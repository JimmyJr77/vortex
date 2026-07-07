# Exercise Card Specification (Card v2)

Canonical reference for how a **complete, publish-ready** exercise card should be authored in the Vortex coaching library. Card v2 schema is defined in migration `095`; Prepare/Access subroles in `096`; foundation card examples in migration `098`.

**Related:** [DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md) §4.5 · [COACHING_CORNER_ROADMAP.md](COACHING_CORNER_ROADMAP.md) · API `GET /api/coach/exercises/:id/card` · [exerciseProgramming.js](../backend/platform/exerciseProgramming.js)

---

## 1. Card anatomy (11 editor tabs)

Each exercise card is assembled from `coaching.exercise` plus related profile tables. The coach UI ([ExerciseEditor.tsx](../src/components/coach/ExerciseEditor.tsx)) maps to these storage locations:

| Editor tab | Primary storage | Purpose |
|------------|-----------------|---------|
| Movement Identity | `coaching.exercise` | Name, summary, family, phase, subrole, order slot |
| Requirements | `exercise.movement_requirements` JSONB | Joints, tissues, breathing/balance demand, impact |
| Taxonomy | `coaching.exercise_tag` | Weighted tenet/methodology/physiology/pattern/equipment/body_region tags |
| Phase Profiles | `coaching.exercise_phase_profile` | Primary phase fit, order slot, fatigue/impact ceilings |
| Why Layer | `coaching.education_content` | Training purpose, why it works, placement, misuse |
| Coaching Execution | `exercise.coaching_execution` JSONB | Setup, steps, cues, faults |
| Dosage | `coaching.exercise_dosage_profile` | Sets/reps/work/rest, volume unit, RPE range |
| Scaling | `coaching.exercise_scaling_profile` | One row per cohort (7 keys; 6 required for publish) |
| Pairing Logic | `exercise.pairing_logic` JSONB | Pairs well / avoid when |
| Safety | `coaching.exercise_safety_profile` | Risk, impact, readiness checks |
| Media & Docs | `exercise.media_library` JSONB + `exercise_media` | References, internal notes, hosted video |

---

## 2. Authoring conventions

### Phase and subrole (Prepare & Access)

- **Phase:** `primary_phase_key = 'prepare_and_access'`
- **Subrole:** One of `raise | mobilize | activate | integrate | potentiate_bridge`
- **Order slot:** Fine-grained key from `coaching.phase_order_slot` (e.g. `breathing_reset`, `hip_rotation`)
- **Dual subroles** (e.g. “Mobilize / Activate”): Store the **primary** subrole on `phase_subrole` (first listed / dominant intent). Record secondary intent in `coach_language` or card summary.

### RAMP framework & Vortex Prepare & Access sequence

**RAMP** (Ian Jeffreys) is a widely accepted strength-and-conditioning warm-up model used in collegiate athletics, professional sports, military performance, and elite programs. The **original** acronym and order:

| Step | Goal | Examples |
|------|------|----------|
| **Raise** | Increase heart rate, temperature, blood flow, respiration, nervous system activity | Light jog, jump rope, bike, skipping, carioca, marches |
| **Activate** | Wake up muscles that need to contribute (often inhibited stabilizers) | Glute bridge, mini-band walks, dead bug, bird dog, scapular push-up, plank |
| **Mobilize** | Usable range through required joints — **dynamic** mobility, not long static stretching | World's Greatest Stretch, leg swings, hip openers, T-spine rotation, squat pry |
| **Potentiate** | Ramp nervous system toward explosive / sport-specific work | Accelerations, jumps, med ball throws, bounds, short sprints, Oly derivatives |

In Jeffreys' model, **Activate comes before Mobilize**. Many modern coaches expand the framework because activation and mobility often overlap. Common adaptations include **Integrate** (“can the body use the mobility and activation you just created?” — crawls, balance reaches, skip progressions, sprint patterning) and reorderings such as Raise → Mobilize → Activate → Integrate → Potentiate, or Raise → Release → Activate → Mobilize → Potentiate.

**Vortex deliberately uses:**

Raise → Mobilize → Activate → Integrate → **Potentiate Bridge** → **Performance Work**

| Stage | Role |
|-------|------|
| Raise | Elevate heart rate and body temperature |
| Mobilize | Dynamic access through ankles, hips, T-spine, shoulders, wrists |
| Activate | Prime glutes, core, scapular stabilizers, feet, posterior chain |
| Integrate | Locomotion, coordination, balance, sprint mechanics — whole-body patterning |
| Potentiate Bridge | Low-stress elastic / reactive ramp (pogos, snap-down prep, bounds, build-ups) before maximal output |
| **Performance Work** | Main session intent: **Movement Intelligence**, **Output**, Capacity, Resilience, Sustained Capacity — then Restore |

Mobilize before Activate fits Vortex's blend of athletic development, tumbling, and Ninja-style movement: open usable ranges before asking stabilizers to fire in integrated positions. **Potentiate Bridge** closes the gap between warm-up and max effort — especially valuable for Ninja, sprinting, gymnastics, football, tactical athletes, parkour, and high-performance youth.

Coach UI copy lives in [prepareAccessRampPhilosophy.ts](../src/coach/prepareAccessRampPhilosophy.ts); Philosophy tab renders it in [FrameworkPanel.tsx](../src/components/coach/FrameworkPanel.tsx). Workout validation enforces subrole order within Prepare & Access blocks (`prepare_subrole_sequence`).


There is no dedicated `best_placement` column. Store session placement guidance in:

**`education_content.programming_guidance`**

Example: *“First 1–3 minutes of session, especially before mobility, tumbling, sprint mechanics…”*

### Taxonomy weights

Each tag is `(facet_type, facet_key, weight)` where **weight is 1–5** (emphasis). Multiple tags per facet are allowed (e.g. four movement patterns on World’s Greatest Stretch).

### Pairing

| Authoring label | JSON path |
|-----------------|-----------|
| Pairs well with | `pairing_logic.pairs_well_after[]` |
| Avoid when | `pairing_logic.do_not_use_when[]` |

Values are human-readable exercise names or short descriptors (slugs optional).

### Media and references

| Authoring label | JSON path |
|-----------------|-----------|
| Demo/reference sources | `media_library.clinical_or_sport_science_references[]` |
| Internal coach notes | `media_library.internal_notes[]` |

Hosted video uses `coaching.exercise_media` (Cloudinary); URL lists in JSONB are sufficient for text-only seeds.

### Scaling cohorts

| Cohort key | Label |
|------------|-------|
| `youth_beginner` | Youth beginner |
| `youth_intermediate` | Youth athlete |
| `teen` | Teen / adult beginner (shared row when copy matches) |
| `adult_beginner` | Adult beginner |
| `adult_advanced` | Advanced athlete |
| `older_adult` | Older adult |
| `pregnancy_postpartum` | Pregnancy/postpartum (optional for publish) |

Population-specific prose goes in **`exercise_scaling_profile.load_guidance`** per cohort. **`gender_specific_notes`** on the `adult_beginner` row when applicable.

### Difficulty profile (age-aware programming)

Canonical table: **`coaching.exercise_difficulty_profile`** (migration `202`, rescored in `216`). One row per exercise.

**Product of record:** [EXERCISE_DIFFICULTY_METHODOLOGY.md](EXERCISE_DIFFICULTY_METHODOLOGY.md)

| Field | Scale | Meaning |
|-------|-------|---------|
| `technical` | 1–10 | Movement pattern complexity (not medium, regressions, or assists) |
| `load` | 1–10 | Inherent resistance — external implement floor or relative BW / stability |
| `overall` | 1–10 | `max(technical, load)` |
| `recommended_age_min` / `recommended_age_max` | years | From **overall** for `exercise`; null for `skill_drill` |
| `attention_demand` | low / moderate / high | Coaching density |

**`programming_kind`** on `coaching.exercise`: `exercise` (workout, age-gated) vs `skill_drill` (class/level gated).

Age-band caps for Needs Engine / workout validation: [`ageDifficultyPolicy.js`](../backend/platform/ageDifficultyPolicy.js) (e.g. ages 6–8 → max overall 5).

Review pipeline: `node scripts/review-exercise-difficulty.mjs` → CSV at `docs/exercise-difficulty-review.csv`.

### RPE

Author `rpe_range: "1-2"` as `default_rpe_min = 1`, `default_rpe_max = 2` on the Default dosage profile. Card API exposes formatted `dosage.rpe_range`.

---

## 3. Publish gate checklist

`validateExercisePublishReady()` requires:

- Name, slug, card summary, primary phase, est seconds per set
- Movement requirements: ≥1 joint action or tissue
- Coaching execution: non-empty setup **and** execution steps
- Taxonomy: at least one tag each for tenet, methodology, physiology, pattern, equipment
- ≥1 phase profile; Default dosage with est seconds; 6 required scaling cohorts
- Safety profile with risk level and ≥1 readiness check
- Why layer: `what_it_is`, `why_it_goes_here`, `common_misuse`

**Not required (but recommended for foundation cards):** `why_it_works`, body_region tags, RPE, pairing logic, media refs, pregnancy cohort.

---

## 4. Worked example — Card 1: 90/90 Breathing with Reach

Below is the **target card format** and where each block lands in the product.

### Movement Identity

| Field | Value |
|-------|-------|
| Name | 90/90 Breathing with Reach |
| Card summary | Supine breathing reset that stacks ribs over pelvis, restores diaphragmatic breathing, and prepares the trunk for movement. |
| Movement family | Breathing reset |
| Phase | Prepare & Access |
| Subrole | Mobilize *(secondary: Activate — noted in coach language)* |
| Order slot | `breathing_reset` |

### Why Layer

| Field | Value |
|-------|-------|
| What it is | Full movement description (mirrors coaching execution) |
| Why it works | The 90/90 position gives the athlete a low-threat way to organize ribcage, pelvis, and diaphragm… (FMS reference) |
| Why it goes here | Belongs in Mobilize (breathing_reset) — trunk access before skill work |
| Best placement → **programming_guidance** | First 1–3 minutes of session, especially before mobility, tumbling, sprint mechanics… |
| Common misuse | Do not use as a long relaxation block… |

### Taxonomy (weighted)

```json
{
  "tenets": [
    { "key": "flexibility", "weight": 3 },
    { "key": "body_control", "weight": 4 },
    { "key": "coordination", "weight": 2 }
  ],
  "methodologies": [
    { "key": "mobility_flexibility", "weight": 3 },
    { "key": "core_body_control", "weight": 4 },
    { "key": "neural", "weight": 2 }
  ],
  "physiology": [
    { "key": "neural_output_readiness", "weight": 3 },
    { "key": "control_stability", "weight": 4 }
  ],
  "patterns": [{ "key": "brace", "weight": 4 }],
  "equipment": [
    { "key": "none", "weight": 5 },
    { "key": "mat", "weight": 2 }
  ],
  "body_regions": [
    { "key": "core", "weight": 5 },
    { "key": "spine", "weight": 4 },
    { "key": "hip", "weight": 2 }
  ]
}
```

### Coaching Execution

- **Setup:** Lie on back 90/90; reach arms; neutral neck
- **Execution steps:** Nasal inhale → long exhale while reaching
- **Coaching focus → `coach_cues`:** Ribs down; pelvis neutral; long exhale…
- **Watch out for → `common_faults`:** Low back arching; shoulders shrugging…

### Dosage

| Field | Value |
|-------|-------|
| volume_unit | `breaths` |
| default_sets | 1 |
| default_reps | 5 |
| default_work_seconds | 45 |
| est_seconds_per_set | 60 |
| rpe_range | 1–2 |

### Scaling (per cohort → `load_guidance`)

| Population | Guidance |
|------------|----------|
| Youth beginner | Hands on belly/ribs; “fill the balloon, blow out slow.” |
| Youth athlete | Gentle reach + heel pressure into wall |
| Teen/adult beginner | 4s inhale, 6s exhale with wall support |
| Advanced athlete | Dead bug reach, heel drag, exhale-to-brace |
| Older adult | Bench/chair support; avoid floor if limited |
| Pregnancy/postpartum | Avoid prolonged supine; side-lying/seated alternative |

### Pairing & Media

- **Pairs well after:** Crocodile Breathing, Dead Bug, Cat-Cow, Glute Bridge…
- **Avoid when:** Dizzy in supine; supine contraindicated; class needs immediate temperature raise
- **References:** Functional Movement Systems 90/90 Breathing Position
- **Internal note:** Best as reset, not a long relaxation block

---

## 5. Foundation cards 1–10 (implemented)

Migration **`098_coaching_prepare_and_access_foundation_cards.sql`** upgrades these slugs to the full spec above:

| # | Slug | Order slot |
|---|------|------------|
| 1 | `9090-breathing-with-reach` | `breathing_reset` |
| 2 | `crocodile-breathing` | `breathing_reset` |
| 3 | `full-body-joint-cars-flow` | `joint_scan` |
| 4 | `cat-cow` | `spinal_mobility` |
| 5 | `quadruped-spinal-circles` | `spinal_mobility` |
| 6 | `quadruped-thread-the-needle` | `thoracic_rotation` |
| 7 | `side-lying-open-book` | `thoracic_rotation` |
| 8 | `9090-hip-switch` | `hip_rotation` *(slot added in 098; **content/placement superseded by hip cluster card #35 in [102](../backend/migrations/102_coaching_prepare_and_access_hip_access_cards.sql) — see §8.6)*) |
| 9 | `worlds-greatest-stretch` | `integrated_mobility` |
| 10 | `inchworm-walkout` | `integrated_mobility` |

**Source data:** [scripts/data/foundation-access-cards-1-10.mjs](../scripts/data/foundation-access-cards-1-10.mjs)  
**Regenerate SQL:** `node scripts/generate-098-foundation-cards.mjs`

Cards 11–44 are rich card v2 in migrations [`100`](../backend/migrations/100_coaching_prepare_and_access_upper_body_cards.sql), [`101`](../backend/migrations/101_coaching_prepare_and_access_lower_leg_cards.sql), and [`102`](../backend/migrations/102_coaching_prepare_and_access_hip_access_cards.sql). Cards 45–50 remain at the thinner `097` seed until a future content pass.

---

## 6. Integration notes

### API

`GET /api/coach/exercises/:id/card` returns nested JSON via `buildExerciseCard()`:

- `movement_identity`, `taxonomy`, `why_layer`, `coaching_execution`, `dosage`, `scaling`, `pairing_logic`, `media_and_document_library`

### Migrations

| Migration | Role |
|-----------|------|
| `095` | Card v2 columns, cohort scaling, `why_it_works` |
| `096` | Prepare/Access subroles + order slots |
| `097` | 50-movement thin seed |
| `098` | Foundation cards 1–10 rich upgrade |

Registered in [initTables.js](../backend/platform/initTables.js); idempotent on boot.

### Subrole ↔ slot consistency

After seeding, this query should return **0 rows**:

```sql
SELECT e.slug, e.phase_subrole, pos.subrole_key
FROM coaching.exercise e
JOIN coaching.phase_order_slot pos ON pos.key = e.primary_order_slot
WHERE e.primary_phase_key = 'prepare_and_access'
  AND e.phase_subrole <> pos.subrole_key;
```

### Workout Builder

Prepare/Access picker groups movements by **subrole chip**, then filters by **order slot**. Foundation cards 1–10 cover breathing → spine → T-spine → hip rotation → integrated mobility — the recommended early-session sequence.

---

## 7. Content authoring checklist (copy/paste)

When writing a new card, include:

- [ ] Card summary (1–2 sentences, coach-facing)
- [ ] Phase, subrole, order slot
- [ ] Best placement (→ `programming_guidance`)
- [ ] Weighted taxonomy (all six facets where relevant)
- [ ] Why it works + why it goes here + common misuse
- [ ] Movement description, setup, steps, coach cues, common faults
- [ ] Default dosage + volume unit + RPE
- [ ] Scaling row for each of 7 cohorts
- [ ] Pairs well with + avoid when
- [ ] At least one media/reference or internal note
- [ ] Safety readiness checks (from 097 or custom)

---

## 8. Implementation notes for Cursor / content agents (Prepare & Access)

Use this section when authoring or upgrading Prepare & Access cards (migrations `097`–`098+`, generator scripts under `scripts/`).

### 8.1 Coach filter dimensions

Build the library so coaches can filter by:

| Dimension | Storage / API | Canonical values |
|-----------|---------------|------------------|
| **phase_subrole** | `exercise.phase_subrole`, `?subrole=` | `raise`, `mobilize`, `activate`, `integrate`, `potentiate_bridge` |
| **body_region** | `exercise_tag` facet `body_region`, `?body_region=` | `foot`, `ankle`, `knee`, `hip`, `spine`, `core`, `shoulder`, `wrist`, `full_body` |
| **session_need** | `pairing_logic.good_for_sessions[]`, `?session_need=` | See table below |
| **fatigue_cost** | `exercise_phase_profile.fatigue_cost`, `?max_fatigue_cost=` | **1–2 preferred** for most Prepare & Access cards |
| **daily_ok** | `exercise_regimen_rule.can_be_daily`, `?can_be_daily=true` | `true` for most low-intensity mobility and breathing drills |

**Session need keys** (store exactly in `good_for_sessions`):

| Key | Use when |
|-----|----------|
| `tumbling_prep` | Hand support, wrist/shoulder/spine access before gymnastics/ninja tumbling |
| `sprint_prep` | Hip, ankle, posture, low-level plyo before acceleration work |
| `squat_prep` | Ankle DF, hip mobility, glute activation before squat patterns |
| `overhead_prep` | T-spine rotation, shoulder mobility, scap control before overhead load |
| `landing_prep` | Ankle stiffness, absorption mechanics before jumps/plyos |
| `crawling_prep` | Wrist, shoulder, quadruped patterns before crawl/beast work |
| `general_warmup` | Default temperature + movement access for mixed sessions |
| `low_readiness_reset` | Breathing, down-regulation, nervous-system reset (anxious/stiff athletes) |

Example on a card:

```json
"good_for_sessions": ["tumbling_prep", "overhead_prep", "general_warmup"]
```

### 8.2 Phase profile defaults (Prepare & Access)

When seeding `exercise_phase_profile` for `prepare_and_access`:

| Field | Typical value |
|-------|----------------|
| `role` | `primary` |
| `fit_weight` | 5 |
| `freshness_required` | `false` |
| `fatigue_cost` | **1–2** (3+ only for late-bridge elastic prep, e.g. low pogos) |
| `fatigue_sensitivity` | 1–2 |
| `impact_level` | 0–1 (2 only for rhythm/bounce drills in Raise or Potentiate Bridge) |
| `intensity_ceiling` | `low` |

Set `exercise_regimen_rule.can_be_daily = true` and `weekly_max_frequency = 7` for breathing and low-intensity mobility.

### 8.3 Validation principle: readiness without stealing output

**Prepare & Access should increase readiness without stealing output.**

The workout validator (`workoutValidation.js`) flags Prepare & Access blocks that contain too many:

- High **fatigue-cost** items (`fatigue_cost > 2`)
- **High-impact** contacts (`impact_level >= 2`, beyond 1–2 bridge drills)
- **Long isometric holds** (isometrics methodology + `work_seconds >= 45`)
- **Conditioning-style** work (methodology `hiit`, or regimen flags)
- **Non-low intensity ceiling** on phase profile

Content agents: if a drill fatigues athletes for Output/Skill, it belongs in Capacity or Sustained Capacity — not Prepare & Access.

### 8.4 Upper-body access cards 11–20 (complete)

Cards **11–20** cover **wrist, shoulder, scapular, and upper-body access** — implemented in migration [`100`](../backend/migrations/100_coaching_prepare_and_access_upper_body_cards.sql). **097 slugs are canonical** (display names updated only).

| # | Slug | Subrole / slot | session_need tags |
|---|------|----------------|-------------------|
| 11 | `wrist-rockers-palms-down` | mobilize / `wrist_prep` | tumbling_prep, crawling_prep, general_warmup |
| 12 | `wrist-rockers-palms-up` | mobilize / `wrist_prep` | tumbling_prep, crawling_prep, general_warmup |
| 13 | `finger-pulses` | activate / `hand_activation` | tumbling_prep, crawling_prep, general_warmup |
| 14 | `scapular-push-up` | activate / `scapular_activation` | tumbling_prep, overhead_prep, crawling_prep |
| 15 | `quadruped-shoulder-circles` | mobilize / `shoulder_mobility` | tumbling_prep, overhead_prep, crawling_prep |
| 16 | `wall-slides-with-lift-off` | mobilize / `shoulder_prep` | overhead_prep, tumbling_prep, general_warmup |
| 17 | `band-external-rotation` | activate / `rotator_cuff_activation` | tumbling_prep, overhead_prep, crawling_prep |
| 18 | `arm-circles` | mobilize / `shoulder_cars` | overhead_prep, tumbling_prep, general_warmup |
| 19 | `bear-crawl-rock-back` | integrate / `crawl_pattern_prep` | tumbling_prep, overhead_prep, crawling_prep |
| 20 | `down-dog-to-plank-wave` | integrate / `full_body_flow` | crawling_prep, overhead_prep, tumbling_prep, general_warmup |

Data: [`scripts/data/upper-body-access-cards-11-20.mjs`](../scripts/data/upper-body-access-cards-11-20.mjs). Generator: [`scripts/generate-100-upper-body-cards.mjs`](../scripts/generate-100-upper-body-cards.mjs).

**Validation rule:** `prepare_upper_body_access` — upper-body access should prepare hand support without pre-fatiguing wrists, shoulders, grip, or trunk (complements `prepare_readiness_stealing` in 099).

### 8.5 Lower-leg access cards 21–30 (complete)

Cards **21–30** cover **foot, ankle, shin, calf, and elastic readiness** — implemented in migration [`101`](../backend/migrations/101_coaching_prepare_and_access_lower_leg_cards.sql). **097 slugs are canonical** (display names updated where noted).

| # | Slug | Subrole / slot | session_need tags |
|---|------|----------------|-------------------|
| 21 | `knee-to-wall-ankle-rockers` | mobilize / `ankle_mobility` | landing_prep, squat_prep, sprint_prep, general_warmup |
| 22 | `half-kneeling-ankle-dorsiflexion-pulse` | mobilize / `ankle_mobility` | landing_prep, squat_prep, sprint_prep, general_warmup |
| 23 | `ankle-cars` | mobilize / `ankle_cars` | landing_prep, sprint_prep, general_warmup |
| 24 | `tibialis-raises` | activate / `shin_activation` | landing_prep, sprint_prep, squat_prep |
| 25 | `calf-raise-to-heel-drop` | activate / `calf_achilles_prep` | landing_prep, sprint_prep, squat_prep |
| 26 | `toe-yoga` | activate / `foot_activation` | landing_prep, sprint_prep, squat_prep |
| 27 | `short-foot-drill` | activate / `foot_activation` | landing_prep, sprint_prep, squat_prep |
| 28 | `foot-tripod-weight-shifts` | integrate / `foot_balance_prep` | landing_prep, sprint_prep, squat_prep |
| 29 | `low-pogos` | potentiate_bridge / `elastic_prep` | landing_prep, sprint_prep, tumbling_prep |
| 30 | `jump-rope-easy-bounce` | raise / `rhythm_warmup` | general_warmup, sprint_prep, landing_prep |

Display name updates: card 25 → **Calf Raise to Controlled Heel Drop**; card 29 → **Low Pogos / Ankling Bounce**. Card 30 uses `phase_profile.role = conditional`.

**New fine slots (101):** `ankle_cars`, `shin_activation`, `calf_achilles_prep`, `foot_balance_prep`, `elastic_prep`. Resequences foot/ankle band (128–136); bumps `hip_mobility` → 140, `squat_access` → 141. Equipment taxonomy adds `wall`, `jump_rope`.

Data: [`scripts/data/lower-leg-access-cards-21-30.mjs`](../scripts/data/lower-leg-access-cards-21-30.mjs). Generator: [`scripts/generate-101-lower-leg-cards.mjs`](../scripts/generate-101-lower-leg-cards.mjs).

**Dose-phase escalation (Prepare & Access):**

| Drill type | Prepare & Access cap | Escalates to |
|------------|---------------------|--------------|
| Low pogos | ≤40 contacts, low amplitude | Output / Sustained Capacity plyometrics |
| Jump rope | ≤90s, RPE ≤4 | Sustained Capacity / conditioning |
| Calf raise + heel drop | ≤15 total reps | Resilience eccentrics |
| Ankle mobility / activation | Low fatigue, 1 set default | — |

**Validation rule:** `prepare_lower_leg_readiness` — foot/ankle prep should not steal spring or become conditioning before sprinting, jumping, tumbling, or agility. Rules: `prepare_pogos_output_dose`, `prepare_jump_rope_fitness_dose`, `prepare_calf_fatigue_before_output`, `prepare_lower_leg_symptoms`, `prepare_lower_leg_spring_check`.

### 8.6 Hip/pelvis access cards 31–44 (complete)

Cards **31–44** cover **hip, pelvis, squat, lunge, and frontal-plane access** — implemented in migration [`102`](../backend/migrations/102_coaching_prepare_and_access_hip_access_cards.sql). **097 slugs are canonical** (display names updated where noted).

| # | Slug | Subrole / slot | session_need tags |
|---|------|----------------|-------------------|
| 31 | `walking-knee-hug` | integrate / `dynamic_hip_mobility` | sprint_prep, squat_prep, landing_prep, general_warmup |
| 32 | `walking-quad-pull` | integrate / `dynamic_quad_hip_flexor` | sprint_prep, squat_prep, landing_prep, general_warmup |
| 33 | `leg-swings-front-back` | mobilize / `hip_swing_sagittal` | sprint_prep, landing_prep, squat_prep, general_warmup |
| 34 | `leg-swings-lateral` | mobilize / `hip_swing_frontal` | sprint_prep, landing_prep, squat_prep, general_warmup |
| 35 | `9090-hip-switch` | mobilize / `hip_rotation` | sprint_prep, squat_prep, general_warmup |
| 36 | `shin-box-switch` | mobilize / `hip_rotation_integrated` | sprint_prep, squat_prep, general_warmup |
| 37 | `shin-box-get-up` | integrate / `hip_transition` | sprint_prep, squat_prep, general_warmup |
| 38 | `hip-cars` | mobilize / `hip_cars` | sprint_prep, squat_prep, general_warmup |
| 39 | `adductor-rockback` | mobilize / `adductor_mobility` | squat_prep, landing_prep, sprint_prep |
| 40 | `frog-rockback` | mobilize / `adductor_mobility` | squat_prep, landing_prep, sprint_prep |
| 41 | `cossack-shift` | integrate / `frontal_plane_mobility` | squat_prep, landing_prep, sprint_prep, tumbling_prep |
| 42 | `deep-squat-pry` | integrate / `squat_access` | squat_prep, landing_prep, sprint_prep, tumbling_prep |
| 43 | `squat-to-stand-with-reach` | integrate / `squat_to_stand` | squat_prep, landing_prep, sprint_prep, tumbling_prep |
| 44 | `lateral-lunge-shift` | integrate / `lateral_lunge_prep` | squat_prep, landing_prep, sprint_prep, tumbling_prep |

Display name updates: cards 33–34 → **Leg Swings — Front/Back** / **Lateral**; card 38 → **Hip CARs — Standing or Quadruped**; card 41 → **Cossack Shift — Low Amplitude**. Cards 37 and 42 use `phase_profile.role = conditional`. Card 35 (`9090-hip-switch`) supersedes foundation card #8 sequencing placement (same slug).

**New fine slots (102):** `hip_swing_sagittal`, `hip_swing_frontal`, `hip_rotation_integrated`, `hip_cars`, `adductor_mobility`, `dynamic_hip_mobility`, `dynamic_quad_hip_flexor`, `hip_transition`, `frontal_plane_mobility`, `lateral_lunge_prep`. Resequences hip band (127–132, 144–150); moves `integrated_mobility` → 137; fixes `squat_access` subrole to integrate @ 148.

Data: [`scripts/data/hip-access-cards-31-44.mjs`](../scripts/data/hip-access-cards-31-44.mjs). Generator: [`scripts/generate-102-hip-access-cards.mjs`](../scripts/generate-102-hip-access-cards.mjs).

**Dose-phase escalation (Prepare & Access):**

| Drill type | Prepare & Access cap | Escalates to |
|------------|---------------------|--------------|
| Deep squat pry | ≤60 seconds | Capacity / mobility block |
| Cossack / lateral lunge | ≤16 reps per side before agility | Capacity / Control |
| Leg swings | Controlled range, RPE ≤4 | — |
| Hip rotation cluster | ≤24 combined reps across ≥3 drills | — |

**Validation rule:** `prepare_hip_access_readiness` — hip/pelvis prep should not become a flexibility session or leg-fatigue circuit before Output. Rules: `prepare_squat_pry_duration`, `prepare_frontal_plane_fatigue`, `prepare_leg_swing_intensity`, `prepare_hip_rotation_volume`, `prepare_groin_symptoms`, `prepare_hip_heaviness_before_output`.

### 8.7 Activation / integration cards 45–50 (Prepare & Access complete)

Cards **45–50** cover **activation and integrated movement-prep** — the bridge from mobility/access into Movement Intelligence or Output — implemented in migration [`103`](../backend/migrations/103_coaching_prepare_and_access_activation_cards.sql). **097 slugs are canonical** (display names updated where noted).

| # | Slug | Subrole / slot | session_need tags |
|---|------|----------------|-------------------|
| 45 | `glute-bridge` | activate / `glute_activation` | sprint_prep, squat_prep, landing_prep, general_warmup |
| 46 | `glute-bridge-march` | activate / `glute_core_integration` | sprint_prep, landing_prep, squat_prep, general_warmup |
| 47 | `dead-bug-heel-tap` | activate / `core_activation` | sprint_prep, tumbling_prep, landing_prep, general_warmup |
| 48 | `bird-dog` | integrate / `cross_body_core` | tumbling_prep, sprint_prep, general_warmup |
| 49 | `mini-band-lateral-walk` | activate / `lateral_hip_activation` | sprint_prep, landing_prep, squat_prep, general_warmup |
| 50 | `a-march` | potentiate_bridge / `marching_mechanics` | sprint_prep, agility_prep, tumbling_prep, general_warmup |

Display name updates: card 47 → **Dead Bug Breathing / Heel Tap**; card 50 → **A-March / Marching Mechanics**. Card 48 (`bird-dog`) moves from activate/`core_activation` to integrate/`cross_body_core`. Card 49 uses steps as reps (`volume_unit: steps` in dosage).

**New fine slots (103):** `glute_core_integration`, `cross_body_core`, `lateral_hip_activation`, `marching_mechanics`. Resequences activation band (137–140), integrate @ 151, potentiate @ 160; moves `integrated_mobility` → 165; legacy `hip_mobility` → 135.

Data: [`scripts/data/activation-access-cards-45-50.mjs`](../scripts/data/activation-access-cards-45-50.mjs). Generator: [`scripts/generate-103-activation-cards.mjs`](../scripts/generate-103-activation-cards.mjs).

**Subrole bands (Prepare & Access):**

| Subrole | order_index band |
|---------|------------------|
| raise | 100–119 |
| mobilize | 120–139 |
| activate | 140–159 |
| integrate | 160–179 |
| potentiate_bridge | 180–199 |

**Dose-phase escalation (Prepare & Access):**

| Drill type | Prepare & Access cap | Escalates to |
|------------|---------------------|--------------|
| Glute bridge | ≤15 reps; hold ≤30s | Capacity / Control |
| Bridge march | Low-volume pelvic primer | Resilience |
| Dead bug | Low-dose anti-extension | Resilience |
| Bird dog | Crisp reps, low volume | Resilience or Skill |
| Mini-band lateral walk | ≤12 steps each direction | Capacity / Control if high volume |
| A-March | Slow, technical primer | Movement Intelligence if fast |

**Validation rule:** `prepare_activation_readiness` — activation should improve position and readiness without fatigue before Skill or Output. Rules: `prepare_glute_bridge_dose`, `prepare_mini_band_lateral_dose`, `prepare_amarch_after_conditioning`, `prepare_amarch_skill_phase`, `prepare_activation_pelvic_floor`.

**Prepare & Access library (cards 1–50) is complete.** Principle: athletes should be warmer, sharper, more mobile, and more ready — not tired.

## 9. Movement Intelligence

**Phase goal:** Teach coordination, perception-action, tumbling foundations, sprint mechanics, landing skill, rhythm, reaction, balance, and body-shape control while the athlete is still fresh. Prepare & Access gives positions; Skill teaches what to do with those positions; Output expresses skills at higher speed and power.

**Placement:** Prepare & Access → **Movement Intelligence** → Output → Capacity → Resilience → Sustained Capacity → Restore

**Subroles** ([104](../backend/migrations/104_coaching_skill_phase_infrastructure.sql)):

| Subrole | order_index band | Purpose |
|---------|------------------|---------|
| `shape_position_intelligence` | 211–219 | Body lines, shapes, posture, trunk control |
| `rotation_inversion_tumbling_foundations` | 221–232 | Rolling, inversion, hand support, tumbling prerequisites |
| `locomotion_sprint_mechanics` | 233–240 | Sprint posture, rhythm, foot strike, acceleration shapes |
| `balance_coordination_rhythm` | 260–268 | Timing, foot placement, balance, sequencing |
| `perception_action_reactive_movement` | 280–285 | Decision-making coupled with movement |

### 9.1 Phase intent variants (dual profiles)

Some drills span phases by intent, not by creating duplicate exercises. Use multiple `exercise_phase_profile` rows on one slug:

| Example slug | Prepare & Access | Movement Intelligence | Output |
|--------------|------------------|-------------------------------|--------|
| `a-march` | `marching_mechanics` / potentiate_bridge, RPE 2–4 | `technical_march` / locomotion_sprint_mechanics, RPE 2–5 | — |
| `low-pogos` | `low_level_plyo_prep` | — | `elastic_prep` |

Document intent in `phase_profile.notes` and dosage RPE bands. Prepare slot `marching_mechanics` is globally unique; Skill uses `technical_march` ([104](../backend/migrations/104_coaching_skill_phase_infrastructure.sql)).

### 9.2 Shape & position cards 1–10

Thin seed: [105](../backend/migrations/105_coaching_movement_intelligence_seed.sql). Rich pass: [106](../backend/migrations/106_coaching_skill_shape_cards.sql). Data: [`scripts/data/skill-shape-cards-1-10.mjs`](../scripts/data/skill-shape-cards-1-10.mjs).

| # | Slug | Slot | session_need tags |
|---|------|------|-------------------|
| 1 | `hollow-body-hold` | `hollow_shape` | tumbling_prep, landing_prep, general_warmup |
| 2 | `arch-body-hold` | `arch_shape` | tumbling_prep, landing_prep, general_warmup |
| 3 | `hollow-to-arch-roll` | `shape_transition` | tumbling_prep, general_warmup |
| 4 | `tuck-hold-rock` | `tuck_shape` | tumbling_prep, landing_prep, general_warmup |
| 5 | `pike-fold-tall-sit` | `pike_shape` | tumbling_prep, general_warmup |
| 6 | `straddle-sit-reach-lift` | `straddle_shape` | tumbling_prep, general_warmup |
| 7 | `front-support-shape-hold` | `support_shape` | tumbling_prep, landing_prep, general_warmup |
| 8 | `rear-support-shape-hold` | `support_shape` | tumbling_prep, general_warmup |
| 9 | `wall-body-line-drill` | `line_drill` | tumbling_prep, sprint_prep, general_warmup |
| 10 | `stick-to-shape-freeze-game` | `shape_reaction` | tumbling_prep, general_warmup |

**Dose-phase escalation (Movement Intelligence):**

| Drill type | Skill cap | Escalates to |
|------------|-----------|--------------|
| Static shape hold | ≤30 seconds | Resilience |
| Shape reaction game | Low volume, full rest | Sustained Capacity if conditioning |
| Tumbling foundation | Fresh, supervised | Capacity if high volume |

**Validation rules:** `movement_intelligence_readiness` (phase), `skill_shape_readiness` (shape cluster), `skill_tumbling_readiness` (tumbling cluster), `skill_sprint_readiness` (sprint mechanics cluster), `skill_balance_readiness` (balance cluster), `skill_perception_readiness` (perception cluster). Rules: `skill_block_fatigue`, `skill_tumbling_after_fitness`, `skill_balance_after_fitness`, `skill_reactive_after_fitness`, `skill_agility_conditioning_dose`, `skill_ladder_pass_volume`, `skill_skipping_high_intensity`, `skill_mirror_shuffle_prerequisite`, `skill_mirror_round_duration`, `skill_tag_game_conditioning`, `skill_tag_unsafe_contact`, `skill_ball_drop_diving`, `skill_reactive_output_intent`, `skill_sprint_max_speed`, `skill_shape_hold_duration`, plus tumbling cluster rules (`skill_roll_mat_required`, `skill_forward_roll_prerequisite`, `skill_backward_roll_progression`, `skill_backward_roll_neck_stop`, `skill_shoulder_roll_surface`, `skill_handstand_endurance`, `skill_donkey_kick_volume`, `skill_cartwheel_hand_placement`, `skill_cartwheel_finish`, `skill_roundoff_prerequisite`, `skill_hurdle_entry_balance`, `skill_rotational_stop`), plus sprint cluster rules (`skill_sprint_iso_hold_duration`, `skill_sprint_switch_volume`, `skill_sprint_high_intensity_drill`, `skill_sprint_toe_down`, `skill_sprint_backward_lean`, `skill_sprint_hip_projection`, `skill_sprint_falling_hinge`, `skill_sprint_start_overreach`, `skill_sprint_arm_midline`, `skill_sprint_after_fitness`, `skill_sprint_before_tumbling_fatigue`, `skill_sprint_missing_prep_before_output`).

**Roadmap:** All **50** Movement Intelligence cards have rich passes in migrations **106–110**. Phase complete.

### 9.3 Rotation / tumbling cards 11–24

Thin seed: [105](../backend/migrations/105_coaching_movement_intelligence_seed.sql). Rich pass: [107](../backend/migrations/107_coaching_skill_tumbling_cards.sql). Data: [`scripts/data/skill-tumbling-cards-11-24.mjs`](../scripts/data/skill-tumbling-cards-11-24.mjs).

| # | Slug | Slot | session_need tags |
|---|------|------|-------------------|
| 11 | `log-roll` | `rolling_foundation` | tumbling_prep, landing_prep, general_warmup |
| 12 | `egg-roll` | `rolling_foundation` | tumbling_prep, landing_prep, general_warmup |
| 13 | `rock-and-roll-to-stand` | `roll_to_stand` | tumbling_prep, landing_prep, general_warmup |
| 14 | `forward-roll-progression` | `forward_roll` | tumbling_prep, landing_prep, general_warmup |
| 15 | `backward-roll-progression` | `backward_roll` | tumbling_prep, landing_prep, general_warmup |
| 16 | `shoulder-roll-progression` | `shoulder_roll` | tumbling_prep, landing_prep, general_warmup |
| 17 | `donkey-kick` | `hand_support_inversion` | tumbling_prep, landing_prep, general_warmup |
| 18 | `wall-walk-handstand-line` | `handstand_line` | tumbling_prep, landing_prep, general_warmup |
| 19 | `handstand-kick-up-wall` | `handstand_entry` | tumbling_prep, landing_prep, general_warmup |
| 20 | `cartwheel` | `cartwheel_foundation` | tumbling_prep, landing_prep, general_warmup |
| 21 | `cartwheel-step-over` | `cartwheel_foundation` | tumbling_prep, landing_prep, general_warmup |
| 22 | `cartwheel-finish-lunge` | `cartwheel_finish` | tumbling_prep, landing_prep, general_warmup |
| 23 | `round-off` | `roundoff_foundation` | tumbling_prep, landing_prep, general_warmup |
| 24 | `hurdle-step-lunge` | `hurdle_entry` | tumbling_prep, landing_prep, general_warmup |

Legacy slugs `cartwheel` and `round-off` are enriched in place (not duplicated). Cards 11–12 share slot `rolling_foundation` (221); cards 20–21 share `cartwheel_foundation` (229).

**Equipment taxonomy (107):** `wedge`, `panel_mat`, `line_tape` added to `coaching.equipment`.

**Dose-phase escalation (Rotation / Tumbling Foundations):**

| Drill type | Skill cap | Escalates to |
|------------|-----------|--------------|
| Rolling foundations | Low reps, mat required | Capacity if high volume |
| Forward/backward roll | Supervised, ≤8 attempts | — |
| Handstand line/kick-up | ≤20s hold | Resilience |
| Donkey kick | ≤10 reps/block | Conditioning elsewhere |
| Round-off snap-down | Technical, not max power | Output |

**Validation rule:** `skill_tumbling_readiness` — tumbling foundations should occur while fresh with gated progressions and safe surfaces. Implemented in `analyzeSkillTumblingReadiness` ([workoutValidation.js](../backend/platform/workoutValidation.js)).

### 9.4 Locomotion / sprint cards 25–34

Thin seed: [105](../backend/migrations/105_coaching_movement_intelligence_seed.sql). Rich pass: [108](../backend/migrations/108_coaching_skill_sprint_cards.sql). Data: [`scripts/data/skill-sprint-cards-25-34.mjs`](../scripts/data/skill-sprint-cards-25-34.mjs).

| # | Slug | Slot | session_need tags |
|---|------|------|-------------------|
| 25 | `wall-drill-split-shin-hold` | `sprint_iso` | sprint_prep, general_warmup |
| 26 | `wall-drill-march` | `sprint_mechanics` | sprint_prep, general_warmup |
| 27 | `wall-drill-switch` | `sprint_mechanics` | sprint_prep, general_warmup |
| 28 | `a-march` | `technical_march` | sprint_prep, general_warmup |
| 29 | `a-skip` | `sprint_rhythm` | sprint_prep, general_warmup |
| 30 | `ankling-dribble-march` | `foot_strike_skill` | sprint_prep, general_warmup |
| 31 | `straight-leg-bound-march` | `frontside_mechanics` | sprint_prep, general_warmup |
| 32 | `falling-start-hold` | `acceleration_position` | sprint_prep, general_warmup |
| 33 | `two-point-start-walk-in` | `acceleration_entry` | sprint_prep, general_warmup |
| 34 | `arm-action-drill` | `arm_action` | sprint_prep, general_warmup |

Cards 26–27 share slot `sprint_mechanics` (234). **`a-march` dual profile:** Prepare/Access primary stays `prepare_and_access` / `marching_mechanics`; Skill profile uses `technical_march` (108 does not overwrite primary phase columns).

**Equipment taxonomy (108):** `mirror` added to `coaching.equipment` (optional arm-action feedback). Wall drills tag `wall` (seeded in Prepare migrations).

**Dose-phase escalation (Locomotion & Sprint Mechanics):**

| Drill type | Skill cap | Escalates to |
|------------|-----------|--------------|
| Wall ISO hold | ≤8s per side | Resilience |
| Wall switch | Crisp, low volume | Output if maximal |
| A-Skip / straight-leg prep | Rhythm-first, short distance | Output if high intent |
| Falling start / two-point walk-in | Technical setup | Output if timed or >5 yards |
| Arm action | Low duration, quiet torso | — |

**Validation rule:** `skill_sprint_readiness` — sprint mechanics should sharpen posture and rhythm while fresh, not become max-speed work or conditioning. Implemented in `analyzeSkillSprintReadiness` and `analyzeSprintPrepBeforeOutput` ([workoutValidation.js](../backend/platform/workoutValidation.js)).

### 9.5 Balance / coordination / rhythm cards 35–44

Thin seed: [105](../backend/migrations/105_coaching_movement_intelligence_seed.sql). Rich pass: [109](../backend/migrations/109_coaching_skill_balance_cards.sql). Data: [`scripts/data/skill-balance-cards-35-44.mjs`](../scripts/data/skill-balance-cards-35-44.mjs).

| # | Slug | Slot | session_need tags |
|---|------|------|-------------------|
| 35 | `beam-walk` | `narrow_base_balance` | general_warmup, landing_prep, sprint_prep |
| 36 | `single-leg-balance-clock` | `single_leg_balance_skill` | general_warmup, landing_prep, sprint_prep |
| 37 | `cross-crawl-march` | `cross_body_coordination` | general_warmup, landing_prep, sprint_prep |
| 38 | `skipping-rhythm-drill` | `rhythm_locomotion` | general_warmup, landing_prep, sprint_prep |
| 39 | `carioca-walkthrough` | `transverse_coordination` | general_warmup, landing_prep, sprint_prep |
| 40 | `lateral-shuffle-walkthrough` | `lateral_movement_skill` | general_warmup, landing_prep, sprint_prep |
| 41 | `backpedal-walkthrough` | `backward_locomotion` | general_warmup, landing_prep, sprint_prep |
| 42 | `ladder-in-in-out-out` | `footwork_rhythm` | general_warmup, landing_prep, sprint_prep |
| 43 | `ladder-ickey-shuffle` | `footwork_rhythm` | general_warmup, landing_prep, sprint_prep |
| 44 | `low-hurdle-step-over` | `step_over_coordination` | general_warmup, landing_prep, sprint_prep |

Migration 109 resequences balance slots to band **260–268** (after perception 251–256). Cards 42–43 share slot `footwork_rhythm` (267).

**Equipment taxonomy (109):** `agility_ladder`, `low_hurdles` added to `coaching.equipment` (`line_tape` from 107; `beam` from base taxonomy).

**Dose-phase escalation (Balance / Coordination / Rhythm):**

| Drill type | Skill cap | Escalates to |
|------------|-----------|--------------|
| Beam / line walk | Low passes, floor first | Output if speed challenge |
| Single-leg reach clock | Clean taps, moderate reach | Control if loaded/high volume |
| Skipping rhythm | RPE ≤5, quiet contacts | Output if power skips |
| Ladder rhythm | ~4 passes/pattern, full rest | Sustained Capacity if circuits |
| Low hurdle step-over | Clean clearance, slow tempo | Output if hurdle hops |

**Validation rule:** `skill_balance_readiness` — balance, coordination, and rhythm drills should improve movement quality at low fatigue, not become conditioning or reactive agility without perception cues. Implemented in `analyzeSkillMovementIntelligenceReadiness` ([workoutValidation.js](../backend/platform/workoutValidation.js)).

### 9.6 Perception-action / reactive movement cards 45–50

Thin seed: [105](../backend/migrations/105_coaching_movement_intelligence_seed.sql). Rich pass: [110](../backend/migrations/110_coaching_skill_perception_cards.sql). Data: [`scripts/data/skill-perception-cards-45-50.mjs`](../scripts/data/skill-perception-cards-45-50.mjs).

| # | Slug | Slot | session_need tags |
|---|------|------|-------------------|
| 45 | `mirror-shuffle-drill` | `mirror_reaction` | general_warmup, sprint_prep, landing_prep |
| 46 | `coach-point-and-go` | `visual_reaction` | general_warmup, sprint_prep, landing_prep |
| 47 | `colored-cone-call-out` | `visual_decision` | general_warmup, sprint_prep, landing_prep |
| 48 | `ball-drop-reaction` | `object_reaction` | general_warmup, sprint_prep, landing_prep |
| 49 | `partner-shadow-tag` | `movement_game` | general_warmup, sprint_prep, landing_prep |
| 50 | `gate-reaction-drill` | `reactive_start` | general_warmup, sprint_prep, landing_prep |

Migration 110 resequences perception slots to band **280–285** (after balance 260–268). Completes the 50-card Movement Intelligence library.

**Equipment taxonomy (110):** `tennis_ball`, `reaction_ball`. Color cone drills tag `cones` with `setup_requirements` for visually distinguishable markers.

**Dose-phase escalation (Perception-Action / Reactive Movement):**

| Drill type | Skill cap | Escalates to |
|------------|-----------|--------------|
| Mirror shuffle | ≤15s rounds, shuffle prep first | Output if competitive max speed |
| Coach point-and-go | 2–4 directions, clean stops | Output if sprint exits |
| Color cone call-out | Short cues, controlled stops | Sustained Capacity if shuttle circuits |
| Ball drop | No diving, full rest | Output if max accelerations |
| Partner tag/shadow | ≤12s rounds, clear rules | Sustained Capacity if long chaotic rounds |
| Gate reaction | Cue-read + first step | Output if timed max sprint |

**Validation rule:** `skill_perception_readiness` — reactive drills should improve see-decide-move quality while fresh, not become conditioning games or unsafe contact. Implemented in `analyzeSkillPerceptionReadiness` ([workoutValidation.js](../backend/platform/workoutValidation.js)).

## 10. Output

**Phase goal:** Express speed, explosiveness, elastic stiffness, plyometric power, reactive strength, jump/throw power, deceleration quality, COD power, and high-intensity reactive agility while the athlete is fresh. Skill teaches the pattern; **Output expresses the pattern fast, powerfully, and with intent.**

**Placement:** Prepare & Access → Movement Intelligence → **Output** → Capacity → Resilience → Sustained Capacity → Restore

**Subroles** ([111](../backend/migrations/111_coaching_output_phase_infrastructure.sql)):

| Subrole | order_index band | Cards |
|---------|------------------|-------|
| `acceleration_start_speed` | 311–316 | 1–10 |
| `max_velocity_exposure` | 321–325 | 11–18 |
| `elastic_stiffness_plyometric_rudiments` | 331–337 | 19–27 |
| `jump_throw_explosive_power` | 341–347 | 28–38 |
| `deceleration_cod_power` | 351–354 | 39–45 |
| `reactive_agility_tumbling_output` | 361–365 | 46–50 |

**Dosing principles:** Low reps, low total volume, high rest, high intent (RPE 7–9). Track plyometric **contacts** where applicable. Regimen: `can_be_daily = false`, `minimum_hours_between_hard_exposures = 48`, `counts_as_neural` and `counts_as_high_intensity = true`.

**Output vs Sustained Capacity:** A sprint is Output when distance is short, intent is high, recovery is full, and speed stays high. It becomes Sustained Capacity when rest is short, reps accumulate, speed drops, and the goal is repeatability under fatigue.

**Validation rule:** `output_readiness` — implemented in `analyzeOutputReadiness` ([workoutValidation.js](../backend/platform/workoutValidation.js)). Key rules: `output_after_fitness` (error), `output_after_capacity`, `output_high_rpe_short_rest`, `output_plyo_contact_volume`, `output_advanced_plyo_prerequisite`, `output_tumbling_missing_skill_prereq`, `output_roundoff_rebound_prerequisite`, `output_cod_missing_decel_prerequisite`.

**Seed library:** [112](../backend/migrations/112_coaching_output_seed.sql) — 50 published Output exercises. Generator: [scripts/generate-111-output-seed.mjs](../scripts/generate-111-output-seed.mjs).

### 10.1 Acceleration & Start Speed (cards 1–10)

Rich pass in [113](../backend/migrations/113_coaching_output_acceleration_cards.sql) — Falling Start through Low-Incline Hill Sprint (`acceleration_start_speed`, slots 311–316). Equipment taxonomy: `incline_surface`, `harness`. Validation education: `output_acceleration_readiness`; validator `analyzeOutputAccelerationReadiness`. Key rules: `output_acceleration_after_fitness`, `output_acceleration_after_capacity`, `output_acceleration_distance`, `output_acceleration_short_rest`, `output_three_point_beginner`, `output_prone_start_substitution`, `output_half_kneeling_substitution`, `output_partner_chase_group`, `output_resisted_load_check`, `output_hill_surface_check`, `output_acceleration_decel_prerequisite`, `output_acceleration_quality_stop`. Generator: [scripts/generate-113-output-acceleration-cards.mjs](../scripts/generate-113-output-acceleration-cards.mjs). Data: [scripts/data/output-acceleration-cards-1-10.mjs](../scripts/data/output-acceleration-cards-1-10.mjs).

### 10.2 Max-Velocity Exposure (cards 11–18)

Rich pass in [114](../backend/migrations/114_coaching_output_max_velocity_cards.sql) — Build-Up Sprint through Curved Sprint / Arc Run (`max_velocity_exposure`, slots 321–325). Equipment taxonomy: `wickets`, `timing_gates`. Validation education: `output_max_velocity_readiness`; validator `analyzeOutputMaxVelocityReadiness`. Generator: [scripts/generate-114-output-max-velocity-cards.mjs](../scripts/generate-114-output-max-velocity-cards.mjs). Data: [scripts/data/output-max-velocity-cards-11-18.mjs](../scripts/data/output-max-velocity-cards-11-18.mjs).

### 10.3 Elastic Stiffness / Plyometric Rudiments (cards 19–27)

Rich pass in [115](../backend/migrations/115_coaching_output_elastic_cards.sql) — Fast Low Pogos through Hurdle Hop Series (`elastic_stiffness_plyometric_rudiments`, slots 331–337: `elastic_ankle`, `lateral_elastic`, `single_leg_elastic`, `landing_to_output`, `drop_landing`, `drop_rebound`, `repeated_elastic_hop`). Equipment taxonomy: `line_tape`, `low_hurdles`, `box`. Validation education: `output_elastic_readiness`; validator `analyzeOutputElasticReadiness`. Key rules: `output_elastic_after_fitness`, `output_elastic_after_capacity`, `output_elastic_contact_volume`, `output_elastic_pogo_quality_stop`, `output_elastic_lateral_knee_valgus`, `output_elastic_single_leg_prerequisite`, `output_elastic_snap_rebound_prerequisite`, `output_elastic_drop_box_height`, `output_elastic_depth_rebound_beginner`, `output_elastic_hurdle_clips`, `output_elastic_short_rest`, `output_elastic_landing_quality_stop`. Generator: [scripts/generate-115-output-elastic-cards.mjs](../scripts/generate-115-output-elastic-cards.mjs). Data: [scripts/data/output-elastic-cards-19-27.mjs](../scripts/data/output-elastic-cards-19-27.mjs).

### 10.4 Jump, Throw & Explosive Power (cards 28–38)

Rich pass in [117](../backend/migrations/117_coaching_output_jump_power_cards.sql) — Countermovement Vertical Jump through Medicine Ball Shot-Put Throw (`jump_throw_explosive_power`, slots 341–347: `vertical_jump_power`, `horizontal_jump_power`, `lateral_jump_power`, `split_jump_power`, `upper_body_power`, `total_body_power`, `rotational_power`). Equipment taxonomy: `slam_ball`, `jump_mat` (`medicine_ball` already in base taxonomy). Validation education: `output_jump_power_readiness`; validator `analyzeOutputJumpPowerReadiness`. Key rules: `output_jump_power_after_fitness`, `output_jump_power_quality_stop`, `output_jump_power_landing_regress`, `output_jump_power_cmj_volume`, `output_jump_power_squat_jump_dip`, `output_jump_power_broad_stick_fail`, `output_jump_power_broad_rebound_prerequisite`, `output_jump_power_lateral_knee_regress`, `output_jump_power_skater_prerequisite`, `output_jump_power_split_landing_regress`, `output_jump_power_med_ball_slow`, `output_jump_power_slam_rib_flare`, `output_jump_power_rotational_low_back_stop`, `output_jump_power_unsafe_throw_area`, `output_jump_power_youth_med_ball_confirm`. Generator: [scripts/generate-117-output-jump-power-cards.mjs](../scripts/generate-117-output-jump-power-cards.mjs). Data: [scripts/data/output-jump-power-cards-28-38.mjs](../scripts/data/output-jump-power-cards-28-38.mjs).

### 10.5 Deceleration / COD Power (cards 39–45)

Rich pass in [118](../backend/migrations/118_coaching_output_decel_cod_cards.sql) — Sprint to Stick through Curved Run to Cut (`deceleration_cod_power`, slots 351–354: `linear_deceleration`, `lateral_deceleration`, `cod_power`, `curved_to_cut`). Card `movement_requirements` includes optional `setup_metadata` and `cod_stress_profile` (approach velocity, cut angle category, braking plane, plant type, exit type). Validation education: `output_decel_cod_readiness`; validator `analyzeOutputDecelCodReadiness`. Key rules: `output_decel_cod_after_fitness`, `output_decel_cod_after_capacity`, `output_decel_cod_linear_prerequisite`, `output_decel_cod_accel_extra_steps`, `output_decel_cod_lateral_valgus`, `output_decel_cod_pro_agility_short_rest`, `output_decel_cod_pro_agility_not_reactive`, `output_decel_cod_90cut_prerequisite`, `output_decel_cod_180_beginner`, `output_decel_cod_angle_velocity`, `output_decel_cod_unsafe_surface`, `output_decel_cod_curve_safety`, `output_decel_cod_tissue_warning`, `output_decel_cod_exit_deceleration`, `output_decel_cod_plant_quality_stop`. Generator: [scripts/generate-118-output-decel-cod-cards.mjs](../scripts/generate-118-output-decel-cod-cards.mjs). Data: [scripts/data/output-decel-cod-cards-39-45.mjs](../scripts/data/output-decel-cod-cards-39-45.mjs).

### 10.6 High-Intensity Reactive Agility & Tumbling Output (cards 46–50)

Rich pass in [119](../backend/migrations/119_coaching_output_reactive_tumbling_cards.sql) — Reactive Gate Sprint through Round-Off Rebound / Snap-Down to Stick (`reactive_agility_tumbling_output`, slots 361–365: `reactive_sprint`, `reactive_agility_output`, `object_reaction_output`, `tumbling_takeoff_output`, `tumbling_rebound_output`). Completes the 50-card Output library. Card `movement_requirements` includes `setup_metadata`, `setup_requirements`, and `reactive_output_profile`. Equipment taxonomy: `spring_floor` (`tennis_ball`, `reaction_ball`, `panel_mat` already in base taxonomy). Validation education: `output_reactive_tumbling_readiness`; validator `analyzeOutputReactiveTumblingReadiness`. Key rules: `output_reactive_tumbling_after_fitness`, `output_reactive_tumbling_after_capacity`, `output_reactive_tumbling_no_cue`, `output_reactive_tumbling_collision`, `output_reactive_tumbling_no_decel_zone`, `output_reactive_tumbling_mirror_prerequisite`, `output_reactive_tumbling_mirror_long_round`, `output_reactive_tumbling_diving`, `output_reactive_tumbling_ball_decel`, `output_reactive_tumbling_hurdle_prerequisite`, `output_reactive_tumbling_hurdle_front_foot`, `output_reactive_tumbling_roundoff_prerequisite`, `output_reactive_tumbling_roundoff_quality_stop`, `output_reactive_tumbling_surface`, `output_reactive_tumbling_tissue_warning`, `output_reactive_tumbling_volume_high`, `output_reactive_tumbling_guessing`, `output_reactive_tumbling_fear_stop`, `output_reactive_tumbling_quality_stop`. Generator: [scripts/generate-119-output-reactive-tumbling-cards.mjs](../scripts/generate-119-output-reactive-tumbling-cards.mjs). Data: [scripts/data/output-reactive-tumbling-cards-46-50.mjs](../scripts/data/output-reactive-tumbling-cards-46-50.mjs).

---

## 11. Capacity

**Phase goal:** Build the athlete’s ability to produce, tolerate, and progressively adapt to force — strength, muscle/tendon capacity, grip, trunk bracing, and targeted tissue work.

**Placement:** Prepare → Skill → Output → **Capacity** → Resilience → Sustained Capacity → Restore. Capacity is not Sustained Capacity: the same goblet squat becomes Capacity with progressive load and full rest, or Sustained Capacity in a short-rest circuit.

**Subroles** ([120](../backend/migrations/120_coaching_capacity_phase_infrastructure.sql)):

| Subrole | order_index | Cards |
|---------|-------------|-------|
| `squat_knee_dominant_strength` | 410 | 1–10 |
| `hinge_posterior_chain_strength` | 420 | 11–18 |
| `upper_body_push_strength` | 430 | 19–26 |
| `pull_hang_grip_strength` | 440 | 27–36 |
| `carry_trunk_loaded_bracing_strength` | 450 | 37–44 |
| `tissue_capacity_isometric_eccentric_accessory` | 460 | 45–50 |

**Fine slots (411–466):** `squat_strength`, `squat_regression`, `front_loaded_squat`, `split_stance_strength`, `lunge_strength`, `step_up_strength`, `frontal_plane_strength`, `loaded_drive_strength`, `deadlift_strength`, `hinge_strength`, `single_leg_hinge`, `hip_extension_strength`, `hamstring_capacity`, `hamstring_eccentric`, `posterior_chain_capacity`, `pushup_regression`, `horizontal_push_strength`, `push_eccentric`, `vertical_push_strength`, `inverted_push_strength`, `support_strength`, `horizontal_pull_strength`, `single_arm_pull_strength`, `row_strength`, `vertical_pull_progression`, `vertical_pull_eccentric`, `vertical_pull_strength`, `scapular_pull_strength`, `hang_grip_capacity`, `climb_grip_strength`, `loaded_carry`, `anti_lateral_flexion_carry`, `front_loaded_carry`, `overhead_carry`, `anti_rotation_strength`, `rotational_trunk_strength`, `quad_tendon_capacity`, `split_stance_isometric`, `adductor_capacity`, `shin_capacity`, `soleus_capacity`, `wrist_forearm_capacity`.

**Dosing principles:** Progressive overload via load, reps, sets, ROM, tempo, pause, unilateral demand, or grip — not short-rest conditioning. Main strength: 2–5 × 3–12 with full rest; tissue isometrics: 2–5 × 10–45s; carries: 2–6 × 10–60 yards.

**Validation rule:** `capacity_readiness` — `analyzeCapacityReadiness` in [workoutValidation.js](../backend/platform/workoutValidation.js). Key rules: `capacity_before_output`, `capacity_heavy_lower_before_max_velocity`, `capacity_youth_heavy_load_confirm`, `capacity_eccentric_volume`, `capacity_nordic_beginner`, `capacity_pullup_regression`, `capacity_dead_hang_shoulder`, `capacity_carry_posture`, `capacity_overhead_carry_mobility`, `capacity_sled_posture`, `capacity_short_rest_density`, `capacity_load_progression`, `capacity_joint_pain_substitution`. Cluster-specific tissue rules live in `analyzeCapacityTissueReadiness` (`capacity_tissue_readiness`).

**Seed library:** [121](../backend/migrations/121_coaching_capacity_seed.sql) — 50 exercises (thin card v2). Generator: [scripts/generate-121-capacity-seed.mjs](../scripts/generate-121-capacity-seed.mjs). Data: [scripts/data/capacity-movements-top-50.mjs](../scripts/data/capacity-movements-top-50.mjs).

### 11.1 Squat / Knee-Dominant Strength (cards 1–10)

Rich pass in [122](../backend/migrations/122_coaching_capacity_squat_cards.sql) — Goblet Squat through Heavy Sled Push / Sled Drive March (`squat_knee_dominant_strength`, slots 411–418: `squat_strength`, `squat_regression`, `front_loaded_squat`, `split_stance_strength`, `lunge_strength`, `step_up_strength`, `frontal_plane_strength`, `loaded_drive_strength`). Card `movement_requirements` includes `setup_requirements`. Equipment taxonomy: `bench`, `barbell`, `turf`. Validation education: `capacity_squat_readiness`; validator `analyzeCapacitySquatReadiness`. Key rules: `capacity_squat_before_output`, `capacity_squat_youth_load_confirm`, `capacity_squat_goblet_valgus`, `capacity_squat_box_relax`, `capacity_squat_front_rack_pain`, `capacity_squat_split_unstable`, `capacity_squat_rfe_ss_prerequisite`, `capacity_squat_reverse_lunge_midline`, `capacity_squat_step_up_height`, `capacity_squat_groin_stop`, `capacity_squat_cossack_beginner`, `capacity_squat_sled_grind`, `capacity_squat_sled_output_suggest`, `capacity_squat_sled_fitness_suggest`, `capacity_squat_tissue_substitution`. Generator: [scripts/generate-122-capacity-squat-cards.mjs](../scripts/generate-122-capacity-squat-cards.mjs). Data: [scripts/data/capacity-squat-cards-1-10.mjs](../scripts/data/capacity-squat-cards-1-10.mjs).

### 11.2 Hinge / Posterior-Chain Strength (cards 11–18)

Rich pass in [123](../backend/migrations/123_coaching_capacity_hinge_cards.sql) — Kettlebell Deadlift / Trap-Bar Deadlift through Back Extension / Hip Extension (`hinge_posterior_chain_strength`, slots 421–427: `deadlift_strength`, `hinge_strength`, `single_leg_hinge`, `hip_extension_strength`, `hamstring_capacity`, `hamstring_eccentric`, `posterior_chain_capacity`). Card `movement_requirements` includes `setup_requirements`. Equipment taxonomy: `trap_bar`, `sliders`, `towel`, `nordic_bench`, `roman_chair`, `glute_ham_developer`, `dowel`. Validation education: `capacity_hinge_readiness`; validator `analyzeCapacityHingeReadiness`. Key rules: `capacity_hinge_before_output`, `capacity_hinge_before_max_velocity`, `capacity_hinge_deadlift_rounding`, `capacity_hinge_rdl_range`, `capacity_hinge_slrdf_balance`, `capacity_hinge_hip_thrust_lumbar`, `capacity_hinge_good_morning_beginner`, `capacity_hinge_slider_cramp`, `capacity_hinge_nordic_prerequisite`, `capacity_hinge_nordic_volume`, `capacity_hinge_sprint_schedule`, `capacity_hinge_back_extension_dominance`, `capacity_hinge_nerve_symptoms`, `capacity_hinge_tissue_substitution`, `capacity_hinge_short_rest_density`. Generator: [scripts/generate-123-capacity-hinge-cards.mjs](../scripts/generate-123-capacity-hinge-cards.mjs). Data: [scripts/data/capacity-hinge-cards-11-18.mjs](../scripts/data/capacity-hinge-cards-11-18.mjs).

### 11.3 Upper-Body Push Strength (cards 19–26)

Rich pass in [124](../backend/migrations/124_coaching_capacity_push_cards.sql) — Incline Push-Up through Dip Support / Ring Support Hold (`upper_body_push_strength`, slots 431–436: `pushup_regression`, `horizontal_push_strength`, `push_eccentric`, `vertical_push_strength`, `inverted_push_strength`, `support_strength`). Card `movement_requirements` includes `setup_requirements`. Equipment taxonomy: `parallettes`, `parallel_bars` (plus existing `bench`, `rings`). Validation education: `capacity_push_readiness`; validator `analyzeCapacityPushReadiness`. Key rules: `capacity_push_before_hand_support`, `capacity_push_incline_sag`, `capacity_push_pushup_quality_stop`, `capacity_push_pushup_plank_regress`, `capacity_push_eccentric_volume`, `capacity_push_floor_press_setup`, `capacity_push_press_shoulder_pain`, `capacity_push_bench_youth_load`, `capacity_push_overhead_rib_flare`, `capacity_push_pike_prerequisite`, `capacity_push_box_pike_prerequisite`, `capacity_push_support_prerequisite`, `capacity_push_ring_support_stop`, `capacity_push_wrist_pain`, `capacity_push_shoulder_pain`, `capacity_push_short_rest_density`. Generator: [scripts/generate-124-capacity-push-cards.mjs](../scripts/generate-124-capacity-push-cards.mjs). Data: [scripts/data/capacity-push-cards-19-26.mjs](../scripts/data/capacity-push-cards-19-26.mjs).

### 11.4 Pull, Hang & Grip Strength (cards 27–36)

Rich pass in [125](../backend/migrations/125_coaching_capacity_pull_cards.sql) — Ring Row / TRX Row through Rope Climb Foot-Lock Pull / Towel Pull (`pull_hang_grip_strength`, slots 441–449: `horizontal_pull_strength`, `single_arm_pull_strength`, `row_strength`, `vertical_pull_progression`, `vertical_pull_eccentric`, `vertical_pull_strength`, `scapular_pull_strength`, `hang_grip_capacity`, `climb_grip_strength`). Progression gates: rows → assisted vertical → eccentrics → pull-ups → scapular → hang → climb. Card `movement_requirements` includes `setup_requirements`. Equipment taxonomy: `suspension_trainer`, `rack`, `cable_machine`, `assisted_pullup_machine`, `rope`, `pull_up_bar` (plus existing `rings`, `towel`, `bar`). Validation education: `capacity_pull_readiness`; validator `analyzeCapacityPullReadiness`. Key rules: `capacity_pull_before_skill`, `capacity_pull_ring_row_sag`, `capacity_pull_inverted_row_unsafe`, `capacity_pull_db_row_rotation`, `capacity_pull_band_anchor_unsafe`, `capacity_pull_assisted_kipping`, `capacity_pull_assisted_lower`, `capacity_pull_eccentric_beginner`, `capacity_pull_eccentric_fast`, `capacity_pull_pullup_strict`, `capacity_pull_pullup_prerequisite`, `capacity_pull_pullup_kipping`, `capacity_pull_scapular_elbow`, `capacity_pull_hang_stop`, `capacity_pull_grip_failure_before_skill`, `capacity_pull_rope_footlock`, `capacity_pull_rope_grip_failure`, `capacity_pull_rope_setup`, `capacity_pull_tissue_substitution`, `capacity_pull_short_rest_density`. Generator: [scripts/generate-125-capacity-pull-cards.mjs](../scripts/generate-125-capacity-pull-cards.mjs). Data: [scripts/data/capacity-pull-cards-27-36.mjs](../scripts/data/capacity-pull-cards-27-36.mjs).

### 11.5 Carry / Trunk / Loaded-Bracing Strength (cards 37–44)

Rich pass in [126](../backend/migrations/126_coaching_capacity_carry_cards.sql) — Farmer Carry through Tall-Kneeling Cable/Band Chop (`carry_trunk_loaded_bracing_strength`, slots 451–456: `loaded_carry`, `anti_lateral_flexion_carry`, `front_loaded_carry`, `overhead_carry`, `anti_rotation_strength`, `rotational_trunk_strength`). Walking carries use `volume_unit: distance` with integer `default_distance` (yards); Pallof/chop use reps or seconds. Card `movement_requirements` includes `setup_requirements`. Equipment taxonomy: `farmer_handles`, `sandbag`, `axle_bar`, `pad` (plus existing `dumbbell`, `kettlebell`, `barbell`, `cable_machine`, `band`, `handles`). Validation education: `capacity_carry_readiness`; validator `analyzeCapacityCarryReadiness`. Key rules: `capacity_carry_before_skill`, `capacity_carry_fitness_distance`, `capacity_carry_farmer_posture`, `capacity_carry_suitcase_lean`, `capacity_carry_front_rack_rib_flare`, `capacity_carry_bear_hug_fold`, `capacity_carry_zercher_elbow`, `capacity_carry_overhead_prerequisite`, `capacity_carry_overhead_quality_stop`, `capacity_carry_pallof_rotation`, `capacity_carry_anchor_unsafe`, `capacity_carry_chop_hip_shift`, `capacity_carry_tissue_substitution`, `capacity_carry_grip_not_target`, `capacity_carry_after_grip_hang`, `capacity_carry_short_rest_density`. Generator: [scripts/generate-126-capacity-carry-cards.mjs](../scripts/generate-126-capacity-carry-cards.mjs). Data: [scripts/data/capacity-carry-cards-37-44.mjs](../scripts/data/capacity-carry-cards-37-44.mjs).

### 11.6 Tissue Capacity — Isometric, Eccentric & Accessory Strength (cards 45–50)

Rich pass in [127](../backend/migrations/127_coaching_capacity_tissue_cards.sql) — Spanish Squat Isometric through Wrist / Forearm Capacity Series (`tissue_capacity_isometric_eccentric_accessory`, slots 461–466: `quad_tendon_capacity`, `split_stance_isometric`, `adductor_capacity`, `shin_capacity`, `soleus_capacity`, `wrist_forearm_capacity`). Completes the 50-card Capacity library. Isometric holds use `volume_unit: seconds`; tibialis and soleus use reps; wrist series uses `reps_or_seconds`. Card `movement_requirements` includes `setup_requirements`. Equipment taxonomy: `strap`, `tib_bar`, `calf_raise_machine`, `wrist_roller`, `rice_bucket`, `grip_tool` (plus existing `bands`, `rack`, `wall`, `bench`, `dumbbell`, `handles`). Validation education: `capacity_tissue_readiness`; validator `analyzeCapacityTissueReadiness`. Key rules: `capacity_tissue_before_output`, `capacity_tissue_spanish_anchor_unsafe`, `capacity_tissue_spanish_knee_stop`, `capacity_tissue_split_iso_valgus`, `capacity_tissue_copenhagen_beginner`, `capacity_tissue_copenhagen_groin_stop`, `capacity_tissue_tibialis_shin_stop`, `capacity_tissue_tibialis_before_sprint`, `capacity_tissue_soleus_achilles_stop`, `capacity_tissue_soleus_before_elastic`, `capacity_tissue_wrist_before_skill`, `capacity_tissue_wrist_stop`, `capacity_tissue_grip_consecutive_days`, `capacity_tissue_daily_hard`, `capacity_tissue_pain_substitution`. Generator: [scripts/generate-127-capacity-tissue-cards.mjs](../scripts/generate-127-capacity-tissue-cards.mjs). Data: [scripts/data/capacity-tissue-cards-45-50.mjs](../scripts/data/capacity-tissue-cards-45-50.mjs).

## 12. Resilience

**Phase goal:** Build precision — landing and braking quality, single-leg balance, trunk/pelvis anti-movement control, hand-support resilience, and slow eccentric/isometric joint tolerance — without stealing Output speed or Sustained Capacity conditioning intent.

**Placement:** Prepare → Skill → Output → Capacity → **Resilience** → Sustained Capacity → Restore. Hard Control work belongs after Output and Capacity; daily-safe drills (dead bug, bird dog, Pallof hold, light balance, tibialis ISO) may appear elsewhere at low intensity.

**Subroles** ([128](../backend/migrations/128_coaching_control_resilience_phase_infrastructure.sql)):

| Subrole | order_index | Cards |
|---------|-------------|-------|
| `landing_braking_control` | 510 | 1–10 |
| `single_leg_balance_foot_ankle_hip_control` | 520 | 11–20 |
| `trunk_pelvis_anti_movement_control` | 530 | 21–30 |
| `scapular_wrist_hand_support_resilience` | 540 | 31–40 |
| `slow_eccentric_isometric_joint_resilience` | 550 | 41–50 |

**Fine slots (511–560):** `bilateral_landing_control`, `snapdown_landing_control`, `drop_landing_control`, `forward_landing_control`, `lateral_landing_control`, `single_leg_landing_control`, `braking_position_control`, `linear_deceleration_control`, `lateral_deceleration_control`, `backward_deceleration_control`, `single_leg_static_balance`, `single_leg_reach_control`, `multi_direction_reach_control`, `single_leg_hinge_control`, `hip_rotation_balance_control`, `eccentric_stepdown_control`, `frontal_plane_stepdown_control`, `single_leg_squat_control`, `perturbation_balance`, `narrow_base_balance_control`, `anti_extension_control`, `loaded_anti_extension_control`, `contralateral_trunk_control`, `anterior_trunk_control`, `lateral_trunk_control`, `quadruped_trunk_control`, `anti_rotation_quadruped_control`, `dynamic_anti_rotation_control`, `anti_rotation_hold`, `half_kneeling_trunk_control`, `scapular_quadruped_control`, `scapular_posterior_chain_control`, `plank_shoulder_control`, `crawling_control`, `posterior_support_control`, `handstand_line_control`, `overhead_scapular_control`, `handstand_eccentric_control`, `straight_arm_support_control`, `wrist_support_control`, `split_stance_eccentric_control`, `frontal_plane_isometric_control`, `deep_frontal_plane_control`, `adductor_isometric_control`, `hamstring_bridge_control`, `hamstring_eccentric_control`, `gastroc_isometric_control`, `soleus_isometric_control`, `tibialis_isometric_control`, `hamstring_isometric_resilience`.

**Slug strategy:** All 50 cards use Control-specific slugs even when cousins exist in other phases (e.g. `snap-down-to-stick-control-version` vs Output `snap-down-to-stick`; `dead-bug-heel-tap-control-progression` vs Prepare `dead-bug-heel-tap`). Cross-phase prerequisites live in `pairing_logic`, not shared slugs.

**Dosing principles:** Low volume, full rest, clean shapes — holds in seconds, landing sticks in reps or attempts, not short-rest circuits. `can_be_daily = true` only for daily-safe slugs (dead bug, bird dog, Pallof hold, wrist support, SL balance, tibialis ISO, beam freeze, light landing shape); hard resilience (SL hop to stick, Nordic lean ISO, ring support, perturbation) is not daily.

**Validation rule:** `control_resilience_readiness` — `analyzeControlResilienceReadiness` in [controlResilienceValidation.js](../backend/platform/controlResilienceValidation.js) (wired from [workoutValidation.js](../backend/platform/workoutValidation.js)). Key rules: `control_resilience_before_output`, `control_resilience_after_fitness_landing`, `control_resilience_landing_valgus`, `control_resilience_sl_hop_prerequisite`, `control_resilience_decel_high_speed`, `control_resilience_decel_short_rest`, `control_resilience_balance_flail`, `control_resilience_perturbation_beginner`, `control_resilience_trunk_rib_flare`, `control_resilience_plank_shoulder_fatigue`, `control_resilience_hand_wrist_pain`, `control_resilience_handstand_prerequisite`, `control_resilience_wall_walk_beginner`, `control_resilience_ring_support_drift`, `control_resilience_wrist_sharp_pain`, `control_resilience_split_squat_valgus`, `control_resilience_groin_frontal_stop`, `control_resilience_hamstring_sharp_stop`, `control_resilience_lower_leg_before_output`, `control_resilience_short_rest_density`, `control_resilience_tissue_substitution`.

**Seed library:** [129](../backend/migrations/129_coaching_control_resilience_seed.sql) — 50 exercises (thin card v2). Generator: [scripts/generate-129-control-seed.mjs](../scripts/generate-129-control-seed.mjs). Data: [scripts/data/control-movements-top-50.mjs](../scripts/data/control-movements-top-50.mjs).

### 12.1 Landing & Braking Control (cards 1–10)

Rich pass in [130](../backend/migrations/130_coaching_control_landing_cards.sql) — Drop Squat to Stick through Backpedal to Stick (`landing_braking_control`, slots 511–520). Card `movement_requirements` includes `setup_requirements` and optional `landing_control_profile` (`landing_base`, `approach_type`, `approach_intensity`, `stick_duration_seconds`, `allowed_extra_steps`, `primary_watch_point`, `progression_trigger`). Card 2 slug is `snap-down-to-stick-control-version` (intent-separated from Output `snap-down-to-stick`). Dosage uses DB-safe units (`reps` or `attempts`); integer `session_volume_min` / `max`. Daily-safe: drop squat, snap-down control, decel stop-step; not daily: box step-off, hops, jog/shuffle/backpedal decel. Validator: `analyzeControlLandingReadiness` in [controlResilienceValidation.js](../backend/platform/controlResilienceValidation.js). Key rules: `control_resilience_landing_valgus`, `control_resilience_landing_loud_contact`, `control_resilience_landing_extra_steps`, `control_resilience_landing_drop_squat_regress`, `control_resilience_landing_snapdown_rebound`, `control_resilience_landing_box_height`, `control_resilience_landing_forward_momentum`, `control_resilience_landing_lateral_collapse`, `control_resilience_sl_hop_prerequisite`, `control_resilience_landing_brake_skid`, `control_resilience_decel_high_speed`, `control_resilience_landing_shuffle_cross`, `control_resilience_landing_backpedal_lane`, `control_resilience_after_fitness_landing`, `control_resilience_landing_pain_stop`, `control_resilience_decel_short_rest`. Generator: [scripts/generate-control-rich.mjs](../scripts/generate-control-rich.mjs). Data: [scripts/data/control-landing-cards-1-10.mjs](../scripts/data/control-landing-cards-1-10.mjs).

### 12.2 Single-Leg Balance / Foot-Ankle-Hip Control (cards 11–20)

Rich pass in [131](../backend/migrations/131_coaching_control_single_leg_cards.sql) — Single-Leg Balance Hold through Beam/Line Balance Freeze (`single_leg_balance_foot_ankle_hip_control`, slots 521–530). Cards are hand-authored in [scripts/data/control-single-leg-cards-11-20.mjs](../scripts/data/control-single-leg-cards-11-20.mjs) and generated by [scripts/generate-control-rich.mjs](../scripts/generate-control-rich.mjs).

Card `movement_requirements` includes `setup_requirements` and optional `single_leg_control_profile`:

```json
{
  "stance_type": "single_leg | tandem | narrow_base | split_stance",
  "support_allowed": "none | fingertip | wall | partner | rail",
  "movement_demand": "static | reach | hinge | rotate | stepdown | perturbation | beam_walk",
  "primary_control_target": "foot_tripod | knee_tracking | hip_level | pelvis_rotation | trunk_stability | quiet_balance",
  "balance_loss_allowed": 0,
  "default_hold_seconds": 20,
  "progression_trigger": "3 clean sets with no foot collapse, no knee valgus, and no uncontrolled balance loss"
}
```

Equipment taxonomy: `y_balance_kit` is seeded by migration 131 for Y-Balance / Star Reach, alongside `line_tape` and `cones`.

Validator: `analyzeControlSingleLegReadiness` in [controlResilienceValidation.js](../backend/platform/controlResilienceValidation.js), wired through `analyzeControlResilienceReadiness`. Key rules: `control_resilience_sl_static_hold_fail`, `control_resilience_sl_tripod_collapse`, `control_resilience_sl_knee_valgus`, `control_resilience_sl_reach_weight_transfer`, `control_resilience_sl_ybalance_distance_chase`, `control_resilience_sl_rdl_pelvis_open`, `control_resilience_sl_airplane_prerequisite`, `control_resilience_sl_airplane_lumbar_twist`, `control_resilience_sl_stepdown_pushoff`, `control_resilience_sl_lateral_pelvic_drop`, `control_resilience_sl_squat_box_low`, `control_resilience_perturbation_beginner`, `control_resilience_sl_perturbation_too_strong`, `control_resilience_sl_beam_safety`, `control_resilience_sl_fatigue_circuit`, `control_resilience_sl_pain_stop`.

### 12.3 Trunk / Pelvis / Anti-Movement Control (cards 21–30)

Rich pass in [132](../backend/migrations/132_coaching_control_trunk_cards.sql) — Dead Bug Heel Tap through Half-Kneeling Anti-Rotation Press/Lift Hold (`trunk_pelvis_anti_movement_control`, slots 531–540). Card `movement_requirements` includes `setup_requirements` and optional `anti_movement_profile` (`primary_anti_motion`, `body_position`, `limb_movement`, `load_type`, `primary_watch_point`, `progression_trigger`). Dosage uses DB-safe units (`reps` or `seconds`); integer `session_volume_min` / `max`. Daily-safe: dead bug heel tap, bird dog ISO, Pallof hold; not daily: loaded dead bug, planks, bear work, pull-through, half-kneeling anti-rotation. Equipment taxonomy adds `slider` (optional pull-through); uses existing `cable_machine`, `handles`, `bands`. Validator: `analyzeControlTrunkReadiness` in [controlResilienceValidation.js](../backend/platform/controlResilienceValidation.js). Key rules: `control_resilience_trunk_dead_bug_arch`, `control_resilience_trunk_loaded_rib_flare`, `control_resilience_trunk_bird_dog_rotation`, `control_resilience_trunk_plank_hip_sag`, `control_resilience_trunk_long_lever_prerequisite`, `control_resilience_trunk_side_plank_regress`, `control_resilience_trunk_bear_plank_regress`, `control_resilience_trunk_bear_tap_rotation`, `control_resilience_trunk_pull_through_rotation`, `control_resilience_trunk_pallof_rotation`, `control_resilience_trunk_half_kneeling_rotation`, `control_resilience_trunk_unsafe_anchor`, `control_resilience_trunk_breath_hold`, `control_resilience_trunk_fitness_density`, `control_resilience_trunk_symptom_substitution`. Generator: [scripts/generate-control-rich.mjs](../scripts/generate-control-rich.mjs). Data: [scripts/data/control-trunk-cards-21-30.mjs](../scripts/data/control-trunk-cards-21-30.mjs).

### 12.4 Scapular / Wrist / Hand-Support Resilience (cards 31–40)

Rich pass in [133](../backend/migrations/133_coaching_control_scapular_cards.sql) — Quadruped Scapular Push-Up Hold through Wrist Lean ISO (`scapular_wrist_hand_support_resilience`, slots 541–550). Cards are hand-authored in [scripts/data/control-scapular-cards-31-40.mjs](../scripts/data/control-scapular-cards-31-40.mjs) and generated by [scripts/generate-control-rich.mjs](../scripts/generate-control-rich.mjs).

Card `movement_requirements` includes `setup_requirements` and optional `hand_support_profile`:

```json
{
  "support_orientation": "quadruped | prone | plank | crawl | rear_support | inverted | ring_support | wrist_specific",
  "primary_support_joint": "wrist | shoulder | elbow | mixed",
  "scapular_action": "protraction | retraction | elevation | depression | stabilization | mixed",
  "inversion_required": false,
  "safe_exit_required": false,
  "hand_support_load": "low | moderate | high",
  "primary_watch_point": "elbow_bend | shoulder_shrug | hip_rotation | shoulder_pinch | banana_back | unsafe_exit | ring_drift | wrist_pain",
  "progression_trigger": "3 clean sets with no pain, no collapse, and safe exit"
}
```

Dosage uses DB-safe units (`reps`, `holds`, `taps`, `distance`, `seconds`, `descents`); integer `session_volume_min` / `max`. Daily-safe: quadruped scapular push-up hold, prone Y-T-W, wrist lean rock hold; not daily: plank taps, bear crawl, crab, handstand line/shrug, wall walk, ring support.

Equipment taxonomy: migration 133 idempotently seeds `parallettes` and `parallel_bars`; cards also use existing `wall`, `rings`, `mat`, and `none`.

Validator: `analyzeControlHandSupportReadiness` in [controlResilienceValidation.js](../backend/platform/controlResilienceValidation.js), wired through `analyzeControlResilienceReadiness`. Key rules: `control_resilience_hs_scapular_elbow_bend`, `control_resilience_hs_ytw_shrug`, `control_resilience_hs_plank_tap_rotation`, `control_resilience_hs_bear_crawl_fitness`, `control_resilience_hs_crab_pinch_stop`, `control_resilience_hs_no_safe_exit`, `control_resilience_hs_banana_back`, `control_resilience_hs_shrug_prerequisite`, `control_resilience_hs_shrug_elbow_bend`, `control_resilience_hs_wall_walk_collapse_stop`, `control_resilience_hs_ring_support_regress`, `control_resilience_hs_ring_support_failure`, `control_resilience_hs_wrist_sharp_stop`, `control_resilience_hs_before_skill`, `control_resilience_hs_symptom_substitution`. Generic loop retains `control_resilience_handstand_prerequisite`, `control_resilience_wall_walk_beginner`, `control_resilience_ring_support_drift`, `control_resilience_wrist_sharp_pain`, and `control_resilience_hand_wrist_pain` for non-scapular hand-support cards (e.g. bear plank shoulder tap) with dedupe when scapular-specific findings already fired.

### 12.5 Slow Eccentric / Isometric Joint Resilience (cards 41–50)

Rich pass in [134](../backend/migrations/134_coaching_control_slow_eccentric_cards.sql) — Split Squat Eccentric to Pause through Nordic Lean Isometric Partial Range (`slow_eccentric_isometric_joint_resilience`, slots 551–560). **Completes the 50-card Resilience library.** Card `movement_requirements` includes `setup_requirements` and optional `joint_resilience_profile`:

```json
{
  "primary_tissue": "hamstring | quad_tendon | adductor | gastroc | soleus | tibialis | mixed",
  "contraction_type": "eccentric_to_isometric | isometric | eccentric | mixed",
  "joint_position": "split_stance | lateral_lunge | cossack | bridge | slider | calf_raise | tibialis_hold | nordic_lean",
  "symptom_monitoring_required": true,
  "pain_rule": "0-3/10 acceptable only if symptoms do not worsen during or after; sharp pain stops drill",
  "progression_trigger": "3 clean sessions with no symptom flare and stable position quality"
}
```

Dosage uses DB-safe units (`reps` or `seconds`); integer `session_volume_min` / `max`. Daily-safe: adductor squeeze bridge hold, tibialis ISO toe-up hold; not daily: split squat eccentric, frontal-plane holds, hamstring bridge/slider/Nordic, calf/soleus ISO.

Equipment taxonomy: migration 134 idempotently seeds `yoga_block`, `foam_roller`, `partner`; cards also use existing `sliders`, `towel`, `nordic_bench`, `tib_bar`, `box`, `mat`, and `none`.

Validator: `analyzeControlSlowEccentricReadiness` in [controlResilienceValidation.js](../backend/platform/controlResilienceValidation.js), wired through `analyzeControlResilienceReadiness`. Key rules: `control_resilience_slow_ecc_before_output`, `control_resilience_slow_ecc_split_valgus`, `control_resilience_slow_ecc_lateral_groin_stop`, `control_resilience_slow_ecc_cossack_forced_depth`, `control_resilience_slow_ecc_cossack_symptom_stop`, `control_resilience_slow_ecc_adductor_groin_stop`, `control_resilience_slow_ecc_bridge_cramp`, `control_resilience_slow_ecc_slider_hip_drop`, `control_resilience_slow_ecc_slider_hamstring_stop`, `control_resilience_slow_ecc_calf_achilles`, `control_resilience_slow_ecc_soleus_before_output`, `control_resilience_slow_ecc_tibialis_stop`, `control_resilience_slow_ecc_nordic_beginner`, `control_resilience_slow_ecc_nordic_unsafe_anchor`, `control_resilience_slow_ecc_nordic_compensation_stop`, `control_resilience_slow_ecc_sprint_proximity`, `control_resilience_slow_ecc_symptom_stop`, `control_resilience_slow_ecc_fitness_density`. Generic loop skips cards 41–50 (migrated from `control_resilience_split_squat_valgus`, `control_resilience_groin_frontal_stop`, `control_resilience_hamstring_sharp_stop`, `control_resilience_lower_leg_before_output`). Generator: [scripts/generate-control-rich.mjs](../scripts/generate-control-rich.mjs). Thin seed sync: [scripts/generate-129-control-seed.mjs](../scripts/generate-129-control-seed.mjs). Data: [scripts/data/control-slow-eccentric-cards-41-50.mjs](../scripts/data/control-slow-eccentric-cards-41-50.mjs).
