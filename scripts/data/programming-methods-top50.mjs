/**
 * Top 50 Programming Library method cards.
 * Consumed by scripts/generate-141-programming-seed.mjs
 */

/** @typedef {Object} ProgrammingMethod */

export const PROGRAMMING_METHODS = [
  {
    "slug": "timed-work-capacity-block",
    "name": "Timed Work Capacity Block",
    "category": "Timed Work Capacity",
    "programming_type": "timed_work_capacity",
    "definition": "A fixed-duration block where athletes accumulate quality work within a time domain using stations, rounds, or continuous effort under a clear time cap.",
    "coach_summary": "Organizes conditioning around a time cap so athletes learn pacing, density, and quality maintenance without chasing open-ended volume.",
    "athlete_summary": "Work hard with good form for the set time. Rest when prescribed and keep quality high even as you get tired.",
    "primary_development_goal": "sustained work capacity and pacing under a time cap",
    "secondary_development_goals": [
      "density tolerance",
      "repeatability",
      "movement quality under fatigue",
      "pacing"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence",
      "prepare_and_access"
    ],
    "energy_system_focus": [
      "mixed",
      "local_muscular_endurance",
      "glycolytic"
    ],
    "fatigue_profile": {
      "fatigue_intentional": true,
      "fatigue_level": "moderate",
      "technical_risk_under_fatigue": "moderate",
      "impact_risk_under_fatigue": "depends_on_exercises",
      "grip_risk_under_fatigue": "depends_on_exercises"
    },
    "supervision_level": "recommended",
    "what_it_is": "A timed block caps total session time and defines how work is organized inside that window \u2014 rounds, stations, or continuous work \u2014 with explicit quality expectations.",
    "why_it_matters": "Time caps create controllable density, teach pacing, and prevent endless grinding while still building repeatability under fatigue.",
    "when_to_use": "Use late in session for Sustained Capacity when you want structured density with a clear end point. Works well for groups with a visible clock.",
    "when_not_to_use": "Do not use before Output or Movement Intelligence. Avoid when athletes lack baseline technique or when no time cap is defined.",
    "common_misuse": [
      "running an open-ended block without a time cap",
      "adding complex skills as fatigue rises",
      "treating the block as a race regardless of form",
      "using high-impact plyometrics under accumulating fatigue",
      "no stop rules when quality collapses"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 6,
          "work_target_seconds": 20,
          "rest_target_seconds": 40,
          "rounds": 3,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 10,
          "work_target_seconds": 30,
          "rest_target_seconds": 30,
          "rounds": 4,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 12,
          "work_target_seconds": 40,
          "rest_target_seconds": 20,
          "rounds": 5,
          "rpe": "7-8"
        }
      },
      "work_rest_options": [
        "timed rounds",
        "timed stations",
        "continuous time cap",
        "quality time cap"
      ],
      "typical_total_duration_minutes": [
        6,
        8,
        10,
        12,
        15
      ],
      "recommended_density": "Work should remain repeatable; if quality drops, reduce reps, load, or station time.",
      "pacing_notes": "Every block needs a visible time cap and explicit quality standard."
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "locomotion",
        "machine_cardio",
        "low_skill_calisthenics",
        "bodyweight_strength",
        "carries",
        "crawls",
        "jump_rope",
        "med_ball"
      ],
      "conditional_exercise_types": [
        "loaded_strength",
        "low_amplitude_elastic"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "max_velocity_sprint",
        "high_impact_plyometrics"
      ]
    },
    "quality_standards": [
      "a visible time cap is set before work begins",
      "movement quality stays consistent through the cap",
      "athletes can recover enough to repeat efforts safely",
      "no pain or unsafe compensations",
      "coach can stop the block when standards fail",
      "pacing is controlled \u2014 not an all-out sprint unless prescribed"
    ],
    "stop_rules": [
      "stop or shorten the cap if quality degrades for two consecutive rounds",
      "stop if pain appears",
      "stop if athletes cannot maintain minimum recovery between stations",
      "reduce complexity if the time cap forces rushed reps",
      "end the block early if environment or space becomes unsafe"
    ],
    "validator_rules": [
      {
        "rule_key": "missing_time_cap",
        "condition_json": {
          "cap_minutes": null
        },
        "message": "Timed Work Capacity blocks require a defined time cap.",
        "severity": "warning"
      },
      {
        "rule_key": "quality_degradation",
        "condition_json": {
          "quality_standards_count_lt": 3
        },
        "message": "Define quality standards before running a time-cap block.",
        "severity": "warning"
      },
      {
        "rule_key": "twcb_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Conditioning before Output may reduce power and reactive quality.",
        "severity": "strong_warning"
      },
      {
        "rule_key": "twcb_advanced_skill",
        "condition_json": {
          "contains_advanced_skill": true
        },
        "message": "Advanced skills should not anchor a timed fatigue block.",
        "severity": "strong_warning"
      }
    ],
    "workout_builder_rules": {
      "preferred_session_phase": "sustained_capacity",
      "allowed_session_phases": [
        "capacity",
        "resilience",
        "sustained_capacity"
      ],
      "default_duration_minutes": 10,
      "default_rounds": 4,
      "default_work_seconds": 30,
      "default_rest_seconds": 30,
      "default_cap_minutes": 10,
      "default_rpe_range": [
        6,
        8
      ],
      "recommended_age_min": 8,
      "coaching_complexity": "moderate",
      "group_friendly": true,
      "equipment_flexibility": "high",
      "requires_timer": true,
      "requires_stations": false,
      "requires_lanes": false,
      "requires_clear_runout": false,
      "requires_score_tracking": false,
      "safety_notes": [
        "Set a time cap",
        "Use simple repeatable movements",
        "Define stop rules before starting"
      ]
    },
    "phase_profiles": [
      {
        "phase_key": "sustained_capacity",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "output",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "avoid",
        "fit_weight": 1
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 6,
        "default_rounds": 3,
        "default_work_seconds": 20,
        "default_rest_seconds": 40,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Short cap, generous rest, simple stations."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 10,
        "default_rounds": 4,
        "default_work_seconds": 30,
        "default_rest_seconds": 30,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Balanced density with clear quality standard."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 12,
        "default_rounds": 5,
        "default_work_seconds": 40,
        "default_rest_seconds": 20,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Higher density only when quality remains repeatable."
      }
    ],
    "examples": [
      {
        "label": "10-minute mixed station cap",
        "audience": "intermediate",
        "example_json": {
          "cap_minutes": 10,
          "stations": [
            {
              "minute": "0-2",
              "task": "Bike or row \u2014 steady pace"
            },
            {
              "minute": "2-4",
              "task": "Goblet squat x 8"
            },
            {
              "minute": "4-6",
              "task": "Farmer carry 20 yards"
            },
            {
              "minute": "6-8",
              "task": "Push-up x 10"
            },
            {
              "minute": "8-10",
              "task": "Bear crawl 15 yards"
            }
          ],
          "quality_standard": "No rushed reps; stop if form breaks."
        },
        "coaching_notes": "Illustrative only \u2014 select exercises in Workout Builder."
      },
      {
        "label": "Youth 6-minute quality cap",
        "audience": "youth",
        "example_json": {
          "cap_minutes": 6,
          "rounds": 3,
          "tasks": [
            "Jump rope 20 sec",
            "Bodyweight squat x 8",
            "Rest walk 30 sec"
          ]
        },
        "coaching_notes": "Keep work submaximal and visible."
      }
    ]
  },
  {
    "slug": "simple-work-rest-intervals",
    "name": "Simple Work/Rest Intervals",
    "category": "Interval Training",
    "programming_type": "work_rest_interval",
    "definition": "Simple Work/Rest Intervals: a structured programming method for organizing training work.",
    "coach_summary": "Use Simple Work/Rest Intervals to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for Simple Work/Rest Intervals and keep movement quality high.",
    "primary_development_goal": "repeatability under fatigue",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "mixed"
    ],
    "fatigue_profile": {
      "fatigue_intentional": true,
      "fatigue_level": "moderate",
      "technical_risk_under_fatigue": "moderate",
      "impact_risk_under_fatigue": "moderate",
      "grip_risk_under_fatigue": "low"
    },
    "supervision_level": "recommended",
    "what_it_is": "Simple Work/Rest Intervals organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 8,
          "work_target_seconds": 20,
          "rest_target_seconds": 40,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 12,
          "work_target_seconds": 30,
          "rest_target_seconds": 30,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 16,
          "work_target_seconds": 40,
          "rest_target_seconds": 20,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "low_skill_calisthenics",
        "bodyweight_strength",
        "machine_cardio",
        "locomotion"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "max_velocity_sprint"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "simple_work_rest_intervals_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "simple_work_rest_intervals_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "preferred_session_phase": "sustained_capacity",
      "allowed_session_phases": [
        "capacity",
        "resilience",
        "sustained_capacity"
      ],
      "default_duration_minutes": 12,
      "default_work_seconds": 30,
      "default_rest_seconds": 30,
      "default_rpe_range": [
        6,
        8
      ],
      "coaching_complexity": "moderate",
      "group_friendly": false,
      "equipment_flexibility": "high",
      "requires_timer": true,
      "requires_stations": false,
      "requires_lanes": false,
      "requires_clear_runout": false,
      "requires_score_tracking": false,
      "safety_notes": [
        "Choose simple movements",
        "Match work to recovery capacity"
      ]
    },
    "phase_profiles": [
      {
        "phase_key": "sustained_capacity",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "output",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "conditional",
        "fit_weight": 2
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 8,
        "default_rounds": null,
        "default_work_seconds": 20,
        "default_rest_seconds": 40,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 12,
        "default_rounds": null,
        "default_work_seconds": 30,
        "default_rest_seconds": 30,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 16,
        "default_rounds": null,
        "default_work_seconds": 40,
        "default_rest_seconds": 20,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "Simple Work/Rest Intervals example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  },
  {
    "slug": "thirty-thirty-interval",
    "name": "30/30 Interval Format",
    "category": "Interval Training",
    "programming_type": "interval",
    "definition": "30/30 Interval Format: a structured programming method for organizing training work.",
    "coach_summary": "Use 30/30 Interval Format to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for 30/30 Interval Format and keep movement quality high.",
    "primary_development_goal": "repeatability under fatigue",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "mixed"
    ],
    "fatigue_profile": {
      "fatigue_intentional": true,
      "fatigue_level": "moderate",
      "technical_risk_under_fatigue": "moderate",
      "impact_risk_under_fatigue": "moderate",
      "grip_risk_under_fatigue": "low"
    },
    "supervision_level": "recommended",
    "what_it_is": "30/30 Interval Format organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 8,
          "work_target_seconds": 20,
          "rest_target_seconds": 40,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 12,
          "work_target_seconds": 30,
          "rest_target_seconds": 30,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 16,
          "work_target_seconds": 40,
          "rest_target_seconds": 20,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "low_skill_calisthenics",
        "bodyweight_strength",
        "machine_cardio",
        "locomotion"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "max_velocity_sprint"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "thirty_thirty_interval_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "thirty_thirty_interval_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "preferred_session_phase": "sustained_capacity",
      "allowed_session_phases": [
        "capacity",
        "resilience",
        "sustained_capacity"
      ],
      "default_duration_minutes": 12,
      "default_work_seconds": 30,
      "default_rest_seconds": 30,
      "default_rpe_range": [
        6,
        8
      ],
      "coaching_complexity": "moderate",
      "group_friendly": false,
      "equipment_flexibility": "high",
      "requires_timer": true,
      "requires_stations": false,
      "requires_lanes": false,
      "requires_clear_runout": false,
      "requires_score_tracking": false,
      "safety_notes": [
        "Choose simple movements",
        "Match work to recovery capacity"
      ]
    },
    "phase_profiles": [
      {
        "phase_key": "sustained_capacity",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "output",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "conditional",
        "fit_weight": 2
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 8,
        "default_rounds": null,
        "default_work_seconds": 20,
        "default_rest_seconds": 40,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 12,
        "default_rounds": null,
        "default_work_seconds": 30,
        "default_rest_seconds": 30,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 16,
        "default_rounds": null,
        "default_work_seconds": 40,
        "default_rest_seconds": 20,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "30/30 Interval Format example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  },
  {
    "slug": "forty-twenty-interval",
    "name": "40/20 Interval Format",
    "category": "HIIT",
    "programming_type": "hiit_interval",
    "definition": "40/20 Interval Format: a structured programming method for organizing training work.",
    "coach_summary": "Use 40/20 Interval Format to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for 40/20 Interval Format and keep movement quality high.",
    "primary_development_goal": "repeatability under fatigue",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "glycolytic",
      "mixed"
    ],
    "fatigue_profile": {
      "fatigue_intentional": true,
      "fatigue_level": "high",
      "technical_risk_under_fatigue": "moderate",
      "impact_risk_under_fatigue": "high",
      "grip_risk_under_fatigue": "moderate"
    },
    "supervision_level": "recommended",
    "what_it_is": "40/20 Interval Format organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 8,
          "work_target_seconds": 20,
          "rest_target_seconds": 40,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 12,
          "work_target_seconds": 30,
          "rest_target_seconds": 20,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 16,
          "work_target_seconds": 40,
          "rest_target_seconds": 10,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "low_skill_calisthenics",
        "bodyweight_strength",
        "machine_cardio",
        "locomotion"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "max_velocity_sprint"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "forty_twenty_interval_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "forty_twenty_interval_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "preferred_session_phase": "sustained_capacity",
      "allowed_session_phases": [
        "capacity",
        "resilience",
        "sustained_capacity"
      ],
      "default_duration_minutes": 12,
      "default_work_seconds": 30,
      "default_rest_seconds": 20,
      "default_rpe_range": [
        6,
        8
      ],
      "coaching_complexity": "moderate",
      "group_friendly": false,
      "equipment_flexibility": "high",
      "requires_timer": true,
      "requires_stations": false,
      "requires_lanes": false,
      "requires_clear_runout": false,
      "requires_score_tracking": false,
      "safety_notes": [
        "Choose simple movements",
        "Match work to recovery capacity"
      ]
    },
    "phase_profiles": [
      {
        "phase_key": "sustained_capacity",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "output",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "conditional",
        "fit_weight": 2
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 8,
        "default_rounds": null,
        "default_work_seconds": 20,
        "default_rest_seconds": 40,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 12,
        "default_rounds": null,
        "default_work_seconds": 30,
        "default_rest_seconds": 20,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 16,
        "default_rounds": null,
        "default_work_seconds": 40,
        "default_rest_seconds": 10,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "40/20 Interval Format example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  },
  {
    "slug": "twenty-forty-beginner-interval",
    "name": "20/40 Beginner Interval Format",
    "category": "Interval Training",
    "programming_type": "interval",
    "definition": "20/40 Beginner Interval Format: a structured programming method for organizing training work.",
    "coach_summary": "Use 20/40 Beginner Interval Format to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for 20/40 Beginner Interval Format and keep movement quality high.",
    "primary_development_goal": "repeatability under fatigue",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "mixed"
    ],
    "fatigue_profile": {
      "fatigue_intentional": true,
      "fatigue_level": "moderate",
      "technical_risk_under_fatigue": "moderate",
      "impact_risk_under_fatigue": "moderate",
      "grip_risk_under_fatigue": "low"
    },
    "supervision_level": "recommended",
    "what_it_is": "20/40 Beginner Interval Format organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 8,
          "work_target_seconds": 20,
          "rest_target_seconds": 40,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 12,
          "work_target_seconds": 30,
          "rest_target_seconds": 30,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 16,
          "work_target_seconds": 40,
          "rest_target_seconds": 20,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "low_skill_calisthenics",
        "bodyweight_strength",
        "machine_cardio",
        "locomotion"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "max_velocity_sprint"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "twenty_forty_beginner_interval_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "twenty_forty_beginner_interval_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "preferred_session_phase": "sustained_capacity",
      "allowed_session_phases": [
        "capacity",
        "resilience",
        "sustained_capacity"
      ],
      "default_duration_minutes": 12,
      "default_work_seconds": 30,
      "default_rest_seconds": 30,
      "default_rpe_range": [
        6,
        8
      ],
      "coaching_complexity": "moderate",
      "group_friendly": false,
      "equipment_flexibility": "high",
      "requires_timer": true,
      "requires_stations": false,
      "requires_lanes": false,
      "requires_clear_runout": false,
      "requires_score_tracking": false,
      "safety_notes": [
        "Choose simple movements",
        "Match work to recovery capacity"
      ]
    },
    "phase_profiles": [
      {
        "phase_key": "sustained_capacity",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "output",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "conditional",
        "fit_weight": 2
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 8,
        "default_rounds": null,
        "default_work_seconds": 20,
        "default_rest_seconds": 40,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 12,
        "default_rounds": null,
        "default_work_seconds": 30,
        "default_rest_seconds": 30,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 16,
        "default_rounds": null,
        "default_work_seconds": 40,
        "default_rest_seconds": 20,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "20/40 Beginner Interval Format example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  },
  {
    "slug": "tabata-style-interval",
    "name": "Tabata-Style Interval",
    "category": "HIIT",
    "programming_type": "tabata",
    "definition": "Tabata-Style Interval: a structured programming method for organizing training work.",
    "coach_summary": "Use Tabata-Style Interval to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for Tabata-Style Interval and keep movement quality high.",
    "primary_development_goal": "repeatability under fatigue",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "glycolytic",
      "mixed"
    ],
    "fatigue_profile": {
      "fatigue_intentional": true,
      "fatigue_level": "high",
      "technical_risk_under_fatigue": "moderate",
      "impact_risk_under_fatigue": "high",
      "grip_risk_under_fatigue": "moderate"
    },
    "supervision_level": "recommended",
    "what_it_is": "Tabata-Style Interval organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 8,
          "work_target_seconds": 20,
          "rest_target_seconds": 40,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 12,
          "work_target_seconds": 30,
          "rest_target_seconds": 20,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 16,
          "work_target_seconds": 40,
          "rest_target_seconds": 10,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "low_skill_calisthenics",
        "bodyweight_strength",
        "machine_cardio",
        "locomotion"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "max_velocity_sprint"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "tabata_style_interval_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "tabata_style_interval_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "preferred_session_phase": "sustained_capacity",
      "allowed_session_phases": [
        "capacity",
        "resilience",
        "sustained_capacity"
      ],
      "default_duration_minutes": 12,
      "default_work_seconds": 30,
      "default_rest_seconds": 20,
      "default_rpe_range": [
        6,
        8
      ],
      "coaching_complexity": "moderate",
      "group_friendly": false,
      "equipment_flexibility": "high",
      "requires_timer": true,
      "requires_stations": false,
      "requires_lanes": false,
      "requires_clear_runout": false,
      "requires_score_tracking": false,
      "safety_notes": [
        "Choose simple movements",
        "Match work to recovery capacity"
      ]
    },
    "phase_profiles": [
      {
        "phase_key": "sustained_capacity",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "output",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "conditional",
        "fit_weight": 2
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 8,
        "default_rounds": null,
        "default_work_seconds": 20,
        "default_rest_seconds": 40,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 12,
        "default_rounds": null,
        "default_work_seconds": 30,
        "default_rest_seconds": 20,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 16,
        "default_rounds": null,
        "default_work_seconds": 40,
        "default_rest_seconds": 10,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "Tabata-Style Interval example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  },
  {
    "slug": "time-cap-quality-block",
    "name": "Time-Cap Quality Block",
    "category": "Timed Work Capacity",
    "programming_type": "time_cap",
    "definition": "Time-Cap Quality Block: a structured programming method for organizing training work.",
    "coach_summary": "Use Time-Cap Quality Block to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for Time-Cap Quality Block and keep movement quality high.",
    "primary_development_goal": "repeatability under fatigue",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "mixed"
    ],
    "fatigue_profile": {
      "fatigue_intentional": true,
      "fatigue_level": "moderate",
      "technical_risk_under_fatigue": "moderate",
      "impact_risk_under_fatigue": "moderate",
      "grip_risk_under_fatigue": "low"
    },
    "supervision_level": "recommended",
    "what_it_is": "Time-Cap Quality Block organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 8,
          "work_target_seconds": 20,
          "rest_target_seconds": 40,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 12,
          "work_target_seconds": 30,
          "rest_target_seconds": 30,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 16,
          "work_target_seconds": 40,
          "rest_target_seconds": 20,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "low_skill_calisthenics",
        "bodyweight_strength",
        "machine_cardio",
        "locomotion"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "max_velocity_sprint"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "time_cap_quality_block_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "time_cap_quality_block_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "preferred_session_phase": "sustained_capacity",
      "allowed_session_phases": [
        "capacity",
        "resilience",
        "sustained_capacity"
      ],
      "default_duration_minutes": 12,
      "default_work_seconds": 30,
      "default_rest_seconds": 30,
      "default_rpe_range": [
        6,
        8
      ],
      "coaching_complexity": "moderate",
      "group_friendly": false,
      "equipment_flexibility": "high",
      "requires_timer": true,
      "requires_stations": false,
      "requires_lanes": false,
      "requires_clear_runout": false,
      "requires_score_tracking": false,
      "safety_notes": [
        "Choose simple movements",
        "Match work to recovery capacity"
      ]
    },
    "phase_profiles": [
      {
        "phase_key": "sustained_capacity",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "output",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "conditional",
        "fit_weight": 2
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 8,
        "default_rounds": null,
        "default_work_seconds": 20,
        "default_rest_seconds": 40,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 12,
        "default_rounds": null,
        "default_work_seconds": 30,
        "default_rest_seconds": 30,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 16,
        "default_rounds": null,
        "default_work_seconds": 40,
        "default_rest_seconds": 20,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "Time-Cap Quality Block example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  },
  {
    "slug": "station-rotation-format",
    "name": "Station Rotation Format",
    "category": "Circuit Training",
    "programming_type": "station_rotation",
    "definition": "Station Rotation Format: a structured programming method for organizing training work.",
    "coach_summary": "Use Station Rotation Format to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for Station Rotation Format and keep movement quality high.",
    "primary_development_goal": "repeatability under fatigue",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "mixed"
    ],
    "fatigue_profile": {
      "fatigue_intentional": true,
      "fatigue_level": "moderate",
      "technical_risk_under_fatigue": "moderate",
      "impact_risk_under_fatigue": "moderate",
      "grip_risk_under_fatigue": "low"
    },
    "supervision_level": "recommended",
    "what_it_is": "Station Rotation Format organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 8,
          "work_target_seconds": 20,
          "rest_target_seconds": 40,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 12,
          "work_target_seconds": 30,
          "rest_target_seconds": 30,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 16,
          "work_target_seconds": 40,
          "rest_target_seconds": 20,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "low_skill_calisthenics",
        "bodyweight_strength",
        "machine_cardio",
        "locomotion"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "max_velocity_sprint"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "station_rotation_format_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "station_rotation_format_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "preferred_session_phase": "sustained_capacity",
      "allowed_session_phases": [
        "capacity",
        "resilience",
        "sustained_capacity"
      ],
      "default_duration_minutes": 12,
      "default_work_seconds": 30,
      "default_rest_seconds": 30,
      "default_rpe_range": [
        6,
        8
      ],
      "coaching_complexity": "moderate",
      "group_friendly": true,
      "equipment_flexibility": "high",
      "requires_timer": true,
      "requires_stations": true,
      "requires_lanes": false,
      "requires_clear_runout": false,
      "requires_score_tracking": false,
      "safety_notes": [
        "Choose simple movements",
        "Match work to recovery capacity"
      ]
    },
    "phase_profiles": [
      {
        "phase_key": "sustained_capacity",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "output",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "conditional",
        "fit_weight": 2
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 8,
        "default_rounds": null,
        "default_work_seconds": 20,
        "default_rest_seconds": 40,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 12,
        "default_rounds": null,
        "default_work_seconds": 30,
        "default_rest_seconds": 30,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 16,
        "default_rounds": null,
        "default_work_seconds": 40,
        "default_rest_seconds": 20,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "Station Rotation Format example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  },
  {
    "slug": "coach-controlled-interval",
    "name": "Coach-Controlled Interval",
    "category": "Interval Training",
    "programming_type": "coach_interval",
    "definition": "Coach-Controlled Interval: a structured programming method for organizing training work.",
    "coach_summary": "Use Coach-Controlled Interval to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for Coach-Controlled Interval and keep movement quality high.",
    "primary_development_goal": "repeatability under fatigue",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "mixed"
    ],
    "fatigue_profile": {
      "fatigue_intentional": true,
      "fatigue_level": "moderate",
      "technical_risk_under_fatigue": "moderate",
      "impact_risk_under_fatigue": "moderate",
      "grip_risk_under_fatigue": "low"
    },
    "supervision_level": "recommended",
    "what_it_is": "Coach-Controlled Interval organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 8,
          "work_target_seconds": 20,
          "rest_target_seconds": 40,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 12,
          "work_target_seconds": 30,
          "rest_target_seconds": 30,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 16,
          "work_target_seconds": 40,
          "rest_target_seconds": 20,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "low_skill_calisthenics",
        "bodyweight_strength",
        "machine_cardio",
        "locomotion"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "max_velocity_sprint"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "coach_controlled_interval_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "coach_controlled_interval_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "preferred_session_phase": "sustained_capacity",
      "allowed_session_phases": [
        "capacity",
        "resilience",
        "sustained_capacity"
      ],
      "default_duration_minutes": 12,
      "default_work_seconds": 30,
      "default_rest_seconds": 30,
      "default_rpe_range": [
        6,
        8
      ],
      "coaching_complexity": "moderate",
      "group_friendly": false,
      "equipment_flexibility": "high",
      "requires_timer": true,
      "requires_stations": false,
      "requires_lanes": false,
      "requires_clear_runout": false,
      "requires_score_tracking": false,
      "safety_notes": [
        "Choose simple movements",
        "Match work to recovery capacity"
      ]
    },
    "phase_profiles": [
      {
        "phase_key": "sustained_capacity",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "output",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "conditional",
        "fit_weight": 2
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 8,
        "default_rounds": null,
        "default_work_seconds": 20,
        "default_rest_seconds": 40,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 12,
        "default_rounds": null,
        "default_work_seconds": 30,
        "default_rest_seconds": 30,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 16,
        "default_rounds": null,
        "default_work_seconds": 40,
        "default_rest_seconds": 20,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "Coach-Controlled Interval example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  },
  {
    "slug": "partner-alternating-interval",
    "name": "Partner Alternating Interval",
    "category": "Partner / Team Relay",
    "programming_type": "partner_interval",
    "definition": "Partner Alternating Interval: a structured programming method for organizing training work.",
    "coach_summary": "Use Partner Alternating Interval to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for Partner Alternating Interval and keep movement quality high.",
    "primary_development_goal": "repeatability under fatigue",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "mixed"
    ],
    "fatigue_profile": {
      "fatigue_intentional": true,
      "fatigue_level": "moderate",
      "technical_risk_under_fatigue": "moderate",
      "impact_risk_under_fatigue": "moderate",
      "grip_risk_under_fatigue": "low"
    },
    "supervision_level": "recommended",
    "what_it_is": "Partner Alternating Interval organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 8,
          "work_target_seconds": 20,
          "rest_target_seconds": 40,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 12,
          "work_target_seconds": 30,
          "rest_target_seconds": 30,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 16,
          "work_target_seconds": 40,
          "rest_target_seconds": 20,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "partner_drill",
        "game",
        "locomotion",
        "low_skill_calisthenics"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "max_velocity_sprint"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "partner_alternating_interval_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "partner_alternating_interval_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "group_friendly": true,
      "coaching_complexity": "moderate"
    },
    "phase_profiles": [
      {
        "phase_key": "sustained_capacity",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "output",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "conditional",
        "fit_weight": 2
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 8,
        "default_rounds": null,
        "default_work_seconds": 20,
        "default_rest_seconds": 40,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 12,
        "default_rounds": null,
        "default_work_seconds": 30,
        "default_rest_seconds": 30,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 16,
        "default_rounds": null,
        "default_work_seconds": 40,
        "default_rest_seconds": 20,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "Partner Alternating Interval example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  },
  {
    "slug": "emom",
    "name": "EMOM",
    "category": "EMOM",
    "programming_type": "emom",
    "definition": "Every Minute On the Minute: athletes complete assigned work at the start of each minute and rest for the remaining time.",
    "coach_summary": "A structured density format that controls pace, keeps groups organized, and builds repeatability when the work fits inside each minute.",
    "athlete_summary": "Do your assigned work when the minute starts, then rest until the next minute.",
    "primary_development_goal": "repeatability and structured density",
    "secondary_development_goals": [
      "pacing",
      "strength endurance",
      "work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "mixed",
      "local_muscular_endurance"
    ],
    "fatigue_profile": {
      "fatigue_intentional": true,
      "fatigue_level": "moderate",
      "technical_risk_under_fatigue": "moderate",
      "impact_risk_under_fatigue": "depends_on_exercises",
      "grip_risk_under_fatigue": "depends_on_exercises"
    },
    "supervision_level": "recommended",
    "what_it_is": "EMOM means Every Minute On the Minute. The athlete starts a task at the beginning of each minute. Any time left in the minute becomes rest.",
    "why_it_matters": "EMOM builds repeatability, pacing, and density because athletes must complete quality work repeatedly while managing rest.",
    "when_to_use": "Use late in the session for Sustained Capacity or during Capacity when loads are moderate and quality remains high.",
    "when_not_to_use": "Do not use EMOM for advanced skill learning, max sprinting, max plyometrics, or technical tumbling under fatigue.",
    "common_misuse": [
      "prescribing too much work so no rest remains",
      "using movements that are too technical",
      "turning every EMOM into punishment",
      "ignoring form breakdown"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 8,
          "work_target_seconds": 20,
          "rest_target_seconds": 40,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 12,
          "work_target_seconds": 25,
          "rest_target_seconds": 35,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 16,
          "work_target_seconds": 30,
          "rest_target_seconds": 30,
          "rpe": "7-8"
        }
      },
      "work_rest_options": [
        "1 movement EMOM",
        "alternating EMOM",
        "4-station EMOM"
      ],
      "typical_total_duration_minutes": [
        8,
        10,
        12,
        16,
        20
      ],
      "recommended_density": "Work should usually take 20-35 seconds, leaving meaningful rest.",
      "pacing_notes": "If work consistently takes more than 40 seconds, reduce reps, load, or complexity."
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "bodyweight_strength",
        "low_skill_calisthenics",
        "carries",
        "crawls",
        "jump_rope",
        "machine_cardio",
        "med_ball"
      ],
      "conditional_exercise_types": [
        "loaded_strength",
        "grip_hang",
        "low_amplitude_elastic"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "max_velocity_sprint",
        "high_impact_plyometrics"
      ]
    },
    "quality_standards": [
      "athlete completes work with at least 15-20 seconds remaining most minutes",
      "movement quality stays consistent",
      "no pain",
      "no rushed unsafe reps",
      "posture remains organized"
    ],
    "stop_rules": [
      "stop or reduce work if athlete has no rest for two consecutive minutes",
      "stop if movement quality degrades",
      "stop if pain appears",
      "stop if athlete cannot safely complete the assigned task"
    ],
    "validator_rules": [
      {
        "rule_key": "emom_no_rest_remaining",
        "condition_json": {
          "estimated_work_seconds_gt": 45
        },
        "message": "This EMOM may leave too little rest. Reduce reps, load, or complexity.",
        "severity": "warning"
      },
      {
        "rule_key": "emom_advanced_skill",
        "condition_json": {
          "contains_advanced_skill": true
        },
        "message": "Advanced skills should not be placed in EMOM fatigue formats.",
        "severity": "strong_warning"
      }
    ],
    "workout_builder_rules": {
      "preferred_session_phase": "sustained_capacity",
      "allowed_session_phases": [
        "capacity",
        "resilience",
        "sustained_capacity"
      ],
      "default_duration_minutes": 12,
      "default_rounds": null,
      "default_work_seconds": 25,
      "default_rest_seconds": 35,
      "default_rpe_range": [
        6,
        8
      ],
      "recommended_age_min": 8,
      "coaching_complexity": "moderate",
      "group_friendly": true,
      "equipment_flexibility": "high",
      "requires_timer": true,
      "requires_stations": false,
      "requires_lanes": false,
      "requires_clear_runout": false,
      "requires_score_tracking": false,
      "safety_notes": [
        "Choose simple movements",
        "Ensure work fits within the minute",
        "Avoid advanced skills under fatigue"
      ]
    },
    "phase_profiles": [
      {
        "phase_key": "sustained_capacity",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "capacity",
        "role": "secondary",
        "fit_weight": 4
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "output",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "avoid",
        "fit_weight": 1
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 8,
        "default_rounds": 8,
        "default_work_seconds": 20,
        "default_rest_seconds": 40,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "8 minutes, ~20s work per minute."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 12,
        "default_rounds": 12,
        "default_work_seconds": 25,
        "default_rest_seconds": 35,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "12-minute EMOM with 25s work target."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 16,
        "default_rounds": 16,
        "default_work_seconds": 30,
        "default_rest_seconds": 30,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "16-minute EMOM; reduce load if rest disappears."
      }
    ],
    "examples": [
      {
        "label": "4-station EMOM",
        "audience": "intermediate",
        "example_json": {
          "minutes": 12,
          "pattern": [
            {
              "minute_mod": 1,
              "task": "Goblet squat x 8"
            },
            {
              "minute_mod": 2,
              "task": "Bear crawl 10 yards"
            },
            {
              "minute_mod": 3,
              "task": "Jump rope 30 sec"
            },
            {
              "minute_mod": 0,
              "task": "Rest / mobility"
            }
          ]
        },
        "coaching_notes": "Example only. Actual workout generated by Workout Builder."
      }
    ]
  },
  {
    "slug": "alternating-emom",
    "name": "Alternating EMOM",
    "category": "EMOM",
    "programming_type": "alternating_emom",
    "definition": "Alternating EMOM: a structured programming method for organizing training work.",
    "coach_summary": "Use Alternating EMOM to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for Alternating EMOM and keep movement quality high.",
    "primary_development_goal": "repeatability under fatigue",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "mixed"
    ],
    "fatigue_profile": {
      "fatigue_intentional": true,
      "fatigue_level": "moderate",
      "technical_risk_under_fatigue": "moderate",
      "impact_risk_under_fatigue": "moderate",
      "grip_risk_under_fatigue": "low"
    },
    "supervision_level": "recommended",
    "what_it_is": "Alternating EMOM organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 8,
          "work_target_seconds": 20,
          "rest_target_seconds": 40,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 12,
          "work_target_seconds": 30,
          "rest_target_seconds": 30,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 16,
          "work_target_seconds": 40,
          "rest_target_seconds": 20,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "low_skill_calisthenics",
        "bodyweight_strength",
        "machine_cardio",
        "locomotion"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "max_velocity_sprint"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "alternating_emom_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "alternating_emom_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "preferred_session_phase": "sustained_capacity",
      "allowed_session_phases": [
        "capacity",
        "resilience",
        "sustained_capacity"
      ],
      "default_duration_minutes": 12,
      "default_work_seconds": 30,
      "default_rest_seconds": 30,
      "default_rpe_range": [
        6,
        8
      ],
      "coaching_complexity": "moderate",
      "group_friendly": true,
      "equipment_flexibility": "high",
      "requires_timer": true,
      "requires_stations": false,
      "requires_lanes": false,
      "requires_clear_runout": false,
      "requires_score_tracking": false,
      "safety_notes": [
        "Choose simple movements",
        "Match work to recovery capacity"
      ]
    },
    "phase_profiles": [
      {
        "phase_key": "sustained_capacity",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "output",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "conditional",
        "fit_weight": 2
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 8,
        "default_rounds": null,
        "default_work_seconds": 20,
        "default_rest_seconds": 40,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 12,
        "default_rounds": null,
        "default_work_seconds": 30,
        "default_rest_seconds": 30,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 16,
        "default_rounds": null,
        "default_work_seconds": 40,
        "default_rest_seconds": 20,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "Alternating EMOM example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  },
  {
    "slug": "strength-endurance-emom",
    "name": "Strength-Endurance EMOM",
    "category": "EMOM",
    "programming_type": "strength_endurance_emom",
    "definition": "Strength-Endurance EMOM: a structured programming method for organizing training work.",
    "coach_summary": "Use Strength-Endurance EMOM to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for Strength-Endurance EMOM and keep movement quality high.",
    "primary_development_goal": "repeatability under fatigue",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "mixed"
    ],
    "fatigue_profile": {
      "fatigue_intentional": true,
      "fatigue_level": "moderate",
      "technical_risk_under_fatigue": "moderate",
      "impact_risk_under_fatigue": "moderate",
      "grip_risk_under_fatigue": "low"
    },
    "supervision_level": "recommended",
    "what_it_is": "Strength-Endurance EMOM organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 8,
          "work_target_seconds": 20,
          "rest_target_seconds": 40,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 12,
          "work_target_seconds": 30,
          "rest_target_seconds": 30,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 16,
          "work_target_seconds": 40,
          "rest_target_seconds": 20,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "low_skill_calisthenics",
        "bodyweight_strength",
        "machine_cardio",
        "locomotion"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "max_velocity_sprint"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "strength_endurance_emom_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "strength_endurance_emom_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "preferred_session_phase": "sustained_capacity",
      "allowed_session_phases": [
        "capacity",
        "resilience",
        "sustained_capacity"
      ],
      "default_duration_minutes": 12,
      "default_work_seconds": 30,
      "default_rest_seconds": 30,
      "default_rpe_range": [
        6,
        8
      ],
      "coaching_complexity": "moderate",
      "group_friendly": true,
      "equipment_flexibility": "high",
      "requires_timer": true,
      "requires_stations": false,
      "requires_lanes": false,
      "requires_clear_runout": false,
      "requires_score_tracking": false,
      "safety_notes": [
        "Choose simple movements",
        "Match work to recovery capacity"
      ]
    },
    "phase_profiles": [
      {
        "phase_key": "sustained_capacity",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "output",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "conditional",
        "fit_weight": 2
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 8,
        "default_rounds": null,
        "default_work_seconds": 20,
        "default_rest_seconds": 40,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 12,
        "default_rounds": null,
        "default_work_seconds": 30,
        "default_rest_seconds": 30,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 16,
        "default_rounds": null,
        "default_work_seconds": 40,
        "default_rest_seconds": 20,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "Strength-Endurance EMOM example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  },
  {
    "slug": "conditioning-emom",
    "name": "Conditioning EMOM",
    "category": "EMOM",
    "programming_type": "conditioning_emom",
    "definition": "Conditioning EMOM: a structured programming method for organizing training work.",
    "coach_summary": "Use Conditioning EMOM to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for Conditioning EMOM and keep movement quality high.",
    "primary_development_goal": "repeatability under fatigue",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "mixed"
    ],
    "fatigue_profile": {
      "fatigue_intentional": true,
      "fatigue_level": "moderate",
      "technical_risk_under_fatigue": "moderate",
      "impact_risk_under_fatigue": "moderate",
      "grip_risk_under_fatigue": "low"
    },
    "supervision_level": "recommended",
    "what_it_is": "Conditioning EMOM organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 8,
          "work_target_seconds": 20,
          "rest_target_seconds": 40,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 12,
          "work_target_seconds": 30,
          "rest_target_seconds": 30,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 16,
          "work_target_seconds": 40,
          "rest_target_seconds": 20,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "low_skill_calisthenics",
        "bodyweight_strength",
        "machine_cardio",
        "locomotion"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "max_velocity_sprint"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "conditioning_emom_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "conditioning_emom_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "preferred_session_phase": "sustained_capacity",
      "allowed_session_phases": [
        "capacity",
        "resilience",
        "sustained_capacity"
      ],
      "default_duration_minutes": 12,
      "default_work_seconds": 30,
      "default_rest_seconds": 30,
      "default_rpe_range": [
        6,
        8
      ],
      "coaching_complexity": "moderate",
      "group_friendly": true,
      "equipment_flexibility": "high",
      "requires_timer": true,
      "requires_stations": false,
      "requires_lanes": false,
      "requires_clear_runout": false,
      "requires_score_tracking": false,
      "safety_notes": [
        "Choose simple movements",
        "Match work to recovery capacity"
      ]
    },
    "phase_profiles": [
      {
        "phase_key": "sustained_capacity",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "output",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "conditional",
        "fit_weight": 2
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 8,
        "default_rounds": null,
        "default_work_seconds": 20,
        "default_rest_seconds": 40,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 12,
        "default_rounds": null,
        "default_work_seconds": 30,
        "default_rest_seconds": 30,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 16,
        "default_rounds": null,
        "default_work_seconds": 40,
        "default_rest_seconds": 20,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "Conditioning EMOM example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  },
  {
    "slug": "amrap",
    "name": "AMRAP",
    "category": "AMRAP",
    "programming_type": "amrap",
    "definition": "AMRAP: a structured programming method for organizing training work.",
    "coach_summary": "Use AMRAP to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for AMRAP and keep movement quality high.",
    "primary_development_goal": "density and repeatability within a fixed time cap",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "mixed"
    ],
    "fatigue_profile": {
      "fatigue_intentional": true,
      "fatigue_level": "moderate",
      "technical_risk_under_fatigue": "moderate",
      "impact_risk_under_fatigue": "moderate",
      "grip_risk_under_fatigue": "low"
    },
    "supervision_level": "recommended",
    "what_it_is": "AMRAP organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 6,
          "cap_minutes": 6,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 8,
          "cap_minutes": 8,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 10,
          "cap_minutes": 10,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "low_skill_calisthenics",
        "bodyweight_strength",
        "machine_cardio",
        "locomotion"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "max_velocity_sprint"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "amrap_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "amrap_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "requires_score_tracking": true,
      "default_cap_minutes": 8
    },
    "phase_profiles": [
      {
        "phase_key": "sustained_capacity",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "output",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "conditional",
        "fit_weight": 2
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 6,
        "default_rounds": null,
        "default_work_seconds": null,
        "default_rest_seconds": null,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 8,
        "default_rounds": null,
        "default_work_seconds": null,
        "default_rest_seconds": null,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 10,
        "default_rounds": null,
        "default_work_seconds": null,
        "default_rest_seconds": null,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "AMRAP example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  },
  {
    "slug": "quality-amrap",
    "name": "Quality AMRAP",
    "category": "AMRAP",
    "programming_type": "quality_amrap",
    "definition": "Quality AMRAP: a structured programming method for organizing training work.",
    "coach_summary": "Use Quality AMRAP to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for Quality AMRAP and keep movement quality high.",
    "primary_development_goal": "density and repeatability within a fixed time cap",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "mixed"
    ],
    "fatigue_profile": {
      "fatigue_intentional": true,
      "fatigue_level": "moderate",
      "technical_risk_under_fatigue": "moderate",
      "impact_risk_under_fatigue": "moderate",
      "grip_risk_under_fatigue": "low"
    },
    "supervision_level": "recommended",
    "what_it_is": "Quality AMRAP organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 6,
          "cap_minutes": 6,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 8,
          "cap_minutes": 8,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 10,
          "cap_minutes": 10,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "low_skill_calisthenics",
        "bodyweight_strength",
        "machine_cardio",
        "locomotion"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "max_velocity_sprint"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "quality_amrap_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "quality_amrap_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "requires_score_tracking": true,
      "default_cap_minutes": 8
    },
    "phase_profiles": [
      {
        "phase_key": "sustained_capacity",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "output",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "conditional",
        "fit_weight": 2
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 6,
        "default_rounds": null,
        "default_work_seconds": null,
        "default_rest_seconds": null,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 8,
        "default_rounds": null,
        "default_work_seconds": null,
        "default_rest_seconds": null,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 10,
        "default_rounds": null,
        "default_work_seconds": null,
        "default_rest_seconds": null,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "Quality AMRAP example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  },
  {
    "slug": "density-block",
    "name": "Density Block",
    "category": "Density Blocks",
    "programming_type": "density_block",
    "definition": "Density Block: a structured programming method for organizing training work.",
    "coach_summary": "Use Density Block to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for Density Block and keep movement quality high.",
    "primary_development_goal": "repeatability under fatigue",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "mixed"
    ],
    "fatigue_profile": {
      "fatigue_intentional": true,
      "fatigue_level": "moderate",
      "technical_risk_under_fatigue": "moderate",
      "impact_risk_under_fatigue": "moderate",
      "grip_risk_under_fatigue": "low"
    },
    "supervision_level": "recommended",
    "what_it_is": "Density Block organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 8,
          "work_target_seconds": 20,
          "rest_target_seconds": 40,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 12,
          "work_target_seconds": 30,
          "rest_target_seconds": 30,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 16,
          "work_target_seconds": 40,
          "rest_target_seconds": 20,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "low_skill_calisthenics",
        "bodyweight_strength",
        "machine_cardio",
        "locomotion"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "max_velocity_sprint"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "density_block_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "density_block_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "preferred_session_phase": "sustained_capacity",
      "allowed_session_phases": [
        "capacity",
        "resilience",
        "sustained_capacity"
      ],
      "default_duration_minutes": 12,
      "default_work_seconds": 30,
      "default_rest_seconds": 30,
      "default_rpe_range": [
        6,
        8
      ],
      "coaching_complexity": "moderate",
      "group_friendly": false,
      "equipment_flexibility": "high",
      "requires_timer": true,
      "requires_stations": false,
      "requires_lanes": false,
      "requires_clear_runout": false,
      "requires_score_tracking": false,
      "safety_notes": [
        "Choose simple movements",
        "Match work to recovery capacity"
      ]
    },
    "phase_profiles": [
      {
        "phase_key": "sustained_capacity",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "output",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "conditional",
        "fit_weight": 2
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 8,
        "default_rounds": null,
        "default_work_seconds": 20,
        "default_rest_seconds": 40,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 12,
        "default_rounds": null,
        "default_work_seconds": 30,
        "default_rest_seconds": 30,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 16,
        "default_rounds": null,
        "default_work_seconds": 40,
        "default_rest_seconds": 20,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "Density Block example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  },
  {
    "slug": "escalating-density-training",
    "name": "Escalating Density Training",
    "category": "Density Blocks",
    "programming_type": "escalating_density",
    "definition": "Escalating Density Training: a structured programming method for organizing training work.",
    "coach_summary": "Use Escalating Density Training to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for Escalating Density Training and keep movement quality high.",
    "primary_development_goal": "repeatability under fatigue",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "mixed"
    ],
    "fatigue_profile": {
      "fatigue_intentional": true,
      "fatigue_level": "moderate",
      "technical_risk_under_fatigue": "moderate",
      "impact_risk_under_fatigue": "moderate",
      "grip_risk_under_fatigue": "low"
    },
    "supervision_level": "recommended",
    "what_it_is": "Escalating Density Training organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 8,
          "work_target_seconds": 20,
          "rest_target_seconds": 40,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 12,
          "work_target_seconds": 30,
          "rest_target_seconds": 30,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 16,
          "work_target_seconds": 40,
          "rest_target_seconds": 20,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "low_skill_calisthenics",
        "bodyweight_strength",
        "machine_cardio",
        "locomotion"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "max_velocity_sprint"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "escalating_density_training_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "escalating_density_training_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "preferred_session_phase": "sustained_capacity",
      "allowed_session_phases": [
        "capacity",
        "resilience",
        "sustained_capacity"
      ],
      "default_duration_minutes": 12,
      "default_work_seconds": 30,
      "default_rest_seconds": 30,
      "default_rpe_range": [
        6,
        8
      ],
      "coaching_complexity": "moderate",
      "group_friendly": false,
      "equipment_flexibility": "high",
      "requires_timer": true,
      "requires_stations": false,
      "requires_lanes": false,
      "requires_clear_runout": false,
      "requires_score_tracking": false,
      "safety_notes": [
        "Choose simple movements",
        "Match work to recovery capacity"
      ]
    },
    "phase_profiles": [
      {
        "phase_key": "sustained_capacity",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "output",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "conditional",
        "fit_weight": 2
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 8,
        "default_rounds": null,
        "default_work_seconds": 20,
        "default_rest_seconds": 40,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 12,
        "default_rounds": null,
        "default_work_seconds": 30,
        "default_rest_seconds": 30,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 16,
        "default_rounds": null,
        "default_work_seconds": 40,
        "default_rest_seconds": 20,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "Escalating Density Training example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  },
  {
    "slug": "ladder-format",
    "name": "Ladder Format",
    "category": "Density Blocks",
    "programming_type": "ladder",
    "definition": "Ladder Format: a structured programming method for organizing training work.",
    "coach_summary": "Use Ladder Format to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for Ladder Format and keep movement quality high.",
    "primary_development_goal": "repeatability under fatigue",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "mixed"
    ],
    "fatigue_profile": {
      "fatigue_intentional": true,
      "fatigue_level": "moderate",
      "technical_risk_under_fatigue": "moderate",
      "impact_risk_under_fatigue": "moderate",
      "grip_risk_under_fatigue": "low"
    },
    "supervision_level": "recommended",
    "what_it_is": "Ladder Format organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 8,
          "work_target_seconds": 20,
          "rest_target_seconds": 40,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 12,
          "work_target_seconds": 30,
          "rest_target_seconds": 30,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 16,
          "work_target_seconds": 40,
          "rest_target_seconds": 20,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "low_skill_calisthenics",
        "bodyweight_strength",
        "machine_cardio",
        "locomotion"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "max_velocity_sprint"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "ladder_format_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "ladder_format_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "preferred_session_phase": "sustained_capacity",
      "allowed_session_phases": [
        "capacity",
        "resilience",
        "sustained_capacity"
      ],
      "default_duration_minutes": 12,
      "default_work_seconds": 30,
      "default_rest_seconds": 30,
      "default_rpe_range": [
        6,
        8
      ],
      "coaching_complexity": "moderate",
      "group_friendly": false,
      "equipment_flexibility": "high",
      "requires_timer": true,
      "requires_stations": false,
      "requires_lanes": false,
      "requires_clear_runout": false,
      "requires_score_tracking": false,
      "safety_notes": [
        "Choose simple movements",
        "Match work to recovery capacity"
      ]
    },
    "phase_profiles": [
      {
        "phase_key": "sustained_capacity",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "output",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "conditional",
        "fit_weight": 2
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 8,
        "default_rounds": null,
        "default_work_seconds": 20,
        "default_rest_seconds": 40,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 12,
        "default_rounds": null,
        "default_work_seconds": 30,
        "default_rest_seconds": 30,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 16,
        "default_rounds": null,
        "default_work_seconds": 40,
        "default_rest_seconds": 20,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "Ladder Format example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  },
  {
    "slug": "pyramid-format",
    "name": "Pyramid Format",
    "category": "Density Blocks",
    "programming_type": "pyramid",
    "definition": "Pyramid Format: a structured programming method for organizing training work.",
    "coach_summary": "Use Pyramid Format to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for Pyramid Format and keep movement quality high.",
    "primary_development_goal": "repeatability under fatigue",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "mixed"
    ],
    "fatigue_profile": {
      "fatigue_intentional": true,
      "fatigue_level": "moderate",
      "technical_risk_under_fatigue": "moderate",
      "impact_risk_under_fatigue": "moderate",
      "grip_risk_under_fatigue": "low"
    },
    "supervision_level": "recommended",
    "what_it_is": "Pyramid Format organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 8,
          "work_target_seconds": 20,
          "rest_target_seconds": 40,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 12,
          "work_target_seconds": 30,
          "rest_target_seconds": 30,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 16,
          "work_target_seconds": 40,
          "rest_target_seconds": 20,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "low_skill_calisthenics",
        "bodyweight_strength",
        "machine_cardio",
        "locomotion"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "max_velocity_sprint"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "pyramid_format_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "pyramid_format_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "preferred_session_phase": "sustained_capacity",
      "allowed_session_phases": [
        "capacity",
        "resilience",
        "sustained_capacity"
      ],
      "default_duration_minutes": 12,
      "default_work_seconds": 30,
      "default_rest_seconds": 30,
      "default_rpe_range": [
        6,
        8
      ],
      "coaching_complexity": "moderate",
      "group_friendly": false,
      "equipment_flexibility": "high",
      "requires_timer": true,
      "requires_stations": false,
      "requires_lanes": false,
      "requires_clear_runout": false,
      "requires_score_tracking": false,
      "safety_notes": [
        "Choose simple movements",
        "Match work to recovery capacity"
      ]
    },
    "phase_profiles": [
      {
        "phase_key": "sustained_capacity",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "output",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "conditional",
        "fit_weight": 2
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 8,
        "default_rounds": null,
        "default_work_seconds": 20,
        "default_rest_seconds": 40,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 12,
        "default_rounds": null,
        "default_work_seconds": 30,
        "default_rest_seconds": 30,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 16,
        "default_rounds": null,
        "default_work_seconds": 40,
        "default_rest_seconds": 20,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "Pyramid Format example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  },
  {
    "slug": "tempo-run-intervals",
    "name": "Tempo Run Intervals",
    "category": "Tempo Conditioning",
    "programming_type": "tempo_run",
    "definition": "Tempo Run Intervals: a structured programming method for organizing training work.",
    "coach_summary": "Use Tempo Run Intervals to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for Tempo Run Intervals and keep movement quality high.",
    "primary_development_goal": "repeatability under fatigue",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "mixed"
    ],
    "fatigue_profile": {
      "fatigue_intentional": true,
      "fatigue_level": "moderate",
      "technical_risk_under_fatigue": "moderate",
      "impact_risk_under_fatigue": "moderate",
      "grip_risk_under_fatigue": "low"
    },
    "supervision_level": "recommended",
    "what_it_is": "Tempo Run Intervals organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 8,
          "work_target_seconds": 20,
          "rest_target_seconds": 40,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 12,
          "work_target_seconds": 30,
          "rest_target_seconds": 30,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 16,
          "work_target_seconds": 40,
          "rest_target_seconds": 20,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "low_skill_calisthenics",
        "bodyweight_strength",
        "machine_cardio",
        "locomotion"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "max_velocity_sprint"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "tempo_run_intervals_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "tempo_run_intervals_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "preferred_session_phase": "sustained_capacity",
      "allowed_session_phases": [
        "capacity",
        "resilience",
        "sustained_capacity"
      ],
      "default_duration_minutes": 12,
      "default_work_seconds": 30,
      "default_rest_seconds": 30,
      "default_rpe_range": [
        6,
        8
      ],
      "coaching_complexity": "moderate",
      "group_friendly": false,
      "equipment_flexibility": "high",
      "requires_timer": true,
      "requires_stations": false,
      "requires_lanes": false,
      "requires_clear_runout": false,
      "requires_score_tracking": false,
      "safety_notes": [
        "Choose simple movements",
        "Match work to recovery capacity"
      ]
    },
    "phase_profiles": [
      {
        "phase_key": "sustained_capacity",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "output",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "conditional",
        "fit_weight": 2
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 8,
        "default_rounds": null,
        "default_work_seconds": 20,
        "default_rest_seconds": 40,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 12,
        "default_rounds": null,
        "default_work_seconds": 30,
        "default_rest_seconds": 30,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 16,
        "default_rounds": null,
        "default_work_seconds": 40,
        "default_rest_seconds": 20,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "Tempo Run Intervals example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  },
  {
    "slug": "tempo-shuttle-intervals",
    "name": "Tempo Shuttle Intervals",
    "category": "Tempo Conditioning",
    "programming_type": "tempo_shuttle",
    "definition": "Tempo Shuttle Intervals: a structured programming method for organizing training work.",
    "coach_summary": "Use Tempo Shuttle Intervals to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for Tempo Shuttle Intervals and keep movement quality high.",
    "primary_development_goal": "repeatability under fatigue",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "mixed"
    ],
    "fatigue_profile": {
      "fatigue_intentional": true,
      "fatigue_level": "moderate",
      "technical_risk_under_fatigue": "moderate",
      "impact_risk_under_fatigue": "moderate",
      "grip_risk_under_fatigue": "low"
    },
    "supervision_level": "recommended",
    "what_it_is": "Tempo Shuttle Intervals organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 8,
          "work_target_seconds": 20,
          "rest_target_seconds": 40,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 12,
          "work_target_seconds": 30,
          "rest_target_seconds": 30,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 16,
          "work_target_seconds": 40,
          "rest_target_seconds": 20,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "low_skill_calisthenics",
        "bodyweight_strength",
        "machine_cardio",
        "locomotion"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "max_velocity_sprint"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "tempo_shuttle_intervals_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "tempo_shuttle_intervals_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "preferred_session_phase": "sustained_capacity",
      "allowed_session_phases": [
        "capacity",
        "resilience",
        "sustained_capacity"
      ],
      "default_duration_minutes": 12,
      "default_work_seconds": 30,
      "default_rest_seconds": 30,
      "default_rpe_range": [
        6,
        8
      ],
      "coaching_complexity": "moderate",
      "group_friendly": false,
      "equipment_flexibility": "high",
      "requires_timer": true,
      "requires_stations": false,
      "requires_lanes": false,
      "requires_clear_runout": false,
      "requires_score_tracking": false,
      "safety_notes": [
        "Choose simple movements",
        "Match work to recovery capacity"
      ]
    },
    "phase_profiles": [
      {
        "phase_key": "sustained_capacity",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "output",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "conditional",
        "fit_weight": 2
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 8,
        "default_rounds": null,
        "default_work_seconds": 20,
        "default_rest_seconds": 40,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 12,
        "default_rounds": null,
        "default_work_seconds": 30,
        "default_rest_seconds": 30,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 16,
        "default_rounds": null,
        "default_work_seconds": 40,
        "default_rest_seconds": 20,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "Tempo Shuttle Intervals example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  },
  {
    "slug": "walk-jog-intervals",
    "name": "Walk-Jog Intervals",
    "category": "Aerobic Base / Zone 2",
    "programming_type": "walk_jog",
    "definition": "Walk-Jog Intervals: a structured programming method for organizing training work.",
    "coach_summary": "Use Walk-Jog Intervals to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for Walk-Jog Intervals and keep movement quality high.",
    "primary_development_goal": "repeatability under fatigue",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "aerobic"
    ],
    "fatigue_profile": {
      "fatigue_intentional": false,
      "fatigue_level": "low",
      "technical_risk_under_fatigue": "low",
      "impact_risk_under_fatigue": "low",
      "grip_risk_under_fatigue": "low"
    },
    "supervision_level": "recommended",
    "what_it_is": "Walk-Jog Intervals organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 15,
          "work_target_seconds": 60,
          "rest_target_seconds": 30,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 20,
          "work_target_seconds": 90,
          "rest_target_seconds": 30,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 30,
          "work_target_seconds": 120,
          "rest_target_seconds": 30,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "low_skill_calisthenics",
        "bodyweight_strength",
        "machine_cardio",
        "locomotion"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "max_velocity_sprint"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "walk_jog_intervals_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "walk_jog_intervals_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "preferred_session_phase": "sustained_capacity",
      "allowed_session_phases": [
        "capacity",
        "resilience",
        "sustained_capacity"
      ],
      "default_duration_minutes": 20,
      "default_work_seconds": 90,
      "default_rest_seconds": 30,
      "default_rpe_range": [
        6,
        8
      ],
      "coaching_complexity": "moderate",
      "group_friendly": false,
      "equipment_flexibility": "high",
      "requires_timer": true,
      "requires_stations": false,
      "requires_lanes": false,
      "requires_clear_runout": false,
      "requires_score_tracking": false,
      "safety_notes": [
        "Choose simple movements",
        "Match work to recovery capacity"
      ]
    },
    "phase_profiles": [
      {
        "phase_key": "sustained_capacity",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "output",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "conditional",
        "fit_weight": 2
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 15,
        "default_rounds": null,
        "default_work_seconds": 60,
        "default_rest_seconds": 30,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 20,
        "default_rounds": null,
        "default_work_seconds": 90,
        "default_rest_seconds": 30,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 30,
        "default_rounds": null,
        "default_work_seconds": 120,
        "default_rest_seconds": 30,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "Walk-Jog Intervals example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  },
  {
    "slug": "zone-2-cardio-block",
    "name": "Zone 2 Cardio Block",
    "category": "Aerobic Base / Zone 2",
    "programming_type": "zone_2",
    "definition": "Zone 2 Cardio Block: a structured programming method for organizing training work.",
    "coach_summary": "Use Zone 2 Cardio Block to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for Zone 2 Cardio Block and keep movement quality high.",
    "primary_development_goal": "repeatability under fatigue",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "aerobic"
    ],
    "fatigue_profile": {
      "fatigue_intentional": false,
      "fatigue_level": "low",
      "technical_risk_under_fatigue": "low",
      "impact_risk_under_fatigue": "low",
      "grip_risk_under_fatigue": "low"
    },
    "supervision_level": "recommended",
    "what_it_is": "Zone 2 Cardio Block organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 15,
          "work_target_seconds": 60,
          "rest_target_seconds": 30,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 20,
          "work_target_seconds": 90,
          "rest_target_seconds": 30,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 30,
          "work_target_seconds": 120,
          "rest_target_seconds": 30,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "low_skill_calisthenics",
        "bodyweight_strength",
        "machine_cardio",
        "locomotion"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "max_velocity_sprint"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "zone_2_cardio_block_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "zone_2_cardio_block_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "preferred_session_phase": "sustained_capacity",
      "allowed_session_phases": [
        "capacity",
        "resilience",
        "sustained_capacity"
      ],
      "default_duration_minutes": 20,
      "default_work_seconds": 90,
      "default_rest_seconds": 30,
      "default_rpe_range": [
        6,
        8
      ],
      "coaching_complexity": "moderate",
      "group_friendly": false,
      "equipment_flexibility": "high",
      "requires_timer": true,
      "requires_stations": false,
      "requires_lanes": false,
      "requires_clear_runout": false,
      "requires_score_tracking": false,
      "safety_notes": [
        "Choose simple movements",
        "Match work to recovery capacity"
      ]
    },
    "phase_profiles": [
      {
        "phase_key": "sustained_capacity",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "output",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "conditional",
        "fit_weight": 2
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 15,
        "default_rounds": null,
        "default_work_seconds": 60,
        "default_rest_seconds": 30,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 20,
        "default_rounds": null,
        "default_work_seconds": 90,
        "default_rest_seconds": 30,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 30,
        "default_rounds": null,
        "default_work_seconds": 120,
        "default_rest_seconds": 30,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "Zone 2 Cardio Block example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  },
  {
    "slug": "low-impact-cardio-intervals",
    "name": "Low-Impact Cardio Intervals",
    "category": "Aerobic Base / Zone 2",
    "programming_type": "low_impact_cardio",
    "definition": "Low-Impact Cardio Intervals: a structured programming method for organizing training work.",
    "coach_summary": "Use Low-Impact Cardio Intervals to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for Low-Impact Cardio Intervals and keep movement quality high.",
    "primary_development_goal": "repeatability under fatigue",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "aerobic"
    ],
    "fatigue_profile": {
      "fatigue_intentional": false,
      "fatigue_level": "low",
      "technical_risk_under_fatigue": "low",
      "impact_risk_under_fatigue": "low",
      "grip_risk_under_fatigue": "low"
    },
    "supervision_level": "recommended",
    "what_it_is": "Low-Impact Cardio Intervals organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 15,
          "work_target_seconds": 60,
          "rest_target_seconds": 30,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 20,
          "work_target_seconds": 90,
          "rest_target_seconds": 30,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 30,
          "work_target_seconds": 120,
          "rest_target_seconds": 30,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "low_skill_calisthenics",
        "bodyweight_strength",
        "machine_cardio",
        "locomotion"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "max_velocity_sprint"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "low_impact_cardio_intervals_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "low_impact_cardio_intervals_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "preferred_session_phase": "sustained_capacity",
      "allowed_session_phases": [
        "capacity",
        "resilience",
        "sustained_capacity"
      ],
      "default_duration_minutes": 20,
      "default_work_seconds": 90,
      "default_rest_seconds": 30,
      "default_rpe_range": [
        6,
        8
      ],
      "coaching_complexity": "moderate",
      "group_friendly": false,
      "equipment_flexibility": "high",
      "requires_timer": true,
      "requires_stations": false,
      "requires_lanes": false,
      "requires_clear_runout": false,
      "requires_score_tracking": false,
      "safety_notes": [
        "Choose simple movements",
        "Match work to recovery capacity"
      ]
    },
    "phase_profiles": [
      {
        "phase_key": "sustained_capacity",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "output",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "conditional",
        "fit_weight": 2
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 15,
        "default_rounds": null,
        "default_work_seconds": 60,
        "default_rest_seconds": 30,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 20,
        "default_rounds": null,
        "default_work_seconds": 90,
        "default_rest_seconds": 30,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 30,
        "default_rounds": null,
        "default_work_seconds": 120,
        "default_rest_seconds": 30,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "Low-Impact Cardio Intervals example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  },
  {
    "slug": "aerobic-movement-circuit",
    "name": "Aerobic Movement Circuit",
    "category": "Aerobic Base / Zone 2",
    "programming_type": "aerobic_circuit",
    "definition": "Aerobic Movement Circuit: a structured programming method for organizing training work.",
    "coach_summary": "Use Aerobic Movement Circuit to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for Aerobic Movement Circuit and keep movement quality high.",
    "primary_development_goal": "repeatability under fatigue",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "aerobic"
    ],
    "fatigue_profile": {
      "fatigue_intentional": false,
      "fatigue_level": "low",
      "technical_risk_under_fatigue": "low",
      "impact_risk_under_fatigue": "low",
      "grip_risk_under_fatigue": "low"
    },
    "supervision_level": "recommended",
    "what_it_is": "Aerobic Movement Circuit organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 15,
          "work_target_seconds": 60,
          "rest_target_seconds": 30,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 20,
          "work_target_seconds": 90,
          "rest_target_seconds": 30,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 30,
          "work_target_seconds": 120,
          "rest_target_seconds": 30,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "low_skill_calisthenics",
        "bodyweight_strength",
        "machine_cardio",
        "locomotion"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "max_velocity_sprint"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "aerobic_movement_circuit_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "aerobic_movement_circuit_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "preferred_session_phase": "sustained_capacity",
      "allowed_session_phases": [
        "capacity",
        "resilience",
        "sustained_capacity"
      ],
      "default_duration_minutes": 20,
      "default_work_seconds": 90,
      "default_rest_seconds": 30,
      "default_rpe_range": [
        6,
        8
      ],
      "coaching_complexity": "moderate",
      "group_friendly": false,
      "equipment_flexibility": "high",
      "requires_timer": true,
      "requires_stations": false,
      "requires_lanes": false,
      "requires_clear_runout": false,
      "requires_score_tracking": false,
      "safety_notes": [
        "Choose simple movements",
        "Match work to recovery capacity"
      ]
    },
    "phase_profiles": [
      {
        "phase_key": "sustained_capacity",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "output",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "conditional",
        "fit_weight": 2
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 15,
        "default_rounds": null,
        "default_work_seconds": 60,
        "default_rest_seconds": 30,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 20,
        "default_rounds": null,
        "default_work_seconds": 90,
        "default_rest_seconds": 30,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 30,
        "default_rounds": null,
        "default_work_seconds": 120,
        "default_rest_seconds": 30,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "Aerobic Movement Circuit example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  },
  {
    "slug": "nasal-breathing-conditioning-block",
    "name": "Nasal-Breathing Conditioning Block",
    "category": "Recovery / Restoration Programming",
    "programming_type": "nasal_breathing",
    "definition": "Nasal-Breathing Conditioning Block: a structured programming method for organizing training work.",
    "coach_summary": "Use Nasal-Breathing Conditioning Block to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for Nasal-Breathing Conditioning Block and keep movement quality high.",
    "primary_development_goal": "repeatability under fatigue",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "restore",
    "compatible_session_phases": [
      "restore",
      "prepare_and_access",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "recovery",
      "aerobic"
    ],
    "fatigue_profile": {
      "fatigue_intentional": false,
      "fatigue_level": "low",
      "technical_risk_under_fatigue": "low",
      "impact_risk_under_fatigue": "low",
      "grip_risk_under_fatigue": "low"
    },
    "supervision_level": "recommended",
    "what_it_is": "Nasal-Breathing Conditioning Block organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 10,
          "work_target_seconds": 30,
          "rest_target_seconds": 30,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 15,
          "work_target_seconds": 45,
          "rest_target_seconds": 20,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 20,
          "work_target_seconds": 60,
          "rest_target_seconds": 10,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "low_skill_calisthenics",
        "bodyweight_strength",
        "machine_cardio",
        "locomotion"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "max_velocity_sprint"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "nasal_breathing_conditioning_block_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "nasal_breathing_conditioning_block_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "preferred_session_phase": "restore",
      "requires_timer": false,
      "default_rpe_range": [
        3,
        5
      ],
      "coaching_complexity": "low",
      "group_friendly": true,
      "equipment_flexibility": "high",
      "requires_lanes": false,
      "requires_clear_runout": false,
      "requires_score_tracking": false,
      "safety_notes": [
        "Keep intensity low",
        "Prioritize breathing and recovery"
      ]
    },
    "phase_profiles": [
      {
        "phase_key": "restore",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "prepare_and_access",
        "role": "secondary",
        "fit_weight": 4
      },
      {
        "phase_key": "sustained_capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "capacity",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "output",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 10,
        "default_rounds": null,
        "default_work_seconds": 30,
        "default_rest_seconds": 30,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 15,
        "default_rounds": null,
        "default_work_seconds": 45,
        "default_rest_seconds": 20,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 20,
        "default_rounds": null,
        "default_work_seconds": 60,
        "default_rest_seconds": 10,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "Nasal-Breathing Conditioning Block example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  },
  {
    "slug": "recovery-pace-circuit",
    "name": "Recovery Pace Circuit",
    "category": "Recovery / Restoration Programming",
    "programming_type": "recovery_circuit",
    "definition": "Recovery Pace Circuit: a structured programming method for organizing training work.",
    "coach_summary": "Use Recovery Pace Circuit to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for Recovery Pace Circuit and keep movement quality high.",
    "primary_development_goal": "repeatability under fatigue",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "restore",
    "compatible_session_phases": [
      "restore",
      "prepare_and_access",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "recovery",
      "aerobic"
    ],
    "fatigue_profile": {
      "fatigue_intentional": false,
      "fatigue_level": "low",
      "technical_risk_under_fatigue": "low",
      "impact_risk_under_fatigue": "low",
      "grip_risk_under_fatigue": "low"
    },
    "supervision_level": "recommended",
    "what_it_is": "Recovery Pace Circuit organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 10,
          "work_target_seconds": 30,
          "rest_target_seconds": 30,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 15,
          "work_target_seconds": 45,
          "rest_target_seconds": 20,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 20,
          "work_target_seconds": 60,
          "rest_target_seconds": 10,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "low_skill_calisthenics",
        "bodyweight_strength",
        "machine_cardio",
        "locomotion"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "max_velocity_sprint"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "recovery_pace_circuit_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "recovery_pace_circuit_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "preferred_session_phase": "restore",
      "requires_timer": false,
      "default_rpe_range": [
        3,
        5
      ],
      "coaching_complexity": "low",
      "group_friendly": true,
      "equipment_flexibility": "high",
      "requires_lanes": false,
      "requires_clear_runout": false,
      "requires_score_tracking": false,
      "safety_notes": [
        "Keep intensity low",
        "Prioritize breathing and recovery"
      ]
    },
    "phase_profiles": [
      {
        "phase_key": "restore",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "prepare_and_access",
        "role": "secondary",
        "fit_weight": 4
      },
      {
        "phase_key": "sustained_capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "capacity",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "output",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 10,
        "default_rounds": null,
        "default_work_seconds": 30,
        "default_rest_seconds": 30,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 15,
        "default_rounds": null,
        "default_work_seconds": 45,
        "default_rest_seconds": 20,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 20,
        "default_rounds": null,
        "default_work_seconds": 60,
        "default_rest_seconds": 10,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "Recovery Pace Circuit example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  },
  {
    "slug": "extensive-tempo-field-circuit",
    "name": "Extensive Tempo Field Circuit",
    "category": "Tempo Conditioning",
    "programming_type": "extensive_tempo",
    "definition": "Extensive Tempo Field Circuit: a structured programming method for organizing training work.",
    "coach_summary": "Use Extensive Tempo Field Circuit to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for Extensive Tempo Field Circuit and keep movement quality high.",
    "primary_development_goal": "repeatability under fatigue",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "mixed"
    ],
    "fatigue_profile": {
      "fatigue_intentional": true,
      "fatigue_level": "moderate",
      "technical_risk_under_fatigue": "moderate",
      "impact_risk_under_fatigue": "moderate",
      "grip_risk_under_fatigue": "low"
    },
    "supervision_level": "recommended",
    "what_it_is": "Extensive Tempo Field Circuit organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 8,
          "work_target_seconds": 20,
          "rest_target_seconds": 40,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 12,
          "work_target_seconds": 30,
          "rest_target_seconds": 30,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 16,
          "work_target_seconds": 40,
          "rest_target_seconds": 20,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "low_skill_calisthenics",
        "bodyweight_strength",
        "machine_cardio",
        "locomotion"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "max_velocity_sprint"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "extensive_tempo_field_circuit_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "extensive_tempo_field_circuit_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "preferred_session_phase": "sustained_capacity",
      "allowed_session_phases": [
        "capacity",
        "resilience",
        "sustained_capacity"
      ],
      "default_duration_minutes": 12,
      "default_work_seconds": 30,
      "default_rest_seconds": 30,
      "default_rpe_range": [
        6,
        8
      ],
      "coaching_complexity": "moderate",
      "group_friendly": false,
      "equipment_flexibility": "high",
      "requires_timer": true,
      "requires_stations": false,
      "requires_lanes": false,
      "requires_clear_runout": false,
      "requires_score_tracking": false,
      "safety_notes": [
        "Choose simple movements",
        "Match work to recovery capacity"
      ]
    },
    "phase_profiles": [
      {
        "phase_key": "sustained_capacity",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "output",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "conditional",
        "fit_weight": 2
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 8,
        "default_rounds": null,
        "default_work_seconds": 20,
        "default_rest_seconds": 40,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 12,
        "default_rounds": null,
        "default_work_seconds": 30,
        "default_rest_seconds": 30,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 16,
        "default_rounds": null,
        "default_work_seconds": 40,
        "default_rest_seconds": 20,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "Extensive Tempo Field Circuit example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  },
  {
    "slug": "cardio-machine-intervals",
    "name": "Cardio Machine Intervals",
    "category": "Interval Training",
    "programming_type": "machine_interval",
    "definition": "Cardio Machine Intervals: a structured programming method for organizing training work.",
    "coach_summary": "Use Cardio Machine Intervals to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for Cardio Machine Intervals and keep movement quality high.",
    "primary_development_goal": "repeatability under fatigue",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "mixed"
    ],
    "fatigue_profile": {
      "fatigue_intentional": true,
      "fatigue_level": "moderate",
      "technical_risk_under_fatigue": "moderate",
      "impact_risk_under_fatigue": "moderate",
      "grip_risk_under_fatigue": "low"
    },
    "supervision_level": "recommended",
    "what_it_is": "Cardio Machine Intervals organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 8,
          "work_target_seconds": 20,
          "rest_target_seconds": 40,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 12,
          "work_target_seconds": 30,
          "rest_target_seconds": 30,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 16,
          "work_target_seconds": 40,
          "rest_target_seconds": 20,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "low_skill_calisthenics",
        "bodyweight_strength",
        "machine_cardio",
        "locomotion"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "max_velocity_sprint"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "cardio_machine_intervals_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "cardio_machine_intervals_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "preferred_session_phase": "sustained_capacity",
      "allowed_session_phases": [
        "capacity",
        "resilience",
        "sustained_capacity"
      ],
      "default_duration_minutes": 12,
      "default_work_seconds": 30,
      "default_rest_seconds": 30,
      "default_rpe_range": [
        6,
        8
      ],
      "coaching_complexity": "moderate",
      "group_friendly": false,
      "equipment_flexibility": "high",
      "requires_timer": true,
      "requires_stations": false,
      "requires_lanes": false,
      "requires_clear_runout": false,
      "requires_score_tracking": false,
      "safety_notes": [
        "Choose simple movements",
        "Match work to recovery capacity"
      ]
    },
    "phase_profiles": [
      {
        "phase_key": "sustained_capacity",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "output",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "conditional",
        "fit_weight": 2
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 8,
        "default_rounds": null,
        "default_work_seconds": 20,
        "default_rest_seconds": 40,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 12,
        "default_rounds": null,
        "default_work_seconds": 30,
        "default_rest_seconds": 30,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 16,
        "default_rounds": null,
        "default_work_seconds": 40,
        "default_rest_seconds": 20,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "Cardio Machine Intervals example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  },
  {
    "slug": "repeat-sprint-format",
    "name": "Repeat Sprint Format",
    "category": "Repeat Sprint / Repeat Shuttle",
    "programming_type": "repeat_sprint",
    "definition": "Repeat Sprint Format: a structured programming method for organizing training work.",
    "coach_summary": "Use Repeat Sprint Format to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for Repeat Sprint Format and keep movement quality high.",
    "primary_development_goal": "repeatability under fatigue",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "mixed"
    ],
    "fatigue_profile": {
      "fatigue_intentional": true,
      "fatigue_level": "moderate",
      "technical_risk_under_fatigue": "moderate",
      "impact_risk_under_fatigue": "moderate",
      "grip_risk_under_fatigue": "low"
    },
    "supervision_level": "required",
    "what_it_is": "Repeat Sprint Format organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 8,
          "work_target_seconds": 20,
          "rest_target_seconds": 40,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 12,
          "work_target_seconds": 30,
          "rest_target_seconds": 30,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 16,
          "work_target_seconds": 40,
          "rest_target_seconds": 20,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "shuttle",
        "sprint",
        "locomotion"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "loaded_strength"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "repeat_sprint_format_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "repeat_sprint_format_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "requires_lanes": true,
      "requires_clear_runout": true,
      "coaching_complexity": "high",
      "group_friendly": false
    },
    "phase_profiles": [
      {
        "phase_key": "output",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "sustained_capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "capacity",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "avoid",
        "fit_weight": 1
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 8,
        "default_rounds": null,
        "default_work_seconds": 20,
        "default_rest_seconds": 40,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 12,
        "default_rounds": null,
        "default_work_seconds": 30,
        "default_rest_seconds": 30,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 16,
        "default_rounds": null,
        "default_work_seconds": 40,
        "default_rest_seconds": 20,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "Repeat Sprint Format example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  },
  {
    "slug": "repeat-shuttle-format",
    "name": "Repeat Shuttle Format",
    "category": "Repeat Sprint / Repeat Shuttle",
    "programming_type": "repeat_shuttle",
    "definition": "Repeated shuttle runs or COD repeats with controlled rest, emphasizing deceleration, re-acceleration, and repeatability under moderate fatigue.",
    "coach_summary": "Builds sport-style repeatability when lanes, runout, and landing competency are in place. Not max Output \u2014 repeat quality shuttles with full-ish recovery.",
    "athlete_summary": "Sprint the shuttle with sharp cuts and safe deceleration. Rest fully enough to keep every rep fast and controlled.",
    "primary_development_goal": "repeat shuttle ability and deceleration control under fatigue",
    "secondary_development_goals": [
      "repeat sprint ability",
      "change-of-direction repeatability",
      "sport-style work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "sustained_capacity",
      "output"
    ],
    "incompatible_phases": [
      "movement_intelligence",
      "prepare_and_access"
    ],
    "energy_system_focus": [
      "alactic_repeat",
      "mixed",
      "glycolytic"
    ],
    "fatigue_profile": {
      "fatigue_intentional": true,
      "fatigue_level": "moderate",
      "technical_risk_under_fatigue": "high",
      "impact_risk_under_fatigue": "high",
      "grip_risk_under_fatigue": "low"
    },
    "supervision_level": "required",
    "what_it_is": "Athletes repeat a defined shuttle distance or pattern (e.g., 5-10-5, 20-yard pro shuttle) with prescribed rest between reps and rounds.",
    "why_it_matters": "Shuttle repeatability bridges field/court demands and conditioning when deceleration and re-acceleration stay crisp rep to rep.",
    "when_to_use": "Late session Sustained Capacity for athletes with proven landing/braking competency. Can support Output when rest is full and intensity is near-max.",
    "when_not_to_use": "Do not use without clear lanes/runout, before Movement Intelligence, or when athletes lack deceleration prerequisites.",
    "common_misuse": [
      "running shuttles in crowded space without runout",
      "short rest turning repeats into sloppy conditioning",
      "programming before athletes can stick landings",
      "using as punishment sprints",
      "max-effort shuttles stacked under high fatigue"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "rounds": 4,
          "work_target_seconds": 6,
          "rest_target_seconds": 60,
          "rpe": "6-7"
        },
        "intermediate": {
          "rounds": 6,
          "work_target_seconds": 5,
          "rest_target_seconds": 45,
          "rpe": "7-8"
        },
        "advanced": {
          "rounds": 8,
          "work_target_seconds": 5,
          "rest_target_seconds": 30,
          "rpe": "8-9"
        }
      },
      "work_rest_options": [
        "5-10-5 repeat",
        "pro-agility repeat",
        "custom distance shuttle"
      ],
      "typical_total_duration_minutes": [
        8,
        12,
        15
      ],
      "recommended_density": "Rest long enough that cut quality and deceleration stay sharp.",
      "pacing_notes": "If cut quality drops, extend rest or reduce reps \u2014 do not chase volume."
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "shuttle",
        "locomotion",
        "sprint"
      ],
      "conditional_exercise_types": [
        "low_amplitude_elastic"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "grip_hang",
        "loaded_strength"
      ]
    },
    "quality_standards": [
      "clear lanes and deceleration/runout space are marked",
      "each rep shows controlled deceleration into the turn",
      "rest is sufficient to repeat near-target speed",
      "no valgus collapse or stutter-step compensations",
      "coach supervises every rep for youth and beginners"
    ],
    "stop_rules": [
      "stop if landing control degrades",
      "stop if pain appears in knee, ankle, or hip",
      "stop if space becomes congested or unsafe",
      "reduce reps if athlete cannot match prior split within agreed tolerance"
    ],
    "validator_rules": [
      {
        "rule_key": "no_runout_space",
        "condition_json": {
          "requires_clear_runout": true,
          "runout_present": false
        },
        "message": "Sprint/shuttle formats require clear lanes and safe deceleration space.",
        "severity": "error"
      },
      {
        "rule_key": "missing_decel_prerequisite",
        "condition_json": {
          "decel_prerequisite_met": false
        },
        "message": "Repeated shuttles require landing and deceleration competency.",
        "severity": "warning"
      },
      {
        "rule_key": "before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Conditioning before Output may reduce sprint and reactive quality.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "preferred_session_phase": "sustained_capacity",
      "allowed_session_phases": [
        "sustained_capacity",
        "output"
      ],
      "default_duration_minutes": 12,
      "default_rounds": 6,
      "default_work_seconds": 5,
      "default_rest_seconds": 45,
      "default_rpe_range": [
        7,
        9
      ],
      "recommended_age_min": 10,
      "coaching_complexity": "high",
      "group_friendly": false,
      "equipment_flexibility": "low",
      "requires_timer": true,
      "requires_stations": false,
      "requires_lanes": true,
      "requires_clear_runout": true,
      "requires_score_tracking": true,
      "safety_notes": [
        "Mark lanes and runout",
        "Verify deceleration competency",
        "Supervise turns and stops"
      ]
    },
    "phase_profiles": [
      {
        "phase_key": "sustained_capacity",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "output",
        "role": "conditional",
        "fit_weight": 3
      },
      {
        "phase_key": "capacity",
        "role": "secondary",
        "fit_weight": 2
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "restore",
        "role": "avoid",
        "fit_weight": 1
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 8,
        "default_rounds": 4,
        "default_work_seconds": 6,
        "default_rest_seconds": 60,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Fewer reps, full recovery, supervised cuts."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 12,
        "default_rounds": 6,
        "default_work_seconds": 5,
        "default_rest_seconds": 45,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Standard repeat shuttle density."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 15,
        "default_rounds": 8,
        "default_work_seconds": 5,
        "default_rest_seconds": 30,
        "default_rpe_min": 8,
        "default_rpe_max": 9,
        "notes": "Only when decel quality remains repeatable."
      }
    ],
    "examples": [
      {
        "label": "5-10-5 repeat shuttle",
        "audience": "intermediate",
        "example_json": {
          "pattern": "5-10-5",
          "reps": 6,
          "rest_seconds": 45,
          "quality": "Stick every stop; no drift on cuts"
        },
        "coaching_notes": "Requires cones, lanes, and 5+ yards runout beyond finish line."
      }
    ]
  },
  {
    "slug": "five-ten-five-repeatability",
    "name": "5-10-5 Repeatability Format",
    "category": "Repeat Sprint / Repeat Shuttle",
    "programming_type": "agility_repeat",
    "definition": "5-10-5 Repeatability Format: a structured programming method for organizing training work.",
    "coach_summary": "Use 5-10-5 Repeatability Format to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for 5-10-5 Repeatability Format and keep movement quality high.",
    "primary_development_goal": "repeatability under fatigue",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "mixed"
    ],
    "fatigue_profile": {
      "fatigue_intentional": true,
      "fatigue_level": "moderate",
      "technical_risk_under_fatigue": "moderate",
      "impact_risk_under_fatigue": "moderate",
      "grip_risk_under_fatigue": "low"
    },
    "supervision_level": "required",
    "what_it_is": "5-10-5 Repeatability Format organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 8,
          "work_target_seconds": 20,
          "rest_target_seconds": 40,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 12,
          "work_target_seconds": 30,
          "rest_target_seconds": 30,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 16,
          "work_target_seconds": 40,
          "rest_target_seconds": 20,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "shuttle",
        "sprint",
        "locomotion"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "loaded_strength"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "five_ten_five_repeatability_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "five_ten_five_repeatability_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "requires_lanes": true,
      "requires_clear_runout": true,
      "coaching_complexity": "high",
      "group_friendly": false
    },
    "phase_profiles": [
      {
        "phase_key": "output",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "sustained_capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "capacity",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "avoid",
        "fit_weight": 1
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 8,
        "default_rounds": null,
        "default_work_seconds": 20,
        "default_rest_seconds": 40,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 12,
        "default_rounds": null,
        "default_work_seconds": 30,
        "default_rest_seconds": 30,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 16,
        "default_rounds": null,
        "default_work_seconds": 40,
        "default_rest_seconds": 20,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "5-10-5 Repeatability Format example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  },
  {
    "slug": "linear-deceleration-repeatability",
    "name": "Linear Deceleration Repeatability",
    "category": "Repeat Sprint / Repeat Shuttle",
    "programming_type": "decel_repeat",
    "definition": "Linear Deceleration Repeatability: a structured programming method for organizing training work.",
    "coach_summary": "Use Linear Deceleration Repeatability to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for Linear Deceleration Repeatability and keep movement quality high.",
    "primary_development_goal": "repeatability under fatigue",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "mixed"
    ],
    "fatigue_profile": {
      "fatigue_intentional": true,
      "fatigue_level": "moderate",
      "technical_risk_under_fatigue": "moderate",
      "impact_risk_under_fatigue": "moderate",
      "grip_risk_under_fatigue": "low"
    },
    "supervision_level": "required",
    "what_it_is": "Linear Deceleration Repeatability organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 8,
          "work_target_seconds": 20,
          "rest_target_seconds": 40,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 12,
          "work_target_seconds": 30,
          "rest_target_seconds": 30,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 16,
          "work_target_seconds": 40,
          "rest_target_seconds": 20,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "shuttle",
        "sprint",
        "locomotion"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "loaded_strength"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "linear_deceleration_repeatability_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "linear_deceleration_repeatability_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "requires_lanes": true,
      "requires_clear_runout": true,
      "coaching_complexity": "high",
      "group_friendly": false
    },
    "phase_profiles": [
      {
        "phase_key": "output",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "sustained_capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "capacity",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "avoid",
        "fit_weight": 1
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 8,
        "default_rounds": null,
        "default_work_seconds": 20,
        "default_rest_seconds": 40,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 12,
        "default_rounds": null,
        "default_work_seconds": 30,
        "default_rest_seconds": 30,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 16,
        "default_rounds": null,
        "default_work_seconds": 40,
        "default_rest_seconds": 20,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "Linear Deceleration Repeatability example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  },
  {
    "slug": "lateral-shuffle-repeatability",
    "name": "Lateral Shuffle Repeatability",
    "category": "Repeat Sprint / Repeat Shuttle",
    "programming_type": "lateral_repeat",
    "definition": "Lateral Shuffle Repeatability: a structured programming method for organizing training work.",
    "coach_summary": "Use Lateral Shuffle Repeatability to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for Lateral Shuffle Repeatability and keep movement quality high.",
    "primary_development_goal": "repeatability under fatigue",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "mixed"
    ],
    "fatigue_profile": {
      "fatigue_intentional": true,
      "fatigue_level": "moderate",
      "technical_risk_under_fatigue": "moderate",
      "impact_risk_under_fatigue": "moderate",
      "grip_risk_under_fatigue": "low"
    },
    "supervision_level": "required",
    "what_it_is": "Lateral Shuffle Repeatability organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 8,
          "work_target_seconds": 20,
          "rest_target_seconds": 40,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 12,
          "work_target_seconds": 30,
          "rest_target_seconds": 30,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 16,
          "work_target_seconds": 40,
          "rest_target_seconds": 20,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "shuttle",
        "sprint",
        "locomotion"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "loaded_strength"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "lateral_shuffle_repeatability_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "lateral_shuffle_repeatability_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "requires_lanes": true,
      "requires_clear_runout": true,
      "coaching_complexity": "high",
      "group_friendly": false
    },
    "phase_profiles": [
      {
        "phase_key": "output",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "sustained_capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "capacity",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "avoid",
        "fit_weight": 1
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 8,
        "default_rounds": null,
        "default_work_seconds": 20,
        "default_rest_seconds": 40,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 12,
        "default_rounds": null,
        "default_work_seconds": 30,
        "default_rest_seconds": 30,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 16,
        "default_rounds": null,
        "default_work_seconds": 40,
        "default_rest_seconds": 20,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "Lateral Shuffle Repeatability example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  },
  {
    "slug": "backpedal-to-sprint-repeatability",
    "name": "Backpedal-to-Sprint Repeatability",
    "category": "Repeat Sprint / Repeat Shuttle",
    "programming_type": "backpedal_sprint",
    "definition": "Backpedal-to-Sprint Repeatability: a structured programming method for organizing training work.",
    "coach_summary": "Use Backpedal-to-Sprint Repeatability to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for Backpedal-to-Sprint Repeatability and keep movement quality high.",
    "primary_development_goal": "repeatability under fatigue",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "mixed"
    ],
    "fatigue_profile": {
      "fatigue_intentional": true,
      "fatigue_level": "moderate",
      "technical_risk_under_fatigue": "moderate",
      "impact_risk_under_fatigue": "moderate",
      "grip_risk_under_fatigue": "low"
    },
    "supervision_level": "required",
    "what_it_is": "Backpedal-to-Sprint Repeatability organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 8,
          "work_target_seconds": 20,
          "rest_target_seconds": 40,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 12,
          "work_target_seconds": 30,
          "rest_target_seconds": 30,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 16,
          "work_target_seconds": 40,
          "rest_target_seconds": 20,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "shuttle",
        "sprint",
        "locomotion"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "loaded_strength"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "backpedal_to_sprint_repeatability_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "backpedal_to_sprint_repeatability_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "requires_lanes": true,
      "requires_clear_runout": true,
      "coaching_complexity": "high",
      "group_friendly": false
    },
    "phase_profiles": [
      {
        "phase_key": "output",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "sustained_capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "capacity",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "avoid",
        "fit_weight": 1
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 8,
        "default_rounds": null,
        "default_work_seconds": 20,
        "default_rest_seconds": 40,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 12,
        "default_rounds": null,
        "default_work_seconds": 30,
        "default_rest_seconds": 30,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 16,
        "default_rounds": null,
        "default_work_seconds": 40,
        "default_rest_seconds": 20,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "Backpedal-to-Sprint Repeatability example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  },
  {
    "slug": "reactive-gate-repeatability",
    "name": "Reactive Gate Repeatability",
    "category": "Repeat Sprint / Repeat Shuttle",
    "programming_type": "reactive_gate",
    "definition": "Reactive Gate Repeatability: a structured programming method for organizing training work.",
    "coach_summary": "Use Reactive Gate Repeatability to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for Reactive Gate Repeatability and keep movement quality high.",
    "primary_development_goal": "repeatability under fatigue",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "mixed"
    ],
    "fatigue_profile": {
      "fatigue_intentional": true,
      "fatigue_level": "moderate",
      "technical_risk_under_fatigue": "moderate",
      "impact_risk_under_fatigue": "moderate",
      "grip_risk_under_fatigue": "low"
    },
    "supervision_level": "required",
    "what_it_is": "Reactive Gate Repeatability organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 8,
          "work_target_seconds": 20,
          "rest_target_seconds": 40,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 12,
          "work_target_seconds": 30,
          "rest_target_seconds": 30,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 16,
          "work_target_seconds": 40,
          "rest_target_seconds": 20,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "shuttle",
        "sprint",
        "locomotion"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "loaded_strength"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "reactive_gate_repeatability_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "reactive_gate_repeatability_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "requires_lanes": true,
      "requires_clear_runout": true,
      "coaching_complexity": "high",
      "group_friendly": false
    },
    "phase_profiles": [
      {
        "phase_key": "output",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "sustained_capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "capacity",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "avoid",
        "fit_weight": 1
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 8,
        "default_rounds": null,
        "default_work_seconds": 20,
        "default_rest_seconds": 40,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 12,
        "default_rounds": null,
        "default_work_seconds": 30,
        "default_rest_seconds": 30,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 16,
        "default_rounds": null,
        "default_work_seconds": 40,
        "default_rest_seconds": 20,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "Reactive Gate Repeatability example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  },
  {
    "slug": "partner-chase-repeatability",
    "name": "Partner Chase Repeatability",
    "category": "Repeat Sprint / Repeat Shuttle",
    "programming_type": "partner_chase",
    "definition": "Partner Chase Repeatability: a structured programming method for organizing training work.",
    "coach_summary": "Use Partner Chase Repeatability to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for Partner Chase Repeatability and keep movement quality high.",
    "primary_development_goal": "repeatability under fatigue",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "mixed"
    ],
    "fatigue_profile": {
      "fatigue_intentional": true,
      "fatigue_level": "moderate",
      "technical_risk_under_fatigue": "moderate",
      "impact_risk_under_fatigue": "moderate",
      "grip_risk_under_fatigue": "low"
    },
    "supervision_level": "required",
    "what_it_is": "Partner Chase Repeatability organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 8,
          "work_target_seconds": 20,
          "rest_target_seconds": 40,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 12,
          "work_target_seconds": 30,
          "rest_target_seconds": 30,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 16,
          "work_target_seconds": 40,
          "rest_target_seconds": 20,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "shuttle",
        "sprint",
        "locomotion"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "loaded_strength"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "partner_chase_repeatability_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "partner_chase_repeatability_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "requires_lanes": true,
      "requires_clear_runout": true,
      "coaching_complexity": "high",
      "group_friendly": false
    },
    "phase_profiles": [
      {
        "phase_key": "output",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "sustained_capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "capacity",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "avoid",
        "fit_weight": 1
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 8,
        "default_rounds": null,
        "default_work_seconds": 20,
        "default_rest_seconds": 40,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 12,
        "default_rounds": null,
        "default_work_seconds": 30,
        "default_rest_seconds": 30,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 16,
        "default_rounds": null,
        "default_work_seconds": 40,
        "default_rest_seconds": 20,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "Partner Chase Repeatability example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  },
  {
    "slug": "curved-run-repeatability",
    "name": "Curved Run Repeatability",
    "category": "Repeat Sprint / Repeat Shuttle",
    "programming_type": "curved_run",
    "definition": "Curved Run Repeatability: a structured programming method for organizing training work.",
    "coach_summary": "Use Curved Run Repeatability to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for Curved Run Repeatability and keep movement quality high.",
    "primary_development_goal": "repeatability under fatigue",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "mixed"
    ],
    "fatigue_profile": {
      "fatigue_intentional": true,
      "fatigue_level": "moderate",
      "technical_risk_under_fatigue": "moderate",
      "impact_risk_under_fatigue": "moderate",
      "grip_risk_under_fatigue": "low"
    },
    "supervision_level": "required",
    "what_it_is": "Curved Run Repeatability organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 8,
          "work_target_seconds": 20,
          "rest_target_seconds": 40,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 12,
          "work_target_seconds": 30,
          "rest_target_seconds": 30,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 16,
          "work_target_seconds": 40,
          "rest_target_seconds": 20,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "shuttle",
        "sprint",
        "locomotion"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "loaded_strength"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "curved_run_repeatability_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "curved_run_repeatability_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "requires_lanes": true,
      "requires_clear_runout": true,
      "coaching_complexity": "high",
      "group_friendly": false
    },
    "phase_profiles": [
      {
        "phase_key": "output",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "sustained_capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "capacity",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "avoid",
        "fit_weight": 1
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 8,
        "default_rounds": null,
        "default_work_seconds": 20,
        "default_rest_seconds": 40,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 12,
        "default_rounds": null,
        "default_work_seconds": 30,
        "default_rest_seconds": 30,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 16,
        "default_rounds": null,
        "default_work_seconds": 40,
        "default_rest_seconds": 20,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "Curved Run Repeatability example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  },
  {
    "slug": "sport-style-conditioning-wave",
    "name": "Sport-Style Conditioning Wave",
    "category": "Mixed-Modal Conditioning",
    "programming_type": "conditioning_wave",
    "definition": "Sport-Style Conditioning Wave: a structured programming method for organizing training work.",
    "coach_summary": "Use Sport-Style Conditioning Wave to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for Sport-Style Conditioning Wave and keep movement quality high.",
    "primary_development_goal": "repeatability under fatigue",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "mixed"
    ],
    "fatigue_profile": {
      "fatigue_intentional": true,
      "fatigue_level": "moderate",
      "technical_risk_under_fatigue": "moderate",
      "impact_risk_under_fatigue": "moderate",
      "grip_risk_under_fatigue": "low"
    },
    "supervision_level": "recommended",
    "what_it_is": "Sport-Style Conditioning Wave organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 8,
          "work_target_seconds": 20,
          "rest_target_seconds": 40,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 12,
          "work_target_seconds": 30,
          "rest_target_seconds": 30,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 16,
          "work_target_seconds": 40,
          "rest_target_seconds": 20,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "low_skill_calisthenics",
        "bodyweight_strength",
        "machine_cardio",
        "locomotion"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "max_velocity_sprint"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "sport_style_conditioning_wave_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "sport_style_conditioning_wave_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "preferred_session_phase": "sustained_capacity",
      "allowed_session_phases": [
        "capacity",
        "resilience",
        "sustained_capacity"
      ],
      "default_duration_minutes": 12,
      "default_work_seconds": 30,
      "default_rest_seconds": 30,
      "default_rpe_range": [
        6,
        8
      ],
      "coaching_complexity": "moderate",
      "group_friendly": false,
      "equipment_flexibility": "high",
      "requires_timer": true,
      "requires_stations": false,
      "requires_lanes": false,
      "requires_clear_runout": false,
      "requires_score_tracking": false,
      "safety_notes": [
        "Choose simple movements",
        "Match work to recovery capacity"
      ]
    },
    "phase_profiles": [
      {
        "phase_key": "sustained_capacity",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "output",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "conditional",
        "fit_weight": 2
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 8,
        "default_rounds": null,
        "default_work_seconds": 20,
        "default_rest_seconds": 40,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 12,
        "default_rounds": null,
        "default_work_seconds": 30,
        "default_rest_seconds": 30,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 16,
        "default_rounds": null,
        "default_work_seconds": 40,
        "default_rest_seconds": 20,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "Sport-Style Conditioning Wave example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  },
  {
    "slug": "mixed-modal-athletic-circuit",
    "name": "Mixed-Modal Athletic Circuit",
    "category": "Mixed-Modal Conditioning",
    "programming_type": "mixed_modal_circuit",
    "definition": "Mixed-Modal Athletic Circuit: a structured programming method for organizing training work.",
    "coach_summary": "Use Mixed-Modal Athletic Circuit to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for Mixed-Modal Athletic Circuit and keep movement quality high.",
    "primary_development_goal": "repeatability under fatigue",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "mixed"
    ],
    "fatigue_profile": {
      "fatigue_intentional": true,
      "fatigue_level": "moderate",
      "technical_risk_under_fatigue": "moderate",
      "impact_risk_under_fatigue": "moderate",
      "grip_risk_under_fatigue": "low"
    },
    "supervision_level": "recommended",
    "what_it_is": "Mixed-Modal Athletic Circuit organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 8,
          "work_target_seconds": 20,
          "rest_target_seconds": 40,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 12,
          "work_target_seconds": 30,
          "rest_target_seconds": 30,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 16,
          "work_target_seconds": 40,
          "rest_target_seconds": 20,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "low_skill_calisthenics",
        "bodyweight_strength",
        "machine_cardio",
        "locomotion"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "max_velocity_sprint"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "mixed_modal_athletic_circuit_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "mixed_modal_athletic_circuit_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "preferred_session_phase": "sustained_capacity",
      "allowed_session_phases": [
        "capacity",
        "resilience",
        "sustained_capacity"
      ],
      "default_duration_minutes": 12,
      "default_work_seconds": 30,
      "default_rest_seconds": 30,
      "default_rpe_range": [
        6,
        8
      ],
      "coaching_complexity": "moderate",
      "group_friendly": false,
      "equipment_flexibility": "high",
      "requires_timer": true,
      "requires_stations": false,
      "requires_lanes": false,
      "requires_clear_runout": false,
      "requires_score_tracking": false,
      "safety_notes": [
        "Choose simple movements",
        "Match work to recovery capacity"
      ]
    },
    "phase_profiles": [
      {
        "phase_key": "sustained_capacity",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "output",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "conditional",
        "fit_weight": 2
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 8,
        "default_rounds": null,
        "default_work_seconds": 20,
        "default_rest_seconds": 40,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 12,
        "default_rounds": null,
        "default_work_seconds": 30,
        "default_rest_seconds": 30,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 16,
        "default_rounds": null,
        "default_work_seconds": 40,
        "default_rest_seconds": 20,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "Mixed-Modal Athletic Circuit example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  },
  {
    "slug": "crawl-carry-circuit",
    "name": "Crawl + Carry Circuit",
    "category": "Mixed-Modal Conditioning",
    "programming_type": "crawl_carry_circuit",
    "definition": "Crawl + Carry Circuit: a structured programming method for organizing training work.",
    "coach_summary": "Use Crawl + Carry Circuit to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for Crawl + Carry Circuit and keep movement quality high.",
    "primary_development_goal": "repeatability under fatigue",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "mixed"
    ],
    "fatigue_profile": {
      "fatigue_intentional": true,
      "fatigue_level": "moderate",
      "technical_risk_under_fatigue": "moderate",
      "impact_risk_under_fatigue": "moderate",
      "grip_risk_under_fatigue": "low"
    },
    "supervision_level": "recommended",
    "what_it_is": "Crawl + Carry Circuit organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 8,
          "work_target_seconds": 20,
          "rest_target_seconds": 40,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 12,
          "work_target_seconds": 30,
          "rest_target_seconds": 30,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 16,
          "work_target_seconds": 40,
          "rest_target_seconds": 20,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "low_skill_calisthenics",
        "bodyweight_strength",
        "machine_cardio",
        "locomotion"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "max_velocity_sprint"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "crawl_carry_circuit_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "crawl_carry_circuit_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "preferred_session_phase": "sustained_capacity",
      "allowed_session_phases": [
        "capacity",
        "resilience",
        "sustained_capacity"
      ],
      "default_duration_minutes": 12,
      "default_work_seconds": 30,
      "default_rest_seconds": 30,
      "default_rpe_range": [
        6,
        8
      ],
      "coaching_complexity": "moderate",
      "group_friendly": false,
      "equipment_flexibility": "high",
      "requires_timer": true,
      "requires_stations": false,
      "requires_lanes": false,
      "requires_clear_runout": false,
      "requires_score_tracking": false,
      "safety_notes": [
        "Choose simple movements",
        "Match work to recovery capacity"
      ]
    },
    "phase_profiles": [
      {
        "phase_key": "sustained_capacity",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "output",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "conditional",
        "fit_weight": 2
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 8,
        "default_rounds": null,
        "default_work_seconds": 20,
        "default_rest_seconds": 40,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 12,
        "default_rounds": null,
        "default_work_seconds": 30,
        "default_rest_seconds": 30,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 16,
        "default_rounds": null,
        "default_work_seconds": 40,
        "default_rest_seconds": 20,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "Crawl + Carry Circuit example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  },
  {
    "slug": "carry-repeatability-format",
    "name": "Carry Repeatability Format",
    "category": "Mixed-Modal Conditioning",
    "programming_type": "carry_repeat",
    "definition": "Carry Repeatability Format: a structured programming method for organizing training work.",
    "coach_summary": "Use Carry Repeatability Format to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for Carry Repeatability Format and keep movement quality high.",
    "primary_development_goal": "repeatability under fatigue",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "mixed"
    ],
    "fatigue_profile": {
      "fatigue_intentional": true,
      "fatigue_level": "moderate",
      "technical_risk_under_fatigue": "moderate",
      "impact_risk_under_fatigue": "moderate",
      "grip_risk_under_fatigue": "low"
    },
    "supervision_level": "recommended",
    "what_it_is": "Carry Repeatability Format organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 8,
          "work_target_seconds": 20,
          "rest_target_seconds": 40,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 12,
          "work_target_seconds": 30,
          "rest_target_seconds": 30,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 16,
          "work_target_seconds": 40,
          "rest_target_seconds": 20,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "low_skill_calisthenics",
        "bodyweight_strength",
        "machine_cardio",
        "locomotion"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "max_velocity_sprint"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "carry_repeatability_format_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "carry_repeatability_format_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "preferred_session_phase": "sustained_capacity",
      "allowed_session_phases": [
        "capacity",
        "resilience",
        "sustained_capacity"
      ],
      "default_duration_minutes": 12,
      "default_work_seconds": 30,
      "default_rest_seconds": 30,
      "default_rpe_range": [
        6,
        8
      ],
      "coaching_complexity": "moderate",
      "group_friendly": false,
      "equipment_flexibility": "high",
      "requires_timer": true,
      "requires_stations": false,
      "requires_lanes": false,
      "requires_clear_runout": false,
      "requires_score_tracking": false,
      "safety_notes": [
        "Choose simple movements",
        "Match work to recovery capacity"
      ]
    },
    "phase_profiles": [
      {
        "phase_key": "sustained_capacity",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "output",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "conditional",
        "fit_weight": 2
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 8,
        "default_rounds": null,
        "default_work_seconds": 20,
        "default_rest_seconds": 40,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 12,
        "default_rounds": null,
        "default_work_seconds": 30,
        "default_rest_seconds": 30,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 16,
        "default_rounds": null,
        "default_work_seconds": 40,
        "default_rest_seconds": 20,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "Carry Repeatability Format example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  },
  {
    "slug": "grip-repeatability-format",
    "name": "Grip Repeatability Format",
    "category": "Mixed-Modal Conditioning",
    "programming_type": "grip_repeat",
    "definition": "Grip Repeatability Format: a structured programming method for organizing training work.",
    "coach_summary": "Use Grip Repeatability Format to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for Grip Repeatability Format and keep movement quality high.",
    "primary_development_goal": "repeatability under fatigue",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "mixed"
    ],
    "fatigue_profile": {
      "fatigue_intentional": true,
      "fatigue_level": "moderate",
      "technical_risk_under_fatigue": "moderate",
      "impact_risk_under_fatigue": "moderate",
      "grip_risk_under_fatigue": "low"
    },
    "supervision_level": "recommended",
    "what_it_is": "Grip Repeatability Format organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 8,
          "work_target_seconds": 20,
          "rest_target_seconds": 40,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 12,
          "work_target_seconds": 30,
          "rest_target_seconds": 30,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 16,
          "work_target_seconds": 40,
          "rest_target_seconds": 20,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "low_skill_calisthenics",
        "bodyweight_strength",
        "machine_cardio",
        "locomotion"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "max_velocity_sprint"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "grip_repeatability_format_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "grip_repeatability_format_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "preferred_session_phase": "sustained_capacity",
      "allowed_session_phases": [
        "capacity",
        "resilience",
        "sustained_capacity"
      ],
      "default_duration_minutes": 12,
      "default_work_seconds": 30,
      "default_rest_seconds": 30,
      "default_rpe_range": [
        6,
        8
      ],
      "coaching_complexity": "moderate",
      "group_friendly": false,
      "equipment_flexibility": "high",
      "requires_timer": true,
      "requires_stations": false,
      "requires_lanes": false,
      "requires_clear_runout": false,
      "requires_score_tracking": false,
      "safety_notes": [
        "Choose simple movements",
        "Match work to recovery capacity"
      ]
    },
    "phase_profiles": [
      {
        "phase_key": "sustained_capacity",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "output",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "conditional",
        "fit_weight": 2
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 8,
        "default_rounds": null,
        "default_work_seconds": 20,
        "default_rest_seconds": 40,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 12,
        "default_rounds": null,
        "default_work_seconds": 30,
        "default_rest_seconds": 30,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 16,
        "default_rounds": null,
        "default_work_seconds": 40,
        "default_rest_seconds": 20,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "Grip Repeatability Format example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  },
  {
    "slug": "jump-rope-conditioning-format",
    "name": "Jump Rope Conditioning Format",
    "category": "Mixed-Modal Conditioning",
    "programming_type": "jump_rope_conditioning",
    "definition": "Jump Rope Conditioning Format: a structured programming method for organizing training work.",
    "coach_summary": "Use Jump Rope Conditioning Format to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for Jump Rope Conditioning Format and keep movement quality high.",
    "primary_development_goal": "repeatability under fatigue",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "mixed"
    ],
    "fatigue_profile": {
      "fatigue_intentional": true,
      "fatigue_level": "moderate",
      "technical_risk_under_fatigue": "moderate",
      "impact_risk_under_fatigue": "moderate",
      "grip_risk_under_fatigue": "low"
    },
    "supervision_level": "recommended",
    "what_it_is": "Jump Rope Conditioning Format organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 8,
          "work_target_seconds": 20,
          "rest_target_seconds": 40,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 12,
          "work_target_seconds": 30,
          "rest_target_seconds": 30,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 16,
          "work_target_seconds": 40,
          "rest_target_seconds": 20,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "low_skill_calisthenics",
        "bodyweight_strength",
        "machine_cardio",
        "locomotion"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "max_velocity_sprint"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "jump_rope_conditioning_format_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "jump_rope_conditioning_format_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "preferred_session_phase": "sustained_capacity",
      "allowed_session_phases": [
        "capacity",
        "resilience",
        "sustained_capacity"
      ],
      "default_duration_minutes": 12,
      "default_work_seconds": 30,
      "default_rest_seconds": 30,
      "default_rpe_range": [
        6,
        8
      ],
      "coaching_complexity": "moderate",
      "group_friendly": false,
      "equipment_flexibility": "high",
      "requires_timer": true,
      "requires_stations": false,
      "requires_lanes": false,
      "requires_clear_runout": false,
      "requires_score_tracking": false,
      "safety_notes": [
        "Choose simple movements",
        "Match work to recovery capacity"
      ]
    },
    "phase_profiles": [
      {
        "phase_key": "sustained_capacity",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "output",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "conditional",
        "fit_weight": 2
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 8,
        "default_rounds": null,
        "default_work_seconds": 20,
        "default_rest_seconds": 40,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 12,
        "default_rounds": null,
        "default_work_seconds": 30,
        "default_rest_seconds": 30,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 16,
        "default_rounds": null,
        "default_work_seconds": 40,
        "default_rest_seconds": 20,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "Jump Rope Conditioning Format example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  },
  {
    "slug": "low-amplitude-elastic-conditioning",
    "name": "Low-Amplitude Elastic Conditioning",
    "category": "Mixed-Modal Conditioning",
    "programming_type": "low_amplitude_elastic",
    "definition": "Low-Amplitude Elastic Conditioning: a structured programming method for organizing training work.",
    "coach_summary": "Use Low-Amplitude Elastic Conditioning to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for Low-Amplitude Elastic Conditioning and keep movement quality high.",
    "primary_development_goal": "repeatability under fatigue",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "mixed"
    ],
    "fatigue_profile": {
      "fatigue_intentional": true,
      "fatigue_level": "moderate",
      "technical_risk_under_fatigue": "moderate",
      "impact_risk_under_fatigue": "moderate",
      "grip_risk_under_fatigue": "low"
    },
    "supervision_level": "recommended",
    "what_it_is": "Low-Amplitude Elastic Conditioning organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 8,
          "work_target_seconds": 20,
          "rest_target_seconds": 40,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 12,
          "work_target_seconds": 30,
          "rest_target_seconds": 30,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 16,
          "work_target_seconds": 40,
          "rest_target_seconds": 20,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "low_skill_calisthenics",
        "bodyweight_strength",
        "machine_cardio",
        "locomotion"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "max_velocity_sprint"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "low_amplitude_elastic_conditioning_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "low_amplitude_elastic_conditioning_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "preferred_session_phase": "sustained_capacity",
      "allowed_session_phases": [
        "capacity",
        "resilience",
        "sustained_capacity"
      ],
      "default_duration_minutes": 12,
      "default_work_seconds": 30,
      "default_rest_seconds": 30,
      "default_rpe_range": [
        6,
        8
      ],
      "coaching_complexity": "moderate",
      "group_friendly": false,
      "equipment_flexibility": "high",
      "requires_timer": true,
      "requires_stations": false,
      "requires_lanes": false,
      "requires_clear_runout": false,
      "requires_score_tracking": false,
      "safety_notes": [
        "Choose simple movements",
        "Match work to recovery capacity"
      ]
    },
    "phase_profiles": [
      {
        "phase_key": "sustained_capacity",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "output",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "conditional",
        "fit_weight": 2
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 8,
        "default_rounds": null,
        "default_work_seconds": 20,
        "default_rest_seconds": 40,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 12,
        "default_rounds": null,
        "default_work_seconds": 30,
        "default_rest_seconds": 30,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 16,
        "default_rounds": null,
        "default_work_seconds": 40,
        "default_rest_seconds": 20,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "Low-Amplitude Elastic Conditioning example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  },
  {
    "slug": "bodyweight-strength-endurance-circuit",
    "name": "Bodyweight Strength-Endurance Circuit",
    "category": "Mixed-Modal Conditioning",
    "programming_type": "bodyweight_strength_endurance",
    "definition": "Bodyweight Strength-Endurance Circuit: a structured programming method for organizing training work.",
    "coach_summary": "Use Bodyweight Strength-Endurance Circuit to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for Bodyweight Strength-Endurance Circuit and keep movement quality high.",
    "primary_development_goal": "repeatability under fatigue",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "mixed"
    ],
    "fatigue_profile": {
      "fatigue_intentional": true,
      "fatigue_level": "moderate",
      "technical_risk_under_fatigue": "moderate",
      "impact_risk_under_fatigue": "moderate",
      "grip_risk_under_fatigue": "low"
    },
    "supervision_level": "recommended",
    "what_it_is": "Bodyweight Strength-Endurance Circuit organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 8,
          "work_target_seconds": 20,
          "rest_target_seconds": 40,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 12,
          "work_target_seconds": 30,
          "rest_target_seconds": 30,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 16,
          "work_target_seconds": 40,
          "rest_target_seconds": 20,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "low_skill_calisthenics",
        "bodyweight_strength",
        "machine_cardio",
        "locomotion"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "max_velocity_sprint"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "bodyweight_strength_endurance_circuit_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "bodyweight_strength_endurance_circuit_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "preferred_session_phase": "sustained_capacity",
      "allowed_session_phases": [
        "capacity",
        "resilience",
        "sustained_capacity"
      ],
      "default_duration_minutes": 12,
      "default_work_seconds": 30,
      "default_rest_seconds": 30,
      "default_rpe_range": [
        6,
        8
      ],
      "coaching_complexity": "moderate",
      "group_friendly": false,
      "equipment_flexibility": "high",
      "requires_timer": true,
      "requires_stations": false,
      "requires_lanes": false,
      "requires_clear_runout": false,
      "requires_score_tracking": false,
      "safety_notes": [
        "Choose simple movements",
        "Match work to recovery capacity"
      ]
    },
    "phase_profiles": [
      {
        "phase_key": "sustained_capacity",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "output",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "conditional",
        "fit_weight": 2
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 8,
        "default_rounds": null,
        "default_work_seconds": 20,
        "default_rest_seconds": 40,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 12,
        "default_rounds": null,
        "default_work_seconds": 30,
        "default_rest_seconds": 30,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 16,
        "default_rounds": null,
        "default_work_seconds": 40,
        "default_rest_seconds": 20,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "Bodyweight Strength-Endurance Circuit example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  },
  {
    "slug": "med-ball-conditioning-circuit",
    "name": "Med Ball Conditioning Circuit",
    "category": "Mixed-Modal Conditioning",
    "programming_type": "med_ball_circuit",
    "definition": "Med Ball Conditioning Circuit: a structured programming method for organizing training work.",
    "coach_summary": "Use Med Ball Conditioning Circuit to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for Med Ball Conditioning Circuit and keep movement quality high.",
    "primary_development_goal": "repeatability under fatigue",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "mixed"
    ],
    "fatigue_profile": {
      "fatigue_intentional": true,
      "fatigue_level": "moderate",
      "technical_risk_under_fatigue": "moderate",
      "impact_risk_under_fatigue": "moderate",
      "grip_risk_under_fatigue": "low"
    },
    "supervision_level": "recommended",
    "what_it_is": "Med Ball Conditioning Circuit organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 8,
          "work_target_seconds": 20,
          "rest_target_seconds": 40,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 12,
          "work_target_seconds": 30,
          "rest_target_seconds": 30,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 16,
          "work_target_seconds": 40,
          "rest_target_seconds": 20,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "low_skill_calisthenics",
        "bodyweight_strength",
        "machine_cardio",
        "locomotion"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "advanced_tumbling",
        "max_velocity_sprint"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "med_ball_conditioning_circuit_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "med_ball_conditioning_circuit_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "preferred_session_phase": "sustained_capacity",
      "allowed_session_phases": [
        "capacity",
        "resilience",
        "sustained_capacity"
      ],
      "default_duration_minutes": 12,
      "default_work_seconds": 30,
      "default_rest_seconds": 30,
      "default_rpe_range": [
        6,
        8
      ],
      "coaching_complexity": "moderate",
      "group_friendly": false,
      "equipment_flexibility": "high",
      "requires_timer": true,
      "requires_stations": false,
      "requires_lanes": false,
      "requires_clear_runout": false,
      "requires_score_tracking": false,
      "safety_notes": [
        "Choose simple movements",
        "Match work to recovery capacity"
      ]
    },
    "phase_profiles": [
      {
        "phase_key": "sustained_capacity",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "output",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "conditional",
        "fit_weight": 2
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 8,
        "default_rounds": null,
        "default_work_seconds": 20,
        "default_rest_seconds": 40,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 12,
        "default_rounds": null,
        "default_work_seconds": 30,
        "default_rest_seconds": 30,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 16,
        "default_rounds": null,
        "default_work_seconds": 40,
        "default_rest_seconds": 20,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "Med Ball Conditioning Circuit example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  },
  {
    "slug": "partner-relay-format",
    "name": "Partner Relay Format",
    "category": "Partner / Team Relay",
    "programming_type": "partner_relay",
    "definition": "Partner Relay Format: a structured programming method for organizing training work.",
    "coach_summary": "Use Partner Relay Format to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for Partner Relay Format and keep movement quality high.",
    "primary_development_goal": "repeatability under fatigue",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "mixed"
    ],
    "fatigue_profile": {
      "fatigue_intentional": true,
      "fatigue_level": "moderate",
      "technical_risk_under_fatigue": "moderate",
      "impact_risk_under_fatigue": "moderate",
      "grip_risk_under_fatigue": "low"
    },
    "supervision_level": "recommended",
    "what_it_is": "Partner Relay Format organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 8,
          "work_target_seconds": 20,
          "rest_target_seconds": 40,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 12,
          "work_target_seconds": 30,
          "rest_target_seconds": 30,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 16,
          "work_target_seconds": 40,
          "rest_target_seconds": 20,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "partner_drill",
        "game",
        "locomotion",
        "low_skill_calisthenics"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "max_velocity_sprint"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "partner_relay_format_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "partner_relay_format_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "group_friendly": true,
      "coaching_complexity": "moderate"
    },
    "phase_profiles": [
      {
        "phase_key": "sustained_capacity",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "output",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "conditional",
        "fit_weight": 2
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 8,
        "default_rounds": null,
        "default_work_seconds": 20,
        "default_rest_seconds": 40,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 12,
        "default_rounds": null,
        "default_work_seconds": 30,
        "default_rest_seconds": 30,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 16,
        "default_rounds": null,
        "default_work_seconds": 40,
        "default_rest_seconds": 20,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "Partner Relay Format example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  },
  {
    "slug": "game-based-conditioning-format",
    "name": "Game-Based Conditioning Format",
    "category": "Game-Based Conditioning",
    "programming_type": "game_conditioning",
    "definition": "Game-Based Conditioning Format: a structured programming method for organizing training work.",
    "coach_summary": "Use Game-Based Conditioning Format to build repeatability and pacing when exercise selection stays simple and safe.",
    "athlete_summary": "Follow the coach pacing cues for Game-Based Conditioning Format and keep movement quality high.",
    "primary_development_goal": "repeatability under fatigue",
    "secondary_development_goals": [
      "pacing",
      "work capacity"
    ],
    "best_session_phase": "sustained_capacity",
    "compatible_session_phases": [
      "capacity",
      "resilience",
      "sustained_capacity"
    ],
    "incompatible_phases": [
      "output",
      "movement_intelligence"
    ],
    "energy_system_focus": [
      "mixed"
    ],
    "fatigue_profile": {
      "fatigue_intentional": true,
      "fatigue_level": "moderate",
      "technical_risk_under_fatigue": "moderate",
      "impact_risk_under_fatigue": "moderate",
      "grip_risk_under_fatigue": "low"
    },
    "supervision_level": "recommended",
    "what_it_is": "Game-Based Conditioning Format organizes work and rest so athletes can repeat quality efforts.",
    "why_it_matters": "Builds sustainable work capacity while preserving movement standards.",
    "when_to_use": "Late in session during Sustained Capacity with simple, low-skill movements.",
    "when_not_to_use": "Before Output, Movement Intelligence, or when pain or poor deceleration control is present.",
    "common_misuse": [
      "progressing density before quality is stable",
      "using advanced skills under fatigue",
      "skipping rest when athletes need recovery"
    ],
    "work_rest_structure": {
      "default_prescription": {
        "beginner": {
          "minutes": 8,
          "work_target_seconds": 20,
          "rest_target_seconds": 40,
          "rpe": "5-6"
        },
        "intermediate": {
          "minutes": 12,
          "work_target_seconds": 30,
          "rest_target_seconds": 30,
          "rpe": "6-7"
        },
        "advanced": {
          "minutes": 16,
          "work_target_seconds": 40,
          "rest_target_seconds": 20,
          "rpe": "7-8"
        }
      }
    },
    "exercise_compatibility": {
      "compatible_exercise_types": [
        "partner_drill",
        "game",
        "locomotion",
        "low_skill_calisthenics"
      ],
      "avoid_exercise_types": [
        "advanced_skill",
        "max_velocity_sprint"
      ]
    },
    "quality_standards": [
      "movement quality stays consistent across rounds",
      "athlete can breathe and recover between efforts",
      "no pain or compensatory patterns",
      "posture and bracing remain organized",
      "effort matches prescribed intensity"
    ],
    "stop_rules": [
      "stop if movement quality degrades for two consecutive efforts",
      "stop if pain appears",
      "stop if athlete cannot recover adequately between efforts",
      "reduce load or complexity if pacing fails"
    ],
    "validator_rules": [
      {
        "rule_key": "game_based_conditioning_format_before_output",
        "condition_json": {
          "block_before_phase": "output"
        },
        "message": "Hard conditioning before Output may reduce power and skill quality.",
        "severity": "warning"
      },
      {
        "rule_key": "game_based_conditioning_format_youth_fatigue",
        "condition_json": {
          "athlete_age_max": 12,
          "fatigue_level": "high"
        },
        "message": "Use shorter work and longer rest for youth athletes.",
        "severity": "warning"
      }
    ],
    "workout_builder_rules": {
      "group_friendly": true,
      "coaching_complexity": "moderate"
    },
    "phase_profiles": [
      {
        "phase_key": "sustained_capacity",
        "role": "primary",
        "fit_weight": 5
      },
      {
        "phase_key": "capacity",
        "role": "secondary",
        "fit_weight": 3
      },
      {
        "phase_key": "resilience",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "restore",
        "role": "conditional",
        "fit_weight": 2
      },
      {
        "phase_key": "output",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "movement_intelligence",
        "role": "avoid",
        "fit_weight": 1
      },
      {
        "phase_key": "prepare_and_access",
        "role": "conditional",
        "fit_weight": 2
      }
    ],
    "prescriptions": [
      {
        "profile_name": "beginner",
        "default_total_minutes": 8,
        "default_rounds": null,
        "default_work_seconds": 20,
        "default_rest_seconds": 40,
        "default_rpe_min": 5,
        "default_rpe_max": 6,
        "notes": "Default beginner prescription."
      },
      {
        "profile_name": "intermediate",
        "default_total_minutes": 12,
        "default_rounds": null,
        "default_work_seconds": 30,
        "default_rest_seconds": 30,
        "default_rpe_min": 6,
        "default_rpe_max": 7,
        "notes": "Default intermediate prescription."
      },
      {
        "profile_name": "advanced",
        "default_total_minutes": 16,
        "default_rounds": null,
        "default_work_seconds": 40,
        "default_rest_seconds": 20,
        "default_rpe_min": 7,
        "default_rpe_max": 8,
        "notes": "Default advanced prescription."
      }
    ],
    "examples": [
      {
        "label": "Game-Based Conditioning Format example",
        "audience": "intermediate",
        "example_json": {
          "rounds": 4,
          "notes": "Illustrative structure only \u2014 select exercises in Workout Builder."
        },
        "coaching_notes": "Adjust work/rest to athlete level."
      }
    ]
  }
]
