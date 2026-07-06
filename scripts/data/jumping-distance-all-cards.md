# Top 50 Jumping Athletes for Distance Exercise Cards

Primary source used: exercise_card_details_for_llm.md, the Vortex Card v2 authoring guide. It defines phase-first authoring, canonical phase keys, taxonomy tags using key + weight, publish gates, dosage/scaling/safety fields, regimen, phaseProfile, and the preferred camelCase Authoring JSON shape. Purpose.txt was requested and searched for, but no file literally titled Purpose.txt surfaced in the accessible File Library results for this run; therefore this deliverable is grounded in exercise_card_details_for_llm.md, existing Vortex card conventions, and stable coaching expertise.

## Category map

- **01-10 — Foundation: landing, braking, foot/ankle stiffness, and takeoff access:** Landing shapes, low-level stiffness, limb alignment, and foot/ankle readiness so distance jumps can be trained without noisy contacts or uncontrolled landings.
- **11-20 — Approach speed, rhythm, penultimate mechanics, and takeoff timing:** Sprint-mechanics and run-up drills that teach posture, acceleration, rhythm, checkmark consistency, penultimate timing, and takeoff posture before maximal jumping.
- **21-30 — Horizontal projection and broad-jump power:** High-intent horizontal jumps, hops, and bounds that train projection angle, hip extension, arm swing, stiffness, and controlled distance-oriented landing.
- **31-40 — Bounds, hops, and triple-jump elasticity:** Elastic and reactive progressions for athletes who already own basic landings and need rhythmic distance contacts, phase control, and repeated projection.
- **41-50 — Strength, tendon, trunk, and throwing support:** Capacity and power-support exercises that build the force, tendon capacity, hamstring/hip reserve, trunk stiffness, and throw-based projection qualities that support long jumping and broad jumping.

Complete Card v2 authoring output for Cursor/import work follows by batch.

# Exercise Library Batch 01-10 — Jumping Athletes for Distance

## Source and authoring basis

- Primary source used: exercise_card_details_for_llm.md, the Vortex Card v2 authoring guide. It defines phase-first authoring, canonical phase keys, taxonomy tags using key + weight, publish gates, dosage/scaling/safety fields, regimen, phaseProfile, and the preferred camelCase Authoring JSON shape. Purpose.txt was requested and searched for, but no file literally titled Purpose.txt surfaced in the accessible File Library results for this run; therefore this deliverable is grounded in exercise_card_details_for_llm.md, existing Vortex card conventions, and stable coaching expertise.
- Card v2 authoring shape used in each card: identity fields, `primaryPhaseKey`, `subrole`, `subroleSecondary`, `slot`, taxonomy tags, `movementRequirements`, `coachingExecution`, `dosage`, `scaling`, `pairingLogic`, `safety`, `regimen`, and `phaseProfile`.
- Programming rule: distance-jump outputs are quality-first. Stop when rhythm, stiffness, projection, landing quality, or release speed degrades.

## Category focus

**Foundation: landing, braking, foot/ankle stiffness, and takeoff access** — Landing shapes, low-level stiffness, limb alignment, and foot/ankle readiness so distance jumps can be trained without noisy contacts or uncontrolled landings.

## Exercises in this batch

01. **Snap Down to Stick** — `resilience` / `landing_braking_control` / `snap_down_to_stick`
02. **Drop Landing to Stick** — `resilience` / `landing_braking_control` / `drop_landing_to_stick`
03. **Single-Leg Landing Stick** — `resilience` / `single_leg_balance_foot_ankle_hip_control` / `single_leg_landing_stick`
04. **Low Box Step-Off to Horizontal Stick** — `resilience` / `landing_braking_control` / `low_box_step_off_to_horizontal_stick`
05. **Ankle Pogo in Place** — `output` / `elastic_stiffness_plyometric_rudiments` / `ankle_pogo_in_place`
06. **Forward-Backward Line Pogo** — `output` / `elastic_stiffness_plyometric_rudiments` / `forward_backward_line_pogo`
07. **Single-Leg Pogo in Place** — `output` / `elastic_stiffness_plyometric_rudiments` / `single_leg_pogo_in_place`
08. **Ankling Walk** — `movement_intelligence` / `locomotion_sprint_mechanics` / `ankling_walk`
09. **Tibialis Raise** — `resilience` / `lower_leg_tissue_capacity` / `tibialis_raise`
10. **Hip Airplane Stick** — `movement_intelligence` / `single_leg_balance_foot_ankle_hip_control` / `hip_airplane_stick`

## Cursor-ready JSON

```json
{
  "cluster": {
    "title": "Jumping Athletes for Distance Exercise Cards 01-10",
    "focus": "jumping_athletes_for_distance",
    "batch": "01-10",
    "category": "Foundation: landing, braking, foot/ankle stiffness, and takeoff access",
    "categoryFocus": "Landing shapes, low-level stiffness, limb alignment, and foot/ankle readiness so distance jumps can be trained without noisy contacts or uncontrolled landings.",
    "cardCount": 10,
    "sourceBasis": "Primary source used: exercise_card_details_for_llm.md, the Vortex Card v2 authoring guide. It defines phase-first authoring, canonical phase keys, taxonomy tags using key + weight, publish gates, dosage/scaling/safety fields, regimen, phaseProfile, and the preferred camelCase Authoring JSON shape. Purpose.txt was requested and searched for, but no file literally titled Purpose.txt surfaced in the accessible File Library results for this run; therefore this deliverable is grounded in exercise_card_details_for_llm.md, existing Vortex card conventions, and stable coaching expertise.",
    "authoringRule": "Use camelCase Card v2 objects with canonical phase keys, taxonomy key+weight tags, movementRequirements, coachingExecution, dosage, scaling cohorts, safety, regimen, and phaseProfile."
  },
  "cards": [
    {
      "id": 1,
      "slug": "snap-down-to-stick",
      "name": "Snap Down to Stick",
      "family": "Landing and braking control",
      "category": "01-10 - Foundation: landing, braking, foot/ankle stiffness, and takeoff access",
      "phaseKey": "resilience",
      "primaryPhaseKey": "resilience",
      "subrole": "landing_braking_control",
      "subroleSecondary": "output_prep",
      "slot": "snap_down_to_stick",
      "cardSummary": "Snap Down to Stick is a Resilience drill for jumping athletes who need more horizontal distance. Teaches fast postural organization into a quiet athletic landing before longer jumps are loaded.",
      "bestPlacement": "Use after high-output jumping/sprinting or on a separate support day when the goal is control, strength, or tissue capacity rather than maximal distance attempts.",
      "description": "Snap Down to Stick addresses distance-jumping performance by targeting teaches fast postural organization into a quiet athletic landing before longer jumps are loaded. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: landing_braking_control. Coach Snap Down to Stick for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Resilience intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "body_control",
          "weight": 5
        },
        {
          "key": "balance",
          "weight": 4
        },
        {
          "key": "coordination",
          "weight": 4
        },
        {
          "key": "resilience",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "balance_stability",
          "weight": 4
        },
        {
          "key": "core_body_control",
          "weight": 4
        },
        {
          "key": "isometrics",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "control_stability",
          "weight": 5
        },
        {
          "key": "tissue_capacity",
          "weight": 3
        },
        {
          "key": "neural_output_readiness",
          "weight": 2
        }
      ],
      "patterns": [
        {
          "key": "land",
          "weight": 5
        },
        {
          "key": "brace",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "none",
          "weight": 5
        }
      ],
      "bodyRegions": [
        {
          "key": "foot",
          "weight": 5
        },
        {
          "key": "ankle",
          "weight": 3
        },
        {
          "key": "knee",
          "weight": 2
        },
        {
          "key": "hip",
          "weight": 2
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "selectionReason": "Teaches fast postural organization into a quiet athletic landing before longer jumps are loaded.",
      "whyItWorks": "Snap Down to Stick works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Resilience / landing_braking_control because the intent is controlled landing, braking, eccentric/isometric ownership, and tissue tolerance rather than maximal distance or conditioning.",
      "commonMisuse": "Do not use Snap Down to Stick as a max jump or fatigue drill. Keep the emphasis on quiet control, alignment, and tissue tolerance.",
      "movementRequirements": {
        "primaryJointActions": [
          "hip_flexion_extension",
          "knee_flexion_extension",
          "ankle_dorsiflexion_plantarflexion"
        ],
        "primaryTissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "foot_intrinsics"
        ],
        "coordinationDemand": "moderate",
        "balanceDemand": "moderate",
        "landingOrImpact": {
          "impactLevel": 2,
          "landingQualityRequired": true,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Snap Down to Stick as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Set a clear lane and landing target for Snap Down to Stick; use none as needed.",
          "Give the athlete enough space to land, stick, and step out safely.",
          "Start with the lower-amplitude version and confirm quiet landings before adding distance or speed."
        ],
        "executionSteps": [
          "Start tall or from the assigned low box/entry position.",
          "Move into the landing task with controlled intent.",
          "Land through the midfoot with knees tracking over toes and hips back enough to absorb force.",
          "Freeze for two seconds, breathe, and reset before the next attempt."
        ],
        "coachCues": [
          "Quiet feet",
          "Knee over middle toes",
          "Hips level",
          "Own the stick",
          "Breathe before you move"
        ],
        "commonFaults": [
          "Knee dives inward",
          "Heel or toe lifts excessively",
          "Trunk folds or twists",
          "Athlete steps out before owning the stick",
          "Landing noise increases"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "attempts",
        "defaultSets": 2,
        "defaultReps": 4,
        "defaultWorkSeconds": 20,
        "defaultRestSeconds": 45,
        "estSecondsPerSet": 70,
        "defaultRpeMin": 3,
        "defaultRpeMax": 5,
        "notes": "Stop each set when landing noise, posture, or alignment degrades."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Snap Down to Stick. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "control_landing",
          "deceleration",
          "resilience"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 2,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern.",
          "Load, range, or lever can be controlled without compensatory twisting, collapse, or symptom response."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": false,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Supported Single-Leg Balance",
          "Step-Off to Stick",
          "Hip Airplane with Support"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 3,
        "minimumHoursBetweenHardExposures": 24,
        "countsAsHighIntensity": false,
        "countsAsHighImpact": false,
        "countsAsNeural": false,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "resilience",
          "role": "primary",
          "fitWeight": 4,
          "freshnessRequired": false,
          "fatigueCost": 2,
          "fatigueSensitivity": 3,
          "technicalComplexity": 3,
          "intensityCeiling": "moderate_control",
          "impactLevel": 2
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    },
    {
      "id": 2,
      "slug": "drop-landing-to-stick",
      "name": "Drop Landing to Stick",
      "family": "Drop landing control",
      "category": "01-10 - Foundation: landing, braking, foot/ankle stiffness, and takeoff access",
      "phaseKey": "resilience",
      "primaryPhaseKey": "resilience",
      "subrole": "landing_braking_control",
      "subroleSecondary": "output_prep",
      "slot": "drop_landing_to_stick",
      "cardSummary": "Drop Landing to Stick is a Resilience drill for jumping athletes who need more horizontal distance. Builds landing tolerance and braking posture from a slightly higher entry without turning it into a jump workout.",
      "bestPlacement": "Use after high-output jumping/sprinting or on a separate support day when the goal is control, strength, or tissue capacity rather than maximal distance attempts.",
      "description": "Drop Landing to Stick addresses distance-jumping performance by targeting builds landing tolerance and braking posture from a slightly higher entry without turning it into a jump workout. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: landing_braking_control. Coach Drop Landing to Stick for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Resilience intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "body_control",
          "weight": 5
        },
        {
          "key": "balance",
          "weight": 4
        },
        {
          "key": "coordination",
          "weight": 4
        },
        {
          "key": "resilience",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "balance_stability",
          "weight": 4
        },
        {
          "key": "core_body_control",
          "weight": 4
        },
        {
          "key": "isometrics",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "control_stability",
          "weight": 5
        },
        {
          "key": "tissue_capacity",
          "weight": 3
        },
        {
          "key": "neural_output_readiness",
          "weight": 2
        }
      ],
      "patterns": [
        {
          "key": "land",
          "weight": 5
        },
        {
          "key": "brace",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "low_box",
          "weight": 5
        }
      ],
      "bodyRegions": [
        {
          "key": "foot",
          "weight": 5
        },
        {
          "key": "ankle",
          "weight": 3
        },
        {
          "key": "knee",
          "weight": 2
        },
        {
          "key": "hip",
          "weight": 2
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "selectionReason": "Builds landing tolerance and braking posture from a slightly higher entry without turning it into a jump workout.",
      "whyItWorks": "Drop Landing to Stick works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Resilience / landing_braking_control because the intent is controlled landing, braking, eccentric/isometric ownership, and tissue tolerance rather than maximal distance or conditioning.",
      "commonMisuse": "Do not use Drop Landing to Stick as a max jump or fatigue drill. Keep the emphasis on quiet control, alignment, and tissue tolerance.",
      "movementRequirements": {
        "primaryJointActions": [
          "hip_flexion",
          "knee_flexion",
          "ankle_dorsiflexion"
        ],
        "primaryTissues": [
          "calves",
          "quadriceps",
          "glutes",
          "tendons"
        ],
        "coordinationDemand": "moderate",
        "balanceDemand": "moderate",
        "landingOrImpact": {
          "impactLevel": 3,
          "landingQualityRequired": true,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Drop Landing to Stick as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Set a clear lane and landing target for Drop Landing to Stick; use low box as needed.",
          "Give the athlete enough space to land, stick, and step out safely.",
          "Start with the lower-amplitude version and confirm quiet landings before adding distance or speed."
        ],
        "executionSteps": [
          "Start tall or from the assigned low box/entry position.",
          "Move into the landing task with controlled intent.",
          "Land through the midfoot with knees tracking over toes and hips back enough to absorb force.",
          "Freeze for two seconds, breathe, and reset before the next attempt."
        ],
        "coachCues": [
          "Quiet feet",
          "Knee over middle toes",
          "Hips level",
          "Own the stick",
          "Breathe before you move"
        ],
        "commonFaults": [
          "Knee dives inward",
          "Heel or toe lifts excessively",
          "Trunk folds or twists",
          "Athlete steps out before owning the stick",
          "Landing noise increases"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "attempts",
        "defaultSets": 2,
        "defaultReps": 4,
        "defaultWorkSeconds": 20,
        "defaultRestSeconds": 45,
        "estSecondsPerSet": 70,
        "defaultRpeMin": 3,
        "defaultRpeMax": 5,
        "notes": "Stop each set when landing noise, posture, or alignment degrades."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Drop Landing to Stick. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "control_landing",
          "deceleration",
          "resilience"
        ]
      },
      "safety": {
        "riskLevel": 3,
        "impactLevel": 3,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern.",
          "Athlete can demonstrate a quiet lower-level landing or contact progression before this drill.",
          "Surface, footwear, spacing, and recovery allow high-quality contacts.",
          "Load, range, or lever can be controlled without compensatory twisting, collapse, or symptom response."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": false,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Supported Single-Leg Balance",
          "Step-Off to Stick",
          "Hip Airplane with Support"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": false,
        "countsAsHighImpact": true,
        "countsAsNeural": false,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "resilience",
          "role": "primary",
          "fitWeight": 4,
          "freshnessRequired": false,
          "fatigueCost": 2,
          "fatigueSensitivity": 3,
          "technicalComplexity": 3,
          "intensityCeiling": "moderate_control",
          "impactLevel": 3
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    },
    {
      "id": 3,
      "slug": "single-leg-landing-stick",
      "name": "Single-Leg Landing Stick",
      "family": "Single-leg landing control",
      "category": "01-10 - Foundation: landing, braking, foot/ankle stiffness, and takeoff access",
      "phaseKey": "resilience",
      "primaryPhaseKey": "resilience",
      "subrole": "single_leg_balance_foot_ankle_hip_control",
      "subroleSecondary": "landing_braking_control",
      "slot": "single_leg_landing_stick",
      "cardSummary": "Single-Leg Landing Stick is a Resilience drill for jumping athletes who need more horizontal distance. Builds unilateral landing ownership so takeoff and landing forces do not collapse through the hip, knee, or foot.",
      "bestPlacement": "Use after high-output jumping/sprinting or on a separate support day when the goal is control, strength, or tissue capacity rather than maximal distance attempts.",
      "description": "Single-Leg Landing Stick addresses distance-jumping performance by targeting builds unilateral landing ownership so takeoff and landing forces do not collapse through the hip, knee, or foot. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: single_leg_balance_foot_ankle_hip_control. Coach Single-Leg Landing Stick for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Resilience intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "body_control",
          "weight": 5
        },
        {
          "key": "balance",
          "weight": 4
        },
        {
          "key": "coordination",
          "weight": 4
        },
        {
          "key": "resilience",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "balance_stability",
          "weight": 4
        },
        {
          "key": "core_body_control",
          "weight": 4
        },
        {
          "key": "isometrics",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "control_stability",
          "weight": 5
        },
        {
          "key": "tissue_capacity",
          "weight": 3
        },
        {
          "key": "neural_output_readiness",
          "weight": 2
        }
      ],
      "patterns": [
        {
          "key": "land",
          "weight": 5
        },
        {
          "key": "brace",
          "weight": 3
        },
        {
          "key": "balance",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "none",
          "weight": 5
        }
      ],
      "bodyRegions": [
        {
          "key": "foot",
          "weight": 5
        },
        {
          "key": "ankle",
          "weight": 3
        },
        {
          "key": "knee",
          "weight": 2
        },
        {
          "key": "hip",
          "weight": 2
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "selectionReason": "Builds unilateral landing ownership so takeoff and landing forces do not collapse through the hip, knee, or foot.",
      "whyItWorks": "Single-Leg Landing Stick works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Resilience / single_leg_balance_foot_ankle_hip_control because the intent is controlled landing, braking, eccentric/isometric ownership, and tissue tolerance rather than maximal distance or conditioning.",
      "commonMisuse": "Do not use Single-Leg Landing Stick as a max jump or fatigue drill. Keep the emphasis on quiet control, alignment, and tissue tolerance.",
      "movementRequirements": {
        "primaryJointActions": [
          "single_leg_hip_knee_ankle_alignment",
          "frontal_plane_control"
        ],
        "primaryTissues": [
          "glute_medius",
          "calves",
          "quadriceps",
          "foot_intrinsics"
        ],
        "coordinationDemand": "moderate",
        "balanceDemand": "high",
        "landingOrImpact": {
          "impactLevel": 3,
          "landingQualityRequired": true,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Single-Leg Landing Stick as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Set a clear lane and landing target for Single-Leg Landing Stick; use none as needed.",
          "Give the athlete enough space to land, stick, and step out safely.",
          "Start with the lower-amplitude version and confirm quiet landings before adding distance or speed."
        ],
        "executionSteps": [
          "Start tall or from the assigned low box/entry position.",
          "Move into the landing task with controlled intent.",
          "Land through the midfoot with knees tracking over toes and hips back enough to absorb force.",
          "Freeze for two seconds, breathe, and reset before the next attempt."
        ],
        "coachCues": [
          "Quiet feet",
          "Knee over middle toes",
          "Hips level",
          "Own the stick",
          "Breathe before you move"
        ],
        "commonFaults": [
          "Knee dives inward",
          "Heel or toe lifts excessively",
          "Trunk folds or twists",
          "Athlete steps out before owning the stick",
          "Landing noise increases"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "attempts",
        "defaultSets": 2,
        "defaultReps": 4,
        "defaultWorkSeconds": 20,
        "defaultRestSeconds": 45,
        "estSecondsPerSet": 70,
        "defaultRpeMin": 3,
        "defaultRpeMax": 5,
        "notes": "Stop each set when landing noise, posture, or alignment degrades."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Single-Leg Landing Stick. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "control_landing",
          "deceleration",
          "resilience"
        ]
      },
      "safety": {
        "riskLevel": 3,
        "impactLevel": 3,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern.",
          "Athlete can demonstrate a quiet lower-level landing or contact progression before this drill.",
          "Surface, footwear, spacing, and recovery allow high-quality contacts.",
          "Load, range, or lever can be controlled without compensatory twisting, collapse, or symptom response."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": false,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Supported Single-Leg Balance",
          "Step-Off to Stick",
          "Hip Airplane with Support"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": false,
        "countsAsHighImpact": true,
        "countsAsNeural": false,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "resilience",
          "role": "primary",
          "fitWeight": 4,
          "freshnessRequired": false,
          "fatigueCost": 2,
          "fatigueSensitivity": 3,
          "technicalComplexity": 3,
          "intensityCeiling": "moderate_control",
          "impactLevel": 3
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    },
    {
      "id": 4,
      "slug": "low-box-step-off-to-horizontal-stick",
      "name": "Low Box Step-Off to Horizontal Stick",
      "family": "Horizontal landing control",
      "category": "01-10 - Foundation: landing, braking, foot/ankle stiffness, and takeoff access",
      "phaseKey": "resilience",
      "primaryPhaseKey": "resilience",
      "subrole": "landing_braking_control",
      "subroleSecondary": "horizontal_landing_control",
      "slot": "low_box_step_off_to_horizontal_stick",
      "cardSummary": "Low Box Step-Off to Horizontal Stick is a Resilience drill for jumping athletes who need more horizontal distance. Adds a small forward travel demand so athletes learn to absorb horizontal momentum cleanly.",
      "bestPlacement": "Use after high-output jumping/sprinting or on a separate support day when the goal is control, strength, or tissue capacity rather than maximal distance attempts.",
      "description": "Low Box Step-Off to Horizontal Stick addresses distance-jumping performance by targeting adds a small forward travel demand so athletes learn to absorb horizontal momentum cleanly. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: landing_braking_control. Coach Low Box Step-Off to Horizontal Stick for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Resilience intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "body_control",
          "weight": 5
        },
        {
          "key": "balance",
          "weight": 4
        },
        {
          "key": "coordination",
          "weight": 4
        },
        {
          "key": "resilience",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "balance_stability",
          "weight": 4
        },
        {
          "key": "core_body_control",
          "weight": 4
        },
        {
          "key": "isometrics",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "control_stability",
          "weight": 5
        },
        {
          "key": "tissue_capacity",
          "weight": 3
        },
        {
          "key": "neural_output_readiness",
          "weight": 2
        }
      ],
      "patterns": [
        {
          "key": "land",
          "weight": 5
        },
        {
          "key": "brace",
          "weight": 3
        },
        {
          "key": "jump",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "low_box",
          "weight": 5
        }
      ],
      "bodyRegions": [
        {
          "key": "foot",
          "weight": 5
        },
        {
          "key": "ankle",
          "weight": 3
        },
        {
          "key": "knee",
          "weight": 2
        },
        {
          "key": "hip",
          "weight": 2
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "selectionReason": "Adds a small forward travel demand so athletes learn to absorb horizontal momentum cleanly.",
      "whyItWorks": "Low Box Step-Off to Horizontal Stick works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Resilience / landing_braking_control because the intent is controlled landing, braking, eccentric/isometric ownership, and tissue tolerance rather than maximal distance or conditioning.",
      "commonMisuse": "Do not use Low Box Step-Off to Horizontal Stick as a max jump or fatigue drill. Keep the emphasis on quiet control, alignment, and tissue tolerance.",
      "movementRequirements": {
        "primaryJointActions": [
          "hip_hinge",
          "knee_flexion",
          "ankle_dorsiflexion"
        ],
        "primaryTissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings"
        ],
        "coordinationDemand": "moderate",
        "balanceDemand": "moderate",
        "landingOrImpact": {
          "impactLevel": 3,
          "landingQualityRequired": true,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Low Box Step-Off to Horizontal Stick as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Set a clear lane and landing target for Low Box Step-Off to Horizontal Stick; use low box as needed.",
          "Give the athlete enough space to land, stick, and step out safely.",
          "Start with the lower-amplitude version and confirm quiet landings before adding distance or speed."
        ],
        "executionSteps": [
          "Start tall or from the assigned low box/entry position.",
          "Move into the landing task with controlled intent.",
          "Land through the midfoot with knees tracking over toes and hips back enough to absorb force.",
          "Freeze for two seconds, breathe, and reset before the next attempt."
        ],
        "coachCues": [
          "Quiet feet",
          "Knee over middle toes",
          "Hips level",
          "Own the stick",
          "Breathe before you move"
        ],
        "commonFaults": [
          "Knee dives inward",
          "Heel or toe lifts excessively",
          "Trunk folds or twists",
          "Athlete steps out before owning the stick",
          "Landing noise increases"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "attempts",
        "defaultSets": 2,
        "defaultReps": 4,
        "defaultWorkSeconds": 20,
        "defaultRestSeconds": 45,
        "estSecondsPerSet": 70,
        "defaultRpeMin": 3,
        "defaultRpeMax": 5,
        "notes": "Stop each set when landing noise, posture, or alignment degrades."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Low Box Step-Off to Horizontal Stick. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "control_landing",
          "deceleration",
          "resilience"
        ]
      },
      "safety": {
        "riskLevel": 3,
        "impactLevel": 3,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern.",
          "Athlete can demonstrate a quiet lower-level landing or contact progression before this drill.",
          "Surface, footwear, spacing, and recovery allow high-quality contacts.",
          "Load, range, or lever can be controlled without compensatory twisting, collapse, or symptom response."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": false,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Supported Single-Leg Balance",
          "Step-Off to Stick",
          "Hip Airplane with Support"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": false,
        "countsAsHighImpact": true,
        "countsAsNeural": false,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "resilience",
          "role": "primary",
          "fitWeight": 4,
          "freshnessRequired": false,
          "fatigueCost": 2,
          "fatigueSensitivity": 3,
          "technicalComplexity": 3,
          "intensityCeiling": "moderate_control",
          "impactLevel": 3
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    },
    {
      "id": 5,
      "slug": "ankle-pogo-in-place",
      "name": "Ankle Pogo in Place",
      "family": "Foot-ankle elastic rudiment",
      "category": "01-10 - Foundation: landing, braking, foot/ankle stiffness, and takeoff access",
      "phaseKey": "output",
      "primaryPhaseKey": "output",
      "subrole": "elastic_stiffness_plyometric_rudiments",
      "subroleSecondary": "landing_control",
      "slot": "ankle_pogo_in_place",
      "cardSummary": "Ankle Pogo in Place is a Output drill for jumping athletes who need more horizontal distance. Low-amplitude elastic contact drill that teaches springy stiffness without large jump stress.",
      "bestPlacement": "Use early in the session after Prepare & Access and any required Movement Intelligence work, before heavy strength or conditioning. Keep volume low and rest long enough for every attempt to stay sharp.",
      "description": "Ankle Pogo in Place addresses distance-jumping performance by targeting low-amplitude elastic contact drill that teaches springy stiffness without large jump stress. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: elastic_stiffness_plyometric_rudiments. Coach Ankle Pogo in Place for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Output intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "explosiveness",
          "weight": 5
        },
        {
          "key": "speed",
          "weight": 4
        },
        {
          "key": "coordination",
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "elastic_energy",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
        },
        {
          "key": "neural_output_readiness",
          "weight": 4
        }
      ],
      "patterns": [
        {
          "key": "jump",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 3
        },
        {
          "key": "brace",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "none",
          "weight": 5
        }
      ],
      "bodyRegions": [
        {
          "key": "foot",
          "weight": 5
        },
        {
          "key": "ankle",
          "weight": 3
        },
        {
          "key": "calf",
          "weight": 2
        }
      ],
      "selectionReason": "Low-amplitude elastic contact drill that teaches springy stiffness without large jump stress.",
      "whyItWorks": "Ankle Pogo in Place works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Output / elastic_stiffness_plyometric_rudiments because the intended adaptation is high-quality force, speed, stiffness, projection, or elastic expression while fresh. Volume stays low and recovery stays long enough that every attempt remains sharp.",
      "commonMisuse": "Do not turn Ankle Pogo in Place into a conditioning station, contact-count challenge, or fatigue finisher. The set ends when speed, distance, stiffness, posture, landing quality, or intent drops.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle_stiffness",
          "forefoot_contact"
        ],
        "primaryTissues": [
          "achilles_tendon",
          "soleus",
          "gastrocnemius",
          "foot_intrinsics"
        ],
        "coordinationDemand": "high",
        "balanceDemand": "low_to_moderate",
        "landingOrImpact": {
          "impactLevel": 2,
          "landingQualityRequired": true,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Ankle Pogo in Place as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Mark a straight lane or contact zone for Ankle Pogo in Place; keep the surface flat, dry, and forgiving.",
          "Review the athlete's lower-level pogo, hop, or landing progression first.",
          "Use small contact volumes and full recovery so elastic quality is obvious."
        ],
        "executionSteps": [
          "Stand tall with ribs stacked and arms relaxed or in sprint-ready position.",
          "Bounce from the ankle with small knee bend and quick quiet contacts.",
          "Keep the heel from slamming and the trunk from rocking.",
          "Stop the set before contacts get slow, loud, or flat-footed."
        ],
        "coachCues": [
          "Tall hips",
          "Punch the ground",
          "Quiet contacts",
          "Rhythm before speed",
          "Step down under you"
        ],
        "commonFaults": [
          "Flat-footed contacts",
          "Overstriding",
          "Rising too early",
          "Arm swing crossing the body",
          "Chopping steps near markers"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "contacts",
        "defaultSets": 3,
        "defaultReps": 20,
        "defaultWorkSeconds": 15,
        "defaultRestSeconds": 60,
        "estSecondsPerSet": 75,
        "defaultRpeMin": 5,
        "defaultRpeMax": 7,
        "notes": "Keep contacts low, springy, and quiet; quality ends the set."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Ankle Pogo in Place. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "jump_power",
          "landing_prep",
          "sprint_prep"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 2,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern.",
          "Athlete is fresh enough that speed, distance, stiffness, and coordination can be expressed without fatigue leakage."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": false,
        "commonSubstitutions": [
          "Ankling Walk",
          "A-March",
          "Line Pogo",
          "Wall Drive March"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": false,
        "countsAsNeural": true,
        "countsAsTissueStress": false,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 4,
          "fatigueSensitivity": 5,
          "technicalComplexity": 4,
          "intensityCeiling": "high",
          "impactLevel": 2
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    },
    {
      "id": 6,
      "slug": "forward-backward-line-pogo",
      "name": "Forward-Backward Line Pogo",
      "family": "Linear foot-ankle elastic rudiment",
      "category": "01-10 - Foundation: landing, braking, foot/ankle stiffness, and takeoff access",
      "phaseKey": "output",
      "primaryPhaseKey": "output",
      "subrole": "elastic_stiffness_plyometric_rudiments",
      "subroleSecondary": "landing_control",
      "slot": "forward_backward_line_pogo",
      "cardSummary": "Forward-Backward Line Pogo is a Output drill for jumping athletes who need more horizontal distance. Adds small horizontal shifts to ankle stiffness so distance-jump contacts stay quick and organized.",
      "bestPlacement": "Use early in the session after Prepare & Access and any required Movement Intelligence work, before heavy strength or conditioning. Keep volume low and rest long enough for every attempt to stay sharp.",
      "description": "Forward-Backward Line Pogo addresses distance-jumping performance by targeting adds small horizontal shifts to ankle stiffness so distance-jump contacts stay quick and organized. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: elastic_stiffness_plyometric_rudiments. Coach Forward-Backward Line Pogo for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Output intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "explosiveness",
          "weight": 5
        },
        {
          "key": "speed",
          "weight": 4
        },
        {
          "key": "coordination",
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "elastic_energy",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
        },
        {
          "key": "neural_output_readiness",
          "weight": 4
        }
      ],
      "patterns": [
        {
          "key": "jump",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 3
        },
        {
          "key": "locomote",
          "weight": 2
        },
        {
          "key": "brace",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "line",
          "weight": 5
        }
      ],
      "bodyRegions": [
        {
          "key": "foot",
          "weight": 5
        },
        {
          "key": "ankle",
          "weight": 3
        },
        {
          "key": "calf",
          "weight": 2
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "selectionReason": "Adds small horizontal shifts to ankle stiffness so distance-jump contacts stay quick and organized.",
      "whyItWorks": "Forward-Backward Line Pogo works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Output / elastic_stiffness_plyometric_rudiments because the intended adaptation is high-quality force, speed, stiffness, projection, or elastic expression while fresh. Volume stays low and recovery stays long enough that every attempt remains sharp.",
      "commonMisuse": "Do not turn Forward-Backward Line Pogo into a conditioning station, contact-count challenge, or fatigue finisher. The set ends when speed, distance, stiffness, posture, landing quality, or intent drops.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle_stiffness",
          "small_horizontal_contacts"
        ],
        "primaryTissues": [
          "achilles_tendon",
          "soleus",
          "gastrocnemius"
        ],
        "coordinationDemand": "high",
        "balanceDemand": "low_to_moderate",
        "landingOrImpact": {
          "impactLevel": 2,
          "landingQualityRequired": true,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Forward-Backward Line Pogo as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Mark a straight lane or contact zone for Forward-Backward Line Pogo; keep the surface flat, dry, and forgiving.",
          "Review the athlete's lower-level pogo, hop, or landing progression first.",
          "Use small contact volumes and full recovery so elastic quality is obvious."
        ],
        "executionSteps": [
          "Stand tall with ribs stacked and arms relaxed or in sprint-ready position.",
          "Bounce from the ankle with small knee bend and quick quiet contacts.",
          "Keep the heel from slamming and the trunk from rocking.",
          "Stop the set before contacts get slow, loud, or flat-footed."
        ],
        "coachCues": [
          "Tall hips",
          "Punch the ground",
          "Quiet contacts",
          "Rhythm before speed",
          "Step down under you"
        ],
        "commonFaults": [
          "Flat-footed contacts",
          "Overstriding",
          "Rising too early",
          "Arm swing crossing the body",
          "Chopping steps near markers"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "contacts",
        "defaultSets": 3,
        "defaultReps": 20,
        "defaultWorkSeconds": 15,
        "defaultRestSeconds": 60,
        "estSecondsPerSet": 75,
        "defaultRpeMin": 5,
        "defaultRpeMax": 7,
        "notes": "Keep contacts low, springy, and quiet; quality ends the set."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Forward-Backward Line Pogo. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "jump_power",
          "landing_prep",
          "sprint_prep"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 2,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern.",
          "Athlete is fresh enough that speed, distance, stiffness, and coordination can be expressed without fatigue leakage."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": false,
        "commonSubstitutions": [
          "Ankling Walk",
          "A-March",
          "Line Pogo",
          "Wall Drive March"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": false,
        "countsAsNeural": true,
        "countsAsTissueStress": false,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 4,
          "fatigueSensitivity": 5,
          "technicalComplexity": 4,
          "intensityCeiling": "high",
          "impactLevel": 2
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    },
    {
      "id": 7,
      "slug": "single-leg-pogo-in-place",
      "name": "Single-Leg Pogo in Place",
      "family": "Single-leg foot-ankle elastic rudiment",
      "category": "01-10 - Foundation: landing, braking, foot/ankle stiffness, and takeoff access",
      "phaseKey": "output",
      "primaryPhaseKey": "output",
      "subrole": "elastic_stiffness_plyometric_rudiments",
      "subroleSecondary": "single_leg_elastic_contacts",
      "slot": "single_leg_pogo_in_place",
      "cardSummary": "Single-Leg Pogo in Place is a Output drill for jumping athletes who need more horizontal distance. Prepares unilateral takeoff stiffness with a smaller, more coachable contact than full single-leg hops.",
      "bestPlacement": "Use early in the session after Prepare & Access and any required Movement Intelligence work, before heavy strength or conditioning. Keep volume low and rest long enough for every attempt to stay sharp.",
      "description": "Single-Leg Pogo in Place addresses distance-jumping performance by targeting prepares unilateral takeoff stiffness with a smaller, more coachable contact than full single-leg hops. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: elastic_stiffness_plyometric_rudiments. Coach Single-Leg Pogo in Place for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Output intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "explosiveness",
          "weight": 5
        },
        {
          "key": "speed",
          "weight": 4
        },
        {
          "key": "coordination",
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "elastic_energy",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
        },
        {
          "key": "neural_output_readiness",
          "weight": 4
        }
      ],
      "patterns": [
        {
          "key": "jump",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 3
        },
        {
          "key": "balance",
          "weight": 2
        },
        {
          "key": "brace",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "none",
          "weight": 5
        }
      ],
      "bodyRegions": [
        {
          "key": "foot",
          "weight": 5
        },
        {
          "key": "ankle",
          "weight": 3
        },
        {
          "key": "calf",
          "weight": 2
        },
        {
          "key": "hip",
          "weight": 2
        }
      ],
      "selectionReason": "Prepares unilateral takeoff stiffness with a smaller, more coachable contact than full single-leg hops.",
      "whyItWorks": "Single-Leg Pogo in Place works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Output / elastic_stiffness_plyometric_rudiments because the intended adaptation is high-quality force, speed, stiffness, projection, or elastic expression while fresh. Volume stays low and recovery stays long enough that every attempt remains sharp.",
      "commonMisuse": "Do not turn Single-Leg Pogo in Place into a conditioning station, contact-count challenge, or fatigue finisher. The set ends when speed, distance, stiffness, posture, landing quality, or intent drops.",
      "movementRequirements": {
        "primaryJointActions": [
          "single_leg_ankle_stiffness",
          "hip_pelvis_stability"
        ],
        "primaryTissues": [
          "achilles_tendon",
          "soleus",
          "gastrocnemius",
          "glute_medius"
        ],
        "coordinationDemand": "high",
        "balanceDemand": "high",
        "landingOrImpact": {
          "impactLevel": 3,
          "landingQualityRequired": true,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Single-Leg Pogo in Place as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Mark a straight lane or contact zone for Single-Leg Pogo in Place; keep the surface flat, dry, and forgiving.",
          "Review the athlete's lower-level pogo, hop, or landing progression first.",
          "Use small contact volumes and full recovery so elastic quality is obvious."
        ],
        "executionSteps": [
          "Stand tall with ribs stacked and arms relaxed or in sprint-ready position.",
          "Bounce from the ankle with small knee bend and quick quiet contacts.",
          "Keep the heel from slamming and the trunk from rocking.",
          "Stop the set before contacts get slow, loud, or flat-footed."
        ],
        "coachCues": [
          "Tall hips",
          "Punch the ground",
          "Quiet contacts",
          "Rhythm before speed",
          "Step down under you"
        ],
        "commonFaults": [
          "Flat-footed contacts",
          "Overstriding",
          "Rising too early",
          "Arm swing crossing the body",
          "Chopping steps near markers"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "contacts",
        "defaultSets": 3,
        "defaultReps": 20,
        "defaultWorkSeconds": 15,
        "defaultRestSeconds": 60,
        "estSecondsPerSet": 75,
        "defaultRpeMin": 5,
        "defaultRpeMax": 7,
        "notes": "Keep contacts low, springy, and quiet; quality ends the set."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Single-Leg Pogo in Place. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "jump_power",
          "landing_prep",
          "sprint_prep"
        ]
      },
      "safety": {
        "riskLevel": 3,
        "impactLevel": 3,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern.",
          "Athlete can demonstrate a quiet lower-level landing or contact progression before this drill.",
          "Surface, footwear, spacing, and recovery allow high-quality contacts.",
          "Athlete is fresh enough that speed, distance, stiffness, and coordination can be expressed without fatigue leakage."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": false,
        "commonSubstitutions": [
          "Ankling Walk",
          "A-March",
          "Line Pogo",
          "Wall Drive March"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": true,
        "countsAsNeural": true,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 4,
          "fatigueSensitivity": 5,
          "technicalComplexity": 4,
          "intensityCeiling": "high",
          "impactLevel": 3
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    },
    {
      "id": 8,
      "slug": "ankling-walk",
      "name": "Ankling Walk",
      "family": "Sprint foot strike mechanics",
      "category": "01-10 - Foundation: landing, braking, foot/ankle stiffness, and takeoff access",
      "phaseKey": "movement_intelligence",
      "primaryPhaseKey": "movement_intelligence",
      "subrole": "locomotion_sprint_mechanics",
      "subroleSecondary": "foot_ankle_sprint_prep",
      "slot": "ankling_walk",
      "cardSummary": "Ankling Walk is a Movement Intelligence drill for jumping athletes who need more horizontal distance. Links foot strike timing, posture, and ankle stiffness in a low-fatigue way before approach work.",
      "bestPlacement": "Use before high-output jumping when the intent is learning, rhythm, or access without fatigue.",
      "description": "Ankling Walk addresses distance-jumping performance by targeting links foot strike timing, posture, and ankle stiffness in a low-fatigue way before approach work. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: locomotion_sprint_mechanics. Coach Ankling Walk for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Movement Intelligence intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "speed",
          "weight": 5
        },
        {
          "key": "coordination",
          "weight": 4
        },
        {
          "key": "explosiveness",
          "weight": 3
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 4
        },
        {
          "key": "sprint_mechanics",
          "weight": 5
        }
      ],
      "physiology": [
        {
          "key": "neural_output_readiness",
          "weight": 4
        },
        {
          "key": "perception_action_skill",
          "weight": 3
        },
        {
          "key": "ssc_stiffness",
          "weight": 3
        },
        {
          "key": "control_stability",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "locomote",
          "weight": 5
        },
        {
          "key": "brace",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "none",
          "weight": 5
        }
      ],
      "bodyRegions": [
        {
          "key": "foot",
          "weight": 5
        },
        {
          "key": "ankle",
          "weight": 3
        },
        {
          "key": "calf",
          "weight": 2
        },
        {
          "key": "hip",
          "weight": 2
        }
      ],
      "selectionReason": "Links foot strike timing, posture, and ankle stiffness in a low-fatigue way before approach work.",
      "whyItWorks": "Ankling Walk works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Movement Intelligence / locomotion_sprint_mechanics because the primary adaptation is rhythm, timing, body organization, spatial accuracy, and technical learning before fatigue corrupts the pattern.",
      "commonMisuse": "Do not chase speed before rhythm and position are clean. Ankling Walk should teach timing and organization, not exhaust the athlete or create random reps.",
      "movementRequirements": {
        "primaryJointActions": [
          "front_side_ankle_strike",
          "posture_control"
        ],
        "primaryTissues": [
          "foot_intrinsics",
          "calves",
          "hip_flexors"
        ],
        "coordinationDemand": "high",
        "balanceDemand": "moderate",
        "landingOrImpact": {
          "impactLevel": 1,
          "landingQualityRequired": true,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Ankling Walk as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Mark the start, finish, and any checkmarks for Ankling Walk; use none as needed.",
          "Clear the lane and ensure the athlete has safe deceleration space.",
          "Rehearse posture slowly before increasing speed."
        ],
        "executionSteps": [
          "Begin with posture tall, eyes forward, and arms organized.",
          "Move through the pattern at the assigned speed while keeping rhythm and foot placement consistent.",
          "Finish past the marker without reaching or chopping steps.",
          "Walk back, reset the cue, and repeat only if rhythm stays clean."
        ],
        "coachCues": [
          "Tall hips",
          "Punch the ground",
          "Quiet contacts",
          "Rhythm before speed",
          "Step down under you"
        ],
        "commonFaults": [
          "Flat-footed contacts",
          "Overstriding",
          "Rising too early",
          "Arm swing crossing the body",
          "Chopping steps near markers"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "distance",
        "defaultSets": 3,
        "defaultReps": 2,
        "defaultWorkSeconds": 10,
        "defaultRestSeconds": 60,
        "estSecondsPerSet": 80,
        "defaultRpeMin": 3,
        "defaultRpeMax": 5,
        "notes": "Run only as fast as the athlete can preserve rhythm, posture, and marker accuracy."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Ankling Walk. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "general_warmup",
          "landing_prep",
          "sprint_prep"
        ]
      },
      "safety": {
        "riskLevel": 1,
        "impactLevel": 1,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": false,
        "commonSubstitutions": [
          "Ankling Walk",
          "A-March",
          "Line Pogo",
          "Wall Drive March"
        ]
      },
      "regimen": {
        "canBeDaily": true,
        "weeklyMaxFrequency": 5,
        "minimumHoursBetweenHardExposures": 24,
        "countsAsHighIntensity": false,
        "countsAsHighImpact": false,
        "countsAsNeural": true,
        "countsAsTissueStress": false,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "movement_intelligence",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 2,
          "fatigueSensitivity": 4,
          "technicalComplexity": 4,
          "intensityCeiling": "technical",
          "impactLevel": 1
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    },
    {
      "id": 9,
      "slug": "tibialis-raise",
      "name": "Tibialis Raise",
      "family": "Lower-leg tissue capacity",
      "category": "01-10 - Foundation: landing, braking, foot/ankle stiffness, and takeoff access",
      "phaseKey": "resilience",
      "primaryPhaseKey": "resilience",
      "subrole": "lower_leg_tissue_capacity",
      "subroleSecondary": "landing_support",
      "slot": "tibialis_raise",
      "cardSummary": "Tibialis Raise is a Resilience drill for jumping athletes who need more horizontal distance. Builds anterior shin capacity for repeated run-up, braking, and landing contacts.",
      "bestPlacement": "Use after high-output jumping/sprinting or on a separate support day when the goal is control, strength, or tissue capacity rather than maximal distance attempts.",
      "description": "Tibialis Raise addresses distance-jumping performance by targeting builds anterior shin capacity for repeated run-up, braking, and landing contacts. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: lower_leg_tissue_capacity. Coach Tibialis Raise for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Resilience intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "strength",
          "weight": 5
        },
        {
          "key": "resilience",
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "strength_training",
          "weight": 5
        },
        {
          "key": "isometrics",
          "weight": 2
        }
      ],
      "physiology": [
        {
          "key": "force_capacity",
          "weight": 5
        },
        {
          "key": "tissue_capacity",
          "weight": 4
        },
        {
          "key": "control_stability",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "brace",
          "weight": 5
        }
      ],
      "equipment": [
        {
          "key": "wall",
          "weight": 5
        }
      ],
      "bodyRegions": [
        {
          "key": "shin",
          "weight": 5
        },
        {
          "key": "ankle",
          "weight": 3
        },
        {
          "key": "foot",
          "weight": 2
        }
      ],
      "selectionReason": "Builds anterior shin capacity for repeated run-up, braking, and landing contacts.",
      "whyItWorks": "Tibialis Raise works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Resilience / lower_leg_tissue_capacity because the intent is controlled landing, braking, eccentric/isometric ownership, and tissue tolerance rather than maximal distance or conditioning.",
      "commonMisuse": "Do not use Tibialis Raise as a max jump or fatigue drill. Keep the emphasis on quiet control, alignment, and tissue tolerance.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle_dorsiflexion"
        ],
        "primaryTissues": [
          "tibialis_anterior",
          "ankle_tendons"
        ],
        "coordinationDemand": "moderate",
        "balanceDemand": "moderate",
        "landingOrImpact": {
          "impactLevel": 0,
          "landingQualityRequired": false,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Tibialis Raise as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Set up the load and support equipment for Tibialis Raise before the athlete begins.",
          "Choose a load or lever that allows full control and no pain.",
          "Confirm the athlete understands the start, finish, and stop criteria."
        ],
        "executionSteps": [
          "Set the joint angle and foot pressure before loading.",
          "Move slowly through the range with even pressure and no bouncing.",
          "Pause where assigned and keep the reps symmetrical.",
          "Stop if symptoms, cramping, or compensation appear."
        ],
        "coachCues": [
          "Brace first",
          "Full foot pressure",
          "Own the range",
          "Drive without twisting",
          "Stop before form breaks"
        ],
        "commonFaults": [
          "Rushed reps",
          "Loss of brace",
          "Range is shortened to lift more load",
          "Asymmetrical pressure",
          "Pain is ignored"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "reps",
        "defaultSets": 3,
        "defaultReps": 10,
        "defaultWorkSeconds": 35,
        "defaultRestSeconds": 75,
        "estSecondsPerSet": 110,
        "defaultRpeMin": 5,
        "defaultRpeMax": 7,
        "notes": "Use controlled tempo and full range without bouncing through symptoms."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Tibialis Raise. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "control_landing",
          "deceleration",
          "resilience"
        ]
      },
      "safety": {
        "riskLevel": 1,
        "impactLevel": 0,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern.",
          "Load, range, or lever can be controlled without compensatory twisting, collapse, or symptom response."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": false,
        "commonSubstitutions": [
          "Split Squat",
          "Step-Up",
          "Calf Raise",
          "Hip Thrust"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 3,
        "minimumHoursBetweenHardExposures": 24,
        "countsAsHighIntensity": false,
        "countsAsHighImpact": false,
        "countsAsNeural": false,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "resilience",
          "role": "primary",
          "fitWeight": 4,
          "freshnessRequired": false,
          "fatigueCost": 2,
          "fatigueSensitivity": 3,
          "technicalComplexity": 3,
          "intensityCeiling": "moderate_control",
          "impactLevel": 0
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    },
    {
      "id": 10,
      "slug": "hip-airplane-stick",
      "name": "Hip Airplane Stick",
      "family": "Single-leg hip control",
      "category": "01-10 - Foundation: landing, braking, foot/ankle stiffness, and takeoff access",
      "phaseKey": "movement_intelligence",
      "primaryPhaseKey": "movement_intelligence",
      "subrole": "single_leg_balance_foot_ankle_hip_control",
      "subroleSecondary": "hip_pelvis_control",
      "slot": "hip_airplane_stick",
      "cardSummary": "Hip Airplane Stick is a Movement Intelligence drill for jumping athletes who need more horizontal distance. Builds hip-pelvis control that supports stable takeoff positions and clean landing alignment.",
      "bestPlacement": "Use before high-output jumping when the intent is learning, rhythm, or access without fatigue.",
      "description": "Hip Airplane Stick addresses distance-jumping performance by targeting builds hip-pelvis control that supports stable takeoff positions and clean landing alignment. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: single_leg_balance_foot_ankle_hip_control. Coach Hip Airplane Stick for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Movement Intelligence intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "body_control",
          "weight": 5
        },
        {
          "key": "balance",
          "weight": 4
        },
        {
          "key": "coordination",
          "weight": 4
        },
        {
          "key": "resilience",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "balance_stability",
          "weight": 4
        },
        {
          "key": "core_body_control",
          "weight": 4
        },
        {
          "key": "isometrics",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "control_stability",
          "weight": 5
        },
        {
          "key": "tissue_capacity",
          "weight": 3
        },
        {
          "key": "neural_output_readiness",
          "weight": 2
        }
      ],
      "patterns": [
        {
          "key": "hinge",
          "weight": 5
        },
        {
          "key": "balance",
          "weight": 3
        },
        {
          "key": "brace",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "none",
          "weight": 5
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "foot",
          "weight": 3
        },
        {
          "key": "ankle",
          "weight": 2
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "selectionReason": "Builds hip-pelvis control that supports stable takeoff positions and clean landing alignment.",
      "whyItWorks": "Hip Airplane Stick works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Movement Intelligence / single_leg_balance_foot_ankle_hip_control because the primary adaptation is rhythm, timing, body organization, spatial accuracy, and technical learning before fatigue corrupts the pattern.",
      "commonMisuse": "Do not chase speed before rhythm and position are clean. Hip Airplane Stick should teach timing and organization, not exhaust the athlete or create random reps.",
      "movementRequirements": {
        "primaryJointActions": [
          "hip_rotation_control",
          "single_leg_hinge"
        ],
        "primaryTissues": [
          "glutes",
          "hamstrings",
          "foot_intrinsics",
          "deep_hip_rotators"
        ],
        "coordinationDemand": "high",
        "balanceDemand": "high",
        "landingOrImpact": {
          "impactLevel": 1,
          "landingQualityRequired": true,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Hip Airplane Stick as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Set up a safe area for Hip Airplane Stick.",
          "Coach the lower-level version first.",
          "Stop if control changes."
        ],
        "executionSteps": [
          "Set up cleanly.",
          "Perform the rep under control.",
          "Reset before quality changes."
        ],
        "coachCues": [
          "Quiet feet",
          "Knee over middle toes",
          "Hips level",
          "Own the stick",
          "Breathe before you move"
        ],
        "commonFaults": [
          "Knee dives inward",
          "Heel or toe lifts excessively",
          "Trunk folds or twists",
          "Athlete steps out before owning the stick",
          "Landing noise increases"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "reps",
        "defaultSets": 3,
        "defaultReps": 5,
        "defaultWorkSeconds": 20,
        "defaultRestSeconds": 60,
        "estSecondsPerSet": 80,
        "defaultRpeMin": 4,
        "defaultRpeMax": 6,
        "notes": "Quality-first default dose."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Hip Airplane Stick. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "general_warmup",
          "landing_prep",
          "sprint_prep"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 1,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": false,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Supported Single-Leg Balance",
          "Step-Off to Stick",
          "Hip Airplane with Support"
        ]
      },
      "regimen": {
        "canBeDaily": true,
        "weeklyMaxFrequency": 5,
        "minimumHoursBetweenHardExposures": 24,
        "countsAsHighIntensity": false,
        "countsAsHighImpact": false,
        "countsAsNeural": true,
        "countsAsTissueStress": false,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "movement_intelligence",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 2,
          "fatigueSensitivity": 4,
          "technicalComplexity": 4,
          "intensityCeiling": "technical",
          "impactLevel": 1
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    }
  ]
}
```


---

# Exercise Library Batch 11-20 — Jumping Athletes for Distance

## Source and authoring basis

- Primary source used: exercise_card_details_for_llm.md, the Vortex Card v2 authoring guide. It defines phase-first authoring, canonical phase keys, taxonomy tags using key + weight, publish gates, dosage/scaling/safety fields, regimen, phaseProfile, and the preferred camelCase Authoring JSON shape. Purpose.txt was requested and searched for, but no file literally titled Purpose.txt surfaced in the accessible File Library results for this run; therefore this deliverable is grounded in exercise_card_details_for_llm.md, existing Vortex card conventions, and stable coaching expertise.
- Card v2 authoring shape used in each card: identity fields, `primaryPhaseKey`, `subrole`, `subroleSecondary`, `slot`, taxonomy tags, `movementRequirements`, `coachingExecution`, `dosage`, `scaling`, `pairingLogic`, `safety`, `regimen`, and `phaseProfile`.
- Programming rule: distance-jump outputs are quality-first. Stop when rhythm, stiffness, projection, landing quality, or release speed degrades.

## Category focus

**Approach speed, rhythm, penultimate mechanics, and takeoff timing** — Sprint-mechanics and run-up drills that teach posture, acceleration, rhythm, checkmark consistency, penultimate timing, and takeoff posture before maximal jumping.

## Exercises in this batch

11. **Wall Drive March** — `prepare_and_access` / `activate` / `wall_drive_march`
12. **Wall Drive Switch** — `prepare_and_access` / `activate` / `wall_drive_switch`
13. **A-March to Projection** — `movement_intelligence` / `locomotion_sprint_mechanics` / `a_march_to_projection`
14. **A-Skip for Approach Rhythm** — `movement_intelligence` / `locomotion_sprint_mechanics` / `a_skip_for_approach_rhythm`
15. **Straight-Leg Bound March** — `movement_intelligence` / `locomotion_sprint_mechanics` / `straight_leg_bound_march`
16. **Mini-Hurdle Wicket Run-In** — `output` / `max_velocity_exposure` / `mini_hurdle_wicket_run_in`
17. **Falling Start to 10 Meters** — `output` / `acceleration_start_speed` / `falling_start_to_10_meters`
18. **Three-Point Acceleration Build-Up** — `output` / `acceleration_start_speed` / `three_point_acceleration_build_up`
19. **Long-Jump Checkmark Run-Up** — `movement_intelligence` / `locomotion_sprint_mechanics` / `long_jump_checkmark_run_up`
20. **Penultimate Step Rhythm Drill** — `movement_intelligence` / `locomotion_sprint_mechanics` / `penultimate_step_rhythm_drill`

## Cursor-ready JSON

```json
{
  "cluster": {
    "title": "Jumping Athletes for Distance Exercise Cards 11-20",
    "focus": "jumping_athletes_for_distance",
    "batch": "11-20",
    "category": "Approach speed, rhythm, penultimate mechanics, and takeoff timing",
    "categoryFocus": "Sprint-mechanics and run-up drills that teach posture, acceleration, rhythm, checkmark consistency, penultimate timing, and takeoff posture before maximal jumping.",
    "cardCount": 10,
    "sourceBasis": "Primary source used: exercise_card_details_for_llm.md, the Vortex Card v2 authoring guide. It defines phase-first authoring, canonical phase keys, taxonomy tags using key + weight, publish gates, dosage/scaling/safety fields, regimen, phaseProfile, and the preferred camelCase Authoring JSON shape. Purpose.txt was requested and searched for, but no file literally titled Purpose.txt surfaced in the accessible File Library results for this run; therefore this deliverable is grounded in exercise_card_details_for_llm.md, existing Vortex card conventions, and stable coaching expertise.",
    "authoringRule": "Use camelCase Card v2 objects with canonical phase keys, taxonomy key+weight tags, movementRequirements, coachingExecution, dosage, scaling cohorts, safety, regimen, and phaseProfile."
  },
  "cards": [
    {
      "id": 11,
      "slug": "wall-drive-march",
      "name": "Wall Drive March",
      "family": "Sprint posture activation",
      "category": "11-20 - Approach speed, rhythm, penultimate mechanics, and takeoff timing",
      "phaseKey": "prepare_and_access",
      "primaryPhaseKey": "prepare_and_access",
      "subrole": "activate",
      "subroleSecondary": "sprint_posture_activation",
      "slot": "wall_drive_march",
      "cardSummary": "Wall Drive March is a Prepare & Access drill for jumping athletes who need more horizontal distance. Teaches projection posture and front-side thigh action before approach speed work.",
      "bestPlacement": "Use before high-output jumping when the intent is learning, rhythm, or access without fatigue.",
      "description": "Wall Drive March addresses distance-jumping performance by targeting teaches projection posture and front-side thigh action before approach speed work. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: activate. Coach Wall Drive March for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Prepare & Access intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "speed",
          "weight": 5
        },
        {
          "key": "coordination",
          "weight": 4
        },
        {
          "key": "explosiveness",
          "weight": 3
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 4
        },
        {
          "key": "sprint_mechanics",
          "weight": 5
        }
      ],
      "physiology": [
        {
          "key": "neural_output_readiness",
          "weight": 4
        },
        {
          "key": "perception_action_skill",
          "weight": 3
        },
        {
          "key": "ssc_stiffness",
          "weight": 3
        },
        {
          "key": "control_stability",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "locomote",
          "weight": 5
        },
        {
          "key": "brace",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "wall",
          "weight": 5
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "ankle",
          "weight": 3
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "selectionReason": "Teaches projection posture and front-side thigh action before approach speed work.",
      "whyItWorks": "Wall Drive March works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Prepare & Access / activate because it creates readiness, position access, tissue activation, and low-fatigue organization before harder jumping or sprinting.",
      "commonMisuse": "Do not over-dose Wall Drive March until it becomes a workout. It should improve access and readiness without stealing power from later jumps.",
      "movementRequirements": {
        "primaryJointActions": [
          "hip_flexion",
          "ankle_stiffness",
          "trunk_posture"
        ],
        "primaryTissues": [
          "hip_flexors",
          "glutes",
          "calves",
          "core"
        ],
        "coordinationDemand": "low",
        "balanceDemand": "low_to_moderate",
        "landingOrImpact": {
          "impactLevel": 0,
          "landingQualityRequired": false,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Wall Drive March as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Mark the start, finish, and any checkmarks for Wall Drive March; use wall as needed.",
          "Clear the lane and ensure the athlete has safe deceleration space.",
          "Rehearse posture slowly before increasing speed."
        ],
        "executionSteps": [
          "Begin with posture tall, eyes forward, and arms organized.",
          "Move through the pattern at the assigned speed while keeping rhythm and foot placement consistent.",
          "Finish past the marker without reaching or chopping steps.",
          "Walk back, reset the cue, and repeat only if rhythm stays clean."
        ],
        "coachCues": [
          "Tall hips",
          "Punch the ground",
          "Quiet contacts",
          "Rhythm before speed",
          "Step down under you"
        ],
        "commonFaults": [
          "Flat-footed contacts",
          "Overstriding",
          "Rising too early",
          "Arm swing crossing the body",
          "Chopping steps near markers"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "distance",
        "defaultSets": 3,
        "defaultReps": 2,
        "defaultWorkSeconds": 10,
        "defaultRestSeconds": 90,
        "estSecondsPerSet": 80,
        "defaultRpeMin": 3,
        "defaultRpeMax": 5,
        "notes": "Run only as fast as the athlete can preserve rhythm, posture, and marker accuracy."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Wall Drive March. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "general_warmup",
          "landing_prep",
          "sprint_prep"
        ]
      },
      "safety": {
        "riskLevel": 1,
        "impactLevel": 0,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": false,
        "commonSubstitutions": [
          "Ankling Walk",
          "A-March",
          "Line Pogo",
          "Wall Drive March"
        ]
      },
      "regimen": {
        "canBeDaily": true,
        "weeklyMaxFrequency": 5,
        "minimumHoursBetweenHardExposures": 24,
        "countsAsHighIntensity": false,
        "countsAsHighImpact": false,
        "countsAsNeural": false,
        "countsAsTissueStress": false,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "prepare_and_access",
          "role": "primary",
          "fitWeight": 4,
          "freshnessRequired": false,
          "fatigueCost": 1,
          "fatigueSensitivity": 2,
          "technicalComplexity": 2,
          "intensityCeiling": "low",
          "impactLevel": 0
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    },
    {
      "id": 12,
      "slug": "wall-drive-switch",
      "name": "Wall Drive Switch",
      "family": "Sprint posture activation",
      "category": "11-20 - Approach speed, rhythm, penultimate mechanics, and takeoff timing",
      "phaseKey": "prepare_and_access",
      "primaryPhaseKey": "prepare_and_access",
      "subrole": "activate",
      "subroleSecondary": "sprint_posture_activation",
      "slot": "wall_drive_switch",
      "cardSummary": "Wall Drive Switch is a Prepare & Access drill for jumping athletes who need more horizontal distance. Adds a crisp switch to wall posture so athletes rehearse takeoff-side stiffness without fatigue.",
      "bestPlacement": "Use before high-output jumping when the intent is learning, rhythm, or access without fatigue.",
      "description": "Wall Drive Switch addresses distance-jumping performance by targeting adds a crisp switch to wall posture so athletes rehearse takeoff-side stiffness without fatigue. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: activate. Coach Wall Drive Switch for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Prepare & Access intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "speed",
          "weight": 5
        },
        {
          "key": "coordination",
          "weight": 4
        },
        {
          "key": "explosiveness",
          "weight": 3
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 4
        },
        {
          "key": "sprint_mechanics",
          "weight": 5
        }
      ],
      "physiology": [
        {
          "key": "neural_output_readiness",
          "weight": 4
        },
        {
          "key": "perception_action_skill",
          "weight": 3
        },
        {
          "key": "ssc_stiffness",
          "weight": 3
        },
        {
          "key": "control_stability",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "locomote",
          "weight": 5
        },
        {
          "key": "brace",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "wall",
          "weight": 5
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "ankle",
          "weight": 3
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "selectionReason": "Adds a crisp switch to wall posture so athletes rehearse takeoff-side stiffness without fatigue.",
      "whyItWorks": "Wall Drive Switch works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Prepare & Access / activate because it creates readiness, position access, tissue activation, and low-fatigue organization before harder jumping or sprinting.",
      "commonMisuse": "Do not over-dose Wall Drive Switch until it becomes a workout. It should improve access and readiness without stealing power from later jumps.",
      "movementRequirements": {
        "primaryJointActions": [
          "hip_switch_timing",
          "ankle_stiffness",
          "trunk_posture"
        ],
        "primaryTissues": [
          "hip_flexors",
          "glutes",
          "calves",
          "core"
        ],
        "coordinationDemand": "low",
        "balanceDemand": "low_to_moderate",
        "landingOrImpact": {
          "impactLevel": 1,
          "landingQualityRequired": true,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Wall Drive Switch as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Mark the start, finish, and any checkmarks for Wall Drive Switch; use wall as needed.",
          "Clear the lane and ensure the athlete has safe deceleration space.",
          "Rehearse posture slowly before increasing speed."
        ],
        "executionSteps": [
          "Begin with posture tall, eyes forward, and arms organized.",
          "Move through the pattern at the assigned speed while keeping rhythm and foot placement consistent.",
          "Finish past the marker without reaching or chopping steps.",
          "Walk back, reset the cue, and repeat only if rhythm stays clean."
        ],
        "coachCues": [
          "Tall hips",
          "Punch the ground",
          "Quiet contacts",
          "Rhythm before speed",
          "Step down under you"
        ],
        "commonFaults": [
          "Flat-footed contacts",
          "Overstriding",
          "Rising too early",
          "Arm swing crossing the body",
          "Chopping steps near markers"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "distance",
        "defaultSets": 3,
        "defaultReps": 2,
        "defaultWorkSeconds": 10,
        "defaultRestSeconds": 90,
        "estSecondsPerSet": 80,
        "defaultRpeMin": 3,
        "defaultRpeMax": 5,
        "notes": "Run only as fast as the athlete can preserve rhythm, posture, and marker accuracy."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Wall Drive Switch. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "general_warmup",
          "landing_prep",
          "sprint_prep"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 1,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": false,
        "commonSubstitutions": [
          "Ankling Walk",
          "A-March",
          "Line Pogo",
          "Wall Drive March"
        ]
      },
      "regimen": {
        "canBeDaily": true,
        "weeklyMaxFrequency": 5,
        "minimumHoursBetweenHardExposures": 24,
        "countsAsHighIntensity": false,
        "countsAsHighImpact": false,
        "countsAsNeural": false,
        "countsAsTissueStress": false,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "prepare_and_access",
          "role": "primary",
          "fitWeight": 4,
          "freshnessRequired": false,
          "fatigueCost": 1,
          "fatigueSensitivity": 2,
          "technicalComplexity": 2,
          "intensityCeiling": "low",
          "impactLevel": 1
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    },
    {
      "id": 13,
      "slug": "a-march-to-projection",
      "name": "A-March to Projection",
      "family": "Sprint mechanics progression",
      "category": "11-20 - Approach speed, rhythm, penultimate mechanics, and takeoff timing",
      "phaseKey": "movement_intelligence",
      "primaryPhaseKey": "movement_intelligence",
      "subrole": "locomotion_sprint_mechanics",
      "subroleSecondary": "approach_posture",
      "slot": "a_march_to_projection",
      "cardSummary": "A-March to Projection is a Movement Intelligence drill for jumping athletes who need more horizontal distance. Connects march rhythm to the projected body position used in long-jump approach acceleration.",
      "bestPlacement": "Use before high-output jumping when the intent is learning, rhythm, or access without fatigue.",
      "description": "A-March to Projection addresses distance-jumping performance by targeting connects march rhythm to the projected body position used in long-jump approach acceleration. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: locomotion_sprint_mechanics. Coach A-March to Projection for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Movement Intelligence intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "speed",
          "weight": 5
        },
        {
          "key": "coordination",
          "weight": 4
        },
        {
          "key": "explosiveness",
          "weight": 3
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 4
        },
        {
          "key": "sprint_mechanics",
          "weight": 5
        }
      ],
      "physiology": [
        {
          "key": "neural_output_readiness",
          "weight": 4
        },
        {
          "key": "perception_action_skill",
          "weight": 3
        },
        {
          "key": "ssc_stiffness",
          "weight": 3
        },
        {
          "key": "control_stability",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "locomote",
          "weight": 5
        },
        {
          "key": "brace",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "none",
          "weight": 5
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "ankle",
          "weight": 3
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "selectionReason": "Connects march rhythm to the projected body position used in long-jump approach acceleration.",
      "whyItWorks": "A-March to Projection works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Movement Intelligence / locomotion_sprint_mechanics because the primary adaptation is rhythm, timing, body organization, spatial accuracy, and technical learning before fatigue corrupts the pattern.",
      "commonMisuse": "Do not chase speed before rhythm and position are clean. A-March to Projection should teach timing and organization, not exhaust the athlete or create random reps.",
      "movementRequirements": {
        "primaryJointActions": [
          "front_side_thigh_lift",
          "foot_strike_under_center"
        ],
        "primaryTissues": [
          "hip_flexors",
          "calves",
          "glutes"
        ],
        "coordinationDemand": "high",
        "balanceDemand": "moderate",
        "landingOrImpact": {
          "impactLevel": 1,
          "landingQualityRequired": true,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform A-March to Projection as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Mark the start, finish, and any checkmarks for A-March to Projection; use none as needed.",
          "Clear the lane and ensure the athlete has safe deceleration space.",
          "Rehearse posture slowly before increasing speed."
        ],
        "executionSteps": [
          "Begin with posture tall, eyes forward, and arms organized.",
          "Move through the pattern at the assigned speed while keeping rhythm and foot placement consistent.",
          "Finish past the marker without reaching or chopping steps.",
          "Walk back, reset the cue, and repeat only if rhythm stays clean."
        ],
        "coachCues": [
          "Tall hips",
          "Punch the ground",
          "Quiet contacts",
          "Rhythm before speed",
          "Step down under you"
        ],
        "commonFaults": [
          "Flat-footed contacts",
          "Overstriding",
          "Rising too early",
          "Arm swing crossing the body",
          "Chopping steps near markers"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "distance",
        "defaultSets": 3,
        "defaultReps": 2,
        "defaultWorkSeconds": 10,
        "defaultRestSeconds": 60,
        "estSecondsPerSet": 80,
        "defaultRpeMin": 3,
        "defaultRpeMax": 5,
        "notes": "Run only as fast as the athlete can preserve rhythm, posture, and marker accuracy."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of A-March to Projection. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "general_warmup",
          "landing_prep",
          "sprint_prep"
        ]
      },
      "safety": {
        "riskLevel": 1,
        "impactLevel": 1,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": false,
        "commonSubstitutions": [
          "Ankling Walk",
          "A-March",
          "Line Pogo",
          "Wall Drive March"
        ]
      },
      "regimen": {
        "canBeDaily": true,
        "weeklyMaxFrequency": 5,
        "minimumHoursBetweenHardExposures": 24,
        "countsAsHighIntensity": false,
        "countsAsHighImpact": false,
        "countsAsNeural": true,
        "countsAsTissueStress": false,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "movement_intelligence",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 2,
          "fatigueSensitivity": 4,
          "technicalComplexity": 4,
          "intensityCeiling": "technical",
          "impactLevel": 1
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    },
    {
      "id": 14,
      "slug": "a-skip-for-approach-rhythm",
      "name": "A-Skip for Approach Rhythm",
      "family": "Sprint rhythm progression",
      "category": "11-20 - Approach speed, rhythm, penultimate mechanics, and takeoff timing",
      "phaseKey": "movement_intelligence",
      "primaryPhaseKey": "movement_intelligence",
      "subrole": "locomotion_sprint_mechanics",
      "subroleSecondary": "approach_rhythm",
      "slot": "a_skip_for_approach_rhythm",
      "cardSummary": "A-Skip for Approach Rhythm is a Movement Intelligence drill for jumping athletes who need more horizontal distance. Builds upright rhythm, posture, and light stiffness that transfers to consistent approach cadence.",
      "bestPlacement": "Use before high-output jumping when the intent is learning, rhythm, or access without fatigue.",
      "description": "A-Skip for Approach Rhythm addresses distance-jumping performance by targeting builds upright rhythm, posture, and light stiffness that transfers to consistent approach cadence. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: locomotion_sprint_mechanics. Coach A-Skip for Approach Rhythm for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Movement Intelligence intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "speed",
          "weight": 5
        },
        {
          "key": "coordination",
          "weight": 4
        },
        {
          "key": "explosiveness",
          "weight": 3
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 4
        },
        {
          "key": "sprint_mechanics",
          "weight": 5
        }
      ],
      "physiology": [
        {
          "key": "neural_output_readiness",
          "weight": 4
        },
        {
          "key": "perception_action_skill",
          "weight": 3
        },
        {
          "key": "ssc_stiffness",
          "weight": 3
        },
        {
          "key": "control_stability",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "locomote",
          "weight": 5
        },
        {
          "key": "jump",
          "weight": 3
        },
        {
          "key": "brace",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "none",
          "weight": 5
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "ankle",
          "weight": 3
        },
        {
          "key": "foot",
          "weight": 2
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "selectionReason": "Builds upright rhythm, posture, and light stiffness that transfers to consistent approach cadence.",
      "whyItWorks": "A-Skip for Approach Rhythm works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Movement Intelligence / locomotion_sprint_mechanics because the primary adaptation is rhythm, timing, body organization, spatial accuracy, and technical learning before fatigue corrupts the pattern.",
      "commonMisuse": "Do not chase speed before rhythm and position are clean. A-Skip for Approach Rhythm should teach timing and organization, not exhaust the athlete or create random reps.",
      "movementRequirements": {
        "primaryJointActions": [
          "front_side_cycle",
          "elastic_foot_strike"
        ],
        "primaryTissues": [
          "hip_flexors",
          "calves",
          "glutes",
          "foot_intrinsics"
        ],
        "coordinationDemand": "high",
        "balanceDemand": "moderate",
        "landingOrImpact": {
          "impactLevel": 2,
          "landingQualityRequired": true,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform A-Skip for Approach Rhythm as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Mark the start, finish, and any checkmarks for A-Skip for Approach Rhythm; use none as needed.",
          "Clear the lane and ensure the athlete has safe deceleration space.",
          "Rehearse posture slowly before increasing speed."
        ],
        "executionSteps": [
          "Begin with posture tall, eyes forward, and arms organized.",
          "Move through the pattern at the assigned speed while keeping rhythm and foot placement consistent.",
          "Finish past the marker without reaching or chopping steps.",
          "Walk back, reset the cue, and repeat only if rhythm stays clean."
        ],
        "coachCues": [
          "Tall hips",
          "Punch the ground",
          "Quiet contacts",
          "Rhythm before speed",
          "Step down under you"
        ],
        "commonFaults": [
          "Flat-footed contacts",
          "Overstriding",
          "Rising too early",
          "Arm swing crossing the body",
          "Chopping steps near markers"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "distance",
        "defaultSets": 3,
        "defaultReps": 2,
        "defaultWorkSeconds": 10,
        "defaultRestSeconds": 60,
        "estSecondsPerSet": 80,
        "defaultRpeMin": 3,
        "defaultRpeMax": 5,
        "notes": "Run only as fast as the athlete can preserve rhythm, posture, and marker accuracy."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of A-Skip for Approach Rhythm. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "general_warmup",
          "landing_prep",
          "sprint_prep"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 2,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": false,
        "commonSubstitutions": [
          "Ankling Walk",
          "A-March",
          "Line Pogo",
          "Wall Drive March"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 5,
        "minimumHoursBetweenHardExposures": 24,
        "countsAsHighIntensity": false,
        "countsAsHighImpact": false,
        "countsAsNeural": true,
        "countsAsTissueStress": false,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "movement_intelligence",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 2,
          "fatigueSensitivity": 4,
          "technicalComplexity": 4,
          "intensityCeiling": "technical",
          "impactLevel": 2
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    },
    {
      "id": 15,
      "slug": "straight-leg-bound-march",
      "name": "Straight-Leg Bound March",
      "family": "Stiff-leg sprint rhythm",
      "category": "11-20 - Approach speed, rhythm, penultimate mechanics, and takeoff timing",
      "phaseKey": "movement_intelligence",
      "primaryPhaseKey": "movement_intelligence",
      "subrole": "locomotion_sprint_mechanics",
      "subroleSecondary": "stiffness_rhythm",
      "slot": "straight_leg_bound_march",
      "cardSummary": "Straight-Leg Bound March is a Movement Intelligence drill for jumping athletes who need more horizontal distance. Introduces front-side stiffness and pawback timing without the intensity of full straight-leg bounds.",
      "bestPlacement": "Use before high-output jumping when the intent is learning, rhythm, or access without fatigue.",
      "description": "Straight-Leg Bound March addresses distance-jumping performance by targeting introduces front-side stiffness and pawback timing without the intensity of full straight-leg bounds. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: locomotion_sprint_mechanics. Coach Straight-Leg Bound March for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Movement Intelligence intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "speed",
          "weight": 5
        },
        {
          "key": "coordination",
          "weight": 4
        },
        {
          "key": "explosiveness",
          "weight": 3
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 4
        },
        {
          "key": "sprint_mechanics",
          "weight": 5
        }
      ],
      "physiology": [
        {
          "key": "neural_output_readiness",
          "weight": 4
        },
        {
          "key": "perception_action_skill",
          "weight": 3
        },
        {
          "key": "ssc_stiffness",
          "weight": 3
        },
        {
          "key": "control_stability",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "locomote",
          "weight": 5
        },
        {
          "key": "jump",
          "weight": 3
        },
        {
          "key": "brace",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "none",
          "weight": 5
        }
      ],
      "bodyRegions": [
        {
          "key": "hamstring",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 3
        },
        {
          "key": "ankle",
          "weight": 2
        },
        {
          "key": "foot",
          "weight": 2
        }
      ],
      "selectionReason": "Introduces front-side stiffness and pawback timing without the intensity of full straight-leg bounds.",
      "whyItWorks": "Straight-Leg Bound March works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Movement Intelligence / locomotion_sprint_mechanics because the primary adaptation is rhythm, timing, body organization, spatial accuracy, and technical learning before fatigue corrupts the pattern.",
      "commonMisuse": "Do not chase speed before rhythm and position are clean. Straight-Leg Bound March should teach timing and organization, not exhaust the athlete or create random reps.",
      "movementRequirements": {
        "primaryJointActions": [
          "hip_flexion_extension",
          "ankle_stiffness",
          "pawback_timing"
        ],
        "primaryTissues": [
          "hamstrings",
          "calves",
          "glutes"
        ],
        "coordinationDemand": "high",
        "balanceDemand": "moderate",
        "landingOrImpact": {
          "impactLevel": 2,
          "landingQualityRequired": true,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Straight-Leg Bound March as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Mark the start, finish, and any checkmarks for Straight-Leg Bound March; use none as needed.",
          "Clear the lane and ensure the athlete has safe deceleration space.",
          "Rehearse posture slowly before increasing speed."
        ],
        "executionSteps": [
          "Begin with posture tall, eyes forward, and arms organized.",
          "Move through the pattern at the assigned speed while keeping rhythm and foot placement consistent.",
          "Finish past the marker without reaching or chopping steps.",
          "Walk back, reset the cue, and repeat only if rhythm stays clean."
        ],
        "coachCues": [
          "Tall hips",
          "Punch the ground",
          "Quiet contacts",
          "Rhythm before speed",
          "Step down under you"
        ],
        "commonFaults": [
          "Flat-footed contacts",
          "Overstriding",
          "Rising too early",
          "Arm swing crossing the body",
          "Chopping steps near markers"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "distance",
        "defaultSets": 3,
        "defaultReps": 2,
        "defaultWorkSeconds": 10,
        "defaultRestSeconds": 60,
        "estSecondsPerSet": 80,
        "defaultRpeMin": 3,
        "defaultRpeMax": 5,
        "notes": "Run only as fast as the athlete can preserve rhythm, posture, and marker accuracy."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Straight-Leg Bound March. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "general_warmup",
          "landing_prep",
          "sprint_prep"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 2,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": false,
        "commonSubstitutions": [
          "Ankling Walk",
          "A-March",
          "Line Pogo",
          "Wall Drive March"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 5,
        "minimumHoursBetweenHardExposures": 24,
        "countsAsHighIntensity": false,
        "countsAsHighImpact": false,
        "countsAsNeural": true,
        "countsAsTissueStress": false,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "movement_intelligence",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 2,
          "fatigueSensitivity": 4,
          "technicalComplexity": 4,
          "intensityCeiling": "technical",
          "impactLevel": 2
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    },
    {
      "id": 16,
      "slug": "mini-hurdle-wicket-run-in",
      "name": "Mini-Hurdle Wicket Run-In",
      "family": "Approach rhythm and wicket timing",
      "category": "11-20 - Approach speed, rhythm, penultimate mechanics, and takeoff timing",
      "phaseKey": "output",
      "primaryPhaseKey": "output",
      "subrole": "max_velocity_exposure",
      "subroleSecondary": "approach_rhythm",
      "slot": "mini_hurdle_wicket_run_in",
      "cardSummary": "Mini-Hurdle Wicket Run-In is a Output drill for jumping athletes who need more horizontal distance. Uses spacing constraints to organize run-up rhythm, posture, and foot placement without cue overload.",
      "bestPlacement": "Use early in the session after Prepare & Access and any required Movement Intelligence work, before heavy strength or conditioning. Keep volume low and rest long enough for every attempt to stay sharp.",
      "description": "Mini-Hurdle Wicket Run-In addresses distance-jumping performance by targeting uses spacing constraints to organize run-up rhythm, posture, and foot placement without cue overload. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: max_velocity_exposure. Coach Mini-Hurdle Wicket Run-In for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Output intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "speed",
          "weight": 5
        },
        {
          "key": "coordination",
          "weight": 4
        },
        {
          "key": "explosiveness",
          "weight": 3
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 4
        },
        {
          "key": "sprint_mechanics",
          "weight": 5
        }
      ],
      "physiology": [
        {
          "key": "neural_output_readiness",
          "weight": 4
        },
        {
          "key": "perception_action_skill",
          "weight": 3
        },
        {
          "key": "ssc_stiffness",
          "weight": 3
        },
        {
          "key": "control_stability",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "locomote",
          "weight": 5
        },
        {
          "key": "brace",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "mini_hurdles",
          "weight": 5
        },
        {
          "key": "cones",
          "weight": 3
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "ankle",
          "weight": 3
        },
        {
          "key": "foot",
          "weight": 2
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "selectionReason": "Uses spacing constraints to organize run-up rhythm, posture, and foot placement without cue overload.",
      "whyItWorks": "Mini-Hurdle Wicket Run-In works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Output / max_velocity_exposure because the intended adaptation is high-quality force, speed, stiffness, projection, or elastic expression while fresh. Volume stays low and recovery stays long enough that every attempt remains sharp.",
      "commonMisuse": "Do not turn Mini-Hurdle Wicket Run-In into a conditioning station, contact-count challenge, or fatigue finisher. The set ends when speed, distance, stiffness, posture, landing quality, or intent drops.",
      "movementRequirements": {
        "primaryJointActions": [
          "cyclic_leg_action",
          "upright_sprint_posture",
          "foot_placement"
        ],
        "primaryTissues": [
          "hip_flexors",
          "glutes",
          "calves",
          "hamstrings"
        ],
        "coordinationDemand": "high",
        "balanceDemand": "low_to_moderate",
        "landingOrImpact": {
          "impactLevel": 2,
          "landingQualityRequired": true,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Mini-Hurdle Wicket Run-In as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Mark the start, finish, and any checkmarks for Mini-Hurdle Wicket Run-In; use mini hurdles, cones as needed.",
          "Clear the lane and ensure the athlete has safe deceleration space.",
          "Rehearse posture slowly before increasing speed."
        ],
        "executionSteps": [
          "Begin with posture tall, eyes forward, and arms organized.",
          "Move through the pattern at the assigned speed while keeping rhythm and foot placement consistent.",
          "Finish past the marker without reaching or chopping steps.",
          "Walk back, reset the cue, and repeat only if rhythm stays clean."
        ],
        "coachCues": [
          "Tall hips",
          "Punch the ground",
          "Quiet contacts",
          "Rhythm before speed",
          "Step down under you"
        ],
        "commonFaults": [
          "Flat-footed contacts",
          "Overstriding",
          "Rising too early",
          "Arm swing crossing the body",
          "Chopping steps near markers"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "distance",
        "defaultSets": 3,
        "defaultReps": 2,
        "defaultWorkSeconds": 10,
        "defaultRestSeconds": 90,
        "estSecondsPerSet": 80,
        "defaultRpeMin": 6,
        "defaultRpeMax": 8,
        "notes": "Run only as fast as the athlete can preserve rhythm, posture, and marker accuracy."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Mini-Hurdle Wicket Run-In. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "jump_power",
          "landing_prep",
          "sprint_prep"
        ]
      },
      "safety": {
        "riskLevel": 3,
        "impactLevel": 2,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern.",
          "Athlete is fresh enough that speed, distance, stiffness, and coordination can be expressed without fatigue leakage."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": false,
        "commonSubstitutions": [
          "Ankling Walk",
          "A-March",
          "Line Pogo",
          "Wall Drive March"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": false,
        "countsAsNeural": true,
        "countsAsTissueStress": false,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 4,
          "fatigueSensitivity": 5,
          "technicalComplexity": 4,
          "intensityCeiling": "high",
          "impactLevel": 2
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    },
    {
      "id": 17,
      "slug": "falling-start-to-10-meters",
      "name": "Falling Start to 10 Meters",
      "family": "Acceleration start",
      "category": "11-20 - Approach speed, rhythm, penultimate mechanics, and takeoff timing",
      "phaseKey": "output",
      "primaryPhaseKey": "output",
      "subrole": "acceleration_start_speed",
      "subroleSecondary": "approach_acceleration",
      "slot": "falling_start_to_10_meters",
      "cardSummary": "Falling Start to 10 Meters is a Output drill for jumping athletes who need more horizontal distance. Trains the projection angle and first-step intent that set up a powerful approach run.",
      "bestPlacement": "Use early in the session after Prepare & Access and any required Movement Intelligence work, before heavy strength or conditioning. Keep volume low and rest long enough for every attempt to stay sharp.",
      "description": "Falling Start to 10 Meters addresses distance-jumping performance by targeting trains the projection angle and first-step intent that set up a powerful approach run. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: acceleration_start_speed. Coach Falling Start to 10 Meters for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Output intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "speed",
          "weight": 5
        },
        {
          "key": "coordination",
          "weight": 4
        },
        {
          "key": "explosiveness",
          "weight": 3
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 4
        },
        {
          "key": "sprint_mechanics",
          "weight": 5
        }
      ],
      "physiology": [
        {
          "key": "neural_output_readiness",
          "weight": 4
        },
        {
          "key": "perception_action_skill",
          "weight": 3
        },
        {
          "key": "ssc_stiffness",
          "weight": 3
        },
        {
          "key": "control_stability",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "locomote",
          "weight": 5
        },
        {
          "key": "brace",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "cones",
          "weight": 5
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "ankle",
          "weight": 3
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "selectionReason": "Trains the projection angle and first-step intent that set up a powerful approach run.",
      "whyItWorks": "Falling Start to 10 Meters works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Output / acceleration_start_speed because the intended adaptation is high-quality force, speed, stiffness, projection, or elastic expression while fresh. Volume stays low and recovery stays long enough that every attempt remains sharp.",
      "commonMisuse": "Do not turn Falling Start to 10 Meters into a conditioning station, contact-count challenge, or fatigue finisher. The set ends when speed, distance, stiffness, posture, landing quality, or intent drops.",
      "movementRequirements": {
        "primaryJointActions": [
          "projection_angle",
          "first_step_stiffness",
          "acceleration_posture"
        ],
        "primaryTissues": [
          "glutes",
          "hamstrings",
          "calves",
          "hip_flexors"
        ],
        "coordinationDemand": "high",
        "balanceDemand": "low_to_moderate",
        "landingOrImpact": {
          "impactLevel": 2,
          "landingQualityRequired": true,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Falling Start to 10 Meters as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Mark the start, finish, and any checkmarks for Falling Start to 10 Meters; use cones as needed.",
          "Clear the lane and ensure the athlete has safe deceleration space.",
          "Rehearse posture slowly before increasing speed."
        ],
        "executionSteps": [
          "Set the start posture and create whole-body tension without stiffness.",
          "Push the ground back and project the hips forward on the first step.",
          "Keep the first few steps powerful, low, and clean rather than popping upright.",
          "Decelerate safely beyond the finish and recover fully before the next start."
        ],
        "coachCues": [
          "Tall hips",
          "Punch the ground",
          "Quiet contacts",
          "Rhythm before speed",
          "Step down under you"
        ],
        "commonFaults": [
          "Flat-footed contacts",
          "Overstriding",
          "Rising too early",
          "Arm swing crossing the body",
          "Chopping steps near markers"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "attempts",
        "defaultSets": 4,
        "defaultReps": 2,
        "defaultWorkSeconds": 5,
        "defaultRestSeconds": 90,
        "estSecondsPerSet": 105,
        "defaultRpeMin": 7,
        "defaultRpeMax": 9,
        "notes": "Full recovery between attempts; stop when first-step projection or speed drops."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Falling Start to 10 Meters. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "jump_power",
          "landing_prep",
          "sprint_prep"
        ]
      },
      "safety": {
        "riskLevel": 3,
        "impactLevel": 2,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern.",
          "Athlete is fresh enough that speed, distance, stiffness, and coordination can be expressed without fatigue leakage."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": false,
        "commonSubstitutions": [
          "Lower-level progression"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": false,
        "countsAsNeural": true,
        "countsAsTissueStress": false,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 4,
          "fatigueSensitivity": 5,
          "technicalComplexity": 4,
          "intensityCeiling": "high",
          "impactLevel": 2
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    },
    {
      "id": 18,
      "slug": "three-point-acceleration-build-up",
      "name": "Three-Point Acceleration Build-Up",
      "family": "Acceleration build-up",
      "category": "11-20 - Approach speed, rhythm, penultimate mechanics, and takeoff timing",
      "phaseKey": "output",
      "primaryPhaseKey": "output",
      "subrole": "acceleration_start_speed",
      "subroleSecondary": "approach_acceleration",
      "slot": "three_point_acceleration_build_up",
      "cardSummary": "Three-Point Acceleration Build-Up is a Output drill for jumping athletes who need more horizontal distance. Builds acceleration intent and gradual rise mechanics that feed into the distance-jump run-up.",
      "bestPlacement": "Use early in the session after Prepare & Access and any required Movement Intelligence work, before heavy strength or conditioning. Keep volume low and rest long enough for every attempt to stay sharp.",
      "description": "Three-Point Acceleration Build-Up addresses distance-jumping performance by targeting builds acceleration intent and gradual rise mechanics that feed into the distance-jump run-up. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: acceleration_start_speed. Coach Three-Point Acceleration Build-Up for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Output intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "speed",
          "weight": 5
        },
        {
          "key": "coordination",
          "weight": 4
        },
        {
          "key": "explosiveness",
          "weight": 3
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 4
        },
        {
          "key": "sprint_mechanics",
          "weight": 5
        }
      ],
      "physiology": [
        {
          "key": "neural_output_readiness",
          "weight": 4
        },
        {
          "key": "perception_action_skill",
          "weight": 3
        },
        {
          "key": "ssc_stiffness",
          "weight": 3
        },
        {
          "key": "control_stability",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "locomote",
          "weight": 5
        },
        {
          "key": "brace",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "cones",
          "weight": 5
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "ankle",
          "weight": 3
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "selectionReason": "Builds acceleration intent and gradual rise mechanics that feed into the distance-jump run-up.",
      "whyItWorks": "Three-Point Acceleration Build-Up works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Output / acceleration_start_speed because the intended adaptation is high-quality force, speed, stiffness, projection, or elastic expression while fresh. Volume stays low and recovery stays long enough that every attempt remains sharp.",
      "commonMisuse": "Do not turn Three-Point Acceleration Build-Up into a conditioning station, contact-count challenge, or fatigue finisher. The set ends when speed, distance, stiffness, posture, landing quality, or intent drops.",
      "movementRequirements": {
        "primaryJointActions": [
          "acceleration_projection",
          "shin_angle",
          "gradual_rise"
        ],
        "primaryTissues": [
          "glutes",
          "hamstrings",
          "calves"
        ],
        "coordinationDemand": "high",
        "balanceDemand": "low_to_moderate",
        "landingOrImpact": {
          "impactLevel": 3,
          "landingQualityRequired": true,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Three-Point Acceleration Build-Up as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Mark the start, finish, and any checkmarks for Three-Point Acceleration Build-Up; use cones as needed.",
          "Clear the lane and ensure the athlete has safe deceleration space.",
          "Rehearse posture slowly before increasing speed."
        ],
        "executionSteps": [
          "Set the start posture and create whole-body tension without stiffness.",
          "Push the ground back and project the hips forward on the first step.",
          "Keep the first few steps powerful, low, and clean rather than popping upright.",
          "Decelerate safely beyond the finish and recover fully before the next start."
        ],
        "coachCues": [
          "Tall hips",
          "Punch the ground",
          "Quiet contacts",
          "Rhythm before speed",
          "Step down under you"
        ],
        "commonFaults": [
          "Flat-footed contacts",
          "Overstriding",
          "Rising too early",
          "Arm swing crossing the body",
          "Chopping steps near markers"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "attempts",
        "defaultSets": 4,
        "defaultReps": 2,
        "defaultWorkSeconds": 5,
        "defaultRestSeconds": 90,
        "estSecondsPerSet": 105,
        "defaultRpeMin": 7,
        "defaultRpeMax": 9,
        "notes": "Full recovery between attempts; stop when first-step projection or speed drops."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Three-Point Acceleration Build-Up. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "jump_power",
          "landing_prep",
          "sprint_prep"
        ]
      },
      "safety": {
        "riskLevel": 4,
        "impactLevel": 3,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern.",
          "Athlete can demonstrate a quiet lower-level landing or contact progression before this drill.",
          "Surface, footwear, spacing, and recovery allow high-quality contacts.",
          "Athlete is fresh enough that speed, distance, stiffness, and coordination can be expressed without fatigue leakage."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Lower-level progression"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": true,
        "countsAsNeural": true,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 4,
          "fatigueSensitivity": 5,
          "technicalComplexity": 4,
          "intensityCeiling": "high",
          "impactLevel": 3
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    },
    {
      "id": 19,
      "slug": "long-jump-checkmark-run-up",
      "name": "Long-Jump Checkmark Run-Up",
      "family": "Approach accuracy and rhythm",
      "category": "11-20 - Approach speed, rhythm, penultimate mechanics, and takeoff timing",
      "phaseKey": "movement_intelligence",
      "primaryPhaseKey": "movement_intelligence",
      "subrole": "locomotion_sprint_mechanics",
      "subroleSecondary": "approach_consistency",
      "slot": "long_jump_checkmark_run_up",
      "cardSummary": "Long-Jump Checkmark Run-Up is a Movement Intelligence drill for jumping athletes who need more horizontal distance. Builds run-up consistency so athletes arrive at takeoff with usable speed instead of guessing steps.",
      "bestPlacement": "Use before high-output jumping when the intent is learning, rhythm, or access without fatigue.",
      "description": "Long-Jump Checkmark Run-Up addresses distance-jumping performance by targeting builds run-up consistency so athletes arrive at takeoff with usable speed instead of guessing steps. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: locomotion_sprint_mechanics. Coach Long-Jump Checkmark Run-Up for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Movement Intelligence intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "speed",
          "weight": 5
        },
        {
          "key": "coordination",
          "weight": 4
        },
        {
          "key": "explosiveness",
          "weight": 3
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 4
        },
        {
          "key": "sprint_mechanics",
          "weight": 5
        }
      ],
      "physiology": [
        {
          "key": "neural_output_readiness",
          "weight": 4
        },
        {
          "key": "perception_action_skill",
          "weight": 3
        },
        {
          "key": "ssc_stiffness",
          "weight": 3
        },
        {
          "key": "control_stability",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "locomote",
          "weight": 5
        },
        {
          "key": "brace",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "cones",
          "weight": 5
        },
        {
          "key": "tape",
          "weight": 3
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "ankle",
          "weight": 3
        },
        {
          "key": "foot",
          "weight": 2
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "selectionReason": "Builds run-up consistency so athletes arrive at takeoff with usable speed instead of guessing steps.",
      "whyItWorks": "Long-Jump Checkmark Run-Up works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Movement Intelligence / locomotion_sprint_mechanics because the primary adaptation is rhythm, timing, body organization, spatial accuracy, and technical learning before fatigue corrupts the pattern.",
      "commonMisuse": "Do not chase speed before rhythm and position are clean. Long-Jump Checkmark Run-Up should teach timing and organization, not exhaust the athlete or create random reps.",
      "movementRequirements": {
        "primaryJointActions": [
          "stride_consistency",
          "approach_rhythm",
          "takeoff_marker_accuracy"
        ],
        "primaryTissues": [
          "calves",
          "hamstrings",
          "glutes",
          "hip_flexors"
        ],
        "coordinationDemand": "high",
        "balanceDemand": "moderate",
        "landingOrImpact": {
          "impactLevel": 1,
          "landingQualityRequired": true,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Long-Jump Checkmark Run-Up as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Mark the start, finish, and any checkmarks for Long-Jump Checkmark Run-Up; use cones, tape as needed.",
          "Clear the lane and ensure the athlete has safe deceleration space.",
          "Rehearse posture slowly before increasing speed."
        ],
        "executionSteps": [
          "Begin with posture tall, eyes forward, and arms organized.",
          "Move through the pattern at the assigned speed while keeping rhythm and foot placement consistent.",
          "Finish past the marker without reaching or chopping steps.",
          "Walk back, reset the cue, and repeat only if rhythm stays clean."
        ],
        "coachCues": [
          "Tall hips",
          "Punch the ground",
          "Quiet contacts",
          "Rhythm before speed",
          "Step down under you"
        ],
        "commonFaults": [
          "Flat-footed contacts",
          "Overstriding",
          "Rising too early",
          "Arm swing crossing the body",
          "Chopping steps near markers"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "distance",
        "defaultSets": 3,
        "defaultReps": 2,
        "defaultWorkSeconds": 10,
        "defaultRestSeconds": 60,
        "estSecondsPerSet": 80,
        "defaultRpeMin": 3,
        "defaultRpeMax": 5,
        "notes": "Run only as fast as the athlete can preserve rhythm, posture, and marker accuracy."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Long-Jump Checkmark Run-Up. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "general_warmup",
          "landing_prep",
          "sprint_prep"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 1,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": false,
        "commonSubstitutions": [
          "Ankling Walk",
          "A-March",
          "Line Pogo",
          "Wall Drive March"
        ]
      },
      "regimen": {
        "canBeDaily": true,
        "weeklyMaxFrequency": 5,
        "minimumHoursBetweenHardExposures": 24,
        "countsAsHighIntensity": false,
        "countsAsHighImpact": false,
        "countsAsNeural": true,
        "countsAsTissueStress": false,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "movement_intelligence",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 2,
          "fatigueSensitivity": 4,
          "technicalComplexity": 4,
          "intensityCeiling": "technical",
          "impactLevel": 1
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    },
    {
      "id": 20,
      "slug": "penultimate-step-rhythm-drill",
      "name": "Penultimate Step Rhythm Drill",
      "family": "Penultimate and takeoff timing",
      "category": "11-20 - Approach speed, rhythm, penultimate mechanics, and takeoff timing",
      "phaseKey": "movement_intelligence",
      "primaryPhaseKey": "movement_intelligence",
      "subrole": "locomotion_sprint_mechanics",
      "subroleSecondary": "takeoff_rhythm",
      "slot": "penultimate_step_rhythm_drill",
      "cardSummary": "Penultimate Step Rhythm Drill is a Movement Intelligence drill for jumping athletes who need more horizontal distance. Teaches the subtle lower-and-rise rhythm that helps convert approach speed into distance.",
      "bestPlacement": "Use before high-output jumping when the intent is learning, rhythm, or access without fatigue.",
      "description": "Penultimate Step Rhythm Drill addresses distance-jumping performance by targeting teaches the subtle lower-and-rise rhythm that helps convert approach speed into distance. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: locomotion_sprint_mechanics. Coach Penultimate Step Rhythm Drill for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Movement Intelligence intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "speed",
          "weight": 5
        },
        {
          "key": "coordination",
          "weight": 4
        },
        {
          "key": "explosiveness",
          "weight": 3
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 4
        },
        {
          "key": "sprint_mechanics",
          "weight": 5
        }
      ],
      "physiology": [
        {
          "key": "neural_output_readiness",
          "weight": 4
        },
        {
          "key": "perception_action_skill",
          "weight": 3
        },
        {
          "key": "ssc_stiffness",
          "weight": 3
        },
        {
          "key": "control_stability",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "locomote",
          "weight": 5
        },
        {
          "key": "jump",
          "weight": 3
        },
        {
          "key": "brace",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "cones",
          "weight": 5
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "ankle",
          "weight": 3
        },
        {
          "key": "knee",
          "weight": 2
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "selectionReason": "Teaches the subtle lower-and-rise rhythm that helps convert approach speed into distance.",
      "whyItWorks": "Penultimate Step Rhythm Drill works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Movement Intelligence / locomotion_sprint_mechanics because the primary adaptation is rhythm, timing, body organization, spatial accuracy, and technical learning before fatigue corrupts the pattern.",
      "commonMisuse": "Do not chase speed before rhythm and position are clean. Penultimate Step Rhythm Drill should teach timing and organization, not exhaust the athlete or create random reps.",
      "movementRequirements": {
        "primaryJointActions": [
          "penultimate_lowering",
          "takeoff_timing",
          "rhythm_control"
        ],
        "primaryTissues": [
          "glutes",
          "calves",
          "quadriceps",
          "hamstrings"
        ],
        "coordinationDemand": "high",
        "balanceDemand": "moderate",
        "landingOrImpact": {
          "impactLevel": 2,
          "landingQualityRequired": true,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Penultimate Step Rhythm Drill as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Mark the start, finish, and any checkmarks for Penultimate Step Rhythm Drill; use cones as needed.",
          "Clear the lane and ensure the athlete has safe deceleration space.",
          "Rehearse posture slowly before increasing speed."
        ],
        "executionSteps": [
          "Begin with posture tall, eyes forward, and arms organized.",
          "Move through the pattern at the assigned speed while keeping rhythm and foot placement consistent.",
          "Finish past the marker without reaching or chopping steps.",
          "Walk back, reset the cue, and repeat only if rhythm stays clean."
        ],
        "coachCues": [
          "Tall hips",
          "Punch the ground",
          "Quiet contacts",
          "Rhythm before speed",
          "Step down under you"
        ],
        "commonFaults": [
          "Flat-footed contacts",
          "Overstriding",
          "Rising too early",
          "Arm swing crossing the body",
          "Chopping steps near markers"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "distance",
        "defaultSets": 3,
        "defaultReps": 2,
        "defaultWorkSeconds": 10,
        "defaultRestSeconds": 60,
        "estSecondsPerSet": 80,
        "defaultRpeMin": 3,
        "defaultRpeMax": 5,
        "notes": "Run only as fast as the athlete can preserve rhythm, posture, and marker accuracy."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Penultimate Step Rhythm Drill. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "general_warmup",
          "landing_prep",
          "sprint_prep"
        ]
      },
      "safety": {
        "riskLevel": 3,
        "impactLevel": 2,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": false,
        "commonSubstitutions": [
          "Ankling Walk",
          "A-March",
          "Line Pogo",
          "Wall Drive March"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 5,
        "minimumHoursBetweenHardExposures": 24,
        "countsAsHighIntensity": false,
        "countsAsHighImpact": false,
        "countsAsNeural": true,
        "countsAsTissueStress": false,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "movement_intelligence",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 2,
          "fatigueSensitivity": 4,
          "technicalComplexity": 4,
          "intensityCeiling": "technical",
          "impactLevel": 2
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    }
  ]
}
```


---

# Exercise Library Batch 21-30 — Jumping Athletes for Distance

## Source and authoring basis

- Primary source used: exercise_card_details_for_llm.md, the Vortex Card v2 authoring guide. It defines phase-first authoring, canonical phase keys, taxonomy tags using key + weight, publish gates, dosage/scaling/safety fields, regimen, phaseProfile, and the preferred camelCase Authoring JSON shape. Purpose.txt was requested and searched for, but no file literally titled Purpose.txt surfaced in the accessible File Library results for this run; therefore this deliverable is grounded in exercise_card_details_for_llm.md, existing Vortex card conventions, and stable coaching expertise.
- Card v2 authoring shape used in each card: identity fields, `primaryPhaseKey`, `subrole`, `subroleSecondary`, `slot`, taxonomy tags, `movementRequirements`, `coachingExecution`, `dosage`, `scaling`, `pairingLogic`, `safety`, `regimen`, and `phaseProfile`.
- Programming rule: distance-jump outputs are quality-first. Stop when rhythm, stiffness, projection, landing quality, or release speed degrades.

## Category focus

**Horizontal projection and broad-jump power** — High-intent horizontal jumps, hops, and bounds that train projection angle, hip extension, arm swing, stiffness, and controlled distance-oriented landing.

## Exercises in this batch

21. **Squat Jump to Stick** — `output` / `jump_throw_explosive_power` / `squat_jump_to_stick`
22. **Countermovement Jump to Stick** — `output` / `jump_throw_explosive_power` / `countermovement_jump_to_stick`
23. **Broad Jump to Stick** — `output` / `jump_throw_explosive_power` / `broad_jump_to_stick`
24. **Repeated Broad Jump Elastic** — `output` / `elastic_stiffness_plyometric_rudiments` / `repeated_broad_jump_elastic`
25. **Broad Jump to Vertical Pop** — `output` / `jump_throw_explosive_power` / `broad_jump_to_vertical_pop`
26. **Single-Leg Hop to Stick** — `output` / `jump_throw_explosive_power` / `single_leg_hop_to_stick`
27. **Single-Leg Hop for Distance** — `output` / `jump_throw_explosive_power` / `single_leg_hop_for_distance`
28. **Alternate-Leg Bound for Distance** — `output` / `elastic_stiffness_plyometric_rudiments` / `alternate_leg_bound_for_distance`
29. **Three-Bound Distance Series** — `output` / `elastic_stiffness_plyometric_rudiments` / `three_bound_distance_series`
30. **Bounding to Pit Landing** — `output` / `jump_throw_explosive_power` / `bounding_to_pit_landing`

## Cursor-ready JSON

```json
{
  "cluster": {
    "title": "Jumping Athletes for Distance Exercise Cards 21-30",
    "focus": "jumping_athletes_for_distance",
    "batch": "21-30",
    "category": "Horizontal projection and broad-jump power",
    "categoryFocus": "High-intent horizontal jumps, hops, and bounds that train projection angle, hip extension, arm swing, stiffness, and controlled distance-oriented landing.",
    "cardCount": 10,
    "sourceBasis": "Primary source used: exercise_card_details_for_llm.md, the Vortex Card v2 authoring guide. It defines phase-first authoring, canonical phase keys, taxonomy tags using key + weight, publish gates, dosage/scaling/safety fields, regimen, phaseProfile, and the preferred camelCase Authoring JSON shape. Purpose.txt was requested and searched for, but no file literally titled Purpose.txt surfaced in the accessible File Library results for this run; therefore this deliverable is grounded in exercise_card_details_for_llm.md, existing Vortex card conventions, and stable coaching expertise.",
    "authoringRule": "Use camelCase Card v2 objects with canonical phase keys, taxonomy key+weight tags, movementRequirements, coachingExecution, dosage, scaling cohorts, safety, regimen, and phaseProfile."
  },
  "cards": [
    {
      "id": 21,
      "slug": "squat-jump-to-stick",
      "name": "Squat Jump to Stick",
      "family": "Vertical projection power",
      "category": "21-30 - Horizontal projection and broad-jump power",
      "phaseKey": "output",
      "primaryPhaseKey": "output",
      "subrole": "jump_throw_explosive_power",
      "subroleSecondary": "landing_control",
      "slot": "squat_jump_to_stick",
      "cardSummary": "Squat Jump to Stick is a Output drill for jumping athletes who need more horizontal distance. Builds clean concentric triple-extension and landing discipline before horizontal projection progresses.",
      "bestPlacement": "Use early in the session after Prepare & Access and any required Movement Intelligence work, before heavy strength or conditioning. Keep volume low and rest long enough for every attempt to stay sharp.",
      "description": "Squat Jump to Stick addresses distance-jumping performance by targeting builds clean concentric triple-extension and landing discipline before horizontal projection progresses. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Coach Squat Jump to Stick for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Output intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "explosiveness",
          "weight": 5
        },
        {
          "key": "power",
          "weight": 5
        },
        {
          "key": "coordination",
          "weight": 3
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 5
        },
        {
          "key": "strength_power",
          "weight": 4
        },
        {
          "key": "plyometrics",
          "weight": 4
        }
      ],
      "physiology": [
        {
          "key": "rate_of_force_development",
          "weight": 5
        },
        {
          "key": "neural_output_readiness",
          "weight": 5
        },
        {
          "key": "ssc_stiffness",
          "weight": 3
        },
        {
          "key": "control_stability",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "jump",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 3
        },
        {
          "key": "brace",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "none",
          "weight": 5
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 3
        },
        {
          "key": "ankle",
          "weight": 2
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "selectionReason": "Builds clean concentric triple-extension and landing discipline before horizontal projection progresses.",
      "whyItWorks": "Squat Jump to Stick works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Output / jump_throw_explosive_power because the intended adaptation is high-quality force, speed, stiffness, projection, or elastic expression while fresh. Volume stays low and recovery stays long enough that every attempt remains sharp.",
      "commonMisuse": "Do not turn Squat Jump to Stick into a conditioning station, contact-count challenge, or fatigue finisher. The set ends when speed, distance, stiffness, posture, landing quality, or intent drops.",
      "movementRequirements": {
        "primaryJointActions": [
          "hip_extension",
          "knee_extension",
          "ankle_plantarflexion",
          "landing_absorption"
        ],
        "primaryTissues": [
          "glutes",
          "quadriceps",
          "calves",
          "hamstrings"
        ],
        "coordinationDemand": "high",
        "balanceDemand": "low_to_moderate",
        "landingOrImpact": {
          "impactLevel": 3,
          "landingQualityRequired": true,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Squat Jump to Stick as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Set a clear lane and landing target for Squat Jump to Stick; use none as needed.",
          "Give the athlete enough space to land, stick, and step out safely.",
          "Start with the lower-amplitude version and confirm quiet landings before adding distance or speed."
        ],
        "executionSteps": [
          "Start in the assigned stance with feet rooted and eyes forward.",
          "Load quickly but under control, then project with full-body intent.",
          "Use arms to support projection without over-rotating the trunk.",
          "Land quietly, stick the position, measure or score only clean attempts, and reset fully."
        ],
        "coachCues": [
          "Fast down, fast up",
          "Reach tall through the floor",
          "Land like a spring, not a crash",
          "Freeze the finish"
        ],
        "commonFaults": [
          "Quality drops",
          "Athlete rushes",
          "Control is lost"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "attempts",
        "defaultSets": 3,
        "defaultReps": 3,
        "defaultWorkSeconds": 15,
        "defaultRestSeconds": 90,
        "estSecondsPerSet": 110,
        "defaultRpeMin": 7,
        "defaultRpeMax": 9,
        "notes": "Use low total attempts with full reset and measurable quality."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Squat Jump to Stick. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "jump_power",
          "landing_prep",
          "sprint_prep"
        ]
      },
      "safety": {
        "riskLevel": 3,
        "impactLevel": 3,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern.",
          "Athlete can demonstrate a quiet lower-level landing or contact progression before this drill.",
          "Surface, footwear, spacing, and recovery allow high-quality contacts.",
          "Athlete is fresh enough that speed, distance, stiffness, and coordination can be expressed without fatigue leakage."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": false,
        "commonSubstitutions": [
          "Lower-level progression"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": true,
        "countsAsNeural": true,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 4,
          "fatigueSensitivity": 5,
          "technicalComplexity": 4,
          "intensityCeiling": "high",
          "impactLevel": 3
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    },
    {
      "id": 22,
      "slug": "countermovement-jump-to-stick",
      "name": "Countermovement Jump to Stick",
      "family": "Vertical projection power",
      "category": "21-30 - Horizontal projection and broad-jump power",
      "phaseKey": "output",
      "primaryPhaseKey": "output",
      "subrole": "jump_throw_explosive_power",
      "subroleSecondary": "landing_control",
      "slot": "countermovement_jump_to_stick",
      "cardSummary": "Countermovement Jump to Stick is a Output drill for jumping athletes who need more horizontal distance. Uses a natural countermovement to rehearse force expression, arm swing timing, and quiet landing control.",
      "bestPlacement": "Use early in the session after Prepare & Access and any required Movement Intelligence work, before heavy strength or conditioning. Keep volume low and rest long enough for every attempt to stay sharp.",
      "description": "Countermovement Jump to Stick addresses distance-jumping performance by targeting uses a natural countermovement to rehearse force expression, arm swing timing, and quiet landing control. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Coach Countermovement Jump to Stick for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Output intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "explosiveness",
          "weight": 5
        },
        {
          "key": "power",
          "weight": 5
        },
        {
          "key": "coordination",
          "weight": 3
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 5
        },
        {
          "key": "strength_power",
          "weight": 4
        },
        {
          "key": "plyometrics",
          "weight": 4
        }
      ],
      "physiology": [
        {
          "key": "rate_of_force_development",
          "weight": 5
        },
        {
          "key": "neural_output_readiness",
          "weight": 5
        },
        {
          "key": "ssc_stiffness",
          "weight": 3
        },
        {
          "key": "control_stability",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "jump",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 3
        },
        {
          "key": "brace",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "none",
          "weight": 5
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 3
        },
        {
          "key": "ankle",
          "weight": 2
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "selectionReason": "Uses a natural countermovement to rehearse force expression, arm swing timing, and quiet landing control.",
      "whyItWorks": "Countermovement Jump to Stick works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Output / jump_throw_explosive_power because the intended adaptation is high-quality force, speed, stiffness, projection, or elastic expression while fresh. Volume stays low and recovery stays long enough that every attempt remains sharp.",
      "commonMisuse": "Do not turn Countermovement Jump to Stick into a conditioning station, contact-count challenge, or fatigue finisher. The set ends when speed, distance, stiffness, posture, landing quality, or intent drops.",
      "movementRequirements": {
        "primaryJointActions": [
          "countermovement_timing",
          "triple_extension",
          "landing_absorption"
        ],
        "primaryTissues": [
          "glutes",
          "quadriceps",
          "calves",
          "hamstrings"
        ],
        "coordinationDemand": "high",
        "balanceDemand": "low_to_moderate",
        "landingOrImpact": {
          "impactLevel": 3,
          "landingQualityRequired": true,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Countermovement Jump to Stick as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Set a clear lane and landing target for Countermovement Jump to Stick; use none as needed.",
          "Give the athlete enough space to land, stick, and step out safely.",
          "Start with the lower-amplitude version and confirm quiet landings before adding distance or speed."
        ],
        "executionSteps": [
          "Start in the assigned stance with feet rooted and eyes forward.",
          "Load quickly but under control, then project with full-body intent.",
          "Use arms to support projection without over-rotating the trunk.",
          "Land quietly, stick the position, measure or score only clean attempts, and reset fully."
        ],
        "coachCues": [
          "Fast down, fast up",
          "Reach tall through the floor",
          "Land like a spring, not a crash",
          "Freeze the finish"
        ],
        "commonFaults": [
          "Quality drops",
          "Athlete rushes",
          "Control is lost"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "attempts",
        "defaultSets": 3,
        "defaultReps": 3,
        "defaultWorkSeconds": 15,
        "defaultRestSeconds": 90,
        "estSecondsPerSet": 110,
        "defaultRpeMin": 7,
        "defaultRpeMax": 9,
        "notes": "Use low total attempts with full reset and measurable quality."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Countermovement Jump to Stick. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "jump_power",
          "landing_prep",
          "sprint_prep"
        ]
      },
      "safety": {
        "riskLevel": 3,
        "impactLevel": 3,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern.",
          "Athlete can demonstrate a quiet lower-level landing or contact progression before this drill.",
          "Surface, footwear, spacing, and recovery allow high-quality contacts.",
          "Athlete is fresh enough that speed, distance, stiffness, and coordination can be expressed without fatigue leakage."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": false,
        "commonSubstitutions": [
          "Lower-level progression"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": true,
        "countsAsNeural": true,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 4,
          "fatigueSensitivity": 5,
          "technicalComplexity": 4,
          "intensityCeiling": "high",
          "impactLevel": 3
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    },
    {
      "id": 23,
      "slug": "broad-jump-to-stick",
      "name": "Broad Jump to Stick",
      "family": "Horizontal projection power",
      "category": "21-30 - Horizontal projection and broad-jump power",
      "phaseKey": "output",
      "primaryPhaseKey": "output",
      "subrole": "jump_throw_explosive_power",
      "subroleSecondary": "landing_control",
      "slot": "broad_jump_to_stick",
      "cardSummary": "Broad Jump to Stick is a Output drill for jumping athletes who need more horizontal distance. Directly trains horizontal projection and distance landing quality with a simple measurable task.",
      "bestPlacement": "Use early in the session after Prepare & Access and any required Movement Intelligence work, before heavy strength or conditioning. Keep volume low and rest long enough for every attempt to stay sharp.",
      "description": "Broad Jump to Stick addresses distance-jumping performance by targeting directly trains horizontal projection and distance landing quality with a simple measurable task. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Coach Broad Jump to Stick for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Output intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "explosiveness",
          "weight": 5
        },
        {
          "key": "power",
          "weight": 5
        },
        {
          "key": "coordination",
          "weight": 3
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 5
        },
        {
          "key": "strength_power",
          "weight": 4
        },
        {
          "key": "plyometrics",
          "weight": 4
        }
      ],
      "physiology": [
        {
          "key": "rate_of_force_development",
          "weight": 5
        },
        {
          "key": "neural_output_readiness",
          "weight": 5
        },
        {
          "key": "ssc_stiffness",
          "weight": 3
        },
        {
          "key": "control_stability",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "jump",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 3
        },
        {
          "key": "brace",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "cones",
          "weight": 5
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 3
        },
        {
          "key": "ankle",
          "weight": 2
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "selectionReason": "Directly trains horizontal projection and distance landing quality with a simple measurable task.",
      "whyItWorks": "Broad Jump to Stick works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Output / jump_throw_explosive_power because the intended adaptation is high-quality force, speed, stiffness, projection, or elastic expression while fresh. Volume stays low and recovery stays long enough that every attempt remains sharp.",
      "commonMisuse": "Do not turn Broad Jump to Stick into a conditioning station, contact-count challenge, or fatigue finisher. The set ends when speed, distance, stiffness, posture, landing quality, or intent drops.",
      "movementRequirements": {
        "primaryJointActions": [
          "horizontal_projection",
          "arm_swing",
          "landing_absorption"
        ],
        "primaryTissues": [
          "glutes",
          "hamstrings",
          "quadriceps",
          "calves"
        ],
        "coordinationDemand": "high",
        "balanceDemand": "low_to_moderate",
        "landingOrImpact": {
          "impactLevel": 4,
          "landingQualityRequired": true,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Broad Jump to Stick as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Set a clear lane and landing target for Broad Jump to Stick; use cones as needed.",
          "Give the athlete enough space to land, stick, and step out safely.",
          "Start with the lower-amplitude version and confirm quiet landings before adding distance or speed."
        ],
        "executionSteps": [
          "Start in the assigned stance with feet rooted and eyes forward.",
          "Load quickly but under control, then project with full-body intent.",
          "Use arms to support projection without over-rotating the trunk.",
          "Land quietly, stick the position, measure or score only clean attempts, and reset fully."
        ],
        "coachCues": [
          "Push the ground away",
          "Project out, not up only",
          "Land quiet",
          "Hold posture through the hips",
          "Reset before the next attempt"
        ],
        "commonFaults": [
          "Reaching the landing leg far ahead instead of projecting the hips",
          "Collapsing knee or arch on contact",
          "Loud landings",
          "Turning the drill into a race",
          "Losing rhythm after the first contact"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "attempts",
        "defaultSets": 3,
        "defaultReps": 3,
        "defaultWorkSeconds": 15,
        "defaultRestSeconds": 90,
        "estSecondsPerSet": 110,
        "defaultRpeMin": 7,
        "defaultRpeMax": 9,
        "notes": "Use low total attempts with full reset and measurable quality."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Broad Jump to Stick. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "horizontal_power",
          "jump_power",
          "landing_prep",
          "long_jump_prep",
          "sprint_prep"
        ]
      },
      "safety": {
        "riskLevel": 4,
        "impactLevel": 4,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern.",
          "Athlete can demonstrate a quiet lower-level landing or contact progression before this drill.",
          "Surface, footwear, spacing, and recovery allow high-quality contacts.",
          "Athlete is fresh enough that speed, distance, stiffness, and coordination can be expressed without fatigue leakage."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Broad Jump to Stick",
          "Low-amplitude pogo",
          "Medicine Ball Scoop Toss",
          "Step-Up to Knee Drive"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": true,
        "countsAsNeural": true,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 4,
          "fatigueSensitivity": 5,
          "technicalComplexity": 4,
          "intensityCeiling": "high",
          "impactLevel": 4
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    },
    {
      "id": 24,
      "slug": "repeated-broad-jump-elastic",
      "name": "Repeated Broad Jump Elastic",
      "family": "Horizontal elastic contacts",
      "category": "21-30 - Horizontal projection and broad-jump power",
      "phaseKey": "output",
      "primaryPhaseKey": "output",
      "subrole": "elastic_stiffness_plyometric_rudiments",
      "subroleSecondary": "horizontal_power",
      "slot": "repeated_broad_jump_elastic",
      "cardSummary": "Repeated Broad Jump Elastic is a Output drill for jumping athletes who need more horizontal distance. Trains repeated projection and elastic reset for athletes who already own single broad-jump landings.",
      "bestPlacement": "Use early in the session after Prepare & Access and any required Movement Intelligence work, before heavy strength or conditioning. Keep volume low and rest long enough for every attempt to stay sharp.",
      "description": "Repeated Broad Jump Elastic addresses distance-jumping performance by targeting trains repeated projection and elastic reset for athletes who already own single broad-jump landings. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: elastic_stiffness_plyometric_rudiments. Coach Repeated Broad Jump Elastic for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Output intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "explosiveness",
          "weight": 5
        },
        {
          "key": "speed",
          "weight": 4
        },
        {
          "key": "coordination",
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "elastic_energy",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
        },
        {
          "key": "neural_output_readiness",
          "weight": 4
        }
      ],
      "patterns": [
        {
          "key": "jump",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 3
        },
        {
          "key": "locomote",
          "weight": 2
        },
        {
          "key": "brace",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "cones",
          "weight": 5
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 3
        },
        {
          "key": "ankle",
          "weight": 2
        },
        {
          "key": "foot",
          "weight": 2
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "selectionReason": "Trains repeated projection and elastic reset for athletes who already own single broad-jump landings.",
      "whyItWorks": "Repeated Broad Jump Elastic works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Output / elastic_stiffness_plyometric_rudiments because the intended adaptation is high-quality force, speed, stiffness, projection, or elastic expression while fresh. Volume stays low and recovery stays long enough that every attempt remains sharp.",
      "commonMisuse": "Do not turn Repeated Broad Jump Elastic into a conditioning station, contact-count challenge, or fatigue finisher. The set ends when speed, distance, stiffness, posture, landing quality, or intent drops.",
      "movementRequirements": {
        "primaryJointActions": [
          "repeated_horizontal_projection",
          "short_ground_contact",
          "landing_reorientation"
        ],
        "primaryTissues": [
          "glutes",
          "hamstrings",
          "calves",
          "quadriceps",
          "achilles_tendon"
        ],
        "coordinationDemand": "high",
        "balanceDemand": "low_to_moderate",
        "landingOrImpact": {
          "impactLevel": 4,
          "landingQualityRequired": true,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Repeated Broad Jump Elastic as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Mark a straight lane or contact zone for Repeated Broad Jump Elastic; keep the surface flat, dry, and forgiving.",
          "Review the athlete's lower-level pogo, hop, or landing progression first.",
          "Use small contact volumes and full recovery so elastic quality is obvious."
        ],
        "executionSteps": [
          "Start with posture tall and the first contact planned.",
          "Project through the ground while keeping contacts stiff, quick, and directional.",
          "Use the arms to match rhythm and avoid overstriding or reaching.",
          "Finish with a controlled landing or run-out and stop if rhythm breaks."
        ],
        "coachCues": [
          "Push the ground away",
          "Project out, not up only",
          "Land quiet",
          "Hold posture through the hips",
          "Reset before the next attempt"
        ],
        "commonFaults": [
          "Reaching the landing leg far ahead instead of projecting the hips",
          "Collapsing knee or arch on contact",
          "Loud landings",
          "Turning the drill into a race",
          "Losing rhythm after the first contact"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "contacts",
        "defaultSets": 3,
        "defaultReps": 8,
        "defaultWorkSeconds": 12,
        "defaultRestSeconds": 120,
        "estSecondsPerSet": 135,
        "defaultRpeMin": 7,
        "defaultRpeMax": 9,
        "notes": "Keep volume capped; elastic quality and posture must match the first contact."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Repeated Broad Jump Elastic. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "horizontal_power",
          "jump_power",
          "landing_prep",
          "long_jump_prep",
          "sprint_prep"
        ]
      },
      "safety": {
        "riskLevel": 4,
        "impactLevel": 4,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern.",
          "Athlete can demonstrate a quiet lower-level landing or contact progression before this drill.",
          "Surface, footwear, spacing, and recovery allow high-quality contacts.",
          "Athlete is fresh enough that speed, distance, stiffness, and coordination can be expressed without fatigue leakage."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Broad Jump to Stick",
          "Low-amplitude pogo",
          "Medicine Ball Scoop Toss",
          "Step-Up to Knee Drive"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": true,
        "countsAsNeural": true,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 4,
          "fatigueSensitivity": 5,
          "technicalComplexity": 4,
          "intensityCeiling": "high",
          "impactLevel": 4
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    },
    {
      "id": 25,
      "slug": "broad-jump-to-vertical-pop",
      "name": "Broad Jump to Vertical Pop",
      "family": "Horizontal-to-vertical projection",
      "category": "21-30 - Horizontal projection and broad-jump power",
      "phaseKey": "output",
      "primaryPhaseKey": "output",
      "subrole": "jump_throw_explosive_power",
      "subroleSecondary": "elastic_reorientation",
      "slot": "broad_jump_to_vertical_pop",
      "cardSummary": "Broad Jump to Vertical Pop is a Output drill for jumping athletes who need more horizontal distance. Forces the athlete to own a horizontal landing and immediately reorganize posture into a small vertical pop.",
      "bestPlacement": "Use early in the session after Prepare & Access and any required Movement Intelligence work, before heavy strength or conditioning. Keep volume low and rest long enough for every attempt to stay sharp.",
      "description": "Broad Jump to Vertical Pop addresses distance-jumping performance by targeting forces the athlete to own a horizontal landing and immediately reorganize posture into a small vertical pop. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Coach Broad Jump to Vertical Pop for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Output intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "explosiveness",
          "weight": 5
        },
        {
          "key": "power",
          "weight": 5
        },
        {
          "key": "coordination",
          "weight": 3
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 5
        },
        {
          "key": "strength_power",
          "weight": 4
        },
        {
          "key": "plyometrics",
          "weight": 4
        }
      ],
      "physiology": [
        {
          "key": "rate_of_force_development",
          "weight": 5
        },
        {
          "key": "neural_output_readiness",
          "weight": 5
        },
        {
          "key": "ssc_stiffness",
          "weight": 3
        },
        {
          "key": "control_stability",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "jump",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 3
        },
        {
          "key": "brace",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "cones",
          "weight": 5
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 3
        },
        {
          "key": "ankle",
          "weight": 2
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "selectionReason": "Forces the athlete to own a horizontal landing and immediately reorganize posture into a small vertical pop.",
      "whyItWorks": "Broad Jump to Vertical Pop works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Output / jump_throw_explosive_power because the intended adaptation is high-quality force, speed, stiffness, projection, or elastic expression while fresh. Volume stays low and recovery stays long enough that every attempt remains sharp.",
      "commonMisuse": "Do not turn Broad Jump to Vertical Pop into a conditioning station, contact-count challenge, or fatigue finisher. The set ends when speed, distance, stiffness, posture, landing quality, or intent drops.",
      "movementRequirements": {
        "primaryJointActions": [
          "horizontal_projection",
          "landing_rebound",
          "vertical_reorientation"
        ],
        "primaryTissues": [
          "glutes",
          "hamstrings",
          "calves",
          "quadriceps"
        ],
        "coordinationDemand": "high",
        "balanceDemand": "low_to_moderate",
        "landingOrImpact": {
          "impactLevel": 4,
          "landingQualityRequired": true,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Broad Jump to Vertical Pop as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Set a clear lane and landing target for Broad Jump to Vertical Pop; use cones as needed.",
          "Give the athlete enough space to land, stick, and step out safely.",
          "Start with the lower-amplitude version and confirm quiet landings before adding distance or speed."
        ],
        "executionSteps": [
          "Start in the assigned stance with feet rooted and eyes forward.",
          "Load quickly but under control, then project with full-body intent.",
          "Use arms to support projection without over-rotating the trunk.",
          "Land quietly, stick the position, measure or score only clean attempts, and reset fully."
        ],
        "coachCues": [
          "Push the ground away",
          "Project out, not up only",
          "Land quiet",
          "Hold posture through the hips",
          "Reset before the next attempt"
        ],
        "commonFaults": [
          "Reaching the landing leg far ahead instead of projecting the hips",
          "Collapsing knee or arch on contact",
          "Loud landings",
          "Turning the drill into a race",
          "Losing rhythm after the first contact"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "attempts",
        "defaultSets": 3,
        "defaultReps": 3,
        "defaultWorkSeconds": 15,
        "defaultRestSeconds": 90,
        "estSecondsPerSet": 110,
        "defaultRpeMin": 7,
        "defaultRpeMax": 9,
        "notes": "Use low total attempts with full reset and measurable quality."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Broad Jump to Vertical Pop. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "horizontal_power",
          "jump_power",
          "landing_prep",
          "long_jump_prep",
          "sprint_prep"
        ]
      },
      "safety": {
        "riskLevel": 4,
        "impactLevel": 4,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern.",
          "Athlete can demonstrate a quiet lower-level landing or contact progression before this drill.",
          "Surface, footwear, spacing, and recovery allow high-quality contacts.",
          "Athlete is fresh enough that speed, distance, stiffness, and coordination can be expressed without fatigue leakage."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Broad Jump to Stick",
          "Low-amplitude pogo",
          "Medicine Ball Scoop Toss",
          "Step-Up to Knee Drive"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": true,
        "countsAsNeural": true,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 4,
          "fatigueSensitivity": 5,
          "technicalComplexity": 4,
          "intensityCeiling": "high",
          "impactLevel": 4
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    },
    {
      "id": 26,
      "slug": "single-leg-hop-to-stick",
      "name": "Single-Leg Hop to Stick",
      "family": "Single-leg horizontal hop",
      "category": "21-30 - Horizontal projection and broad-jump power",
      "phaseKey": "output",
      "primaryPhaseKey": "output",
      "subrole": "jump_throw_explosive_power",
      "subroleSecondary": "single_leg_landing_control",
      "slot": "single_leg_hop_to_stick",
      "cardSummary": "Single-Leg Hop to Stick is a Output drill for jumping athletes who need more horizontal distance. Builds unilateral projection and landing control before full single-leg distance hops or takeoff-specific work.",
      "bestPlacement": "Use early in the session after Prepare & Access and any required Movement Intelligence work, before heavy strength or conditioning. Keep volume low and rest long enough for every attempt to stay sharp.",
      "description": "Single-Leg Hop to Stick addresses distance-jumping performance by targeting builds unilateral projection and landing control before full single-leg distance hops or takeoff-specific work. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Coach Single-Leg Hop to Stick for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Output intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "explosiveness",
          "weight": 5
        },
        {
          "key": "power",
          "weight": 5
        },
        {
          "key": "coordination",
          "weight": 3
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 5
        },
        {
          "key": "strength_power",
          "weight": 4
        },
        {
          "key": "plyometrics",
          "weight": 4
        }
      ],
      "physiology": [
        {
          "key": "rate_of_force_development",
          "weight": 5
        },
        {
          "key": "neural_output_readiness",
          "weight": 5
        },
        {
          "key": "ssc_stiffness",
          "weight": 3
        },
        {
          "key": "control_stability",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "jump",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 3
        },
        {
          "key": "balance",
          "weight": 2
        },
        {
          "key": "brace",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "cones",
          "weight": 5
        }
      ],
      "bodyRegions": [
        {
          "key": "foot",
          "weight": 5
        },
        {
          "key": "ankle",
          "weight": 3
        },
        {
          "key": "knee",
          "weight": 2
        },
        {
          "key": "hip",
          "weight": 2
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "selectionReason": "Builds unilateral projection and landing control before full single-leg distance hops or takeoff-specific work.",
      "whyItWorks": "Single-Leg Hop to Stick works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Output / jump_throw_explosive_power because the intended adaptation is high-quality force, speed, stiffness, projection, or elastic expression while fresh. Volume stays low and recovery stays long enough that every attempt remains sharp.",
      "commonMisuse": "Do not turn Single-Leg Hop to Stick into a conditioning station, contact-count challenge, or fatigue finisher. The set ends when speed, distance, stiffness, posture, landing quality, or intent drops.",
      "movementRequirements": {
        "primaryJointActions": [
          "single_leg_horizontal_projection",
          "frontal_plane_landing_control"
        ],
        "primaryTissues": [
          "glutes",
          "calves",
          "quadriceps",
          "hamstrings",
          "foot_intrinsics"
        ],
        "coordinationDemand": "high",
        "balanceDemand": "high",
        "landingOrImpact": {
          "impactLevel": 4,
          "landingQualityRequired": true,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Single-Leg Hop to Stick as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Set a clear lane and landing target for Single-Leg Hop to Stick; use cones as needed.",
          "Give the athlete enough space to land, stick, and step out safely.",
          "Start with the lower-amplitude version and confirm quiet landings before adding distance or speed."
        ],
        "executionSteps": [
          "Start in the assigned stance with feet rooted and eyes forward.",
          "Load quickly but under control, then project with full-body intent.",
          "Use arms to support projection without over-rotating the trunk.",
          "Land quietly, stick the position, measure or score only clean attempts, and reset fully."
        ],
        "coachCues": [
          "Push the ground away",
          "Project out, not up only",
          "Land quiet",
          "Hold posture through the hips",
          "Reset before the next attempt"
        ],
        "commonFaults": [
          "Reaching the landing leg far ahead instead of projecting the hips",
          "Collapsing knee or arch on contact",
          "Loud landings",
          "Turning the drill into a race",
          "Losing rhythm after the first contact"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "attempts",
        "defaultSets": 3,
        "defaultReps": 3,
        "defaultWorkSeconds": 15,
        "defaultRestSeconds": 90,
        "estSecondsPerSet": 110,
        "defaultRpeMin": 7,
        "defaultRpeMax": 9,
        "notes": "Use low total attempts with full reset and measurable quality."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Single-Leg Hop to Stick. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "horizontal_power",
          "jump_power",
          "landing_prep",
          "long_jump_prep",
          "sprint_prep"
        ]
      },
      "safety": {
        "riskLevel": 4,
        "impactLevel": 4,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern.",
          "Athlete can demonstrate a quiet lower-level landing or contact progression before this drill.",
          "Surface, footwear, spacing, and recovery allow high-quality contacts.",
          "Athlete is fresh enough that speed, distance, stiffness, and coordination can be expressed without fatigue leakage."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Broad Jump to Stick",
          "Low-amplitude pogo",
          "Medicine Ball Scoop Toss",
          "Step-Up to Knee Drive"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": true,
        "countsAsNeural": true,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 4,
          "fatigueSensitivity": 5,
          "technicalComplexity": 4,
          "intensityCeiling": "high",
          "impactLevel": 4
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    },
    {
      "id": 27,
      "slug": "single-leg-hop-for-distance",
      "name": "Single-Leg Hop for Distance",
      "family": "Single-leg horizontal power",
      "category": "21-30 - Horizontal projection and broad-jump power",
      "phaseKey": "output",
      "primaryPhaseKey": "output",
      "subrole": "jump_throw_explosive_power",
      "subroleSecondary": "single_leg_horizontal_power",
      "slot": "single_leg_hop_for_distance",
      "cardSummary": "Single-Leg Hop for Distance is a Output drill for jumping athletes who need more horizontal distance. High-specificity single-leg distance task for athletes with strong landing and tendon readiness.",
      "bestPlacement": "Use early in the session after Prepare & Access and any required Movement Intelligence work, before heavy strength or conditioning. Keep volume low and rest long enough for every attempt to stay sharp.",
      "description": "Single-Leg Hop for Distance addresses distance-jumping performance by targeting high-specificity single-leg distance task for athletes with strong landing and tendon readiness. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Coach Single-Leg Hop for Distance for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Output intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "explosiveness",
          "weight": 5
        },
        {
          "key": "power",
          "weight": 5
        },
        {
          "key": "coordination",
          "weight": 3
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 5
        },
        {
          "key": "strength_power",
          "weight": 4
        },
        {
          "key": "plyometrics",
          "weight": 4
        }
      ],
      "physiology": [
        {
          "key": "rate_of_force_development",
          "weight": 5
        },
        {
          "key": "neural_output_readiness",
          "weight": 5
        },
        {
          "key": "ssc_stiffness",
          "weight": 3
        },
        {
          "key": "control_stability",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "jump",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 3
        },
        {
          "key": "balance",
          "weight": 2
        },
        {
          "key": "brace",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "cones",
          "weight": 5
        },
        {
          "key": "tape",
          "weight": 3
        }
      ],
      "bodyRegions": [
        {
          "key": "foot",
          "weight": 5
        },
        {
          "key": "ankle",
          "weight": 3
        },
        {
          "key": "knee",
          "weight": 2
        },
        {
          "key": "hip",
          "weight": 2
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "selectionReason": "High-specificity single-leg distance task for athletes with strong landing and tendon readiness.",
      "whyItWorks": "Single-Leg Hop for Distance works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Output / jump_throw_explosive_power because the intended adaptation is high-quality force, speed, stiffness, projection, or elastic expression while fresh. Volume stays low and recovery stays long enough that every attempt remains sharp.",
      "commonMisuse": "Do not turn Single-Leg Hop for Distance into a conditioning station, contact-count challenge, or fatigue finisher. The set ends when speed, distance, stiffness, posture, landing quality, or intent drops.",
      "movementRequirements": {
        "primaryJointActions": [
          "single_leg_projection",
          "landing_absorption",
          "pelvis_control"
        ],
        "primaryTissues": [
          "glutes",
          "hamstrings",
          "calves",
          "quadriceps",
          "achilles_tendon"
        ],
        "coordinationDemand": "high",
        "balanceDemand": "high",
        "landingOrImpact": {
          "impactLevel": 5,
          "landingQualityRequired": true,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Single-Leg Hop for Distance as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Set a clear lane and landing target for Single-Leg Hop for Distance; use cones, tape as needed.",
          "Give the athlete enough space to land, stick, and step out safely.",
          "Start with the lower-amplitude version and confirm quiet landings before adding distance or speed."
        ],
        "executionSteps": [
          "Start in the assigned stance with feet rooted and eyes forward.",
          "Load quickly but under control, then project with full-body intent.",
          "Use arms to support projection without over-rotating the trunk.",
          "Land quietly, stick the position, measure or score only clean attempts, and reset fully."
        ],
        "coachCues": [
          "Push the ground away",
          "Project out, not up only",
          "Land quiet",
          "Hold posture through the hips",
          "Reset before the next attempt"
        ],
        "commonFaults": [
          "Reaching the landing leg far ahead instead of projecting the hips",
          "Collapsing knee or arch on contact",
          "Loud landings",
          "Turning the drill into a race",
          "Losing rhythm after the first contact"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "attempts",
        "defaultSets": 3,
        "defaultReps": 3,
        "defaultWorkSeconds": 15,
        "defaultRestSeconds": 150,
        "estSecondsPerSet": 170,
        "defaultRpeMin": 7,
        "defaultRpeMax": 9,
        "notes": "Use low total attempts with full reset and measurable quality."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Single-Leg Hop for Distance. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "horizontal_power",
          "jump_power",
          "landing_prep",
          "long_jump_prep",
          "sprint_prep"
        ]
      },
      "safety": {
        "riskLevel": 5,
        "impactLevel": 5,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern.",
          "Athlete can demonstrate a quiet lower-level landing or contact progression before this drill.",
          "Surface, footwear, spacing, and recovery allow high-quality contacts.",
          "Athlete is fresh enough that speed, distance, stiffness, and coordination can be expressed without fatigue leakage."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Broad Jump to Stick",
          "Low-amplitude pogo",
          "Medicine Ball Scoop Toss",
          "Step-Up to Knee Drive"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 1,
        "minimumHoursBetweenHardExposures": 72,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": true,
        "countsAsNeural": true,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 4,
          "fatigueSensitivity": 5,
          "technicalComplexity": 4,
          "intensityCeiling": "high",
          "impactLevel": 5
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    },
    {
      "id": 28,
      "slug": "alternate-leg-bound-for-distance",
      "name": "Alternate-Leg Bound for Distance",
      "family": "Alternate-leg bounding",
      "category": "21-30 - Horizontal projection and broad-jump power",
      "phaseKey": "output",
      "primaryPhaseKey": "output",
      "subrole": "elastic_stiffness_plyometric_rudiments",
      "subroleSecondary": "horizontal_power",
      "slot": "alternate_leg_bound_for_distance",
      "cardSummary": "Alternate-Leg Bound for Distance is a Output drill for jumping athletes who need more horizontal distance. Transfers projection into alternating contacts that resemble approach-to-takeoff rhythm.",
      "bestPlacement": "Use early in the session after Prepare & Access and any required Movement Intelligence work, before heavy strength or conditioning. Keep volume low and rest long enough for every attempt to stay sharp.",
      "description": "Alternate-Leg Bound for Distance addresses distance-jumping performance by targeting transfers projection into alternating contacts that resemble approach-to-takeoff rhythm. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: elastic_stiffness_plyometric_rudiments. Coach Alternate-Leg Bound for Distance for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Output intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "explosiveness",
          "weight": 5
        },
        {
          "key": "speed",
          "weight": 4
        },
        {
          "key": "coordination",
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "elastic_energy",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
        },
        {
          "key": "neural_output_readiness",
          "weight": 4
        }
      ],
      "patterns": [
        {
          "key": "jump",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 3
        },
        {
          "key": "locomote",
          "weight": 2
        },
        {
          "key": "brace",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "cones",
          "weight": 5
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "ankle",
          "weight": 3
        },
        {
          "key": "knee",
          "weight": 2
        },
        {
          "key": "foot",
          "weight": 2
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "selectionReason": "Transfers projection into alternating contacts that resemble approach-to-takeoff rhythm.",
      "whyItWorks": "Alternate-Leg Bound for Distance works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Output / elastic_stiffness_plyometric_rudiments because the intended adaptation is high-quality force, speed, stiffness, projection, or elastic expression while fresh. Volume stays low and recovery stays long enough that every attempt remains sharp.",
      "commonMisuse": "Do not turn Alternate-Leg Bound for Distance into a conditioning station, contact-count challenge, or fatigue finisher. The set ends when speed, distance, stiffness, posture, landing quality, or intent drops.",
      "movementRequirements": {
        "primaryJointActions": [
          "alternating_projection",
          "stiff_contact",
          "rhythm_control"
        ],
        "primaryTissues": [
          "glutes",
          "hamstrings",
          "calves",
          "quadriceps",
          "achilles_tendon"
        ],
        "coordinationDemand": "high",
        "balanceDemand": "low_to_moderate",
        "landingOrImpact": {
          "impactLevel": 5,
          "landingQualityRequired": true,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Alternate-Leg Bound for Distance as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Mark a straight lane or contact zone for Alternate-Leg Bound for Distance; keep the surface flat, dry, and forgiving.",
          "Review the athlete's lower-level pogo, hop, or landing progression first.",
          "Use small contact volumes and full recovery so elastic quality is obvious."
        ],
        "executionSteps": [
          "Start with posture tall and the first contact planned.",
          "Project through the ground while keeping contacts stiff, quick, and directional.",
          "Use the arms to match rhythm and avoid overstriding or reaching.",
          "Finish with a controlled landing or run-out and stop if rhythm breaks."
        ],
        "coachCues": [
          "Push the ground away",
          "Project out, not up only",
          "Land quiet",
          "Hold posture through the hips",
          "Reset before the next attempt"
        ],
        "commonFaults": [
          "Reaching the landing leg far ahead instead of projecting the hips",
          "Collapsing knee or arch on contact",
          "Loud landings",
          "Turning the drill into a race",
          "Losing rhythm after the first contact"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "contacts",
        "defaultSets": 3,
        "defaultReps": 6,
        "defaultWorkSeconds": 12,
        "defaultRestSeconds": 150,
        "estSecondsPerSet": 165,
        "defaultRpeMin": 7,
        "defaultRpeMax": 9,
        "notes": "Keep volume capped; elastic quality and posture must match the first contact."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Alternate-Leg Bound for Distance. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "horizontal_power",
          "jump_power",
          "landing_prep",
          "long_jump_prep",
          "sprint_prep"
        ]
      },
      "safety": {
        "riskLevel": 5,
        "impactLevel": 5,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern.",
          "Athlete can demonstrate a quiet lower-level landing or contact progression before this drill.",
          "Surface, footwear, spacing, and recovery allow high-quality contacts.",
          "Athlete is fresh enough that speed, distance, stiffness, and coordination can be expressed without fatigue leakage."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Broad Jump to Stick",
          "Low-amplitude pogo",
          "Medicine Ball Scoop Toss",
          "Step-Up to Knee Drive"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 1,
        "minimumHoursBetweenHardExposures": 72,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": true,
        "countsAsNeural": true,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 4,
          "fatigueSensitivity": 5,
          "technicalComplexity": 4,
          "intensityCeiling": "high",
          "impactLevel": 5
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    },
    {
      "id": 29,
      "slug": "three-bound-distance-series",
      "name": "Three-Bound Distance Series",
      "family": "Short bound series",
      "category": "21-30 - Horizontal projection and broad-jump power",
      "phaseKey": "output",
      "primaryPhaseKey": "output",
      "subrole": "elastic_stiffness_plyometric_rudiments",
      "subroleSecondary": "horizontal_power",
      "slot": "three_bound_distance_series",
      "cardSummary": "Three-Bound Distance Series is a Output drill for jumping athletes who need more horizontal distance. Compresses distance-bounding quality into a measurable low-volume series.",
      "bestPlacement": "Use early in the session after Prepare & Access and any required Movement Intelligence work, before heavy strength or conditioning. Keep volume low and rest long enough for every attempt to stay sharp.",
      "description": "Three-Bound Distance Series addresses distance-jumping performance by targeting compresses distance-bounding quality into a measurable low-volume series. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: elastic_stiffness_plyometric_rudiments. Coach Three-Bound Distance Series for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Output intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "explosiveness",
          "weight": 5
        },
        {
          "key": "speed",
          "weight": 4
        },
        {
          "key": "coordination",
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "elastic_energy",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
        },
        {
          "key": "neural_output_readiness",
          "weight": 4
        }
      ],
      "patterns": [
        {
          "key": "jump",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 3
        },
        {
          "key": "locomote",
          "weight": 2
        },
        {
          "key": "brace",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "cones",
          "weight": 5
        },
        {
          "key": "tape",
          "weight": 3
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "ankle",
          "weight": 3
        },
        {
          "key": "knee",
          "weight": 2
        },
        {
          "key": "foot",
          "weight": 2
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "selectionReason": "Compresses distance-bounding quality into a measurable low-volume series.",
      "whyItWorks": "Three-Bound Distance Series works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Output / elastic_stiffness_plyometric_rudiments because the intended adaptation is high-quality force, speed, stiffness, projection, or elastic expression while fresh. Volume stays low and recovery stays long enough that every attempt remains sharp.",
      "commonMisuse": "Do not turn Three-Bound Distance Series into a conditioning station, contact-count challenge, or fatigue finisher. The set ends when speed, distance, stiffness, posture, landing quality, or intent drops.",
      "movementRequirements": {
        "primaryJointActions": [
          "repeated_projection",
          "bound_rhythm",
          "landing_control"
        ],
        "primaryTissues": [
          "glutes",
          "hamstrings",
          "calves",
          "quadriceps",
          "achilles_tendon"
        ],
        "coordinationDemand": "high",
        "balanceDemand": "low_to_moderate",
        "landingOrImpact": {
          "impactLevel": 5,
          "landingQualityRequired": true,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Three-Bound Distance Series as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Mark a straight lane or contact zone for Three-Bound Distance Series; keep the surface flat, dry, and forgiving.",
          "Review the athlete's lower-level pogo, hop, or landing progression first.",
          "Use small contact volumes and full recovery so elastic quality is obvious."
        ],
        "executionSteps": [
          "Start with posture tall and the first contact planned.",
          "Project through the ground while keeping contacts stiff, quick, and directional.",
          "Use the arms to match rhythm and avoid overstriding or reaching.",
          "Finish with a controlled landing or run-out and stop if rhythm breaks."
        ],
        "coachCues": [
          "Push the ground away",
          "Project out, not up only",
          "Land quiet",
          "Hold posture through the hips",
          "Reset before the next attempt"
        ],
        "commonFaults": [
          "Reaching the landing leg far ahead instead of projecting the hips",
          "Collapsing knee or arch on contact",
          "Loud landings",
          "Turning the drill into a race",
          "Losing rhythm after the first contact"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "contacts",
        "defaultSets": 3,
        "defaultReps": 6,
        "defaultWorkSeconds": 12,
        "defaultRestSeconds": 150,
        "estSecondsPerSet": 165,
        "defaultRpeMin": 7,
        "defaultRpeMax": 9,
        "notes": "Keep volume capped; elastic quality and posture must match the first contact."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Three-Bound Distance Series. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "horizontal_power",
          "jump_power",
          "landing_prep",
          "long_jump_prep",
          "sprint_prep"
        ]
      },
      "safety": {
        "riskLevel": 5,
        "impactLevel": 5,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern.",
          "Athlete can demonstrate a quiet lower-level landing or contact progression before this drill.",
          "Surface, footwear, spacing, and recovery allow high-quality contacts.",
          "Athlete is fresh enough that speed, distance, stiffness, and coordination can be expressed without fatigue leakage."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Broad Jump to Stick",
          "Low-amplitude pogo",
          "Medicine Ball Scoop Toss",
          "Step-Up to Knee Drive"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 1,
        "minimumHoursBetweenHardExposures": 72,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": true,
        "countsAsNeural": true,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 4,
          "fatigueSensitivity": 5,
          "technicalComplexity": 4,
          "intensityCeiling": "high",
          "impactLevel": 5
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    },
    {
      "id": 30,
      "slug": "bounding-to-pit-landing",
      "name": "Bounding to Pit Landing",
      "family": "Horizontal projection to pit landing",
      "category": "21-30 - Horizontal projection and broad-jump power",
      "phaseKey": "output",
      "primaryPhaseKey": "output",
      "subrole": "jump_throw_explosive_power",
      "subroleSecondary": "pit_landing_skill",
      "slot": "bounding_to_pit_landing",
      "cardSummary": "Bounding to Pit Landing is a Output drill for jumping athletes who need more horizontal distance. Connects horizontal projection with a safer sand/pit landing option for jumpers who need distance expression.",
      "bestPlacement": "Use early in the session after Prepare & Access and any required Movement Intelligence work, before heavy strength or conditioning. Keep volume low and rest long enough for every attempt to stay sharp.",
      "description": "Bounding to Pit Landing addresses distance-jumping performance by targeting connects horizontal projection with a safer sand/pit landing option for jumpers who need distance expression. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Coach Bounding to Pit Landing for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Output intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "explosiveness",
          "weight": 5
        },
        {
          "key": "power",
          "weight": 5
        },
        {
          "key": "coordination",
          "weight": 3
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 5
        },
        {
          "key": "strength_power",
          "weight": 4
        },
        {
          "key": "plyometrics",
          "weight": 4
        }
      ],
      "physiology": [
        {
          "key": "rate_of_force_development",
          "weight": 5
        },
        {
          "key": "neural_output_readiness",
          "weight": 5
        },
        {
          "key": "ssc_stiffness",
          "weight": 3
        },
        {
          "key": "control_stability",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "jump",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 3
        },
        {
          "key": "locomote",
          "weight": 2
        },
        {
          "key": "brace",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "jump_pit",
          "weight": 5
        },
        {
          "key": "cones",
          "weight": 3
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 3
        },
        {
          "key": "ankle",
          "weight": 2
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "selectionReason": "Connects horizontal projection with a safer sand/pit landing option for jumpers who need distance expression.",
      "whyItWorks": "Bounding to Pit Landing works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Output / jump_throw_explosive_power because the intended adaptation is high-quality force, speed, stiffness, projection, or elastic expression while fresh. Volume stays low and recovery stays long enough that every attempt remains sharp.",
      "commonMisuse": "Do not turn Bounding to Pit Landing into a conditioning station, contact-count challenge, or fatigue finisher. The set ends when speed, distance, stiffness, posture, landing quality, or intent drops.",
      "movementRequirements": {
        "primaryJointActions": [
          "horizontal_projection",
          "flight_posture",
          "pit_landing"
        ],
        "primaryTissues": [
          "glutes",
          "hamstrings",
          "calves",
          "quadriceps"
        ],
        "coordinationDemand": "high",
        "balanceDemand": "low_to_moderate",
        "landingOrImpact": {
          "impactLevel": 4,
          "landingQualityRequired": true,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Bounding to Pit Landing as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Set a clear lane and landing target for Bounding to Pit Landing; use jump pit, cones as needed.",
          "Give the athlete enough space to land, stick, and step out safely.",
          "Start with the lower-amplitude version and confirm quiet landings before adding distance or speed."
        ],
        "executionSteps": [
          "Start in the assigned stance with feet rooted and eyes forward.",
          "Load quickly but under control, then project with full-body intent.",
          "Use arms to support projection without over-rotating the trunk.",
          "Land quietly, stick the position, measure or score only clean attempts, and reset fully."
        ],
        "coachCues": [
          "Push the ground away",
          "Project out, not up only",
          "Land quiet",
          "Hold posture through the hips",
          "Reset before the next attempt"
        ],
        "commonFaults": [
          "Reaching the landing leg far ahead instead of projecting the hips",
          "Collapsing knee or arch on contact",
          "Loud landings",
          "Turning the drill into a race",
          "Losing rhythm after the first contact"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "attempts",
        "defaultSets": 3,
        "defaultReps": 3,
        "defaultWorkSeconds": 15,
        "defaultRestSeconds": 90,
        "estSecondsPerSet": 110,
        "defaultRpeMin": 7,
        "defaultRpeMax": 9,
        "notes": "Use low total attempts with full reset and measurable quality."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Bounding to Pit Landing. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "horizontal_power",
          "jump_power",
          "landing_prep",
          "long_jump_prep",
          "sprint_prep"
        ]
      },
      "safety": {
        "riskLevel": 5,
        "impactLevel": 4,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern.",
          "Athlete can demonstrate a quiet lower-level landing or contact progression before this drill.",
          "Surface, footwear, spacing, and recovery allow high-quality contacts.",
          "Athlete is fresh enough that speed, distance, stiffness, and coordination can be expressed without fatigue leakage."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Broad Jump to Stick",
          "Low-amplitude pogo",
          "Medicine Ball Scoop Toss",
          "Step-Up to Knee Drive"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": true,
        "countsAsNeural": true,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 4,
          "fatigueSensitivity": 5,
          "technicalComplexity": 4,
          "intensityCeiling": "high",
          "impactLevel": 4
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    }
  ]
}
```


---

# Exercise Library Batch 31-40 — Jumping Athletes for Distance

## Source and authoring basis

- Primary source used: exercise_card_details_for_llm.md, the Vortex Card v2 authoring guide. It defines phase-first authoring, canonical phase keys, taxonomy tags using key + weight, publish gates, dosage/scaling/safety fields, regimen, phaseProfile, and the preferred camelCase Authoring JSON shape. Purpose.txt was requested and searched for, but no file literally titled Purpose.txt surfaced in the accessible File Library results for this run; therefore this deliverable is grounded in exercise_card_details_for_llm.md, existing Vortex card conventions, and stable coaching expertise.
- Card v2 authoring shape used in each card: identity fields, `primaryPhaseKey`, `subrole`, `subroleSecondary`, `slot`, taxonomy tags, `movementRequirements`, `coachingExecution`, `dosage`, `scaling`, `pairingLogic`, `safety`, `regimen`, and `phaseProfile`.
- Programming rule: distance-jump outputs are quality-first. Stop when rhythm, stiffness, projection, landing quality, or release speed degrades.

## Category focus

**Bounds, hops, and triple-jump elasticity** — Elastic and reactive progressions for athletes who already own basic landings and need rhythmic distance contacts, phase control, and repeated projection.

## Exercises in this batch

31. **Alternating Bounds for Rhythm** — `output` / `elastic_stiffness_plyometric_rudiments` / `alternating_bounds_for_rhythm`
32. **Alternating Bounds for Distance** — `output` / `elastic_stiffness_plyometric_rudiments` / `alternating_bounds_for_distance`
33. **Power Skip for Distance** — `output` / `jump_throw_explosive_power` / `power_skip_for_distance`
34. **Straight-Leg Bound** — `output` / `elastic_stiffness_plyometric_rudiments` / `straight_leg_bound`
35. **Hurdle Hop to Sprint-Out** — `output` / `elastic_stiffness_plyometric_rudiments` / `hurdle_hop_to_sprint_out`
36. **Low Box Drop to Broad Jump** — `output` / `elastic_stiffness_plyometric_rudiments` / `low_box_drop_to_broad_jump`
37. **Depth Drop to Horizontal Rebound** — `output` / `elastic_stiffness_plyometric_rudiments` / `depth_drop_to_horizontal_rebound`
38. **Single-Leg Rebound Hop** — `output` / `elastic_stiffness_plyometric_rudiments` / `single_leg_rebound_hop`
39. **Hop-Step-Jump Phase Series** — `output` / `elastic_stiffness_plyometric_rudiments` / `hop_step_jump_phase_series`
40. **Triple-Jump Walk-In Bound Series** — `output` / `elastic_stiffness_plyometric_rudiments` / `triple_jump_walk_in_bound_series`

## Cursor-ready JSON

```json
{
  "cluster": {
    "title": "Jumping Athletes for Distance Exercise Cards 31-40",
    "focus": "jumping_athletes_for_distance",
    "batch": "31-40",
    "category": "Bounds, hops, and triple-jump elasticity",
    "categoryFocus": "Elastic and reactive progressions for athletes who already own basic landings and need rhythmic distance contacts, phase control, and repeated projection.",
    "cardCount": 10,
    "sourceBasis": "Primary source used: exercise_card_details_for_llm.md, the Vortex Card v2 authoring guide. It defines phase-first authoring, canonical phase keys, taxonomy tags using key + weight, publish gates, dosage/scaling/safety fields, regimen, phaseProfile, and the preferred camelCase Authoring JSON shape. Purpose.txt was requested and searched for, but no file literally titled Purpose.txt surfaced in the accessible File Library results for this run; therefore this deliverable is grounded in exercise_card_details_for_llm.md, existing Vortex card conventions, and stable coaching expertise.",
    "authoringRule": "Use camelCase Card v2 objects with canonical phase keys, taxonomy key+weight tags, movementRequirements, coachingExecution, dosage, scaling cohorts, safety, regimen, and phaseProfile."
  },
  "cards": [
    {
      "id": 31,
      "slug": "alternating-bounds-for-rhythm",
      "name": "Alternating Bounds for Rhythm",
      "family": "Rhythmic alternate-leg bounds",
      "category": "31-40 - Bounds, hops, and triple-jump elasticity",
      "phaseKey": "output",
      "primaryPhaseKey": "output",
      "subrole": "elastic_stiffness_plyometric_rudiments",
      "subroleSecondary": "rhythm_control",
      "slot": "alternating_bounds_for_rhythm",
      "cardSummary": "Alternating Bounds for Rhythm is a Output drill for jumping athletes who need more horizontal distance. Prioritizes timing and posture before maximal distance so bounds do not become chaotic leaping.",
      "bestPlacement": "Use early in the session after Prepare & Access and any required Movement Intelligence work, before heavy strength or conditioning. Keep volume low and rest long enough for every attempt to stay sharp.",
      "description": "Alternating Bounds for Rhythm addresses distance-jumping performance by targeting prioritizes timing and posture before maximal distance so bounds do not become chaotic leaping. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: elastic_stiffness_plyometric_rudiments. Coach Alternating Bounds for Rhythm for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Output intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "explosiveness",
          "weight": 5
        },
        {
          "key": "speed",
          "weight": 4
        },
        {
          "key": "coordination",
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "elastic_energy",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
        },
        {
          "key": "neural_output_readiness",
          "weight": 4
        }
      ],
      "patterns": [
        {
          "key": "jump",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 3
        },
        {
          "key": "locomote",
          "weight": 2
        },
        {
          "key": "brace",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "cones",
          "weight": 5
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 3
        },
        {
          "key": "ankle",
          "weight": 2
        },
        {
          "key": "foot",
          "weight": 2
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "selectionReason": "Prioritizes timing and posture before maximal distance so bounds do not become chaotic leaping.",
      "whyItWorks": "Alternating Bounds for Rhythm works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Output / elastic_stiffness_plyometric_rudiments because the intended adaptation is high-quality force, speed, stiffness, projection, or elastic expression while fresh. Volume stays low and recovery stays long enough that every attempt remains sharp.",
      "commonMisuse": "Do not turn Alternating Bounds for Rhythm into a conditioning station, contact-count challenge, or fatigue finisher. The set ends when speed, distance, stiffness, posture, landing quality, or intent drops.",
      "movementRequirements": {
        "primaryJointActions": [
          "alternating_bound_rhythm",
          "stiff_contact",
          "posture"
        ],
        "primaryTissues": [
          "glutes",
          "hamstrings",
          "calves",
          "achilles_tendon"
        ],
        "coordinationDemand": "high",
        "balanceDemand": "low_to_moderate",
        "landingOrImpact": {
          "impactLevel": 4,
          "landingQualityRequired": true,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Alternating Bounds for Rhythm as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Mark a straight lane or contact zone for Alternating Bounds for Rhythm; keep the surface flat, dry, and forgiving.",
          "Review the athlete's lower-level pogo, hop, or landing progression first.",
          "Use small contact volumes and full recovery so elastic quality is obvious."
        ],
        "executionSteps": [
          "Start with posture tall and the first contact planned.",
          "Project through the ground while keeping contacts stiff, quick, and directional.",
          "Use the arms to match rhythm and avoid overstriding or reaching.",
          "Finish with a controlled landing or run-out and stop if rhythm breaks."
        ],
        "coachCues": [
          "Push the ground away",
          "Project out, not up only",
          "Land quiet",
          "Hold posture through the hips",
          "Reset before the next attempt"
        ],
        "commonFaults": [
          "Reaching the landing leg far ahead instead of projecting the hips",
          "Collapsing knee or arch on contact",
          "Loud landings",
          "Turning the drill into a race",
          "Losing rhythm after the first contact"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "contacts",
        "defaultSets": 3,
        "defaultReps": 8,
        "defaultWorkSeconds": 12,
        "defaultRestSeconds": 120,
        "estSecondsPerSet": 135,
        "defaultRpeMin": 7,
        "defaultRpeMax": 9,
        "notes": "Keep volume capped; elastic quality and posture must match the first contact."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Alternating Bounds for Rhythm. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "horizontal_power",
          "jump_power",
          "landing_prep",
          "long_jump_prep",
          "sprint_prep"
        ]
      },
      "safety": {
        "riskLevel": 4,
        "impactLevel": 4,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern.",
          "Athlete can demonstrate a quiet lower-level landing or contact progression before this drill.",
          "Surface, footwear, spacing, and recovery allow high-quality contacts.",
          "Athlete is fresh enough that speed, distance, stiffness, and coordination can be expressed without fatigue leakage."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Broad Jump to Stick",
          "Low-amplitude pogo",
          "Medicine Ball Scoop Toss",
          "Step-Up to Knee Drive"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": true,
        "countsAsNeural": true,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 4,
          "fatigueSensitivity": 5,
          "technicalComplexity": 4,
          "intensityCeiling": "high",
          "impactLevel": 4
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    },
    {
      "id": 32,
      "slug": "alternating-bounds-for-distance",
      "name": "Alternating Bounds for Distance",
      "family": "Maximal alternate-leg bounds",
      "category": "31-40 - Bounds, hops, and triple-jump elasticity",
      "phaseKey": "output",
      "primaryPhaseKey": "output",
      "subrole": "elastic_stiffness_plyometric_rudiments",
      "subroleSecondary": "horizontal_power",
      "slot": "alternating_bounds_for_distance",
      "cardSummary": "Alternating Bounds for Distance is a Output drill for jumping athletes who need more horizontal distance. Raises the projection demand after rhythm is stable, making it a high-value distance-jumper power drill.",
      "bestPlacement": "Use early in the session after Prepare & Access and any required Movement Intelligence work, before heavy strength or conditioning. Keep volume low and rest long enough for every attempt to stay sharp.",
      "description": "Alternating Bounds for Distance addresses distance-jumping performance by targeting raises the projection demand after rhythm is stable, making it a high-value distance-jumper power drill. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: elastic_stiffness_plyometric_rudiments. Coach Alternating Bounds for Distance for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Output intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "explosiveness",
          "weight": 5
        },
        {
          "key": "speed",
          "weight": 4
        },
        {
          "key": "coordination",
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "elastic_energy",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
        },
        {
          "key": "neural_output_readiness",
          "weight": 4
        }
      ],
      "patterns": [
        {
          "key": "jump",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 3
        },
        {
          "key": "locomote",
          "weight": 2
        },
        {
          "key": "brace",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "cones",
          "weight": 5
        },
        {
          "key": "tape",
          "weight": 3
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 3
        },
        {
          "key": "ankle",
          "weight": 2
        },
        {
          "key": "foot",
          "weight": 2
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "selectionReason": "Raises the projection demand after rhythm is stable, making it a high-value distance-jumper power drill.",
      "whyItWorks": "Alternating Bounds for Distance works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Output / elastic_stiffness_plyometric_rudiments because the intended adaptation is high-quality force, speed, stiffness, projection, or elastic expression while fresh. Volume stays low and recovery stays long enough that every attempt remains sharp.",
      "commonMisuse": "Do not turn Alternating Bounds for Distance into a conditioning station, contact-count challenge, or fatigue finisher. The set ends when speed, distance, stiffness, posture, landing quality, or intent drops.",
      "movementRequirements": {
        "primaryJointActions": [
          "maximal_alternating_projection",
          "stiff_contact",
          "posture_control"
        ],
        "primaryTissues": [
          "glutes",
          "hamstrings",
          "calves",
          "quadriceps",
          "achilles_tendon"
        ],
        "coordinationDemand": "high",
        "balanceDemand": "low_to_moderate",
        "landingOrImpact": {
          "impactLevel": 5,
          "landingQualityRequired": true,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Alternating Bounds for Distance as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Mark a straight lane or contact zone for Alternating Bounds for Distance; keep the surface flat, dry, and forgiving.",
          "Review the athlete's lower-level pogo, hop, or landing progression first.",
          "Use small contact volumes and full recovery so elastic quality is obvious."
        ],
        "executionSteps": [
          "Start with posture tall and the first contact planned.",
          "Project through the ground while keeping contacts stiff, quick, and directional.",
          "Use the arms to match rhythm and avoid overstriding or reaching.",
          "Finish with a controlled landing or run-out and stop if rhythm breaks."
        ],
        "coachCues": [
          "Push the ground away",
          "Project out, not up only",
          "Land quiet",
          "Hold posture through the hips",
          "Reset before the next attempt"
        ],
        "commonFaults": [
          "Reaching the landing leg far ahead instead of projecting the hips",
          "Collapsing knee or arch on contact",
          "Loud landings",
          "Turning the drill into a race",
          "Losing rhythm after the first contact"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "contacts",
        "defaultSets": 3,
        "defaultReps": 6,
        "defaultWorkSeconds": 12,
        "defaultRestSeconds": 150,
        "estSecondsPerSet": 165,
        "defaultRpeMin": 7,
        "defaultRpeMax": 9,
        "notes": "Keep volume capped; elastic quality and posture must match the first contact."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Alternating Bounds for Distance. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "horizontal_power",
          "jump_power",
          "landing_prep",
          "long_jump_prep",
          "sprint_prep"
        ]
      },
      "safety": {
        "riskLevel": 5,
        "impactLevel": 5,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern.",
          "Athlete can demonstrate a quiet lower-level landing or contact progression before this drill.",
          "Surface, footwear, spacing, and recovery allow high-quality contacts.",
          "Athlete is fresh enough that speed, distance, stiffness, and coordination can be expressed without fatigue leakage."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Broad Jump to Stick",
          "Low-amplitude pogo",
          "Medicine Ball Scoop Toss",
          "Step-Up to Knee Drive"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 1,
        "minimumHoursBetweenHardExposures": 72,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": true,
        "countsAsNeural": true,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 4,
          "fatigueSensitivity": 5,
          "technicalComplexity": 4,
          "intensityCeiling": "high",
          "impactLevel": 5
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    },
    {
      "id": 33,
      "slug": "power-skip-for-distance",
      "name": "Power Skip for Distance",
      "family": "Power skipping",
      "category": "31-40 - Bounds, hops, and triple-jump elasticity",
      "phaseKey": "output",
      "primaryPhaseKey": "output",
      "subrole": "jump_throw_explosive_power",
      "subroleSecondary": "horizontal_rhythm",
      "slot": "power_skip_for_distance",
      "cardSummary": "Power Skip for Distance is a Output drill for jumping athletes who need more horizontal distance. Blends sprint rhythm, stiffness, and projection in a lower-complexity alternative to full bounds.",
      "bestPlacement": "Use early in the session after Prepare & Access and any required Movement Intelligence work, before heavy strength or conditioning. Keep volume low and rest long enough for every attempt to stay sharp.",
      "description": "Power Skip for Distance addresses distance-jumping performance by targeting blends sprint rhythm, stiffness, and projection in a lower-complexity alternative to full bounds. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Coach Power Skip for Distance for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Output intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "explosiveness",
          "weight": 5
        },
        {
          "key": "speed",
          "weight": 4
        },
        {
          "key": "coordination",
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "elastic_energy",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
        },
        {
          "key": "neural_output_readiness",
          "weight": 4
        }
      ],
      "patterns": [
        {
          "key": "jump",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 3
        },
        {
          "key": "locomote",
          "weight": 2
        },
        {
          "key": "brace",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "cones",
          "weight": 5
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 3
        },
        {
          "key": "ankle",
          "weight": 2
        },
        {
          "key": "foot",
          "weight": 2
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "selectionReason": "Blends sprint rhythm, stiffness, and projection in a lower-complexity alternative to full bounds.",
      "whyItWorks": "Power Skip for Distance works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Output / jump_throw_explosive_power because the intended adaptation is high-quality force, speed, stiffness, projection, or elastic expression while fresh. Volume stays low and recovery stays long enough that every attempt remains sharp.",
      "commonMisuse": "Do not turn Power Skip for Distance into a conditioning station, contact-count challenge, or fatigue finisher. The set ends when speed, distance, stiffness, posture, landing quality, or intent drops.",
      "movementRequirements": {
        "primaryJointActions": [
          "skip_projection",
          "arm_swing_timing",
          "upright_stiffness"
        ],
        "primaryTissues": [
          "glutes",
          "calves",
          "hamstrings",
          "hip_flexors"
        ],
        "coordinationDemand": "high",
        "balanceDemand": "low_to_moderate",
        "landingOrImpact": {
          "impactLevel": 4,
          "landingQualityRequired": true,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Power Skip for Distance as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Mark a straight lane or contact zone for Power Skip for Distance; keep the surface flat, dry, and forgiving.",
          "Review the athlete's lower-level pogo, hop, or landing progression first.",
          "Use small contact volumes and full recovery so elastic quality is obvious."
        ],
        "executionSteps": [
          "Start with posture tall and the first contact planned.",
          "Project through the ground while keeping contacts stiff, quick, and directional.",
          "Use the arms to match rhythm and avoid overstriding or reaching.",
          "Finish with a controlled landing or run-out and stop if rhythm breaks."
        ],
        "coachCues": [
          "Push the ground away",
          "Project out, not up only",
          "Land quiet",
          "Hold posture through the hips",
          "Reset before the next attempt"
        ],
        "commonFaults": [
          "Reaching the landing leg far ahead instead of projecting the hips",
          "Collapsing knee or arch on contact",
          "Loud landings",
          "Turning the drill into a race",
          "Losing rhythm after the first contact"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "contacts",
        "defaultSets": 3,
        "defaultReps": 8,
        "defaultWorkSeconds": 12,
        "defaultRestSeconds": 120,
        "estSecondsPerSet": 135,
        "defaultRpeMin": 7,
        "defaultRpeMax": 9,
        "notes": "Keep volume capped; elastic quality and posture must match the first contact."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Power Skip for Distance. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "horizontal_power",
          "jump_power",
          "landing_prep",
          "long_jump_prep",
          "sprint_prep"
        ]
      },
      "safety": {
        "riskLevel": 4,
        "impactLevel": 4,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern.",
          "Athlete can demonstrate a quiet lower-level landing or contact progression before this drill.",
          "Surface, footwear, spacing, and recovery allow high-quality contacts.",
          "Athlete is fresh enough that speed, distance, stiffness, and coordination can be expressed without fatigue leakage."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Broad Jump to Stick",
          "Low-amplitude pogo",
          "Medicine Ball Scoop Toss",
          "Step-Up to Knee Drive"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": true,
        "countsAsNeural": true,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 4,
          "fatigueSensitivity": 5,
          "technicalComplexity": 4,
          "intensityCeiling": "high",
          "impactLevel": 4
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    },
    {
      "id": 34,
      "slug": "straight-leg-bound",
      "name": "Straight-Leg Bound",
      "family": "Straight-leg elastic bound",
      "category": "31-40 - Bounds, hops, and triple-jump elasticity",
      "phaseKey": "output",
      "primaryPhaseKey": "output",
      "subrole": "elastic_stiffness_plyometric_rudiments",
      "subroleSecondary": "sprint_stiffness",
      "slot": "straight_leg_bound",
      "cardSummary": "Straight-Leg Bound is a Output drill for jumping athletes who need more horizontal distance. Develops front-side stiffness and elastic strike for approach-speed carryover.",
      "bestPlacement": "Use early in the session after Prepare & Access and any required Movement Intelligence work, before heavy strength or conditioning. Keep volume low and rest long enough for every attempt to stay sharp.",
      "description": "Straight-Leg Bound addresses distance-jumping performance by targeting develops front-side stiffness and elastic strike for approach-speed carryover. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: elastic_stiffness_plyometric_rudiments. Coach Straight-Leg Bound for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Output intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "explosiveness",
          "weight": 5
        },
        {
          "key": "speed",
          "weight": 4
        },
        {
          "key": "coordination",
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "elastic_energy",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
        },
        {
          "key": "neural_output_readiness",
          "weight": 4
        }
      ],
      "patterns": [
        {
          "key": "jump",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 3
        },
        {
          "key": "locomote",
          "weight": 2
        },
        {
          "key": "brace",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "cones",
          "weight": 5
        }
      ],
      "bodyRegions": [
        {
          "key": "hamstring",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 3
        },
        {
          "key": "ankle",
          "weight": 2
        },
        {
          "key": "foot",
          "weight": 2
        }
      ],
      "selectionReason": "Develops front-side stiffness and elastic strike for approach-speed carryover.",
      "whyItWorks": "Straight-Leg Bound works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Output / elastic_stiffness_plyometric_rudiments because the intended adaptation is high-quality force, speed, stiffness, projection, or elastic expression while fresh. Volume stays low and recovery stays long enough that every attempt remains sharp.",
      "commonMisuse": "Do not turn Straight-Leg Bound into a conditioning station, contact-count challenge, or fatigue finisher. The set ends when speed, distance, stiffness, posture, landing quality, or intent drops.",
      "movementRequirements": {
        "primaryJointActions": [
          "front_side_stiffness",
          "pawback_timing",
          "ankle_stiffness"
        ],
        "primaryTissues": [
          "hamstrings",
          "calves",
          "glutes",
          "achilles_tendon"
        ],
        "coordinationDemand": "high",
        "balanceDemand": "low_to_moderate",
        "landingOrImpact": {
          "impactLevel": 4,
          "landingQualityRequired": true,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Straight-Leg Bound as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Mark a straight lane or contact zone for Straight-Leg Bound; keep the surface flat, dry, and forgiving.",
          "Review the athlete's lower-level pogo, hop, or landing progression first.",
          "Use small contact volumes and full recovery so elastic quality is obvious."
        ],
        "executionSteps": [
          "Start with posture tall and the first contact planned.",
          "Project through the ground while keeping contacts stiff, quick, and directional.",
          "Use the arms to match rhythm and avoid overstriding or reaching.",
          "Finish with a controlled landing or run-out and stop if rhythm breaks."
        ],
        "coachCues": [
          "Push the ground away",
          "Project out, not up only",
          "Land quiet",
          "Hold posture through the hips",
          "Reset before the next attempt"
        ],
        "commonFaults": [
          "Reaching the landing leg far ahead instead of projecting the hips",
          "Collapsing knee or arch on contact",
          "Loud landings",
          "Turning the drill into a race",
          "Losing rhythm after the first contact"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "contacts",
        "defaultSets": 3,
        "defaultReps": 8,
        "defaultWorkSeconds": 12,
        "defaultRestSeconds": 120,
        "estSecondsPerSet": 135,
        "defaultRpeMin": 7,
        "defaultRpeMax": 9,
        "notes": "Keep volume capped; elastic quality and posture must match the first contact."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Straight-Leg Bound. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "horizontal_power",
          "jump_power",
          "landing_prep",
          "long_jump_prep",
          "sprint_prep"
        ]
      },
      "safety": {
        "riskLevel": 4,
        "impactLevel": 4,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern.",
          "Athlete can demonstrate a quiet lower-level landing or contact progression before this drill.",
          "Surface, footwear, spacing, and recovery allow high-quality contacts.",
          "Athlete is fresh enough that speed, distance, stiffness, and coordination can be expressed without fatigue leakage."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Broad Jump to Stick",
          "Low-amplitude pogo",
          "Medicine Ball Scoop Toss",
          "Step-Up to Knee Drive"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": true,
        "countsAsNeural": true,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 4,
          "fatigueSensitivity": 5,
          "technicalComplexity": 4,
          "intensityCeiling": "high",
          "impactLevel": 4
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    },
    {
      "id": 35,
      "slug": "hurdle-hop-to-sprint-out",
      "name": "Hurdle Hop to Sprint-Out",
      "family": "Elastic hop to acceleration",
      "category": "31-40 - Bounds, hops, and triple-jump elasticity",
      "phaseKey": "output",
      "primaryPhaseKey": "output",
      "subrole": "elastic_stiffness_plyometric_rudiments",
      "subroleSecondary": "sprint_transfer",
      "slot": "hurdle_hop_to_sprint_out",
      "cardSummary": "Hurdle Hop to Sprint-Out is a Output drill for jumping athletes who need more horizontal distance. Links elastic contacts to sprinting out, useful for athletes who must project and keep moving.",
      "bestPlacement": "Use early in the session after Prepare & Access and any required Movement Intelligence work, before heavy strength or conditioning. Keep volume low and rest long enough for every attempt to stay sharp.",
      "description": "Hurdle Hop to Sprint-Out addresses distance-jumping performance by targeting links elastic contacts to sprinting out, useful for athletes who must project and keep moving. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: elastic_stiffness_plyometric_rudiments. Coach Hurdle Hop to Sprint-Out for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Output intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "explosiveness",
          "weight": 5
        },
        {
          "key": "speed",
          "weight": 4
        },
        {
          "key": "coordination",
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "elastic_energy",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
        },
        {
          "key": "neural_output_readiness",
          "weight": 4
        }
      ],
      "patterns": [
        {
          "key": "jump",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 3
        },
        {
          "key": "locomote",
          "weight": 2
        },
        {
          "key": "brace",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "mini_hurdles",
          "weight": 5
        },
        {
          "key": "cones",
          "weight": 3
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "ankle",
          "weight": 3
        },
        {
          "key": "knee",
          "weight": 2
        },
        {
          "key": "foot",
          "weight": 2
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "selectionReason": "Links elastic contacts to sprinting out, useful for athletes who must project and keep moving.",
      "whyItWorks": "Hurdle Hop to Sprint-Out works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Output / elastic_stiffness_plyometric_rudiments because the intended adaptation is high-quality force, speed, stiffness, projection, or elastic expression while fresh. Volume stays low and recovery stays long enough that every attempt remains sharp.",
      "commonMisuse": "Do not turn Hurdle Hop to Sprint-Out into a conditioning station, contact-count challenge, or fatigue finisher. The set ends when speed, distance, stiffness, posture, landing quality, or intent drops.",
      "movementRequirements": {
        "primaryJointActions": [
          "elastic_hop",
          "transition_acceleration",
          "posture_recovery"
        ],
        "primaryTissues": [
          "calves",
          "glutes",
          "hamstrings",
          "quadriceps"
        ],
        "coordinationDemand": "high",
        "balanceDemand": "low_to_moderate",
        "landingOrImpact": {
          "impactLevel": 4,
          "landingQualityRequired": true,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Hurdle Hop to Sprint-Out as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Mark a straight lane or contact zone for Hurdle Hop to Sprint-Out; keep the surface flat, dry, and forgiving.",
          "Review the athlete's lower-level pogo, hop, or landing progression first.",
          "Use small contact volumes and full recovery so elastic quality is obvious."
        ],
        "executionSteps": [
          "Start with posture tall and the first contact planned.",
          "Project through the ground while keeping contacts stiff, quick, and directional.",
          "Use the arms to match rhythm and avoid overstriding or reaching.",
          "Finish with a controlled landing or run-out and stop if rhythm breaks."
        ],
        "coachCues": [
          "Push the ground away",
          "Project out, not up only",
          "Land quiet",
          "Hold posture through the hips",
          "Reset before the next attempt"
        ],
        "commonFaults": [
          "Reaching the landing leg far ahead instead of projecting the hips",
          "Collapsing knee or arch on contact",
          "Loud landings",
          "Turning the drill into a race",
          "Losing rhythm after the first contact"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "contacts",
        "defaultSets": 3,
        "defaultReps": 8,
        "defaultWorkSeconds": 12,
        "defaultRestSeconds": 120,
        "estSecondsPerSet": 135,
        "defaultRpeMin": 7,
        "defaultRpeMax": 9,
        "notes": "Keep volume capped; elastic quality and posture must match the first contact."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Hurdle Hop to Sprint-Out. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "horizontal_power",
          "jump_power",
          "landing_prep",
          "long_jump_prep",
          "sprint_prep"
        ]
      },
      "safety": {
        "riskLevel": 4,
        "impactLevel": 4,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern.",
          "Athlete can demonstrate a quiet lower-level landing or contact progression before this drill.",
          "Surface, footwear, spacing, and recovery allow high-quality contacts.",
          "Athlete is fresh enough that speed, distance, stiffness, and coordination can be expressed without fatigue leakage."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Broad Jump to Stick",
          "Low-amplitude pogo",
          "Medicine Ball Scoop Toss",
          "Step-Up to Knee Drive"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": true,
        "countsAsNeural": true,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 4,
          "fatigueSensitivity": 5,
          "technicalComplexity": 4,
          "intensityCeiling": "high",
          "impactLevel": 4
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    },
    {
      "id": 36,
      "slug": "low-box-drop-to-broad-jump",
      "name": "Low Box Drop to Broad Jump",
      "family": "Drop-to-horizontal rebound",
      "category": "31-40 - Bounds, hops, and triple-jump elasticity",
      "phaseKey": "output",
      "primaryPhaseKey": "output",
      "subrole": "elastic_stiffness_plyometric_rudiments",
      "subroleSecondary": "horizontal_rebound_power",
      "slot": "low_box_drop_to_broad_jump",
      "cardSummary": "Low Box Drop to Broad Jump is a Output drill for jumping athletes who need more horizontal distance. Advanced rebound drill that converts a controlled drop into immediate horizontal projection.",
      "bestPlacement": "Use early in the session after Prepare & Access and any required Movement Intelligence work, before heavy strength or conditioning. Keep volume low and rest long enough for every attempt to stay sharp.",
      "description": "Low Box Drop to Broad Jump addresses distance-jumping performance by targeting advanced rebound drill that converts a controlled drop into immediate horizontal projection. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: elastic_stiffness_plyometric_rudiments. Coach Low Box Drop to Broad Jump for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Output intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "explosiveness",
          "weight": 5
        },
        {
          "key": "power",
          "weight": 5
        },
        {
          "key": "coordination",
          "weight": 3
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 5
        },
        {
          "key": "strength_power",
          "weight": 4
        },
        {
          "key": "plyometrics",
          "weight": 4
        }
      ],
      "physiology": [
        {
          "key": "rate_of_force_development",
          "weight": 5
        },
        {
          "key": "neural_output_readiness",
          "weight": 5
        },
        {
          "key": "ssc_stiffness",
          "weight": 3
        },
        {
          "key": "control_stability",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "jump",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 3
        },
        {
          "key": "brace",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "low_box",
          "weight": 5
        },
        {
          "key": "cones",
          "weight": 3
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 3
        },
        {
          "key": "ankle",
          "weight": 2
        },
        {
          "key": "foot",
          "weight": 2
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "selectionReason": "Advanced rebound drill that converts a controlled drop into immediate horizontal projection.",
      "whyItWorks": "Low Box Drop to Broad Jump works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Output / elastic_stiffness_plyometric_rudiments because the intended adaptation is high-quality force, speed, stiffness, projection, or elastic expression while fresh. Volume stays low and recovery stays long enough that every attempt remains sharp.",
      "commonMisuse": "Do not turn Low Box Drop to Broad Jump into a conditioning station, contact-count challenge, or fatigue finisher. The set ends when speed, distance, stiffness, posture, landing quality, or intent drops.",
      "movementRequirements": {
        "primaryJointActions": [
          "drop_absorption",
          "short_amortization",
          "horizontal_rebound"
        ],
        "primaryTissues": [
          "glutes",
          "hamstrings",
          "calves",
          "quadriceps",
          "achilles_tendon"
        ],
        "coordinationDemand": "high",
        "balanceDemand": "low_to_moderate",
        "landingOrImpact": {
          "impactLevel": 5,
          "landingQualityRequired": true,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Low Box Drop to Broad Jump as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Set a clear lane and landing target for Low Box Drop to Broad Jump; use low box, cones as needed.",
          "Give the athlete enough space to land, stick, and step out safely.",
          "Start with the lower-amplitude version and confirm quiet landings before adding distance or speed."
        ],
        "executionSteps": [
          "Start in the assigned stance with feet rooted and eyes forward.",
          "Load quickly but under control, then project with full-body intent.",
          "Use arms to support projection without over-rotating the trunk.",
          "Land quietly, stick the position, measure or score only clean attempts, and reset fully."
        ],
        "coachCues": [
          "Push the ground away",
          "Project out, not up only",
          "Land quiet",
          "Hold posture through the hips",
          "Reset before the next attempt"
        ],
        "commonFaults": [
          "Reaching the landing leg far ahead instead of projecting the hips",
          "Collapsing knee or arch on contact",
          "Loud landings",
          "Turning the drill into a race",
          "Losing rhythm after the first contact"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "attempts",
        "defaultSets": 3,
        "defaultReps": 3,
        "defaultWorkSeconds": 15,
        "defaultRestSeconds": 150,
        "estSecondsPerSet": 170,
        "defaultRpeMin": 7,
        "defaultRpeMax": 9,
        "notes": "Use low total attempts with full reset and measurable quality."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Low Box Drop to Broad Jump. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "horizontal_power",
          "jump_power",
          "landing_prep",
          "long_jump_prep",
          "sprint_prep"
        ]
      },
      "safety": {
        "riskLevel": 5,
        "impactLevel": 5,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern.",
          "Athlete can demonstrate a quiet lower-level landing or contact progression before this drill.",
          "Surface, footwear, spacing, and recovery allow high-quality contacts.",
          "Athlete is fresh enough that speed, distance, stiffness, and coordination can be expressed without fatigue leakage."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Broad Jump to Stick",
          "Low-amplitude pogo",
          "Medicine Ball Scoop Toss",
          "Step-Up to Knee Drive"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 1,
        "minimumHoursBetweenHardExposures": 72,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": true,
        "countsAsNeural": true,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 4,
          "fatigueSensitivity": 5,
          "technicalComplexity": 4,
          "intensityCeiling": "high",
          "impactLevel": 5
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    },
    {
      "id": 37,
      "slug": "depth-drop-to-horizontal-rebound",
      "name": "Depth Drop to Horizontal Rebound",
      "family": "Depth-to-horizontal rebound",
      "category": "31-40 - Bounds, hops, and triple-jump elasticity",
      "phaseKey": "output",
      "primaryPhaseKey": "output",
      "subrole": "elastic_stiffness_plyometric_rudiments",
      "subroleSecondary": "horizontal_rebound_power",
      "slot": "depth_drop_to_horizontal_rebound",
      "cardSummary": "Depth Drop to Horizontal Rebound is a Output drill for jumping athletes who need more horizontal distance. High-intensity SSC option for mature athletes who can rebound horizontally without collapsing.",
      "bestPlacement": "Use early in the session after Prepare & Access and any required Movement Intelligence work, before heavy strength or conditioning. Keep volume low and rest long enough for every attempt to stay sharp.",
      "description": "Depth Drop to Horizontal Rebound addresses distance-jumping performance by targeting high-intensity SSC option for mature athletes who can rebound horizontally without collapsing. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: elastic_stiffness_plyometric_rudiments. Coach Depth Drop to Horizontal Rebound for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Output intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "explosiveness",
          "weight": 5
        },
        {
          "key": "speed",
          "weight": 4
        },
        {
          "key": "coordination",
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "elastic_energy",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
        },
        {
          "key": "neural_output_readiness",
          "weight": 4
        }
      ],
      "patterns": [
        {
          "key": "jump",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 3
        },
        {
          "key": "brace",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "low_box",
          "weight": 5
        },
        {
          "key": "cones",
          "weight": 3
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 3
        },
        {
          "key": "ankle",
          "weight": 2
        },
        {
          "key": "foot",
          "weight": 2
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "selectionReason": "High-intensity SSC option for mature athletes who can rebound horizontally without collapsing.",
      "whyItWorks": "Depth Drop to Horizontal Rebound works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Output / elastic_stiffness_plyometric_rudiments because the intended adaptation is high-quality force, speed, stiffness, projection, or elastic expression while fresh. Volume stays low and recovery stays long enough that every attempt remains sharp.",
      "commonMisuse": "Do not turn Depth Drop to Horizontal Rebound into a conditioning station, contact-count challenge, or fatigue finisher. The set ends when speed, distance, stiffness, posture, landing quality, or intent drops.",
      "movementRequirements": {
        "primaryJointActions": [
          "eccentric_absorption",
          "short_ground_contact",
          "horizontal_rebound"
        ],
        "primaryTissues": [
          "achilles_tendon",
          "calves",
          "glutes",
          "hamstrings",
          "quadriceps"
        ],
        "coordinationDemand": "high",
        "balanceDemand": "low_to_moderate",
        "landingOrImpact": {
          "impactLevel": 5,
          "landingQualityRequired": true,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Depth Drop to Horizontal Rebound as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Mark a straight lane or contact zone for Depth Drop to Horizontal Rebound; keep the surface flat, dry, and forgiving.",
          "Review the athlete's lower-level pogo, hop, or landing progression first.",
          "Use small contact volumes and full recovery so elastic quality is obvious."
        ],
        "executionSteps": [
          "Start with posture tall and the first contact planned.",
          "Project through the ground while keeping contacts stiff, quick, and directional.",
          "Use the arms to match rhythm and avoid overstriding or reaching.",
          "Finish with a controlled landing or run-out and stop if rhythm breaks."
        ],
        "coachCues": [
          "Push the ground away",
          "Project out, not up only",
          "Land quiet",
          "Hold posture through the hips",
          "Reset before the next attempt"
        ],
        "commonFaults": [
          "Reaching the landing leg far ahead instead of projecting the hips",
          "Collapsing knee or arch on contact",
          "Loud landings",
          "Turning the drill into a race",
          "Losing rhythm after the first contact"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "contacts",
        "defaultSets": 3,
        "defaultReps": 6,
        "defaultWorkSeconds": 12,
        "defaultRestSeconds": 150,
        "estSecondsPerSet": 165,
        "defaultRpeMin": 7,
        "defaultRpeMax": 9,
        "notes": "Keep volume capped; elastic quality and posture must match the first contact."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Depth Drop to Horizontal Rebound. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "horizontal_power",
          "jump_power",
          "landing_prep",
          "long_jump_prep",
          "sprint_prep"
        ]
      },
      "safety": {
        "riskLevel": 5,
        "impactLevel": 5,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern.",
          "Athlete can demonstrate a quiet lower-level landing or contact progression before this drill.",
          "Surface, footwear, spacing, and recovery allow high-quality contacts.",
          "Athlete is fresh enough that speed, distance, stiffness, and coordination can be expressed without fatigue leakage."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Broad Jump to Stick",
          "Low-amplitude pogo",
          "Medicine Ball Scoop Toss",
          "Step-Up to Knee Drive"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 1,
        "minimumHoursBetweenHardExposures": 72,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": true,
        "countsAsNeural": true,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 4,
          "fatigueSensitivity": 5,
          "technicalComplexity": 4,
          "intensityCeiling": "high",
          "impactLevel": 5
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    },
    {
      "id": 38,
      "slug": "single-leg-rebound-hop",
      "name": "Single-Leg Rebound Hop",
      "family": "Single-leg reactive hop",
      "category": "31-40 - Bounds, hops, and triple-jump elasticity",
      "phaseKey": "output",
      "primaryPhaseKey": "output",
      "subrole": "elastic_stiffness_plyometric_rudiments",
      "subroleSecondary": "single_leg_reactive_power",
      "slot": "single_leg_rebound_hop",
      "cardSummary": "Single-Leg Rebound Hop is a Output drill for jumping athletes who need more horizontal distance. High-specificity unilateral elastic drill for athletes who already tolerate single-leg hops and bounds.",
      "bestPlacement": "Use early in the session after Prepare & Access and any required Movement Intelligence work, before heavy strength or conditioning. Keep volume low and rest long enough for every attempt to stay sharp.",
      "description": "Single-Leg Rebound Hop addresses distance-jumping performance by targeting high-specificity unilateral elastic drill for athletes who already tolerate single-leg hops and bounds. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: elastic_stiffness_plyometric_rudiments. Coach Single-Leg Rebound Hop for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Output intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "explosiveness",
          "weight": 5
        },
        {
          "key": "speed",
          "weight": 4
        },
        {
          "key": "coordination",
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "elastic_energy",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
        },
        {
          "key": "neural_output_readiness",
          "weight": 4
        }
      ],
      "patterns": [
        {
          "key": "jump",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 3
        },
        {
          "key": "balance",
          "weight": 2
        },
        {
          "key": "brace",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "cones",
          "weight": 5
        }
      ],
      "bodyRegions": [
        {
          "key": "foot",
          "weight": 5
        },
        {
          "key": "ankle",
          "weight": 3
        },
        {
          "key": "knee",
          "weight": 2
        },
        {
          "key": "hip",
          "weight": 2
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "selectionReason": "High-specificity unilateral elastic drill for athletes who already tolerate single-leg hops and bounds.",
      "whyItWorks": "Single-Leg Rebound Hop works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Output / elastic_stiffness_plyometric_rudiments because the intended adaptation is high-quality force, speed, stiffness, projection, or elastic expression while fresh. Volume stays low and recovery stays long enough that every attempt remains sharp.",
      "commonMisuse": "Do not turn Single-Leg Rebound Hop into a conditioning station, contact-count challenge, or fatigue finisher. The set ends when speed, distance, stiffness, posture, landing quality, or intent drops.",
      "movementRequirements": {
        "primaryJointActions": [
          "single_leg_rebound",
          "short_ground_contact",
          "pelvis_control"
        ],
        "primaryTissues": [
          "achilles_tendon",
          "calves",
          "glutes",
          "hamstrings"
        ],
        "coordinationDemand": "high",
        "balanceDemand": "high",
        "landingOrImpact": {
          "impactLevel": 5,
          "landingQualityRequired": true,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Single-Leg Rebound Hop as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Mark a straight lane or contact zone for Single-Leg Rebound Hop; keep the surface flat, dry, and forgiving.",
          "Review the athlete's lower-level pogo, hop, or landing progression first.",
          "Use small contact volumes and full recovery so elastic quality is obvious."
        ],
        "executionSteps": [
          "Start with posture tall and the first contact planned.",
          "Project through the ground while keeping contacts stiff, quick, and directional.",
          "Use the arms to match rhythm and avoid overstriding or reaching.",
          "Finish with a controlled landing or run-out and stop if rhythm breaks."
        ],
        "coachCues": [
          "Push the ground away",
          "Project out, not up only",
          "Land quiet",
          "Hold posture through the hips",
          "Reset before the next attempt"
        ],
        "commonFaults": [
          "Reaching the landing leg far ahead instead of projecting the hips",
          "Collapsing knee or arch on contact",
          "Loud landings",
          "Turning the drill into a race",
          "Losing rhythm after the first contact"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "contacts",
        "defaultSets": 3,
        "defaultReps": 6,
        "defaultWorkSeconds": 12,
        "defaultRestSeconds": 150,
        "estSecondsPerSet": 165,
        "defaultRpeMin": 7,
        "defaultRpeMax": 9,
        "notes": "Keep volume capped; elastic quality and posture must match the first contact."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Single-Leg Rebound Hop. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "horizontal_power",
          "jump_power",
          "landing_prep",
          "long_jump_prep",
          "sprint_prep"
        ]
      },
      "safety": {
        "riskLevel": 5,
        "impactLevel": 5,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern.",
          "Athlete can demonstrate a quiet lower-level landing or contact progression before this drill.",
          "Surface, footwear, spacing, and recovery allow high-quality contacts.",
          "Athlete is fresh enough that speed, distance, stiffness, and coordination can be expressed without fatigue leakage."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Broad Jump to Stick",
          "Low-amplitude pogo",
          "Medicine Ball Scoop Toss",
          "Step-Up to Knee Drive"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 1,
        "minimumHoursBetweenHardExposures": 72,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": true,
        "countsAsNeural": true,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 4,
          "fatigueSensitivity": 5,
          "technicalComplexity": 4,
          "intensityCeiling": "high",
          "impactLevel": 5
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    },
    {
      "id": 39,
      "slug": "hop-step-jump-phase-series",
      "name": "Hop-Step-Jump Phase Series",
      "family": "Triple-jump phase control",
      "category": "31-40 - Bounds, hops, and triple-jump elasticity",
      "phaseKey": "output",
      "primaryPhaseKey": "output",
      "subrole": "elastic_stiffness_plyometric_rudiments",
      "subroleSecondary": "triple_jump_phase_control",
      "slot": "hop_step_jump_phase_series",
      "cardSummary": "Hop-Step-Jump Phase Series is a Output drill for jumping athletes who need more horizontal distance. Specific phase-sequence drill for jumpers who need controlled distance across hop, step, and jump contacts.",
      "bestPlacement": "Use early in the session after Prepare & Access and any required Movement Intelligence work, before heavy strength or conditioning. Keep volume low and rest long enough for every attempt to stay sharp.",
      "description": "Hop-Step-Jump Phase Series addresses distance-jumping performance by targeting specific phase-sequence drill for jumpers who need controlled distance across hop, step, and jump contacts. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: elastic_stiffness_plyometric_rudiments. Coach Hop-Step-Jump Phase Series for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Output intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "explosiveness",
          "weight": 5
        },
        {
          "key": "speed",
          "weight": 4
        },
        {
          "key": "coordination",
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "elastic_energy",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
        },
        {
          "key": "neural_output_readiness",
          "weight": 4
        }
      ],
      "patterns": [
        {
          "key": "jump",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 3
        },
        {
          "key": "locomote",
          "weight": 2
        },
        {
          "key": "brace",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "cones",
          "weight": 5
        },
        {
          "key": "jump_pit",
          "weight": 3
        }
      ],
      "bodyRegions": [
        {
          "key": "foot",
          "weight": 5
        },
        {
          "key": "ankle",
          "weight": 3
        },
        {
          "key": "knee",
          "weight": 2
        },
        {
          "key": "hip",
          "weight": 2
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "selectionReason": "Specific phase-sequence drill for jumpers who need controlled distance across hop, step, and jump contacts.",
      "whyItWorks": "Hop-Step-Jump Phase Series works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Output / elastic_stiffness_plyometric_rudiments because the intended adaptation is high-quality force, speed, stiffness, projection, or elastic expression while fresh. Volume stays low and recovery stays long enough that every attempt remains sharp.",
      "commonMisuse": "Do not turn Hop-Step-Jump Phase Series into a conditioning station, contact-count challenge, or fatigue finisher. The set ends when speed, distance, stiffness, posture, landing quality, or intent drops.",
      "movementRequirements": {
        "primaryJointActions": [
          "hop_step_jump_sequence",
          "phase_rhythm",
          "landing_control"
        ],
        "primaryTissues": [
          "achilles_tendon",
          "calves",
          "glutes",
          "hamstrings",
          "quadriceps"
        ],
        "coordinationDemand": "high",
        "balanceDemand": "low_to_moderate",
        "landingOrImpact": {
          "impactLevel": 5,
          "landingQualityRequired": true,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Hop-Step-Jump Phase Series as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Mark a straight lane or contact zone for Hop-Step-Jump Phase Series; keep the surface flat, dry, and forgiving.",
          "Review the athlete's lower-level pogo, hop, or landing progression first.",
          "Use small contact volumes and full recovery so elastic quality is obvious."
        ],
        "executionSteps": [
          "Start with posture tall and the first contact planned.",
          "Project through the ground while keeping contacts stiff, quick, and directional.",
          "Use the arms to match rhythm and avoid overstriding or reaching.",
          "Finish with a controlled landing or run-out and stop if rhythm breaks."
        ],
        "coachCues": [
          "Push the ground away",
          "Project out, not up only",
          "Land quiet",
          "Hold posture through the hips",
          "Reset before the next attempt"
        ],
        "commonFaults": [
          "Reaching the landing leg far ahead instead of projecting the hips",
          "Collapsing knee or arch on contact",
          "Loud landings",
          "Turning the drill into a race",
          "Losing rhythm after the first contact"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "contacts",
        "defaultSets": 3,
        "defaultReps": 6,
        "defaultWorkSeconds": 12,
        "defaultRestSeconds": 150,
        "estSecondsPerSet": 165,
        "defaultRpeMin": 7,
        "defaultRpeMax": 9,
        "notes": "Keep volume capped; elastic quality and posture must match the first contact."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Hop-Step-Jump Phase Series. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "horizontal_power",
          "jump_power",
          "landing_prep",
          "long_jump_prep",
          "sprint_prep"
        ]
      },
      "safety": {
        "riskLevel": 5,
        "impactLevel": 5,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern.",
          "Athlete can demonstrate a quiet lower-level landing or contact progression before this drill.",
          "Surface, footwear, spacing, and recovery allow high-quality contacts.",
          "Athlete is fresh enough that speed, distance, stiffness, and coordination can be expressed without fatigue leakage."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Broad Jump to Stick",
          "Low-amplitude pogo",
          "Medicine Ball Scoop Toss",
          "Step-Up to Knee Drive"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 1,
        "minimumHoursBetweenHardExposures": 72,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": true,
        "countsAsNeural": true,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 4,
          "fatigueSensitivity": 5,
          "technicalComplexity": 4,
          "intensityCeiling": "high",
          "impactLevel": 5
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    },
    {
      "id": 40,
      "slug": "triple-jump-walk-in-bound-series",
      "name": "Triple-Jump Walk-In Bound Series",
      "family": "Walk-in triple-jump rhythm",
      "category": "31-40 - Bounds, hops, and triple-jump elasticity",
      "phaseKey": "output",
      "primaryPhaseKey": "output",
      "subrole": "elastic_stiffness_plyometric_rudiments",
      "subroleSecondary": "triple_jump_phase_control",
      "slot": "triple_jump_walk_in_bound_series",
      "cardSummary": "Triple-Jump Walk-In Bound Series is a Output drill for jumping athletes who need more horizontal distance. Uses a controlled walk-in to rehearse triple-jump phase rhythm before faster approach speeds.",
      "bestPlacement": "Use early in the session after Prepare & Access and any required Movement Intelligence work, before heavy strength or conditioning. Keep volume low and rest long enough for every attempt to stay sharp.",
      "description": "Triple-Jump Walk-In Bound Series addresses distance-jumping performance by targeting uses a controlled walk-in to rehearse triple-jump phase rhythm before faster approach speeds. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: elastic_stiffness_plyometric_rudiments. Coach Triple-Jump Walk-In Bound Series for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Output intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "explosiveness",
          "weight": 5
        },
        {
          "key": "speed",
          "weight": 4
        },
        {
          "key": "coordination",
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "elastic_energy",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
        },
        {
          "key": "neural_output_readiness",
          "weight": 4
        }
      ],
      "patterns": [
        {
          "key": "jump",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 3
        },
        {
          "key": "locomote",
          "weight": 2
        },
        {
          "key": "brace",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "cones",
          "weight": 5
        },
        {
          "key": "jump_pit",
          "weight": 3
        }
      ],
      "bodyRegions": [
        {
          "key": "foot",
          "weight": 5
        },
        {
          "key": "ankle",
          "weight": 3
        },
        {
          "key": "knee",
          "weight": 2
        },
        {
          "key": "hip",
          "weight": 2
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "selectionReason": "Uses a controlled walk-in to rehearse triple-jump phase rhythm before faster approach speeds.",
      "whyItWorks": "Triple-Jump Walk-In Bound Series works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Output / elastic_stiffness_plyometric_rudiments because the intended adaptation is high-quality force, speed, stiffness, projection, or elastic expression while fresh. Volume stays low and recovery stays long enough that every attempt remains sharp.",
      "commonMisuse": "Do not turn Triple-Jump Walk-In Bound Series into a conditioning station, contact-count challenge, or fatigue finisher. The set ends when speed, distance, stiffness, posture, landing quality, or intent drops.",
      "movementRequirements": {
        "primaryJointActions": [
          "walk_in_rhythm",
          "phase_projection",
          "phase_control"
        ],
        "primaryTissues": [
          "achilles_tendon",
          "calves",
          "glutes",
          "hamstrings",
          "quadriceps"
        ],
        "coordinationDemand": "high",
        "balanceDemand": "low_to_moderate",
        "landingOrImpact": {
          "impactLevel": 5,
          "landingQualityRequired": true,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Triple-Jump Walk-In Bound Series as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Mark a straight lane or contact zone for Triple-Jump Walk-In Bound Series; keep the surface flat, dry, and forgiving.",
          "Review the athlete's lower-level pogo, hop, or landing progression first.",
          "Use small contact volumes and full recovery so elastic quality is obvious."
        ],
        "executionSteps": [
          "Start with posture tall and the first contact planned.",
          "Project through the ground while keeping contacts stiff, quick, and directional.",
          "Use the arms to match rhythm and avoid overstriding or reaching.",
          "Finish with a controlled landing or run-out and stop if rhythm breaks."
        ],
        "coachCues": [
          "Push the ground away",
          "Project out, not up only",
          "Land quiet",
          "Hold posture through the hips",
          "Reset before the next attempt"
        ],
        "commonFaults": [
          "Reaching the landing leg far ahead instead of projecting the hips",
          "Collapsing knee or arch on contact",
          "Loud landings",
          "Turning the drill into a race",
          "Losing rhythm after the first contact"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "contacts",
        "defaultSets": 3,
        "defaultReps": 6,
        "defaultWorkSeconds": 12,
        "defaultRestSeconds": 150,
        "estSecondsPerSet": 165,
        "defaultRpeMin": 7,
        "defaultRpeMax": 9,
        "notes": "Keep volume capped; elastic quality and posture must match the first contact."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Triple-Jump Walk-In Bound Series. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "horizontal_power",
          "jump_power",
          "landing_prep",
          "long_jump_prep",
          "sprint_prep"
        ]
      },
      "safety": {
        "riskLevel": 5,
        "impactLevel": 5,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern.",
          "Athlete can demonstrate a quiet lower-level landing or contact progression before this drill.",
          "Surface, footwear, spacing, and recovery allow high-quality contacts.",
          "Athlete is fresh enough that speed, distance, stiffness, and coordination can be expressed without fatigue leakage."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Broad Jump to Stick",
          "Low-amplitude pogo",
          "Medicine Ball Scoop Toss",
          "Step-Up to Knee Drive"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 1,
        "minimumHoursBetweenHardExposures": 72,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": true,
        "countsAsNeural": true,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 4,
          "fatigueSensitivity": 5,
          "technicalComplexity": 4,
          "intensityCeiling": "high",
          "impactLevel": 5
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    }
  ]
}
```


---

# Exercise Library Batch 41-50 — Jumping Athletes for Distance

## Source and authoring basis

- Primary source used: exercise_card_details_for_llm.md, the Vortex Card v2 authoring guide. It defines phase-first authoring, canonical phase keys, taxonomy tags using key + weight, publish gates, dosage/scaling/safety fields, regimen, phaseProfile, and the preferred camelCase Authoring JSON shape. Purpose.txt was requested and searched for, but no file literally titled Purpose.txt surfaced in the accessible File Library results for this run; therefore this deliverable is grounded in exercise_card_details_for_llm.md, existing Vortex card conventions, and stable coaching expertise.
- Card v2 authoring shape used in each card: identity fields, `primaryPhaseKey`, `subrole`, `subroleSecondary`, `slot`, taxonomy tags, `movementRequirements`, `coachingExecution`, `dosage`, `scaling`, `pairingLogic`, `safety`, `regimen`, and `phaseProfile`.
- Programming rule: distance-jump outputs are quality-first. Stop when rhythm, stiffness, projection, landing quality, or release speed degrades.

## Category focus

**Strength, tendon, trunk, and throwing support** — Capacity and power-support exercises that build the force, tendon capacity, hamstring/hip reserve, trunk stiffness, and throw-based projection qualities that support long jumping and broad jumping.

## Exercises in this batch

41. **Trap Bar Deadlift** — `capacity` / `hinge_posterior_chain_strength` / `trap_bar_deadlift`
42. **Rear-Foot-Elevated Split Squat** — `capacity` / `squat_knee_dominant_strength` / `rear_foot_elevated_split_squat`
43. **Step-Up to Knee Drive** — `capacity` / `squat_knee_dominant_strength` / `step_up_to_knee_drive`
44. **Single-Leg Romanian Deadlift** — `capacity` / `hinge_posterior_chain_strength` / `single_leg_romanian_deadlift`
45. **Hip Thrust** — `capacity` / `hinge_posterior_chain_strength` / `hip_thrust`
46. **Standing Calf Raise** — `capacity` / `lower_leg_tissue_capacity` / `standing_calf_raise`
47. **Bent-Knee Soleus Raise** — `capacity` / `lower_leg_tissue_capacity` / `bent_knee_soleus_raise`
48. **Nordic Hamstring Eccentric** — `resilience` / `slow_eccentric_isometric_joint_resilience` / `nordic_hamstring_eccentric`
49. **Medicine Ball Scoop Toss** — `output` / `jump_throw_explosive_power` / `medicine_ball_scoop_toss`
50. **Medicine Ball Overhead Back Throw** — `output` / `jump_throw_explosive_power` / `medicine_ball_overhead_back_throw`

## Cursor-ready JSON

```json
{
  "cluster": {
    "title": "Jumping Athletes for Distance Exercise Cards 41-50",
    "focus": "jumping_athletes_for_distance",
    "batch": "41-50",
    "category": "Strength, tendon, trunk, and throwing support",
    "categoryFocus": "Capacity and power-support exercises that build the force, tendon capacity, hamstring/hip reserve, trunk stiffness, and throw-based projection qualities that support long jumping and broad jumping.",
    "cardCount": 10,
    "sourceBasis": "Primary source used: exercise_card_details_for_llm.md, the Vortex Card v2 authoring guide. It defines phase-first authoring, canonical phase keys, taxonomy tags using key + weight, publish gates, dosage/scaling/safety fields, regimen, phaseProfile, and the preferred camelCase Authoring JSON shape. Purpose.txt was requested and searched for, but no file literally titled Purpose.txt surfaced in the accessible File Library results for this run; therefore this deliverable is grounded in exercise_card_details_for_llm.md, existing Vortex card conventions, and stable coaching expertise.",
    "authoringRule": "Use camelCase Card v2 objects with canonical phase keys, taxonomy key+weight tags, movementRequirements, coachingExecution, dosage, scaling cohorts, safety, regimen, and phaseProfile."
  },
  "cards": [
    {
      "id": 41,
      "slug": "trap-bar-deadlift",
      "name": "Trap Bar Deadlift",
      "family": "Bilateral lower-body force capacity",
      "category": "41-50 - Strength, tendon, trunk, and throwing support",
      "phaseKey": "capacity",
      "primaryPhaseKey": "capacity",
      "subrole": "hinge_posterior_chain_strength",
      "subroleSecondary": "force_capacity_support",
      "slot": "trap_bar_deadlift",
      "cardSummary": "Trap Bar Deadlift is a Capacity drill for jumping athletes who need more horizontal distance. Builds high-force hip and leg extension reserve that supports powerful takeoff without extra jump contacts.",
      "bestPlacement": "Use after high-output jumping/sprinting or on a separate support day when the goal is control, strength, or tissue capacity rather than maximal distance attempts.",
      "description": "Trap Bar Deadlift addresses distance-jumping performance by targeting builds high-force hip and leg extension reserve that supports powerful takeoff without extra jump contacts. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: hinge_posterior_chain_strength. Coach Trap Bar Deadlift for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Capacity intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "strength",
          "weight": 5
        },
        {
          "key": "resilience",
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "strength_training",
          "weight": 5
        }
      ],
      "physiology": [
        {
          "key": "force_capacity",
          "weight": 5
        },
        {
          "key": "tissue_capacity",
          "weight": 4
        },
        {
          "key": "control_stability",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "hinge",
          "weight": 5
        },
        {
          "key": "brace",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "trap_bar",
          "weight": 5
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 3
        },
        {
          "key": "ankle",
          "weight": 2
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "selectionReason": "Builds high-force hip and leg extension reserve that supports powerful takeoff without extra jump contacts.",
      "whyItWorks": "Trap Bar Deadlift works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Capacity / hinge_posterior_chain_strength because the exercise builds force production, local tissue capacity, and structural reserve that supports jumping without adding unnecessary impact contacts.",
      "commonMisuse": "Do not rush Trap Bar Deadlift or load it so heavily that positions, range, or bar path collapse. It supports distance jumping by building force reserve, not by creating exhaustion.",
      "movementRequirements": {
        "primaryJointActions": [
          "hip_extension",
          "knee_extension",
          "trunk_bracing"
        ],
        "primaryTissues": [
          "glutes",
          "hamstrings",
          "quadriceps",
          "spinal_erectors"
        ],
        "coordinationDemand": "moderate",
        "balanceDemand": "low_to_moderate",
        "landingOrImpact": {
          "impactLevel": 1,
          "landingQualityRequired": true,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Trap Bar Deadlift as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Set up the load and support equipment for Trap Bar Deadlift before the athlete begins.",
          "Choose a load or lever that allows full control and no pain.",
          "Confirm the athlete understands the start, finish, and stop criteria."
        ],
        "executionSteps": [
          "Brace before the first rep and own the start position.",
          "Move through the full assigned range without rushing or twisting.",
          "Drive the concentric with intent while keeping the path controlled.",
          "Reset between reps if position changes and stop before technical failure."
        ],
        "coachCues": [
          "Brace first",
          "Full foot pressure",
          "Own the range",
          "Drive without twisting",
          "Stop before form breaks"
        ],
        "commonFaults": [
          "Rushed reps",
          "Loss of brace",
          "Range is shortened to lift more load",
          "Asymmetrical pressure",
          "Pain is ignored"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "reps",
        "defaultSets": 3,
        "defaultReps": 5,
        "defaultWorkSeconds": 30,
        "defaultRestSeconds": 120,
        "estSecondsPerSet": 150,
        "defaultRpeMin": 6,
        "defaultRpeMax": 8,
        "notes": "Use progressive loading with clean reps; this is strength support, not conditioning."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Trap Bar Deadlift. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "control_landing",
          "deceleration",
          "resilience"
        ]
      },
      "safety": {
        "riskLevel": 3,
        "impactLevel": 1,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern.",
          "Load, range, or lever can be controlled without compensatory twisting, collapse, or symptom response."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": false,
        "commonSubstitutions": [
          "Split Squat",
          "Step-Up",
          "Calf Raise",
          "Hip Thrust"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 3,
        "minimumHoursBetweenHardExposures": 24,
        "countsAsHighIntensity": false,
        "countsAsHighImpact": false,
        "countsAsNeural": false,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "capacity",
          "role": "primary",
          "fitWeight": 4,
          "freshnessRequired": false,
          "fatigueCost": 3,
          "fatigueSensitivity": 3,
          "technicalComplexity": 3,
          "intensityCeiling": "moderate_heavy",
          "impactLevel": 1
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    },
    {
      "id": 42,
      "slug": "rear-foot-elevated-split-squat",
      "name": "Rear-Foot-Elevated Split Squat",
      "family": "Unilateral squat strength",
      "category": "41-50 - Strength, tendon, trunk, and throwing support",
      "phaseKey": "capacity",
      "primaryPhaseKey": "capacity",
      "subrole": "squat_knee_dominant_strength",
      "subroleSecondary": "single_leg_force_capacity",
      "slot": "rear_foot_elevated_split_squat",
      "cardSummary": "Rear-Foot-Elevated Split Squat is a Capacity drill for jumping athletes who need more horizontal distance. Builds unilateral force and hip-knee-foot control for takeoff and landing resilience.",
      "bestPlacement": "Use after high-output jumping/sprinting or on a separate support day when the goal is control, strength, or tissue capacity rather than maximal distance attempts.",
      "description": "Rear-Foot-Elevated Split Squat addresses distance-jumping performance by targeting builds unilateral force and hip-knee-foot control for takeoff and landing resilience. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: squat_knee_dominant_strength. Coach Rear-Foot-Elevated Split Squat for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Capacity intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "strength",
          "weight": 5
        },
        {
          "key": "resilience",
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "strength_training",
          "weight": 5
        }
      ],
      "physiology": [
        {
          "key": "force_capacity",
          "weight": 5
        },
        {
          "key": "tissue_capacity",
          "weight": 4
        },
        {
          "key": "control_stability",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "squat",
          "weight": 5
        },
        {
          "key": "brace",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "bench",
          "weight": 5
        },
        {
          "key": "dumbbells",
          "weight": 3
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 3
        },
        {
          "key": "ankle",
          "weight": 2
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "selectionReason": "Builds unilateral force and hip-knee-foot control for takeoff and landing resilience.",
      "whyItWorks": "Rear-Foot-Elevated Split Squat works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Capacity / squat_knee_dominant_strength because the exercise builds force production, local tissue capacity, and structural reserve that supports jumping without adding unnecessary impact contacts.",
      "commonMisuse": "Do not rush Rear-Foot-Elevated Split Squat or load it so heavily that positions, range, or bar path collapse. It supports distance jumping by building force reserve, not by creating exhaustion.",
      "movementRequirements": {
        "primaryJointActions": [
          "single_leg_squat",
          "hip_knee_control",
          "trunk_bracing"
        ],
        "primaryTissues": [
          "quadriceps",
          "glutes",
          "adductors",
          "calves"
        ],
        "coordinationDemand": "moderate",
        "balanceDemand": "low_to_moderate",
        "landingOrImpact": {
          "impactLevel": 1,
          "landingQualityRequired": true,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Rear-Foot-Elevated Split Squat as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Set up the load and support equipment for Rear-Foot-Elevated Split Squat before the athlete begins.",
          "Choose a load or lever that allows full control and no pain.",
          "Confirm the athlete understands the start, finish, and stop criteria."
        ],
        "executionSteps": [
          "Brace before the first rep and own the start position.",
          "Move through the full assigned range without rushing or twisting.",
          "Drive the concentric with intent while keeping the path controlled.",
          "Reset between reps if position changes and stop before technical failure."
        ],
        "coachCues": [
          "Brace first",
          "Full foot pressure",
          "Own the range",
          "Drive without twisting",
          "Stop before form breaks"
        ],
        "commonFaults": [
          "Rushed reps",
          "Loss of brace",
          "Range is shortened to lift more load",
          "Asymmetrical pressure",
          "Pain is ignored"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "reps",
        "defaultSets": 3,
        "defaultReps": 5,
        "defaultWorkSeconds": 30,
        "defaultRestSeconds": 120,
        "estSecondsPerSet": 150,
        "defaultRpeMin": 6,
        "defaultRpeMax": 8,
        "notes": "Use progressive loading with clean reps; this is strength support, not conditioning."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Rear-Foot-Elevated Split Squat. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "control_landing",
          "deceleration",
          "resilience"
        ]
      },
      "safety": {
        "riskLevel": 3,
        "impactLevel": 1,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern.",
          "Load, range, or lever can be controlled without compensatory twisting, collapse, or symptom response."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": false,
        "commonSubstitutions": [
          "Split Squat",
          "Step-Up",
          "Calf Raise",
          "Hip Thrust"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 3,
        "minimumHoursBetweenHardExposures": 24,
        "countsAsHighIntensity": false,
        "countsAsHighImpact": false,
        "countsAsNeural": false,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "capacity",
          "role": "primary",
          "fitWeight": 4,
          "freshnessRequired": false,
          "fatigueCost": 3,
          "fatigueSensitivity": 3,
          "technicalComplexity": 3,
          "intensityCeiling": "moderate_heavy",
          "impactLevel": 1
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    },
    {
      "id": 43,
      "slug": "step-up-to-knee-drive",
      "name": "Step-Up to Knee Drive",
      "family": "Step-up force and posture",
      "category": "41-50 - Strength, tendon, trunk, and throwing support",
      "phaseKey": "capacity",
      "primaryPhaseKey": "capacity",
      "subrole": "squat_knee_dominant_strength",
      "subroleSecondary": "approach_force_support",
      "slot": "step_up_to_knee_drive",
      "cardSummary": "Step-Up to Knee Drive is a Capacity drill for jumping athletes who need more horizontal distance. Strengthens single-leg drive through a posture that resembles sprint and takeoff positions.",
      "bestPlacement": "Use after high-output jumping/sprinting or on a separate support day when the goal is control, strength, or tissue capacity rather than maximal distance attempts.",
      "description": "Step-Up to Knee Drive addresses distance-jumping performance by targeting strengthens single-leg drive through a posture that resembles sprint and takeoff positions. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: squat_knee_dominant_strength. Coach Step-Up to Knee Drive for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Capacity intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "strength",
          "weight": 5
        },
        {
          "key": "resilience",
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "strength_training",
          "weight": 5
        }
      ],
      "physiology": [
        {
          "key": "force_capacity",
          "weight": 5
        },
        {
          "key": "tissue_capacity",
          "weight": 4
        },
        {
          "key": "control_stability",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "squat",
          "weight": 5
        },
        {
          "key": "locomote",
          "weight": 3
        },
        {
          "key": "brace",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        },
        {
          "key": "dumbbells",
          "weight": 3
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 3
        },
        {
          "key": "ankle",
          "weight": 2
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "selectionReason": "Strengthens single-leg drive through a posture that resembles sprint and takeoff positions.",
      "whyItWorks": "Step-Up to Knee Drive works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Capacity / squat_knee_dominant_strength because the exercise builds force production, local tissue capacity, and structural reserve that supports jumping without adding unnecessary impact contacts.",
      "commonMisuse": "Do not rush Step-Up to Knee Drive or load it so heavily that positions, range, or bar path collapse. It supports distance jumping by building force reserve, not by creating exhaustion.",
      "movementRequirements": {
        "primaryJointActions": [
          "step_drive",
          "hip_extension",
          "pelvis_control"
        ],
        "primaryTissues": [
          "quadriceps",
          "glutes",
          "calves",
          "hip_flexors"
        ],
        "coordinationDemand": "moderate",
        "balanceDemand": "low_to_moderate",
        "landingOrImpact": {
          "impactLevel": 1,
          "landingQualityRequired": true,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Step-Up to Knee Drive as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Set up the load and support equipment for Step-Up to Knee Drive before the athlete begins.",
          "Choose a load or lever that allows full control and no pain.",
          "Confirm the athlete understands the start, finish, and stop criteria."
        ],
        "executionSteps": [
          "Brace before the first rep and own the start position.",
          "Move through the full assigned range without rushing or twisting.",
          "Drive the concentric with intent while keeping the path controlled.",
          "Reset between reps if position changes and stop before technical failure."
        ],
        "coachCues": [
          "Brace first",
          "Full foot pressure",
          "Own the range",
          "Drive without twisting",
          "Stop before form breaks"
        ],
        "commonFaults": [
          "Rushed reps",
          "Loss of brace",
          "Range is shortened to lift more load",
          "Asymmetrical pressure",
          "Pain is ignored"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "reps",
        "defaultSets": 3,
        "defaultReps": 5,
        "defaultWorkSeconds": 30,
        "defaultRestSeconds": 120,
        "estSecondsPerSet": 150,
        "defaultRpeMin": 6,
        "defaultRpeMax": 8,
        "notes": "Use progressive loading with clean reps; this is strength support, not conditioning."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Step-Up to Knee Drive. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "control_landing",
          "deceleration",
          "resilience"
        ]
      },
      "safety": {
        "riskLevel": 3,
        "impactLevel": 1,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern.",
          "Load, range, or lever can be controlled without compensatory twisting, collapse, or symptom response."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": false,
        "commonSubstitutions": [
          "Split Squat",
          "Step-Up",
          "Calf Raise",
          "Hip Thrust"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 3,
        "minimumHoursBetweenHardExposures": 24,
        "countsAsHighIntensity": false,
        "countsAsHighImpact": false,
        "countsAsNeural": false,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "capacity",
          "role": "primary",
          "fitWeight": 4,
          "freshnessRequired": false,
          "fatigueCost": 3,
          "fatigueSensitivity": 3,
          "technicalComplexity": 3,
          "intensityCeiling": "moderate_heavy",
          "impactLevel": 1
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    },
    {
      "id": 44,
      "slug": "single-leg-romanian-deadlift",
      "name": "Single-Leg Romanian Deadlift",
      "family": "Single-leg posterior-chain strength",
      "category": "41-50 - Strength, tendon, trunk, and throwing support",
      "phaseKey": "capacity",
      "primaryPhaseKey": "capacity",
      "subrole": "hinge_posterior_chain_strength",
      "subroleSecondary": "single_leg_posterior_chain",
      "slot": "single_leg_romanian_deadlift",
      "cardSummary": "Single-Leg Romanian Deadlift is a Capacity drill for jumping athletes who need more horizontal distance. Builds posterior-chain strength and pelvis control without adding impact.",
      "bestPlacement": "Use after high-output jumping/sprinting or on a separate support day when the goal is control, strength, or tissue capacity rather than maximal distance attempts.",
      "description": "Single-Leg Romanian Deadlift addresses distance-jumping performance by targeting builds posterior-chain strength and pelvis control without adding impact. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: hinge_posterior_chain_strength. Coach Single-Leg Romanian Deadlift for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Capacity intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "strength",
          "weight": 5
        },
        {
          "key": "resilience",
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "strength_training",
          "weight": 5
        }
      ],
      "physiology": [
        {
          "key": "force_capacity",
          "weight": 5
        },
        {
          "key": "tissue_capacity",
          "weight": 4
        },
        {
          "key": "control_stability",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "hinge",
          "weight": 5
        },
        {
          "key": "balance",
          "weight": 3
        },
        {
          "key": "brace",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "dumbbells",
          "weight": 5
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "hamstring",
          "weight": 3
        },
        {
          "key": "ankle",
          "weight": 2
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "selectionReason": "Builds posterior-chain strength and pelvis control without adding impact.",
      "whyItWorks": "Single-Leg Romanian Deadlift works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Capacity / hinge_posterior_chain_strength because the exercise builds force production, local tissue capacity, and structural reserve that supports jumping without adding unnecessary impact contacts.",
      "commonMisuse": "Do not rush Single-Leg Romanian Deadlift or load it so heavily that positions, range, or bar path collapse. It supports distance jumping by building force reserve, not by creating exhaustion.",
      "movementRequirements": {
        "primaryJointActions": [
          "single_leg_hinge",
          "hip_extension_control",
          "pelvis_control"
        ],
        "primaryTissues": [
          "hamstrings",
          "glutes",
          "adductors",
          "foot_intrinsics"
        ],
        "coordinationDemand": "moderate",
        "balanceDemand": "high",
        "landingOrImpact": {
          "impactLevel": 0,
          "landingQualityRequired": false,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Single-Leg Romanian Deadlift as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Set up the load and support equipment for Single-Leg Romanian Deadlift before the athlete begins.",
          "Choose a load or lever that allows full control and no pain.",
          "Confirm the athlete understands the start, finish, and stop criteria."
        ],
        "executionSteps": [
          "Brace before the first rep and own the start position.",
          "Move through the full assigned range without rushing or twisting.",
          "Drive the concentric with intent while keeping the path controlled.",
          "Reset between reps if position changes and stop before technical failure."
        ],
        "coachCues": [
          "Brace first",
          "Full foot pressure",
          "Own the range",
          "Drive without twisting",
          "Stop before form breaks"
        ],
        "commonFaults": [
          "Rushed reps",
          "Loss of brace",
          "Range is shortened to lift more load",
          "Asymmetrical pressure",
          "Pain is ignored"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "reps",
        "defaultSets": 3,
        "defaultReps": 5,
        "defaultWorkSeconds": 30,
        "defaultRestSeconds": 120,
        "estSecondsPerSet": 150,
        "defaultRpeMin": 6,
        "defaultRpeMax": 8,
        "notes": "Use progressive loading with clean reps; this is strength support, not conditioning."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Single-Leg Romanian Deadlift. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "control_landing",
          "deceleration",
          "resilience"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 0,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern.",
          "Load, range, or lever can be controlled without compensatory twisting, collapse, or symptom response."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": false,
        "commonSubstitutions": [
          "Split Squat",
          "Step-Up",
          "Calf Raise",
          "Hip Thrust"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 3,
        "minimumHoursBetweenHardExposures": 24,
        "countsAsHighIntensity": false,
        "countsAsHighImpact": false,
        "countsAsNeural": false,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "capacity",
          "role": "primary",
          "fitWeight": 4,
          "freshnessRequired": false,
          "fatigueCost": 3,
          "fatigueSensitivity": 3,
          "technicalComplexity": 3,
          "intensityCeiling": "moderate_heavy",
          "impactLevel": 0
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    },
    {
      "id": 45,
      "slug": "hip-thrust",
      "name": "Hip Thrust",
      "family": "Hip extension strength",
      "category": "41-50 - Strength, tendon, trunk, and throwing support",
      "phaseKey": "capacity",
      "primaryPhaseKey": "capacity",
      "subrole": "hinge_posterior_chain_strength",
      "subroleSecondary": "hip_extension_force",
      "slot": "hip_thrust",
      "cardSummary": "Hip Thrust is a Capacity drill for jumping athletes who need more horizontal distance. Builds hip extension force that supports projection while sparing landing volume.",
      "bestPlacement": "Use after high-output jumping/sprinting or on a separate support day when the goal is control, strength, or tissue capacity rather than maximal distance attempts.",
      "description": "Hip Thrust addresses distance-jumping performance by targeting builds hip extension force that supports projection while sparing landing volume. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: hinge_posterior_chain_strength. Coach Hip Thrust for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Capacity intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "strength",
          "weight": 5
        },
        {
          "key": "resilience",
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "strength_training",
          "weight": 5
        }
      ],
      "physiology": [
        {
          "key": "force_capacity",
          "weight": 5
        },
        {
          "key": "tissue_capacity",
          "weight": 4
        },
        {
          "key": "control_stability",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "hinge",
          "weight": 5
        },
        {
          "key": "brace",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "barbell",
          "weight": 5
        },
        {
          "key": "bench",
          "weight": 3
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        }
      ],
      "selectionReason": "Builds hip extension force that supports projection while sparing landing volume.",
      "whyItWorks": "Hip Thrust works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Capacity / hinge_posterior_chain_strength because the exercise builds force production, local tissue capacity, and structural reserve that supports jumping without adding unnecessary impact contacts.",
      "commonMisuse": "Do not rush Hip Thrust or load it so heavily that positions, range, or bar path collapse. It supports distance jumping by building force reserve, not by creating exhaustion.",
      "movementRequirements": {
        "primaryJointActions": [
          "hip_extension",
          "posterior_pelvic_control"
        ],
        "primaryTissues": [
          "glutes",
          "hamstrings"
        ],
        "coordinationDemand": "moderate",
        "balanceDemand": "low_to_moderate",
        "landingOrImpact": {
          "impactLevel": 0,
          "landingQualityRequired": false,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Hip Thrust as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Set up the load and support equipment for Hip Thrust before the athlete begins.",
          "Choose a load or lever that allows full control and no pain.",
          "Confirm the athlete understands the start, finish, and stop criteria."
        ],
        "executionSteps": [
          "Brace before the first rep and own the start position.",
          "Move through the full assigned range without rushing or twisting.",
          "Drive the concentric with intent while keeping the path controlled.",
          "Reset between reps if position changes and stop before technical failure."
        ],
        "coachCues": [
          "Brace first",
          "Full foot pressure",
          "Own the range",
          "Drive without twisting",
          "Stop before form breaks"
        ],
        "commonFaults": [
          "Rushed reps",
          "Loss of brace",
          "Range is shortened to lift more load",
          "Asymmetrical pressure",
          "Pain is ignored"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "reps",
        "defaultSets": 3,
        "defaultReps": 5,
        "defaultWorkSeconds": 30,
        "defaultRestSeconds": 120,
        "estSecondsPerSet": 150,
        "defaultRpeMin": 6,
        "defaultRpeMax": 8,
        "notes": "Use progressive loading with clean reps; this is strength support, not conditioning."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Hip Thrust. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "control_landing",
          "deceleration",
          "resilience"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 0,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern.",
          "Load, range, or lever can be controlled without compensatory twisting, collapse, or symptom response."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": false,
        "commonSubstitutions": [
          "Split Squat",
          "Step-Up",
          "Calf Raise",
          "Hip Thrust"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 3,
        "minimumHoursBetweenHardExposures": 24,
        "countsAsHighIntensity": false,
        "countsAsHighImpact": false,
        "countsAsNeural": false,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "capacity",
          "role": "primary",
          "fitWeight": 4,
          "freshnessRequired": false,
          "fatigueCost": 3,
          "fatigueSensitivity": 3,
          "technicalComplexity": 3,
          "intensityCeiling": "moderate_heavy",
          "impactLevel": 0
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    },
    {
      "id": 46,
      "slug": "standing-calf-raise",
      "name": "Standing Calf Raise",
      "family": "Calf and Achilles capacity",
      "category": "41-50 - Strength, tendon, trunk, and throwing support",
      "phaseKey": "capacity",
      "primaryPhaseKey": "capacity",
      "subrole": "lower_leg_tissue_capacity",
      "subroleSecondary": "ankle_force_capacity",
      "slot": "standing_calf_raise",
      "cardSummary": "Standing Calf Raise is a Capacity drill for jumping athletes who need more horizontal distance. Builds calf-Achilles force reserve needed for repeated run-up and takeoff contacts.",
      "bestPlacement": "Use after high-output jumping/sprinting or on a separate support day when the goal is control, strength, or tissue capacity rather than maximal distance attempts.",
      "description": "Standing Calf Raise addresses distance-jumping performance by targeting builds calf-Achilles force reserve needed for repeated run-up and takeoff contacts. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: lower_leg_tissue_capacity. Coach Standing Calf Raise for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Capacity intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "strength",
          "weight": 5
        },
        {
          "key": "resilience",
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "strength_training",
          "weight": 5
        },
        {
          "key": "isometrics",
          "weight": 2
        }
      ],
      "physiology": [
        {
          "key": "force_capacity",
          "weight": 5
        },
        {
          "key": "tissue_capacity",
          "weight": 4
        },
        {
          "key": "control_stability",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "brace",
          "weight": 5
        }
      ],
      "equipment": [
        {
          "key": "machine_or_dumbbells",
          "weight": 5
        }
      ],
      "bodyRegions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "foot",
          "weight": 3
        },
        {
          "key": "calf",
          "weight": 2
        }
      ],
      "selectionReason": "Builds calf-Achilles force reserve needed for repeated run-up and takeoff contacts.",
      "whyItWorks": "Standing Calf Raise works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Capacity / lower_leg_tissue_capacity because the exercise builds force production, local tissue capacity, and structural reserve that supports jumping without adding unnecessary impact contacts.",
      "commonMisuse": "Do not rush Standing Calf Raise or load it so heavily that positions, range, or bar path collapse. It supports distance jumping by building force reserve, not by creating exhaustion.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle_plantarflexion",
          "forefoot_pressure"
        ],
        "primaryTissues": [
          "gastrocnemius",
          "achilles_tendon",
          "foot_intrinsics"
        ],
        "coordinationDemand": "moderate",
        "balanceDemand": "low_to_moderate",
        "landingOrImpact": {
          "impactLevel": 0,
          "landingQualityRequired": false,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Standing Calf Raise as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Set up the load and support equipment for Standing Calf Raise before the athlete begins.",
          "Choose a load or lever that allows full control and no pain.",
          "Confirm the athlete understands the start, finish, and stop criteria."
        ],
        "executionSteps": [
          "Set the joint angle and foot pressure before loading.",
          "Move slowly through the range with even pressure and no bouncing.",
          "Pause where assigned and keep the reps symmetrical.",
          "Stop if symptoms, cramping, or compensation appear."
        ],
        "coachCues": [
          "Brace first",
          "Full foot pressure",
          "Own the range",
          "Drive without twisting",
          "Stop before form breaks"
        ],
        "commonFaults": [
          "Rushed reps",
          "Loss of brace",
          "Range is shortened to lift more load",
          "Asymmetrical pressure",
          "Pain is ignored"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "reps",
        "defaultSets": 3,
        "defaultReps": 10,
        "defaultWorkSeconds": 35,
        "defaultRestSeconds": 75,
        "estSecondsPerSet": 110,
        "defaultRpeMin": 5,
        "defaultRpeMax": 7,
        "notes": "Use controlled tempo and full range without bouncing through symptoms."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Standing Calf Raise. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "control_landing",
          "deceleration",
          "resilience"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 0,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern.",
          "Load, range, or lever can be controlled without compensatory twisting, collapse, or symptom response."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": false,
        "commonSubstitutions": [
          "Split Squat",
          "Step-Up",
          "Calf Raise",
          "Hip Thrust"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 3,
        "minimumHoursBetweenHardExposures": 24,
        "countsAsHighIntensity": false,
        "countsAsHighImpact": false,
        "countsAsNeural": false,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "capacity",
          "role": "primary",
          "fitWeight": 4,
          "freshnessRequired": false,
          "fatigueCost": 3,
          "fatigueSensitivity": 3,
          "technicalComplexity": 3,
          "intensityCeiling": "moderate_heavy",
          "impactLevel": 0
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    },
    {
      "id": 47,
      "slug": "bent-knee-soleus-raise",
      "name": "Bent-Knee Soleus Raise",
      "family": "Soleus and Achilles capacity",
      "category": "41-50 - Strength, tendon, trunk, and throwing support",
      "phaseKey": "capacity",
      "primaryPhaseKey": "capacity",
      "subrole": "lower_leg_tissue_capacity",
      "subroleSecondary": "ankle_force_capacity",
      "slot": "bent_knee_soleus_raise",
      "cardSummary": "Bent-Knee Soleus Raise is a Capacity drill for jumping athletes who need more horizontal distance. Builds soleus capacity for stance support, braking, and elastic takeoff mechanics.",
      "bestPlacement": "Use after high-output jumping/sprinting or on a separate support day when the goal is control, strength, or tissue capacity rather than maximal distance attempts.",
      "description": "Bent-Knee Soleus Raise addresses distance-jumping performance by targeting builds soleus capacity for stance support, braking, and elastic takeoff mechanics. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: lower_leg_tissue_capacity. Coach Bent-Knee Soleus Raise for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Capacity intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "strength",
          "weight": 5
        },
        {
          "key": "resilience",
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "strength_training",
          "weight": 5
        },
        {
          "key": "isometrics",
          "weight": 2
        }
      ],
      "physiology": [
        {
          "key": "force_capacity",
          "weight": 5
        },
        {
          "key": "tissue_capacity",
          "weight": 4
        },
        {
          "key": "control_stability",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "brace",
          "weight": 5
        }
      ],
      "equipment": [
        {
          "key": "machine_or_dumbbells",
          "weight": 5
        }
      ],
      "bodyRegions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "foot",
          "weight": 3
        },
        {
          "key": "calf",
          "weight": 2
        }
      ],
      "selectionReason": "Builds soleus capacity for stance support, braking, and elastic takeoff mechanics.",
      "whyItWorks": "Bent-Knee Soleus Raise works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Capacity / lower_leg_tissue_capacity because the exercise builds force production, local tissue capacity, and structural reserve that supports jumping without adding unnecessary impact contacts.",
      "commonMisuse": "Do not rush Bent-Knee Soleus Raise or load it so heavily that positions, range, or bar path collapse. It supports distance jumping by building force reserve, not by creating exhaustion.",
      "movementRequirements": {
        "primaryJointActions": [
          "bent_knee_plantarflexion",
          "ankle_control"
        ],
        "primaryTissues": [
          "soleus",
          "achilles_tendon"
        ],
        "coordinationDemand": "moderate",
        "balanceDemand": "low_to_moderate",
        "landingOrImpact": {
          "impactLevel": 0,
          "landingQualityRequired": false,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Bent-Knee Soleus Raise as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Set up the load and support equipment for Bent-Knee Soleus Raise before the athlete begins.",
          "Choose a load or lever that allows full control and no pain.",
          "Confirm the athlete understands the start, finish, and stop criteria."
        ],
        "executionSteps": [
          "Set the joint angle and foot pressure before loading.",
          "Move slowly through the range with even pressure and no bouncing.",
          "Pause where assigned and keep the reps symmetrical.",
          "Stop if symptoms, cramping, or compensation appear."
        ],
        "coachCues": [
          "Brace first",
          "Full foot pressure",
          "Own the range",
          "Drive without twisting",
          "Stop before form breaks"
        ],
        "commonFaults": [
          "Rushed reps",
          "Loss of brace",
          "Range is shortened to lift more load",
          "Asymmetrical pressure",
          "Pain is ignored"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "reps",
        "defaultSets": 3,
        "defaultReps": 10,
        "defaultWorkSeconds": 35,
        "defaultRestSeconds": 75,
        "estSecondsPerSet": 110,
        "defaultRpeMin": 5,
        "defaultRpeMax": 7,
        "notes": "Use controlled tempo and full range without bouncing through symptoms."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Bent-Knee Soleus Raise. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "control_landing",
          "deceleration",
          "resilience"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 0,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern.",
          "Load, range, or lever can be controlled without compensatory twisting, collapse, or symptom response."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": false,
        "commonSubstitutions": [
          "Split Squat",
          "Step-Up",
          "Calf Raise",
          "Hip Thrust"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 3,
        "minimumHoursBetweenHardExposures": 24,
        "countsAsHighIntensity": false,
        "countsAsHighImpact": false,
        "countsAsNeural": false,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "capacity",
          "role": "primary",
          "fitWeight": 4,
          "freshnessRequired": false,
          "fatigueCost": 3,
          "fatigueSensitivity": 3,
          "technicalComplexity": 3,
          "intensityCeiling": "moderate_heavy",
          "impactLevel": 0
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    },
    {
      "id": 48,
      "slug": "nordic-hamstring-eccentric",
      "name": "Nordic Hamstring Eccentric",
      "family": "Hamstring eccentric capacity",
      "category": "41-50 - Strength, tendon, trunk, and throwing support",
      "phaseKey": "resilience",
      "primaryPhaseKey": "resilience",
      "subrole": "slow_eccentric_isometric_joint_resilience",
      "subroleSecondary": "hamstring_tissue_capacity",
      "slot": "nordic_hamstring_eccentric",
      "cardSummary": "Nordic Hamstring Eccentric is a Resilience drill for jumping athletes who need more horizontal distance. Builds hamstring braking capacity for approach speed and late-swing control without sprint volume.",
      "bestPlacement": "Use after high-output jumping/sprinting or on a separate support day when the goal is control, strength, or tissue capacity rather than maximal distance attempts.",
      "description": "Nordic Hamstring Eccentric addresses distance-jumping performance by targeting builds hamstring braking capacity for approach speed and late-swing control without sprint volume. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: slow_eccentric_isometric_joint_resilience. Coach Nordic Hamstring Eccentric for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Resilience intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "strength",
          "weight": 5
        },
        {
          "key": "resilience",
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "strength_training",
          "weight": 5
        },
        {
          "key": "eccentrics",
          "weight": 5
        }
      ],
      "physiology": [
        {
          "key": "force_capacity",
          "weight": 5
        },
        {
          "key": "tissue_capacity",
          "weight": 4
        },
        {
          "key": "control_stability",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "hinge",
          "weight": 5
        },
        {
          "key": "brace",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "partner_or_anchor",
          "weight": 5
        },
        {
          "key": "pad",
          "weight": 3
        }
      ],
      "bodyRegions": [
        {
          "key": "hamstring",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 3
        },
        {
          "key": "knee",
          "weight": 2
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "selectionReason": "Builds hamstring braking capacity for approach speed and late-swing control without sprint volume.",
      "whyItWorks": "Nordic Hamstring Eccentric works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Resilience / slow_eccentric_isometric_joint_resilience because the intent is controlled landing, braking, eccentric/isometric ownership, and tissue tolerance rather than maximal distance or conditioning.",
      "commonMisuse": "Do not use Nordic Hamstring Eccentric as a max jump or fatigue drill. Keep the emphasis on quiet control, alignment, and tissue tolerance.",
      "movementRequirements": {
        "primaryJointActions": [
          "knee_flexor_eccentric",
          "trunk_bracing"
        ],
        "primaryTissues": [
          "hamstrings",
          "tendons"
        ],
        "coordinationDemand": "moderate",
        "balanceDemand": "moderate",
        "landingOrImpact": {
          "impactLevel": 0,
          "landingQualityRequired": false,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Nordic Hamstring Eccentric as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Set up the load and support equipment for Nordic Hamstring Eccentric before the athlete begins.",
          "Choose a load or lever that allows full control and no pain.",
          "Confirm the athlete understands the start, finish, and stop criteria."
        ],
        "executionSteps": [
          "Set the anchor and brace the trunk before lowering.",
          "Lower slowly through the assigned range while resisting collapse.",
          "Use hands, partner, or assistance to return if needed.",
          "Keep reps few and high quality; soreness is not the goal."
        ],
        "coachCues": [
          "Brace first",
          "Full foot pressure",
          "Own the range",
          "Drive without twisting",
          "Stop before form breaks"
        ],
        "commonFaults": [
          "Rushed reps",
          "Loss of brace",
          "Range is shortened to lift more load",
          "Asymmetrical pressure",
          "Pain is ignored"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "reps",
        "defaultSets": 3,
        "defaultReps": 4,
        "defaultWorkSeconds": 35,
        "defaultRestSeconds": 90,
        "estSecondsPerSet": 125,
        "defaultRpeMin": 5,
        "defaultRpeMax": 7,
        "notes": "Keep eccentric control smooth; avoid soreness-chasing volume before speed or jump days."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Nordic Hamstring Eccentric. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "control_landing",
          "deceleration",
          "resilience"
        ]
      },
      "safety": {
        "riskLevel": 4,
        "impactLevel": 0,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern.",
          "Load, range, or lever can be controlled without compensatory twisting, collapse, or symptom response."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": true,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Split Squat",
          "Step-Up",
          "Calf Raise",
          "Hip Thrust"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 3,
        "minimumHoursBetweenHardExposures": 24,
        "countsAsHighIntensity": false,
        "countsAsHighImpact": false,
        "countsAsNeural": false,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "resilience",
          "role": "primary",
          "fitWeight": 4,
          "freshnessRequired": false,
          "fatigueCost": 2,
          "fatigueSensitivity": 3,
          "technicalComplexity": 3,
          "intensityCeiling": "moderate_control",
          "impactLevel": 0
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    },
    {
      "id": 49,
      "slug": "medicine-ball-scoop-toss",
      "name": "Medicine Ball Scoop Toss",
      "family": "Horizontal medicine-ball projection",
      "category": "41-50 - Strength, tendon, trunk, and throwing support",
      "phaseKey": "output",
      "primaryPhaseKey": "output",
      "subrole": "jump_throw_explosive_power",
      "subroleSecondary": "horizontal_projection_power",
      "slot": "medicine_ball_scoop_toss",
      "cardSummary": "Medicine Ball Scoop Toss is a Output drill for jumping athletes who need more horizontal distance. Lets athletes express horizontal hip projection and trunk stiffness without landing impact.",
      "bestPlacement": "Use early in the session after Prepare & Access and any required Movement Intelligence work, before heavy strength or conditioning. Keep volume low and rest long enough for every attempt to stay sharp.",
      "description": "Medicine Ball Scoop Toss addresses distance-jumping performance by targeting lets athletes express horizontal hip projection and trunk stiffness without landing impact. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Coach Medicine Ball Scoop Toss for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Output intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "explosiveness",
          "weight": 5
        },
        {
          "key": "power",
          "weight": 5
        },
        {
          "key": "coordination",
          "weight": 3
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 5
        },
        {
          "key": "strength_power",
          "weight": 4
        }
      ],
      "physiology": [
        {
          "key": "rate_of_force_development",
          "weight": 5
        },
        {
          "key": "neural_output_readiness",
          "weight": 5
        },
        {
          "key": "ssc_stiffness",
          "weight": 2
        },
        {
          "key": "control_stability",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "throw",
          "weight": 5
        },
        {
          "key": "hinge",
          "weight": 3
        },
        {
          "key": "brace",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall_or_open_space",
          "weight": 3
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "shoulder",
          "weight": 2
        }
      ],
      "selectionReason": "Lets athletes express horizontal hip projection and trunk stiffness without landing impact.",
      "whyItWorks": "Medicine Ball Scoop Toss works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Output / jump_throw_explosive_power because the intended adaptation is high-quality force, speed, stiffness, projection, or elastic expression while fresh. Volume stays low and recovery stays long enough that every attempt remains sharp.",
      "commonMisuse": "Do not turn Medicine Ball Scoop Toss into a conditioning station, contact-count challenge, or fatigue finisher. The set ends when speed, distance, stiffness, posture, landing quality, or intent drops.",
      "movementRequirements": {
        "primaryJointActions": [
          "hip_extension",
          "trunk_rotation_control",
          "throw_release"
        ],
        "primaryTissues": [
          "glutes",
          "hamstrings",
          "core",
          "shoulders"
        ],
        "coordinationDemand": "high",
        "balanceDemand": "low_to_moderate",
        "landingOrImpact": {
          "impactLevel": 0,
          "landingQualityRequired": false,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Medicine Ball Scoop Toss as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Choose a medicine ball the athlete can throw fast without losing posture.",
          "Set a clear throwing lane or wall target and keep bystanders outside the rebound path.",
          "Use full reset between throws so release speed stays high."
        ],
        "executionSteps": [
          "Set posture and load the hips before the throw.",
          "Project the ball with fast hip extension and a clean release path.",
          "Finish balanced without chasing the ball into unsafe space.",
          "Reset fully and repeat only while release speed stays high."
        ],
        "coachCues": [
          "Load the hips",
          "Throw through the ground",
          "Release fast",
          "Finish balanced",
          "Do not chase fatigue"
        ],
        "commonFaults": [
          "Throwing with arms only",
          "Over-arching the back",
          "Losing balance after release",
          "Using a ball too heavy to move fast"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "throws",
        "defaultSets": 3,
        "defaultReps": 4,
        "defaultWorkSeconds": 15,
        "defaultRestSeconds": 75,
        "estSecondsPerSet": 90,
        "defaultRpeMin": 6,
        "defaultRpeMax": 8,
        "notes": "Throw with intent but stop before release speed or posture drops."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Medicine Ball Scoop Toss. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "jump_power",
          "landing_prep",
          "sprint_prep"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 0,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern.",
          "Athlete is fresh enough that speed, distance, stiffness, and coordination can be expressed without fatigue leakage."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": false,
        "commonSubstitutions": [
          "Medicine Ball Chest Pass",
          "Medicine Ball Scoop Toss",
          "Countermovement Jump to Stick"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": false,
        "countsAsNeural": true,
        "countsAsTissueStress": false,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 4,
          "fatigueSensitivity": 5,
          "technicalComplexity": 4,
          "intensityCeiling": "high",
          "impactLevel": 0
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    },
    {
      "id": 50,
      "slug": "medicine-ball-overhead-back-throw",
      "name": "Medicine Ball Overhead Back Throw",
      "family": "Total-body backward projection throw",
      "category": "41-50 - Strength, tendon, trunk, and throwing support",
      "phaseKey": "output",
      "primaryPhaseKey": "output",
      "subrole": "jump_throw_explosive_power",
      "subroleSecondary": "total_body_projection_power",
      "slot": "medicine_ball_overhead_back_throw",
      "cardSummary": "Medicine Ball Overhead Back Throw is a Output drill for jumping athletes who need more horizontal distance. High-value total-body power throw for projecting through the hips and ankles without extra jump landings.",
      "bestPlacement": "Use early in the session after Prepare & Access and any required Movement Intelligence work, before heavy strength or conditioning. Keep volume low and rest long enough for every attempt to stay sharp.",
      "description": "Medicine Ball Overhead Back Throw addresses distance-jumping performance by targeting high-value total-body power throw for projecting through the hips and ankles without extra jump landings. It should be coached with clear quality gates, honest phase placement, and enough recovery to preserve the intended adaptation.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Coach Medicine Ball Overhead Back Throw for distance-jump transfer: projection, stiffness, rhythm, tissue capacity, or landing control according to the drill. Keep the dose aligned with Output intent.",
      "athleteLanguage": "Move with intent, own the position, and make every rep look like the one you want to keep.",
      "tenets": [
        {
          "key": "explosiveness",
          "weight": 5
        },
        {
          "key": "power",
          "weight": 5
        },
        {
          "key": "coordination",
          "weight": 3
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 5
        },
        {
          "key": "strength_power",
          "weight": 4
        }
      ],
      "physiology": [
        {
          "key": "rate_of_force_development",
          "weight": 5
        },
        {
          "key": "neural_output_readiness",
          "weight": 5
        },
        {
          "key": "ssc_stiffness",
          "weight": 2
        },
        {
          "key": "control_stability",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "throw",
          "weight": 5
        },
        {
          "key": "hinge",
          "weight": 3
        },
        {
          "key": "brace",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "open_space",
          "weight": 3
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 3
        },
        {
          "key": "ankle",
          "weight": 2
        },
        {
          "key": "core",
          "weight": 2
        },
        {
          "key": "shoulder",
          "weight": 2
        }
      ],
      "selectionReason": "High-value total-body power throw for projecting through the hips and ankles without extra jump landings.",
      "whyItWorks": "Medicine Ball Overhead Back Throw works because distance jumping depends on usable approach speed, projection angle, elastic stiffness, single-leg force, hip and trunk control, and landing/braking tolerance. This drill isolates one of those constraints without making every session a maximal jump test.",
      "whyItGoesHere": "Belongs in Output / jump_throw_explosive_power because the intended adaptation is high-quality force, speed, stiffness, projection, or elastic expression while fresh. Volume stays low and recovery stays long enough that every attempt remains sharp.",
      "commonMisuse": "Do not turn Medicine Ball Overhead Back Throw into a conditioning station, contact-count challenge, or fatigue finisher. The set ends when speed, distance, stiffness, posture, landing quality, or intent drops.",
      "movementRequirements": {
        "primaryJointActions": [
          "triple_extension",
          "hip_extension",
          "overhead_release"
        ],
        "primaryTissues": [
          "glutes",
          "hamstrings",
          "quadriceps",
          "calves",
          "core",
          "shoulders"
        ],
        "coordinationDemand": "high",
        "balanceDemand": "low_to_moderate",
        "landingOrImpact": {
          "impactLevel": 0,
          "landingQualityRequired": false,
          "surface": "flat non-slip surface; use sand pit only for pit-specific jumping progressions"
        },
        "rangeOfMotion": "Use the largest pain-free range that preserves posture, foot pressure, and alignment.",
        "surfaceAndSpace": "Clear lane with safe stopping and reset space; avoid slick, crowded, or excessively hard surfaces for impact work.",
        "asymmetryWatch": "Watch for side-to-side differences in foot pressure, knee tracking, hip height, trunk rotation, arm timing, and confidence."
      },
      "coachingExecution": {
        "movementDescription": "Perform Medicine Ball Overhead Back Throw as a quality-first distance-jump support drill, emphasizing the specific constraint named in the card summary.",
        "setup": [
          "Choose a medicine ball the athlete can throw fast without losing posture.",
          "Set a clear throwing lane or wall target and keep bystanders outside the rebound path.",
          "Use full reset between throws so release speed stays high."
        ],
        "executionSteps": [
          "Set posture and load the hips before the throw.",
          "Project the ball with fast hip extension and a clean release path.",
          "Finish balanced without chasing the ball into unsafe space.",
          "Reset fully and repeat only while release speed stays high."
        ],
        "coachCues": [
          "Load the hips",
          "Throw through the ground",
          "Release fast",
          "Finish balanced",
          "Do not chase fatigue"
        ],
        "commonFaults": [
          "Throwing with arms only",
          "Over-arching the back",
          "Losing balance after release",
          "Using a ball too heavy to move fast"
        ],
        "breathingCues": [
          "Exhale softly to find ribs before the set.",
          "Do not hold the breath through low-level skill work unless bracing under load requires a brief brace.",
          "Reset breathing between high-intent attempts."
        ],
        "qualityGate": [
          "The athlete can explain the goal of the drill in simple language.",
          "Landing/contact sound, posture, and alignment remain repeatable.",
          "Speed, height, distance, release velocity, or rhythm does not visibly drop across the set."
        ],
        "stopSigns": [
          "Pain, sharp discomfort, loss of confidence, dizziness, or symptom response appears.",
          "Landing becomes loud, uncontrolled, or misaligned for two reps in a row.",
          "The athlete begins racing the drill, guessing, or turning it into conditioning.",
          "Output speed, distance, stiffness, rhythm, or release quality clearly falls."
        ]
      },
      "dosage": {
        "volumeUnit": "throws",
        "defaultSets": 3,
        "defaultReps": 4,
        "defaultWorkSeconds": 15,
        "defaultRestSeconds": 75,
        "estSecondsPerSet": 90,
        "defaultRpeMin": 6,
        "defaultRpeMax": 8,
        "notes": "Throw with intent but stop before release speed or posture drops."
      },
      "scaling": {
        "youth_beginner": "Use the smallest amplitude or simplest version of Medicine Ball Overhead Back Throw. Keep it playful, short, and technically clean; stop before fatigue changes landing, posture, or attention.",
        "youth_intermediate": "Add one variable at a time: distance, approach speed, contact count, range, cue complexity, or load. Keep clear stick/reset rules.",
        "teen": "Place before heavy strength or conditioning when used for speed/power. Cap contacts and progress only when landings, rhythm, and approach positions repeat.",
        "adult_beginner": "Start with controlled range, lower impact, longer rest, and fewer sets. Prioritize confidence, quiet contact, and clean positions over distance.",
        "adult_advanced": "Progress intent, approach speed, amplitude, load, or sport specificity while preserving full recovery and measurable quality standards.",
        "older_adult": "Use low-impact substitutions, supported variations, stable surfaces, longer rest, and lower amplitude. Replace high-impact jumps with step, calf, or med-ball power options when needed.",
        "pregnancy_postpartum": "Use only when cleared and symptom-free. Regress impact, bracing demand, breath-holding, and heavy loading if there is leaking, heaviness, pain, coning, dizziness, or pelvic-floor symptoms.",
        "genderSpecificNotes": "No default gender adjustment. Individualize by training age, tissue history, landing control, pelvic-floor symptoms, footwear, surface, recovery, and current readiness."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Lower-level landing or sprint-mechanics prep"
        ],
        "pairsWellBefore": [
          "Long jump or broad jump technical work",
          "Acceleration or approach work",
          "Lower-body strength or support accessories"
        ],
        "doNotUseWhen": [
          "The athlete has pain with takeoff, landing, sprinting, or the loaded pattern.",
          "The surface, equipment, footwear, or spacing is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "jump_power",
          "landing_prep",
          "sprint_prep"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 0,
        "readinessChecks": [
          "Athlete is pain-free in the relevant takeoff, landing, sprinting, or loading pattern.",
          "Athlete is fresh enough that speed, distance, stiffness, and coordination can be expressed without fatigue leakage."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting the relevant joints or tissues.",
          "Inability to demonstrate the lower-level progression safely.",
          "Recent injury or return-to-play status without coach/clinician clearance for the chosen impact or load."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": false,
        "commonSubstitutions": [
          "Medicine Ball Chest Pass",
          "Medicine Ball Scoop Toss",
          "Countermovement Jump to Stick"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": false,
        "countsAsNeural": true,
        "countsAsTissueStress": false,
        "countsAsConditioning": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 4,
          "fatigueSensitivity": 5,
          "technicalComplexity": 4,
          "intensityCeiling": "high",
          "impactLevel": 0
        }
      ],
      "mediaReferences": [
        "Vortex Exercise Card Authoring Guide: Card v2 phase-first authoring, taxonomy, dosage/scaling/safety, and publish-gate structure.",
        "Internal demo recommended: front and side view to confirm projection, landing, posture, and reset quality."
      ],
      "mediaInternalNotes": [
        "Film high-impact jumps from the front and side when possible.",
        "Keep maximal distance attempts separated from fatigue-based conditioning blocks."
      ]
    }
  ]
}
```


---
