# Top 50 High-Impact Level 3-4 Exercise Cards

## Source and caveat

Primary requested sources: Purpose.txt and exercise_card_details_for_llm.md. Purpose.txt was searched for but was not located in the accessible File Library results, so this deliverable does not pretend it was read. The authoring basis uses the accessible Vortex Card v2 descriptions of exercise_card_details_for_llm.md: phase-first authoring, canonical phase keys, taxonomy tags as key + weight, publish-gate fields, dosage, scaling cohorts, safety, pairing logic, regimen, phaseProfile, and the preferred camelCase JSON shape. Additional grounding comes from existing SSC/Stiffness, plyometrics, explosiveness, neural-output, and jumping-athlete card precedents surfaced in File Library, plus the user's stated impact threshold rules.

## Programming and impact threshold rules

- All 50 exercises are authored as Output-phase, high-impact options. They are not Prepare & Access warm-up prep. They should be placed after access and movement-intelligence work while the nervous system is fresh, before heavy strength, conditioning, or high-volume sport work. Every set ends when contact quality, posture, projection, braking alignment, decision quality, or reset speed degrades.
- Impact levels are set deliberately: 25 cards at impactLevel 3 and 25 cards at impactLevel 4. Each card sets movementRequirements.impactLevel, safety.impactLevel, and phaseProfile[].impactLevel to the same value, so each card qualifies for a High impact flag under the user's >=3 rule.

## Category map

- **01-10 - Level 3 - Landing-to-Rebound and Low Hurdle Bridge:** Moderate high-impact contacts that bridge controlled landings, low hurdles, split stance, and lateral edge control into Output work.
- **11-20 - Level 3 - Horizontal/Lateral Control and Moderate Bounds:** Moderate bounds, hops, and lateral-to-linear transitions that develop useful projection without level-4 volume or amplitude.
- **21-25 - Level 3 - Rotational/Reactive Impact Control:** Reactive and rotational single-contact drills that train cue processing while keeping contact dose controlled.
- **26-35 - Level 4 - Higher-Amplitude Bounds and Reactive Rebounds:** More demanding horizontal, lateral, hurdle, and depth-rebound progressions for athletes who own lower-level landings.
- **36-45 - Level 4 - COD, Curved, Partner, and Multidirectional Output:** Reactive agility and reorientation drills that combine high-impact contacts with braking, cutting, sprint-out, or live cues.
- **46-50 - Level 4 - Implement-Integrated and Reactive Plyometric Finishers:** Medicine-ball, band-assisted, hurdle, and partner constraints integrated with high-impact Output contacts.

## Exercise index

| # | Exercise | Impact | Primary phase / subrole / slot | Default dose | Why it belongs |
|---:|---|---:|---|---|---|
| 01 | Snap-Down to Low Vertical Rebound | 3/5 | `output` / `elastic_stiffness_plyometric_rudiments` / `snap_down_low_vertical_rebound` | 3 x 3-5 rebounds, 60-90s rest | bridges a controlled snap-down into a small vertical elastic response without making the athlete chase height |
| 02 | Low Box Drop to Quarter-Squat Rebound | 3/5 | `output` / `elastic_stiffness_plyometric_rudiments` / `low_box_drop_quarter_squat_rebound` | 3 x 2-4 reps, 90-120s rest | lets coaches expose a mild drop-to-rebound problem before taller depth or hurdle work |
| 03 | Step-Off to Single-Leg Stick | 3/5 | `output` / `single_leg_elastic_control` / `step_off_single_leg_stick` | 2-4 x 2-3/side, 60-90s rest | raises impact above low prep while still demanding a full stick before reactive progressions |
| 04 | Low Hurdle Hop to Pause Stick | 3/5 | `output` / `reactive_jump` / `low_hurdle_hop_pause_stick` | 3 x 2-4 hops, 60-120s rest | adds a clearance constraint while the pause prevents uncontrolled continuous contacts |
| 05 | Split-Stance Scissor Hop to Stick | 3/5 | `output` / `elastic_stiffness_plyometric_rudiments` / `split_stance_scissor_hop_to_stick` | 2-4 x 3-5 total, 60-90s rest | teaches hip exchange and trunk control without the volume of continuous scissor jumps |
| 06 | Lateral Line Hop to Single-Leg Stick | 3/5 | `output` / `single_leg_elastic_control` / `lateral_line_hop_single_leg_stick` | 2-4 x 2-4/side, 60-90s rest | makes lateral impact coachable with a small target and a clear stick requirement |
| 07 | Two-Hop Vertical Rhythm to Stick | 3/5 | `output` / `elastic_stiffness_plyometric_rudiments` / `two_hop_vertical_rhythm_to_stick` | 3 x 2 contacts + stick, 60-90s rest | teaches repeatability while the final stick exposes whether alignment survived the rebounds |
| 08 | Pogo-Pogo-Stick Series | 3/5 | `output` / `elastic_stiffness_plyometric_rudiments` / `pogo_pogo_stick_series` | 3 x 3-5 contacts, 45-90s rest | raises the common pogo into a high-impact bridge only when the final stick is owned |
| 09 | Low Hurdle Lateral Hop to Stick | 3/5 | `output` / `reactive_jump` / `low_hurdle_lateral_hop_to_stick` | 2-4 x 2-3/side, 75-120s rest | combines low hurdle stiffness with side-to-side landing control without continuous volume |
| 10 | Drop Landing to 45-Degree Push-Off | 3/5 | `output` / `deceleration_cod_power` / `drop_landing_45_degree_push_off` | 3 x 2-3/side, 90-120s rest | builds a bridge from vertical impact to athletic redirection while keeping the angle controlled |
| 11 | Broad Jump to Backpedal Reset | 3/5 | `output` / `jump_throw_explosive_power` / `broad_jump_backpedal_reset` | 3-5 x 1-3 reps, 90-120s rest | keeps broad-jump power but adds a practical reset pattern that rewards balanced landing |
| 12 | Skater Hop to Forward Re-Acceleration | 3/5 | `output` / `deceleration_cod_power` / `skater_hop_forward_reacceleration` | 3 x 2/side, 90-120s rest | connects lateral landing control to the next athletic action instead of stopping at the stick |
| 13 | Diagonal Bound to Stick | 3/5 | `output` / `single_leg_elastic_control` / `diagonal_bound_to_stick` | 2-4 x 2-3/side, 90s rest | adds diagonal sport transfer while keeping amplitude moderate and landing accountable |
| 14 | Single-Leg Lateral Hop to Stick | 3/5 | `output` / `single_leg_elastic_control` / `single_leg_lateral_hop_to_stick_alt` | 2-4 x 2-4/side, 60-90s rest | valuable for high-impact unilateral tolerance without the cost of repeated rebounds |
| 15 | Triple-Line Hop and Stick | 3/5 | `output` / `single_leg_elastic_control` / `triple_line_hop_and_stick` | 2-4 x 1 sequence/side, 90s rest | uses limited contact count to build repeat unilateral stiffness before longer hop tests |
| 16 | Carioca Bound to Stick | 3/5 | `output` / `multidirectional_elastic_power` / `carioca_bound_to_stick` | 2-3 x 2/side, 90-120s rest | turns carioca rhythm into a higher-impact elastic expression without chaotic volume |
| 17 | Medial-Lateral Ankle Hop Series | 3/5 | `output` / `elastic_stiffness_plyometric_rudiments` / `medial_lateral_ankle_hop_series` | 3 x 4-8 contacts/side, 45-75s rest | small but meaningful unilateral contacts help fill level-3 impact without requiring long jumps |
| 18 | Crossover Step to Bound and Stick | 3/5 | `output` / `multidirectional_elastic_power` / `crossover_step_bound_and_stick` | 2-4 x 2/side, 90-120s rest | builds reorientation power while the stick keeps the athlete from over-rotating |
| 19 | Hop-to-Hop-to-Stick Linear | 3/5 | `output` / `single_leg_elastic_control` / `hop_to_hop_to_stick_linear` | 2-4 x 1-2 sequences/side, 90s rest | more demanding than one hop but still bounded by a short series and visible quality gate |
| 20 | Curved Bound to Stick | 3/5 | `output` / `multidirectional_elastic_power` / `curved_bound_to_stick` | 2-4 x 2-3 bounds/side, 90-120s rest | adds curved force application for field and track athletes while keeping speed and volume moderate |
| 21 | 90-Degree Jump Turn to Stick | 3/5 | `output` / `multidirectional_elastic_control` / `ninety_degree_jump_turn_to_stick` | 3 x 2-3 each direction, 60-90s rest | trains rotation and landing integrity at a moderate impact level before adding rebounds |
| 22 | Reactive Cone-Call Hop to Stick | 3/5 | `output` / `reactive_agility_output` / `reactive_cone_call_hop_to_stick` | 3 x 3-5 calls, 75-120s rest | keeps decision quality high while adding a real high-impact contact |
| 23 | Partner Point Hop-to-Stick | 3/5 | `output` / `reactive_agility_output` / `partner_point_hop_to_stick` | 3 x 3-5 cues, 75-120s rest | the partner creates timing uncertainty without turning the drill into a race |
| 24 | Medicine Ball Catch to Low Hop and Stick | 3/5 | `output` / `upper_body_trunk_elasticity` / `med_ball_catch_low_hop_stick` | 2-4 x 2-4 reps, 90-120s rest | adds trunk/visual demand to a low hop while keeping ball load and amplitude conservative |
| 25 | Split-Stance Reactive Hop Switch | 3/5 | `output` / `reactive_agility_output` / `split_stance_reactive_hop_switch` | 3 x 3-5 total cues, 75-120s rest | combines reactive timing and split-stance impact without the cost of continuous maximal jumps |
| 26 | Alternate Bounds for Height and Distance | 4/5 | `output` / `elastic_stiffness_plyometric_rudiments` / `alternate_bounds_height_distance` | 3-4 x 4-6 bounds, 2-3min rest | progresses rhythm bounds into a more forceful distance-and-height output without going to level 5 |
| 27 | Single-Leg Triple Hop to Stick | 4/5 | `output` / `single_leg_elastic_control` / `single_leg_triple_hop_to_stick` | 2-4 x 1 sequence/side, 2-3min rest | excellent high-impact plyometric for athletes who have earned single-leg hop control |
| 28 | Repeated Broad Jump to Sprint-Out | 4/5 | `output` / `jump_throw_explosive_power` / `repeated_broad_jump_sprint_out` | 3-4 x 2 broad jumps + 5-10m, 2-3min rest | links repeated horizontal power to the next sport action while keeping reps low |
| 29 | Bounds to Decel Gate | 4/5 | `output` / `deceleration_cod_power` / `bounds_to_decel_gate` | 3-4 x 4 bounds + stick, 2-3min rest | adds a braking responsibility to high-output bounding so it is not just distance chasing |
| 30 | Lateral Bound Rebound Series | 4/5 | `output` / `multidirectional_elastic_power` / `lateral_bound_rebound_series` | 2-4 x 3-5 contacts, 2-3min rest | high-value frontal-plane output for athletes who already own skater hop sticks |
| 31 | Tuck Jump to Lateral Stick | 4/5 | `output` / `vertical_elastic_power` / `tuck_jump_to_lateral_stick` | 3 x 2-4 reps, 2min rest | uses a high vertical demand but caps chaos with a deliberate lateral stick |
| 32 | Low Hurdle Hop Continuous with Turn | 4/5 | `output` / `reactive_jump` / `low_hurdle_hop_continuous_with_turn` | 2-4 x 3-5 contacts, 2-3min rest | progresses hurdle contacts by adding turn control rather than simply increasing height |
| 33 | Hurdle Hop to Broad Jump | 4/5 | `output` / `reactive_jump` / `hurdle_hop_to_broad_jump` | 3-4 x 1-3 sequences, 2-3min rest | combines vertical stiffness and horizontal power in a small enough dose to stay quality-first |
| 34 | Depth Drop to Lateral Rebound | 4/5 | `output` / `depth_reactive_jump` / `depth_drop_lateral_rebound` | 2-4 x 2/side, 2-3min rest | strong level-4 option for athletes who need lateral elastic power after absorbing impact |
| 35 | Depth Drop to Broad Rebound | 4/5 | `output` / `depth_reactive_jump` / `depth_drop_broad_rebound` | 2-4 x 1-3 reps, 2-3min rest | high-impact horizontal elastic bridge that belongs only after lower-level drop and broad-jump quality |
| 36 | Reactive 45-Degree Hop-to-Cut | 4/5 | `output` / `reactive_agility_output` / `reactive_45_degree_hop_to_cut` | 3-5 x 1-2/side, 2-3min rest | combines impact, braking, decision timing, and re-acceleration in a capped output dose |
| 37 | Crossover Bound to Re-Acceleration | 4/5 | `output` / `deceleration_cod_power` / `crossover_bound_reacceleration` | 3-4 x 2/side, 2-3min rest | turns crossover power into usable sport acceleration without high-volume cutting |
| 38 | Partner Chase Bound Start | 4/5 | `output` / `reactive_agility_output` / `partner_chase_bound_start` | 3-5 x 1 chase/side, 2-3min rest | adds meaningful uncertainty while keeping the high-impact portion short and supervised |
| 39 | Shuffle-to-Bound-to-Sprint | 4/5 | `output` / `deceleration_cod_power` / `shuffle_bound_sprint` | 3-5 x 1 sequence/side, 2-3min rest | connects lateral movement, high-impact bound, and sprint-out in one coachable pattern |
| 40 | Backpedal Turn to Hop-and-Go | 4/5 | `output` / `deceleration_cod_power` / `backpedal_turn_hop_and_go` | 3-4 x 1 sequence/side, 2-3min rest | fills a useful gap between agility mechanics and true high-impact re-acceleration |
| 41 | Curved Sprint Bound Series | 4/5 | `output` / `max_velocity_exposure` / `curved_sprint_bound_series` | 3-4 x 10-20m, 2-3min rest | uses curve constraints to challenge stiffness and posture without maximal sprint volume |
| 42 | Zigzag Bound Rebound Course | 4/5 | `output` / `multidirectional_elastic_power` / `zigzag_bound_rebound_course` | 2-4 x 4-6 contacts, 2-3min rest | develops repeated angle changes while preserving a simple cone-defined quality gate |
| 43 | 180 Jump Rebound to Sprint-Out | 4/5 | `output` / `multidirectional_elastic_control` / `one_eighty_jump_rebound_sprint_out` | 3-4 x 1-2 reps/side, 2-3min rest | progresses a 180 rebound into sport-relevant acceleration without chasing fatigue |
| 44 | Single-Leg Lateral Rebound to Cut | 4/5 | `output` / `single_leg_elastic_control` / `single_leg_lateral_rebound_to_cut` | 2-4 x 1-2/side, 2-3min rest | high-transfer but high-cost unilateral contact for athletes with demonstrated single-leg landing skill |
| 45 | Reaction Ball Drop to Hop-and-Go | 4/5 | `output` / `reactive_agility_output` / `reaction_ball_drop_hop_and_go` | 3-5 x 1 rep/side, 2-3min rest | adds perception-action demand while preserving a small number of high-quality contacts |
| 46 | Medicine Ball Scoop Toss to Broad Rebound | 4/5 | `output` / `jump_throw_explosive_power` / `med_ball_scoop_toss_broad_rebound` | 3-5 x 1-2 reps, 2-3min rest | pairs trunk/hip projection with lower-body elastic output without letting the throw become conditioning |
| 47 | Medicine Ball Rotational Toss to Lateral Bound | 4/5 | `output` / `jump_throw_explosive_power` / `med_ball_rotational_toss_lateral_bound` | 3-4 x 1-2/side, 2-3min rest | connects implement power to a real high-impact lateral projection with clear spacing requirements |
| 48 | Resisted Band-Assisted Rebound Jump | 4/5 | `output` / `vertical_elastic_power` / `resisted_band_assisted_rebound_jump` | 2-4 x 3-5 contacts, 2-3min rest | band assistance can sharpen rebound timing but requires coaching so impact stays organized |
| 49 | Low Hurdle Hop to Reactive Color Call | 4/5 | `output` / `reactive_agility_output` / `low_hurdle_hop_reactive_color_call` | 3-5 x 1-2 reps, 2-3min rest | merges reactive decision-making with a level-4 contact while keeping total contacts capped |
| 50 | Mirror Bound-and-Cut Duel | 4/5 | `output` / `reactive_agility_output` / `mirror_bound_and_cut_duel` | 3-5 x 3-5s bouts, 2-3min rest | the most sport-like option in the set; useful only when spacing, maturity, and stop command quality are excellent |

## Full Cursor-ready JSON

```json
{
  "library": {
    "title": "Top 50 High-Impact Level 3-4 Exercise Library",
    "focus": "high_impact_level_3_4_expansion",
    "purpose": "Add 25 more level-3 and 25 more level-4 high-impact exercise cards while preserving phase honesty, safety gating, and Card v2 authoring structure.",
    "cardCount": 50,
    "generatedOn": "2026-07-07",
    "impactDistribution": {
      "level3": 25,
      "level4": 25
    },
    "primaryPhaseKey": "output"
  },
  "sourceNotes": {
    "purposeTxt": {
      "status": "Requested and searched for, but not located in accessible File Library results.",
      "handling": "This file does not claim Purpose.txt was read. It uses the available Card v2 descriptions, existing Vortex exercise-card precedents, and stable coaching expertise."
    },
    "exerciseCardDetailsForLlmMd": {
      "usedFor": [
        "phase-first authoring",
        "canonical primaryPhaseKey/subrole/slot fields",
        "taxonomy tags with key + weight",
        "movementRequirements, coachingExecution, dosage, scaling, safety, pairingLogic, regimen, and phaseProfile",
        "anti-pattern avoidance: no conditioning drift, no Prepare & Access misuse for high-impact contacts"
      ]
    },
    "sourceBasis": "Primary requested sources: Purpose.txt and exercise_card_details_for_llm.md. Purpose.txt was searched for but was not located in the accessible File Library results, so this deliverable does not pretend it was read. The authoring basis uses the accessible Vortex Card v2 descriptions of exercise_card_details_for_llm.md: phase-first authoring, canonical phase keys, taxonomy tags as key + weight, publish-gate fields, dosage, scaling cohorts, safety, pairing logic, regimen, phaseProfile, and the preferred camelCase JSON shape. Additional grounding comes from existing SSC/Stiffness, plyometrics, explosiveness, neural-output, and jumping-athlete card precedents surfaced in File Library, plus the user's stated impact threshold rules.",
    "programmingRule": "All 50 exercises are authored as Output-phase, high-impact options. They are not Prepare & Access warm-up prep. They should be placed after access and movement-intelligence work while the nervous system is fresh, before heavy strength, conditioning, or high-volume sport work. Every set ends when contact quality, posture, projection, braking alignment, decision quality, or reset speed degrades.",
    "thresholdRule": "Impact levels are set deliberately: 25 cards at impactLevel 3 and 25 cards at impactLevel 4. Each card sets movementRequirements.impactLevel, safety.impactLevel, and phaseProfile[].impactLevel to the same value, so each card qualifies for a High impact flag under the user's >=3 rule."
  },
  "categories": [
    {
      "range": "01-10",
      "title": "Level 3 - Landing-to-Rebound and Low Hurdle Bridge",
      "focus": "Moderate high-impact contacts that bridge controlled landings, low hurdles, split stance, and lateral edge control into Output work."
    },
    {
      "range": "11-20",
      "title": "Level 3 - Horizontal/Lateral Control and Moderate Bounds",
      "focus": "Moderate bounds, hops, and lateral-to-linear transitions that develop useful projection without level-4 volume or amplitude."
    },
    {
      "range": "21-25",
      "title": "Level 3 - Rotational/Reactive Impact Control",
      "focus": "Reactive and rotational single-contact drills that train cue processing while keeping contact dose controlled."
    },
    {
      "range": "26-35",
      "title": "Level 4 - Higher-Amplitude Bounds and Reactive Rebounds",
      "focus": "More demanding horizontal, lateral, hurdle, and depth-rebound progressions for athletes who own lower-level landings."
    },
    {
      "range": "36-45",
      "title": "Level 4 - COD, Curved, Partner, and Multidirectional Output",
      "focus": "Reactive agility and reorientation drills that combine high-impact contacts with braking, cutting, sprint-out, or live cues."
    },
    {
      "range": "46-50",
      "title": "Level 4 - Implement-Integrated and Reactive Plyometric Finishers",
      "focus": "Medicine-ball, band-assisted, hurdle, and partner constraints integrated with high-impact Output contacts."
    }
  ],
  "cards": [
    {
      "id": 1,
      "slug": "snap-down-to-low-vertical-rebound",
      "name": "Snap-Down to Low Vertical Rebound",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_3",
      "impactClassification": {
        "movementImpactLevel": 3,
        "safetyImpactLevel": 3,
        "phaseProfileImpactLevel": 3,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "elastic_stiffness_plyometric_rudiments",
      "subroleSecondary": "landing_to_rebound_bridge",
      "slot": "snap_down_low_vertical_rebound",
      "category": "Level 3 - Landing-to-Rebound and Low Hurdle Bridge",
      "cardSummary": "Snap-Down to Low Vertical Rebound is a level-3 high-impact Output drill for low-amplitude rebound timing after a clean braking position.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Snap-Down to Low Vertical Rebound as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets low-amplitude rebound timing after a clean braking position. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: elastic_stiffness_plyometric_rudiments. Coach this as level-3 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "bridges a controlled snap-down into a small vertical elastic response without making the athlete chase height",
      "selectionTarget": "low-amplitude rebound timing after a clean braking position",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "jump",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 4
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
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
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
      "whyItWorks": "Snap-Down to Low Vertical Rebound creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because bridges a controlled snap-down into a small vertical elastic response without making the athlete chase height.",
      "whyItGoesHere": "Belongs in Output because impact level 3 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing"
        ],
        "primaryTissues": [
          "calf complex",
          "Achilles tendon",
          "quadriceps",
          "patellar tendon",
          "glutes",
          "hip flexors",
          "abdominals",
          "obliques"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "dynamic",
        "coordinationDemand": "high",
        "impactLevel": 3,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "3 x 3-5 rebounds, 60-90s rest",
        "sets": "2-4",
        "repsOrContacts": "2-5 quality reps/contacts",
        "rest": "60-120 seconds",
        "contactCap": "10-24 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 3,
        "impactLevel": 3,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 3,
          "fatigueSensitivity": 5,
          "technicalComplexity": 3,
          "intensityCeiling": "high",
          "impactLevel": 3
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 2,
      "slug": "low-box-drop-to-quarter-squat-rebound",
      "name": "Low Box Drop to Quarter-Squat Rebound",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_3",
      "impactClassification": {
        "movementImpactLevel": 3,
        "safetyImpactLevel": 3,
        "phaseProfileImpactLevel": 3,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "elastic_stiffness_plyometric_rudiments",
      "subroleSecondary": "depth_reactive_bridge",
      "slot": "low_box_drop_quarter_squat_rebound",
      "category": "Level 3 - Landing-to-Rebound and Low Hurdle Bridge",
      "cardSummary": "Low Box Drop to Quarter-Squat Rebound is a level-3 high-impact Output drill for short drop absorption and immediate vertical re-output.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Low Box Drop to Quarter-Squat Rebound as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets short drop absorption and immediate vertical re-output. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: elastic_stiffness_plyometric_rudiments. Coach this as level-3 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "lets coaches expose a mild drop-to-rebound problem before taller depth or hurdle work",
      "selectionTarget": "short drop absorption and immediate vertical re-output",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "land",
          "weight": 5
        },
        {
          "key": "jump",
          "weight": 4
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
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
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
      "whyItWorks": "Low Box Drop to Quarter-Squat Rebound creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because lets coaches expose a mild drop-to-rebound problem before taller depth or hurdle work.",
      "whyItGoesHere": "Belongs in Output because impact level 3 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing"
        ],
        "primaryTissues": [
          "calf complex",
          "Achilles tendon",
          "quadriceps",
          "patellar tendon",
          "glutes",
          "hip flexors",
          "abdominals",
          "obliques"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "dynamic",
        "coordinationDemand": "high",
        "impactLevel": 3,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "3 x 2-4 reps, 90-120s rest",
        "sets": "2-4",
        "repsOrContacts": "2-5 quality reps/contacts",
        "rest": "60-120 seconds",
        "contactCap": "10-24 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 3,
        "impactLevel": 3,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 3,
          "fatigueSensitivity": 5,
          "technicalComplexity": 3,
          "intensityCeiling": "high",
          "impactLevel": 3
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 3,
      "slug": "step-off-to-single-leg-stick",
      "name": "Step-Off to Single-Leg Stick",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_3",
      "impactClassification": {
        "movementImpactLevel": 3,
        "safetyImpactLevel": 3,
        "phaseProfileImpactLevel": 3,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "single_leg_elastic_control",
      "subroleSecondary": "landing_braking_control",
      "slot": "step_off_single_leg_stick",
      "category": "Level 3 - Landing-to-Rebound and Low Hurdle Bridge",
      "cardSummary": "Step-Off to Single-Leg Stick is a level-3 high-impact Output drill for unilateral landing accountability from a small step-off.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Step-Off to Single-Leg Stick as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets unilateral landing accountability from a small step-off. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: single_leg_elastic_control. Coach this as level-3 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "raises impact above low prep while still demanding a full stick before reactive progressions",
      "selectionTarget": "unilateral landing accountability from a small step-off",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "land",
          "weight": 5
        },
        {
          "key": "brace",
          "weight": 4
        },
        {
          "key": "balance",
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
      "whyItWorks": "Step-Off to Single-Leg Stick creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because raises impact above low prep while still demanding a full stick before reactive progressions.",
      "whyItGoesHere": "Belongs in Output because impact level 3 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing"
        ],
        "primaryTissues": [
          "intrinsic foot",
          "plantar fascia",
          "calf complex",
          "Achilles tendon",
          "quadriceps",
          "patellar tendon",
          "glutes",
          "hip flexors"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "dynamic",
        "coordinationDemand": "high",
        "impactLevel": 3,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "2-4 x 2-3/side, 60-90s rest",
        "sets": "2-4",
        "repsOrContacts": "2-5 quality reps/contacts",
        "rest": "60-120 seconds",
        "contactCap": "10-24 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 3,
        "impactLevel": 3,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 3,
          "fatigueSensitivity": 5,
          "technicalComplexity": 3,
          "intensityCeiling": "high",
          "impactLevel": 3
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 4,
      "slug": "low-hurdle-hop-to-pause-stick",
      "name": "Low Hurdle Hop to Pause Stick",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_3",
      "impactClassification": {
        "movementImpactLevel": 3,
        "safetyImpactLevel": 3,
        "phaseProfileImpactLevel": 3,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "reactive_jump",
      "subroleSecondary": "landing_control",
      "slot": "low_hurdle_hop_pause_stick",
      "category": "Level 3 - Landing-to-Rebound and Low Hurdle Bridge",
      "cardSummary": "Low Hurdle Hop to Pause Stick is a level-3 high-impact Output drill for safe hurdle clearance with controlled landing shape.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Low Hurdle Hop to Pause Stick as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets safe hurdle clearance with controlled landing shape. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: reactive_jump. Coach this as level-3 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "adds a clearance constraint while the pause prevents uncontrolled continuous contacts",
      "selectionTarget": "safe hurdle clearance with controlled landing shape",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "jump",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 4
        },
        {
          "key": "brace",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "low_hurdle",
          "weight": 5
        }
      ],
      "bodyRegions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
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
      "whyItWorks": "Low Hurdle Hop to Pause Stick creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because adds a clearance constraint while the pause prevents uncontrolled continuous contacts.",
      "whyItGoesHere": "Belongs in Output because impact level 3 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing"
        ],
        "primaryTissues": [
          "calf complex",
          "Achilles tendon",
          "quadriceps",
          "patellar tendon",
          "glutes",
          "hip flexors",
          "abdominals",
          "obliques"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "dynamic",
        "coordinationDemand": "high",
        "impactLevel": 3,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "3 x 2-4 hops, 60-120s rest",
        "sets": "2-4",
        "repsOrContacts": "2-5 quality reps/contacts",
        "rest": "60-120 seconds",
        "contactCap": "10-24 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 3,
        "impactLevel": 3,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 3,
          "fatigueSensitivity": 5,
          "technicalComplexity": 3,
          "intensityCeiling": "high",
          "impactLevel": 3
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 5,
      "slug": "split-stance-scissor-hop-to-stick",
      "name": "Split-Stance Scissor Hop to Stick",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_3",
      "impactClassification": {
        "movementImpactLevel": 3,
        "safetyImpactLevel": 3,
        "phaseProfileImpactLevel": 3,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "elastic_stiffness_plyometric_rudiments",
      "subroleSecondary": "split_stance_elastic_control",
      "slot": "split_stance_scissor_hop_to_stick",
      "category": "Level 3 - Landing-to-Rebound and Low Hurdle Bridge",
      "cardSummary": "Split-Stance Scissor Hop to Stick is a level-3 high-impact Output drill for split-stance exchange with landing alignment.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Split-Stance Scissor Hop to Stick as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets split-stance exchange with landing alignment. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: elastic_stiffness_plyometric_rudiments. Coach this as level-3 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "teaches hip exchange and trunk control without the volume of continuous scissor jumps",
      "selectionTarget": "split-stance exchange with landing alignment",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "jump",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 4
        },
        {
          "key": "squat",
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
      "whyItWorks": "Split-Stance Scissor Hop to Stick creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because teaches hip exchange and trunk control without the volume of continuous scissor jumps.",
      "whyItGoesHere": "Belongs in Output because impact level 3 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing"
        ],
        "primaryTissues": [
          "glutes",
          "hip flexors",
          "quadriceps",
          "patellar tendon",
          "calf complex",
          "Achilles tendon",
          "abdominals",
          "obliques"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "dynamic",
        "coordinationDemand": "high",
        "impactLevel": 3,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "2-4 x 3-5 total, 60-90s rest",
        "sets": "2-4",
        "repsOrContacts": "2-5 quality reps/contacts",
        "rest": "60-120 seconds",
        "contactCap": "10-24 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 3,
        "impactLevel": 3,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 3,
          "fatigueSensitivity": 5,
          "technicalComplexity": 3,
          "intensityCeiling": "high",
          "impactLevel": 3
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 6,
      "slug": "lateral-line-hop-to-single-leg-stick",
      "name": "Lateral Line Hop to Single-Leg Stick",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_3",
      "impactClassification": {
        "movementImpactLevel": 3,
        "safetyImpactLevel": 3,
        "phaseProfileImpactLevel": 3,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "single_leg_elastic_control",
      "subroleSecondary": "frontal_plane_landing",
      "slot": "lateral_line_hop_single_leg_stick",
      "category": "Level 3 - Landing-to-Rebound and Low Hurdle Bridge",
      "cardSummary": "Lateral Line Hop to Single-Leg Stick is a level-3 high-impact Output drill for frontal-plane landing and edge control.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Lateral Line Hop to Single-Leg Stick as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets frontal-plane landing and edge control. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: single_leg_elastic_control. Coach this as level-3 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "makes lateral impact coachable with a small target and a clear stick requirement",
      "selectionTarget": "frontal-plane landing and edge control",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "jump",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 4
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
      "whyItWorks": "Lateral Line Hop to Single-Leg Stick creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because makes lateral impact coachable with a small target and a clear stick requirement.",
      "whyItGoesHere": "Belongs in Output because impact level 3 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing",
          "acceleration step mechanics",
          "foot strike under center of mass"
        ],
        "primaryTissues": [
          "intrinsic foot",
          "plantar fascia",
          "calf complex",
          "Achilles tendon",
          "quadriceps",
          "patellar tendon",
          "glutes",
          "hip flexors"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "dynamic",
        "coordinationDemand": "high",
        "impactLevel": 3,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "2-4 x 2-4/side, 60-90s rest",
        "sets": "2-4",
        "repsOrContacts": "2-5 quality reps/contacts",
        "rest": "60-120 seconds",
        "contactCap": "10-24 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 3,
        "impactLevel": 3,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 3,
          "fatigueSensitivity": 5,
          "technicalComplexity": 3,
          "intensityCeiling": "high",
          "impactLevel": 3
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 7,
      "slug": "two-hop-vertical-rhythm-to-stick",
      "name": "Two-Hop Vertical Rhythm to Stick",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_3",
      "impactClassification": {
        "movementImpactLevel": 3,
        "safetyImpactLevel": 3,
        "phaseProfileImpactLevel": 3,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "elastic_stiffness_plyometric_rudiments",
      "subroleSecondary": "vertical_rhythm_control",
      "slot": "two_hop_vertical_rhythm_to_stick",
      "category": "Level 3 - Landing-to-Rebound and Low Hurdle Bridge",
      "cardSummary": "Two-Hop Vertical Rhythm to Stick is a level-3 high-impact Output drill for two clean elastic contacts followed by landing ownership.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Two-Hop Vertical Rhythm to Stick as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets two clean elastic contacts followed by landing ownership. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: elastic_stiffness_plyometric_rudiments. Coach this as level-3 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "teaches repeatability while the final stick exposes whether alignment survived the rebounds",
      "selectionTarget": "two clean elastic contacts followed by landing ownership",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "jump",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 4
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
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
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
      "whyItWorks": "Two-Hop Vertical Rhythm to Stick creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because teaches repeatability while the final stick exposes whether alignment survived the rebounds.",
      "whyItGoesHere": "Belongs in Output because impact level 3 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing"
        ],
        "primaryTissues": [
          "calf complex",
          "Achilles tendon",
          "quadriceps",
          "patellar tendon",
          "glutes",
          "hip flexors",
          "abdominals",
          "obliques"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "dynamic",
        "coordinationDemand": "high",
        "impactLevel": 3,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "3 x 2 contacts + stick, 60-90s rest",
        "sets": "2-4",
        "repsOrContacts": "2-5 quality reps/contacts",
        "rest": "60-120 seconds",
        "contactCap": "10-24 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 3,
        "impactLevel": 3,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 3,
          "fatigueSensitivity": 5,
          "technicalComplexity": 3,
          "intensityCeiling": "high",
          "impactLevel": 3
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 8,
      "slug": "pogo-pogo-stick-series",
      "name": "Pogo-Pogo-Stick Series",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_3",
      "impactClassification": {
        "movementImpactLevel": 3,
        "safetyImpactLevel": 3,
        "phaseProfileImpactLevel": 3,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "elastic_stiffness_plyometric_rudiments",
      "subroleSecondary": "ankle_to_landing_bridge",
      "slot": "pogo_pogo_stick_series",
      "category": "Level 3 - Landing-to-Rebound and Low Hurdle Bridge",
      "cardSummary": "Pogo-Pogo-Stick Series is a level-3 high-impact Output drill for ankle stiffness with a controlled final landing.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Pogo-Pogo-Stick Series as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets ankle stiffness with a controlled final landing. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: elastic_stiffness_plyometric_rudiments. Coach this as level-3 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "raises the common pogo into a high-impact bridge only when the final stick is owned",
      "selectionTarget": "ankle stiffness with a controlled final landing",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "jump",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 4
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
          "weight": 4
        },
        {
          "key": "calf",
          "weight": 3
        },
        {
          "key": "knee",
          "weight": 2
        }
      ],
      "whyItWorks": "Pogo-Pogo-Stick Series creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because raises the common pogo into a high-impact bridge only when the final stick is owned.",
      "whyItGoesHere": "Belongs in Output because impact level 3 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing"
        ],
        "primaryTissues": [
          "intrinsic foot",
          "plantar fascia",
          "calf complex",
          "Achilles tendon",
          "quadriceps",
          "patellar tendon"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "dynamic",
        "coordinationDemand": "high",
        "impactLevel": 3,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "3 x 3-5 contacts, 45-90s rest",
        "sets": "2-4",
        "repsOrContacts": "2-5 quality reps/contacts",
        "rest": "60-120 seconds",
        "contactCap": "10-24 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 3,
        "impactLevel": 3,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 3,
          "fatigueSensitivity": 5,
          "technicalComplexity": 3,
          "intensityCeiling": "high",
          "impactLevel": 3
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 9,
      "slug": "low-hurdle-lateral-hop-to-stick",
      "name": "Low Hurdle Lateral Hop to Stick",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_3",
      "impactClassification": {
        "movementImpactLevel": 3,
        "safetyImpactLevel": 3,
        "phaseProfileImpactLevel": 3,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "reactive_jump",
      "subroleSecondary": "lateral_hurdle_control",
      "slot": "low_hurdle_lateral_hop_to_stick",
      "category": "Level 3 - Landing-to-Rebound and Low Hurdle Bridge",
      "cardSummary": "Low Hurdle Lateral Hop to Stick is a level-3 high-impact Output drill for lateral hurdle clearance and frontal-plane braking.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Low Hurdle Lateral Hop to Stick as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets lateral hurdle clearance and frontal-plane braking. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: reactive_jump. Coach this as level-3 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "combines low hurdle stiffness with side-to-side landing control without continuous volume",
      "selectionTarget": "lateral hurdle clearance and frontal-plane braking",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "jump",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 4
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
          "key": "low_hurdle",
          "weight": 5
        }
      ],
      "bodyRegions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
        },
        {
          "key": "hip",
          "weight": 3
        },
        {
          "key": "adductors",
          "weight": 2
        }
      ],
      "whyItWorks": "Low Hurdle Lateral Hop to Stick creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because combines low hurdle stiffness with side-to-side landing control without continuous volume.",
      "whyItGoesHere": "Belongs in Output because impact level 3 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing",
          "acceleration step mechanics",
          "foot strike under center of mass"
        ],
        "primaryTissues": [
          "calf complex",
          "Achilles tendon",
          "quadriceps",
          "patellar tendon",
          "glutes",
          "hip flexors",
          "adductors",
          "glute medius"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "dynamic",
        "coordinationDemand": "high",
        "impactLevel": 3,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "2-4 x 2-3/side, 75-120s rest",
        "sets": "2-4",
        "repsOrContacts": "2-5 quality reps/contacts",
        "rest": "60-120 seconds",
        "contactCap": "10-24 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 3,
        "impactLevel": 3,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 3,
          "fatigueSensitivity": 5,
          "technicalComplexity": 3,
          "intensityCeiling": "high",
          "impactLevel": 3
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 10,
      "slug": "drop-landing-to-45-degree-push-off",
      "name": "Drop Landing to 45-Degree Push-Off",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_3",
      "impactClassification": {
        "movementImpactLevel": 3,
        "safetyImpactLevel": 3,
        "phaseProfileImpactLevel": 3,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "deceleration_cod_power",
      "subroleSecondary": "angled_reacceleration_bridge",
      "slot": "drop_landing_45_degree_push_off",
      "category": "Level 3 - Landing-to-Rebound and Low Hurdle Bridge",
      "cardSummary": "Drop Landing to 45-Degree Push-Off is a level-3 high-impact Output drill for landing absorption linked to angled re-acceleration.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Drop Landing to 45-Degree Push-Off as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets landing absorption linked to angled re-acceleration. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: deceleration_cod_power. Coach this as level-3 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "builds a bridge from vertical impact to athletic redirection while keeping the angle controlled",
      "selectionTarget": "landing absorption linked to angled re-acceleration",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "land",
          "weight": 5
        },
        {
          "key": "locomote",
          "weight": 4
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
        },
        {
          "key": "cones",
          "weight": 4
        }
      ],
      "bodyRegions": [
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
      "whyItWorks": "Drop Landing to 45-Degree Push-Off creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because builds a bridge from vertical impact to athletic redirection while keeping the angle controlled.",
      "whyItGoesHere": "Belongs in Output because impact level 3 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing",
          "acceleration step mechanics",
          "foot strike under center of mass"
        ],
        "primaryTissues": [
          "intrinsic foot",
          "plantar fascia",
          "calf complex",
          "Achilles tendon",
          "quadriceps",
          "patellar tendon",
          "glutes",
          "hip flexors"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "dynamic",
        "coordinationDemand": "high",
        "impactLevel": 3,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "3 x 2-3/side, 90-120s rest",
        "sets": "2-4",
        "repsOrContacts": "2-5 quality reps/contacts",
        "rest": "60-120 seconds",
        "contactCap": "10-24 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 3,
        "impactLevel": 3,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 3,
          "fatigueSensitivity": 5,
          "technicalComplexity": 3,
          "intensityCeiling": "high",
          "impactLevel": 3
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 11,
      "slug": "broad-jump-to-backpedal-reset",
      "name": "Broad Jump to Backpedal Reset",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_3",
      "impactClassification": {
        "movementImpactLevel": 3,
        "safetyImpactLevel": 3,
        "phaseProfileImpactLevel": 3,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "jump_throw_explosive_power",
      "subroleSecondary": "horizontal_projection_control",
      "slot": "broad_jump_backpedal_reset",
      "category": "Level 3 - Horizontal/Lateral Control and Moderate Bounds",
      "cardSummary": "Broad Jump to Backpedal Reset is a level-3 high-impact Output drill for horizontal projection with a controlled backward reset.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Broad Jump to Backpedal Reset as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets horizontal projection with a controlled backward reset. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Coach this as level-3 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "keeps broad-jump power but adds a practical reset pattern that rewards balanced landing",
      "selectionTarget": "horizontal projection with a controlled backward reset",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "jump",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 4
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
      "whyItWorks": "Broad Jump to Backpedal Reset creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because keeps broad-jump power but adds a practical reset pattern that rewards balanced landing.",
      "whyItGoesHere": "Belongs in Output because impact level 3 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing",
          "acceleration step mechanics",
          "foot strike under center of mass"
        ],
        "primaryTissues": [
          "glutes",
          "hip flexors",
          "quadriceps",
          "patellar tendon",
          "calf complex",
          "Achilles tendon",
          "abdominals",
          "obliques"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "dynamic",
        "coordinationDemand": "high",
        "impactLevel": 3,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "3-5 x 1-3 reps, 90-120s rest",
        "sets": "2-4",
        "repsOrContacts": "2-5 quality reps/contacts",
        "rest": "60-120 seconds",
        "contactCap": "10-24 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 3,
        "impactLevel": 3,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 3,
          "fatigueSensitivity": 5,
          "technicalComplexity": 3,
          "intensityCeiling": "high",
          "impactLevel": 3
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 12,
      "slug": "skater-hop-to-forward-re-acceleration",
      "name": "Skater Hop to Forward Re-Acceleration",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_3",
      "impactClassification": {
        "movementImpactLevel": 3,
        "safetyImpactLevel": 3,
        "phaseProfileImpactLevel": 3,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "deceleration_cod_power",
      "subroleSecondary": "lateral_to_linear_transition",
      "slot": "skater_hop_forward_reacceleration",
      "category": "Level 3 - Horizontal/Lateral Control and Moderate Bounds",
      "cardSummary": "Skater Hop to Forward Re-Acceleration is a level-3 high-impact Output drill for side landing linked to forward first-step projection.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Skater Hop to Forward Re-Acceleration as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets side landing linked to forward first-step projection. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: deceleration_cod_power. Coach this as level-3 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "connects lateral landing control to the next athletic action instead of stopping at the stick",
      "selectionTarget": "side landing linked to forward first-step projection",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "jump",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 4
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
          "key": "adductors",
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
      "whyItWorks": "Skater Hop to Forward Re-Acceleration creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because connects lateral landing control to the next athletic action instead of stopping at the stick.",
      "whyItGoesHere": "Belongs in Output because impact level 3 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing",
          "acceleration step mechanics",
          "foot strike under center of mass"
        ],
        "primaryTissues": [
          "glutes",
          "hip flexors",
          "adductors",
          "glute medius",
          "calf complex",
          "Achilles tendon",
          "abdominals",
          "obliques"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "dynamic",
        "coordinationDemand": "high",
        "impactLevel": 3,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "3 x 2/side, 90-120s rest",
        "sets": "2-4",
        "repsOrContacts": "2-5 quality reps/contacts",
        "rest": "60-120 seconds",
        "contactCap": "10-24 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 3,
        "impactLevel": 3,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 3,
          "fatigueSensitivity": 5,
          "technicalComplexity": 3,
          "intensityCeiling": "high",
          "impactLevel": 3
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 13,
      "slug": "diagonal-bound-to-stick",
      "name": "Diagonal Bound to Stick",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_3",
      "impactClassification": {
        "movementImpactLevel": 3,
        "safetyImpactLevel": 3,
        "phaseProfileImpactLevel": 3,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "single_leg_elastic_control",
      "subroleSecondary": "diagonal_projection_control",
      "slot": "diagonal_bound_to_stick",
      "category": "Level 3 - Horizontal/Lateral Control and Moderate Bounds",
      "cardSummary": "Diagonal Bound to Stick is a level-3 high-impact Output drill for 45-degree single-leg projection and landing.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Diagonal Bound to Stick as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets 45-degree single-leg projection and landing. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: single_leg_elastic_control. Coach this as level-3 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "adds diagonal sport transfer while keeping amplitude moderate and landing accountable",
      "selectionTarget": "45-degree single-leg projection and landing",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "bound",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 4
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
          "weight": 4
        },
        {
          "key": "knee",
          "weight": 3
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "whyItWorks": "Diagonal Bound to Stick creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because adds diagonal sport transfer while keeping amplitude moderate and landing accountable.",
      "whyItGoesHere": "Belongs in Output because impact level 3 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing",
          "acceleration step mechanics",
          "foot strike under center of mass"
        ],
        "primaryTissues": [
          "glutes",
          "hip flexors",
          "calf complex",
          "Achilles tendon",
          "quadriceps",
          "patellar tendon",
          "abdominals",
          "obliques"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "dynamic",
        "coordinationDemand": "high",
        "impactLevel": 3,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "2-4 x 2-3/side, 90s rest",
        "sets": "2-4",
        "repsOrContacts": "2-5 quality reps/contacts",
        "rest": "60-120 seconds",
        "contactCap": "10-24 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 3,
        "impactLevel": 3,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 3,
          "fatigueSensitivity": 5,
          "technicalComplexity": 3,
          "intensityCeiling": "high",
          "impactLevel": 3
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 14,
      "slug": "single-leg-lateral-hop-to-stick",
      "name": "Single-Leg Lateral Hop to Stick",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_3",
      "impactClassification": {
        "movementImpactLevel": 3,
        "safetyImpactLevel": 3,
        "phaseProfileImpactLevel": 3,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "single_leg_elastic_control",
      "subroleSecondary": "lateral_hop_control",
      "slot": "single_leg_lateral_hop_to_stick_alt",
      "category": "Level 3 - Horizontal/Lateral Control and Moderate Bounds",
      "cardSummary": "Single-Leg Lateral Hop to Stick is a level-3 high-impact Output drill for unilateral lateral hop distance with clean alignment.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Single-Leg Lateral Hop to Stick as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets unilateral lateral hop distance with clean alignment. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: single_leg_elastic_control. Coach this as level-3 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "valuable for high-impact unilateral tolerance without the cost of repeated rebounds",
      "selectionTarget": "unilateral lateral hop distance with clean alignment",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "jump",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 4
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
      "whyItWorks": "Single-Leg Lateral Hop to Stick creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because valuable for high-impact unilateral tolerance without the cost of repeated rebounds.",
      "whyItGoesHere": "Belongs in Output because impact level 3 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing"
        ],
        "primaryTissues": [
          "intrinsic foot",
          "plantar fascia",
          "calf complex",
          "Achilles tendon",
          "quadriceps",
          "patellar tendon",
          "glutes",
          "hip flexors"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "dynamic",
        "coordinationDemand": "high",
        "impactLevel": 3,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "2-4 x 2-4/side, 60-90s rest",
        "sets": "2-4",
        "repsOrContacts": "2-5 quality reps/contacts",
        "rest": "60-120 seconds",
        "contactCap": "10-24 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 3,
        "impactLevel": 3,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 3,
          "fatigueSensitivity": 5,
          "technicalComplexity": 3,
          "intensityCeiling": "high",
          "impactLevel": 3
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 15,
      "slug": "triple-line-hop-and-stick",
      "name": "Triple-Line Hop and Stick",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_3",
      "impactClassification": {
        "movementImpactLevel": 3,
        "safetyImpactLevel": 3,
        "phaseProfileImpactLevel": 3,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "single_leg_elastic_control",
      "subroleSecondary": "multi_contact_line_control",
      "slot": "triple_line_hop_and_stick",
      "category": "Level 3 - Horizontal/Lateral Control and Moderate Bounds",
      "cardSummary": "Triple-Line Hop and Stick is a level-3 high-impact Output drill for three small single-leg contacts followed by a stick.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Triple-Line Hop and Stick as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets three small single-leg contacts followed by a stick. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: single_leg_elastic_control. Coach this as level-3 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "uses limited contact count to build repeat unilateral stiffness before longer hop tests",
      "selectionTarget": "three small single-leg contacts followed by a stick",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "hop",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 4
        },
        {
          "key": "brace",
          "weight": 3
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
      "whyItWorks": "Triple-Line Hop and Stick creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because uses limited contact count to build repeat unilateral stiffness before longer hop tests.",
      "whyItGoesHere": "Belongs in Output because impact level 3 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing"
        ],
        "primaryTissues": [
          "intrinsic foot",
          "plantar fascia",
          "calf complex",
          "Achilles tendon",
          "quadriceps",
          "patellar tendon",
          "glutes",
          "hip flexors"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "dynamic",
        "coordinationDemand": "high",
        "impactLevel": 3,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "2-4 x 1 sequence/side, 90s rest",
        "sets": "2-4",
        "repsOrContacts": "2-5 quality reps/contacts",
        "rest": "60-120 seconds",
        "contactCap": "10-24 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 3,
        "impactLevel": 3,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 3,
          "fatigueSensitivity": 5,
          "technicalComplexity": 3,
          "intensityCeiling": "high",
          "impactLevel": 3
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 16,
      "slug": "carioca-bound-to-stick",
      "name": "Carioca Bound to Stick",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_3",
      "impactClassification": {
        "movementImpactLevel": 3,
        "safetyImpactLevel": 3,
        "phaseProfileImpactLevel": 3,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "multidirectional_elastic_power",
      "subroleSecondary": "rotational_lateral_control",
      "slot": "carioca_bound_to_stick",
      "category": "Level 3 - Horizontal/Lateral Control and Moderate Bounds",
      "cardSummary": "Carioca Bound to Stick is a level-3 high-impact Output drill for rotational lateral rhythm with a controlled bound finish.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Carioca Bound to Stick as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets rotational lateral rhythm with a controlled bound finish. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: multidirectional_elastic_power. Coach this as level-3 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "turns carioca rhythm into a higher-impact elastic expression without chaotic volume",
      "selectionTarget": "rotational lateral rhythm with a controlled bound finish",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "bound",
          "weight": 5
        },
        {
          "key": "rotate",
          "weight": 4
        },
        {
          "key": "land",
          "weight": 3
        },
        {
          "key": "locomote",
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
          "key": "adductors",
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
      "whyItWorks": "Carioca Bound to Stick creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because turns carioca rhythm into a higher-impact elastic expression without chaotic volume.",
      "whyItGoesHere": "Belongs in Output because impact level 3 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing",
          "hip internal/external rotation",
          "thoracic rotation",
          "pelvis control",
          "acceleration step mechanics"
        ],
        "primaryTissues": [
          "glutes",
          "hip flexors",
          "adductors",
          "glute medius",
          "calf complex",
          "Achilles tendon",
          "abdominals",
          "obliques"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "dynamic",
        "coordinationDemand": "high",
        "impactLevel": 3,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "2-3 x 2/side, 90-120s rest",
        "sets": "2-4",
        "repsOrContacts": "2-5 quality reps/contacts",
        "rest": "60-120 seconds",
        "contactCap": "10-24 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 3,
        "impactLevel": 3,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 3,
          "fatigueSensitivity": 5,
          "technicalComplexity": 3,
          "intensityCeiling": "high",
          "impactLevel": 3
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 17,
      "slug": "medial-lateral-ankle-hop-series",
      "name": "Medial-Lateral Ankle Hop Series",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_3",
      "impactClassification": {
        "movementImpactLevel": 3,
        "safetyImpactLevel": 3,
        "phaseProfileImpactLevel": 3,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "elastic_stiffness_plyometric_rudiments",
      "subroleSecondary": "frontal_plane_ankle_stiffness",
      "slot": "medial_lateral_ankle_hop_series",
      "category": "Level 3 - Horizontal/Lateral Control and Moderate Bounds",
      "cardSummary": "Medial-Lateral Ankle Hop Series is a level-3 high-impact Output drill for quick medial-lateral foot stiffness under low displacement.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Medial-Lateral Ankle Hop Series as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets quick medial-lateral foot stiffness under low displacement. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: elastic_stiffness_plyometric_rudiments. Coach this as level-3 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "small but meaningful unilateral contacts help fill level-3 impact without requiring long jumps",
      "selectionTarget": "quick medial-lateral foot stiffness under low displacement",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "hop",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 4
        },
        {
          "key": "brace",
          "weight": 3
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
          "weight": 4
        },
        {
          "key": "calf",
          "weight": 3
        },
        {
          "key": "hip",
          "weight": 2
        }
      ],
      "whyItWorks": "Medial-Lateral Ankle Hop Series creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because small but meaningful unilateral contacts help fill level-3 impact without requiring long jumps.",
      "whyItGoesHere": "Belongs in Output because impact level 3 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing"
        ],
        "primaryTissues": [
          "intrinsic foot",
          "plantar fascia",
          "calf complex",
          "Achilles tendon",
          "glutes",
          "hip flexors"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "dynamic",
        "coordinationDemand": "high",
        "impactLevel": 3,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "3 x 4-8 contacts/side, 45-75s rest",
        "sets": "2-4",
        "repsOrContacts": "2-5 quality reps/contacts",
        "rest": "60-120 seconds",
        "contactCap": "10-24 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 3,
        "impactLevel": 3,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 3,
          "fatigueSensitivity": 5,
          "technicalComplexity": 3,
          "intensityCeiling": "high",
          "impactLevel": 3
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 18,
      "slug": "crossover-step-to-bound-and-stick",
      "name": "Crossover Step to Bound and Stick",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_3",
      "impactClassification": {
        "movementImpactLevel": 3,
        "safetyImpactLevel": 3,
        "phaseProfileImpactLevel": 3,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "multidirectional_elastic_power",
      "subroleSecondary": "crossover_projection_control",
      "slot": "crossover_step_bound_and_stick",
      "category": "Level 3 - Horizontal/Lateral Control and Moderate Bounds",
      "cardSummary": "Crossover Step to Bound and Stick is a level-3 high-impact Output drill for crossover push-off mechanics into a controlled bound.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Crossover Step to Bound and Stick as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets crossover push-off mechanics into a controlled bound. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: multidirectional_elastic_power. Coach this as level-3 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "builds reorientation power while the stick keeps the athlete from over-rotating",
      "selectionTarget": "crossover push-off mechanics into a controlled bound",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "bound",
          "weight": 5
        },
        {
          "key": "rotate",
          "weight": 4
        },
        {
          "key": "land",
          "weight": 3
        },
        {
          "key": "locomote",
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
          "key": "adductors",
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
      "whyItWorks": "Crossover Step to Bound and Stick creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because builds reorientation power while the stick keeps the athlete from over-rotating.",
      "whyItGoesHere": "Belongs in Output because impact level 3 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing",
          "hip internal/external rotation",
          "thoracic rotation",
          "pelvis control",
          "acceleration step mechanics"
        ],
        "primaryTissues": [
          "glutes",
          "hip flexors",
          "adductors",
          "glute medius",
          "calf complex",
          "Achilles tendon",
          "abdominals",
          "obliques"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "dynamic",
        "coordinationDemand": "high",
        "impactLevel": 3,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "2-4 x 2/side, 90-120s rest",
        "sets": "2-4",
        "repsOrContacts": "2-5 quality reps/contacts",
        "rest": "60-120 seconds",
        "contactCap": "10-24 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 3,
        "impactLevel": 3,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 3,
          "fatigueSensitivity": 5,
          "technicalComplexity": 3,
          "intensityCeiling": "high",
          "impactLevel": 3
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 19,
      "slug": "hop-to-hop-to-stick-linear",
      "name": "Hop-to-Hop-to-Stick Linear",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_3",
      "impactClassification": {
        "movementImpactLevel": 3,
        "safetyImpactLevel": 3,
        "phaseProfileImpactLevel": 3,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "single_leg_elastic_control",
      "subroleSecondary": "linear_hop_series_control",
      "slot": "hop_to_hop_to_stick_linear",
      "category": "Level 3 - Horizontal/Lateral Control and Moderate Bounds",
      "cardSummary": "Hop-to-Hop-to-Stick Linear is a level-3 high-impact Output drill for two same-leg hops followed by clean landing ownership.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Hop-to-Hop-to-Stick Linear as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets two same-leg hops followed by clean landing ownership. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: single_leg_elastic_control. Coach this as level-3 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "more demanding than one hop but still bounded by a short series and visible quality gate",
      "selectionTarget": "two same-leg hops followed by clean landing ownership",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "hop",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 4
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
      "whyItWorks": "Hop-to-Hop-to-Stick Linear creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because more demanding than one hop but still bounded by a short series and visible quality gate.",
      "whyItGoesHere": "Belongs in Output because impact level 3 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing"
        ],
        "primaryTissues": [
          "intrinsic foot",
          "plantar fascia",
          "calf complex",
          "Achilles tendon",
          "quadriceps",
          "patellar tendon",
          "glutes",
          "hip flexors"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "dynamic",
        "coordinationDemand": "high",
        "impactLevel": 3,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "2-4 x 1-2 sequences/side, 90s rest",
        "sets": "2-4",
        "repsOrContacts": "2-5 quality reps/contacts",
        "rest": "60-120 seconds",
        "contactCap": "10-24 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 3,
        "impactLevel": 3,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 3,
          "fatigueSensitivity": 5,
          "technicalComplexity": 3,
          "intensityCeiling": "high",
          "impactLevel": 3
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 20,
      "slug": "curved-bound-to-stick",
      "name": "Curved Bound to Stick",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_3",
      "impactClassification": {
        "movementImpactLevel": 3,
        "safetyImpactLevel": 3,
        "phaseProfileImpactLevel": 3,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "multidirectional_elastic_power",
      "subroleSecondary": "curved_projection_control",
      "slot": "curved_bound_to_stick",
      "category": "Level 3 - Horizontal/Lateral Control and Moderate Bounds",
      "cardSummary": "Curved Bound to Stick is a level-3 high-impact Output drill for elastic projection around a shallow curve.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Curved Bound to Stick as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets elastic projection around a shallow curve. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: multidirectional_elastic_power. Coach this as level-3 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "adds curved force application for field and track athletes while keeping speed and volume moderate",
      "selectionTarget": "elastic projection around a shallow curve",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "bound",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 4
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
          "key": "cones",
          "weight": 5
        }
      ],
      "bodyRegions": [
        {
          "key": "ankle",
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
          "key": "core",
          "weight": 2
        }
      ],
      "whyItWorks": "Curved Bound to Stick creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because adds curved force application for field and track athletes while keeping speed and volume moderate.",
      "whyItGoesHere": "Belongs in Output because impact level 3 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing",
          "acceleration step mechanics",
          "foot strike under center of mass"
        ],
        "primaryTissues": [
          "calf complex",
          "Achilles tendon",
          "glutes",
          "hip flexors",
          "quadriceps",
          "patellar tendon",
          "abdominals",
          "obliques"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "dynamic",
        "coordinationDemand": "high",
        "impactLevel": 3,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "2-4 x 2-3 bounds/side, 90-120s rest",
        "sets": "2-4",
        "repsOrContacts": "2-5 quality reps/contacts",
        "rest": "60-120 seconds",
        "contactCap": "10-24 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 3,
        "impactLevel": 3,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 3,
          "fatigueSensitivity": 5,
          "technicalComplexity": 3,
          "intensityCeiling": "high",
          "impactLevel": 3
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 21,
      "slug": "90-degree-jump-turn-to-stick",
      "name": "90-Degree Jump Turn to Stick",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_3",
      "impactClassification": {
        "movementImpactLevel": 3,
        "safetyImpactLevel": 3,
        "phaseProfileImpactLevel": 3,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "multidirectional_elastic_control",
      "subroleSecondary": "rotational_landing_control",
      "slot": "ninety_degree_jump_turn_to_stick",
      "category": "Level 3 - Rotational/Reactive Impact Control",
      "cardSummary": "90-Degree Jump Turn to Stick is a level-3 high-impact Output drill for quarter-turn airtime orientation and landing control.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform 90-Degree Jump Turn to Stick as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets quarter-turn airtime orientation and landing control. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: multidirectional_elastic_control. Coach this as level-3 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "trains rotation and landing integrity at a moderate impact level before adding rebounds",
      "selectionTarget": "quarter-turn airtime orientation and landing control",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "jump",
          "weight": 5
        },
        {
          "key": "rotate",
          "weight": 4
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
          "key": "ankle",
          "weight": 4
        },
        {
          "key": "knee",
          "weight": 3
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "whyItWorks": "90-Degree Jump Turn to Stick creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because trains rotation and landing integrity at a moderate impact level before adding rebounds.",
      "whyItGoesHere": "Belongs in Output because impact level 3 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing",
          "hip internal/external rotation",
          "thoracic rotation",
          "pelvis control"
        ],
        "primaryTissues": [
          "glutes",
          "hip flexors",
          "calf complex",
          "Achilles tendon",
          "quadriceps",
          "patellar tendon",
          "abdominals",
          "obliques"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "dynamic",
        "coordinationDemand": "high",
        "impactLevel": 3,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "3 x 2-3 each direction, 60-90s rest",
        "sets": "2-4",
        "repsOrContacts": "2-5 quality reps/contacts",
        "rest": "60-120 seconds",
        "contactCap": "10-24 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 3,
        "impactLevel": 3,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 3,
          "fatigueSensitivity": 5,
          "technicalComplexity": 3,
          "intensityCeiling": "high",
          "impactLevel": 3
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 22,
      "slug": "reactive-cone-call-hop-to-stick",
      "name": "Reactive Cone-Call Hop to Stick",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_3",
      "impactClassification": {
        "movementImpactLevel": 3,
        "safetyImpactLevel": 3,
        "phaseProfileImpactLevel": 3,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "reactive_agility_output",
      "subroleSecondary": "cue_to_hop_control",
      "slot": "reactive_cone_call_hop_to_stick",
      "category": "Level 3 - Rotational/Reactive Impact Control",
      "cardSummary": "Reactive Cone-Call Hop to Stick is a level-3 high-impact Output drill for visual cue response with a single controlled hop.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Reactive Cone-Call Hop to Stick as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets visual cue response with a single controlled hop. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: reactive_agility_output. Coach this as level-3 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "keeps decision quality high while adding a real high-impact contact",
      "selectionTarget": "visual cue response with a single controlled hop",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "jump",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 4
        },
        {
          "key": "locomote",
          "weight": 3
        },
        {
          "key": "react",
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
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
          "weight": 4
        },
        {
          "key": "hip",
          "weight": 3
        },
        {
          "key": "eyes",
          "weight": 2
        }
      ],
      "whyItWorks": "Reactive Cone-Call Hop to Stick creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because keeps decision quality high while adding a real high-impact contact.",
      "whyItGoesHere": "Belongs in Output because impact level 3 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing",
          "acceleration step mechanics",
          "foot strike under center of mass",
          "visual cue processing",
          "braking-to-reacceleration timing"
        ],
        "primaryTissues": [
          "calf complex",
          "Achilles tendon",
          "quadriceps",
          "patellar tendon",
          "glutes",
          "hip flexors",
          "visual system",
          "vestibular orientation"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "dynamic",
        "coordinationDemand": "high",
        "impactLevel": 3,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "3 x 3-5 calls, 75-120s rest",
        "sets": "2-4",
        "repsOrContacts": "2-5 quality reps/contacts",
        "rest": "60-120 seconds",
        "contactCap": "10-24 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 3,
        "impactLevel": 3,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 3,
          "fatigueSensitivity": 5,
          "technicalComplexity": 3,
          "intensityCeiling": "high",
          "impactLevel": 3
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 23,
      "slug": "partner-point-hop-to-stick",
      "name": "Partner Point Hop-to-Stick",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_3",
      "impactClassification": {
        "movementImpactLevel": 3,
        "safetyImpactLevel": 3,
        "phaseProfileImpactLevel": 3,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "reactive_agility_output",
      "subroleSecondary": "partner_cue_landing_control",
      "slot": "partner_point_hop_to_stick",
      "category": "Level 3 - Rotational/Reactive Impact Control",
      "cardSummary": "Partner Point Hop-to-Stick is a level-3 high-impact Output drill for partner cue processing into one clean hop and finish.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Partner Point Hop-to-Stick as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets partner cue processing into one clean hop and finish. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: reactive_agility_output. Coach this as level-3 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "the partner creates timing uncertainty without turning the drill into a race",
      "selectionTarget": "partner cue processing into one clean hop and finish",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "jump",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 4
        },
        {
          "key": "react",
          "weight": 3
        },
        {
          "key": "brace",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "partner",
          "weight": 5
        },
        {
          "key": "cones",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
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
      "whyItWorks": "Partner Point Hop-to-Stick creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because the partner creates timing uncertainty without turning the drill into a race.",
      "whyItGoesHere": "Belongs in Output because impact level 3 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing",
          "visual cue processing",
          "braking-to-reacceleration timing"
        ],
        "primaryTissues": [
          "calf complex",
          "Achilles tendon",
          "quadriceps",
          "patellar tendon",
          "glutes",
          "hip flexors",
          "abdominals",
          "obliques"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "dynamic",
        "coordinationDemand": "high",
        "impactLevel": 3,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "3 x 3-5 cues, 75-120s rest",
        "sets": "2-4",
        "repsOrContacts": "2-5 quality reps/contacts",
        "rest": "60-120 seconds",
        "contactCap": "10-24 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 3,
        "impactLevel": 3,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 3,
          "fatigueSensitivity": 5,
          "technicalComplexity": 3,
          "intensityCeiling": "high",
          "impactLevel": 3
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 24,
      "slug": "medicine-ball-catch-to-low-hop-and-stick",
      "name": "Medicine Ball Catch to Low Hop and Stick",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_3",
      "impactClassification": {
        "movementImpactLevel": 3,
        "safetyImpactLevel": 3,
        "phaseProfileImpactLevel": 3,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "upper_body_trunk_elasticity",
      "subroleSecondary": "catch_to_lower_body_rebound",
      "slot": "med_ball_catch_low_hop_stick",
      "category": "Level 3 - Rotational/Reactive Impact Control",
      "cardSummary": "Medicine Ball Catch to Low Hop and Stick is a level-3 high-impact Output drill for catch timing linked to a small lower-body re-output.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Medicine Ball Catch to Low Hop and Stick as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets catch timing linked to a small lower-body re-output. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: upper_body_trunk_elasticity. Coach this as level-3 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "adds trunk/visual demand to a low hop while keeping ball load and amplitude conservative",
      "selectionTarget": "catch timing linked to a small lower-body re-output",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "catch",
          "weight": 5
        },
        {
          "key": "jump",
          "weight": 4
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
          "key": "medicine_ball",
          "weight": 5
        },
        {
          "key": "partner",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "core",
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
          "key": "shoulder",
          "weight": 2
        }
      ],
      "whyItWorks": "Medicine Ball Catch to Low Hop and Stick creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because adds trunk/visual demand to a low hop while keeping ball load and amplitude conservative.",
      "whyItGoesHere": "Belongs in Output because impact level 3 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing",
          "shoulder flexion/extension",
          "trunk-to-arm force transfer"
        ],
        "primaryTissues": [
          "abdominals",
          "obliques",
          "glutes",
          "hip flexors",
          "quadriceps",
          "patellar tendon",
          "calf complex",
          "Achilles tendon"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "dynamic",
        "coordinationDemand": "high",
        "impactLevel": 3,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "2-4 x 2-4 reps, 90-120s rest",
        "sets": "2-4",
        "repsOrContacts": "2-5 quality reps/contacts",
        "rest": "60-120 seconds",
        "contactCap": "10-24 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 3,
        "impactLevel": 3,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 3,
          "fatigueSensitivity": 5,
          "technicalComplexity": 3,
          "intensityCeiling": "high",
          "impactLevel": 3
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 25,
      "slug": "split-stance-reactive-hop-switch",
      "name": "Split-Stance Reactive Hop Switch",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_3",
      "impactClassification": {
        "movementImpactLevel": 3,
        "safetyImpactLevel": 3,
        "phaseProfileImpactLevel": 3,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "reactive_agility_output",
      "subroleSecondary": "split_stance_reactive_switch",
      "slot": "split_stance_reactive_hop_switch",
      "category": "Level 3 - Rotational/Reactive Impact Control",
      "cardSummary": "Split-Stance Reactive Hop Switch is a level-3 high-impact Output drill for cue-driven split-stance exchange with landing control.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Split-Stance Reactive Hop Switch as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets cue-driven split-stance exchange with landing control. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: reactive_agility_output. Coach this as level-3 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "combines reactive timing and split-stance impact without the cost of continuous maximal jumps",
      "selectionTarget": "cue-driven split-stance exchange with landing control",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "jump",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 4
        },
        {
          "key": "react",
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
      "whyItWorks": "Split-Stance Reactive Hop Switch creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because combines reactive timing and split-stance impact without the cost of continuous maximal jumps.",
      "whyItGoesHere": "Belongs in Output because impact level 3 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing",
          "visual cue processing",
          "braking-to-reacceleration timing"
        ],
        "primaryTissues": [
          "glutes",
          "hip flexors",
          "quadriceps",
          "patellar tendon",
          "calf complex",
          "Achilles tendon",
          "abdominals",
          "obliques"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "dynamic",
        "coordinationDemand": "high",
        "impactLevel": 3,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "3 x 3-5 total cues, 75-120s rest",
        "sets": "2-4",
        "repsOrContacts": "2-5 quality reps/contacts",
        "rest": "60-120 seconds",
        "contactCap": "10-24 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 3,
        "impactLevel": 3,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
      },
      "phaseProfile": [
        {
          "phaseKey": "output",
          "role": "primary",
          "fitWeight": 5,
          "freshnessRequired": true,
          "fatigueCost": 3,
          "fatigueSensitivity": 5,
          "technicalComplexity": 3,
          "intensityCeiling": "high",
          "impactLevel": 3
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 26,
      "slug": "alternate-bounds-for-height-and-distance",
      "name": "Alternate Bounds for Height and Distance",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_4",
      "impactClassification": {
        "movementImpactLevel": 4,
        "safetyImpactLevel": 4,
        "phaseProfileImpactLevel": 4,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "elastic_stiffness_plyometric_rudiments",
      "subroleSecondary": "horizontal_vertical_projection",
      "slot": "alternate_bounds_height_distance",
      "category": "Level 4 - Higher-Amplitude Bounds and Reactive Rebounds",
      "cardSummary": "Alternate Bounds for Height and Distance is a level-4 high-impact Output drill for larger alternating bounds that blend vertical stiffness and horizontal travel.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Alternate Bounds for Height and Distance as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets larger alternating bounds that blend vertical stiffness and horizontal travel. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: elastic_stiffness_plyometric_rudiments. Coach this as level-4 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "progresses rhythm bounds into a more forceful distance-and-height output without going to level 5",
      "selectionTarget": "larger alternating bounds that blend vertical stiffness and horizontal travel",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "bound",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 4
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
          "key": "hamstrings",
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
      "whyItWorks": "Alternate Bounds for Height and Distance creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because progresses rhythm bounds into a more forceful distance-and-height output without going to level 5.",
      "whyItGoesHere": "Belongs in Output because impact level 4 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing",
          "acceleration step mechanics",
          "foot strike under center of mass"
        ],
        "primaryTissues": [
          "glutes",
          "hip flexors",
          "hamstrings",
          "calf complex",
          "Achilles tendon",
          "abdominals",
          "obliques"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "high_dynamic",
        "coordinationDemand": "very_high",
        "impactLevel": 4,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "3-4 x 4-6 bounds, 2-3min rest",
        "sets": "2-5",
        "repsOrContacts": "1-4 quality reps/contacts",
        "rest": "2-3 minutes",
        "contactCap": "6-18 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 4,
        "impactLevel": 4,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
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
          "intensityCeiling": "very_high_quality_only",
          "impactLevel": 4
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 27,
      "slug": "single-leg-triple-hop-to-stick",
      "name": "Single-Leg Triple Hop to Stick",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_4",
      "impactClassification": {
        "movementImpactLevel": 4,
        "safetyImpactLevel": 4,
        "phaseProfileImpactLevel": 4,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "single_leg_elastic_control",
      "subroleSecondary": "repeated_unilateral_projection",
      "slot": "single_leg_triple_hop_to_stick",
      "category": "Level 4 - Higher-Amplitude Bounds and Reactive Rebounds",
      "cardSummary": "Single-Leg Triple Hop to Stick is a level-4 high-impact Output drill for repeated unilateral horizontal projection and final landing.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Single-Leg Triple Hop to Stick as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets repeated unilateral horizontal projection and final landing. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: single_leg_elastic_control. Coach this as level-4 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "excellent high-impact plyometric for athletes who have earned single-leg hop control",
      "selectionTarget": "repeated unilateral horizontal projection and final landing",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "hop",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 4
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
      "whyItWorks": "Single-Leg Triple Hop to Stick creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because excellent high-impact plyometric for athletes who have earned single-leg hop control.",
      "whyItGoesHere": "Belongs in Output because impact level 4 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing"
        ],
        "primaryTissues": [
          "intrinsic foot",
          "plantar fascia",
          "calf complex",
          "Achilles tendon",
          "quadriceps",
          "patellar tendon",
          "glutes",
          "hip flexors"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "high_dynamic",
        "coordinationDemand": "very_high",
        "impactLevel": 4,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "2-4 x 1 sequence/side, 2-3min rest",
        "sets": "2-5",
        "repsOrContacts": "1-4 quality reps/contacts",
        "rest": "2-3 minutes",
        "contactCap": "6-18 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 4,
        "impactLevel": 4,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
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
          "intensityCeiling": "very_high_quality_only",
          "impactLevel": 4
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 28,
      "slug": "repeated-broad-jump-to-sprint-out",
      "name": "Repeated Broad Jump to Sprint-Out",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_4",
      "impactClassification": {
        "movementImpactLevel": 4,
        "safetyImpactLevel": 4,
        "phaseProfileImpactLevel": 4,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "jump_throw_explosive_power",
      "subroleSecondary": "horizontal_projection_to_acceleration",
      "slot": "repeated_broad_jump_sprint_out",
      "category": "Level 4 - Higher-Amplitude Bounds and Reactive Rebounds",
      "cardSummary": "Repeated Broad Jump to Sprint-Out is a level-4 high-impact Output drill for horizontal rebounds that finish in acceleration.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Repeated Broad Jump to Sprint-Out as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets horizontal rebounds that finish in acceleration. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Coach this as level-4 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "links repeated horizontal power to the next sport action while keeping reps low",
      "selectionTarget": "horizontal rebounds that finish in acceleration",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "jump",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 4
        },
        {
          "key": "locomote",
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
      "whyItWorks": "Repeated Broad Jump to Sprint-Out creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because links repeated horizontal power to the next sport action while keeping reps low.",
      "whyItGoesHere": "Belongs in Output because impact level 4 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing",
          "acceleration step mechanics",
          "foot strike under center of mass"
        ],
        "primaryTissues": [
          "glutes",
          "hip flexors",
          "quadriceps",
          "patellar tendon",
          "calf complex",
          "Achilles tendon",
          "abdominals",
          "obliques"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "high_dynamic",
        "coordinationDemand": "very_high",
        "impactLevel": 4,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "3-4 x 2 broad jumps + 5-10m, 2-3min rest",
        "sets": "2-5",
        "repsOrContacts": "1-4 quality reps/contacts",
        "rest": "2-3 minutes",
        "contactCap": "6-18 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 4,
        "impactLevel": 4,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
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
          "intensityCeiling": "very_high_quality_only",
          "impactLevel": 4
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 29,
      "slug": "bounds-to-decel-gate",
      "name": "Bounds to Decel Gate",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_4",
      "impactClassification": {
        "movementImpactLevel": 4,
        "safetyImpactLevel": 4,
        "phaseProfileImpactLevel": 4,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "deceleration_cod_power",
      "subroleSecondary": "bound_to_braking_gate",
      "slot": "bounds_to_decel_gate",
      "category": "Level 4 - Higher-Amplitude Bounds and Reactive Rebounds",
      "cardSummary": "Bounds to Decel Gate is a level-4 high-impact Output drill for elastic projection followed by controlled braking at a gate.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Bounds to Decel Gate as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets elastic projection followed by controlled braking at a gate. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: deceleration_cod_power. Coach this as level-4 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "adds a braking responsibility to high-output bounding so it is not just distance chasing",
      "selectionTarget": "elastic projection followed by controlled braking at a gate",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "bound",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 4
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
      "whyItWorks": "Bounds to Decel Gate creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because adds a braking responsibility to high-output bounding so it is not just distance chasing.",
      "whyItGoesHere": "Belongs in Output because impact level 4 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing",
          "acceleration step mechanics",
          "foot strike under center of mass"
        ],
        "primaryTissues": [
          "glutes",
          "hip flexors",
          "quadriceps",
          "patellar tendon",
          "calf complex",
          "Achilles tendon",
          "abdominals",
          "obliques"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "high_dynamic",
        "coordinationDemand": "very_high",
        "impactLevel": 4,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "3-4 x 4 bounds + stick, 2-3min rest",
        "sets": "2-5",
        "repsOrContacts": "1-4 quality reps/contacts",
        "rest": "2-3 minutes",
        "contactCap": "6-18 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 4,
        "impactLevel": 4,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
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
          "intensityCeiling": "very_high_quality_only",
          "impactLevel": 4
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 30,
      "slug": "lateral-bound-rebound-series",
      "name": "Lateral Bound Rebound Series",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_4",
      "impactClassification": {
        "movementImpactLevel": 4,
        "safetyImpactLevel": 4,
        "phaseProfileImpactLevel": 4,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "multidirectional_elastic_power",
      "subroleSecondary": "frontal_plane_rebound_power",
      "slot": "lateral_bound_rebound_series",
      "category": "Level 4 - Higher-Amplitude Bounds and Reactive Rebounds",
      "cardSummary": "Lateral Bound Rebound Series is a level-4 high-impact Output drill for continuous lateral re-projection with strong edge control.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Lateral Bound Rebound Series as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets continuous lateral re-projection with strong edge control. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: multidirectional_elastic_power. Coach this as level-4 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "high-value frontal-plane output for athletes who already own skater hop sticks",
      "selectionTarget": "continuous lateral re-projection with strong edge control",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "bound",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 4
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
          "key": "adductors",
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
      "whyItWorks": "Lateral Bound Rebound Series creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because high-value frontal-plane output for athletes who already own skater hop sticks.",
      "whyItGoesHere": "Belongs in Output because impact level 4 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing",
          "acceleration step mechanics",
          "foot strike under center of mass"
        ],
        "primaryTissues": [
          "glutes",
          "hip flexors",
          "adductors",
          "glute medius",
          "calf complex",
          "Achilles tendon",
          "abdominals",
          "obliques"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "high_dynamic",
        "coordinationDemand": "very_high",
        "impactLevel": 4,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "2-4 x 3-5 contacts, 2-3min rest",
        "sets": "2-5",
        "repsOrContacts": "1-4 quality reps/contacts",
        "rest": "2-3 minutes",
        "contactCap": "6-18 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 4,
        "impactLevel": 4,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
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
          "intensityCeiling": "very_high_quality_only",
          "impactLevel": 4
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 31,
      "slug": "tuck-jump-to-lateral-stick",
      "name": "Tuck Jump to Lateral Stick",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_4",
      "impactClassification": {
        "movementImpactLevel": 4,
        "safetyImpactLevel": 4,
        "phaseProfileImpactLevel": 4,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "vertical_elastic_power",
      "subroleSecondary": "vertical_to_lateral_landing",
      "slot": "tuck_jump_to_lateral_stick",
      "category": "Level 4 - Higher-Amplitude Bounds and Reactive Rebounds",
      "cardSummary": "Tuck Jump to Lateral Stick is a level-4 high-impact Output drill for vertical explosive contact ending in lateral landing control.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Tuck Jump to Lateral Stick as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets vertical explosive contact ending in lateral landing control. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: vertical_elastic_power. Coach this as level-4 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "uses a high vertical demand but caps chaos with a deliberate lateral stick",
      "selectionTarget": "vertical explosive contact ending in lateral landing control",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "jump",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 4
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
      "whyItWorks": "Tuck Jump to Lateral Stick creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because uses a high vertical demand but caps chaos with a deliberate lateral stick.",
      "whyItGoesHere": "Belongs in Output because impact level 4 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing"
        ],
        "primaryTissues": [
          "glutes",
          "hip flexors",
          "quadriceps",
          "patellar tendon",
          "calf complex",
          "Achilles tendon",
          "abdominals",
          "obliques"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "high_dynamic",
        "coordinationDemand": "very_high",
        "impactLevel": 4,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "3 x 2-4 reps, 2min rest",
        "sets": "2-5",
        "repsOrContacts": "1-4 quality reps/contacts",
        "rest": "2-3 minutes",
        "contactCap": "6-18 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 4,
        "impactLevel": 4,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
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
          "intensityCeiling": "very_high_quality_only",
          "impactLevel": 4
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 32,
      "slug": "low-hurdle-hop-continuous-with-turn",
      "name": "Low Hurdle Hop Continuous with Turn",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_4",
      "impactClassification": {
        "movementImpactLevel": 4,
        "safetyImpactLevel": 4,
        "phaseProfileImpactLevel": 4,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "reactive_jump",
      "subroleSecondary": "hurdle_turn_reactivity",
      "slot": "low_hurdle_hop_continuous_with_turn",
      "category": "Level 4 - Higher-Amplitude Bounds and Reactive Rebounds",
      "cardSummary": "Low Hurdle Hop Continuous with Turn is a level-4 high-impact Output drill for continuous low hurdle contacts plus directional reorientation.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Low Hurdle Hop Continuous with Turn as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets continuous low hurdle contacts plus directional reorientation. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: reactive_jump. Coach this as level-4 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "progresses hurdle contacts by adding turn control rather than simply increasing height",
      "selectionTarget": "continuous low hurdle contacts plus directional reorientation",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "jump",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 4
        },
        {
          "key": "rotate",
          "weight": 3
        },
        {
          "key": "brace",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "low_hurdle",
          "weight": 5
        }
      ],
      "bodyRegions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
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
      "whyItWorks": "Low Hurdle Hop Continuous with Turn creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because progresses hurdle contacts by adding turn control rather than simply increasing height.",
      "whyItGoesHere": "Belongs in Output because impact level 4 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing",
          "hip internal/external rotation",
          "thoracic rotation",
          "pelvis control"
        ],
        "primaryTissues": [
          "calf complex",
          "Achilles tendon",
          "quadriceps",
          "patellar tendon",
          "glutes",
          "hip flexors",
          "abdominals",
          "obliques"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "high_dynamic",
        "coordinationDemand": "very_high",
        "impactLevel": 4,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "2-4 x 3-5 contacts, 2-3min rest",
        "sets": "2-5",
        "repsOrContacts": "1-4 quality reps/contacts",
        "rest": "2-3 minutes",
        "contactCap": "6-18 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 4,
        "impactLevel": 4,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
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
          "intensityCeiling": "very_high_quality_only",
          "impactLevel": 4
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 33,
      "slug": "hurdle-hop-to-broad-jump",
      "name": "Hurdle Hop to Broad Jump",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_4",
      "impactClassification": {
        "movementImpactLevel": 4,
        "safetyImpactLevel": 4,
        "phaseProfileImpactLevel": 4,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "reactive_jump",
      "subroleSecondary": "vertical_horizontal_reprojection",
      "slot": "hurdle_hop_to_broad_jump",
      "category": "Level 4 - Higher-Amplitude Bounds and Reactive Rebounds",
      "cardSummary": "Hurdle Hop to Broad Jump is a level-4 high-impact Output drill for clearance contact into horizontal projection.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Hurdle Hop to Broad Jump as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets clearance contact into horizontal projection. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: reactive_jump. Coach this as level-4 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "combines vertical stiffness and horizontal power in a small enough dose to stay quality-first",
      "selectionTarget": "clearance contact into horizontal projection",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "jump",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 4
        },
        {
          "key": "brace",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "low_hurdle",
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
      "whyItWorks": "Hurdle Hop to Broad Jump creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because combines vertical stiffness and horizontal power in a small enough dose to stay quality-first.",
      "whyItGoesHere": "Belongs in Output because impact level 4 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing"
        ],
        "primaryTissues": [
          "glutes",
          "hip flexors",
          "quadriceps",
          "patellar tendon",
          "calf complex",
          "Achilles tendon",
          "abdominals",
          "obliques"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "high_dynamic",
        "coordinationDemand": "very_high",
        "impactLevel": 4,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "3-4 x 1-3 sequences, 2-3min rest",
        "sets": "2-5",
        "repsOrContacts": "1-4 quality reps/contacts",
        "rest": "2-3 minutes",
        "contactCap": "6-18 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 4,
        "impactLevel": 4,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
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
          "intensityCeiling": "very_high_quality_only",
          "impactLevel": 4
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 34,
      "slug": "depth-drop-to-lateral-rebound",
      "name": "Depth Drop to Lateral Rebound",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_4",
      "impactClassification": {
        "movementImpactLevel": 4,
        "safetyImpactLevel": 4,
        "phaseProfileImpactLevel": 4,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "depth_reactive_jump",
      "subroleSecondary": "lateral_rebound_after_drop",
      "slot": "depth_drop_lateral_rebound",
      "category": "Level 4 - Higher-Amplitude Bounds and Reactive Rebounds",
      "cardSummary": "Depth Drop to Lateral Rebound is a level-4 high-impact Output drill for drop absorption followed by side re-projection.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Depth Drop to Lateral Rebound as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets drop absorption followed by side re-projection. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: depth_reactive_jump. Coach this as level-4 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "strong level-4 option for athletes who need lateral elastic power after absorbing impact",
      "selectionTarget": "drop absorption followed by side re-projection",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "land",
          "weight": 5
        },
        {
          "key": "jump",
          "weight": 4
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
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
          "weight": 5
        },
        {
          "key": "adductors",
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
      "whyItWorks": "Depth Drop to Lateral Rebound creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because strong level-4 option for athletes who need lateral elastic power after absorbing impact.",
      "whyItGoesHere": "Belongs in Output because impact level 4 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing",
          "acceleration step mechanics",
          "foot strike under center of mass"
        ],
        "primaryTissues": [
          "glutes",
          "hip flexors",
          "adductors",
          "glute medius",
          "quadriceps",
          "patellar tendon",
          "calf complex",
          "Achilles tendon"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "high_dynamic",
        "coordinationDemand": "very_high",
        "impactLevel": 4,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "2-4 x 2/side, 2-3min rest",
        "sets": "2-5",
        "repsOrContacts": "1-4 quality reps/contacts",
        "rest": "2-3 minutes",
        "contactCap": "6-18 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 4,
        "impactLevel": 4,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
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
          "intensityCeiling": "very_high_quality_only",
          "impactLevel": 4
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 35,
      "slug": "depth-drop-to-broad-rebound",
      "name": "Depth Drop to Broad Rebound",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_4",
      "impactClassification": {
        "movementImpactLevel": 4,
        "safetyImpactLevel": 4,
        "phaseProfileImpactLevel": 4,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "depth_reactive_jump",
      "subroleSecondary": "horizontal_rebound_after_drop",
      "slot": "depth_drop_broad_rebound",
      "category": "Level 4 - Higher-Amplitude Bounds and Reactive Rebounds",
      "cardSummary": "Depth Drop to Broad Rebound is a level-4 high-impact Output drill for drop landing transformed into horizontal rebound power.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Depth Drop to Broad Rebound as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets drop landing transformed into horizontal rebound power. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: depth_reactive_jump. Coach this as level-4 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "high-impact horizontal elastic bridge that belongs only after lower-level drop and broad-jump quality",
      "selectionTarget": "drop landing transformed into horizontal rebound power",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "land",
          "weight": 5
        },
        {
          "key": "jump",
          "weight": 4
        },
        {
          "key": "brace",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "box",
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
      "whyItWorks": "Depth Drop to Broad Rebound creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because high-impact horizontal elastic bridge that belongs only after lower-level drop and broad-jump quality.",
      "whyItGoesHere": "Belongs in Output because impact level 4 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing"
        ],
        "primaryTissues": [
          "glutes",
          "hip flexors",
          "quadriceps",
          "patellar tendon",
          "calf complex",
          "Achilles tendon",
          "abdominals",
          "obliques"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "high_dynamic",
        "coordinationDemand": "very_high",
        "impactLevel": 4,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "2-4 x 1-3 reps, 2-3min rest",
        "sets": "2-5",
        "repsOrContacts": "1-4 quality reps/contacts",
        "rest": "2-3 minutes",
        "contactCap": "6-18 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 4,
        "impactLevel": 4,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
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
          "intensityCeiling": "very_high_quality_only",
          "impactLevel": 4
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 36,
      "slug": "reactive-45-degree-hop-to-cut",
      "name": "Reactive 45-Degree Hop-to-Cut",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_4",
      "impactClassification": {
        "movementImpactLevel": 4,
        "safetyImpactLevel": 4,
        "phaseProfileImpactLevel": 4,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "reactive_agility_output",
      "subroleSecondary": "hop_to_cut_reacceleration",
      "slot": "reactive_45_degree_hop_to_cut",
      "category": "Level 4 - COD, Curved, Partner, and Multidirectional Output",
      "cardSummary": "Reactive 45-Degree Hop-to-Cut is a level-4 high-impact Output drill for cue-driven hop landing into a sharp angled cut.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Reactive 45-Degree Hop-to-Cut as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets cue-driven hop landing into a sharp angled cut. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: reactive_agility_output. Coach this as level-4 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "combines impact, braking, decision timing, and re-acceleration in a capped output dose",
      "selectionTarget": "cue-driven hop landing into a sharp angled cut",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "hop",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 4
        },
        {
          "key": "locomote",
          "weight": 3
        },
        {
          "key": "react",
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
          "weight": 4
        },
        {
          "key": "ankle",
          "weight": 3
        },
        {
          "key": "eyes",
          "weight": 2
        }
      ],
      "whyItWorks": "Reactive 45-Degree Hop-to-Cut creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because combines impact, braking, decision timing, and re-acceleration in a capped output dose.",
      "whyItGoesHere": "Belongs in Output because impact level 4 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing",
          "acceleration step mechanics",
          "foot strike under center of mass",
          "visual cue processing",
          "braking-to-reacceleration timing"
        ],
        "primaryTissues": [
          "glutes",
          "hip flexors",
          "quadriceps",
          "patellar tendon",
          "calf complex",
          "Achilles tendon",
          "visual system",
          "vestibular orientation"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "high_dynamic",
        "coordinationDemand": "very_high",
        "impactLevel": 4,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "3-5 x 1-2/side, 2-3min rest",
        "sets": "2-5",
        "repsOrContacts": "1-4 quality reps/contacts",
        "rest": "2-3 minutes",
        "contactCap": "6-18 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 4,
        "impactLevel": 4,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
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
          "intensityCeiling": "very_high_quality_only",
          "impactLevel": 4
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 37,
      "slug": "crossover-bound-to-re-acceleration",
      "name": "Crossover Bound to Re-Acceleration",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_4",
      "impactClassification": {
        "movementImpactLevel": 4,
        "safetyImpactLevel": 4,
        "phaseProfileImpactLevel": 4,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "deceleration_cod_power",
      "subroleSecondary": "crossover_bound_go",
      "slot": "crossover_bound_reacceleration",
      "category": "Level 4 - COD, Curved, Partner, and Multidirectional Output",
      "cardSummary": "Crossover Bound to Re-Acceleration is a level-4 high-impact Output drill for crossover projection into immediate first-step acceleration.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Crossover Bound to Re-Acceleration as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets crossover projection into immediate first-step acceleration. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: deceleration_cod_power. Coach this as level-4 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "turns crossover power into usable sport acceleration without high-volume cutting",
      "selectionTarget": "crossover projection into immediate first-step acceleration",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "bound",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 4
        },
        {
          "key": "rotate",
          "weight": 3
        },
        {
          "key": "locomote",
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
          "key": "adductors",
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
      "whyItWorks": "Crossover Bound to Re-Acceleration creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because turns crossover power into usable sport acceleration without high-volume cutting.",
      "whyItGoesHere": "Belongs in Output because impact level 4 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing",
          "hip internal/external rotation",
          "thoracic rotation",
          "pelvis control",
          "acceleration step mechanics"
        ],
        "primaryTissues": [
          "glutes",
          "hip flexors",
          "adductors",
          "glute medius",
          "calf complex",
          "Achilles tendon",
          "abdominals",
          "obliques"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "high_dynamic",
        "coordinationDemand": "very_high",
        "impactLevel": 4,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "3-4 x 2/side, 2-3min rest",
        "sets": "2-5",
        "repsOrContacts": "1-4 quality reps/contacts",
        "rest": "2-3 minutes",
        "contactCap": "6-18 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 4,
        "impactLevel": 4,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
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
          "intensityCeiling": "very_high_quality_only",
          "impactLevel": 4
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 38,
      "slug": "partner-chase-bound-start",
      "name": "Partner Chase Bound Start",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_4",
      "impactClassification": {
        "movementImpactLevel": 4,
        "safetyImpactLevel": 4,
        "phaseProfileImpactLevel": 4,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "reactive_agility_output",
      "subroleSecondary": "partner_chase_first_step",
      "slot": "partner_chase_bound_start",
      "category": "Level 4 - COD, Curved, Partner, and Multidirectional Output",
      "cardSummary": "Partner Chase Bound Start is a level-4 high-impact Output drill for live partner cue into one bound and short chase.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Partner Chase Bound Start as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets live partner cue into one bound and short chase. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: reactive_agility_output. Coach this as level-4 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "adds meaningful uncertainty while keeping the high-impact portion short and supervised",
      "selectionTarget": "live partner cue into one bound and short chase",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "bound",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 4
        },
        {
          "key": "react",
          "weight": 3
        },
        {
          "key": "locomote",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "partner",
          "weight": 5
        },
        {
          "key": "cones",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
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
          "key": "eyes",
          "weight": 2
        }
      ],
      "whyItWorks": "Partner Chase Bound Start creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because adds meaningful uncertainty while keeping the high-impact portion short and supervised.",
      "whyItGoesHere": "Belongs in Output because impact level 4 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing",
          "acceleration step mechanics",
          "foot strike under center of mass",
          "visual cue processing",
          "braking-to-reacceleration timing"
        ],
        "primaryTissues": [
          "glutes",
          "hip flexors",
          "calf complex",
          "Achilles tendon",
          "quadriceps",
          "patellar tendon",
          "visual system",
          "vestibular orientation"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "high_dynamic",
        "coordinationDemand": "very_high",
        "impactLevel": 4,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "3-5 x 1 chase/side, 2-3min rest",
        "sets": "2-5",
        "repsOrContacts": "1-4 quality reps/contacts",
        "rest": "2-3 minutes",
        "contactCap": "6-18 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 4,
        "impactLevel": 4,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
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
          "intensityCeiling": "very_high_quality_only",
          "impactLevel": 4
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 39,
      "slug": "shuffle-to-bound-to-sprint",
      "name": "Shuffle-to-Bound-to-Sprint",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_4",
      "impactClassification": {
        "movementImpactLevel": 4,
        "safetyImpactLevel": 4,
        "phaseProfileImpactLevel": 4,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "deceleration_cod_power",
      "subroleSecondary": "lateral_to_linear_output",
      "slot": "shuffle_bound_sprint",
      "category": "Level 4 - COD, Curved, Partner, and Multidirectional Output",
      "cardSummary": "Shuffle-to-Bound-to-Sprint is a level-4 high-impact Output drill for lateral shuffle rhythm into explosive bound and acceleration.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Shuffle-to-Bound-to-Sprint as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets lateral shuffle rhythm into explosive bound and acceleration. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: deceleration_cod_power. Coach this as level-4 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "connects lateral movement, high-impact bound, and sprint-out in one coachable pattern",
      "selectionTarget": "lateral shuffle rhythm into explosive bound and acceleration",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "bound",
          "weight": 4
        },
        {
          "key": "land",
          "weight": 3
        },
        {
          "key": "sprint",
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
      "whyItWorks": "Shuffle-to-Bound-to-Sprint creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because connects lateral movement, high-impact bound, and sprint-out in one coachable pattern.",
      "whyItGoesHere": "Belongs in Output because impact level 4 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing",
          "acceleration step mechanics",
          "foot strike under center of mass"
        ],
        "primaryTissues": [
          "glutes",
          "hip flexors",
          "quadriceps",
          "patellar tendon",
          "calf complex",
          "Achilles tendon",
          "abdominals",
          "obliques"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "high_dynamic",
        "coordinationDemand": "very_high",
        "impactLevel": 4,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "3-5 x 1 sequence/side, 2-3min rest",
        "sets": "2-5",
        "repsOrContacts": "1-4 quality reps/contacts",
        "rest": "2-3 minutes",
        "contactCap": "6-18 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 4,
        "impactLevel": 4,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
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
          "intensityCeiling": "very_high_quality_only",
          "impactLevel": 4
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 40,
      "slug": "backpedal-turn-to-hop-and-go",
      "name": "Backpedal Turn to Hop-and-Go",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_4",
      "impactClassification": {
        "movementImpactLevel": 4,
        "safetyImpactLevel": 4,
        "phaseProfileImpactLevel": 4,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "deceleration_cod_power",
      "subroleSecondary": "rearward_to_forward_transition",
      "slot": "backpedal_turn_hop_and_go",
      "category": "Level 4 - COD, Curved, Partner, and Multidirectional Output",
      "cardSummary": "Backpedal Turn to Hop-and-Go is a level-4 high-impact Output drill for rearward movement, hip flip, hop contact, and go.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Backpedal Turn to Hop-and-Go as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets rearward movement, hip flip, hop contact, and go. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: deceleration_cod_power. Coach this as level-4 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "fills a useful gap between agility mechanics and true high-impact re-acceleration",
      "selectionTarget": "rearward movement, hip flip, hop contact, and go",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "hop",
          "weight": 4
        },
        {
          "key": "land",
          "weight": 3
        },
        {
          "key": "react",
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
      "whyItWorks": "Backpedal Turn to Hop-and-Go creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because fills a useful gap between agility mechanics and true high-impact re-acceleration.",
      "whyItGoesHere": "Belongs in Output because impact level 4 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing",
          "acceleration step mechanics",
          "foot strike under center of mass",
          "visual cue processing",
          "braking-to-reacceleration timing"
        ],
        "primaryTissues": [
          "glutes",
          "hip flexors",
          "quadriceps",
          "patellar tendon",
          "calf complex",
          "Achilles tendon",
          "abdominals",
          "obliques"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "high_dynamic",
        "coordinationDemand": "very_high",
        "impactLevel": 4,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "3-4 x 1 sequence/side, 2-3min rest",
        "sets": "2-5",
        "repsOrContacts": "1-4 quality reps/contacts",
        "rest": "2-3 minutes",
        "contactCap": "6-18 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 4,
        "impactLevel": 4,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
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
          "intensityCeiling": "very_high_quality_only",
          "impactLevel": 4
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 41,
      "slug": "curved-sprint-bound-series",
      "name": "Curved Sprint Bound Series",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_4",
      "impactClassification": {
        "movementImpactLevel": 4,
        "safetyImpactLevel": 4,
        "phaseProfileImpactLevel": 4,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "max_velocity_exposure",
      "subroleSecondary": "curved_elastic_contacts",
      "slot": "curved_sprint_bound_series",
      "category": "Level 4 - COD, Curved, Partner, and Multidirectional Output",
      "cardSummary": "Curved Sprint Bound Series is a level-4 high-impact Output drill for elastic bounding around a curve with posture and lean.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Curved Sprint Bound Series as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets elastic bounding around a curve with posture and lean. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: max_velocity_exposure. Coach this as level-4 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "uses curve constraints to challenge stiffness and posture without maximal sprint volume",
      "selectionTarget": "elastic bounding around a curve with posture and lean",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "bound",
          "weight": 5
        },
        {
          "key": "locomote",
          "weight": 4
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
      "bodyRegions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "hip",
          "weight": 4
        },
        {
          "key": "hamstrings",
          "weight": 3
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "whyItWorks": "Curved Sprint Bound Series creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because uses curve constraints to challenge stiffness and posture without maximal sprint volume.",
      "whyItGoesHere": "Belongs in Output because impact level 4 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing",
          "acceleration step mechanics",
          "foot strike under center of mass"
        ],
        "primaryTissues": [
          "calf complex",
          "Achilles tendon",
          "glutes",
          "hip flexors",
          "hamstrings",
          "abdominals",
          "obliques"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "high_dynamic",
        "coordinationDemand": "very_high",
        "impactLevel": 4,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "3-4 x 10-20m, 2-3min rest",
        "sets": "2-5",
        "repsOrContacts": "1-4 quality reps/contacts",
        "rest": "2-3 minutes",
        "contactCap": "6-18 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 4,
        "impactLevel": 4,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
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
          "intensityCeiling": "very_high_quality_only",
          "impactLevel": 4
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 42,
      "slug": "zigzag-bound-rebound-course",
      "name": "Zigzag Bound Rebound Course",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_4",
      "impactClassification": {
        "movementImpactLevel": 4,
        "safetyImpactLevel": 4,
        "phaseProfileImpactLevel": 4,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "multidirectional_elastic_power",
      "subroleSecondary": "zigzag_rebound_projection",
      "slot": "zigzag_bound_rebound_course",
      "category": "Level 4 - COD, Curved, Partner, and Multidirectional Output",
      "cardSummary": "Zigzag Bound Rebound Course is a level-4 high-impact Output drill for multidirectional bounds between angled gates.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Zigzag Bound Rebound Course as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets multidirectional bounds between angled gates. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: multidirectional_elastic_power. Coach this as level-4 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "develops repeated angle changes while preserving a simple cone-defined quality gate",
      "selectionTarget": "multidirectional bounds between angled gates",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "bound",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 4
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
          "weight": 4
        },
        {
          "key": "knee",
          "weight": 3
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "whyItWorks": "Zigzag Bound Rebound Course creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because develops repeated angle changes while preserving a simple cone-defined quality gate.",
      "whyItGoesHere": "Belongs in Output because impact level 4 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing",
          "acceleration step mechanics",
          "foot strike under center of mass"
        ],
        "primaryTissues": [
          "glutes",
          "hip flexors",
          "calf complex",
          "Achilles tendon",
          "quadriceps",
          "patellar tendon",
          "abdominals",
          "obliques"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "high_dynamic",
        "coordinationDemand": "very_high",
        "impactLevel": 4,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "2-4 x 4-6 contacts, 2-3min rest",
        "sets": "2-5",
        "repsOrContacts": "1-4 quality reps/contacts",
        "rest": "2-3 minutes",
        "contactCap": "6-18 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 4,
        "impactLevel": 4,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
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
          "intensityCeiling": "very_high_quality_only",
          "impactLevel": 4
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 43,
      "slug": "180-jump-rebound-to-sprint-out",
      "name": "180 Jump Rebound to Sprint-Out",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_4",
      "impactClassification": {
        "movementImpactLevel": 4,
        "safetyImpactLevel": 4,
        "phaseProfileImpactLevel": 4,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "multidirectional_elastic_control",
      "subroleSecondary": "rotation_to_acceleration",
      "slot": "one_eighty_jump_rebound_sprint_out",
      "category": "Level 4 - COD, Curved, Partner, and Multidirectional Output",
      "cardSummary": "180 Jump Rebound to Sprint-Out is a level-4 high-impact Output drill for half-turn rebound linked to a short acceleration.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform 180 Jump Rebound to Sprint-Out as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets half-turn rebound linked to a short acceleration. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: multidirectional_elastic_control. Coach this as level-4 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "progresses a 180 rebound into sport-relevant acceleration without chasing fatigue",
      "selectionTarget": "half-turn rebound linked to a short acceleration",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "jump",
          "weight": 5
        },
        {
          "key": "rotate",
          "weight": 4
        },
        {
          "key": "land",
          "weight": 3
        },
        {
          "key": "sprint",
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
          "weight": 4
        },
        {
          "key": "knee",
          "weight": 3
        },
        {
          "key": "core",
          "weight": 2
        }
      ],
      "whyItWorks": "180 Jump Rebound to Sprint-Out creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because progresses a 180 rebound into sport-relevant acceleration without chasing fatigue.",
      "whyItGoesHere": "Belongs in Output because impact level 4 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing",
          "hip internal/external rotation",
          "thoracic rotation",
          "pelvis control",
          "acceleration step mechanics"
        ],
        "primaryTissues": [
          "glutes",
          "hip flexors",
          "calf complex",
          "Achilles tendon",
          "quadriceps",
          "patellar tendon",
          "abdominals",
          "obliques"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "high_dynamic",
        "coordinationDemand": "very_high",
        "impactLevel": 4,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "3-4 x 1-2 reps/side, 2-3min rest",
        "sets": "2-5",
        "repsOrContacts": "1-4 quality reps/contacts",
        "rest": "2-3 minutes",
        "contactCap": "6-18 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 4,
        "impactLevel": 4,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
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
          "intensityCeiling": "very_high_quality_only",
          "impactLevel": 4
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 44,
      "slug": "single-leg-lateral-rebound-to-cut",
      "name": "Single-Leg Lateral Rebound to Cut",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_4",
      "impactClassification": {
        "movementImpactLevel": 4,
        "safetyImpactLevel": 4,
        "phaseProfileImpactLevel": 4,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "single_leg_elastic_control",
      "subroleSecondary": "unilateral_cut_rebound",
      "slot": "single_leg_lateral_rebound_to_cut",
      "category": "Level 4 - COD, Curved, Partner, and Multidirectional Output",
      "cardSummary": "Single-Leg Lateral Rebound to Cut is a level-4 high-impact Output drill for single-leg side rebound into controlled cut.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Single-Leg Lateral Rebound to Cut as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets single-leg side rebound into controlled cut. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: single_leg_elastic_control. Coach this as level-4 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "high-transfer but high-cost unilateral contact for athletes with demonstrated single-leg landing skill",
      "selectionTarget": "single-leg side rebound into controlled cut",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "hop",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 4
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
      "whyItWorks": "Single-Leg Lateral Rebound to Cut creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because high-transfer but high-cost unilateral contact for athletes with demonstrated single-leg landing skill.",
      "whyItGoesHere": "Belongs in Output because impact level 4 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing",
          "acceleration step mechanics",
          "foot strike under center of mass"
        ],
        "primaryTissues": [
          "intrinsic foot",
          "plantar fascia",
          "calf complex",
          "Achilles tendon",
          "quadriceps",
          "patellar tendon",
          "glutes",
          "hip flexors"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "high_dynamic",
        "coordinationDemand": "very_high",
        "impactLevel": 4,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "2-4 x 1-2/side, 2-3min rest",
        "sets": "2-5",
        "repsOrContacts": "1-4 quality reps/contacts",
        "rest": "2-3 minutes",
        "contactCap": "6-18 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 4,
        "impactLevel": 4,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
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
          "intensityCeiling": "very_high_quality_only",
          "impactLevel": 4
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 45,
      "slug": "reaction-ball-drop-to-hop-and-go",
      "name": "Reaction Ball Drop to Hop-and-Go",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_4",
      "impactClassification": {
        "movementImpactLevel": 4,
        "safetyImpactLevel": 4,
        "phaseProfileImpactLevel": 4,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "reactive_agility_output",
      "subroleSecondary": "visual_reaction_hop_go",
      "slot": "reaction_ball_drop_hop_and_go",
      "category": "Level 4 - COD, Curved, Partner, and Multidirectional Output",
      "cardSummary": "Reaction Ball Drop to Hop-and-Go is a level-4 high-impact Output drill for visual tracking into a hop contact and acceleration.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Reaction Ball Drop to Hop-and-Go as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets visual tracking into a hop contact and acceleration. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: reactive_agility_output. Coach this as level-4 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "adds perception-action demand while preserving a small number of high-quality contacts",
      "selectionTarget": "visual tracking into a hop contact and acceleration",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "react",
          "weight": 5
        },
        {
          "key": "hop",
          "weight": 4
        },
        {
          "key": "land",
          "weight": 3
        },
        {
          "key": "locomote",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "reaction_ball",
          "weight": 5
        },
        {
          "key": "partner",
          "weight": 4
        },
        {
          "key": "cones",
          "weight": 3
        }
      ],
      "bodyRegions": [
        {
          "key": "eyes",
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
          "key": "knee",
          "weight": 2
        }
      ],
      "whyItWorks": "Reaction Ball Drop to Hop-and-Go creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because adds perception-action demand while preserving a small number of high-quality contacts.",
      "whyItGoesHere": "Belongs in Output because impact level 4 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing",
          "acceleration step mechanics",
          "foot strike under center of mass",
          "visual cue processing",
          "braking-to-reacceleration timing"
        ],
        "primaryTissues": [
          "visual system",
          "vestibular orientation",
          "glutes",
          "hip flexors",
          "calf complex",
          "Achilles tendon",
          "quadriceps",
          "patellar tendon"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "high_dynamic",
        "coordinationDemand": "very_high",
        "impactLevel": 4,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "3-5 x 1 rep/side, 2-3min rest",
        "sets": "2-5",
        "repsOrContacts": "1-4 quality reps/contacts",
        "rest": "2-3 minutes",
        "contactCap": "6-18 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 4,
        "impactLevel": 4,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
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
          "intensityCeiling": "very_high_quality_only",
          "impactLevel": 4
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 46,
      "slug": "medicine-ball-scoop-toss-to-broad-rebound",
      "name": "Medicine Ball Scoop Toss to Broad Rebound",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_4",
      "impactClassification": {
        "movementImpactLevel": 4,
        "safetyImpactLevel": 4,
        "phaseProfileImpactLevel": 4,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "jump_throw_explosive_power",
      "subroleSecondary": "throw_to_horizontal_rebound",
      "slot": "med_ball_scoop_toss_broad_rebound",
      "category": "Level 4 - Implement-Integrated and Reactive Plyometric Finishers",
      "cardSummary": "Medicine Ball Scoop Toss to Broad Rebound is a level-4 high-impact Output drill for hip projection through a throw followed by broad rebound.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Medicine Ball Scoop Toss to Broad Rebound as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets hip projection through a throw followed by broad rebound. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Coach this as level-4 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "pairs trunk/hip projection with lower-body elastic output without letting the throw become conditioning",
      "selectionTarget": "hip projection through a throw followed by broad rebound",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "throw",
          "weight": 5
        },
        {
          "key": "jump",
          "weight": 4
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
          "key": "medicine_ball",
          "weight": 5
        }
      ],
      "bodyRegions": [
        {
          "key": "hip",
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
          "key": "ankle",
          "weight": 2
        },
        {
          "key": "knee",
          "weight": 2
        }
      ],
      "whyItWorks": "Medicine Ball Scoop Toss to Broad Rebound creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because pairs trunk/hip projection with lower-body elastic output without letting the throw become conditioning.",
      "whyItGoesHere": "Belongs in Output because impact level 4 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing",
          "shoulder flexion/extension",
          "trunk-to-arm force transfer"
        ],
        "primaryTissues": [
          "glutes",
          "hip flexors",
          "abdominals",
          "obliques",
          "deltoids",
          "rotator cuff",
          "calf complex",
          "Achilles tendon"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "high_dynamic",
        "coordinationDemand": "very_high",
        "impactLevel": 4,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "3-5 x 1-2 reps, 2-3min rest",
        "sets": "2-5",
        "repsOrContacts": "1-4 quality reps/contacts",
        "rest": "2-3 minutes",
        "contactCap": "6-18 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 4,
        "impactLevel": 4,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
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
          "intensityCeiling": "very_high_quality_only",
          "impactLevel": 4
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 47,
      "slug": "medicine-ball-rotational-toss-to-lateral-bound",
      "name": "Medicine Ball Rotational Toss to Lateral Bound",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_4",
      "impactClassification": {
        "movementImpactLevel": 4,
        "safetyImpactLevel": 4,
        "phaseProfileImpactLevel": 4,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "jump_throw_explosive_power",
      "subroleSecondary": "rotational_throw_to_lateral_bound",
      "slot": "med_ball_rotational_toss_lateral_bound",
      "category": "Level 4 - Implement-Integrated and Reactive Plyometric Finishers",
      "cardSummary": "Medicine Ball Rotational Toss to Lateral Bound is a level-4 high-impact Output drill for rotational force transfer into lateral bound and controlled finish.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Medicine Ball Rotational Toss to Lateral Bound as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets rotational force transfer into lateral bound and controlled finish. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: jump_throw_explosive_power. Coach this as level-4 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "connects implement power to a real high-impact lateral projection with clear spacing requirements",
      "selectionTarget": "rotational force transfer into lateral bound and controlled finish",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "throw",
          "weight": 5
        },
        {
          "key": "rotate",
          "weight": 4
        },
        {
          "key": "bound",
          "weight": 3
        },
        {
          "key": "land",
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
          "key": "core",
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
          "key": "shoulder",
          "weight": 2
        }
      ],
      "whyItWorks": "Medicine Ball Rotational Toss to Lateral Bound creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because connects implement power to a real high-impact lateral projection with clear spacing requirements.",
      "whyItGoesHere": "Belongs in Output because impact level 4 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing",
          "hip internal/external rotation",
          "thoracic rotation",
          "pelvis control",
          "shoulder flexion/extension"
        ],
        "primaryTissues": [
          "glutes",
          "hip flexors",
          "abdominals",
          "obliques",
          "calf complex",
          "Achilles tendon",
          "quadriceps",
          "patellar tendon"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "high_dynamic",
        "coordinationDemand": "very_high",
        "impactLevel": 4,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "3-4 x 1-2/side, 2-3min rest",
        "sets": "2-5",
        "repsOrContacts": "1-4 quality reps/contacts",
        "rest": "2-3 minutes",
        "contactCap": "6-18 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 4,
        "impactLevel": 4,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
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
          "intensityCeiling": "very_high_quality_only",
          "impactLevel": 4
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 48,
      "slug": "resisted-band-assisted-rebound-jump",
      "name": "Resisted Band-Assisted Rebound Jump",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_4",
      "impactClassification": {
        "movementImpactLevel": 4,
        "safetyImpactLevel": 4,
        "phaseProfileImpactLevel": 4,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "vertical_elastic_power",
      "subroleSecondary": "assisted_rebound_stiffness",
      "slot": "resisted_band_assisted_rebound_jump",
      "category": "Level 4 - Implement-Integrated and Reactive Plyometric Finishers",
      "cardSummary": "Resisted Band-Assisted Rebound Jump is a level-4 high-impact Output drill for overspeed-assisted rebound stiffness with conservative volume.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Resisted Band-Assisted Rebound Jump as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets overspeed-assisted rebound stiffness with conservative volume. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: vertical_elastic_power. Coach this as level-4 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "band assistance can sharpen rebound timing but requires coaching so impact stays organized",
      "selectionTarget": "overspeed-assisted rebound stiffness with conservative volume",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "jump",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 4
        },
        {
          "key": "brace",
          "weight": 3
        }
      ],
      "equipment": [
        {
          "key": "resistance_band",
          "weight": 5
        }
      ],
      "bodyRegions": [
        {
          "key": "ankle",
          "weight": 5
        },
        {
          "key": "knee",
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
      "whyItWorks": "Resisted Band-Assisted Rebound Jump creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because band assistance can sharpen rebound timing but requires coaching so impact stays organized.",
      "whyItGoesHere": "Belongs in Output because impact level 4 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing"
        ],
        "primaryTissues": [
          "calf complex",
          "Achilles tendon",
          "quadriceps",
          "patellar tendon",
          "glutes",
          "hip flexors",
          "abdominals",
          "obliques"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "high_dynamic",
        "coordinationDemand": "very_high",
        "impactLevel": 4,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "2-4 x 3-5 contacts, 2-3min rest",
        "sets": "2-5",
        "repsOrContacts": "1-4 quality reps/contacts",
        "rest": "2-3 minutes",
        "contactCap": "6-18 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 4,
        "impactLevel": 4,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
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
          "intensityCeiling": "very_high_quality_only",
          "impactLevel": 4
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 49,
      "slug": "low-hurdle-hop-to-reactive-color-call",
      "name": "Low Hurdle Hop to Reactive Color Call",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_4",
      "impactClassification": {
        "movementImpactLevel": 4,
        "safetyImpactLevel": 4,
        "phaseProfileImpactLevel": 4,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "reactive_agility_output",
      "subroleSecondary": "hurdle_reaction_landing",
      "slot": "low_hurdle_hop_reactive_color_call",
      "category": "Level 4 - Implement-Integrated and Reactive Plyometric Finishers",
      "cardSummary": "Low Hurdle Hop to Reactive Color Call is a level-4 high-impact Output drill for hurdle contact followed by live color-directed exit.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Low Hurdle Hop to Reactive Color Call as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets hurdle contact followed by live color-directed exit. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: reactive_agility_output. Coach this as level-4 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "merges reactive decision-making with a level-4 contact while keeping total contacts capped",
      "selectionTarget": "hurdle contact followed by live color-directed exit",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "jump",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 4
        },
        {
          "key": "react",
          "weight": 3
        },
        {
          "key": "locomote",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "low_hurdle",
          "weight": 5
        },
        {
          "key": "cones",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "eyes",
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
      "whyItWorks": "Low Hurdle Hop to Reactive Color Call creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because merges reactive decision-making with a level-4 contact while keeping total contacts capped.",
      "whyItGoesHere": "Belongs in Output because impact level 4 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing",
          "acceleration step mechanics",
          "foot strike under center of mass",
          "visual cue processing",
          "braking-to-reacceleration timing"
        ],
        "primaryTissues": [
          "visual system",
          "vestibular orientation",
          "calf complex",
          "Achilles tendon",
          "quadriceps",
          "patellar tendon",
          "glutes",
          "hip flexors"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "high_dynamic",
        "coordinationDemand": "very_high",
        "impactLevel": 4,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "3-5 x 1-2 reps, 2-3min rest",
        "sets": "2-5",
        "repsOrContacts": "1-4 quality reps/contacts",
        "rest": "2-3 minutes",
        "contactCap": "6-18 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 4,
        "impactLevel": 4,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
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
          "intensityCeiling": "very_high_quality_only",
          "impactLevel": 4
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    },
    {
      "id": 50,
      "slug": "mirror-bound-and-cut-duel",
      "name": "Mirror Bound-and-Cut Duel",
      "family": "High-Impact Level 3-4 Plyometric / Reactive Output",
      "focus": "high_impact_level_3_4_expansion",
      "impactTarget": "level_4",
      "impactClassification": {
        "movementImpactLevel": 4,
        "safetyImpactLevel": 4,
        "phaseProfileImpactLevel": 4,
        "highImpactThresholdApplied": ">= 3",
        "flaggedHighImpact": true,
        "clientFacingBadge": "High impact",
        "prepareAndAccessCompatible": false,
        "phasePlacementNote": "Author as Output high-impact work, not Prepare & Access warm-up prep."
      },
      "primaryPhaseKey": "output",
      "phaseKey": "output",
      "subrole": "reactive_agility_output",
      "subroleSecondary": "live_mirror_bound_cut",
      "slot": "mirror_bound_and_cut_duel",
      "category": "Level 4 - Implement-Integrated and Reactive Plyometric Finishers",
      "cardSummary": "Mirror Bound-and-Cut Duel is a level-4 high-impact Output drill for live opponent read into one bound and one cut.",
      "bestPlacement": "Use after Prepare & Access and any needed Movement Intelligence, while the nervous system is fresh. Place before heavy strength, conditioning, long sport blocks, or fatigue-based work.",
      "description": "Perform Mirror Bound-and-Cut Duel as a low-volume, high-quality plyometric or reactive-output exposure. The exercise targets live opponent read into one bound and one cut. The coach should cap volume, demand clean landings, and stop the set before contact quality fades.",
      "coachLanguage": "Primary subrole: reactive_agility_output. Coach this as level-4 high-impact Output work: small dose, long enough rest, clean projection, quiet landings, and an immediate stop when posture, timing, alignment, or reaction quality changes.",
      "athleteLanguage": "Fast and clean. Leave the ground with intent, land quietly, own the finish, and reset before the next rep.",
      "selectionRationale": "the most sport-like option in the set; useful only when spacing, maturity, and stop command quality are excellent",
      "selectionTarget": "live opponent read into one bound and one cut",
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
          "key": "plyometrics",
          "weight": 5
        },
        {
          "key": "speed_power",
          "weight": 4
        },
        {
          "key": "neural",
          "weight": 3
        }
      ],
      "physiology": [
        {
          "key": "ssc_stiffness",
          "weight": 5
        },
        {
          "key": "rate_of_force_development",
          "weight": 4
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
          "key": "bound",
          "weight": 5
        },
        {
          "key": "land",
          "weight": 4
        },
        {
          "key": "react",
          "weight": 3
        },
        {
          "key": "locomote",
          "weight": 2
        }
      ],
      "equipment": [
        {
          "key": "partner",
          "weight": 5
        },
        {
          "key": "cones",
          "weight": 4
        }
      ],
      "bodyRegions": [
        {
          "key": "eyes",
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
      "whyItWorks": "Mirror Bound-and-Cut Duel creates a high-quality stretch-shortening-cycle problem: the athlete must accept force, maintain alignment, and re-express force quickly enough to preserve elastic transfer. It is useful because the most sport-like option in the set; useful only when spacing, maturity, and stop command quality are excellent.",
      "whyItGoesHere": "Belongs in Output because impact level 4 is freshness-sensitive high-impact work. It should not be used as low-stress Prepare & Access work or as conditioning volume.",
      "commonMisuse": "Do not use this as a finisher, conditioning station, punishment, or warm-up filler. Do not progress height, distance, speed, cue uncertainty, and volume at the same time. Stop when contacts get loud, slow, flat, unstable, or misaligned.",
      "scalingGuidance": "Scale first by reducing amplitude, distance, height, contacts, approach speed, cue uncertainty, or surface demand. Progress only when every rep shows quiet contacts, stable trunk, aligned knee-foot path, and fast reset behavior.",
      "movementRequirements": {
        "primaryJointActions": [
          "ankle plantarflexion and dorsiflexion",
          "knee flexion-extension control",
          "hip flexion-extension",
          "trunk bracing",
          "acceleration step mechanics",
          "foot strike under center of mass",
          "visual cue processing",
          "braking-to-reacceleration timing"
        ],
        "primaryTissues": [
          "visual system",
          "vestibular orientation",
          "glutes",
          "hip flexors",
          "quadriceps",
          "patellar tendon",
          "calf complex",
          "Achilles tendon"
        ],
        "breathingDemand": "braced_exhale_or_relaxed_reset",
        "balanceDemand": "high_dynamic",
        "coordinationDemand": "very_high",
        "impactLevel": 4,
        "surfaceNeeds": "flat, non-slip, shock-absorbing surface with safe spacing",
        "readinessPrerequisites": [
          "Pain-free jumping, hopping, landing, and deceleration patterns.",
          "Can demonstrate a lower-level landing or rebound progression quietly and under control.",
          "Understands stop command and can reset between reps."
        ]
      },
      "coachingExecution": {
        "setup": [
          "Choose a safe lane, surface, target, cone, hurdle, box, partner, or implement setup that matches the card.",
          "Rehearse the lower-level pattern first and confirm the athlete can land quietly with trunk and knee-foot alignment.",
          "Give one clear task cue and one stop cue before the set begins."
        ],
        "executionSteps": [
          "Start tall and organized with eyes up and ribs stacked over pelvis.",
          "Create the required jump, hop, bound, drop, throw, or reactive action with high intent.",
          "Land through the whole foot or appropriate forefoot contact without collapsing, twisting, or reaching excessively.",
          "Stick, rebound, cut, sprint, or reset exactly as the drill requires.",
          "Stop the set when output, timing, landing, spacing, or decision quality is no longer repeatable."
        ],
        "coachingCues": [
          "Quiet contact.",
          "Push the ground away.",
          "Own the landing before the next answer.",
          "Fast intent, full reset.",
          "Knee tracks over mid-foot."
        ],
        "qualityGates": [
          "Every rep looks fast, quiet, and aligned.",
          "No visible knee collapse, trunk dumping, heel whip, toe drag, or uncontrolled rotation.",
          "The athlete can stop, stick, or redirect on command.",
          "The next rep is not slower or louder than the previous rep."
        ],
        "stopSigns": [
          "Pain, guarding, limping, or change in mechanics.",
          "Loud or flat landings, slow ground contacts, or repeated balance losses.",
          "Fatigue turns the drill into conditioning instead of Output quality.",
          "Unsafe spacing, surface, equipment, or partner communication."
        ],
        "commonFaults": [
          "Chasing distance or height before earning landing shape.",
          "Adding too many contacts because the exercise looks simple.",
          "Progressing cue complexity before the base contact is clean.",
          "Using the drill late in the session after fatigue has dulled contact quality."
        ]
      },
      "dosage": {
        "defaultDose": "3-5 x 3-5s bouts, 2-3min rest",
        "sets": "2-5",
        "repsOrContacts": "1-4 quality reps/contacts",
        "rest": "2-3 minutes",
        "contactCap": "6-18 total quality contacts",
        "tempo": "Explosive concentric or rebound; controlled stick/reset when prescribed.",
        "densityWarning": "Keep density low. This is high-impact Output work, not HIIT."
      },
      "scaling": {
        "regression": "Reduce height, distance, speed, contacts, reactive choices, implement load, or range. Use a stick before rebound, two-leg before single-leg, and predictable cue before live cue.",
        "progression": "Progress one variable at a time: amplitude, distance, speed, approach, contact count, hurdle/box height, cue uncertainty, or sport specificity.",
        "forYouth": "Use small amplitude, low contact counts, playful but controlled cues, and full coach supervision.",
        "forTeens": "Progress only when landing alignment and maturity are consistent; keep total contacts conservative.",
        "forAdults": "Use when training age, tissue tolerance, recovery, and session priority support high-impact Output work.",
        "forOlderAdults": "Usually regress to low-amplitude hops, line taps, step-offs, or non-impact power unless already conditioned for plyometrics.",
        "forDeconditioned": "Use preparatory landing, marching, low pogo, strength, and tissue capacity progressions first.",
        "forPregnancyPostpartum": "Omit or use non-impact alternatives unless cleared for impact and symptom-free with established plyometric tolerance."
      },
      "pairingLogic": {
        "pairsWellAfter": [
          "Dynamic warm-up",
          "Relevant mobility/access work",
          "Landing control or lower-level rebound prep",
          "Movement Intelligence drill for the same direction or cue"
        ],
        "pairsWellBefore": [
          "Acceleration, sprint, jump, or COD technical work",
          "Lower-body strength or power support work",
          "Sport-specific skill that benefits from fresh elastic output"
        ],
        "doNotUseWhen": [
          "Athlete has current pain, bone stress concern, tendon flare, or unresolved lower-limb injury.",
          "Athlete cannot demonstrate a lower-level progression safely.",
          "The surface, equipment, footwear, partner spacing, or supervision is unsafe.",
          "The athlete is already fatigued enough that contacts are slow, loud, flat, or poorly aligned."
        ],
        "goodForSessions": [
          "plyometric_output",
          "jump_power",
          "speed_agility_output",
          "reactive_cod_output"
        ]
      },
      "safety": {
        "riskLevel": 4,
        "impactLevel": 4,
        "readinessChecks": [
          "Pain-free lower-limb and trunk motion for the chosen pattern.",
          "Can land quietly with knee tracking over mid-foot.",
          "Can follow the stop command and reset without rushing.",
          "Has earned the lower-impact prerequisite progression."
        ],
        "contraindications": [
          "Active pain or medical restriction affecting foot, ankle, knee, hip, back, pelvis, or relevant upper-body tissues.",
          "Recent injury or return-to-play status without qualified clearance for impact.",
          "Known bone stress injury, acute tendon irritation, or uncontrolled landing mechanics.",
          "Unsafe environment, equipment, or partner behavior."
        ],
        "requiresSpotting": false,
        "requiresCoachSupervision": true,
        "commonSubstitutions": [
          "Snap Down to Stick",
          "Low-amplitude Pogo",
          "Skater Hop to Stick",
          "Countermovement Jump to Stick",
          "Medicine Ball Scoop Toss without Jump"
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
        "countsAsConditioning": false,
        "countsAsPrepareAndAccess": false
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
          "intensityCeiling": "very_high_quality_only",
          "impactLevel": 4
        }
      ],
      "mediaReferences": [
        "Internal demo recommended: front and side view to confirm contact, posture, projection, landing, and reset quality.",
        "Card v2 source basis: phase-first authoring with movementRequirements, coachingExecution, dosage, safety, regimen, and phaseProfile fields."
      ],
      "mediaInternalNotes": [
        "Film high-impact contacts when possible.",
        "Track total contacts and keep this out of fatigue circuits.",
        "Verify movementRequirements.impactLevel, safety.impactLevel, and phaseProfile.impactLevel match."
      ]
    }
  ]
}
```