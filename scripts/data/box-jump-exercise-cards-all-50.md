# Box Jump Exercise Cards Batch 1-10
Copy the JSON block below into Cursor or an import script.
```json
{
  "cluster": {
    "topic": "box_jump_focused_exercises",
    "card_count": 10,
    "format": "Vortex Card v2 Authoring JSON (camelCase)",
    "notes": "Slot keys are intent-clear authoring slots; verify exact phase_order_slot keys against the application database before import.",
    "batch": "1-10"
  },
  "cards": [
    {
      "slug": "snap-down-to-stick",
      "name": "Snap Down to Stick",
      "family": "Box Jump Landing & Braking Control",
      "subrole": "landing_braking_control",
      "slot": "landing_stick_foundation",
      "primaryPhaseKey": "resilience",
      "cardSummary": "Box-jump-focused exercise that teaches fast hip-load timing and quiet two-foot landing mechanics before any box height is added. Best used when the coach wants landing control without violating session order.",
      "bestPlacement": "Resilience block after warm-up, Output, or Capacity when the goal is landing control rather than maximal jump height.",
      "description": "Snap Down to Stick is a box-jump-family landing-control drill. The athlete uses the box or drop height only as high as they can absorb quietly, holds the landing shape, then resets before the next attempt. The main goal is braking skill, joint alignment, and tissue tolerance rather than chasing height or fatigue.",
      "coachLanguage": "Primary subrole: landing_braking_control. Slot: landing_stick_foundation. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
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
          "key": "strength",
          "weight": 2
        }
      ],
      "methodologies": [
        {
          "key": "plyometrics",
          "weight": 3
        },
        {
          "key": "balance_stability",
          "weight": 5
        },
        {
          "key": "eccentric_negative",
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
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Snap Down to Stick lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Resilience because the adaptation target is braking quality, landing tolerance, and joint control, not maximal power.",
      "commonMisuse": "Rushing to height or speed before the athlete can stick the landing; this changes a control drill into uncontrolled impact.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "dynamic",
        "coordination_demand": "moderate",
        "impact_level": 2
      },
      "coachingExecution": {
        "movement_description": "Snap Down to Stick is a box-jump-family landing-control drill. The athlete uses the box or drop height only as high as they can absorb quietly, holds the landing shape, then resets before the next attempt. The main goal is braking skill, joint alignment, and tissue tolerance rather than chasing height or fatigue.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Begin in an athletic stance with eyes on the top/front edge of the box."
        ],
        "execution_steps": [
          "Move or drop into the landing with a quiet, controlled foot contact.",
          "Absorb through the ankles, knees, and hips while keeping ribs stacked over pelvis.",
          "Hold the stick for two full seconds before stepping down and resetting."
        ],
        "coach_cues": [
          "Own the stick before adding height.",
          "Absorb through ankle, knee, and hip together.",
          "No knee cave or torso collapse.",
          "Stop as soon as landings get loud."
        ],
        "athlete_cues": [
          "Land soft and freeze.",
          "Knees point the same way as toes.",
          "Hold still before you move."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Landing noise increases across reps",
          "Knees cave or feet collapse inward",
          "Athlete cannot hold the stick",
          "Torso folds forward on contact"
        ],
        "quality_gate": [
          "Athlete holds the stick for two seconds",
          "Landing is quiet and symmetrical enough for the drill",
          "Athlete can explain or demonstrate the safer step-down reset"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "attempts",
        "default_sets": 2,
        "default_reps": 4,
        "default_work_seconds": null,
        "default_rest_seconds": 45,
        "est_seconds_per_set": 35,
        "default_rpe_min": 4,
        "default_rpe_max": 6
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Snap Down to Stick; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Low Box Jump to Stick",
        "Countermovement Box Jump"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep",
        "control_landing",
        "resilience"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=x1nBhDLUUi0",
        "https://www.youtube.com/watch?v=6HFB64kFeNk",
        "https://www.youtube.com/watch?v=1IDRgtr4u6g"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 4,
        "load": 5,
        "complexity": 3,
        "overall": 5,
        "recommended_age_min": 4,
        "recommended_age_max": null,
        "attention_demand": "moderate",
        "notes": "Foundation box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 2,
        "impact_level": 2,
        "requires_spotting": false,
        "requires_coach_supervision": "optional",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 4,
        "minimum_hours_between_hard_exposures": 24,
        "counts_as_high_intensity": false,
        "counts_as_high_impact": false,
        "counts_as_neural": false,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": false,
        "fatigue_cost": 3,
        "fatigue_sensitivity": 3,
        "technical_complexity": 3,
        "impact_level": 2,
        "intensity_ceiling": "moderate"
      },
      "subroleSecondary": "jump_throw_explosive_power"
    },
    {
      "slug": "low-box-step-off-to-stick",
      "name": "Low Box Step-Off to Stick",
      "family": "Box Jump Landing & Braking Control",
      "subrole": "landing_braking_control",
      "slot": "landing_stick_foundation",
      "primaryPhaseKey": "resilience",
      "cardSummary": "Box-jump-focused exercise that builds eccentric landing absorption from a low box without the distraction of jumping up first. Best used when the coach wants landing control without violating session order.",
      "bestPlacement": "Resilience block after warm-up, Output, or Capacity when the goal is landing control rather than maximal jump height.",
      "description": "Low Box Step-Off to Stick is a box-jump-family landing-control drill. The athlete uses the box or drop height only as high as they can absorb quietly, holds the landing shape, then resets before the next attempt. The main goal is braking skill, joint alignment, and tissue tolerance rather than chasing height or fatigue.",
      "coachLanguage": "Primary subrole: landing_braking_control. Slot: landing_stick_foundation. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
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
          "key": "strength",
          "weight": 2
        }
      ],
      "methodologies": [
        {
          "key": "plyometrics",
          "weight": 3
        },
        {
          "key": "balance_stability",
          "weight": 5
        },
        {
          "key": "eccentric_negative",
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
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Low Box Step-Off to Stick lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Resilience because the adaptation target is braking quality, landing tolerance, and joint control, not maximal power.",
      "commonMisuse": "Rushing to height or speed before the athlete can stick the landing; this changes a control drill into uncontrolled impact.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "dynamic",
        "coordination_demand": "moderate",
        "impact_level": 2
      },
      "coachingExecution": {
        "movement_description": "Low Box Step-Off to Stick is a box-jump-family landing-control drill. The athlete uses the box or drop height only as high as they can absorb quietly, holds the landing shape, then resets before the next attempt. The main goal is braking skill, joint alignment, and tissue tolerance rather than chasing height or fatigue.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Stand tall on the first low box with toes close to the edge and arms relaxed but ready."
        ],
        "execution_steps": [
          "Move or drop into the landing with a quiet, controlled foot contact.",
          "Absorb through the ankles, knees, and hips while keeping ribs stacked over pelvis.",
          "Hold the stick for two full seconds before stepping down and resetting."
        ],
        "coach_cues": [
          "Own the stick before adding height.",
          "Absorb through ankle, knee, and hip together.",
          "No knee cave or torso collapse.",
          "Stop as soon as landings get loud."
        ],
        "athlete_cues": [
          "Land soft and freeze.",
          "Knees point the same way as toes.",
          "Hold still before you move."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Landing noise increases across reps",
          "Knees cave or feet collapse inward",
          "Athlete cannot hold the stick",
          "Torso folds forward on contact"
        ],
        "quality_gate": [
          "Athlete holds the stick for two seconds",
          "Landing is quiet and symmetrical enough for the drill",
          "Athlete can explain or demonstrate the safer step-down reset"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "attempts",
        "default_sets": 2,
        "default_reps": 4,
        "default_work_seconds": null,
        "default_rest_seconds": 45,
        "est_seconds_per_set": 35,
        "default_rpe_min": 4,
        "default_rpe_max": 6
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Low Box Step-Off to Stick; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Low Box Jump to Stick",
        "Countermovement Box Jump"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep",
        "control_landing",
        "resilience"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=yG8pexv9J6g",
        "https://www.youtube.com/watch?v=GZLyZCqF8BQ",
        "https://www.youtube.com/watch?v=6HFB64kFeNk"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 4,
        "load": 5,
        "complexity": 3,
        "overall": 5,
        "recommended_age_min": 4,
        "recommended_age_max": null,
        "attention_demand": "moderate",
        "notes": "Foundation box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 2,
        "impact_level": 2,
        "requires_spotting": false,
        "requires_coach_supervision": "optional",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 4,
        "minimum_hours_between_hard_exposures": 24,
        "counts_as_high_intensity": false,
        "counts_as_high_impact": false,
        "counts_as_neural": false,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": false,
        "fatigue_cost": 3,
        "fatigue_sensitivity": 3,
        "technical_complexity": 3,
        "impact_level": 2,
        "intensity_ceiling": "moderate"
      },
      "subroleSecondary": "jump_throw_explosive_power"
    },
    {
      "slug": "depth-drop-to-athletic-stick",
      "name": "Depth Drop to Athletic Stick",
      "family": "Box Jump Landing & Braking Control",
      "subrole": "landing_braking_control",
      "slot": "landing_braking_control",
      "primaryPhaseKey": "resilience",
      "cardSummary": "Box-jump-focused exercise that uses a controlled drop from a small box to train braking, posture, and force absorption. Best used when the coach wants landing control without violating session order.",
      "bestPlacement": "Resilience block after warm-up, Output, or Capacity when the goal is landing control rather than maximal jump height.",
      "description": "Depth Drop to Athletic Stick is a box-jump-family landing-control drill. The athlete uses the box or drop height only as high as they can absorb quietly, holds the landing shape, then resets before the next attempt. The main goal is braking skill, joint alignment, and tissue tolerance rather than chasing height or fatigue.",
      "coachLanguage": "Primary subrole: landing_braking_control. Slot: landing_braking_control. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
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
          "key": "strength",
          "weight": 2
        }
      ],
      "methodologies": [
        {
          "key": "plyometrics",
          "weight": 3
        },
        {
          "key": "balance_stability",
          "weight": 5
        },
        {
          "key": "eccentric_negative",
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
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Depth Drop to Athletic Stick lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Resilience because the adaptation target is braking quality, landing tolerance, and joint control, not maximal power.",
      "commonMisuse": "Rushing to height or speed before the athlete can stick the landing; this changes a control drill into uncontrolled impact.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "dynamic",
        "coordination_demand": "moderate",
        "impact_level": 3
      },
      "coachingExecution": {
        "movement_description": "Depth Drop to Athletic Stick is a box-jump-family landing-control drill. The athlete uses the box or drop height only as high as they can absorb quietly, holds the landing shape, then resets before the next attempt. The main goal is braking skill, joint alignment, and tissue tolerance rather than chasing height or fatigue.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Stand tall on the first low box with toes close to the edge and arms relaxed but ready."
        ],
        "execution_steps": [
          "Move or drop into the landing with a quiet, controlled foot contact.",
          "Absorb through the ankles, knees, and hips while keeping ribs stacked over pelvis.",
          "Hold the stick for two full seconds before stepping down and resetting."
        ],
        "coach_cues": [
          "Own the stick before adding height.",
          "Absorb through ankle, knee, and hip together.",
          "No knee cave or torso collapse.",
          "Stop as soon as landings get loud."
        ],
        "athlete_cues": [
          "Land soft and freeze.",
          "Knees point the same way as toes.",
          "Hold still before you move."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Landing noise increases across reps",
          "Knees cave or feet collapse inward",
          "Athlete cannot hold the stick",
          "Torso folds forward on contact"
        ],
        "quality_gate": [
          "Athlete holds the stick for two seconds",
          "Landing is quiet and symmetrical enough for the drill",
          "Athlete can explain or demonstrate the safer step-down reset"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "attempts",
        "default_sets": 2,
        "default_reps": 3,
        "default_work_seconds": null,
        "default_rest_seconds": 45,
        "est_seconds_per_set": 35,
        "default_rpe_min": 4,
        "default_rpe_max": 6
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Depth Drop to Athletic Stick; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Low Box Jump to Stick",
        "Countermovement Box Jump"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep",
        "control_landing",
        "resilience"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=yG8pexv9J6g",
        "https://www.youtube.com/watch?v=GZLyZCqF8BQ",
        "https://www.youtube.com/watch?v=wU_VFDemCk0"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 4,
        "load": 6,
        "complexity": 3,
        "overall": 6,
        "recommended_age_min": 4,
        "recommended_age_max": null,
        "attention_demand": "moderate",
        "notes": "Foundation box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 2,
        "impact_level": 3,
        "requires_spotting": false,
        "requires_coach_supervision": "optional",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 4,
        "minimum_hours_between_hard_exposures": 24,
        "counts_as_high_intensity": false,
        "counts_as_high_impact": true,
        "counts_as_neural": false,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": false,
        "fatigue_cost": 3,
        "fatigue_sensitivity": 3,
        "technical_complexity": 3,
        "impact_level": 3,
        "intensity_ceiling": "moderate"
      },
      "subroleSecondary": "jump_throw_explosive_power"
    },
    {
      "slug": "single-leg-depth-drop-to-stick",
      "name": "Single-Leg Depth Drop to Stick",
      "family": "Box Jump Landing & Braking Control",
      "subrole": "single_leg_balance_foot_ankle_hip_control",
      "slot": "single_leg_landing_control",
      "primaryPhaseKey": "resilience",
      "cardSummary": "Box-jump-focused exercise that progresses landing control to single-leg foot, ankle, knee, and hip alignment. Best used when the coach wants landing control without violating session order.",
      "bestPlacement": "Resilience block after warm-up, Output, or Capacity when the goal is landing control rather than maximal jump height.",
      "description": "Single-Leg Depth Drop to Stick is a box-jump-family landing-control drill. The athlete uses the box or drop height only as high as they can absorb quietly, holds the landing shape, then resets before the next attempt. The main goal is braking skill, joint alignment, and tissue tolerance rather than chasing height or fatigue.",
      "coachLanguage": "Primary subrole: single_leg_balance_foot_ankle_hip_control. Slot: single_leg_landing_control. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
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
          "key": "strength",
          "weight": 2
        }
      ],
      "methodologies": [
        {
          "key": "plyometrics",
          "weight": 3
        },
        {
          "key": "balance_stability",
          "weight": 5
        },
        {
          "key": "eccentric_negative",
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
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Single-Leg Depth Drop to Stick lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Resilience because the adaptation target is braking quality, landing tolerance, and joint control, not maximal power.",
      "commonMisuse": "Rushing to height or speed before the athlete can stick the landing; this changes a control drill into uncontrolled impact.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "single_leg",
        "coordination_demand": "high",
        "impact_level": 4
      },
      "coachingExecution": {
        "movement_description": "Single-Leg Depth Drop to Stick is a box-jump-family landing-control drill. The athlete uses the box or drop height only as high as they can absorb quietly, holds the landing shape, then resets before the next attempt. The main goal is braking skill, joint alignment, and tissue tolerance rather than chasing height or fatigue.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Set up on the working leg with the stance foot rooted and the box low enough to keep the knee tracking clean."
        ],
        "execution_steps": [
          "Move or drop into the landing with a quiet, controlled foot contact.",
          "Absorb through the ankles, knees, and hips while keeping ribs stacked over pelvis.",
          "Hold the stick for two full seconds before stepping down and resetting."
        ],
        "coach_cues": [
          "Own the stick before adding height.",
          "Absorb through ankle, knee, and hip together.",
          "No knee cave or torso collapse.",
          "Stop as soon as landings get loud.",
          "Pelvis level; do not let the stance hip dump."
        ],
        "athlete_cues": [
          "Land soft and freeze.",
          "Knees point the same way as toes.",
          "Hold still before you move.",
          "Balance before the next rep."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Landing noise increases across reps",
          "Knees cave or feet collapse inward",
          "Athlete cannot hold the stick",
          "Torso folds forward on contact"
        ],
        "quality_gate": [
          "Athlete holds the stick for two seconds",
          "Landing is quiet and symmetrical enough for the drill",
          "Athlete can explain or demonstrate the safer step-down reset",
          "Single-leg balance is held without hopping"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "attempts",
        "default_sets": 2,
        "default_reps": 3,
        "default_work_seconds": null,
        "default_rest_seconds": 45,
        "est_seconds_per_set": 35,
        "default_rpe_min": 4,
        "default_rpe_max": 6
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Single-Leg Depth Drop to Stick; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Low Box Jump to Stick",
        "Countermovement Box Jump"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep",
        "control_landing",
        "resilience"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=v-DkonrKU28",
        "https://www.youtube.com/watch?v=yG8pexv9J6g",
        "https://www.youtube.com/watch?v=C5uWN9FIU9E"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 7,
        "load": 7,
        "complexity": 6,
        "overall": 7,
        "recommended_age_min": 9,
        "recommended_age_max": null,
        "attention_demand": "high",
        "notes": "Advanced box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 3,
        "impact_level": 4,
        "requires_spotting": false,
        "requires_coach_supervision": "recommended",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface",
          "No prior mastery of lower-level box jumps and landing sticks"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 3,
        "minimum_hours_between_hard_exposures": 48,
        "counts_as_high_intensity": false,
        "counts_as_high_impact": true,
        "counts_as_neural": false,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": false,
        "fatigue_cost": 3,
        "fatigue_sensitivity": 3,
        "technical_complexity": 4,
        "impact_level": 4,
        "intensity_ceiling": "moderate"
      },
      "subroleSecondary": "jump_throw_explosive_power"
    },
    {
      "slug": "box-jump-step-down-reset",
      "name": "Box Jump Step-Down Reset",
      "family": "Box Jump Movement Intelligence",
      "subrole": "balance_coordination_rhythm",
      "slot": "box_jump_mechanics",
      "primaryPhaseKey": "movement_intelligence",
      "cardSummary": "Box-jump-focused exercise that teaches the safest box-jump rhythm: jump up, stick, stand tall, step down, reset before the next rep. Best used when the coach wants technical skill without violating session order.",
      "bestPlacement": "Movement Intelligence block before high-intent jumping; use as crisp teaching reps, not fatigue work.",
      "description": "Box Jump Step-Down Reset is a technical box-jump skill drill. The athlete moves at a teachable speed, coordinates the takeoff and landing sequence, and resets every rep so the pattern stays crisp. It prepares the athlete for higher-intent box jumps without turning the set into conditioning.",
      "coachLanguage": "Primary subrole: balance_coordination_rhythm. Slot: box_jump_mechanics. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
      "tenets": [
        {
          "key": "coordination",
          "weight": 5
        },
        {
          "key": "body_control",
          "weight": 4
        },
        {
          "key": "balance",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 4
        },
        {
          "key": "balance_stability",
          "weight": 3
        },
        {
          "key": "plyometrics",
          "weight": 2
        }
      ],
      "physiology": [
        {
          "key": "perception_action_skill",
          "weight": 4
        },
        {
          "key": "control_stability",
          "weight": 4
        },
        {
          "key": "neural_output_readiness",
          "weight": 2
        }
      ],
      "patterns": [
        {
          "key": "jump",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Box Jump Step-Down Reset lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Movement Intelligence because the athlete is learning timing and spatial control before fatigue or high-intent work.",
      "commonMisuse": "Letting the drill become a race or finisher; the learning target disappears when reps get rushed.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "dynamic",
        "coordination_demand": "moderate",
        "impact_level": 2
      },
      "coachingExecution": {
        "movement_description": "Box Jump Step-Down Reset is a technical box-jump skill drill. The athlete moves at a teachable speed, coordinates the takeoff and landing sequence, and resets every rep so the pattern stays crisp. It prepares the athlete for higher-intent box jumps without turning the set into conditioning.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Begin in an athletic stance with eyes on the top/front edge of the box."
        ],
        "execution_steps": [
          "Load the hips with control and swing the arms in rhythm with the jump pattern.",
          "Jump or move over the box with enough height to clear safely without rushing.",
          "Land, stand tall, step down, and reset before the next rep."
        ],
        "coach_cues": [
          "Jump up, not forward into the box.",
          "Quiet feet on the box.",
          "Knees track over the middle toes.",
          "Step down; do not rebound off a high box."
        ],
        "athlete_cues": [
          "Land like a ninja.",
          "Stick the landing before you stand tall.",
          "Step down and reset."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Box height too high for a clean landing",
          "Knees collapsing inward",
          "Landing on the toes or front edge of the box",
          "Rebounding down from the box instead of stepping down"
        ],
        "quality_gate": [
          "Every landing is quiet and controlled",
          "Athlete steps down safely",
          "No knee valgus, foot collapse, or torso panic",
          "Next rep looks as good as the first rep"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 2,
        "default_reps": 4,
        "default_work_seconds": null,
        "default_rest_seconds": 45,
        "est_seconds_per_set": 40,
        "default_rpe_min": 3,
        "default_rpe_max": 5
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Box Jump Step-Down Reset; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Low Box Jump to Stick",
        "Countermovement Box Jump"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=G-bxQY57mKc",
        "https://www.youtube.com/watch?v=v9cZQqGX1Xk",
        "https://www.youtube.com/watch?v=fTpI4tgjci0"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 4,
        "load": 5,
        "complexity": 3,
        "overall": 5,
        "recommended_age_min": 4,
        "recommended_age_max": null,
        "attention_demand": "moderate",
        "notes": "Foundation box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 2,
        "impact_level": 2,
        "requires_spotting": false,
        "requires_coach_supervision": "optional",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 4,
        "minimum_hours_between_hard_exposures": 24,
        "counts_as_high_intensity": false,
        "counts_as_high_impact": false,
        "counts_as_neural": true,
        "counts_as_tissue_stress": false,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 2,
        "fatigue_sensitivity": 3,
        "technical_complexity": 3,
        "impact_level": 2,
        "intensity_ceiling": "moderate"
      }
    },
    {
      "slug": "low-box-jump-to-stick",
      "name": "Low Box Jump to Stick",
      "family": "Box Jump Explosive Power",
      "subrole": "jump_throw_explosive_power",
      "slot": "low_box_power_stick",
      "primaryPhaseKey": "output",
      "cardSummary": "Box-jump-focused exercise that introduces explosive box jumping with a low height and a complete landing stick. Best used when the coach wants power expression without violating session order.",
      "bestPlacement": "Early Output block after warm-up and before heavy strength; give full recovery and stop while jumps are fast.",
      "description": "Low Box Jump to Stick is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Slot: low_box_power_stick. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
      "tenets": [
        {
          "key": "explosiveness",
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
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Low Box Jump to Stick lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Output because high-speed force expression is freshness-sensitive and should happen before fatigue-producing strength or conditioning.",
      "commonMisuse": "Using box jumps for high-rep fatigue or chasing a box height that forces a deep knee tuck; that turns an Output drill into conditioning and hides poor takeoff quality.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "dynamic",
        "coordination_demand": "moderate",
        "impact_level": 3
      },
      "coachingExecution": {
        "movement_description": "Low Box Jump to Stick is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Begin in an athletic stance with eyes on the top/front edge of the box."
        ],
        "execution_steps": [
          "Load quickly but under control, then drive the floor away with full-body intent.",
          "Land on the box with the whole foot, knees tracking over toes, and chest organized.",
          "Stand tall, step down, and rest long enough for the next rep to be just as explosive."
        ],
        "coach_cues": [
          "Jump up, not forward into the box.",
          "Quiet feet on the box.",
          "Knees track over the middle toes.",
          "Step down; do not rebound off a high box."
        ],
        "athlete_cues": [
          "Land like a ninja.",
          "Stick the landing before you stand tall.",
          "Step down and reset."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Box height too high for a clean landing",
          "Knees collapsing inward",
          "Landing on the toes or front edge of the box",
          "Rebounding down from the box instead of stepping down"
        ],
        "quality_gate": [
          "Every landing is quiet and controlled",
          "Athlete steps down safely",
          "No knee valgus, foot collapse, or torso panic",
          "Next rep looks as good as the first rep"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 3,
        "default_reps": 3,
        "default_work_seconds": null,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 45,
        "default_rpe_min": 7,
        "default_rpe_max": 9
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Low Box Jump to Stick; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Heavy lower-body strength",
        "Sled push",
        "Medicine-ball throws",
        "Acceleration work"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=G-bxQY57mKc",
        "https://www.youtube.com/watch?v=v9cZQqGX1Xk",
        "https://www.youtube.com/watch?v=cLSB_Zn0awM"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 4,
        "load": 6,
        "complexity": 3,
        "overall": 6,
        "recommended_age_min": 4,
        "recommended_age_max": null,
        "attention_demand": "moderate",
        "notes": "Foundation box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 2,
        "impact_level": 3,
        "requires_spotting": false,
        "requires_coach_supervision": "optional",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 3,
        "minimum_hours_between_hard_exposures": 48,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": true,
        "counts_as_neural": true,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 3,
        "impact_level": 3,
        "intensity_ceiling": "high"
      },
      "subroleSecondary": "landing_braking_control"
    },
    {
      "slug": "static-squat-jump-to-box",
      "name": "Static Squat Jump to Box",
      "family": "Box Jump Explosive Power",
      "subrole": "jump_throw_explosive_power",
      "slot": "concentric_box_power",
      "primaryPhaseKey": "output",
      "cardSummary": "Box-jump-focused exercise that builds pure concentric leg drive from a held squat position into a quiet box landing. Best used when the coach wants power expression without violating session order.",
      "bestPlacement": "Early Output block after warm-up and before heavy strength; give full recovery and stop while jumps are fast.",
      "description": "Static Squat Jump to Box is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Slot: concentric_box_power. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
      "tenets": [
        {
          "key": "explosiveness",
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
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Static Squat Jump to Box lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Output because high-speed force expression is freshness-sensitive and should happen before fatigue-producing strength or conditioning.",
      "commonMisuse": "Using box jumps for high-rep fatigue or chasing a box height that forces a deep knee tuck; that turns an Output drill into conditioning and hides poor takeoff quality.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "dynamic",
        "coordination_demand": "moderate",
        "impact_level": 3
      },
      "coachingExecution": {
        "movement_description": "Static Squat Jump to Box is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Begin in an athletic stance with eyes on the top/front edge of the box."
        ],
        "execution_steps": [
          "Set the start position, pause still for one to two seconds, then jump without a bounce.",
          "Land on the box with the whole foot, knees tracking over toes, and chest organized.",
          "Stand tall, step down, and rest long enough for the next rep to be just as explosive."
        ],
        "coach_cues": [
          "Jump up, not forward into the box.",
          "Quiet feet on the box.",
          "Knees track over the middle toes.",
          "Step down; do not rebound off a high box."
        ],
        "athlete_cues": [
          "Land like a ninja.",
          "Stick the landing before you stand tall.",
          "Step down and reset."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Box height too high for a clean landing",
          "Knees collapsing inward",
          "Landing on the toes or front edge of the box",
          "Rebounding down from the box instead of stepping down"
        ],
        "quality_gate": [
          "Every landing is quiet and controlled",
          "Athlete steps down safely",
          "No knee valgus, foot collapse, or torso panic",
          "Next rep looks as good as the first rep"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 3,
        "default_reps": 3,
        "default_work_seconds": null,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 45,
        "default_rpe_min": 7,
        "default_rpe_max": 9
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Static Squat Jump to Box; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Heavy lower-body strength",
        "Sled push",
        "Medicine-ball throws",
        "Acceleration work"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=cUP0GEOXzLg",
        "https://www.youtube.com/watch?v=5DCET9VPfjU",
        "https://www.youtube.com/watch?v=G-bxQY57mKc"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 5,
        "load": 6,
        "complexity": 4,
        "overall": 6,
        "recommended_age_min": 6,
        "recommended_age_max": null,
        "attention_demand": "moderate",
        "notes": "Base box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 2,
        "impact_level": 3,
        "requires_spotting": false,
        "requires_coach_supervision": "optional",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 3,
        "minimum_hours_between_hard_exposures": 48,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": true,
        "counts_as_neural": true,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 3,
        "impact_level": 3,
        "intensity_ceiling": "high"
      },
      "subroleSecondary": "landing_braking_control"
    },
    {
      "slug": "pause-box-jump",
      "name": "Pause Box Jump",
      "family": "Box Jump Explosive Power",
      "subrole": "jump_throw_explosive_power",
      "slot": "concentric_box_power",
      "primaryPhaseKey": "output",
      "cardSummary": "Box-jump-focused exercise that removes the fast countermovement so the athlete must create force from a controlled paused position. Best used when the coach wants power expression without violating session order.",
      "bestPlacement": "Early Output block after warm-up and before heavy strength; give full recovery and stop while jumps are fast.",
      "description": "Pause Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Slot: concentric_box_power. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
      "tenets": [
        {
          "key": "explosiveness",
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
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Pause Box Jump lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Output because high-speed force expression is freshness-sensitive and should happen before fatigue-producing strength or conditioning.",
      "commonMisuse": "Using box jumps for high-rep fatigue or chasing a box height that forces a deep knee tuck; that turns an Output drill into conditioning and hides poor takeoff quality.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "dynamic",
        "coordination_demand": "moderate",
        "impact_level": 3
      },
      "coachingExecution": {
        "movement_description": "Pause Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Begin in an athletic stance with eyes on the top/front edge of the box."
        ],
        "execution_steps": [
          "Set the start position, pause still for one to two seconds, then jump without a bounce.",
          "Land on the box with the whole foot, knees tracking over toes, and chest organized.",
          "Stand tall, step down, and rest long enough for the next rep to be just as explosive."
        ],
        "coach_cues": [
          "Jump up, not forward into the box.",
          "Quiet feet on the box.",
          "Knees track over the middle toes.",
          "Step down; do not rebound off a high box."
        ],
        "athlete_cues": [
          "Land like a ninja.",
          "Stick the landing before you stand tall.",
          "Step down and reset."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Box height too high for a clean landing",
          "Knees collapsing inward",
          "Landing on the toes or front edge of the box",
          "Rebounding down from the box instead of stepping down"
        ],
        "quality_gate": [
          "Every landing is quiet and controlled",
          "Athlete steps down safely",
          "No knee valgus, foot collapse, or torso panic",
          "Next rep looks as good as the first rep"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 3,
        "default_reps": 3,
        "default_work_seconds": null,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 45,
        "default_rpe_min": 7,
        "default_rpe_max": 9
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Pause Box Jump; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Heavy lower-body strength",
        "Sled push",
        "Medicine-ball throws",
        "Acceleration work"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=OupSuT2VFTk",
        "https://www.youtube.com/watch?v=w-DEsTW0jQI",
        "https://www.youtube.com/watch?v=cLSB_Zn0awM"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 5,
        "load": 6,
        "complexity": 4,
        "overall": 6,
        "recommended_age_min": 6,
        "recommended_age_max": null,
        "attention_demand": "moderate",
        "notes": "Base box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 2,
        "impact_level": 3,
        "requires_spotting": false,
        "requires_coach_supervision": "optional",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 3,
        "minimum_hours_between_hard_exposures": 48,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": true,
        "counts_as_neural": true,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 3,
        "impact_level": 3,
        "intensity_ceiling": "high"
      },
      "subroleSecondary": "landing_braking_control"
    },
    {
      "slug": "no-arm-swing-box-jump",
      "name": "No-Arm-Swing Box Jump",
      "family": "Box Jump Explosive Power",
      "subrole": "jump_throw_explosive_power",
      "slot": "concentric_box_power",
      "primaryPhaseKey": "output",
      "cardSummary": "Box-jump-focused exercise that isolates lower-body impulse and trunk stiffness by taking the arm swing away. Best used when the coach wants power expression without violating session order.",
      "bestPlacement": "Early Output block after warm-up and before heavy strength; give full recovery and stop while jumps are fast.",
      "description": "No-Arm-Swing Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Slot: concentric_box_power. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
      "tenets": [
        {
          "key": "explosiveness",
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
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, No-Arm-Swing Box Jump lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Output because high-speed force expression is freshness-sensitive and should happen before fatigue-producing strength or conditioning.",
      "commonMisuse": "Using box jumps for high-rep fatigue or chasing a box height that forces a deep knee tuck; that turns an Output drill into conditioning and hides poor takeoff quality.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "dynamic",
        "coordination_demand": "moderate",
        "impact_level": 3
      },
      "coachingExecution": {
        "movement_description": "No-Arm-Swing Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Begin in an athletic stance with eyes on the top/front edge of the box."
        ],
        "execution_steps": [
          "Hold the arms fixed or lightly crossed, load the hips under control, and jump without arm-swing help.",
          "Land on the box with the whole foot, knees tracking over toes, and chest organized.",
          "Stand tall, step down, and rest long enough for the next rep to be just as explosive."
        ],
        "coach_cues": [
          "Jump up, not forward into the box.",
          "Quiet feet on the box.",
          "Knees track over the middle toes.",
          "Step down; do not rebound off a high box."
        ],
        "athlete_cues": [
          "Land like a ninja.",
          "Stick the landing before you stand tall.",
          "Step down and reset."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Box height too high for a clean landing",
          "Knees collapsing inward",
          "Landing on the toes or front edge of the box",
          "Rebounding down from the box instead of stepping down"
        ],
        "quality_gate": [
          "Every landing is quiet and controlled",
          "Athlete steps down safely",
          "No knee valgus, foot collapse, or torso panic",
          "Next rep looks as good as the first rep"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 3,
        "default_reps": 3,
        "default_work_seconds": null,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 45,
        "default_rpe_min": 7,
        "default_rpe_max": 9
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of No-Arm-Swing Box Jump; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Heavy lower-body strength",
        "Sled push",
        "Medicine-ball throws",
        "Acceleration work"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=2wb7AHBZb1c",
        "https://www.youtube.com/watch?v=G-bxQY57mKc",
        "https://www.youtube.com/watch?v=cLSB_Zn0awM"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 5,
        "load": 6,
        "complexity": 4,
        "overall": 6,
        "recommended_age_min": 6,
        "recommended_age_max": null,
        "attention_demand": "moderate",
        "notes": "Base box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 2,
        "impact_level": 3,
        "requires_spotting": false,
        "requires_coach_supervision": "optional",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 3,
        "minimum_hours_between_hard_exposures": 48,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": true,
        "counts_as_neural": true,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 3,
        "impact_level": 3,
        "intensity_ceiling": "high"
      },
      "subroleSecondary": "landing_braking_control"
    },
    {
      "slug": "box-jump-with-altitude-landing",
      "name": "Box Jump with Altitude Landing",
      "family": "Box Jump Landing & Braking Control",
      "subrole": "landing_braking_control",
      "slot": "landing_braking_control",
      "primaryPhaseKey": "resilience",
      "cardSummary": "Box-jump-focused exercise that pairs an upward jump with a deliberate drop-and-stick to train landing tolerance after box contact. Best used when the coach wants landing control without violating session order.",
      "bestPlacement": "Resilience block after warm-up, Output, or Capacity when the goal is landing control rather than maximal jump height.",
      "description": "Box Jump with Altitude Landing is a box-jump-family landing-control drill. The athlete uses the box or drop height only as high as they can absorb quietly, holds the landing shape, then resets before the next attempt. The main goal is braking skill, joint alignment, and tissue tolerance rather than chasing height or fatigue.",
      "coachLanguage": "Primary subrole: landing_braking_control. Slot: landing_braking_control. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
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
          "key": "strength",
          "weight": 2
        }
      ],
      "methodologies": [
        {
          "key": "plyometrics",
          "weight": 3
        },
        {
          "key": "balance_stability",
          "weight": 5
        },
        {
          "key": "eccentric_negative",
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
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Box Jump with Altitude Landing lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Resilience because the adaptation target is braking quality, landing tolerance, and joint control, not maximal power.",
      "commonMisuse": "Rushing to height or speed before the athlete can stick the landing; this changes a control drill into uncontrolled impact.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 4
      },
      "coachingExecution": {
        "movement_description": "Box Jump with Altitude Landing is a box-jump-family landing-control drill. The athlete uses the box or drop height only as high as they can absorb quietly, holds the landing shape, then resets before the next attempt. The main goal is braking skill, joint alignment, and tissue tolerance rather than chasing height or fatigue.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Begin in an athletic stance with eyes on the top/front edge of the box."
        ],
        "execution_steps": [
          "Move or drop into the landing with a quiet, controlled foot contact.",
          "Absorb through the ankles, knees, and hips while keeping ribs stacked over pelvis.",
          "Hold the stick for two full seconds before stepping down and resetting."
        ],
        "coach_cues": [
          "Own the stick before adding height.",
          "Absorb through ankle, knee, and hip together.",
          "No knee cave or torso collapse.",
          "Stop as soon as landings get loud."
        ],
        "athlete_cues": [
          "Land soft and freeze.",
          "Knees point the same way as toes.",
          "Hold still before you move."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Landing noise increases across reps",
          "Knees cave or feet collapse inward",
          "Athlete cannot hold the stick",
          "Torso folds forward on contact"
        ],
        "quality_gate": [
          "Athlete holds the stick for two seconds",
          "Landing is quiet and symmetrical enough for the drill",
          "Athlete can explain or demonstrate the safer step-down reset"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "attempts",
        "default_sets": 2,
        "default_reps": 3,
        "default_work_seconds": null,
        "default_rest_seconds": 45,
        "est_seconds_per_set": 35,
        "default_rpe_min": 4,
        "default_rpe_max": 6
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Box Jump with Altitude Landing; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Low Box Jump to Stick",
        "Countermovement Box Jump"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep",
        "control_landing",
        "resilience"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=ZL54zeg6qjg",
        "https://www.youtube.com/watch?v=v-DkonrKU28",
        "https://www.youtube.com/watch?v=-ZGryFyvnt4"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 7,
        "load": 7,
        "complexity": 6,
        "overall": 7,
        "recommended_age_min": 9,
        "recommended_age_max": null,
        "attention_demand": "high",
        "notes": "Advanced box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 3,
        "impact_level": 4,
        "requires_spotting": false,
        "requires_coach_supervision": "recommended",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface",
          "No prior mastery of lower-level box jumps and landing sticks"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 3,
        "minimum_hours_between_hard_exposures": 48,
        "counts_as_high_intensity": false,
        "counts_as_high_impact": true,
        "counts_as_neural": false,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": false,
        "fatigue_cost": 3,
        "fatigue_sensitivity": 3,
        "technical_complexity": 4,
        "impact_level": 4,
        "intensity_ceiling": "moderate"
      },
      "subroleSecondary": "jump_throw_explosive_power"
    }
  ]
}
```
# Box Jump Exercise Cards Batch 11-20
Copy the JSON block below into Cursor or an import script.
```json
{
  "cluster": {
    "topic": "box_jump_focused_exercises",
    "card_count": 10,
    "format": "Vortex Card v2 Authoring JSON (camelCase)",
    "notes": "Slot keys are intent-clear authoring slots; verify exact phase_order_slot keys against the application database before import.",
    "batch": "11-20"
  },
  "cards": [
    {
      "slug": "countermovement-box-jump",
      "name": "Countermovement Box Jump",
      "family": "Box Jump Explosive Power",
      "subrole": "jump_throw_explosive_power",
      "slot": "box_jump_power",
      "primaryPhaseKey": "output",
      "cardSummary": "Box-jump-focused exercise that the primary box-jump expression for bilateral vertical power with an athletic countermovement. Best used when the coach wants power expression without violating session order.",
      "bestPlacement": "Early Output block after warm-up and before heavy strength; give full recovery and stop while jumps are fast.",
      "description": "Countermovement Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Slot: box_jump_power. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
      "tenets": [
        {
          "key": "explosiveness",
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
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Countermovement Box Jump lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Output because high-speed force expression is freshness-sensitive and should happen before fatigue-producing strength or conditioning.",
      "commonMisuse": "Using box jumps for high-rep fatigue or chasing a box height that forces a deep knee tuck; that turns an Output drill into conditioning and hides poor takeoff quality.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "dynamic",
        "coordination_demand": "moderate",
        "impact_level": 3
      },
      "coachingExecution": {
        "movement_description": "Countermovement Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Begin in an athletic stance with eyes on the top/front edge of the box."
        ],
        "execution_steps": [
          "Load quickly but under control, then drive the floor away with full-body intent.",
          "Land on the box with the whole foot, knees tracking over toes, and chest organized.",
          "Stand tall, step down, and rest long enough for the next rep to be just as explosive."
        ],
        "coach_cues": [
          "Jump up, not forward into the box.",
          "Quiet feet on the box.",
          "Knees track over the middle toes.",
          "Step down; do not rebound off a high box."
        ],
        "athlete_cues": [
          "Land like a ninja.",
          "Stick the landing before you stand tall.",
          "Step down and reset."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Box height too high for a clean landing",
          "Knees collapsing inward",
          "Landing on the toes or front edge of the box",
          "Rebounding down from the box instead of stepping down"
        ],
        "quality_gate": [
          "Every landing is quiet and controlled",
          "Athlete steps down safely",
          "No knee valgus, foot collapse, or torso panic",
          "Next rep looks as good as the first rep"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 3,
        "default_reps": 3,
        "default_work_seconds": null,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 45,
        "default_rpe_min": 7,
        "default_rpe_max": 9
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Countermovement Box Jump; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Heavy lower-body strength",
        "Sled push",
        "Medicine-ball throws",
        "Acceleration work"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=G-bxQY57mKc",
        "https://www.youtube.com/watch?v=VfXl0OV2QV8",
        "https://www.youtube.com/watch?v=d2z2_rRkpAo"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 5,
        "load": 6,
        "complexity": 4,
        "overall": 6,
        "recommended_age_min": 6,
        "recommended_age_max": null,
        "attention_demand": "moderate",
        "notes": "Base box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 2,
        "impact_level": 3,
        "requires_spotting": false,
        "requires_coach_supervision": "optional",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 3,
        "minimum_hours_between_hard_exposures": 48,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": true,
        "counts_as_neural": true,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 3,
        "impact_level": 3,
        "intensity_ceiling": "high"
      },
      "subroleSecondary": "landing_braking_control"
    },
    {
      "slug": "athletic-box-jump-for-height-quality",
      "name": "Athletic Box Jump for Height Quality",
      "family": "Box Jump Explosive Power",
      "subrole": "jump_throw_explosive_power",
      "slot": "box_jump_power",
      "primaryPhaseKey": "output",
      "cardSummary": "Box-jump-focused exercise that develops high-intent vertical projection while capping reps so height never turns into sloppy hip-flexion tricks. Best used when the coach wants power expression without violating session order.",
      "bestPlacement": "Early Output block after warm-up and before heavy strength; give full recovery and stop while jumps are fast.",
      "description": "Athletic Box Jump for Height Quality is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Slot: box_jump_power. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
      "tenets": [
        {
          "key": "explosiveness",
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
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Athletic Box Jump for Height Quality lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Output because high-speed force expression is freshness-sensitive and should happen before fatigue-producing strength or conditioning.",
      "commonMisuse": "Using box jumps for high-rep fatigue or chasing a box height that forces a deep knee tuck; that turns an Output drill into conditioning and hides poor takeoff quality.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "dynamic",
        "coordination_demand": "moderate",
        "impact_level": 3
      },
      "coachingExecution": {
        "movement_description": "Athletic Box Jump for Height Quality is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Begin in an athletic stance with eyes on the top/front edge of the box."
        ],
        "execution_steps": [
          "Load quickly but under control, then drive the floor away with full-body intent.",
          "Land on the box with the whole foot, knees tracking over toes, and chest organized.",
          "Stand tall, step down, and rest long enough for the next rep to be just as explosive."
        ],
        "coach_cues": [
          "Jump up, not forward into the box.",
          "Quiet feet on the box.",
          "Knees track over the middle toes.",
          "Step down; do not rebound off a high box."
        ],
        "athlete_cues": [
          "Land like a ninja.",
          "Stick the landing before you stand tall.",
          "Step down and reset."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Box height too high for a clean landing",
          "Knees collapsing inward",
          "Landing on the toes or front edge of the box",
          "Rebounding down from the box instead of stepping down"
        ],
        "quality_gate": [
          "Every landing is quiet and controlled",
          "Athlete steps down safely",
          "No knee valgus, foot collapse, or torso panic",
          "Next rep looks as good as the first rep"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 3,
        "default_reps": 3,
        "default_work_seconds": null,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 45,
        "default_rpe_min": 7,
        "default_rpe_max": 9
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Athletic Box Jump for Height Quality; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Heavy lower-body strength",
        "Sled push",
        "Medicine-ball throws",
        "Acceleration work"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=cLSB_Zn0awM",
        "https://www.youtube.com/watch?v=H_19zs2b5rs",
        "https://www.youtube.com/watch?v=VfXl0OV2QV8"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 5,
        "load": 6,
        "complexity": 4,
        "overall": 6,
        "recommended_age_min": 6,
        "recommended_age_max": null,
        "attention_demand": "moderate",
        "notes": "Base box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 2,
        "impact_level": 3,
        "requires_spotting": false,
        "requires_coach_supervision": "optional",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 3,
        "minimum_hours_between_hard_exposures": 48,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": true,
        "counts_as_neural": true,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 3,
        "impact_level": 3,
        "intensity_ceiling": "high"
      },
      "subroleSecondary": "landing_braking_control"
    },
    {
      "slug": "seated-box-jump",
      "name": "Seated Box Jump",
      "family": "Box Jump Explosive Power",
      "subrole": "jump_throw_explosive_power",
      "slot": "concentric_box_power",
      "primaryPhaseKey": "output",
      "cardSummary": "Box-jump-focused exercise that starts from a dead-stop seat to train starting strength and rapid hip extension without a countermovement. Best used when the coach wants power expression without violating session order.",
      "bestPlacement": "Early Output block after warm-up and before heavy strength; give full recovery and stop while jumps are fast.",
      "description": "Seated Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Slot: concentric_box_power. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
      "tenets": [
        {
          "key": "explosiveness",
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
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Seated Box Jump lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Output because high-speed force expression is freshness-sensitive and should happen before fatigue-producing strength or conditioning.",
      "commonMisuse": "Using box jumps for high-rep fatigue or chasing a box height that forces a deep knee tuck; that turns an Output drill into conditioning and hides poor takeoff quality.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 3
      },
      "coachingExecution": {
        "movement_description": "Seated Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Sit on a box or bench at a height that allows feet flat, torso tall, and shins nearly vertical."
        ],
        "execution_steps": [
          "Lean slightly forward from the hips, brace, and drive through the floor from a dead stop.",
          "Land on the box with the whole foot, knees tracking over toes, and chest organized.",
          "Stand tall, step down, and rest long enough for the next rep to be just as explosive."
        ],
        "coach_cues": [
          "Jump up, not forward into the box.",
          "Quiet feet on the box.",
          "Knees track over the middle toes.",
          "Step down; do not rebound off a high box."
        ],
        "athlete_cues": [
          "Land like a ninja.",
          "Stick the landing before you stand tall.",
          "Step down and reset."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Box height too high for a clean landing",
          "Knees collapsing inward",
          "Landing on the toes or front edge of the box",
          "Rebounding down from the box instead of stepping down"
        ],
        "quality_gate": [
          "Every landing is quiet and controlled",
          "Athlete steps down safely",
          "No knee valgus, foot collapse, or torso panic",
          "Next rep looks as good as the first rep"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 3,
        "default_reps": 3,
        "default_work_seconds": null,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 45,
        "default_rpe_min": 7,
        "default_rpe_max": 9
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Seated Box Jump; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Heavy lower-body strength",
        "Sled push",
        "Medicine-ball throws",
        "Acceleration work"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=S1BOv-JwZUA",
        "https://www.youtube.com/watch?v=64OAo8kINPQ",
        "https://www.youtube.com/watch?v=mK32QJ3HidM"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 7,
        "load": 7,
        "complexity": 6,
        "overall": 7,
        "recommended_age_min": 9,
        "recommended_age_max": null,
        "attention_demand": "high",
        "notes": "Advanced box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 2,
        "impact_level": 3,
        "requires_spotting": false,
        "requires_coach_supervision": "optional",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface",
          "No prior mastery of lower-level box jumps and landing sticks"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 3,
        "minimum_hours_between_hard_exposures": 48,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": true,
        "counts_as_neural": true,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 4,
        "impact_level": 3,
        "intensity_ceiling": "high"
      },
      "subroleSecondary": "landing_braking_control"
    },
    {
      "slug": "seated-start-box-jump",
      "name": "Seated Start Box Jump",
      "family": "Box Jump Explosive Power",
      "subrole": "jump_throw_explosive_power",
      "slot": "concentric_box_power",
      "primaryPhaseKey": "output",
      "cardSummary": "Box-jump-focused exercise that uses a precise seated start height and full reset to emphasize first-rep concentric power. Best used when the coach wants power expression without violating session order.",
      "bestPlacement": "Early Output block after warm-up and before heavy strength; give full recovery and stop while jumps are fast.",
      "description": "Seated Start Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Slot: concentric_box_power. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
      "tenets": [
        {
          "key": "explosiveness",
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
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Seated Start Box Jump lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Output because high-speed force expression is freshness-sensitive and should happen before fatigue-producing strength or conditioning.",
      "commonMisuse": "Using box jumps for high-rep fatigue or chasing a box height that forces a deep knee tuck; that turns an Output drill into conditioning and hides poor takeoff quality.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 3
      },
      "coachingExecution": {
        "movement_description": "Seated Start Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Sit on a box or bench at a height that allows feet flat, torso tall, and shins nearly vertical."
        ],
        "execution_steps": [
          "Lean slightly forward from the hips, brace, and drive through the floor from a dead stop.",
          "Land on the box with the whole foot, knees tracking over toes, and chest organized.",
          "Stand tall, step down, and rest long enough for the next rep to be just as explosive."
        ],
        "coach_cues": [
          "Jump up, not forward into the box.",
          "Quiet feet on the box.",
          "Knees track over the middle toes.",
          "Step down; do not rebound off a high box."
        ],
        "athlete_cues": [
          "Land like a ninja.",
          "Stick the landing before you stand tall.",
          "Step down and reset."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Box height too high for a clean landing",
          "Knees collapsing inward",
          "Landing on the toes or front edge of the box",
          "Rebounding down from the box instead of stepping down"
        ],
        "quality_gate": [
          "Every landing is quiet and controlled",
          "Athlete steps down safely",
          "No knee valgus, foot collapse, or torso panic",
          "Next rep looks as good as the first rep"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 3,
        "default_reps": 3,
        "default_work_seconds": null,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 45,
        "default_rpe_min": 7,
        "default_rpe_max": 9
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Seated Start Box Jump; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Heavy lower-body strength",
        "Sled push",
        "Medicine-ball throws",
        "Acceleration work"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=mK32QJ3HidM",
        "https://www.youtube.com/watch?v=S1BOv-JwZUA",
        "https://www.youtube.com/watch?v=64OAo8kINPQ"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 7,
        "load": 7,
        "complexity": 6,
        "overall": 7,
        "recommended_age_min": 9,
        "recommended_age_max": null,
        "attention_demand": "high",
        "notes": "Advanced box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 2,
        "impact_level": 3,
        "requires_spotting": false,
        "requires_coach_supervision": "optional",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface",
          "No prior mastery of lower-level box jumps and landing sticks"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 3,
        "minimum_hours_between_hard_exposures": 48,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": true,
        "counts_as_neural": true,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 4,
        "impact_level": 3,
        "intensity_ceiling": "high"
      },
      "subroleSecondary": "landing_braking_control"
    },
    {
      "slug": "non-countermovement-box-jump",
      "name": "Non-Countermovement Box Jump",
      "family": "Box Jump Explosive Power",
      "subrole": "jump_throw_explosive_power",
      "slot": "concentric_box_power",
      "primaryPhaseKey": "output",
      "cardSummary": "Box-jump-focused exercise that trains explosive takeoff from a static athletic position with no dip-rebound contribution. Best used when the coach wants power expression without violating session order.",
      "bestPlacement": "Early Output block after warm-up and before heavy strength; give full recovery and stop while jumps are fast.",
      "description": "Non-Countermovement Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Slot: concentric_box_power. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
      "tenets": [
        {
          "key": "explosiveness",
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
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Non-Countermovement Box Jump lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Output because high-speed force expression is freshness-sensitive and should happen before fatigue-producing strength or conditioning.",
      "commonMisuse": "Using box jumps for high-rep fatigue or chasing a box height that forces a deep knee tuck; that turns an Output drill into conditioning and hides poor takeoff quality.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 3
      },
      "coachingExecution": {
        "movement_description": "Non-Countermovement Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Begin in an athletic stance with eyes on the top/front edge of the box."
        ],
        "execution_steps": [
          "Set the start position, pause still for one to two seconds, then jump without a bounce.",
          "Land on the box with the whole foot, knees tracking over toes, and chest organized.",
          "Stand tall, step down, and rest long enough for the next rep to be just as explosive."
        ],
        "coach_cues": [
          "Jump up, not forward into the box.",
          "Quiet feet on the box.",
          "Knees track over the middle toes.",
          "Step down; do not rebound off a high box."
        ],
        "athlete_cues": [
          "Land like a ninja.",
          "Stick the landing before you stand tall.",
          "Step down and reset."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Box height too high for a clean landing",
          "Knees collapsing inward",
          "Landing on the toes or front edge of the box",
          "Rebounding down from the box instead of stepping down"
        ],
        "quality_gate": [
          "Every landing is quiet and controlled",
          "Athlete steps down safely",
          "No knee valgus, foot collapse, or torso panic",
          "Next rep looks as good as the first rep"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 3,
        "default_reps": 3,
        "default_work_seconds": null,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 45,
        "default_rpe_min": 7,
        "default_rpe_max": 9
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Non-Countermovement Box Jump; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Heavy lower-body strength",
        "Sled push",
        "Medicine-ball throws",
        "Acceleration work"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=5DCET9VPfjU",
        "https://www.youtube.com/watch?v=eAkWgBuYeBM",
        "https://www.youtube.com/watch?v=OupSuT2VFTk"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 7,
        "load": 7,
        "complexity": 6,
        "overall": 7,
        "recommended_age_min": 9,
        "recommended_age_max": null,
        "attention_demand": "high",
        "notes": "Advanced box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 2,
        "impact_level": 3,
        "requires_spotting": false,
        "requires_coach_supervision": "optional",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface",
          "No prior mastery of lower-level box jumps and landing sticks"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 3,
        "minimum_hours_between_hard_exposures": 48,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": true,
        "counts_as_neural": true,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 4,
        "impact_level": 3,
        "intensity_ceiling": "high"
      },
      "subroleSecondary": "landing_braking_control"
    },
    {
      "slug": "deep-squat-jump-to-box",
      "name": "Deep Squat Jump to Box",
      "family": "Box Jump Explosive Power",
      "subrole": "jump_throw_explosive_power",
      "slot": "concentric_box_power",
      "primaryPhaseKey": "output",
      "cardSummary": "Box-jump-focused exercise that progresses squat-depth strength into explosive projection while keeping the box height submaximal. Best used when the coach wants power expression without violating session order.",
      "bestPlacement": "Early Output block after warm-up and before heavy strength; give full recovery and stop while jumps are fast.",
      "description": "Deep Squat Jump to Box is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Slot: concentric_box_power. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
      "tenets": [
        {
          "key": "explosiveness",
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
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Deep Squat Jump to Box lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Output because high-speed force expression is freshness-sensitive and should happen before fatigue-producing strength or conditioning.",
      "commonMisuse": "Using box jumps for high-rep fatigue or chasing a box height that forces a deep knee tuck; that turns an Output drill into conditioning and hides poor takeoff quality.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 3
      },
      "coachingExecution": {
        "movement_description": "Deep Squat Jump to Box is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Begin in an athletic stance with eyes on the top/front edge of the box."
        ],
        "execution_steps": [
          "Load quickly but under control, then drive the floor away with full-body intent.",
          "Land on the box with the whole foot, knees tracking over toes, and chest organized.",
          "Stand tall, step down, and rest long enough for the next rep to be just as explosive."
        ],
        "coach_cues": [
          "Jump up, not forward into the box.",
          "Quiet feet on the box.",
          "Knees track over the middle toes.",
          "Step down; do not rebound off a high box."
        ],
        "athlete_cues": [
          "Land like a ninja.",
          "Stick the landing before you stand tall.",
          "Step down and reset."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Box height too high for a clean landing",
          "Knees collapsing inward",
          "Landing on the toes or front edge of the box",
          "Rebounding down from the box instead of stepping down"
        ],
        "quality_gate": [
          "Every landing is quiet and controlled",
          "Athlete steps down safely",
          "No knee valgus, foot collapse, or torso panic",
          "Next rep looks as good as the first rep"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 3,
        "default_reps": 3,
        "default_work_seconds": null,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 45,
        "default_rpe_min": 7,
        "default_rpe_max": 9
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Deep Squat Jump to Box; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Heavy lower-body strength",
        "Sled push",
        "Medicine-ball throws",
        "Acceleration work"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=cUP0GEOXzLg",
        "https://www.youtube.com/watch?v=G-bxQY57mKc",
        "https://www.youtube.com/watch?v=cLSB_Zn0awM"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 7,
        "load": 7,
        "complexity": 6,
        "overall": 7,
        "recommended_age_min": 9,
        "recommended_age_max": null,
        "attention_demand": "high",
        "notes": "Advanced box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 2,
        "impact_level": 3,
        "requires_spotting": false,
        "requires_coach_supervision": "optional",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface",
          "No prior mastery of lower-level box jumps and landing sticks"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 3,
        "minimum_hours_between_hard_exposures": 48,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": true,
        "counts_as_neural": true,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 4,
        "impact_level": 3,
        "intensity_ceiling": "high"
      },
      "subroleSecondary": "landing_braking_control"
    },
    {
      "slug": "kneeling-box-jump",
      "name": "Kneeling Box Jump",
      "family": "Box Jump Explosive Power",
      "subrole": "jump_throw_explosive_power",
      "slot": "hip_extension_power",
      "primaryPhaseKey": "output",
      "cardSummary": "Box-jump-focused exercise that challenges hip snap, trunk stiffness, and rapid foot replacement from a tall-kneeling start. Best used when the coach wants power expression without violating session order.",
      "bestPlacement": "Early Output block after warm-up and before heavy strength; give full recovery and stop while jumps are fast.",
      "description": "Kneeling Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Slot: hip_extension_power. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
      "tenets": [
        {
          "key": "explosiveness",
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
          "key": "neural_output_readiness",
          "weight": 5
        },
        {
          "key": "ssc_stiffness",
          "weight": 4
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
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Kneeling Box Jump lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Output because high-speed force expression is freshness-sensitive and should happen before fatigue-producing strength or conditioning.",
      "commonMisuse": "Using box jumps for high-rep fatigue or chasing a box height that forces a deep knee tuck; that turns an Output drill into conditioning and hides poor takeoff quality.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 4
      },
      "coachingExecution": {
        "movement_description": "Kneeling Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Start tall-kneeling on a mat facing a low soft box."
        ],
        "execution_steps": [
          "Snap the hips forward, replace the feet quickly underneath the body, then jump onto the box.",
          "Land on the box with the whole foot, knees tracking over toes, and chest organized.",
          "Stand tall, step down, and rest long enough for the next rep to be just as explosive."
        ],
        "coach_cues": [
          "Jump up, not forward into the box.",
          "Quiet feet on the box.",
          "Knees track over the middle toes.",
          "Step down; do not rebound off a high box."
        ],
        "athlete_cues": [
          "Land like a ninja.",
          "Stick the landing before you stand tall.",
          "Step down and reset."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Box height too high for a clean landing",
          "Knees collapsing inward",
          "Landing on the toes or front edge of the box",
          "Rebounding down from the box instead of stepping down"
        ],
        "quality_gate": [
          "Every landing is quiet and controlled",
          "Athlete steps down safely",
          "No knee valgus, foot collapse, or torso panic",
          "Next rep looks as good as the first rep"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 3,
        "default_reps": 2,
        "default_work_seconds": null,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 45,
        "default_rpe_min": 7,
        "default_rpe_max": 9
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Kneeling Box Jump; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Heavy lower-body strength",
        "Sled push",
        "Medicine-ball throws",
        "Acceleration work"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=o-bqq-CmT9Q",
        "https://www.youtube.com/watch?v=KRINJuW_HjQ",
        "https://www.youtube.com/watch?v=G-bxQY57mKc"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 8,
        "load": 8,
        "complexity": 7,
        "overall": 8,
        "recommended_age_min": 12,
        "recommended_age_max": null,
        "attention_demand": "high",
        "notes": "Elite box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 4,
        "impact_level": 4,
        "requires_spotting": false,
        "requires_coach_supervision": "required",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface",
          "No prior mastery of lower-level box jumps and landing sticks"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 2,
        "minimum_hours_between_hard_exposures": 48,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": true,
        "counts_as_neural": true,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 5,
        "impact_level": 4,
        "intensity_ceiling": "high"
      },
      "subroleSecondary": "landing_braking_control"
    },
    {
      "slug": "half-kneeling-box-jump",
      "name": "Half-Kneeling Box Jump",
      "family": "Box Jump Explosive Power",
      "subrole": "jump_throw_explosive_power",
      "slot": "hip_extension_power",
      "primaryPhaseKey": "output",
      "cardSummary": "Box-jump-focused exercise that adds asymmetrical start mechanics to hip extension power before two-foot box landing. Best used when the coach wants power expression without violating session order.",
      "bestPlacement": "Early Output block after warm-up and before heavy strength; give full recovery and stop while jumps are fast.",
      "description": "Half-Kneeling Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Slot: hip_extension_power. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
      "tenets": [
        {
          "key": "explosiveness",
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
          "key": "neural_output_readiness",
          "weight": 5
        },
        {
          "key": "ssc_stiffness",
          "weight": 4
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
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Half-Kneeling Box Jump lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Output because high-speed force expression is freshness-sensitive and should happen before fatigue-producing strength or conditioning.",
      "commonMisuse": "Using box jumps for high-rep fatigue or chasing a box height that forces a deep knee tuck; that turns an Output drill into conditioning and hides poor takeoff quality.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 4
      },
      "coachingExecution": {
        "movement_description": "Half-Kneeling Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Start half-kneeling on a mat with the front foot flat and the box close enough for a safe landing."
        ],
        "execution_steps": [
          "Snap the hips forward, replace the feet quickly underneath the body, then jump onto the box.",
          "Land on the box with the whole foot, knees tracking over toes, and chest organized.",
          "Stand tall, step down, and rest long enough for the next rep to be just as explosive."
        ],
        "coach_cues": [
          "Jump up, not forward into the box.",
          "Quiet feet on the box.",
          "Knees track over the middle toes.",
          "Step down; do not rebound off a high box."
        ],
        "athlete_cues": [
          "Land like a ninja.",
          "Stick the landing before you stand tall.",
          "Step down and reset."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Box height too high for a clean landing",
          "Knees collapsing inward",
          "Landing on the toes or front edge of the box",
          "Rebounding down from the box instead of stepping down"
        ],
        "quality_gate": [
          "Every landing is quiet and controlled",
          "Athlete steps down safely",
          "No knee valgus, foot collapse, or torso panic",
          "Next rep looks as good as the first rep"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 3,
        "default_reps": 2,
        "default_work_seconds": null,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 45,
        "default_rpe_min": 7,
        "default_rpe_max": 9
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Half-Kneeling Box Jump; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Heavy lower-body strength",
        "Sled push",
        "Medicine-ball throws",
        "Acceleration work"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=8vJ-qL5XNvs",
        "https://www.youtube.com/watch?v=o-bqq-CmT9Q",
        "https://www.youtube.com/watch?v=G-bxQY57mKc"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 8,
        "load": 8,
        "complexity": 7,
        "overall": 8,
        "recommended_age_min": 12,
        "recommended_age_max": null,
        "attention_demand": "high",
        "notes": "Elite box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 4,
        "impact_level": 4,
        "requires_spotting": false,
        "requires_coach_supervision": "required",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface",
          "No prior mastery of lower-level box jumps and landing sticks"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 2,
        "minimum_hours_between_hard_exposures": 48,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": true,
        "counts_as_neural": true,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 5,
        "impact_level": 4,
        "intensity_ceiling": "high"
      },
      "subroleSecondary": "landing_braking_control"
    },
    {
      "slug": "reset-repetition-box-jump",
      "name": "Reset Repetition Box Jump",
      "family": "Box Jump Explosive Power",
      "subrole": "jump_throw_explosive_power",
      "slot": "box_jump_power",
      "primaryPhaseKey": "output",
      "cardSummary": "Box-jump-focused exercise that keeps every rep high-quality by forcing a full step-down and athletic reset between jumps. Best used when the coach wants power expression without violating session order.",
      "bestPlacement": "Early Output block after warm-up and before heavy strength; give full recovery and stop while jumps are fast.",
      "description": "Reset Repetition Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Slot: box_jump_power. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
      "tenets": [
        {
          "key": "explosiveness",
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
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Reset Repetition Box Jump lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Output because high-speed force expression is freshness-sensitive and should happen before fatigue-producing strength or conditioning.",
      "commonMisuse": "Using box jumps for high-rep fatigue or chasing a box height that forces a deep knee tuck; that turns an Output drill into conditioning and hides poor takeoff quality.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "dynamic",
        "coordination_demand": "moderate",
        "impact_level": 3
      },
      "coachingExecution": {
        "movement_description": "Reset Repetition Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Begin in an athletic stance with eyes on the top/front edge of the box."
        ],
        "execution_steps": [
          "Load quickly but under control, then drive the floor away with full-body intent.",
          "Land on the box with the whole foot, knees tracking over toes, and chest organized.",
          "Stand tall, step down, and rest long enough for the next rep to be just as explosive."
        ],
        "coach_cues": [
          "Jump up, not forward into the box.",
          "Quiet feet on the box.",
          "Knees track over the middle toes.",
          "Step down; do not rebound off a high box."
        ],
        "athlete_cues": [
          "Land like a ninja.",
          "Stick the landing before you stand tall.",
          "Step down and reset."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Box height too high for a clean landing",
          "Knees collapsing inward",
          "Landing on the toes or front edge of the box",
          "Rebounding down from the box instead of stepping down"
        ],
        "quality_gate": [
          "Every landing is quiet and controlled",
          "Athlete steps down safely",
          "No knee valgus, foot collapse, or torso panic",
          "Next rep looks as good as the first rep"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 3,
        "default_reps": 3,
        "default_work_seconds": null,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 45,
        "default_rpe_min": 7,
        "default_rpe_max": 9
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Reset Repetition Box Jump; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Heavy lower-body strength",
        "Sled push",
        "Medicine-ball throws",
        "Acceleration work"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=G-bxQY57mKc",
        "https://www.youtube.com/watch?v=fTpI4tgjci0",
        "https://www.youtube.com/watch?v=cLSB_Zn0awM"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 5,
        "load": 6,
        "complexity": 4,
        "overall": 6,
        "recommended_age_min": 6,
        "recommended_age_max": null,
        "attention_demand": "moderate",
        "notes": "Base box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 2,
        "impact_level": 3,
        "requires_spotting": false,
        "requires_coach_supervision": "optional",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 3,
        "minimum_hours_between_hard_exposures": 48,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": true,
        "counts_as_neural": true,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 3,
        "impact_level": 3,
        "intensity_ceiling": "high"
      },
      "subroleSecondary": "landing_braking_control"
    },
    {
      "slug": "arm-swing-timing-box-jump",
      "name": "Arm-Swing Timing Box Jump",
      "family": "Box Jump Movement Intelligence",
      "subrole": "balance_coordination_rhythm",
      "slot": "box_jump_mechanics",
      "primaryPhaseKey": "movement_intelligence",
      "cardSummary": "Box-jump-focused exercise that teaches synchronized arm drive, hip load, and takeoff timing before higher-output box-jump work. Best used when the coach wants technical skill without violating session order.",
      "bestPlacement": "Movement Intelligence block before high-intent jumping; use as crisp teaching reps, not fatigue work.",
      "description": "Arm-Swing Timing Box Jump is a technical box-jump skill drill. The athlete moves at a teachable speed, coordinates the takeoff and landing sequence, and resets every rep so the pattern stays crisp. It prepares the athlete for higher-intent box jumps without turning the set into conditioning.",
      "coachLanguage": "Primary subrole: balance_coordination_rhythm. Slot: box_jump_mechanics. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
      "tenets": [
        {
          "key": "coordination",
          "weight": 5
        },
        {
          "key": "body_control",
          "weight": 4
        },
        {
          "key": "balance",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 4
        },
        {
          "key": "balance_stability",
          "weight": 3
        },
        {
          "key": "plyometrics",
          "weight": 2
        }
      ],
      "physiology": [
        {
          "key": "perception_action_skill",
          "weight": 4
        },
        {
          "key": "control_stability",
          "weight": 4
        },
        {
          "key": "neural_output_readiness",
          "weight": 2
        }
      ],
      "patterns": [
        {
          "key": "jump",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Arm-Swing Timing Box Jump lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Movement Intelligence because the athlete is learning timing and spatial control before fatigue or high-intent work.",
      "commonMisuse": "Letting the drill become a race or finisher; the learning target disappears when reps get rushed.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "dynamic",
        "coordination_demand": "moderate",
        "impact_level": 2
      },
      "coachingExecution": {
        "movement_description": "Arm-Swing Timing Box Jump is a technical box-jump skill drill. The athlete moves at a teachable speed, coordinates the takeoff and landing sequence, and resets every rep so the pattern stays crisp. It prepares the athlete for higher-intent box jumps without turning the set into conditioning.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Begin in an athletic stance with eyes on the top/front edge of the box."
        ],
        "execution_steps": [
          "Load the hips with control and swing the arms in rhythm with the jump pattern.",
          "Jump or move over the box with enough height to clear safely without rushing.",
          "Land, stand tall, step down, and reset before the next rep."
        ],
        "coach_cues": [
          "Jump up, not forward into the box.",
          "Quiet feet on the box.",
          "Knees track over the middle toes.",
          "Step down; do not rebound off a high box."
        ],
        "athlete_cues": [
          "Land like a ninja.",
          "Stick the landing before you stand tall.",
          "Step down and reset."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Box height too high for a clean landing",
          "Knees collapsing inward",
          "Landing on the toes or front edge of the box",
          "Rebounding down from the box instead of stepping down"
        ],
        "quality_gate": [
          "Every landing is quiet and controlled",
          "Athlete steps down safely",
          "No knee valgus, foot collapse, or torso panic",
          "Next rep looks as good as the first rep"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 2,
        "default_reps": 4,
        "default_work_seconds": null,
        "default_rest_seconds": 45,
        "est_seconds_per_set": 40,
        "default_rpe_min": 3,
        "default_rpe_max": 5
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Arm-Swing Timing Box Jump; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Low Box Jump to Stick",
        "Countermovement Box Jump"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=G-bxQY57mKc",
        "https://www.youtube.com/watch?v=cLSB_Zn0awM",
        "https://www.youtube.com/watch?v=fTpI4tgjci0"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 4,
        "load": 5,
        "complexity": 3,
        "overall": 5,
        "recommended_age_min": 4,
        "recommended_age_max": null,
        "attention_demand": "moderate",
        "notes": "Foundation box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 2,
        "impact_level": 2,
        "requires_spotting": false,
        "requires_coach_supervision": "optional",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 4,
        "minimum_hours_between_hard_exposures": 24,
        "counts_as_high_intensity": false,
        "counts_as_high_impact": false,
        "counts_as_neural": true,
        "counts_as_tissue_stress": false,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 2,
        "fatigue_sensitivity": 3,
        "technical_complexity": 3,
        "impact_level": 2,
        "intensity_ceiling": "moderate"
      }
    }
  ]
}
```
# Box Jump Exercise Cards Batch 21-30
Copy the JSON block below into Cursor or an import script.
```json
{
  "cluster": {
    "topic": "box_jump_focused_exercises",
    "card_count": 10,
    "format": "Vortex Card v2 Authoring JSON (camelCase)",
    "notes": "Slot keys are intent-clear authoring slots; verify exact phase_order_slot keys against the application database before import.",
    "batch": "21-30"
  },
  "cards": [
    {
      "slug": "one-step-box-jump",
      "name": "One-Step Box Jump",
      "family": "Box Jump Explosive Power",
      "subrole": "jump_throw_explosive_power",
      "slot": "approach_box_power",
      "primaryPhaseKey": "output",
      "cardSummary": "Box-jump-focused exercise that bridges standing box jumps to sport-like approach rhythm with only one controlled step. Best used when the coach wants power expression without violating session order.",
      "bestPlacement": "Early Output block after warm-up and before heavy strength; give full recovery and stop while jumps are fast.",
      "description": "One-Step Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Slot: approach_box_power. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
      "tenets": [
        {
          "key": "explosiveness",
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
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, One-Step Box Jump lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Output because high-speed force expression is freshness-sensitive and should happen before fatigue-producing strength or conditioning.",
      "commonMisuse": "Using box jumps for high-rep fatigue or chasing a box height that forces a deep knee tuck; that turns an Output drill into conditioning and hides poor takeoff quality.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 3
      },
      "coachingExecution": {
        "movement_description": "One-Step Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Begin in an athletic stance with eyes on the top/front edge of the box."
        ],
        "execution_steps": [
          "Load quickly but under control, then drive the floor away with full-body intent.",
          "Land on the box with the whole foot, knees tracking over toes, and chest organized.",
          "Stand tall, step down, and rest long enough for the next rep to be just as explosive."
        ],
        "coach_cues": [
          "Jump up, not forward into the box.",
          "Quiet feet on the box.",
          "Knees track over the middle toes.",
          "Step down; do not rebound off a high box."
        ],
        "athlete_cues": [
          "Land like a ninja.",
          "Stick the landing before you stand tall.",
          "Step down and reset."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Box height too high for a clean landing",
          "Knees collapsing inward",
          "Landing on the toes or front edge of the box",
          "Rebounding down from the box instead of stepping down"
        ],
        "quality_gate": [
          "Every landing is quiet and controlled",
          "Athlete steps down safely",
          "No knee valgus, foot collapse, or torso panic",
          "Next rep looks as good as the first rep"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 3,
        "default_reps": 3,
        "default_work_seconds": null,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 45,
        "default_rpe_min": 7,
        "default_rpe_max": 9
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of One-Step Box Jump; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Heavy lower-body strength",
        "Sled push",
        "Medicine-ball throws",
        "Acceleration work"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=G-bxQY57mKc",
        "https://www.youtube.com/watch?v=cLSB_Zn0awM",
        "https://www.youtube.com/watch?v=VfXl0OV2QV8"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 7,
        "load": 7,
        "complexity": 6,
        "overall": 7,
        "recommended_age_min": 9,
        "recommended_age_max": null,
        "attention_demand": "high",
        "notes": "Advanced box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 2,
        "impact_level": 3,
        "requires_spotting": false,
        "requires_coach_supervision": "optional",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface",
          "No prior mastery of lower-level box jumps and landing sticks"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 3,
        "minimum_hours_between_hard_exposures": 48,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": true,
        "counts_as_neural": true,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 4,
        "impact_level": 3,
        "intensity_ceiling": "high"
      },
      "subroleSecondary": "landing_braking_control"
    },
    {
      "slug": "single-leg-takeoff-to-two-foot-box-landing",
      "name": "Single-Leg Takeoff to Two-Foot Box Landing",
      "family": "Box Jump Explosive Power",
      "subrole": "jump_throw_explosive_power",
      "slot": "unilateral_box_power",
      "primaryPhaseKey": "output",
      "cardSummary": "Box-jump-focused exercise that loads one leg at takeoff while using a two-foot landing on the box to reduce landing stress. Best used when the coach wants power expression without violating session order.",
      "bestPlacement": "Early Output block after warm-up and before heavy strength; give full recovery and stop while jumps are fast.",
      "description": "Single-Leg Takeoff to Two-Foot Box Landing is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Slot: unilateral_box_power. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
      "tenets": [
        {
          "key": "explosiveness",
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
          "key": "neural_output_readiness",
          "weight": 5
        },
        {
          "key": "ssc_stiffness",
          "weight": 4
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
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Single-Leg Takeoff to Two-Foot Box Landing lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Output because high-speed force expression is freshness-sensitive and should happen before fatigue-producing strength or conditioning.",
      "commonMisuse": "Using box jumps for high-rep fatigue or chasing a box height that forces a deep knee tuck; that turns an Output drill into conditioning and hides poor takeoff quality.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "single_leg",
        "coordination_demand": "high",
        "impact_level": 4
      },
      "coachingExecution": {
        "movement_description": "Single-Leg Takeoff to Two-Foot Box Landing is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Set up on the working leg with the stance foot rooted and the box low enough to keep the knee tracking clean."
        ],
        "execution_steps": [
          "Load quickly but under control, then drive the floor away with full-body intent.",
          "Land on the box with the whole foot, knees tracking over toes, and chest organized.",
          "Stand tall, step down, and rest long enough for the next rep to be just as explosive."
        ],
        "coach_cues": [
          "Jump up, not forward into the box.",
          "Quiet feet on the box.",
          "Knees track over the middle toes.",
          "Step down; do not rebound off a high box.",
          "Pelvis level; do not let the stance hip dump."
        ],
        "athlete_cues": [
          "Land like a ninja.",
          "Stick the landing before you stand tall.",
          "Step down and reset.",
          "Balance before the next rep."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Box height too high for a clean landing",
          "Knees collapsing inward",
          "Landing on the toes or front edge of the box",
          "Rebounding down from the box instead of stepping down"
        ],
        "quality_gate": [
          "Every landing is quiet and controlled",
          "Athlete steps down safely",
          "No knee valgus, foot collapse, or torso panic",
          "Next rep looks as good as the first rep",
          "Single-leg balance is held without hopping"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 3,
        "default_reps": 3,
        "default_work_seconds": null,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 45,
        "default_rpe_min": 7,
        "default_rpe_max": 9
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Single-Leg Takeoff to Two-Foot Box Landing; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Heavy lower-body strength",
        "Sled push",
        "Medicine-ball throws",
        "Acceleration work"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=LDU_yVvp7pA",
        "https://www.youtube.com/watch?v=C5uWN9FIU9E",
        "https://www.youtube.com/watch?v=G-bxQY57mKc"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 7,
        "load": 7,
        "complexity": 6,
        "overall": 7,
        "recommended_age_min": 9,
        "recommended_age_max": null,
        "attention_demand": "high",
        "notes": "Advanced box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 3,
        "impact_level": 4,
        "requires_spotting": false,
        "requires_coach_supervision": "recommended",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface",
          "No prior mastery of lower-level box jumps and landing sticks"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 3,
        "minimum_hours_between_hard_exposures": 48,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": true,
        "counts_as_neural": true,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 4,
        "impact_level": 4,
        "intensity_ceiling": "high"
      },
      "subroleSecondary": "landing_braking_control"
    },
    {
      "slug": "single-leg-box-jump-to-single-leg-landing",
      "name": "Single-Leg Box Jump to Single-Leg Landing",
      "family": "Box Jump Explosive Power",
      "subrole": "jump_throw_explosive_power",
      "slot": "unilateral_box_power",
      "primaryPhaseKey": "output",
      "cardSummary": "Box-jump-focused exercise that high-skill unilateral power and landing control for athletes who already own lower-level single-leg hops. Best used when the coach wants power expression without violating session order.",
      "bestPlacement": "Early Output block after warm-up and before heavy strength; give full recovery and stop while jumps are fast.",
      "description": "Single-Leg Box Jump to Single-Leg Landing is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Slot: unilateral_box_power. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
      "tenets": [
        {
          "key": "explosiveness",
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
          "key": "neural_output_readiness",
          "weight": 5
        },
        {
          "key": "ssc_stiffness",
          "weight": 4
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
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Single-Leg Box Jump to Single-Leg Landing lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Output because high-speed force expression is freshness-sensitive and should happen before fatigue-producing strength or conditioning.",
      "commonMisuse": "Using box jumps for high-rep fatigue or chasing a box height that forces a deep knee tuck; that turns an Output drill into conditioning and hides poor takeoff quality.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "single_leg",
        "coordination_demand": "high",
        "impact_level": 4
      },
      "coachingExecution": {
        "movement_description": "Single-Leg Box Jump to Single-Leg Landing is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Set up on the working leg with the stance foot rooted and the box low enough to keep the knee tracking clean."
        ],
        "execution_steps": [
          "Load quickly but under control, then drive the floor away with full-body intent.",
          "Land on the box with the whole foot, knees tracking over toes, and chest organized.",
          "Stand tall, step down, and rest long enough for the next rep to be just as explosive."
        ],
        "coach_cues": [
          "Jump up, not forward into the box.",
          "Quiet feet on the box.",
          "Knees track over the middle toes.",
          "Step down; do not rebound off a high box.",
          "Pelvis level; do not let the stance hip dump."
        ],
        "athlete_cues": [
          "Land like a ninja.",
          "Stick the landing before you stand tall.",
          "Step down and reset.",
          "Balance before the next rep."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Box height too high for a clean landing",
          "Knees collapsing inward",
          "Landing on the toes or front edge of the box",
          "Rebounding down from the box instead of stepping down"
        ],
        "quality_gate": [
          "Every landing is quiet and controlled",
          "Athlete steps down safely",
          "No knee valgus, foot collapse, or torso panic",
          "Next rep looks as good as the first rep",
          "Single-leg balance is held without hopping"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 3,
        "default_reps": 2,
        "default_work_seconds": null,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 45,
        "default_rpe_min": 7,
        "default_rpe_max": 9
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Single-Leg Box Jump to Single-Leg Landing; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Heavy lower-body strength",
        "Sled push",
        "Medicine-ball throws",
        "Acceleration work"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=LDU_yVvp7pA",
        "https://www.youtube.com/watch?v=C5uWN9FIU9E",
        "https://www.youtube.com/watch?v=XRVSx_xr1_M"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 8,
        "load": 8,
        "complexity": 7,
        "overall": 8,
        "recommended_age_min": 12,
        "recommended_age_max": null,
        "attention_demand": "high",
        "notes": "Elite box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 4,
        "impact_level": 4,
        "requires_spotting": false,
        "requires_coach_supervision": "required",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface",
          "No prior mastery of lower-level box jumps and landing sticks"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 2,
        "minimum_hours_between_hard_exposures": 48,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": true,
        "counts_as_neural": true,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 5,
        "impact_level": 4,
        "intensity_ceiling": "high"
      },
      "subroleSecondary": "landing_braking_control"
    },
    {
      "slug": "standing-box-jump-to-single-leg-landing",
      "name": "Standing Box Jump to Single-Leg Landing",
      "family": "Box Jump Landing & Braking Control",
      "subrole": "single_leg_balance_foot_ankle_hip_control",
      "slot": "single_leg_landing_control",
      "primaryPhaseKey": "resilience",
      "cardSummary": "Box-jump-focused exercise that keeps a bilateral takeoff but demands single-leg balance and alignment on top of the box. Best used when the coach wants landing control without violating session order.",
      "bestPlacement": "Resilience block after warm-up, Output, or Capacity when the goal is landing control rather than maximal jump height.",
      "description": "Standing Box Jump to Single-Leg Landing is a box-jump-family landing-control drill. The athlete uses the box or drop height only as high as they can absorb quietly, holds the landing shape, then resets before the next attempt. The main goal is braking skill, joint alignment, and tissue tolerance rather than chasing height or fatigue.",
      "coachLanguage": "Primary subrole: single_leg_balance_foot_ankle_hip_control. Slot: single_leg_landing_control. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
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
          "key": "strength",
          "weight": 2
        }
      ],
      "methodologies": [
        {
          "key": "plyometrics",
          "weight": 3
        },
        {
          "key": "balance_stability",
          "weight": 5
        },
        {
          "key": "eccentric_negative",
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
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Standing Box Jump to Single-Leg Landing lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Resilience because the adaptation target is braking quality, landing tolerance, and joint control, not maximal power.",
      "commonMisuse": "Rushing to height or speed before the athlete can stick the landing; this changes a control drill into uncontrolled impact.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "single_leg",
        "coordination_demand": "high",
        "impact_level": 4
      },
      "coachingExecution": {
        "movement_description": "Standing Box Jump to Single-Leg Landing is a box-jump-family landing-control drill. The athlete uses the box or drop height only as high as they can absorb quietly, holds the landing shape, then resets before the next attempt. The main goal is braking skill, joint alignment, and tissue tolerance rather than chasing height or fatigue.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Set up on the working leg with the stance foot rooted and the box low enough to keep the knee tracking clean."
        ],
        "execution_steps": [
          "Move or drop into the landing with a quiet, controlled foot contact.",
          "Absorb through the ankles, knees, and hips while keeping ribs stacked over pelvis.",
          "Hold the stick for two full seconds before stepping down and resetting."
        ],
        "coach_cues": [
          "Own the stick before adding height.",
          "Absorb through ankle, knee, and hip together.",
          "No knee cave or torso collapse.",
          "Stop as soon as landings get loud.",
          "Pelvis level; do not let the stance hip dump."
        ],
        "athlete_cues": [
          "Land soft and freeze.",
          "Knees point the same way as toes.",
          "Hold still before you move.",
          "Balance before the next rep."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Landing noise increases across reps",
          "Knees cave or feet collapse inward",
          "Athlete cannot hold the stick",
          "Torso folds forward on contact"
        ],
        "quality_gate": [
          "Athlete holds the stick for two seconds",
          "Landing is quiet and symmetrical enough for the drill",
          "Athlete can explain or demonstrate the safer step-down reset",
          "Single-leg balance is held without hopping"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "attempts",
        "default_sets": 2,
        "default_reps": 3,
        "default_work_seconds": null,
        "default_rest_seconds": 45,
        "est_seconds_per_set": 35,
        "default_rpe_min": 4,
        "default_rpe_max": 6
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Standing Box Jump to Single-Leg Landing; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Low Box Jump to Stick",
        "Countermovement Box Jump"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep",
        "control_landing",
        "resilience"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=JXYT_gFdCDo",
        "https://www.youtube.com/watch?v=C5uWN9FIU9E",
        "https://www.youtube.com/watch?v=G-bxQY57mKc"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 7,
        "load": 7,
        "complexity": 6,
        "overall": 7,
        "recommended_age_min": 9,
        "recommended_age_max": null,
        "attention_demand": "high",
        "notes": "Advanced box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 3,
        "impact_level": 4,
        "requires_spotting": false,
        "requires_coach_supervision": "recommended",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface",
          "No prior mastery of lower-level box jumps and landing sticks"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 3,
        "minimum_hours_between_hard_exposures": 48,
        "counts_as_high_intensity": false,
        "counts_as_high_impact": true,
        "counts_as_neural": false,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": false,
        "fatigue_cost": 3,
        "fatigue_sensitivity": 3,
        "technical_complexity": 4,
        "impact_level": 4,
        "intensity_ceiling": "moderate"
      },
      "subroleSecondary": "jump_throw_explosive_power"
    },
    {
      "slug": "single-leg-lateral-box-jump",
      "name": "Single-Leg Lateral Box Jump",
      "family": "Box Jump Explosive Power",
      "subrole": "deceleration_cod_power",
      "slot": "lateral_unilateral_box_power",
      "primaryPhaseKey": "output",
      "cardSummary": "Box-jump-focused exercise that develops frontal-plane single-leg projection and controlled lateral landing onto the box. Best used when the coach wants power expression without violating session order.",
      "bestPlacement": "Early Output block after warm-up and before heavy strength; give full recovery and stop while jumps are fast.",
      "description": "Single-Leg Lateral Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
      "coachLanguage": "Primary subrole: deceleration_cod_power. Slot: lateral_unilateral_box_power. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
      "tenets": [
        {
          "key": "explosiveness",
          "weight": 5
        },
        {
          "key": "agility",
          "weight": 4
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
          "key": "neural_output_readiness",
          "weight": 5
        },
        {
          "key": "ssc_stiffness",
          "weight": 4
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
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        },
        {
          "key": "locomote",
          "weight": 2
        },
        {
          "key": "rotate",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Single-Leg Lateral Box Jump lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Output because high-speed force expression is freshness-sensitive and should happen before fatigue-producing strength or conditioning.",
      "commonMisuse": "Using box jumps for high-rep fatigue or chasing a box height that forces a deep knee tuck; that turns an Output drill into conditioning and hides poor takeoff quality.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "single_leg",
        "coordination_demand": "high",
        "impact_level": 4
      },
      "coachingExecution": {
        "movement_description": "Single-Leg Lateral Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Set up on the working leg with the stance foot rooted and the box low enough to keep the knee tracking clean."
        ],
        "execution_steps": [
          "Load quickly but under control, then drive the floor away with full-body intent.",
          "Land on the box with the whole foot, knees tracking over toes, and chest organized.",
          "Stand tall, step down, and rest long enough for the next rep to be just as explosive."
        ],
        "coach_cues": [
          "Jump up, not forward into the box.",
          "Quiet feet on the box.",
          "Knees track over the middle toes.",
          "Step down; do not rebound off a high box.",
          "Pelvis level; do not let the stance hip dump."
        ],
        "athlete_cues": [
          "Land like a ninja.",
          "Stick the landing before you stand tall.",
          "Step down and reset.",
          "Balance before the next rep."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Box height too high for a clean landing",
          "Knees collapsing inward",
          "Landing on the toes or front edge of the box",
          "Rebounding down from the box instead of stepping down"
        ],
        "quality_gate": [
          "Every landing is quiet and controlled",
          "Athlete steps down safely",
          "No knee valgus, foot collapse, or torso panic",
          "Next rep looks as good as the first rep",
          "Single-leg balance is held without hopping"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 3,
        "default_reps": 2,
        "default_work_seconds": null,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 45,
        "default_rpe_min": 7,
        "default_rpe_max": 9
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Single-Leg Lateral Box Jump; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Heavy lower-body strength",
        "Sled push",
        "Medicine-ball throws",
        "Acceleration work"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep",
        "deceleration"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=ynTAwRE1eks",
        "https://www.youtube.com/watch?v=LDU_yVvp7pA",
        "https://www.youtube.com/watch?v=sugmNPK5Pw4"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 8,
        "load": 8,
        "complexity": 7,
        "overall": 8,
        "recommended_age_min": 12,
        "recommended_age_max": null,
        "attention_demand": "high",
        "notes": "Elite box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 4,
        "impact_level": 4,
        "requires_spotting": false,
        "requires_coach_supervision": "required",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface",
          "No prior mastery of lower-level box jumps and landing sticks"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 2,
        "minimum_hours_between_hard_exposures": 48,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": true,
        "counts_as_neural": true,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 5,
        "impact_level": 4,
        "intensity_ceiling": "high"
      },
      "subroleSecondary": "landing_braking_control"
    },
    {
      "slug": "skater-jump-to-box",
      "name": "Skater Jump to Box",
      "family": "Box Jump Explosive Power",
      "subrole": "deceleration_cod_power",
      "slot": "lateral_unilateral_box_power",
      "primaryPhaseKey": "output",
      "cardSummary": "Box-jump-focused exercise that turns a skater-style lateral push into an elevated landing target for hip, knee, and ankle control. Best used when the coach wants power expression without violating session order.",
      "bestPlacement": "Early Output block after warm-up and before heavy strength; give full recovery and stop while jumps are fast.",
      "description": "Skater Jump to Box is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
      "coachLanguage": "Primary subrole: deceleration_cod_power. Slot: lateral_unilateral_box_power. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
      "tenets": [
        {
          "key": "explosiveness",
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
          "key": "neural_output_readiness",
          "weight": 5
        },
        {
          "key": "ssc_stiffness",
          "weight": 4
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
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        },
        {
          "key": "locomote",
          "weight": 2
        },
        {
          "key": "rotate",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Skater Jump to Box lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Output because high-speed force expression is freshness-sensitive and should happen before fatigue-producing strength or conditioning.",
      "commonMisuse": "Using box jumps for high-rep fatigue or chasing a box height that forces a deep knee tuck; that turns an Output drill into conditioning and hides poor takeoff quality.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 4
      },
      "coachingExecution": {
        "movement_description": "Skater Jump to Box is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Begin in an athletic stance with eyes on the top/front edge of the box."
        ],
        "execution_steps": [
          "Load quickly but under control, then drive the floor away with full-body intent.",
          "Land on the box with the whole foot, knees tracking over toes, and chest organized.",
          "Stand tall, step down, and rest long enough for the next rep to be just as explosive."
        ],
        "coach_cues": [
          "Jump up, not forward into the box.",
          "Quiet feet on the box.",
          "Knees track over the middle toes.",
          "Step down; do not rebound off a high box."
        ],
        "athlete_cues": [
          "Land like a ninja.",
          "Stick the landing before you stand tall.",
          "Step down and reset."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Box height too high for a clean landing",
          "Knees collapsing inward",
          "Landing on the toes or front edge of the box",
          "Rebounding down from the box instead of stepping down"
        ],
        "quality_gate": [
          "Every landing is quiet and controlled",
          "Athlete steps down safely",
          "No knee valgus, foot collapse, or torso panic",
          "Next rep looks as good as the first rep"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 3,
        "default_reps": 3,
        "default_work_seconds": null,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 45,
        "default_rpe_min": 7,
        "default_rpe_max": 9
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Skater Jump to Box; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Heavy lower-body strength",
        "Sled push",
        "Medicine-ball throws",
        "Acceleration work"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep",
        "deceleration"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=ynTAwRE1eks",
        "https://www.youtube.com/watch?v=oQFykYI4pRM",
        "https://www.youtube.com/watch?v=G-bxQY57mKc"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 7,
        "load": 7,
        "complexity": 6,
        "overall": 7,
        "recommended_age_min": 9,
        "recommended_age_max": null,
        "attention_demand": "high",
        "notes": "Advanced box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 3,
        "impact_level": 4,
        "requires_spotting": false,
        "requires_coach_supervision": "recommended",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface",
          "No prior mastery of lower-level box jumps and landing sticks"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 3,
        "minimum_hours_between_hard_exposures": 48,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": true,
        "counts_as_neural": true,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 4,
        "impact_level": 4,
        "intensity_ceiling": "high"
      },
      "subroleSecondary": "landing_braking_control"
    },
    {
      "slug": "split-stance-box-jump",
      "name": "Split-Stance Box Jump",
      "family": "Box Jump Explosive Power",
      "subrole": "jump_throw_explosive_power",
      "slot": "asymmetrical_box_power",
      "primaryPhaseKey": "output",
      "cardSummary": "Box-jump-focused exercise that uses a split stance to expose left-right force differences while still landing on two feet. Best used when the coach wants power expression without violating session order.",
      "bestPlacement": "Early Output block after warm-up and before heavy strength; give full recovery and stop while jumps are fast.",
      "description": "Split-Stance Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Slot: asymmetrical_box_power. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
      "tenets": [
        {
          "key": "explosiveness",
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
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Split-Stance Box Jump lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Output because high-speed force expression is freshness-sensitive and should happen before fatigue-producing strength or conditioning.",
      "commonMisuse": "Using box jumps for high-rep fatigue or chasing a box height that forces a deep knee tuck; that turns an Output drill into conditioning and hides poor takeoff quality.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 3
      },
      "coachingExecution": {
        "movement_description": "Split-Stance Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Begin in an athletic stance with eyes on the top/front edge of the box."
        ],
        "execution_steps": [
          "Load quickly but under control, then drive the floor away with full-body intent.",
          "Land on the box with the whole foot, knees tracking over toes, and chest organized.",
          "Stand tall, step down, and rest long enough for the next rep to be just as explosive."
        ],
        "coach_cues": [
          "Jump up, not forward into the box.",
          "Quiet feet on the box.",
          "Knees track over the middle toes.",
          "Step down; do not rebound off a high box."
        ],
        "athlete_cues": [
          "Land like a ninja.",
          "Stick the landing before you stand tall.",
          "Step down and reset."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Box height too high for a clean landing",
          "Knees collapsing inward",
          "Landing on the toes or front edge of the box",
          "Rebounding down from the box instead of stepping down"
        ],
        "quality_gate": [
          "Every landing is quiet and controlled",
          "Athlete steps down safely",
          "No knee valgus, foot collapse, or torso panic",
          "Next rep looks as good as the first rep"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 3,
        "default_reps": 3,
        "default_work_seconds": null,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 45,
        "default_rpe_min": 7,
        "default_rpe_max": 9
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Split-Stance Box Jump; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Heavy lower-body strength",
        "Sled push",
        "Medicine-ball throws",
        "Acceleration work"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=G-bxQY57mKc",
        "https://www.youtube.com/watch?v=cLSB_Zn0awM",
        "https://www.youtube.com/watch?v=C5uWN9FIU9E"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 7,
        "load": 7,
        "complexity": 6,
        "overall": 7,
        "recommended_age_min": 9,
        "recommended_age_max": null,
        "attention_demand": "high",
        "notes": "Advanced box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 2,
        "impact_level": 3,
        "requires_spotting": false,
        "requires_coach_supervision": "optional",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface",
          "No prior mastery of lower-level box jumps and landing sticks"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 3,
        "minimum_hours_between_hard_exposures": 48,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": true,
        "counts_as_neural": true,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 4,
        "impact_level": 3,
        "intensity_ceiling": "high"
      },
      "subroleSecondary": "landing_braking_control"
    },
    {
      "slug": "staggered-stance-rotational-box-jump",
      "name": "Staggered-Stance Rotational Box Jump",
      "family": "Box Jump Explosive Power",
      "subrole": "deceleration_cod_power",
      "slot": "rotational_box_power",
      "primaryPhaseKey": "output",
      "cardSummary": "Box-jump-focused exercise that adds rotational intent from a staggered stance while the athlete lands square and stable on the box. Best used when the coach wants power expression without violating session order.",
      "bestPlacement": "Early Output block after warm-up and before heavy strength; give full recovery and stop while jumps are fast.",
      "description": "Staggered-Stance Rotational Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
      "coachLanguage": "Primary subrole: deceleration_cod_power. Slot: rotational_box_power. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
      "tenets": [
        {
          "key": "explosiveness",
          "weight": 5
        },
        {
          "key": "agility",
          "weight": 4
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
          "key": "neural_output_readiness",
          "weight": 5
        },
        {
          "key": "ssc_stiffness",
          "weight": 4
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
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        },
        {
          "key": "locomote",
          "weight": 2
        },
        {
          "key": "rotate",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Staggered-Stance Rotational Box Jump lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Output because high-speed force expression is freshness-sensitive and should happen before fatigue-producing strength or conditioning.",
      "commonMisuse": "Using box jumps for high-rep fatigue or chasing a box height that forces a deep knee tuck; that turns an Output drill into conditioning and hides poor takeoff quality.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 4
      },
      "coachingExecution": {
        "movement_description": "Staggered-Stance Rotational Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Begin in an athletic stance with eyes on the top/front edge of the box."
        ],
        "execution_steps": [
          "Rotate through the hips and trunk as one unit, then land square and stable on the box.",
          "Land on the box with the whole foot, knees tracking over toes, and chest organized.",
          "Stand tall, step down, and rest long enough for the next rep to be just as explosive."
        ],
        "coach_cues": [
          "Jump up, not forward into the box.",
          "Quiet feet on the box.",
          "Knees track over the middle toes.",
          "Step down; do not rebound off a high box.",
          "Rotate, then land square; do not spin after contact."
        ],
        "athlete_cues": [
          "Land like a ninja.",
          "Stick the landing before you stand tall.",
          "Step down and reset.",
          "Turn, land, freeze."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Box height too high for a clean landing",
          "Knees collapsing inward",
          "Landing on the toes or front edge of the box",
          "Rebounding down from the box instead of stepping down"
        ],
        "quality_gate": [
          "Every landing is quiet and controlled",
          "Athlete steps down safely",
          "No knee valgus, foot collapse, or torso panic",
          "Next rep looks as good as the first rep"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 3,
        "default_reps": 2,
        "default_work_seconds": null,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 45,
        "default_rpe_min": 7,
        "default_rpe_max": 9
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Staggered-Stance Rotational Box Jump; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Heavy lower-body strength",
        "Sled push",
        "Medicine-ball throws",
        "Acceleration work"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep",
        "deceleration"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=wgvSBp8_rKo",
        "https://www.youtube.com/watch?v=AH0kPH6Hfjc",
        "https://www.youtube.com/watch?v=otq4LjjwJcQ"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 8,
        "load": 8,
        "complexity": 7,
        "overall": 8,
        "recommended_age_min": 12,
        "recommended_age_max": null,
        "attention_demand": "high",
        "notes": "Elite box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 4,
        "impact_level": 4,
        "requires_spotting": false,
        "requires_coach_supervision": "required",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface",
          "No prior mastery of lower-level box jumps and landing sticks"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 2,
        "minimum_hours_between_hard_exposures": 48,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": true,
        "counts_as_neural": true,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 5,
        "impact_level": 4,
        "intensity_ceiling": "high"
      },
      "subroleSecondary": "landing_braking_control"
    },
    {
      "slug": "rear-foot-elevated-split-squat-jump-to-box",
      "name": "Rear-Foot-Elevated Split Squat Jump to Box",
      "family": "Box Jump Explosive Power",
      "subrole": "jump_throw_explosive_power",
      "slot": "asymmetrical_box_power",
      "primaryPhaseKey": "output",
      "cardSummary": "Box-jump-focused exercise that advanced unilateral strength-to-power bridge from a rear-foot-elevated start into a safe box target. Best used when the coach wants power expression without violating session order.",
      "bestPlacement": "Early Output block after warm-up and before heavy strength; give full recovery and stop while jumps are fast.",
      "description": "Rear-Foot-Elevated Split Squat Jump to Box is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Slot: asymmetrical_box_power. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
      "tenets": [
        {
          "key": "explosiveness",
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
          "key": "neural_output_readiness",
          "weight": 5
        },
        {
          "key": "ssc_stiffness",
          "weight": 4
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
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Rear-Foot-Elevated Split Squat Jump to Box lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Output because high-speed force expression is freshness-sensitive and should happen before fatigue-producing strength or conditioning.",
      "commonMisuse": "Using box jumps for high-rep fatigue or chasing a box height that forces a deep knee tuck; that turns an Output drill into conditioning and hides poor takeoff quality.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 4
      },
      "coachingExecution": {
        "movement_description": "Rear-Foot-Elevated Split Squat Jump to Box is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Begin in an athletic stance with eyes on the top/front edge of the box."
        ],
        "execution_steps": [
          "Load quickly but under control, then drive the floor away with full-body intent.",
          "Land on the box with the whole foot, knees tracking over toes, and chest organized.",
          "Stand tall, step down, and rest long enough for the next rep to be just as explosive."
        ],
        "coach_cues": [
          "Jump up, not forward into the box.",
          "Quiet feet on the box.",
          "Knees track over the middle toes.",
          "Step down; do not rebound off a high box."
        ],
        "athlete_cues": [
          "Land like a ninja.",
          "Stick the landing before you stand tall.",
          "Step down and reset."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Box height too high for a clean landing",
          "Knees collapsing inward",
          "Landing on the toes or front edge of the box",
          "Rebounding down from the box instead of stepping down"
        ],
        "quality_gate": [
          "Every landing is quiet and controlled",
          "Athlete steps down safely",
          "No knee valgus, foot collapse, or torso panic",
          "Next rep looks as good as the first rep"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 3,
        "default_reps": 2,
        "default_work_seconds": null,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 45,
        "default_rpe_min": 7,
        "default_rpe_max": 9
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Rear-Foot-Elevated Split Squat Jump to Box; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Heavy lower-body strength",
        "Sled push",
        "Medicine-ball throws",
        "Acceleration work"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=LDU_yVvp7pA",
        "https://www.youtube.com/watch?v=G-bxQY57mKc",
        "https://www.youtube.com/watch?v=cLSB_Zn0awM"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 8,
        "load": 8,
        "complexity": 7,
        "overall": 8,
        "recommended_age_min": 12,
        "recommended_age_max": null,
        "attention_demand": "high",
        "notes": "Elite box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 4,
        "impact_level": 4,
        "requires_spotting": false,
        "requires_coach_supervision": "required",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface",
          "No prior mastery of lower-level box jumps and landing sticks"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 2,
        "minimum_hours_between_hard_exposures": 48,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": true,
        "counts_as_neural": true,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 5,
        "impact_level": 4,
        "intensity_ceiling": "high"
      },
      "subroleSecondary": "landing_braking_control"
    },
    {
      "slug": "single-leg-hurdle-hop-to-box-jump",
      "name": "Single-Leg Hurdle Hop to Box Jump",
      "family": "Box Jump Explosive Power",
      "subrole": "reactive_agility_tumbling_output",
      "slot": "reactive_unilateral_box_power",
      "primaryPhaseKey": "output",
      "cardSummary": "Box-jump-focused exercise that links single-leg hurdle reactivity into a box landing for advanced elastic-power athletes. Best used when the coach wants power expression without violating session order.",
      "bestPlacement": "Early Output block after warm-up and before heavy strength; give full recovery and stop while jumps are fast.",
      "description": "Single-Leg Hurdle Hop to Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
      "coachLanguage": "Primary subrole: reactive_agility_tumbling_output. Slot: reactive_unilateral_box_power. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
      "tenets": [
        {
          "key": "explosiveness",
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
          "key": "neural_output_readiness",
          "weight": 5
        },
        {
          "key": "ssc_stiffness",
          "weight": 4
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
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        },
        {
          "key": "cones",
          "weight": 2
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Single-Leg Hurdle Hop to Box Jump lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Output because high-speed force expression is freshness-sensitive and should happen before fatigue-producing strength or conditioning.",
      "commonMisuse": "Using box jumps for high-rep fatigue or chasing a box height that forces a deep knee tuck; that turns an Output drill into conditioning and hides poor takeoff quality.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "single_leg",
        "coordination_demand": "high",
        "impact_level": 5
      },
      "coachingExecution": {
        "movement_description": "Single-Leg Hurdle Hop to Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Place a low hurdle or cone before the box; keep spacing short enough for crisp contacts.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Set up on the working leg with the stance foot rooted and the box low enough to keep the knee tracking clean."
        ],
        "execution_steps": [
          "Hop the hurdle with a fast, stiff contact, then immediately project to the box if quality stays high.",
          "Land on the box with the whole foot, knees tracking over toes, and chest organized.",
          "Stand tall, step down, and rest long enough for the next rep to be just as explosive."
        ],
        "coach_cues": [
          "Jump up, not forward into the box.",
          "Quiet feet on the box.",
          "Knees track over the middle toes.",
          "Step down; do not rebound off a high box.",
          "Pelvis level; do not let the stance hip dump."
        ],
        "athlete_cues": [
          "Land like a ninja.",
          "Stick the landing before you stand tall.",
          "Step down and reset.",
          "Balance before the next rep."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Box height too high for a clean landing",
          "Knees collapsing inward",
          "Landing on the toes or front edge of the box",
          "Rebounding down from the box instead of stepping down"
        ],
        "quality_gate": [
          "Every landing is quiet and controlled",
          "Athlete steps down safely",
          "No knee valgus, foot collapse, or torso panic",
          "Next rep looks as good as the first rep",
          "Single-leg balance is held without hopping"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 3,
        "default_reps": 2,
        "default_work_seconds": null,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 45,
        "default_rpe_min": 7,
        "default_rpe_max": 9
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Single-Leg Hurdle Hop to Box Jump; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Heavy lower-body strength",
        "Sled push",
        "Medicine-ball throws",
        "Acceleration work"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=CnWUbIjt57I",
        "https://www.youtube.com/watch?v=8f1a0r-oUZ4",
        "https://www.youtube.com/watch?v=8J-BAx1yTZE"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 8,
        "load": 8,
        "complexity": 7,
        "overall": 8,
        "recommended_age_min": 12,
        "recommended_age_max": null,
        "attention_demand": "high",
        "notes": "Elite box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 4,
        "impact_level": 5,
        "requires_spotting": false,
        "requires_coach_supervision": "required",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface",
          "No prior mastery of lower-level box jumps and landing sticks"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 2,
        "minimum_hours_between_hard_exposures": 48,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": true,
        "counts_as_neural": true,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 5,
        "impact_level": 5,
        "intensity_ceiling": "high"
      },
      "subroleSecondary": "landing_braking_control"
    }
  ]
}
```
# Box Jump Exercise Cards Batch 31-40
Copy the JSON block below into Cursor or an import script.
```json
{
  "cluster": {
    "topic": "box_jump_focused_exercises",
    "card_count": 10,
    "format": "Vortex Card v2 Authoring JSON (camelCase)",
    "notes": "Slot keys are intent-clear authoring slots; verify exact phase_order_slot keys against the application database before import.",
    "batch": "31-40"
  },
  "cards": [
    {
      "slug": "pogo-to-box-jump",
      "name": "Pogo to Box Jump",
      "family": "Box Jump Explosive Power",
      "subrole": "elastic_stiffness_plyometric_rudiments",
      "slot": "elastic_to_box_power",
      "primaryPhaseKey": "output",
      "cardSummary": "Box-jump-focused exercise that uses low-amplitude ankle stiffness before a single high-quality box jump. Best used when the coach wants power expression without violating session order.",
      "bestPlacement": "Early Output block after warm-up and before heavy strength; give full recovery and stop while jumps are fast.",
      "description": "Pogo to Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
      "coachLanguage": "Primary subrole: elastic_stiffness_plyometric_rudiments. Slot: elastic_to_box_power. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
      "tenets": [
        {
          "key": "explosiveness",
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
          "key": "neural_output_readiness",
          "weight": 5
        },
        {
          "key": "ssc_stiffness",
          "weight": 4
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
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Pogo to Box Jump lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Output because high-speed force expression is freshness-sensitive and should happen before fatigue-producing strength or conditioning.",
      "commonMisuse": "Using box jumps for high-rep fatigue or chasing a box height that forces a deep knee tuck; that turns an Output drill into conditioning and hides poor takeoff quality.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 4
      },
      "coachingExecution": {
        "movement_description": "Pogo to Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Begin in an athletic stance with eyes on the top/front edge of the box."
        ],
        "execution_steps": [
          "Load quickly but under control, then drive the floor away with full-body intent.",
          "Land on the box with the whole foot, knees tracking over toes, and chest organized.",
          "Stand tall, step down, and rest long enough for the next rep to be just as explosive."
        ],
        "coach_cues": [
          "Jump up, not forward into the box.",
          "Quiet feet on the box.",
          "Knees track over the middle toes.",
          "Step down; do not rebound off a high box."
        ],
        "athlete_cues": [
          "Land like a ninja.",
          "Stick the landing before you stand tall.",
          "Step down and reset."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Box height too high for a clean landing",
          "Knees collapsing inward",
          "Landing on the toes or front edge of the box",
          "Rebounding down from the box instead of stepping down"
        ],
        "quality_gate": [
          "Every landing is quiet and controlled",
          "Athlete steps down safely",
          "No knee valgus, foot collapse, or torso panic",
          "Next rep looks as good as the first rep"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 3,
        "default_reps": 3,
        "default_work_seconds": null,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 45,
        "default_rpe_min": 7,
        "default_rpe_max": 9
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Pogo to Box Jump; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Heavy lower-body strength",
        "Sled push",
        "Medicine-ball throws",
        "Acceleration work"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=G-bxQY57mKc",
        "https://www.youtube.com/watch?v=8J-BAx1yTZE",
        "https://www.youtube.com/watch?v=cLSB_Zn0awM"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 7,
        "load": 7,
        "complexity": 6,
        "overall": 7,
        "recommended_age_min": 9,
        "recommended_age_max": null,
        "attention_demand": "high",
        "notes": "Advanced box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 3,
        "impact_level": 4,
        "requires_spotting": false,
        "requires_coach_supervision": "recommended",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface",
          "No prior mastery of lower-level box jumps and landing sticks"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 3,
        "minimum_hours_between_hard_exposures": 48,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": true,
        "counts_as_neural": true,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 4,
        "impact_level": 4,
        "intensity_ceiling": "high"
      },
      "subroleSecondary": "landing_braking_control"
    },
    {
      "slug": "double-pogo-to-box-jump",
      "name": "Double Pogo to Box Jump",
      "family": "Box Jump Explosive Power",
      "subrole": "elastic_stiffness_plyometric_rudiments",
      "slot": "elastic_to_box_power",
      "primaryPhaseKey": "output",
      "cardSummary": "Box-jump-focused exercise that trains repeated stiff contacts followed by a decisive vertical impulse onto the box. Best used when the coach wants power expression without violating session order.",
      "bestPlacement": "Early Output block after warm-up and before heavy strength; give full recovery and stop while jumps are fast.",
      "description": "Double Pogo to Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
      "coachLanguage": "Primary subrole: elastic_stiffness_plyometric_rudiments. Slot: elastic_to_box_power. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
      "tenets": [
        {
          "key": "explosiveness",
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
          "key": "neural_output_readiness",
          "weight": 5
        },
        {
          "key": "ssc_stiffness",
          "weight": 4
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
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Double Pogo to Box Jump lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Output because high-speed force expression is freshness-sensitive and should happen before fatigue-producing strength or conditioning.",
      "commonMisuse": "Using box jumps for high-rep fatigue or chasing a box height that forces a deep knee tuck; that turns an Output drill into conditioning and hides poor takeoff quality.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 4
      },
      "coachingExecution": {
        "movement_description": "Double Pogo to Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Begin in an athletic stance with eyes on the top/front edge of the box."
        ],
        "execution_steps": [
          "Load quickly but under control, then drive the floor away with full-body intent.",
          "Land on the box with the whole foot, knees tracking over toes, and chest organized.",
          "Stand tall, step down, and rest long enough for the next rep to be just as explosive."
        ],
        "coach_cues": [
          "Jump up, not forward into the box.",
          "Quiet feet on the box.",
          "Knees track over the middle toes.",
          "Step down; do not rebound off a high box."
        ],
        "athlete_cues": [
          "Land like a ninja.",
          "Stick the landing before you stand tall.",
          "Step down and reset."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Box height too high for a clean landing",
          "Knees collapsing inward",
          "Landing on the toes or front edge of the box",
          "Rebounding down from the box instead of stepping down"
        ],
        "quality_gate": [
          "Every landing is quiet and controlled",
          "Athlete steps down safely",
          "No knee valgus, foot collapse, or torso panic",
          "Next rep looks as good as the first rep"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 3,
        "default_reps": 3,
        "default_work_seconds": null,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 45,
        "default_rpe_min": 7,
        "default_rpe_max": 9
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Double Pogo to Box Jump; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Heavy lower-body strength",
        "Sled push",
        "Medicine-ball throws",
        "Acceleration work"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=8J-BAx1yTZE",
        "https://www.youtube.com/watch?v=G-bxQY57mKc",
        "https://www.youtube.com/watch?v=cLSB_Zn0awM"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 7,
        "load": 7,
        "complexity": 6,
        "overall": 7,
        "recommended_age_min": 9,
        "recommended_age_max": null,
        "attention_demand": "high",
        "notes": "Advanced box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 3,
        "impact_level": 4,
        "requires_spotting": false,
        "requires_coach_supervision": "recommended",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface",
          "No prior mastery of lower-level box jumps and landing sticks"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 3,
        "minimum_hours_between_hard_exposures": 48,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": true,
        "counts_as_neural": true,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 4,
        "impact_level": 4,
        "intensity_ceiling": "high"
      },
      "subroleSecondary": "landing_braking_control"
    },
    {
      "slug": "hurdle-hop-to-box-jump",
      "name": "Hurdle Hop to Box Jump",
      "family": "Box Jump Explosive Power",
      "subrole": "reactive_agility_tumbling_output",
      "slot": "reactive_combo_box_power",
      "primaryPhaseKey": "output",
      "cardSummary": "Box-jump-focused exercise that combines a reactive hurdle contact with a controlled box target to train elastic rebound power. Best used when the coach wants power expression without violating session order.",
      "bestPlacement": "Early Output block after warm-up and before heavy strength; give full recovery and stop while jumps are fast.",
      "description": "Hurdle Hop to Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
      "coachLanguage": "Primary subrole: reactive_agility_tumbling_output. Slot: reactive_combo_box_power. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
      "tenets": [
        {
          "key": "explosiveness",
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
          "key": "neural_output_readiness",
          "weight": 5
        },
        {
          "key": "ssc_stiffness",
          "weight": 4
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
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        },
        {
          "key": "cones",
          "weight": 2
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Hurdle Hop to Box Jump lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Output because high-speed force expression is freshness-sensitive and should happen before fatigue-producing strength or conditioning.",
      "commonMisuse": "Using box jumps for high-rep fatigue or chasing a box height that forces a deep knee tuck; that turns an Output drill into conditioning and hides poor takeoff quality.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 5
      },
      "coachingExecution": {
        "movement_description": "Hurdle Hop to Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Place a low hurdle or cone before the box; keep spacing short enough for crisp contacts.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Begin in an athletic stance with eyes on the top/front edge of the box."
        ],
        "execution_steps": [
          "Hop the hurdle with a fast, stiff contact, then immediately project to the box if quality stays high.",
          "Land on the box with the whole foot, knees tracking over toes, and chest organized.",
          "Stand tall, step down, and rest long enough for the next rep to be just as explosive."
        ],
        "coach_cues": [
          "Jump up, not forward into the box.",
          "Quiet feet on the box.",
          "Knees track over the middle toes.",
          "Step down; do not rebound off a high box."
        ],
        "athlete_cues": [
          "Land like a ninja.",
          "Stick the landing before you stand tall.",
          "Step down and reset."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Box height too high for a clean landing",
          "Knees collapsing inward",
          "Landing on the toes or front edge of the box",
          "Rebounding down from the box instead of stepping down"
        ],
        "quality_gate": [
          "Every landing is quiet and controlled",
          "Athlete steps down safely",
          "No knee valgus, foot collapse, or torso panic",
          "Next rep looks as good as the first rep"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 3,
        "default_reps": 3,
        "default_work_seconds": null,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 45,
        "default_rpe_min": 7,
        "default_rpe_max": 9
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Hurdle Hop to Box Jump; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Heavy lower-body strength",
        "Sled push",
        "Medicine-ball throws",
        "Acceleration work"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=8J-BAx1yTZE",
        "https://www.youtube.com/watch?v=LGtfBs0hsgw",
        "https://www.youtube.com/watch?v=UOSzerRxXeA"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 7,
        "load": 8,
        "complexity": 6,
        "overall": 8,
        "recommended_age_min": 9,
        "recommended_age_max": null,
        "attention_demand": "high",
        "notes": "Advanced box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 4,
        "impact_level": 5,
        "requires_spotting": false,
        "requires_coach_supervision": "required",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface",
          "No prior mastery of lower-level box jumps and landing sticks"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 3,
        "minimum_hours_between_hard_exposures": 48,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": true,
        "counts_as_neural": true,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 4,
        "impact_level": 5,
        "intensity_ceiling": "high"
      },
      "subroleSecondary": "landing_braking_control"
    },
    {
      "slug": "lateral-hurdle-hop-to-box-jump",
      "name": "Lateral Hurdle Hop to Box Jump",
      "family": "Box Jump Explosive Power",
      "subrole": "reactive_agility_tumbling_output",
      "slot": "reactive_lateral_box_power",
      "primaryPhaseKey": "output",
      "cardSummary": "Box-jump-focused exercise that adds frontal-plane stiffness and redirection before jumping onto the box. Best used when the coach wants power expression without violating session order.",
      "bestPlacement": "Early Output block after warm-up and before heavy strength; give full recovery and stop while jumps are fast.",
      "description": "Lateral Hurdle Hop to Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
      "coachLanguage": "Primary subrole: reactive_agility_tumbling_output. Slot: reactive_lateral_box_power. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
      "tenets": [
        {
          "key": "explosiveness",
          "weight": 5
        },
        {
          "key": "agility",
          "weight": 4
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
          "key": "neural_output_readiness",
          "weight": 5
        },
        {
          "key": "ssc_stiffness",
          "weight": 4
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
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        },
        {
          "key": "locomote",
          "weight": 2
        },
        {
          "key": "rotate",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        },
        {
          "key": "cones",
          "weight": 2
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Lateral Hurdle Hop to Box Jump lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Output because high-speed force expression is freshness-sensitive and should happen before fatigue-producing strength or conditioning.",
      "commonMisuse": "Using box jumps for high-rep fatigue or chasing a box height that forces a deep knee tuck; that turns an Output drill into conditioning and hides poor takeoff quality.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 5
      },
      "coachingExecution": {
        "movement_description": "Lateral Hurdle Hop to Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Place a low hurdle or cone before the box; keep spacing short enough for crisp contacts.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Begin in an athletic stance with eyes on the top/front edge of the box."
        ],
        "execution_steps": [
          "Hop the hurdle with a fast, stiff contact, then immediately project to the box if quality stays high.",
          "Land on the box with the whole foot, knees tracking over toes, and chest organized.",
          "Stand tall, step down, and rest long enough for the next rep to be just as explosive."
        ],
        "coach_cues": [
          "Jump up, not forward into the box.",
          "Quiet feet on the box.",
          "Knees track over the middle toes.",
          "Step down; do not rebound off a high box."
        ],
        "athlete_cues": [
          "Land like a ninja.",
          "Stick the landing before you stand tall.",
          "Step down and reset."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Box height too high for a clean landing",
          "Knees collapsing inward",
          "Landing on the toes or front edge of the box",
          "Rebounding down from the box instead of stepping down"
        ],
        "quality_gate": [
          "Every landing is quiet and controlled",
          "Athlete steps down safely",
          "No knee valgus, foot collapse, or torso panic",
          "Next rep looks as good as the first rep"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 3,
        "default_reps": 2,
        "default_work_seconds": null,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 45,
        "default_rpe_min": 7,
        "default_rpe_max": 9
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Lateral Hurdle Hop to Box Jump; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Heavy lower-body strength",
        "Sled push",
        "Medicine-ball throws",
        "Acceleration work"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=mv0Pd1d9kLU",
        "https://www.youtube.com/watch?v=ao5mlfrJz58",
        "https://www.youtube.com/watch?v=8J-BAx1yTZE"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 8,
        "load": 8,
        "complexity": 7,
        "overall": 8,
        "recommended_age_min": 12,
        "recommended_age_max": null,
        "attention_demand": "high",
        "notes": "Elite box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 4,
        "impact_level": 5,
        "requires_spotting": false,
        "requires_coach_supervision": "required",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface",
          "No prior mastery of lower-level box jumps and landing sticks"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 2,
        "minimum_hours_between_hard_exposures": 48,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": true,
        "counts_as_neural": true,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 5,
        "impact_level": 5,
        "intensity_ceiling": "high"
      },
      "subroleSecondary": "landing_braking_control"
    },
    {
      "slug": "broad-jump-to-box-jump",
      "name": "Broad Jump to Box Jump",
      "family": "Box Jump Explosive Power",
      "subrole": "jump_throw_explosive_power",
      "slot": "horizontal_to_vertical_power",
      "primaryPhaseKey": "output",
      "cardSummary": "Box-jump-focused exercise that links horizontal projection into vertical box power while maintaining posture and landing discipline. Best used when the coach wants power expression without violating session order.",
      "bestPlacement": "Early Output block after warm-up and before heavy strength; give full recovery and stop while jumps are fast.",
      "description": "Broad Jump to Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Slot: horizontal_to_vertical_power. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
      "tenets": [
        {
          "key": "explosiveness",
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
          "key": "neural_output_readiness",
          "weight": 5
        },
        {
          "key": "ssc_stiffness",
          "weight": 4
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
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Broad Jump to Box Jump lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Output because high-speed force expression is freshness-sensitive and should happen before fatigue-producing strength or conditioning.",
      "commonMisuse": "Using box jumps for high-rep fatigue or chasing a box height that forces a deep knee tuck; that turns an Output drill into conditioning and hides poor takeoff quality.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 4
      },
      "coachingExecution": {
        "movement_description": "Broad Jump to Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Leave enough floor space between the start and box to perform a controlled broad jump before the box takeoff.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Begin in an athletic stance with eyes on the top/front edge of the box."
        ],
        "execution_steps": [
          "Project forward into the broad jump, control the contact, then convert into the box jump.",
          "Land on the box with the whole foot, knees tracking over toes, and chest organized.",
          "Stand tall, step down, and rest long enough for the next rep to be just as explosive."
        ],
        "coach_cues": [
          "Jump up, not forward into the box.",
          "Quiet feet on the box.",
          "Knees track over the middle toes.",
          "Step down; do not rebound off a high box."
        ],
        "athlete_cues": [
          "Land like a ninja.",
          "Stick the landing before you stand tall.",
          "Step down and reset."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Box height too high for a clean landing",
          "Knees collapsing inward",
          "Landing on the toes or front edge of the box",
          "Rebounding down from the box instead of stepping down"
        ],
        "quality_gate": [
          "Every landing is quiet and controlled",
          "Athlete steps down safely",
          "No knee valgus, foot collapse, or torso panic",
          "Next rep looks as good as the first rep"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 3,
        "default_reps": 3,
        "default_work_seconds": null,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 45,
        "default_rpe_min": 7,
        "default_rpe_max": 9
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Broad Jump to Box Jump; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Heavy lower-body strength",
        "Sled push",
        "Medicine-ball throws",
        "Acceleration work"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=Ssu5iwAe8tA",
        "https://www.youtube.com/watch?v=GfOgCuzwVn8",
        "https://www.youtube.com/watch?v=G-bxQY57mKc"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 7,
        "load": 7,
        "complexity": 6,
        "overall": 7,
        "recommended_age_min": 9,
        "recommended_age_max": null,
        "attention_demand": "high",
        "notes": "Advanced box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 3,
        "impact_level": 4,
        "requires_spotting": false,
        "requires_coach_supervision": "recommended",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface",
          "No prior mastery of lower-level box jumps and landing sticks"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 3,
        "minimum_hours_between_hard_exposures": 48,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": true,
        "counts_as_neural": true,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 4,
        "impact_level": 4,
        "intensity_ceiling": "high"
      },
      "subroleSecondary": "landing_braking_control"
    },
    {
      "slug": "reactive-rebound-broad-jump-to-box-jump",
      "name": "Reactive Rebound Broad Jump to Box Jump",
      "family": "Box Jump Explosive Power",
      "subrole": "reactive_agility_tumbling_output",
      "slot": "reactive_combo_box_power",
      "primaryPhaseKey": "output",
      "cardSummary": "Box-jump-focused exercise that uses a rebound broad jump into the box jump for advanced horizontal-to-vertical elastic transfer. Best used when the coach wants power expression without violating session order.",
      "bestPlacement": "Early Output block after warm-up and before heavy strength; give full recovery and stop while jumps are fast.",
      "description": "Reactive Rebound Broad Jump to Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
      "coachLanguage": "Primary subrole: reactive_agility_tumbling_output. Slot: reactive_combo_box_power. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
      "tenets": [
        {
          "key": "explosiveness",
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
          "key": "neural_output_readiness",
          "weight": 5
        },
        {
          "key": "ssc_stiffness",
          "weight": 4
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
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Reactive Rebound Broad Jump to Box Jump lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Output because high-speed force expression is freshness-sensitive and should happen before fatigue-producing strength or conditioning.",
      "commonMisuse": "Using box jumps for high-rep fatigue or chasing a box height that forces a deep knee tuck; that turns an Output drill into conditioning and hides poor takeoff quality.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 5
      },
      "coachingExecution": {
        "movement_description": "Reactive Rebound Broad Jump to Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Leave enough floor space between the start and box to perform a controlled broad jump before the box takeoff.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Begin in an athletic stance with eyes on the top/front edge of the box."
        ],
        "execution_steps": [
          "Project forward into the broad jump, control the contact, then convert into the box jump.",
          "Land on the box with the whole foot, knees tracking over toes, and chest organized.",
          "Stand tall, step down, and rest long enough for the next rep to be just as explosive."
        ],
        "coach_cues": [
          "Jump up, not forward into the box.",
          "Quiet feet on the box.",
          "Knees track over the middle toes.",
          "Step down; do not rebound off a high box."
        ],
        "athlete_cues": [
          "Land like a ninja.",
          "Stick the landing before you stand tall.",
          "Step down and reset."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Box height too high for a clean landing",
          "Knees collapsing inward",
          "Landing on the toes or front edge of the box",
          "Rebounding down from the box instead of stepping down"
        ],
        "quality_gate": [
          "Every landing is quiet and controlled",
          "Athlete steps down safely",
          "No knee valgus, foot collapse, or torso panic",
          "Next rep looks as good as the first rep"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 3,
        "default_reps": 2,
        "default_work_seconds": null,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 45,
        "default_rpe_min": 7,
        "default_rpe_max": 9
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Reactive Rebound Broad Jump to Box Jump; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Heavy lower-body strength",
        "Sled push",
        "Medicine-ball throws",
        "Acceleration work"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=CeGEIRWDBuM",
        "https://www.youtube.com/watch?v=Ssu5iwAe8tA",
        "https://www.youtube.com/watch?v=8J-BAx1yTZE"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 8,
        "load": 8,
        "complexity": 7,
        "overall": 8,
        "recommended_age_min": 12,
        "recommended_age_max": null,
        "attention_demand": "high",
        "notes": "Elite box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 4,
        "impact_level": 5,
        "requires_spotting": false,
        "requires_coach_supervision": "required",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface",
          "No prior mastery of lower-level box jumps and landing sticks"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 2,
        "minimum_hours_between_hard_exposures": 48,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": true,
        "counts_as_neural": true,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 5,
        "impact_level": 5,
        "intensity_ceiling": "high"
      },
      "subroleSecondary": "landing_braking_control"
    },
    {
      "slug": "depth-drop-to-box-jump",
      "name": "Depth Drop to Box Jump",
      "family": "Box Jump Explosive Power",
      "subrole": "reactive_agility_tumbling_output",
      "slot": "depth_to_box_power",
      "primaryPhaseKey": "output",
      "cardSummary": "Box-jump-focused exercise that drops from a low box and immediately projects to a second box, training transition from absorption to output. Best used when the coach wants power expression without violating session order.",
      "bestPlacement": "Early Output block after warm-up and before heavy strength; give full recovery and stop while jumps are fast.",
      "description": "Depth Drop to Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
      "coachLanguage": "Primary subrole: reactive_agility_tumbling_output. Slot: depth_to_box_power. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
      "tenets": [
        {
          "key": "explosiveness",
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
          "key": "neural_output_readiness",
          "weight": 5
        },
        {
          "key": "ssc_stiffness",
          "weight": 4
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
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Depth Drop to Box Jump lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Output because high-speed force expression is freshness-sensitive and should happen before fatigue-producing strength or conditioning.",
      "commonMisuse": "Using box jumps for high-rep fatigue or chasing a box height that forces a deep knee tuck; that turns an Output drill into conditioning and hides poor takeoff quality.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 5
      },
      "coachingExecution": {
        "movement_description": "Depth Drop to Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Stand tall on the first low box with toes close to the edge and arms relaxed but ready."
        ],
        "execution_steps": [
          "Load quickly but under control, then drive the floor away with full-body intent.",
          "Land on the box with the whole foot, knees tracking over toes, and chest organized.",
          "Stand tall, step down, and rest long enough for the next rep to be just as explosive."
        ],
        "coach_cues": [
          "Jump up, not forward into the box.",
          "Quiet feet on the box.",
          "Knees track over the middle toes.",
          "Step down; do not rebound off a high box."
        ],
        "athlete_cues": [
          "Land like a ninja.",
          "Stick the landing before you stand tall.",
          "Step down and reset."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Box height too high for a clean landing",
          "Knees collapsing inward",
          "Landing on the toes or front edge of the box",
          "Rebounding down from the box instead of stepping down"
        ],
        "quality_gate": [
          "Every landing is quiet and controlled",
          "Athlete steps down safely",
          "No knee valgus, foot collapse, or torso panic",
          "Next rep looks as good as the first rep"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 3,
        "default_reps": 2,
        "default_work_seconds": null,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 45,
        "default_rpe_min": 7,
        "default_rpe_max": 9
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Depth Drop to Box Jump; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Heavy lower-body strength",
        "Sled push",
        "Medicine-ball throws",
        "Acceleration work"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=wRvUBhlTjHU",
        "https://www.youtube.com/watch?v=rv3Sq3u-UhU",
        "https://www.youtube.com/watch?v=H5vvlcANU8Y"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 8,
        "load": 8,
        "complexity": 7,
        "overall": 8,
        "recommended_age_min": 12,
        "recommended_age_max": null,
        "attention_demand": "high",
        "notes": "Elite box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 4,
        "impact_level": 5,
        "requires_spotting": false,
        "requires_coach_supervision": "required",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface",
          "No prior mastery of lower-level box jumps and landing sticks"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 2,
        "minimum_hours_between_hard_exposures": 48,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": true,
        "counts_as_neural": true,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 5,
        "impact_level": 5,
        "intensity_ceiling": "high"
      },
      "subroleSecondary": "landing_braking_control"
    },
    {
      "slug": "depth-jump-to-box-jump",
      "name": "Depth Jump to Box Jump",
      "family": "Box Jump Explosive Power",
      "subrole": "reactive_agility_tumbling_output",
      "slot": "depth_to_box_power",
      "primaryPhaseKey": "output",
      "cardSummary": "Box-jump-focused exercise that advanced depth-jump exposure that should only be used when ground contact and landing quality stay excellent. Best used when the coach wants power expression without violating session order.",
      "bestPlacement": "Early Output block after warm-up and before heavy strength; give full recovery and stop while jumps are fast.",
      "description": "Depth Jump to Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
      "coachLanguage": "Primary subrole: reactive_agility_tumbling_output. Slot: depth_to_box_power. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
      "tenets": [
        {
          "key": "explosiveness",
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
          "key": "neural_output_readiness",
          "weight": 5
        },
        {
          "key": "ssc_stiffness",
          "weight": 4
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
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Depth Jump to Box Jump lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Output because high-speed force expression is freshness-sensitive and should happen before fatigue-producing strength or conditioning.",
      "commonMisuse": "Using box jumps for high-rep fatigue or chasing a box height that forces a deep knee tuck; that turns an Output drill into conditioning and hides poor takeoff quality.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 5
      },
      "coachingExecution": {
        "movement_description": "Depth Jump to Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Stand tall on the first low box with toes close to the edge and arms relaxed but ready."
        ],
        "execution_steps": [
          "Load quickly but under control, then drive the floor away with full-body intent.",
          "Land on the box with the whole foot, knees tracking over toes, and chest organized.",
          "Stand tall, step down, and rest long enough for the next rep to be just as explosive."
        ],
        "coach_cues": [
          "Jump up, not forward into the box.",
          "Quiet feet on the box.",
          "Knees track over the middle toes.",
          "Step down; do not rebound off a high box."
        ],
        "athlete_cues": [
          "Land like a ninja.",
          "Stick the landing before you stand tall.",
          "Step down and reset."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Box height too high for a clean landing",
          "Knees collapsing inward",
          "Landing on the toes or front edge of the box",
          "Rebounding down from the box instead of stepping down"
        ],
        "quality_gate": [
          "Every landing is quiet and controlled",
          "Athlete steps down safely",
          "No knee valgus, foot collapse, or torso panic",
          "Next rep looks as good as the first rep"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 3,
        "default_reps": 2,
        "default_work_seconds": null,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 45,
        "default_rpe_min": 7,
        "default_rpe_max": 9
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Depth Jump to Box Jump; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Heavy lower-body strength",
        "Sled push",
        "Medicine-ball throws",
        "Acceleration work"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=wRvUBhlTjHU",
        "https://www.youtube.com/watch?v=rv3Sq3u-UhU",
        "https://www.youtube.com/watch?v=LGtfBs0hsgw"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 8,
        "load": 8,
        "complexity": 7,
        "overall": 8,
        "recommended_age_min": 12,
        "recommended_age_max": null,
        "attention_demand": "high",
        "notes": "Elite box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 4,
        "impact_level": 5,
        "requires_spotting": false,
        "requires_coach_supervision": "required",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface",
          "No prior mastery of lower-level box jumps and landing sticks"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 2,
        "minimum_hours_between_hard_exposures": 48,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": true,
        "counts_as_neural": true,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 5,
        "impact_level": 5,
        "intensity_ceiling": "high"
      },
      "subroleSecondary": "landing_braking_control"
    },
    {
      "slug": "box-jump-to-depth-drop",
      "name": "Box Jump to Depth Drop",
      "family": "Box Jump Landing & Braking Control",
      "subrole": "landing_braking_control",
      "slot": "landing_braking_control",
      "primaryPhaseKey": "resilience",
      "cardSummary": "Box-jump-focused exercise that turns the box jump into a landing-resilience drill by adding a deliberate drop-and-stick afterward. Best used when the coach wants landing control without violating session order.",
      "bestPlacement": "Resilience block after warm-up, Output, or Capacity when the goal is landing control rather than maximal jump height.",
      "description": "Box Jump to Depth Drop is a box-jump-family landing-control drill. The athlete uses the box or drop height only as high as they can absorb quietly, holds the landing shape, then resets before the next attempt. The main goal is braking skill, joint alignment, and tissue tolerance rather than chasing height or fatigue.",
      "coachLanguage": "Primary subrole: landing_braking_control. Slot: landing_braking_control. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
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
          "key": "strength",
          "weight": 2
        }
      ],
      "methodologies": [
        {
          "key": "plyometrics",
          "weight": 3
        },
        {
          "key": "balance_stability",
          "weight": 5
        },
        {
          "key": "eccentric_negative",
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
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Box Jump to Depth Drop lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Resilience because the adaptation target is braking quality, landing tolerance, and joint control, not maximal power.",
      "commonMisuse": "Rushing to height or speed before the athlete can stick the landing; this changes a control drill into uncontrolled impact.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 5
      },
      "coachingExecution": {
        "movement_description": "Box Jump to Depth Drop is a box-jump-family landing-control drill. The athlete uses the box or drop height only as high as they can absorb quietly, holds the landing shape, then resets before the next attempt. The main goal is braking skill, joint alignment, and tissue tolerance rather than chasing height or fatigue.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Stand tall on the first low box with toes close to the edge and arms relaxed but ready."
        ],
        "execution_steps": [
          "Move or drop into the landing with a quiet, controlled foot contact.",
          "Absorb through the ankles, knees, and hips while keeping ribs stacked over pelvis.",
          "Hold the stick for two full seconds before stepping down and resetting."
        ],
        "coach_cues": [
          "Own the stick before adding height.",
          "Absorb through ankle, knee, and hip together.",
          "No knee cave or torso collapse.",
          "Stop as soon as landings get loud."
        ],
        "athlete_cues": [
          "Land soft and freeze.",
          "Knees point the same way as toes.",
          "Hold still before you move."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Landing noise increases across reps",
          "Knees cave or feet collapse inward",
          "Athlete cannot hold the stick",
          "Torso folds forward on contact"
        ],
        "quality_gate": [
          "Athlete holds the stick for two seconds",
          "Landing is quiet and symmetrical enough for the drill",
          "Athlete can explain or demonstrate the safer step-down reset"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "attempts",
        "default_sets": 2,
        "default_reps": 3,
        "default_work_seconds": null,
        "default_rest_seconds": 45,
        "est_seconds_per_set": 35,
        "default_rpe_min": 4,
        "default_rpe_max": 6
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Box Jump to Depth Drop; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Low Box Jump to Stick",
        "Countermovement Box Jump"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep",
        "control_landing",
        "resilience"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=-ZGryFyvnt4",
        "https://www.youtube.com/watch?v=ZL54zeg6qjg",
        "https://www.youtube.com/watch?v=yG8pexv9J6g"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 7,
        "load": 8,
        "complexity": 6,
        "overall": 8,
        "recommended_age_min": 9,
        "recommended_age_max": null,
        "attention_demand": "high",
        "notes": "Advanced box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 4,
        "impact_level": 5,
        "requires_spotting": false,
        "requires_coach_supervision": "required",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface",
          "No prior mastery of lower-level box jumps and landing sticks"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 3,
        "minimum_hours_between_hard_exposures": 48,
        "counts_as_high_intensity": false,
        "counts_as_high_impact": true,
        "counts_as_neural": false,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": false,
        "fatigue_cost": 3,
        "fatigue_sensitivity": 3,
        "technical_complexity": 4,
        "impact_level": 5,
        "intensity_ceiling": "moderate"
      },
      "subroleSecondary": "jump_throw_explosive_power"
    },
    {
      "slug": "low-consecutive-rebound-box-jump",
      "name": "Low Consecutive Rebound Box Jump",
      "family": "Box Jump Explosive Power",
      "subrole": "elastic_stiffness_plyometric_rudiments",
      "slot": "elastic_to_box_power",
      "primaryPhaseKey": "output",
      "cardSummary": "Box-jump-focused exercise that uses a very low box and capped contacts to teach quick rebounding without turning the set into conditioning. Best used when the coach wants power expression without violating session order.",
      "bestPlacement": "Early Output block after warm-up and before heavy strength; give full recovery and stop while jumps are fast.",
      "description": "Low Consecutive Rebound Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
      "coachLanguage": "Primary subrole: elastic_stiffness_plyometric_rudiments. Slot: elastic_to_box_power. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
      "tenets": [
        {
          "key": "explosiveness",
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
          "key": "neural_output_readiness",
          "weight": 5
        },
        {
          "key": "ssc_stiffness",
          "weight": 4
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
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Low Consecutive Rebound Box Jump lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Output because high-speed force expression is freshness-sensitive and should happen before fatigue-producing strength or conditioning.",
      "commonMisuse": "Using box jumps for high-rep fatigue or chasing a box height that forces a deep knee tuck; that turns an Output drill into conditioning and hides poor takeoff quality.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 4
      },
      "coachingExecution": {
        "movement_description": "Low Consecutive Rebound Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Begin in an athletic stance with eyes on the top/front edge of the box."
        ],
        "execution_steps": [
          "Load quickly but under control, then drive the floor away with full-body intent.",
          "Land on the box with the whole foot, knees tracking over toes, and chest organized.",
          "Stand tall, step down, and rest long enough for the next rep to be just as explosive."
        ],
        "coach_cues": [
          "Jump up, not forward into the box.",
          "Quiet feet on the box.",
          "Knees track over the middle toes.",
          "Step down; do not rebound off a high box."
        ],
        "athlete_cues": [
          "Land like a ninja.",
          "Stick the landing before you stand tall.",
          "Step down and reset."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Box height too high for a clean landing",
          "Knees collapsing inward",
          "Landing on the toes or front edge of the box",
          "Rebounding down from the box instead of stepping down"
        ],
        "quality_gate": [
          "Every landing is quiet and controlled",
          "Athlete steps down safely",
          "No knee valgus, foot collapse, or torso panic",
          "Next rep looks as good as the first rep"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 3,
        "default_reps": 3,
        "default_work_seconds": null,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 45,
        "default_rpe_min": 7,
        "default_rpe_max": 9
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Low Consecutive Rebound Box Jump; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Heavy lower-body strength",
        "Sled push",
        "Medicine-ball throws",
        "Acceleration work"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=G-bxQY57mKc",
        "https://www.youtube.com/watch?v=cLSB_Zn0awM",
        "https://www.youtube.com/watch?v=fTpI4tgjci0"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 7,
        "load": 7,
        "complexity": 6,
        "overall": 7,
        "recommended_age_min": 9,
        "recommended_age_max": null,
        "attention_demand": "high",
        "notes": "Advanced box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 3,
        "impact_level": 4,
        "requires_spotting": false,
        "requires_coach_supervision": "recommended",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface",
          "No prior mastery of lower-level box jumps and landing sticks"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 3,
        "minimum_hours_between_hard_exposures": 48,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": true,
        "counts_as_neural": true,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 4,
        "impact_level": 4,
        "intensity_ceiling": "high"
      },
      "subroleSecondary": "landing_braking_control"
    }
  ]
}
```
# Box Jump Exercise Cards Batch 41-50
Copy the JSON block below into Cursor or an import script.
```json
{
  "cluster": {
    "topic": "box_jump_focused_exercises",
    "card_count": 10,
    "format": "Vortex Card v2 Authoring JSON (camelCase)",
    "notes": "Slot keys are intent-clear authoring slots; verify exact phase_order_slot keys against the application database before import.",
    "batch": "41-50"
  },
  "cards": [
    {
      "slug": "lateral-box-jump",
      "name": "Lateral Box Jump",
      "family": "Box Jump Explosive Power",
      "subrole": "deceleration_cod_power",
      "slot": "multidirectional_box_power",
      "primaryPhaseKey": "output",
      "cardSummary": "Box-jump-focused exercise that develops side-to-side force production and landing control with the box as a lateral target. Best used when the coach wants power expression without violating session order.",
      "bestPlacement": "Early Output block after warm-up and before heavy strength; give full recovery and stop while jumps are fast.",
      "description": "Lateral Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
      "coachLanguage": "Primary subrole: deceleration_cod_power. Slot: multidirectional_box_power. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
      "tenets": [
        {
          "key": "explosiveness",
          "weight": 5
        },
        {
          "key": "agility",
          "weight": 4
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
          "key": "neural_output_readiness",
          "weight": 5
        },
        {
          "key": "ssc_stiffness",
          "weight": 4
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
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        },
        {
          "key": "locomote",
          "weight": 2
        },
        {
          "key": "rotate",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Lateral Box Jump lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Output because high-speed force expression is freshness-sensitive and should happen before fatigue-producing strength or conditioning.",
      "commonMisuse": "Using box jumps for high-rep fatigue or chasing a box height that forces a deep knee tuck; that turns an Output drill into conditioning and hides poor takeoff quality.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 4
      },
      "coachingExecution": {
        "movement_description": "Lateral Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Begin in an athletic stance with eyes on the top/front edge of the box."
        ],
        "execution_steps": [
          "Load quickly but under control, then drive the floor away with full-body intent.",
          "Land on the box with the whole foot, knees tracking over toes, and chest organized.",
          "Stand tall, step down, and rest long enough for the next rep to be just as explosive."
        ],
        "coach_cues": [
          "Jump up, not forward into the box.",
          "Quiet feet on the box.",
          "Knees track over the middle toes.",
          "Step down; do not rebound off a high box."
        ],
        "athlete_cues": [
          "Land like a ninja.",
          "Stick the landing before you stand tall.",
          "Step down and reset."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Box height too high for a clean landing",
          "Knees collapsing inward",
          "Landing on the toes or front edge of the box",
          "Rebounding down from the box instead of stepping down"
        ],
        "quality_gate": [
          "Every landing is quiet and controlled",
          "Athlete steps down safely",
          "No knee valgus, foot collapse, or torso panic",
          "Next rep looks as good as the first rep"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 3,
        "default_reps": 3,
        "default_work_seconds": null,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 45,
        "default_rpe_min": 7,
        "default_rpe_max": 9
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Lateral Box Jump; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Heavy lower-body strength",
        "Sled push",
        "Medicine-ball throws",
        "Acceleration work"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep",
        "deceleration"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=oQFykYI4pRM",
        "https://www.youtube.com/watch?v=sugmNPK5Pw4",
        "https://www.youtube.com/watch?v=G-bxQY57mKc"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 7,
        "load": 7,
        "complexity": 6,
        "overall": 7,
        "recommended_age_min": 9,
        "recommended_age_max": null,
        "attention_demand": "high",
        "notes": "Advanced box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 3,
        "impact_level": 4,
        "requires_spotting": false,
        "requires_coach_supervision": "recommended",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface",
          "No prior mastery of lower-level box jumps and landing sticks"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 3,
        "minimum_hours_between_hard_exposures": 48,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": true,
        "counts_as_neural": true,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 4,
        "impact_level": 4,
        "intensity_ceiling": "high"
      },
      "subroleSecondary": "landing_braking_control"
    },
    {
      "slug": "side-to-side-box-jump-over",
      "name": "Side-to-Side Box Jump Over",
      "family": "Box Jump Explosive Power",
      "subrole": "deceleration_cod_power",
      "slot": "multidirectional_box_power",
      "primaryPhaseKey": "output",
      "cardSummary": "Box-jump-focused exercise that trains lateral stiffness and spatial awareness over a low box with strict quality and low volume. Best used when the coach wants power expression without violating session order.",
      "bestPlacement": "Early Output block after warm-up and before heavy strength; give full recovery and stop while jumps are fast.",
      "description": "Side-to-Side Box Jump Over is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
      "coachLanguage": "Primary subrole: deceleration_cod_power. Slot: multidirectional_box_power. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
      "tenets": [
        {
          "key": "explosiveness",
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
          "key": "neural_output_readiness",
          "weight": 5
        },
        {
          "key": "ssc_stiffness",
          "weight": 4
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
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        },
        {
          "key": "locomote",
          "weight": 2
        },
        {
          "key": "rotate",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Side-to-Side Box Jump Over lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Output because high-speed force expression is freshness-sensitive and should happen before fatigue-producing strength or conditioning.",
      "commonMisuse": "Using box jumps for high-rep fatigue or chasing a box height that forces a deep knee tuck; that turns an Output drill into conditioning and hides poor takeoff quality.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 4
      },
      "coachingExecution": {
        "movement_description": "Side-to-Side Box Jump Over is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Begin in an athletic stance with eyes on the top/front edge of the box."
        ],
        "execution_steps": [
          "Load quickly but under control, then drive the floor away with full-body intent.",
          "Land on the box with the whole foot, knees tracking over toes, and chest organized.",
          "Stand tall, step down, and rest long enough for the next rep to be just as explosive."
        ],
        "coach_cues": [
          "Jump up, not forward into the box.",
          "Quiet feet on the box.",
          "Knees track over the middle toes.",
          "Step down; do not rebound off a high box."
        ],
        "athlete_cues": [
          "Land like a ninja.",
          "Stick the landing before you stand tall.",
          "Step down and reset."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Box height too high for a clean landing",
          "Knees collapsing inward",
          "Landing on the toes or front edge of the box",
          "Rebounding down from the box instead of stepping down"
        ],
        "quality_gate": [
          "Every landing is quiet and controlled",
          "Athlete steps down safely",
          "No knee valgus, foot collapse, or torso panic",
          "Next rep looks as good as the first rep"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 3,
        "default_reps": 3,
        "default_work_seconds": null,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 45,
        "default_rpe_min": 7,
        "default_rpe_max": 9
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Side-to-Side Box Jump Over; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Heavy lower-body strength",
        "Sled push",
        "Medicine-ball throws",
        "Acceleration work"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep",
        "deceleration"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=oQFykYI4pRM",
        "https://www.youtube.com/watch?v=sugmNPK5Pw4",
        "https://www.youtube.com/watch?v=FrLxbdpco-s"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 7,
        "load": 7,
        "complexity": 6,
        "overall": 7,
        "recommended_age_min": 9,
        "recommended_age_max": null,
        "attention_demand": "high",
        "notes": "Advanced box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 3,
        "impact_level": 4,
        "requires_spotting": false,
        "requires_coach_supervision": "recommended",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface",
          "No prior mastery of lower-level box jumps and landing sticks"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 3,
        "minimum_hours_between_hard_exposures": 48,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": true,
        "counts_as_neural": true,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 4,
        "impact_level": 4,
        "intensity_ceiling": "high"
      },
      "subroleSecondary": "landing_braking_control"
    },
    {
      "slug": "90-degree-box-jump",
      "name": "90-Degree Box Jump",
      "family": "Box Jump Explosive Power",
      "subrole": "deceleration_cod_power",
      "slot": "rotational_box_power",
      "primaryPhaseKey": "output",
      "cardSummary": "Box-jump-focused exercise that teaches rotational projection and square landing after a 90-degree turn. Best used when the coach wants power expression without violating session order.",
      "bestPlacement": "Early Output block after warm-up and before heavy strength; give full recovery and stop while jumps are fast.",
      "description": "90-Degree Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
      "coachLanguage": "Primary subrole: deceleration_cod_power. Slot: rotational_box_power. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
      "tenets": [
        {
          "key": "explosiveness",
          "weight": 5
        },
        {
          "key": "agility",
          "weight": 4
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
          "key": "neural_output_readiness",
          "weight": 5
        },
        {
          "key": "ssc_stiffness",
          "weight": 4
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
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        },
        {
          "key": "locomote",
          "weight": 2
        },
        {
          "key": "rotate",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, 90-Degree Box Jump lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Output because high-speed force expression is freshness-sensitive and should happen before fatigue-producing strength or conditioning.",
      "commonMisuse": "Using box jumps for high-rep fatigue or chasing a box height that forces a deep knee tuck; that turns an Output drill into conditioning and hides poor takeoff quality.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 4
      },
      "coachingExecution": {
        "movement_description": "90-Degree Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Begin in an athletic stance with eyes on the top/front edge of the box."
        ],
        "execution_steps": [
          "Rotate through the hips and trunk as one unit, then land square and stable on the box.",
          "Land on the box with the whole foot, knees tracking over toes, and chest organized.",
          "Stand tall, step down, and rest long enough for the next rep to be just as explosive."
        ],
        "coach_cues": [
          "Jump up, not forward into the box.",
          "Quiet feet on the box.",
          "Knees track over the middle toes.",
          "Step down; do not rebound off a high box.",
          "Rotate, then land square; do not spin after contact."
        ],
        "athlete_cues": [
          "Land like a ninja.",
          "Stick the landing before you stand tall.",
          "Step down and reset.",
          "Turn, land, freeze."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Box height too high for a clean landing",
          "Knees collapsing inward",
          "Landing on the toes or front edge of the box",
          "Rebounding down from the box instead of stepping down"
        ],
        "quality_gate": [
          "Every landing is quiet and controlled",
          "Athlete steps down safely",
          "No knee valgus, foot collapse, or torso panic",
          "Next rep looks as good as the first rep"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 3,
        "default_reps": 3,
        "default_work_seconds": null,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 45,
        "default_rpe_min": 7,
        "default_rpe_max": 9
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of 90-Degree Box Jump; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Heavy lower-body strength",
        "Sled push",
        "Medicine-ball throws",
        "Acceleration work"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep",
        "deceleration"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=xNfb38oKrPQ",
        "https://www.youtube.com/watch?v=AH0kPH6Hfjc",
        "https://www.youtube.com/watch?v=3IqpTO-CCMY"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 7,
        "load": 7,
        "complexity": 6,
        "overall": 7,
        "recommended_age_min": 9,
        "recommended_age_max": null,
        "attention_demand": "high",
        "notes": "Advanced box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 3,
        "impact_level": 4,
        "requires_spotting": false,
        "requires_coach_supervision": "recommended",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface",
          "No prior mastery of lower-level box jumps and landing sticks"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 3,
        "minimum_hours_between_hard_exposures": 48,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": true,
        "counts_as_neural": true,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 4,
        "impact_level": 4,
        "intensity_ceiling": "high"
      },
      "subroleSecondary": "landing_braking_control"
    },
    {
      "slug": "rotational-box-jump",
      "name": "Rotational Box Jump",
      "family": "Box Jump Explosive Power",
      "subrole": "deceleration_cod_power",
      "slot": "rotational_box_power",
      "primaryPhaseKey": "output",
      "cardSummary": "Box-jump-focused exercise that develops transverse-plane power and landing control without chasing height. Best used when the coach wants power expression without violating session order.",
      "bestPlacement": "Early Output block after warm-up and before heavy strength; give full recovery and stop while jumps are fast.",
      "description": "Rotational Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
      "coachLanguage": "Primary subrole: deceleration_cod_power. Slot: rotational_box_power. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
      "tenets": [
        {
          "key": "explosiveness",
          "weight": 5
        },
        {
          "key": "agility",
          "weight": 4
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
          "key": "neural_output_readiness",
          "weight": 5
        },
        {
          "key": "ssc_stiffness",
          "weight": 4
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
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        },
        {
          "key": "locomote",
          "weight": 2
        },
        {
          "key": "rotate",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Rotational Box Jump lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Output because high-speed force expression is freshness-sensitive and should happen before fatigue-producing strength or conditioning.",
      "commonMisuse": "Using box jumps for high-rep fatigue or chasing a box height that forces a deep knee tuck; that turns an Output drill into conditioning and hides poor takeoff quality.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 4
      },
      "coachingExecution": {
        "movement_description": "Rotational Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Begin in an athletic stance with eyes on the top/front edge of the box."
        ],
        "execution_steps": [
          "Rotate through the hips and trunk as one unit, then land square and stable on the box.",
          "Land on the box with the whole foot, knees tracking over toes, and chest organized.",
          "Stand tall, step down, and rest long enough for the next rep to be just as explosive."
        ],
        "coach_cues": [
          "Jump up, not forward into the box.",
          "Quiet feet on the box.",
          "Knees track over the middle toes.",
          "Step down; do not rebound off a high box.",
          "Rotate, then land square; do not spin after contact."
        ],
        "athlete_cues": [
          "Land like a ninja.",
          "Stick the landing before you stand tall.",
          "Step down and reset.",
          "Turn, land, freeze."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Box height too high for a clean landing",
          "Knees collapsing inward",
          "Landing on the toes or front edge of the box",
          "Rebounding down from the box instead of stepping down"
        ],
        "quality_gate": [
          "Every landing is quiet and controlled",
          "Athlete steps down safely",
          "No knee valgus, foot collapse, or torso panic",
          "Next rep looks as good as the first rep"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 3,
        "default_reps": 3,
        "default_work_seconds": null,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 45,
        "default_rpe_min": 7,
        "default_rpe_max": 9
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Rotational Box Jump; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Heavy lower-body strength",
        "Sled push",
        "Medicine-ball throws",
        "Acceleration work"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep",
        "deceleration"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=wgvSBp8_rKo",
        "https://www.youtube.com/watch?v=WgCge6U-6FQ",
        "https://www.youtube.com/watch?v=AH0kPH6Hfjc"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 7,
        "load": 7,
        "complexity": 6,
        "overall": 7,
        "recommended_age_min": 9,
        "recommended_age_max": null,
        "attention_demand": "high",
        "notes": "Advanced box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 3,
        "impact_level": 4,
        "requires_spotting": false,
        "requires_coach_supervision": "recommended",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface",
          "No prior mastery of lower-level box jumps and landing sticks"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 3,
        "minimum_hours_between_hard_exposures": 48,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": true,
        "counts_as_neural": true,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 4,
        "impact_level": 4,
        "intensity_ceiling": "high"
      },
      "subroleSecondary": "landing_braking_control"
    },
    {
      "slug": "diagonal-approach-box-jump",
      "name": "Diagonal Approach Box Jump",
      "family": "Box Jump Explosive Power",
      "subrole": "deceleration_cod_power",
      "slot": "multidirectional_box_power",
      "primaryPhaseKey": "output",
      "cardSummary": "Box-jump-focused exercise that bridges COD mechanics into a controlled diagonal approach and stable box landing. Best used when the coach wants power expression without violating session order.",
      "bestPlacement": "Early Output block after warm-up and before heavy strength; give full recovery and stop while jumps are fast.",
      "description": "Diagonal Approach Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
      "coachLanguage": "Primary subrole: deceleration_cod_power. Slot: multidirectional_box_power. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
      "tenets": [
        {
          "key": "explosiveness",
          "weight": 5
        },
        {
          "key": "agility",
          "weight": 4
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
          "key": "neural_output_readiness",
          "weight": 5
        },
        {
          "key": "ssc_stiffness",
          "weight": 4
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
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        },
        {
          "key": "locomote",
          "weight": 2
        },
        {
          "key": "rotate",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Diagonal Approach Box Jump lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Output because high-speed force expression is freshness-sensitive and should happen before fatigue-producing strength or conditioning.",
      "commonMisuse": "Using box jumps for high-rep fatigue or chasing a box height that forces a deep knee tuck; that turns an Output drill into conditioning and hides poor takeoff quality.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 4
      },
      "coachingExecution": {
        "movement_description": "Diagonal Approach Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Begin in an athletic stance with eyes on the top/front edge of the box."
        ],
        "execution_steps": [
          "Load quickly but under control, then drive the floor away with full-body intent.",
          "Land on the box with the whole foot, knees tracking over toes, and chest organized.",
          "Stand tall, step down, and rest long enough for the next rep to be just as explosive."
        ],
        "coach_cues": [
          "Jump up, not forward into the box.",
          "Quiet feet on the box.",
          "Knees track over the middle toes.",
          "Step down; do not rebound off a high box."
        ],
        "athlete_cues": [
          "Land like a ninja.",
          "Stick the landing before you stand tall.",
          "Step down and reset."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Box height too high for a clean landing",
          "Knees collapsing inward",
          "Landing on the toes or front edge of the box",
          "Rebounding down from the box instead of stepping down"
        ],
        "quality_gate": [
          "Every landing is quiet and controlled",
          "Athlete steps down safely",
          "No knee valgus, foot collapse, or torso panic",
          "Next rep looks as good as the first rep"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 3,
        "default_reps": 3,
        "default_work_seconds": null,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 45,
        "default_rpe_min": 7,
        "default_rpe_max": 9
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Diagonal Approach Box Jump; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Heavy lower-body strength",
        "Sled push",
        "Medicine-ball throws",
        "Acceleration work"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep",
        "deceleration"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=AH0kPH6Hfjc",
        "https://www.youtube.com/watch?v=oQFykYI4pRM",
        "https://www.youtube.com/watch?v=G-bxQY57mKc"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 7,
        "load": 7,
        "complexity": 6,
        "overall": 7,
        "recommended_age_min": 9,
        "recommended_age_max": null,
        "attention_demand": "high",
        "notes": "Advanced box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 3,
        "impact_level": 4,
        "requires_spotting": false,
        "requires_coach_supervision": "recommended",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface",
          "No prior mastery of lower-level box jumps and landing sticks"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 3,
        "minimum_hours_between_hard_exposures": 48,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": true,
        "counts_as_neural": true,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 4,
        "impact_level": 4,
        "intensity_ceiling": "high"
      },
      "subroleSecondary": "landing_braking_control"
    },
    {
      "slug": "shuffle-to-box-jump",
      "name": "Shuffle-to-Box Jump",
      "family": "Box Jump Explosive Power",
      "subrole": "deceleration_cod_power",
      "slot": "multidirectional_box_power",
      "primaryPhaseKey": "output",
      "cardSummary": "Box-jump-focused exercise that uses a short lateral shuffle into vertical box projection for sport-like rhythm and redirection. Best used when the coach wants power expression without violating session order.",
      "bestPlacement": "Early Output block after warm-up and before heavy strength; give full recovery and stop while jumps are fast.",
      "description": "Shuffle-to-Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
      "coachLanguage": "Primary subrole: deceleration_cod_power. Slot: multidirectional_box_power. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
      "tenets": [
        {
          "key": "explosiveness",
          "weight": 5
        },
        {
          "key": "agility",
          "weight": 4
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
          "key": "neural_output_readiness",
          "weight": 5
        },
        {
          "key": "ssc_stiffness",
          "weight": 4
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
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        },
        {
          "key": "locomote",
          "weight": 2
        },
        {
          "key": "rotate",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Shuffle-to-Box Jump lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Output because high-speed force expression is freshness-sensitive and should happen before fatigue-producing strength or conditioning.",
      "commonMisuse": "Using box jumps for high-rep fatigue or chasing a box height that forces a deep knee tuck; that turns an Output drill into conditioning and hides poor takeoff quality.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 4
      },
      "coachingExecution": {
        "movement_description": "Shuffle-to-Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Begin in an athletic stance with eyes on the top/front edge of the box."
        ],
        "execution_steps": [
          "Load quickly but under control, then drive the floor away with full-body intent.",
          "Land on the box with the whole foot, knees tracking over toes, and chest organized.",
          "Stand tall, step down, and rest long enough for the next rep to be just as explosive."
        ],
        "coach_cues": [
          "Jump up, not forward into the box.",
          "Quiet feet on the box.",
          "Knees track over the middle toes.",
          "Step down; do not rebound off a high box."
        ],
        "athlete_cues": [
          "Land like a ninja.",
          "Stick the landing before you stand tall.",
          "Step down and reset."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Box height too high for a clean landing",
          "Knees collapsing inward",
          "Landing on the toes or front edge of the box",
          "Rebounding down from the box instead of stepping down"
        ],
        "quality_gate": [
          "Every landing is quiet and controlled",
          "Athlete steps down safely",
          "No knee valgus, foot collapse, or torso panic",
          "Next rep looks as good as the first rep"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 3,
        "default_reps": 3,
        "default_work_seconds": null,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 45,
        "default_rpe_min": 7,
        "default_rpe_max": 9
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Shuffle-to-Box Jump; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Heavy lower-body strength",
        "Sled push",
        "Medicine-ball throws",
        "Acceleration work"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep",
        "deceleration"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=BXmWWH6iXsA",
        "https://www.youtube.com/watch?v=oQFykYI4pRM",
        "https://www.youtube.com/watch?v=G-bxQY57mKc"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 7,
        "load": 7,
        "complexity": 6,
        "overall": 7,
        "recommended_age_min": 9,
        "recommended_age_max": null,
        "attention_demand": "high",
        "notes": "Advanced box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 3,
        "impact_level": 4,
        "requires_spotting": false,
        "requires_coach_supervision": "recommended",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface",
          "No prior mastery of lower-level box jumps and landing sticks"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 3,
        "minimum_hours_between_hard_exposures": 48,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": true,
        "counts_as_neural": true,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 4,
        "impact_level": 4,
        "intensity_ceiling": "high"
      },
      "subroleSecondary": "landing_braking_control"
    },
    {
      "slug": "box-jump-over-reset",
      "name": "Box Jump-Over Reset",
      "family": "Box Jump Movement Intelligence",
      "subrole": "balance_coordination_rhythm",
      "slot": "box_jump_mechanics",
      "primaryPhaseKey": "movement_intelligence",
      "cardSummary": "Box-jump-focused exercise that teaches safe box jump-over mechanics as a skill before it becomes a conditioning movement. Best used when the coach wants technical skill without violating session order.",
      "bestPlacement": "Movement Intelligence block before high-intent jumping; use as crisp teaching reps, not fatigue work.",
      "description": "Box Jump-Over Reset is a technical box-jump skill drill. The athlete moves at a teachable speed, coordinates the takeoff and landing sequence, and resets every rep so the pattern stays crisp. It prepares the athlete for higher-intent box jumps without turning the set into conditioning.",
      "coachLanguage": "Primary subrole: balance_coordination_rhythm. Slot: box_jump_mechanics. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
      "tenets": [
        {
          "key": "coordination",
          "weight": 5
        },
        {
          "key": "body_control",
          "weight": 4
        },
        {
          "key": "balance",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 4
        },
        {
          "key": "balance_stability",
          "weight": 3
        },
        {
          "key": "plyometrics",
          "weight": 2
        }
      ],
      "physiology": [
        {
          "key": "perception_action_skill",
          "weight": 4
        },
        {
          "key": "control_stability",
          "weight": 4
        },
        {
          "key": "neural_output_readiness",
          "weight": 2
        }
      ],
      "patterns": [
        {
          "key": "jump",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Box Jump-Over Reset lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Movement Intelligence because the athlete is learning timing and spatial control before fatigue or high-intent work.",
      "commonMisuse": "Letting the drill become a race or finisher; the learning target disappears when reps get rushed.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "dynamic",
        "coordination_demand": "moderate",
        "impact_level": 3
      },
      "coachingExecution": {
        "movement_description": "Box Jump-Over Reset is a technical box-jump skill drill. The athlete moves at a teachable speed, coordinates the takeoff and landing sequence, and resets every rep so the pattern stays crisp. It prepares the athlete for higher-intent box jumps without turning the set into conditioning.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Begin in an athletic stance with eyes on the top/front edge of the box."
        ],
        "execution_steps": [
          "Load the hips with control and swing the arms in rhythm with the jump pattern.",
          "Jump or move over the box with enough height to clear safely without rushing.",
          "Land, stand tall, step down, and reset before the next rep."
        ],
        "coach_cues": [
          "Jump up, not forward into the box.",
          "Quiet feet on the box.",
          "Knees track over the middle toes.",
          "Step down; do not rebound off a high box."
        ],
        "athlete_cues": [
          "Land like a ninja.",
          "Stick the landing before you stand tall.",
          "Step down and reset."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Box height too high for a clean landing",
          "Knees collapsing inward",
          "Landing on the toes or front edge of the box",
          "Rebounding down from the box instead of stepping down"
        ],
        "quality_gate": [
          "Every landing is quiet and controlled",
          "Athlete steps down safely",
          "No knee valgus, foot collapse, or torso panic",
          "Next rep looks as good as the first rep"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 2,
        "default_reps": 4,
        "default_work_seconds": null,
        "default_rest_seconds": 45,
        "est_seconds_per_set": 40,
        "default_rpe_min": 3,
        "default_rpe_max": 5
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Box Jump-Over Reset; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Low Box Jump to Stick",
        "Countermovement Box Jump"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=-Tz4BF2ne2A",
        "https://www.youtube.com/watch?v=O5EIfqz4fX0",
        "https://www.youtube.com/watch?v=H_19zs2b5rs"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 5,
        "load": 6,
        "complexity": 4,
        "overall": 6,
        "recommended_age_min": 6,
        "recommended_age_max": null,
        "attention_demand": "moderate",
        "notes": "Base box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 2,
        "impact_level": 3,
        "requires_spotting": false,
        "requires_coach_supervision": "optional",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 4,
        "minimum_hours_between_hard_exposures": 24,
        "counts_as_high_intensity": false,
        "counts_as_high_impact": true,
        "counts_as_neural": true,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 2,
        "fatigue_sensitivity": 3,
        "technical_complexity": 3,
        "impact_level": 3,
        "intensity_ceiling": "moderate"
      }
    },
    {
      "slug": "light-weighted-box-jump",
      "name": "Light Weighted Box Jump",
      "family": "Box Jump Explosive Power",
      "subrole": "jump_throw_explosive_power",
      "slot": "loaded_box_power",
      "primaryPhaseKey": "output",
      "cardSummary": "Box-jump-focused exercise that adds very light external load only after unloaded jump quality is excellent. Best used when the coach wants power expression without violating session order.",
      "bestPlacement": "Early Output block after warm-up and before heavy strength; give full recovery and stop while jumps are fast.",
      "description": "Light Weighted Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Slot: loaded_box_power. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
      "tenets": [
        {
          "key": "explosiveness",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        },
        {
          "key": "resistance_calisthenics",
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
          "weight": 4
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
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        },
        {
          "key": "dumbbell",
          "weight": 3
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Light Weighted Box Jump lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Output because high-speed force expression is freshness-sensitive and should happen before fatigue-producing strength or conditioning.",
      "commonMisuse": "Using box jumps for high-rep fatigue or chasing a box height that forces a deep knee tuck; that turns an Output drill into conditioning and hides poor takeoff quality.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 4
      },
      "coachingExecution": {
        "movement_description": "Light Weighted Box Jump is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Use only very light dumbbells or a vest; remove load if height, landing, or posture changes.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Begin in an athletic stance with eyes on the top/front edge of the box."
        ],
        "execution_steps": [
          "Load quickly but under control, then drive the floor away with full-body intent.",
          "Land on the box with the whole foot, knees tracking over toes, and chest organized.",
          "Stand tall, step down, and rest long enough for the next rep to be just as explosive."
        ],
        "coach_cues": [
          "Jump up, not forward into the box.",
          "Quiet feet on the box.",
          "Knees track over the middle toes.",
          "Step down; do not rebound off a high box.",
          "Load must not reduce takeoff speed or landing shape."
        ],
        "athlete_cues": [
          "Land like a ninja.",
          "Stick the landing before you stand tall.",
          "Step down and reset.",
          "Light load, fast jump."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Box height too high for a clean landing",
          "Knees collapsing inward",
          "Landing on the toes or front edge of the box",
          "Rebounding down from the box instead of stepping down",
          "External load makes the jump slower or changes posture"
        ],
        "quality_gate": [
          "Every landing is quiet and controlled",
          "Athlete steps down safely",
          "No knee valgus, foot collapse, or torso panic",
          "Next rep looks as good as the first rep"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 3,
        "default_reps": 2,
        "default_work_seconds": null,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 45,
        "default_rpe_min": 7,
        "default_rpe_max": 9
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Light Weighted Box Jump; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Heavy lower-body strength",
        "Sled push",
        "Medicine-ball throws",
        "Acceleration work"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=RyBHJc1myxA",
        "https://www.youtube.com/watch?v=fuK29UwPrIw",
        "https://www.youtube.com/watch?v=q3NxYuZ_5bQ"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 8,
        "load": 8,
        "complexity": 7,
        "overall": 8,
        "recommended_age_min": 12,
        "recommended_age_max": null,
        "attention_demand": "high",
        "notes": "Elite box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 4,
        "impact_level": 4,
        "requires_spotting": false,
        "requires_coach_supervision": "required",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface",
          "No prior mastery of lower-level box jumps and landing sticks"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 2,
        "minimum_hours_between_hard_exposures": 48,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": true,
        "counts_as_neural": true,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 5,
        "impact_level": 4,
        "intensity_ceiling": "high"
      },
      "subroleSecondary": "landing_braking_control"
    },
    {
      "slug": "medicine-ball-box-jump-stick",
      "name": "Medicine Ball Box Jump Stick",
      "family": "Box Jump Explosive Power",
      "subrole": "jump_throw_explosive_power",
      "slot": "loaded_box_power",
      "primaryPhaseKey": "output",
      "cardSummary": "Box-jump-focused exercise that uses a light medicine ball to coordinate trunk stiffness, arm position, and powerful lower-body projection. Best used when the coach wants power expression without violating session order.",
      "bestPlacement": "Early Output block after warm-up and before heavy strength; give full recovery and stop while jumps are fast.",
      "description": "Medicine Ball Box Jump Stick is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Slot: loaded_box_power. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
      "tenets": [
        {
          "key": "explosiveness",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        },
        {
          "key": "resistance_calisthenics",
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
          "weight": 4
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
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        },
        {
          "key": "medicine_ball",
          "weight": 3
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Medicine Ball Box Jump Stick lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Output because high-speed force expression is freshness-sensitive and should happen before fatigue-producing strength or conditioning.",
      "commonMisuse": "Using box jumps for high-rep fatigue or chasing a box height that forces a deep knee tuck; that turns an Output drill into conditioning and hides poor takeoff quality.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 4
      },
      "coachingExecution": {
        "movement_description": "Medicine Ball Box Jump Stick is a high-intent box-jump power exercise. The athlete creates a crisp takeoff, lands softly on the box with full-foot control, stands tall, steps down, and fully resets. The purpose is explosive force expression with low volume and full recovery, not conditioning.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Hold a light medicine ball close to the chest; do not let the ball pull the torso forward.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Begin in an athletic stance with eyes on the top/front edge of the box."
        ],
        "execution_steps": [
          "Load quickly but under control, then drive the floor away with full-body intent.",
          "Land on the box with the whole foot, knees tracking over toes, and chest organized.",
          "Stand tall, step down, and rest long enough for the next rep to be just as explosive."
        ],
        "coach_cues": [
          "Jump up, not forward into the box.",
          "Quiet feet on the box.",
          "Knees track over the middle toes.",
          "Step down; do not rebound off a high box.",
          "Load must not reduce takeoff speed or landing shape."
        ],
        "athlete_cues": [
          "Land like a ninja.",
          "Stick the landing before you stand tall.",
          "Step down and reset.",
          "Light load, fast jump."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Box height too high for a clean landing",
          "Knees collapsing inward",
          "Landing on the toes or front edge of the box",
          "Rebounding down from the box instead of stepping down"
        ],
        "quality_gate": [
          "Every landing is quiet and controlled",
          "Athlete steps down safely",
          "No knee valgus, foot collapse, or torso panic",
          "Next rep looks as good as the first rep"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box"
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 3,
        "default_reps": 3,
        "default_work_seconds": null,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 45,
        "default_rpe_min": 7,
        "default_rpe_max": 9
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Medicine Ball Box Jump Stick; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Heavy lower-body strength",
        "Sled push",
        "Medicine-ball throws",
        "Acceleration work"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=B_tzzBwPpf0",
        "https://www.youtube.com/watch?v=guKpOTppoVg",
        "https://www.youtube.com/watch?v=RvJnTpPySJI"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 7,
        "load": 7,
        "complexity": 6,
        "overall": 7,
        "recommended_age_min": 9,
        "recommended_age_max": null,
        "attention_demand": "high",
        "notes": "Advanced box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 3,
        "impact_level": 4,
        "requires_spotting": false,
        "requires_coach_supervision": "recommended",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface",
          "No prior mastery of lower-level box jumps and landing sticks"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 3,
        "minimum_hours_between_hard_exposures": 48,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": true,
        "counts_as_neural": true,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 4,
        "impact_level": 4,
        "intensity_ceiling": "high"
      },
      "subroleSecondary": "landing_braking_control"
    },
    {
      "slug": "burpee-box-jump-over",
      "name": "Burpee Box Jump-Over",
      "family": "Box Jump Conditioning Repeatability",
      "subrole": "conditioning_circuit",
      "slot": "conditioning_circuit",
      "primaryPhaseKey": "sustained_capacity",
      "cardSummary": "Box-jump-focused exercise that a conditioning-only box-jump pattern for athletes who can maintain safe mechanics under fatigue. Best used when the coach wants conditioning repeatability without violating session order.",
      "bestPlacement": "Late sustained-capacity block only, after power, strength, and skill work are finished.",
      "description": "Burpee Box Jump-Over is a conditioning-only box-jump pattern. The athlete combines a floor-to-box transition with repeatable jumping mechanics and must maintain safe posture under fatigue. It belongs late in the session, never before speed, max jumping, or technical skill work.",
      "coachLanguage": "Primary subrole: conditioning_circuit. Slot: conditioning_circuit. Keep box height honest; the box is a target for better mechanics, not an ego test.",
      "athleteLanguage": "Jump or land softly, own the box, step down, and make every rep look clean.",
      "participantStructure": "individual",
      "tenets": [
        {
          "key": "explosiveness",
          "weight": 2
        },
        {
          "key": "coordination",
          "weight": 3
        },
        {
          "key": "strength",
          "weight": 2
        }
      ],
      "methodologies": [
        {
          "key": "hiit",
          "weight": 5
        },
        {
          "key": "plyometrics",
          "weight": 2
        },
        {
          "key": "resistance_calisthenics",
          "weight": 2
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
        }
      ],
      "patterns": [
        {
          "key": "jump",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 5
        },
        {
          "key": "squat",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
          "weight": 5
        },
        {
          "key": "mat",
          "weight": 1
        }
      ],
      "body_regions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 4
        }
      ],
      "whyItWorks": "The box reduces landing drop from the upward jump while giving the athlete an external target. Used correctly, Burpee Box Jump-Over lets the coach bias takeoff power, landing control, or coordination while limiting unnecessary eccentric overload.",
      "whyItGoesHere": "This belongs in Sustained Capacity because the goal is repeatable work under fatigue, and it would corrupt power or skill if placed early.",
      "commonMisuse": "Programming this before power or skill work; fatigued box-jump-over reps are conditioning and should stay late.",
      "scalingGuidance": "Scale by box height, approach complexity, landing demand, external load, and total contacts. Progress only when the athlete keeps quiet landings and full reset quality.",
      "movementRequirements": {
        "primary_joint_actions": [
          "ankle_plantarflexion",
          "knee_extension",
          "hip_extension",
          "hip_knee_ankle_flexion_landing"
        ],
        "primary_tissues": [
          "calves",
          "quadriceps",
          "glutes",
          "hamstrings",
          "intrinsic_foot"
        ],
        "primary_motor_control_demands": [
          "takeoff_timing",
          "landing_alignment",
          "postural_stiffness"
        ],
        "postural_shape": "athletic_stance_to_stacked_landing",
        "breathing_demand": "brace_and_exhale_on_effort",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 4
      },
      "coachingExecution": {
        "movement_description": "Burpee Box Jump-Over is a conditioning-only box-jump pattern. The athlete combines a floor-to-box transition with repeatable jumping mechanics and must maintain safe posture under fatigue. It belongs late in the session, never before speed, max jumping, or technical skill work.",
        "setup": [
          "Use a stable, non-slip box at a height the athlete can land on without tucking excessively.",
          "Clear the surrounding area and set the athlete far enough from the box to jump vertically, not dive forward.",
          "Begin in an athletic stance with eyes on the top/front edge of the box."
        ],
        "execution_steps": [
          "Move from the floor into the box jump-over pattern at a pace you can control.",
          "Land with both feet secure before stepping or hopping down on the opposite side.",
          "Keep breathing and posture consistent; slow down before mechanics degrade."
        ],
        "coach_cues": [
          "Conditioning intent only; keep it late.",
          "Pace so mechanics stay safe.",
          "No missed box contacts.",
          "Lower the box before grinding reps."
        ],
        "athlete_cues": [
          "Move smooth, not sloppy.",
          "Both feet secure on the box.",
          "Slow down before your landings get loud."
        ],
        "breathing_cues": [
          "Brace before takeoff",
          "Exhale naturally after landing or during the reset"
        ],
        "common_faults": [
          "Rushing the box contact",
          "Tripping or clipping the box",
          "Turning the lower back into the driver during burpees",
          "Continuing after jump mechanics degrade"
        ],
        "quality_gate": [
          "Athlete can keep a sustainable pace without missed contacts",
          "Box height remains conservative",
          "Breathing is elevated but movement quality is not collapsing"
        ],
        "stop_signs": [
          "Missed box contact or tripping",
          "Knee, Achilles, back, or hip pain",
          "Landing quality worsens for two reps in a row",
          "Athlete begins jumping down from a high box",
          "Athlete cannot maintain safe breathing or posture under fatigue"
        ]
      },
      "dosage": {
        "volume_unit": "intervals",
        "default_sets": 3,
        "default_reps": null,
        "default_work_seconds": 40,
        "default_rest_seconds": 80,
        "est_seconds_per_set": 60,
        "default_rpe_min": 6,
        "default_rpe_max": 8
      },
      "scaling": {
        "youth_beginner": "Use a very low soft box or step-over version of Burpee Box Jump-Over; require a two-second stick and step-down reset.",
        "youth_intermediate": "Use a low-to-moderate box with 2-3 perfect reps per set; add height only when landing stays quiet.",
        "teen": "Use the listed version with full rest; progress by quality, intent, and small height changes, not fatigue.",
        "adult_beginner": "Start one progression lower and cap volume at 2 sets until consistent landing control is demonstrated.",
        "adult_advanced": "Use the prescribed variation with crisp intent; progress by small height/load/complexity changes while keeping reps low.",
        "older_adult": "Regress to step-up, low box jump, or landing stick with a soft surface; prioritize confidence and joint comfort.",
        "pregnancy_postpartum": "Usually substitute step-ups, low impact landing prep, or medicine-ball throws; avoid high-impact jumping unless medically cleared and already trained."
      },
      "genderSpecificNotes": "No default gender adjustment; scale by training age, tendon history, landing quality, and confidence with the box.",
      "pairsWellAfter": [
        "General warm-up",
        "Ankle stiffness prep",
        "Snap Down to Stick",
        "Low pogo series"
      ],
      "pairsWellBefore": [
        "Low Box Jump to Stick",
        "Countermovement Box Jump"
      ],
      "doNotUseWhen": [
        "Box surface is unstable or slippery",
        "Athlete cannot step down safely",
        "Athlete shows pain, fear, or uncontrolled landing mechanics",
        "Fatigue is already high and the intent is power"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep"
      ],
      "mediaReferences": [
        "https://www.youtube.com/watch?v=GLktGkmcvWE",
        "https://www.youtube.com/watch?v=2e7YL10YdiM",
        "https://www.youtube.com/watch?v=0-AGS6Tucx0"
      ],
      "mediaInternalNotes": [
        "Use direct YouTube watch?v= URLs only.",
        "Film side and front angle for the Vortex library demo.",
        "Show the regression before the full variation for youth groups."
      ],
      "difficultyProfile": {
        "technical": 6,
        "load": 8,
        "complexity": 6,
        "overall": 8,
        "recommended_age_min": 12,
        "recommended_age_max": null,
        "attention_demand": "high",
        "notes": "Conditioning box-jump variation; use lower progression if landing quality or confidence is not present."
      },
      "safety": {
        "risk_level": 4,
        "impact_level": 4,
        "requires_spotting": false,
        "requires_coach_supervision": "required",
        "readiness_checks": [
          "Athlete can squat or hinge into an athletic landing shape without pain",
          "Athlete can demonstrate a safe step-down reset",
          "Box height allows a quiet full-foot landing without excessive knee tuck"
        ],
        "contraindications": [
          "Current knee, Achilles, ankle, hip, or low-back pain",
          "Inability to land quietly on a lower regression",
          "Unstable or slippery box surface"
        ],
        "common_substitutions": [
          "Snap Down to Stick",
          "Low Box Jump to Stick",
          "Box Step-Up"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 2,
        "minimum_hours_between_hard_exposures": 48,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": true,
        "counts_as_neural": false,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": true
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": false,
        "fatigue_cost": 5,
        "fatigue_sensitivity": 4,
        "technical_complexity": 4,
        "impact_level": 4,
        "intensity_ceiling": "high"
      }
    }
  ]
}
```
