/**
 * Rich card v2 content for Skill / Movement Intelligence shape cards 1–10.
 * Consumed by scripts/generate-106-skill-shape-cards.mjs
 * UPDATE-only on slugs seeded in migration 105.
 */

const GENDER_DEFAULT =
  'No sex-based default. Scale by trunk control, hip mobility, wrist tolerance, coordination, sport demand, and symptoms.'

/** @type {import('./foundation-access-cards-1-10.mjs').FoundationCard[]} */
export const SKILL_SHAPE_CARDS = [
  {
    slug: 'hollow-body-hold',
    name: 'Hollow Body Hold / Hollow Rock Prep',
    family: 'Gymnastics shape',
    slot: 'hollow_shape',
    cardSummary: 'Foundational anterior body-line shape that teaches ribs-down, posterior pelvic tilt, and trunk tension before tumbling and inversion.',
    bestPlacement: 'Early in Shape & Position Intelligence after breathing and dead bug when athletes need a clean hollow before rolls, hand support, or tumbling.',
    description: 'Lie supine with arms overhead and legs extended. Exhale to press the low back toward the floor, lift shoulders and legs slightly, and hold a long banana shape without rib flare or neck strain. Optional small hollow rocks only if the static hold is clean.',
    coachLanguage: 'Use when the athlete needs anterior body-line awareness before hollow-dependent skills. Keep dose low and shape crisp — not a core burnout.',
    athleteLanguage: 'Ribs down, belly tight, reach long through fingers and toes — hold your hollow like a stiff banana.',
    tenets: [
      {
        key: 'body_control',
        weight: 5
      },
      {
        key: 'coordination',
        weight: 4
      },
      {
        key: 'balance',
        weight: 3
      },
      {
        key: 'strength',
        weight: 2
      }
    ],
    methodologies: [
      {
        key: 'core_body_control',
        weight: 5
      },
      {
        key: 'neural',
        weight: 3
      },
      {
        key: 'balance_stability',
        weight: 3
      }
    ],
    physiology: [
      {
        key: 'control_stability',
        weight: 5
      },
      {
        key: 'neural_output_readiness',
        weight: 2
      }
    ],
    patterns: [
      {
        key: 'brace',
        weight: 5
      },
      {
        key: 'invert',
        weight: 2
      }
    ],
    equipment: [
      {
        key: 'mat',
        weight: 4
      },
      {
        key: 'none',
        weight: 3
      }
    ],
    body_regions: [
      {
        key: 'core',
        weight: 5
      },
      {
        key: 'spine',
        weight: 4
      },
      {
        key: 'full_body',
        weight: 3
      }
    ],
    whyItWorks: 'The hollow shape organizes anterior trunk tension, rib-pelvis stacking, and global body line — the same shape demanded in tumbling takeoffs, handstands, and bar work. Teaching it on the floor reduces compensation through the low back and neck before dynamic skill.',
    whyItGoesHere: 'Belongs in Shape & Position Intelligence (hollow_shape) — first static shape athletes must own before hollow-to-arch transitions and inversion progressions.',
    commonMisuse: 'Gymnastics shape programming rule: teach clean static shapes at low RPE in Skill first. Holds beyond ~30s or loaded isometrics belong in Control / Resilience; shape games that become conditioning belong in Fitness / Repeatability — not Skill. Do not rush dynamic transitions without prerequisite shapes in the same session. Do not progress to hollow rocks if the static hold loses low-back contact or ribs flare.',
    scalingGuidance: 'Scale by lumbar control, neck tolerance, hip flexor length, and symptoms; regress to tuck hollow or feet on floor.',
    movementRequirements: {
      primary_joint_actions: [
        'spinal_flexion',
        'shoulder_flexion'
      ],
      primary_tissues: [
        'abdominals',
        'hip_flexors'
      ],
      breathing_demand: 'nasal',
      balance_demand: 'stable',
      impact_level: 0,
      prerequisites: []
    },
    coachingExecution: {
      movement_description: 'Supine hollow with arms overhead and legs long. Exhale, ribs down, low back gently pressed to floor, lift shoulders and heels slightly. Hold or small controlled rocks.',
      setup: [
        'Mat',
        'Arms by ears',
        'Legs together and long',
        'Chin slightly tucked',
        'Exhale to set ribs'
      ],
      execution_steps: [
        'Exhale and draw ribs toward pelvis.',
        'Lift shoulder blades and heels off floor.',
        'Reach long through fingers and toes.',
        'Hold 10–20s with quiet breathing.',
        'Optional: tiny hollow rocks only if shape stays clean.'
      ],
      breathing_cues: [
        'Exhale to set the shape.',
        'Small breaths behind the brace.',
        'Do not hold breath until failure.'
      ],
      coach_cues: [
        'Ribs down.',
        'Low back stays heavy.',
        'Reach long.',
        'Neck quiet.',
        'Shape before rock.'
      ],
      athlete_cues: [
        'Banana tight.',
        'Press your back down.',
        'Long arms, long legs.',
        'No rib pop.'
      ],
      common_faults: [
        'Rib flare and arched low back.',
        'Legs too high or bent without control.',
        'Chin jutting or neck tension.',
        'Holding breath until failure.',
        'Rocking before static hold is owned.'
      ],
      stop_signs: [
        'Low-back pain.',
        'Neck pain or dizziness.',
        'Unable to maintain low-back contact after coaching.'
      ]
    },
    dosage: {
      volume_unit: 'reps',
      default_sets: 1,
      default_reps: 3,
      default_work_seconds: 20,
      default_rest_seconds: 0,
      est_seconds_per_set: 45,
      default_rpe_min: 2,
      default_rpe_max: 4,
      session_volume_min: 6,
      session_volume_max: 24
    },
    phaseProfile: {
      role: 'primary',
      fit_weight: 5,
      freshness_required: true,
      fatigue_sensitivity: 2,
      fatigue_cost: 1,
      technical_complexity: 2,
      impact_level: 0,
      intensity_ceiling: 'moderate',
      daily_ok: true,
      notes: 'Skill-dose hollow holds (10–20s, RPE 2–4). If holds exceed ~30s, add load, or become a core finisher, shift to Control / Resilience.'
    },
    scaling: {
      youth_beginner: 'Tuck hollow with feet on floor and arms at sides; 5–10s holds.',
      youth_intermediate: 'Standard hollow; reduce leg height if hip flexors pull the back off the floor.',
      teen: 'Standard hollow; reduce leg height if hip flexors pull the back off the floor.',
      adult_beginner: 'Standard hollow; reduce leg height if hip flexors pull the back off the floor.',
      adult_advanced: 'Add hollow rock prep only after 20s clean hold; avoid high rep rocks in Skill.',
      older_adult: 'Bent-knee hollow or dead-bug position with shorter holds.',
      pregnancy_postpartum: 'Use tuck hollow, elevated head support, or avoid prolonged supine holds if contraindicated; prioritize rib-pelvis stacking in side-lying or quadruped alternatives.'
    },
    pairsWellAfter: [
      'Arch Body Hold / Superman Shape',
      'Hollow-to-Arch Roll',
      'Wall Body-Line Drill'
    ],
    avoidBefore: [
      'Max-effort tumbling if hollow hold already fatigues trunk',
      'Long plank or GHD finisher before this shape block'
    ],
    subrole: 'shape_position_intelligence',
    genderSpecificNotes: 'No sex-based default. Scale by trunk control, hip mobility, wrist tolerance, coordination, sport demand, and symptoms.',
    goodForSessions: [
      'tumbling_prep',
      'sprint_prep',
      'landing_prep',
      'general_warmup'
    ],
    pairsWellBefore: [
      '90/90 Breathing',
      'Dead Bug Breathing / Heel Tap',
      'Glute Bridge'
    ],
    doNotUseWhen: [
      'Trunk or wrist pain worsens with shape',
      'Athlete is too fatigued to hold clean lines'
    ],
    mediaReferences: [
      'USA Gymnastics shape progressions',
      'Rick McCharles gymnastics body shapes'
    ],
    mediaInternalNotes: [
      'Shape cluster cards 1–10; align with Skill phase shape_position_intelligence.'
    ]
  },
  {
    slug: 'arch-body-hold',
    name: 'Arch Body Hold / Superman Shape',
    family: 'Gymnastics shape',
    slot: 'arch_shape',
    cardSummary: 'Posterior extension shape that teaches long spine, glute engagement, and shoulder extension contrast to hollow before rolls and arch-dependent skills.',
    bestPlacement: 'After hollow or breathing reset when athletes need extension awareness before backward rolls, bridges, or arch-to-hollow transitions.',
    description: 'Lie prone with arms extended overhead. Gently lift chest, arms, and legs off the floor while keeping the neck neutral and glutes active. Hold a long superman/arch shape without cramping or lumbar pinching.',
    coachLanguage: 'Pair with hollow teaching: athletes need both anterior and posterior body lines. Keep lift modest — this is shape intelligence, not back extension strength.',
    athleteLanguage: 'Lift your chest and legs slightly, squeeze your glutes, and reach long like a superhero — eyes down.',
    tenets: [
      {
        key: 'body_control',
        weight: 5
      },
      {
        key: 'coordination',
        weight: 4
      },
      {
        key: 'balance',
        weight: 3
      },
      {
        key: 'strength',
        weight: 2
      }
    ],
    methodologies: [
      {
        key: 'core_body_control',
        weight: 5
      },
      {
        key: 'neural',
        weight: 3
      },
      {
        key: 'balance_stability',
        weight: 3
      }
    ],
    physiology: [
      {
        key: 'control_stability',
        weight: 5
      },
      {
        key: 'neural_output_readiness',
        weight: 2
      }
    ],
    patterns: [
      {
        key: 'brace',
        weight: 5
      },
      {
        key: 'extend',
        weight: 3
      }
    ],
    equipment: [
      {
        key: 'mat',
        weight: 4
      },
      {
        key: 'none',
        weight: 3
      }
    ],
    body_regions: [
      {
        key: 'core',
        weight: 5
      },
      {
        key: 'spine',
        weight: 4
      },
      {
        key: 'full_body',
        weight: 3
      }
    ],
    whyItWorks: 'Arch/superman shape builds awareness of posterior chain engagement and long-spine extension used in backward rolls, walkovers, and hollow-to-arch contrast. Modest lift teaches control without turning the drill into maximal back extension.',
    whyItGoesHere: 'Belongs in Shape & Position Intelligence (arch_shape) — posterior counterpart to hollow before shape transitions and rolling foundations.',
    commonMisuse: 'Gymnastics shape programming rule: teach clean static shapes at low RPE in Skill first. Holds beyond ~30s or loaded isometrics belong in Control / Resilience; shape games that become conditioning belong in Fitness / Repeatability — not Skill. Do not rush dynamic transitions without prerequisite shapes in the same session. Do not hyperextend or hold maximal arch isometrics here — that is Control / Resilience work.',
    scalingGuidance: 'Scale by extension tolerance, lumbar symptoms, and coordination; use unilateral lifts or shorter holds.',
    movementRequirements: {
      primary_joint_actions: [
        'spinal_extension',
        'shoulder_extension'
      ],
      primary_tissues: [
        'glutes',
        'spinal_extensors'
      ],
      breathing_demand: 'nasal',
      balance_demand: 'stable',
      impact_level: 0,
      prerequisites: []
    },
    coachingExecution: {
      movement_description: 'Prone superman/arch hold with arms overhead, neutral neck, modest lift of chest and legs.',
      setup: [
        'Prone on mat',
        'Arms by ears',
        'Legs straight',
        'Forehead or chin neutral',
        'Glutes pre-set'
      ],
      execution_steps: [
        'Exhale lightly to brace.',
        'Lift chest, arms, and thighs slightly off floor.',
        'Reach long through fingers and toes.',
        'Hold 10–15s with glutes on.',
        'Lower with control.'
      ],
      breathing_cues: [
        'Breathe quietly during hold.',
        'Avoid breath-holding and cramping.'
      ],
      coach_cues: [
        'Long spine.',
        'Glutes lift legs.',
        'Eyes down.',
        'Small lift.',
        'No pinch in low back.'
      ],
      athlete_cues: [
        'Superhero long.',
        'Lift everything together.',
        'Quiet neck.',
        'Squeeze your glutes.'
      ],
      common_faults: [
        'Excessive lumbar hyperextension.',
        'Neck cranked upward.',
        'Legs flopping wider than chest lift.',
        'Holding breath until cramp.',
        'Arms shrugged into ears.'
      ],
      stop_signs: [
        'Low-back pinching.',
        'Headache or neck pain.',
        'Cramping that does not resolve with smaller range.'
      ]
    },
    dosage: {
      volume_unit: 'reps',
      default_sets: 1,
      default_reps: 3,
      default_work_seconds: 15,
      default_rest_seconds: 0,
      est_seconds_per_set: 40,
      default_rpe_min: 2,
      default_rpe_max: 4,
      session_volume_min: 5,
      session_volume_max: 20
    },
    phaseProfile: {
      role: 'primary',
      fit_weight: 5,
      freshness_required: true,
      fatigue_sensitivity: 2,
      fatigue_cost: 1,
      technical_complexity: 2,
      impact_level: 0,
      intensity_ceiling: 'moderate',
      daily_ok: true,
      notes: 'Skill-dose arch holds (10–15s). Longer loaded back-extension holds belong in Control / Resilience.'
    },
    scaling: {
      youth_beginner: 'Lift one arm and opposite leg only; 5s holds.',
      youth_intermediate: 'Modest bilateral lift; reduce height if lumbar pinches.',
      teen: 'Modest bilateral lift; reduce height if lumbar pinches.',
      adult_beginner: 'Modest bilateral lift; reduce height if lumbar pinches.',
      adult_advanced: 'Add slow arch rocks only if static hold is clean for 15s.',
      older_adult: 'Smaller lift or hands under forehead for support.',
      pregnancy_postpartum: 'Reduce lift height; avoid prolonged prone extension if uncomfortable — use standing cobra or wall arch awareness instead.'
    },
    pairsWellAfter: [
      'Hollow-to-Arch Roll',
      'Backward Roll Rocker / Backward Roll Progression'
    ],
    avoidBefore: [
      'Heavy hip hinge or deadlift fatigue that limits extension control'
    ],
    subrole: 'shape_position_intelligence',
    genderSpecificNotes: 'No sex-based default. Scale by trunk control, hip mobility, wrist tolerance, coordination, sport demand, and symptoms.',
    goodForSessions: [
      'tumbling_prep',
      'sprint_prep',
      'landing_prep',
      'general_warmup'
    ],
    pairsWellBefore: [
      '90/90 Breathing',
      'Dead Bug Breathing / Heel Tap',
      'Glute Bridge'
    ],
    doNotUseWhen: [
      'Trunk or wrist pain worsens with shape',
      'Athlete is too fatigued to hold clean lines'
    ],
    mediaReferences: [
      'USA Gymnastics shape progressions',
      'Rick McCharles gymnastics body shapes'
    ],
    mediaInternalNotes: [
      'Shape cluster cards 1–10; align with Skill phase shape_position_intelligence.'
    ]
  },
  {
    slug: 'hollow-to-arch-roll',
    name: 'Hollow-to-Arch Roll',
    family: 'Gymnastics shape',
    slot: 'shape_transition',
    cardSummary: 'Slow shape contrast drill rolling between hollow and arch on the floor to build axis awareness before log rolls and tumbling shape changes.',
    bestPlacement: 'After clean hollow and arch holds when athletes need to feel shape change without momentum or fatigue.',
    description: 'From a hollow shape on the back, allow a controlled roll through side-lying into a modest arch on the belly, then reverse. Move slowly with continuous body tension — not a fast log roll.',
    coachLanguage: 'Require prerequisite hollow and arch static shapes in the same session. This is contrast and control, not a conditioning roll circuit.',
    athleteLanguage: 'Stay tight, roll slowly from hollow to your belly shape and back — like a pencil flipping sides.',
    tenets: [
      {
        key: 'body_control',
        weight: 5
      },
      {
        key: 'coordination',
        weight: 4
      },
      {
        key: 'balance',
        weight: 3
      },
      {
        key: 'strength',
        weight: 2
      }
    ],
    methodologies: [
      {
        key: 'core_body_control',
        weight: 5
      },
      {
        key: 'neural',
        weight: 3
      },
      {
        key: 'balance_stability',
        weight: 3
      }
    ],
    physiology: [
      {
        key: 'control_stability',
        weight: 5
      },
      {
        key: 'perception_action_skill',
        weight: 2
      }
    ],
    patterns: [
      {
        key: 'brace',
        weight: 5
      },
      {
        key: 'rotate',
        weight: 4
      }
    ],
    equipment: [
      {
        key: 'mat',
        weight: 4
      },
      {
        key: 'none',
        weight: 3
      }
    ],
    body_regions: [
      {
        key: 'core',
        weight: 5
      },
      {
        key: 'spine',
        weight: 4
      },
      {
        key: 'full_body',
        weight: 3
      }
    ],
    whyItWorks: 'Alternating hollow and arch through a slow roll teaches the athlete to maintain tension while changing body line — the same demand in rolling progressions and tumbling shape switches. Slow speed exposes breaks in line that fast rolls hide.',
    whyItGoesHere: 'Belongs in Shape & Position Intelligence (shape_transition) — bridge between static shapes and rolling/tumbling foundations.',
    commonMisuse: 'Gymnastics shape programming rule: teach clean static shapes at low RPE in Skill first. Holds beyond ~30s or loaded isometrics belong in Control / Resilience; shape games that become conditioning belong in Fitness / Repeatability — not Skill. Do not rush dynamic transitions without prerequisite shapes in the same session. Do not use high-rep roll circuits for conditioning; that belongs in Fitness. Do not assign without hollow and arch holds first.',
    scalingGuidance: 'Assist through hips, shorten range, or use egg roll before full hollow-to-arch.',
    movementRequirements: {
      primary_joint_actions: [
        'spinal_flexion',
        'spinal_extension',
        'rotation'
      ],
      primary_tissues: [
        'abdominals',
        'glutes'
      ],
      breathing_demand: 'nasal',
      balance_demand: 'stable',
      impact_level: 0,
      prerequisites: [
        'hollow-body-hold',
        'arch-body-hold'
      ]
    },
    coachingExecution: {
      movement_description: 'Controlled supine hollow rolling to prone arch and return, maintaining body line.',
      setup: [
        'Mat',
        'Hollow shape reviewed',
        'Arch shape reviewed',
        'Arms overhead or by sides as coached'
      ],
      execution_steps: [
        'Set hollow with ribs down.',
        'Roll slowly through side body keeping legs long.',
        'Arrive in modest arch with glutes on.',
        'Reverse roll back to hollow.',
        'Repeat 3–5 slow reps.'
      ],
      breathing_cues: [
        'Exhale at shape change.',
        'Avoid breath-holding through the roll.'
      ],
      coach_cues: [
        'Slow pencil.',
        'Stay long.',
        'Shape change, not flop.',
        'Tight the whole roll.',
        'Eyes follow if safe.'
      ],
      athlete_cues: [
        'Tight banana to tight superhero.',
        'Roll like a log.',
        'No loose middle.'
      ],
      common_faults: [
        'Collapsing in the middle of the roll.',
        'Using momentum to flip fast.',
        'Neck whipping.',
        'Hips bending and breaking line.',
        'Attempting before static shapes are clean.'
      ],
      stop_signs: [
        'Dizziness.',
        'Neck pain.',
        'Low-back pain during transition.',
        'Athlete cannot find arch or hollow on command.'
      ]
    },
    dosage: {
      volume_unit: 'reps',
      default_sets: 1,
      default_reps: 4,
      default_work_seconds: null,
      default_rest_seconds: 0,
      est_seconds_per_set: 50,
      default_rpe_min: 2,
      default_rpe_max: 5,
      session_volume_min: 4,
      session_volume_max: 12
    },
    phaseProfile: {
      role: 'primary',
      fit_weight: 5,
      freshness_required: true,
      fatigue_sensitivity: 2,
      fatigue_cost: 2,
      technical_complexity: 3,
      impact_level: 0,
      intensity_ceiling: 'moderate',
      daily_ok: true,
      notes: 'Low-rep shape contrast only. High-rep rolling for conditioning → Fitness; long holds in either shape → Control.'
    },
    scaling: {
      youth_beginner: 'Coach-assisted hip roll or egg roll side-to-side before full hollow-to-arch.',
      youth_intermediate: 'Reduce reps; pause in each shape 2s before continuing.',
      teen: 'Reduce reps; pause in each shape 2s before continuing.',
      adult_beginner: 'Reduce reps; pause in each shape 2s before continuing.',
      adult_advanced: 'Add directional cue (hollow → arch only) before full reversals.',
      older_adult: 'Assist through shoulders/hips; smaller range.',
      pregnancy_postpartum: 'Use assisted rolls or shape holds only if rolling is contraindicated; avoid dizziness in supine transitions.'
    },
    pairsWellAfter: [
      'Log Roll / Pencil Roll',
      'Egg Roll / Tuck Roll Side-to-Side'
    ],
    avoidBefore: [
      'Full tumbling passes if trunk is already fatigued from roll volume'
    ],
    subrole: 'shape_position_intelligence',
    genderSpecificNotes: 'No sex-based default. Scale by trunk control, hip mobility, wrist tolerance, coordination, sport demand, and symptoms.',
    goodForSessions: [
      'tumbling_prep',
      'sprint_prep',
      'landing_prep',
      'general_warmup'
    ],
    pairsWellBefore: [
      '90/90 Breathing',
      'Dead Bug Breathing / Heel Tap',
      'Glute Bridge'
    ],
    doNotUseWhen: [
      'Trunk or wrist pain worsens with shape',
      'Athlete is too fatigued to hold clean lines'
    ],
    mediaReferences: [
      'USA Gymnastics shape progressions',
      'Rick McCharles gymnastics body shapes'
    ],
    mediaInternalNotes: [
      'Shape cluster cards 1–10; align with Skill phase shape_position_intelligence.'
    ]
  },
  {
    slug: 'tuck-hold-rock',
    name: 'Tuck Hold / Tuck Rock',
    family: 'Gymnastics shape',
    slot: 'tuck_shape',
    cardSummary: 'Compression tuck shape on back or seated that teaches knee-to-chest control before rolls, inversions, and tuck jumps.',
    bestPlacement: 'After hollow awareness when athletes need compact shape control before backward rolls, tuck jumps, or bar tuck shapes.',
    description: 'From supine or seated, pull knees toward chest with arms wrapping shins or beside knees. Hold a round tuck without collapsing posture. Optional small tuck rocks only if hold is stable.',
    coachLanguage: 'Emphasize round back and compact shape — not a sit-up crunch finisher. Keep reps low in Skill.',
    athleteLanguage: 'Hug your knees, round your back slightly, and hold your tuck tight like a ball.',
    tenets: [
      {
        key: 'body_control',
        weight: 5
      },
      {
        key: 'coordination',
        weight: 4
      },
      {
        key: 'balance',
        weight: 3
      },
      {
        key: 'strength',
        weight: 2
      }
    ],
    methodologies: [
      {
        key: 'core_body_control',
        weight: 5
      },
      {
        key: 'neural',
        weight: 3
      },
      {
        key: 'balance_stability',
        weight: 3
      }
    ],
    physiology: [
      {
        key: 'control_stability',
        weight: 5
      },
      {
        key: 'neural_output_readiness',
        weight: 2
      }
    ],
    patterns: [
      {
        key: 'brace',
        weight: 5
      }
    ],
    equipment: [
      {
        key: 'mat',
        weight: 4
      },
      {
        key: 'none',
        weight: 3
      }
    ],
    body_regions: [
      {
        key: 'core',
        weight: 5
      },
      {
        key: 'hip',
        weight: 4
      },
      {
        key: 'spine',
        weight: 3
      }
    ],
    whyItWorks: 'Tuck shape is the compression body line used in backward rolls, bar swings, and tuck jumps. Holding and lightly rocking the tuck builds spinal flexion control separate from hip flexor cramping.',
    whyItGoesHere: 'Belongs in Shape & Position Intelligence (tuck_shape) — compression counterpart to long hollow/straddle lines.',
    commonMisuse: 'Gymnastics shape programming rule: teach clean static shapes at low RPE in Skill first. Holds beyond ~30s or loaded isometrics belong in Control / Resilience; shape games that become conditioning belong in Fitness / Repeatability — not Skill. Do not rush dynamic transitions without prerequisite shapes in the same session. Do not turn tuck rocks into high-rep abdominal conditioning.',
    scalingGuidance: 'Feet down between reps, smaller rock amplitude, or seated tuck hold.',
    movementRequirements: {
      primary_joint_actions: [
        'hip_flexion',
        'spinal_flexion'
      ],
      primary_tissues: [
        'abdominals',
        'hip_flexors'
      ],
      breathing_demand: 'nasal',
      balance_demand: 'stable',
      impact_level: 0,
      prerequisites: [
        'hollow-body-hold'
      ]
    },
    coachingExecution: {
      movement_description: 'Compact tuck hold with knees pulled in; optional controlled tuck rock on mat.',
      setup: [
        'Mat',
        'Seated or supine start',
        'Arms wrap shins or hold knees'
      ],
      execution_steps: [
        'Pull knees toward chest.',
        'Round slightly through upper back.',
        'Hold tuck 10–15s.',
        'Optional: rock back and return without opening tuck.',
        'Reset between reps.'
      ],
      breathing_cues: [
        'Exhale to pull knees in.',
        'Quiet breaths during hold.'
      ],
      coach_cues: [
        'Round and tight.',
        'Knees close.',
        'Small rock.',
        'Feet quiet on return.'
      ],
      athlete_cues: [
        'Ball shape.',
        'Knees to chest.',
        'Stay round.',
        'Tiny rock.'
      ],
      common_faults: [
        'Opening tuck on the rock.',
        'Using momentum to slam back.',
        'Neck pulling forward aggressively.',
        'Hip flexor cramp from gripping too hard.',
        'Confusing with sit-up conditioning.'
      ],
      stop_signs: [
        'Hip flexor cramp.',
        'Low-back pain.',
        'Dizziness with rocking.'
      ]
    },
    dosage: {
      volume_unit: 'reps',
      default_sets: 1,
      default_reps: 4,
      default_work_seconds: 15,
      default_rest_seconds: 0,
      est_seconds_per_set: 45,
      default_rpe_min: 2,
      default_rpe_max: 4,
      session_volume_min: 4,
      session_volume_max: 16
    },
    phaseProfile: {
      role: 'primary',
      fit_weight: 5,
      freshness_required: true,
      fatigue_sensitivity: 2,
      fatigue_cost: 1,
      technical_complexity: 2,
      impact_level: 0,
      intensity_ceiling: 'moderate',
      daily_ok: true,
      notes: 'Skill tuck holds and small rocks only. High-rep tuck conditioning → Fitness; long weighted tuck holds → Control.'
    },
    scaling: {
      youth_beginner: 'Seated tuck hold without rock; feet on floor between reps.',
      youth_intermediate: 'Supine tuck hold; add tiny rock when hold is stable.',
      teen: 'Supine tuck hold; add tiny rock when hold is stable.',
      adult_beginner: 'Supine tuck hold; add tiny rock when hold is stable.',
      adult_advanced: 'Controlled tuck rock 4–6 reps if shape stays closed.',
      older_adult: 'Reduce rock range; hands behind thighs for support.',
      pregnancy_postpartum: 'Seated tuck or supported dead-bug tuck; avoid aggressive rocking if abdominal pressure is contraindicated.'
    },
    pairsWellAfter: [
      'Egg Roll / Tuck Roll Side-to-Side',
      'Backward Roll Rocker / Backward Roll Progression'
    ],
    subrole: 'shape_position_intelligence',
    genderSpecificNotes: 'No sex-based default. Scale by trunk control, hip mobility, wrist tolerance, coordination, sport demand, and symptoms.',
    goodForSessions: [
      'tumbling_prep',
      'sprint_prep',
      'landing_prep',
      'general_warmup'
    ],
    pairsWellBefore: [
      '90/90 Breathing',
      'Dead Bug Breathing / Heel Tap',
      'Glute Bridge'
    ],
    avoidBefore: [
      'High-fatigue core or wrist finisher before shape work'
    ],
    doNotUseWhen: [
      'Trunk or wrist pain worsens with shape',
      'Athlete is too fatigued to hold clean lines'
    ],
    mediaReferences: [
      'USA Gymnastics shape progressions',
      'Rick McCharles gymnastics body shapes'
    ],
    mediaInternalNotes: [
      'Shape cluster cards 1–10; align with Skill phase shape_position_intelligence.'
    ]
  },
  {
    slug: 'pike-fold-tall-sit',
    name: 'Pike Fold-to-Tall Sit Drill',
    family: 'Gymnastics shape',
    slot: 'pike_shape',
    cardSummary: 'Pike compression drill moving between folded pike and tall sit to teach hamstring length with stacked spine before pike jumps and bar work.',
    bestPlacement: 'When athletes need pike shape awareness before handstand pike entries, v-ups, or bar pike shapes — after breathing and core access.',
    description: 'Seated with legs extended, fold into pike reaching toward shins, then sit tall with stacked spine without losing control. Alternate slow fold and tall sit for shape contrast.',
    coachLanguage: 'Prioritize spine stack in tall sit and controlled fold — not maximal hamstring stretch force. Keep RPE low.',
    athleteLanguage: 'Fold forward with a flat back as far as you control, then sit tall like a string pulls your head up.',
    tenets: [
      {
        key: 'body_control',
        weight: 5
      },
      {
        key: 'coordination',
        weight: 4
      },
      {
        key: 'balance',
        weight: 3
      },
      {
        key: 'strength',
        weight: 2
      }
    ],
    methodologies: [
      {
        key: 'core_body_control',
        weight: 5
      },
      {
        key: 'neural',
        weight: 3
      },
      {
        key: 'balance_stability',
        weight: 3
      }
    ],
    physiology: [
      {
        key: 'control_stability',
        weight: 5
      },
      {
        key: 'neural_output_readiness',
        weight: 2
      }
    ],
    patterns: [
      {
        key: 'brace',
        weight: 4
      },
      {
        key: 'hinge',
        weight: 4
      }
    ],
    equipment: [
      {
        key: 'mat',
        weight: 4
      },
      {
        key: 'none',
        weight: 3
      }
    ],
    body_regions: [
      {
        key: 'hamstrings',
        weight: 4
      },
      {
        key: 'spine',
        weight: 4
      },
      {
        key: 'core',
        weight: 4
      }
    ],
    whyItWorks: 'Pike shape combines hamstring length with spinal flexion control needed for jumps, casts, and floor pike skills. Alternating fold and tall sit teaches the athlete to find both compression and stacked posture.',
    whyItGoesHere: 'Belongs in Shape & Position Intelligence (pike_shape) — compression line distinct from straddle and hollow.',
    commonMisuse: 'Gymnastics shape programming rule: teach clean static shapes at low RPE in Skill first. Holds beyond ~30s or loaded isometrics belong in Control / Resilience; shape games that become conditioning belong in Fitness / Repeatability — not Skill. Do not rush dynamic transitions without prerequisite shapes in the same session. Do not force maximal pike stretch or high-rep sit-ups disguised as pike folds.',
    scalingGuidance: 'Bent knees, elevated hips, or hands on floor beside hips for support.',
    movementRequirements: {
      primary_joint_actions: [
        'hip_flexion',
        'spinal_flexion'
      ],
      primary_tissues: [
        'hamstrings',
        'abdominals'
      ],
      breathing_demand: 'nasal',
      balance_demand: 'stable',
      impact_level: 0,
      prerequisites: [
        'hollow-body-hold'
      ]
    },
    coachingExecution: {
      movement_description: 'Seated pike fold then tall sit reset; slow tempo for shape quality.',
      setup: [
        'Mat',
        'Legs long',
        'Feet flexed',
        'Hands reach toward shins or ankles'
      ],
      execution_steps: [
        'Sit tall and stack spine.',
        'Hinge from hips into pike fold with flat back.',
        'Pause at controlled end range.',
        'Return to tall sit without collapsing.',
        'Repeat 5–8 slow reps.'
      ],
      breathing_cues: [
        'Exhale into fold.',
        'Inhale to grow tall.'
      ],
      coach_cues: [
        'Hinge, do not collapse.',
        'Tall sit reset.',
        'Knees point up.',
        'Reach chest, not forehead force.'
      ],
      athlete_cues: [
        'Fold with flat back.',
        'Sit tall between.',
        'Pull toes to you.'
      ],
      common_faults: [
        'Rounding aggressively with head pull.',
        'Bouncing at end range.',
        'Losing tall sit stack.',
        'Hamstring cramp from forcing depth.',
        'Using momentum.'
      ],
      stop_signs: [
        'Hamstring strain pain.',
        'Low-back pain in fold.',
        'Numbness or tingling.'
      ]
    },
    dosage: {
      volume_unit: 'reps',
      default_sets: 1,
      default_reps: 6,
      default_work_seconds: null,
      default_rest_seconds: 0,
      est_seconds_per_set: 55,
      default_rpe_min: 2,
      default_rpe_max: 4,
      session_volume_min: 6,
      session_volume_max: 18
    },
    phaseProfile: {
      role: 'primary',
      fit_weight: 5,
      freshness_required: true,
      fatigue_sensitivity: 2,
      fatigue_cost: 1,
      technical_complexity: 3,
      impact_level: 0,
      intensity_ceiling: 'moderate',
      daily_ok: true,
      notes: 'Skill pike shape reps at low RPE. Loaded pike holds or aggressive stretching blocks → Control or separate mobility work.'
    },
    scaling: {
      youth_beginner: 'Bent-knee pike fold; hands on floor beside hips.',
      youth_intermediate: 'Straight legs with smaller range; pause 2s in tall sit.',
      teen: 'Straight legs with smaller range; pause 2s in tall sit.',
      adult_beginner: 'Straight legs with smaller range; pause 2s in tall sit.',
      adult_advanced: 'Add light reach hold at end range if hamstrings tolerate.',
      older_adult: 'Elevated seat or strap around feet for assistance.',
      pregnancy_postpartum: 'Bent knees and smaller range; avoid aggressive abdominal compression if contraindicated.'
    },
    pairsWellAfter: [
      'Straddle Sit Reach and Lift',
      'Handstand line drills when pike entry is next'
    ],
    subrole: 'shape_position_intelligence',
    genderSpecificNotes: 'No sex-based default. Scale by trunk control, hip mobility, wrist tolerance, coordination, sport demand, and symptoms.',
    goodForSessions: [
      'tumbling_prep',
      'sprint_prep',
      'landing_prep',
      'general_warmup'
    ],
    pairsWellBefore: [
      '90/90 Breathing',
      'Dead Bug Breathing / Heel Tap',
      'Glute Bridge'
    ],
    avoidBefore: [
      'High-fatigue core or wrist finisher before shape work'
    ],
    doNotUseWhen: [
      'Trunk or wrist pain worsens with shape',
      'Athlete is too fatigued to hold clean lines'
    ],
    mediaReferences: [
      'USA Gymnastics shape progressions',
      'Rick McCharles gymnastics body shapes'
    ],
    mediaInternalNotes: [
      'Shape cluster cards 1–10; align with Skill phase shape_position_intelligence.'
    ]
  },
  {
    slug: 'straddle-sit-reach-lift',
    name: 'Straddle Sit Reach and Lift',
    family: 'Gymnastics shape',
    slot: 'straddle_shape',
    cardSummary: 'Straddle sit shape drill combining reach forward and lift of legs to build adductor control and stacked trunk for straddle jumps and press shapes.',
    bestPlacement: 'After pike or hollow work when athletes need straddle line awareness before straddle jumps, press handstands, or beam straddle skills.',
    description: 'Seated in a straddle, reach forward with a long spine, then practice lifting one or both legs slightly while maintaining upright trunk. Alternate reaches and lifts at low amplitude.',
    coachLanguage: 'Keep lift height modest — this is shape and active straddle control, not middle-split forcing or conditioning.',
    athleteLanguage: 'Sit in a wide V, reach long forward, then lift your legs slightly without leaning back.',
    tenets: [
      {
        key: 'body_control',
        weight: 5
      },
      {
        key: 'coordination',
        weight: 4
      },
      {
        key: 'balance',
        weight: 3
      },
      {
        key: 'strength',
        weight: 2
      }
    ],
    methodologies: [
      {
        key: 'core_body_control',
        weight: 5
      },
      {
        key: 'neural',
        weight: 3
      },
      {
        key: 'balance_stability',
        weight: 3
      }
    ],
    physiology: [
      {
        key: 'control_stability',
        weight: 5
      },
      {
        key: 'neural_output_readiness',
        weight: 2
      }
    ],
    patterns: [
      {
        key: 'brace',
        weight: 5
      }
    ],
    equipment: [
      {
        key: 'mat',
        weight: 4
      },
      {
        key: 'none',
        weight: 3
      }
    ],
    body_regions: [
      {
        key: 'hip',
        weight: 5
      },
      {
        key: 'core',
        weight: 4
      },
      {
        key: 'adductors',
        weight: 4
      }
    ],
    whyItWorks: 'Active straddle shape combines hip abduction control, adductor engagement, and trunk stack used in straddle jumps and press entries. Reach-and-lift teaches tension without passive oversplits.',
    whyItGoesHere: 'Belongs in Shape & Position Intelligence (straddle_shape) — wide-base compression line before dynamic straddle skills.',
    commonMisuse: 'Gymnastics shape programming rule: teach clean static shapes at low RPE in Skill first. Holds beyond ~30s or loaded isometrics belong in Control / Resilience; shape games that become conditioning belong in Fitness / Repeatability — not Skill. Do not rush dynamic transitions without prerequisite shapes in the same session. Do not force splits depth or high-rep leg lifts for conditioning in Skill.',
    scalingGuidance: 'Narrow straddle, bent knees, hand support behind, or single-leg lift only.',
    movementRequirements: {
      primary_joint_actions: [
        'hip_abduction',
        'hip_flexion',
        'spinal_flexion'
      ],
      primary_tissues: [
        'adductors',
        'hip_flexors',
        'abdominals'
      ],
      breathing_demand: 'nasal',
      balance_demand: 'stable',
      impact_level: 0,
      prerequisites: [
        'pike-fold-tall-sit'
      ]
    },
    coachingExecution: {
      movement_description: 'Straddle sit reach forward then low amplitude leg lift with stacked trunk.',
      setup: [
        'Mat',
        'Straddle angle comfortable',
        'Toes up',
        'Hands reach between legs or to shins'
      ],
      execution_steps: [
        'Sit tall in straddle.',
        'Reach forward with long spine.',
        'Return upright and lift one leg 2–4 inches.',
        'Alternate legs or lift both briefly if control allows.',
        'Maintain quiet upper body.'
      ],
      breathing_cues: [
        'Exhale on reach.',
        'Steady breath on lift.'
      ],
      coach_cues: [
        'Long reach.',
        'Lift from hips.',
        'Chest tall.',
        'Knees point up.',
        'Small lift.'
      ],
      athlete_cues: [
        'Wide V tall.',
        'Reach then lift.',
        'Toes to ceiling.',
        'No lean back.'
      ],
      common_faults: [
        'Collapsing chest on reach.',
        'Leaning back on leg lift.',
        'Turning out knees excessively.',
        'Forcing straddle width beyond control.',
        'High leg lifts turning into conditioning.'
      ],
      stop_signs: [
        'Groin pinching.',
        'Low-back pain.',
        'Hamstring cramp.'
      ]
    },
    dosage: {
      volume_unit: 'reps',
      default_sets: 1,
      default_reps: 6,
      default_work_seconds: null,
      default_rest_seconds: 0,
      est_seconds_per_set: 60,
      default_rpe_min: 2,
      default_rpe_max: 5,
      session_volume_min: 6,
      session_volume_max: 20
    },
    phaseProfile: {
      role: 'primary',
      fit_weight: 5,
      freshness_required: true,
      fatigue_sensitivity: 2,
      fatigue_cost: 2,
      technical_complexity: 3,
      impact_level: 0,
      intensity_ceiling: 'moderate',
      daily_ok: true,
      notes: 'Low-amplitude straddle shape work. Split forcing or high-rep leg lifts → separate mobility or Fitness — not Skill shape dose.'
    },
    scaling: {
      youth_beginner: 'Narrow straddle; reach only without lift.',
      youth_intermediate: 'Reach plus single-leg lift 2 inches.',
      teen: 'Reach plus single-leg lift 2 inches.',
      adult_beginner: 'Reach plus single-leg lift 2 inches.',
      adult_advanced: 'Alternate double-leg micro-lift if trunk stays stacked.',
      older_adult: 'Bent-knee straddle or elevated hips.',
      pregnancy_postpartum: 'Narrow straddle and hand support; avoid aggressive adductor stretch if symptomatic.'
    },
    pairsWellAfter: [
      'Beam Walk / Line Walk',
      'Straddle jump prep when athlete owns shape'
    ],
    subrole: 'shape_position_intelligence',
    genderSpecificNotes: 'No sex-based default. Scale by trunk control, hip mobility, wrist tolerance, coordination, sport demand, and symptoms.',
    goodForSessions: [
      'tumbling_prep',
      'sprint_prep',
      'landing_prep',
      'general_warmup'
    ],
    pairsWellBefore: [
      '90/90 Breathing',
      'Dead Bug Breathing / Heel Tap',
      'Glute Bridge'
    ],
    avoidBefore: [
      'High-fatigue core or wrist finisher before shape work'
    ],
    doNotUseWhen: [
      'Trunk or wrist pain worsens with shape',
      'Athlete is too fatigued to hold clean lines'
    ],
    mediaReferences: [
      'USA Gymnastics shape progressions',
      'Rick McCharles gymnastics body shapes'
    ],
    mediaInternalNotes: [
      'Shape cluster cards 1–10; align with Skill phase shape_position_intelligence.'
    ]
  },
  {
    slug: 'front-support-shape-hold',
    name: 'Front Support Shape Hold',
    family: 'Gymnastics shape',
    slot: 'support_shape',
    cardSummary: 'Front support/plank shape on hands teaching shoulder-over-wrist stack, protraction, and body line before handstand and tumbling support.',
    bestPlacement: 'After wrist prep and dead bug when athletes need hand-support shape before cartwheel, handstand, or floor support skills.',
    description: 'Set a high front support/plank with shoulders over wrists, ribs down, glutes on, and heels reaching back. Hold a straight line without sag or pike.',
    coachLanguage: 'Sequence after Prepare wrist and scapular access. Short holds — wrist fatigue before tumbling is a misuse.',
    athleteLanguage: 'Push the floor away, shoulders over hands, body straight like a table.',
    tenets: [
      {
        key: 'body_control',
        weight: 5
      },
      {
        key: 'coordination',
        weight: 4
      },
      {
        key: 'balance',
        weight: 3
      },
      {
        key: 'strength',
        weight: 2
      }
    ],
    methodologies: [
      {
        key: 'core_body_control',
        weight: 5
      },
      {
        key: 'neural',
        weight: 3
      },
      {
        key: 'balance_stability',
        weight: 3
      }
    ],
    physiology: [
      {
        key: 'control_stability',
        weight: 5
      },
      {
        key: 'neural_output_readiness',
        weight: 2
      }
    ],
    patterns: [
      {
        key: 'brace',
        weight: 5
      },
      {
        key: 'invert',
        weight: 2
      }
    ],
    equipment: [
      {
        key: 'mat',
        weight: 5
      },
      {
        key: 'none',
        weight: 2
      }
    ],
    body_regions: [
      {
        key: 'shoulder',
        weight: 5
      },
      {
        key: 'wrist',
        weight: 4
      },
      {
        key: 'core',
        weight: 5
      }
    ],
    whyItWorks: 'Front support is the base shape for handstands, cartwheels, and bars. Teaching protraction, shoulder stack, and rib-pelvis control on the floor reduces sag and wrist collapse before inversion.',
    whyItGoesHere: 'Belongs in Shape & Position Intelligence (support_shape) — anterior support line paired with rear support.',
    commonMisuse: 'Gymnastics shape programming rule: teach clean static shapes at low RPE in Skill first. Holds beyond ~30s or loaded isometrics belong in Control / Resilience; shape games that become conditioning belong in Fitness / Repeatability — not Skill. Do not rush dynamic transitions without prerequisite shapes in the same session. Do not hold maximal plank time here; >30s or weighted planks → Control. Do not stack before fresh wrist prep.',
    scalingGuidance: 'Elevated hands, knees down, or shorter holds based on wrist and shoulder tolerance.',
    movementRequirements: {
      primary_joint_actions: [
        'shoulder_flexion',
        'scapular_protraction'
      ],
      primary_tissues: [
        'shoulders',
        'wrists',
        'core'
      ],
      breathing_demand: 'nasal',
      balance_demand: 'stable',
      impact_level: 0,
      prerequisites: [
        'hollow-body-hold'
      ]
    },
    coachingExecution: {
      movement_description: 'Front support hold with straight body line and active shoulders.',
      setup: [
        'Mat',
        'Hands shoulder-width',
        'Wrist prep complete',
        'Shoulders over wrists'
      ],
      execution_steps: [
        'Set hands and push floor away.',
        'Protract shoulders slightly.',
        'Ribs down, glutes on.',
        'Hold 10–20s.',
        'Rest wrists between holds.'
      ],
      breathing_cues: [
        'Breathe behind the brace.',
        'Avoid max tension breath-hold.'
      ],
      coach_cues: [
        'Push floor.',
        'Shoulders over hands.',
        'Straight line.',
        'Heels back.',
        'Ribs down.'
      ],
      athlete_cues: [
        'Strong table.',
        'Push away.',
        'No sag.',
        'Wrists quiet.'
      ],
      common_faults: [
        'Scapular winging or sag.',
        'Pike hips up or sagging low back.',
        'Elbows locked and shrugging.',
        'Holding too long before tumbling.',
        'Skipping wrist prep.'
      ],
      stop_signs: [
        'Wrist pain.',
        'Shoulder pinching.',
        'Low-back pain.'
      ]
    },
    dosage: {
      volume_unit: 'reps',
      default_sets: 1,
      default_reps: 2,
      default_work_seconds: 15,
      default_rest_seconds: 0,
      est_seconds_per_set: 35,
      default_rpe_min: 2,
      default_rpe_max: 4,
      session_volume_min: 4,
      session_volume_max: 16
    },
    phaseProfile: {
      role: 'primary',
      fit_weight: 5,
      freshness_required: true,
      fatigue_sensitivity: 2,
      fatigue_cost: 2,
      technical_complexity: 3,
      impact_level: 0,
      intensity_ceiling: 'moderate',
      daily_ok: true,
      notes: 'Short front-support shape holds (10–20s). Long plank endurance or RPE >5 support work → Control / Resilience.'
    },
    scaling: {
      youth_beginner: 'Knees-down front support; 5–10s.',
      youth_intermediate: 'Full front support 10–15s with wrist breaks.',
      teen: 'Full front support 10–15s with wrist breaks.',
      adult_beginner: 'Full front support 10–15s with wrist breaks.',
      adult_advanced: 'Add scapular push at end of hold if wrists tolerate.',
      older_adult: 'Elevated hands on box; shorter holds.',
      pregnancy_postpartum: 'Elevated surface or kneeling plank; avoid prolonged hand support if wrist/abdominal pressure contraindicated.'
    },
    pairsWellAfter: [
      'Rear Support Shape Hold',
      'Cartwheel Hand-Placement Line Drill',
      'Wall Walk-Up to Handstand Line'
    ],
    avoidBefore: [
      'Handstand or cartwheel volume if wrists are already hot'
    ],
    subrole: 'shape_position_intelligence',
    genderSpecificNotes: 'No sex-based default. Scale by trunk control, hip mobility, wrist tolerance, coordination, sport demand, and symptoms.',
    goodForSessions: [
      'tumbling_prep',
      'sprint_prep',
      'landing_prep',
      'general_warmup'
    ],
    pairsWellBefore: [
      '90/90 Breathing',
      'Dead Bug Breathing / Heel Tap',
      'Glute Bridge'
    ],
    doNotUseWhen: [
      'Trunk or wrist pain worsens with shape',
      'Athlete is too fatigued to hold clean lines'
    ],
    mediaReferences: [
      'USA Gymnastics shape progressions',
      'Rick McCharles gymnastics body shapes'
    ],
    mediaInternalNotes: [
      'Shape cluster cards 1–10; align with Skill phase shape_position_intelligence.'
    ]
  },
  {
    slug: 'rear-support-shape-hold',
    name: 'Rear Support Shape Hold',
    family: 'Gymnastics shape',
    slot: 'support_shape',
    cardSummary: 'Rear support/table shape with hips lifted teaching shoulder extension, wrist load, and posterior line before bridge walks and backward skills.',
    bestPlacement: 'After front support when athletes need both support shapes before tumbling backward entries or cast prep.',
    description: 'Sit with hands behind hips, fingers forward or slightly out. Lift hips to a table shape with shoulders down, chest open, and knees bent at 90 degrees. Hold without wrist collapse.',
    coachLanguage: 'Pair with front support in the same session when possible. Keep holds short to protect wrists.',
    athleteLanguage: 'Lift your hips to a table, push through your hands, and open your chest.',
    tenets: [
      {
        key: 'body_control',
        weight: 5
      },
      {
        key: 'coordination',
        weight: 4
      },
      {
        key: 'balance',
        weight: 3
      },
      {
        key: 'strength',
        weight: 2
      }
    ],
    methodologies: [
      {
        key: 'core_body_control',
        weight: 5
      },
      {
        key: 'neural',
        weight: 3
      },
      {
        key: 'balance_stability',
        weight: 3
      }
    ],
    physiology: [
      {
        key: 'control_stability',
        weight: 5
      },
      {
        key: 'neural_output_readiness',
        weight: 2
      }
    ],
    patterns: [
      {
        key: 'brace',
        weight: 5
      },
      {
        key: 'extend',
        weight: 3
      }
    ],
    equipment: [
      {
        key: 'mat',
        weight: 4
      },
      {
        key: 'none',
        weight: 3
      }
    ],
    body_regions: [
      {
        key: 'shoulder',
        weight: 5
      },
      {
        key: 'wrist',
        weight: 5
      },
      {
        key: 'core',
        weight: 4
      }
    ],
    whyItWorks: 'Rear support builds the posterior hand-support line used in bridges, table walks, and cast preparation. It complements front support so athletes feel both protraction and open-shoulder extension under load.',
    whyItGoesHere: 'Belongs in Shape & Position Intelligence (support_shape) — posterior support counterpart to front support.',
    commonMisuse: 'Gymnastics shape programming rule: teach clean static shapes at low RPE in Skill first. Holds beyond ~30s or loaded isometrics belong in Control / Resilience; shape games that become conditioning belong in Fitness / Repeatability — not Skill. Do not rush dynamic transitions without prerequisite shapes in the same session. Do not turn into high-rep hip thrusts or long table holds for conditioning.',
    scalingGuidance: 'Bent knees, elevated hands, or shorter holds; regress if wrist extension is limited.',
    movementRequirements: {
      primary_joint_actions: [
        'shoulder_extension',
        'hip_extension'
      ],
      primary_tissues: [
        'shoulders',
        'wrists',
        'glutes'
      ],
      breathing_demand: 'nasal',
      balance_demand: 'stable',
      impact_level: 0,
      prerequisites: [
        'front-support-shape-hold'
      ]
    },
    coachingExecution: {
      movement_description: 'Rear support/table hold with hips lifted and open chest.',
      setup: [
        'Mat',
        'Hands behind hips',
        'Feet flat',
        'Wrist prep done'
      ],
      execution_steps: [
        'Place hands and set shoulders down.',
        'Lift hips to table height.',
        'Open chest without rib flare.',
        'Hold 10–15s.',
        'Lower hips with control.'
      ],
      breathing_cues: [
        'Steady nasal breathing.',
        'Do not breath-hold and cram wrists.'
      ],
      coach_cues: [
        'Push through hands.',
        'Open chest.',
        'Knees 90.',
        'Hips level.',
        'Short hold.'
      ],
      athlete_cues: [
        'Table top.',
        'Hips up.',
        'Shoulders back and down.',
        'Push the floor.'
      ],
      common_faults: [
        'Wrist collapsing inward.',
        'Shoulders shrugged to ears.',
        'Rib flare instead of chest open.',
        'Hips too low or too high.',
        'Long holds fatiguing wrists before skill.'
      ],
      stop_signs: [
        'Wrist pain in extension.',
        'Shoulder impingement symptoms.',
        'Low-back pinching.'
      ]
    },
    dosage: {
      volume_unit: 'reps',
      default_sets: 1,
      default_reps: 2,
      default_work_seconds: 12,
      default_rest_seconds: 0,
      est_seconds_per_set: 30,
      default_rpe_min: 2,
      default_rpe_max: 4,
      session_volume_min: 4,
      session_volume_max: 14
    },
    phaseProfile: {
      role: 'primary',
      fit_weight: 5,
      freshness_required: true,
      fatigue_sensitivity: 2,
      fatigue_cost: 2,
      technical_complexity: 3,
      impact_level: 0,
      intensity_ceiling: 'moderate',
      daily_ok: true,
      notes: 'Short rear-support shape holds. Extended table endurance or loaded hip thrust work → Control / Capacity — not Skill.'
    },
    scaling: {
      youth_beginner: 'Small hip lift with hands elevated on box.',
      youth_intermediate: 'Standard table hold 10s; rest wrists between.',
      teen: 'Standard table hold 10s; rest wrists between.',
      adult_beginner: 'Standard table hold 10s; rest wrists between.',
      adult_advanced: 'Add single-leg table only if wrists and shoulders tolerate.',
      older_adult: 'Elevated hands and shorter hold.',
      pregnancy_postpartum: 'Reduce range; use hip bridge alternative if wrist extension is contraindicated.'
    },
    pairsWellAfter: [
      'Wall Walk-Up to Handstand Line',
      'Backward Roll Rocker / Backward Roll Progression'
    ],
    avoidBefore: [
      'Heavy wrist extension volume then immediate tumbling'
    ],
    subrole: 'shape_position_intelligence',
    genderSpecificNotes: 'No sex-based default. Scale by trunk control, hip mobility, wrist tolerance, coordination, sport demand, and symptoms.',
    goodForSessions: [
      'tumbling_prep',
      'sprint_prep',
      'landing_prep',
      'general_warmup'
    ],
    pairsWellBefore: [
      '90/90 Breathing',
      'Dead Bug Breathing / Heel Tap',
      'Glute Bridge'
    ],
    doNotUseWhen: [
      'Trunk or wrist pain worsens with shape',
      'Athlete is too fatigued to hold clean lines'
    ],
    mediaReferences: [
      'USA Gymnastics shape progressions',
      'Rick McCharles gymnastics body shapes'
    ],
    mediaInternalNotes: [
      'Shape cluster cards 1–10; align with Skill phase shape_position_intelligence.'
    ]
  },
  {
    slug: 'wall-body-line-drill',
    name: 'Wall Body-Line Drill',
    family: 'Gymnastics shape',
    slot: 'line_drill',
    cardSummary: 'Standing wall line drill aligning ears, shoulders, hips, and heels to teach global posture and body line before handstand, sprint posture, and landing shapes.',
    bestPlacement: 'After static shapes when athletes need vertical line awareness before handstand line, wall sprint drill, or landing posture work.',
    description: 'Stand with back against a wall: head, upper back, hips, and heels contact where possible. Brace lightly, reach arms overhead without ribs flaring, and hold alignment. Step off and recall the line.',
    coachLanguage: 'Use as posture and line transfer — not a wall sit endurance test. Pair with hollow and support shapes in the same block.',
    athleteLanguage: 'Back against the wall, tall and straight from head to heels, arms up without leaning back.',
    tenets: [
      {
        key: 'body_control',
        weight: 5
      },
      {
        key: 'coordination',
        weight: 4
      },
      {
        key: 'balance',
        weight: 3
      },
      {
        key: 'strength',
        weight: 2
      }
    ],
    methodologies: [
      {
        key: 'core_body_control',
        weight: 5
      },
      {
        key: 'neural',
        weight: 3
      },
      {
        key: 'balance_stability',
        weight: 3
      }
    ],
    physiology: [
      {
        key: 'control_stability',
        weight: 5
      },
      {
        key: 'neural_output_readiness',
        weight: 2
      }
    ],
    patterns: [
      {
        key: 'brace',
        weight: 5
      },
      {
        key: 'locomote',
        weight: 2
      }
    ],
    equipment: [
      {
        key: 'none',
        weight: 4
      },
      {
        key: 'wall',
        weight: 5
      }
    ],
    body_regions: [
      {
        key: 'core',
        weight: 5
      },
      {
        key: 'spine',
        weight: 4
      },
      {
        key: 'full_body',
        weight: 3
      }
    ],
    whyItWorks: 'Wall line feedback gives immediate visual and tactile cues for global alignment used in handstands, sprint posture, and stuck landings. Overhead reach exposes rib flare that hollow work also targets.',
    whyItGoesHere: 'Belongs in Shape & Position Intelligence (line_drill) — vertical line intelligence after floor shapes.',
    commonMisuse: 'Gymnastics shape programming rule: teach clean static shapes at low RPE in Skill first. Holds beyond ~30s or loaded isometrics belong in Control / Resilience; shape games that become conditioning belong in Fitness / Repeatability — not Skill. Do not rush dynamic transitions without prerequisite shapes in the same session. Do not use long wall sits or overhead holds >30s as conditioning.',
    scalingGuidance: 'Partial wall contact, arms at sides first, or single-arm reach.',
    movementRequirements: {
      primary_joint_actions: [
        'shoulder_flexion',
        'postural_alignment'
      ],
      primary_tissues: [
        'core',
        'shoulders'
      ],
      breathing_demand: 'nasal',
      balance_demand: 'stable',
      impact_level: 0,
      prerequisites: [
        'hollow-body-hold',
        'front-support-shape-hold'
      ]
    },
    coachingExecution: {
      movement_description: 'Wall alignment with optional overhead reach; step-off line recall.',
      setup: [
        'Wall space',
        'Heels 2–4 inches from wall',
        'Feet hip-width'
      ],
      execution_steps: [
        'Stand tall against wall.',
        'Set head, ribs, hips, heels contact as available.',
        'Reach arms overhead without ribs popping.',
        'Hold 15–20s.',
        'Step forward and maintain line 5s.'
      ],
      breathing_cues: [
        'Exhale to set ribs before overhead reach.'
      ],
      coach_cues: [
        'Three points of contact.',
        'Ribs down on reach.',
        'Chin neutral.',
        'Glutes lightly on.'
      ],
      athlete_cues: [
        'Tall against wall.',
        'Reach without leaning.',
        'Same line stepping off.'
      ],
      common_faults: [
        'Excessive lumbar arch off wall.',
        'Rib flare on overhead reach.',
        'Heels lifting or knees bent into wall sit.',
        'Chin lifted away from wall.',
        'Turning into long isometric endurance.'
      ],
      stop_signs: [
        'Shoulder pain on overhead reach.',
        'Dizziness.',
        'Low-back pain with arching.'
      ]
    },
    dosage: {
      volume_unit: 'reps',
      default_sets: 1,
      default_reps: 3,
      default_work_seconds: 20,
      default_rest_seconds: 0,
      est_seconds_per_set: 50,
      default_rpe_min: 2,
      default_rpe_max: 4,
      session_volume_min: 5,
      session_volume_max: 18
    },
    phaseProfile: {
      role: 'primary',
      fit_weight: 5,
      freshness_required: true,
      fatigue_sensitivity: 2,
      fatigue_cost: 1,
      technical_complexity: 2,
      impact_level: 0,
      intensity_ceiling: 'moderate',
      daily_ok: true,
      notes: 'Line drill holds 15–20s at RPE 2–4. Wall sit endurance or overhead isometric max → Control.'
    },
    scaling: {
      youth_beginner: 'Wall contact at head and hips only; arms at sides.',
      youth_intermediate: 'Full line with overhead reach if shoulders allow.',
      teen: 'Full line with overhead reach if shoulders allow.',
      adult_beginner: 'Full line with overhead reach if shoulders allow.',
      adult_advanced: 'Add slow step-off walk maintaining line.',
      older_adult: 'Shorter holds; partial contact acceptable.',
      pregnancy_postpartum: 'Arms at sides only; avoid prolonged overhead if shoulder or abdominal symptoms present.'
    },
    pairsWellAfter: [
      'Wall Drill ISO — Split Shin Angle Hold',
      'Handstand Kick-Up to Wall or Spot'
    ],
    subrole: 'shape_position_intelligence',
    genderSpecificNotes: 'No sex-based default. Scale by trunk control, hip mobility, wrist tolerance, coordination, sport demand, and symptoms.',
    goodForSessions: [
      'tumbling_prep',
      'sprint_prep',
      'landing_prep',
      'general_warmup'
    ],
    pairsWellBefore: [
      '90/90 Breathing',
      'Dead Bug Breathing / Heel Tap',
      'Glute Bridge'
    ],
    avoidBefore: [
      'High-fatigue core or wrist finisher before shape work'
    ],
    doNotUseWhen: [
      'Trunk or wrist pain worsens with shape',
      'Athlete is too fatigued to hold clean lines'
    ],
    mediaReferences: [
      'USA Gymnastics shape progressions',
      'Rick McCharles gymnastics body shapes'
    ],
    mediaInternalNotes: [
      'Shape cluster cards 1–10; align with Skill phase shape_position_intelligence.'
    ]
  },
  {
    slug: 'stick-to-shape-freeze-game',
    name: 'Stick-to-Shape Freeze Game',
    family: 'Gymnastics shape',
    slot: 'shape_reaction',
    cardSummary: 'Coach-cued shape freeze game where athletes snap into hollow, arch, tuck, pike, straddle, or support shapes on command — shape recall under light cognitive load.',
    bestPlacement: 'Capstone of the shape cluster after static shapes 1–9 when athletes can hit shapes on verbal cue without conditioning fatigue.',
    description: 'Athletes move lightly in place or on a line. On cue, freeze into a prescribed shape (hollow on back, arch prone, tuck, pike sit, straddle, front support, etc.) for 3–5 seconds, then reset. Keep rounds short and rest generous.',
    coachLanguage: 'Requires prerequisite shapes in session. Stop if shapes degrade or heart rate turns this into conditioning — that belongs in Fitness.',
    athleteLanguage: 'When I call a shape, snap into it fast, hold it clean for three seconds, then reset.',
    tenets: [
      {
        key: 'body_control',
        weight: 5
      },
      {
        key: 'coordination',
        weight: 4
      },
      {
        key: 'balance',
        weight: 3
      },
      {
        key: 'strength',
        weight: 2
      }
    ],
    methodologies: [
      {
        key: 'core_body_control',
        weight: 4
      },
      {
        key: 'neural',
        weight: 4
      },
      {
        key: 'balance_stability',
        weight: 3
      }
    ],
    physiology: [
      {
        key: 'control_stability',
        weight: 4
      },
      {
        key: 'perception_action_skill',
        weight: 4
      }
    ],
    patterns: [
      {
        key: 'brace',
        weight: 4
      },
      {
        key: 'locomote',
        weight: 3
      }
    ],
    equipment: [
      {
        key: 'mat',
        weight: 4
      },
      {
        key: 'none',
        weight: 3
      }
    ],
    body_regions: [
      {
        key: 'core',
        weight: 5
      },
      {
        key: 'spine',
        weight: 4
      },
      {
        key: 'full_body',
        weight: 3
      }
    ],
    whyItWorks: 'Random shape recall under cue links static shape learning to decision and timing — the same demand when a coach calls corrections mid-pass or when an athlete must rebuild line quickly between skills.',
    whyItGoesHere: 'Belongs in Shape & Position Intelligence (shape_reaction) — perception-action capstone for the shape cluster, not a conditioning game.',
    commonMisuse: 'Gymnastics shape programming rule: teach clean static shapes at low RPE in Skill first. Holds beyond ~30s or loaded isometrics belong in Control / Resilience; shape games that become conditioning belong in Fitness / Repeatability — not Skill. Do not rush dynamic transitions without prerequisite shapes in the same session. If athletes chase speed with sloppy shapes or elevated heart rate for multiple minutes, move the game to Fitness / Repeatability or reduce rounds.',
    scalingGuidance: 'Fewer shapes in rotation, longer rest, partner demo first, or stick to floor shapes only.',
    movementRequirements: {
      primary_joint_actions: [
        'multi_shape'
      ],
      primary_tissues: [
        'full_body'
      ],
      breathing_demand: 'nasal',
      balance_demand: 'variable',
      impact_level: 0,
      prerequisites: [
        'hollow-body-hold',
        'arch-body-hold',
        'hollow-to-arch-roll',
        'tuck-hold-rock',
        'pike-fold-tall-sit',
        'straddle-sit-reach-lift',
        'front-support-shape-hold',
        'rear-support-shape-hold',
        'wall-body-line-drill'
      ]
    },
    coachingExecution: {
      movement_description: 'Verbal shape call → freeze 3–5s → reset; low locomotion between cues.',
      setup: [
        'Mat or line',
        'Shapes 1–9 reviewed',
        'Clear cue words',
        'Rest between rounds'
      ],
      execution_steps: [
        'Review cue-to-shape mapping.',
        'Light march or step on line.',
        'Coach calls shape — athlete freezes in clean position.',
        'Hold 3–5s.',
        'Reset and rest 10–15s between calls.'
      ],
      breathing_cues: [
        'Reset breath between cues.',
        'Do not sprint between shapes in Skill dose.'
      ],
      coach_cues: [
        'Shape first, speed second.',
        'Freeze clean.',
        'Rest between rounds.',
        'Stop if shapes break down.'
      ],
      athlete_cues: [
        'Listen, snap, freeze.',
        'Hold it pretty.',
        'Reset breathing.'
      ],
      common_faults: [
        'Running the game too long with rising heart rate.',
        'Sloppy shapes to win speed.',
        'Calling shapes not yet taught in session.',
        'No rest between cues.',
        'Using as punishment or conditioning finisher.'
      ],
      stop_signs: [
        'Shapes consistently break down.',
        'Athlete cannot hit prerequisite shapes on command.',
        'Excessive fatigue or dizziness.'
      ]
    },
    dosage: {
      volume_unit: 'reps',
      default_sets: 1,
      default_reps: 8,
      default_work_seconds: null,
      default_rest_seconds: 0,
      est_seconds_per_set: 90,
      default_rpe_min: 3,
      default_rpe_max: 5,
      session_volume_min: 8,
      session_volume_max: 24
    },
    phaseProfile: {
      role: 'primary',
      fit_weight: 5,
      freshness_required: true,
      fatigue_sensitivity: 3,
      fatigue_cost: 2,
      technical_complexity: 4,
      impact_level: 0,
      intensity_ceiling: 'moderate',
      daily_ok: true,
      notes: 'Skill-dose shape reaction: 6–10 cues with full rest. Continuous game play, elevated heart rate, or timed AMRAP → Fitness — not Skill.'
    },
    scaling: {
      youth_beginner: 'Two-shape rotation (hollow and arch only) with demo before each cue.',
      youth_intermediate: 'Rotate 4–5 shapes with 10s rest; coach checks shape before adding speed.',
      teen: 'Rotate 4–5 shapes with 10s rest; coach checks shape before adding speed.',
      adult_beginner: 'Rotate 4–5 shapes with 10s rest; coach checks shape before adding speed.',
      adult_advanced: 'Full shape deck with partner mirror check.',
      older_adult: 'Seated or kneeling shapes only to reduce transitions.',
      pregnancy_postpartum: 'Limit shape set and avoid high-pressure speed; substitute coached static shape holds if cognitive load is too high.'
    },
    pairsWellAfter: [
      'Log Roll / Pencil Roll',
      'Coach Point-and-Go Drill when blending shape and reaction'
    ],
    avoidBefore: [
      'Output or max tumbling if game already elevated heart rate'
    ],
    doNotUseWhen: [
      'Prerequisite static shapes not yet reviewed in session',
      'Athlete cannot hit hollow and arch on command',
      'Session already includes high-fatigue fitness block before Skill'
    ],
    subrole: 'shape_position_intelligence',
    genderSpecificNotes: 'No sex-based default. Scale by trunk control, hip mobility, wrist tolerance, coordination, sport demand, and symptoms.',
    goodForSessions: [
      'tumbling_prep',
      'sprint_prep',
      'landing_prep',
      'general_warmup'
    ],
    pairsWellBefore: [
      '90/90 Breathing',
      'Dead Bug Breathing / Heel Tap',
      'Glute Bridge'
    ],
    mediaReferences: [
      'USA Gymnastics shape progressions',
      'Rick McCharles gymnastics body shapes'
    ],
    mediaInternalNotes: [
      'Shape cluster cards 1–10; align with Skill phase shape_position_intelligence.'
    ]
  }
]
export const SKILL_SHAPE_SLUGS = SKILL_SHAPE_CARDS.map((c) => c.slug)

