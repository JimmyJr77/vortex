/**
 * Generates backend/migrations/097_coaching_prepare_access_seed.sql
 * Run: node scripts/generate-097-prepare-seed.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {Array<{
 *  name: string, slug: string, desc: string, family: string,
 *  subrole: string, slot: string, focus: string,
 *  joints: string[], tissues?: string[], body: string,
 *  tenets: string[], methods: string[], phys: string[], pattern: string, equip: string,
 *  sets: number, reps?: number|null, work?: number|null, rest: number, est: number, unit: string,
 *  impact: number, skill: string, ageMin: number,
 *  setup: string[], steps: string[], cues: string[], faults: string[]
 * }>} */
const MOVEMENTS = [
  { name: '90/90 Breathing with Reach', slug: '9090-breathing-with-reach', desc: 'Supine breathing drill linking ribcage, pelvis, and diaphragm.', family: 'Breathing reset', subrole: 'mobilize', slot: 'breathing_reset', focus: 'Ribcage, pelvis, diaphragm, trunk stack', joints: ['spine_rotation', 'shoulder_flexion'], tissues: ['diaphragm', 'intercostals'], body: 'spine', tenets: ['body_control', 'flexibility'], methods: ['mobility_flexibility', 'core_body_control'], phys: ['control_stability'], pattern: 'brace', equip: 'mat', sets: 2, work: 45, rest: 15, est: 50, unit: 'breaths', impact: 0, skill: 'EARLY_STAGE', ageMin: 6, setup: ['Lie on back in 90/90 hip/knee position', 'Reach one arm overhead'], steps: ['Inhale into back and sides of ribcage', 'Exhale fully while reaching longer'], cues: ['Ribs down, pelvis neutral', 'Long exhale'], faults: ['Holding breath', 'Arching lower back'] },
  { name: 'Crocodile Breathing', slug: 'crocodile-breathing', desc: 'Prone breathing for posterior expansion and down-regulation.', family: 'Breathing reset', subrole: 'mobilize', slot: 'breathing_reset', focus: 'Diaphragm, posterior expansion, relaxation', joints: ['spine_extension'], tissues: ['diaphragm'], body: 'spine', tenets: ['body_control', 'flexibility'], methods: ['mobility_flexibility'], phys: ['control_stability'], pattern: 'brace', equip: 'mat', sets: 2, work: 60, rest: 15, est: 65, unit: 'breaths', impact: 0, skill: 'EARLY_STAGE', ageMin: 6, setup: ['Lie prone, forehead on stacked hands'], steps: ['Breathe into belly pressing floor', 'Slow nasal inhale, long exhale'], cues: ['Relax jaw and shoulders'], faults: ['Shrugging shoulders on inhale'] },
  { name: 'Full-Body Joint CARs Flow', slug: 'full-body-joint-cars-flow', desc: 'Controlled articular rotations through major joints.', family: 'Joint scan', subrole: 'mobilize', slot: 'joint_scan', focus: 'Joint scan, active range, readiness', joints: ['multi_joint'], tissues: ['synovial'], body: 'full_body', tenets: ['flexibility', 'coordination'], methods: ['mobility_flexibility', 'neural'], phys: ['control_stability', 'perception_action_skill'], pattern: 'locomote', equip: 'none', sets: 1, reps: 1, rest: 0, est: 180, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 8, setup: ['Stand tall, soft knees'], steps: ['Neck CARs', 'Shoulder CARs', 'Hip CARs', 'Ankle CARs — slow and controlled'], cues: ['No compensation from other joints'], faults: ['Rushing', 'Using momentum'] },
  { name: 'Neck CARs', slug: 'neck-cars', desc: 'Controlled cervical rotations and nods.', family: 'Joint scan', subrole: 'mobilize', slot: 'joint_scan', focus: 'Cervical control, visual orientation', joints: ['cervical_rotation', 'cervical_flexion'], body: 'spine', tenets: ['body_control', 'coordination'], methods: ['mobility_flexibility'], phys: ['control_stability'], pattern: 'rotate', equip: 'none', sets: 2, reps: 3, rest: 10, est: 30, unit: 'reps', impact: 0, skill: 'EARLY_STAGE', ageMin: 6, setup: ['Seated or standing tall'], steps: ['Slow chin tuck', 'Draw circles with nose'], cues: ['Small range, no pain'], faults: ['Fast jerky motion'] },
  { name: 'Cat-Cow', slug: 'cat-cow', desc: 'Quadruped spinal flexion and extension.', family: 'Spinal mobility', subrole: 'mobilize', slot: 'spinal_mobility', focus: 'Spinal flexion/extension, pelvic awareness', joints: ['spine_flexion', 'spine_extension'], body: 'spine', tenets: ['flexibility', 'body_control'], methods: ['mobility_flexibility'], phys: ['control_stability'], pattern: 'brace', equip: 'mat', sets: 2, reps: 8, rest: 15, est: 35, unit: 'reps', impact: 0, skill: 'EARLY_STAGE', ageMin: 4, setup: ['Quadruped, wrists under shoulders'], steps: ['Inhale: drop belly, lift chest (cow)', 'Exhale: round spine (cat)'], cues: ['Move one segment at a time'], faults: ['Only moving at lumbar spine'] },
  { name: 'Quadruped Spinal Circles', slug: 'quadruped-spinal-circles', desc: 'Segmental spine circles in quadruped.', family: 'Spinal mobility', subrole: 'mobilize', slot: 'spinal_mobility', focus: 'Segmental spine, lateral flexion, control', joints: ['spine_rotation', 'spine_lateral_flexion'], body: 'spine', tenets: ['flexibility', 'coordination'], methods: ['mobility_flexibility', 'core_body_control'], phys: ['control_stability'], pattern: 'brace', equip: 'mat', sets: 2, reps: 4, rest: 15, est: 40, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 8, setup: ['Quadruped neutral spine'], steps: ['Draw small circles with spine', 'Reverse direction each rep'], cues: ['Keep shoulders quiet'], faults: ['Shifting weight side to side excessively'] },
  { name: 'Quadruped Thread the Needle', slug: 'quadruped-thread-the-needle', desc: 'Quadruped thoracic rotation reach-under.', family: 'Thoracic rotation', subrole: 'mobilize', slot: 'thoracic_rotation', focus: 'Thoracic rotation, scapular freedom', joints: ['thoracic_rotation', 'shoulder_flexion'], body: 'spine', tenets: ['flexibility', 'body_control'], methods: ['mobility_flexibility'], phys: ['control_stability'], pattern: 'rotate', equip: 'mat', sets: 2, reps: 6, rest: 15, est: 35, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 6, setup: ['Quadruped, one hand behind head'], steps: ['Rotate elbow toward opposite wrist', 'Follow with eyes'], cues: ['Rotate through mid-back'], faults: ['Dumping into lumbar spine'] },
  { name: 'Side-Lying Open Book', slug: 'side-lying-open-book', desc: 'Side-lying thoracic rotation with knee anchor.', family: 'Thoracic rotation', subrole: 'mobilize', slot: 'thoracic_rotation', focus: 'Thoracic rotation, rib mobility', joints: ['thoracic_rotation'], body: 'spine', tenets: ['flexibility'], methods: ['mobility_flexibility'], phys: ['control_stability'], pattern: 'rotate', equip: 'mat', sets: 2, reps: 6, rest: 15, est: 35, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 6, setup: ['Side-lying, knees bent 90°, arms extended'], steps: ['Open top arm like a book', 'Follow hand with eyes'], cues: ['Keep knees stacked'], faults: ['Rolling hips backward'] },
  { name: 'Inchworm Walkout', slug: 'inchworm-walkout', desc: 'Standing to plank walkout and return.', family: 'Full-body flow', subrole: 'integrate', slot: 'crawl_pattern_prep', focus: 'Hamstrings, shoulders, trunk, plank access', joints: ['shoulder_flexion', 'hip_hinge'], body: 'full_body', tenets: ['flexibility', 'coordination'], methods: ['mobility_flexibility', 'core_body_control'], phys: ['control_stability', 'force_tissue_capacity'], pattern: 'locomote', equip: 'none', sets: 2, reps: 4, rest: 20, est: 40, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 6, setup: ['Stand feet hip-width'], steps: ['Hinge and place hands on floor', 'Walk out to plank', 'Walk feet to hands and stand'], cues: ['Soft knees if hamstrings tight'], faults: ['Sagging hips in plank'] },
  { name: 'Wrist Rockers — Palms Down', slug: 'wrist-rockers-palms-down', desc: 'Wrist extension rocking for hand support prep.', family: 'Wrist prep', subrole: 'mobilize', slot: 'wrist_prep', focus: 'Wrist extension for tumbling, crawling, pressing', joints: ['wrist_extension'], body: 'wrist', tenets: ['flexibility', 'body_control'], methods: ['mobility_flexibility'], phys: ['control_stability'], pattern: 'brace', equip: 'mat', sets: 2, reps: 8, rest: 10, est: 25, unit: 'reps', impact: 0, skill: 'EARLY_STAGE', ageMin: 6, setup: ['Quadruped, fingers forward'], steps: ['Rock forward over wrists', 'Keep elbows straight'], cues: ['Even pressure through palm'], faults: ['Collapsing on pinky side'] },
  { name: 'Wrist Rockers — Palms Up', slug: 'wrist-rockers-palms-up', desc: 'Wrist flexor-biased rocking.', family: 'Wrist prep', subrole: 'mobilize', slot: 'wrist_prep', focus: 'Wrist flexors, forearms, hand support', joints: ['wrist_flexion'], body: 'wrist', tenets: ['flexibility'], methods: ['mobility_flexibility'], phys: ['control_stability'], pattern: 'brace', equip: 'mat', sets: 2, reps: 8, rest: 10, est: 25, unit: 'reps', impact: 0, skill: 'EARLY_STAGE', ageMin: 6, setup: ['Quadruped, fingers toward knees'], steps: ['Rock back gently over wrists'], cues: ['Stop before sharp pain'], faults: ['Forcing range'] },
  { name: 'Finger Pulses', slug: 'finger-pulses', desc: 'Hand intrinsic activation with palm lifts.', family: 'Wrist prep', subrole: 'mobilize', slot: 'wrist_prep', focus: 'Hand intrinsic strength, wrist prep (also activates intrinsics)', joints: ['wrist_extension'], body: 'wrist', tenets: ['strength', 'body_control'], methods: ['isometrics', 'core_body_control'], phys: ['control_stability'], pattern: 'brace', equip: 'mat', sets: 2, reps: 10, rest: 10, est: 20, unit: 'reps', impact: 0, skill: 'EARLY_STAGE', ageMin: 6, setup: ['Quadruped, flat palms'], steps: ['Lift fingers and palm while keeping contact'], cues: ['Spread fingers wide'], faults: ['Lifting whole hand off floor'] },
  { name: 'Scapular Push-Up', slug: 'scapular-push-up', desc: 'Protraction/retraction in plank or quadruped.', family: 'Scapular activation', subrole: 'activate', slot: 'scapular_activation', focus: 'Serratus anterior, scapular protraction', joints: ['scapular_protraction'], body: 'shoulder', tenets: ['body_control', 'strength'], methods: ['core_body_control', 'isometrics'], phys: ['control_stability'], pattern: 'push', equip: 'none', sets: 2, reps: 10, rest: 20, est: 30, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 8, setup: ['Plank or quadruped'], steps: ['Push floor away (protract)', 'Allow shoulder blades to come together'], cues: ['Elbows stay straight'], faults: ['Bending elbows'] },
  { name: 'Quadruped Shoulder Circles', slug: 'quadruped-shoulder-circles', desc: 'Shoulder CARs in quadruped.', family: 'Shoulder mobility', subrole: 'mobilize', slot: 'shoulder_mobility', focus: 'Shoulder CARs, scapular control', joints: ['shoulder_rotation'], body: 'shoulder', tenets: ['flexibility', 'coordination'], methods: ['mobility_flexibility'], phys: ['control_stability'], pattern: 'rotate', equip: 'mat', sets: 2, reps: 5, rest: 10, est: 30, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 8, setup: ['Quadruped, one arm extended'], steps: ['Draw slow circles with arm'], cues: ['Keep trunk still'], faults: ['Rotating through spine'] },
  { name: 'Wall Slides with Lift-Off', slug: 'wall-slides-with-lift-off', desc: 'Wall slide with optional lift-off at top.', family: 'Shoulder mobility', subrole: 'mobilize', slot: 'shoulder_mobility', focus: 'Shoulder flexion, thoracic extension, scap control', joints: ['shoulder_flexion', 'scapular_upward_rotation'], body: 'shoulder', tenets: ['flexibility', 'body_control'], methods: ['mobility_flexibility'], phys: ['control_stability'], pattern: 'push', equip: 'none', sets: 2, reps: 8, rest: 15, est: 35, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 8, setup: ['Back to wall, arms in W'], steps: ['Slide arms up wall', 'Optional small lift-off at top'], cues: ['Ribs stay down'], faults: ['Arching lower back'] },
  { name: 'Band External Rotation', slug: 'band-external-rotation', desc: 'No-money drill for rotator cuff.', family: 'Rotator cuff activation', subrole: 'activate', slot: 'rotator_cuff_activation', focus: 'Rotator cuff, shoulder centration', joints: ['shoulder_external_rotation'], body: 'shoulder', tenets: ['strength', 'body_control'], methods: ['resistance_calisthenics', 'isometrics'], phys: ['control_stability'], pattern: 'pull', equip: 'bands', sets: 2, reps: 12, rest: 20, est: 30, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 10, setup: ['Band at elbow height, elbows at sides'], steps: ['Rotate hands outward', 'Control return'], cues: ['Elbows pinned to ribs'], faults: ['Shrugging shoulders'] },
  { name: 'Arm Circles', slug: 'arm-circles', desc: 'Standing shoulder circles for range prep.', family: 'Shoulder mobility', subrole: 'mobilize', slot: 'shoulder_mobility', focus: 'Shoulder range, neural prep', joints: ['shoulder_flexion', 'shoulder_abduction'], body: 'shoulder', tenets: ['flexibility', 'coordination'], methods: ['mobility_flexibility', 'neural'], phys: ['control_stability'], pattern: 'rotate', equip: 'none', sets: 2, reps: 10, rest: 10, est: 25, unit: 'reps', impact: 0, skill: 'EARLY_STAGE', ageMin: 4, setup: ['Stand tall, arms out'], steps: ['Small to large circles', 'Reverse direction'], cues: ['Relax neck'], faults: ['Over-striding with trunk lean'] },
  { name: 'Bear Crawl Rock-Back', slug: 'bear-crawl-rock-back', desc: 'Bear position rock-back for wrist and hip access.', family: 'Crawl pattern', subrole: 'integrate', slot: 'crawl_pattern_prep', focus: 'Wrists, shoulders, hips, trunk', joints: ['hip_flexion', 'wrist_extension'], body: 'full_body', tenets: ['coordination', 'body_control'], methods: ['mobility_flexibility', 'core_body_control'], phys: ['control_stability', 'perception_action_skill'], pattern: 'locomote', equip: 'mat', sets: 2, reps: 6, rest: 20, est: 35, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 6, setup: ['Quadruped, knees slightly off floor or on floor'], steps: ['Rock hips back toward heels', 'Return to start'], cues: ['Press through palms'], faults: ['Collapsing wrists'] },
  { name: 'Down Dog to Plank Wave', slug: 'down-dog-to-plank-wave', desc: 'Alternating down dog and plank.', family: 'Shoulder integration', subrole: 'integrate', slot: 'crawl_pattern_prep', focus: 'Shoulder flexion, hamstrings, trunk line', joints: ['shoulder_flexion', 'hip_hinge'], body: 'full_body', tenets: ['flexibility', 'body_control'], methods: ['mobility_flexibility', 'core_body_control'], phys: ['control_stability'], pattern: 'locomote', equip: 'mat', sets: 2, reps: 5, rest: 20, est: 40, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 8, setup: ['Down dog position'], steps: ['Shift forward to plank', 'Push back to down dog'], cues: ['Long spine both positions'], faults: ['Sagging in plank'] },
  { name: 'Knee-to-Wall Ankle Rockers', slug: 'knee-to-wall-ankle-rockers', desc: 'Wall-assisted dorsiflexion rocks.', family: 'Ankle mobility', subrole: 'mobilize', slot: 'ankle_mobility', focus: 'Dorsiflexion, squat/landing access', joints: ['ankle_dorsiflexion'], body: 'ankle', tenets: ['flexibility', 'body_control'], methods: ['mobility_flexibility'], phys: ['control_stability'], pattern: 'squat', equip: 'none', sets: 2, reps: 10, rest: 15, est: 30, unit: 'reps', impact: 0, skill: 'EARLY_STAGE', ageMin: 6, setup: ['Toes 4-5 inches from wall, lunge stance'], steps: ['Drive knee to wall without heel lift', 'Rock back and repeat'], cues: ['Heel stays down'], faults: ['Heel popping up'] },
  { name: 'Half-Kneeling Ankle Dorsiflexion Pulse', slug: 'half-kneeling-ankle-dorsiflexion-pulse', desc: 'Half-kneeling ankle glide pulses.', family: 'Ankle mobility', subrole: 'mobilize', slot: 'ankle_mobility', focus: 'Ankle glide, calf-ankle interface', joints: ['ankle_dorsiflexion'], body: 'ankle', tenets: ['flexibility'], methods: ['mobility_flexibility'], phys: ['control_stability'], pattern: 'squat', equip: 'mat', sets: 2, reps: 12, rest: 15, est: 30, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 8, setup: ['Half-kneeling, front foot flat'], steps: ['Pulse knee forward over toes', 'Keep heel down'], cues: ['Tibia over foot'], faults: ['Foot collapsing inward'] },
  { name: 'Ankle CARs', slug: 'ankle-cars', desc: 'Controlled articular rotations at ankle.', family: 'Ankle mobility', subrole: 'mobilize', slot: 'ankle_mobility', focus: 'Ankle control, end-range awareness', joints: ['ankle_inversion', 'ankle_eversion'], body: 'ankle', tenets: ['flexibility', 'coordination'], methods: ['mobility_flexibility'], phys: ['control_stability'], pattern: 'rotate', equip: 'none', sets: 2, reps: 5, rest: 10, est: 25, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 8, setup: ['Seated or standing, lift foot'], steps: ['Draw slow circles with foot'], cues: ['Isolate ankle'], faults: ['Moving knee'] },
  { name: 'Tibialis Raises', slug: 'tibialis-raises', desc: 'Standing anterior shin raises.', family: 'Foot activation', subrole: 'activate', slot: 'foot_activation', focus: 'Anterior shin, deceleration prep', joints: ['ankle_dorsiflexion'], body: 'ankle', tenets: ['strength', 'body_control'], methods: ['isometrics', 'resistance_calisthenics'], phys: ['control_stability'], pattern: 'brace', equip: 'none', sets: 2, reps: 15, rest: 20, est: 30, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 8, setup: ['Back to wall, feet flat'], steps: ['Lift toes toward shins', 'Lower with control'], cues: ['Keep heels down'], faults: ['Leaning back excessively'] },
  { name: 'Calf Raise to Heel Drop', slug: 'calf-raise-to-heel-drop', desc: 'Controlled calf raise and eccentric lower.', family: 'Foot activation', subrole: 'activate', slot: 'foot_activation', focus: 'Calf-Achilles prep', joints: ['ankle_plantarflexion'], tissues: ['achilles', 'gastrocnemius'], body: 'ankle', tenets: ['strength', 'flexibility'], methods: ['eccentric_negative', 'mobility_flexibility'], phys: ['force_tissue_capacity'], pattern: 'squat', equip: 'none', sets: 2, reps: 10, rest: 20, est: 35, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 8, setup: ['Stand on edge of step or flat ground'], steps: ['Rise onto balls of feet', 'Lower heels slowly below level if on step'], cues: ['Straight knee line'], faults: ['Bouncing at bottom'] },
  { name: 'Toe Yoga', slug: 'toe-yoga', desc: 'Independent toe lifts for foot control.', family: 'Foot activation', subrole: 'activate', slot: 'foot_activation', focus: 'Foot intrinsics, arch control', joints: ['toe_extension'], body: 'ankle', tenets: ['body_control', 'coordination'], methods: ['isometrics', 'core_body_control'], phys: ['control_stability'], pattern: 'brace', equip: 'none', sets: 2, reps: 8, rest: 15, est: 25, unit: 'reps', impact: 0, skill: 'EARLY_STAGE', ageMin: 6, setup: ['Seated or standing'], steps: ['Lift big toe, keep others down', 'Alternate pattern'], cues: ['Move slowly'], faults: ['Curling whole foot'] },
  { name: 'Short-Foot Drill', slug: 'short-foot-drill', desc: 'Arch doming without toe curl.', family: 'Foot activation', subrole: 'activate', slot: 'foot_activation', focus: 'Foot tripod, arch stiffness', joints: ['foot_supination'], body: 'ankle', tenets: ['body_control', 'strength'], methods: ['isometrics'], phys: ['control_stability'], pattern: 'brace', equip: 'none', sets: 2, reps: 10, rest: 15, est: 25, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 8, setup: ['Single leg balance, foot flat'], steps: ['Shorten foot by pulling ball toward heel', 'Hold 2-3 seconds'], cues: ['Toes stay long'], faults: ['Curling toes under'] },
  { name: 'Foot Tripod Weight Shifts', slug: 'foot-tripod-weight-shifts', desc: 'Weight shifts through heel, big toe, little toe.', family: 'Foot activation', subrole: 'activate', slot: 'foot_activation', focus: 'Foot pressure, balance readiness', joints: ['ankle_inversion', 'ankle_eversion'], body: 'ankle', tenets: ['balance', 'body_control'], methods: ['balance_stability'], phys: ['control_stability', 'perception_action_skill'], pattern: 'brace', equip: 'none', sets: 2, reps: 6, rest: 15, est: 30, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 6, setup: ['Single leg stand'], steps: ['Shift weight to heel, then ball, then edges'], cues: ['Quiet upper body'], faults: ['Hip hiking'] },
  { name: 'Low Pogos', slug: 'low-pogos', desc: 'Low-amplitude ankle bounces.', family: 'Elastic prep', subrole: 'potentiate_bridge', slot: 'low_level_plyo_prep', focus: 'Elastic ankle stiffness, light SSC', joints: ['ankle_plantarflexion'], body: 'ankle', tenets: ['explosiveness', 'coordination'], methods: ['plyometrics', 'neural'], phys: ['ssc_stiffness', 'neural_output_readiness'], pattern: 'jump', equip: 'none', sets: 2, reps: 10, rest: 30, est: 25, unit: 'reps', impact: 2, skill: 'BEGINNER', ageMin: 8, setup: ['Stand tall, soft knees'], steps: ['Small quick bounces off floor', 'Minimal knee bend'], cues: ['Stiff ankles', 'Quiet landings'], faults: ['Deep squatting between reps'] },
  { name: 'Jump Rope Easy Bounce', slug: 'jump-rope-easy-bounce', desc: 'Light rope or mimed bounce for rhythm.', family: 'Rhythm warm-up', subrole: 'raise', slot: 'rhythm_warmup', focus: 'Rhythm, foot/ankle temperature', joints: ['ankle_plantarflexion'], body: 'full_body', tenets: ['coordination', 'speed'], methods: ['neural', 'plyometrics'], phys: ['neural_output_readiness', 'energy_systems_repeatability'], pattern: 'jump', equip: 'none', sets: 2, work: 30, rest: 30, est: 35, unit: 'seconds', impact: 2, skill: 'BEGINNER', ageMin: 6, setup: ['Hold rope or mime bounce'], steps: ['Easy double-foot bounce', 'Stay on balls of feet'], cues: ['Relax shoulders'], faults: ['Jumping too high'] },
  { name: 'Walking Knee Hug', slug: 'walking-knee-hug', desc: 'Walk with knee-to-chest pulls.', family: 'Hip mobility', subrole: 'mobilize', slot: 'hip_mobility', focus: 'Hip flexion, single-leg balance', joints: ['hip_flexion'], body: 'hip', tenets: ['flexibility', 'balance'], methods: ['mobility_flexibility', 'balance_stability'], phys: ['control_stability'], pattern: 'locomote', equip: 'none', sets: 2, reps: 10, rest: 15, est: 40, unit: 'reps', impact: 0, skill: 'EARLY_STAGE', ageMin: 4, setup: ['Walk forward'], steps: ['Pull knee to chest', 'Alternate legs'], cues: ['Stand tall on support leg'], faults: ['Rounding back'] },
  { name: 'Walking Quad Pull', slug: 'walking-quad-pull', desc: 'Walk with standing quad stretch.', family: 'Hip mobility', subrole: 'mobilize', slot: 'hip_mobility', focus: 'Hip extension, quad length, balance', joints: ['hip_extension', 'knee_flexion'], body: 'hip', tenets: ['flexibility', 'balance'], methods: ['mobility_flexibility'], phys: ['control_stability'], pattern: 'locomote', equip: 'none', sets: 2, reps: 10, rest: 15, est: 40, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 6, setup: ['Walk forward'], steps: ['Grab ankle, pull heel to glute', 'Keep knees together'], cues: ['Tall posture'], faults: ['Arching lower back'] },
  { name: 'Leg Swings Front Back', slug: 'leg-swings-front-back', desc: 'Dynamic hip flexion/extension swings.', family: 'Hip mobility', subrole: 'mobilize', slot: 'hip_mobility', focus: 'Hip flexion/extension', joints: ['hip_flexion', 'hip_extension'], body: 'hip', tenets: ['flexibility', 'coordination'], methods: ['mobility_flexibility', 'neural'], phys: ['control_stability'], pattern: 'locomote', equip: 'none', sets: 2, reps: 10, rest: 15, est: 30, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 8, setup: ['Hold wall for balance'], steps: ['Swing leg forward and back', 'Stay tall, no trunk lean'], cues: ['Control at end range'], faults: ['Throwing leg violently'] },
  { name: 'Leg Swings Lateral', slug: 'leg-swings-lateral', desc: 'Frontal-plane leg swings.', family: 'Hip mobility', subrole: 'mobilize', slot: 'hip_mobility', focus: 'Hip abduction/adduction', joints: ['hip_abduction'], body: 'hip', tenets: ['flexibility', 'coordination'], methods: ['mobility_flexibility'], phys: ['control_stability'], pattern: 'locomote', equip: 'none', sets: 2, reps: 10, rest: 15, est: 30, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 8, setup: ['Face wall, hand support'], steps: ['Swing leg across and out'], cues: ['Pelvis stays square'], faults: ['Rotating trunk'] },
  { name: '90/90 Hip Switch', slug: '9090-hip-switch', desc: 'Seated 90/90 hip internal/external rotation switches.', family: 'Hip mobility', subrole: 'mobilize', slot: 'hip_mobility', focus: 'Hip internal/external rotation', joints: ['hip_rotation'], body: 'hip', tenets: ['flexibility', 'body_control'], methods: ['mobility_flexibility'], phys: ['control_stability'], pattern: 'rotate', equip: 'mat', sets: 2, reps: 8, rest: 20, est: 45, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 8, setup: ['Seated 90/90, hands behind for support'], steps: ['Lift knees and switch sides', 'Control the transition'], cues: ['Stay tall'], faults: ['Using momentum to flop'] },
  { name: 'Shin Box Switch', slug: 'shin-box-switch', desc: 'Shin box position hip switches.', family: 'Hip mobility', subrole: 'mobilize', slot: 'hip_mobility', focus: 'Hip rotation, trunk control', joints: ['hip_rotation'], body: 'hip', tenets: ['flexibility', 'coordination'], methods: ['mobility_flexibility', 'core_body_control'], phys: ['control_stability'], pattern: 'rotate', equip: 'mat', sets: 2, reps: 6, rest: 20, est: 40, unit: 'reps', impact: 0, skill: 'INTERMEDIATE', ageMin: 10, setup: ['Shin box seated'], steps: ['Switch legs to opposite 90/90'], cues: ['Hands light on floor'], faults: ['Collapsing into one hip'] },
  { name: 'Shin Box Get-Up', slug: 'shin-box-get-up', desc: 'Rise from shin box to kneeling or standing.', family: 'Hip integration', subrole: 'integrate', slot: 'full_body_flow', focus: 'Hip rotation to locomotion', joints: ['hip_rotation', 'hip_extension'], body: 'full_body', tenets: ['coordination', 'strength'], methods: ['mobility_flexibility', 'core_body_control'], phys: ['control_stability', 'perception_action_skill'], pattern: 'locomote', equip: 'mat', sets: 2, reps: 4, rest: 30, est: 45, unit: 'reps', impact: 0, skill: 'INTERMEDIATE', ageMin: 10, setup: ['Start in shin box'], steps: ['Rotate and extend to half-kneeling', 'Optional stand'], cues: ['Drive through front foot'], faults: ['Using hands to push off floor'] },
  { name: 'Hip CARs', slug: 'hip-cars', desc: 'Standing or quadruped hip controlled rotations.', family: 'Hip mobility', subrole: 'mobilize', slot: 'hip_mobility', focus: 'Active hip control', joints: ['hip_rotation', 'hip_flexion'], body: 'hip', tenets: ['flexibility', 'coordination'], methods: ['mobility_flexibility'], phys: ['control_stability'], pattern: 'rotate', equip: 'none', sets: 2, reps: 4, rest: 15, est: 35, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 8, setup: ['Stand on one leg or quadruped'], steps: ['Draw slow circles with knee'], cues: ['Keep pelvis still'], faults: ['Trunk sway'] },
  { name: 'Adductor Rockback', slug: 'adductor-rockback', desc: 'Half-kneeling adductor stretch rock.', family: 'Hip mobility', subrole: 'mobilize', slot: 'hip_mobility', focus: 'Adductors, groin, hinge', joints: ['hip_abduction'], tissues: ['adductors'], body: 'hip', tenets: ['flexibility'], methods: ['mobility_flexibility'], phys: ['force_tissue_capacity'], pattern: 'hinge', equip: 'mat', sets: 2, reps: 8, rest: 15, est: 35, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 8, setup: ['Half-kneeling wide stance'], steps: ['Rock toward straight leg side'], cues: ['Flat back'], faults: ['Rounding spine'] },
  { name: 'Frog Rockback', slug: 'frog-rockback', desc: 'Quadruped wide-knee rockback.', family: 'Hip mobility', subrole: 'mobilize', slot: 'hip_mobility', focus: 'Hip abduction, adductor tissue', joints: ['hip_abduction'], tissues: ['adductors'], body: 'hip', tenets: ['flexibility'], methods: ['mobility_flexibility'], phys: ['force_tissue_capacity'], pattern: 'squat', equip: 'mat', sets: 2, reps: 8, rest: 20, est: 40, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 8, setup: ['Quadruped, knees wide'], steps: ['Rock hips back toward heels'], cues: ['Keep spine neutral'], faults: ['Collapsing into low back flexion'] },
  { name: 'Cossack Shift', slug: 'cossack-shift', desc: 'Low-amplitude lateral lunge shift.', family: 'Hip mobility', subrole: 'mobilize', slot: 'hip_mobility', focus: 'Frontal-plane hip/ankle access', joints: ['hip_abduction', 'ankle_dorsiflexion'], body: 'hip', tenets: ['flexibility', 'balance'], methods: ['mobility_flexibility', 'balance_stability'], phys: ['control_stability'], pattern: 'squat', equip: 'none', sets: 2, reps: 6, rest: 20, est: 40, unit: 'reps', impact: 0, skill: 'INTERMEDIATE', ageMin: 10, setup: ['Wide stance, toes forward or slightly out'], steps: ['Shift to one side keeping heel down', 'Alternate sides'], cues: ['Chest up'], faults: ['Heel lifting on bent leg side'] },
  { name: 'Deep Squat Pry', slug: 'deep-squat-pry', desc: 'Hold deep squat and pry knees open.', family: 'Squat access', subrole: 'integrate', slot: 'squat_to_stand', focus: 'Squat bottom, hips, ankles, trunk', joints: ['hip_flexion', 'ankle_dorsiflexion'], body: 'full_body', tenets: ['flexibility', 'body_control'], methods: ['mobility_flexibility'], phys: ['control_stability'], pattern: 'squat', equip: 'none', sets: 2, work: 30, rest: 20, est: 35, unit: 'seconds', impact: 0, skill: 'BEGINNER', ageMin: 8, setup: ['Deep squat, elbows inside knees'], steps: ['Pry knees out with elbows', 'Breathe and relax into position'], cues: ['Heels down', 'Chest up'], faults: ['Heels lifting', 'Rounding upper back'] },
  { name: 'Squat-to-Stand with Reach', slug: 'squat-to-stand-with-reach', desc: 'Deep squat hold to stand with overhead reach.', family: 'Squat access', subrole: 'integrate', slot: 'squat_to_stand', focus: 'Hamstrings, squat access, T-spine', joints: ['hip_flexion', 'shoulder_flexion'], body: 'full_body', tenets: ['flexibility', 'coordination'], methods: ['mobility_flexibility'], phys: ['control_stability'], pattern: 'squat', equip: 'none', sets: 2, reps: 6, rest: 20, est: 40, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 6, setup: ['Hold bottom of squat'], steps: ['Reach arms up as you stand', 'Return to squat with control'], cues: ['Weight through mid-foot'], faults: ['Rolling onto toes'] },
  { name: 'Lateral Lunge Shift', slug: 'lateral-lunge-shift', desc: 'Side-to-side lateral lunge patterning.', family: 'Lunge pattern', subrole: 'integrate', slot: 'lunge_pattern_prep', focus: 'Frontal-plane loading, adductors', joints: ['hip_abduction', 'knee_flexion'], body: 'hip', tenets: ['flexibility', 'strength'], methods: ['mobility_flexibility', 'balance_stability'], phys: ['control_stability'], pattern: 'squat', equip: 'none', sets: 2, reps: 6, rest: 20, est: 40, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 8, setup: ['Stand wide'], steps: ['Shift to one side into lateral lunge', 'Drive back to center'], cues: ['Knee tracks over foot'], faults: ['Knee collapsing inward'] },
  { name: 'Glute Bridge', slug: 'glute-bridge', desc: 'Supine hip extension bridge.', family: 'Glute activation', subrole: 'activate', slot: 'glute_activation', focus: 'Hip extension, glute activation', joints: ['hip_extension'], tissues: ['glutes'], body: 'hip', tenets: ['strength', 'body_control'], methods: ['isometrics', 'core_body_control'], phys: ['control_stability', 'force_tissue_capacity'], pattern: 'hinge', equip: 'mat', sets: 2, reps: 12, rest: 20, est: 35, unit: 'reps', impact: 0, skill: 'EARLY_STAGE', ageMin: 6, setup: ['Supine, knees bent, feet flat'], steps: ['Drive through heels, lift hips', 'Squeeze glutes at top'], cues: ['Ribs down', 'Knees hip-width'], faults: ['Over-arching lumbar spine'] },
  { name: 'Glute Bridge March', slug: 'glute-bridge-march', desc: 'Bridge hold with alternating leg march.', family: 'Glute activation', subrole: 'activate', slot: 'glute_activation', focus: 'Pelvic control, glute/trunk integration', joints: ['hip_extension', 'hip_flexion'], body: 'hip', tenets: ['strength', 'body_control'], methods: ['core_body_control', 'isometrics'], phys: ['control_stability'], pattern: 'hinge', equip: 'mat', sets: 2, reps: 8, rest: 25, est: 40, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 8, setup: ['Bridge position'], steps: ['Lift one foot without dropping hips', 'Alternate'], cues: ['Level pelvis'], faults: ['Hips dropping on lift'] },
  { name: 'Dead Bug Heel Tap', slug: 'dead-bug-heel-tap', desc: 'Supine dead bug with heel taps.', family: 'Core activation', subrole: 'activate', slot: 'core_activation', focus: 'Anterior core, rib-pelvis control', joints: ['hip_flexion', 'shoulder_flexion'], body: 'core', tenets: ['body_control', 'coordination'], methods: ['core_body_control', 'isometrics'], phys: ['control_stability'], pattern: 'brace', equip: 'mat', sets: 2, reps: 8, rest: 20, est: 35, unit: 'reps', impact: 0, skill: 'EARLY_STAGE', ageMin: 6, setup: ['Supine, arms up, knees 90°'], steps: ['Lower heel to floor one side', 'Return with ribs down'], cues: ['Press low back to floor'], faults: ['Lower back arching'] },
  { name: 'Bird Dog', slug: 'bird-dog', desc: 'Quadruped opposite arm/leg reach.', family: 'Core activation', subrole: 'activate', slot: 'core_activation', focus: 'Cross-body trunk control', joints: ['hip_extension', 'shoulder_flexion'], body: 'core', tenets: ['body_control', 'coordination', 'balance'], methods: ['core_body_control', 'balance_stability'], phys: ['control_stability', 'perception_action_skill'], pattern: 'brace', equip: 'mat', sets: 2, reps: 6, rest: 20, est: 35, unit: 'reps', impact: 0, skill: 'EARLY_STAGE', ageMin: 6, setup: ['Quadruped neutral'], steps: ['Reach opposite arm and leg long', 'Hold 2 seconds'], cues: ['Hips level'], faults: ['Rotating or sagging'] },
  { name: 'Mini-Band Lateral Walk', slug: 'mini-band-lateral-walk', desc: 'Band-resisted lateral steps.', family: 'Glute activation', subrole: 'activate', slot: 'glute_activation', focus: 'Glute medius, knee tracking', joints: ['hip_abduction'], tissues: ['glute_med'], body: 'hip', tenets: ['strength', 'body_control'], methods: ['resistance_calisthenics', 'balance_stability'], phys: ['control_stability'], pattern: 'locomote', equip: 'bands', sets: 2, reps: 10, rest: 25, est: 35, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 10, setup: ['Band above knees, quarter squat'], steps: ['Step laterally maintaining tension', 'No feet together'], cues: ['Knees out'], faults: ['Standing up between steps'] },
  { name: 'A-March', slug: 'a-march', desc: 'Marching mechanics with postural emphasis.', family: 'Sprint posture prep', subrole: 'potentiate_bridge', slot: 'marching_mechanics', focus: 'Sprint posture, rhythm, neural readiness', joints: ['hip_flexion', 'ankle_dorsiflexion'], body: 'full_body', tenets: ['speed', 'coordination', 'body_control'], methods: ['neural', 'mobility_flexibility'], phys: ['neural_output_readiness', 'perception_action_skill'], pattern: 'locomote', equip: 'none', sets: 2, reps: 10, rest: 30, est: 40, unit: 'reps', impact: 0, skill: 'BEGINNER', ageMin: 8, setup: ['Stand tall'], steps: ['Drive knee to hip height', 'Opposite arm swing', 'Quick ground contact'], cues: ['Tall posture', 'Toes up'], faults: ['Leaning back', 'Slow lazy steps'] },
]

const WGS = {
  name: "World's Greatest Stretch", slug: 'worlds-greatest-stretch',
  family: 'Integrated mobility', subrole: 'integrate', slot: 'integrated_mobility',
  focus: 'Hip flexor, hamstring, T-spine, lunge pattern',
  joints: ['hip_flexion', 'thoracic_rotation'], body: 'full_body',
}

const SUBROLE_WHY = {
  raise: 'Belongs in Raise — elevates temperature, blood flow, and general readiness without fatigue.',
  mobilize: 'Belongs in Mobilize — opens joint ranges needed for later skill, speed, and strength work.',
  activate: 'Belongs in Activate — wakes stabilizers and primes positions before integrated patterns.',
  integrate: 'Belongs in Integrate — connects joints into whole-body movement chains.',
  potentiate_bridge: 'Belongs in Potentiate Bridge — gently ramps neural intent toward Skill/Output without fatigue.',
}

function sqlStr(s) {
  return `'${String(s).replace(/'/g, "''")}'`
}

function jsonArr(arr) {
  return `'${JSON.stringify(arr).replace(/'/g, "''")}'::jsonb`
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

let sql = `-- Seed 50 Prepare / Access movements (card v2 + subrole hierarchy).
-- IDEMPOTENT. Generated by scripts/generate-097-prepare-seed.mjs

-- 1) Insert 49 new exercises
INSERT INTO coaching.exercise (
  facility_id, name, slug, description, sport_id, skill_level, age_min,
  default_sets, default_reps, default_work_seconds, default_rest_seconds, est_seconds_per_set,
  is_published, visibility,
  card_summary, coach_language, athlete_language,
  movement_family, primary_phase_key, phase_subrole, primary_order_slot,
  movement_requirements, coaching_execution
)
SELECT
  (SELECT id FROM public.facility ORDER BY id LIMIT 1),
  d.name, d.slug, d.description,
  (SELECT id FROM coaching.sport WHERE key = 'fitness'),
  d.skill::public.skill_level,
  d.age_min,
  d.sets, d.reps, d.work, d.rest, d.est,
  TRUE, 'facility',
  d.summary, d.coach_lang, d.athlete_lang,
  d.family, 'prepare_access', d.subrole, d.slot,
  d.req::jsonb, d.exec::jsonb
FROM (VALUES
`

sql += MOVEMENTS.map((m) => {
  const summary = `${m.focus}.`
  const coachLang = `Use in Prepare / Access (${m.subrole.replace(/_/g, ' ')}) before higher-intent work.`
  const athleteLang = `Move with control; this prepares your ${m.body.replace(/_/g, ' ')} for training.`
  const reps = m.reps ?? null
  const work = m.work ?? null
  return `  (${sqlStr(m.name)}, ${sqlStr(m.slug)}, ${sqlStr(m.desc)}, ${sqlStr(m.skill)}, ${m.ageMin}, ${m.sets}, ${reps ?? 'NULL'}, ${work ?? 'NULL'}, ${m.rest}, ${m.est}, ${sqlStr(summary)}, ${sqlStr(coachLang)}, ${sqlStr(athleteLang)}, ${sqlStr(m.family)}, ${sqlStr(m.subrole)}, ${sqlStr(m.slot)}, ${jsonReq(m).replace('::jsonb', '')}::jsonb, ${jsonExec(m).replace('::jsonb', '')}::jsonb)`
}).join(',\n')

sql += `
) AS d(name, slug, description, skill, age_min, sets, reps, work, rest, est, summary, coach_lang, athlete_lang, family, subrole, slot, req, exec)
ON CONFLICT (facility_id, slug) DO NOTHING;

-- Fix finger-pulses: wrist_prep slot maps to mobilize (dual subrole — primary mobilize per plan)
UPDATE coaching.exercise SET
  phase_subrole = 'mobilize',
  coach_language = 'Use in Prepare / Access (mobilize) before higher-intent work. Secondary intent: hand intrinsic activation.',
  updated_at = now()
WHERE slug = 'finger-pulses' AND primary_phase_key = 'prepare_access';

-- Update existing World's Greatest Stretch
UPDATE coaching.exercise SET
  card_summary = ${sqlStr(WGS.focus + '.')},
  coach_language = ${sqlStr('Use in Prepare / Access (integrate) as a dynamic full-body opener.')},
  movement_family = ${sqlStr(WGS.family)},
  primary_phase_key = 'prepare_access',
  phase_subrole = 'integrate',
  primary_order_slot = 'integrated_mobility',
  movement_requirements = ${jsonReq({ ...WGS, joints: WGS.joints, tissues: [], tenets: ['flexibility'], unit: 'reps', impact: 0 })},
  coaching_execution = '{"movement_description":"Dynamic lunge with thoracic rotation and hamstring stretch.","setup":["Lunge forward, back knee down"],"execution_steps":["Place same-side elbow inside front foot","Rotate and reach sky"],"coach_cues":["Keep back leg long"],"common_faults":["Collapsing forward"]}'::jsonb,
  updated_at = now()
WHERE slug = 'worlds-greatest-stretch';

`

// All slugs including WGS (for tags, scaling, education)
const ALL = [
  ...MOVEMENTS,
  {
    slug: 'worlds-greatest-stretch',
    tenets: ['flexibility', 'coordination'],
    methods: ['mobility_flexibility', 'core_body_control'],
    phys: ['control_stability', 'force_tissue_capacity'],
    pattern: 'locomote',
    equip: 'none',
    body: 'full_body',
    subrole: 'integrate',
    slot: 'integrated_mobility',
    impact: 0,
  },
]

function slugList(arr) {
  return arr.map((m) => sqlStr(m.slug)).join(', ')
}

// Tags - tenet
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

// Phase profiles
sql += `-- 3) Prepare / Access phase profiles\nINSERT INTO coaching.exercise_phase_profile (
  exercise_id, phase_id, fit_weight, role, order_slot, order_index,
  freshness_required, fatigue_sensitivity, fatigue_cost, technical_complexity, impact_level, intensity_ceiling
)
SELECT e.id, sp.id, 5, 'primary', m.slot, pos.order_index,
  FALSE, 1, 1, 2, m.impact, 'low'
FROM (VALUES\n`
sql += [...MOVEMENTS, { slug: 'worlds-greatest-stretch', slot: 'integrated_mobility', impact: 0 }].map((m) => {
  const impact = m.impact ?? 0
  return `  (${sqlStr(m.slug)}, ${sqlStr(m.slot || WGS.slot)}, ${impact})`
}).join(',\n')
sql += `
) AS m(slug, slot, impact)
JOIN coaching.exercise e ON e.slug = m.slug
JOIN coaching.session_phase sp ON sp.key = 'prepare_access'
JOIN coaching.phase_order_slot pos ON pos.key = m.slot
ON CONFLICT (exercise_id, phase_id) DO UPDATE SET
  role = EXCLUDED.role, order_slot = EXCLUDED.order_slot, fit_weight = EXCLUDED.fit_weight,
  impact_level = EXCLUDED.impact_level, intensity_ceiling = EXCLUDED.intensity_ceiling;

`

// Dosage profiles
sql += `-- 4) Dosage profiles\nINSERT INTO coaching.exercise_dosage_profile (
  exercise_id, profile_name, is_default, volume_unit, default_sets, default_reps,
  default_work_seconds, default_rest_seconds, est_seconds_per_set
)
SELECT e.id, 'Default', TRUE, m.unit, m.sets, m.reps, m.work, m.rest, m.est
FROM (VALUES\n`
sql += MOVEMENTS.map((m) => `  (${sqlStr(m.slug)}, ${sqlStr(m.unit)}, ${m.sets}, ${m.reps ?? 'NULL'}, ${m.work ?? 'NULL'}, ${m.rest}, ${m.est})`).join(',\n')
sql += `,
  ('worlds-greatest-stretch', 'reps', 2, 6, NULL, 20, 35)
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
sql += [...MOVEMENTS, { slug: 'worlds-greatest-stretch', impact: 0 }].map((m) => `  (${sqlStr(m.slug)}, ${m.impact ?? 0})`).join(',\n')
sql += `
) AS m(slug, impact)
JOIN coaching.exercise e ON e.slug = m.slug
WHERE NOT EXISTS (SELECT 1 FROM coaching.exercise_safety_profile s WHERE s.exercise_id = e.id);

UPDATE coaching.exercise_safety_profile s SET
  readiness_checks = ARRAY['Athlete can land quietly', 'No ankle/knee pain'],
  impact_level = 2
FROM coaching.exercise e
WHERE s.exercise_id = e.id AND e.slug IN ('low-pogos', 'jump-rope-easy-bounce');

`

// Regimen
sql += `-- 6) Regimen rules (daily OK for warm-ups)\nINSERT INTO coaching.exercise_regimen_rule (
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

// Scaling cohorts (6 required for publish)
sql += `-- 7) Scaling cohort rows (6 required cohorts)\n`
for (const ck of cohortKeys) {
  sql += `INSERT INTO coaching.exercise_scaling_profile (exercise_id, cohort_key, label, scale_direction, load_guidance, complexity_guidance, coach_notes)
SELECT e.id, '${ck}', '${ck.replace(/_/g, ' ')}', 'baseline', 'Reduce reps or duration for younger or less trained athletes.', 'Use simpler variation if form breaks down.', 'Warm-up dose only — prioritize quality.'
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
  'Develops movement access and readiness for athletic training.',
  CASE e.phase_subrole
    WHEN 'raise' THEN ${sqlStr(SUBROLE_WHY.raise)}
    WHEN 'mobilize' THEN ${sqlStr(SUBROLE_WHY.mobilize)}
    WHEN 'activate' THEN ${sqlStr(SUBROLE_WHY.activate)}
    WHEN 'integrate' THEN ${sqlStr(SUBROLE_WHY.integrate)}
    WHEN 'potentiate_bridge' THEN ${sqlStr(SUBROLE_WHY.potentiate_bridge)}
    ELSE 'Place in Prepare / Access before higher-intent work.'
  END,
  'Use early in session; scale volume by age and attention. Stop before fatigue.',
  'Do not use as conditioning or max-effort work in the warm-up.',
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

// Cues
sql += `-- 9) Representative cues\nINSERT INTO coaching.exercise_cue (exercise_id, cue_type, body, sort_order)
SELECT e.id, v.cue_type, v.body, v.sort_order
FROM (VALUES
  ('deep-squat-pry', 'cue', 'Keep heels down and chest up in the bottom.', 0),
  ('deep-squat-pry', 'fault', 'Heels lifting off floor.', 1),
  ('glute-bridge', 'cue', 'Drive through heels; ribs down at top.', 0),
  ('glute-bridge', 'fault', 'Over-arching lower back.', 1),
  ('bear-crawl-rock-back', 'cue', 'Press palms; rock hips back with control.', 0),
  ('a-march', 'cue', 'Tall posture; quick sharp knee drive.', 0),
  ('a-march', 'fault', 'Leaning backward.', 1)
) AS v(slug, cue_type, body, sort_order)
JOIN coaching.exercise e ON e.slug = v.slug
WHERE NOT EXISTS (
  SELECT 1 FROM coaching.exercise_cue c
  WHERE c.exercise_id = e.id AND c.cue_type = v.cue_type AND c.body = v.body
);
`

const outPath = path.join(__dirname, '../backend/migrations/097_coaching_prepare_access_seed.sql')
fs.writeFileSync(outPath, sql)
console.log('Wrote', outPath, '—', MOVEMENTS.length + 1, 'movements')
