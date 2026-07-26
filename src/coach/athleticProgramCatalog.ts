export type AthleticProgramCategory = 'Performance goal' | 'Full-body equipment'
export type AthleticAgeBracket = '8–11' | '12–14' | '15–18' | '19+'
export type SessionComponentKind =
  | 'Neural / skill'
  | 'Speed'
  | 'Power'
  | 'Strength'
  | 'Core'
  | 'Mobility'
  | 'Carry'

export interface AthleticSessionComponent {
  name: string
  dose: string
  kind: SessionComponentKind
  exerciseSearch: string
}

export interface AthleticProgramSession {
  key: 'A' | 'B' | 'C'
  title: string
  intent: string
  components: AthleticSessionComponent[]
}

export interface AthleticProgramBlock {
  weeks: '1–4' | '5–8' | '9–12'
  name: string
  intent: string
  progression: string
}

export interface AthleticProgram {
  id: string
  title: string
  shortTitle: string
  category: AthleticProgramCategory
  summary: string
  primaryGoal: string
  kpi: string
  equipment: string[]
  tags: string[]
  safetyNote?: string
  ageGuidance: Record<AthleticAgeBracket, string>
  blocks: AthleticProgramBlock[]
  sessions: AthleticProgramSession[]
}

const c = (
  name: string,
  dose: string,
  kind: SessionComponentKind,
  exerciseSearch = name,
): AthleticSessionComponent => ({ name, dose, kind, exerciseSearch })

const s = (
  key: 'A' | 'B' | 'C',
  title: string,
  intent: string,
  components: AthleticSessionComponent[],
): AthleticProgramSession => ({ key, title, intent, components })

const standardBlocks = (
  foundation: string,
  build: string,
  express: string,
): AthleticProgramBlock[] => [
  { weeks: '1–4', name: 'Foundation', intent: 'Learn positions and establish a repeatable baseline.', progression: foundation },
  { weeks: '5–8', name: 'Build', intent: 'Increase usable force, velocity, or complexity.', progression: build },
  { weeks: '9–12', name: 'Express', intent: 'Convert the new capacity into the program outcome.', progression: express },
]

const universalAgeGuidance = (
  foundation: string,
  development: string,
  performance: string,
  adult: string,
): Record<AthleticAgeBracket, string> => ({
  '8–11': foundation,
  '12–14': development,
  '15–18': performance,
  '19+': adult,
})

const strengthAgeGuidance = universalAgeGuidance(
  'Use 1–3 sets, bodyweight or light external load, RPE 5–6, and 3–4 good reps in reserve.',
  'Use 2–4 sets, mostly 6–12 reps, RPE 6–7, and progress only after two technically clean sessions.',
  'Use the full prescription at RPE 6–8. Lower-repetition work is reserved for technically competent athletes.',
  'Use the full prescription at RPE 6–8 and adjust volume to training history, recovery, and competition.',
)

const speedAgeGuidance = universalAgeGuidance(
  'Use races and 10–15 m repetitions with 60–90 seconds recovery. Keep the experience playful and crisp.',
  'Use 15–25 m repetitions with 90–150 seconds recovery and explicit deceleration coaching.',
  'Use 20–40 m repetitions with 2–4 minutes recovery and individualized technical feedback.',
  'Use 20–40 m repetitions with 2–4 minutes recovery; reduce total volume for new or masters sprinters.',
)

const jumpAgeGuidance = universalAgeGuidance(
  'Use 20–35 low/moderate contacts, stick landings, and no loaded jumps.',
  'Use 25–45 contacts. Add low reactive combinations only after consistent landing control.',
  'Use 30–55 contacts and full recovery. Loaded or depth variations require demonstrated competency.',
  'Use 25–60 contacts based on training history. Begin with Development volume if deconditioned.',
)

export const ATHLETIC_AGE_BRACKETS: AthleticAgeBracket[] = ['8–11', '12–14', '15–18', '19+']

export const ATHLETIC_PROGRAMS: AthleticProgram[] = [
  {
    id: 'rotational-strength',
    title: '12-Week Rotational Strength',
    shortTitle: 'Rotational Strength',
    category: 'Performance goal',
    summary: 'Builds hip-to-hand force transfer, rotational deceleration, and usable sport-position power on both sides.',
    primaryGoal: 'Rotational force production and control',
    kpi: 'Standing medicine-ball scoop toss distance or velocity, tested left and right.',
    equipment: ['Medicine ball', 'Band or cable', 'Dumbbell', 'Landmine optional'],
    tags: ['Rotation', 'Power', 'Core'],
    ageGuidance: universalAgeGuidance(
      'Use a 1–2 kg ball, band resistance, split stances, and deliberate catches.',
      'Use a 2–3 kg ball and add controlled steps, pivots, and unilateral loading.',
      'Typically use a 2–4 kg ball with reactive cues and higher strength loads.',
      'Typically use a 2–5 kg ball; choose mass that preserves sequencing and ball speed.',
    ),
    blocks: standardBlocks(
      'Use tall or split stances, pause at the catch, and throw at 70–80% intent.',
      'Add a step, pivot, or lateral transfer; raise throw intent to 80–90%.',
      'Use reactive partner cues or sport stances and a light ball at maximal safe velocity.',
    ),
    sessions: [
      s('A', 'Hip-to-hand force', 'Sequence force from the ground through the trunk into projection.', [
        c('Split-stance band lift', '3 × 8/side', 'Core'),
        c('Medicine-ball scoop toss', '4 × 3/side', 'Power', 'medicine ball scoop toss'),
        c('Goblet split squat', '3 × 8/side', 'Strength', 'goblet split squat'),
        c('Half-kneeling Pallof press', '3 × 8/side', 'Core', 'Pallof press'),
        c('Suitcase carry', '3 × 20 m/side', 'Carry'),
      ]),
      s('B', 'Decelerate rotation', 'Create and absorb transverse-plane force without losing alignment.', [
        c('Step-behind medicine-ball shot put', '4 × 3/side', 'Power', 'medicine ball shot put'),
        c('Cable or band chop', '3 × 8/side', 'Core', 'cable chop'),
        c('Lateral lunge', '3 × 8/side', 'Strength'),
        c('Tall-kneeling anti-rotation hold', '3 × 20 s/side', 'Core', 'anti rotation hold'),
        c('Dead bug pullover', '3 × 6/side', 'Core', 'dead bug'),
      ]),
      s('C', 'Transfer and express', 'Apply rotation from unilateral and athletic positions.', [
        c('Rotational wall toss', '5 × 3/side', 'Power', 'rotational medicine ball throw'),
        c('Landmine rotation or band pivot press', '3 × 6/side', 'Strength', 'landmine rotation'),
        c('Single-leg Romanian deadlift', '3 × 8/side', 'Strength', 'single leg RDL'),
        c('Side-plank row', '3 × 8/side', 'Core', 'side plank row'),
        c('Cross-body carry', '3 × 20 m/side', 'Carry', 'cross body carry'),
      ]),
    ],
  },
  {
    id: 'jump-power-height',
    title: '12-Week Jump Power & Height',
    shortTitle: 'Jump Power & Height',
    category: 'Performance goal',
    summary: 'Develops vertical, horizontal, and approach-jump output through landing skill, strength, and elastic progression.',
    primaryGoal: 'Jump height and lower-body power',
    kpi: 'Countermovement jump plus standing broad jump using the same device and arm rule.',
    equipment: ['Low hurdles', 'Box', 'Strength equipment'],
    tags: ['Jump', 'Power', 'Plyometric'],
    safetyNote: 'End the jump block after two poor landings or a visible loss of jump height.',
    ageGuidance: jumpAgeGuidance,
    blocks: standardBlocks(
      'Stick every landing, use low amplitude, and reset 3–5 seconds between repetitions.',
      'Add repeated pogo or hurdle rhythm; only qualified older athletes use very light loaded jumps.',
      'Use approach or cued jumps. Depth-drop-to-jump is earned through the landing gate.',
    ),
    sessions: [
      s('A', 'Vertical force', 'Build vertical projection from stable landing and squat strength.', [
        c('Snap-down', '3 × 3', 'Neural / skill'),
        c('Countermovement jump', '5 × 2', 'Power'),
        c('Squat variation', '4 × 6', 'Strength', 'squat'),
        c('Rear-foot-elevated split squat', '3 × 6/side', 'Strength'),
        c('Calf isometric hold', '3 × 25 s/side', 'Strength', 'calf isometric'),
      ]),
      s('B', 'Horizontal force', 'Project and absorb force horizontally while strengthening the posterior chain.', [
        c('Pogo jump', '3 × 10', 'Power', 'pogo'),
        c('Broad jump with stick', '5 × 2', 'Power', 'standing broad jump'),
        c('Romanian deadlift', '4 × 6', 'Strength'),
        c('Step-up', '3 × 8/side', 'Strength'),
        c('Dead bug', '3 × 8/side', 'Core'),
      ]),
      s('C', 'Approach and elastic', 'Connect short-contact elasticity to an approach jump.', [
        c('Low hurdle hop', '4 × 3', 'Power', 'hurdle hop'),
        c('Approach jump', '5 × 2', 'Power'),
        c('Hip thrust', '4 × 6', 'Strength'),
        c('Lateral lunge', '3 × 6/side', 'Strength'),
        c('Soleus raise', '3 × 12', 'Strength', 'bent knee calf raise'),
      ]),
    ],
  },
  {
    id: 'general-strength',
    title: '12-Week General Strength',
    shortTitle: 'Strength',
    category: 'Performance goal',
    summary: 'Builds the squat, hinge, push, pull, unilateral, carry, and trunk patterns required for durable athletic force.',
    primaryGoal: 'Full-body foundational strength',
    kpi: 'Technically consistent submaximal rep test in squat, push, hinge, and pull patterns.',
    equipment: ['Dumbbells', 'Kettlebell or trap bar', 'Bench', 'Pull-up or row station'],
    tags: ['Strength', 'Full body'],
    ageGuidance: strengthAgeGuidance,
    blocks: standardBlocks(
      'Use 8–12 reps, 3–4 reps in reserve, a controlled eccentric, and the athlete’s best pain-free range.',
      'Use 6–8 reps and add load in 2.5–5% steps after all repetitions are clean.',
      'Competent 15+ athletes may use 4–6 reps; younger athletes remain at 6–10.',
    ),
    sessions: [
      s('A', 'Squat + horizontal push/pull', 'Train force through a balanced full-body pattern menu.', [
        c('Goblet or front squat', '4 × 6–8', 'Strength', 'goblet squat'),
        c('Push-up or dumbbell bench press', '4 × 6–10', 'Strength', 'push up'),
        c('One-arm row', '4 × 8/side', 'Strength', 'single arm row'),
        c('Split squat', '3 × 8/side', 'Strength'),
        c('Farmer carry', '3 × 25 m', 'Carry'),
      ]),
      s('B', 'Hinge + vertical push/pull', 'Strengthen posterior chain and vertical upper-body patterns.', [
        c('Kettlebell or trap-bar deadlift', '4 × 6', 'Strength', 'kettlebell deadlift'),
        c('Half-kneeling press', '3 × 8/side', 'Strength'),
        c('Assisted pull-up', '4 × 6–8', 'Strength', 'assisted pull up'),
        c('Step-up', '3 × 8/side', 'Strength'),
        c('Pallof press', '3 × 8/side', 'Core'),
      ]),
      s('C', 'Total-body unilateral', 'Build unilateral leg strength with balanced upper-body work.', [
        c('Front-foot-elevated split squat', '4 × 6/side', 'Strength'),
        c('Hip thrust', '4 × 8', 'Strength'),
        c('Incline dumbbell press', '3 × 8', 'Strength', 'incline press'),
        c('Chest-supported row', '3 × 10', 'Strength'),
        c('Suitcase carry', '3 × 20 m/side', 'Carry'),
      ]),
    ],
  },
  {
    id: 'explosiveness',
    title: '12-Week Explosiveness',
    shortTitle: 'Explosiveness',
    category: 'Performance goal',
    summary: 'Trains rapid lower-body force, upper-body projection, and fresh total-body contrast work.',
    primaryGoal: 'Rate of force development',
    kpi: '10 m sprint plus medicine-ball chest throw or standing broad jump.',
    equipment: ['Medicine ball', 'Sled', 'Strength equipment'],
    tags: ['Power', 'Sprint', 'Throw'],
    ageGuidance: universalAgeGuidance(
      'Use throws, jumps, races, and simple strength; do not use complex loaded ballistic lifts.',
      'Use light medicine balls and technically simple push-press patterns under close coaching.',
      'Use the full plan; Olympic-lift derivatives require prior technical preparation.',
      'Use the full plan and choose ballistic variations consistent with training history.',
    ),
    blocks: standardBlocks(
      'Separate skill and strength, use long resets, and learn submaximal starts.',
      'Add a resisted sprint or light ballistic implement and one simple strength-power pairing.',
      'Use low-volume contrast work with maximal intent and minimal fatigue.',
    ),
    sessions: [
      s('A', 'Lower-body rate of force', 'Project rapidly from the ground and reinforce the force base.', [
        c('Wall switch', '3 × 5/side', 'Neural / skill', 'wall sprint switch'),
        c('10 m acceleration sprint', '6 reps', 'Speed', 'acceleration sprint'),
        c('Broad jump', '4 × 2', 'Power', 'standing broad jump'),
        c('Squat variation', '4 × 5', 'Strength', 'squat'),
        c('Sled push', '5 × 10 m', 'Strength'),
      ]),
      s('B', 'Upper-body projection', 'Express total-body power through throws and presses.', [
        c('Medicine-ball chest pass', '5 × 3', 'Power'),
        c('Overhead backward medicine-ball throw', '4 × 3', 'Power', 'overhead medicine ball throw'),
        c('Push press pattern', '4 × 5', 'Power', 'push press'),
        c('Pull-up or row', '4 × 6', 'Strength', 'pull up'),
        c('Split squat', '3 × 6/side', 'Strength'),
      ]),
      s('C', 'Total-body contrast', 'Pair high-force and high-velocity work without accumulating fatigue.', [
        c('Countermovement jump', '3 × 2', 'Power'),
        c('Squat variation', '3 × 4', 'Strength', 'squat'),
        c('Medicine-ball scoop toss', '4 × 3/side', 'Power'),
        c('Landmine press', '3 × 5/side', 'Strength'),
        c('15 m acceleration sprint', '5 reps', 'Speed', 'acceleration sprint'),
      ]),
    ],
  },
  {
    id: 'speed',
    title: '12-Week Speed',
    shortTitle: 'Speed',
    category: 'Performance goal',
    summary: 'Progresses acceleration, maximal velocity, and competitive speed transfer with full recovery.',
    primaryGoal: 'Linear sprint speed',
    kpi: '10 m sprint and flying 10 m, with surface, shoes, start, and timing method standardized.',
    equipment: ['Cones', 'Timing gates optional', 'Light sled', 'Wickets optional'],
    tags: ['Speed', 'Acceleration', 'Max velocity'],
    safetyNote: 'Stop after two repetitions below approximately 95% of the athlete’s best quality effort or when mechanics deteriorate.',
    ageGuidance: speedAgeGuidance,
    blocks: standardBlocks(
      'Learn posture, projection, and stop mechanics with 80–90% build-ups.',
      'Extend acceleration to 15–25 m, add fly 10s, and use only light resistance that preserves shape.',
      'Use competitive or cued starts and fly 10–20 m; reduce sprint volume in Week 11.',
    ),
    sessions: [
      s('A', 'Acceleration', 'Create horizontal projection and efficient early steps.', [
        c('Wall march and switch', '2 × 5/side', 'Neural / skill', 'wall sprint drill'),
        c('Falling start', '4 × 10 m', 'Speed'),
        c('Three-point start', '4 × 15 m', 'Speed', '3 point sprint start'),
        c('Sled march or push', '4 × 10 m', 'Strength', 'sled march'),
        c('Split squat', '3 × 6/side', 'Strength'),
      ]),
      s('B', 'Maximum velocity', 'Develop upright rhythm, stiffness, and front-side mechanics.', [
        c('A-skip', '2 × 15 m', 'Neural / skill'),
        c('Dribble run', '3 × 15 m', 'Neural / skill', 'dribble sprint'),
        c('Build-up plus flying 10 m', '5 reps', 'Speed', 'flying sprint'),
        c('Wicket run', '4 passes', 'Speed', 'wicket sprint'),
        c('Hamstring bridge', '3 × 8', 'Strength'),
      ]),
      s('C', 'Speed transfer', 'Apply sprint mechanics to pursuit, curves, and elastic projection.', [
        c('Pursuit or chase start', '6 × 10–15 m', 'Speed', 'chase sprint'),
        c('Curved sprint', '4 × 20 m', 'Speed'),
        c('Bounds', '3 × 10 m', 'Power', 'bounding'),
        c('Romanian deadlift', '3 × 6', 'Strength'),
        c('Calf and soleus raise', '3 × 10 each', 'Strength', 'calf raise'),
      ]),
    ],
  },
  {
    id: 'agility',
    title: '12-Week Agility',
    shortTitle: 'Agility',
    category: 'Performance goal',
    summary: 'Builds braking, planned direction change, and true reactive perception-action skill.',
    primaryGoal: 'Multidirectional speed and reactive agility',
    kpi: '5-10-5 shuttle plus coach-scored deceleration alignment and steps-to-stop.',
    equipment: ['Cones', 'Partner or visual cues'],
    tags: ['Agility', 'Deceleration', 'Reaction'],
    ageGuidance: universalAgeGuidance(
      'Use tag and mirror games, wide cutting angles, and short bouts with high success.',
      'Blend planned cuts with simple one-choice reactions and reinforce braking positions.',
      'Use the full plan with faster entries, sharper angles, and sport-relevant information.',
      'Use the full plan; manage entry speed and change-of-direction volume to joint history.',
    ),
    blocks: standardBlocks(
      'Use planned stops and cuts at 60–80% with clear center-of-mass control.',
      'Increase entry speed and progress to sharper angles, shuffle-to-sprint, and crossover.',
      'Use an unplanned visual cue, opponent, or sport-relevant space; keep bouts 3–8 seconds.',
    ),
    sessions: [
      s('A', 'Deceleration', 'Own the shapes and eccentric strength required to stop.', [
        c('Snap-down', '3 × 3', 'Neural / skill'),
        c('Run-to-stick', '5 × 5 m', 'Neural / skill', 'deceleration drill'),
        c('Lateral shuffle-to-stick', '4 ×/side', 'Neural / skill', 'lateral deceleration'),
        c('Lateral lunge', '3 × 8/side', 'Strength'),
        c('Copenhagen plank regression', '3 × 15 s/side', 'Core', 'Copenhagen plank'),
      ]),
      s('B', 'Planned change of direction', 'Apply controlled braking to repeatable cutting angles.', [
        c('45-degree cut', '4 ×/side', 'Speed', '45 degree cut'),
        c('90-degree cut', '4 ×/side', 'Speed', '90 degree cut'),
        c('5-10-5 shuttle technique', '4 reps', 'Speed', 'pro agility shuttle'),
        c('Split squat', '3 × 6/side', 'Strength'),
        c('Calf isometric hold', '3 × 25 s/side', 'Strength', 'calf isometric'),
      ]),
      s('C', 'Reactive agility', 'Read external information and select an efficient movement solution.', [
        c('Mirror drill', '5 × 8 s', 'Neural / skill'),
        c('Color or point-call reaction', '6 × 5–10 m', 'Neural / skill', 'reaction drill'),
        c('Partner gate race', '5 reps', 'Speed', 'gate reaction drill'),
        c('Single-leg Romanian deadlift', '3 × 6/side', 'Strength', 'single leg RDL'),
        c('Side plank', '3 × 20 s/side', 'Core'),
      ]),
    ],
  },
  {
    id: 'core-strength',
    title: '12-Week Core Strength',
    shortTitle: 'Core Strength',
    category: 'Performance goal',
    summary: 'Develops anti-extension, anti-rotation, lateral control, and integrated trunk strength through carries and limb motion.',
    primaryGoal: 'Trunk force transfer and positional control',
    kpi: 'Quality side-plank time capped at 60 seconds plus standardized loaded-carry distance.',
    equipment: ['Band or cable', 'Dumbbells or kettlebells'],
    tags: ['Core', 'Carry', 'Anti-rotation'],
    ageGuidance: universalAgeGuidance(
      'Use 15–25 second holds, short levers, light carries, and positional games.',
      'Use 20–35 second holds, moderate carries, and controlled marching or crawling.',
      'Use 20–45 second holds with harder levers, asymmetrical loads, and dynamic limb action.',
      'Use 20–45 second holds and load carries to the athlete’s bracing ability and training history.',
    ),
    blocks: standardBlocks(
      'Use short levers and static control with a complete exhale that preserves position.',
      'Progress lever length, unilateral load, crawling, and marching.',
      'Use dynamic limb action around a stable trunk and asymmetrical carries.',
    ),
    sessions: [
      s('A', 'Anti-extension', 'Resist excessive extension while the limbs move.', [
        c('Dead bug', '3 × 6/side', 'Core'),
        c('Body saw or long-lever plank', '3 × 15–30 s', 'Core', 'body saw'),
        c('Bear crawl', '3 × 10 m', 'Core'),
        c('Goblet squat', '3 × 8', 'Strength'),
        c('Farmer carry', '3 × 25 m', 'Carry'),
      ]),
      s('B', 'Anti-rotation and lateral', 'Control frontal and transverse forces under asymmetrical load.', [
        c('Pallof press', '3 × 8/side', 'Core'),
        c('Side plank', '3 × 20–40 s/side', 'Core'),
        c('Suitcase carry', '4 × 20 m/side', 'Carry'),
        c('Split squat', '3 × 8/side', 'Strength'),
        c('One-arm row', '3 × 8/side', 'Strength', 'single arm row'),
      ]),
      s('C', 'Integrated trunk', 'Transfer trunk control into kneeling, marching, pushing, and carrying.', [
        c('Half-kneeling chop or lift', '3 × 8/side', 'Core', 'half kneeling chop'),
        c('Bird-dog row', '3 × 6/side', 'Core', 'bird dog row'),
        c('Cross-body march', '3 × 10/side', 'Core', 'cross body march'),
        c('Push-up', '3 × 8', 'Strength'),
        c('Overhead carry', '3 × 15 m', 'Carry'),
      ]),
    ],
  },
  {
    id: 'plyometric',
    title: '12-Week Plyometric',
    shortTitle: 'Plyometric',
    category: 'Performance goal',
    summary: 'Progresses landing skill into elastic vertical, horizontal, lateral, and short-contact output.',
    primaryGoal: 'Reactive strength and elastic coordination',
    kpi: 'Reactive strength index when available; otherwise pogo consistency plus standing broad jump.',
    equipment: ['Low box', 'Low hurdles', 'Jump rope'],
    tags: ['Plyometric', 'Elasticity', 'Landing'],
    safetyNote: 'Contact targets are ceilings. Stop before landing quality or rebound height deteriorates.',
    ageGuidance: jumpAgeGuidance,
    blocks: standardBlocks(
      'Land, pause, and reset; emphasize low-amplitude extensive contacts.',
      'Use combinations of 2–3 contacts and progress bilateral work to controlled unilateral work.',
      'Use fast ground contacts. Low-box depth jumps require demonstrated landing competency.',
    ),
    sessions: [
      s('A', 'Landing and vertical elastic', 'Develop quiet landing control and repeated ankle stiffness.', [
        c('Snap-down', '3 × 3', 'Neural / skill'),
        c('Drop landing', '4 × 2', 'Neural / skill'),
        c('Pogo jump', '4 × 10', 'Power', 'pogo'),
        c('Squat jump', '4 × 2', 'Power'),
        c('Calf isometric hold', '3 × 25 s', 'Strength', 'calf isometric'),
      ]),
      s('B', 'Horizontal and lateral', 'Project and absorb force across two planes.', [
        c('Broad jump with stick', '4 × 2', 'Power', 'standing broad jump'),
        c('Skater bound with stick', '4 × 3/side', 'Power', 'lateral bound'),
        c('Lateral line hop', '3 × 8/side', 'Power', 'line hop'),
        c('Split squat', '3 × 6/side', 'Strength'),
        c('Adductor plank', '3 × 15 s/side', 'Core', 'Copenhagen plank'),
      ]),
      s('C', 'Reactive rhythm', 'Create short, repeatable contacts with consistent posture.', [
        c('Low hurdle hop', '5 × 3', 'Power', 'hurdle hop'),
        c('Jump-rope rhythm', '4 × 20 s', 'Power', 'jump rope'),
        c('Skip for height', '3 × 15 m', 'Power', 'power skip'),
        c('Hip hinge', '3 × 8', 'Strength'),
        c('Soleus raise', '3 × 12', 'Strength', 'bent knee calf raise'),
      ]),
    ],
  },
  {
    id: 'isometric-strength',
    title: '12-Week Isometric Strength',
    shortTitle: 'Isometric Strength',
    category: 'Performance goal',
    summary: 'Builds yielding positional endurance before progressing qualified athletes to short overcoming efforts.',
    primaryGoal: 'Angle-specific force and positional strength',
    kpi: 'Fixed-angle split-squat and calf hold, or force-time isometric pull when instrumentation is available.',
    equipment: ['Rack or immovable pins optional', 'Dumbbells', 'Pull-up station'],
    tags: ['Isometric', 'Tendon', 'Position'],
    safetyNote: 'Use normal breathing on yielding holds and avoid prolonged breath-holding.',
    ageGuidance: universalAgeGuidance(
      'Use 15–25 second yielding holds and position-based games; no maximal overcoming efforts.',
      'Use 20–35 second yielding holds and controlled moderate loads.',
      'Use yielding work plus supervised 3–6 second overcoming efforts after technical preparation.',
      'Use yielding and overcoming work according to training history and cardiovascular considerations.',
    ),
    blocks: standardBlocks(
      'Use yielding holds at mid-range for 15–30 seconds with smooth breathing.',
      'Progress lever or load and introduce submaximal overcoming efforts for qualified athletes.',
      'Qualified 15+ athletes use 3–6 second high-intent overcoming work at relevant joint angles.',
    ),
    sessions: [
      s('A', 'Lower-body yielding', 'Own lower-body positions under time and tension.', [
        c('Split-squat isometric hold', '4 × 20–30 s/side', 'Strength', 'split squat isometric'),
        c('Wall sit', '3 × 30 s', 'Strength'),
        c('Calf isometric hold', '3 × 25 s/side', 'Strength', 'calf isometric'),
        c('Push-up', '3 × 8', 'Strength'),
        c('Farmer carry', '3 × 20 m', 'Carry'),
      ]),
      s('B', 'Upper-body and trunk yielding', 'Build pulling, pushing, and lateral trunk positional strength.', [
        c('Push-up midpoint hold', '4 × 10–20 s', 'Strength', 'isometric push up'),
        c('Flexed-arm hang', '4 × 10–20 s', 'Strength'),
        c('Side plank', '3 × 20 s/side', 'Core'),
        c('Romanian deadlift', '3 × 8', 'Strength'),
        c('Suitcase carry', '3 × 20 m/side', 'Carry'),
      ]),
      s('C', 'Overcoming and angle specific', 'Produce force against an immovable constraint without grinding repetitions.', [
        c('Isometric mid-thigh pull', '5 × 3–5 s', 'Strength'),
        c('Isometric split squat against pins', '4 × 3–5 s/side', 'Strength', 'split squat isometric'),
        c('Pallof hold', '3 × 20 s/side', 'Core', 'Pallof isometric'),
        c('Row variation', '3 × 8', 'Strength', 'row'),
        c('Mobility reset', '5 minutes', 'Mobility', 'mobility flow'),
      ]),
    ],
  },
  {
    id: 'neural-training',
    title: '12-Week Neural Training',
    shortTitle: 'Neural Training',
    category: 'Performance goal',
    summary: 'Uses fresh, low-fatigue reaction, rhythm, coordination, balance, and perception-action work.',
    primaryGoal: 'Coordination and rapid movement selection',
    kpi: 'Reaction drill accuracy plus first-step time, balance errors, or rhythm-task completion.',
    equipment: ['Ball', 'Cones or floor lines', 'Partner'],
    tags: ['Reaction', 'Coordination', 'Perception'],
    ageGuidance: universalAgeGuidance(
      'Use game-heavy, one-cue/one-response sessions and prioritize success and enjoyment.',
      'Add two-choice reactions, faster rhythms, and mild dual tasks.',
      'Use sport-relevant information and uncertain cue timing while keeping bouts under 10 seconds.',
      'Use the full plan and adjust balance or reaction complexity to training and neurological history.',
    ),
    blocks: standardBlocks(
      'Use one cue and one response with predictable rhythm and a high success rate.',
      'Add two-choice reactions, faster rhythm, and a mild dual task.',
      'Use uncertain cue timing, an opponent, and sport-relevant decisions while fresh.',
    ),
    sessions: [
      s('A', 'Reaction and first step', 'Translate a simple external cue into a fast, organized first action.', [
        c('Ball-drop reaction', '6 reps', 'Neural / skill'),
        c('Partner point start', '6 × 5 m', 'Speed', 'point reaction sprint'),
        c('Rapid switch', '3 × 5/side', 'Neural / skill', 'wall sprint switch'),
        c('Low pogo', '3 × 10', 'Power', 'pogo'),
        c('Split squat', '3 × 6/side', 'Strength'),
      ]),
      s('B', 'Rhythm and coordination', 'Coordinate cyclical movement, crossing patterns, and object exchange.', [
        c('A-march and A-skip', '3 × 15 m', 'Neural / skill', 'A skip'),
        c('Floor-line rhythm patterns', '6 patterns', 'Neural / skill', 'agility ladder rhythm'),
        c('Cross-crawl', '3 × 20 s', 'Neural / skill'),
        c('Medicine-ball catch and toss', '4 × 5', 'Power', 'medicine ball catch'),
        c('Loaded carry', '3 × 20 m', 'Carry', 'farmer carry'),
      ]),
      s('C', 'Perception-action', 'Select movement from opponent, gate, and object information.', [
        c('Mirror drill', '5 × 6 s', 'Neural / skill'),
        c('Numbered gate call', '6 reps', 'Neural / skill', 'gate reaction drill'),
        c('Single-leg balance with toss', '3 × 20 s/side', 'Neural / skill', 'single leg balance ball toss'),
        c('Reactive jump', '4 × 2', 'Power'),
        c('Row and push-up pairing', '3 × 8 each', 'Strength', 'push up'),
      ]),
    ],
  },
  {
    id: 'mobility',
    title: '12-Week Mobility',
    shortTitle: 'Mobility',
    category: 'Performance goal',
    summary: 'Builds active, controlled range at the ankle, hip, thoracic spine, and shoulder, then integrates it into movement.',
    primaryGoal: 'Usable joint range with motor control',
    kpi: 'Knee-to-wall, active straight-leg raise, shoulder-flexion wall test, and pain-free squat depth.',
    equipment: ['Wall', 'Light dumbbell or kettlebell', 'Band optional'],
    tags: ['Mobility', 'Range', 'Control'],
    safetyNote: 'Never force range or stretch into sharp, radiating, or nerve-like symptoms.',
    ageGuidance: universalAgeGuidance(
      'Use crawling, reaching, squatting, and games through varied ranges rather than long passive holds.',
      'Use controlled repetitions and brief end-range isometrics.',
      'Add light loaded mobility after demonstrating pain-free active range.',
      'Use light loaded mobility and select ranges around injury history and daily readiness.',
    ),
    blocks: standardBlocks(
      'Find pain-free active range with slow breathing and low load.',
      'Add 10–20 second end-range isometrics and light load.',
      'Integrate the acquired range into squat, lunge, reach, crawl, and overhead patterns.',
    ),
    sessions: [
      s('A', 'Ankle and hip', 'Improve ankle dorsiflexion and multi-planar hip access.', [
        c('Knee-to-wall ankle mobilization', '2 × 8/side', 'Mobility', 'ankle dorsiflexion mobilization'),
        c('Calf eccentric', '3 × 8/side', 'Strength', 'eccentric calf raise'),
        c('90/90 hip switch', '3 × 6', 'Mobility'),
        c('Adductor rock-back', '2 × 8/side', 'Mobility'),
        c('Goblet squat pry', '3 × 20 s', 'Mobility'),
      ]),
      s('B', 'Thoracic and shoulder', 'Build thoracic rotation, scapular motion, and overhead access.', [
        c('Open book', '2 × 6/side', 'Mobility'),
        c('Quadruped thoracic rotation', '2 × 6/side', 'Mobility'),
        c('Wall slide', '3 × 8', 'Mobility'),
        c('Scapular push-up', '3 × 8', 'Strength'),
        c('Half-kneeling pulldown', '3 × 8', 'Strength'),
      ]),
      s('C', 'Integrated control', 'Own new range during loaded and coordinated full-body patterns.', [
        c('Cossack squat', '3 × 6/side', 'Mobility'),
        c('Controlled hip circle', '2 × 3/side', 'Mobility', 'hip CAR'),
        c('Split-squat ankle drive', '3 × 6/side', 'Mobility', 'split squat ankle mobility'),
        c('Overhead squat reach', '3 × 6', 'Mobility'),
        c('Loaded carry', '3 × 20 m', 'Carry', 'farmer carry'),
      ]),
    ],
  },
  {
    id: 'powerlifting-full-body',
    title: '12-Week Powerlifting-Inspired Full Body',
    shortTitle: 'Powerlifting',
    category: 'Full-body equipment',
    summary: 'Builds squat, bench, and deadlift skill and strength with age-appropriate substitutions and no routine missed repetitions.',
    primaryGoal: 'Full-body maximal-strength foundation',
    kpi: 'Clean submaximal 3–5RM estimate for experienced adults; rep-quality test for youth.',
    equipment: ['Barbell', 'Rack', 'Bench', 'Dumbbells', 'Pull-up station'],
    tags: ['Powerlifting', 'Barbell', 'Strength'],
    safetyNote: 'Competition lifts and low-repetition loading are limited to technically competent, skeletally mature athletes and adults.',
    ageGuidance: universalAgeGuidance(
      'Use goblet squat, push-up or dumbbell bench, and kettlebell deadlift for 2–3 × 8–12. No maximal testing.',
      'Use front squat to box, dumbbell bench, and trap-bar or kettlebell deadlift for 3 × 6–10. No maximal testing.',
      'Use barbell lifts only after a technique gate, normally with 3+ reps in reserve and no missed repetitions.',
      'Use the full plan. A supervised Week 12 3RM is optional only for experienced lifters.',
    ),
    blocks: standardBlocks(
      'Use 4–6 reps at RPE 6–7 and reduce volume 40% in Week 4.',
      'Use 3–5 reps at RPE 7–8 and reduce volume 40% in Week 8.',
      'Use 2–4 reps at RPE 7–8.5 with no misses; taper before the Week 12 assessment.',
    ),
    sessions: [
      s('A', 'Squat emphasis', 'Prioritize the competition or safest squat pattern with balanced assistance.', [
        c('Back squat or safety-bar squat', '4 × 5', 'Strength', 'back squat'),
        c('Paused bench press', '4 × 5', 'Strength'),
        c('Chest-supported row', '3 × 8', 'Strength'),
        c('Split squat', '3 × 8/side', 'Strength'),
        c('Pallof press', '3 × 8/side', 'Core'),
      ]),
      s('B', 'Bench emphasis', 'Build pressing strength while rehearsing a technically submaximal hinge.', [
        c('Bench press', '5 × 4', 'Strength'),
        c('Technique deadlift', '3 × 5', 'Strength', 'deadlift'),
        c('Pull-up', '4 × 6', 'Strength'),
        c('Dumbbell Romanian deadlift', '3 × 8', 'Strength'),
        c('Farmer carry', '3 × 25 m', 'Carry'),
      ]),
      s('C', 'Deadlift emphasis', 'Prioritize the hinge while maintaining squat and pressing exposure.', [
        c('Deadlift', '4 × 4', 'Strength'),
        c('Tempo squat', '3 × 6', 'Strength'),
        c('Close-grip bench press', '3 × 6', 'Strength'),
        c('One-arm row', '3 × 8/side', 'Strength', 'single arm row'),
        c('Side plank', '3 × 25 s/side', 'Core'),
      ]),
    ],
  },
  {
    id: 'kettlebell-full-body',
    title: '12-Week Kettlebell Full Body',
    shortTitle: 'Kettlebell',
    category: 'Full-body equipment',
    summary: 'Uses a kettlebell to train hinge, squat, push, pull, unilateral control, carries, and qualified ballistic power.',
    primaryGoal: 'Full-body kettlebell strength and power',
    kpi: 'Technically consistent hinge, rack, carry, and get-up progression at a repeatable RPE.',
    equipment: ['Kettlebells'],
    tags: ['Kettlebell', 'Full body', 'Strength'],
    safetyNote: 'Swings and cleans require demonstrated hinge control and qualified instruction.',
    ageGuidance: strengthAgeGuidance,
    blocks: standardBlocks(
      'Use the deadlift before the swing, half get-ups, 2–3 working sets, and RPE 5–6.',
      'Add the swing only after the hinge gate, introduce front-rack positions, and use RPE 6–7.',
      'Qualified 15+ athletes may use cleans, push press, or double-kettlebell work while preserving crisp technique.',
    ),
    sessions: [
      s('A', 'Hinge and push', 'Build the kettlebell hinge with horizontal pressing and full-body assistance.', [
        c('Kettlebell deadlift', '4 × 8', 'Strength'),
        c('One-arm kettlebell floor press', '3 × 8/side', 'Strength', 'kettlebell floor press'),
        c('Goblet squat', '3 × 10', 'Strength'),
        c('One-arm kettlebell row', '3 × 10/side', 'Strength', 'single arm kettlebell row'),
        c('Suitcase carry', '3 × 25 m/side', 'Carry'),
      ]),
      s('B', 'Squat and pull', 'Use rack, unilateral hinge, pull, and press patterns.', [
        c('Kettlebell goblet squat', '4 × 8', 'Strength', 'goblet squat'),
        c('Supported one-arm row', '4 × 8/side', 'Strength', 'single arm row'),
        c('Half-kneeling kettlebell press', '3 × 8/side', 'Strength', 'half kneeling press'),
        c('Single-leg kettlebell Romanian deadlift', '3 × 8/side', 'Strength', 'single leg RDL'),
        c('Front-rack carry', '3 × 20 m/side', 'Carry'),
      ]),
      s('C', 'Ballistic total body', 'Express a qualified hinge ballistically and connect it to total-body control.', [
        c('Two-hand kettlebell swing', '6 × 10', 'Power', 'kettlebell swing'),
        c('Kettlebell clean to rack', '4 × 5/side', 'Power', 'kettlebell clean'),
        c('Kettlebell reverse lunge', '3 × 8/side', 'Strength', 'reverse lunge'),
        c('Push-up', '3 × 8–12', 'Strength'),
        c('Turkish get-up', '3 × 1/side', 'Core'),
      ]),
    ],
  },
  {
    id: 'bodyweight-full-body',
    title: '12-Week Bodyweight Full Body',
    shortTitle: 'Bodyweight',
    category: 'Full-body equipment',
    summary: 'Builds complete-body strength through leverage, tempo, range, unilateral work, crawling, and safe pulling.',
    primaryGoal: 'Equipment-light full-body strength',
    kpi: 'Quality progression in squat, push-up, row or pull-up, split squat, bridge, and trunk control.',
    equipment: ['Pull-up bar or safe row station', 'Bench or step'],
    tags: ['Bodyweight', 'Calisthenics', 'Full body'],
    ageGuidance: strengthAgeGuidance,
    blocks: standardBlocks(
      'Use stable bilateral patterns, comfortable range, and a controlled three-second lowering phase.',
      'Progress to unilateral patterns, a lower push-up angle, and less assistance on pulling.',
      'Use longer levers, pauses, 1.5 repetitions, and greater safe range rather than endless repetitions.',
    ),
    sessions: [
      s('A', 'Squat, push, and core', 'Build foundational lower-body, pressing, and crawling strength.', [
        c('Tempo bodyweight squat', '4 × 10', 'Strength', 'bodyweight squat'),
        c('Push-up', '4 × 6–12', 'Strength'),
        c('Reverse lunge', '3 × 8/side', 'Strength'),
        c('Dead bug', '3 × 8/side', 'Core'),
        c('Bear crawl', '4 × 10 m', 'Core'),
      ]),
      s('B', 'Unilateral and pull', 'Balance unilateral leg strength with safe upper-body pulling.', [
        c('Split squat', '4 × 8/side', 'Strength'),
        c('Inverted row or assisted pull-up', '4 × 6–10', 'Strength', 'inverted row'),
        c('Single-leg bridge', '3 × 10/side', 'Strength', 'single leg glute bridge'),
        c('Side plank', '3 × 20–40 s/side', 'Core'),
        c('Crab walk', '3 × 10 m', 'Core'),
      ]),
      s('C', 'Athletic strength', 'Use quality full-body patterns without turning the session into a race.', [
        c('Bodyweight step-up', '3 × 10/side', 'Strength', 'step up'),
        c('Pike push-up', '3 × 6–10', 'Strength'),
        c('Hamstring walkout', '3 × 6', 'Strength'),
        c('Close-grip push-up', '3 × 6–10', 'Strength'),
        c('Hollow hold', '3 × 15–30 s', 'Core'),
      ]),
    ],
  },
  {
    id: 'dumbbell-full-body',
    title: '12-Week Dumbbell Full Body',
    shortTitle: 'Dumbbell',
    category: 'Full-body equipment',
    summary: 'Uses dumbbells for balanced bilateral, unilateral, horizontal, vertical, hinge, carry, and trunk training.',
    primaryGoal: 'Full-body dumbbell strength',
    kpi: 'Submaximal rep-quality test on dumbbell squat, press, row, and Romanian deadlift patterns.',
    equipment: ['Dumbbells', 'Bench or step'],
    tags: ['Dumbbell', 'Full body', 'Strength'],
    ageGuidance: strengthAgeGuidance,
    blocks: standardBlocks(
      'Use 8–12 reps, 3–4 reps in reserve, and controlled lowering.',
      'Use 6–10 reps and add load after completing the top of the range twice.',
      'Qualified 15+ athletes use 5–8 reps on primary lifts; younger athletes remain at 6–10.',
    ),
    sessions: [
      s('A', 'Squat, push, and pull', 'Train the foundational full-body patterns with balanced volume.', [
        c('Dumbbell front squat', '4 × 8', 'Strength'),
        c('Dumbbell bench or floor press', '4 × 8', 'Strength', 'dumbbell bench press'),
        c('One-arm dumbbell row', '4 × 8/side', 'Strength', 'single arm dumbbell row'),
        c('Dumbbell reverse lunge', '3 × 8/side', 'Strength', 'reverse lunge'),
        c('Dumbbell farmer carry', '3 × 25 m', 'Carry', 'farmer carry'),
      ]),
      s('B', 'Hinge and vertical', 'Build posterior-chain and vertical pressing strength.', [
        c('Dumbbell Romanian deadlift', '4 × 8', 'Strength'),
        c('Half-kneeling one-arm dumbbell press', '3 × 8/side', 'Strength', 'half kneeling press'),
        c('Dumbbell chest-supported row', '4 × 10', 'Strength', 'chest supported row'),
        c('Dumbbell step-up', '3 × 8/side', 'Strength', 'step up'),
        c('Dumbbell suitcase carry', '3 × 20 m/side', 'Carry', 'suitcase carry'),
      ]),
      s('C', 'Total-body unilateral', 'Challenge unilateral strength and trunk control across the body.', [
        c('Dumbbell split squat', '4 × 6/side', 'Strength', 'split squat'),
        c('Alternating dumbbell floor press', '3 × 8/side', 'Strength', 'dumbbell floor press'),
        c('Dumbbell single-leg Romanian deadlift', '3 × 8/side', 'Strength', 'single leg RDL'),
        c('Renegade-row regression', '3 × 6/side', 'Core', 'renegade row'),
        c('Dumbbell front-rack march', '3 × 20 steps', 'Carry', 'front rack march'),
      ]),
    ],
  },
  {
    id: 'barbell-full-body',
    title: '12-Week Barbell Full Body',
    shortTitle: 'Barbell',
    category: 'Full-body equipment',
    summary: 'Builds barbell technique and total-body strength through squat, hinge, press, pull, and qualified power patterns.',
    primaryGoal: 'Full-body barbell strength and technique',
    kpi: 'Technically consistent submaximal front squat, press, and deadlift rep-quality assessment.',
    equipment: ['Barbell or training bar', 'Rack', 'Bench', 'Landmine', 'Pull-up station'],
    tags: ['Barbell', 'Full body', 'Strength'],
    safetyNote: 'Foundation athletes use a dowel, training bar, or dumbbell equivalent. No routine missed repetitions.',
    ageGuidance: universalAgeGuidance(
      'Use a dowel, training bar, goblet squat, landmine press, and kettlebell deadlift for 1–3 × 8–12.',
      'Use a training bar and simple barbell patterns for 2–4 × 6–10 under direct supervision.',
      'Use the full plan after a technique gate, normally at RPE 6–8 with 2–4 reps in reserve.',
      'Use the full plan and adjust barbell variation to mobility, training history, and recovery.',
    ),
    blocks: standardBlocks(
      'Progress dowel or training bar to empty bar, use 6–10 reps, and repeat setup on every repetition.',
      'Use 5–8 reps at RPE 6–7 and add 2.5–5% only after two clean exposures.',
      'Qualified 15+ athletes may use 3–6 reps at RPE 7–8; younger athletes remain at 6–10.',
    ),
    sessions: [
      s('A', 'Squat emphasis', 'Build front-loaded squat skill with balanced push and pull work.', [
        c('Barbell front squat', '4 × 5–8', 'Strength', 'front squat'),
        c('Barbell bench press', '4 × 6–8', 'Strength', 'bench press'),
        c('Barbell row', '3 × 8', 'Strength'),
        c('Split squat', '3 × 8/side', 'Strength'),
        c('Dead bug', '3 × 8/side', 'Core'),
      ]),
      s('B', 'Hinge emphasis', 'Train the barbell hinge with shoulder-friendly vertical work.', [
        c('Barbell Romanian deadlift', '4 × 6–8', 'Strength', 'Romanian deadlift'),
        c('Landmine press', '4 × 8/side', 'Strength'),
        c('Assisted pull-up', '4 × 6', 'Strength', 'assisted pull up'),
        c('Barbell step-up', '3 × 8/side', 'Strength', 'step up'),
        c('Suitcase carry', '3 × 20 m/side', 'Carry'),
      ]),
      s('C', 'Total body', 'Connect hinge strength, qualified pressing power, and trunk control.', [
        c('Trap-bar or technique deadlift', '4 × 5', 'Strength', 'trap bar deadlift'),
        c('Barbell push press', '4 × 5', 'Power', 'push press'),
        c('Barbell hip thrust', '3 × 8', 'Strength', 'hip thrust'),
        c('Inverted row', '3 × 8', 'Strength'),
        c('Pallof press', '3 × 8/side', 'Core'),
      ]),
    ],
  },
]

export const WEEKLY_LOADING_GUIDE = [
  { week: 1, strength: 'Base sets −1 · RPE 5–6', output: '70–80% intent', action: 'Establish technique and KPI baseline.' },
  { week: 2, strength: 'Base sets · same load or +1 rep', output: '80–85% intent', action: 'Reinforce the primary cue.' },
  { week: 3, strength: 'Base sets · +2.5–5% after gate', output: '85–90% intent', action: 'Apply the first overload.' },
  { week: 4, strength: 'Volume −40% · RPE ≤6', output: 'Reps/contacts −35%', action: 'Consolidate and recheck.' },
  { week: 5, strength: 'Base sets · Block 2 variation', output: '85–90% intent', action: 'Teach the new progression.' },
  { week: 6, strength: 'Add one set to one primary move', output: '90–95% intent', action: 'Apply a volume overload.' },
  { week: 7, strength: 'Base sets · small load increase', output: '90–95% intent', action: 'Highest quality volume.' },
  { week: 8, strength: 'Volume −40% · RPE ≤6', output: 'Reps/contacts −40%', action: 'Consolidate.' },
  { week: 9, strength: 'Primary reps −2 · RPE 7–8', output: '95–100% intent', action: 'Express speed or force.' },
  { week: 10, strength: 'Same · load only if fast', output: '95–100% intent', action: 'Build specific quality.' },
  { week: 11, strength: 'Accessories −25% · no grinding', output: 'Reps −25% · full rest', action: 'Peak freshness.' },
  { week: 12, strength: 'Two light sessions', output: 'Full-rest KPI attempts', action: 'Assess and document the next plan.' },
] as const

