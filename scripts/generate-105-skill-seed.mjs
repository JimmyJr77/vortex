/**
 * Generates backend/migrations/105_coaching_movement_intelligence_seed.sql
 * Run: node scripts/generate-105-skill-seed.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const MOVEMENTS = [
  { name: 'Hollow Body Hold / Hollow Rock Prep', slug: 'hollow-body-hold', desc: 'Skill-phase drill: Hollow Body Hold / Hollow Rock Prep.', family: 'Shape & position', subrole: 'shape_position_intelligence', slot: 'hollow_shape', focus: 'Hollow Body Hold', joints: ['spine_flexion', 'spine_extension'], body: 'core', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'brace', equip: 'mat', sets: 2, reps: null, work: 30, rest: 20, est: 35, unit: 'seconds', impact: 0, skill: 'EARLY_STAGE', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Arch Body Hold / Superman Shape', slug: 'arch-body-hold', desc: 'Skill-phase drill: Arch Body Hold / Superman Shape.', family: 'Shape & position', subrole: 'shape_position_intelligence', slot: 'arch_shape', focus: 'Arch Body Hold', joints: ['spine_flexion', 'spine_extension'], body: 'core', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'brace', equip: 'mat', sets: 2, reps: null, work: 30, rest: 20, est: 35, unit: 'seconds', impact: 0, skill: 'EARLY_STAGE', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Hollow-to-Arch Roll', slug: 'hollow-to-arch-roll', desc: 'Skill-phase drill: Hollow-to-Arch Roll.', family: 'Shape & position', subrole: 'shape_position_intelligence', slot: 'shape_transition', focus: 'Hollow-to-Arch Roll', joints: ['spine_flexion', 'spine_extension'], body: 'core', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'brace', equip: 'mat', sets: 1, reps: 8, work: null, rest: 20, est: 30, unit: 'reps', impact: 0, skill: 'EARLY_STAGE', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Tuck Hold / Tuck Rock', slug: 'tuck-hold-rock', desc: 'Skill-phase drill: Tuck Hold / Tuck Rock.', family: 'Shape & position', subrole: 'shape_position_intelligence', slot: 'tuck_shape', focus: 'Tuck Hold', joints: ['spine_flexion', 'spine_extension'], body: 'core', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'brace', equip: 'mat', sets: 2, reps: null, work: 30, rest: 20, est: 35, unit: 'seconds', impact: 0, skill: 'EARLY_STAGE', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Pike Fold-to-Tall Sit Drill', slug: 'pike-fold-tall-sit', desc: 'Skill-phase drill: Pike Fold-to-Tall Sit Drill.', family: 'Shape & position', subrole: 'shape_position_intelligence', slot: 'pike_shape', focus: 'Pike Fold-to-Tall Sit Drill', joints: ['spine_flexion', 'spine_extension'], body: 'core', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'brace', equip: 'mat', sets: 2, reps: null, work: 30, rest: 20, est: 35, unit: 'seconds', impact: 0, skill: 'EARLY_STAGE', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Straddle Sit Reach and Lift', slug: 'straddle-sit-reach-lift', desc: 'Skill-phase drill: Straddle Sit Reach and Lift.', family: 'Shape & position', subrole: 'shape_position_intelligence', slot: 'straddle_shape', focus: 'Straddle Sit Reach and Lift', joints: ['spine_flexion', 'spine_extension'], body: 'core', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'brace', equip: 'mat', sets: 2, reps: null, work: 30, rest: 20, est: 35, unit: 'seconds', impact: 0, skill: 'EARLY_STAGE', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Front Support Shape Hold', slug: 'front-support-shape-hold', desc: 'Skill-phase drill: Front Support Shape Hold.', family: 'Shape & position', subrole: 'shape_position_intelligence', slot: 'support_shape', focus: 'Front Support Shape Hold', joints: ['spine_flexion', 'spine_extension'], body: 'core', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'brace', equip: 'mat', sets: 2, reps: null, work: 30, rest: 20, est: 35, unit: 'seconds', impact: 0, skill: 'EARLY_STAGE', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Rear Support Shape Hold', slug: 'rear-support-shape-hold', desc: 'Skill-phase drill: Rear Support Shape Hold.', family: 'Shape & position', subrole: 'shape_position_intelligence', slot: 'support_shape', focus: 'Rear Support Shape Hold', joints: ['spine_flexion', 'spine_extension'], body: 'core', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'brace', equip: 'mat', sets: 2, reps: null, work: 30, rest: 20, est: 35, unit: 'seconds', impact: 0, skill: 'EARLY_STAGE', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Wall Body-Line Drill', slug: 'wall-body-line-drill', desc: 'Skill-phase drill: Wall Body-Line Drill.', family: 'Shape & position', subrole: 'shape_position_intelligence', slot: 'line_drill', focus: 'Wall Body-Line Drill', joints: ['spine_flexion', 'spine_extension'], body: 'core', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'brace', equip: 'mat', sets: 2, reps: null, work: 30, rest: 20, est: 35, unit: 'seconds', impact: 0, skill: 'EARLY_STAGE', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Stick-to-Shape Freeze Game', slug: 'stick-to-shape-freeze-game', desc: 'Skill-phase drill: Stick-to-Shape Freeze Game.', family: 'Shape & position', subrole: 'shape_position_intelligence', slot: 'shape_reaction', focus: 'Stick-to-Shape Freeze Game', joints: ['spine_flexion', 'spine_extension'], body: 'core', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'brace', equip: 'mat', sets: 1, reps: 8, work: null, rest: 20, est: 30, unit: 'reps', impact: 0, skill: 'EARLY_STAGE', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Log Roll / Pencil Roll', slug: 'log-roll', desc: 'Skill-phase drill: Log Roll / Pencil Roll.', family: 'Tumbling foundation', subrole: 'rotation_inversion_tumbling_foundations', slot: 'rolling_foundation', focus: 'Log Roll', joints: ['shoulder_flexion', 'spine_rotation'], body: 'full_body', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'brace', equip: 'mat', sets: 1, reps: 8, work: null, rest: 20, est: 30, unit: 'reps', impact: 1, skill: 'BEGINNER', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Egg Roll / Tuck Roll Side-to-Side', slug: 'egg-roll', desc: 'Skill-phase drill: Egg Roll / Tuck Roll Side-to-Side.', family: 'Tumbling foundation', subrole: 'rotation_inversion_tumbling_foundations', slot: 'rolling_foundation', focus: 'Egg Roll', joints: ['shoulder_flexion', 'spine_rotation'], body: 'full_body', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'brace', equip: 'mat', sets: 1, reps: 8, work: null, rest: 20, est: 30, unit: 'reps', impact: 1, skill: 'BEGINNER', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Rock-and-Roll to Stand', slug: 'rock-and-roll-to-stand', desc: 'Skill-phase drill: Rock-and-Roll to Stand.', family: 'Tumbling foundation', subrole: 'rotation_inversion_tumbling_foundations', slot: 'roll_to_stand', focus: 'Rock-and-Roll to Stand', joints: ['shoulder_flexion', 'spine_rotation'], body: 'full_body', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'brace', equip: 'mat', sets: 1, reps: 8, work: null, rest: 20, est: 30, unit: 'reps', impact: 1, skill: 'BEGINNER', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Forward Roll Progression', slug: 'forward-roll-progression', desc: 'Skill-phase drill: Forward Roll Progression.', family: 'Tumbling foundation', subrole: 'rotation_inversion_tumbling_foundations', slot: 'forward_roll', focus: 'Forward Roll Progression', joints: ['shoulder_flexion', 'spine_rotation'], body: 'full_body', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'rotate', equip: 'mat', sets: 1, reps: 8, work: null, rest: 20, est: 30, unit: 'reps', impact: 1, skill: 'BEGINNER', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Backward Roll Rocker / Backward Roll Progression', slug: 'backward-roll-progression', desc: 'Skill-phase drill: Backward Roll Rocker / Backward Roll Progression.', family: 'Tumbling foundation', subrole: 'rotation_inversion_tumbling_foundations', slot: 'backward_roll', focus: 'Backward Roll Rocker', joints: ['shoulder_flexion', 'spine_rotation'], body: 'full_body', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'rotate', equip: 'mat', sets: 1, reps: 8, work: null, rest: 20, est: 30, unit: 'reps', impact: 1, skill: 'BEGINNER', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Shoulder Roll / Safety Roll Progression', slug: 'shoulder-roll-progression', desc: 'Skill-phase drill: Shoulder Roll / Safety Roll Progression.', family: 'Tumbling foundation', subrole: 'rotation_inversion_tumbling_foundations', slot: 'shoulder_roll', focus: 'Shoulder Roll', joints: ['shoulder_flexion', 'spine_rotation'], body: 'full_body', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'rotate', equip: 'mat', sets: 1, reps: 8, work: null, rest: 20, est: 30, unit: 'reps', impact: 1, skill: 'BEGINNER', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Donkey Kick / Bunny Hop', slug: 'donkey-kick', desc: 'Skill-phase drill: Donkey Kick / Bunny Hop.', family: 'Tumbling foundation', subrole: 'rotation_inversion_tumbling_foundations', slot: 'hand_support_inversion', focus: 'Donkey Kick', joints: ['shoulder_flexion', 'spine_rotation'], body: 'full_body', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'brace', equip: 'mat', sets: 1, reps: 8, work: null, rest: 20, est: 30, unit: 'reps', impact: 1, skill: 'BEGINNER', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Wall Walk-Up to Handstand Line', slug: 'wall-walk-handstand-line', desc: 'Skill-phase drill: Wall Walk-Up to Handstand Line.', family: 'Tumbling foundation', subrole: 'rotation_inversion_tumbling_foundations', slot: 'handstand_line', focus: 'Wall Walk-Up to Handstand Line', joints: ['shoulder_flexion', 'spine_rotation'], body: 'full_body', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'brace', equip: 'mat', sets: 1, reps: 8, work: null, rest: 20, est: 30, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Handstand Kick-Up to Wall or Spot', slug: 'handstand-kick-up-wall', desc: 'Skill-phase drill: Handstand Kick-Up to Wall or Spot.', family: 'Tumbling foundation', subrole: 'rotation_inversion_tumbling_foundations', slot: 'handstand_entry', focus: 'Handstand Kick-Up to Wall or Spot', joints: ['shoulder_flexion', 'spine_rotation'], body: 'full_body', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'invert', equip: 'mat', sets: 1, reps: 8, work: null, rest: 20, est: 30, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Cartwheel Hand-Placement Line Drill', slug: 'cartwheel', desc: 'Skill-phase drill: Cartwheel Hand-Placement Line Drill.', family: 'Tumbling foundation', subrole: 'rotation_inversion_tumbling_foundations', slot: 'cartwheel_foundation', focus: 'Cartwheel Hand-Placement Line Drill', joints: ['shoulder_flexion', 'spine_rotation'], body: 'full_body', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'rotate', equip: 'mat', sets: 1, reps: 8, work: null, rest: 20, est: 30, unit: 'reps', impact: 1, skill: 'BEGINNER', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Cartwheel Step-Over / Cartwheel Over Panel Mat', slug: 'cartwheel-step-over', desc: 'Skill-phase drill: Cartwheel Step-Over / Cartwheel Over Panel Mat.', family: 'Tumbling foundation', subrole: 'rotation_inversion_tumbling_foundations', slot: 'cartwheel_foundation', focus: 'Cartwheel Step-Over', joints: ['shoulder_flexion', 'spine_rotation'], body: 'full_body', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'rotate', equip: 'mat', sets: 1, reps: 8, work: null, rest: 20, est: 30, unit: 'reps', impact: 1, skill: 'BEGINNER', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Cartwheel Finish Lunge Drill', slug: 'cartwheel-finish-lunge', desc: 'Skill-phase drill: Cartwheel Finish Lunge Drill.', family: 'Tumbling foundation', subrole: 'rotation_inversion_tumbling_foundations', slot: 'cartwheel_finish', focus: 'Cartwheel Finish Lunge Drill', joints: ['shoulder_flexion', 'spine_rotation'], body: 'full_body', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'rotate', equip: 'mat', sets: 1, reps: 8, work: null, rest: 20, est: 30, unit: 'reps', impact: 1, skill: 'BEGINNER', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Round-Off Snap-Down Shape Drill', slug: 'round-off', desc: 'Skill-phase drill: Round-Off Snap-Down Shape Drill.', family: 'Tumbling foundation', subrole: 'rotation_inversion_tumbling_foundations', slot: 'roundoff_foundation', focus: 'Round-Off Snap-Down Shape Drill', joints: ['shoulder_flexion', 'spine_rotation'], body: 'full_body', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'rotate', equip: 'mat', sets: 1, reps: 8, work: null, rest: 20, est: 30, unit: 'reps', impact: 1, skill: 'BEGINNER', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Hurdle Step to Lunge Shape', slug: 'hurdle-step-lunge', desc: 'Skill-phase drill: Hurdle Step to Lunge Shape.', family: 'Tumbling foundation', subrole: 'rotation_inversion_tumbling_foundations', slot: 'hurdle_entry', focus: 'Hurdle Step to Lunge Shape', joints: ['shoulder_flexion', 'spine_rotation'], body: 'full_body', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'brace', equip: 'mat', sets: 1, reps: 8, work: null, rest: 20, est: 30, unit: 'reps', impact: 1, skill: 'BEGINNER', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Wall Drill ISO — Split Shin Angle Hold', slug: 'wall-drill-split-shin-hold', desc: 'Skill-phase drill: Wall Drill ISO — Split Shin Angle Hold.', family: 'Sprint mechanics', subrole: 'locomotion_sprint_mechanics', slot: 'sprint_iso', focus: 'Wall Drill ISO — Split Shin Angle Hold', joints: ['multi_joint'], body: 'full_body', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'locomote', equip: 'none', sets: 2, reps: null, work: 30, rest: 20, est: 35, unit: 'seconds', impact: 0, skill: 'BEGINNER', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Wall Drill March', slug: 'wall-drill-march', desc: 'Skill-phase drill: Wall Drill March.', family: 'Sprint mechanics', subrole: 'locomotion_sprint_mechanics', slot: 'sprint_mechanics', focus: 'Wall Drill March', joints: ['multi_joint'], body: 'full_body', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'locomote', equip: 'none', sets: 1, reps: 8, work: null, rest: 20, est: 30, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Wall Drill Switch', slug: 'wall-drill-switch', desc: 'Skill-phase drill: Wall Drill Switch.', family: 'Sprint mechanics', subrole: 'locomotion_sprint_mechanics', slot: 'sprint_mechanics', focus: 'Wall Drill Switch', joints: ['multi_joint'], body: 'full_body', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'locomote', equip: 'none', sets: 1, reps: 8, work: null, rest: 20, est: 30, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'A-March — Technical Version', slug: 'a-march', desc: 'Skill-phase drill: A-March — Technical Version.', family: 'Sprint mechanics', subrole: 'locomotion_sprint_mechanics', slot: 'technical_march', focus: 'A-March — Technical Version', joints: ['multi_joint'], body: 'full_body', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'locomote', equip: 'none', sets: 1, reps: 8, work: null, rest: 20, est: 30, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'A-Skip', slug: 'a-skip', desc: 'Skill-phase drill: A-Skip.', family: 'Sprint mechanics', subrole: 'locomotion_sprint_mechanics', slot: 'sprint_rhythm', focus: 'A-Skip', joints: ['multi_joint'], body: 'full_body', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'locomote', equip: 'none', sets: 1, reps: 8, work: null, rest: 20, est: 30, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Ankling / Dribble March', slug: 'ankling-dribble-march', desc: 'Skill-phase drill: Ankling / Dribble March.', family: 'Sprint mechanics', subrole: 'locomotion_sprint_mechanics', slot: 'foot_strike_skill', focus: 'Ankling', joints: ['multi_joint'], body: 'full_body', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'locomote', equip: 'none', sets: 1, reps: 8, work: null, rest: 20, est: 30, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Straight-Leg Bound March / Straight-Leg Run Prep', slug: 'straight-leg-bound-march', desc: 'Skill-phase drill: Straight-Leg Bound March / Straight-Leg Run Prep.', family: 'Sprint mechanics', subrole: 'locomotion_sprint_mechanics', slot: 'frontside_mechanics', focus: 'Straight-Leg Bound March', joints: ['multi_joint'], body: 'full_body', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'locomote', equip: 'none', sets: 1, reps: 8, work: null, rest: 20, est: 30, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Falling Start Position Hold', slug: 'falling-start-hold', desc: 'Skill-phase drill: Falling Start Position Hold.', family: 'Sprint mechanics', subrole: 'locomotion_sprint_mechanics', slot: 'acceleration_position', focus: 'Falling Start Position Hold', joints: ['multi_joint'], body: 'full_body', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'locomote', equip: 'none', sets: 2, reps: null, work: 30, rest: 20, est: 35, unit: 'seconds', impact: 0, skill: 'BEGINNER', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Two-Point Start Walk-In', slug: 'two-point-start-walk-in', desc: 'Skill-phase drill: Two-Point Start Walk-In.', family: 'Sprint mechanics', subrole: 'locomotion_sprint_mechanics', slot: 'acceleration_entry', focus: 'Two-Point Start Walk-In', joints: ['multi_joint'], body: 'full_body', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'locomote', equip: 'none', sets: 1, reps: 8, work: null, rest: 20, est: 30, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Arm Action Drill — Seated or Standing', slug: 'arm-action-drill', desc: 'Skill-phase drill: Arm Action Drill — Seated or Standing.', family: 'Sprint mechanics', subrole: 'locomotion_sprint_mechanics', slot: 'arm_action', focus: 'Arm Action Drill — Seated or Standing', joints: ['multi_joint'], body: 'full_body', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'locomote', equip: 'none', sets: 1, reps: 8, work: null, rest: 20, est: 30, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Beam Walk / Line Walk', slug: 'beam-walk', desc: 'Skill-phase drill: Beam Walk / Line Walk.', family: 'Balance & rhythm', subrole: 'balance_coordination_rhythm', slot: 'narrow_base_balance', focus: 'Beam Walk', joints: ['multi_joint'], body: 'full_body', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'locomote', equip: 'none', sets: 1, reps: 8, work: null, rest: 20, est: 30, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Single-Leg Balance Reach Clock', slug: 'single-leg-balance-clock', desc: 'Skill-phase drill: Single-Leg Balance Reach Clock.', family: 'Balance & rhythm', subrole: 'balance_coordination_rhythm', slot: 'single_leg_balance_skill', focus: 'Single-Leg Balance Reach Clock', joints: ['multi_joint'], body: 'full_body', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'locomote', equip: 'none', sets: 1, reps: 8, work: null, rest: 20, est: 30, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Cross-Crawl March', slug: 'cross-crawl-march', desc: 'Skill-phase drill: Cross-Crawl March.', family: 'Balance & rhythm', subrole: 'balance_coordination_rhythm', slot: 'cross_body_coordination', focus: 'Cross-Crawl March', joints: ['multi_joint'], body: 'full_body', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'locomote', equip: 'none', sets: 1, reps: 8, work: null, rest: 20, est: 30, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Skipping Rhythm Drill', slug: 'skipping-rhythm-drill', desc: 'Skill-phase drill: Skipping Rhythm Drill.', family: 'Balance & rhythm', subrole: 'balance_coordination_rhythm', slot: 'rhythm_locomotion', focus: 'Skipping Rhythm Drill', joints: ['multi_joint'], body: 'full_body', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'locomote', equip: 'none', sets: 1, reps: 8, work: null, rest: 20, est: 30, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Carioca / Grapevine Walkthrough', slug: 'carioca-walkthrough', desc: 'Skill-phase drill: Carioca / Grapevine Walkthrough.', family: 'Balance & rhythm', subrole: 'balance_coordination_rhythm', slot: 'transverse_coordination', focus: 'Carioca', joints: ['multi_joint'], body: 'full_body', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'locomote', equip: 'none', sets: 1, reps: 8, work: null, rest: 20, est: 30, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Lateral Shuffle Mechanics Walkthrough', slug: 'lateral-shuffle-walkthrough', desc: 'Skill-phase drill: Lateral Shuffle Mechanics Walkthrough.', family: 'Balance & rhythm', subrole: 'balance_coordination_rhythm', slot: 'lateral_movement_skill', focus: 'Lateral Shuffle Mechanics Walkthrough', joints: ['multi_joint'], body: 'full_body', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'locomote', equip: 'none', sets: 1, reps: 8, work: null, rest: 20, est: 30, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Backpedal Mechanics Walkthrough', slug: 'backpedal-walkthrough', desc: 'Skill-phase drill: Backpedal Mechanics Walkthrough.', family: 'Balance & rhythm', subrole: 'balance_coordination_rhythm', slot: 'backward_locomotion', focus: 'Backpedal Mechanics Walkthrough', joints: ['multi_joint'], body: 'full_body', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'locomote', equip: 'none', sets: 1, reps: 8, work: null, rest: 20, est: 30, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Ladder Rhythm — In-In-Out-Out', slug: 'ladder-in-in-out-out', desc: 'Skill-phase drill: Ladder Rhythm — In-In-Out-Out.', family: 'Balance & rhythm', subrole: 'balance_coordination_rhythm', slot: 'footwork_rhythm', focus: 'Ladder Rhythm — In-In-Out-Out', joints: ['multi_joint'], body: 'full_body', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'locomote', equip: 'none', sets: 1, reps: 8, work: null, rest: 20, est: 30, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Ladder Rhythm — Ickey Shuffle Walkthrough', slug: 'ladder-ickey-shuffle', desc: 'Skill-phase drill: Ladder Rhythm — Ickey Shuffle Walkthrough.', family: 'Balance & rhythm', subrole: 'balance_coordination_rhythm', slot: 'footwork_rhythm', focus: 'Ladder Rhythm — Ickey Shuffle Walkthrough', joints: ['multi_joint'], body: 'full_body', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'locomote', equip: 'none', sets: 1, reps: 8, work: null, rest: 20, est: 30, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Low Hurdle Step-Over Series', slug: 'low-hurdle-step-over', desc: 'Skill-phase drill: Low Hurdle Step-Over Series.', family: 'Balance & rhythm', subrole: 'balance_coordination_rhythm', slot: 'step_over_coordination', focus: 'Low Hurdle Step-Over Series', joints: ['multi_joint'], body: 'full_body', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'locomote', equip: 'none', sets: 1, reps: 8, work: null, rest: 20, est: 30, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Mirror Shuffle Drill', slug: 'mirror-shuffle-drill', desc: 'Skill-phase drill: Mirror Shuffle Drill.', family: 'Reactive movement', subrole: 'perception_action_reactive_movement', slot: 'mirror_reaction', focus: 'Mirror Shuffle Drill', joints: ['multi_joint'], body: 'full_body', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'locomote', equip: 'none', sets: 1, reps: 8, work: null, rest: 20, est: 30, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Coach Point-and-Go Drill', slug: 'coach-point-and-go', desc: 'Skill-phase drill: Coach Point-and-Go Drill.', family: 'Reactive movement', subrole: 'perception_action_reactive_movement', slot: 'visual_reaction', focus: 'Coach Point-and-Go Drill', joints: ['multi_joint'], body: 'full_body', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'locomote', equip: 'none', sets: 1, reps: 8, work: null, rest: 20, est: 30, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Colored Cone Call-Out', slug: 'colored-cone-call-out', desc: 'Skill-phase drill: Colored Cone Call-Out.', family: 'Reactive movement', subrole: 'perception_action_reactive_movement', slot: 'visual_decision', focus: 'Colored Cone Call-Out', joints: ['multi_joint'], body: 'full_body', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'locomote', equip: 'none', sets: 1, reps: 8, work: null, rest: 20, est: 30, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Ball Drop Reaction Drill', slug: 'ball-drop-reaction', desc: 'Skill-phase drill: Ball Drop Reaction Drill.', family: 'Reactive movement', subrole: 'perception_action_reactive_movement', slot: 'object_reaction', focus: 'Ball Drop Reaction Drill', joints: ['multi_joint'], body: 'full_body', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'locomote', equip: 'none', sets: 1, reps: 8, work: null, rest: 20, est: 30, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Partner Tag / Shadow Tag Boundaries', slug: 'partner-shadow-tag', desc: 'Skill-phase drill: Partner Tag / Shadow Tag Boundaries.', family: 'Reactive movement', subrole: 'perception_action_reactive_movement', slot: 'movement_game', focus: 'Partner Tag', joints: ['multi_joint'], body: 'full_body', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'locomote', equip: 'none', sets: 1, reps: 8, work: null, rest: 20, est: 30, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
  { name: 'Gate Reaction Drill', slug: 'gate-reaction-drill', desc: 'Skill-phase drill: Gate Reaction Drill.', family: 'Reactive movement', subrole: 'perception_action_reactive_movement', slot: 'reactive_start', focus: 'Gate Reaction Drill', joints: ['multi_joint'], body: 'full_body', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'locomote', equip: 'none', sets: 1, reps: 8, work: null, rest: 20, est: 30, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 6, setup: ['Clear space and explain the skill goal'], steps: ['Set up in the starting position', 'Execute with control and coach feedback', 'Reset and repeat for quality'], cues: ['Move with control', 'Stay in the target shape or rhythm'], faults: ['Rushing reps', 'Losing posture or line'] },
]

const PRIMARY_PHASE = 'movement_intelligence'

const LEGACY_SLUGS = new Set([
  'hollow-body-hold',
  'cartwheel',
  'handstand-hold',
  'round-off',
])

const LEGACY_UPDATES = {
  'hollow-body-hold': MOVEMENTS.find((m) => m.slug === 'hollow-body-hold'),
  cartwheel: MOVEMENTS.find((m) => m.slug === 'cartwheel'),
  'round-off': MOVEMENTS.find((m) => m.slug === 'round-off'),
  'handstand-hold': {
    name: 'Handstand Hold',
    slug: 'handstand-hold',
    desc: 'Inverted balance and shoulder stability in a clean handstand line.',
    family: 'Tumbling foundation',
    subrole: 'rotation_inversion_tumbling_foundations',
    slot: 'handstand_line',
    focus: 'Handstand line and shoulder stability',
    joints: ['shoulder_flexion'],
    body: 'full_body',
    tenets: ['body_control', 'coordination'],
    methods: ['core_body_control', 'neural'],
    phys: ['control_stability', 'perception_action_skill'],
    pattern: 'invert',
    equip: 'none',
    sets: 2,
    reps: null,
    work: 30,
    rest: 20,
    est: 35,
    unit: 'seconds',
    impact: 1,
    skill: 'BEGINNER',
    ageMin: 6,
    setup: ['Wall or spotter available'],
    steps: ['Kick or walk to line', 'Hold stacked position'],
    cues: ['Push the floor away', 'Ribs in'],
    faults: ['Banana back', 'Collapsed shoulders'],
  },
}


const SUBROLE_WHY = {
  shape_position_intelligence:
    'Belongs in Shape & Position Intelligence — teaches body lines, shapes, and trunk control before dynamic skill.',
  rotation_inversion_tumbling_foundations:
    'Belongs in Rotation / Inversion / Tumbling Foundations — builds rolling, inversion, and tumbling prerequisites while fresh.',
  locomotion_sprint_mechanics:
    'Belongs in Locomotion & Sprint Mechanics — develops posture, rhythm, and acceleration shapes before speed output.',
  balance_coordination_rhythm:
    'Belongs in Balance / Coordination / Rhythm — develops timing, foot placement, and low-fatigue coordination.',
  perception_action_reactive_movement:
    'Belongs in Perception-Action / Reactive Movement — couples decision-making with movement under external cues.',
}


function sqlStr(s) {
  return `'${String(s).replace(/'/g, "''")}'`
}

function jsonReq(m) {
  const obj = {
    primary_joint_actions: m.joints,
    primary_tissues: m.tissues || [],
    breathing_demand: m.unit === 'breaths' ? 'diaphragmatic' : 'nasal',
    balance_demand: m.tenets.includes('balance') ? 'single_leg' : 'stable',
    impact_level: m.impact,
  }
  return `'${JSON.stringify(obj).replace(/'/g, "''")}'::jsonb`
}

function jsonExec(m) {
  const obj = {
    movement_description: m.desc,
    setup: m.setup,
    execution_steps: m.steps,
    coach_cues: m.cues,
    common_faults: m.faults,
  }
  return `'${JSON.stringify(obj).replace(/'/g, "''")}'::jsonb`
}

const cohortKeys = ['youth_beginner', 'youth_intermediate', 'teen', 'adult_beginner', 'adult_advanced', 'older_adult']

const TO_INSERT = MOVEMENTS.filter((m) => !LEGACY_SLUGS.has(m.slug))
const ALL = MOVEMENTS

function slugList(arr) {
  return arr.map((m) => sqlStr(m.slug)).join(', ')
}

function coachLangText(m) {
  return `Use in Movement Intelligence (${m.subrole.replace(/_/g, ' ')}) while the athlete is fresh.`
}

function athleteLangText(m) {
  return `Move with control; this builds ${m.body.replace(/_/g, ' ')} skill for training.`
}

let sql = `-- Seed 50 Movement Intelligence movements (card v2 + subrole hierarchy).
-- IDEMPOTENT. Generated by scripts/generate-105-skill-seed.mjs

-- 1) Insert new exercises (legacy slugs updated separately)
INSERT INTO coaching.exercise (
  facility_id, name, slug, description, sport_id, skill_level, age_min,
  default_sets, default_reps, default_work_seconds, default_rest_seconds, est_seconds_per_set,
  is_published, visibility,
  card_summary, coach_language, athlete_language,
  movement_family, primary_phase_key, phase_subrole, primary_order_slot,
  movement_requirements, coaching_execution
)
SELECT
  f.id,
  d.name, d.slug, d.description,
  (SELECT id FROM coaching.sport WHERE key = 'fitness'),
  d.skill::public.skill_level,
  d.age_min,
  d.sets, d.reps, d.work, d.rest, d.est,
  TRUE, 'facility',
  d.summary, d.coach_lang, d.athlete_lang,
  d.family, '${PRIMARY_PHASE}', d.subrole, d.slot,
  d.req::jsonb, d.exec::jsonb
FROM (VALUES
`

sql += TO_INSERT.map((m) => {
  const summary = `${m.focus}.`
  const reps = m.reps ?? null
  const work = m.work ?? null
  return `  (${sqlStr(m.name)}, ${sqlStr(m.slug)}, ${sqlStr(m.desc)}, ${sqlStr(m.skill)}, ${m.ageMin}, ${m.sets}, ${reps ?? 'NULL'}, ${work ?? 'NULL'}, ${m.rest}, ${m.est}, ${sqlStr(summary)}, ${sqlStr(coachLangText(m))}, ${sqlStr(athleteLangText(m))}, ${sqlStr(m.family)}, ${sqlStr(m.subrole)}, ${sqlStr(m.slot)}, ${jsonReq(m).replace('::jsonb', '')}::jsonb, ${jsonExec(m).replace('::jsonb', '')}::jsonb)`
}).join(',\n')

sql += `
) AS d(name, slug, description, skill, age_min, sets, reps, work, rest, est, summary, coach_lang, athlete_lang, family, subrole, slot, req, exec)
CROSS JOIN public.facility f
ON CONFLICT (facility_id, slug) DO NOTHING;

`

// Tags
sql += `-- 2) Taxonomy tags\n`
for (const facet of ['tenet', 'methodology', 'physiology', 'pattern', 'equipment', 'body_region']) {
  const tableMap = { tenet: 'tenet', methodology: 'methodology', physiology: 'physiological_emphasis', pattern: 'movement_pattern', equipment: 'equipment', body_region: 'body_region' }
  const keyField = facet === 'tenet' ? 'tenets' : facet === 'methodology' ? 'methods' : facet === 'physiology' ? 'phys' : facet === 'pattern' ? 'pattern' : facet === 'equipment' ? 'equip' : 'body'
  sql += `INSERT INTO coaching.exercise_tag (exercise_id, facet_type, facet_id, weight)\nSELECT e.id, '${facet}', f.id, 4\nFROM (VALUES\n`
  const rows = []
  for (const m of ALL) {
    if (facet === 'pattern' || facet === 'equipment' || facet === 'body_region') {
      const val = m[keyField]
      rows.push(`  (${sqlStr(m.slug)}, ${sqlStr(val)})`)
    } else {
      for (const k of m[keyField] || []) {
        rows.push(`  (${sqlStr(m.slug)}, ${sqlStr(k)})`)
      }
    }
  }
  sql += rows.join(',\n')
  sql += `\n) AS v(slug, fkey)\nJOIN coaching.exercise e ON e.slug = v.slug\nJOIN coaching.${tableMap[facet]} f ON f.key = v.fkey\nON CONFLICT (exercise_id, facet_type, facet_id) DO NOTHING;\n\n`
}

// Phase profiles (all 50; a-march also gets prepare profile unchanged — skill profile only here)
sql += `-- 3) Movement Intelligence phase profiles\nINSERT INTO coaching.exercise_phase_profile (
  exercise_id, phase_id, fit_weight, role, order_slot, order_index,
  freshness_required, fatigue_sensitivity, fatigue_cost, technical_complexity, impact_level, intensity_ceiling
)
SELECT e.id, sp.id, 5, 'primary', m.slot, pos.order_index,
  FALSE, 1, 1, 2, m.impact, 'low'
FROM (VALUES\n`
sql += MOVEMENTS.map((m) => {
  const impact = m.impact ?? 0
  return `  (${sqlStr(m.slug)}, ${sqlStr(m.slot)}, ${impact})`
}).join(',\n')
sql += `
) AS m(slug, slot, impact)
JOIN coaching.exercise e ON e.slug = m.slug
JOIN coaching.session_phase sp ON sp.key = 'movement_intelligence'
JOIN coaching.phase_order_slot pos ON pos.key = m.slot
ON CONFLICT (exercise_id, phase_id) DO UPDATE SET
  role = EXCLUDED.role, order_slot = EXCLUDED.order_slot, fit_weight = EXCLUDED.fit_weight,
  impact_level = EXCLUDED.impact_level, intensity_ceiling = EXCLUDED.intensity_ceiling;

`

// Dosage
sql += `-- 4) Dosage profiles\nINSERT INTO coaching.exercise_dosage_profile (
  exercise_id, profile_name, is_default, volume_unit, default_sets, default_reps,
  default_work_seconds, default_rest_seconds, est_seconds_per_set
)
SELECT e.id, 'Default', TRUE, m.unit, m.sets, m.reps, m.work, m.rest, m.est
FROM (VALUES\n`
sql += MOVEMENTS.map((m) => `  (${sqlStr(m.slug)}, ${sqlStr(m.unit)}, ${m.sets}, ${m.reps ?? 'NULL'}, ${m.work ?? 'NULL'}, ${m.rest}, ${m.est})`).join(',\n')
sql += `
) AS m(slug, unit, sets, reps, work, rest, est)
JOIN coaching.exercise e ON e.slug = m.slug
WHERE NOT EXISTS (SELECT 1 FROM coaching.exercise_dosage_profile d WHERE d.exercise_id = e.id AND d.profile_name = 'Default');

`

// Safety
sql += `-- 5) Safety profiles\nINSERT INTO coaching.exercise_safety_profile (
  exercise_id, risk_level, impact_level, requires_coach_supervision, readiness_checks
)
SELECT e.id, 1, COALESCE(m.impact, 0), 'none', ARRAY['No acute pain', 'Can maintain posture']
FROM (VALUES\n`
sql += MOVEMENTS.map((m) => `  (${sqlStr(m.slug)}, ${m.impact ?? 0})`).join(',\n')
sql += `
) AS m(slug, impact)
JOIN coaching.exercise e ON e.slug = m.slug
WHERE NOT EXISTS (SELECT 1 FROM coaching.exercise_safety_profile s WHERE s.exercise_id = e.id);

`

// Regimen
sql += `-- 6) Regimen rules (skill dose)\nINSERT INTO coaching.exercise_regimen_rule (
  exercise_id, can_be_daily, weekly_max_frequency, minimum_hours_between_hard_exposures
)
SELECT e.id, TRUE, 7, 0
FROM coaching.exercise e
WHERE e.slug IN (${slugList(ALL)})
  AND NOT EXISTS (SELECT 1 FROM coaching.exercise_regimen_rule r WHERE r.exercise_id = e.id);

UPDATE coaching.exercise_regimen_rule r SET can_be_daily = TRUE, weekly_max_frequency = 7, minimum_hours_between_hard_exposures = 0
FROM coaching.exercise e
WHERE r.exercise_id = e.id AND e.slug IN (${slugList(ALL)});

`

// Scaling
sql += `-- 7) Scaling cohort rows (6 required cohorts)\n`
for (const ck of cohortKeys) {
  sql += `INSERT INTO coaching.exercise_scaling_profile (exercise_id, cohort_key, label, scale_direction, load_guidance, complexity_guidance, coach_notes)
SELECT e.id, '${ck}', '${ck.replace(/_/g, ' ')}', 'baseline', 'Reduce reps or duration for younger or less trained athletes.', 'Use simpler variation if form breaks down.', 'Skill dose only — prioritize quality and freshness.'
FROM coaching.exercise e
WHERE e.slug IN (${slugList(ALL)})
  AND NOT EXISTS (SELECT 1 FROM coaching.exercise_scaling_profile sp WHERE sp.exercise_id = e.id AND sp.cohort_key = '${ck}');

`
}

// Education
sql += `-- 8) Why-layer education\nINSERT INTO coaching.education_content (
  entity_type, entity_key, entity_id, title, short_summary, what_it_is, why_it_matters,
  why_it_goes_here, programming_guidance, common_misuse, scaling_guidance
)
SELECT
  'exercise', e.slug, e.id, e.name,
  e.card_summary,
  COALESCE(e.description, e.name),
  'Develops movement skill and body intelligence while the athlete is fresh.',
  CASE e.phase_subrole
    WHEN 'shape_position_intelligence' THEN ${sqlStr(SUBROLE_WHY.shape_position_intelligence)}
    WHEN 'rotation_inversion_tumbling_foundations' THEN ${sqlStr(SUBROLE_WHY.rotation_inversion_tumbling_foundations)}
    WHEN 'locomotion_sprint_mechanics' THEN ${sqlStr(SUBROLE_WHY.locomotion_sprint_mechanics)}
    WHEN 'balance_coordination_rhythm' THEN ${sqlStr(SUBROLE_WHY.balance_coordination_rhythm)}
    WHEN 'perception_action_reactive_movement' THEN ${sqlStr(SUBROLE_WHY.perception_action_reactive_movement)}
    ELSE 'Place in Movement Intelligence while fresh.'
  END,
  'Use in Skill phase after Prepare; scale volume by age and attention. Stop before fatigue.',
  'Do not use as conditioning or max-effort output work in the skill block.',
  'Reduce reps, duration, or range for youth and beginners.'
FROM coaching.exercise e
WHERE e.slug IN (${slugList(ALL)})
ON CONFLICT (entity_type, entity_key, entity_id) DO UPDATE SET
  title = EXCLUDED.title,
  short_summary = EXCLUDED.short_summary,
  what_it_is = EXCLUDED.what_it_is,
  why_it_goes_here = EXCLUDED.why_it_goes_here,
  programming_guidance = EXCLUDED.programming_guidance,
  common_misuse = EXCLUDED.common_misuse,
  scaling_guidance = EXCLUDED.scaling_guidance,
  updated_at = now();

`

// Legacy updates
sql += `-- 9) Legacy library slugs → Movement Intelligence (primary phase)\n`
for (const [slug, m] of Object.entries(LEGACY_UPDATES)) {
  const summary = `${m.focus}.`
  sql += `UPDATE coaching.exercise SET
  name = ${sqlStr(m.name)},
  description = ${sqlStr(m.desc)},
  card_summary = ${sqlStr(summary)},
  coach_language = ${sqlStr(coachLangText(m))},
  athlete_language = ${sqlStr(athleteLangText(m))},
  movement_family = ${sqlStr(m.family)},
  primary_phase_key = '${PRIMARY_PHASE}',
  phase_subrole = ${sqlStr(m.subrole)},
  primary_order_slot = ${sqlStr(m.slot)},
  movement_requirements = ${jsonReq(m)},
  coaching_execution = ${jsonExec(m)},
  updated_at = now()
WHERE slug = '${slug}';

`
}

// a-march note: primary_phase_key stays prepare_and_access from migration 097; skill profile already inserted in section 3.
sql += `-- 10) a-march dual profile stub: prepare_and_access primary unchanged; skill profile on technical_march is in section 3.
-- (No UPDATE to primary_phase_key for a-march.)

`

const outPath = path.join(__dirname, '../backend/migrations/105_coaching_movement_intelligence_seed.sql')
fs.writeFileSync(outPath, sql)
console.log('Wrote', outPath, '—', MOVEMENTS.length, 'movements')
