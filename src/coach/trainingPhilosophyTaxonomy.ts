/**
 * Coach-facing Training Philosophy Taxonomy content.
 * Rendered in FrameworkPanel (Philosophy tab) alongside DB-backed education rows.
 */

import { SESSION_PHASE_ORDER } from './taxonomy'

/** Overarching hub — how the full taxonomy fits together. */
export const TRAINING_PHILOSOPHY_TAXONOMY = {
  title: 'Training Philosophy Taxonomy',
  intro: `The Athleticism Accelerator is not a random exercise list — it is a layered system that answers four questions for every drill: what quality are we developing, how are we training it, what tissue or system is stressed, and where does it belong in time? Session Phases sequence intent across the workout. Athleticism Accelerator Tenets name the qualities we build. Methodologies describe how we load those qualities. Physiological Emphasis tags what systems are actually being trained. Order Slots fine-sort exercises within a phase so freshness-sensitive work stays early. Session Models allocate minutes across phases for 60-, 90-, and 120-minute sessions. Validation Rules enforce the logic so a tired athlete does not accidentally sprint after HIIT.`,
  layers: [
    {
      name: 'Session Phases',
      role: 'When in the session — the macro sequence of intent.',
      connects: 'Phases protect fatigue-sensitive qualities (skill, speed, power) before conditioning and strength that create fatigue on purpose.',
    },
    {
      name: 'Athleticism Accelerator Tenets',
      role: 'What we develop — the athletic qualities that transfer across sports.',
      connects: 'Every exercise is tagged to tenets so coaches see whether a drill builds strength, speed, explosiveness, coordination, or control.',
    },
    {
      name: 'Methodologies',
      role: 'How we train — the loading strategy (plyometrics, isometrics, HIIT, etc.).',
      connects: 'Methodologies have primary phase homes. Plyometrics belong in Output; HIIT belongs late in Sustained Capacity.',
    },
    {
      name: 'Physiological Emphasis',
      role: 'Why it works — neural readiness, SSC stiffness, tissue capacity, perception–action skill.',
      connects: 'Physiology explains the mechanism so coaches do not confuse a neural sprint drill with a conditioning shuttle.',
    },
    {
      name: 'Order Slots',
      role: 'Fine order within a phase — subrole bands and progression slots.',
      connects: 'Slots keep elastic prep before depth rebounds, acceleration before max velocity, and landing prep before jump power.',
    },
    {
      name: 'Session Models',
      role: 'Time allocation — how minutes map to phases for 60 / 90 / 120 sessions.',
      connects: 'Models preserve phase order while letting tumbling-first, speed add-on, or fitness add-on sessions shift minutes without breaking intent.',
    },
    {
      name: 'Validation Rules',
      role: 'Guardrails — automated checks when phase order, freshness, or cluster prerequisites are violated.',
      connects: 'Rules translate philosophy into actionable warnings in the Workout Builder before bad sequencing reaches the floor.',
    },
  ],
  shortfalls: [
    'Random “warm-up circuits” that fatigue athletes before skill or speed work.',
    'Plyometrics and sprints placed after HIIT or heavy leg days — training conditioning, not power.',
    'Long static stretching immediately before jumps or sprints — reducing elastic readiness.',
    'Strength-before-speed sessions that grind out squats then expect crisp acceleration.',
    'Tumbling or advanced skill buried after conditioning when attention and landing quality are gone.',
    'One-size-fits-all workouts with no progression logic — same drills regardless of landing competency or freshness.',
    'Exercise selection driven by equipment availability instead of phase intent and tenet development.',
  ],
  transcends: `Traditional workouts often list exercises without sequencing logic: “10 exercises, 3 rounds, go.” The Athleticism Accelerator inverts that. Phases encode **when** qualities must be trained. Tenets encode **what** transfers. Methodologies encode **how** load is applied. Physiology encodes **why** the drill works. Order slots encode **micro-progression** inside a phase. Session models encode **time** without sacrificing order. Validation rules encode **accountability**. Together they maximize athletic development in minimal time by placing the highest-intent, highest-transfer work while the athlete is freshest — and pushing fatigue-creating work to where it belongs.`,
  flow: SESSION_PHASE_ORDER.map((key, i) => ({
    step: i + 1,
    phaseKey: key,
    label:
      key === 'prepare_and_access'
        ? 'Prepare & Access'
        : key === 'movement_intelligence'
          ? 'Movement Intelligence'
          : key === 'resilience'
            ? 'Resilience'
            : key === 'sustained_capacity'
              ? 'Sustained Capacity'
              : key.charAt(0).toUpperCase() + key.slice(1),
  })),
} as const

export const SESSION_PHASES_HUB = {
  title: 'Session Phases — macro session intent',
  intro: `Session phases are the backbone of every Athleticism Accelerator workout. Each phase has a distinct job, fatigue profile, and placement rule. Sensitive qualities — coordination, speed, elastic power — need a fresh nervous system. Strength tolerates more fatigue. Conditioning creates fatigue on purpose. Restore downshifts the athlete. The canonical order is Prepare & Access → Movement Intelligence → Output → Capacity → Resilience → Sustained Capacity → Restore.`,
  principles: [
    'Prepare & Access raises readiness without meaningful fatigue — access before intensity.',
    'Movement Intelligence teaches patterns while the brain and body can still learn.',
    'Output expresses speed, power, and elasticity while intent and landing quality are high.',
    'Capacity builds force and tissue tolerance after quality speed/power work.',
    'Resilience trains brakes, stabilizers, and eccentric tolerance.',
    'Sustained Capacity intentionally accumulates fatigue — almost always late.',
    'Restore cools down, breathes, and assigns flexibility homework — never new stress.',
  ],
  misuse: `The most expensive mistake is treating phases as interchangeable blocks. HIIT before skill destroys learning. Heavy strength before output reduces jump height and sprint quality. Advanced tumbling after conditioning increases landing risk. Static flexibility before power reduces stiffness. Session phases exist so coaches do not have to re-learn sports science every time they build a workout.`,
} as const

export const TENETS_HUB = {
  title: 'Athleticism Accelerator Tenets',
  intro: `Tenets are the athletic qualities Vortex develops on purpose — not generic “fitness.” Every exercise card carries weighted tenet tags (1–5) so coaches see what a drill actually builds: Strength, Explosiveness, Speed, Agility, Flexibility/Mobility, Balance, Coordination, and Body Control. Tenets answer “what transfers to sport?” Methodologies answer “how we load it.” Phases answer “when it belongs.”`,
  principles: [
    'Strength is the force foundation — primarily Capacity, not before max power unless it is a strength-priority day.',
    'Explosiveness is rate of force — Output jumps, throws, bounds with low reps and full reset.',
    'Speed is coordinated rapid movement — early in the session with generous rest.',
    'Agility is decelerate–redirect–react — technical work before fatigue; conditioning shuttles late.',
    'Flexibility/Mobility is usable range — dynamic early, long static late.',
    'Balance is base-of-support control — low level in Prepare; hard balance when fatiguing stabilizers is later.',
    'Coordination is multi-part timing — Skill phase with rhythm, tumbling, and pattern drills.',
    'Body Control is spatial ownership — Skill for shapes; Resilience for fatiguing stability.',
  ],
  misuse: `Tagging everything as “explosiveness” because it feels hard, or programming strength circuits and calling them “plyometrics,” blurs intent. Tenets keep programming honest: a heavy squat builds strength; a countermovement jump with full rest builds explosiveness; a fatigued box-jump circuit builds conditioning — different tenets, different phases.`,
} as const

export const METHODOLOGIES_HUB = {
  title: 'Methodologies — how we load qualities',
  intro: `Methodologies describe the training tool, not the session phase. Resistance & Calisthenics, Plyometrics, Isometrics, Eccentric/Negative Training, Neural Training, Balance & Stability, Mobility & Flexibility, Core & Body Control, and HIIT each have primary phase homes. A methodology can appear in secondary phases when dose and intent match — low pogos in Prepare as elastic prep, not max-depth rebounds.`,
  primaryHomes: [
    { methodology: 'Resistance & Calisthenics', primary: 'Capacity', secondary: 'Control, Skill (technical calisthenics)' },
    { methodology: 'Plyometrics', primary: 'Output', secondary: 'Prepare (low elastic prep), Skill (landing mechanics)' },
    { methodology: 'Isometrics', primary: 'Prepare (light), Skill, Capacity, Control', secondary: 'Activation and yielding holds' },
    { methodology: 'Eccentric/Negative', primary: 'Resilience', secondary: 'Capacity' },
    { methodology: 'Neural', primary: 'Prepare, Skill, Output', secondary: 'High-intent coordination and speed' },
    { methodology: 'Balance & Stability', primary: 'Control, Skill', secondary: 'Prepare (low level)' },
    { methodology: 'Mobility & Flexibility', primary: 'Prepare (dynamic), Restore (static)', secondary: 'Never long static before power' },
    { methodology: 'Core & Body Control', primary: 'Control, Skill', secondary: 'Prepare activation' },
    { methodology: 'HIIT', primary: 'Sustained Capacity', secondary: 'Almost never before skill or output' },
  ],
  misuse: `Using plyometrics as a finisher after leg day, isometric burnout before tumbling, or HIIT as a “warm-up” are methodology–phase mismatches. The taxonomy keeps the tool aligned with the phase intent.`,
} as const

export const PHYSIOLOGY_HUB = {
  title: 'Physiological Emphasis — why the drill works',
  intro: `Physiological emphasis tags the systems under stress: neural output & readiness, force/tissue capacity, SSC & stiffness, control & stability, perception–action skill, and energy systems & repeatability. Two drills can look similar but train different physiology — a snap-down rebound (SSC stiffness) versus a heavy squat (force capacity) versus a reaction shuffle (perception–action).`,
  systems: [
    {
      key: 'neural_output_readiness',
      summary: 'Motor unit recruitment, intent, and speed of coordination — train fresh, low volume, high rest.',
    },
    {
      key: 'force_tissue_capacity',
      summary: 'Muscle, tendon, and joint tolerance — progressive strength, calisthenics, eccentrics in Capacity and Control.',
    },
    {
      key: 'ssc_stiffness',
      summary: 'Stretch–shortening cycle and elastic rebound — Output pogos, bounds, jumps; manage contacts and landing quality.',
    },
    {
      key: 'control_stability',
      summary: 'Position ownership under load or speed — balance, core, isometrics, landing sticks.',
    },
    {
      key: 'perception_action_skill',
      summary: 'See–decide–move — reaction drills, tumbling, rhythm in Skill while focus is intact.',
    },
    {
      key: 'energy_systems_repeatability',
      summary: 'Repeat efforts under fatigue — HIIT and intervals late or in separate sessions.',
    },
  ],
  misuse: `Chasing SSC stiffness with high-rep fatigued jumps, or calling a conditioning circuit “neural training” because it is fast, mislabels physiology and hides recovery cost.`,
} as const

export const ORDER_SLOTS_HUB = {
  title: 'Order Slots — fine progression within a phase',
  intro: `Order slots are the micro-sequence inside a session phase. Prepare & Access slots follow the RAMP-derived subroles (Raise → Mobilize → Activate → Integrate → Potentiate Bridge). Skill slots group shape, tumbling, sprint mechanics, balance, and perception clusters. Output slots progress acceleration → max velocity → elastic rudiments → jump/throw power → deceleration → COD → reactive agility. Each slot has an order index and freshness sensitivity so related exercises sort correctly in the library and builder.`,
  concepts: [
    'Subroles are the coarse bands; order slots are the fine lanes within each band.',
    'Freshness sensitivity (1–5) signals how quickly quality drops when the athlete is tired.',
    'Progression slots encode prerequisites — e.g. broad jump to stick before broad jump rebound.',
    'Slots make the library searchable and make validation cluster-aware (acceleration, elastic, jump power).',
  ],
  phaseGroups: [
    { phase: 'Prepare & Access', subroles: 'Raise, Mobilize, Activate, Integrate, Potentiate Bridge', examples: 'breathing_reset, hip_rotation, glute_activation, crawl_progressions, elastic_prep' },
    { phase: 'Movement Intelligence', subroles: 'Shape, Tumbling, Sprint mechanics, Balance, Perception–action', examples: 'shape_holds, tumbling_foundation, sprint_mechanics, balance_coordination, reactive_agility' },
    { phase: 'Output', subroles: 'Acceleration, Max velocity, Elastic, Jump/throw power, Decel, COD, Reactive agility', examples: 'acceleration_start_speed, max_velocity_exposure, elastic_ankle, vertical_jump_power, decel_foundation' },
    { phase: 'Capacity / Control / Fitness / Restore', subroles: 'Phase-level slots for strength, isometrics, conditioning, cooldown', examples: 'main_strength, eccentric_control, conditioning_intervals, post_workout_flexibility' },
  ],
  misuse: `Skipping slots — programming depth rebounds before snap-down stick, or continuous skater bounds before lateral bound to stick — bypasses built-in progression logic and increases injury risk.`,
} as const

export const SESSION_MODELS_HUB = {
  title: 'Session Models (60 / 90 / 120 minutes)',
  intro: `Session models allocate minutes across phases without breaking phase order. A 60-minute general session balances prepare, skill, output, capacity, control, a short fitness touch, and restore. Ninety-minute models support tumbling-first or tumbling-end layouts. One-hundred-twenty-minute models add speed or fitness blocks as intentional add-ons — speed early while neural output is fresh; fitness late because it creates fatigue on purpose.`,
  models: [
    {
      key: 'session_60_general',
      name: '60-Minute General Athletic Development',
      summary: 'Balanced allocation: ~8 prepare, ~8 skill, ~15 output, ~18 capacity, ~7 control, ~3 fitness, ~1 restore.',
    },
    {
      key: 'session_90_tumbling_first',
      name: '90-Minute Tumbling First',
      summary: 'Extended skill/tumbling block early (~22 min) with reduced or zero dedicated fitness — tumbling while fresh.',
    },
    {
      key: 'session_90_tumbling_end',
      name: '90-Minute Tumbling End',
      summary: 'Training blocks first; tumbling block later (~30 min) when session design prioritizes strength/speed before skill volume.',
    },
    {
      key: 'session_120_speed_addon',
      name: '120-Minute Tumbling First + Speed Add-On',
      summary: 'Tumbling first, then expanded output (~30 min speed focus + additional output) before capacity and control.',
    },
    {
      key: 'session_120_fitness_addon',
      name: '120-Minute Tumbling First + Sustained Capacity Add-On',
      summary: 'Sensitive work first; ~30 min Sustained Capacity add-on placed late after capacity and control.',
    },
  ],
  placementRules: [
    'Speed add-ons belong early after prepare and tumbling reset — neural output decays with fatigue.',
    'Sustained Capacity add-ons belong late — conditioning intentionally compromises freshness for repeatability.',
    'Tumbling-first models protect landing quality; tumbling-end models require stronger prepare and output discipline.',
  ],
  misuse: `Stretching a 60-minute template into 90 minutes by adding random circuits, or placing a fitness add-on before output “to get it done,” defeats the model’s purpose.`,
} as const

export const VALIDATION_RULES_HUB = {
  title: 'Validation Rules — philosophy encoded as guardrails',
  intro: `Validation rules are the app’s coaching conscience. Global rules protect phase order, freshness after fatigue, HIIT-before-skill/output, and static flex before power. Cluster rules (Prepare lower leg, Skill tumbling, Output acceleration/elastic/jump power, etc.) encode progression prerequisites and stop rules when watch notes or programming violate cluster intent. Errors block incoherent sequencing; warnings flag fatigue-sensitive misplacement; recommendations suggest regressions.`,
  categories: [
    {
      name: 'Global session rules',
      examples: 'phase_order_violation, freshness_required_after_fatigue, hiit_before_skill_output, static_flex_before_output',
    },
    {
      name: 'Prepare & Access cluster rules',
      examples: 'prepare_subrole_sequence, prepare_pogos_output_dose, prepare_lower_leg_readiness',
    },
    {
      name: 'Skill cluster rules',
      examples: 'skill_tumbling_readiness, skill_sprint_readiness, skill_perception_readiness',
    },
    {
      name: 'Output cluster rules',
      examples: 'output_acceleration_readiness, output_max_velocity_readiness, output_elastic_readiness, output_jump_power_readiness',
    },
  ],
  principles: [
    'Freshness-sensitive work must not follow phases that create high fatigue cost.',
    'Progression prerequisites are enforced — rebound variants require stick competency.',
    'Quality drop stop rules end sets when speed, height, throw velocity, or landing quality declines.',
    'Coaches can override warnings with rationale; errors reflect non-negotiable phase role violations.',
  ],
  misuse: `Ignoring validation warnings and overriding every alert trains athletes the way traditional workouts do — hard for the sake of hard, without respecting sequencing science.`,
} as const
