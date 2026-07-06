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

### Phase and subrole (Prepare / Access)

- **Phase:** `primary_phase_key = 'prepare_access'`
- **Subrole:** One of `raise | mobilize | activate | integrate | potentiate_bridge`
- **Order slot:** Fine-grained key from `coaching.phase_order_slot` (e.g. `breathing_reset`, `hip_rotation`)
- **Dual subroles** (e.g. “Mobilize / Activate”): Store the **primary** subrole on `phase_subrole` (first listed / dominant intent). Record secondary intent in `coach_language` or card summary.

### Best placement

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
| Phase | Prepare / Access |
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

Migration **`098_coaching_prepare_access_foundation_cards.sql`** upgrades these slugs to the full spec above:

| # | Slug | Order slot |
|---|------|------------|
| 1 | `9090-breathing-with-reach` | `breathing_reset` |
| 2 | `crocodile-breathing` | `breathing_reset` |
| 3 | `full-body-joint-cars-flow` | `joint_scan` |
| 4 | `cat-cow` | `spinal_mobility` |
| 5 | `quadruped-spinal-circles` | `spinal_mobility` |
| 6 | `quadruped-thread-the-needle` | `thoracic_rotation` |
| 7 | `side-lying-open-book` | `thoracic_rotation` |
| 8 | `9090-hip-switch` | `hip_rotation` *(slot added in 098)* |
| 9 | `worlds-greatest-stretch` | `integrated_mobility` |
| 10 | `inchworm-walkout` | `integrated_mobility` |

**Source data:** [scripts/data/foundation-access-cards-1-10.mjs](../scripts/data/foundation-access-cards-1-10.mjs)  
**Regenerate SQL:** `node scripts/generate-098-foundation-cards.mjs`

Cards 11–50 remain at the thinner `097` seed until a future content pass.

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
WHERE e.primary_phase_key = 'prepare_access'
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

## 8. Implementation notes for Cursor / content agents (Prepare / Access)

Use this section when authoring or upgrading Prepare / Access cards (migrations `097`–`098+`, generator scripts under `scripts/`).

### 8.1 Coach filter dimensions

Build the library so coaches can filter by:

| Dimension | Storage / API | Canonical values |
|-----------|---------------|------------------|
| **phase_subrole** | `exercise.phase_subrole`, `?subrole=` | `raise`, `mobilize`, `activate`, `integrate`, `potentiate_bridge` |
| **body_region** | `exercise_tag` facet `body_region`, `?body_region=` | `foot`, `ankle`, `knee`, `hip`, `spine`, `core`, `shoulder`, `wrist`, `full_body` |
| **session_need** | `pairing_logic.good_for_sessions[]`, `?session_need=` | See table below |
| **fatigue_cost** | `exercise_phase_profile.fatigue_cost`, `?max_fatigue_cost=` | **1–2 preferred** for most Prepare / Access cards |
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

### 8.2 Phase profile defaults (Prepare / Access)

When seeding `exercise_phase_profile` for `prepare_access`:

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

**Prepare / Access should increase readiness without stealing output.**

The workout validator (`workoutValidation.js`) flags Prepare / Access blocks that contain too many:

- High **fatigue-cost** items (`fatigue_cost > 2`)
- **High-impact** contacts (`impact_level >= 2`, beyond 1–2 bridge drills)
- **Long isometric holds** (isometrics methodology + `work_seconds >= 45`)
- **Conditioning-style** work (methodology `hiit`, or regimen flags)
- **Non-low intensity ceiling** on phase profile

Content agents: if a drill fatigues athletes for Output/Skill, it belongs in Capacity or Fitness — not Prepare / Access.

### 8.4 Content roadmap — cards 11–20 (upper-body access)

Cards **11–20** should cover **wrist, shoulder, scapular, and upper-body access** — critical for tumbling, gymnastics, ninja, crawling, hand support, and overhead work.

| # | Target movement (from 097 seed slug) | Subrole / slot focus | session_need tags |
|---|--------------------------------------|----------------------|-------------------|
| 11 | `wrist-rockers-palms-down` | mobilize / `wrist_prep` | tumbling_prep, crawling_prep |
| 12 | `wrist-rockers-palms-up` | mobilize / `wrist_prep` | tumbling_prep, crawling_prep |
| 13 | `finger-pulses` | mobilize / `wrist_prep` | tumbling_prep, crawling_prep |
| 14 | `scapular-push-up` | activate / `scapular_activation` | tumbling_prep, overhead_prep |
| 15 | `quadruped-shoulder-circles` | mobilize / `shoulder_mobility` | overhead_prep, tumbling_prep |
| 16 | `wall-slides-with-lift-off` | mobilize / `shoulder_mobility` | overhead_prep |
| 17 | `band-external-rotation` | activate / `rotator_cuff_activation` | overhead_prep, tumbling_prep |
| 18 | `arm-circles` | mobilize / `shoulder_mobility` | general_warmup, overhead_prep |
| 19 | `bear-crawl-rock-back` | integrate / `crawl_pattern_prep` | crawling_prep, tumbling_prep |
| 20 | `down-dog-to-plank-wave` | integrate / `crawl_pattern_prep` | crawling_prep, overhead_prep |

Upgrade pattern: same as cards 1–10 (`scripts/data/` module + `generate-099` or extend `098` pattern). Tag **`body_region`**: `wrist`, `shoulder`, `spine`, `core` as appropriate; set **`good_for_sessions`** on every card.

Cards 21–50 remain thin `097` seed until subsequent passes (lower body, elastic bridge, rhythm raise).
