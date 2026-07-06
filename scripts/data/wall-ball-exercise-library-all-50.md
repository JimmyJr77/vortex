# Top 50 Wall Ball Exercise Cards

## Source basis and caveat

Primary source used: exercise_card_details_for_llm.md, the Card v2 authoring guide for Vortex coaching exercise cards. It defines phase-first authoring, canonical phase keys, taxonomy key+weight tags, publish-gate expectations, JSON authoring shape, dosage, scaling cohorts, safety, regimen, and phaseProfile fields. Purpose.txt was requested and searched for by exact filename and related Purpose/Vortex/Athleticism Accelerator language, but it was not located in the accessible File Library results for this run. Therefore, this wall-ball exercise library is grounded in exercise_card_details_for_llm.md, existing Vortex card conventions surfaced in the File Library, and stable coaching expertise.

Use camelCase Card v2 objects with identity fields, primaryPhaseKey/subrole/slot, taxonomy tags, movementRequirements, coachingExecution, dosage, scaling cohorts, pairing logic, safety, regimen, and phaseProfile. For wall-ball drills, distinguish skill learning, fresh power, strength support, controlled resilience, and conditioning instead of tagging every variation as the same thing.

## Category map

- **01-10 - Foundation, Position, and Skill Ownership:** Wall-ball prerequisites that teach front-rack position, squat timing, target awareness, catch mechanics, breathing, and the squat-to-throw rhythm before volume or load is added.
- **11-20 - Power, High-Intent Throwing, and Output Quality:** Low-volume wall-ball and medicine-ball variants that emphasize speed of extension, throw intent, target accuracy, and full recovery rather than conditioning fatigue.
- **21-30 - Rotational, Lateral, and Multiplanar Wall-Ball Variations:** Wall and medicine-ball drills that expand wall-ball transfer into rotation, lateral footwork, lunge patterns, trunk control, and multi-directional catching/throwing.
- **31-40 - Sustained Capacity, Work-Rate, and Repeatability:** Classic wall-ball conditioning formats that train repeatable squat-to-throw output while preserving posture, target accuracy, breathing, and safe catch mechanics under fatigue.
- **41-50 - Support Exercises and Prerequisites for Better Wall Balls:** Medicine-ball strength, catch, bracing, shoulder, trunk, and front-rack support drills that build the positions and tolerance needed for better wall-ball performance.

## Complete Cursor-ready JSON

```json
{
  "library": {
    "title": "Top 50 Wall Ball Exercise Library",
    "focus": "wall_balls",
    "purpose": "Develop athletes who can squat, throw, catch, breathe, and repeat wall-ball work with power, target accuracy, trunk position, safe receiving mechanics, and appropriate phase placement.",
    "cardCount": 50,
    "generatedOn": "2026-07-06",
    "primaryPhaseMix": [
      "capacity",
      "movement_intelligence",
      "output",
      "prepare_and_access",
      "resilience",
      "sustained_capacity"
    ]
  },
  "sourceNotes": {
    "exerciseCardDetailsForLlmMd": {
      "usedFor": [
        "Card v2 authoring workflow and publish requirements",
        "canonical phase keys and subrole/slot logic",
        "taxonomy key + weight tags",
        "movementRequirements, coachingExecution, dosage, scaling, safety, pairing, regimen, and phaseProfile sections",
        "anti-patterns: distinguish skill, power, support strength, resilience, and conditioning instead of over-tagging all wall-ball drills the same way"
      ]
    },
    "purposeTxt": {
      "status": "Requested by the user but not located in accessible File Library searches during this run.",
      "handling": "The deliverable is grounded in exercise_card_details_for_llm.md, existing Vortex exercise-card conventions surfaced in File Library, and stable coaching expertise; it does not pretend Purpose.txt was read."
    },
    "sourceBasis": "Primary source used: exercise_card_details_for_llm.md, the Card v2 authoring guide for Vortex coaching exercise cards. It defines phase-first authoring, canonical phase keys, taxonomy key+weight tags, publish-gate expectations, JSON authoring shape, dosage, scaling cohorts, safety, regimen, and phaseProfile fields. Purpose.txt was requested and searched for by exact filename and related Purpose/Vortex/Athleticism Accelerator language, but it was not located in the accessible File Library results for this run. Therefore, this wall-ball exercise library is grounded in exercise_card_details_for_llm.md, existing Vortex card conventions surfaced in the File Library, and stable coaching expertise."
  },
  "categories": [
    {
      "range": "01-10",
      "title": "Foundation, Position, and Skill Ownership",
      "focus": "Wall-ball prerequisites that teach front-rack position, squat timing, target awareness, catch mechanics, breathing, and the squat-to-throw rhythm before volume or load is added."
    },
    {
      "range": "11-20",
      "title": "Power, High-Intent Throwing, and Output Quality",
      "focus": "Low-volume wall-ball and medicine-ball variants that emphasize speed of extension, throw intent, target accuracy, and full recovery rather than conditioning fatigue."
    },
    {
      "range": "21-30",
      "title": "Rotational, Lateral, and Multiplanar Wall-Ball Variations",
      "focus": "Wall and medicine-ball drills that expand wall-ball transfer into rotation, lateral footwork, lunge patterns, trunk control, and multi-directional catching/throwing."
    },
    {
      "range": "31-40",
      "title": "Sustained Capacity, Work-Rate, and Repeatability",
      "focus": "Classic wall-ball conditioning formats that train repeatable squat-to-throw output while preserving posture, target accuracy, breathing, and safe catch mechanics under fatigue."
    },
    {
      "range": "41-50",
      "title": "Support Exercises and Prerequisites for Better Wall Balls",
      "focus": "Medicine-ball strength, catch, bracing, shoulder, trunk, and front-rack support drills that build the positions and tolerance needed for better wall-ball performance."
    }
  ],
  "authoringRule": "Use camelCase Card v2 objects with identity fields, primaryPhaseKey/subrole/slot, taxonomy tags, movementRequirements, coachingExecution, dosage, scaling cohorts, pairing logic, safety, regimen, and phaseProfile. For wall-ball drills, distinguish skill learning, fresh power, strength support, controlled resilience, and conditioning instead of tagging every variation as the same thing.",
  "cards": [
    {
      "id": 1,
      "slug": "medicine-ball-front-rack-breathing-squat",
      "name": "Medicine Ball Front Rack Breathing Squat",
      "family": "Wall-ball squat access",
      "category": "01-10 - Foundation, Position, and Skill Ownership",
      "primaryPhaseKey": "prepare_and_access",
      "subrole": "activate",
      "subroleSecondary": "breathing_brace",
      "slot": "wall_ball_front_rack_breathing_squat",
      "cardSummary": "Medicine Ball Front Rack Breathing Squat trains front-rack squat access with calm breathing before wall-ball work. It belongs in Prepare And Access when the coach wants foundation, position, and skill ownership without losing wall-ball mechanics.",
      "selectionReason": "Front-rack squat access with calm breathing before wall-ball work.",
      "bestPlacement": "Use early in Prepare & Access before higher-intent wall-ball work.",
      "description": "Hold the medicine ball at the chest, breathe into the brace, and squat through a controlled range without throwing.",
      "coachLanguage": "Primary subrole: activate. Belongs in Prepare & Access because the drill improves readiness, access, activation, or position ownership before higher-intent work without creating meaningful fatigue. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Brace first, then squat.",
      "tenets": [
        {
          "key": "body_control",
          "weight": 5
        },
        {
          "key": "coordination",
          "weight": 3
        },
        {
          "key": "flexibility",
          "weight": 2
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "mobility_flexibility",
          "weight": 2
        },
        {
          "key": "core_body_control",
          "weight": 4
        }
      ],
      "physiology": [
        {
          "key": "neural_output_readiness",
          "weight": 3
        },
        {
          "key": "control_stability",
          "weight": 4
        }
      ],
      "patterns": [
        {
          "key": "squat",
          "weight": 4
        },
        {
          "key": "brace",
          "weight": 4
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "front-rack bracing",
          "front-rack catch",
          "overhead reach",
          "squat",
          "triple extension"
        ],
        "primaryTissues": [
          "anterior core",
          "calves",
          "glutes",
          "quadriceps",
          "shoulders",
          "triceps"
        ],
        "breathingDemand": "low-to-moderate",
        "balanceDemand": "low-to-moderate",
        "coordinationDemand": "moderate",
        "impactLevel": 0
      },
      "whyItWorks": "Medicine Ball Front Rack Breathing Squat improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Prepare & Access because the drill improves readiness, access, activation, or position ownership before higher-intent work without creating meaningful fatigue.",
      "commonMisuse": "Do not add enough volume or load that a readiness drill becomes fatigue work.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "Hold the medicine ball at the chest, breathe into the brace, and squat through a controlled range without throwing.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "Hold the medicine ball at the chest, breathe into the brace, and squat through a controlled range without throwing.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "reps",
        "defaultSets": 2,
        "defaultReps": 6,
        "defaultWorkSeconds": null,
        "defaultRestSeconds": 30,
        "estSecondsPerSet": 30,
        "defaultRpeMin": 2,
        "defaultRpeMax": 3,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable."
      },
      "scaling": {
        "youthBeginner": "Use a light soft medicine ball, lower target, shorter range of motion, and single-rep resets. Coach the catch before adding continuous reps.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use the full version with the intended phase dose: low-volume full-rest work for Output or controlled intervals for Sustained Capacity.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "General temperature raise",
          "Hip and ankle mobility",
          "Front-rack breathing squat"
        ],
        "pairsWellBefore": [
          "Main wall-ball interval",
          "Medicine-ball power block",
          "Strength support block"
        ],
        "avoidPairingWith": [
          "High-fatigue burpee circuits before skill or power work",
          "Max effort sprinting immediately after sloppy wall-ball intervals",
          "Heavy overhead fatigue before shoulder-sensitive athletes throw"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 0,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
        ]
      },
      "regimen": {
        "canBeDaily": true,
        "weeklyMaxFrequency": 5,
        "minimumHoursBetweenHardExposures": 0,
        "countsAsHighIntensity": false,
        "countsAsHighImpact": false,
        "countsAsNeural": true,
        "countsAsTissueStress": false,
        "countsAsConditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": false,
        "fatigueCost": 1,
        "fatigueSensitivity": 2,
        "technicalComplexity": 2,
        "intensityCeiling": "low",
        "impactLevel": 0
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 2,
      "slug": "wall-ball-target-tap",
      "name": "Wall Ball Target Tap",
      "family": "Target and release prep",
      "category": "01-10 - Foundation, Position, and Skill Ownership",
      "primaryPhaseKey": "movement_intelligence",
      "subrole": "shape_position_intelligence",
      "subroleSecondary": "target_awareness",
      "slot": "wall_ball_target_tap",
      "cardSummary": "Wall Ball Target Tap trains target awareness and overhead reach without high force or fatigue. It belongs in Movement Intelligence when the coach wants foundation, position, and skill ownership without losing wall-ball mechanics.",
      "selectionReason": "Target awareness and overhead reach without high force or fatigue.",
      "bestPlacement": "Use after a general warm-up and before heavy strength or conditioning.",
      "description": "Stand at wall-ball distance, extend the ball toward the target, and rehearse release height, eye line, and finish position without a hard throw.",
      "coachLanguage": "Primary subrole: shape_position_intelligence. Belongs in Movement Intelligence because the main adaptation is coordination, timing, target recognition, spacing, and movement quality while the nervous system is fresh. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Show the target early.",
      "tenets": [
        {
          "key": "coordination",
          "weight": 5
        },
        {
          "key": "body_control",
          "weight": 5
        },
        {
          "key": "balance",
          "weight": 2
        },
        {
          "key": "agility",
          "weight": 2
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        },
        {
          "key": "core_body_control",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "perception_action_skill",
          "weight": 4
        },
        {
          "key": "control_stability",
          "weight": 5
        },
        {
          "key": "neural_output_readiness",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "squat",
          "weight": 4
        },
        {
          "key": "brace",
          "weight": 4
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "front-rack catch",
          "overhead reach",
          "squat",
          "triple extension"
        ],
        "primaryTissues": [
          "anterior core",
          "calves",
          "glutes",
          "quadriceps",
          "shoulders",
          "triceps"
        ],
        "breathingDemand": "low-to-moderate",
        "balanceDemand": "low-to-moderate",
        "coordinationDemand": "high",
        "impactLevel": 0
      },
      "whyItWorks": "Wall Ball Target Tap improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Movement Intelligence because the main adaptation is coordination, timing, target recognition, spacing, and movement quality while the nervous system is fresh.",
      "commonMisuse": "Do not rush the progression into heavy balls, high targets, or timed sets before the athlete owns timing and catch mechanics.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "Stand at wall-ball distance, extend the ball toward the target, and rehearse release height, eye line, and finish position without a hard throw.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "Stand at wall-ball distance, extend the ball toward the target, and rehearse release height, eye line, and finish position without a hard throw.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "reps",
        "defaultSets": 2,
        "defaultReps": 8,
        "defaultWorkSeconds": null,
        "defaultRestSeconds": 30,
        "estSecondsPerSet": 40,
        "defaultRpeMin": 2,
        "defaultRpeMax": 4,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable."
      },
      "scaling": {
        "youthBeginner": "Use a light soft medicine ball, lower target, shorter range of motion, and single-rep resets. Coach the catch before adding continuous reps.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use the full version with the intended phase dose: low-volume full-rest work for Output or controlled intervals for Sustained Capacity.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "General temperature raise",
          "Hip and ankle mobility",
          "Front-rack breathing squat"
        ],
        "pairsWellBefore": [
          "Main wall-ball interval",
          "Medicine-ball power block",
          "Strength support block"
        ],
        "avoidPairingWith": [
          "High-fatigue burpee circuits before skill or power work",
          "Max effort sprinting immediately after sloppy wall-ball intervals",
          "Heavy overhead fatigue before shoulder-sensitive athletes throw"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 0,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
        ]
      },
      "regimen": {
        "canBeDaily": true,
        "weeklyMaxFrequency": 4,
        "minimumHoursBetweenHardExposures": 0,
        "countsAsHighIntensity": false,
        "countsAsHighImpact": false,
        "countsAsNeural": true,
        "countsAsTissueStress": false,
        "countsAsConditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": true,
        "fatigueCost": 2,
        "fatigueSensitivity": 4,
        "technicalComplexity": 4,
        "intensityCeiling": "moderate",
        "impactLevel": 0
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 3,
      "slug": "wall-ball-squat-to-press-pattern",
      "name": "Wall Ball Squat-to-Press Pattern",
      "family": "Squat-to-throw patterning",
      "category": "01-10 - Foundation, Position, and Skill Ownership",
      "primaryPhaseKey": "movement_intelligence",
      "subrole": "shape_position_intelligence",
      "subroleSecondary": "squat_throw_timing",
      "slot": "wall_ball_squat_to_press_pattern",
      "cardSummary": "Wall Ball Squat-to-Press Pattern trains pattern squat depth, trunk stack, and finish timing before releasing the ball. It belongs in Movement Intelligence when the coach wants foundation, position, and skill ownership without losing wall-ball mechanics.",
      "selectionReason": "Pattern squat depth, trunk stack, and finish timing before releasing the ball.",
      "bestPlacement": "Use after a general warm-up and before heavy strength or conditioning.",
      "description": "Squat with the ball in the front rack, stand tall, and press to the target line without releasing unless the coach approves the rhythm.",
      "coachLanguage": "Primary subrole: shape_position_intelligence. Belongs in Movement Intelligence because the main adaptation is coordination, timing, target recognition, spacing, and movement quality while the nervous system is fresh. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Legs finish the throw.",
      "tenets": [
        {
          "key": "coordination",
          "weight": 5
        },
        {
          "key": "body_control",
          "weight": 5
        },
        {
          "key": "balance",
          "weight": 2
        },
        {
          "key": "agility",
          "weight": 2
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        },
        {
          "key": "core_body_control",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "perception_action_skill",
          "weight": 4
        },
        {
          "key": "control_stability",
          "weight": 5
        },
        {
          "key": "neural_output_readiness",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "squat",
          "weight": 4
        },
        {
          "key": "brace",
          "weight": 4
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "front-rack catch",
          "overhead reach",
          "squat",
          "triple extension"
        ],
        "primaryTissues": [
          "anterior core",
          "calves",
          "glutes",
          "quadriceps",
          "shoulders",
          "triceps"
        ],
        "breathingDemand": "low-to-moderate",
        "balanceDemand": "low-to-moderate",
        "coordinationDemand": "high",
        "impactLevel": 0
      },
      "whyItWorks": "Wall Ball Squat-to-Press Pattern improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Movement Intelligence because the main adaptation is coordination, timing, target recognition, spacing, and movement quality while the nervous system is fresh.",
      "commonMisuse": "Do not rush the progression into heavy balls, high targets, or timed sets before the athlete owns timing and catch mechanics.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "Squat with the ball in the front rack, stand tall, and press to the target line without releasing unless the coach approves the rhythm.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "Squat with the ball in the front rack, stand tall, and press to the target line without releasing unless the coach approves the rhythm.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "reps",
        "defaultSets": 2,
        "defaultReps": 6,
        "defaultWorkSeconds": null,
        "defaultRestSeconds": 45,
        "estSecondsPerSet": 30,
        "defaultRpeMin": 3,
        "defaultRpeMax": 4,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable."
      },
      "scaling": {
        "youthBeginner": "Use a light soft medicine ball, lower target, shorter range of motion, and single-rep resets. Coach the catch before adding continuous reps.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use the full version with the intended phase dose: low-volume full-rest work for Output or controlled intervals for Sustained Capacity.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "General temperature raise",
          "Hip and ankle mobility",
          "Front-rack breathing squat"
        ],
        "pairsWellBefore": [
          "Main wall-ball interval",
          "Medicine-ball power block",
          "Strength support block"
        ],
        "avoidPairingWith": [
          "High-fatigue burpee circuits before skill or power work",
          "Max effort sprinting immediately after sloppy wall-ball intervals",
          "Heavy overhead fatigue before shoulder-sensitive athletes throw"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 0,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
        ]
      },
      "regimen": {
        "canBeDaily": true,
        "weeklyMaxFrequency": 4,
        "minimumHoursBetweenHardExposures": 0,
        "countsAsHighIntensity": false,
        "countsAsHighImpact": false,
        "countsAsNeural": true,
        "countsAsTissueStress": false,
        "countsAsConditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": true,
        "fatigueCost": 2,
        "fatigueSensitivity": 4,
        "technicalComplexity": 4,
        "intensityCeiling": "moderate",
        "impactLevel": 0
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 4,
      "slug": "wall-ball-catch-and-freeze",
      "name": "Wall Ball Catch-and-Freeze",
      "family": "Catch mechanics and position control",
      "category": "01-10 - Foundation, Position, and Skill Ownership",
      "primaryPhaseKey": "resilience",
      "subrole": "landing_braking_control",
      "subroleSecondary": "catch_bracing",
      "slot": "wall_ball_catch_and_freeze",
      "cardSummary": "Wall Ball Catch-and-Freeze trains teaches receiving the ball softly while freezing the squat-ready posture. It belongs in Resilience when the coach wants foundation, position, and skill ownership without losing wall-ball mechanics.",
      "selectionReason": "Teaches receiving the ball softly while freezing the squat-ready posture.",
      "bestPlacement": "Use in the Capacity/Resilience support block after skill or power work.",
      "description": "Toss the ball to the wall or from a partner and catch it at the chest, then freeze for one count with feet, ribs, and hips organized.",
      "coachLanguage": "Primary subrole: landing_braking_control. Belongs in Resilience because the drill builds controlled receiving, bracing, trunk position, joint ownership, and durable positions rather than speed or conditioning. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Catch soft, freeze tall.",
      "tenets": [
        {
          "key": "body_control",
          "weight": 5
        },
        {
          "key": "balance",
          "weight": 3
        },
        {
          "key": "strength",
          "weight": 2
        },
        {
          "key": "coordination",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "isometrics",
          "weight": 3
        },
        {
          "key": "core_body_control",
          "weight": 5
        },
        {
          "key": "balance_stability",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "control_stability",
          "weight": 5
        },
        {
          "key": "force_tissue_capacity",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "squat",
          "weight": 4
        },
        {
          "key": "brace",
          "weight": 4
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "front-rack catch",
          "overhead reach",
          "squat",
          "triple extension"
        ],
        "primaryTissues": [
          "anterior core",
          "calves",
          "glutes",
          "quadriceps",
          "shoulders",
          "triceps"
        ],
        "breathingDemand": "low-to-moderate",
        "balanceDemand": "low-to-moderate",
        "coordinationDemand": "moderate",
        "impactLevel": 1
      },
      "whyItWorks": "Wall Ball Catch-and-Freeze improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Resilience because the drill builds controlled receiving, bracing, trunk position, joint ownership, and durable positions rather than speed or conditioning.",
      "commonMisuse": "Do not turn controlled holds, catches, or bracing work into speed reps. The value is control under manageable stress.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "Toss the ball to the wall or from a partner and catch it at the chest, then freeze for one count with feet, ribs, and hips organized.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "Toss the ball to the wall or from a partner and catch it at the chest, then freeze for one count with feet, ribs, and hips organized.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "reps",
        "defaultSets": 3,
        "defaultReps": 5,
        "defaultWorkSeconds": null,
        "defaultRestSeconds": 45,
        "estSecondsPerSet": 25,
        "defaultRpeMin": 3,
        "defaultRpeMax": 5,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable."
      },
      "scaling": {
        "youthBeginner": "Use a light soft medicine ball, lower target, shorter range of motion, and single-rep resets. Coach the catch before adding continuous reps.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use the full version with the intended phase dose: low-volume full-rest work for Output or controlled intervals for Sustained Capacity.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "General temperature raise",
          "Hip and ankle mobility",
          "Front-rack breathing squat"
        ],
        "pairsWellBefore": [
          "Main wall-ball interval",
          "Medicine-ball power block",
          "Strength support block"
        ],
        "avoidPairingWith": [
          "High-fatigue burpee circuits before skill or power work",
          "Max effort sprinting immediately after sloppy wall-ball intervals",
          "Heavy overhead fatigue before shoulder-sensitive athletes throw"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 1,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
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
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": false,
        "fatigueCost": 2,
        "fatigueSensitivity": 3,
        "technicalComplexity": 3,
        "intensityCeiling": "moderate",
        "impactLevel": 1
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 5,
      "slug": "half-wall-ball-shot",
      "name": "Half Wall Ball Shot",
      "family": "Low-amplitude wall-ball skill",
      "category": "01-10 - Foundation, Position, and Skill Ownership",
      "primaryPhaseKey": "movement_intelligence",
      "subrole": "shape_position_intelligence",
      "subroleSecondary": "squat_throw_timing",
      "slot": "half_wall_ball_shot",
      "cardSummary": "Half Wall Ball Shot trains reduced-range wall-ball shot for athletes who need rhythm before full depth or full target height. It belongs in Movement Intelligence when the coach wants foundation, position, and skill ownership without losing wall-ball mechanics.",
      "selectionReason": "Reduced-range wall-ball shot for athletes who need rhythm before full depth or full target height.",
      "bestPlacement": "Use after a general warm-up and before heavy strength or conditioning.",
      "description": "Use a partial squat, throw to a lower target, catch cleanly, and reset before the next rep.",
      "coachLanguage": "Primary subrole: shape_position_intelligence. Belongs in Movement Intelligence because the main adaptation is coordination, timing, target recognition, spacing, and movement quality while the nervous system is fresh. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Smooth down, fast up.",
      "tenets": [
        {
          "key": "coordination",
          "weight": 5
        },
        {
          "key": "body_control",
          "weight": 5
        },
        {
          "key": "balance",
          "weight": 2
        },
        {
          "key": "agility",
          "weight": 2
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        },
        {
          "key": "core_body_control",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "perception_action_skill",
          "weight": 4
        },
        {
          "key": "control_stability",
          "weight": 5
        },
        {
          "key": "neural_output_readiness",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "squat",
          "weight": 4
        },
        {
          "key": "brace",
          "weight": 4
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "front-rack catch",
          "overhead reach",
          "squat",
          "triple extension"
        ],
        "primaryTissues": [
          "anterior core",
          "calves",
          "glutes",
          "quadriceps",
          "shoulders",
          "triceps"
        ],
        "breathingDemand": "low-to-moderate",
        "balanceDemand": "low-to-moderate",
        "coordinationDemand": "high",
        "impactLevel": 1
      },
      "whyItWorks": "Half Wall Ball Shot improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Movement Intelligence because the main adaptation is coordination, timing, target recognition, spacing, and movement quality while the nervous system is fresh.",
      "commonMisuse": "Do not rush the progression into heavy balls, high targets, or timed sets before the athlete owns timing and catch mechanics.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "Use a partial squat, throw to a lower target, catch cleanly, and reset before the next rep.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "Use a partial squat, throw to a lower target, catch cleanly, and reset before the next rep.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "reps",
        "defaultSets": 3,
        "defaultReps": 5,
        "defaultWorkSeconds": null,
        "defaultRestSeconds": 45,
        "estSecondsPerSet": 25,
        "defaultRpeMin": 3,
        "defaultRpeMax": 5,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable."
      },
      "scaling": {
        "youthBeginner": "Use a light soft medicine ball, lower target, shorter range of motion, and single-rep resets. Coach the catch before adding continuous reps.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use the full version with the intended phase dose: low-volume full-rest work for Output or controlled intervals for Sustained Capacity.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "General temperature raise",
          "Hip and ankle mobility",
          "Front-rack breathing squat"
        ],
        "pairsWellBefore": [
          "Main wall-ball interval",
          "Medicine-ball power block",
          "Strength support block"
        ],
        "avoidPairingWith": [
          "High-fatigue burpee circuits before skill or power work",
          "Max effort sprinting immediately after sloppy wall-ball intervals",
          "Heavy overhead fatigue before shoulder-sensitive athletes throw"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 1,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
        ]
      },
      "regimen": {
        "canBeDaily": true,
        "weeklyMaxFrequency": 4,
        "minimumHoursBetweenHardExposures": 0,
        "countsAsHighIntensity": false,
        "countsAsHighImpact": false,
        "countsAsNeural": true,
        "countsAsTissueStress": false,
        "countsAsConditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": true,
        "fatigueCost": 2,
        "fatigueSensitivity": 4,
        "technicalComplexity": 4,
        "intensityCeiling": "moderate",
        "impactLevel": 1
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 6,
      "slug": "tempo-wall-ball-shot",
      "name": "Tempo Wall Ball Shot",
      "family": "Wall-ball timing control",
      "category": "01-10 - Foundation, Position, and Skill Ownership",
      "primaryPhaseKey": "movement_intelligence",
      "subrole": "shape_position_intelligence",
      "subroleSecondary": "tempo_control",
      "slot": "tempo_wall_ball_shot",
      "cardSummary": "Tempo Wall Ball Shot trains builds squat control and throw timing with a slower descent and clean finish. It belongs in Movement Intelligence when the coach wants foundation, position, and skill ownership without losing wall-ball mechanics.",
      "selectionReason": "Builds squat control and throw timing with a slower descent and clean finish.",
      "bestPlacement": "Use after a general warm-up and before heavy strength or conditioning.",
      "description": "Descend for a three-count, drive up smoothly, release to the target, and catch without collapsing.",
      "coachLanguage": "Primary subrole: shape_position_intelligence. Belongs in Movement Intelligence because the main adaptation is coordination, timing, target recognition, spacing, and movement quality while the nervous system is fresh. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Control down, snap up.",
      "tenets": [
        {
          "key": "coordination",
          "weight": 5
        },
        {
          "key": "body_control",
          "weight": 5
        },
        {
          "key": "balance",
          "weight": 2
        },
        {
          "key": "agility",
          "weight": 2
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        },
        {
          "key": "core_body_control",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "perception_action_skill",
          "weight": 4
        },
        {
          "key": "control_stability",
          "weight": 5
        },
        {
          "key": "neural_output_readiness",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "squat",
          "weight": 4
        },
        {
          "key": "brace",
          "weight": 4
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "front-rack catch",
          "overhead reach",
          "squat",
          "triple extension"
        ],
        "primaryTissues": [
          "anterior core",
          "calves",
          "glutes",
          "quadriceps",
          "shoulders",
          "triceps"
        ],
        "breathingDemand": "low-to-moderate",
        "balanceDemand": "low-to-moderate",
        "coordinationDemand": "high",
        "impactLevel": 1
      },
      "whyItWorks": "Tempo Wall Ball Shot improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Movement Intelligence because the main adaptation is coordination, timing, target recognition, spacing, and movement quality while the nervous system is fresh.",
      "commonMisuse": "Do not rush the progression into heavy balls, high targets, or timed sets before the athlete owns timing and catch mechanics.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "Descend for a three-count, drive up smoothly, release to the target, and catch without collapsing.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "Descend for a three-count, drive up smoothly, release to the target, and catch without collapsing.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "reps",
        "defaultSets": 3,
        "defaultReps": 5,
        "defaultWorkSeconds": null,
        "defaultRestSeconds": 60,
        "estSecondsPerSet": 25,
        "defaultRpeMin": 4,
        "defaultRpeMax": 5,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable."
      },
      "scaling": {
        "youthBeginner": "Use a light soft medicine ball, lower target, shorter range of motion, and single-rep resets. Coach the catch before adding continuous reps.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use the full version with the intended phase dose: low-volume full-rest work for Output or controlled intervals for Sustained Capacity.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "General temperature raise",
          "Hip and ankle mobility",
          "Front-rack breathing squat"
        ],
        "pairsWellBefore": [
          "Main wall-ball interval",
          "Medicine-ball power block",
          "Strength support block"
        ],
        "avoidPairingWith": [
          "High-fatigue burpee circuits before skill or power work",
          "Max effort sprinting immediately after sloppy wall-ball intervals",
          "Heavy overhead fatigue before shoulder-sensitive athletes throw"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 1,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
        ]
      },
      "regimen": {
        "canBeDaily": true,
        "weeklyMaxFrequency": 4,
        "minimumHoursBetweenHardExposures": 0,
        "countsAsHighIntensity": false,
        "countsAsHighImpact": false,
        "countsAsNeural": true,
        "countsAsTissueStress": false,
        "countsAsConditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": true,
        "fatigueCost": 2,
        "fatigueSensitivity": 4,
        "technicalComplexity": 4,
        "intensityCeiling": "moderate",
        "impactLevel": 1
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 7,
      "slug": "wall-ball-single-rep-reset",
      "name": "Wall Ball Single-Rep Reset",
      "family": "Wall-ball rep quality",
      "category": "01-10 - Foundation, Position, and Skill Ownership",
      "primaryPhaseKey": "output",
      "subrole": "jump_throw_explosive_power",
      "subroleSecondary": "skill_reset",
      "slot": "wall_ball_single_rep_reset",
      "cardSummary": "Wall Ball Single-Rep Reset trains high-quality single reps that reinforce mechanics without conditioning drift. It belongs in Output when the coach wants foundation, position, and skill ownership without losing wall-ball mechanics.",
      "selectionReason": "High-quality single reps that reinforce mechanics without conditioning drift.",
      "bestPlacement": "Use after a general warm-up and before heavy strength or conditioning.",
      "description": "Perform one full wall ball, catch, stand, breathe, and reset completely before the next attempt.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Belongs in Output because the goal is high-intent throwing, power, speed of extension, or short acceleration with low volume and full recovery. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "One perfect rep.",
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
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        },
        {
          "key": "plyometrics",
          "weight": 2
        }
      ],
      "physiology": [
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
          "key": "squat",
          "weight": 4
        },
        {
          "key": "push",
          "weight": 4
        },
        {
          "key": "jump",
          "weight": 3
        },
        {
          "key": "brace",
          "weight": 4
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "front-rack catch",
          "overhead reach",
          "squat",
          "triple extension"
        ],
        "primaryTissues": [
          "anterior core",
          "calves",
          "glutes",
          "quadriceps",
          "shoulders",
          "triceps"
        ],
        "breathingDemand": "moderate",
        "balanceDemand": "low-to-moderate",
        "coordinationDemand": "high",
        "impactLevel": 1
      },
      "whyItWorks": "Wall Ball Single-Rep Reset improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Output because the goal is high-intent throwing, power, speed of extension, or short acceleration with low volume and full recovery.",
      "commonMisuse": "Do not turn this into a high-rep wall-ball workout. Full rest and clean speed are the point.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "Perform one full wall ball, catch, stand, breathe, and reset completely before the next attempt.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "Perform one full wall ball, catch, stand, breathe, and reset completely before the next attempt.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "attempts",
        "defaultSets": 4,
        "defaultReps": null,
        "defaultWorkSeconds": null,
        "defaultRestSeconds": 60,
        "estSecondsPerSet": 15,
        "defaultRpeMin": 5,
        "defaultRpeMax": 7,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable.",
        "defaultAttempts": 3
      },
      "scaling": {
        "youthBeginner": "Use a light soft medicine ball, lower target, shorter range of motion, and single-rep resets. Coach the catch before adding continuous reps.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use low-volume, high-intent attempts with full rest. Progress with speed, accuracy, or target challenge before volume.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "Prepare & Access mobility",
          "Catch-and-freeze rehearsal",
          "Low-target accuracy set"
        ],
        "pairsWellBefore": [
          "Strength work",
          "Sustained Capacity",
          "Sport conditioning"
        ],
        "avoidPairingWith": [
          "Long conditioning blocks before the drill",
          "Heavy shoulder fatigue",
          "High-rep wall balls that reduce throw speed"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 1,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": false,
        "countsAsNeural": true,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": true,
        "fatigueCost": 4,
        "fatigueSensitivity": 5,
        "technicalComplexity": 3,
        "intensityCeiling": "high",
        "impactLevel": 1
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 8,
      "slug": "standard-wall-ball-shot",
      "name": "Standard Wall Ball Shot",
      "family": "Classic wall-ball pattern",
      "category": "01-10 - Foundation, Position, and Skill Ownership",
      "primaryPhaseKey": "sustained_capacity",
      "subrole": "conditioning_intervals",
      "subroleSecondary": "wall_ball_repeatability",
      "slot": "standard_wall_ball_shot",
      "cardSummary": "Standard Wall Ball Shot trains classic squat-to-target throw for repeatable full-body work capacity. It belongs in Sustained Capacity when the coach wants foundation, position, and skill ownership without losing wall-ball mechanics.",
      "selectionReason": "Classic squat-to-target throw for repeatable full-body work capacity.",
      "bestPlacement": "Use late in the session after Prepare & Access, Movement Intelligence, Output, and main Capacity priorities.",
      "description": "Squat below the chosen standard, drive up, throw to the target, receive the ball, and continue only while posture and accuracy remain clean.",
      "coachLanguage": "Primary subrole: conditioning_intervals. Belongs in Sustained Capacity because the intended stress is repeatable wall-ball work under fatigue while maintaining posture, breathing, target accuracy, and safe mechanics. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Squat, throw, catch, breathe.",
      "tenets": [
        {
          "key": "work_capacity",
          "weight": 5
        },
        {
          "key": "strength",
          "weight": 3
        },
        {
          "key": "explosiveness",
          "weight": 3
        },
        {
          "key": "body_control",
          "weight": 4
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "hiit",
          "weight": 5
        },
        {
          "key": "core_body_control",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "energy_systems_repeatability",
          "weight": 5
        },
        {
          "key": "force_tissue_capacity",
          "weight": 3
        },
        {
          "key": "control_stability",
          "weight": 4
        }
      ],
      "patterns": [
        {
          "key": "squat",
          "weight": 5
        },
        {
          "key": "push",
          "weight": 4
        },
        {
          "key": "brace",
          "weight": 4
        },
        {
          "key": "locomote",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "front-rack catch",
          "overhead reach",
          "squat",
          "triple extension"
        ],
        "primaryTissues": [
          "anterior core",
          "calves",
          "glutes",
          "quadriceps",
          "shoulders",
          "triceps"
        ],
        "breathingDemand": "high",
        "balanceDemand": "low-to-moderate",
        "coordinationDemand": "moderate",
        "impactLevel": 1
      },
      "whyItWorks": "Standard Wall Ball Shot improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Sustained Capacity because the intended stress is repeatable wall-ball work under fatigue while maintaining posture, breathing, target accuracy, and safe mechanics.",
      "commonMisuse": "Do not chase exhaustion after mechanics degrade. Missed targets, collapsed catches, and ugly squats are not better conditioning.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "Squat below the chosen standard, drive up, throw to the target, receive the ball, and continue only while posture and accuracy remain clean.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "Squat below the chosen standard, drive up, throw to the target, receive the ball, and continue only while posture and accuracy remain clean.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down.",
          "Use planned breaks before missed targets or collapsed catches appear; repeatability is the goal, not random exhaustion."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "reps",
        "defaultSets": 3,
        "defaultReps": 10,
        "defaultWorkSeconds": null,
        "defaultRestSeconds": 60,
        "estSecondsPerSet": 50,
        "defaultRpeMin": 5,
        "defaultRpeMax": 7,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable."
      },
      "scaling": {
        "youthBeginner": "Do not use fatigue formats first. Use single reps, low targets, and skill sets before any timed conditioning.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use intervals, EMOMs, or density blocks only while target accuracy and catch safety stay above the quality gate.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "Prepare & Access",
          "Movement Intelligence practice",
          "Output/power work",
          "Capacity work"
        ],
        "pairsWellBefore": [
          "Restore cooldown",
          "Breathing reset",
          "Soft tissue or mobility downshift"
        ],
        "avoidPairingWith": [
          "Fresh speed or power after the interval",
          "Skill learning immediately after fatigue",
          "Any block where missed targets become acceptable"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 1,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": false,
        "countsAsNeural": false,
        "countsAsTissueStress": true,
        "countsAsConditioning": true
      },
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": false,
        "fatigueCost": 5,
        "fatigueSensitivity": 4,
        "technicalComplexity": 3,
        "intensityCeiling": "high",
        "impactLevel": 1
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 9,
      "slug": "low-target-wall-ball-accuracy-set",
      "name": "Low-Target Wall Ball Accuracy Set",
      "family": "Wall-ball accuracy regression",
      "category": "01-10 - Foundation, Position, and Skill Ownership",
      "primaryPhaseKey": "movement_intelligence",
      "subrole": "shape_position_intelligence",
      "subroleSecondary": "target_accuracy",
      "slot": "low_target_wall_ball_accuracy_set",
      "cardSummary": "Low-Target Wall Ball Accuracy Set trains low-target wall-ball reps for accuracy, rhythm, and shoulder-friendly mechanics. It belongs in Movement Intelligence when the coach wants foundation, position, and skill ownership without losing wall-ball mechanics.",
      "selectionReason": "Low-target wall-ball reps for accuracy, rhythm, and shoulder-friendly mechanics.",
      "bestPlacement": "Use after a general warm-up and before heavy strength or conditioning.",
      "description": "Throw to a lower target with a lighter ball and count only catches that return to a stable front rack.",
      "coachLanguage": "Primary subrole: shape_position_intelligence. Belongs in Movement Intelligence because the main adaptation is coordination, timing, target recognition, spacing, and movement quality while the nervous system is fresh. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Hit the same spot.",
      "tenets": [
        {
          "key": "coordination",
          "weight": 5
        },
        {
          "key": "body_control",
          "weight": 5
        },
        {
          "key": "balance",
          "weight": 2
        },
        {
          "key": "agility",
          "weight": 2
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        },
        {
          "key": "core_body_control",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "perception_action_skill",
          "weight": 4
        },
        {
          "key": "control_stability",
          "weight": 5
        },
        {
          "key": "neural_output_readiness",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "squat",
          "weight": 4
        },
        {
          "key": "brace",
          "weight": 4
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "front-rack catch",
          "overhead reach",
          "squat",
          "triple extension"
        ],
        "primaryTissues": [
          "anterior core",
          "calves",
          "glutes",
          "quadriceps",
          "shoulders",
          "triceps"
        ],
        "breathingDemand": "low-to-moderate",
        "balanceDemand": "low-to-moderate",
        "coordinationDemand": "high",
        "impactLevel": 1
      },
      "whyItWorks": "Low-Target Wall Ball Accuracy Set improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Movement Intelligence because the main adaptation is coordination, timing, target recognition, spacing, and movement quality while the nervous system is fresh.",
      "commonMisuse": "Do not rush the progression into heavy balls, high targets, or timed sets before the athlete owns timing and catch mechanics.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "Throw to a lower target with a lighter ball and count only catches that return to a stable front rack.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "Throw to a lower target with a lighter ball and count only catches that return to a stable front rack.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "reps",
        "defaultSets": 3,
        "defaultReps": 6,
        "defaultWorkSeconds": null,
        "defaultRestSeconds": 45,
        "estSecondsPerSet": 30,
        "defaultRpeMin": 3,
        "defaultRpeMax": 5,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable."
      },
      "scaling": {
        "youthBeginner": "Use a light soft medicine ball, lower target, shorter range of motion, and single-rep resets. Coach the catch before adding continuous reps.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use the full version with the intended phase dose: low-volume full-rest work for Output or controlled intervals for Sustained Capacity.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "General temperature raise",
          "Hip and ankle mobility",
          "Front-rack breathing squat"
        ],
        "pairsWellBefore": [
          "Main wall-ball interval",
          "Medicine-ball power block",
          "Strength support block"
        ],
        "avoidPairingWith": [
          "High-fatigue burpee circuits before skill or power work",
          "Max effort sprinting immediately after sloppy wall-ball intervals",
          "Heavy overhead fatigue before shoulder-sensitive athletes throw"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 1,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
        ]
      },
      "regimen": {
        "canBeDaily": true,
        "weeklyMaxFrequency": 4,
        "minimumHoursBetweenHardExposures": 0,
        "countsAsHighIntensity": false,
        "countsAsHighImpact": false,
        "countsAsNeural": true,
        "countsAsTissueStress": false,
        "countsAsConditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": true,
        "fatigueCost": 2,
        "fatigueSensitivity": 4,
        "technicalComplexity": 4,
        "intensityCeiling": "moderate",
        "impactLevel": 1
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 10,
      "slug": "wall-ball-step-back-reset-shot",
      "name": "Wall Ball Step-Back Reset Shot",
      "family": "Reset and spacing skill",
      "category": "01-10 - Foundation, Position, and Skill Ownership",
      "primaryPhaseKey": "movement_intelligence",
      "subrole": "shape_position_intelligence",
      "subroleSecondary": "spacing_reset",
      "slot": "wall_ball_step_back_reset_shot",
      "cardSummary": "Wall Ball Step-Back Reset Shot trains adds spacing discipline so the athlete learns to stay in the correct wall-ball lane. It belongs in Movement Intelligence when the coach wants foundation, position, and skill ownership without losing wall-ball mechanics.",
      "selectionReason": "Adds spacing discipline so the athlete learns to stay in the correct wall-ball lane.",
      "bestPlacement": "Use after a general warm-up and before heavy strength or conditioning.",
      "description": "After each catch, step back to the marked line, reset stance, and perform the next wall ball only after position is organized.",
      "coachLanguage": "Primary subrole: shape_position_intelligence. Belongs in Movement Intelligence because the main adaptation is coordination, timing, target recognition, spacing, and movement quality while the nervous system is fresh. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Own your line.",
      "tenets": [
        {
          "key": "coordination",
          "weight": 5
        },
        {
          "key": "body_control",
          "weight": 5
        },
        {
          "key": "balance",
          "weight": 2
        },
        {
          "key": "agility",
          "weight": 2
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        },
        {
          "key": "core_body_control",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "perception_action_skill",
          "weight": 4
        },
        {
          "key": "control_stability",
          "weight": 5
        },
        {
          "key": "neural_output_readiness",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "squat",
          "weight": 4
        },
        {
          "key": "brace",
          "weight": 4
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "front-rack catch",
          "overhead reach",
          "squat",
          "triple extension"
        ],
        "primaryTissues": [
          "anterior core",
          "calves",
          "glutes",
          "quadriceps",
          "shoulders",
          "triceps"
        ],
        "breathingDemand": "low-to-moderate",
        "balanceDemand": "low-to-moderate",
        "coordinationDemand": "high",
        "impactLevel": 1
      },
      "whyItWorks": "Wall Ball Step-Back Reset Shot improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Movement Intelligence because the main adaptation is coordination, timing, target recognition, spacing, and movement quality while the nervous system is fresh.",
      "commonMisuse": "Do not rush the progression into heavy balls, high targets, or timed sets before the athlete owns timing and catch mechanics.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "After each catch, step back to the marked line, reset stance, and perform the next wall ball only after position is organized.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "After each catch, step back to the marked line, reset stance, and perform the next wall ball only after position is organized.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "reps",
        "defaultSets": 3,
        "defaultReps": 5,
        "defaultWorkSeconds": null,
        "defaultRestSeconds": 45,
        "estSecondsPerSet": 25,
        "defaultRpeMin": 3,
        "defaultRpeMax": 5,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable."
      },
      "scaling": {
        "youthBeginner": "Use a light soft medicine ball, lower target, shorter range of motion, and single-rep resets. Coach the catch before adding continuous reps.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use the full version with the intended phase dose: low-volume full-rest work for Output or controlled intervals for Sustained Capacity.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "General temperature raise",
          "Hip and ankle mobility",
          "Front-rack breathing squat"
        ],
        "pairsWellBefore": [
          "Main wall-ball interval",
          "Medicine-ball power block",
          "Strength support block"
        ],
        "avoidPairingWith": [
          "High-fatigue burpee circuits before skill or power work",
          "Max effort sprinting immediately after sloppy wall-ball intervals",
          "Heavy overhead fatigue before shoulder-sensitive athletes throw"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 1,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
        ]
      },
      "regimen": {
        "canBeDaily": true,
        "weeklyMaxFrequency": 4,
        "minimumHoursBetweenHardExposures": 0,
        "countsAsHighIntensity": false,
        "countsAsHighImpact": false,
        "countsAsNeural": true,
        "countsAsTissueStress": false,
        "countsAsConditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": true,
        "fatigueCost": 2,
        "fatigueSensitivity": 4,
        "technicalComplexity": 4,
        "intensityCeiling": "moderate",
        "impactLevel": 1
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 11,
      "slug": "light-fast-wall-ball-shot",
      "name": "Light Fast Wall Ball Shot",
      "family": "Speed-biased wall-ball power",
      "category": "11-20 - Power, High-Intent Throwing, and Output Quality",
      "primaryPhaseKey": "output",
      "subrole": "jump_throw_explosive_power",
      "subroleSecondary": "low_load_speed",
      "slot": "light_fast_wall_ball_shot",
      "cardSummary": "Light Fast Wall Ball Shot trains light-ball throws that train fast extension and target snap while fresh. It belongs in Output when the coach wants power, high-intent throwing, and output quality without losing wall-ball mechanics.",
      "selectionReason": "Light-ball throws that train fast extension and target snap while fresh.",
      "bestPlacement": "Use after a general warm-up and before heavy strength or conditioning.",
      "description": "Use a lighter medicine ball, perform low-rep wall-ball shots, and rest long enough that every throw is fast and accurate.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Belongs in Output because the goal is high-intent throwing, power, speed of extension, or short acceleration with low volume and full recovery. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Fast legs, fast hands.",
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
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        },
        {
          "key": "plyometrics",
          "weight": 2
        }
      ],
      "physiology": [
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
          "key": "squat",
          "weight": 4
        },
        {
          "key": "push",
          "weight": 4
        },
        {
          "key": "jump",
          "weight": 3
        },
        {
          "key": "brace",
          "weight": 4
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "front-rack catch",
          "overhead reach",
          "squat",
          "triple extension"
        ],
        "primaryTissues": [
          "anterior core",
          "calves",
          "glutes",
          "quadriceps",
          "shoulders",
          "triceps"
        ],
        "breathingDemand": "moderate",
        "balanceDemand": "low-to-moderate",
        "coordinationDemand": "high",
        "impactLevel": 1
      },
      "whyItWorks": "Light Fast Wall Ball Shot improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Output because the goal is high-intent throwing, power, speed of extension, or short acceleration with low volume and full recovery.",
      "commonMisuse": "Do not turn this into a high-rep wall-ball workout. Full rest and clean speed are the point.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "Use a lighter medicine ball, perform low-rep wall-ball shots, and rest long enough that every throw is fast and accurate.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "Use a lighter medicine ball, perform low-rep wall-ball shots, and rest long enough that every throw is fast and accurate.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "attempts",
        "defaultSets": 5,
        "defaultReps": null,
        "defaultWorkSeconds": null,
        "defaultRestSeconds": 90,
        "estSecondsPerSet": 15,
        "defaultRpeMin": 6,
        "defaultRpeMax": 8,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable.",
        "defaultAttempts": 3
      },
      "scaling": {
        "youthBeginner": "Use a light soft medicine ball, lower target, shorter range of motion, and single-rep resets. Coach the catch before adding continuous reps.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use low-volume, high-intent attempts with full rest. Progress with speed, accuracy, or target challenge before volume.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "Prepare & Access mobility",
          "Catch-and-freeze rehearsal",
          "Low-target accuracy set"
        ],
        "pairsWellBefore": [
          "Strength work",
          "Sustained Capacity",
          "Sport conditioning"
        ],
        "avoidPairingWith": [
          "Long conditioning blocks before the drill",
          "Heavy shoulder fatigue",
          "High-rep wall balls that reduce throw speed"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 1,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": false,
        "countsAsNeural": true,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": true,
        "fatigueCost": 4,
        "fatigueSensitivity": 5,
        "technicalComplexity": 3,
        "intensityCeiling": "high",
        "impactLevel": 1
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 12,
      "slug": "heavy-wall-ball-power-shot",
      "name": "Heavy Wall Ball Power Shot",
      "family": "Heavy wall-ball power",
      "category": "11-20 - Power, High-Intent Throwing, and Output Quality",
      "primaryPhaseKey": "output",
      "subrole": "jump_throw_explosive_power",
      "subroleSecondary": "heavy_throw_power",
      "slot": "heavy_wall_ball_power_shot",
      "cardSummary": "Heavy Wall Ball Power Shot trains heavier low-rep wall-ball shots for forceful triple extension without high-volume fatigue. It belongs in Output when the coach wants power, high-intent throwing, and output quality without losing wall-ball mechanics.",
      "selectionReason": "Heavier low-rep wall-ball shots for forceful triple extension without high-volume fatigue.",
      "bestPlacement": "Use after a general warm-up and before heavy strength or conditioning.",
      "description": "Use a heavier ball only if catch posture stays safe; perform powerful singles or triples with full reset between reps.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Belongs in Output because the goal is high-intent throwing, power, speed of extension, or short acceleration with low volume and full recovery. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Heavy but clean.",
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
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        },
        {
          "key": "plyometrics",
          "weight": 2
        }
      ],
      "physiology": [
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
          "key": "squat",
          "weight": 4
        },
        {
          "key": "push",
          "weight": 4
        },
        {
          "key": "jump",
          "weight": 3
        },
        {
          "key": "brace",
          "weight": 4
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "front-rack catch",
          "overhead reach",
          "squat",
          "triple extension"
        ],
        "primaryTissues": [
          "anterior core",
          "calves",
          "glutes",
          "quadriceps",
          "shoulders",
          "triceps"
        ],
        "breathingDemand": "moderate",
        "balanceDemand": "low-to-moderate",
        "coordinationDemand": "high",
        "impactLevel": 2
      },
      "whyItWorks": "Heavy Wall Ball Power Shot improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Output because the goal is high-intent throwing, power, speed of extension, or short acceleration with low volume and full recovery.",
      "commonMisuse": "Do not turn this into a high-rep wall-ball workout. Full rest and clean speed are the point.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "Use a heavier ball only if catch posture stays safe; perform powerful singles or triples with full reset between reps.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "Use a heavier ball only if catch posture stays safe; perform powerful singles or triples with full reset between reps.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "attempts",
        "defaultSets": 5,
        "defaultReps": null,
        "defaultWorkSeconds": null,
        "defaultRestSeconds": 120,
        "estSecondsPerSet": 10,
        "defaultRpeMin": 7,
        "defaultRpeMax": 9,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable.",
        "defaultAttempts": 2
      },
      "scaling": {
        "youthBeginner": "Use a light soft medicine ball, lower target, shorter range of motion, and single-rep resets. Coach the catch before adding continuous reps.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use low-volume, high-intent attempts with full rest. Progress with speed, accuracy, or target challenge before volume.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "Prepare & Access mobility",
          "Catch-and-freeze rehearsal",
          "Low-target accuracy set"
        ],
        "pairsWellBefore": [
          "Strength work",
          "Sustained Capacity",
          "Sport conditioning"
        ],
        "avoidPairingWith": [
          "Long conditioning blocks before the drill",
          "Heavy shoulder fatigue",
          "High-rep wall balls that reduce throw speed"
        ]
      },
      "safety": {
        "riskLevel": 3,
        "impactLevel": 2,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": false,
        "countsAsNeural": true,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": true,
        "fatigueCost": 4,
        "fatigueSensitivity": 5,
        "technicalComplexity": 3,
        "intensityCeiling": "high",
        "impactLevel": 2
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 13,
      "slug": "high-target-wall-ball-shot",
      "name": "High-Target Wall Ball Shot",
      "family": "High-target accuracy power",
      "category": "11-20 - Power, High-Intent Throwing, and Output Quality",
      "primaryPhaseKey": "output",
      "subrole": "jump_throw_explosive_power",
      "subroleSecondary": "high_target_power",
      "slot": "high_target_wall_ball_shot",
      "cardSummary": "High-Target Wall Ball Shot trains higher-target shots that challenge vertical force and release accuracy at low volume. It belongs in Output when the coach wants power, high-intent throwing, and output quality without losing wall-ball mechanics.",
      "selectionReason": "Higher-target shots that challenge vertical force and release accuracy at low volume.",
      "bestPlacement": "Use after a general warm-up and before heavy strength or conditioning.",
      "description": "Throw to a higher target with a manageable ball, finish tall, and stop if the athlete throws from the low back or misses repeatedly.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Belongs in Output because the goal is high-intent throwing, power, speed of extension, or short acceleration with low volume and full recovery. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Tall finish to target.",
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
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        },
        {
          "key": "plyometrics",
          "weight": 2
        }
      ],
      "physiology": [
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
          "key": "squat",
          "weight": 4
        },
        {
          "key": "push",
          "weight": 4
        },
        {
          "key": "jump",
          "weight": 3
        },
        {
          "key": "brace",
          "weight": 4
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "front-rack catch",
          "overhead reach",
          "squat",
          "triple extension"
        ],
        "primaryTissues": [
          "anterior core",
          "calves",
          "glutes",
          "quadriceps",
          "shoulders",
          "triceps"
        ],
        "breathingDemand": "moderate",
        "balanceDemand": "low-to-moderate",
        "coordinationDemand": "high",
        "impactLevel": 2
      },
      "whyItWorks": "High-Target Wall Ball Shot improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Output because the goal is high-intent throwing, power, speed of extension, or short acceleration with low volume and full recovery.",
      "commonMisuse": "Do not turn this into a high-rep wall-ball workout. Full rest and clean speed are the point.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "Throw to a higher target with a manageable ball, finish tall, and stop if the athlete throws from the low back or misses repeatedly.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "Throw to a higher target with a manageable ball, finish tall, and stop if the athlete throws from the low back or misses repeatedly.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "attempts",
        "defaultSets": 4,
        "defaultReps": null,
        "defaultWorkSeconds": null,
        "defaultRestSeconds": 90,
        "estSecondsPerSet": 15,
        "defaultRpeMin": 6,
        "defaultRpeMax": 8,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable.",
        "defaultAttempts": 3
      },
      "scaling": {
        "youthBeginner": "Use a light soft medicine ball, lower target, shorter range of motion, and single-rep resets. Coach the catch before adding continuous reps.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use low-volume, high-intent attempts with full rest. Progress with speed, accuracy, or target challenge before volume.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "Prepare & Access mobility",
          "Catch-and-freeze rehearsal",
          "Low-target accuracy set"
        ],
        "pairsWellBefore": [
          "Strength work",
          "Sustained Capacity",
          "Sport conditioning"
        ],
        "avoidPairingWith": [
          "Long conditioning blocks before the drill",
          "Heavy shoulder fatigue",
          "High-rep wall balls that reduce throw speed"
        ]
      },
      "safety": {
        "riskLevel": 3,
        "impactLevel": 2,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": false,
        "countsAsNeural": true,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": true,
        "fatigueCost": 4,
        "fatigueSensitivity": 5,
        "technicalComplexity": 3,
        "intensityCeiling": "high",
        "impactLevel": 2
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 14,
      "slug": "jumping-wall-ball-shot",
      "name": "Jumping Wall Ball Shot",
      "family": "Jump-assisted wall-ball power",
      "category": "11-20 - Power, High-Intent Throwing, and Output Quality",
      "primaryPhaseKey": "output",
      "subrole": "jump_throw_explosive_power",
      "subroleSecondary": "jump_throw_power",
      "slot": "jumping_wall_ball_shot",
      "cardSummary": "Jumping Wall Ball Shot trains wall-ball variation that adds a small jump for explosive hip, knee, and ankle extension. It belongs in Output when the coach wants power, high-intent throwing, and output quality without losing wall-ball mechanics.",
      "selectionReason": "Wall-ball variation that adds a small jump for explosive hip, knee, and ankle extension.",
      "bestPlacement": "Use after a general warm-up and before heavy strength or conditioning.",
      "description": "Dip into a squat, jump as the ball releases, land quietly, and reset before the next attempt.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Belongs in Output because the goal is high-intent throwing, power, speed of extension, or short acceleration with low volume and full recovery. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Jump through the throw.",
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
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        },
        {
          "key": "plyometrics",
          "weight": 2
        }
      ],
      "physiology": [
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
          "key": "squat",
          "weight": 4
        },
        {
          "key": "push",
          "weight": 4
        },
        {
          "key": "jump",
          "weight": 3
        },
        {
          "key": "brace",
          "weight": 4
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "front-rack catch",
          "overhead reach",
          "squat",
          "triple extension"
        ],
        "primaryTissues": [
          "anterior core",
          "calves",
          "glutes",
          "quadriceps",
          "shoulders",
          "triceps"
        ],
        "breathingDemand": "moderate",
        "balanceDemand": "low-to-moderate",
        "coordinationDemand": "high",
        "impactLevel": 3
      },
      "whyItWorks": "Jumping Wall Ball Shot improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Output because the goal is high-intent throwing, power, speed of extension, or short acceleration with low volume and full recovery.",
      "commonMisuse": "Do not turn this into a high-rep wall-ball workout. Full rest and clean speed are the point.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "Dip into a squat, jump as the ball releases, land quietly, and reset before the next attempt.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "Dip into a squat, jump as the ball releases, land quietly, and reset before the next attempt.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "attempts",
        "defaultSets": 4,
        "defaultReps": null,
        "defaultWorkSeconds": null,
        "defaultRestSeconds": 120,
        "estSecondsPerSet": 15,
        "defaultRpeMin": 7,
        "defaultRpeMax": 9,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable.",
        "defaultAttempts": 3
      },
      "scaling": {
        "youthBeginner": "Use a light soft medicine ball, lower target, shorter range of motion, and single-rep resets. Coach the catch before adding continuous reps.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use low-volume, high-intent attempts with full rest. Progress with speed, accuracy, or target challenge before volume.",
        "olderAdult": "Usually remove the jump and use a low-target wall ball or no-release thruster unless impact tolerance is clearly established.",
        "pregnancyPostpartum": "Avoid the jump version. Substitute no-release thrusters, low-target tosses, or front-rack squats if cleared."
      },
      "pairing": {
        "pairsWellAfter": [
          "Prepare & Access mobility",
          "Catch-and-freeze rehearsal",
          "Low-target accuracy set"
        ],
        "pairsWellBefore": [
          "Strength work",
          "Sustained Capacity",
          "Sport conditioning"
        ],
        "avoidPairingWith": [
          "Long conditioning blocks before the drill",
          "Heavy shoulder fatigue",
          "High-rep wall balls that reduce throw speed"
        ]
      },
      "safety": {
        "riskLevel": 3,
        "impactLevel": 3,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
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
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": true,
        "fatigueCost": 4,
        "fatigueSensitivity": 5,
        "technicalComplexity": 3,
        "intensityCeiling": "high",
        "impactLevel": 3
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 15,
      "slug": "dip-drive-wall-ball-pop-throw",
      "name": "Dip-Drive Wall Ball Pop Throw",
      "family": "Upper-body release and leg drive",
      "category": "11-20 - Power, High-Intent Throwing, and Output Quality",
      "primaryPhaseKey": "output",
      "subrole": "jump_throw_explosive_power",
      "subroleSecondary": "dip_drive_throw",
      "slot": "dip_drive_wall_ball_pop_throw",
      "cardSummary": "Dip-Drive Wall Ball Pop Throw trains short dip-drive throw that isolates fast leg drive and release without full squat fatigue. It belongs in Output when the coach wants power, high-intent throwing, and output quality without losing wall-ball mechanics.",
      "selectionReason": "Short dip-drive throw that isolates fast leg drive and release without full squat fatigue.",
      "bestPlacement": "Use after a general warm-up and before heavy strength or conditioning.",
      "description": "Use a quarter-squat dip, drive up, and pop the ball to the target while keeping ribs down and eyes on the target.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Belongs in Output because the goal is high-intent throwing, power, speed of extension, or short acceleration with low volume and full recovery. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Dip, drive, release.",
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
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        },
        {
          "key": "plyometrics",
          "weight": 2
        }
      ],
      "physiology": [
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
          "key": "squat",
          "weight": 4
        },
        {
          "key": "push",
          "weight": 4
        },
        {
          "key": "jump",
          "weight": 3
        },
        {
          "key": "brace",
          "weight": 4
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "front-rack catch",
          "overhead reach",
          "squat",
          "triple extension"
        ],
        "primaryTissues": [
          "anterior core",
          "calves",
          "glutes",
          "quadriceps",
          "shoulders",
          "triceps"
        ],
        "breathingDemand": "moderate",
        "balanceDemand": "low-to-moderate",
        "coordinationDemand": "high",
        "impactLevel": 1
      },
      "whyItWorks": "Dip-Drive Wall Ball Pop Throw improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Output because the goal is high-intent throwing, power, speed of extension, or short acceleration with low volume and full recovery.",
      "commonMisuse": "Do not turn this into a high-rep wall-ball workout. Full rest and clean speed are the point.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "Use a quarter-squat dip, drive up, and pop the ball to the target while keeping ribs down and eyes on the target.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "Use a quarter-squat dip, drive up, and pop the ball to the target while keeping ribs down and eyes on the target.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "attempts",
        "defaultSets": 5,
        "defaultReps": null,
        "defaultWorkSeconds": null,
        "defaultRestSeconds": 75,
        "estSecondsPerSet": 15,
        "defaultRpeMin": 6,
        "defaultRpeMax": 8,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable.",
        "defaultAttempts": 3
      },
      "scaling": {
        "youthBeginner": "Use a light soft medicine ball, lower target, shorter range of motion, and single-rep resets. Coach the catch before adding continuous reps.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use low-volume, high-intent attempts with full rest. Progress with speed, accuracy, or target challenge before volume.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "Prepare & Access mobility",
          "Catch-and-freeze rehearsal",
          "Low-target accuracy set"
        ],
        "pairsWellBefore": [
          "Strength work",
          "Sustained Capacity",
          "Sport conditioning"
        ],
        "avoidPairingWith": [
          "Long conditioning blocks before the drill",
          "Heavy shoulder fatigue",
          "High-rep wall balls that reduce throw speed"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 1,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": false,
        "countsAsNeural": true,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": true,
        "fatigueCost": 4,
        "fatigueSensitivity": 5,
        "technicalComplexity": 3,
        "intensityCeiling": "high",
        "impactLevel": 1
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 16,
      "slug": "wall-ball-shot-put-throw-to-wall",
      "name": "Wall Ball Shot-Put Throw to Wall",
      "family": "Unilateral wall-ball power",
      "category": "11-20 - Power, High-Intent Throwing, and Output Quality",
      "primaryPhaseKey": "output",
      "subrole": "jump_throw_explosive_power",
      "subroleSecondary": "shot_put_power",
      "slot": "wall_ball_shot_put_throw_to_wall",
      "cardSummary": "Wall Ball Shot-Put Throw to Wall trains single-arm shot-put style throw to the wall for chest, trunk, and hip power. It belongs in Output when the coach wants power, high-intent throwing, and output quality without losing wall-ball mechanics.",
      "selectionReason": "Single-arm shot-put style throw to the wall for chest, trunk, and hip power.",
      "bestPlacement": "Use after a general warm-up and before heavy strength or conditioning.",
      "description": "Hold the ball near one shoulder, rotate slightly, push explosively into the wall, and catch or let the ball rebound safely.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Belongs in Output because the goal is high-intent throwing, power, speed of extension, or short acceleration with low volume and full recovery. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Push from the hip.",
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
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        },
        {
          "key": "plyometrics",
          "weight": 2
        }
      ],
      "physiology": [
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
          "key": "push",
          "weight": 5
        },
        {
          "key": "brace",
          "weight": 4
        },
        {
          "key": "rotate",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "shoulder",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "spine",
          "weight": 3
        },
        {
          "key": "hip",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "front-rack catch",
          "hip rotation",
          "overhead reach",
          "squat",
          "triple extension",
          "trunk rotation"
        ],
        "primaryTissues": [
          "anterior core",
          "calves",
          "glutes",
          "obliques",
          "quadriceps",
          "shoulders",
          "thoracic rotators",
          "triceps"
        ],
        "breathingDemand": "moderate",
        "balanceDemand": "low-to-moderate",
        "coordinationDemand": "high",
        "impactLevel": 1
      },
      "whyItWorks": "Wall Ball Shot-Put Throw to Wall improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Output because the goal is high-intent throwing, power, speed of extension, or short acceleration with low volume and full recovery.",
      "commonMisuse": "Do not turn this into a high-rep wall-ball workout. Full rest and clean speed are the point.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "Hold the ball near one shoulder, rotate slightly, push explosively into the wall, and catch or let the ball rebound safely.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "Hold the ball near one shoulder, rotate slightly, push explosively into the wall, and catch or let the ball rebound safely.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "attempts",
        "defaultSets": 4,
        "defaultReps": null,
        "defaultWorkSeconds": null,
        "defaultRestSeconds": 90,
        "estSecondsPerSet": 20,
        "defaultRpeMin": 6,
        "defaultRpeMax": 8,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable.",
        "defaultAttempts": 4
      },
      "scaling": {
        "youthBeginner": "Use a light soft medicine ball, lower target, shorter range of motion, and single-rep resets. Coach the catch before adding continuous reps.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use low-volume, high-intent attempts with full rest. Progress with speed, accuracy, or target challenge before volume.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "Prepare & Access mobility",
          "Catch-and-freeze rehearsal",
          "Low-target accuracy set"
        ],
        "pairsWellBefore": [
          "Strength work",
          "Sustained Capacity",
          "Sport conditioning"
        ],
        "avoidPairingWith": [
          "Long conditioning blocks before the drill",
          "Heavy shoulder fatigue",
          "High-rep wall balls that reduce throw speed"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 1,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": false,
        "countsAsNeural": true,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": true,
        "fatigueCost": 4,
        "fatigueSensitivity": 5,
        "technicalComplexity": 3,
        "intensityCeiling": "high",
        "impactLevel": 1
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 17,
      "slug": "split-stance-wall-ball-power-throw",
      "name": "Split-Stance Wall Ball Power Throw",
      "family": "Split-stance throw power",
      "category": "11-20 - Power, High-Intent Throwing, and Output Quality",
      "primaryPhaseKey": "output",
      "subrole": "jump_throw_explosive_power",
      "subroleSecondary": "split_stance_throw",
      "slot": "split_stance_wall_ball_power_throw",
      "cardSummary": "Split-Stance Wall Ball Power Throw trains power throw from split stance that teaches vertical drive and trunk stiffness without full squat cycling. It belongs in Output when the coach wants power, high-intent throwing, and output quality without losing wall-ball mechanics.",
      "selectionReason": "Power throw from split stance that teaches vertical drive and trunk stiffness without full squat cycling.",
      "bestPlacement": "Use after a general warm-up and before heavy strength or conditioning.",
      "description": "Set a split stance, dip slightly, throw to the wall target, and keep the front knee and pelvis controlled.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Belongs in Output because the goal is high-intent throwing, power, speed of extension, or short acceleration with low volume and full recovery. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Drive from the front foot.",
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
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        },
        {
          "key": "plyometrics",
          "weight": 2
        }
      ],
      "physiology": [
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
          "key": "squat",
          "weight": 4
        },
        {
          "key": "push",
          "weight": 4
        },
        {
          "key": "jump",
          "weight": 3
        },
        {
          "key": "brace",
          "weight": 4
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "front-rack catch",
          "overhead reach",
          "split-stance control",
          "squat",
          "triple extension"
        ],
        "primaryTissues": [
          "anterior core",
          "calves",
          "glutes",
          "hip stabilizers",
          "quadriceps",
          "shoulders",
          "triceps"
        ],
        "breathingDemand": "moderate",
        "balanceDemand": "moderate",
        "coordinationDemand": "high",
        "impactLevel": 1
      },
      "whyItWorks": "Split-Stance Wall Ball Power Throw improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Output because the goal is high-intent throwing, power, speed of extension, or short acceleration with low volume and full recovery.",
      "commonMisuse": "Do not turn this into a high-rep wall-ball workout. Full rest and clean speed are the point.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "Set a split stance, dip slightly, throw to the wall target, and keep the front knee and pelvis controlled.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "Set a split stance, dip slightly, throw to the wall target, and keep the front knee and pelvis controlled.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "attempts",
        "defaultSets": 4,
        "defaultReps": null,
        "defaultWorkSeconds": null,
        "defaultRestSeconds": 90,
        "estSecondsPerSet": 20,
        "defaultRpeMin": 6,
        "defaultRpeMax": 8,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable.",
        "defaultAttempts": 4
      },
      "scaling": {
        "youthBeginner": "Use a light soft medicine ball, lower target, shorter range of motion, and single-rep resets. Coach the catch before adding continuous reps.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use low-volume, high-intent attempts with full rest. Progress with speed, accuracy, or target challenge before volume.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "Prepare & Access mobility",
          "Catch-and-freeze rehearsal",
          "Low-target accuracy set"
        ],
        "pairsWellBefore": [
          "Strength work",
          "Sustained Capacity",
          "Sport conditioning"
        ],
        "avoidPairingWith": [
          "Long conditioning blocks before the drill",
          "Heavy shoulder fatigue",
          "High-rep wall balls that reduce throw speed"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 1,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": false,
        "countsAsNeural": true,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": true,
        "fatigueCost": 4,
        "fatigueSensitivity": 5,
        "technicalComplexity": 3,
        "intensityCeiling": "high",
        "impactLevel": 1
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 18,
      "slug": "wall-ball-cluster-set",
      "name": "Wall Ball Cluster Set",
      "family": "Power repeat cluster",
      "category": "11-20 - Power, High-Intent Throwing, and Output Quality",
      "primaryPhaseKey": "output",
      "subrole": "jump_throw_explosive_power",
      "subroleSecondary": "cluster_power",
      "slot": "wall_ball_cluster_set",
      "cardSummary": "Wall Ball Cluster Set trains small clusters of wall-ball reps with intra-set rest to keep power high. It belongs in Output when the coach wants power, high-intent throwing, and output quality without losing wall-ball mechanics.",
      "selectionReason": "Small clusters of wall-ball reps with intra-set rest to keep power high.",
      "bestPlacement": "Use after a general warm-up and before heavy strength or conditioning.",
      "description": "Perform two to three fast wall balls, rest briefly, and repeat the mini-cluster without letting speed or target accuracy fade.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Belongs in Output because the goal is high-intent throwing, power, speed of extension, or short acceleration with low volume and full recovery. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Keep every rep sharp.",
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
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        },
        {
          "key": "plyometrics",
          "weight": 2
        }
      ],
      "physiology": [
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
          "key": "squat",
          "weight": 4
        },
        {
          "key": "push",
          "weight": 4
        },
        {
          "key": "jump",
          "weight": 3
        },
        {
          "key": "brace",
          "weight": 4
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "front-rack catch",
          "overhead reach",
          "squat",
          "triple extension"
        ],
        "primaryTissues": [
          "anterior core",
          "calves",
          "glutes",
          "quadriceps",
          "shoulders",
          "triceps"
        ],
        "breathingDemand": "moderate",
        "balanceDemand": "low-to-moderate",
        "coordinationDemand": "high",
        "impactLevel": 1
      },
      "whyItWorks": "Wall Ball Cluster Set improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Output because the goal is high-intent throwing, power, speed of extension, or short acceleration with low volume and full recovery.",
      "commonMisuse": "Do not turn this into a high-rep wall-ball workout. Full rest and clean speed are the point.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "Perform two to three fast wall balls, rest briefly, and repeat the mini-cluster without letting speed or target accuracy fade.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "Perform two to three fast wall balls, rest briefly, and repeat the mini-cluster without letting speed or target accuracy fade.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "rounds",
        "defaultSets": 4,
        "defaultReps": null,
        "defaultWorkSeconds": null,
        "defaultRestSeconds": 120,
        "estSecondsPerSet": 60,
        "defaultRpeMin": 6,
        "defaultRpeMax": 8,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable.",
        "defaultRounds": 4
      },
      "scaling": {
        "youthBeginner": "Use a light soft medicine ball, lower target, shorter range of motion, and single-rep resets. Coach the catch before adding continuous reps.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use low-volume, high-intent attempts with full rest. Progress with speed, accuracy, or target challenge before volume.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "Prepare & Access mobility",
          "Catch-and-freeze rehearsal",
          "Low-target accuracy set"
        ],
        "pairsWellBefore": [
          "Strength work",
          "Sustained Capacity",
          "Sport conditioning"
        ],
        "avoidPairingWith": [
          "Long conditioning blocks before the drill",
          "Heavy shoulder fatigue",
          "High-rep wall balls that reduce throw speed"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 1,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": false,
        "countsAsNeural": true,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": true,
        "fatigueCost": 4,
        "fatigueSensitivity": 5,
        "technicalComplexity": 3,
        "intensityCeiling": "high",
        "impactLevel": 1
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 19,
      "slug": "wall-ball-reactive-target-call",
      "name": "Wall Ball Reactive Target Call",
      "family": "Reactive wall-ball targeting",
      "category": "11-20 - Power, High-Intent Throwing, and Output Quality",
      "primaryPhaseKey": "movement_intelligence",
      "subrole": "perception_action_reactive_movement",
      "subroleSecondary": "target_selection",
      "slot": "wall_ball_reactive_target_call",
      "cardSummary": "Wall Ball Reactive Target Call trains cue-based target selection that connects seeing/hearing, throwing accuracy, and reset quality. It belongs in Movement Intelligence when the coach wants power, high-intent throwing, and output quality without losing wall-ball mechanics.",
      "selectionReason": "Cue-based target selection that connects seeing/hearing, throwing accuracy, and reset quality.",
      "bestPlacement": "Use after a general warm-up and before heavy strength or conditioning.",
      "description": "Coach calls high/low or left/right target as the athlete starts the squat; athlete throws only to the called target and resets.",
      "coachLanguage": "Primary subrole: perception_action_reactive_movement. Belongs in Movement Intelligence because the main adaptation is coordination, timing, target recognition, spacing, and movement quality while the nervous system is fresh. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Hear it, hit it.",
      "tenets": [
        {
          "key": "coordination",
          "weight": 5
        },
        {
          "key": "body_control",
          "weight": 5
        },
        {
          "key": "balance",
          "weight": 2
        },
        {
          "key": "agility",
          "weight": 2
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        },
        {
          "key": "core_body_control",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "perception_action_skill",
          "weight": 4
        },
        {
          "key": "control_stability",
          "weight": 5
        },
        {
          "key": "neural_output_readiness",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "squat",
          "weight": 4
        },
        {
          "key": "brace",
          "weight": 4
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "front-rack catch",
          "overhead reach",
          "squat",
          "triple extension"
        ],
        "primaryTissues": [
          "anterior core",
          "calves",
          "glutes",
          "quadriceps",
          "shoulders",
          "triceps"
        ],
        "breathingDemand": "low-to-moderate",
        "balanceDemand": "low-to-moderate",
        "coordinationDemand": "high",
        "impactLevel": 1
      },
      "whyItWorks": "Wall Ball Reactive Target Call improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Movement Intelligence because the main adaptation is coordination, timing, target recognition, spacing, and movement quality while the nervous system is fresh.",
      "commonMisuse": "Do not rush the progression into heavy balls, high targets, or timed sets before the athlete owns timing and catch mechanics.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "Coach calls high/low or left/right target as the athlete starts the squat; athlete throws only to the called target and resets.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "Coach calls high/low or left/right target as the athlete starts the squat; athlete throws only to the called target and resets.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "attempts",
        "defaultSets": 4,
        "defaultReps": null,
        "defaultWorkSeconds": null,
        "defaultRestSeconds": 75,
        "estSecondsPerSet": 20,
        "defaultRpeMin": 4,
        "defaultRpeMax": 6,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable.",
        "defaultAttempts": 4
      },
      "scaling": {
        "youthBeginner": "Use a light soft medicine ball, lower target, shorter range of motion, and single-rep resets. Coach the catch before adding continuous reps.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use the full version with the intended phase dose: low-volume full-rest work for Output or controlled intervals for Sustained Capacity.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "General temperature raise",
          "Hip and ankle mobility",
          "Front-rack breathing squat"
        ],
        "pairsWellBefore": [
          "Main wall-ball interval",
          "Medicine-ball power block",
          "Strength support block"
        ],
        "avoidPairingWith": [
          "High-fatigue burpee circuits before skill or power work",
          "Max effort sprinting immediately after sloppy wall-ball intervals",
          "Heavy overhead fatigue before shoulder-sensitive athletes throw"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 1,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
        ]
      },
      "regimen": {
        "canBeDaily": true,
        "weeklyMaxFrequency": 4,
        "minimumHoursBetweenHardExposures": 0,
        "countsAsHighIntensity": false,
        "countsAsHighImpact": false,
        "countsAsNeural": true,
        "countsAsTissueStress": false,
        "countsAsConditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": true,
        "fatigueCost": 2,
        "fatigueSensitivity": 4,
        "technicalComplexity": 4,
        "intensityCeiling": "moderate",
        "impactLevel": 1
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 20,
      "slug": "wall-ball-throw-to-sprint-exit",
      "name": "Wall Ball Throw-to-Sprint Exit",
      "family": "Throw plus acceleration exit",
      "category": "11-20 - Power, High-Intent Throwing, and Output Quality",
      "primaryPhaseKey": "output",
      "subrole": "acceleration_start_speed",
      "subroleSecondary": "throw_to_sprint",
      "slot": "wall_ball_throw_to_sprint_exit",
      "cardSummary": "Wall Ball Throw-to-Sprint Exit trains links a powerful wall-ball throw to a short acceleration while freshness is high. It belongs in Output when the coach wants power, high-intent throwing, and output quality without losing wall-ball mechanics.",
      "selectionReason": "Links a powerful wall-ball throw to a short acceleration while freshness is high.",
      "bestPlacement": "Use after a general warm-up and before heavy strength or conditioning.",
      "description": "Complete one wall-ball throw, let the ball drop safely or partner clears it, then accelerate 5-10 yards on a cue.",
      "coachLanguage": "Primary subrole: acceleration_start_speed. Belongs in Output because the goal is high-intent throwing, power, speed of extension, or short acceleration with low volume and full recovery. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Throw, go, shut it down.",
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
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        },
        {
          "key": "plyometrics",
          "weight": 2
        }
      ],
      "physiology": [
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
          "key": "squat",
          "weight": 4
        },
        {
          "key": "push",
          "weight": 4
        },
        {
          "key": "jump",
          "weight": 3
        },
        {
          "key": "brace",
          "weight": 4
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "acceleration",
          "deceleration",
          "front-rack catch",
          "locomotion",
          "overhead reach",
          "squat",
          "triple extension"
        ],
        "primaryTissues": [
          "adductors",
          "anterior core",
          "calves",
          "glutes",
          "hamstrings",
          "quadriceps",
          "shoulders",
          "triceps"
        ],
        "breathingDemand": "moderate",
        "balanceDemand": "low-to-moderate",
        "coordinationDemand": "high",
        "impactLevel": 2
      },
      "whyItWorks": "Wall Ball Throw-to-Sprint Exit improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Output because the goal is high-intent throwing, power, speed of extension, or short acceleration with low volume and full recovery.",
      "commonMisuse": "Do not turn this into a high-rep wall-ball workout. Full rest and clean speed are the point.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "Complete one wall-ball throw, let the ball drop safely or partner clears it, then accelerate 5-10 yards on a cue.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise.",
          "Mark the run/carry distance with cones and keep the ball path separate from the running lane."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "Complete one wall-ball throw, let the ball drop safely or partner clears it, then accelerate 5-10 yards on a cue.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "attempts",
        "defaultSets": 5,
        "defaultReps": null,
        "defaultWorkSeconds": null,
        "defaultRestSeconds": 120,
        "estSecondsPerSet": 10,
        "defaultRpeMin": 7,
        "defaultRpeMax": 9,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable.",
        "defaultAttempts": 2
      },
      "scaling": {
        "youthBeginner": "Use a light soft medicine ball, lower target, shorter range of motion, and single-rep resets. Coach the catch before adding continuous reps.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use low-volume, high-intent attempts with full rest. Progress with speed, accuracy, or target challenge before volume.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "Prepare & Access mobility",
          "Catch-and-freeze rehearsal",
          "Low-target accuracy set"
        ],
        "pairsWellBefore": [
          "Strength work",
          "Sustained Capacity",
          "Sport conditioning"
        ],
        "avoidPairingWith": [
          "Long conditioning blocks before the drill",
          "Heavy shoulder fatigue",
          "High-rep wall balls that reduce throw speed"
        ]
      },
      "safety": {
        "riskLevel": 3,
        "impactLevel": 2,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": false,
        "countsAsNeural": true,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": true,
        "fatigueCost": 4,
        "fatigueSensitivity": 5,
        "technicalComplexity": 3,
        "intensityCeiling": "high",
        "impactLevel": 2
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 21,
      "slug": "rotational-wall-ball-scoop-toss",
      "name": "Rotational Wall-Ball Scoop Toss",
      "family": "Rotational wall throw",
      "category": "21-30 - Rotational, Lateral, and Multiplanar Wall-Ball Variations",
      "primaryPhaseKey": "output",
      "subrole": "jump_throw_explosive_power",
      "subroleSecondary": "rotational_power",
      "slot": "rotational_wall_ball_scoop_toss",
      "cardSummary": "Rotational Wall-Ball Scoop Toss trains rotational medicine-ball wall throw for hip-to-trunk power transfer. It belongs in Output when the coach wants rotational, lateral, and multiplanar wall-ball variations without losing wall-ball mechanics.",
      "selectionReason": "Rotational medicine-ball wall throw for hip-to-trunk power transfer.",
      "bestPlacement": "Use after a general warm-up and before heavy strength or conditioning.",
      "description": "Stand side-on to the wall, load the outside hip, scoop the ball into the wall, and catch or retrieve safely.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Belongs in Output because the goal is high-intent throwing, power, speed of extension, or short acceleration with low volume and full recovery. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Hip turns the ball.",
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
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        },
        {
          "key": "plyometrics",
          "weight": 2
        }
      ],
      "physiology": [
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
          "key": "squat",
          "weight": 4
        },
        {
          "key": "push",
          "weight": 4
        },
        {
          "key": "jump",
          "weight": 3
        },
        {
          "key": "brace",
          "weight": 4
        },
        {
          "key": "rotate",
          "weight": 4
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        },
        {
          "key": "spine",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "front-rack catch",
          "hip rotation",
          "overhead reach",
          "squat",
          "triple extension",
          "trunk rotation"
        ],
        "primaryTissues": [
          "anterior core",
          "calves",
          "glutes",
          "obliques",
          "quadriceps",
          "shoulders",
          "thoracic rotators",
          "triceps"
        ],
        "breathingDemand": "moderate",
        "balanceDemand": "low-to-moderate",
        "coordinationDemand": "high",
        "impactLevel": 1
      },
      "whyItWorks": "Rotational Wall-Ball Scoop Toss improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Output because the goal is high-intent throwing, power, speed of extension, or short acceleration with low volume and full recovery.",
      "commonMisuse": "Do not turn this into a high-rep wall-ball workout. Full rest and clean speed are the point.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "Stand side-on to the wall, load the outside hip, scoop the ball into the wall, and catch or retrieve safely.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "Stand side-on to the wall, load the outside hip, scoop the ball into the wall, and catch or retrieve safely.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "attempts",
        "defaultSets": 4,
        "defaultReps": null,
        "defaultWorkSeconds": null,
        "defaultRestSeconds": 90,
        "estSecondsPerSet": 20,
        "defaultRpeMin": 6,
        "defaultRpeMax": 8,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable.",
        "defaultAttempts": 4
      },
      "scaling": {
        "youthBeginner": "Use a light soft medicine ball, lower target, shorter range of motion, and single-rep resets. Coach the catch before adding continuous reps.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use low-volume, high-intent attempts with full rest. Progress with speed, accuracy, or target challenge before volume.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "Prepare & Access mobility",
          "Catch-and-freeze rehearsal",
          "Low-target accuracy set"
        ],
        "pairsWellBefore": [
          "Strength work",
          "Sustained Capacity",
          "Sport conditioning"
        ],
        "avoidPairingWith": [
          "Long conditioning blocks before the drill",
          "Heavy shoulder fatigue",
          "High-rep wall balls that reduce throw speed"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 1,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": false,
        "countsAsNeural": true,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": true,
        "fatigueCost": 4,
        "fatigueSensitivity": 5,
        "technicalComplexity": 3,
        "intensityCeiling": "high",
        "impactLevel": 1
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 22,
      "slug": "side-stance-wall-ball-shot",
      "name": "Side-Stance Wall Ball Shot",
      "family": "Side-on wall-ball shot",
      "category": "21-30 - Rotational, Lateral, and Multiplanar Wall-Ball Variations",
      "primaryPhaseKey": "movement_intelligence",
      "subrole": "shape_position_intelligence",
      "subroleSecondary": "frontal_plane_throw",
      "slot": "side_stance_wall_ball_shot",
      "cardSummary": "Side-Stance Wall Ball Shot trains side-on stance variation that teaches lateral hip loading and target release without losing squat posture. It belongs in Movement Intelligence when the coach wants rotational, lateral, and multiplanar wall-ball variations without losing wall-ball mechanics.",
      "selectionReason": "Side-on stance variation that teaches lateral hip loading and target release without losing squat posture.",
      "bestPlacement": "Use after a general warm-up and before heavy strength or conditioning.",
      "description": "Set side-on to the wall, squat under control, rotate to square the chest, and throw to the target.",
      "coachLanguage": "Primary subrole: shape_position_intelligence. Belongs in Movement Intelligence because the main adaptation is coordination, timing, target recognition, spacing, and movement quality while the nervous system is fresh. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Load side, finish square.",
      "tenets": [
        {
          "key": "coordination",
          "weight": 5
        },
        {
          "key": "body_control",
          "weight": 5
        },
        {
          "key": "balance",
          "weight": 2
        },
        {
          "key": "agility",
          "weight": 2
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        },
        {
          "key": "core_body_control",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "perception_action_skill",
          "weight": 4
        },
        {
          "key": "control_stability",
          "weight": 5
        },
        {
          "key": "neural_output_readiness",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "squat",
          "weight": 4
        },
        {
          "key": "brace",
          "weight": 4
        },
        {
          "key": "rotate",
          "weight": 4
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        },
        {
          "key": "spine",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "front-rack catch",
          "overhead reach",
          "squat",
          "triple extension"
        ],
        "primaryTissues": [
          "anterior core",
          "calves",
          "glutes",
          "quadriceps",
          "shoulders",
          "triceps"
        ],
        "breathingDemand": "low-to-moderate",
        "balanceDemand": "low-to-moderate",
        "coordinationDemand": "high",
        "impactLevel": 1
      },
      "whyItWorks": "Side-Stance Wall Ball Shot improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Movement Intelligence because the main adaptation is coordination, timing, target recognition, spacing, and movement quality while the nervous system is fresh.",
      "commonMisuse": "Do not rush the progression into heavy balls, high targets, or timed sets before the athlete owns timing and catch mechanics.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "Set side-on to the wall, squat under control, rotate to square the chest, and throw to the target.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "Set side-on to the wall, squat under control, rotate to square the chest, and throw to the target.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "reps",
        "defaultSets": 3,
        "defaultReps": 5,
        "defaultWorkSeconds": null,
        "defaultRestSeconds": 60,
        "estSecondsPerSet": 25,
        "defaultRpeMin": 4,
        "defaultRpeMax": 6,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable."
      },
      "scaling": {
        "youthBeginner": "Use a light soft medicine ball, lower target, shorter range of motion, and single-rep resets. Coach the catch before adding continuous reps.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use the full version with the intended phase dose: low-volume full-rest work for Output or controlled intervals for Sustained Capacity.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "General temperature raise",
          "Hip and ankle mobility",
          "Front-rack breathing squat"
        ],
        "pairsWellBefore": [
          "Main wall-ball interval",
          "Medicine-ball power block",
          "Strength support block"
        ],
        "avoidPairingWith": [
          "High-fatigue burpee circuits before skill or power work",
          "Max effort sprinting immediately after sloppy wall-ball intervals",
          "Heavy overhead fatigue before shoulder-sensitive athletes throw"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 1,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
        ]
      },
      "regimen": {
        "canBeDaily": true,
        "weeklyMaxFrequency": 4,
        "minimumHoursBetweenHardExposures": 0,
        "countsAsHighIntensity": false,
        "countsAsHighImpact": false,
        "countsAsNeural": true,
        "countsAsTissueStress": false,
        "countsAsConditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": true,
        "fatigueCost": 2,
        "fatigueSensitivity": 4,
        "technicalComplexity": 4,
        "intensityCeiling": "moderate",
        "impactLevel": 1
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 23,
      "slug": "half-kneeling-rotational-wall-throw",
      "name": "Half-Kneeling Rotational Wall Throw",
      "family": "Kneeling rotation control",
      "category": "21-30 - Rotational, Lateral, and Multiplanar Wall-Ball Variations",
      "primaryPhaseKey": "resilience",
      "subrole": "trunk_pelvis_anti_movement_control",
      "subroleSecondary": "rotation_control",
      "slot": "half_kneeling_rotational_wall_throw",
      "cardSummary": "Half-Kneeling Rotational Wall Throw trains half-kneeling wall throw that limits lower-body compensation and exposes trunk-pelvis control. It belongs in Resilience when the coach wants rotational, lateral, and multiplanar wall-ball variations without losing wall-ball mechanics.",
      "selectionReason": "Half-kneeling wall throw that limits lower-body compensation and exposes trunk-pelvis control.",
      "bestPlacement": "Use in the Capacity/Resilience support block after skill or power work.",
      "description": "From half-kneeling, rotate through the trunk and hips just enough to throw the ball into the wall while the pelvis stays controlled.",
      "coachLanguage": "Primary subrole: trunk_pelvis_anti_movement_control. Belongs in Resilience because the drill builds controlled receiving, bracing, trunk position, joint ownership, and durable positions rather than speed or conditioning. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Ribs over hips.",
      "tenets": [
        {
          "key": "body_control",
          "weight": 5
        },
        {
          "key": "balance",
          "weight": 3
        },
        {
          "key": "strength",
          "weight": 2
        },
        {
          "key": "coordination",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "isometrics",
          "weight": 3
        },
        {
          "key": "core_body_control",
          "weight": 5
        },
        {
          "key": "balance_stability",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "control_stability",
          "weight": 5
        },
        {
          "key": "force_tissue_capacity",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "brace",
          "weight": 5
        },
        {
          "key": "push",
          "weight": 3
        },
        {
          "key": "rotate",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "core",
          "weight": 5
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "spine",
          "weight": 3
        },
        {
          "key": "hip",
          "weight": 2
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "front-rack catch",
          "hip rotation",
          "overhead reach",
          "split-stance control",
          "squat",
          "triple extension",
          "trunk rotation"
        ],
        "primaryTissues": [
          "anterior core",
          "calves",
          "glutes",
          "hip stabilizers",
          "obliques",
          "quadriceps",
          "shoulders",
          "thoracic rotators",
          "triceps"
        ],
        "breathingDemand": "low-to-moderate",
        "balanceDemand": "low-to-moderate",
        "coordinationDemand": "moderate",
        "impactLevel": 0
      },
      "whyItWorks": "Half-Kneeling Rotational Wall Throw improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Resilience because the drill builds controlled receiving, bracing, trunk position, joint ownership, and durable positions rather than speed or conditioning.",
      "commonMisuse": "Do not turn controlled holds, catches, or bracing work into speed reps. The value is control under manageable stress.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "From half-kneeling, rotate through the trunk and hips just enough to throw the ball into the wall while the pelvis stays controlled.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "From half-kneeling, rotate through the trunk and hips just enough to throw the ball into the wall while the pelvis stays controlled.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "reps",
        "defaultSets": 3,
        "defaultReps": 5,
        "defaultWorkSeconds": null,
        "defaultRestSeconds": 60,
        "estSecondsPerSet": 25,
        "defaultRpeMin": 4,
        "defaultRpeMax": 6,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable."
      },
      "scaling": {
        "youthBeginner": "Use a light soft medicine ball, lower target, shorter range of motion, and single-rep resets. Coach the catch before adding continuous reps.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use the full version with the intended phase dose: low-volume full-rest work for Output or controlled intervals for Sustained Capacity.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "General temperature raise",
          "Hip and ankle mobility",
          "Front-rack breathing squat"
        ],
        "pairsWellBefore": [
          "Main wall-ball interval",
          "Medicine-ball power block",
          "Strength support block"
        ],
        "avoidPairingWith": [
          "High-fatigue burpee circuits before skill or power work",
          "Max effort sprinting immediately after sloppy wall-ball intervals",
          "Heavy overhead fatigue before shoulder-sensitive athletes throw"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 0,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
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
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": false,
        "fatigueCost": 2,
        "fatigueSensitivity": 3,
        "technicalComplexity": 3,
        "intensityCeiling": "moderate",
        "impactLevel": 0
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 24,
      "slug": "tall-kneeling-overhead-wall-throw",
      "name": "Tall-Kneeling Overhead Wall Throw",
      "family": "Kneeling overhead power",
      "category": "21-30 - Rotational, Lateral, and Multiplanar Wall-Ball Variations",
      "primaryPhaseKey": "output",
      "subrole": "jump_throw_explosive_power",
      "subroleSecondary": "overhead_throw_power",
      "slot": "tall_kneeling_overhead_wall_throw",
      "cardSummary": "Tall-Kneeling Overhead Wall Throw trains overhead wall throw that emphasizes trunk stiffness and shoulder finish without squat fatigue. It belongs in Output when the coach wants rotational, lateral, and multiplanar wall-ball variations without losing wall-ball mechanics.",
      "selectionReason": "Overhead wall throw that emphasizes trunk stiffness and shoulder finish without squat fatigue.",
      "bestPlacement": "Use after a general warm-up and before heavy strength or conditioning.",
      "description": "Kneel tall, brace, bring the ball overhead, and throw to the wall target without arching through the low back.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Belongs in Output because the goal is high-intent throwing, power, speed of extension, or short acceleration with low volume and full recovery. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Brace before overhead.",
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
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        },
        {
          "key": "plyometrics",
          "weight": 2
        }
      ],
      "physiology": [
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
          "key": "brace",
          "weight": 5
        },
        {
          "key": "push",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "core",
          "weight": 5
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "spine",
          "weight": 3
        },
        {
          "key": "hip",
          "weight": 2
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "front-rack catch",
          "overhead reach",
          "squat",
          "triple extension"
        ],
        "primaryTissues": [
          "anterior core",
          "calves",
          "glutes",
          "quadriceps",
          "shoulders",
          "triceps"
        ],
        "breathingDemand": "moderate",
        "balanceDemand": "low-to-moderate",
        "coordinationDemand": "high",
        "impactLevel": 0
      },
      "whyItWorks": "Tall-Kneeling Overhead Wall Throw improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Output because the goal is high-intent throwing, power, speed of extension, or short acceleration with low volume and full recovery.",
      "commonMisuse": "Do not turn this into a high-rep wall-ball workout. Full rest and clean speed are the point.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "Kneel tall, brace, bring the ball overhead, and throw to the wall target without arching through the low back.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "Kneel tall, brace, bring the ball overhead, and throw to the wall target without arching through the low back.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "attempts",
        "defaultSets": 4,
        "defaultReps": null,
        "defaultWorkSeconds": null,
        "defaultRestSeconds": 75,
        "estSecondsPerSet": 20,
        "defaultRpeMin": 6,
        "defaultRpeMax": 8,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable.",
        "defaultAttempts": 4
      },
      "scaling": {
        "youthBeginner": "Use a light soft medicine ball, lower target, shorter range of motion, and single-rep resets. Coach the catch before adding continuous reps.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use low-volume, high-intent attempts with full rest. Progress with speed, accuracy, or target challenge before volume.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "Prepare & Access mobility",
          "Catch-and-freeze rehearsal",
          "Low-target accuracy set"
        ],
        "pairsWellBefore": [
          "Strength work",
          "Sustained Capacity",
          "Sport conditioning"
        ],
        "avoidPairingWith": [
          "Long conditioning blocks before the drill",
          "Heavy shoulder fatigue",
          "High-rep wall balls that reduce throw speed"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 0,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": false,
        "countsAsNeural": true,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": true,
        "fatigueCost": 4,
        "fatigueSensitivity": 5,
        "technicalComplexity": 3,
        "intensityCeiling": "high",
        "impactLevel": 0
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 25,
      "slug": "lateral-shuffle-to-wall-ball-shot",
      "name": "Lateral Shuffle to Wall Ball Shot",
      "family": "Lateral footwork to shot",
      "category": "21-30 - Rotational, Lateral, and Multiplanar Wall-Ball Variations",
      "primaryPhaseKey": "movement_intelligence",
      "subrole": "perception_action_reactive_movement",
      "subroleSecondary": "footwork_to_throw",
      "slot": "lateral_shuffle_to_wall_ball_shot",
      "cardSummary": "Lateral Shuffle to Wall Ball Shot trains connects lateral movement, braking, and organized wall-ball release. It belongs in Movement Intelligence when the coach wants rotational, lateral, and multiplanar wall-ball variations without losing wall-ball mechanics.",
      "selectionReason": "Connects lateral movement, braking, and organized wall-ball release.",
      "bestPlacement": "Use after a general warm-up and before heavy strength or conditioning.",
      "description": "Shuffle one to three steps into the wall-ball station, brake under control, perform one wall ball, and reset.",
      "coachLanguage": "Primary subrole: perception_action_reactive_movement. Belongs in Movement Intelligence because the main adaptation is coordination, timing, target recognition, spacing, and movement quality while the nervous system is fresh. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Shuffle, stick, throw.",
      "tenets": [
        {
          "key": "coordination",
          "weight": 5
        },
        {
          "key": "body_control",
          "weight": 5
        },
        {
          "key": "balance",
          "weight": 2
        },
        {
          "key": "agility",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        },
        {
          "key": "core_body_control",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "perception_action_skill",
          "weight": 4
        },
        {
          "key": "control_stability",
          "weight": 5
        },
        {
          "key": "neural_output_readiness",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "squat",
          "weight": 4
        },
        {
          "key": "brace",
          "weight": 4
        },
        {
          "key": "locomote",
          "weight": 4
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "acceleration",
          "deceleration",
          "front-rack catch",
          "locomotion",
          "overhead reach",
          "squat",
          "triple extension"
        ],
        "primaryTissues": [
          "adductors",
          "anterior core",
          "calves",
          "glutes",
          "hamstrings",
          "quadriceps",
          "shoulders",
          "triceps"
        ],
        "breathingDemand": "low-to-moderate",
        "balanceDemand": "moderate",
        "coordinationDemand": "high",
        "impactLevel": 1
      },
      "whyItWorks": "Lateral Shuffle to Wall Ball Shot improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Movement Intelligence because the main adaptation is coordination, timing, target recognition, spacing, and movement quality while the nervous system is fresh.",
      "commonMisuse": "Do not rush the progression into heavy balls, high targets, or timed sets before the athlete owns timing and catch mechanics.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "Shuffle one to three steps into the wall-ball station, brake under control, perform one wall ball, and reset.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "Shuffle one to three steps into the wall-ball station, brake under control, perform one wall ball, and reset.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "reps",
        "defaultSets": 3,
        "defaultReps": 4,
        "defaultWorkSeconds": null,
        "defaultRestSeconds": 75,
        "estSecondsPerSet": 20,
        "defaultRpeMin": 4,
        "defaultRpeMax": 6,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable."
      },
      "scaling": {
        "youthBeginner": "Use a light soft medicine ball, lower target, shorter range of motion, and single-rep resets. Coach the catch before adding continuous reps.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use the full version with the intended phase dose: low-volume full-rest work for Output or controlled intervals for Sustained Capacity.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "General temperature raise",
          "Hip and ankle mobility",
          "Front-rack breathing squat"
        ],
        "pairsWellBefore": [
          "Main wall-ball interval",
          "Medicine-ball power block",
          "Strength support block"
        ],
        "avoidPairingWith": [
          "High-fatigue burpee circuits before skill or power work",
          "Max effort sprinting immediately after sloppy wall-ball intervals",
          "Heavy overhead fatigue before shoulder-sensitive athletes throw"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 1,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
        ]
      },
      "regimen": {
        "canBeDaily": true,
        "weeklyMaxFrequency": 4,
        "minimumHoursBetweenHardExposures": 0,
        "countsAsHighIntensity": false,
        "countsAsHighImpact": false,
        "countsAsNeural": true,
        "countsAsTissueStress": false,
        "countsAsConditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": true,
        "fatigueCost": 2,
        "fatigueSensitivity": 4,
        "technicalComplexity": 4,
        "intensityCeiling": "moderate",
        "impactLevel": 1
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 26,
      "slug": "lateral-catch-and-throw-wall-ball",
      "name": "Lateral Catch-and-Throw Wall Ball",
      "family": "Lateral catch and throw",
      "category": "21-30 - Rotational, Lateral, and Multiplanar Wall-Ball Variations",
      "primaryPhaseKey": "movement_intelligence",
      "subrole": "perception_action_reactive_movement",
      "subroleSecondary": "lateral_catch_throw",
      "slot": "lateral_catch_and_throw_wall_ball",
      "cardSummary": "Lateral Catch-and-Throw Wall Ball trains lateral moving catch-and-throw drill for eyes, feet, trunk, and hand timing. It belongs in Movement Intelligence when the coach wants rotational, lateral, and multiplanar wall-ball variations without losing wall-ball mechanics.",
      "selectionReason": "Lateral moving catch-and-throw drill for eyes, feet, trunk, and hand timing.",
      "bestPlacement": "Use after a general warm-up and before heavy strength or conditioning.",
      "description": "Receive the ball after a small lateral step, square up, throw to the wall, and catch in a stable stance.",
      "coachLanguage": "Primary subrole: perception_action_reactive_movement. Belongs in Movement Intelligence because the main adaptation is coordination, timing, target recognition, spacing, and movement quality while the nervous system is fresh. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Move first, catch square.",
      "tenets": [
        {
          "key": "coordination",
          "weight": 5
        },
        {
          "key": "body_control",
          "weight": 5
        },
        {
          "key": "balance",
          "weight": 2
        },
        {
          "key": "agility",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        },
        {
          "key": "core_body_control",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "perception_action_skill",
          "weight": 4
        },
        {
          "key": "control_stability",
          "weight": 5
        },
        {
          "key": "neural_output_readiness",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "squat",
          "weight": 4
        },
        {
          "key": "brace",
          "weight": 4
        },
        {
          "key": "locomote",
          "weight": 4
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "front-rack catch",
          "overhead reach",
          "squat",
          "triple extension"
        ],
        "primaryTissues": [
          "anterior core",
          "calves",
          "glutes",
          "quadriceps",
          "shoulders",
          "triceps"
        ],
        "breathingDemand": "low-to-moderate",
        "balanceDemand": "moderate",
        "coordinationDemand": "high",
        "impactLevel": 1
      },
      "whyItWorks": "Lateral Catch-and-Throw Wall Ball improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Movement Intelligence because the main adaptation is coordination, timing, target recognition, spacing, and movement quality while the nervous system is fresh.",
      "commonMisuse": "Do not rush the progression into heavy balls, high targets, or timed sets before the athlete owns timing and catch mechanics.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "Receive the ball after a small lateral step, square up, throw to the wall, and catch in a stable stance.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "Receive the ball after a small lateral step, square up, throw to the wall, and catch in a stable stance.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "reps",
        "defaultSets": 3,
        "defaultReps": 5,
        "defaultWorkSeconds": null,
        "defaultRestSeconds": 60,
        "estSecondsPerSet": 25,
        "defaultRpeMin": 4,
        "defaultRpeMax": 6,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable."
      },
      "scaling": {
        "youthBeginner": "Use a light soft medicine ball, lower target, shorter range of motion, and single-rep resets. Coach the catch before adding continuous reps.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use the full version with the intended phase dose: low-volume full-rest work for Output or controlled intervals for Sustained Capacity.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "General temperature raise",
          "Hip and ankle mobility",
          "Front-rack breathing squat"
        ],
        "pairsWellBefore": [
          "Main wall-ball interval",
          "Medicine-ball power block",
          "Strength support block"
        ],
        "avoidPairingWith": [
          "High-fatigue burpee circuits before skill or power work",
          "Max effort sprinting immediately after sloppy wall-ball intervals",
          "Heavy overhead fatigue before shoulder-sensitive athletes throw"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 1,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
        ]
      },
      "regimen": {
        "canBeDaily": true,
        "weeklyMaxFrequency": 4,
        "minimumHoursBetweenHardExposures": 0,
        "countsAsHighIntensity": false,
        "countsAsHighImpact": false,
        "countsAsNeural": true,
        "countsAsTissueStress": false,
        "countsAsConditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": true,
        "fatigueCost": 2,
        "fatigueSensitivity": 4,
        "technicalComplexity": 4,
        "intensityCeiling": "moderate",
        "impactLevel": 1
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 27,
      "slug": "reverse-lunge-to-wall-ball-shot",
      "name": "Reverse Lunge to Wall Ball Shot",
      "family": "Lunge to wall-ball shot",
      "category": "21-30 - Rotational, Lateral, and Multiplanar Wall-Ball Variations",
      "primaryPhaseKey": "capacity",
      "subrole": "squat_knee_dominant_strength",
      "subroleSecondary": "unilateral_wall_ball",
      "slot": "reverse_lunge_to_wall_ball_shot",
      "cardSummary": "Reverse Lunge to Wall Ball Shot trains unilateral strength and rhythm variation that links reverse-lunge control to a wall-ball release. It belongs in Capacity when the coach wants rotational, lateral, and multiplanar wall-ball variations without losing wall-ball mechanics.",
      "selectionReason": "Unilateral strength and rhythm variation that links reverse-lunge control to a wall-ball release.",
      "bestPlacement": "Use in the Capacity/Resilience support block after skill or power work.",
      "description": "Step back into a reverse lunge while holding the ball, return to stance, and immediately perform a controlled wall-ball shot.",
      "coachLanguage": "Primary subrole: squat_knee_dominant_strength. Belongs in Capacity because the drill builds strength, force production, tissue tolerance, and structural reserve that supports wall-ball performance. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Step, stand, throw.",
      "tenets": [
        {
          "key": "strength",
          "weight": 5
        },
        {
          "key": "body_control",
          "weight": 4
        },
        {
          "key": "coordination",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "resistance_calisthenics",
          "weight": 3
        },
        {
          "key": "core_body_control",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "force_tissue_capacity",
          "weight": 5
        },
        {
          "key": "control_stability",
          "weight": 4
        }
      ],
      "patterns": [
        {
          "key": "squat",
          "weight": 4
        },
        {
          "key": "brace",
          "weight": 4
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "front-rack catch",
          "overhead reach",
          "split-stance control",
          "squat",
          "triple extension"
        ],
        "primaryTissues": [
          "anterior core",
          "calves",
          "glutes",
          "hip stabilizers",
          "quadriceps",
          "shoulders",
          "triceps"
        ],
        "breathingDemand": "moderate",
        "balanceDemand": "moderate",
        "coordinationDemand": "moderate",
        "impactLevel": 1
      },
      "whyItWorks": "Reverse Lunge to Wall Ball Shot improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Capacity because the drill builds strength, force production, tissue tolerance, and structural reserve that supports wall-ball performance.",
      "commonMisuse": "Do not confuse a support-strength drill with a conditioning challenge. Load and range should build positions, not ruin them.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "Step back into a reverse lunge while holding the ball, return to stance, and immediately perform a controlled wall-ball shot.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "Step back into a reverse lunge while holding the ball, return to stance, and immediately perform a controlled wall-ball shot.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "reps",
        "defaultSets": 3,
        "defaultReps": 5,
        "defaultWorkSeconds": null,
        "defaultRestSeconds": 75,
        "estSecondsPerSet": 25,
        "defaultRpeMin": 5,
        "defaultRpeMax": 7,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable."
      },
      "scaling": {
        "youthBeginner": "Use a light soft medicine ball, lower target, shorter range of motion, and single-rep resets. Coach the catch before adding continuous reps.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use the full version with the intended phase dose: low-volume full-rest work for Output or controlled intervals for Sustained Capacity.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "General temperature raise",
          "Hip and ankle mobility",
          "Front-rack breathing squat"
        ],
        "pairsWellBefore": [
          "Main wall-ball interval",
          "Medicine-ball power block",
          "Strength support block"
        ],
        "avoidPairingWith": [
          "High-fatigue burpee circuits before skill or power work",
          "Max effort sprinting immediately after sloppy wall-ball intervals",
          "Heavy overhead fatigue before shoulder-sensitive athletes throw"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 1,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
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
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": false,
        "fatigueCost": 3,
        "fatigueSensitivity": 3,
        "technicalComplexity": 3,
        "intensityCeiling": "moderate",
        "impactLevel": 1
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 28,
      "slug": "cossack-shift-to-wall-ball-toss",
      "name": "Cossack Shift to Wall Ball Toss",
      "family": "Frontal-plane squat to throw",
      "category": "21-30 - Rotational, Lateral, and Multiplanar Wall-Ball Variations",
      "primaryPhaseKey": "movement_intelligence",
      "subrole": "balance_coordination_rhythm",
      "subroleSecondary": "frontal_plane_control",
      "slot": "cossack_shift_to_wall_ball_toss",
      "cardSummary": "Cossack Shift to Wall Ball Toss trains frontal-plane range and coordination drill that shifts into a wall-ball toss. It belongs in Movement Intelligence when the coach wants rotational, lateral, and multiplanar wall-ball variations without losing wall-ball mechanics.",
      "selectionReason": "Frontal-plane range and coordination drill that shifts into a wall-ball toss.",
      "bestPlacement": "Use after a general warm-up and before heavy strength or conditioning.",
      "description": "Shift into a shallow Cossack position, return to center, and throw the ball to the target with clean foot pressure.",
      "coachLanguage": "Primary subrole: balance_coordination_rhythm. Belongs in Movement Intelligence because the main adaptation is coordination, timing, target recognition, spacing, and movement quality while the nervous system is fresh. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Shift, center, throw.",
      "tenets": [
        {
          "key": "coordination",
          "weight": 5
        },
        {
          "key": "body_control",
          "weight": 5
        },
        {
          "key": "balance",
          "weight": 2
        },
        {
          "key": "agility",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        },
        {
          "key": "core_body_control",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "perception_action_skill",
          "weight": 4
        },
        {
          "key": "control_stability",
          "weight": 5
        },
        {
          "key": "neural_output_readiness",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "squat",
          "weight": 4
        },
        {
          "key": "brace",
          "weight": 4
        },
        {
          "key": "locomote",
          "weight": 4
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "front-rack catch",
          "overhead reach",
          "squat",
          "triple extension"
        ],
        "primaryTissues": [
          "anterior core",
          "calves",
          "glutes",
          "quadriceps",
          "shoulders",
          "triceps"
        ],
        "breathingDemand": "low-to-moderate",
        "balanceDemand": "moderate",
        "coordinationDemand": "high",
        "impactLevel": 1
      },
      "whyItWorks": "Cossack Shift to Wall Ball Toss improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Movement Intelligence because the main adaptation is coordination, timing, target recognition, spacing, and movement quality while the nervous system is fresh.",
      "commonMisuse": "Do not rush the progression into heavy balls, high targets, or timed sets before the athlete owns timing and catch mechanics.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "Shift into a shallow Cossack position, return to center, and throw the ball to the target with clean foot pressure.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "Shift into a shallow Cossack position, return to center, and throw the ball to the target with clean foot pressure.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "reps",
        "defaultSets": 3,
        "defaultReps": 4,
        "defaultWorkSeconds": null,
        "defaultRestSeconds": 75,
        "estSecondsPerSet": 20,
        "defaultRpeMin": 4,
        "defaultRpeMax": 6,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable."
      },
      "scaling": {
        "youthBeginner": "Use a light soft medicine ball, lower target, shorter range of motion, and single-rep resets. Coach the catch before adding continuous reps.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use the full version with the intended phase dose: low-volume full-rest work for Output or controlled intervals for Sustained Capacity.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "General temperature raise",
          "Hip and ankle mobility",
          "Front-rack breathing squat"
        ],
        "pairsWellBefore": [
          "Main wall-ball interval",
          "Medicine-ball power block",
          "Strength support block"
        ],
        "avoidPairingWith": [
          "High-fatigue burpee circuits before skill or power work",
          "Max effort sprinting immediately after sloppy wall-ball intervals",
          "Heavy overhead fatigue before shoulder-sensitive athletes throw"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 1,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
        ]
      },
      "regimen": {
        "canBeDaily": true,
        "weeklyMaxFrequency": 4,
        "minimumHoursBetweenHardExposures": 0,
        "countsAsHighIntensity": false,
        "countsAsHighImpact": false,
        "countsAsNeural": true,
        "countsAsTissueStress": false,
        "countsAsConditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": true,
        "fatigueCost": 2,
        "fatigueSensitivity": 4,
        "technicalComplexity": 4,
        "intensityCeiling": "moderate",
        "impactLevel": 1
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 29,
      "slug": "crossover-step-wall-ball-shot",
      "name": "Crossover Step Wall Ball Shot",
      "family": "Crossover footwork to shot",
      "category": "21-30 - Rotational, Lateral, and Multiplanar Wall-Ball Variations",
      "primaryPhaseKey": "movement_intelligence",
      "subrole": "perception_action_reactive_movement",
      "subroleSecondary": "crossover_to_throw",
      "slot": "crossover_step_wall_ball_shot",
      "cardSummary": "Crossover Step Wall Ball Shot trains crossover-step approach that teaches reorientation into a stable throw. It belongs in Movement Intelligence when the coach wants rotational, lateral, and multiplanar wall-ball variations without losing wall-ball mechanics.",
      "selectionReason": "Crossover-step approach that teaches reorientation into a stable throw.",
      "bestPlacement": "Use after a general warm-up and before heavy strength or conditioning.",
      "description": "Crossover into the wall-ball lane, square the hips and chest, then perform one wall-ball shot to target.",
      "coachLanguage": "Primary subrole: perception_action_reactive_movement. Belongs in Movement Intelligence because the main adaptation is coordination, timing, target recognition, spacing, and movement quality while the nervous system is fresh. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Cross, square, shoot.",
      "tenets": [
        {
          "key": "coordination",
          "weight": 5
        },
        {
          "key": "body_control",
          "weight": 5
        },
        {
          "key": "balance",
          "weight": 2
        },
        {
          "key": "agility",
          "weight": 2
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        },
        {
          "key": "core_body_control",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "perception_action_skill",
          "weight": 4
        },
        {
          "key": "control_stability",
          "weight": 5
        },
        {
          "key": "neural_output_readiness",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "squat",
          "weight": 4
        },
        {
          "key": "brace",
          "weight": 4
        },
        {
          "key": "rotate",
          "weight": 4
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        },
        {
          "key": "spine",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "front-rack catch",
          "hip rotation",
          "overhead reach",
          "squat",
          "triple extension",
          "trunk rotation"
        ],
        "primaryTissues": [
          "anterior core",
          "calves",
          "glutes",
          "obliques",
          "quadriceps",
          "shoulders",
          "thoracic rotators",
          "triceps"
        ],
        "breathingDemand": "low-to-moderate",
        "balanceDemand": "moderate",
        "coordinationDemand": "high",
        "impactLevel": 1
      },
      "whyItWorks": "Crossover Step Wall Ball Shot improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Movement Intelligence because the main adaptation is coordination, timing, target recognition, spacing, and movement quality while the nervous system is fresh.",
      "commonMisuse": "Do not rush the progression into heavy balls, high targets, or timed sets before the athlete owns timing and catch mechanics.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "Crossover into the wall-ball lane, square the hips and chest, then perform one wall-ball shot to target.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "Crossover into the wall-ball lane, square the hips and chest, then perform one wall-ball shot to target.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "reps",
        "defaultSets": 3,
        "defaultReps": 4,
        "defaultWorkSeconds": null,
        "defaultRestSeconds": 75,
        "estSecondsPerSet": 20,
        "defaultRpeMin": 4,
        "defaultRpeMax": 6,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable."
      },
      "scaling": {
        "youthBeginner": "Use a light soft medicine ball, lower target, shorter range of motion, and single-rep resets. Coach the catch before adding continuous reps.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use the full version with the intended phase dose: low-volume full-rest work for Output or controlled intervals for Sustained Capacity.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "General temperature raise",
          "Hip and ankle mobility",
          "Front-rack breathing squat"
        ],
        "pairsWellBefore": [
          "Main wall-ball interval",
          "Medicine-ball power block",
          "Strength support block"
        ],
        "avoidPairingWith": [
          "High-fatigue burpee circuits before skill or power work",
          "Max effort sprinting immediately after sloppy wall-ball intervals",
          "Heavy overhead fatigue before shoulder-sensitive athletes throw"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 1,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
        ]
      },
      "regimen": {
        "canBeDaily": true,
        "weeklyMaxFrequency": 4,
        "minimumHoursBetweenHardExposures": 0,
        "countsAsHighIntensity": false,
        "countsAsHighImpact": false,
        "countsAsNeural": true,
        "countsAsTissueStress": false,
        "countsAsConditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": true,
        "fatigueCost": 2,
        "fatigueSensitivity": 4,
        "technicalComplexity": 4,
        "intensityCeiling": "moderate",
        "impactLevel": 1
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 30,
      "slug": "180-turn-wall-ball-catch-and-throw",
      "name": "180-Turn Wall Ball Catch-and-Throw",
      "family": "Turn and throw coordination",
      "category": "21-30 - Rotational, Lateral, and Multiplanar Wall-Ball Variations",
      "primaryPhaseKey": "movement_intelligence",
      "subrole": "perception_action_reactive_movement",
      "subroleSecondary": "turn_catch_throw",
      "slot": "one_eighty_turn_wall_ball_catch_and_throw",
      "cardSummary": "180-Turn Wall Ball Catch-and-Throw trains reorientation drill that links turning, catching, target location, and throw control. It belongs in Movement Intelligence when the coach wants rotational, lateral, and multiplanar wall-ball variations without losing wall-ball mechanics.",
      "selectionReason": "Reorientation drill that links turning, catching, target location, and throw control.",
      "bestPlacement": "Use after a general warm-up and before heavy strength or conditioning.",
      "description": "Start facing away, turn on cue, receive or pick up the ball, square to the wall, and perform one accurate wall-ball throw.",
      "coachLanguage": "Primary subrole: perception_action_reactive_movement. Belongs in Movement Intelligence because the main adaptation is coordination, timing, target recognition, spacing, and movement quality while the nervous system is fresh. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Turn, find, throw.",
      "tenets": [
        {
          "key": "coordination",
          "weight": 5
        },
        {
          "key": "body_control",
          "weight": 5
        },
        {
          "key": "balance",
          "weight": 2
        },
        {
          "key": "agility",
          "weight": 2
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        },
        {
          "key": "core_body_control",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "perception_action_skill",
          "weight": 4
        },
        {
          "key": "control_stability",
          "weight": 5
        },
        {
          "key": "neural_output_readiness",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "squat",
          "weight": 4
        },
        {
          "key": "brace",
          "weight": 4
        },
        {
          "key": "rotate",
          "weight": 4
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        },
        {
          "key": "spine",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "front-rack catch",
          "hip rotation",
          "overhead reach",
          "squat",
          "triple extension",
          "trunk rotation"
        ],
        "primaryTissues": [
          "anterior core",
          "calves",
          "glutes",
          "obliques",
          "quadriceps",
          "shoulders",
          "thoracic rotators",
          "triceps"
        ],
        "breathingDemand": "low-to-moderate",
        "balanceDemand": "moderate",
        "coordinationDemand": "high",
        "impactLevel": 1
      },
      "whyItWorks": "180-Turn Wall Ball Catch-and-Throw improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Movement Intelligence because the main adaptation is coordination, timing, target recognition, spacing, and movement quality while the nervous system is fresh.",
      "commonMisuse": "Do not rush the progression into heavy balls, high targets, or timed sets before the athlete owns timing and catch mechanics.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "Start facing away, turn on cue, receive or pick up the ball, square to the wall, and perform one accurate wall-ball throw.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "Start facing away, turn on cue, receive or pick up the ball, square to the wall, and perform one accurate wall-ball throw.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "attempts",
        "defaultSets": 3,
        "defaultReps": null,
        "defaultWorkSeconds": null,
        "defaultRestSeconds": 90,
        "estSecondsPerSet": 20,
        "defaultRpeMin": 4,
        "defaultRpeMax": 6,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable.",
        "defaultAttempts": 4
      },
      "scaling": {
        "youthBeginner": "Use a light soft medicine ball, lower target, shorter range of motion, and single-rep resets. Coach the catch before adding continuous reps.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use the full version with the intended phase dose: low-volume full-rest work for Output or controlled intervals for Sustained Capacity.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "General temperature raise",
          "Hip and ankle mobility",
          "Front-rack breathing squat"
        ],
        "pairsWellBefore": [
          "Main wall-ball interval",
          "Medicine-ball power block",
          "Strength support block"
        ],
        "avoidPairingWith": [
          "High-fatigue burpee circuits before skill or power work",
          "Max effort sprinting immediately after sloppy wall-ball intervals",
          "Heavy overhead fatigue before shoulder-sensitive athletes throw"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 1,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
        ]
      },
      "regimen": {
        "canBeDaily": true,
        "weeklyMaxFrequency": 4,
        "minimumHoursBetweenHardExposures": 0,
        "countsAsHighIntensity": false,
        "countsAsHighImpact": false,
        "countsAsNeural": true,
        "countsAsTissueStress": false,
        "countsAsConditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": true,
        "fatigueCost": 2,
        "fatigueSensitivity": 4,
        "technicalComplexity": 4,
        "intensityCeiling": "moderate",
        "impactLevel": 1
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 31,
      "slug": "wall-ball-emom",
      "name": "Wall Ball EMOM",
      "family": "Wall-ball density repeatability",
      "category": "31-40 - Sustained Capacity, Work-Rate, and Repeatability",
      "primaryPhaseKey": "sustained_capacity",
      "subrole": "conditioning_intervals",
      "subroleSecondary": "emom_repeatability",
      "slot": "wall_ball_emom",
      "cardSummary": "Wall Ball EMOM trains minute-based wall-ball prescription that builds repeatability without uncontrolled fatigue. It belongs in Sustained Capacity when the coach wants sustained capacity, work-rate, and repeatability without losing wall-ball mechanics.",
      "selectionReason": "Minute-based wall-ball prescription that builds repeatability without uncontrolled fatigue.",
      "bestPlacement": "Use late in the session after Prepare & Access, Movement Intelligence, Output, and main Capacity priorities.",
      "description": "At the top of each minute, perform a prescribed number of wall balls, then rest the remainder of the minute.",
      "coachLanguage": "Primary subrole: conditioning_intervals. Belongs in Sustained Capacity because the intended stress is repeatable wall-ball work under fatigue while maintaining posture, breathing, target accuracy, and safe mechanics. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Same reps, same shape.",
      "tenets": [
        {
          "key": "work_capacity",
          "weight": 5
        },
        {
          "key": "strength",
          "weight": 3
        },
        {
          "key": "explosiveness",
          "weight": 3
        },
        {
          "key": "body_control",
          "weight": 4
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "hiit",
          "weight": 5
        },
        {
          "key": "core_body_control",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "energy_systems_repeatability",
          "weight": 5
        },
        {
          "key": "force_tissue_capacity",
          "weight": 3
        },
        {
          "key": "control_stability",
          "weight": 4
        }
      ],
      "patterns": [
        {
          "key": "squat",
          "weight": 5
        },
        {
          "key": "push",
          "weight": 4
        },
        {
          "key": "brace",
          "weight": 4
        },
        {
          "key": "locomote",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "front-rack catch",
          "overhead reach",
          "squat",
          "triple extension"
        ],
        "primaryTissues": [
          "anterior core",
          "calves",
          "glutes",
          "quadriceps",
          "shoulders",
          "triceps"
        ],
        "breathingDemand": "high",
        "balanceDemand": "low-to-moderate",
        "coordinationDemand": "moderate",
        "impactLevel": 1
      },
      "whyItWorks": "Wall Ball EMOM improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Sustained Capacity because the intended stress is repeatable wall-ball work under fatigue while maintaining posture, breathing, target accuracy, and safe mechanics.",
      "commonMisuse": "Do not chase exhaustion after mechanics degrade. Missed targets, collapsed catches, and ugly squats are not better conditioning.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "At the top of each minute, perform a prescribed number of wall balls, then rest the remainder of the minute.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "At the top of each minute, perform a prescribed number of wall balls, then rest the remainder of the minute.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down.",
          "Use planned breaks before missed targets or collapsed catches appear; repeatability is the goal, not random exhaustion."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "rounds",
        "defaultSets": 1,
        "defaultReps": null,
        "defaultWorkSeconds": null,
        "defaultRestSeconds": 0,
        "estSecondsPerSet": 60,
        "defaultRpeMin": 6,
        "defaultRpeMax": 8,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable.",
        "defaultRounds": 10
      },
      "scaling": {
        "youthBeginner": "Do not use fatigue formats first. Use single reps, low targets, and skill sets before any timed conditioning.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use intervals, EMOMs, or density blocks only while target accuracy and catch safety stay above the quality gate.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "Prepare & Access",
          "Movement Intelligence practice",
          "Output/power work",
          "Capacity work"
        ],
        "pairsWellBefore": [
          "Restore cooldown",
          "Breathing reset",
          "Soft tissue or mobility downshift"
        ],
        "avoidPairingWith": [
          "Fresh speed or power after the interval",
          "Skill learning immediately after fatigue",
          "Any block where missed targets become acceptable"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 1,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": false,
        "countsAsNeural": false,
        "countsAsTissueStress": true,
        "countsAsConditioning": true
      },
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": false,
        "fatigueCost": 5,
        "fatigueSensitivity": 4,
        "technicalComplexity": 3,
        "intensityCeiling": "high",
        "impactLevel": 1
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 32,
      "slug": "wall-ball-30-30-intervals",
      "name": "Wall Ball 30-30 Intervals",
      "family": "Wall-ball work-rest intervals",
      "category": "31-40 - Sustained Capacity, Work-Rate, and Repeatability",
      "primaryPhaseKey": "sustained_capacity",
      "subrole": "conditioning_intervals",
      "subroleSecondary": "wall_ball_intervals",
      "slot": "wall_ball_30_30_intervals",
      "cardSummary": "Wall Ball 30-30 Intervals trains timed wall-ball intervals that train repeatable output with planned recovery. It belongs in Sustained Capacity when the coach wants sustained capacity, work-rate, and repeatability without losing wall-ball mechanics.",
      "selectionReason": "Timed wall-ball intervals that train repeatable output with planned recovery.",
      "bestPlacement": "Use late in the session after Prepare & Access, Movement Intelligence, Output, and main Capacity priorities.",
      "description": "Work for 30 seconds, rest for 30 seconds, and keep each interval accurate and mechanically consistent.",
      "coachLanguage": "Primary subrole: conditioning_intervals. Belongs in Sustained Capacity because the intended stress is repeatable wall-ball work under fatigue while maintaining posture, breathing, target accuracy, and safe mechanics. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Work hard, stay clean.",
      "tenets": [
        {
          "key": "work_capacity",
          "weight": 5
        },
        {
          "key": "strength",
          "weight": 3
        },
        {
          "key": "explosiveness",
          "weight": 3
        },
        {
          "key": "body_control",
          "weight": 4
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "hiit",
          "weight": 5
        },
        {
          "key": "core_body_control",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "energy_systems_repeatability",
          "weight": 5
        },
        {
          "key": "force_tissue_capacity",
          "weight": 3
        },
        {
          "key": "control_stability",
          "weight": 4
        }
      ],
      "patterns": [
        {
          "key": "squat",
          "weight": 5
        },
        {
          "key": "push",
          "weight": 4
        },
        {
          "key": "brace",
          "weight": 4
        },
        {
          "key": "locomote",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "front-rack catch",
          "overhead reach",
          "squat",
          "triple extension"
        ],
        "primaryTissues": [
          "anterior core",
          "calves",
          "glutes",
          "quadriceps",
          "shoulders",
          "triceps"
        ],
        "breathingDemand": "high",
        "balanceDemand": "low-to-moderate",
        "coordinationDemand": "moderate",
        "impactLevel": 1
      },
      "whyItWorks": "Wall Ball 30-30 Intervals improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Sustained Capacity because the intended stress is repeatable wall-ball work under fatigue while maintaining posture, breathing, target accuracy, and safe mechanics.",
      "commonMisuse": "Do not chase exhaustion after mechanics degrade. Missed targets, collapsed catches, and ugly squats are not better conditioning.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "Work for 30 seconds, rest for 30 seconds, and keep each interval accurate and mechanically consistent.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "Work for 30 seconds, rest for 30 seconds, and keep each interval accurate and mechanically consistent.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down.",
          "Use planned breaks before missed targets or collapsed catches appear; repeatability is the goal, not random exhaustion."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "intervals",
        "defaultSets": 6,
        "defaultReps": null,
        "defaultWorkSeconds": 30,
        "defaultRestSeconds": 30,
        "estSecondsPerSet": 60,
        "defaultRpeMin": 7,
        "defaultRpeMax": 8,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable.",
        "defaultIntervals": 6
      },
      "scaling": {
        "youthBeginner": "Do not use fatigue formats first. Use single reps, low targets, and skill sets before any timed conditioning.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use intervals, EMOMs, or density blocks only while target accuracy and catch safety stay above the quality gate.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "Prepare & Access",
          "Movement Intelligence practice",
          "Output/power work",
          "Capacity work"
        ],
        "pairsWellBefore": [
          "Restore cooldown",
          "Breathing reset",
          "Soft tissue or mobility downshift"
        ],
        "avoidPairingWith": [
          "Fresh speed or power after the interval",
          "Skill learning immediately after fatigue",
          "Any block where missed targets become acceptable"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 1,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": false,
        "countsAsNeural": false,
        "countsAsTissueStress": true,
        "countsAsConditioning": true
      },
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": false,
        "fatigueCost": 5,
        "fatigueSensitivity": 4,
        "technicalComplexity": 3,
        "intensityCeiling": "high",
        "impactLevel": 1
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 33,
      "slug": "wall-ball-tabata",
      "name": "Wall Ball Tabata",
      "family": "Wall-ball short intervals",
      "category": "31-40 - Sustained Capacity, Work-Rate, and Repeatability",
      "primaryPhaseKey": "sustained_capacity",
      "subrole": "conditioning_intervals",
      "subroleSecondary": "tabata_repeatability",
      "slot": "wall_ball_tabata",
      "cardSummary": "Wall Ball Tabata trains very short work-rest wall-ball format for advanced athletes who can preserve mechanics. It belongs in Sustained Capacity when the coach wants sustained capacity, work-rate, and repeatability without losing wall-ball mechanics.",
      "selectionReason": "Very short work-rest wall-ball format for advanced athletes who can preserve mechanics.",
      "bestPlacement": "Use late in the session after Prepare & Access, Movement Intelligence, Output, and main Capacity priorities.",
      "description": "Complete 20 seconds of wall balls and 10 seconds rest for the assigned rounds, stopping early if catch or squat quality breaks.",
      "coachLanguage": "Primary subrole: conditioning_intervals. Belongs in Sustained Capacity because the intended stress is repeatable wall-ball work under fatigue while maintaining posture, breathing, target accuracy, and safe mechanics. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Fast, not sloppy.",
      "tenets": [
        {
          "key": "work_capacity",
          "weight": 5
        },
        {
          "key": "strength",
          "weight": 3
        },
        {
          "key": "explosiveness",
          "weight": 3
        },
        {
          "key": "body_control",
          "weight": 4
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "hiit",
          "weight": 5
        },
        {
          "key": "core_body_control",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "energy_systems_repeatability",
          "weight": 5
        },
        {
          "key": "force_tissue_capacity",
          "weight": 3
        },
        {
          "key": "control_stability",
          "weight": 4
        }
      ],
      "patterns": [
        {
          "key": "squat",
          "weight": 5
        },
        {
          "key": "push",
          "weight": 4
        },
        {
          "key": "brace",
          "weight": 4
        },
        {
          "key": "locomote",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "front-rack catch",
          "overhead reach",
          "squat",
          "triple extension"
        ],
        "primaryTissues": [
          "anterior core",
          "calves",
          "glutes",
          "quadriceps",
          "shoulders",
          "triceps"
        ],
        "breathingDemand": "high",
        "balanceDemand": "low-to-moderate",
        "coordinationDemand": "moderate",
        "impactLevel": 1
      },
      "whyItWorks": "Wall Ball Tabata improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Sustained Capacity because the intended stress is repeatable wall-ball work under fatigue while maintaining posture, breathing, target accuracy, and safe mechanics.",
      "commonMisuse": "Do not chase exhaustion after mechanics degrade. Missed targets, collapsed catches, and ugly squats are not better conditioning.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "Complete 20 seconds of wall balls and 10 seconds rest for the assigned rounds, stopping early if catch or squat quality breaks.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "Complete 20 seconds of wall balls and 10 seconds rest for the assigned rounds, stopping early if catch or squat quality breaks.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down.",
          "Use planned breaks before missed targets or collapsed catches appear; repeatability is the goal, not random exhaustion."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "intervals",
        "defaultSets": 8,
        "defaultReps": null,
        "defaultWorkSeconds": 20,
        "defaultRestSeconds": 10,
        "estSecondsPerSet": 60,
        "defaultRpeMin": 7,
        "defaultRpeMax": 9,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable.",
        "defaultIntervals": 8
      },
      "scaling": {
        "youthBeginner": "Do not use fatigue formats first. Use single reps, low targets, and skill sets before any timed conditioning.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use intervals, EMOMs, or density blocks only while target accuracy and catch safety stay above the quality gate.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "Prepare & Access",
          "Movement Intelligence practice",
          "Output/power work",
          "Capacity work"
        ],
        "pairsWellBefore": [
          "Restore cooldown",
          "Breathing reset",
          "Soft tissue or mobility downshift"
        ],
        "avoidPairingWith": [
          "Fresh speed or power after the interval",
          "Skill learning immediately after fatigue",
          "Any block where missed targets become acceptable"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 1,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": false,
        "countsAsNeural": false,
        "countsAsTissueStress": true,
        "countsAsConditioning": true
      },
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": false,
        "fatigueCost": 5,
        "fatigueSensitivity": 4,
        "technicalComplexity": 3,
        "intensityCeiling": "high",
        "impactLevel": 1
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 34,
      "slug": "wall-ball-repetition-ladder",
      "name": "Wall Ball Repetition Ladder",
      "family": "Wall-ball pacing ladder",
      "category": "31-40 - Sustained Capacity, Work-Rate, and Repeatability",
      "primaryPhaseKey": "sustained_capacity",
      "subrole": "conditioning_intervals",
      "subroleSecondary": "rep_ladder",
      "slot": "wall_ball_repetition_ladder",
      "cardSummary": "Wall Ball Repetition Ladder trains ascending or descending rep ladder that teaches pacing, breathing, and target consistency. It belongs in Sustained Capacity when the coach wants sustained capacity, work-rate, and repeatability without losing wall-ball mechanics.",
      "selectionReason": "Ascending or descending rep ladder that teaches pacing, breathing, and target consistency.",
      "bestPlacement": "Use late in the session after Prepare & Access, Movement Intelligence, Output, and main Capacity priorities.",
      "description": "Perform wall balls in a planned rep ladder with short rests, holding mechanics at each rung.",
      "coachLanguage": "Primary subrole: conditioning_intervals. Belongs in Sustained Capacity because the intended stress is repeatable wall-ball work under fatigue while maintaining posture, breathing, target accuracy, and safe mechanics. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Pace the ladder.",
      "tenets": [
        {
          "key": "work_capacity",
          "weight": 5
        },
        {
          "key": "strength",
          "weight": 3
        },
        {
          "key": "explosiveness",
          "weight": 3
        },
        {
          "key": "body_control",
          "weight": 4
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "hiit",
          "weight": 5
        },
        {
          "key": "core_body_control",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "energy_systems_repeatability",
          "weight": 5
        },
        {
          "key": "force_tissue_capacity",
          "weight": 3
        },
        {
          "key": "control_stability",
          "weight": 4
        }
      ],
      "patterns": [
        {
          "key": "squat",
          "weight": 5
        },
        {
          "key": "push",
          "weight": 4
        },
        {
          "key": "brace",
          "weight": 4
        },
        {
          "key": "locomote",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "front-rack catch",
          "overhead reach",
          "squat",
          "triple extension"
        ],
        "primaryTissues": [
          "anterior core",
          "calves",
          "glutes",
          "quadriceps",
          "shoulders",
          "triceps"
        ],
        "breathingDemand": "high",
        "balanceDemand": "low-to-moderate",
        "coordinationDemand": "moderate",
        "impactLevel": 1
      },
      "whyItWorks": "Wall Ball Repetition Ladder improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Sustained Capacity because the intended stress is repeatable wall-ball work under fatigue while maintaining posture, breathing, target accuracy, and safe mechanics.",
      "commonMisuse": "Do not chase exhaustion after mechanics degrade. Missed targets, collapsed catches, and ugly squats are not better conditioning.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "Perform wall balls in a planned rep ladder with short rests, holding mechanics at each rung.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "Perform wall balls in a planned rep ladder with short rests, holding mechanics at each rung.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down.",
          "Use planned breaks before missed targets or collapsed catches appear; repeatability is the goal, not random exhaustion."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "rounds",
        "defaultSets": 1,
        "defaultReps": null,
        "defaultWorkSeconds": null,
        "defaultRestSeconds": 30,
        "estSecondsPerSet": 60,
        "defaultRpeMin": 6,
        "defaultRpeMax": 8,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable.",
        "defaultRounds": 10
      },
      "scaling": {
        "youthBeginner": "Do not use fatigue formats first. Use single reps, low targets, and skill sets before any timed conditioning.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use intervals, EMOMs, or density blocks only while target accuracy and catch safety stay above the quality gate.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "Prepare & Access",
          "Movement Intelligence practice",
          "Output/power work",
          "Capacity work"
        ],
        "pairsWellBefore": [
          "Restore cooldown",
          "Breathing reset",
          "Soft tissue or mobility downshift"
        ],
        "avoidPairingWith": [
          "Fresh speed or power after the interval",
          "Skill learning immediately after fatigue",
          "Any block where missed targets become acceptable"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 1,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": false,
        "countsAsNeural": false,
        "countsAsTissueStress": true,
        "countsAsConditioning": true
      },
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": false,
        "fatigueCost": 5,
        "fatigueSensitivity": 4,
        "technicalComplexity": 3,
        "intensityCeiling": "high",
        "impactLevel": 1
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 35,
      "slug": "wall-ball-target-cycling",
      "name": "Wall Ball Target Cycling",
      "family": "Wall-ball target repeatability",
      "category": "31-40 - Sustained Capacity, Work-Rate, and Repeatability",
      "primaryPhaseKey": "sustained_capacity",
      "subrole": "conditioning_intervals",
      "subroleSecondary": "target_cycling",
      "slot": "wall_ball_target_cycling",
      "cardSummary": "Wall Ball Target Cycling trains conditioning drill that alternates target height or location while keeping reps repeatable. It belongs in Sustained Capacity when the coach wants sustained capacity, work-rate, and repeatability without losing wall-ball mechanics.",
      "selectionReason": "Conditioning drill that alternates target height or location while keeping reps repeatable.",
      "bestPlacement": "Use late in the session after Prepare & Access, Movement Intelligence, Output, and main Capacity priorities.",
      "description": "Cycle through two or three marked targets as prescribed, counting only accurate throws and stable catches.",
      "coachLanguage": "Primary subrole: conditioning_intervals. Belongs in Sustained Capacity because the intended stress is repeatable wall-ball work under fatigue while maintaining posture, breathing, target accuracy, and safe mechanics. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Hit, catch, repeat.",
      "tenets": [
        {
          "key": "work_capacity",
          "weight": 5
        },
        {
          "key": "strength",
          "weight": 3
        },
        {
          "key": "explosiveness",
          "weight": 3
        },
        {
          "key": "body_control",
          "weight": 4
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "hiit",
          "weight": 5
        },
        {
          "key": "core_body_control",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "energy_systems_repeatability",
          "weight": 5
        },
        {
          "key": "force_tissue_capacity",
          "weight": 3
        },
        {
          "key": "control_stability",
          "weight": 4
        }
      ],
      "patterns": [
        {
          "key": "squat",
          "weight": 5
        },
        {
          "key": "push",
          "weight": 4
        },
        {
          "key": "brace",
          "weight": 4
        },
        {
          "key": "locomote",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "front-rack catch",
          "overhead reach",
          "squat",
          "triple extension"
        ],
        "primaryTissues": [
          "anterior core",
          "calves",
          "glutes",
          "quadriceps",
          "shoulders",
          "triceps"
        ],
        "breathingDemand": "high",
        "balanceDemand": "low-to-moderate",
        "coordinationDemand": "high",
        "impactLevel": 1
      },
      "whyItWorks": "Wall Ball Target Cycling improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Sustained Capacity because the intended stress is repeatable wall-ball work under fatigue while maintaining posture, breathing, target accuracy, and safe mechanics.",
      "commonMisuse": "Do not chase exhaustion after mechanics degrade. Missed targets, collapsed catches, and ugly squats are not better conditioning.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "Cycle through two or three marked targets as prescribed, counting only accurate throws and stable catches.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "Cycle through two or three marked targets as prescribed, counting only accurate throws and stable catches.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down.",
          "Use planned breaks before missed targets or collapsed catches appear; repeatability is the goal, not random exhaustion."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "reps",
        "defaultSets": 4,
        "defaultReps": 8,
        "defaultWorkSeconds": null,
        "defaultRestSeconds": 45,
        "estSecondsPerSet": 40,
        "defaultRpeMin": 6,
        "defaultRpeMax": 8,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable."
      },
      "scaling": {
        "youthBeginner": "Do not use fatigue formats first. Use single reps, low targets, and skill sets before any timed conditioning.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use intervals, EMOMs, or density blocks only while target accuracy and catch safety stay above the quality gate.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "Prepare & Access",
          "Movement Intelligence practice",
          "Output/power work",
          "Capacity work"
        ],
        "pairsWellBefore": [
          "Restore cooldown",
          "Breathing reset",
          "Soft tissue or mobility downshift"
        ],
        "avoidPairingWith": [
          "Fresh speed or power after the interval",
          "Skill learning immediately after fatigue",
          "Any block where missed targets become acceptable"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 1,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": false,
        "countsAsNeural": false,
        "countsAsTissueStress": true,
        "countsAsConditioning": true
      },
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": false,
        "fatigueCost": 5,
        "fatigueSensitivity": 4,
        "technicalComplexity": 3,
        "intensityCeiling": "high",
        "impactLevel": 1
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 36,
      "slug": "wall-ball-plus-shuttle-run",
      "name": "Wall Ball + Shuttle Run",
      "family": "Wall-ball and locomotion interval",
      "category": "31-40 - Sustained Capacity, Work-Rate, and Repeatability",
      "primaryPhaseKey": "sustained_capacity",
      "subrole": "conditioning_circuit",
      "subroleSecondary": "wall_ball_shuttle",
      "slot": "wall_ball_plus_shuttle_run",
      "cardSummary": "Wall Ball + Shuttle Run trains combines wall-ball output with short shuttle running for sport-style repeatability. It belongs in Sustained Capacity when the coach wants sustained capacity, work-rate, and repeatability without losing wall-ball mechanics.",
      "selectionReason": "Combines wall-ball output with short shuttle running for sport-style repeatability.",
      "bestPlacement": "Use late in the session after Prepare & Access, Movement Intelligence, Output, and main Capacity priorities.",
      "description": "Perform a small wall-ball set, run a short shuttle, return to the target, and repeat only while mechanics remain safe.",
      "coachLanguage": "Primary subrole: conditioning_circuit. Belongs in Sustained Capacity because the intended stress is repeatable wall-ball work under fatigue while maintaining posture, breathing, target accuracy, and safe mechanics. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Throw clean, run controlled.",
      "tenets": [
        {
          "key": "work_capacity",
          "weight": 5
        },
        {
          "key": "strength",
          "weight": 3
        },
        {
          "key": "explosiveness",
          "weight": 3
        },
        {
          "key": "body_control",
          "weight": 4
        },
        {
          "key": "agility",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "hiit",
          "weight": 5
        },
        {
          "key": "core_body_control",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "energy_systems_repeatability",
          "weight": 5
        },
        {
          "key": "force_tissue_capacity",
          "weight": 3
        },
        {
          "key": "control_stability",
          "weight": 4
        }
      ],
      "patterns": [
        {
          "key": "squat",
          "weight": 5
        },
        {
          "key": "push",
          "weight": 4
        },
        {
          "key": "brace",
          "weight": 4
        },
        {
          "key": "locomote",
          "weight": 4
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "acceleration",
          "deceleration",
          "front-rack catch",
          "locomotion",
          "overhead reach",
          "squat",
          "triple extension"
        ],
        "primaryTissues": [
          "adductors",
          "anterior core",
          "calves",
          "glutes",
          "hamstrings",
          "quadriceps",
          "shoulders",
          "triceps"
        ],
        "breathingDemand": "high",
        "balanceDemand": "low-to-moderate",
        "coordinationDemand": "moderate",
        "impactLevel": 2
      },
      "whyItWorks": "Wall Ball + Shuttle Run improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Sustained Capacity because the intended stress is repeatable wall-ball work under fatigue while maintaining posture, breathing, target accuracy, and safe mechanics.",
      "commonMisuse": "Do not chase exhaustion after mechanics degrade. Missed targets, collapsed catches, and ugly squats are not better conditioning.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "Perform a small wall-ball set, run a short shuttle, return to the target, and repeat only while mechanics remain safe.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise.",
          "Mark the run/carry distance with cones and keep the ball path separate from the running lane."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "Perform a small wall-ball set, run a short shuttle, return to the target, and repeat only while mechanics remain safe.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down.",
          "Use planned breaks before missed targets or collapsed catches appear; repeatability is the goal, not random exhaustion."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "rounds",
        "defaultSets": 5,
        "defaultReps": null,
        "defaultWorkSeconds": null,
        "defaultRestSeconds": 60,
        "estSecondsPerSet": 60,
        "defaultRpeMin": 7,
        "defaultRpeMax": 9,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable.",
        "defaultRounds": 5
      },
      "scaling": {
        "youthBeginner": "Do not use fatigue formats first. Use single reps, low targets, and skill sets before any timed conditioning.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use intervals, EMOMs, or density blocks only while target accuracy and catch safety stay above the quality gate.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "Prepare & Access",
          "Movement Intelligence practice",
          "Output/power work",
          "Capacity work"
        ],
        "pairsWellBefore": [
          "Restore cooldown",
          "Breathing reset",
          "Soft tissue or mobility downshift"
        ],
        "avoidPairingWith": [
          "Fresh speed or power after the interval",
          "Skill learning immediately after fatigue",
          "Any block where missed targets become acceptable"
        ]
      },
      "safety": {
        "riskLevel": 3,
        "impactLevel": 2,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": false,
        "countsAsNeural": false,
        "countsAsTissueStress": true,
        "countsAsConditioning": true
      },
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": false,
        "fatigueCost": 5,
        "fatigueSensitivity": 4,
        "technicalComplexity": 3,
        "intensityCeiling": "high",
        "impactLevel": 2
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 37,
      "slug": "wall-ball-plus-bear-hug-carry-shuttle",
      "name": "Wall Ball + Bear-Hug Carry Shuttle",
      "family": "Wall-ball and carry repeatability",
      "category": "31-40 - Sustained Capacity, Work-Rate, and Repeatability",
      "primaryPhaseKey": "sustained_capacity",
      "subrole": "conditioning_circuit",
      "subroleSecondary": "wall_ball_carry",
      "slot": "wall_ball_plus_bear_hug_carry_shuttle",
      "cardSummary": "Wall Ball + Bear-Hug Carry Shuttle trains adds a carry after wall-ball reps to challenge breathing, bracing, and repeatability. It belongs in Sustained Capacity when the coach wants sustained capacity, work-rate, and repeatability without losing wall-ball mechanics.",
      "selectionReason": "Adds a carry after wall-ball reps to challenge breathing, bracing, and repeatability.",
      "bestPlacement": "Use late in the session after Prepare & Access, Movement Intelligence, Output, and main Capacity priorities.",
      "description": "Complete wall-ball reps, bear-hug carry the ball to a cone and back, then rest or repeat by plan.",
      "coachLanguage": "Primary subrole: conditioning_circuit. Belongs in Sustained Capacity because the intended stress is repeatable wall-ball work under fatigue while maintaining posture, breathing, target accuracy, and safe mechanics. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Breathe through the carry.",
      "tenets": [
        {
          "key": "work_capacity",
          "weight": 5
        },
        {
          "key": "strength",
          "weight": 3
        },
        {
          "key": "explosiveness",
          "weight": 3
        },
        {
          "key": "body_control",
          "weight": 4
        },
        {
          "key": "agility",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "hiit",
          "weight": 5
        },
        {
          "key": "core_body_control",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "energy_systems_repeatability",
          "weight": 5
        },
        {
          "key": "force_tissue_capacity",
          "weight": 3
        },
        {
          "key": "control_stability",
          "weight": 4
        }
      ],
      "patterns": [
        {
          "key": "squat",
          "weight": 5
        },
        {
          "key": "push",
          "weight": 4
        },
        {
          "key": "brace",
          "weight": 4
        },
        {
          "key": "locomote",
          "weight": 4
        },
        {
          "key": "carry",
          "weight": 5
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "acceleration",
          "deceleration",
          "front-rack catch",
          "locomotion",
          "overhead reach",
          "squat",
          "triple extension"
        ],
        "primaryTissues": [
          "adductors",
          "anterior core",
          "calves",
          "glutes",
          "hamstrings",
          "quadriceps",
          "shoulders",
          "triceps"
        ],
        "breathingDemand": "high",
        "balanceDemand": "low-to-moderate",
        "coordinationDemand": "moderate",
        "impactLevel": 1
      },
      "whyItWorks": "Wall Ball + Bear-Hug Carry Shuttle improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Sustained Capacity because the intended stress is repeatable wall-ball work under fatigue while maintaining posture, breathing, target accuracy, and safe mechanics.",
      "commonMisuse": "Do not chase exhaustion after mechanics degrade. Missed targets, collapsed catches, and ugly squats are not better conditioning.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "Complete wall-ball reps, bear-hug carry the ball to a cone and back, then rest or repeat by plan.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise.",
          "Mark the run/carry distance with cones and keep the ball path separate from the running lane."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "Complete wall-ball reps, bear-hug carry the ball to a cone and back, then rest or repeat by plan.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down.",
          "Use planned breaks before missed targets or collapsed catches appear; repeatability is the goal, not random exhaustion."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "rounds",
        "defaultSets": 4,
        "defaultReps": null,
        "defaultWorkSeconds": null,
        "defaultRestSeconds": 75,
        "estSecondsPerSet": 60,
        "defaultRpeMin": 7,
        "defaultRpeMax": 8,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable.",
        "defaultRounds": 4
      },
      "scaling": {
        "youthBeginner": "Do not use fatigue formats first. Use single reps, low targets, and skill sets before any timed conditioning.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use intervals, EMOMs, or density blocks only while target accuracy and catch safety stay above the quality gate.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "Prepare & Access",
          "Movement Intelligence practice",
          "Output/power work",
          "Capacity work"
        ],
        "pairsWellBefore": [
          "Restore cooldown",
          "Breathing reset",
          "Soft tissue or mobility downshift"
        ],
        "avoidPairingWith": [
          "Fresh speed or power after the interval",
          "Skill learning immediately after fatigue",
          "Any block where missed targets become acceptable"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 1,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": false,
        "countsAsNeural": false,
        "countsAsTissueStress": true,
        "countsAsConditioning": true
      },
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": false,
        "fatigueCost": 5,
        "fatigueSensitivity": 4,
        "technicalComplexity": 3,
        "intensityCeiling": "high",
        "impactLevel": 1
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 38,
      "slug": "partner-alternating-wall-ball-relay",
      "name": "Partner Alternating Wall Ball Relay",
      "family": "Partner wall-ball relay",
      "category": "31-40 - Sustained Capacity, Work-Rate, and Repeatability",
      "primaryPhaseKey": "sustained_capacity",
      "subrole": "conditioning_intervals",
      "subroleSecondary": "partner_wall_ball_relay",
      "slot": "partner_alternating_wall_ball_relay",
      "cardSummary": "Partner Alternating Wall Ball Relay trains alternating partner format that preserves intent through shared rest and clear spacing. It belongs in Sustained Capacity when the coach wants sustained capacity, work-rate, and repeatability without losing wall-ball mechanics.",
      "selectionReason": "Alternating partner format that preserves intent through shared rest and clear spacing.",
      "bestPlacement": "Use late in the session after Prepare & Access, Movement Intelligence, Output, and main Capacity priorities.",
      "description": "Partners alternate wall-ball reps or short sets, communicate clearly, and stay out of each other's catch path.",
      "coachLanguage": "Primary subrole: conditioning_intervals. Belongs in Sustained Capacity because the intended stress is repeatable wall-ball work under fatigue while maintaining posture, breathing, target accuracy, and safe mechanics. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Your rep, clean lane.",
      "tenets": [
        {
          "key": "work_capacity",
          "weight": 5
        },
        {
          "key": "strength",
          "weight": 3
        },
        {
          "key": "explosiveness",
          "weight": 3
        },
        {
          "key": "body_control",
          "weight": 4
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "hiit",
          "weight": 5
        },
        {
          "key": "core_body_control",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "energy_systems_repeatability",
          "weight": 5
        },
        {
          "key": "force_tissue_capacity",
          "weight": 3
        },
        {
          "key": "control_stability",
          "weight": 4
        }
      ],
      "patterns": [
        {
          "key": "squat",
          "weight": 5
        },
        {
          "key": "push",
          "weight": 4
        },
        {
          "key": "brace",
          "weight": 4
        },
        {
          "key": "locomote",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "front-rack catch",
          "overhead reach",
          "squat",
          "triple extension"
        ],
        "primaryTissues": [
          "anterior core",
          "calves",
          "glutes",
          "quadriceps",
          "shoulders",
          "triceps"
        ],
        "breathingDemand": "high",
        "balanceDemand": "low-to-moderate",
        "coordinationDemand": "moderate",
        "impactLevel": 1
      },
      "whyItWorks": "Partner Alternating Wall Ball Relay improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Sustained Capacity because the intended stress is repeatable wall-ball work under fatigue while maintaining posture, breathing, target accuracy, and safe mechanics.",
      "commonMisuse": "Do not chase exhaustion after mechanics degrade. Missed targets, collapsed catches, and ugly squats are not better conditioning.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "Partners alternate wall-ball reps or short sets, communicate clearly, and stay out of each other's catch path.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise.",
          "Assign one clear working lane per pair and define who throws, catches, counts, and calls stop."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "Partners alternate wall-ball reps or short sets, communicate clearly, and stay out of each other's catch path.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down.",
          "Use planned breaks before missed targets or collapsed catches appear; repeatability is the goal, not random exhaustion."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "rounds",
        "defaultSets": 5,
        "defaultReps": null,
        "defaultWorkSeconds": null,
        "defaultRestSeconds": 60,
        "estSecondsPerSet": 60,
        "defaultRpeMin": 6,
        "defaultRpeMax": 8,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable.",
        "defaultRounds": 5
      },
      "scaling": {
        "youthBeginner": "Do not use fatigue formats first. Use single reps, low targets, and skill sets before any timed conditioning.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use intervals, EMOMs, or density blocks only while target accuracy and catch safety stay above the quality gate.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "Prepare & Access",
          "Movement Intelligence practice",
          "Output/power work",
          "Capacity work"
        ],
        "pairsWellBefore": [
          "Restore cooldown",
          "Breathing reset",
          "Soft tissue or mobility downshift"
        ],
        "avoidPairingWith": [
          "Fresh speed or power after the interval",
          "Skill learning immediately after fatigue",
          "Any block where missed targets become acceptable"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 1,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": false,
        "countsAsNeural": false,
        "countsAsTissueStress": true,
        "countsAsConditioning": true
      },
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": false,
        "fatigueCost": 5,
        "fatigueSensitivity": 4,
        "technicalComplexity": 3,
        "intensityCeiling": "high",
        "impactLevel": 1
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 39,
      "slug": "wall-ball-density-block",
      "name": "Wall Ball Density Block",
      "family": "Wall-ball density capacity",
      "category": "31-40 - Sustained Capacity, Work-Rate, and Repeatability",
      "primaryPhaseKey": "sustained_capacity",
      "subrole": "conditioning_intervals",
      "subroleSecondary": "density_block",
      "slot": "wall_ball_density_block",
      "cardSummary": "Wall Ball Density Block trains fixed-time density block that builds wall-ball volume while quality gates control the dose. It belongs in Sustained Capacity when the coach wants sustained capacity, work-rate, and repeatability without losing wall-ball mechanics.",
      "selectionReason": "Fixed-time density block that builds wall-ball volume while quality gates control the dose.",
      "bestPlacement": "Use late in the session after Prepare & Access, Movement Intelligence, Output, and main Capacity priorities.",
      "description": "Accumulate quality wall-ball reps for the assigned time cap, using micro-breaks before the catch or squat degrades.",
      "coachLanguage": "Primary subrole: conditioning_intervals. Belongs in Sustained Capacity because the intended stress is repeatable wall-ball work under fatigue while maintaining posture, breathing, target accuracy, and safe mechanics. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Break before you break down.",
      "tenets": [
        {
          "key": "work_capacity",
          "weight": 5
        },
        {
          "key": "strength",
          "weight": 3
        },
        {
          "key": "explosiveness",
          "weight": 3
        },
        {
          "key": "body_control",
          "weight": 4
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "hiit",
          "weight": 5
        },
        {
          "key": "core_body_control",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "energy_systems_repeatability",
          "weight": 5
        },
        {
          "key": "force_tissue_capacity",
          "weight": 3
        },
        {
          "key": "control_stability",
          "weight": 4
        }
      ],
      "patterns": [
        {
          "key": "squat",
          "weight": 5
        },
        {
          "key": "push",
          "weight": 4
        },
        {
          "key": "brace",
          "weight": 4
        },
        {
          "key": "locomote",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "front-rack catch",
          "overhead reach",
          "squat",
          "triple extension"
        ],
        "primaryTissues": [
          "anterior core",
          "calves",
          "glutes",
          "quadriceps",
          "shoulders",
          "triceps"
        ],
        "breathingDemand": "high",
        "balanceDemand": "low-to-moderate",
        "coordinationDemand": "moderate",
        "impactLevel": 1
      },
      "whyItWorks": "Wall Ball Density Block improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Sustained Capacity because the intended stress is repeatable wall-ball work under fatigue while maintaining posture, breathing, target accuracy, and safe mechanics.",
      "commonMisuse": "Do not chase exhaustion after mechanics degrade. Missed targets, collapsed catches, and ugly squats are not better conditioning.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "Accumulate quality wall-ball reps for the assigned time cap, using micro-breaks before the catch or squat degrades.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "Accumulate quality wall-ball reps for the assigned time cap, using micro-breaks before the catch or squat degrades.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down.",
          "Use planned breaks before missed targets or collapsed catches appear; repeatability is the goal, not random exhaustion."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "seconds",
        "defaultSets": 1,
        "defaultReps": null,
        "defaultWorkSeconds": 300,
        "defaultRestSeconds": 0,
        "estSecondsPerSet": 300,
        "defaultRpeMin": 6,
        "defaultRpeMax": 8,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable."
      },
      "scaling": {
        "youthBeginner": "Do not use fatigue formats first. Use single reps, low targets, and skill sets before any timed conditioning.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use intervals, EMOMs, or density blocks only while target accuracy and catch safety stay above the quality gate.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "Prepare & Access",
          "Movement Intelligence practice",
          "Output/power work",
          "Capacity work"
        ],
        "pairsWellBefore": [
          "Restore cooldown",
          "Breathing reset",
          "Soft tissue or mobility downshift"
        ],
        "avoidPairingWith": [
          "Fresh speed or power after the interval",
          "Skill learning immediately after fatigue",
          "Any block where missed targets become acceptable"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 1,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": false,
        "countsAsNeural": false,
        "countsAsTissueStress": true,
        "countsAsConditioning": true
      },
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": false,
        "fatigueCost": 5,
        "fatigueSensitivity": 4,
        "technicalComplexity": 3,
        "intensityCeiling": "high",
        "impactLevel": 1
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 40,
      "slug": "wall-ball-chipper-segment",
      "name": "Wall Ball Chipper Segment",
      "family": "Wall-ball workout segment",
      "category": "31-40 - Sustained Capacity, Work-Rate, and Repeatability",
      "primaryPhaseKey": "sustained_capacity",
      "subrole": "conditioning_circuit",
      "subroleSecondary": "chipper_segment",
      "slot": "wall_ball_chipper_segment",
      "cardSummary": "Wall Ball Chipper Segment trains a larger wall-ball segment for athletes who can handle volume without losing mechanics. It belongs in Sustained Capacity when the coach wants sustained capacity, work-rate, and repeatability without losing wall-ball mechanics.",
      "selectionReason": "A larger wall-ball segment for athletes who can handle volume without losing mechanics.",
      "bestPlacement": "Use late in the session after Prepare & Access, Movement Intelligence, Output, and main Capacity priorities.",
      "description": "Complete a prescribed number of wall balls as part of a larger circuit, placing it late enough that it does not steal speed or strength quality.",
      "coachLanguage": "Primary subrole: conditioning_circuit. Belongs in Sustained Capacity because the intended stress is repeatable wall-ball work under fatigue while maintaining posture, breathing, target accuracy, and safe mechanics. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Chip away, stay accurate.",
      "tenets": [
        {
          "key": "work_capacity",
          "weight": 5
        },
        {
          "key": "strength",
          "weight": 3
        },
        {
          "key": "explosiveness",
          "weight": 3
        },
        {
          "key": "body_control",
          "weight": 4
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "hiit",
          "weight": 5
        },
        {
          "key": "core_body_control",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "energy_systems_repeatability",
          "weight": 5
        },
        {
          "key": "force_tissue_capacity",
          "weight": 3
        },
        {
          "key": "control_stability",
          "weight": 4
        }
      ],
      "patterns": [
        {
          "key": "squat",
          "weight": 5
        },
        {
          "key": "push",
          "weight": 4
        },
        {
          "key": "brace",
          "weight": 4
        },
        {
          "key": "locomote",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "front-rack catch",
          "overhead reach",
          "squat",
          "triple extension"
        ],
        "primaryTissues": [
          "anterior core",
          "calves",
          "glutes",
          "quadriceps",
          "shoulders",
          "triceps"
        ],
        "breathingDemand": "high",
        "balanceDemand": "low-to-moderate",
        "coordinationDemand": "moderate",
        "impactLevel": 1
      },
      "whyItWorks": "Wall Ball Chipper Segment improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Sustained Capacity because the intended stress is repeatable wall-ball work under fatigue while maintaining posture, breathing, target accuracy, and safe mechanics.",
      "commonMisuse": "Do not chase exhaustion after mechanics degrade. Missed targets, collapsed catches, and ugly squats are not better conditioning.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "Complete a prescribed number of wall balls as part of a larger circuit, placing it late enough that it does not steal speed or strength quality.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "Complete a prescribed number of wall balls as part of a larger circuit, placing it late enough that it does not steal speed or strength quality.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down.",
          "Use planned breaks before missed targets or collapsed catches appear; repeatability is the goal, not random exhaustion."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "reps",
        "defaultSets": 1,
        "defaultReps": 50,
        "defaultWorkSeconds": null,
        "defaultRestSeconds": 0,
        "estSecondsPerSet": 250,
        "defaultRpeMin": 7,
        "defaultRpeMax": 9,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable."
      },
      "scaling": {
        "youthBeginner": "Do not use fatigue formats first. Use single reps, low targets, and skill sets before any timed conditioning.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use intervals, EMOMs, or density blocks only while target accuracy and catch safety stay above the quality gate.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "Prepare & Access",
          "Movement Intelligence practice",
          "Output/power work",
          "Capacity work"
        ],
        "pairsWellBefore": [
          "Restore cooldown",
          "Breathing reset",
          "Soft tissue or mobility downshift"
        ],
        "avoidPairingWith": [
          "Fresh speed or power after the interval",
          "Skill learning immediately after fatigue",
          "Any block where missed targets become acceptable"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 1,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": false,
        "countsAsNeural": false,
        "countsAsTissueStress": true,
        "countsAsConditioning": true
      },
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": false,
        "fatigueCost": 5,
        "fatigueSensitivity": 4,
        "technicalComplexity": 3,
        "intensityCeiling": "high",
        "impactLevel": 1
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 41,
      "slug": "medicine-ball-front-squat",
      "name": "Medicine Ball Front Squat",
      "family": "Wall-ball strength support",
      "category": "41-50 - Support Exercises and Prerequisites for Better Wall Balls",
      "primaryPhaseKey": "capacity",
      "subrole": "squat_knee_dominant_strength",
      "subroleSecondary": "front_rack_support",
      "slot": "medicine_ball_front_squat",
      "cardSummary": "Medicine Ball Front Squat trains strength-support drill for squat depth, front-rack posture, and bracing without a throw. It belongs in Capacity when the coach wants support exercises and prerequisites for better wall balls without losing wall-ball mechanics.",
      "selectionReason": "Strength-support drill for squat depth, front-rack posture, and bracing without a throw.",
      "bestPlacement": "Use in the Capacity/Resilience support block after skill or power work.",
      "description": "Hold the medicine ball in the front rack and perform controlled squats through a range the athlete can own.",
      "coachLanguage": "Primary subrole: squat_knee_dominant_strength. Belongs in Capacity because the drill builds strength, force production, tissue tolerance, and structural reserve that supports wall-ball performance. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Keep the ball high.",
      "tenets": [
        {
          "key": "strength",
          "weight": 5
        },
        {
          "key": "body_control",
          "weight": 4
        },
        {
          "key": "coordination",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "resistance_calisthenics",
          "weight": 3
        },
        {
          "key": "core_body_control",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "force_tissue_capacity",
          "weight": 5
        },
        {
          "key": "control_stability",
          "weight": 4
        }
      ],
      "patterns": [
        {
          "key": "squat",
          "weight": 4
        },
        {
          "key": "brace",
          "weight": 4
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "front-rack bracing",
          "front-rack catch",
          "overhead reach",
          "squat",
          "triple extension"
        ],
        "primaryTissues": [
          "anterior core",
          "calves",
          "glutes",
          "quadriceps",
          "shoulders",
          "triceps"
        ],
        "breathingDemand": "moderate",
        "balanceDemand": "low-to-moderate",
        "coordinationDemand": "moderate",
        "impactLevel": 0
      },
      "whyItWorks": "Medicine Ball Front Squat improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Capacity because the drill builds strength, force production, tissue tolerance, and structural reserve that supports wall-ball performance.",
      "commonMisuse": "Do not confuse a support-strength drill with a conditioning challenge. Load and range should build positions, not ruin them.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "Hold the medicine ball in the front rack and perform controlled squats through a range the athlete can own.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "Hold the medicine ball in the front rack and perform controlled squats through a range the athlete can own.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "reps",
        "defaultSets": 3,
        "defaultReps": 8,
        "defaultWorkSeconds": null,
        "defaultRestSeconds": 60,
        "estSecondsPerSet": 40,
        "defaultRpeMin": 5,
        "defaultRpeMax": 7,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable."
      },
      "scaling": {
        "youthBeginner": "Use a light soft medicine ball, lower target, shorter range of motion, and single-rep resets. Coach the catch before adding continuous reps.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use the full version with the intended phase dose: low-volume full-rest work for Output or controlled intervals for Sustained Capacity.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "General temperature raise",
          "Hip and ankle mobility",
          "Front-rack breathing squat"
        ],
        "pairsWellBefore": [
          "Main wall-ball interval",
          "Medicine-ball power block",
          "Strength support block"
        ],
        "avoidPairingWith": [
          "High-fatigue burpee circuits before skill or power work",
          "Max effort sprinting immediately after sloppy wall-ball intervals",
          "Heavy overhead fatigue before shoulder-sensitive athletes throw"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 0,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
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
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": false,
        "fatigueCost": 3,
        "fatigueSensitivity": 3,
        "technicalComplexity": 3,
        "intensityCeiling": "moderate",
        "impactLevel": 0
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 42,
      "slug": "medicine-ball-thruster-no-release",
      "name": "Medicine Ball Thruster (No Release)",
      "family": "Wall-ball thruster support",
      "category": "41-50 - Support Exercises and Prerequisites for Better Wall Balls",
      "primaryPhaseKey": "capacity",
      "subrole": "squat_knee_dominant_strength",
      "subroleSecondary": "pressing_support",
      "slot": "medicine_ball_thruster_no_release",
      "cardSummary": "Medicine Ball Thruster (No Release) trains squat-to-press support pattern for athletes learning to connect leg drive and overhead finish. It belongs in Capacity when the coach wants support exercises and prerequisites for better wall balls without losing wall-ball mechanics.",
      "selectionReason": "Squat-to-press support pattern for athletes learning to connect leg drive and overhead finish.",
      "bestPlacement": "Use in the Capacity/Resilience support block after skill or power work.",
      "description": "Squat with the ball at the chest, stand, press overhead, return to the chest, and reset before the next rep.",
      "coachLanguage": "Primary subrole: squat_knee_dominant_strength. Belongs in Capacity because the drill builds strength, force production, tissue tolerance, and structural reserve that supports wall-ball performance. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Legs drive the press.",
      "tenets": [
        {
          "key": "strength",
          "weight": 5
        },
        {
          "key": "body_control",
          "weight": 4
        },
        {
          "key": "coordination",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "resistance_calisthenics",
          "weight": 3
        },
        {
          "key": "core_body_control",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "force_tissue_capacity",
          "weight": 5
        },
        {
          "key": "control_stability",
          "weight": 4
        }
      ],
      "patterns": [
        {
          "key": "squat",
          "weight": 4
        },
        {
          "key": "brace",
          "weight": 4
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "front-rack catch",
          "overhead reach",
          "squat",
          "triple extension"
        ],
        "primaryTissues": [
          "anterior core",
          "calves",
          "glutes",
          "quadriceps",
          "shoulders",
          "triceps"
        ],
        "breathingDemand": "moderate",
        "balanceDemand": "low-to-moderate",
        "coordinationDemand": "moderate",
        "impactLevel": 0
      },
      "whyItWorks": "Medicine Ball Thruster (No Release) improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Capacity because the drill builds strength, force production, tissue tolerance, and structural reserve that supports wall-ball performance.",
      "commonMisuse": "Do not confuse a support-strength drill with a conditioning challenge. Load and range should build positions, not ruin them.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "Squat with the ball at the chest, stand, press overhead, return to the chest, and reset before the next rep.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "Squat with the ball at the chest, stand, press overhead, return to the chest, and reset before the next rep.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "reps",
        "defaultSets": 3,
        "defaultReps": 6,
        "defaultWorkSeconds": null,
        "defaultRestSeconds": 60,
        "estSecondsPerSet": 30,
        "defaultRpeMin": 5,
        "defaultRpeMax": 7,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable."
      },
      "scaling": {
        "youthBeginner": "Use a light soft medicine ball, lower target, shorter range of motion, and single-rep resets. Coach the catch before adding continuous reps.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use the full version with the intended phase dose: low-volume full-rest work for Output or controlled intervals for Sustained Capacity.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "General temperature raise",
          "Hip and ankle mobility",
          "Front-rack breathing squat"
        ],
        "pairsWellBefore": [
          "Main wall-ball interval",
          "Medicine-ball power block",
          "Strength support block"
        ],
        "avoidPairingWith": [
          "High-fatigue burpee circuits before skill or power work",
          "Max effort sprinting immediately after sloppy wall-ball intervals",
          "Heavy overhead fatigue before shoulder-sensitive athletes throw"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 0,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
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
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": false,
        "fatigueCost": 3,
        "fatigueSensitivity": 3,
        "technicalComplexity": 3,
        "intensityCeiling": "moderate",
        "impactLevel": 0
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 43,
      "slug": "medicine-ball-clean-to-squat",
      "name": "Medicine Ball Clean to Squat",
      "family": "Wall-ball catch and squat support",
      "category": "41-50 - Support Exercises and Prerequisites for Better Wall Balls",
      "primaryPhaseKey": "movement_intelligence",
      "subrole": "shape_position_intelligence",
      "subroleSecondary": "front_rack_transition",
      "slot": "medicine_ball_clean_to_squat",
      "cardSummary": "Medicine Ball Clean to Squat trains teaches picking up, receiving, and squatting with the medicine ball before adding a wall target. It belongs in Movement Intelligence when the coach wants support exercises and prerequisites for better wall balls without losing wall-ball mechanics.",
      "selectionReason": "Teaches picking up, receiving, and squatting with the medicine ball before adding a wall target.",
      "bestPlacement": "Use after a general warm-up and before heavy strength or conditioning.",
      "description": "Clean the ball from the floor or low position to front rack, settle the catch, and squat under control.",
      "coachLanguage": "Primary subrole: shape_position_intelligence. Belongs in Movement Intelligence because the main adaptation is coordination, timing, target recognition, spacing, and movement quality while the nervous system is fresh. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Catch high, squat smooth.",
      "tenets": [
        {
          "key": "coordination",
          "weight": 5
        },
        {
          "key": "body_control",
          "weight": 5
        },
        {
          "key": "balance",
          "weight": 2
        },
        {
          "key": "agility",
          "weight": 2
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        },
        {
          "key": "core_body_control",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "perception_action_skill",
          "weight": 4
        },
        {
          "key": "control_stability",
          "weight": 5
        },
        {
          "key": "neural_output_readiness",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "squat",
          "weight": 4
        },
        {
          "key": "brace",
          "weight": 4
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "front-rack catch",
          "overhead reach",
          "squat",
          "triple extension"
        ],
        "primaryTissues": [
          "anterior core",
          "calves",
          "glutes",
          "quadriceps",
          "shoulders",
          "triceps"
        ],
        "breathingDemand": "low-to-moderate",
        "balanceDemand": "low-to-moderate",
        "coordinationDemand": "high",
        "impactLevel": 0
      },
      "whyItWorks": "Medicine Ball Clean to Squat improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Movement Intelligence because the main adaptation is coordination, timing, target recognition, spacing, and movement quality while the nervous system is fresh.",
      "commonMisuse": "Do not rush the progression into heavy balls, high targets, or timed sets before the athlete owns timing and catch mechanics.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "Clean the ball from the floor or low position to front rack, settle the catch, and squat under control.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "Clean the ball from the floor or low position to front rack, settle the catch, and squat under control.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "reps",
        "defaultSets": 3,
        "defaultReps": 5,
        "defaultWorkSeconds": null,
        "defaultRestSeconds": 60,
        "estSecondsPerSet": 25,
        "defaultRpeMin": 4,
        "defaultRpeMax": 6,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable."
      },
      "scaling": {
        "youthBeginner": "Use a light soft medicine ball, lower target, shorter range of motion, and single-rep resets. Coach the catch before adding continuous reps.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use the full version with the intended phase dose: low-volume full-rest work for Output or controlled intervals for Sustained Capacity.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "General temperature raise",
          "Hip and ankle mobility",
          "Front-rack breathing squat"
        ],
        "pairsWellBefore": [
          "Main wall-ball interval",
          "Medicine-ball power block",
          "Strength support block"
        ],
        "avoidPairingWith": [
          "High-fatigue burpee circuits before skill or power work",
          "Max effort sprinting immediately after sloppy wall-ball intervals",
          "Heavy overhead fatigue before shoulder-sensitive athletes throw"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 0,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
        ]
      },
      "regimen": {
        "canBeDaily": true,
        "weeklyMaxFrequency": 4,
        "minimumHoursBetweenHardExposures": 0,
        "countsAsHighIntensity": false,
        "countsAsHighImpact": false,
        "countsAsNeural": true,
        "countsAsTissueStress": false,
        "countsAsConditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": true,
        "fatigueCost": 2,
        "fatigueSensitivity": 4,
        "technicalComplexity": 4,
        "intensityCeiling": "moderate",
        "impactLevel": 0
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 44,
      "slug": "medicine-ball-squat-clean-to-wall-ball-shot",
      "name": "Medicine Ball Squat Clean to Wall Ball Shot",
      "family": "Clean to wall-ball integration",
      "category": "41-50 - Support Exercises and Prerequisites for Better Wall Balls",
      "primaryPhaseKey": "sustained_capacity",
      "subrole": "conditioning_circuit",
      "subroleSecondary": "clean_to_wall_ball",
      "slot": "medicine_ball_squat_clean_to_wall_ball_shot",
      "cardSummary": "Medicine Ball Squat Clean to Wall Ball Shot trains combines the floor pickup, squat, and wall-ball throw into one repeatable conditioning pattern. It belongs in Sustained Capacity when the coach wants support exercises and prerequisites for better wall balls without losing wall-ball mechanics.",
      "selectionReason": "Combines the floor pickup, squat, and wall-ball throw into one repeatable conditioning pattern.",
      "bestPlacement": "Use late in the session after Prepare & Access, Movement Intelligence, Output, and main Capacity priorities.",
      "description": "Clean the ball from the floor, stand or squat as prescribed, then throw to the wall target and reset.",
      "coachLanguage": "Primary subrole: conditioning_circuit. Belongs in Sustained Capacity because the intended stress is repeatable wall-ball work under fatigue while maintaining posture, breathing, target accuracy, and safe mechanics. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Clean, stand, shoot.",
      "tenets": [
        {
          "key": "work_capacity",
          "weight": 5
        },
        {
          "key": "strength",
          "weight": 3
        },
        {
          "key": "explosiveness",
          "weight": 3
        },
        {
          "key": "body_control",
          "weight": 4
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "hiit",
          "weight": 5
        },
        {
          "key": "core_body_control",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "energy_systems_repeatability",
          "weight": 5
        },
        {
          "key": "force_tissue_capacity",
          "weight": 3
        },
        {
          "key": "control_stability",
          "weight": 4
        }
      ],
      "patterns": [
        {
          "key": "squat",
          "weight": 5
        },
        {
          "key": "push",
          "weight": 4
        },
        {
          "key": "brace",
          "weight": 4
        },
        {
          "key": "locomote",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "front-rack catch",
          "overhead reach",
          "squat",
          "triple extension"
        ],
        "primaryTissues": [
          "anterior core",
          "calves",
          "glutes",
          "quadriceps",
          "shoulders",
          "triceps"
        ],
        "breathingDemand": "high",
        "balanceDemand": "low-to-moderate",
        "coordinationDemand": "moderate",
        "impactLevel": 1
      },
      "whyItWorks": "Medicine Ball Squat Clean to Wall Ball Shot improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Sustained Capacity because the intended stress is repeatable wall-ball work under fatigue while maintaining posture, breathing, target accuracy, and safe mechanics.",
      "commonMisuse": "Do not chase exhaustion after mechanics degrade. Missed targets, collapsed catches, and ugly squats are not better conditioning.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "Clean the ball from the floor, stand or squat as prescribed, then throw to the wall target and reset.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "Clean the ball from the floor, stand or squat as prescribed, then throw to the wall target and reset.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down.",
          "Use planned breaks before missed targets or collapsed catches appear; repeatability is the goal, not random exhaustion."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "reps",
        "defaultSets": 3,
        "defaultReps": 6,
        "defaultWorkSeconds": null,
        "defaultRestSeconds": 75,
        "estSecondsPerSet": 30,
        "defaultRpeMin": 6,
        "defaultRpeMax": 8,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable."
      },
      "scaling": {
        "youthBeginner": "Do not use fatigue formats first. Use single reps, low targets, and skill sets before any timed conditioning.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use intervals, EMOMs, or density blocks only while target accuracy and catch safety stay above the quality gate.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "Prepare & Access",
          "Movement Intelligence practice",
          "Output/power work",
          "Capacity work"
        ],
        "pairsWellBefore": [
          "Restore cooldown",
          "Breathing reset",
          "Soft tissue or mobility downshift"
        ],
        "avoidPairingWith": [
          "Fresh speed or power after the interval",
          "Skill learning immediately after fatigue",
          "Any block where missed targets become acceptable"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 1,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": false,
        "countsAsNeural": false,
        "countsAsTissueStress": true,
        "countsAsConditioning": true
      },
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": false,
        "fatigueCost": 5,
        "fatigueSensitivity": 4,
        "technicalComplexity": 3,
        "intensityCeiling": "high",
        "impactLevel": 1
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 45,
      "slug": "wall-ball-low-catch-position-hold",
      "name": "Wall Ball Low-Catch Position Hold",
      "family": "Catch-position resilience",
      "category": "41-50 - Support Exercises and Prerequisites for Better Wall Balls",
      "primaryPhaseKey": "resilience",
      "subrole": "slow_eccentric_isometric_joint_resilience",
      "subroleSecondary": "low_catch_hold",
      "slot": "wall_ball_low_catch_position_hold",
      "cardSummary": "Wall Ball Low-Catch Position Hold trains isometric catch-position hold that builds squat bottom ownership and front-rack tolerance. It belongs in Resilience when the coach wants support exercises and prerequisites for better wall balls without losing wall-ball mechanics.",
      "selectionReason": "Isometric catch-position hold that builds squat bottom ownership and front-rack tolerance.",
      "bestPlacement": "Use in the Capacity/Resilience support block after skill or power work.",
      "description": "Hold the ball at the chest in the bottom or near-bottom squat position for a controlled time without collapsing.",
      "coachLanguage": "Primary subrole: slow_eccentric_isometric_joint_resilience. Belongs in Resilience because the drill builds controlled receiving, bracing, trunk position, joint ownership, and durable positions rather than speed or conditioning. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Own the catch.",
      "tenets": [
        {
          "key": "body_control",
          "weight": 5
        },
        {
          "key": "balance",
          "weight": 3
        },
        {
          "key": "strength",
          "weight": 2
        },
        {
          "key": "coordination",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "isometrics",
          "weight": 3
        },
        {
          "key": "core_body_control",
          "weight": 5
        },
        {
          "key": "balance_stability",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "control_stability",
          "weight": 5
        },
        {
          "key": "force_tissue_capacity",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "squat",
          "weight": 4
        },
        {
          "key": "brace",
          "weight": 4
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "front-rack catch",
          "overhead reach",
          "squat",
          "triple extension"
        ],
        "primaryTissues": [
          "anterior core",
          "calves",
          "glutes",
          "quadriceps",
          "shoulders",
          "triceps"
        ],
        "breathingDemand": "low-to-moderate",
        "balanceDemand": "low-to-moderate",
        "coordinationDemand": "moderate",
        "impactLevel": 0
      },
      "whyItWorks": "Wall Ball Low-Catch Position Hold improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Resilience because the drill builds controlled receiving, bracing, trunk position, joint ownership, and durable positions rather than speed or conditioning.",
      "commonMisuse": "Do not turn controlled holds, catches, or bracing work into speed reps. The value is control under manageable stress.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "Hold the ball at the chest in the bottom or near-bottom squat position for a controlled time without collapsing.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "Hold the ball at the chest in the bottom or near-bottom squat position for a controlled time without collapsing.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "seconds",
        "defaultSets": 3,
        "defaultReps": null,
        "defaultWorkSeconds": 20,
        "defaultRestSeconds": 45,
        "estSecondsPerSet": 20,
        "defaultRpeMin": 4,
        "defaultRpeMax": 6,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable."
      },
      "scaling": {
        "youthBeginner": "Use a light soft medicine ball, lower target, shorter range of motion, and single-rep resets. Coach the catch before adding continuous reps.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use the full version with the intended phase dose: low-volume full-rest work for Output or controlled intervals for Sustained Capacity.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "General temperature raise",
          "Hip and ankle mobility",
          "Front-rack breathing squat"
        ],
        "pairsWellBefore": [
          "Main wall-ball interval",
          "Medicine-ball power block",
          "Strength support block"
        ],
        "avoidPairingWith": [
          "High-fatigue burpee circuits before skill or power work",
          "Max effort sprinting immediately after sloppy wall-ball intervals",
          "Heavy overhead fatigue before shoulder-sensitive athletes throw"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 0,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
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
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": false,
        "fatigueCost": 2,
        "fatigueSensitivity": 3,
        "technicalComplexity": 3,
        "intensityCeiling": "moderate",
        "impactLevel": 0
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 46,
      "slug": "wall-ball-overhead-catch-prep",
      "name": "Wall Ball Overhead Catch Prep",
      "family": "Overhead and shoulder prep",
      "category": "41-50 - Support Exercises and Prerequisites for Better Wall Balls",
      "primaryPhaseKey": "prepare_and_access",
      "subrole": "activate",
      "subroleSecondary": "shoulder_overhead_prep",
      "slot": "wall_ball_overhead_catch_prep",
      "cardSummary": "Wall Ball Overhead Catch Prep trains low-intensity shoulder and trunk prep for receiving and finishing wall-ball throws. It belongs in Prepare And Access when the coach wants support exercises and prerequisites for better wall balls without losing wall-ball mechanics.",
      "selectionReason": "Low-intensity shoulder and trunk prep for receiving and finishing wall-ball throws.",
      "bestPlacement": "Use early in Prepare & Access before higher-intent wall-ball work.",
      "description": "Hold or lightly toss the ball to an overhead position while keeping ribs stacked and shoulders comfortable.",
      "coachLanguage": "Primary subrole: activate. Belongs in Prepare & Access because the drill improves readiness, access, activation, or position ownership before higher-intent work without creating meaningful fatigue. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Ribs down, reach tall.",
      "tenets": [
        {
          "key": "body_control",
          "weight": 5
        },
        {
          "key": "coordination",
          "weight": 3
        },
        {
          "key": "flexibility",
          "weight": 2
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "mobility_flexibility",
          "weight": 2
        },
        {
          "key": "core_body_control",
          "weight": 4
        }
      ],
      "physiology": [
        {
          "key": "neural_output_readiness",
          "weight": 3
        },
        {
          "key": "control_stability",
          "weight": 4
        }
      ],
      "patterns": [
        {
          "key": "squat",
          "weight": 4
        },
        {
          "key": "brace",
          "weight": 4
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "front-rack catch",
          "overhead reach",
          "squat",
          "triple extension"
        ],
        "primaryTissues": [
          "anterior core",
          "calves",
          "glutes",
          "quadriceps",
          "shoulders",
          "triceps"
        ],
        "breathingDemand": "low-to-moderate",
        "balanceDemand": "low-to-moderate",
        "coordinationDemand": "moderate",
        "impactLevel": 0
      },
      "whyItWorks": "Wall Ball Overhead Catch Prep improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Prepare & Access because the drill improves readiness, access, activation, or position ownership before higher-intent work without creating meaningful fatigue.",
      "commonMisuse": "Do not add enough volume or load that a readiness drill becomes fatigue work.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "Hold or lightly toss the ball to an overhead position while keeping ribs stacked and shoulders comfortable.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "Hold or lightly toss the ball to an overhead position while keeping ribs stacked and shoulders comfortable.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "reps",
        "defaultSets": 2,
        "defaultReps": 6,
        "defaultWorkSeconds": null,
        "defaultRestSeconds": 30,
        "estSecondsPerSet": 30,
        "defaultRpeMin": 2,
        "defaultRpeMax": 4,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable."
      },
      "scaling": {
        "youthBeginner": "Use a light soft medicine ball, lower target, shorter range of motion, and single-rep resets. Coach the catch before adding continuous reps.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use the full version with the intended phase dose: low-volume full-rest work for Output or controlled intervals for Sustained Capacity.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "General temperature raise",
          "Hip and ankle mobility",
          "Front-rack breathing squat"
        ],
        "pairsWellBefore": [
          "Main wall-ball interval",
          "Medicine-ball power block",
          "Strength support block"
        ],
        "avoidPairingWith": [
          "High-fatigue burpee circuits before skill or power work",
          "Max effort sprinting immediately after sloppy wall-ball intervals",
          "Heavy overhead fatigue before shoulder-sensitive athletes throw"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 0,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
        ]
      },
      "regimen": {
        "canBeDaily": true,
        "weeklyMaxFrequency": 5,
        "minimumHoursBetweenHardExposures": 0,
        "countsAsHighIntensity": false,
        "countsAsHighImpact": false,
        "countsAsNeural": true,
        "countsAsTissueStress": false,
        "countsAsConditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": false,
        "fatigueCost": 1,
        "fatigueSensitivity": 2,
        "technicalComplexity": 2,
        "intensityCeiling": "low",
        "impactLevel": 0
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 47,
      "slug": "front-rack-reverse-lunge-with-med-ball",
      "name": "Front-Rack Reverse Lunge with Med Ball",
      "family": "Unilateral support strength",
      "category": "41-50 - Support Exercises and Prerequisites for Better Wall Balls",
      "primaryPhaseKey": "capacity",
      "subrole": "squat_knee_dominant_strength",
      "subroleSecondary": "unilateral_front_rack",
      "slot": "front_rack_reverse_lunge_with_med_ball",
      "cardSummary": "Front-Rack Reverse Lunge with Med Ball trains unilateral leg and trunk support for wall-ball athletes who need better stance and pelvis control. It belongs in Capacity when the coach wants support exercises and prerequisites for better wall balls without losing wall-ball mechanics.",
      "selectionReason": "Unilateral leg and trunk support for wall-ball athletes who need better stance and pelvis control.",
      "bestPlacement": "Use in the Capacity/Resilience support block after skill or power work.",
      "description": "Hold the ball at the chest, step back into a reverse lunge, return to stance, and keep the torso organized.",
      "coachLanguage": "Primary subrole: squat_knee_dominant_strength. Belongs in Capacity because the drill builds strength, force production, tissue tolerance, and structural reserve that supports wall-ball performance. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Step back, stay stacked.",
      "tenets": [
        {
          "key": "strength",
          "weight": 5
        },
        {
          "key": "body_control",
          "weight": 4
        },
        {
          "key": "coordination",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "resistance_calisthenics",
          "weight": 3
        },
        {
          "key": "core_body_control",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "force_tissue_capacity",
          "weight": 5
        },
        {
          "key": "control_stability",
          "weight": 4
        }
      ],
      "patterns": [
        {
          "key": "squat",
          "weight": 4
        },
        {
          "key": "brace",
          "weight": 4
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "front-rack catch",
          "overhead reach",
          "split-stance control",
          "squat",
          "triple extension"
        ],
        "primaryTissues": [
          "anterior core",
          "calves",
          "glutes",
          "hip stabilizers",
          "quadriceps",
          "shoulders",
          "triceps"
        ],
        "breathingDemand": "moderate",
        "balanceDemand": "moderate",
        "coordinationDemand": "moderate",
        "impactLevel": 0
      },
      "whyItWorks": "Front-Rack Reverse Lunge with Med Ball improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Capacity because the drill builds strength, force production, tissue tolerance, and structural reserve that supports wall-ball performance.",
      "commonMisuse": "Do not confuse a support-strength drill with a conditioning challenge. Load and range should build positions, not ruin them.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "Hold the ball at the chest, step back into a reverse lunge, return to stance, and keep the torso organized.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "Hold the ball at the chest, step back into a reverse lunge, return to stance, and keep the torso organized.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "reps",
        "defaultSets": 3,
        "defaultReps": 6,
        "defaultWorkSeconds": null,
        "defaultRestSeconds": 60,
        "estSecondsPerSet": 30,
        "defaultRpeMin": 5,
        "defaultRpeMax": 7,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable."
      },
      "scaling": {
        "youthBeginner": "Use a light soft medicine ball, lower target, shorter range of motion, and single-rep resets. Coach the catch before adding continuous reps.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use the full version with the intended phase dose: low-volume full-rest work for Output or controlled intervals for Sustained Capacity.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "General temperature raise",
          "Hip and ankle mobility",
          "Front-rack breathing squat"
        ],
        "pairsWellBefore": [
          "Main wall-ball interval",
          "Medicine-ball power block",
          "Strength support block"
        ],
        "avoidPairingWith": [
          "High-fatigue burpee circuits before skill or power work",
          "Max effort sprinting immediately after sloppy wall-ball intervals",
          "Heavy overhead fatigue before shoulder-sensitive athletes throw"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 0,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
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
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": false,
        "fatigueCost": 3,
        "fatigueSensitivity": 3,
        "technicalComplexity": 3,
        "intensityCeiling": "moderate",
        "impactLevel": 0
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 48,
      "slug": "tall-kneeling-chest-pass-to-wall",
      "name": "Tall-Kneeling Chest Pass to Wall",
      "family": "Upper-body wall throw support",
      "category": "41-50 - Support Exercises and Prerequisites for Better Wall Balls",
      "primaryPhaseKey": "output",
      "subrole": "jump_throw_explosive_power",
      "subroleSecondary": "upper_body_chest_pass",
      "slot": "tall_kneeling_chest_pass_to_wall",
      "cardSummary": "Tall-Kneeling Chest Pass to Wall trains low-impact chest pass that trains fast hand release and trunk stiffness for wall-ball transfer. It belongs in Output when the coach wants support exercises and prerequisites for better wall balls without losing wall-ball mechanics.",
      "selectionReason": "Low-impact chest pass that trains fast hand release and trunk stiffness for wall-ball transfer.",
      "bestPlacement": "Use after a general warm-up and before heavy strength or conditioning.",
      "description": "Kneel tall, brace, chest-pass the ball to the wall, and catch the rebound with quiet ribs and hands.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Belongs in Output because the goal is high-intent throwing, power, speed of extension, or short acceleration with low volume and full recovery. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Snap from the chest.",
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
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        },
        {
          "key": "plyometrics",
          "weight": 2
        }
      ],
      "physiology": [
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
          "key": "push",
          "weight": 5
        },
        {
          "key": "brace",
          "weight": 4
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "shoulder",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "spine",
          "weight": 3
        },
        {
          "key": "hip",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "front-rack catch",
          "overhead reach",
          "squat",
          "triple extension"
        ],
        "primaryTissues": [
          "anterior core",
          "calves",
          "glutes",
          "quadriceps",
          "shoulders",
          "triceps"
        ],
        "breathingDemand": "moderate",
        "balanceDemand": "low-to-moderate",
        "coordinationDemand": "high",
        "impactLevel": 0
      },
      "whyItWorks": "Tall-Kneeling Chest Pass to Wall improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Output because the goal is high-intent throwing, power, speed of extension, or short acceleration with low volume and full recovery.",
      "commonMisuse": "Do not turn this into a high-rep wall-ball workout. Full rest and clean speed are the point.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "Kneel tall, brace, chest-pass the ball to the wall, and catch the rebound with quiet ribs and hands.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "Kneel tall, brace, chest-pass the ball to the wall, and catch the rebound with quiet ribs and hands.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "attempts",
        "defaultSets": 4,
        "defaultReps": null,
        "defaultWorkSeconds": null,
        "defaultRestSeconds": 60,
        "estSecondsPerSet": 25,
        "defaultRpeMin": 5,
        "defaultRpeMax": 7,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable.",
        "defaultAttempts": 5
      },
      "scaling": {
        "youthBeginner": "Use a light soft medicine ball, lower target, shorter range of motion, and single-rep resets. Coach the catch before adding continuous reps.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use low-volume, high-intent attempts with full rest. Progress with speed, accuracy, or target challenge before volume.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "Prepare & Access mobility",
          "Catch-and-freeze rehearsal",
          "Low-target accuracy set"
        ],
        "pairsWellBefore": [
          "Strength work",
          "Sustained Capacity",
          "Sport conditioning"
        ],
        "avoidPairingWith": [
          "Long conditioning blocks before the drill",
          "Heavy shoulder fatigue",
          "High-rep wall balls that reduce throw speed"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 0,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": false,
        "countsAsNeural": true,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": true,
        "fatigueCost": 4,
        "fatigueSensitivity": 5,
        "technicalComplexity": 3,
        "intensityCeiling": "high",
        "impactLevel": 0
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 49,
      "slug": "half-kneeling-chest-pass-to-wall",
      "name": "Half-Kneeling Chest Pass to Wall",
      "family": "Split-position throw support",
      "category": "41-50 - Support Exercises and Prerequisites for Better Wall Balls",
      "primaryPhaseKey": "output",
      "subrole": "jump_throw_explosive_power",
      "subroleSecondary": "half_kneeling_throw",
      "slot": "half_kneeling_chest_pass_to_wall",
      "cardSummary": "Half-Kneeling Chest Pass to Wall trains split-position chest pass that challenges trunk and pelvis control while throwing. It belongs in Output when the coach wants support exercises and prerequisites for better wall balls without losing wall-ball mechanics.",
      "selectionReason": "Split-position chest pass that challenges trunk and pelvis control while throwing.",
      "bestPlacement": "Use after a general warm-up and before heavy strength or conditioning.",
      "description": "From half-kneeling, chest-pass to the wall and catch without shifting the pelvis or arching through the back.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Belongs in Output because the goal is high-intent throwing, power, speed of extension, or short acceleration with low volume and full recovery. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Throw without drifting.",
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
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        },
        {
          "key": "plyometrics",
          "weight": 2
        }
      ],
      "physiology": [
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
          "key": "push",
          "weight": 5
        },
        {
          "key": "brace",
          "weight": 4
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "shoulder",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "spine",
          "weight": 3
        },
        {
          "key": "hip",
          "weight": 3
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "front-rack catch",
          "overhead reach",
          "split-stance control",
          "squat",
          "triple extension"
        ],
        "primaryTissues": [
          "anterior core",
          "calves",
          "glutes",
          "hip stabilizers",
          "quadriceps",
          "shoulders",
          "triceps"
        ],
        "breathingDemand": "moderate",
        "balanceDemand": "low-to-moderate",
        "coordinationDemand": "high",
        "impactLevel": 0
      },
      "whyItWorks": "Half-Kneeling Chest Pass to Wall improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Output because the goal is high-intent throwing, power, speed of extension, or short acceleration with low volume and full recovery.",
      "commonMisuse": "Do not turn this into a high-rep wall-ball workout. Full rest and clean speed are the point.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "From half-kneeling, chest-pass to the wall and catch without shifting the pelvis or arching through the back.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "From half-kneeling, chest-pass to the wall and catch without shifting the pelvis or arching through the back.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "attempts",
        "defaultSets": 4,
        "defaultReps": null,
        "defaultWorkSeconds": null,
        "defaultRestSeconds": 60,
        "estSecondsPerSet": 20,
        "defaultRpeMin": 5,
        "defaultRpeMax": 7,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable.",
        "defaultAttempts": 4
      },
      "scaling": {
        "youthBeginner": "Use a light soft medicine ball, lower target, shorter range of motion, and single-rep resets. Coach the catch before adding continuous reps.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use low-volume, high-intent attempts with full rest. Progress with speed, accuracy, or target challenge before volume.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "Prepare & Access mobility",
          "Catch-and-freeze rehearsal",
          "Low-target accuracy set"
        ],
        "pairsWellBefore": [
          "Strength work",
          "Sustained Capacity",
          "Sport conditioning"
        ],
        "avoidPairingWith": [
          "Long conditioning blocks before the drill",
          "Heavy shoulder fatigue",
          "High-rep wall balls that reduce throw speed"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 0,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
        ]
      },
      "regimen": {
        "canBeDaily": false,
        "weeklyMaxFrequency": 2,
        "minimumHoursBetweenHardExposures": 48,
        "countsAsHighIntensity": true,
        "countsAsHighImpact": false,
        "countsAsNeural": true,
        "countsAsTissueStress": true,
        "countsAsConditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": true,
        "fatigueCost": 4,
        "fatigueSensitivity": 5,
        "technicalComplexity": 3,
        "intensityCeiling": "high",
        "impactLevel": 0
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    },
    {
      "id": 50,
      "slug": "medicine-ball-dead-bug-pullover",
      "name": "Medicine Ball Dead Bug Pullover",
      "family": "Trunk and shoulder support",
      "category": "41-50 - Support Exercises and Prerequisites for Better Wall Balls",
      "primaryPhaseKey": "resilience",
      "subrole": "trunk_pelvis_anti_movement_control",
      "subroleSecondary": "shoulder_trunk_control",
      "slot": "medicine_ball_dead_bug_pullover",
      "cardSummary": "Medicine Ball Dead Bug Pullover trains trunk-control accessory that supports overhead reach, rib position, and breathing for wall-ball athletes. It belongs in Resilience when the coach wants support exercises and prerequisites for better wall balls without losing wall-ball mechanics.",
      "selectionReason": "Trunk-control accessory that supports overhead reach, rib position, and breathing for wall-ball athletes.",
      "bestPlacement": "Use in the Capacity/Resilience support block after skill or power work.",
      "description": "Lie on the back, hold the medicine ball over the chest, lower the ball or limbs only as far as the low back and ribs stay controlled.",
      "coachLanguage": "Primary subrole: trunk_pelvis_anti_movement_control. Belongs in Resilience because the drill builds controlled receiving, bracing, trunk position, joint ownership, and durable positions rather than speed or conditioning. Coach wall-ball work by phase intent: skill reps stay crisp, power reps stay fresh, support drills stay controlled, and conditioning stops when quality drops.",
      "athleteLanguage": "Ribs stay quiet.",
      "tenets": [
        {
          "key": "body_control",
          "weight": 5
        },
        {
          "key": "balance",
          "weight": 3
        },
        {
          "key": "strength",
          "weight": 2
        },
        {
          "key": "coordination",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "isometrics",
          "weight": 3
        },
        {
          "key": "core_body_control",
          "weight": 5
        },
        {
          "key": "balance_stability",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "control_stability",
          "weight": 5
        },
        {
          "key": "force_tissue_capacity",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "brace",
          "weight": 5
        },
        {
          "key": "push",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "wall",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "core",
          "weight": 5
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "spine",
          "weight": 3
        },
        {
          "key": "hip",
          "weight": 2
        }
      ],
      "movementRequirements": {
        "primaryJointActions": [
          "anti-extension bracing",
          "controlled hip flexion",
          "shoulder flexion"
        ],
        "primaryTissues": [
          "anterior core",
          "hip flexors",
          "lats",
          "shoulders"
        ],
        "breathingDemand": "low-to-moderate",
        "balanceDemand": "low-to-moderate",
        "coordinationDemand": "moderate",
        "impactLevel": 0
      },
      "whyItWorks": "Medicine Ball Dead Bug Pullover improves wall-ball performance by matching the constraint that matters most: squat organization, ball path, target accuracy, trunk stiffness, catching, breathing, or repeatability. The drill creates a clear coaching problem and lets the coach progress one variable at a time: ball load, target height, squat depth, speed, rest, complexity, or total volume.",
      "whyItGoesHere": "Belongs in Resilience because the drill builds controlled receiving, bracing, trunk position, joint ownership, and durable positions rather than speed or conditioning.",
      "commonMisuse": "Do not turn controlled holds, catches, or bracing work into speed reps. The value is control under manageable stress.",
      "scalingGuidance": "Scale by reducing ball weight, target height, squat depth, throw speed, movement complexity, total reps, work duration, or conditioning density before increasing intensity. The quality gate decides progression.",
      "coachingExecution": {
        "movementDescription": "Lie on the back, hold the medicine ball over the chest, lower the ball or limbs only as far as the low back and ribs stay controlled.",
        "setup": [
          "Choose a medicine-ball weight that the athlete can catch without bracing through the face, neck, or low back.",
          "Use a clear wall target, safe wall surface, non-slip floor, and enough space so misses do not strike another athlete.",
          "Start with feet under the hips or in the stance required by the card, ball held high at the chest unless the variation says otherwise."
        ],
        "executionSteps": [
          "Organize the ribs over the pelvis, grip the ball securely, and establish the target or movement lane before the rep begins.",
          "Lie on the back, hold the medicine ball over the chest, lower the ball or limbs only as far as the low back and ribs stay controlled.",
          "Finish each rep with the ball, feet, trunk, and eyes controlled before starting the next rep.",
          "End the set as soon as catch quality, squat depth, target accuracy, breathing rhythm, or spacing breaks down."
        ],
        "coachCues": [
          "Ball high at the chest.",
          "Ribs stacked over hips.",
          "Drive the floor away.",
          "Throw through the target.",
          "Catch soft and reset."
        ],
        "commonFaults": [
          "Letting the ball pull the chest and eyes down during the catch.",
          "Throwing from the low back instead of extending through legs, trunk, and arms together.",
          "Choosing a ball that is too heavy or a target that is too high for clean rhythm.",
          "Turning a skill or power drill into conditioning by rushing the next rep."
        ],
        "breathingCues": [
          "Inhale or reset breath as the ball returns or before the descent.",
          "Exhale through the drive and throw without losing trunk position.",
          "During intervals, use small planned breaths between reps rather than holding breath across the set."
        ],
        "qualityGate": "Rep counts only when squat position, target accuracy, ball path, catch safety, and breathing remain repeatable.",
        "stopSigns": [
          "Shoulder, wrist, back, hip, knee, ankle, neck, or pelvic-floor symptoms.",
          "Repeated missed targets, face-level catches, dropped balls, or uncontrolled rebounds.",
          "Knees collapse, heels consistently lift, trunk folds, or the athlete cannot reset breathing.",
          "Crowded lane, unsafe wall surface, or ball weight too heavy to receive safely."
        ]
      },
      "dosage": {
        "volumeUnit": "reps",
        "defaultSets": 3,
        "defaultReps": 6,
        "defaultWorkSeconds": null,
        "defaultRestSeconds": 45,
        "estSecondsPerSet": 30,
        "defaultRpeMin": 3,
        "defaultRpeMax": 5,
        "loadGuidance": "Use the lightest ball that lets the athlete meet the quality gate; progress load only after catch, target, and squat mechanics are stable."
      },
      "scaling": {
        "youthBeginner": "Use a light soft medicine ball, lower target, shorter range of motion, and single-rep resets. Coach the catch before adding continuous reps.",
        "youthIntermediate": "Use small sets of 3-6 quality reps or short intervals. Progress target height only after the athlete catches cleanly and squats without collapsing.",
        "teen": "Use standard wall-ball mechanics when mobility and catch skill are consistent. Add volume or load one variable at a time, never both together.",
        "adultBeginner": "Start with medicine-ball front squats, no-release thrusters, or low-target wall balls. Keep reps low until breathing and catch rhythm are stable.",
        "adultAdvanced": "Use the full version with the intended phase dose: low-volume full-rest work for Output or controlled intervals for Sustained Capacity.",
        "olderAdult": "Favor lighter balls, lower targets, partial depth, no-release thrusters, or chest-pass variations. Avoid fast rebounds if reaction or shoulder tolerance is limited.",
        "pregnancyPostpartum": "Use only when medically cleared and symptom-free. Avoid high-pressure bracing, heavy balls, breath holding, jumping, and high-rep fatigue; substitute low-target throws, no-release thrusters, or carries when appropriate."
      },
      "pairing": {
        "pairsWellAfter": [
          "General temperature raise",
          "Hip and ankle mobility",
          "Front-rack breathing squat"
        ],
        "pairsWellBefore": [
          "Main wall-ball interval",
          "Medicine-ball power block",
          "Strength support block"
        ],
        "avoidPairingWith": [
          "High-fatigue burpee circuits before skill or power work",
          "Max effort sprinting immediately after sloppy wall-ball intervals",
          "Heavy overhead fatigue before shoulder-sensitive athletes throw"
        ]
      },
      "safety": {
        "riskLevel": 2,
        "impactLevel": 0,
        "requiresSpotting": false,
        "requiresCoachSupervision": "recommended",
        "readinessChecks": [
          "Athlete can squat to the chosen depth pain-free while keeping balance and trunk position.",
          "Athlete can reach overhead or throw to the chosen target without shoulder, back, neck, or wrist symptoms.",
          "Athlete can catch the selected medicine ball at chest height without flinching, face contact, or trunk collapse.",
          "Wall, target, floor, ball, footwear, spacing, and other athletes are safe for rebounds and misses."
        ],
        "contraindications": [
          "Acute shoulder, wrist, back, hip, knee, ankle, or neck injury aggravated by squatting, throwing, or catching.",
          "Uncontrolled catch mechanics, repeated missed targets, dizziness, concussion symptoms, or unsafe ball rebound path.",
          "Pregnancy/postpartum symptoms, pelvic heaviness, leaking, pain, or pressure with impact, bracing, or high-rep fatigue unless cleared and regressed."
        ],
        "commonSubstitutions": [
          "Medicine Ball Front Squat",
          "Medicine Ball Thruster (No Release)",
          "Half Wall Ball Shot",
          "Tall-Kneeling Chest Pass to Wall",
          "Wall Ball Target Tap"
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
      "phaseProfile": {
        "role": "primary",
        "fitWeight": 5,
        "freshnessRequired": false,
        "fatigueCost": 2,
        "fatigueSensitivity": 3,
        "technicalComplexity": 3,
        "intensityCeiling": "moderate",
        "impactLevel": 0
      },
      "authoringNotes": {
        "cardShape": "Card v2 Authoring format from exercise_card_details_for_llm.md",
        "slotNote": "Slot keys are proposed wall-ball-specific order slots and should be matched to existing database slots or added with migration/rationale before publishing.",
        "sourceCaveat": "Purpose.txt was requested but not located in accessible File Library results during this run."
      }
    }
  ]
}
```
