# Exercise Card Authoring Guide (LLM / Content Agent)

**File of record** for generating new inputs to the Vortex coaching exercise Library. Paste this document (or §14 prompt stub) into ChatGPT, Claude, or Cursor when authoring card batches.

Use this document when generating **complete, publish-ready Vortex coaching exercise cards** (Card v2). It explains the Athleticism Accelerator taxonomy, what each card section means, how to think while authoring, and the exact JSON shapes to output.

**Canonical implementation reference:** [EXERCISE_CARD_SPEC.md](./EXERCISE_CARD_SPEC.md) · Example data: [scripts/data/foundation-access-cards-1-10.mjs](../scripts/data/foundation-access-cards-1-10.mjs) · Legacy alias: [exercise_card_details.md](./exercise_card_details.md) (redirects here)

---

## 1. How to use this document

1. **Pick the primary session phase first** — this drives dose, fatigue, placement, and validator behavior.
2. **Pick subrole + order slot** — must match an existing slot in that phase (or propose a new slot key with rationale).
3. **Tag honestly** — tenets describe *what transfers*; methodologies describe *how load is applied*; physiology describes *why the system adapts*.
4. **Write coach-facing copy** — card summary, cues, and misuse warnings should prevent bad sequencing in the Workout Builder.
5. **Write client-facing copy** — `athleteLanguage`, `athlete_cues`, and plain `movement_description` power the Library **Client view** (§5.2).
6. **Add demo YouTube links** — 3–5 `watch?v=` URLs in `mediaReferences` (§5.1); these embed in coach and client detail modals.
7. **Set difficulty + age band** — `difficultyProfile` drives Library filters, Needs Engine caps, and client “Best for ages” badges (§5.3).
8. **Set `participantStructure`** when the drill requires a partner or small group — not for spotting-only work (§5.4).
9. **Output JSON** using the **Authoring format (§8)** unless explicitly asked for API format (§9).

**Slug rule:** lowercase kebab-case, stable forever once published (e.g. `9090-breathing-with-reach`). Do not rename slugs of existing library cards.

**Legacy phase keys — do NOT use:**

```json
{
  "deprecated_phase_keys": [
    "prepare_access",
    "skill_movement_intelligence",
    "control_resilience",
    "fitness_repeatability"
  ],
  "use_instead": [
    "prepare_and_access",
    "movement_intelligence",
    "resilience",
    "sustained_capacity"
  ]
}
```

---

## 2. Athleticism Accelerator — system overview

Vortex workouts are not random exercise lists. Every card answers four questions:

```json
{
  "framework_questions": {
    "when": "Session phase — where in the workout (freshness-sensitive work early, fatigue-creating work late)",
    "what": "Tenets — athletic qualities that transfer (strength, speed, coordination, etc.)",
    "how": "Methodologies — loading strategy (plyometrics, isometrics, HIIT, etc.)",
    "why": "Physiological emphasis — systems under stress (neural readiness, SSC stiffness, tissue capacity, etc.)"
  },
  "supporting_layers": {
    "order_slots": "Fine progression within a phase (micro-sequence inside subroles)",
    "session_models": "Minutes allocated across phases for 60 / 90 / 120 min sessions",
    "validation_rules": "Automated guardrails when sequencing violates phase intent"
  }
}
```

**Canonical session flow (never reorder phases in a workout):**

```json
{
  "session_phase_order": [
    {
      "key": "prepare_and_access",
      "display_name": "Prepare & Access",
      "definition": "Raise temperature, mobilize joints, activate key tissues, and create access to the positions needed for training.",
      "think": "Readiness without meaningful fatigue. Access before intensity."
    },
    {
      "key": "movement_intelligence",
      "display_name": "Movement Intelligence",
      "definition": "Develop coordination, body shapes, rhythm, mechanics, spatial awareness, and movement literacy before fatigue.",
      "think": "Learning and patterning while the nervous system is fresh. Not conditioning."
    },
    {
      "key": "output",
      "display_name": "Output",
      "definition": "Express high-quality speed, power, elasticity, acceleration, jumping, throwing, and reactive athleticism while fresh.",
      "think": "High intent, low volume, full rest. Speed/power before heavy strength."
    },
    {
      "key": "capacity",
      "display_name": "Capacity",
      "definition": "Build strength, force production, tissue tolerance, and structural reserve through loaded and progressive work.",
      "think": "Force development. Tolerates more fatigue than speed/skill."
    },
    {
      "key": "resilience",
      "display_name": "Resilience",
      "definition": "Build control, stability, landing mechanics, braking ability, joint ownership, trunk control, and tissue durability.",
      "think": "Brakes, stabilizers, eccentrics, landing sticks — not max speed or HIIT."
    },
    {
      "key": "sustained_capacity",
      "display_name": "Sustained Capacity",
      "definition": "Build the ability to repeat useful athletic work under fatigue while maintaining quality, posture, and safe mechanics.",
      "think": "Conditioning on purpose — almost always late in session."
    },
    {
      "key": "restore",
      "display_name": "Restore",
      "definition": "Downshift the nervous system, restore breathing, reduce tension, recover range, and support readiness.",
      "think": "Cooldown only. No new stress."
    }
  ]
}
```

**Methodology → primary phase homes (do not invert without explicit rationale):**

```json
{
  "methodology_primary_homes": [
    { "methodology": "resistance_calisthenics", "primary": "capacity", "secondary": "resilience, movement_intelligence (technical)" },
    { "methodology": "plyometrics", "primary": "output", "secondary": "prepare_and_access (low elastic prep), movement_intelligence (landing mechanics)" },
    { "methodology": "isometrics", "primary": "prepare_and_access (light), movement_intelligence, capacity, resilience", "secondary": "activation and yielding holds" },
    { "methodology": "eccentric_negative", "primary": "resilience", "secondary": "capacity" },
    { "methodology": "neural", "primary": "prepare_and_access, movement_intelligence, output", "secondary": "high-intent coordination and speed" },
    { "methodology": "balance_stability", "primary": "resilience, movement_intelligence", "secondary": "prepare_and_access (low level)" },
    { "methodology": "mobility_flexibility", "primary": "prepare_and_access (dynamic), restore (static)", "secondary": "never long static before power" },
    { "methodology": "core_body_control", "primary": "resilience, movement_intelligence", "secondary": "prepare_and_access (activation)" },
    { "methodology": "hiit", "primary": "sustained_capacity", "secondary": "almost never before skill or output" }
  ]
}
```

---

## 3. Taxonomy facet keys (for tags)

Each tag is `{ "key": "<facet_key>", "weight": 1-5 }`. Weight = emphasis (5 = dominant).

### 3.1 Tenets (`tenets`)

```json
{
  "tenets": [
    { "key": "strength", "name": "Strength", "meaning": "Ability to exert force against resistance" },
    { "key": "explosiveness", "name": "Explosiveness", "meaning": "Maximal force in minimal time" },
    { "key": "speed", "name": "Speed", "meaning": "Rapid coordinated movement" },
    { "key": "agility", "name": "Agility", "meaning": "Decelerate, redirect, react" },
    { "key": "flexibility", "name": "Flexibility/Mobility", "meaning": "Usable range of motion" },
    { "key": "balance", "name": "Balance", "meaning": "Stability over base of support" },
    { "key": "coordination", "name": "Coordination", "meaning": "Multi-part timing and precision" },
    { "key": "body_control", "name": "Body Control", "meaning": "Spatial ownership of body shapes and transitions" }
  ]
}
```

### 3.2 Methodologies (`methodologies`)

```json
{
  "methodologies": [
    { "key": "resistance_calisthenics", "name": "Resistance & Calisthenics" },
    { "key": "plyometrics", "name": "Plyometrics" },
    { "key": "isometrics", "name": "Isometrics" },
    { "key": "eccentric_negative", "name": "Eccentric/Negative Training" },
    { "key": "neural", "name": "Neural Training" },
    { "key": "balance_stability", "name": "Balance & Stability Work" },
    { "key": "mobility_flexibility", "name": "Mobility & Flexibility Drills" },
    { "key": "core_body_control", "name": "Core & Body Control Work" },
    { "key": "hiit", "name": "HIIT" }
  ]
}
```

### 3.3 Physiological emphasis (`physiology`)

```json
{
  "physiology": [
    { "key": "neural_output_readiness", "name": "Neural Output & Readiness" },
    { "key": "force_tissue_capacity", "name": "Force Capacity & Tissue Capacity" },
    { "key": "ssc_stiffness", "name": "SSC & Stiffness (Elastic Energy)" },
    { "key": "control_stability", "name": "Control & Stability" },
    { "key": "perception_action_skill", "name": "Perception–Action Skill" },
    { "key": "energy_systems_repeatability", "name": "Energy Systems & Repeatability" }
  ]
}
```

### 3.4 Movement patterns (`patterns`)

```json
{
  "patterns": [
    "squat", "hinge", "push", "pull", "brace", "jump", "land",
    "rotate", "locomote", "carry", "hang", "invert"
  ]
}
```

### 3.5 Body regions (`body_regions`)

```json
{
  "body_regions": [
    "foot", "ankle", "knee", "hip", "spine", "core",
    "shoulder", "wrist", "full_body"
  ]
}
```

### 3.6 Equipment (`equipment`)

Use existing keys from the library. Common values:

```json
{
  "equipment_common": [
    "none", "mat", "bands", "box", "beam", "bar", "rings", "kettlebell",
    "dumbbell", "sled", "medicine_ball", "cones", "wall", "jump_rope",
    "mirror", "sliders", "cable_machine", "foam_roller", "partner"
  ],
  "note": "New equipment keys are added via migrations when a cluster needs them. Prefer existing keys; propose new keys only when necessary."
}
```

---

## 4. Phase subroles (pick one per card)

Subrole must match the **order slot** you choose (slots carry `subrole_key` in the database). Store the **dominant** subrole on the card; note secondary intent in `coachLanguage`.

### 4.1 Prepare & Access — RAMP-derived sequence

Vortex order: **Raise → Mobilize → Activate → Integrate → Potentiate Bridge** → then performance phases.

```json
{
  "phase": "prepare_and_access",
  "subroles": [
    { "key": "raise", "think": "Temperature, HR, general movement — not fatigue" },
    { "key": "mobilize", "think": "Dynamic joint access, CARs, breathing resets" },
    { "key": "activate", "think": "Glute/core/scapular/foot priming — light, not burnout" },
    { "key": "integrate", "think": "Locomotion, crawls, flows, patterning whole-body" },
    { "key": "potentiate_bridge", "think": "Low-stress elastic ramp before Output (pogos, build-ups)" }
  ],
  "typical_phase_profile": {
    "role": "primary",
    "fit_weight": 5,
    "freshness_required": false,
    "fatigue_cost": "1-2 (3+ only for bridge elastic prep)",
    "fatigue_sensitivity": "1-2",
    "impact_level": "0-1",
    "intensity_ceiling": "low"
  },
  "validator_principle": "Prepare must increase readiness without stealing Output. High fatigue_cost, HIIT methodology, or long iso holds trigger warnings."
}
```

### 4.2 Movement Intelligence

```json
{
  "phase": "movement_intelligence",
  "subroles": [
    { "key": "shape_position_intelligence", "examples": "Hollow/arch, line holds, shape drills" },
    { "key": "rotation_inversion_tumbling_foundations", "examples": "Rolls, cartwheel prep, handstand line" },
    { "key": "locomotion_sprint_mechanics", "examples": "A-march, skips, acceleration posture" },
    { "key": "balance_coordination_rhythm", "examples": "Beam work, skipping, ladder rhythm" },
    { "key": "perception_action_reactive_movement", "examples": "Mirror drills, visual reactions, tag games" }
  ],
  "think": "Technical learning while fresh. Reps should stay crisp — not exhaustive circuits."
}
```

### 4.3 Output

```json
{
  "phase": "output",
  "subroles": [
    { "key": "acceleration_start_speed", "examples": "Starts, first-step power" },
    { "key": "max_velocity_exposure", "examples": "Flys, wicket runs, max-speed exposures" },
    { "key": "elastic_stiffness_plyometric_rudiments", "examples": "Pogos, bounds, ankle stiffness" },
    { "key": "jump_throw_explosive_power", "examples": "CMJ, broad jump, med-ball throws" },
    { "key": "deceleration_cod_power", "examples": "Cuts, decel drills, COD power" },
    { "key": "reactive_agility_tumbling_output", "examples": "Reactive tumbling/agility at output intent" }
  ],
  "think": "Express force quickly with full recovery. Low volume, high intent. Tired reps = conditioning, not power."
}
```

### 4.4 Capacity

```json
{
  "phase": "capacity",
  "subroles": [
    { "key": "squat_knee_dominant_strength", "examples": "Squats, split squats, leg press patterns" },
    { "key": "hinge_posterior_chain_strength", "examples": "RDL, deadlift, hip hinge" },
    { "key": "upper_body_push_strength", "examples": "Push-ups, bench, overhead press" },
    { "key": "pull_hang_grip_strength", "examples": "Pull-ups, rows, hangs" },
    { "key": "carry_trunk_loaded_bracing_strength", "examples": "Carries, loaded marches" },
    { "key": "tissue_capacity_isometric_eccentric_accessory", "examples": "Accessory iso/ecc strength work" }
  ],
  "think": "Progressive force development. Usually after Output. Not max sprinting or main plyo exposure."
}
```

### 4.5 Resilience

```json
{
  "phase": "resilience",
  "subroles": [
    { "key": "landing_braking_control", "examples": "Landing sticks, snap-downs, decel absorption" },
    { "key": "single_leg_balance_foot_ankle_hip_control", "examples": "SL balance, Y-balance, step-downs" },
    { "key": "trunk_pelvis_anti_movement_control", "examples": "Dead bug, Pallof, anti-rotation" },
    { "key": "scapular_wrist_hand_support_resilience", "examples": "Scapular stability, wrist/hand support holds" },
    { "key": "slow_eccentric_isometric_joint_resilience", "examples": "Nordic leans, slow eccentrics, iso holds" }
  ],
  "think": "Control, brakes, tissue tolerance — not speed, not HIIT. Often after Capacity."
}
```

### 4.6 Sustained Capacity & Restore

```json
{
  "sustained_capacity": {
    "subroles": "Uses coarse slots (conditioning_intervals, conditioning_circuit) more than fine subroles",
    "think": "Repeatability under fatigue — circuits, intervals, tempo work. Late in session."
  },
  "restore": {
    "subroles": "Cooldown / breathing / static flexibility slots",
    "think": "Downshift only. No new skill, strength, or competitive finishers."
  }
}
```

---

## 5. Card sections — what they mean and what to think about

```json
{
  "card_sections": [
    {
      "section": "movement_identity",
      "fields": ["slug", "name", "family", "subrole", "slot", "cardSummary", "coachLanguage", "athleteLanguage"],
      "think": [
        "Name = coach library label. Slug = permanent URL key.",
        "family = short cluster label (e.g. 'Breathing reset', 'Landing & Braking Control').",
        "cardSummary = 1-2 sentences: what it does and why a coach would pick it.",
        "subrole + slot must be consistent — slot drives subrole unless explicitly overridden.",
        "coachLanguage = placement hints, dual-subrole notes, coach-only context.",
        "athleteLanguage = simple cue the athlete hears on the floor."
      ]
    },
    {
      "section": "movement_requirements",
      "fields": ["primary_joint_actions", "primary_tissues", "breathing_demand", "balance_demand", "coordination_demand", "impact_level"],
      "think": [
        "At least one joint action OR tissue required for publish.",
        "impact_level 0-5: 0 = none, 5 = high landing/contact stress.",
        "Use honest demands — validators cross-check impact vs phase."
      ]
    },
    {
      "section": "taxonomy_tags",
      "fields": ["tenets", "methodologies", "physiology", "patterns", "equipment", "body_regions"],
      "think": [
        "Publish requires: tenet, methodology, physiology, pattern, equipment (body_region recommended).",
        "Weight 1-5 on each tag. Top weight should match primary intent.",
        "Do not tag explosiveness on a breathing drill unless it truly trains RFD."
      ]
    },
    {
      "section": "why_layer",
      "fields": ["whyItWorks", "whyItGoesHere", "bestPlacement", "commonMisuse", "scalingGuidance"],
      "think": [
        "whyItWorks = mechanism / sport-science rationale (optional but recommended for rich cards).",
        "whyItGoesHere = why this phase + slot — ties to session sequencing science.",
        "bestPlacement → stored as programming_guidance (WHEN in session / week).",
        "commonMisuse = what coaches get wrong — prevents bad pairing in Builder.",
        "scalingGuidance = high-level scaling philosophy before per-cohort rows."
      ],
      "publish_required": ["what_it_is (use description)", "why_it_goes_here", "common_misuse"]
    },
    {
      "section": "coaching_execution",
      "fields": ["movement_description", "setup", "execution_steps", "coach_cues", "common_faults", "breathing_cues", "quality_gate", "stop_signs"],
      "think": [
        "Publish requires non-empty setup AND execution_steps.",
        "movement_description = full prose version; can mirror description field.",
        "coach_cues = what to say; common_faults = what to fix; stop_signs = end set immediately.",
        "quality_gate = pass/fail criteria before progressing variant."
      ]
    },
    {
      "section": "dosage",
      "fields": ["volume_unit", "default_sets", "default_reps", "default_work_seconds", "default_rest_seconds", "est_seconds_per_set", "default_rpe_min", "default_rpe_max"],
      "think": [
        "volume_unit must be one of: reps, seconds, distance, contacts, rounds, attempts, intervals, breaths.",
        "est_seconds_per_set required for publish — drives session time math.",
        "Prepare & Access: low sets/reps, RPE 1-3 typical. Output: full rest, low rep count.",
        "Match unit to drill (breaths for breathing, contacts for pogos, attempts for landings)."
      ]
    },
    {
      "section": "scaling",
      "fields": ["youth_beginner", "youth_intermediate", "teen", "adult_beginner", "adult_advanced", "older_adult", "pregnancy_postpartum", "genderSpecificNotes"],
      "think": [
        "Six cohorts required for publish (all except pregnancy_postpartum).",
        "Each value = load_guidance prose for that population — regressions, cues, contraindications.",
        "pregnancy_postpartum: side-lying/seated alternatives, avoid prolonged supine, breath-holding.",
        "genderSpecificNotes: only when clinically relevant — not default male/female load splits."
      ]
    },
    {
      "section": "pairing_logic",
      "fields": ["pairsWellAfter", "pairsWellBefore", "doNotUseWhen", "good_for_sessions"],
      "think": [
        "pairsWellAfter = human-readable names of good follow-on drills.",
        "doNotUseWhen = symptoms, session types, or states that disqualify the drill.",
        "good_for_sessions = filter keys (see session_need_keys below)."
      ]
    },
    {
      "section": "safety_profile",
      "fields": ["risk_level", "impact_level", "readiness_checks", "contraindications", "requires_spotting", "requires_coach_supervision"],
      "think": [
        "risk_level 1-5. readiness_checks = pre-flight questions coach verifies.",
        "At least one readiness check required for publish.",
        "contraindications = hard stops (pain, instability, medical)."
      ]
    },
    {
      "section": "regimen_rule",
      "fields": ["can_be_daily", "weekly_max_frequency", "counts_as_high_intensity", "counts_as_conditioning", "etc."],
      "think": [
        "can_be_daily true for low-intensity Prepare drills (breathing, mobility).",
        "counts_as_conditioning true only for Sustained Capacity intent — triggers validators if placed early."
      ]
    },
    {
      "section": "media",
      "fields": ["mediaReferences", "mediaInternalNotes"],
      "think": [
        "References = external sport-science / clinical sources (FMS, NSCA, etc.).",
        "Internal notes = coach-only context not shown to athletes."
      ]
    }
  ]
}
```

### 5.1 Session need keys (`good_for_sessions`)

```json
{
  "session_need_keys": [
    { "key": "tumbling_prep", "use_when": "Hand support, wrist/shoulder/spine access before gymnastics/ninja tumbling" },
    { "key": "sprint_prep", "use_when": "Hip, ankle, posture, low-level plyo before acceleration" },
    { "key": "squat_prep", "use_when": "Ankle DF, hip mobility, glute activation before squat patterns" },
    { "key": "overhead_prep", "use_when": "T-spine rotation, shoulder mobility before overhead load" },
    { "key": "landing_prep", "use_when": "Ankle stiffness, absorption before jumps/plyos" },
    { "key": "crawling_prep", "use_when": "Wrist, shoulder, quadruped patterns before crawl/beast work" },
    { "key": "general_warmup", "use_when": "Default temperature + movement access" },
    { "key": "low_readiness_reset", "use_when": "Breathing, down-regulation for anxious/stiff athletes" }
  ]
}
```

Resilience / Output clusters may add keys like `control_landing`, `deceleration`, `resilience` — match existing cards in the same cluster when possible.

---

## 6. Publish gate (minimum viable rich card)

```json
{
  "publish_requirements": {
    "identity": ["name", "slug", "card_summary", "primary_phase_key", "est_seconds_per_set"],
    "movement_requirements": "At least one primary_joint_actions OR primary_tissues",
    "coaching_execution": "Non-empty setup[] AND execution_steps[]",
    "taxonomy": "At least one tag each: tenet, methodology, physiology, pattern, equipment",
    "phase_profile": "At least one exercise_phase_profile row with role primary for main phase",
    "dosage": "Default profile with est_seconds_per_set",
    "scaling": "Cohort rows for: youth_beginner, youth_intermediate, teen, adult_beginner, adult_advanced, older_adult",
    "safety": "risk_level + at least one readiness_checks[] entry",
    "why_layer": ["what_it_is", "why_it_goes_here", "common_misuse"],
    "recommended_rich": ["why_it_works", "body_region tags", "RPE range", "pairing_logic", "media refs", "pregnancy_postpartum cohort"]
  }
}
```

---

## 7. Authoring workflow checklist (for the LLM)

Before finalizing JSON, verify:

```json
{
  "pre_submit_checklist": [
    "Primary phase matches drill intent (not just equipment available)",
    "Subrole matches order slot for that phase",
    "Methodology primary home aligns with phase (no HIIT in Prepare, no max plyo in Restore)",
    "fatigue_cost and impact_level appropriate for phase",
    "Tenet tags match what the drill actually develops — not how hard it feels",
    "commonMisuse warns against the most likely sequencing mistake",
    "Scaling covers all six required cohorts with actionable prose",
    "Dosage unit matches drill type; rest periods realistic",
    "Slug is unique, kebab-case, and intent-clear",
    "No deprecated phase keys used"
  ]
}
```

---

## 8. Authoring JSON format (preferred — `scripts/data/*.mjs`)

Use **camelCase** field names. Taxonomy tags use **`key` + `weight`** (generators resolve DB ids).

### 8.1 Field schema

```json
{
  "$schema_note": "Informal schema for LLM output — not JSON Schema validated",
  "type": "object",
  "required": [
    "slug", "name", "family", "subrole", "slot", "cardSummary",
    "description", "tenets", "methodologies", "physiology", "patterns", "equipment",
    "whyItGoesHere", "commonMisuse",
    "movementRequirements", "coachingExecution", "dosage", "scaling", "safety"
  ],
  "properties": {
    "slug": { "type": "string", "pattern": "kebab-case" },
    "name": { "type": "string" },
    "family": { "type": "string" },
    "subrole": { "type": "string", "enum_ref": "see section 4 subroles for target phase" },
    "subroleSecondary": { "type": "string", "optional": true },
    "slot": { "type": "string", "description": "phase_order_slot.key" },
    "primaryPhaseKey": {
      "type": "string",
      "default": "prepare_and_access",
      "enum": ["prepare_and_access", "movement_intelligence", "output", "capacity", "resilience", "sustained_capacity", "restore"]
    },
    "cardSummary": { "type": "string", "max_sentences": 2 },
    "bestPlacement": { "type": "string", "maps_to": "programming_guidance" },
    "description": { "type": "string", "maps_to": "what_it_is" },
    "coachLanguage": { "type": "string" },
    "athleteLanguage": { "type": "string" },
    "tenets": { "type": "array", "items": { "key": "string", "weight": "1-5" } },
    "methodologies": { "type": "array", "items": { "key": "string", "weight": "1-5" } },
    "physiology": { "type": "array", "items": { "key": "string", "weight": "1-5" } },
    "patterns": { "type": "array", "items": { "key": "string", "weight": "1-5" } },
    "equipment": { "type": "array", "items": { "key": "string", "weight": "1-5" } },
    "body_regions": { "type": "array", "items": { "key": "string", "weight": "1-5" }, "optional": true },
    "whyItWorks": { "type": "string" },
    "whyItGoesHere": { "type": "string" },
    "commonMisuse": { "type": "string" },
    "scalingGuidance": { "type": "string" },
    "movementRequirements": {
      "type": "object",
      "properties": {
        "primary_joint_actions": { "type": "array", "items": "string" },
        "primary_tissues": { "type": "array", "items": "string" },
        "primary_motor_control_demands": { "type": "array", "items": "string", "optional": true },
        "postural_shape": { "type": "string", "optional": true },
        "breathing_demand": { "type": "string", "optional": true },
        "balance_demand": { "type": "string", "optional": true },
        "coordination_demand": { "type": "string", "optional": true },
        "impact_level": { "type": "integer", "min": 0, "max": 5 }
      }
    },
    "coachingExecution": {
      "type": "object",
      "properties": {
        "movement_description": { "type": "string" },
        "setup": { "type": "array", "items": "string", "min_items": 1 },
        "execution_steps": { "type": "array", "items": "string", "min_items": 1 },
        "coach_cues": { "type": "array", "items": "string" },
        "athlete_cues": { "type": "array", "items": "string", "optional": true },
        "breathing_cues": { "type": "array", "items": "string", "optional": true },
        "common_faults": { "type": "array", "items": "string" },
        "quality_gate": { "type": "array", "items": "string", "optional": true },
        "stop_signs": { "type": "array", "items": "string", "optional": true }
      }
    },
    "dosage": {
      "type": "object",
      "properties": {
        "volume_unit": { "enum": ["reps", "seconds", "distance", "contacts", "rounds", "attempts", "intervals", "breaths"] },
        "default_sets": { "type": "integer" },
        "default_reps": { "type": "integer", "nullable": true },
        "default_work_seconds": { "type": "integer", "nullable": true },
        "default_rest_seconds": { "type": "integer" },
        "est_seconds_per_set": { "type": "integer" },
        "default_rpe_min": { "type": "integer", "min": 1, "max": 10 },
        "default_rpe_max": { "type": "integer", "min": 1, "max": 10 }
      }
    },
    "scaling": {
      "type": "object",
      "required_cohorts": ["youth_beginner", "youth_intermediate", "teen", "adult_beginner", "adult_advanced", "older_adult"],
      "optional_cohorts": ["pregnancy_postpartum"],
      "cohort_values": "string prose per cohort key"
    },
    "genderSpecificNotes": { "type": "string" },
    "pairsWellAfter": { "type": "array", "items": "string" },
    "pairsWellBefore": { "type": "array", "items": "string", "optional": true },
    "doNotUseWhen": { "type": "array", "items": "string" },
    "goodForSessions": { "type": "array", "items": "string", "description": "session_need keys" },
    "mediaReferences": { "type": "array", "items": "string" },
    "mediaInternalNotes": { "type": "array", "items": "string" },
    "safety": {
      "type": "object",
      "properties": {
        "risk_level": { "type": "integer", "min": 1, "max": 5 },
        "impact_level": { "type": "integer", "min": 0, "max": 5 },
        "requires_spotting": { "type": "boolean" },
        "requires_coach_supervision": { "enum": ["optional", "recommended", "required"] },
        "readiness_checks": { "type": "array", "items": "string", "min_items": 1 },
        "contraindications": { "type": "array", "items": "string" },
        "common_substitutions": { "type": "array", "items": "string" }
      }
    },
    "regimen": {
      "type": "object",
      "properties": {
        "can_be_daily": { "type": "boolean" },
        "weekly_max_frequency": { "type": "integer" },
        "minimum_hours_between_hard_exposures": { "type": "integer" },
        "counts_as_high_intensity": { "type": "boolean" },
        "counts_as_high_impact": { "type": "boolean" },
        "counts_as_neural": { "type": "boolean" },
        "counts_as_tissue_stress": { "type": "boolean" },
        "counts_as_conditioning": { "type": "boolean" }
      }
    },
    "phaseProfile": {
      "type": "object",
      "description": "Optional explicit profile; otherwise inferred from phase defaults",
      "properties": {
        "role": { "enum": ["primary", "secondary", "conditional", "avoid"] },
        "fit_weight": { "type": "integer", "min": 1, "max": 5 },
        "freshness_required": { "type": "boolean" },
        "fatigue_cost": { "type": "integer", "min": 1, "max": 5 },
        "fatigue_sensitivity": { "type": "integer", "min": 1, "max": 5 },
        "technical_complexity": { "type": "integer", "min": 1, "max": 5 },
        "impact_level": { "type": "integer", "min": 0, "max": 5 },
        "intensity_ceiling": { "enum": ["low", "moderate", "high", null] }
      }
    }
  }
}
```

### 8.2 Complete example (copy-paste template)

Replace placeholders. This is a **Prepare & Access** reference card:

```json
{
  "slug": "9090-breathing-with-reach",
  "name": "90/90 Breathing with Reach",
  "family": "Breathing reset",
  "primaryPhaseKey": "prepare_and_access",
  "subrole": "mobilize",
  "subroleSecondary": "activate",
  "slot": "breathing_reset",
  "cardSummary": "Supine breathing reset that stacks ribs over pelvis, restores diaphragmatic breathing, and prepares the trunk for movement.",
  "bestPlacement": "First 1–3 minutes of session, especially before mobility, tumbling, sprint mechanics, lifting, or athletes who arrive overextended, anxious, or stiff.",
  "description": "Lie on the back with feet on a wall, bench, or box so hips and knees are bent to roughly 90 degrees. Keep the neck neutral. Reach arms toward the ceiling or slightly forward to bring the ribs down. Inhale through the nose, expanding the abdomen and lower ribs. Exhale slowly and fully, letting the ribs soften down without crunching.",
  "coachLanguage": "Primary subrole: Mobilize. Secondary intent: Activate trunk stabilizers. Use as a low-threat reset before higher-intent work.",
  "athleteLanguage": "Breathe low and wide; long exhale while reaching long.",
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
  ],
  "whyItWorks": "The 90/90 position gives the athlete a low-threat way to organize the ribcage, pelvis, and diaphragm. Slow nasal breathing with a longer exhale restores diaphragmatic patterning before higher-intent work.",
  "whyItGoesHere": "Belongs in Mobilize (breathing_reset) — trunk access and down-regulation before mobility or skill work.",
  "commonMisuse": "Do not use as a long relaxation block or substitute for raising temperature when athletes need active warm-up.",
  "scalingGuidance": "Scale by trunk control, comfort in supine, and breathing strategy; reduce reps/duration for youth.",
  "movementRequirements": {
    "primary_joint_actions": ["spine_rotation", "shoulder_flexion"],
    "primary_tissues": ["diaphragm", "intercostals"],
    "breathing_demand": "diaphragmatic",
    "balance_demand": "stable",
    "impact_level": 0
  },
  "coachingExecution": {
    "movement_description": "Lie on the back with feet on a wall, bench, or box so hips and knees are bent to roughly 90 degrees. Keep the neck neutral. Reach arms toward the ceiling or slightly forward to bring the ribs down. Inhale through the nose, expanding the abdomen and lower ribs. Exhale slowly and fully, letting the ribs soften down without crunching.",
    "setup": [
      "Lie on back with hips and knees at roughly 90 degrees (wall, bench, or box support)",
      "Reach arms toward ceiling or slightly forward",
      "Neck neutral, jaw relaxed"
    ],
    "execution_steps": [
      "Inhale through nose into abdomen and lower ribs",
      "Exhale slowly and fully while reaching longer",
      "Repeat for prescribed breaths"
    ],
    "coach_cues": [
      "Ribs down without forcing spinal flexion",
      "Pelvis neutral or slightly posteriorly tilted",
      "Long exhale",
      "Breath expands low, wide, and back — not just into the chest"
    ],
    "common_faults": [
      "Low back arching off the floor",
      "Shoulders shrugging",
      "Athlete crunching instead of exhaling",
      "Breath held during the reach"
    ]
  },
  "dosage": {
    "volume_unit": "breaths",
    "default_sets": 1,
    "default_reps": 5,
    "default_work_seconds": 45,
    "default_rest_seconds": 0,
    "est_seconds_per_set": 60,
    "default_rpe_min": 1,
    "default_rpe_max": 2
  },
  "scaling": {
    "youth_beginner": "Hands on belly/ribs. Cue: fill the balloon, blow out slow.",
    "youth_intermediate": "Gentle reach and heel pressure into wall.",
    "teen": "Wall support; 4-second inhale, 6-second exhale.",
    "adult_beginner": "Wall support; 4-second inhale, 6-second exhale.",
    "adult_advanced": "Dead bug arm reach, heel drag, or exhale-to-brace transition.",
    "older_adult": "Bench/chair support; avoid floor if mobility is limited.",
    "pregnancy_postpartum": "Avoid prolonged supine; use side-lying or seated breathing alternative."
  },
  "genderSpecificNotes": "No default gender adjustment; scale by trunk control, comfort, pregnancy/postpartum status, and breathing strategy.",
  "pairsWellAfter": ["Crocodile Breathing", "Dead Bug", "Cat-Cow", "Glute Bridge"],
  "doNotUseWhen": [
    "Athlete feels dizzy in supine breathing",
    "Supine position is uncomfortable or contraindicated",
    "Class needs immediate temperature raise and athletes are already moving well"
  ],
  "goodForSessions": ["general_warmup", "low_readiness_reset"],
  "mediaReferences": ["Functional Movement Systems 90/90 Breathing Position"],
  "mediaInternalNotes": ["Best as reset, not a long relaxation block."],
  "safety": {
    "risk_level": 1,
    "impact_level": 0,
    "requires_spotting": false,
    "requires_coach_supervision": "optional",
    "readiness_checks": [
      "Comfortable in supine",
      "No dizziness with slow breathing"
    ],
    "contraindications": [],
    "common_substitutions": ["Seated breathing alternative", "Side-lying breathing"]
  },
  "regimen": {
    "can_be_daily": true,
    "weekly_max_frequency": 7,
    "minimum_hours_between_hard_exposures": 0,
    "counts_as_high_intensity": false,
    "counts_as_high_impact": false,
    "counts_as_neural": false,
    "counts_as_tissue_stress": false,
    "counts_as_conditioning": false
  },
  "phaseProfile": {
    "role": "primary",
    "fit_weight": 5,
    "freshness_required": false,
    "fatigue_cost": 1,
    "fatigue_sensitivity": 1,
    "technical_complexity": 1,
    "impact_level": 0,
    "intensity_ceiling": "low"
  }
}
```

### 8.3 Batch output format

When generating multiple cards, return:

```json
{
  "cluster": {
    "phase": "prepare_and_access",
    "subrole": "mobilize",
    "slot_band": "breathing_reset",
    "card_count": 1
  },
  "cards": [
    { "slug": "example-slug", "name": "Example Name", "...": "..." }
  ]
}
```

---

## 9. API JSON format (`POST/PUT /api/coach/exercises`)

Use when importing directly via API. **snake_case** keys. Tags need **`facetId`** from `GET /api/coach/taxonomy` (not just key).

```json
{
  "name": "90/90 Breathing with Reach",
  "slug": "9090-breathing-with-reach",
  "card_summary": "...",
  "coach_language": "...",
  "athlete_language": "...",
  "description": "...",
  "est_seconds_per_set": 60,
  "movement_identity": {
    "movement_family": "Breathing reset",
    "phase_key": "prepare_and_access",
    "phase_subrole": "mobilize",
    "order_slot": "breathing_reset"
  },
  "movement_requirements": { "primary_joint_actions": [], "primary_tissues": [], "impact_level": 0 },
  "coaching_execution": { "setup": [], "execution_steps": [], "coach_cues": [], "common_faults": [] },
  "tags": [
    { "facetType": "tenet", "facetId": 1, "weight": 4 }
  ],
  "phase_profiles": [{
    "phase_id": 1,
    "role": "primary",
    "fit_weight": 5,
    "order_slot": "breathing_reset",
    "freshness_required": false,
    "fatigue_cost": 1,
    "fatigue_sensitivity": 1,
    "technical_complexity": 1,
    "impact_level": 0,
    "intensity_ceiling": "low"
  }],
  "why_layer": {
    "what_it_is": "...",
    "why_it_works": "...",
    "why_it_goes_here": "...",
    "programming_guidance": "...",
    "common_misuse": "...",
    "scaling_guidance": "..."
  },
  "dosage": {
    "volume_unit": "breaths",
    "default_sets": 1,
    "default_reps": 5,
    "default_work_seconds": 45,
    "default_rest_seconds": 0,
    "est_seconds_per_set": 60,
    "default_rpe_min": 1,
    "default_rpe_max": 2
  },
  "scaling": {
    "youth_beginner": { "load_guidance": "..." },
    "youth_intermediate": { "load_guidance": "..." },
    "teen": { "load_guidance": "..." },
    "adult_beginner": { "load_guidance": "..." },
    "adult_advanced": { "load_guidance": "..." },
    "older_adult": { "load_guidance": "..." },
    "pregnancy_postpartum": { "load_guidance": "..." },
    "gender_specific_notes": "..."
  },
  "pairing_logic": {
    "pairs_well_after": [],
    "do_not_use_when": [],
    "good_for_sessions": []
  },
  "safety_profile": {
    "risk_level": 1,
    "impact_level": 0,
    "requires_spotting": false,
    "requires_coach_supervision": "optional",
    "readiness_checks": [],
    "contraindications": [],
    "common_substitutions": []
  },
  "regimen_rule": {
    "can_be_daily": true,
    "weekly_max_frequency": 7,
    "minimum_hours_between_hard_exposures": 0,
    "counts_as_high_intensity": false,
    "counts_as_high_impact": false,
    "counts_as_neural": false,
    "counts_as_tissue_stress": false,
    "counts_as_conditioning": false
  },
  "media_library": {
    "clinical_or_sport_science_references": [],
    "internal_notes": []
  }
}
```

**Read-back shape:** `GET /api/coach/exercises/:id/card` returns nested sections: `movement_identity`, `taxonomy`, `why_layer`, `coaching_execution`, `dosage`, `scaling`, `pairing_logic`, `safety_profile`, `media_and_document_library`.

---

## 10. Phase-specific dose guidance (quick reference)

```json
{
  "phase_dose_defaults": {
    "prepare_and_access": {
      "fatigue_cost": "1-2",
      "impact_level": "0-1",
      "intensity_ceiling": "low",
      "rpe_typical": "1-3",
      "rest": "minimal",
      "can_be_daily": true
    },
    "movement_intelligence": {
      "fatigue_cost": "2-4",
      "freshness_required": true,
      "rpe_typical": "3-5 technical",
      "rest": "enough to keep reps crisp",
      "think": "Quality over volume; stop when timing degrades"
    },
    "output": {
      "fatigue_cost": "4-5",
      "freshness_required": true,
      "rpe_typical": "7-9 intent, low rep count",
      "rest": "full — 60-180s+ depending on drill",
      "think": "Contacts and attempts capped; progress via quality not exhaustion"
    },
    "capacity": {
      "fatigue_cost": "3-4",
      "rpe_typical": "6-8 strength",
      "rest": "60-120s typical between sets",
      "think": "Progressive load; not max sprint or plyo main work"
    },
    "resilience": {
      "fatigue_cost": "2-4 local tissue stress",
      "rpe_typical": "moderate control focus",
      "think": "Landing sticks, iso holds, eccentrics — control not speed"
    },
    "sustained_capacity": {
      "fatigue_cost": "4-5",
      "counts_as_conditioning": true,
      "think": "Elevated HR on purpose; late placement"
    },
    "restore": {
      "fatigue_cost": "1",
      "impact_level": "0",
      "think": "Downshift; static flex OK here, not before Output"
    }
  }
}
```

---

## 11. Common LLM mistakes to avoid

```json
{
  "anti_patterns": [
    {
      "mistake": "Tagging everything as explosiveness or agility because it feels athletic",
      "fix": "Tag the primary transfer — a heavy squat is strength; a fresh CMJ is explosiveness; fatigued box jumps are conditioning"
    },
    {
      "mistake": "Placing high-fatigue drills in Prepare & Access",
      "fix": "Move to Capacity, Output, or Sustained Capacity based on intent"
    },
    {
      "mistake": "Using deprecated phase keys (prepare_access, skill_movement_intelligence, etc.)",
      "fix": "Use canonical keys from section 2"
    },
    {
      "mistake": "Subrole contradicts order slot",
      "fix": "Pick slot first; subrole must match slot's subrole_key"
    },
    {
      "mistake": "Generic scaling copy pasted across all cohorts",
      "fix": "Each cohort needs a distinct, actionable regression or progression"
    },
    {
      "mistake": "Missing commonMisuse",
      "fix": "Always state the most likely wrong placement or dose error"
    },
    {
      "mistake": "Coaching execution without setup steps",
      "fix": "Publish gate requires setup[] and execution_steps[]"
    },
    {
      "mistake": "Duplicate or near-duplicate slugs/names in same cluster",
      "fix": "Check existing library slugs; differentiate intent in name and summary"
    }
  ]
}
```

---

## 12. Optional cluster-specific profiles

Some Output / Resilience cards include extra JSON on `movement_requirements` for validators:

```json
{
  "optional_movement_requirement_extensions": {
    "landing_control_profile": "Resilience landing cluster — surface type, amplitude, stick quality",
    "anti_movement_profile": "Resilience trunk cluster — anchor, reach direction, rotation tolerance",
    "joint_resilience_profile": "Slow eccentric cluster — tissue target, range, tempo",
    "setup_metadata": "Output decel/reactive — cone layout, approach speed",
    "cod_stress_profile": "Output COD — cut angle, approach velocity",
    "reactive_output_profile": "Output reactive tumbling — stimulus type, amplitude cap"
  },
  "note": "Only add when authoring cards in those validated clusters; mirror existing cards in scripts/data/"
}
```

---

## 13. Related files in this repo

```json
{
  "references": {
    "spec": "docs/EXERCISE_CARD_SPEC.md",
    "architecture": "docs/DATABASE_ARCHITECTURE.md",
    "example_data_prepare": "scripts/data/foundation-access-cards-1-10.mjs",
    "example_data_resilience": "scripts/data/control-card-factory.mjs",
    "save_logic": "backend/platform/exerciseProgramming.js",
    "publish_validation": "backend/platform/exerciseProgramming.js validateExercisePublishReady",
    "phase_keys": "src/coach/sessionPhaseKeys.ts",
    "taxonomy_constants": "src/coach/taxonomy.ts"
  }
}
```

---

## 14. Prompt stub (paste into ChatGPT / Claude)

```
You are authoring Vortex coaching exercise cards (Card v2) for the Athleticism Accelerator.

Rules:
- Follow docs/exercise_card_details.md exactly.
- Output valid JSON using the Authoring format (§8): camelCase, taxonomy by key+weight.
- Pick canonical phase keys only (prepare_and_access, movement_intelligence, output, capacity, resilience, sustained_capacity, restore).
- Match subrole to order slot for the target phase.
- Include all publish-required fields and six scaling cohorts.
- commonMisuse must warn against realistic sequencing errors.
- Do not invent equipment keys unless necessary; prefer the equipment_common list.

Task: Generate [N] cards for phase [PHASE], subrole [SUBROLE], slot band [SLOT].
Return: { "cluster": {...}, "cards": [...] }
```
