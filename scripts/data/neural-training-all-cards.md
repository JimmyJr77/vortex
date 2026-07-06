# Neural Training Exercise Cards 1-50

Source basis: `exercise_card_details_for_llm.md` defines Card v2 authoring workflow, canonical phase keys, taxonomy tagging, publish gates, dosage/scaling/safety fields, anti-patterns, and batch JSON output shape. Existing neural card examples in the File Library informed drill naming and coaching language, then keys were normalized to the canonical guide. `Purpose.txt` was requested but was not found in the accessible File Library search results during this session.


Complete batch for Cursor/import work. Neural Training is the dominant methodology across the set; fatigue is controlled so the work stays crisp, attentive, and non-conditioning.

```json
{
  "cluster": {
    "phase_focus": "neural_training",
    "card_count": 50,
    "source_basis": [
      "exercise_card_details_for_llm.md: Card v2 authoring guide, phase logic, taxonomy keys, publish gates, authoring JSON format, dosage/scaling/safety fields, and anti-patterns.",
      "Existing neural-training-card examples in the File Library were used as reference patterns, then normalized to current canonical keys.",
      "Purpose.txt was requested but not located in the available File Library search results for this session."
    ],
    "scoring_rule": "Neural Training is the dominant methodology. Cards emphasize crisp readiness, perception-action quality, coordination, speed, stiffness, or reactive output with low fatigue and clear stop rules."
  },
  "cards": [
    {
      "slug": "cross-crawl-dead-bug",
      "name": "Cross-Crawl Dead Bug",
      "family": "Cross-body coordination",
      "primaryPhaseKey": "prepare_and_access",
      "subrole": "activate",
      "subroleSecondary": "coordinate",
      "slot": "neural_activation",
      "cardSummary": "Supine contralateral drill that links breathing, trunk control, and opposite-limb timing without impact.",
      "bestPlacement": "Use in the first 5-12 minutes after a light temperature raise. Keep the dose low so readiness improves without creating fatigue.",
      "description": "Cross-Crawl Dead Bug is a neural-focused drill for cross-body coordination, anterior core timing, and low-threat neural organization. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Activate. Neural emphasis: cross-body coordination, anterior core timing, and low-threat neural organization. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
      "tenets": [
        {
          "key": "coordination",
          "weight": 5
        },
        {
          "key": "body_control",
          "weight": 4
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 5
        },
        {
          "key": "core_body_control",
          "weight": 4
        }
      ],
      "physiology": [
        {
          "key": "neural_output_readiness",
          "weight": 5
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
          "key": "none",
          "weight": 5
        },
        {
          "key": "mat",
          "weight": 2
        }
      ],
      "body_regions": [
        {
          "key": "core",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 4
        },
        {
          "key": "spine",
          "weight": 3
        }
      ],
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Prepare & Access / Activate because it raises neural organization and movement confidence without meaningful fatigue.",
      "commonMisuse": "Do not turn this into conditioning, a long fatigue circuit, or a random agility game. The value is a crisp neural signal, an accurate movement answer, and a clean reset. If the athlete gets slower, louder, dizzy, or less coordinated, the set is done.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "trunk_bracing",
          "rib_pelvis_stack"
        ],
        "primary_tissues": [
          "abdominals",
          "obliques",
          "diaphragm",
          "glutes",
          "hip_flexors",
          "adductors",
          "spinal_stabilizers"
        ],
        "breathing_demand": "rhythmic",
        "balance_demand": "stable",
        "coordination_demand": "high",
        "impact_level": 0
      },
      "coachingExecution": {
        "movement_description": "Perform Cross-Crawl Dead Bug as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Use a mat or clear floor area.",
          "Athlete starts in the base position with ribs stacked over pelvis.",
          "Demonstrate one slow rep before asking for crisp reps."
        ],
        "execution_steps": [
          "Athlete sets the trunk first and breathes without bracing aggressively.",
          "Move one limb or opposite limbs while the pelvis and ribcage stay quiet.",
          "Pause briefly to show control before the next switch or tap.",
          "End the set when hips rock, breath holding appears, or timing slows."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Ribs stacked over pelvis.",
          "Move the limb without moving the trunk."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Holding breath to create fake stability.",
          "Rib flare, hip shift, or spinal sag."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "The athlete leaves the drill more organized than they entered: breathing controlled, posture cleaner, and no meaningful fatigue created.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated."
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 2,
        "default_reps": 5,
        "default_work_seconds": 25,
        "default_rest_seconds": 30,
        "est_seconds_per_set": 60,
        "default_rpe_min": 2,
        "default_rpe_max": 5
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Painful movement pattern",
        "Athlete cannot follow the cue or maintain safe posture"
      ],
      "goodForSessions": [
        "general_warmup",
        "low_readiness_reset"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 1,
        "impact_level": 0,
        "requires_spotting": false,
        "requires_coach_supervision": "optional",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Painful movement pattern",
          "Athlete cannot follow the cue or maintain safe posture"
        ],
        "common_substitutions": [
          "Dead bug variation",
          "Quadruped tap",
          "Incline plank tap"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 6,
        "minimum_hours_between_hard_exposures": 0,
        "counts_as_high_intensity": false,
        "counts_as_high_impact": false,
        "counts_as_neural": true,
        "counts_as_tissue_stress": false,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": false,
        "fatigue_cost": 1,
        "fatigue_sensitivity": 2,
        "technical_complexity": 2,
        "impact_level": 0,
        "intensity_ceiling": "low"
      }
    },
    {
      "slug": "bear-crawl-contralateral-tap",
      "name": "Bear Crawl Contralateral Tap",
      "family": "Cross-body coordination",
      "primaryPhaseKey": "prepare_and_access",
      "subrole": "activate",
      "subroleSecondary": "coordinate",
      "slot": "neural_activation",
      "cardSummary": "Bear-position tap drill that teaches trunk control while the opposite hand and knee coordinate under light tension.",
      "bestPlacement": "Use in the first 5-12 minutes after a light temperature raise. Keep the dose low so readiness improves without creating fatigue.",
      "description": "Bear Crawl Contralateral Tap is a neural-focused drill for anti-rotation, contralateral timing, and reflexive trunk stability. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Activate. Neural emphasis: anti-rotation, contralateral timing, and reflexive trunk stability. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
      "tenets": [
        {
          "key": "coordination",
          "weight": 5
        },
        {
          "key": "body_control",
          "weight": 4
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 5
        },
        {
          "key": "core_body_control",
          "weight": 4
        }
      ],
      "physiology": [
        {
          "key": "neural_output_readiness",
          "weight": 5
        },
        {
          "key": "control_stability",
          "weight": 4
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
        },
        {
          "key": "mat",
          "weight": 2
        }
      ],
      "body_regions": [
        {
          "key": "core",
          "weight": 5
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "hip",
          "weight": 3
        },
        {
          "key": "wrist",
          "weight": 2
        }
      ],
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Prepare & Access / Activate because it raises neural organization and movement confidence without meaningful fatigue.",
      "commonMisuse": "Do not turn this into conditioning, a long fatigue circuit, or a random agility game. The value is a crisp neural signal, an accurate movement answer, and a clean reset. If the athlete gets slower, louder, dizzy, or less coordinated, the set is done.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "hip_flexion_extension",
          "knee_drive",
          "ankle_stiffness",
          "arm_leg_coordination",
          "trunk_bracing",
          "rib_pelvis_stack"
        ],
        "primary_tissues": [
          "abdominals",
          "obliques",
          "diaphragm",
          "deltoids",
          "rotator_cuff",
          "scapular_stabilizers",
          "glutes",
          "hip_flexors"
        ],
        "breathing_demand": "rhythmic",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 0
      },
      "coachingExecution": {
        "movement_description": "Perform Bear Crawl Contralateral Tap as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Use a mat or clear floor area.",
          "Athlete starts in the base position with ribs stacked over pelvis.",
          "Demonstrate one slow rep before asking for crisp reps."
        ],
        "execution_steps": [
          "Athlete sets the trunk first and breathes without bracing aggressively.",
          "Move one limb or opposite limbs while the pelvis and ribcage stay quiet.",
          "Pause briefly to show control before the next switch or tap.",
          "End the set when hips rock, breath holding appears, or timing slows."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Push the ground away.",
          "Eyes up, hips under you.",
          "Ribs stacked over pelvis."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Standing tall before the first step.",
          "Crossing feet or reaching outside the base unnecessarily.",
          "Holding breath to create fake stability.",
          "Rib flare, hip shift, or spinal sag."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "The athlete leaves the drill more organized than they entered: breathing controlled, posture cleaner, and no meaningful fatigue created.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated."
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 2,
        "default_reps": 5,
        "default_work_seconds": 25,
        "default_rest_seconds": 30,
        "est_seconds_per_set": 60,
        "default_rpe_min": 2,
        "default_rpe_max": 5
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Wrist or shoulder pain in support positions"
      ],
      "goodForSessions": [
        "general_warmup",
        "crawling_prep"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 1,
        "impact_level": 0,
        "requires_spotting": false,
        "requires_coach_supervision": "optional",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Wrist or shoulder pain in support positions"
        ],
        "common_substitutions": [
          "Dead bug variation",
          "Quadruped tap",
          "Incline plank tap"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 6,
        "minimum_hours_between_hard_exposures": 0,
        "counts_as_high_intensity": false,
        "counts_as_high_impact": false,
        "counts_as_neural": true,
        "counts_as_tissue_stress": false,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": false,
        "fatigue_cost": 1,
        "fatigue_sensitivity": 2,
        "technical_complexity": 2,
        "impact_level": 0,
        "intensity_ceiling": "low"
      }
    },
    {
      "slug": "wall-drive-iso-hold",
      "name": "Wall Drive Iso Hold",
      "family": "Acceleration posture activation",
      "primaryPhaseKey": "prepare_and_access",
      "subrole": "activate",
      "subroleSecondary": "sprint_posture",
      "slot": "sprint_activation",
      "cardSummary": "Low-fatigue wall-drive position hold that teaches shin angle, trunk line, and front-side sprint posture.",
      "bestPlacement": "Use in the first 5-12 minutes after a light temperature raise. Keep the dose low so readiness improves without creating fatigue.",
      "description": "Wall Drive Iso Hold is a neural-focused drill for acceleration posture, stance stiffness, and neural priming for sprint mechanics. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Activate. Neural emphasis: acceleration posture, stance stiffness, and neural priming for sprint mechanics. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
      "tenets": [
        {
          "key": "coordination",
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 4
        },
        {
          "key": "speed",
          "weight": 2
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 5
        },
        {
          "key": "isometrics",
          "weight": 4
        }
      ],
      "physiology": [
        {
          "key": "neural_output_readiness",
          "weight": 5
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
      "body_regions": [
        {
          "key": "foot",
          "weight": 5
        },
        {
          "key": "ankle",
          "weight": 4
        },
        {
          "key": "hip",
          "weight": 3
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Prepare & Access / Activate because it raises neural organization and movement confidence without meaningful fatigue.",
      "commonMisuse": "Do not turn this into conditioning, a long fatigue circuit, or a random agility game. The value is a crisp neural signal, an accurate movement answer, and a clean reset. If the athlete gets slower, louder, dizzy, or less coordinated, the set is done.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "hip_flexion_extension",
          "knee_drive",
          "ankle_stiffness",
          "arm_leg_coordination",
          "trunk_bracing",
          "rib_pelvis_stack"
        ],
        "primary_tissues": [
          "foot_intrinsics",
          "plantar fascia",
          "calves",
          "achilles_tendon",
          "glutes",
          "hip_flexors",
          "adductors",
          "abdominals"
        ],
        "breathing_demand": "rhythmic",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 0
      },
      "coachingExecution": {
        "movement_description": "Perform Wall Drive Iso Hold as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Stand facing a wall with hands on the wall at shoulder height.",
          "Step back until the body can form a straight sprint-posture line.",
          "Demonstrate one slow rep before asking for crisp reps."
        ],
        "execution_steps": [
          "Athlete starts organized and attentive.",
          "Perform the pattern at the assigned rhythm or speed.",
          "Own the finish position before the next repetition.",
          "Stop before fatigue changes timing, posture, or coordination."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Push the ground away.",
          "Eyes up, hips under you.",
          "Ribs stacked over pelvis."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Standing tall before the first step.",
          "Crossing feet or reaching outside the base unnecessarily.",
          "Holding breath to create fake stability.",
          "Rib flare, hip shift, or spinal sag."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "The athlete leaves the drill more organized than they entered: breathing controlled, posture cleaner, and no meaningful fatigue created.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated."
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 2,
        "default_reps": 5,
        "default_work_seconds": 25,
        "default_rest_seconds": 30,
        "est_seconds_per_set": 60,
        "default_rpe_min": 2,
        "default_rpe_max": 5
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Painful movement pattern",
        "Athlete cannot follow the cue or maintain safe posture"
      ],
      "goodForSessions": [
        "sprint_prep",
        "general_warmup"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 1,
        "impact_level": 0,
        "requires_spotting": false,
        "requires_coach_supervision": "optional",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Painful movement pattern",
          "Athlete cannot follow the cue or maintain safe posture"
        ],
        "common_substitutions": [
          "Dead bug variation",
          "Quadruped tap",
          "Incline plank tap"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 6,
        "minimum_hours_between_hard_exposures": 0,
        "counts_as_high_intensity": false,
        "counts_as_high_impact": false,
        "counts_as_neural": true,
        "counts_as_tissue_stress": false,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": false,
        "fatigue_cost": 1,
        "fatigue_sensitivity": 2,
        "technical_complexity": 2,
        "impact_level": 0,
        "intensity_ceiling": "low"
      }
    },
    {
      "slug": "wall-drive-switch",
      "name": "Wall Drive Switch",
      "family": "Acceleration posture activation",
      "primaryPhaseKey": "prepare_and_access",
      "subrole": "activate",
      "subroleSecondary": "potentiate",
      "slot": "sprint_activation",
      "cardSummary": "Wall-supported knee-drive switch that links sprint posture with quick limb exchange before higher-speed work.",
      "bestPlacement": "Use in the first 5-12 minutes after a light temperature raise. Keep the dose low so readiness improves without creating fatigue.",
      "description": "Wall Drive Switch is a neural-focused drill for limb exchange speed, acceleration posture, and elastic switch timing. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Activate. Neural emphasis: limb exchange speed, acceleration posture, and elastic switch timing. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
      "tenets": [
        {
          "key": "speed",
          "weight": 4
        },
        {
          "key": "coordination",
          "weight": 4
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 5
        }
      ],
      "physiology": [
        {
          "key": "neural_output_readiness",
          "weight": 5
        },
        {
          "key": "control_stability",
          "weight": 2
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
      "body_regions": [
        {
          "key": "foot",
          "weight": 5
        },
        {
          "key": "ankle",
          "weight": 4
        },
        {
          "key": "hip",
          "weight": 3
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Prepare & Access / Activate because it raises neural organization and movement confidence without meaningful fatigue.",
      "commonMisuse": "Do not turn this into conditioning, a long fatigue circuit, or a random agility game. The value is a crisp neural signal, an accurate movement answer, and a clean reset. If the athlete gets slower, louder, dizzy, or less coordinated, the set is done.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "hip_flexion_extension",
          "knee_drive",
          "ankle_stiffness",
          "arm_leg_coordination",
          "trunk_bracing",
          "rib_pelvis_stack"
        ],
        "primary_tissues": [
          "foot_intrinsics",
          "plantar fascia",
          "calves",
          "achilles_tendon",
          "glutes",
          "hip_flexors",
          "adductors",
          "abdominals"
        ],
        "breathing_demand": "rhythmic",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 0
      },
      "coachingExecution": {
        "movement_description": "Perform Wall Drive Switch as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Stand facing a wall with hands on the wall at shoulder height.",
          "Step back until the body can form a straight sprint-posture line.",
          "Demonstrate one slow rep before asking for crisp reps."
        ],
        "execution_steps": [
          "Athlete starts organized and attentive.",
          "Perform the pattern at the assigned rhythm or speed.",
          "Own the finish position before the next repetition.",
          "Stop before fatigue changes timing, posture, or coordination."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Push the ground away.",
          "Eyes up, hips under you.",
          "Ribs stacked over pelvis."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Standing tall before the first step.",
          "Crossing feet or reaching outside the base unnecessarily.",
          "Holding breath to create fake stability.",
          "Rib flare, hip shift, or spinal sag."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "The athlete leaves the drill more organized than they entered: breathing controlled, posture cleaner, and no meaningful fatigue created.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated."
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 2,
        "default_reps": 5,
        "default_work_seconds": 25,
        "default_rest_seconds": 30,
        "est_seconds_per_set": 60,
        "default_rpe_min": 2,
        "default_rpe_max": 5
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Painful movement pattern",
        "Athlete cannot follow the cue or maintain safe posture"
      ],
      "goodForSessions": [
        "sprint_prep"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 1,
        "impact_level": 0,
        "requires_spotting": false,
        "requires_coach_supervision": "optional",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Painful movement pattern",
          "Athlete cannot follow the cue or maintain safe posture"
        ],
        "common_substitutions": [
          "Dead bug variation",
          "Quadruped tap",
          "Incline plank tap"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 6,
        "minimum_hours_between_hard_exposures": 0,
        "counts_as_high_intensity": false,
        "counts_as_high_impact": false,
        "counts_as_neural": true,
        "counts_as_tissue_stress": false,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": false,
        "fatigue_cost": 1,
        "fatigue_sensitivity": 2,
        "technical_complexity": 2,
        "impact_level": 0,
        "intensity_ceiling": "low"
      }
    },
    {
      "slug": "push-up-shoulder-tap-metronome",
      "name": "Push-Up Shoulder Tap Metronome",
      "family": "Reflexive trunk control",
      "primaryPhaseKey": "prepare_and_access",
      "subrole": "activate",
      "subroleSecondary": "coordinate",
      "slot": "neural_activation",
      "cardSummary": "Metronome-paced shoulder tap drill that trains anti-rotation and timing under upper-body support.",
      "bestPlacement": "Use in the first 5-12 minutes after a light temperature raise. Keep the dose low so readiness improves without creating fatigue.",
      "description": "Push-Up Shoulder Tap Metronome is a neural-focused drill for rhythm, shoulder stability, and trunk anti-rotation. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Activate. Neural emphasis: rhythm, shoulder stability, and trunk anti-rotation. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
      "tenets": [
        {
          "key": "coordination",
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 4
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 5
        },
        {
          "key": "core_body_control",
          "weight": 4
        }
      ],
      "physiology": [
        {
          "key": "neural_output_readiness",
          "weight": 5
        },
        {
          "key": "control_stability",
          "weight": 4
        }
      ],
      "patterns": [
        {
          "key": "push",
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
        },
        {
          "key": "mat",
          "weight": 2
        }
      ],
      "body_regions": [
        {
          "key": "core",
          "weight": 5
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "wrist",
          "weight": 3
        }
      ],
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Prepare & Access / Activate because it raises neural organization and movement confidence without meaningful fatigue.",
      "commonMisuse": "Do not turn this into conditioning, a long fatigue circuit, or a random agility game. The value is a crisp neural signal, an accurate movement answer, and a clean reset. If the athlete gets slower, louder, dizzy, or less coordinated, the set is done.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "shoulder_support",
          "elbow_extension",
          "scapular_control",
          "trunk_bracing",
          "rib_pelvis_stack"
        ],
        "primary_tissues": [
          "abdominals",
          "obliques",
          "diaphragm",
          "deltoids",
          "rotator_cuff",
          "scapular_stabilizers",
          "wrist_flexors",
          "wrist_extensors"
        ],
        "breathing_demand": "rhythmic",
        "balance_demand": "stable",
        "coordination_demand": "high",
        "impact_level": 0
      },
      "coachingExecution": {
        "movement_description": "Perform Push-Up Shoulder Tap Metronome as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Use a mat or clear floor area.",
          "Athlete starts in the base position with ribs stacked over pelvis.",
          "Demonstrate one slow rep before asking for crisp reps."
        ],
        "execution_steps": [
          "Athlete sets the trunk first and breathes without bracing aggressively.",
          "Move one limb or opposite limbs while the pelvis and ribcage stay quiet.",
          "Pause briefly to show control before the next switch or tap.",
          "End the set when hips rock, breath holding appears, or timing slows."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Ribs stacked over pelvis.",
          "Move the limb without moving the trunk."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Holding breath to create fake stability.",
          "Rib flare, hip shift, or spinal sag."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "The athlete leaves the drill more organized than they entered: breathing controlled, posture cleaner, and no meaningful fatigue created.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated."
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 2,
        "default_reps": 5,
        "default_work_seconds": 25,
        "default_rest_seconds": 30,
        "est_seconds_per_set": 60,
        "default_rpe_min": 2,
        "default_rpe_max": 5
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Wrist or shoulder pain in support positions"
      ],
      "goodForSessions": [
        "general_warmup",
        "crawling_prep"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 1,
        "impact_level": 0,
        "requires_spotting": false,
        "requires_coach_supervision": "optional",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Wrist or shoulder pain in support positions"
        ],
        "common_substitutions": [
          "Dead bug variation",
          "Quadruped tap",
          "Incline plank tap"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 6,
        "minimum_hours_between_hard_exposures": 0,
        "counts_as_high_intensity": false,
        "counts_as_high_impact": false,
        "counts_as_neural": true,
        "counts_as_tissue_stress": false,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": false,
        "fatigue_cost": 1,
        "fatigue_sensitivity": 2,
        "technical_complexity": 2,
        "impact_level": 0,
        "intensity_ceiling": "low"
      }
    },
    {
      "slug": "plank-command-tap-matrix",
      "name": "Plank Command Tap Matrix",
      "family": "Reactive trunk control",
      "primaryPhaseKey": "prepare_and_access",
      "subrole": "activate",
      "subroleSecondary": "react",
      "slot": "neural_activation",
      "cardSummary": "Coach-called plank tap drill that adds fast decision-making to a stable trunk position.",
      "bestPlacement": "Use in the first 5-12 minutes after a light temperature raise. Keep the dose low so readiness improves without creating fatigue.",
      "description": "Plank Command Tap Matrix is a neural-focused drill for auditory processing, limb dissociation, and anti-rotation under command. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Activate. Neural emphasis: auditory processing, limb dissociation, and anti-rotation under command. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
      "tenets": [
        {
          "key": "coordination",
          "weight": 5
        },
        {
          "key": "body_control",
          "weight": 4
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 5
        },
        {
          "key": "core_body_control",
          "weight": 4
        }
      ],
      "physiology": [
        {
          "key": "perception_action_skill",
          "weight": 4
        },
        {
          "key": "neural_output_readiness",
          "weight": 4
        },
        {
          "key": "control_stability",
          "weight": 4
        }
      ],
      "patterns": [
        {
          "key": "push",
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
        },
        {
          "key": "mat",
          "weight": 2
        },
        {
          "key": "partner",
          "weight": 2
        }
      ],
      "body_regions": [
        {
          "key": "core",
          "weight": 5
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "wrist",
          "weight": 3
        }
      ],
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Prepare & Access / Activate because it raises neural organization and movement confidence without meaningful fatigue.",
      "commonMisuse": "Do not turn this into conditioning, a long fatigue circuit, or a random agility game. The value is a crisp neural signal, an accurate movement answer, and a clean reset. If the athlete gets slower, louder, dizzy, or less coordinated, the set is done.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "shoulder_support",
          "elbow_extension",
          "scapular_control",
          "trunk_bracing",
          "rib_pelvis_stack"
        ],
        "primary_tissues": [
          "abdominals",
          "obliques",
          "diaphragm",
          "deltoids",
          "rotator_cuff",
          "scapular_stabilizers",
          "wrist_flexors",
          "wrist_extensors"
        ],
        "breathing_demand": "rhythmic",
        "balance_demand": "stable",
        "coordination_demand": "high",
        "impact_level": 0
      },
      "coachingExecution": {
        "movement_description": "Perform Plank Command Tap Matrix as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Partner or coach stands where the cue is visible or audible without crowding the athlete.",
          "Agree on the cue and stop rule before the first rep.",
          "Demonstrate one slow rep before asking for crisp reps."
        ],
        "execution_steps": [
          "Athlete holds the start position and waits for the cue instead of guessing.",
          "Coach or partner gives one clear visual or auditory cue.",
          "Athlete makes the correct first movement, finishes the required action, and regains control.",
          "Reset fully before the next rep so attention and mechanics stay crisp."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Ribs stacked over pelvis.",
          "Move the limb without moving the trunk."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Holding breath to create fake stability.",
          "Rib flare, hip shift, or spinal sag."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "The athlete leaves the drill more organized than they entered: breathing controlled, posture cleaner, and no meaningful fatigue created.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated."
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 2,
        "default_reps": 5,
        "default_work_seconds": 25,
        "default_rest_seconds": 30,
        "est_seconds_per_set": 60,
        "default_rpe_min": 2,
        "default_rpe_max": 5
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Wrist or shoulder pain in support positions"
      ],
      "goodForSessions": [
        "general_warmup",
        "crawling_prep"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 1,
        "impact_level": 0,
        "requires_spotting": false,
        "requires_coach_supervision": "optional",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Wrist or shoulder pain in support positions"
        ],
        "common_substitutions": [
          "Dead bug variation",
          "Quadruped tap",
          "Incline plank tap"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 6,
        "minimum_hours_between_hard_exposures": 0,
        "counts_as_high_intensity": false,
        "counts_as_high_impact": false,
        "counts_as_neural": true,
        "counts_as_tissue_stress": false,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": false,
        "fatigue_cost": 1,
        "fatigue_sensitivity": 2,
        "technical_complexity": 2,
        "impact_level": 0,
        "intensity_ceiling": "low"
      }
    },
    {
      "slug": "mountain-climber-switch-freeze",
      "name": "Mountain Climber Switch Freeze",
      "family": "Reflexive trunk control",
      "primaryPhaseKey": "prepare_and_access",
      "subrole": "activate",
      "subroleSecondary": "potentiate",
      "slot": "neural_activation",
      "cardSummary": "Fast plank-based hip switch with a freeze that trains trunk stiffness during rapid limb exchange.",
      "bestPlacement": "Use in the first 5-12 minutes after a light temperature raise. Keep the dose low so readiness improves without creating fatigue.",
      "description": "Mountain Climber Switch Freeze is a neural-focused drill for limb exchange speed, anti-extension control, and hip flexor timing. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Activate. Neural emphasis: limb exchange speed, anti-extension control, and hip flexor timing. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
      "tenets": [
        {
          "key": "coordination",
          "weight": 4
        },
        {
          "key": "speed",
          "weight": 3
        },
        {
          "key": "body_control",
          "weight": 4
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 5
        },
        {
          "key": "core_body_control",
          "weight": 4
        }
      ],
      "physiology": [
        {
          "key": "neural_output_readiness",
          "weight": 5
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
        },
        {
          "key": "mat",
          "weight": 2
        }
      ],
      "body_regions": [
        {
          "key": "core",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 4
        },
        {
          "key": "wrist",
          "weight": 3
        },
        {
          "key": "shoulder",
          "weight": 2
        }
      ],
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Prepare & Access / Activate because it raises neural organization and movement confidence without meaningful fatigue.",
      "commonMisuse": "Do not turn this into conditioning, a long fatigue circuit, or a random agility game. The value is a crisp neural signal, an accurate movement answer, and a clean reset. If the athlete gets slower, louder, dizzy, or less coordinated, the set is done.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "hip_flexion_extension",
          "knee_drive",
          "ankle_stiffness",
          "arm_leg_coordination",
          "trunk_bracing",
          "rib_pelvis_stack"
        ],
        "primary_tissues": [
          "abdominals",
          "obliques",
          "diaphragm",
          "glutes",
          "hip_flexors",
          "adductors",
          "wrist_flexors",
          "wrist_extensors"
        ],
        "breathing_demand": "rhythmic",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 1
      },
      "coachingExecution": {
        "movement_description": "Perform Mountain Climber Switch Freeze as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Use a mat or clear floor area.",
          "Athlete starts in the base position with ribs stacked over pelvis.",
          "Demonstrate one slow rep before asking for crisp reps."
        ],
        "execution_steps": [
          "Athlete sets the trunk first and breathes without bracing aggressively.",
          "Move one limb or opposite limbs while the pelvis and ribcage stay quiet.",
          "Pause briefly to show control before the next switch or tap.",
          "End the set when hips rock, breath holding appears, or timing slows."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Push the ground away.",
          "Eyes up, hips under you.",
          "Ribs stacked over pelvis."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Standing tall before the first step.",
          "Crossing feet or reaching outside the base unnecessarily.",
          "Holding breath to create fake stability.",
          "Rib flare, hip shift, or spinal sag."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "The athlete leaves the drill more organized than they entered: breathing controlled, posture cleaner, and no meaningful fatigue created.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated.",
          "Contacts get loud, uncontrolled, or asymmetrical."
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 2,
        "default_reps": 5,
        "default_work_seconds": 25,
        "default_rest_seconds": 30,
        "est_seconds_per_set": 60,
        "default_rpe_min": 2,
        "default_rpe_max": 5
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Active calf, Achilles, knee, or hip irritation",
        "Slippery surface or unsafe stopping area",
        "Wrist or shoulder pain in support positions"
      ],
      "goodForSessions": [
        "general_warmup",
        "sprint_prep"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 1,
        "impact_level": 1,
        "requires_spotting": false,
        "requires_coach_supervision": "optional",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Active calf, Achilles, knee, or hip irritation",
          "Slippery surface or unsafe stopping area",
          "Wrist or shoulder pain in support positions"
        ],
        "common_substitutions": [
          "Dead bug variation",
          "Quadruped tap",
          "Incline plank tap"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 6,
        "minimum_hours_between_hard_exposures": 0,
        "counts_as_high_intensity": false,
        "counts_as_high_impact": false,
        "counts_as_neural": true,
        "counts_as_tissue_stress": false,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": false,
        "fatigue_cost": 2,
        "fatigue_sensitivity": 2,
        "technical_complexity": 2,
        "impact_level": 1,
        "intensity_ceiling": "low"
      }
    },
    {
      "slug": "a-march-linear",
      "name": "A-March Linear",
      "family": "Sprint coordination",
      "primaryPhaseKey": "movement_intelligence",
      "subrole": "locomotion_sprint_mechanics",
      "subroleSecondary": "coordinate",
      "slot": "sprint_mechanics",
      "cardSummary": "Marching sprint-mechanics drill that maps posture, arm timing, and front-side rhythm at low cost.",
      "bestPlacement": "Use after general warm-up and before Output, strength, or conditioning. Keep decision quality and timing crisp; stop when the athlete starts guessing.",
      "description": "A-March Linear is a neural-focused drill for sprint posture, opposite arm-leg timing, and ground contact awareness. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Locomotion / Sprint Mechanics. Neural emphasis: sprint posture, opposite arm-leg timing, and ground contact awareness. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
      "tenets": [
        {
          "key": "coordination",
          "weight": 5
        },
        {
          "key": "speed",
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
        }
      ],
      "physiology": [
        {
          "key": "neural_output_readiness",
          "weight": 4
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
        }
      ],
      "equipment": [
        {
          "key": "none",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "full_body",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 4
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
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Movement Intelligence / Locomotion / Sprint Mechanics because the primary adaptation is timing, perception, coordination, and body control while the nervous system is fresh.",
      "commonMisuse": "Do not turn this into conditioning, a long fatigue circuit, or a random agility game. The value is a crisp neural signal, an accurate movement answer, and a clean reset. If the athlete gets slower, louder, dizzy, or less coordinated, the set is done.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "hip_flexion_extension",
          "knee_drive",
          "ankle_stiffness",
          "arm_leg_coordination"
        ],
        "primary_tissues": [
          "nervous_system",
          "postural_system",
          "glutes",
          "hip_flexors",
          "adductors",
          "calves",
          "achilles_tendon",
          "foot_intrinsics"
        ],
        "breathing_demand": "rhythmic",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 0
      },
      "coachingExecution": {
        "movement_description": "Perform A-March Linear as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Use a clear, non-slippery training lane.",
          "Athlete starts in the base position with posture organized and attention on the cue.",
          "Demonstrate one slow rep before asking for crisp reps."
        ],
        "execution_steps": [
          "Athlete starts organized and attentive.",
          "Perform the pattern at the assigned rhythm or speed.",
          "Own the finish position before the next repetition.",
          "Stop before fatigue changes timing, posture, or coordination."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Push the ground away.",
          "Eyes up, hips under you."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Standing tall before the first step.",
          "Crossing feet or reaching outside the base unnecessarily."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "The athlete reads the cue, performs the correct action, and resets without guessing, rushing, or losing posture. Learning quality is more important than speed.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated."
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 2,
        "default_reps": 5,
        "default_work_seconds": 25,
        "default_rest_seconds": 30,
        "est_seconds_per_set": 60,
        "default_rpe_min": 2,
        "default_rpe_max": 5
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Painful movement pattern",
        "Athlete cannot follow the cue or maintain safe posture"
      ],
      "goodForSessions": [
        "sprint_prep",
        "general_warmup"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 1,
        "impact_level": 0,
        "requires_spotting": false,
        "requires_coach_supervision": "optional",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Painful movement pattern",
          "Athlete cannot follow the cue or maintain safe posture"
        ],
        "common_substitutions": [
          "A-March Linear",
          "Supported balance reach",
          "Low-speed planned version"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 6,
        "minimum_hours_between_hard_exposures": 0,
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
        "fatigue_cost": 3,
        "fatigue_sensitivity": 4,
        "technical_complexity": 3,
        "impact_level": 0,
        "intensity_ceiling": "moderate"
      }
    },
    {
      "slug": "a-skip-snap-down",
      "name": "A-Skip Snap Down",
      "family": "Sprint coordination",
      "primaryPhaseKey": "movement_intelligence",
      "subrole": "locomotion_sprint_mechanics",
      "subroleSecondary": "potentiate",
      "slot": "sprint_mechanics",
      "cardSummary": "Rhythmic sprint skip that adds elastic foot contact and a crisp downstroke under the hip.",
      "bestPlacement": "Use after general warm-up and before Output, strength, or conditioning. Keep decision quality and timing crisp; stop when the athlete starts guessing.",
      "description": "A-Skip Snap Down is a neural-focused drill for elastic rhythm, ground stiffness, and front-side sprint timing. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Locomotion / Sprint Mechanics. Neural emphasis: elastic rhythm, ground stiffness, and front-side sprint timing. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
      "tenets": [
        {
          "key": "coordination",
          "weight": 5
        },
        {
          "key": "speed",
          "weight": 3
        },
        {
          "key": "explosiveness",
          "weight": 2
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 5
        },
        {
          "key": "plyometrics",
          "weight": 2
        }
      ],
      "physiology": [
        {
          "key": "neural_output_readiness",
          "weight": 4
        },
        {
          "key": "ssc_stiffness",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "locomote",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "none",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "full_body",
          "weight": 5
        },
        {
          "key": "ankle",
          "weight": 4
        },
        {
          "key": "foot",
          "weight": 3
        },
        {
          "key": "hip",
          "weight": 2
        }
      ],
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Movement Intelligence / Locomotion / Sprint Mechanics because the primary adaptation is timing, perception, coordination, and body control while the nervous system is fresh.",
      "commonMisuse": "Do not turn this into conditioning, a long fatigue circuit, or a random agility game. The value is a crisp neural signal, an accurate movement answer, and a clean reset. If the athlete gets slower, louder, dizzy, or less coordinated, the set is done.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "hip_flexion_extension",
          "knee_drive",
          "ankle_stiffness",
          "arm_leg_coordination",
          "hip_knee_ankle_absorption",
          "eccentric_braking",
          "postural_stick"
        ],
        "primary_tissues": [
          "nervous_system",
          "postural_system",
          "calves",
          "achilles_tendon",
          "foot_intrinsics",
          "plantar fascia",
          "glutes",
          "hip_flexors"
        ],
        "breathing_demand": "rhythmic",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 1
      },
      "coachingExecution": {
        "movement_description": "Perform A-Skip Snap Down as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Use a clear, non-slippery training lane.",
          "Athlete starts in the base position with posture organized and attention on the cue.",
          "Demonstrate one slow rep before asking for crisp reps."
        ],
        "execution_steps": [
          "Athlete loads quietly with posture stacked and eyes forward.",
          "Athlete performs the jump, hop, contact, or drop with crisp intent.",
          "Athlete sticks, rebounds, or finishes exactly as assigned without extra contacts.",
          "Stop the set if contact sound, alignment, or rhythm degrades."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Push the ground away.",
          "Eyes up, hips under you.",
          "Quiet contacts."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Standing tall before the first step.",
          "Crossing feet or reaching outside the base unnecessarily.",
          "Landing loud or stiff.",
          "Knees collapsing inward or feet spinning out."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "The athlete reads the cue, performs the correct action, and resets without guessing, rushing, or losing posture. Learning quality is more important than speed.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated.",
          "Contacts get loud, uncontrolled, or asymmetrical."
        ]
      },
      "dosage": {
        "volume_unit": "attempts",
        "default_sets": 2,
        "default_reps": 3,
        "default_work_seconds": 15,
        "default_rest_seconds": 60,
        "est_seconds_per_set": 75,
        "default_rpe_min": 3,
        "default_rpe_max": 6
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Active calf, Achilles, knee, or hip irritation",
        "Slippery surface or unsafe stopping area"
      ],
      "goodForSessions": [
        "sprint_prep",
        "landing_prep"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 1,
        "impact_level": 1,
        "requires_spotting": false,
        "requires_coach_supervision": "optional",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Active calf, Achilles, knee, or hip irritation",
          "Slippery surface or unsafe stopping area"
        ],
        "common_substitutions": [
          "Snap-Down to Athletic Stick",
          "Low-amplitude pogo",
          "March or step-to-stick alternative"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 6,
        "minimum_hours_between_hard_exposures": 0,
        "counts_as_high_intensity": false,
        "counts_as_high_impact": false,
        "counts_as_neural": true,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 3,
        "fatigue_sensitivity": 4,
        "technical_complexity": 3,
        "impact_level": 1,
        "intensity_ceiling": "moderate"
      }
    },
    {
      "slug": "skipping-rhythm-change",
      "name": "Skipping Rhythm Change",
      "family": "Rhythm and coordination",
      "primaryPhaseKey": "movement_intelligence",
      "subrole": "balance_coordination_rhythm",
      "subroleSecondary": "coordinate",
      "slot": "rhythm_switching",
      "cardSummary": "Skipping drill with deliberate cadence changes to improve rhythm switching and elastic coordination.",
      "bestPlacement": "Use after general warm-up and before Output, strength, or conditioning. Keep decision quality and timing crisp; stop when the athlete starts guessing.",
      "description": "Skipping Rhythm Change is a neural-focused drill for rhythm variability, elastic timing, and contralateral coordination. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Balance / Coordination / Rhythm. Neural emphasis: rhythm variability, elastic timing, and contralateral coordination. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
      "tenets": [
        {
          "key": "coordination",
          "weight": 5
        },
        {
          "key": "body_control",
          "weight": 3
        },
        {
          "key": "speed",
          "weight": 2
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 5
        }
      ],
      "physiology": [
        {
          "key": "neural_output_readiness",
          "weight": 4
        },
        {
          "key": "control_stability",
          "weight": 2
        }
      ],
      "patterns": [
        {
          "key": "locomote",
          "weight": 5
        }
      ],
      "equipment": [
        {
          "key": "none",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "full_body",
          "weight": 5
        },
        {
          "key": "ankle",
          "weight": 4
        },
        {
          "key": "hip",
          "weight": 3
        }
      ],
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Movement Intelligence / Balance / Coordination / Rhythm because the primary adaptation is timing, perception, coordination, and body control while the nervous system is fresh.",
      "commonMisuse": "Do not turn this into conditioning, a long fatigue circuit, or a random agility game. The value is a crisp neural signal, an accurate movement answer, and a clean reset. If the athlete gets slower, louder, dizzy, or less coordinated, the set is done.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "hip_flexion_extension",
          "knee_drive",
          "ankle_stiffness",
          "arm_leg_coordination"
        ],
        "primary_tissues": [
          "nervous_system",
          "postural_system",
          "calves",
          "achilles_tendon",
          "glutes",
          "hip_flexors",
          "adductors"
        ],
        "breathing_demand": "rhythmic",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 1
      },
      "coachingExecution": {
        "movement_description": "Perform Skipping Rhythm Change as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Use a clear, non-slippery training lane.",
          "Athlete starts in the base position with posture organized and attention on the cue.",
          "Demonstrate one slow rep before asking for crisp reps."
        ],
        "execution_steps": [
          "Athlete starts organized and attentive.",
          "Perform the pattern at the assigned rhythm or speed.",
          "Own the finish position before the next repetition.",
          "Stop before fatigue changes timing, posture, or coordination."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Push the ground away.",
          "Eyes up, hips under you."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Standing tall before the first step.",
          "Crossing feet or reaching outside the base unnecessarily."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "The athlete reads the cue, performs the correct action, and resets without guessing, rushing, or losing posture. Learning quality is more important than speed.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated.",
          "Contacts get loud, uncontrolled, or asymmetrical."
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 2,
        "default_reps": 5,
        "default_work_seconds": 25,
        "default_rest_seconds": 30,
        "est_seconds_per_set": 60,
        "default_rpe_min": 2,
        "default_rpe_max": 5
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Active calf, Achilles, knee, or hip irritation",
        "Slippery surface or unsafe stopping area"
      ],
      "goodForSessions": [
        "general_warmup",
        "sprint_prep"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 1,
        "impact_level": 1,
        "requires_spotting": false,
        "requires_coach_supervision": "optional",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Active calf, Achilles, knee, or hip irritation",
          "Slippery surface or unsafe stopping area"
        ],
        "common_substitutions": [
          "A-March Linear",
          "Supported balance reach",
          "Low-speed planned version"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 6,
        "minimum_hours_between_hard_exposures": 0,
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
        "fatigue_cost": 3,
        "fatigue_sensitivity": 4,
        "technical_complexity": 3,
        "impact_level": 1,
        "intensity_ceiling": "moderate"
      }
    },
    {
      "slug": "single-leg-balance-clock-reach",
      "name": "Single-Leg Balance Clock Reach",
      "family": "Balance and proprioception",
      "primaryPhaseKey": "movement_intelligence",
      "subrole": "balance_coordination_rhythm",
      "subroleSecondary": "coordinate",
      "slot": "proprioceptive_control",
      "cardSummary": "Single-leg reach matrix that improves foot, hip, and visual balance control without impact.",
      "bestPlacement": "Use after general warm-up and before Output, strength, or conditioning. Keep decision quality and timing crisp; stop when the athlete starts guessing.",
      "description": "Single-Leg Balance Clock Reach is a neural-focused drill for proprioceptive mapping, hip stability, and controlled reach strategy. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Balance / Coordination / Rhythm. Neural emphasis: proprioceptive mapping, hip stability, and controlled reach strategy. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
      "tenets": [
        {
          "key": "balance",
          "weight": 5
        },
        {
          "key": "coordination",
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 4
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 4
        },
        {
          "key": "balance_stability",
          "weight": 5
        }
      ],
      "physiology": [
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
          "key": "brace",
          "weight": 5
        },
        {
          "key": "locomote",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "none",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "foot",
          "weight": 5
        },
        {
          "key": "ankle",
          "weight": 4
        },
        {
          "key": "hip",
          "weight": 3
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Movement Intelligence / Balance / Coordination / Rhythm because the primary adaptation is timing, perception, coordination, and body control while the nervous system is fresh.",
      "commonMisuse": "Do not turn this into conditioning, a long fatigue circuit, or a random agility game. The value is a crisp neural signal, an accurate movement answer, and a clean reset. If the athlete gets slower, louder, dizzy, or less coordinated, the set is done.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "trunk_bracing",
          "rib_pelvis_stack",
          "hip_flexion_extension",
          "knee_drive",
          "ankle_stiffness",
          "arm_leg_coordination"
        ],
        "primary_tissues": [
          "foot_intrinsics",
          "plantar fascia",
          "calves",
          "achilles_tendon",
          "glutes",
          "hip_flexors",
          "adductors",
          "abdominals"
        ],
        "breathing_demand": "rhythmic",
        "balance_demand": "single_leg_or_dynamic",
        "coordination_demand": "high",
        "impact_level": 0
      },
      "coachingExecution": {
        "movement_description": "Perform Single-Leg Balance Clock Reach as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Use a clear, non-slippery training lane.",
          "Athlete starts in the base position with posture organized and attention on the cue.",
          "Demonstrate one slow rep before asking for crisp reps."
        ],
        "execution_steps": [
          "Athlete establishes a tall, quiet starting position.",
          "Perform the reach, walk, head turn, or hinge at a controllable speed.",
          "Regain balance after each movement without hopping or rushing.",
          "Progress only when posture and foot pressure stay calm."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Push the ground away.",
          "Eyes up, hips under you.",
          "Ribs stacked over pelvis."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Standing tall before the first step.",
          "Crossing feet or reaching outside the base unnecessarily.",
          "Holding breath to create fake stability.",
          "Rib flare, hip shift, or spinal sag."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "The athlete reads the cue, performs the correct action, and resets without guessing, rushing, or losing posture. Learning quality is more important than speed.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated."
        ]
      },
      "dosage": {
        "volume_unit": "seconds",
        "default_sets": 2,
        "default_reps": 1,
        "default_work_seconds": 20,
        "default_rest_seconds": 30,
        "est_seconds_per_set": 50,
        "default_rpe_min": 2,
        "default_rpe_max": 4
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Painful movement pattern",
        "Athlete cannot follow the cue or maintain safe posture"
      ],
      "goodForSessions": [
        "general_warmup",
        "low_readiness_reset"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 1,
        "impact_level": 0,
        "requires_spotting": false,
        "requires_coach_supervision": "optional",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Painful movement pattern",
          "Athlete cannot follow the cue or maintain safe posture"
        ],
        "common_substitutions": [
          "Dead bug variation",
          "Quadruped tap",
          "Incline plank tap"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 6,
        "minimum_hours_between_hard_exposures": 0,
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
        "fatigue_cost": 3,
        "fatigue_sensitivity": 4,
        "technical_complexity": 3,
        "impact_level": 0,
        "intensity_ceiling": "moderate"
      }
    },
    {
      "slug": "eyes-closed-single-leg-balance",
      "name": "Eyes-Closed Single-Leg Balance",
      "family": "Balance and proprioception",
      "primaryPhaseKey": "movement_intelligence",
      "subrole": "balance_coordination_rhythm",
      "subroleSecondary": "proprioception",
      "slot": "proprioceptive_control",
      "cardSummary": "Visual-input-reduced balance drill that improves proprioceptive ownership and calm postural control.",
      "bestPlacement": "Use after general warm-up and before Output, strength, or conditioning. Keep decision quality and timing crisp; stop when the athlete starts guessing.",
      "description": "Eyes-Closed Single-Leg Balance is a neural-focused drill for foot-ankle mapping, vestibular reliance, and stillness under reduced visual input. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Balance / Coordination / Rhythm. Neural emphasis: foot-ankle mapping, vestibular reliance, and stillness under reduced visual input. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
      "tenets": [
        {
          "key": "balance",
          "weight": 5
        },
        {
          "key": "body_control",
          "weight": 4
        }
      ],
      "methodologies": [
        {
          "key": "balance_stability",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        }
      ],
      "physiology": [
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
          "key": "brace",
          "weight": 5
        }
      ],
      "equipment": [
        {
          "key": "none",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "foot",
          "weight": 5
        },
        {
          "key": "ankle",
          "weight": 4
        },
        {
          "key": "hip",
          "weight": 3
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Movement Intelligence / Balance / Coordination / Rhythm because the primary adaptation is timing, perception, coordination, and body control while the nervous system is fresh.",
      "commonMisuse": "Do not turn this into conditioning, a long fatigue circuit, or a random agility game. The value is a crisp neural signal, an accurate movement answer, and a clean reset. If the athlete gets slower, louder, dizzy, or less coordinated, the set is done.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "trunk_bracing",
          "rib_pelvis_stack"
        ],
        "primary_tissues": [
          "foot_intrinsics",
          "plantar fascia",
          "calves",
          "achilles_tendon",
          "glutes",
          "hip_flexors",
          "adductors",
          "abdominals"
        ],
        "breathing_demand": "rhythmic",
        "balance_demand": "single_leg_or_dynamic",
        "coordination_demand": "high",
        "impact_level": 0
      },
      "coachingExecution": {
        "movement_description": "Perform Eyes-Closed Single-Leg Balance as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Use a clear, non-slippery training lane.",
          "Athlete starts in the base position with posture organized and attention on the cue.",
          "Demonstrate one slow rep before asking for crisp reps."
        ],
        "execution_steps": [
          "Athlete establishes a tall, quiet starting position.",
          "Perform the reach, walk, head turn, or hinge at a controllable speed.",
          "Regain balance after each movement without hopping or rushing.",
          "Progress only when posture and foot pressure stay calm."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Ribs stacked over pelvis.",
          "Move the limb without moving the trunk."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Holding breath to create fake stability.",
          "Rib flare, hip shift, or spinal sag.",
          "Using speed to hide balance loss.",
          "Looking down the whole time instead of owning posture."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "The athlete reads the cue, performs the correct action, and resets without guessing, rushing, or losing posture. Learning quality is more important than speed.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated."
        ]
      },
      "dosage": {
        "volume_unit": "seconds",
        "default_sets": 2,
        "default_reps": 1,
        "default_work_seconds": 20,
        "default_rest_seconds": 30,
        "est_seconds_per_set": 50,
        "default_rpe_min": 2,
        "default_rpe_max": 4
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Dizziness, vertigo, nausea, or recent concussion symptoms without medical clearance"
      ],
      "goodForSessions": [
        "low_readiness_reset",
        "general_warmup"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 1,
        "impact_level": 0,
        "requires_spotting": false,
        "requires_coach_supervision": "optional",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Dizziness, vertigo, nausea, or recent concussion symptoms without medical clearance"
        ],
        "common_substitutions": [
          "Dead bug variation",
          "Quadruped tap",
          "Incline plank tap"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 6,
        "minimum_hours_between_hard_exposures": 0,
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
        "fatigue_cost": 3,
        "fatigue_sensitivity": 4,
        "technical_complexity": 3,
        "impact_level": 0,
        "intensity_ceiling": "moderate"
      }
    },
    {
      "slug": "vestibular-head-turn-march",
      "name": "Vestibular Head-Turn March",
      "family": "Vestibular coordination",
      "primaryPhaseKey": "movement_intelligence",
      "subrole": "balance_coordination_rhythm",
      "subroleSecondary": "integrate",
      "slot": "vestibular_coordination",
      "cardSummary": "Marching drill with slow head turns that teaches gaze, posture, and balance control during movement.",
      "bestPlacement": "Use after general warm-up and before Output, strength, or conditioning. Keep decision quality and timing crisp; stop when the athlete starts guessing.",
      "description": "Vestibular Head-Turn March is a neural-focused drill for vestibular organization, gait rhythm, and postural control during visual head motion. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Balance / Coordination / Rhythm. Neural emphasis: vestibular organization, gait rhythm, and postural control during visual head motion. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
      "tenets": [
        {
          "key": "coordination",
          "weight": 5
        },
        {
          "key": "balance",
          "weight": 4
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
          "key": "balance_stability",
          "weight": 3
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
      "body_regions": [
        {
          "key": "full_body",
          "weight": 5
        },
        {
          "key": "spine",
          "weight": 4
        },
        {
          "key": "hip",
          "weight": 3
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Movement Intelligence / Balance / Coordination / Rhythm because the primary adaptation is timing, perception, coordination, and body control while the nervous system is fresh.",
      "commonMisuse": "Do not turn this into conditioning, a long fatigue circuit, or a random agility game. The value is a crisp neural signal, an accurate movement answer, and a clean reset. If the athlete gets slower, louder, dizzy, or less coordinated, the set is done.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "hip_flexion_extension",
          "knee_drive",
          "ankle_stiffness",
          "arm_leg_coordination",
          "trunk_bracing",
          "rib_pelvis_stack"
        ],
        "primary_tissues": [
          "nervous_system",
          "postural_system",
          "spinal_stabilizers",
          "glutes",
          "hip_flexors",
          "adductors",
          "abdominals",
          "obliques"
        ],
        "breathing_demand": "rhythmic",
        "balance_demand": "single_leg_or_dynamic",
        "coordination_demand": "high",
        "impact_level": 0
      },
      "coachingExecution": {
        "movement_description": "Perform Vestibular Head-Turn March as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Use a clear, non-slippery training lane.",
          "Athlete starts in the base position with posture organized and attention on the cue.",
          "Demonstrate one slow rep before asking for crisp reps."
        ],
        "execution_steps": [
          "Athlete establishes a tall, quiet starting position.",
          "Perform the reach, walk, head turn, or hinge at a controllable speed.",
          "Regain balance after each movement without hopping or rushing.",
          "Progress only when posture and foot pressure stay calm."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Push the ground away.",
          "Eyes up, hips under you.",
          "Ribs stacked over pelvis."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Standing tall before the first step.",
          "Crossing feet or reaching outside the base unnecessarily.",
          "Holding breath to create fake stability.",
          "Rib flare, hip shift, or spinal sag."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "The athlete reads the cue, performs the correct action, and resets without guessing, rushing, or losing posture. Learning quality is more important than speed.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated."
        ]
      },
      "dosage": {
        "volume_unit": "seconds",
        "default_sets": 2,
        "default_reps": 1,
        "default_work_seconds": 20,
        "default_rest_seconds": 30,
        "est_seconds_per_set": 50,
        "default_rpe_min": 2,
        "default_rpe_max": 4
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Dizziness, vertigo, nausea, or recent concussion symptoms without medical clearance"
      ],
      "goodForSessions": [
        "general_warmup",
        "low_readiness_reset"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 1,
        "impact_level": 0,
        "requires_spotting": false,
        "requires_coach_supervision": "optional",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Dizziness, vertigo, nausea, or recent concussion symptoms without medical clearance"
        ],
        "common_substitutions": [
          "Dead bug variation",
          "Quadruped tap",
          "Incline plank tap"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 6,
        "minimum_hours_between_hard_exposures": 0,
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
        "fatigue_cost": 3,
        "fatigue_sensitivity": 4,
        "technical_complexity": 3,
        "impact_level": 0,
        "intensity_ceiling": "moderate"
      }
    },
    {
      "slug": "single-leg-rdl-airplane",
      "name": "Single-Leg RDL Airplane",
      "family": "Balance and proprioception",
      "primaryPhaseKey": "movement_intelligence",
      "subrole": "balance_coordination_rhythm",
      "subroleSecondary": "hinge_control",
      "slot": "proprioceptive_control",
      "cardSummary": "Hinge-and-rotation balance drill that challenges hip control and spatial awareness in one-leg stance.",
      "bestPlacement": "Use after general warm-up and before Output, strength, or conditioning. Keep decision quality and timing crisp; stop when the athlete starts guessing.",
      "description": "Single-Leg RDL Airplane is a neural-focused drill for hip proprioception, trunk rotation control, and single-leg hinge ownership. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Balance / Coordination / Rhythm. Neural emphasis: hip proprioception, trunk rotation control, and single-leg hinge ownership. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
      "tenets": [
        {
          "key": "balance",
          "weight": 5
        },
        {
          "key": "body_control",
          "weight": 4
        },
        {
          "key": "coordination",
          "weight": 4
        }
      ],
      "methodologies": [
        {
          "key": "balance_stability",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        }
      ],
      "physiology": [
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
          "key": "hinge",
          "weight": 5
        },
        {
          "key": "rotate",
          "weight": 3
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
      "body_regions": [
        {
          "key": "foot",
          "weight": 5
        },
        {
          "key": "ankle",
          "weight": 4
        },
        {
          "key": "hip",
          "weight": 3
        },
        {
          "key": "core",
          "weight": 2
        },
        {
          "key": "spine",
          "weight": 2
        }
      ],
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Movement Intelligence / Balance / Coordination / Rhythm because the primary adaptation is timing, perception, coordination, and body control while the nervous system is fresh.",
      "commonMisuse": "Do not turn this into conditioning, a long fatigue circuit, or a random agility game. The value is a crisp neural signal, an accurate movement answer, and a clean reset. If the athlete gets slower, louder, dizzy, or less coordinated, the set is done.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "hip_hinge",
          "pelvic_control",
          "thoracic_rotation",
          "hip_rotation",
          "trunk_rotation_control",
          "trunk_bracing",
          "rib_pelvis_stack"
        ],
        "primary_tissues": [
          "foot_intrinsics",
          "plantar fascia",
          "calves",
          "achilles_tendon",
          "glutes",
          "hip_flexors",
          "adductors",
          "abdominals"
        ],
        "breathing_demand": "rhythmic",
        "balance_demand": "single_leg_or_dynamic",
        "coordination_demand": "high",
        "impact_level": 0
      },
      "coachingExecution": {
        "movement_description": "Perform Single-Leg RDL Airplane as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Use a clear, non-slippery training lane.",
          "Athlete starts in the base position with posture organized and attention on the cue.",
          "Demonstrate one slow rep before asking for crisp reps."
        ],
        "execution_steps": [
          "Athlete establishes a tall, quiet starting position.",
          "Perform the reach, walk, head turn, or hinge at a controllable speed.",
          "Regain balance after each movement without hopping or rushing.",
          "Progress only when posture and foot pressure stay calm."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Ribs stacked over pelvis.",
          "Move the limb without moving the trunk.",
          "Turn with control, not a twist and collapse."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Holding breath to create fake stability.",
          "Rib flare, hip shift, or spinal sag.",
          "Using speed to hide balance loss.",
          "Looking down the whole time instead of owning posture."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "The athlete reads the cue, performs the correct action, and resets without guessing, rushing, or losing posture. Learning quality is more important than speed.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated."
        ]
      },
      "dosage": {
        "volume_unit": "seconds",
        "default_sets": 2,
        "default_reps": 1,
        "default_work_seconds": 20,
        "default_rest_seconds": 30,
        "est_seconds_per_set": 50,
        "default_rpe_min": 2,
        "default_rpe_max": 4
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Painful movement pattern",
        "Athlete cannot follow the cue or maintain safe posture"
      ],
      "goodForSessions": [
        "general_warmup",
        "squat_prep"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 2,
        "impact_level": 0,
        "requires_spotting": false,
        "requires_coach_supervision": "recommended",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Painful movement pattern",
          "Athlete cannot follow the cue or maintain safe posture"
        ],
        "common_substitutions": [
          "Dead bug variation",
          "Quadruped tap",
          "Incline plank tap"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 6,
        "minimum_hours_between_hard_exposures": 0,
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
        "fatigue_cost": 3,
        "fatigue_sensitivity": 4,
        "technical_complexity": 3,
        "impact_level": 0,
        "intensity_ceiling": "moderate"
      }
    },
    {
      "slug": "crawling-direction-call",
      "name": "Crawling Direction Call",
      "family": "Crawling perception-action",
      "primaryPhaseKey": "movement_intelligence",
      "subrole": "perception_action_reactive_movement",
      "subroleSecondary": "crawling",
      "slot": "perception_action_skill",
      "cardSummary": "Quadruped crawl that changes direction on a coach call to connect perception, limb sequencing, and trunk control.",
      "bestPlacement": "Use after general warm-up and before Output, strength, or conditioning. Keep decision quality and timing crisp; stop when the athlete starts guessing.",
      "description": "Crawling Direction Call is a neural-focused drill for auditory decision-making, crawling rhythm, and contralateral repositioning. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Perception-Action / Reactive Movement. Neural emphasis: auditory decision-making, crawling rhythm, and contralateral repositioning. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
      "tenets": [
        {
          "key": "coordination",
          "weight": 5
        },
        {
          "key": "agility",
          "weight": 3
        },
        {
          "key": "body_control",
          "weight": 4
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 5
        },
        {
          "key": "core_body_control",
          "weight": 4
        }
      ],
      "physiology": [
        {
          "key": "perception_action_skill",
          "weight": 5
        },
        {
          "key": "neural_output_readiness",
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
        },
        {
          "key": "partner",
          "weight": 2
        }
      ],
      "body_regions": [
        {
          "key": "full_body",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 3
        },
        {
          "key": "wrist",
          "weight": 2
        },
        {
          "key": "hip",
          "weight": 2
        }
      ],
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Movement Intelligence / Perception-Action / Reactive Movement because the primary adaptation is timing, perception, coordination, and body control while the nervous system is fresh.",
      "commonMisuse": "Do not turn this into conditioning, a long fatigue circuit, or a random agility game. The value is a crisp neural signal, an accurate movement answer, and a clean reset. If the athlete gets slower, louder, dizzy, or less coordinated, the set is done.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "hip_flexion_extension",
          "knee_drive",
          "ankle_stiffness",
          "arm_leg_coordination",
          "trunk_bracing",
          "rib_pelvis_stack"
        ],
        "primary_tissues": [
          "nervous_system",
          "postural_system",
          "abdominals",
          "obliques",
          "diaphragm",
          "deltoids",
          "rotator_cuff",
          "scapular_stabilizers"
        ],
        "breathing_demand": "rhythmic",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 0
      },
      "coachingExecution": {
        "movement_description": "Perform Crawling Direction Call as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Partner or coach stands where the cue is visible or audible without crowding the athlete.",
          "Agree on the cue and stop rule before the first rep.",
          "Demonstrate one slow rep before asking for crisp reps."
        ],
        "execution_steps": [
          "Athlete holds the start position and waits for the cue instead of guessing.",
          "Coach or partner gives one clear visual or auditory cue.",
          "Athlete makes the correct first movement, finishes the required action, and regains control.",
          "Reset fully before the next rep so attention and mechanics stay crisp."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Push the ground away.",
          "Eyes up, hips under you.",
          "Ribs stacked over pelvis."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Standing tall before the first step.",
          "Crossing feet or reaching outside the base unnecessarily.",
          "Holding breath to create fake stability.",
          "Rib flare, hip shift, or spinal sag."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "The athlete reads the cue, performs the correct action, and resets without guessing, rushing, or losing posture. Learning quality is more important than speed.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated."
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 2,
        "default_reps": 5,
        "default_work_seconds": 25,
        "default_rest_seconds": 30,
        "est_seconds_per_set": 60,
        "default_rpe_min": 2,
        "default_rpe_max": 5
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Wrist or shoulder pain in support positions"
      ],
      "goodForSessions": [
        "crawling_prep",
        "general_warmup"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 1,
        "impact_level": 0,
        "requires_spotting": false,
        "requires_coach_supervision": "optional",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Wrist or shoulder pain in support positions"
        ],
        "common_substitutions": [
          "Coach Point Step Reaction",
          "Planned cone step",
          "Low-speed mirror walk"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 6,
        "minimum_hours_between_hard_exposures": 0,
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
        "fatigue_cost": 3,
        "fatigue_sensitivity": 4,
        "technical_complexity": 3,
        "impact_level": 0,
        "intensity_ceiling": "moderate"
      }
    },
    {
      "slug": "quadruped-cross-body-reach",
      "name": "Quadruped Cross-Body Reach",
      "family": "Cross-body coordination",
      "primaryPhaseKey": "prepare_and_access",
      "subrole": "activate",
      "subroleSecondary": "coordinate",
      "slot": "neural_activation",
      "cardSummary": "Quadruped reach-across pattern that teaches trunk rotation control while maintaining pressure through the base limbs.",
      "bestPlacement": "Use in the first 5-12 minutes after a light temperature raise. Keep the dose low so readiness improves without creating fatigue.",
      "description": "Quadruped Cross-Body Reach is a neural-focused drill for cross-body reach timing, trunk control, and shoulder-hip organization. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Activate. Neural emphasis: cross-body reach timing, trunk control, and shoulder-hip organization. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
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
          "key": "flexibility",
          "weight": 2
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 5
        },
        {
          "key": "core_body_control",
          "weight": 4
        }
      ],
      "physiology": [
        {
          "key": "neural_output_readiness",
          "weight": 4
        },
        {
          "key": "control_stability",
          "weight": 4
        }
      ],
      "patterns": [
        {
          "key": "brace",
          "weight": 5
        },
        {
          "key": "rotate",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "none",
          "weight": 5
        },
        {
          "key": "mat",
          "weight": 2
        }
      ],
      "body_regions": [
        {
          "key": "core",
          "weight": 5
        },
        {
          "key": "spine",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 3
        },
        {
          "key": "hip",
          "weight": 2
        },
        {
          "key": "wrist",
          "weight": 2
        }
      ],
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Prepare & Access / Activate because it raises neural organization and movement confidence without meaningful fatigue.",
      "commonMisuse": "Do not turn this into conditioning, a long fatigue circuit, or a random agility game. The value is a crisp neural signal, an accurate movement answer, and a clean reset. If the athlete gets slower, louder, dizzy, or less coordinated, the set is done.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "trunk_bracing",
          "rib_pelvis_stack",
          "thoracic_rotation",
          "hip_rotation",
          "trunk_rotation_control"
        ],
        "primary_tissues": [
          "abdominals",
          "obliques",
          "diaphragm",
          "spinal_stabilizers",
          "deltoids",
          "rotator_cuff",
          "scapular_stabilizers",
          "glutes"
        ],
        "breathing_demand": "rhythmic",
        "balance_demand": "stable",
        "coordination_demand": "high",
        "impact_level": 0
      },
      "coachingExecution": {
        "movement_description": "Perform Quadruped Cross-Body Reach as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Use a mat or clear floor area.",
          "Athlete starts in the base position with ribs stacked over pelvis.",
          "Demonstrate one slow rep before asking for crisp reps."
        ],
        "execution_steps": [
          "Athlete sets the trunk first and breathes without bracing aggressively.",
          "Move one limb or opposite limbs while the pelvis and ribcage stay quiet.",
          "Pause briefly to show control before the next switch or tap.",
          "End the set when hips rock, breath holding appears, or timing slows."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Ribs stacked over pelvis.",
          "Move the limb without moving the trunk.",
          "Turn with control, not a twist and collapse."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Holding breath to create fake stability.",
          "Rib flare, hip shift, or spinal sag.",
          "Using speed to hide balance loss.",
          "Looking down the whole time instead of owning posture."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "The athlete leaves the drill more organized than they entered: breathing controlled, posture cleaner, and no meaningful fatigue created.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated."
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 2,
        "default_reps": 5,
        "default_work_seconds": 25,
        "default_rest_seconds": 30,
        "est_seconds_per_set": 60,
        "default_rpe_min": 2,
        "default_rpe_max": 5
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Wrist or shoulder pain in support positions"
      ],
      "goodForSessions": [
        "general_warmup",
        "crawling_prep"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 1,
        "impact_level": 0,
        "requires_spotting": false,
        "requires_coach_supervision": "optional",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Wrist or shoulder pain in support positions"
        ],
        "common_substitutions": [
          "Dead bug variation",
          "Quadruped tap",
          "Incline plank tap"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 6,
        "minimum_hours_between_hard_exposures": 0,
        "counts_as_high_intensity": false,
        "counts_as_high_impact": false,
        "counts_as_neural": true,
        "counts_as_tissue_stress": false,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": false,
        "fatigue_cost": 1,
        "fatigue_sensitivity": 2,
        "technical_complexity": 2,
        "impact_level": 0,
        "intensity_ceiling": "low"
      }
    },
    {
      "slug": "beam-walk-head-turn",
      "name": "Beam Walk Head Turn",
      "family": "Balance and vestibular control",
      "primaryPhaseKey": "movement_intelligence",
      "subrole": "balance_coordination_rhythm",
      "subroleSecondary": "vestibular",
      "slot": "balance_coordination_rhythm",
      "cardSummary": "Narrow-base walking drill with controlled head turns to improve balance, gaze control, and foot placement.",
      "bestPlacement": "Use after general warm-up and before Output, strength, or conditioning. Keep decision quality and timing crisp; stop when the athlete starts guessing.",
      "description": "Beam Walk Head Turn is a neural-focused drill for vestibular balance, foot placement accuracy, and posture under moving gaze. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Balance / Coordination / Rhythm. Neural emphasis: vestibular balance, foot placement accuracy, and posture under moving gaze. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
      "tenets": [
        {
          "key": "balance",
          "weight": 5
        },
        {
          "key": "coordination",
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 4
        }
      ],
      "methodologies": [
        {
          "key": "balance_stability",
          "weight": 5
        },
        {
          "key": "neural",
          "weight": 4
        }
      ],
      "physiology": [
        {
          "key": "control_stability",
          "weight": 5
        },
        {
          "key": "perception_action_skill",
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
          "key": "beam",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "foot",
          "weight": 5
        },
        {
          "key": "ankle",
          "weight": 4
        },
        {
          "key": "hip",
          "weight": 3
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Movement Intelligence / Balance / Coordination / Rhythm because the primary adaptation is timing, perception, coordination, and body control while the nervous system is fresh.",
      "commonMisuse": "Do not turn this into conditioning, a long fatigue circuit, or a random agility game. The value is a crisp neural signal, an accurate movement answer, and a clean reset. If the athlete gets slower, louder, dizzy, or less coordinated, the set is done.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "hip_flexion_extension",
          "knee_drive",
          "ankle_stiffness",
          "arm_leg_coordination",
          "trunk_bracing",
          "rib_pelvis_stack"
        ],
        "primary_tissues": [
          "foot_intrinsics",
          "plantar fascia",
          "calves",
          "achilles_tendon",
          "glutes",
          "hip_flexors",
          "adductors",
          "abdominals"
        ],
        "breathing_demand": "rhythmic",
        "balance_demand": "single_leg_or_dynamic",
        "coordination_demand": "high",
        "impact_level": 0
      },
      "coachingExecution": {
        "movement_description": "Perform Beam Walk Head Turn as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Set a low, stable beam or narrow line with clear space around it.",
          "Athlete starts tall with eyes forward and arms relaxed for balance.",
          "Demonstrate one slow rep before asking for crisp reps."
        ],
        "execution_steps": [
          "Athlete establishes a tall, quiet starting position.",
          "Perform the reach, walk, head turn, or hinge at a controllable speed.",
          "Regain balance after each movement without hopping or rushing.",
          "Progress only when posture and foot pressure stay calm."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Push the ground away.",
          "Eyes up, hips under you.",
          "Ribs stacked over pelvis."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Standing tall before the first step.",
          "Crossing feet or reaching outside the base unnecessarily.",
          "Holding breath to create fake stability.",
          "Rib flare, hip shift, or spinal sag."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "The athlete reads the cue, performs the correct action, and resets without guessing, rushing, or losing posture. Learning quality is more important than speed.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated."
        ]
      },
      "dosage": {
        "volume_unit": "seconds",
        "default_sets": 2,
        "default_reps": 1,
        "default_work_seconds": 20,
        "default_rest_seconds": 30,
        "est_seconds_per_set": 50,
        "default_rpe_min": 2,
        "default_rpe_max": 4
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Dizziness, vertigo, nausea, or recent concussion symptoms without medical clearance"
      ],
      "goodForSessions": [
        "general_warmup",
        "low_readiness_reset"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 2,
        "impact_level": 0,
        "requires_spotting": false,
        "requires_coach_supervision": "recommended",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Dizziness, vertigo, nausea, or recent concussion symptoms without medical clearance"
        ],
        "common_substitutions": [
          "Dead bug variation",
          "Quadruped tap",
          "Incline plank tap"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 6,
        "minimum_hours_between_hard_exposures": 0,
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
        "fatigue_cost": 3,
        "fatigue_sensitivity": 4,
        "technical_complexity": 3,
        "impact_level": 0,
        "intensity_ceiling": "moderate"
      }
    },
    {
      "slug": "mirror-balance-reach",
      "name": "Mirror Balance Reach",
      "family": "Mirror balance reaction",
      "primaryPhaseKey": "movement_intelligence",
      "subrole": "perception_action_reactive_movement",
      "subroleSecondary": "balance",
      "slot": "perception_action_skill",
      "cardSummary": "Partner-mirror reach drill that trains visual processing and balance adjustments in a low-speed setting.",
      "bestPlacement": "Use after general warm-up and before Output, strength, or conditioning. Keep decision quality and timing crisp; stop when the athlete starts guessing.",
      "description": "Mirror Balance Reach is a neural-focused drill for visual matching, balance recovery, and controlled reach strategy. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Perception-Action / Reactive Movement. Neural emphasis: visual matching, balance recovery, and controlled reach strategy. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
      "tenets": [
        {
          "key": "balance",
          "weight": 5
        },
        {
          "key": "coordination",
          "weight": 5
        },
        {
          "key": "agility",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 5
        },
        {
          "key": "balance_stability",
          "weight": 4
        }
      ],
      "physiology": [
        {
          "key": "perception_action_skill",
          "weight": 5
        },
        {
          "key": "control_stability",
          "weight": 4
        }
      ],
      "patterns": [
        {
          "key": "brace",
          "weight": 5
        },
        {
          "key": "locomote",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "partner",
          "weight": 5
        },
        {
          "key": "mirror",
          "weight": 2
        }
      ],
      "body_regions": [
        {
          "key": "foot",
          "weight": 5
        },
        {
          "key": "ankle",
          "weight": 4
        },
        {
          "key": "hip",
          "weight": 3
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Movement Intelligence / Perception-Action / Reactive Movement because the primary adaptation is timing, perception, coordination, and body control while the nervous system is fresh.",
      "commonMisuse": "Do not turn this into conditioning, a long fatigue circuit, or a random agility game. The value is a crisp neural signal, an accurate movement answer, and a clean reset. If the athlete gets slower, louder, dizzy, or less coordinated, the set is done.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "trunk_bracing",
          "rib_pelvis_stack",
          "hip_flexion_extension",
          "knee_drive",
          "ankle_stiffness",
          "arm_leg_coordination"
        ],
        "primary_tissues": [
          "foot_intrinsics",
          "plantar fascia",
          "calves",
          "achilles_tendon",
          "glutes",
          "hip_flexors",
          "adductors",
          "abdominals"
        ],
        "breathing_demand": "rhythmic",
        "balance_demand": "single_leg_or_dynamic",
        "coordination_demand": "high",
        "impact_level": 0
      },
      "coachingExecution": {
        "movement_description": "Perform Mirror Balance Reach as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Partner or coach stands where the cue is visible or audible without crowding the athlete.",
          "Agree on the cue and stop rule before the first rep.",
          "Demonstrate one slow rep before asking for crisp reps."
        ],
        "execution_steps": [
          "Athlete holds the start position and waits for the cue instead of guessing.",
          "Coach or partner gives one clear visual or auditory cue.",
          "Athlete makes the correct first movement, finishes the required action, and regains control.",
          "Reset fully before the next rep so attention and mechanics stay crisp."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Push the ground away.",
          "Eyes up, hips under you.",
          "Ribs stacked over pelvis."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Standing tall before the first step.",
          "Crossing feet or reaching outside the base unnecessarily.",
          "Holding breath to create fake stability.",
          "Rib flare, hip shift, or spinal sag."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "The athlete reads the cue, performs the correct action, and resets without guessing, rushing, or losing posture. Learning quality is more important than speed.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated."
        ]
      },
      "dosage": {
        "volume_unit": "seconds",
        "default_sets": 3,
        "default_reps": 1,
        "default_work_seconds": 12,
        "default_rest_seconds": 45,
        "est_seconds_per_set": 60,
        "default_rpe_min": 3,
        "default_rpe_max": 6
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Painful movement pattern",
        "Athlete cannot follow the cue or maintain safe posture"
      ],
      "goodForSessions": [
        "general_warmup"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 1,
        "impact_level": 0,
        "requires_spotting": false,
        "requires_coach_supervision": "optional",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Painful movement pattern",
          "Athlete cannot follow the cue or maintain safe posture"
        ],
        "common_substitutions": [
          "Coach Point Step Reaction",
          "Planned cone step",
          "Low-speed mirror walk"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 6,
        "minimum_hours_between_hard_exposures": 0,
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
        "fatigue_cost": 3,
        "fatigue_sensitivity": 4,
        "technical_complexity": 3,
        "impact_level": 0,
        "intensity_ceiling": "moderate"
      }
    },
    {
      "slug": "jump-rope-rhythm-switch",
      "name": "Jump Rope Rhythm Switch",
      "family": "Rhythm and foot timing",
      "primaryPhaseKey": "movement_intelligence",
      "subrole": "balance_coordination_rhythm",
      "subroleSecondary": "potentiate",
      "slot": "rhythm_switching",
      "cardSummary": "Jump-rope drill that changes cadence, foot pattern, or count rhythm to sharpen timing and foot stiffness.",
      "bestPlacement": "Use after general warm-up and before Output, strength, or conditioning. Keep decision quality and timing crisp; stop when the athlete starts guessing.",
      "description": "Jump Rope Rhythm Switch is a neural-focused drill for rhythm switching, foot timing, and elastic contact quality. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Balance / Coordination / Rhythm. Neural emphasis: rhythm switching, foot timing, and elastic contact quality. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
      "tenets": [
        {
          "key": "coordination",
          "weight": 5
        },
        {
          "key": "balance",
          "weight": 3
        },
        {
          "key": "speed",
          "weight": 2
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 5
        },
        {
          "key": "plyometrics",
          "weight": 2
        }
      ],
      "physiology": [
        {
          "key": "neural_output_readiness",
          "weight": 4
        },
        {
          "key": "ssc_stiffness",
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
        }
      ],
      "equipment": [
        {
          "key": "jump_rope",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "foot",
          "weight": 5
        },
        {
          "key": "ankle",
          "weight": 4
        },
        {
          "key": "full_body",
          "weight": 3
        }
      ],
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Movement Intelligence / Balance / Coordination / Rhythm because the primary adaptation is timing, perception, coordination, and body control while the nervous system is fresh.",
      "commonMisuse": "Do not turn this into conditioning, a long fatigue circuit, or a random agility game. The value is a crisp neural signal, an accurate movement answer, and a clean reset. If the athlete gets slower, louder, dizzy, or less coordinated, the set is done.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "hip_extension",
          "knee_extension",
          "ankle_plantar_flexion",
          "hip_knee_ankle_absorption",
          "eccentric_braking",
          "postural_stick"
        ],
        "primary_tissues": [
          "foot_intrinsics",
          "plantar fascia",
          "calves",
          "achilles_tendon",
          "nervous_system",
          "postural_system"
        ],
        "breathing_demand": "rhythmic",
        "balance_demand": "single_leg_or_dynamic",
        "coordination_demand": "high",
        "impact_level": 1
      },
      "coachingExecution": {
        "movement_description": "Perform Jump Rope Rhythm Switch as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Use a rope sized so the athlete can turn it without shoulder shrugging.",
          "Stand tall on a safe surface with enough overhead and side clearance.",
          "Demonstrate one slow rep before asking for crisp reps."
        ],
        "execution_steps": [
          "Athlete loads quietly with posture stacked and eyes forward.",
          "Athlete performs the jump, hop, contact, or drop with crisp intent.",
          "Athlete sticks, rebounds, or finishes exactly as assigned without extra contacts.",
          "Stop the set if contact sound, alignment, or rhythm degrades."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Quiet contacts.",
          "Land under your center."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Landing loud or stiff.",
          "Knees collapsing inward or feet spinning out.",
          "Using speed to hide balance loss.",
          "Looking down the whole time instead of owning posture."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "The athlete reads the cue, performs the correct action, and resets without guessing, rushing, or losing posture. Learning quality is more important than speed.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated.",
          "Contacts get loud, uncontrolled, or asymmetrical."
        ]
      },
      "dosage": {
        "volume_unit": "contacts",
        "default_sets": 2,
        "default_reps": 12,
        "default_work_seconds": 15,
        "default_rest_seconds": 45,
        "est_seconds_per_set": 60,
        "default_rpe_min": 3,
        "default_rpe_max": 6
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Active calf, Achilles, knee, or hip irritation",
        "Slippery surface or unsafe stopping area"
      ],
      "goodForSessions": [
        "general_warmup",
        "landing_prep"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 1,
        "impact_level": 1,
        "requires_spotting": false,
        "requires_coach_supervision": "optional",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Active calf, Achilles, knee, or hip irritation",
          "Slippery surface or unsafe stopping area"
        ],
        "common_substitutions": [
          "Snap-Down to Athletic Stick",
          "Low-amplitude pogo",
          "March or step-to-stick alternative"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 6,
        "minimum_hours_between_hard_exposures": 0,
        "counts_as_high_intensity": false,
        "counts_as_high_impact": false,
        "counts_as_neural": true,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 3,
        "fatigue_sensitivity": 4,
        "technical_complexity": 3,
        "impact_level": 1,
        "intensity_ceiling": "moderate"
      }
    },
    {
      "slug": "low-line-pogo-side-to-side",
      "name": "Low Line Pogo Side-to-Side",
      "family": "Plyometric stiffness",
      "primaryPhaseKey": "prepare_and_access",
      "subrole": "potentiate_bridge",
      "subroleSecondary": "elastic",
      "slot": "plyometric_stiffness",
      "cardSummary": "Small lateral line hops that prepare the ankle and hip for quick side-to-side sport contacts.",
      "bestPlacement": "Use in the first 5-12 minutes after a light temperature raise. Keep the dose low so readiness improves without creating fatigue.",
      "description": "Low Line Pogo Side-to-Side is a neural-focused drill for lateral ankle stiffness, hip alignment, and reactive foot control. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Potentiate Bridge. Neural emphasis: lateral ankle stiffness, hip alignment, and reactive foot control. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
      "tenets": [
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
          "weight": 5
        },
        {
          "key": "plyometrics",
          "weight": 4
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
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
        }
      ],
      "equipment": [
        {
          "key": "cones",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "foot",
          "weight": 5
        },
        {
          "key": "ankle",
          "weight": 4
        },
        {
          "key": "hip",
          "weight": 3
        }
      ],
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Prepare & Access / Potentiate Bridge because it raises neural organization and movement confidence without meaningful fatigue.",
      "commonMisuse": "Do not turn this into conditioning, a long fatigue circuit, or a random agility game. The value is a crisp neural signal, an accurate movement answer, and a clean reset. If the athlete gets slower, louder, dizzy, or less coordinated, the set is done.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "hip_extension",
          "knee_extension",
          "ankle_plantar_flexion",
          "hip_knee_ankle_absorption",
          "eccentric_braking",
          "postural_stick"
        ],
        "primary_tissues": [
          "foot_intrinsics",
          "plantar fascia",
          "calves",
          "achilles_tendon",
          "glutes",
          "hip_flexors",
          "adductors"
        ],
        "breathing_demand": "rhythmic",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 1
      },
      "coachingExecution": {
        "movement_description": "Perform Low Line Pogo Side-to-Side as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Set cones to mark a short, clear lane or decision area.",
          "Keep distances short enough that every rep can be sharp and controlled.",
          "Demonstrate one slow rep before asking for crisp reps."
        ],
        "execution_steps": [
          "Athlete loads quietly with posture stacked and eyes forward.",
          "Athlete performs the jump, hop, contact, or drop with crisp intent.",
          "Athlete sticks, rebounds, or finishes exactly as assigned without extra contacts.",
          "Stop the set if contact sound, alignment, or rhythm degrades."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Quiet contacts.",
          "Land under your center."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Landing loud or stiff.",
          "Knees collapsing inward or feet spinning out.",
          "Using speed to hide balance loss.",
          "Looking down the whole time instead of owning posture."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "The athlete leaves the drill more organized than they entered: breathing controlled, posture cleaner, and no meaningful fatigue created.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated.",
          "Contacts get loud, uncontrolled, or asymmetrical."
        ]
      },
      "dosage": {
        "volume_unit": "contacts",
        "default_sets": 2,
        "default_reps": 12,
        "default_work_seconds": 15,
        "default_rest_seconds": 45,
        "est_seconds_per_set": 60,
        "default_rpe_min": 3,
        "default_rpe_max": 6
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Active calf, Achilles, knee, or hip irritation",
        "Slippery surface or unsafe stopping area"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 1,
        "impact_level": 1,
        "requires_spotting": false,
        "requires_coach_supervision": "optional",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Active calf, Achilles, knee, or hip irritation",
          "Slippery surface or unsafe stopping area"
        ],
        "common_substitutions": [
          "Snap-Down to Athletic Stick",
          "Low-amplitude pogo",
          "March or step-to-stick alternative"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 6,
        "minimum_hours_between_hard_exposures": 0,
        "counts_as_high_intensity": false,
        "counts_as_high_impact": false,
        "counts_as_neural": true,
        "counts_as_tissue_stress": true,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": false,
        "fatigue_cost": 2,
        "fatigue_sensitivity": 2,
        "technical_complexity": 2,
        "impact_level": 1,
        "intensity_ceiling": "low"
      }
    },
    {
      "slug": "split-stance-auditory-sprint-start",
      "name": "Split-Stance Auditory Sprint Start",
      "family": "Reaction acceleration",
      "primaryPhaseKey": "output",
      "subrole": "acceleration_start_speed",
      "subroleSecondary": "react",
      "slot": "reaction_speed",
      "cardSummary": "Low-volume sprint start that adds an auditory trigger to sharpen perception-to-action speed.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, before heavy strength or conditioning. Keep volume low, intent high, and rest long enough for every rep to look sharp.",
      "description": "Split-Stance Auditory Sprint Start is a neural-focused drill for auditory reaction, first-step mechanics, and acceleration intent. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Acceleration Start Speed. Neural emphasis: auditory reaction, first-step mechanics, and acceleration intent. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
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
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 5
        }
      ],
      "physiology": [
        {
          "key": "perception_action_skill",
          "weight": 5
        },
        {
          "key": "neural_output_readiness",
          "weight": 5
        }
      ],
      "patterns": [
        {
          "key": "locomote",
          "weight": 5
        }
      ],
      "equipment": [
        {
          "key": "none",
          "weight": 5
        },
        {
          "key": "partner",
          "weight": 2
        }
      ],
      "body_regions": [
        {
          "key": "full_body",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 4
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
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Output / Acceleration Start Speed because the drill expresses speed, stiffness, power, or reactive intent and requires freshness, low volume, and full recovery.",
      "commonMisuse": "Do not chase sweat or contacts. This belongs early as high-quality neural output; tired reps turn it into conditioning and erase the purpose. Keep attempts capped and rest long enough to preserve speed and mechanics.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "hip_flexion_extension",
          "knee_drive",
          "ankle_stiffness",
          "arm_leg_coordination"
        ],
        "primary_tissues": [
          "nervous_system",
          "postural_system",
          "glutes",
          "hip_flexors",
          "adductors",
          "calves",
          "achilles_tendon",
          "foot_intrinsics"
        ],
        "breathing_demand": "controlled_between_reps",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 1
      },
      "coachingExecution": {
        "movement_description": "Perform Split-Stance Auditory Sprint Start as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Partner or coach stands where the cue is visible or audible without crowding the athlete.",
          "Agree on the cue and stop rule before the first rep.",
          "Complete general warm-up first; do not start this cold or under fatigue."
        ],
        "execution_steps": [
          "Athlete holds the start position and waits for the cue instead of guessing.",
          "Coach or partner gives one clear visual or auditory cue.",
          "Athlete makes the correct first movement, finishes the required action, and regains control.",
          "Reset fully before the next rep so attention and mechanics stay crisp."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Push the ground away.",
          "Eyes up, hips under you."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Standing tall before the first step.",
          "Crossing feet or reaching outside the base unnecessarily."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "Every rep is fast, quiet, and technically repeatable with full reset between attempts. End the set when speed, contact quality, posture, or landing control drops.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated.",
          "Contacts get loud, uncontrolled, or asymmetrical.",
          "The athlete needs conditioning-style effort to keep going."
        ]
      },
      "dosage": {
        "volume_unit": "attempts",
        "default_sets": 3,
        "default_reps": 3,
        "default_work_seconds": 8,
        "default_rest_seconds": 75,
        "est_seconds_per_set": 90,
        "default_rpe_min": 5,
        "default_rpe_max": 8
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Active calf, Achilles, knee, or hip irritation",
        "Slippery surface or unsafe stopping area",
        "Unprepared hamstring or calf tissue",
        "Crowded lane or unsafe stopping distance"
      ],
      "goodForSessions": [
        "sprint_prep"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 1,
        "impact_level": 1,
        "requires_spotting": false,
        "requires_coach_supervision": "recommended",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Active calf, Achilles, knee, or hip irritation",
          "Slippery surface or unsafe stopping area",
          "Unprepared hamstring or calf tissue",
          "Crowded lane or unsafe stopping distance"
        ],
        "common_substitutions": [
          "A-March Linear",
          "Supported balance reach",
          "Low-speed planned version"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 6,
        "minimum_hours_between_hard_exposures": 0,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": false,
        "counts_as_neural": true,
        "counts_as_tissue_stress": false,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 4,
        "impact_level": 1,
        "intensity_ceiling": "high"
      }
    },
    {
      "slug": "partner-point-reactive-sprint-start",
      "name": "Partner Point Reactive Sprint Start",
      "family": "Reaction acceleration",
      "primaryPhaseKey": "output",
      "subrole": "acceleration_start_speed",
      "subroleSecondary": "react",
      "slot": "reaction_speed",
      "cardSummary": "Partner-directed start that trains the athlete to accelerate in response to a visual directional cue.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, before heavy strength or conditioning. Keep volume low, intent high, and rest long enough for every rep to look sharp.",
      "description": "Partner Point Reactive Sprint Start is a neural-focused drill for visual processing, first-step direction, and acceleration readiness. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Acceleration Start Speed. Neural emphasis: visual processing, first-step direction, and acceleration readiness. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
      "tenets": [
        {
          "key": "speed",
          "weight": 5
        },
        {
          "key": "agility",
          "weight": 3
        },
        {
          "key": "coordination",
          "weight": 4
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 5
        }
      ],
      "physiology": [
        {
          "key": "perception_action_skill",
          "weight": 5
        },
        {
          "key": "neural_output_readiness",
          "weight": 5
        }
      ],
      "patterns": [
        {
          "key": "locomote",
          "weight": 5
        }
      ],
      "equipment": [
        {
          "key": "partner",
          "weight": 5
        },
        {
          "key": "cones",
          "weight": 2
        }
      ],
      "body_regions": [
        {
          "key": "full_body",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 4
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
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Output / Acceleration Start Speed because the drill expresses speed, stiffness, power, or reactive intent and requires freshness, low volume, and full recovery.",
      "commonMisuse": "Do not chase sweat or contacts. This belongs early as high-quality neural output; tired reps turn it into conditioning and erase the purpose. Keep attempts capped and rest long enough to preserve speed and mechanics.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "hip_flexion_extension",
          "knee_drive",
          "ankle_stiffness",
          "arm_leg_coordination"
        ],
        "primary_tissues": [
          "nervous_system",
          "postural_system",
          "glutes",
          "hip_flexors",
          "adductors",
          "calves",
          "achilles_tendon",
          "foot_intrinsics"
        ],
        "breathing_demand": "controlled_between_reps",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 1
      },
      "coachingExecution": {
        "movement_description": "Perform Partner Point Reactive Sprint Start as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Set cones to mark a short, clear lane or decision area.",
          "Keep distances short enough that every rep can be sharp and controlled.",
          "Complete general warm-up first; do not start this cold or under fatigue."
        ],
        "execution_steps": [
          "Athlete holds the start position and waits for the cue instead of guessing.",
          "Coach or partner gives one clear visual or auditory cue.",
          "Athlete makes the correct first movement, finishes the required action, and regains control.",
          "Reset fully before the next rep so attention and mechanics stay crisp."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Push the ground away.",
          "Eyes up, hips under you."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Standing tall before the first step.",
          "Crossing feet or reaching outside the base unnecessarily."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "Every rep is fast, quiet, and technically repeatable with full reset between attempts. End the set when speed, contact quality, posture, or landing control drops.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated.",
          "Contacts get loud, uncontrolled, or asymmetrical.",
          "The athlete needs conditioning-style effort to keep going."
        ]
      },
      "dosage": {
        "volume_unit": "attempts",
        "default_sets": 3,
        "default_reps": 3,
        "default_work_seconds": 8,
        "default_rest_seconds": 75,
        "est_seconds_per_set": 90,
        "default_rpe_min": 5,
        "default_rpe_max": 8
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Active calf, Achilles, knee, or hip irritation",
        "Slippery surface or unsafe stopping area",
        "Unprepared hamstring or calf tissue",
        "Crowded lane or unsafe stopping distance"
      ],
      "goodForSessions": [
        "sprint_prep"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 1,
        "impact_level": 1,
        "requires_spotting": false,
        "requires_coach_supervision": "recommended",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Active calf, Achilles, knee, or hip irritation",
          "Slippery surface or unsafe stopping area",
          "Unprepared hamstring or calf tissue",
          "Crowded lane or unsafe stopping distance"
        ],
        "common_substitutions": [
          "Coach Point Step Reaction",
          "Planned cone step",
          "Low-speed mirror walk"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 6,
        "minimum_hours_between_hard_exposures": 0,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": false,
        "counts_as_neural": true,
        "counts_as_tissue_stress": false,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 4,
        "impact_level": 1,
        "intensity_ceiling": "high"
      }
    },
    {
      "slug": "tennis-ball-drop-acceleration-chase",
      "name": "Tennis Ball Drop Acceleration Chase",
      "family": "Reaction acceleration",
      "primaryPhaseKey": "output",
      "subrole": "acceleration_start_speed",
      "subroleSecondary": "react",
      "slot": "reaction_speed",
      "cardSummary": "Visual reaction drill where the athlete accelerates to catch a dropped ball before its second bounce.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, before heavy strength or conditioning. Keep volume low, intent high, and rest long enough for every rep to look sharp.",
      "description": "Tennis Ball Drop Acceleration Chase is a neural-focused drill for visual trigger, acceleration decision speed, and relaxed first-step output. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Acceleration Start Speed. Neural emphasis: visual trigger, acceleration decision speed, and relaxed first-step output. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
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
          "key": "agility",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 5
        }
      ],
      "physiology": [
        {
          "key": "perception_action_skill",
          "weight": 5
        },
        {
          "key": "neural_output_readiness",
          "weight": 5
        }
      ],
      "patterns": [
        {
          "key": "locomote",
          "weight": 5
        }
      ],
      "equipment": [
        {
          "key": "partner",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "full_body",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 4
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
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Output / Acceleration Start Speed because the drill expresses speed, stiffness, power, or reactive intent and requires freshness, low volume, and full recovery.",
      "commonMisuse": "Do not chase sweat or contacts. This belongs early as high-quality neural output; tired reps turn it into conditioning and erase the purpose. Keep attempts capped and rest long enough to preserve speed and mechanics.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "hip_flexion_extension",
          "knee_drive",
          "ankle_stiffness",
          "arm_leg_coordination"
        ],
        "primary_tissues": [
          "nervous_system",
          "postural_system",
          "glutes",
          "hip_flexors",
          "adductors",
          "calves",
          "achilles_tendon",
          "foot_intrinsics"
        ],
        "breathing_demand": "controlled_between_reps",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 1
      },
      "coachingExecution": {
        "movement_description": "Perform Tennis Ball Drop Acceleration Chase as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Partner or coach stands where the cue is visible or audible without crowding the athlete.",
          "Agree on the cue and stop rule before the first rep.",
          "Complete general warm-up first; do not start this cold or under fatigue."
        ],
        "execution_steps": [
          "Athlete holds the start position and waits for the cue instead of guessing.",
          "Coach or partner gives one clear visual or auditory cue.",
          "Athlete makes the correct first movement, finishes the required action, and regains control.",
          "Reset fully before the next rep so attention and mechanics stay crisp."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Push the ground away.",
          "Eyes up, hips under you."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Standing tall before the first step.",
          "Crossing feet or reaching outside the base unnecessarily."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "Every rep is fast, quiet, and technically repeatable with full reset between attempts. End the set when speed, contact quality, posture, or landing control drops.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated.",
          "Contacts get loud, uncontrolled, or asymmetrical.",
          "The athlete needs conditioning-style effort to keep going."
        ]
      },
      "dosage": {
        "volume_unit": "attempts",
        "default_sets": 3,
        "default_reps": 3,
        "default_work_seconds": 8,
        "default_rest_seconds": 75,
        "est_seconds_per_set": 90,
        "default_rpe_min": 5,
        "default_rpe_max": 8
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Active calf, Achilles, knee, or hip irritation",
        "Slippery surface or unsafe stopping area",
        "Unprepared hamstring or calf tissue",
        "Crowded lane or unsafe stopping distance"
      ],
      "goodForSessions": [
        "sprint_prep"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 1,
        "impact_level": 1,
        "requires_spotting": false,
        "requires_coach_supervision": "recommended",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Active calf, Achilles, knee, or hip irritation",
          "Slippery surface or unsafe stopping area",
          "Unprepared hamstring or calf tissue",
          "Crowded lane or unsafe stopping distance"
        ],
        "common_substitutions": [
          "A-March Linear",
          "Supported balance reach",
          "Low-speed planned version"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 6,
        "minimum_hours_between_hard_exposures": 0,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": false,
        "counts_as_neural": true,
        "counts_as_tissue_stress": false,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 4,
        "impact_level": 1,
        "intensity_ceiling": "high"
      }
    },
    {
      "slug": "reactive-stick-drop-catch",
      "name": "Reactive Stick Drop Catch",
      "family": "Hand-eye reaction",
      "primaryPhaseKey": "movement_intelligence",
      "subrole": "perception_action_reactive_movement",
      "subroleSecondary": "react",
      "slot": "reaction_speed",
      "cardSummary": "Partner stick-drop drill that trains visual reaction time and relaxed catching speed.",
      "bestPlacement": "Use after general warm-up and before Output, strength, or conditioning. Keep decision quality and timing crisp; stop when the athlete starts guessing.",
      "description": "Reactive Stick Drop Catch is a neural-focused drill for visual reaction, hand speed, and grip timing. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Perception-Action / Reactive Movement. Neural emphasis: visual reaction, hand speed, and grip timing. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
      "tenets": [
        {
          "key": "coordination",
          "weight": 5
        },
        {
          "key": "speed",
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
        }
      ],
      "physiology": [
        {
          "key": "perception_action_skill",
          "weight": 5
        },
        {
          "key": "neural_output_readiness",
          "weight": 4
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
          "key": "partner",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "shoulder",
          "weight": 5
        },
        {
          "key": "wrist",
          "weight": 4
        },
        {
          "key": "full_body",
          "weight": 3
        }
      ],
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Movement Intelligence / Perception-Action / Reactive Movement because the primary adaptation is timing, perception, coordination, and body control while the nervous system is fresh.",
      "commonMisuse": "Do not turn this into conditioning, a long fatigue circuit, or a random agility game. The value is a crisp neural signal, an accurate movement answer, and a clean reset. If the athlete gets slower, louder, dizzy, or less coordinated, the set is done.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "trunk_bracing",
          "rib_pelvis_stack"
        ],
        "primary_tissues": [
          "deltoids",
          "rotator_cuff",
          "scapular_stabilizers",
          "wrist_flexors",
          "wrist_extensors",
          "nervous_system",
          "postural_system"
        ],
        "breathing_demand": "rhythmic",
        "balance_demand": "stable",
        "coordination_demand": "high",
        "impact_level": 0
      },
      "coachingExecution": {
        "movement_description": "Perform Reactive Stick Drop Catch as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Partner or coach stands where the cue is visible or audible without crowding the athlete.",
          "Agree on the cue and stop rule before the first rep.",
          "Demonstrate one slow rep before asking for crisp reps."
        ],
        "execution_steps": [
          "Athlete holds the start position and waits for the cue instead of guessing.",
          "Coach or partner gives one clear visual or auditory cue.",
          "Athlete makes the correct first movement, finishes the required action, and regains control.",
          "Reset fully before the next rep so attention and mechanics stay crisp."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Ribs stacked over pelvis.",
          "Move the limb without moving the trunk."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Holding breath to create fake stability.",
          "Rib flare, hip shift, or spinal sag."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "The athlete reads the cue, performs the correct action, and resets without guessing, rushing, or losing posture. Learning quality is more important than speed.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated."
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 2,
        "default_reps": 5,
        "default_work_seconds": 25,
        "default_rest_seconds": 30,
        "est_seconds_per_set": 60,
        "default_rpe_min": 2,
        "default_rpe_max": 5
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Wrist or shoulder pain in support positions"
      ],
      "goodForSessions": [
        "general_warmup"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 1,
        "impact_level": 0,
        "requires_spotting": false,
        "requires_coach_supervision": "optional",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Wrist or shoulder pain in support positions"
        ],
        "common_substitutions": [
          "Coach Point Step Reaction",
          "Planned cone step",
          "Low-speed mirror walk"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 6,
        "minimum_hours_between_hard_exposures": 0,
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
        "fatigue_cost": 3,
        "fatigue_sensitivity": 4,
        "technical_complexity": 3,
        "impact_level": 0,
        "intensity_ceiling": "moderate"
      }
    },
    {
      "slug": "mirror-shuffle",
      "name": "Mirror Shuffle",
      "family": "Mirror reaction",
      "primaryPhaseKey": "movement_intelligence",
      "subrole": "perception_action_reactive_movement",
      "subroleSecondary": "agility",
      "slot": "perception_action_skill",
      "cardSummary": "Short partner mirror drill that trains reactive lateral movement without turning the set into conditioning.",
      "bestPlacement": "Use after general warm-up and before Output, strength, or conditioning. Keep decision quality and timing crisp; stop when the athlete starts guessing.",
      "description": "Mirror Shuffle is a neural-focused drill for visual read, lateral first step, and controlled braking. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Perception-Action / Reactive Movement. Neural emphasis: visual read, lateral first step, and controlled braking. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
      "tenets": [
        {
          "key": "agility",
          "weight": 5
        },
        {
          "key": "coordination",
          "weight": 5
        },
        {
          "key": "body_control",
          "weight": 4
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 5
        },
        {
          "key": "balance_stability",
          "weight": 2
        }
      ],
      "physiology": [
        {
          "key": "perception_action_skill",
          "weight": 5
        },
        {
          "key": "neural_output_readiness",
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
          "key": "land",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "partner",
          "weight": 5
        },
        {
          "key": "cones",
          "weight": 2
        }
      ],
      "body_regions": [
        {
          "key": "full_body",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 4
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
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Movement Intelligence / Perception-Action / Reactive Movement because the primary adaptation is timing, perception, coordination, and body control while the nervous system is fresh.",
      "commonMisuse": "Do not turn this into conditioning, a long fatigue circuit, or a random agility game. The value is a crisp neural signal, an accurate movement answer, and a clean reset. If the athlete gets slower, louder, dizzy, or less coordinated, the set is done.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "hip_flexion_extension",
          "knee_drive",
          "ankle_stiffness",
          "arm_leg_coordination",
          "hip_knee_ankle_absorption",
          "eccentric_braking",
          "postural_stick"
        ],
        "primary_tissues": [
          "nervous_system",
          "postural_system",
          "glutes",
          "hip_flexors",
          "adductors",
          "calves",
          "achilles_tendon",
          "abdominals"
        ],
        "breathing_demand": "rhythmic",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 1
      },
      "coachingExecution": {
        "movement_description": "Perform Mirror Shuffle as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Set cones to mark a short, clear lane or decision area.",
          "Keep distances short enough that every rep can be sharp and controlled.",
          "Demonstrate one slow rep before asking for crisp reps."
        ],
        "execution_steps": [
          "Athlete holds the start position and waits for the cue instead of guessing.",
          "Coach or partner gives one clear visual or auditory cue.",
          "Athlete makes the correct first movement, finishes the required action, and regains control.",
          "Reset fully before the next rep so attention and mechanics stay crisp."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Push the ground away.",
          "Eyes up, hips under you.",
          "Quiet contacts."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Standing tall before the first step.",
          "Crossing feet or reaching outside the base unnecessarily.",
          "Landing loud or stiff.",
          "Knees collapsing inward or feet spinning out."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "The athlete reads the cue, performs the correct action, and resets without guessing, rushing, or losing posture. Learning quality is more important than speed.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated.",
          "Contacts get loud, uncontrolled, or asymmetrical."
        ]
      },
      "dosage": {
        "volume_unit": "attempts",
        "default_sets": 2,
        "default_reps": 3,
        "default_work_seconds": 15,
        "default_rest_seconds": 60,
        "est_seconds_per_set": 75,
        "default_rpe_min": 3,
        "default_rpe_max": 6
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Active calf, Achilles, knee, or hip irritation",
        "Slippery surface or unsafe stopping area"
      ],
      "goodForSessions": [
        "deceleration",
        "general_warmup"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 1,
        "impact_level": 1,
        "requires_spotting": false,
        "requires_coach_supervision": "optional",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Active calf, Achilles, knee, or hip irritation",
          "Slippery surface or unsafe stopping area"
        ],
        "common_substitutions": [
          "Snap-Down to Athletic Stick",
          "Low-amplitude pogo",
          "March or step-to-stick alternative"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 6,
        "minimum_hours_between_hard_exposures": 0,
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
        "fatigue_cost": 3,
        "fatigue_sensitivity": 4,
        "technical_complexity": 3,
        "impact_level": 1,
        "intensity_ceiling": "moderate"
      }
    },
    {
      "slug": "cone-color-call-cut",
      "name": "Cone Color Call Cut",
      "family": "Reactive cut",
      "primaryPhaseKey": "movement_intelligence",
      "subrole": "perception_action_reactive_movement",
      "subroleSecondary": "deceleration",
      "slot": "perception_action_skill",
      "cardSummary": "Color-call cutting drill that links visual recognition to a controlled change of direction.",
      "bestPlacement": "Use after general warm-up and before Output, strength, or conditioning. Keep decision quality and timing crisp; stop when the athlete starts guessing.",
      "description": "Cone Color Call Cut is a neural-focused drill for cue recognition, deceleration choice, and clean foot placement. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Perception-Action / Reactive Movement. Neural emphasis: cue recognition, deceleration choice, and clean foot placement. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
      "tenets": [
        {
          "key": "agility",
          "weight": 5
        },
        {
          "key": "coordination",
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 4
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 5
        },
        {
          "key": "balance_stability",
          "weight": 2
        }
      ],
      "physiology": [
        {
          "key": "perception_action_skill",
          "weight": 5
        },
        {
          "key": "neural_output_readiness",
          "weight": 4
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
          "key": "land",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "cones",
          "weight": 5
        },
        {
          "key": "partner",
          "weight": 2
        }
      ],
      "body_regions": [
        {
          "key": "full_body",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 4
        },
        {
          "key": "knee",
          "weight": 3
        },
        {
          "key": "ankle",
          "weight": 2
        }
      ],
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Movement Intelligence / Perception-Action / Reactive Movement because the primary adaptation is timing, perception, coordination, and body control while the nervous system is fresh.",
      "commonMisuse": "Do not turn this into conditioning, a long fatigue circuit, or a random agility game. The value is a crisp neural signal, an accurate movement answer, and a clean reset. If the athlete gets slower, louder, dizzy, or less coordinated, the set is done.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "hip_flexion_extension",
          "knee_drive",
          "ankle_stiffness",
          "arm_leg_coordination",
          "hip_knee_ankle_absorption",
          "eccentric_braking",
          "postural_stick"
        ],
        "primary_tissues": [
          "nervous_system",
          "postural_system",
          "glutes",
          "hip_flexors",
          "adductors",
          "quadriceps",
          "patellar_tendon",
          "calves"
        ],
        "breathing_demand": "rhythmic",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 1
      },
      "coachingExecution": {
        "movement_description": "Perform Cone Color Call Cut as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Set cones to mark a short, clear lane or decision area.",
          "Keep distances short enough that every rep can be sharp and controlled.",
          "Demonstrate one slow rep before asking for crisp reps."
        ],
        "execution_steps": [
          "Athlete holds the start position and waits for the cue instead of guessing.",
          "Coach or partner gives one clear visual or auditory cue.",
          "Athlete makes the correct first movement, finishes the required action, and regains control.",
          "Reset fully before the next rep so attention and mechanics stay crisp."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Push the ground away.",
          "Eyes up, hips under you.",
          "Quiet contacts."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Standing tall before the first step.",
          "Crossing feet or reaching outside the base unnecessarily.",
          "Landing loud or stiff.",
          "Knees collapsing inward or feet spinning out."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "The athlete reads the cue, performs the correct action, and resets without guessing, rushing, or losing posture. Learning quality is more important than speed.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated.",
          "Contacts get loud, uncontrolled, or asymmetrical."
        ]
      },
      "dosage": {
        "volume_unit": "attempts",
        "default_sets": 2,
        "default_reps": 3,
        "default_work_seconds": 15,
        "default_rest_seconds": 60,
        "est_seconds_per_set": 75,
        "default_rpe_min": 3,
        "default_rpe_max": 6
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Active calf, Achilles, knee, or hip irritation",
        "Slippery surface or unsafe stopping area"
      ],
      "goodForSessions": [
        "deceleration",
        "general_warmup"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 2,
        "impact_level": 1,
        "requires_spotting": false,
        "requires_coach_supervision": "recommended",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Active calf, Achilles, knee, or hip irritation",
          "Slippery surface or unsafe stopping area"
        ],
        "common_substitutions": [
          "Snap-Down to Athletic Stick",
          "Low-amplitude pogo",
          "March or step-to-stick alternative"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 6,
        "minimum_hours_between_hard_exposures": 0,
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
        "fatigue_cost": 3,
        "fatigue_sensitivity": 4,
        "technical_complexity": 3,
        "impact_level": 1,
        "intensity_ceiling": "moderate"
      }
    },
    {
      "slug": "coach-point-step-reaction",
      "name": "Coach Point Step Reaction",
      "family": "Low-speed reaction",
      "primaryPhaseKey": "movement_intelligence",
      "subrole": "perception_action_reactive_movement",
      "subroleSecondary": "react",
      "slot": "perception_action_skill",
      "cardSummary": "Coach-pointed step drill that teaches the athlete to wait for information, step cleanly, and reset posture.",
      "bestPlacement": "Use after general warm-up and before Output, strength, or conditioning. Keep decision quality and timing crisp; stop when the athlete starts guessing.",
      "description": "Coach Point Step Reaction is a neural-focused drill for visual recognition, first-step direction, and calm reset control. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Perception-Action / Reactive Movement. Neural emphasis: visual recognition, first-step direction, and calm reset control. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
      "tenets": [
        {
          "key": "coordination",
          "weight": 5
        },
        {
          "key": "agility",
          "weight": 4
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
        }
      ],
      "physiology": [
        {
          "key": "perception_action_skill",
          "weight": 5
        },
        {
          "key": "neural_output_readiness",
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
          "key": "partner",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "full_body",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        }
      ],
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Movement Intelligence / Perception-Action / Reactive Movement because the primary adaptation is timing, perception, coordination, and body control while the nervous system is fresh.",
      "commonMisuse": "Do not turn this into conditioning, a long fatigue circuit, or a random agility game. The value is a crisp neural signal, an accurate movement answer, and a clean reset. If the athlete gets slower, louder, dizzy, or less coordinated, the set is done.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "hip_flexion_extension",
          "knee_drive",
          "ankle_stiffness",
          "arm_leg_coordination",
          "trunk_bracing",
          "rib_pelvis_stack"
        ],
        "primary_tissues": [
          "nervous_system",
          "postural_system",
          "glutes",
          "hip_flexors",
          "adductors",
          "calves",
          "achilles_tendon"
        ],
        "breathing_demand": "rhythmic",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 0
      },
      "coachingExecution": {
        "movement_description": "Perform Coach Point Step Reaction as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Partner or coach stands where the cue is visible or audible without crowding the athlete.",
          "Agree on the cue and stop rule before the first rep.",
          "Demonstrate one slow rep before asking for crisp reps."
        ],
        "execution_steps": [
          "Athlete holds the start position and waits for the cue instead of guessing.",
          "Coach or partner gives one clear visual or auditory cue.",
          "Athlete makes the correct first movement, finishes the required action, and regains control.",
          "Reset fully before the next rep so attention and mechanics stay crisp."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Push the ground away.",
          "Eyes up, hips under you.",
          "Ribs stacked over pelvis."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Standing tall before the first step.",
          "Crossing feet or reaching outside the base unnecessarily.",
          "Holding breath to create fake stability.",
          "Rib flare, hip shift, or spinal sag."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "The athlete reads the cue, performs the correct action, and resets without guessing, rushing, or losing posture. Learning quality is more important than speed.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated."
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 2,
        "default_reps": 5,
        "default_work_seconds": 25,
        "default_rest_seconds": 30,
        "est_seconds_per_set": 60,
        "default_rpe_min": 2,
        "default_rpe_max": 5
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Painful movement pattern",
        "Athlete cannot follow the cue or maintain safe posture"
      ],
      "goodForSessions": [
        "general_warmup",
        "low_readiness_reset"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 1,
        "impact_level": 0,
        "requires_spotting": false,
        "requires_coach_supervision": "optional",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Painful movement pattern",
          "Athlete cannot follow the cue or maintain safe posture"
        ],
        "common_substitutions": [
          "Coach Point Step Reaction",
          "Planned cone step",
          "Low-speed mirror walk"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 6,
        "minimum_hours_between_hard_exposures": 0,
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
        "fatigue_cost": 3,
        "fatigue_sensitivity": 4,
        "technical_complexity": 3,
        "impact_level": 0,
        "intensity_ceiling": "moderate"
      }
    },
    {
      "slug": "ball-drop-lateral-shuffle-catch",
      "name": "Ball Drop Lateral Shuffle Catch",
      "family": "Visual reaction lateral movement",
      "primaryPhaseKey": "movement_intelligence",
      "subrole": "perception_action_reactive_movement",
      "subroleSecondary": "agility",
      "slot": "perception_action_skill",
      "cardSummary": "Lateral reaction drill where the athlete shuffles to a dropped ball and finishes under control.",
      "bestPlacement": "Use after general warm-up and before Output, strength, or conditioning. Keep decision quality and timing crisp; stop when the athlete starts guessing.",
      "description": "Ball Drop Lateral Shuffle Catch is a neural-focused drill for visual trigger, lateral movement timing, and braking after the catch. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Perception-Action / Reactive Movement. Neural emphasis: visual trigger, lateral movement timing, and braking after the catch. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
      "tenets": [
        {
          "key": "agility",
          "weight": 5
        },
        {
          "key": "coordination",
          "weight": 4
        },
        {
          "key": "speed",
          "weight": 3
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 5
        }
      ],
      "physiology": [
        {
          "key": "perception_action_skill",
          "weight": 5
        },
        {
          "key": "neural_output_readiness",
          "weight": 4
        }
      ],
      "patterns": [
        {
          "key": "locomote",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "partner",
          "weight": 5
        },
        {
          "key": "cones",
          "weight": 2
        }
      ],
      "body_regions": [
        {
          "key": "full_body",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 4
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
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Movement Intelligence / Perception-Action / Reactive Movement because the primary adaptation is timing, perception, coordination, and body control while the nervous system is fresh.",
      "commonMisuse": "Do not turn this into conditioning, a long fatigue circuit, or a random agility game. The value is a crisp neural signal, an accurate movement answer, and a clean reset. If the athlete gets slower, louder, dizzy, or less coordinated, the set is done.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "hip_flexion_extension",
          "knee_drive",
          "ankle_stiffness",
          "arm_leg_coordination",
          "hip_knee_ankle_absorption",
          "eccentric_braking",
          "postural_stick"
        ],
        "primary_tissues": [
          "nervous_system",
          "postural_system",
          "glutes",
          "hip_flexors",
          "adductors",
          "calves",
          "achilles_tendon",
          "abdominals"
        ],
        "breathing_demand": "rhythmic",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 1
      },
      "coachingExecution": {
        "movement_description": "Perform Ball Drop Lateral Shuffle Catch as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Set cones to mark a short, clear lane or decision area.",
          "Keep distances short enough that every rep can be sharp and controlled.",
          "Demonstrate one slow rep before asking for crisp reps."
        ],
        "execution_steps": [
          "Athlete holds the start position and waits for the cue instead of guessing.",
          "Coach or partner gives one clear visual or auditory cue.",
          "Athlete makes the correct first movement, finishes the required action, and regains control.",
          "Reset fully before the next rep so attention and mechanics stay crisp."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Push the ground away.",
          "Eyes up, hips under you.",
          "Quiet contacts."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Standing tall before the first step.",
          "Crossing feet or reaching outside the base unnecessarily.",
          "Landing loud or stiff.",
          "Knees collapsing inward or feet spinning out."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "The athlete reads the cue, performs the correct action, and resets without guessing, rushing, or losing posture. Learning quality is more important than speed.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated.",
          "Contacts get loud, uncontrolled, or asymmetrical."
        ]
      },
      "dosage": {
        "volume_unit": "attempts",
        "default_sets": 2,
        "default_reps": 3,
        "default_work_seconds": 15,
        "default_rest_seconds": 60,
        "est_seconds_per_set": 75,
        "default_rpe_min": 3,
        "default_rpe_max": 6
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Active calf, Achilles, knee, or hip irritation",
        "Slippery surface or unsafe stopping area"
      ],
      "goodForSessions": [
        "general_warmup",
        "deceleration"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 1,
        "impact_level": 1,
        "requires_spotting": false,
        "requires_coach_supervision": "optional",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Active calf, Achilles, knee, or hip irritation",
          "Slippery surface or unsafe stopping area"
        ],
        "common_substitutions": [
          "Snap-Down to Athletic Stick",
          "Low-amplitude pogo",
          "March or step-to-stick alternative"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 6,
        "minimum_hours_between_hard_exposures": 0,
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
        "fatigue_cost": 3,
        "fatigue_sensitivity": 4,
        "technical_complexity": 3,
        "impact_level": 1,
        "intensity_ceiling": "moderate"
      }
    },
    {
      "slug": "reactive-med-ball-target-pass",
      "name": "Reactive Med Ball Target Pass",
      "family": "Reactive throw",
      "primaryPhaseKey": "movement_intelligence",
      "subrole": "perception_action_reactive_movement",
      "subroleSecondary": "target_selection",
      "slot": "perception_action_skill",
      "cardSummary": "Light medicine-ball passing drill that trains target recognition, trunk organization, and accurate response.",
      "bestPlacement": "Use after general warm-up and before Output, strength, or conditioning. Keep decision quality and timing crisp; stop when the athlete starts guessing.",
      "description": "Reactive Med Ball Target Pass is a neural-focused drill for target selection, trunk organization, and accurate response under a live cue. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Perception-Action / Reactive Movement. Neural emphasis: target selection, trunk organization, and accurate response under a live cue. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
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
          "key": "agility",
          "weight": 2
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 5
        },
        {
          "key": "core_body_control",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "perception_action_skill",
          "weight": 5
        },
        {
          "key": "control_stability",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "rotate",
          "weight": 5
        },
        {
          "key": "brace",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "partner",
          "weight": 2
        }
      ],
      "body_regions": [
        {
          "key": "core",
          "weight": 5
        },
        {
          "key": "shoulder",
          "weight": 4
        },
        {
          "key": "wrist",
          "weight": 3
        },
        {
          "key": "full_body",
          "weight": 2
        }
      ],
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Movement Intelligence / Perception-Action / Reactive Movement because the primary adaptation is timing, perception, coordination, and body control while the nervous system is fresh.",
      "commonMisuse": "Do not turn this into conditioning, a long fatigue circuit, or a random agility game. The value is a crisp neural signal, an accurate movement answer, and a clean reset. If the athlete gets slower, louder, dizzy, or less coordinated, the set is done.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "thoracic_rotation",
          "hip_rotation",
          "trunk_rotation_control",
          "trunk_bracing",
          "rib_pelvis_stack"
        ],
        "primary_tissues": [
          "abdominals",
          "obliques",
          "diaphragm",
          "deltoids",
          "rotator_cuff",
          "scapular_stabilizers",
          "wrist_flexors",
          "wrist_extensors"
        ],
        "breathing_demand": "rhythmic",
        "balance_demand": "stable",
        "coordination_demand": "high",
        "impact_level": 0
      },
      "coachingExecution": {
        "movement_description": "Perform Reactive Med Ball Target Pass as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Use a light medicine ball the athlete can move without strain.",
          "Set a partner, wall, or target location with enough space for a controlled reset.",
          "Demonstrate one slow rep before asking for crisp reps."
        ],
        "execution_steps": [
          "Athlete holds the start position and waits for the cue instead of guessing.",
          "Coach or partner gives one clear visual or auditory cue.",
          "Athlete makes the correct first movement, finishes the required action, and regains control.",
          "Reset fully before the next rep so attention and mechanics stay crisp."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Ribs stacked over pelvis.",
          "Move the limb without moving the trunk.",
          "Turn with control, not a twist and collapse."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Holding breath to create fake stability.",
          "Rib flare, hip shift, or spinal sag."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "The athlete reads the cue, performs the correct action, and resets without guessing, rushing, or losing posture. Learning quality is more important than speed.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated."
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 2,
        "default_reps": 5,
        "default_work_seconds": 25,
        "default_rest_seconds": 30,
        "est_seconds_per_set": 60,
        "default_rpe_min": 2,
        "default_rpe_max": 5
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Wrist or shoulder pain in support positions"
      ],
      "goodForSessions": [
        "general_warmup",
        "overhead_prep"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 1,
        "impact_level": 0,
        "requires_spotting": false,
        "requires_coach_supervision": "optional",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Wrist or shoulder pain in support positions"
        ],
        "common_substitutions": [
          "Coach Point Step Reaction",
          "Planned cone step",
          "Low-speed mirror walk"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 6,
        "minimum_hours_between_hard_exposures": 0,
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
        "fatigue_cost": 3,
        "fatigue_sensitivity": 4,
        "technical_complexity": 3,
        "impact_level": 0,
        "intensity_ceiling": "moderate"
      }
    },
    {
      "slug": "command-tap-and-go",
      "name": "Command Tap and Go",
      "family": "Command reaction",
      "primaryPhaseKey": "movement_intelligence",
      "subrole": "perception_action_reactive_movement",
      "subroleSecondary": "accelerate",
      "slot": "perception_action_skill",
      "cardSummary": "Coach-commanded tap-and-go drill that links auditory processing, touch accuracy, and short acceleration.",
      "bestPlacement": "Use after general warm-up and before Output, strength, or conditioning. Keep decision quality and timing crisp; stop when the athlete starts guessing.",
      "description": "Command Tap and Go is a neural-focused drill for auditory decision-making, target touch precision, and short burst acceleration. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Perception-Action / Reactive Movement. Neural emphasis: auditory decision-making, target touch precision, and short burst acceleration. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
      "tenets": [
        {
          "key": "coordination",
          "weight": 5
        },
        {
          "key": "speed",
          "weight": 3
        },
        {
          "key": "agility",
          "weight": 4
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 5
        }
      ],
      "physiology": [
        {
          "key": "perception_action_skill",
          "weight": 5
        },
        {
          "key": "neural_output_readiness",
          "weight": 4
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
          "key": "partner",
          "weight": 2
        }
      ],
      "body_regions": [
        {
          "key": "full_body",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 4
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
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Movement Intelligence / Perception-Action / Reactive Movement because the primary adaptation is timing, perception, coordination, and body control while the nervous system is fresh.",
      "commonMisuse": "Do not turn this into conditioning, a long fatigue circuit, or a random agility game. The value is a crisp neural signal, an accurate movement answer, and a clean reset. If the athlete gets slower, louder, dizzy, or less coordinated, the set is done.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "hip_flexion_extension",
          "knee_drive",
          "ankle_stiffness",
          "arm_leg_coordination",
          "trunk_bracing",
          "rib_pelvis_stack"
        ],
        "primary_tissues": [
          "nervous_system",
          "postural_system",
          "glutes",
          "hip_flexors",
          "adductors",
          "calves",
          "achilles_tendon",
          "abdominals"
        ],
        "breathing_demand": "rhythmic",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 1
      },
      "coachingExecution": {
        "movement_description": "Perform Command Tap and Go as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Set cones to mark a short, clear lane or decision area.",
          "Keep distances short enough that every rep can be sharp and controlled.",
          "Demonstrate one slow rep before asking for crisp reps."
        ],
        "execution_steps": [
          "Athlete holds the start position and waits for the cue instead of guessing.",
          "Coach or partner gives one clear visual or auditory cue.",
          "Athlete makes the correct first movement, finishes the required action, and regains control.",
          "Reset fully before the next rep so attention and mechanics stay crisp."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Push the ground away.",
          "Eyes up, hips under you.",
          "Ribs stacked over pelvis."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Standing tall before the first step.",
          "Crossing feet or reaching outside the base unnecessarily.",
          "Holding breath to create fake stability.",
          "Rib flare, hip shift, or spinal sag."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "The athlete reads the cue, performs the correct action, and resets without guessing, rushing, or losing posture. Learning quality is more important than speed.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated.",
          "Contacts get loud, uncontrolled, or asymmetrical."
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 2,
        "default_reps": 5,
        "default_work_seconds": 25,
        "default_rest_seconds": 30,
        "est_seconds_per_set": 60,
        "default_rpe_min": 2,
        "default_rpe_max": 5
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Active calf, Achilles, knee, or hip irritation",
        "Slippery surface or unsafe stopping area"
      ],
      "goodForSessions": [
        "sprint_prep",
        "general_warmup"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 1,
        "impact_level": 1,
        "requires_spotting": false,
        "requires_coach_supervision": "optional",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Active calf, Achilles, knee, or hip irritation",
          "Slippery surface or unsafe stopping area"
        ],
        "common_substitutions": [
          "Coach Point Step Reaction",
          "Planned cone step",
          "Low-speed mirror walk"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 6,
        "minimum_hours_between_hard_exposures": 0,
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
        "fatigue_cost": 3,
        "fatigue_sensitivity": 4,
        "technical_complexity": 3,
        "impact_level": 1,
        "intensity_ceiling": "moderate"
      }
    },
    {
      "slug": "ankling-pogo-hop",
      "name": "Ankling Pogo Hop",
      "family": "Plyometric stiffness",
      "primaryPhaseKey": "output",
      "subrole": "elastic_stiffness_plyometric_rudiments",
      "subroleSecondary": "potentiate",
      "slot": "plyometric_stiffness",
      "cardSummary": "Low-amplitude pogo drill that teaches ankle stiffness and elastic contacts without heavy fatigue.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, before heavy strength or conditioning. Keep volume low, intent high, and rest long enough for every rep to look sharp.",
      "description": "Ankling Pogo Hop is a neural-focused drill for ankle stiffness, foot reactivity, and short ground contact. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Elastic Stiffness / Plyometric Rudiments. Neural emphasis: ankle stiffness, foot reactivity, and short ground contact. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
      "tenets": [
        {
          "key": "explosiveness",
          "weight": 4
        },
        {
          "key": "coordination",
          "weight": 4
        },
        {
          "key": "speed",
          "weight": 2
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
        }
      ],
      "equipment": [
        {
          "key": "none",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "foot",
          "weight": 5
        },
        {
          "key": "ankle",
          "weight": 4
        },
        {
          "key": "full_body",
          "weight": 3
        }
      ],
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Output / Elastic Stiffness / Plyometric Rudiments because the drill expresses speed, stiffness, power, or reactive intent and requires freshness, low volume, and full recovery.",
      "commonMisuse": "Do not chase sweat or contacts. This belongs early as high-quality neural output; tired reps turn it into conditioning and erase the purpose. Keep attempts capped and rest long enough to preserve speed and mechanics.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "hip_extension",
          "knee_extension",
          "ankle_plantar_flexion",
          "hip_knee_ankle_absorption",
          "eccentric_braking",
          "postural_stick"
        ],
        "primary_tissues": [
          "foot_intrinsics",
          "plantar fascia",
          "calves",
          "achilles_tendon",
          "nervous_system",
          "postural_system"
        ],
        "breathing_demand": "controlled_between_reps",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 1
      },
      "coachingExecution": {
        "movement_description": "Perform Ankling Pogo Hop as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Use a clear, non-slippery training lane.",
          "Athlete starts in the base position with posture organized and attention on the cue.",
          "Complete general warm-up first; do not start this cold or under fatigue."
        ],
        "execution_steps": [
          "Athlete loads quietly with posture stacked and eyes forward.",
          "Athlete performs the jump, hop, contact, or drop with crisp intent.",
          "Athlete sticks, rebounds, or finishes exactly as assigned without extra contacts.",
          "Stop the set if contact sound, alignment, or rhythm degrades."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Quiet contacts.",
          "Land under your center."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Landing loud or stiff.",
          "Knees collapsing inward or feet spinning out."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "Every rep is fast, quiet, and technically repeatable with full reset between attempts. End the set when speed, contact quality, posture, or landing control drops.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated.",
          "Contacts get loud, uncontrolled, or asymmetrical.",
          "The athlete needs conditioning-style effort to keep going."
        ]
      },
      "dosage": {
        "volume_unit": "contacts",
        "default_sets": 3,
        "default_reps": 12,
        "default_work_seconds": 15,
        "default_rest_seconds": 75,
        "est_seconds_per_set": 90,
        "default_rpe_min": 3,
        "default_rpe_max": 8
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Active calf, Achilles, knee, or hip irritation",
        "Slippery surface or unsafe stopping area"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 1,
        "impact_level": 1,
        "requires_spotting": false,
        "requires_coach_supervision": "recommended",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Active calf, Achilles, knee, or hip irritation",
          "Slippery surface or unsafe stopping area"
        ],
        "common_substitutions": [
          "Snap-Down to Athletic Stick",
          "Low-amplitude pogo",
          "March or step-to-stick alternative"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 6,
        "minimum_hours_between_hard_exposures": 0,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": false,
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
        "impact_level": 1,
        "intensity_ceiling": "high"
      }
    },
    {
      "slug": "single-leg-pogo-hold-stick",
      "name": "Single-Leg Pogo Hold-Stick",
      "family": "Plyometric stiffness",
      "primaryPhaseKey": "output",
      "subrole": "elastic_stiffness_plyometric_rudiments",
      "subroleSecondary": "land_control",
      "slot": "plyometric_stiffness",
      "cardSummary": "Single-leg low pogo followed by a frozen stick to connect elastic contacts with balance control.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, before heavy strength or conditioning. Keep volume low, intent high, and rest long enough for every rep to look sharp.",
      "description": "Single-Leg Pogo Hold-Stick is a neural-focused drill for single-leg foot stiffness, ankle proprioception, and controlled landing ownership. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Elastic Stiffness / Plyometric Rudiments. Neural emphasis: single-leg foot stiffness, ankle proprioception, and controlled landing ownership. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
      "tenets": [
        {
          "key": "explosiveness",
          "weight": 4
        },
        {
          "key": "balance",
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 4
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
          "key": "balance_stability",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "control_stability",
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
        }
      ],
      "equipment": [
        {
          "key": "none",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "foot",
          "weight": 5
        },
        {
          "key": "ankle",
          "weight": 4
        },
        {
          "key": "knee",
          "weight": 3
        },
        {
          "key": "hip",
          "weight": 2
        }
      ],
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Output / Elastic Stiffness / Plyometric Rudiments because the drill expresses speed, stiffness, power, or reactive intent and requires freshness, low volume, and full recovery.",
      "commonMisuse": "Do not chase sweat or contacts. This belongs early as high-quality neural output; tired reps turn it into conditioning and erase the purpose. Keep attempts capped and rest long enough to preserve speed and mechanics.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "hip_extension",
          "knee_extension",
          "ankle_plantar_flexion",
          "hip_knee_ankle_absorption",
          "eccentric_braking",
          "postural_stick"
        ],
        "primary_tissues": [
          "foot_intrinsics",
          "plantar fascia",
          "calves",
          "achilles_tendon",
          "quadriceps",
          "patellar_tendon",
          "glutes",
          "hip_flexors"
        ],
        "breathing_demand": "controlled_between_reps",
        "balance_demand": "single_leg_or_dynamic",
        "coordination_demand": "high",
        "impact_level": 2
      },
      "coachingExecution": {
        "movement_description": "Perform Single-Leg Pogo Hold-Stick as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Use a clear, non-slippery training lane.",
          "Athlete starts in the base position with posture organized and attention on the cue.",
          "Complete general warm-up first; do not start this cold or under fatigue."
        ],
        "execution_steps": [
          "Athlete loads quietly with posture stacked and eyes forward.",
          "Athlete performs the jump, hop, contact, or drop with crisp intent.",
          "Athlete sticks, rebounds, or finishes exactly as assigned without extra contacts.",
          "Stop the set if contact sound, alignment, or rhythm degrades."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Quiet contacts.",
          "Land under your center."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Landing loud or stiff.",
          "Knees collapsing inward or feet spinning out."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "Every rep is fast, quiet, and technically repeatable with full reset between attempts. End the set when speed, contact quality, posture, or landing control drops.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated.",
          "Contacts get loud, uncontrolled, or asymmetrical.",
          "The athlete needs conditioning-style effort to keep going."
        ]
      },
      "dosage": {
        "volume_unit": "contacts",
        "default_sets": 3,
        "default_reps": 12,
        "default_work_seconds": 15,
        "default_rest_seconds": 75,
        "est_seconds_per_set": 90,
        "default_rpe_min": 3,
        "default_rpe_max": 8
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Poor landing control or pain with impact",
        "Knee, ankle, or hip symptoms during jumping or cutting"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 2,
        "impact_level": 2,
        "requires_spotting": false,
        "requires_coach_supervision": "recommended",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Poor landing control or pain with impact",
          "Knee, ankle, or hip symptoms during jumping or cutting"
        ],
        "common_substitutions": [
          "Snap-Down to Athletic Stick",
          "Low-amplitude pogo",
          "March or step-to-stick alternative"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 4,
        "minimum_hours_between_hard_exposures": 24,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": false,
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
        "impact_level": 2,
        "intensity_ceiling": "high"
      }
    },
    {
      "slug": "snap-down-to-athletic-stick",
      "name": "Snap-Down to Athletic Stick",
      "family": "Landing mechanics",
      "primaryPhaseKey": "output",
      "subrole": "jump_throw_explosive_power",
      "subroleSecondary": "landing_control",
      "slot": "landing_skill",
      "cardSummary": "Fast arm-and-hip snap into an athletic base that teaches landing posture before jumping and cutting.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, before heavy strength or conditioning. Keep volume low, intent high, and rest long enough for every rep to look sharp.",
      "description": "Snap-Down to Athletic Stick is a neural-focused drill for reflexive bracing, hip loading, and quiet landing posture. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Jump / Throw Explosive Power. Neural emphasis: reflexive bracing, hip loading, and quiet landing posture. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
      "tenets": [
        {
          "key": "explosiveness",
          "weight": 3
        },
        {
          "key": "body_control",
          "weight": 5
        },
        {
          "key": "coordination",
          "weight": 4
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 5
        },
        {
          "key": "plyometrics",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "neural_output_readiness",
          "weight": 4
        },
        {
          "key": "control_stability",
          "weight": 5
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
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "none",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "full_body",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 4
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
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Output / Jump / Throw Explosive Power because the drill expresses speed, stiffness, power, or reactive intent and requires freshness, low volume, and full recovery.",
      "commonMisuse": "Do not chase sweat or contacts. This belongs early as high-quality neural output; tired reps turn it into conditioning and erase the purpose. Keep attempts capped and rest long enough to preserve speed and mechanics.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "hip_extension",
          "knee_extension",
          "ankle_plantar_flexion",
          "hip_knee_ankle_absorption",
          "eccentric_braking",
          "postural_stick",
          "trunk_bracing",
          "rib_pelvis_stack"
        ],
        "primary_tissues": [
          "nervous_system",
          "postural_system",
          "glutes",
          "hip_flexors",
          "adductors",
          "quadriceps",
          "patellar_tendon",
          "calves"
        ],
        "breathing_demand": "controlled_between_reps",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 1
      },
      "coachingExecution": {
        "movement_description": "Perform Snap-Down to Athletic Stick as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Use a clear, non-slippery training lane.",
          "Athlete starts in the base position with posture organized and attention on the cue.",
          "Complete general warm-up first; do not start this cold or under fatigue."
        ],
        "execution_steps": [
          "Athlete loads quietly with posture stacked and eyes forward.",
          "Athlete performs the jump, hop, contact, or drop with crisp intent.",
          "Athlete sticks, rebounds, or finishes exactly as assigned without extra contacts.",
          "Stop the set if contact sound, alignment, or rhythm degrades."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Quiet contacts.",
          "Land under your center.",
          "Ribs stacked over pelvis."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Landing loud or stiff.",
          "Knees collapsing inward or feet spinning out.",
          "Holding breath to create fake stability.",
          "Rib flare, hip shift, or spinal sag."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "Every rep is fast, quiet, and technically repeatable with full reset between attempts. End the set when speed, contact quality, posture, or landing control drops.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated.",
          "Contacts get loud, uncontrolled, or asymmetrical.",
          "The athlete needs conditioning-style effort to keep going."
        ]
      },
      "dosage": {
        "volume_unit": "attempts",
        "default_sets": 3,
        "default_reps": 3,
        "default_work_seconds": 15,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 105,
        "default_rpe_min": 3,
        "default_rpe_max": 8
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Active calf, Achilles, knee, or hip irritation",
        "Slippery surface or unsafe stopping area"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 1,
        "impact_level": 1,
        "requires_spotting": false,
        "requires_coach_supervision": "recommended",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Active calf, Achilles, knee, or hip irritation",
          "Slippery surface or unsafe stopping area"
        ],
        "common_substitutions": [
          "Snap-Down to Athletic Stick",
          "Low-amplitude pogo",
          "March or step-to-stick alternative"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 6,
        "minimum_hours_between_hard_exposures": 0,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": false,
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
        "impact_level": 1,
        "intensity_ceiling": "high"
      }
    },
    {
      "slug": "countermovement-jump-to-stick",
      "name": "Countermovement Jump to Stick",
      "family": "Plyometric power",
      "primaryPhaseKey": "output",
      "subrole": "jump_throw_explosive_power",
      "subroleSecondary": "land_control",
      "slot": "plyometric_potentiation",
      "cardSummary": "Vertical jump with a frozen landing that trains fast takeoff while preserving landing control.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, before heavy strength or conditioning. Keep volume low, intent high, and rest long enough for every rep to look sharp.",
      "description": "Countermovement Jump to Stick is a neural-focused drill for rate of force expression, arm swing timing, and landing integrity. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Jump / Throw Explosive Power. Neural emphasis: rate of force expression, arm swing timing, and landing integrity. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
      "tenets": [
        {
          "key": "explosiveness",
          "weight": 5
        },
        {
          "key": "coordination",
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 4
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
          "weight": 5
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
        }
      ],
      "equipment": [
        {
          "key": "none",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "full_body",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 4
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
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Output / Jump / Throw Explosive Power because the drill expresses speed, stiffness, power, or reactive intent and requires freshness, low volume, and full recovery.",
      "commonMisuse": "Do not chase sweat or contacts. This belongs early as high-quality neural output; tired reps turn it into conditioning and erase the purpose. Keep attempts capped and rest long enough to preserve speed and mechanics.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "hip_extension",
          "knee_extension",
          "ankle_plantar_flexion",
          "hip_knee_ankle_absorption",
          "eccentric_braking",
          "postural_stick"
        ],
        "primary_tissues": [
          "nervous_system",
          "postural_system",
          "glutes",
          "hip_flexors",
          "adductors",
          "quadriceps",
          "patellar_tendon",
          "calves"
        ],
        "breathing_demand": "controlled_between_reps",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 2
      },
      "coachingExecution": {
        "movement_description": "Perform Countermovement Jump to Stick as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Use a clear, non-slippery training lane.",
          "Athlete starts in the base position with posture organized and attention on the cue.",
          "Complete general warm-up first; do not start this cold or under fatigue."
        ],
        "execution_steps": [
          "Athlete loads quietly with posture stacked and eyes forward.",
          "Athlete performs the jump, hop, contact, or drop with crisp intent.",
          "Athlete sticks, rebounds, or finishes exactly as assigned without extra contacts.",
          "Stop the set if contact sound, alignment, or rhythm degrades."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Quiet contacts.",
          "Land under your center."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Landing loud or stiff.",
          "Knees collapsing inward or feet spinning out."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "Every rep is fast, quiet, and technically repeatable with full reset between attempts. End the set when speed, contact quality, posture, or landing control drops.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated.",
          "Contacts get loud, uncontrolled, or asymmetrical.",
          "The athlete needs conditioning-style effort to keep going."
        ]
      },
      "dosage": {
        "volume_unit": "attempts",
        "default_sets": 3,
        "default_reps": 3,
        "default_work_seconds": 15,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 105,
        "default_rpe_min": 3,
        "default_rpe_max": 8
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Poor landing control or pain with impact",
        "Knee, ankle, or hip symptoms during jumping or cutting"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 2,
        "impact_level": 2,
        "requires_spotting": false,
        "requires_coach_supervision": "recommended",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Poor landing control or pain with impact",
          "Knee, ankle, or hip symptoms during jumping or cutting"
        ],
        "common_substitutions": [
          "Snap-Down to Athletic Stick",
          "Low-amplitude pogo",
          "March or step-to-stick alternative"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 4,
        "minimum_hours_between_hard_exposures": 24,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": false,
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
        "impact_level": 2,
        "intensity_ceiling": "high"
      }
    },
    {
      "slug": "broad-jump-to-stick",
      "name": "Broad Jump to Stick",
      "family": "Plyometric power",
      "primaryPhaseKey": "output",
      "subrole": "jump_throw_explosive_power",
      "subroleSecondary": "land_control",
      "slot": "plyometric_potentiation",
      "cardSummary": "Horizontal jump with a controlled stick to train projection, hip power, and deceleration ownership.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, before heavy strength or conditioning. Keep volume low, intent high, and rest long enough for every rep to look sharp.",
      "description": "Broad Jump to Stick is a neural-focused drill for horizontal force, hip extension, and landing deceleration. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Jump / Throw Explosive Power. Neural emphasis: horizontal force, hip extension, and landing deceleration. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
      "tenets": [
        {
          "key": "explosiveness",
          "weight": 5
        },
        {
          "key": "coordination",
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 4
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
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "none",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "full_body",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 4
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
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Output / Jump / Throw Explosive Power because the drill expresses speed, stiffness, power, or reactive intent and requires freshness, low volume, and full recovery.",
      "commonMisuse": "Do not chase sweat or contacts. This belongs early as high-quality neural output; tired reps turn it into conditioning and erase the purpose. Keep attempts capped and rest long enough to preserve speed and mechanics.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "hip_extension",
          "knee_extension",
          "ankle_plantar_flexion",
          "hip_knee_ankle_absorption",
          "eccentric_braking",
          "postural_stick"
        ],
        "primary_tissues": [
          "nervous_system",
          "postural_system",
          "glutes",
          "hip_flexors",
          "adductors",
          "quadriceps",
          "patellar_tendon",
          "calves"
        ],
        "breathing_demand": "controlled_between_reps",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 2
      },
      "coachingExecution": {
        "movement_description": "Perform Broad Jump to Stick as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Use a clear, non-slippery training lane.",
          "Athlete starts in the base position with posture organized and attention on the cue.",
          "Complete general warm-up first; do not start this cold or under fatigue."
        ],
        "execution_steps": [
          "Athlete loads quietly with posture stacked and eyes forward.",
          "Athlete performs the jump, hop, contact, or drop with crisp intent.",
          "Athlete sticks, rebounds, or finishes exactly as assigned without extra contacts.",
          "Stop the set if contact sound, alignment, or rhythm degrades."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Quiet contacts.",
          "Land under your center."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Landing loud or stiff.",
          "Knees collapsing inward or feet spinning out."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "Every rep is fast, quiet, and technically repeatable with full reset between attempts. End the set when speed, contact quality, posture, or landing control drops.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated.",
          "Contacts get loud, uncontrolled, or asymmetrical.",
          "The athlete needs conditioning-style effort to keep going."
        ]
      },
      "dosage": {
        "volume_unit": "attempts",
        "default_sets": 3,
        "default_reps": 3,
        "default_work_seconds": 15,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 105,
        "default_rpe_min": 3,
        "default_rpe_max": 8
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Poor landing control or pain with impact",
        "Knee, ankle, or hip symptoms during jumping or cutting"
      ],
      "goodForSessions": [
        "landing_prep",
        "sprint_prep"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 2,
        "impact_level": 2,
        "requires_spotting": false,
        "requires_coach_supervision": "recommended",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Poor landing control or pain with impact",
          "Knee, ankle, or hip symptoms during jumping or cutting"
        ],
        "common_substitutions": [
          "Snap-Down to Athletic Stick",
          "Low-amplitude pogo",
          "March or step-to-stick alternative"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 4,
        "minimum_hours_between_hard_exposures": 24,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": false,
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
        "impact_level": 2,
        "intensity_ceiling": "high"
      }
    },
    {
      "slug": "low-box-drop-to-vertical-rebound",
      "name": "Low Box Drop to Vertical Rebound",
      "family": "Reactive plyometric",
      "primaryPhaseKey": "output",
      "subrole": "elastic_stiffness_plyometric_rudiments",
      "subroleSecondary": "jump_power",
      "slot": "plyometric_potentiation",
      "cardSummary": "Low drop into an immediate vertical rebound that trains reactive stiffness when landing mechanics are already owned.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, before heavy strength or conditioning. Keep volume low, intent high, and rest long enough for every rep to look sharp.",
      "description": "Low Box Drop to Vertical Rebound is a neural-focused drill for elastic rebound timing, contact stiffness, and safe reactive transition. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Elastic Stiffness / Plyometric Rudiments. Neural emphasis: elastic rebound timing, contact stiffness, and safe reactive transition. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
      "tenets": [
        {
          "key": "explosiveness",
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
          "key": "neural_output_readiness",
          "weight": 5
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
          "key": "full_body",
          "weight": 5
        },
        {
          "key": "foot",
          "weight": 4
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
        }
      ],
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Output / Elastic Stiffness / Plyometric Rudiments because the drill expresses speed, stiffness, power, or reactive intent and requires freshness, low volume, and full recovery.",
      "commonMisuse": "Do not chase sweat or contacts. This belongs early as high-quality neural output; tired reps turn it into conditioning and erase the purpose. Keep attempts capped and rest long enough to preserve speed and mechanics.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "hip_extension",
          "knee_extension",
          "ankle_plantar_flexion",
          "hip_knee_ankle_absorption",
          "eccentric_braking",
          "postural_stick"
        ],
        "primary_tissues": [
          "nervous_system",
          "postural_system",
          "foot_intrinsics",
          "plantar fascia",
          "calves",
          "achilles_tendon",
          "quadriceps",
          "patellar_tendon"
        ],
        "breathing_demand": "controlled_between_reps",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 3
      },
      "coachingExecution": {
        "movement_description": "Perform Low Box Drop to Vertical Rebound as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Use a low, stable box appropriate for the athlete's landing skill.",
          "Confirm the landing area is clear, flat, and non-slippery.",
          "Complete general warm-up first; do not start this cold or under fatigue."
        ],
        "execution_steps": [
          "Athlete holds the start position and waits for the cue instead of guessing.",
          "Coach or partner gives one clear visual or auditory cue.",
          "Athlete makes the correct first movement, finishes the required action, and regains control.",
          "Reset fully before the next rep so attention and mechanics stay crisp."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Quiet contacts.",
          "Land under your center."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Landing loud or stiff.",
          "Knees collapsing inward or feet spinning out."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "Every rep is fast, quiet, and technically repeatable with full reset between attempts. End the set when speed, contact quality, posture, or landing control drops.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated.",
          "Contacts get loud, uncontrolled, or asymmetrical.",
          "The athlete needs conditioning-style effort to keep going."
        ]
      },
      "dosage": {
        "volume_unit": "attempts",
        "default_sets": 3,
        "default_reps": 3,
        "default_work_seconds": 15,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 105,
        "default_rpe_min": 3,
        "default_rpe_max": 8
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Poor landing control or pain with impact",
        "Knee, ankle, or hip symptoms during jumping or cutting"
      ],
      "goodForSessions": [
        "landing_prep"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 3,
        "impact_level": 3,
        "requires_spotting": false,
        "requires_coach_supervision": "recommended",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Poor landing control or pain with impact",
          "Knee, ankle, or hip symptoms during jumping or cutting"
        ],
        "common_substitutions": [
          "Snap-Down to Athletic Stick",
          "Low-amplitude pogo",
          "March or step-to-stick alternative"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 3,
        "minimum_hours_between_hard_exposures": 36,
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
      }
    },
    {
      "slug": "skater-bound-to-stick",
      "name": "Skater Bound to Stick",
      "family": "Lateral power and landing",
      "primaryPhaseKey": "output",
      "subrole": "deceleration_cod_power",
      "subroleSecondary": "land_control",
      "slot": "lateral_bound_power",
      "cardSummary": "Lateral bound with a frozen landing that builds frontal-plane power and single-leg braking control.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, before heavy strength or conditioning. Keep volume low, intent high, and rest long enough for every rep to look sharp.",
      "description": "Skater Bound to Stick is a neural-focused drill for lateral projection, single-leg deceleration, and hip-knee-foot alignment. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Deceleration / COD Power. Neural emphasis: lateral projection, single-leg deceleration, and hip-knee-foot alignment. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
      "tenets": [
        {
          "key": "explosiveness",
          "weight": 4
        },
        {
          "key": "agility",
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 4
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
          "key": "balance_stability",
          "weight": 2
        }
      ],
      "physiology": [
        {
          "key": "neural_output_readiness",
          "weight": 5
        },
        {
          "key": "control_stability",
          "weight": 4
        },
        {
          "key": "ssc_stiffness",
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
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "none",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "foot",
          "weight": 5
        },
        {
          "key": "ankle",
          "weight": 4
        },
        {
          "key": "knee",
          "weight": 3
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
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Output / Deceleration / COD Power because the drill expresses speed, stiffness, power, or reactive intent and requires freshness, low volume, and full recovery.",
      "commonMisuse": "Do not chase sweat or contacts. This belongs early as high-quality neural output; tired reps turn it into conditioning and erase the purpose. Keep attempts capped and rest long enough to preserve speed and mechanics.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "hip_extension",
          "knee_extension",
          "ankle_plantar_flexion",
          "hip_knee_ankle_absorption",
          "eccentric_braking",
          "postural_stick",
          "hip_flexion_extension",
          "knee_drive"
        ],
        "primary_tissues": [
          "foot_intrinsics",
          "plantar fascia",
          "calves",
          "achilles_tendon",
          "quadriceps",
          "patellar_tendon",
          "glutes",
          "hip_flexors"
        ],
        "breathing_demand": "controlled_between_reps",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 2
      },
      "coachingExecution": {
        "movement_description": "Perform Skater Bound to Stick as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Use a clear, non-slippery training lane.",
          "Athlete starts in the base position with posture organized and attention on the cue.",
          "Complete general warm-up first; do not start this cold or under fatigue."
        ],
        "execution_steps": [
          "Athlete loads quietly with posture stacked and eyes forward.",
          "Athlete performs the jump, hop, contact, or drop with crisp intent.",
          "Athlete sticks, rebounds, or finishes exactly as assigned without extra contacts.",
          "Stop the set if contact sound, alignment, or rhythm degrades."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Push the ground away.",
          "Eyes up, hips under you.",
          "Quiet contacts."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Standing tall before the first step.",
          "Crossing feet or reaching outside the base unnecessarily.",
          "Landing loud or stiff.",
          "Knees collapsing inward or feet spinning out."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "Every rep is fast, quiet, and technically repeatable with full reset between attempts. End the set when speed, contact quality, posture, or landing control drops.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated.",
          "Contacts get loud, uncontrolled, or asymmetrical.",
          "The athlete needs conditioning-style effort to keep going."
        ]
      },
      "dosage": {
        "volume_unit": "attempts",
        "default_sets": 3,
        "default_reps": 3,
        "default_work_seconds": 15,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 105,
        "default_rpe_min": 3,
        "default_rpe_max": 8
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Poor landing control or pain with impact",
        "Knee, ankle, or hip symptoms during jumping or cutting"
      ],
      "goodForSessions": [
        "landing_prep",
        "deceleration"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 2,
        "impact_level": 2,
        "requires_spotting": false,
        "requires_coach_supervision": "recommended",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Poor landing control or pain with impact",
          "Knee, ankle, or hip symptoms during jumping or cutting"
        ],
        "common_substitutions": [
          "Snap-Down to Athletic Stick",
          "Low-amplitude pogo",
          "March or step-to-stick alternative"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 4,
        "minimum_hours_between_hard_exposures": 24,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": false,
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
        "impact_level": 2,
        "intensity_ceiling": "high"
      }
    },
    {
      "slug": "hop-hop-stick-multi-directional",
      "name": "Hop-Hop-Stick Multi-Directional",
      "family": "Reactive landing control",
      "primaryPhaseKey": "output",
      "subrole": "deceleration_cod_power",
      "subroleSecondary": "coordinate",
      "slot": "deceleration_skill",
      "cardSummary": "Two quick hops followed by a frozen landing to train repeat contact and braking in multiple directions.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, before heavy strength or conditioning. Keep volume low, intent high, and rest long enough for every rep to look sharp.",
      "description": "Hop-Hop-Stick Multi-Directional is a neural-focused drill for multi-directional foot stiffness, proprioception, and landing control. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Deceleration / COD Power. Neural emphasis: multi-directional foot stiffness, proprioception, and landing control. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
      "tenets": [
        {
          "key": "agility",
          "weight": 4
        },
        {
          "key": "coordination",
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 4
        }
      ],
      "methodologies": [
        {
          "key": "plyometrics",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 5
        }
      ],
      "physiology": [
        {
          "key": "neural_output_readiness",
          "weight": 5
        },
        {
          "key": "control_stability",
          "weight": 4
        },
        {
          "key": "ssc_stiffness",
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
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "none",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "foot",
          "weight": 5
        },
        {
          "key": "ankle",
          "weight": 4
        },
        {
          "key": "knee",
          "weight": 3
        },
        {
          "key": "hip",
          "weight": 2
        }
      ],
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Output / Deceleration / COD Power because the drill expresses speed, stiffness, power, or reactive intent and requires freshness, low volume, and full recovery.",
      "commonMisuse": "Do not chase sweat or contacts. This belongs early as high-quality neural output; tired reps turn it into conditioning and erase the purpose. Keep attempts capped and rest long enough to preserve speed and mechanics.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "hip_extension",
          "knee_extension",
          "ankle_plantar_flexion",
          "hip_knee_ankle_absorption",
          "eccentric_braking",
          "postural_stick",
          "hip_flexion_extension",
          "knee_drive"
        ],
        "primary_tissues": [
          "foot_intrinsics",
          "plantar fascia",
          "calves",
          "achilles_tendon",
          "quadriceps",
          "patellar_tendon",
          "glutes",
          "hip_flexors"
        ],
        "breathing_demand": "controlled_between_reps",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 2
      },
      "coachingExecution": {
        "movement_description": "Perform Hop-Hop-Stick Multi-Directional as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Use a clear, non-slippery training lane.",
          "Athlete starts in the base position with posture organized and attention on the cue.",
          "Complete general warm-up first; do not start this cold or under fatigue."
        ],
        "execution_steps": [
          "Athlete loads quietly with posture stacked and eyes forward.",
          "Athlete performs the jump, hop, contact, or drop with crisp intent.",
          "Athlete sticks, rebounds, or finishes exactly as assigned without extra contacts.",
          "Stop the set if contact sound, alignment, or rhythm degrades."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Push the ground away.",
          "Eyes up, hips under you.",
          "Quiet contacts."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Standing tall before the first step.",
          "Crossing feet or reaching outside the base unnecessarily.",
          "Landing loud or stiff.",
          "Knees collapsing inward or feet spinning out."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "Every rep is fast, quiet, and technically repeatable with full reset between attempts. End the set when speed, contact quality, posture, or landing control drops.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated.",
          "Contacts get loud, uncontrolled, or asymmetrical.",
          "The athlete needs conditioning-style effort to keep going."
        ]
      },
      "dosage": {
        "volume_unit": "attempts",
        "default_sets": 3,
        "default_reps": 3,
        "default_work_seconds": 15,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 105,
        "default_rpe_min": 3,
        "default_rpe_max": 8
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Poor landing control or pain with impact",
        "Knee, ankle, or hip symptoms during jumping or cutting"
      ],
      "goodForSessions": [
        "landing_prep",
        "deceleration"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 2,
        "impact_level": 2,
        "requires_spotting": false,
        "requires_coach_supervision": "recommended",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Poor landing control or pain with impact",
          "Knee, ankle, or hip symptoms during jumping or cutting"
        ],
        "common_substitutions": [
          "Snap-Down to Athletic Stick",
          "Low-amplitude pogo",
          "March or step-to-stick alternative"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 4,
        "minimum_hours_between_hard_exposures": 24,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": false,
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
        "impact_level": 2,
        "intensity_ceiling": "high"
      }
    },
    {
      "slug": "mini-hurdle-wicket-rhythm-run",
      "name": "Mini-Hurdle Wicket Rhythm Run",
      "family": "Sprint rhythm exposure",
      "primaryPhaseKey": "output",
      "subrole": "max_velocity_exposure",
      "subroleSecondary": "rhythm",
      "slot": "max_velocity_rhythm",
      "cardSummary": "Low-volume rhythm run through small wickets or cone spaces to sharpen upright sprint timing.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, before heavy strength or conditioning. Keep volume low, intent high, and rest long enough for every rep to look sharp.",
      "description": "Mini-Hurdle Wicket Rhythm Run is a neural-focused drill for upright sprint rhythm, front-side mechanics, and ground contact timing. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Max Velocity Exposure. Neural emphasis: upright sprint rhythm, front-side mechanics, and ground contact timing. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
      "tenets": [
        {
          "key": "speed",
          "weight": 5
        },
        {
          "key": "coordination",
          "weight": 4
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 5
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
          "weight": 4
        }
      ],
      "patterns": [
        {
          "key": "locomote",
          "weight": 5
        }
      ],
      "equipment": [
        {
          "key": "cones",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "full_body",
          "weight": 5
        },
        {
          "key": "foot",
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        },
        {
          "key": "hip",
          "weight": 2
        }
      ],
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Output / Max Velocity Exposure because the drill expresses speed, stiffness, power, or reactive intent and requires freshness, low volume, and full recovery.",
      "commonMisuse": "Do not chase sweat or contacts. This belongs early as high-quality neural output; tired reps turn it into conditioning and erase the purpose. Keep attempts capped and rest long enough to preserve speed and mechanics.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "hip_flexion_extension",
          "knee_drive",
          "ankle_stiffness",
          "arm_leg_coordination"
        ],
        "primary_tissues": [
          "nervous_system",
          "postural_system",
          "foot_intrinsics",
          "plantar fascia",
          "calves",
          "achilles_tendon",
          "glutes",
          "hip_flexors"
        ],
        "breathing_demand": "controlled_between_reps",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 1
      },
      "coachingExecution": {
        "movement_description": "Perform Mini-Hurdle Wicket Rhythm Run as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Set cones to mark a short, clear lane or decision area.",
          "Keep distances short enough that every rep can be sharp and controlled.",
          "Complete general warm-up first; do not start this cold or under fatigue."
        ],
        "execution_steps": [
          "Athlete starts organized and attentive.",
          "Perform the pattern at the assigned rhythm or speed.",
          "Own the finish position before the next repetition.",
          "Stop before fatigue changes timing, posture, or coordination."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Push the ground away.",
          "Eyes up, hips under you."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Standing tall before the first step.",
          "Crossing feet or reaching outside the base unnecessarily."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "Every rep is fast, quiet, and technically repeatable with full reset between attempts. End the set when speed, contact quality, posture, or landing control drops.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated.",
          "Contacts get loud, uncontrolled, or asymmetrical.",
          "The athlete needs conditioning-style effort to keep going."
        ]
      },
      "dosage": {
        "volume_unit": "attempts",
        "default_sets": 3,
        "default_reps": 3,
        "default_work_seconds": 8,
        "default_rest_seconds": 75,
        "est_seconds_per_set": 90,
        "default_rpe_min": 5,
        "default_rpe_max": 8
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Active calf, Achilles, knee, or hip irritation",
        "Slippery surface or unsafe stopping area"
      ],
      "goodForSessions": [
        "sprint_prep"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 1,
        "impact_level": 1,
        "requires_spotting": false,
        "requires_coach_supervision": "recommended",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Active calf, Achilles, knee, or hip irritation",
          "Slippery surface or unsafe stopping area"
        ],
        "common_substitutions": [
          "A-March Linear",
          "Supported balance reach",
          "Low-speed planned version"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 6,
        "minimum_hours_between_hard_exposures": 0,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": false,
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
        "impact_level": 1,
        "intensity_ceiling": "high"
      }
    },
    {
      "slug": "sprint-float-sprint-build-up",
      "name": "Sprint-Float-Sprint Build-Up",
      "family": "Speed rhythm exposure",
      "primaryPhaseKey": "output",
      "subrole": "max_velocity_exposure",
      "subroleSecondary": "speed_potentiation",
      "slot": "max_velocity_exposure",
      "cardSummary": "Short sprint rhythm exposure that alternates fast, relaxed, and fast zones without creating fatigue.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, before heavy strength or conditioning. Keep volume low, intent high, and rest long enough for every rep to look sharp.",
      "description": "Sprint-Float-Sprint Build-Up is a neural-focused drill for speed relaxation, posture preservation, and controlled re-acceleration. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Max Velocity Exposure. Neural emphasis: speed relaxation, posture preservation, and controlled re-acceleration. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
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
          "key": "body_control",
          "weight": 2
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 5
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
        }
      ],
      "patterns": [
        {
          "key": "locomote",
          "weight": 5
        }
      ],
      "equipment": [
        {
          "key": "cones",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "full_body",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 4
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
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Output / Max Velocity Exposure because the drill expresses speed, stiffness, power, or reactive intent and requires freshness, low volume, and full recovery.",
      "commonMisuse": "Do not chase sweat or contacts. This belongs early as high-quality neural output; tired reps turn it into conditioning and erase the purpose. Keep attempts capped and rest long enough to preserve speed and mechanics.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "hip_flexion_extension",
          "knee_drive",
          "ankle_stiffness",
          "arm_leg_coordination"
        ],
        "primary_tissues": [
          "nervous_system",
          "postural_system",
          "glutes",
          "hip_flexors",
          "adductors",
          "calves",
          "achilles_tendon",
          "foot_intrinsics"
        ],
        "breathing_demand": "controlled_between_reps",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 1
      },
      "coachingExecution": {
        "movement_description": "Perform Sprint-Float-Sprint Build-Up as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Set cones to mark a short, clear lane or decision area.",
          "Keep distances short enough that every rep can be sharp and controlled.",
          "Complete general warm-up first; do not start this cold or under fatigue."
        ],
        "execution_steps": [
          "Athlete starts organized and attentive.",
          "Perform the pattern at the assigned rhythm or speed.",
          "Own the finish position before the next repetition.",
          "Stop before fatigue changes timing, posture, or coordination."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Push the ground away.",
          "Eyes up, hips under you."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Standing tall before the first step.",
          "Crossing feet or reaching outside the base unnecessarily."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "Every rep is fast, quiet, and technically repeatable with full reset between attempts. End the set when speed, contact quality, posture, or landing control drops.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated.",
          "Contacts get loud, uncontrolled, or asymmetrical.",
          "The athlete needs conditioning-style effort to keep going."
        ]
      },
      "dosage": {
        "volume_unit": "attempts",
        "default_sets": 3,
        "default_reps": 3,
        "default_work_seconds": 8,
        "default_rest_seconds": 75,
        "est_seconds_per_set": 90,
        "default_rpe_min": 5,
        "default_rpe_max": 8
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Active calf, Achilles, knee, or hip irritation",
        "Slippery surface or unsafe stopping area",
        "Unprepared hamstring or calf tissue",
        "Crowded lane or unsafe stopping distance"
      ],
      "goodForSessions": [
        "sprint_prep"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 2,
        "impact_level": 1,
        "requires_spotting": false,
        "requires_coach_supervision": "recommended",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Active calf, Achilles, knee, or hip irritation",
          "Slippery surface or unsafe stopping area",
          "Unprepared hamstring or calf tissue",
          "Crowded lane or unsafe stopping distance"
        ],
        "common_substitutions": [
          "A-March Linear",
          "Supported balance reach",
          "Low-speed planned version"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 6,
        "minimum_hours_between_hard_exposures": 0,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": false,
        "counts_as_neural": true,
        "counts_as_tissue_stress": false,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 4,
        "impact_level": 1,
        "intensity_ceiling": "high"
      }
    },
    {
      "slug": "falling-start-to-10-yards",
      "name": "Falling Start to 10 Yards",
      "family": "Acceleration mechanics",
      "primaryPhaseKey": "output",
      "subrole": "acceleration_start_speed",
      "subroleSecondary": "potentiate",
      "slot": "acceleration_prep",
      "cardSummary": "Simple acceleration start that uses a controlled fall to cue projection and first-step intent.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, before heavy strength or conditioning. Keep volume low, intent high, and rest long enough for every rep to look sharp.",
      "description": "Falling Start to 10 Yards is a neural-focused drill for projection angle, first-step stiffness, and acceleration intent. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Acceleration Start Speed. Neural emphasis: projection angle, first-step stiffness, and acceleration intent. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
      "tenets": [
        {
          "key": "speed",
          "weight": 5
        },
        {
          "key": "explosiveness",
          "weight": 4
        },
        {
          "key": "coordination",
          "weight": 4
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 5
        }
      ],
      "physiology": [
        {
          "key": "neural_output_readiness",
          "weight": 5
        }
      ],
      "patterns": [
        {
          "key": "locomote",
          "weight": 5
        }
      ],
      "equipment": [
        {
          "key": "none",
          "weight": 5
        },
        {
          "key": "cones",
          "weight": 2
        }
      ],
      "body_regions": [
        {
          "key": "full_body",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 4
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
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Output / Acceleration Start Speed because the drill expresses speed, stiffness, power, or reactive intent and requires freshness, low volume, and full recovery.",
      "commonMisuse": "Do not chase sweat or contacts. This belongs early as high-quality neural output; tired reps turn it into conditioning and erase the purpose. Keep attempts capped and rest long enough to preserve speed and mechanics.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "hip_flexion_extension",
          "knee_drive",
          "ankle_stiffness",
          "arm_leg_coordination"
        ],
        "primary_tissues": [
          "nervous_system",
          "postural_system",
          "glutes",
          "hip_flexors",
          "adductors",
          "calves",
          "achilles_tendon",
          "foot_intrinsics"
        ],
        "breathing_demand": "controlled_between_reps",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 1
      },
      "coachingExecution": {
        "movement_description": "Perform Falling Start to 10 Yards as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Set cones to mark a short, clear lane or decision area.",
          "Keep distances short enough that every rep can be sharp and controlled.",
          "Complete general warm-up first; do not start this cold or under fatigue."
        ],
        "execution_steps": [
          "Athlete starts organized and attentive.",
          "Perform the pattern at the assigned rhythm or speed.",
          "Own the finish position before the next repetition.",
          "Stop before fatigue changes timing, posture, or coordination."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Push the ground away.",
          "Eyes up, hips under you."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Standing tall before the first step.",
          "Crossing feet or reaching outside the base unnecessarily."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "Every rep is fast, quiet, and technically repeatable with full reset between attempts. End the set when speed, contact quality, posture, or landing control drops.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated.",
          "Contacts get loud, uncontrolled, or asymmetrical.",
          "The athlete needs conditioning-style effort to keep going."
        ]
      },
      "dosage": {
        "volume_unit": "attempts",
        "default_sets": 3,
        "default_reps": 3,
        "default_work_seconds": 8,
        "default_rest_seconds": 75,
        "est_seconds_per_set": 90,
        "default_rpe_min": 5,
        "default_rpe_max": 8
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Active calf, Achilles, knee, or hip irritation",
        "Slippery surface or unsafe stopping area",
        "Unprepared hamstring or calf tissue",
        "Crowded lane or unsafe stopping distance"
      ],
      "goodForSessions": [
        "sprint_prep"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 1,
        "impact_level": 1,
        "requires_spotting": false,
        "requires_coach_supervision": "recommended",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Active calf, Achilles, knee, or hip irritation",
          "Slippery surface or unsafe stopping area",
          "Unprepared hamstring or calf tissue",
          "Crowded lane or unsafe stopping distance"
        ],
        "common_substitutions": [
          "A-March Linear",
          "Supported balance reach",
          "Low-speed planned version"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 6,
        "minimum_hours_between_hard_exposures": 0,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": false,
        "counts_as_neural": true,
        "counts_as_tissue_stress": false,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 4,
        "impact_level": 1,
        "intensity_ceiling": "high"
      }
    },
    {
      "slug": "lateral-shuffle-decel-stick",
      "name": "Lateral Shuffle Decel Stick",
      "family": "Deceleration skill",
      "primaryPhaseKey": "output",
      "subrole": "deceleration_cod_power",
      "subroleSecondary": "braking_control",
      "slot": "deceleration_skill",
      "cardSummary": "Short lateral shuffle into a frozen stop that teaches braking alignment and edge control.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, before heavy strength or conditioning. Keep volume low, intent high, and rest long enough for every rep to look sharp.",
      "description": "Lateral Shuffle Decel Stick is a neural-focused drill for frontal-plane deceleration, hip-knee-foot alignment, and braking posture. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Deceleration / COD Power. Neural emphasis: frontal-plane deceleration, hip-knee-foot alignment, and braking posture. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
      "tenets": [
        {
          "key": "agility",
          "weight": 5
        },
        {
          "key": "body_control",
          "weight": 4
        },
        {
          "key": "coordination",
          "weight": 4
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 5
        },
        {
          "key": "balance_stability",
          "weight": 2
        }
      ],
      "physiology": [
        {
          "key": "neural_output_readiness",
          "weight": 5
        },
        {
          "key": "control_stability",
          "weight": 4
        }
      ],
      "patterns": [
        {
          "key": "locomote",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "cones",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
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
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Output / Deceleration / COD Power because the drill expresses speed, stiffness, power, or reactive intent and requires freshness, low volume, and full recovery.",
      "commonMisuse": "Do not chase sweat or contacts. This belongs early as high-quality neural output; tired reps turn it into conditioning and erase the purpose. Keep attempts capped and rest long enough to preserve speed and mechanics.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "hip_flexion_extension",
          "knee_drive",
          "ankle_stiffness",
          "arm_leg_coordination",
          "hip_knee_ankle_absorption",
          "eccentric_braking",
          "postural_stick"
        ],
        "primary_tissues": [
          "glutes",
          "hip_flexors",
          "adductors",
          "quadriceps",
          "patellar_tendon",
          "calves",
          "achilles_tendon",
          "abdominals"
        ],
        "breathing_demand": "controlled_between_reps",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 1
      },
      "coachingExecution": {
        "movement_description": "Perform Lateral Shuffle Decel Stick as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Set cones to mark a short, clear lane or decision area.",
          "Keep distances short enough that every rep can be sharp and controlled.",
          "Complete general warm-up first; do not start this cold or under fatigue."
        ],
        "execution_steps": [
          "Athlete loads quietly with posture stacked and eyes forward.",
          "Athlete performs the jump, hop, contact, or drop with crisp intent.",
          "Athlete sticks, rebounds, or finishes exactly as assigned without extra contacts.",
          "Stop the set if contact sound, alignment, or rhythm degrades."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Push the ground away.",
          "Eyes up, hips under you.",
          "Quiet contacts."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Standing tall before the first step.",
          "Crossing feet or reaching outside the base unnecessarily.",
          "Landing loud or stiff.",
          "Knees collapsing inward or feet spinning out."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "Every rep is fast, quiet, and technically repeatable with full reset between attempts. End the set when speed, contact quality, posture, or landing control drops.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated.",
          "Contacts get loud, uncontrolled, or asymmetrical.",
          "The athlete needs conditioning-style effort to keep going."
        ]
      },
      "dosage": {
        "volume_unit": "attempts",
        "default_sets": 3,
        "default_reps": 3,
        "default_work_seconds": 15,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 105,
        "default_rpe_min": 3,
        "default_rpe_max": 8
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Active calf, Achilles, knee, or hip irritation",
        "Slippery surface or unsafe stopping area"
      ],
      "goodForSessions": [
        "deceleration",
        "landing_prep"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 2,
        "impact_level": 1,
        "requires_spotting": false,
        "requires_coach_supervision": "recommended",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Active calf, Achilles, knee, or hip irritation",
          "Slippery surface or unsafe stopping area"
        ],
        "common_substitutions": [
          "Snap-Down to Athletic Stick",
          "Low-amplitude pogo",
          "March or step-to-stick alternative"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 6,
        "minimum_hours_between_hard_exposures": 0,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": false,
        "counts_as_neural": true,
        "counts_as_tissue_stress": false,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 4,
        "impact_level": 1,
        "intensity_ceiling": "high"
      }
    },
    {
      "slug": "5-10-5-decel-stick",
      "name": "5-10-5 Decel Stick",
      "family": "Deceleration skill",
      "primaryPhaseKey": "output",
      "subrole": "deceleration_cod_power",
      "subroleSecondary": "coordinate",
      "slot": "deceleration_skill",
      "cardSummary": "Change-of-direction prep using short shuttle distances and a deliberate stick at each turn point.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, before heavy strength or conditioning. Keep volume low, intent high, and rest long enough for every rep to look sharp.",
      "description": "5-10-5 Decel Stick is a neural-focused drill for deceleration timing, body lean, and controlled reorientation. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Deceleration / COD Power. Neural emphasis: deceleration timing, body lean, and controlled reorientation. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
      "tenets": [
        {
          "key": "agility",
          "weight": 5
        },
        {
          "key": "coordination",
          "weight": 4
        },
        {
          "key": "body_control",
          "weight": 4
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 5
        },
        {
          "key": "balance_stability",
          "weight": 2
        }
      ],
      "physiology": [
        {
          "key": "neural_output_readiness",
          "weight": 5
        },
        {
          "key": "control_stability",
          "weight": 4
        }
      ],
      "patterns": [
        {
          "key": "locomote",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "cones",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "full_body",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 4
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
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Output / Deceleration / COD Power because the drill expresses speed, stiffness, power, or reactive intent and requires freshness, low volume, and full recovery.",
      "commonMisuse": "Do not chase sweat or contacts. This belongs early as high-quality neural output; tired reps turn it into conditioning and erase the purpose. Keep attempts capped and rest long enough to preserve speed and mechanics.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "hip_flexion_extension",
          "knee_drive",
          "ankle_stiffness",
          "arm_leg_coordination",
          "hip_knee_ankle_absorption",
          "eccentric_braking",
          "postural_stick"
        ],
        "primary_tissues": [
          "nervous_system",
          "postural_system",
          "glutes",
          "hip_flexors",
          "adductors",
          "quadriceps",
          "patellar_tendon",
          "calves"
        ],
        "breathing_demand": "controlled_between_reps",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 2
      },
      "coachingExecution": {
        "movement_description": "Perform 5-10-5 Decel Stick as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Set cones to mark a short, clear lane or decision area.",
          "Keep distances short enough that every rep can be sharp and controlled.",
          "Complete general warm-up first; do not start this cold or under fatigue."
        ],
        "execution_steps": [
          "Athlete loads quietly with posture stacked and eyes forward.",
          "Athlete performs the jump, hop, contact, or drop with crisp intent.",
          "Athlete sticks, rebounds, or finishes exactly as assigned without extra contacts.",
          "Stop the set if contact sound, alignment, or rhythm degrades."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Push the ground away.",
          "Eyes up, hips under you.",
          "Quiet contacts."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Standing tall before the first step.",
          "Crossing feet or reaching outside the base unnecessarily.",
          "Landing loud or stiff.",
          "Knees collapsing inward or feet spinning out."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "Every rep is fast, quiet, and technically repeatable with full reset between attempts. End the set when speed, contact quality, posture, or landing control drops.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated.",
          "Contacts get loud, uncontrolled, or asymmetrical.",
          "The athlete needs conditioning-style effort to keep going."
        ]
      },
      "dosage": {
        "volume_unit": "attempts",
        "default_sets": 3,
        "default_reps": 3,
        "default_work_seconds": 15,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 105,
        "default_rpe_min": 3,
        "default_rpe_max": 8
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Poor landing control or pain with impact",
        "Knee, ankle, or hip symptoms during jumping or cutting"
      ],
      "goodForSessions": [
        "deceleration"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 2,
        "impact_level": 2,
        "requires_spotting": false,
        "requires_coach_supervision": "recommended",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Poor landing control or pain with impact",
          "Knee, ankle, or hip symptoms during jumping or cutting"
        ],
        "common_substitutions": [
          "Snap-Down to Athletic Stick",
          "Low-amplitude pogo",
          "March or step-to-stick alternative"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 4,
        "minimum_hours_between_hard_exposures": 24,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": false,
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
        "impact_level": 2,
        "intensity_ceiling": "high"
      }
    },
    {
      "slug": "drop-step-crossover-go",
      "name": "Drop-Step Crossover Go",
      "family": "Change of direction",
      "primaryPhaseKey": "output",
      "subrole": "deceleration_cod_power",
      "subroleSecondary": "react",
      "slot": "deceleration_skill",
      "cardSummary": "Drop-step and crossover start that teaches fast hip turn and clean first step out of lateral stance.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, before heavy strength or conditioning. Keep volume low, intent high, and rest long enough for every rep to look sharp.",
      "description": "Drop-Step Crossover Go is a neural-focused drill for hip reorientation, crossover step mechanics, and directional acceleration. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Deceleration / COD Power. Neural emphasis: hip reorientation, crossover step mechanics, and directional acceleration. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
      "tenets": [
        {
          "key": "agility",
          "weight": 5
        },
        {
          "key": "speed",
          "weight": 4
        },
        {
          "key": "coordination",
          "weight": 4
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 5
        }
      ],
      "physiology": [
        {
          "key": "neural_output_readiness",
          "weight": 5
        },
        {
          "key": "perception_action_skill",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "locomote",
          "weight": 5
        },
        {
          "key": "rotate",
          "weight": 3
        },
        {
          "key": "land",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "cones",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
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
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Output / Deceleration / COD Power because the drill expresses speed, stiffness, power, or reactive intent and requires freshness, low volume, and full recovery.",
      "commonMisuse": "Do not chase sweat or contacts. This belongs early as high-quality neural output; tired reps turn it into conditioning and erase the purpose. Keep attempts capped and rest long enough to preserve speed and mechanics.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "hip_flexion_extension",
          "knee_drive",
          "ankle_stiffness",
          "arm_leg_coordination",
          "thoracic_rotation",
          "hip_rotation",
          "trunk_rotation_control",
          "hip_knee_ankle_absorption"
        ],
        "primary_tissues": [
          "glutes",
          "hip_flexors",
          "adductors",
          "quadriceps",
          "patellar_tendon",
          "calves",
          "achilles_tendon",
          "abdominals"
        ],
        "breathing_demand": "controlled_between_reps",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 2
      },
      "coachingExecution": {
        "movement_description": "Perform Drop-Step Crossover Go as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Set cones to mark a short, clear lane or decision area.",
          "Keep distances short enough that every rep can be sharp and controlled.",
          "Complete general warm-up first; do not start this cold or under fatigue."
        ],
        "execution_steps": [
          "Athlete holds the start position and waits for the cue instead of guessing.",
          "Coach or partner gives one clear visual or auditory cue.",
          "Athlete makes the correct first movement, finishes the required action, and regains control.",
          "Reset fully before the next rep so attention and mechanics stay crisp."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Push the ground away.",
          "Eyes up, hips under you.",
          "Quiet contacts."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Standing tall before the first step.",
          "Crossing feet or reaching outside the base unnecessarily.",
          "Landing loud or stiff.",
          "Knees collapsing inward or feet spinning out."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "Every rep is fast, quiet, and technically repeatable with full reset between attempts. End the set when speed, contact quality, posture, or landing control drops.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated.",
          "Contacts get loud, uncontrolled, or asymmetrical.",
          "The athlete needs conditioning-style effort to keep going."
        ]
      },
      "dosage": {
        "volume_unit": "attempts",
        "default_sets": 3,
        "default_reps": 3,
        "default_work_seconds": 15,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 105,
        "default_rpe_min": 3,
        "default_rpe_max": 8
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Poor landing control or pain with impact",
        "Knee, ankle, or hip symptoms during jumping or cutting"
      ],
      "goodForSessions": [
        "deceleration",
        "sprint_prep"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 2,
        "impact_level": 2,
        "requires_spotting": false,
        "requires_coach_supervision": "recommended",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Poor landing control or pain with impact",
          "Knee, ankle, or hip symptoms during jumping or cutting"
        ],
        "common_substitutions": [
          "Snap-Down to Athletic Stick",
          "Low-amplitude pogo",
          "March or step-to-stick alternative"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 4,
        "minimum_hours_between_hard_exposures": 24,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": false,
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
        "impact_level": 2,
        "intensity_ceiling": "high"
      }
    },
    {
      "slug": "backpedal-to-sprint-turn",
      "name": "Backpedal to Sprint Turn",
      "family": "Change of direction",
      "primaryPhaseKey": "output",
      "subrole": "deceleration_cod_power",
      "subroleSecondary": "transition",
      "slot": "deceleration_skill",
      "cardSummary": "Backpedal-to-turn drill that links rearward movement, hip flip, and forward acceleration.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, before heavy strength or conditioning. Keep volume low, intent high, and rest long enough for every rep to look sharp.",
      "description": "Backpedal to Sprint Turn is a neural-focused drill for rearward movement control, hip flip timing, and acceleration after transition. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Deceleration / COD Power. Neural emphasis: rearward movement control, hip flip timing, and acceleration after transition. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
      "tenets": [
        {
          "key": "agility",
          "weight": 5
        },
        {
          "key": "speed",
          "weight": 4
        },
        {
          "key": "coordination",
          "weight": 4
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 5
        }
      ],
      "physiology": [
        {
          "key": "neural_output_readiness",
          "weight": 5
        },
        {
          "key": "perception_action_skill",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "locomote",
          "weight": 5
        },
        {
          "key": "rotate",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "cones",
          "weight": 5
        }
      ],
      "body_regions": [
        {
          "key": "full_body",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 4
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
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Output / Deceleration / COD Power because the drill expresses speed, stiffness, power, or reactive intent and requires freshness, low volume, and full recovery.",
      "commonMisuse": "Do not chase sweat or contacts. This belongs early as high-quality neural output; tired reps turn it into conditioning and erase the purpose. Keep attempts capped and rest long enough to preserve speed and mechanics.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "hip_flexion_extension",
          "knee_drive",
          "ankle_stiffness",
          "arm_leg_coordination",
          "thoracic_rotation",
          "hip_rotation",
          "trunk_rotation_control"
        ],
        "primary_tissues": [
          "nervous_system",
          "postural_system",
          "glutes",
          "hip_flexors",
          "adductors",
          "calves",
          "achilles_tendon",
          "abdominals"
        ],
        "breathing_demand": "controlled_between_reps",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 1
      },
      "coachingExecution": {
        "movement_description": "Perform Backpedal to Sprint Turn as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Set cones to mark a short, clear lane or decision area.",
          "Keep distances short enough that every rep can be sharp and controlled.",
          "Complete general warm-up first; do not start this cold or under fatigue."
        ],
        "execution_steps": [
          "Athlete starts organized and attentive.",
          "Perform the pattern at the assigned rhythm or speed.",
          "Own the finish position before the next repetition.",
          "Stop before fatigue changes timing, posture, or coordination."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Push the ground away.",
          "Eyes up, hips under you.",
          "Turn with control, not a twist and collapse."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Standing tall before the first step.",
          "Crossing feet or reaching outside the base unnecessarily."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "Every rep is fast, quiet, and technically repeatable with full reset between attempts. End the set when speed, contact quality, posture, or landing control drops.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated.",
          "Contacts get loud, uncontrolled, or asymmetrical.",
          "The athlete needs conditioning-style effort to keep going."
        ]
      },
      "dosage": {
        "volume_unit": "attempts",
        "default_sets": 3,
        "default_reps": 3,
        "default_work_seconds": 8,
        "default_rest_seconds": 75,
        "est_seconds_per_set": 90,
        "default_rpe_min": 5,
        "default_rpe_max": 8
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Active calf, Achilles, knee, or hip irritation",
        "Slippery surface or unsafe stopping area",
        "Unprepared hamstring or calf tissue",
        "Crowded lane or unsafe stopping distance"
      ],
      "goodForSessions": [
        "deceleration",
        "sprint_prep"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 2,
        "impact_level": 1,
        "requires_spotting": false,
        "requires_coach_supervision": "recommended",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Active calf, Achilles, knee, or hip irritation",
          "Slippery surface or unsafe stopping area",
          "Unprepared hamstring or calf tissue",
          "Crowded lane or unsafe stopping distance"
        ],
        "common_substitutions": [
          "A-March Linear",
          "Supported balance reach",
          "Low-speed planned version"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 6,
        "minimum_hours_between_hard_exposures": 0,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": false,
        "counts_as_neural": true,
        "counts_as_tissue_stress": false,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 4,
        "impact_level": 1,
        "intensity_ceiling": "high"
      }
    },
    {
      "slug": "partner-mirror-tag-burst",
      "name": "Partner Mirror Tag Burst",
      "family": "Reactive agility",
      "primaryPhaseKey": "movement_intelligence",
      "subrole": "perception_action_reactive_movement",
      "subroleSecondary": "tag_burst",
      "slot": "perception_action_skill",
      "cardSummary": "Short mirror-tag burst that trains reactive acceleration and braking while preserving decision quality.",
      "bestPlacement": "Use after general warm-up and before Output, strength, or conditioning. Keep decision quality and timing crisp; stop when the athlete starts guessing.",
      "description": "Partner Mirror Tag Burst is a neural-focused drill for live opponent reading, first-step timing, and braking under pressure. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Perception-Action / Reactive Movement. Neural emphasis: live opponent reading, first-step timing, and braking under pressure. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
      "tenets": [
        {
          "key": "agility",
          "weight": 5
        },
        {
          "key": "speed",
          "weight": 4
        },
        {
          "key": "coordination",
          "weight": 5
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 5
        }
      ],
      "physiology": [
        {
          "key": "perception_action_skill",
          "weight": 5
        },
        {
          "key": "neural_output_readiness",
          "weight": 4
        }
      ],
      "patterns": [
        {
          "key": "locomote",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "partner",
          "weight": 5
        },
        {
          "key": "cones",
          "weight": 2
        }
      ],
      "body_regions": [
        {
          "key": "full_body",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 4
        },
        {
          "key": "knee",
          "weight": 3
        },
        {
          "key": "ankle",
          "weight": 2
        }
      ],
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Movement Intelligence / Perception-Action / Reactive Movement because the primary adaptation is timing, perception, coordination, and body control while the nervous system is fresh.",
      "commonMisuse": "Do not turn this into conditioning, a long fatigue circuit, or a random agility game. The value is a crisp neural signal, an accurate movement answer, and a clean reset. If the athlete gets slower, louder, dizzy, or less coordinated, the set is done.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "hip_flexion_extension",
          "knee_drive",
          "ankle_stiffness",
          "arm_leg_coordination",
          "hip_knee_ankle_absorption",
          "eccentric_braking",
          "postural_stick"
        ],
        "primary_tissues": [
          "nervous_system",
          "postural_system",
          "glutes",
          "hip_flexors",
          "adductors",
          "quadriceps",
          "patellar_tendon",
          "calves"
        ],
        "breathing_demand": "rhythmic",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 1
      },
      "coachingExecution": {
        "movement_description": "Perform Partner Mirror Tag Burst as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Set cones to mark a short, clear lane or decision area.",
          "Keep distances short enough that every rep can be sharp and controlled.",
          "Demonstrate one slow rep before asking for crisp reps."
        ],
        "execution_steps": [
          "Athlete holds the start position and waits for the cue instead of guessing.",
          "Coach or partner gives one clear visual or auditory cue.",
          "Athlete makes the correct first movement, finishes the required action, and regains control.",
          "Reset fully before the next rep so attention and mechanics stay crisp."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Push the ground away.",
          "Eyes up, hips under you.",
          "Quiet contacts."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Standing tall before the first step.",
          "Crossing feet or reaching outside the base unnecessarily.",
          "Landing loud or stiff.",
          "Knees collapsing inward or feet spinning out."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "The athlete reads the cue, performs the correct action, and resets without guessing, rushing, or losing posture. Learning quality is more important than speed.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated.",
          "Contacts get loud, uncontrolled, or asymmetrical."
        ]
      },
      "dosage": {
        "volume_unit": "attempts",
        "default_sets": 2,
        "default_reps": 3,
        "default_work_seconds": 15,
        "default_rest_seconds": 60,
        "est_seconds_per_set": 75,
        "default_rpe_min": 3,
        "default_rpe_max": 6
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Active calf, Achilles, knee, or hip irritation",
        "Slippery surface or unsafe stopping area"
      ],
      "goodForSessions": [
        "deceleration",
        "general_warmup"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 2,
        "impact_level": 1,
        "requires_spotting": false,
        "requires_coach_supervision": "recommended",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Active calf, Achilles, knee, or hip irritation",
          "Slippery surface or unsafe stopping area"
        ],
        "common_substitutions": [
          "Snap-Down to Athletic Stick",
          "Low-amplitude pogo",
          "March or step-to-stick alternative"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 6,
        "minimum_hours_between_hard_exposures": 0,
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
        "fatigue_cost": 3,
        "fatigue_sensitivity": 4,
        "technical_complexity": 3,
        "impact_level": 1,
        "intensity_ceiling": "moderate"
      }
    },
    {
      "slug": "reactive-45-degree-cut",
      "name": "Reactive 45-Degree Cut",
      "family": "Reactive cut",
      "primaryPhaseKey": "output",
      "subrole": "reactive_agility_tumbling_output",
      "subroleSecondary": "deceleration",
      "slot": "reactive_agility_output",
      "cardSummary": "Coach-cued 45-degree cut that combines reaction, braking, and re-acceleration at a controlled dose.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, before heavy strength or conditioning. Keep volume low, intent high, and rest long enough for every rep to look sharp.",
      "description": "Reactive 45-Degree Cut is a neural-focused drill for visual cue reading, cut angle control, and quick re-acceleration. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Reactive Agility Output. Neural emphasis: visual cue reading, cut angle control, and quick re-acceleration. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
      "tenets": [
        {
          "key": "agility",
          "weight": 5
        },
        {
          "key": "speed",
          "weight": 4
        },
        {
          "key": "coordination",
          "weight": 4
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 5
        }
      ],
      "physiology": [
        {
          "key": "perception_action_skill",
          "weight": 5
        },
        {
          "key": "neural_output_readiness",
          "weight": 5
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
          "key": "land",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "cones",
          "weight": 5
        },
        {
          "key": "partner",
          "weight": 2
        }
      ],
      "body_regions": [
        {
          "key": "full_body",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 4
        },
        {
          "key": "knee",
          "weight": 3
        },
        {
          "key": "ankle",
          "weight": 2
        }
      ],
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Output / Reactive Agility Output because the drill expresses speed, stiffness, power, or reactive intent and requires freshness, low volume, and full recovery.",
      "commonMisuse": "Do not chase sweat or contacts. This belongs early as high-quality neural output; tired reps turn it into conditioning and erase the purpose. Keep attempts capped and rest long enough to preserve speed and mechanics.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "hip_flexion_extension",
          "knee_drive",
          "ankle_stiffness",
          "arm_leg_coordination",
          "hip_knee_ankle_absorption",
          "eccentric_braking",
          "postural_stick"
        ],
        "primary_tissues": [
          "nervous_system",
          "postural_system",
          "glutes",
          "hip_flexors",
          "adductors",
          "quadriceps",
          "patellar_tendon",
          "calves"
        ],
        "breathing_demand": "controlled_between_reps",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 2
      },
      "coachingExecution": {
        "movement_description": "Perform Reactive 45-Degree Cut as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Set cones to mark a short, clear lane or decision area.",
          "Keep distances short enough that every rep can be sharp and controlled.",
          "Complete general warm-up first; do not start this cold or under fatigue."
        ],
        "execution_steps": [
          "Athlete holds the start position and waits for the cue instead of guessing.",
          "Coach or partner gives one clear visual or auditory cue.",
          "Athlete makes the correct first movement, finishes the required action, and regains control.",
          "Reset fully before the next rep so attention and mechanics stay crisp."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Push the ground away.",
          "Eyes up, hips under you.",
          "Quiet contacts."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Standing tall before the first step.",
          "Crossing feet or reaching outside the base unnecessarily.",
          "Landing loud or stiff.",
          "Knees collapsing inward or feet spinning out."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "Every rep is fast, quiet, and technically repeatable with full reset between attempts. End the set when speed, contact quality, posture, or landing control drops.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated.",
          "Contacts get loud, uncontrolled, or asymmetrical.",
          "The athlete needs conditioning-style effort to keep going."
        ]
      },
      "dosage": {
        "volume_unit": "attempts",
        "default_sets": 3,
        "default_reps": 3,
        "default_work_seconds": 15,
        "default_rest_seconds": 90,
        "est_seconds_per_set": 105,
        "default_rpe_min": 3,
        "default_rpe_max": 8
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Poor landing control or pain with impact",
        "Knee, ankle, or hip symptoms during jumping or cutting"
      ],
      "goodForSessions": [
        "deceleration",
        "sprint_prep"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 2,
        "impact_level": 2,
        "requires_spotting": false,
        "requires_coach_supervision": "recommended",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Poor landing control or pain with impact",
          "Knee, ankle, or hip symptoms during jumping or cutting"
        ],
        "common_substitutions": [
          "Snap-Down to Athletic Stick",
          "Low-amplitude pogo",
          "March or step-to-stick alternative"
        ]
      },
      "regimen": {
        "can_be_daily": false,
        "weekly_max_frequency": 4,
        "minimum_hours_between_hard_exposures": 24,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": false,
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
        "impact_level": 2,
        "intensity_ceiling": "high"
      }
    },
    {
      "slug": "reactive-med-ball-toss-and-relocate",
      "name": "Reactive Med Ball Toss and Relocate",
      "family": "Reactive throw and relocate",
      "primaryPhaseKey": "movement_intelligence",
      "subrole": "perception_action_reactive_movement",
      "subroleSecondary": "throw_relocate",
      "slot": "perception_action_skill",
      "cardSummary": "Light med-ball partner drill that links throw accuracy, relocation, and catch readiness.",
      "bestPlacement": "Use after general warm-up and before Output, strength, or conditioning. Keep decision quality and timing crisp; stop when the athlete starts guessing.",
      "description": "Reactive Med Ball Toss and Relocate is a neural-focused drill for throw-then-move timing, relocation footwork, and reactive catching posture. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Perception-Action / Reactive Movement. Neural emphasis: throw-then-move timing, relocation footwork, and reactive catching posture. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
      "tenets": [
        {
          "key": "coordination",
          "weight": 5
        },
        {
          "key": "agility",
          "weight": 3
        },
        {
          "key": "body_control",
          "weight": 4
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 5
        },
        {
          "key": "core_body_control",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "perception_action_skill",
          "weight": 5
        },
        {
          "key": "control_stability",
          "weight": 3
        }
      ],
      "patterns": [
        {
          "key": "rotate",
          "weight": 5
        },
        {
          "key": "locomote",
          "weight": 3
        },
        {
          "key": "brace",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "partner",
          "weight": 2
        }
      ],
      "body_regions": [
        {
          "key": "full_body",
          "weight": 5
        },
        {
          "key": "core",
          "weight": 4
        },
        {
          "key": "shoulder",
          "weight": 3
        },
        {
          "key": "hip",
          "weight": 2
        }
      ],
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Movement Intelligence / Perception-Action / Reactive Movement because the primary adaptation is timing, perception, coordination, and body control while the nervous system is fresh.",
      "commonMisuse": "Do not turn this into conditioning, a long fatigue circuit, or a random agility game. The value is a crisp neural signal, an accurate movement answer, and a clean reset. If the athlete gets slower, louder, dizzy, or less coordinated, the set is done.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "thoracic_rotation",
          "hip_rotation",
          "trunk_rotation_control",
          "hip_flexion_extension",
          "knee_drive",
          "ankle_stiffness",
          "arm_leg_coordination",
          "trunk_bracing"
        ],
        "primary_tissues": [
          "nervous_system",
          "postural_system",
          "abdominals",
          "obliques",
          "diaphragm",
          "deltoids",
          "rotator_cuff",
          "scapular_stabilizers"
        ],
        "breathing_demand": "rhythmic",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 0
      },
      "coachingExecution": {
        "movement_description": "Perform Reactive Med Ball Toss and Relocate as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Use a light medicine ball the athlete can move without strain.",
          "Set a partner, wall, or target location with enough space for a controlled reset.",
          "Demonstrate one slow rep before asking for crisp reps."
        ],
        "execution_steps": [
          "Athlete holds the start position and waits for the cue instead of guessing.",
          "Coach or partner gives one clear visual or auditory cue.",
          "Athlete makes the correct first movement, finishes the required action, and regains control.",
          "Reset fully before the next rep so attention and mechanics stay crisp."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Push the ground away.",
          "Eyes up, hips under you.",
          "Ribs stacked over pelvis."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Standing tall before the first step.",
          "Crossing feet or reaching outside the base unnecessarily.",
          "Holding breath to create fake stability.",
          "Rib flare, hip shift, or spinal sag."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "The athlete reads the cue, performs the correct action, and resets without guessing, rushing, or losing posture. Learning quality is more important than speed.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated."
        ]
      },
      "dosage": {
        "volume_unit": "reps",
        "default_sets": 2,
        "default_reps": 5,
        "default_work_seconds": 25,
        "default_rest_seconds": 30,
        "est_seconds_per_set": 60,
        "default_rpe_min": 2,
        "default_rpe_max": 5
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Painful movement pattern",
        "Athlete cannot follow the cue or maintain safe posture"
      ],
      "goodForSessions": [
        "general_warmup"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 1,
        "impact_level": 0,
        "requires_spotting": false,
        "requires_coach_supervision": "optional",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Painful movement pattern",
          "Athlete cannot follow the cue or maintain safe posture"
        ],
        "common_substitutions": [
          "Coach Point Step Reaction",
          "Planned cone step",
          "Low-speed mirror walk"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 6,
        "minimum_hours_between_hard_exposures": 0,
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
        "fatigue_cost": 3,
        "fatigue_sensitivity": 4,
        "technical_complexity": 3,
        "impact_level": 0,
        "intensity_ceiling": "moderate"
      }
    },
    {
      "slug": "split-stance-crossover-chase",
      "name": "Split-Stance Crossover Chase",
      "family": "Reactive acceleration",
      "primaryPhaseKey": "output",
      "subrole": "acceleration_start_speed",
      "subroleSecondary": "react",
      "slot": "reaction_speed",
      "cardSummary": "Split-stance crossover start that turns a partner cue into a short chase and controlled finish.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, before heavy strength or conditioning. Keep volume low, intent high, and rest long enough for every rep to look sharp.",
      "description": "Split-Stance Crossover Chase is a neural-focused drill for visual reaction, crossover projection, and short chase acceleration. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Acceleration Start Speed. Neural emphasis: visual reaction, crossover projection, and short chase acceleration. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
      "tenets": [
        {
          "key": "speed",
          "weight": 5
        },
        {
          "key": "agility",
          "weight": 4
        },
        {
          "key": "coordination",
          "weight": 4
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 5
        }
      ],
      "physiology": [
        {
          "key": "perception_action_skill",
          "weight": 5
        },
        {
          "key": "neural_output_readiness",
          "weight": 5
        }
      ],
      "patterns": [
        {
          "key": "locomote",
          "weight": 5
        },
        {
          "key": "rotate",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "partner",
          "weight": 5
        },
        {
          "key": "cones",
          "weight": 2
        }
      ],
      "body_regions": [
        {
          "key": "full_body",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 4
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
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Output / Acceleration Start Speed because the drill expresses speed, stiffness, power, or reactive intent and requires freshness, low volume, and full recovery.",
      "commonMisuse": "Do not chase sweat or contacts. This belongs early as high-quality neural output; tired reps turn it into conditioning and erase the purpose. Keep attempts capped and rest long enough to preserve speed and mechanics.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "hip_flexion_extension",
          "knee_drive",
          "ankle_stiffness",
          "arm_leg_coordination",
          "thoracic_rotation",
          "hip_rotation",
          "trunk_rotation_control"
        ],
        "primary_tissues": [
          "nervous_system",
          "postural_system",
          "glutes",
          "hip_flexors",
          "adductors",
          "calves",
          "achilles_tendon",
          "abdominals"
        ],
        "breathing_demand": "controlled_between_reps",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 1
      },
      "coachingExecution": {
        "movement_description": "Perform Split-Stance Crossover Chase as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Set cones to mark a short, clear lane or decision area.",
          "Keep distances short enough that every rep can be sharp and controlled.",
          "Complete general warm-up first; do not start this cold or under fatigue."
        ],
        "execution_steps": [
          "Athlete starts organized and attentive.",
          "Perform the pattern at the assigned rhythm or speed.",
          "Own the finish position before the next repetition.",
          "Stop before fatigue changes timing, posture, or coordination."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Push the ground away.",
          "Eyes up, hips under you.",
          "Turn with control, not a twist and collapse."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Standing tall before the first step.",
          "Crossing feet or reaching outside the base unnecessarily."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "Every rep is fast, quiet, and technically repeatable with full reset between attempts. End the set when speed, contact quality, posture, or landing control drops.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated.",
          "Contacts get loud, uncontrolled, or asymmetrical.",
          "The athlete needs conditioning-style effort to keep going."
        ]
      },
      "dosage": {
        "volume_unit": "attempts",
        "default_sets": 3,
        "default_reps": 3,
        "default_work_seconds": 8,
        "default_rest_seconds": 75,
        "est_seconds_per_set": 90,
        "default_rpe_min": 5,
        "default_rpe_max": 8
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Active calf, Achilles, knee, or hip irritation",
        "Slippery surface or unsafe stopping area",
        "Unprepared hamstring or calf tissue",
        "Crowded lane or unsafe stopping distance"
      ],
      "goodForSessions": [
        "sprint_prep",
        "deceleration"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 2,
        "impact_level": 1,
        "requires_spotting": false,
        "requires_coach_supervision": "recommended",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Active calf, Achilles, knee, or hip irritation",
          "Slippery surface or unsafe stopping area",
          "Unprepared hamstring or calf tissue",
          "Crowded lane or unsafe stopping distance"
        ],
        "common_substitutions": [
          "A-March Linear",
          "Supported balance reach",
          "Low-speed planned version"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 6,
        "minimum_hours_between_hard_exposures": 0,
        "counts_as_high_intensity": true,
        "counts_as_high_impact": false,
        "counts_as_neural": true,
        "counts_as_tissue_stress": false,
        "counts_as_conditioning": false
      },
      "phaseProfile": {
        "role": "primary",
        "fit_weight": 5,
        "freshness_required": true,
        "fatigue_cost": 4,
        "fatigue_sensitivity": 5,
        "technical_complexity": 4,
        "impact_level": 1,
        "intensity_ceiling": "high"
      }
    },
    {
      "slug": "low-level-reactive-agility-box",
      "name": "Low-Level Reactive Agility Box",
      "family": "Reactive agility",
      "primaryPhaseKey": "movement_intelligence",
      "subrole": "perception_action_reactive_movement",
      "subroleSecondary": "integrate",
      "slot": "perception_action_skill",
      "cardSummary": "Small-box reactive movement drill that trains scan, choose, move, brake, and reset without conditioning intent.",
      "bestPlacement": "Use after general warm-up and before Output, strength, or conditioning. Keep decision quality and timing crisp; stop when the athlete starts guessing.",
      "description": "Low-Level Reactive Agility Box is a neural-focused drill for multi-cue scanning, short-range movement choice, and controlled reset. It gives the athlete a short, crisp exposure that improves readiness, timing, perception, or output without becoming conditioning.",
      "coachLanguage": "Primary subrole: Perception-Action / Reactive Movement. Neural emphasis: multi-cue scanning, short-range movement choice, and controlled reset. Coach it as a high-quality nervous-system exposure: short sets, precise positions, full attention, and enough rest that every rep remains fast or controlled.",
      "athleteLanguage": "Fast signal, clean answer. Move with intent, stay relaxed where you can, and own the finish.",
      "tenets": [
        {
          "key": "agility",
          "weight": 5
        },
        {
          "key": "coordination",
          "weight": 5
        },
        {
          "key": "body_control",
          "weight": 4
        }
      ],
      "methodologies": [
        {
          "key": "neural",
          "weight": 5
        },
        {
          "key": "balance_stability",
          "weight": 2
        }
      ],
      "physiology": [
        {
          "key": "perception_action_skill",
          "weight": 5
        },
        {
          "key": "neural_output_readiness",
          "weight": 4
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
          "key": "land",
          "weight": 3
        },
        {
          "key": "rotate",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "cones",
          "weight": 5
        },
        {
          "key": "partner",
          "weight": 2
        }
      ],
      "body_regions": [
        {
          "key": "full_body",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 4
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
      "whyItWorks": "Neural drills work best when the cue is clear, the dose is small, and the athlete has enough recovery to coordinate cleaner output. This drill links sensory input, posture, timing, and motor action so the athlete practices higher-quality movement rather than simply accumulating fatigue.",
      "whyItGoesHere": "Belongs in Movement Intelligence / Perception-Action / Reactive Movement because the primary adaptation is timing, perception, coordination, and body control while the nervous system is fresh.",
      "commonMisuse": "Do not turn this into conditioning, a long fatigue circuit, or a random agility game. The value is a crisp neural signal, an accurate movement answer, and a clean reset. If the athlete gets slower, louder, dizzy, or less coordinated, the set is done.",
      "scalingGuidance": "Scale by reducing speed, distance, amplitude, stance challenge, cue choices, or impact first. Progress by adding intent, slightly shorter reaction windows, greater precision, or more sport-specific angles only after the base version is clean.",
      "movementRequirements": {
        "primary_joint_actions": [
          "hip_flexion_extension",
          "knee_drive",
          "ankle_stiffness",
          "arm_leg_coordination",
          "hip_knee_ankle_absorption",
          "eccentric_braking",
          "postural_stick",
          "thoracic_rotation"
        ],
        "primary_tissues": [
          "nervous_system",
          "postural_system",
          "glutes",
          "hip_flexors",
          "adductors",
          "calves",
          "achilles_tendon",
          "abdominals"
        ],
        "breathing_demand": "rhythmic",
        "balance_demand": "dynamic",
        "coordination_demand": "high",
        "impact_level": 1
      },
      "coachingExecution": {
        "movement_description": "Perform Low-Level Reactive Agility Box as a short neural-quality exposure. The athlete starts organized, waits for the cue or rhythm, performs the action with clean mechanics, and resets before fatigue changes timing or posture.",
        "setup": [
          "Set cones to mark a short, clear lane or decision area.",
          "Keep distances short enough that every rep can be sharp and controlled.",
          "Demonstrate one slow rep before asking for crisp reps."
        ],
        "execution_steps": [
          "Athlete holds the start position and waits for the cue instead of guessing.",
          "Coach or partner gives one clear visual or auditory cue.",
          "Athlete makes the correct first movement, finishes the required action, and regains control.",
          "Reset fully before the next rep so attention and mechanics stay crisp."
        ],
        "coach_cues": [
          "Fast signal, clean answer.",
          "Stay relaxed where you can.",
          "Own the finish.",
          "Push the ground away.",
          "Eyes up, hips under you.",
          "Quiet contacts."
        ],
        "common_faults": [
          "Rushing before the cue is clear.",
          "Adding volume after timing has degraded.",
          "Standing tall before the first step.",
          "Crossing feet or reaching outside the base unnecessarily.",
          "Landing loud or stiff.",
          "Knees collapsing inward or feet spinning out."
        ],
        "breathing_cues": [
          "Breathe quietly before the rep.",
          "Do not hold breath to force coordination.",
          "Reset breathing before the next attempt."
        ],
        "quality_gate": "The athlete reads the cue, performs the correct action, and resets without guessing, rushing, or losing posture. Learning quality is more important than speed.",
        "stop_signs": [
          "Dizziness, nausea, or disorientation.",
          "Pain, limping, or protective movement.",
          "Timing gets slower or noticeably less coordinated.",
          "Contacts get loud, uncontrolled, or asymmetrical."
        ]
      },
      "dosage": {
        "volume_unit": "attempts",
        "default_sets": 2,
        "default_reps": 3,
        "default_work_seconds": 15,
        "default_rest_seconds": 60,
        "est_seconds_per_set": 75,
        "default_rpe_min": 3,
        "default_rpe_max": 6
      },
      "scaling": {
        "youth_beginner": "Use the lowest-complexity version, short sets, and a clear freeze or reset after each rep. Keep it playful and stop when attention drops.",
        "youth_intermediate": "Add one constraint at a time: a slightly faster cue, smaller target, modest direction change, or cleaner rhythm. Keep total volume modest.",
        "teen": "Use before speed, power, or sport-skill work. Require clean mechanics and full recovery instead of chasing fatigue.",
        "adult_beginner": "Start with predictable reps, slower tempo, and shorter ranges. Progress to reactive cues only after posture and control are consistent.",
        "adult_advanced": "Use high intent, low volume, and longer rest. Progress through speed, distance, unpredictability, or reduced ground contact, not through fatigue.",
        "older_adult": "Use supported, lower-amplitude options with extra rest. Prioritize balance safety, controlled transitions, and confidence.",
        "pregnancy_postpartum": "Default to low-impact, supported, and non-fatiguing options. Avoid breath holding, aggressive impacts, or positions that create symptoms; follow clinician guidance when needed."
      },
      "genderSpecificNotes": "No default gender-specific adjustment. Individualize by training age, landing control, joint history, pelvic-floor symptoms, footwear, surface, and fatigue state.",
      "pairsWellAfter": [
        "General temperature raise",
        "Dynamic mobility",
        "Low-level activation"
      ],
      "pairsWellBefore": [
        "Acceleration work",
        "Jump or landing work",
        "Strength training",
        "Sport-skill practice"
      ],
      "doNotUseWhen": [
        "Active calf, Achilles, knee, or hip irritation",
        "Slippery surface or unsafe stopping area"
      ],
      "goodForSessions": [
        "general_warmup",
        "deceleration"
      ],
      "mediaReferences": [
        "Internal demo: front and side view",
        "Motor learning: low-fatigue, high-quality practice",
        "Sprint, plyometric, and landing progression principles as appropriate"
      ],
      "mediaInternalNotes": [
        "Neural emphasis: quality over quantity.",
        "Use short exposures before the main training stress, not as metabolic finishers.",
        "Normalize taxonomy keys to exercise_card_details_for_llm.md before import."
      ],
      "safety": {
        "risk_level": 2,
        "impact_level": 1,
        "requires_spotting": false,
        "requires_coach_supervision": "recommended",
        "readiness_checks": [
          "Athlete can hold the start or landing posture without pain.",
          "Breathing stays controlled and the athlete can follow cues.",
          "Movement quality stays sharp at the planned speed."
        ],
        "contraindications": [
          "Active calf, Achilles, knee, or hip irritation",
          "Slippery surface or unsafe stopping area"
        ],
        "common_substitutions": [
          "Snap-Down to Athletic Stick",
          "Low-amplitude pogo",
          "March or step-to-stick alternative"
        ]
      },
      "regimen": {
        "can_be_daily": true,
        "weekly_max_frequency": 6,
        "minimum_hours_between_hard_exposures": 0,
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
        "fatigue_cost": 3,
        "fatigue_sensitivity": 4,
        "technical_complexity": 3,
        "impact_level": 1,
        "intensity_ceiling": "moderate"
      }
    }
  ]
}
```
