export const FLIP_FIT_PROGRAM_VERSION = 1

export const FLIP_FIT_AGE_BANDS = ['9-11', '12-14', '15-18'] as const
export type FlipFitAgeBand = (typeof FLIP_FIT_AGE_BANDS)[number]

export const FLIP_FIT_TENETS = [
  'Strength',
  'Explosiveness',
  'Speed',
  'Agility',
  'Flexibility and Mobility',
  'Balance',
  'Coordination',
  'Body Control',
] as const
export type FlipFitTenet = (typeof FLIP_FIT_TENETS)[number]

export type FlipFitPhaseKey =
  | 'prepare_and_access'
  | 'movement_intelligence'
  | 'output'
  | 'capacity'
  | 'sustained_capacity'
  | 'resilience'
  | 'restore'

export type FlipFitCardMatchStatus = 'reused' | 'alias' | 'new' | 'review'

export interface FlipFitAgePrescription {
  ageBand: FlipFitAgeBand
  role: 'regression' | 'foundation' | 'progression'
  variation: string
  dosage: string
  work: string
  rest: string
  intensity: string
  intent: string
  equipment: string[]
  scalingGuidance: string
  readinessGate: string
}

export interface FlipFitExerciseCard {
  id: string
  name: string
  aliases: string[]
  description: string
  instructions: string[]
  coachingCues: string[]
  commonErrors: string[]
  movementPattern: string
  phase: FlipFitPhaseKey | 'tumbling'
  methodology: string
  tenets: FlipFitTenet[]
  bodyRegions: string[]
  equipment: string[]
  impactLevel: 'low' | 'moderate' | 'high'
  freshnessRequirement: 'low' | 'moderate' | 'high'
  safetyNotes: string[]
  supervision: string
  prerequisites: string[]
  matchStatus: FlipFitCardMatchStatus
  ageScaling: Record<FlipFitAgeBand, FlipFitAgePrescription>
  under9EquipmentNote?: string
}

export interface FlipFitScheduledExercise {
  id: string
  cardId: string
  allocationMinutes: number
  movementFunction: string
  card: FlipFitExerciseCard
}

export interface FlipFitSessionPhase {
  key: FlipFitPhaseKey
  name: string
  durationMinutes: number
  objective: string
  exercises: FlipFitScheduledExercise[]
}

export interface FlipFitTumblingBlock {
  durationMinutes: 30
  objective: string
  exercises: FlipFitScheduledExercise[]
}

export interface FlipFitStressProfile {
  primaryRegion: string
  bodyRegions: string[]
  regionLoad: Record<string, number>
  impact: 1 | 2 | 3
  freshness: 1 | 2 | 3
  eccentricDemand: 1 | 2 | 3
  volume: 1 | 2 | 3
  evidence: {
    effectiveVolumeMinutes: number
    moderateImpactMinutes: number
    highImpactMinutes: number
    highFreshnessMinutes: number
    eccentricMinutes: number
    tempoMinutes: number
    restoreMinutes: number
    impactExercises: string[]
    eccentricExercises: string[]
  }
}

export interface FlipFitWeeklyStressSummary {
  bodyRegions: Array<{
    region: string
    load: number
    days: number
    peakDailyLoad: number
  }>
  impact: {
    lowDays: number
    moderateDays: number
    highDays: number
    exposureMinutes: number
  }
  recovery: {
    highFreshnessDays: number
    highEccentricDays: number
    highVolumeDays: number
    restoreMinutes: number
  }
}

export interface FlipFitTrainingDay {
  id: string
  weekNumber: number
  dayNumber: number
  dayName: string
  date: string
  movementFunction: string
  objective: string
  phases: FlipFitSessionPhase[]
  tumbling: FlipFitTumblingBlock
  athleticMinutes: 90
  totalMinutes: 120
  stress: FlipFitStressProfile
  tenets: FlipFitTenet[]
}

export interface FlipFitCoverageSummary {
  tenets: Record<FlipFitTenet, number>
  performanceBalance: Record<'Speed' | 'Agility' | 'Strength' | 'Power', number>
  bodyRegions: Record<string, number>
  equipment: string[]
  stress: FlipFitWeeklyStressSummary
}

export interface FlipFitProgramWeek {
  weekNumber: number
  dateRange: { start: string; end: string }
  movementFunction: string
  capacityFocus: string
  coachingObjective: string
  progression: string
  days: FlipFitTrainingDay[]
  coverage: FlipFitCoverageSummary
}

export interface FlipFitProgram {
  version: number
  name: 'Flip & Fit'
  startDate: string
  endDate: string
  weeks: FlipFitProgramWeek[]
  sessions: FlipFitTrainingDay[]
  exerciseCards: FlipFitExerciseCard[]
}

export interface FlipFitValidationIssue {
  code: string
  severity: 'error' | 'warning'
  message: string
  resolution: string
  sessionId?: string
}

export interface FlipFitValidationResult {
  valid: boolean
  checks: number
  errors: FlipFitValidationIssue[]
  warnings: FlipFitValidationIssue[]
}

interface ExerciseSeed {
  name: string
  regression: string
  progression: string
  equipment: string[]
  movementPattern: string
  bodyRegions: string[]
  tenets: FlipFitTenet[]
  methodology?: string
  aliases?: string[]
  matchStatus?: FlipFitCardMatchStatus
  cues?: string[]
  safety?: string[]
  prerequisites?: string[]
  regressionEquipment?: string[]
  progressionEquipment?: string[]
}

interface WeekSpec {
  movementFunction: string
  capacityFocus: string
  coachingObjective: string
  progression: string
  movement: ExerciseSeed[]
  output: ExerciseSeed[]
  capacity: ExerciseSeed[]
  resilience: ExerciseSeed[]
  tumbling: ExerciseSeed[]
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const

export const FLIP_FIT_PHASE_TEMPLATE = [
  { key: 'prepare_and_access', name: 'Prepare & Access', minutes: 10 },
  { key: 'movement_intelligence', name: 'Movement Intelligence', minutes: 20 },
  { key: 'output', name: 'Output', minutes: 20 },
  { key: 'capacity_slot', name: 'Capacity slot', minutes: 25 },
  { key: 'resilience', name: 'Resilience', minutes: 10 },
  { key: 'restore', name: 'Restore', minutes: 5 },
] as const

export const FLIP_FIT_ATHLETE_SETS = [
  {
    id: 'set-1',
    name: 'Athlete Set 1',
    blocks: [
      { label: 'Athletic workout', minutes: 90, order: 1 },
      { label: 'Shared tumbling', minutes: 30, order: 2 },
    ],
    totalMinutes: 120,
  },
  {
    id: 'set-2',
    name: 'Athlete Set 2',
    blocks: [
      { label: 'Shared tumbling', minutes: 30, order: 1 },
      { label: 'Athletic workout', minutes: 90, order: 2 },
    ],
    totalMinutes: 120,
  },
] as const

export const FLIP_FIT_EQUIPMENT_POLICY = {
  foundation: 'Ages 12–14 may use the full facility inventory when the selected load, setup, and technique meet the athlete’s readiness.',
  regression: 'Ages 9–11 may still use appropriately sized free weights and barbells; scale the variation, load, range, and decision demand before removing equipment by default.',
  progression: 'Ages 15–18 progress through quality, load, speed, range, or complexity—never through fatigue alone.',
  under9: 'Youth-size barbells are available for athletes younger than 9. They are an equipment option, not automatic load permission; use a separate readiness-based prescription with direct qualified supervision.',
} as const

const PHASE_NAMES: Record<FlipFitPhaseKey, string> = {
  prepare_and_access: 'Prepare & Access',
  movement_intelligence: 'Movement Intelligence',
  output: 'Output',
  capacity: 'Capacity',
  sustained_capacity: 'Sustained Capacity',
  resilience: 'Resilience',
  restore: 'Restore',
}

const OUTPUT_METHODS = new Set([
  'Plyometric',
  'Ballistic',
  'Overspeed',
  'Resisted — Speed/Power Application',
  'Assisted — Speed/Power Application',
  'Variable Resistance — Speed/Power Application',
  'Accommodating Resistance — Speed/Power Application',
])

const CAPACITY_METHODS = new Set([
  'Resisted — Strength Application',
  'Isometric — Strength Application',
  'Concentric-Focused',
  'Tempo-Controlled',
  'Paused',
  'Variable Resistance — Strength Application',
  'Accommodating Resistance — Strength Application',
  'Assisted or Scaled — Strength Application',
  'Eccentric-Focused — Strength Application',
])

function seed(
  name: string,
  regression: string,
  progression: string,
  options: Omit<ExerciseSeed, 'name' | 'regression' | 'progression'>,
): ExerciseSeed {
  return { name, regression, progression, ...options }
}

const movementDefaults = {
  equipment: ['Floor markers'],
  movementPattern: 'Movement skill',
  bodyRegions: ['Foot', 'Ankle', 'Hip', 'Trunk'],
  tenets: ['Balance', 'Coordination', 'Body Control'] as FlipFitTenet[],
  methodology: 'Skill acquisition',
  matchStatus: 'new' as FlipFitCardMatchStatus,
}

const outputDefaults = {
  equipment: ['Floor markers'],
  movementPattern: 'Explosive locomotion',
  bodyRegions: ['Foot', 'Ankle', 'Knee', 'Hip', 'Trunk'],
  tenets: ['Explosiveness', 'Speed', 'Coordination', 'Body Control'] as FlipFitTenet[],
  methodology: 'Plyometric',
  matchStatus: 'new' as FlipFitCardMatchStatus,
}

const capacityDefaults = {
  equipment: ['Dumbbell'],
  movementPattern: 'Strength',
  bodyRegions: ['Hip', 'Knee', 'Trunk'],
  tenets: ['Strength', 'Balance', 'Body Control'] as FlipFitTenet[],
  methodology: 'Resisted — Strength Application',
  matchStatus: 'reused' as FlipFitCardMatchStatus,
}

const resilienceDefaults = {
  equipment: ['Bodyweight'],
  movementPattern: 'Tissue capacity',
  bodyRegions: ['Foot', 'Ankle', 'Knee', 'Hip', 'Trunk'],
  tenets: ['Strength', 'Balance', 'Body Control'] as FlipFitTenet[],
  methodology: 'Tempo-Controlled',
  matchStatus: 'reused' as FlipFitCardMatchStatus,
}

const tumblingDefaults = {
  equipment: ['Panel mat'],
  movementPattern: 'Tumbling skill',
  bodyRegions: ['Wrist', 'Shoulder', 'Trunk', 'Hip', 'Ankle'],
  tenets: ['Flexibility and Mobility', 'Balance', 'Coordination', 'Body Control'] as FlipFitTenet[],
  methodology: 'Skill progression',
  matchStatus: 'new' as FlipFitCardMatchStatus,
  safety: ['Use a clear matted lane and stop when shape, orientation, or landing control is lost.'],
  prerequisites: ['Pain-free preparation positions', 'Understands the stop signal'],
}

function M(name: string, regression: string, progression: string, options: Partial<ExerciseSeed> = {}) {
  return seed(name, regression, progression, { ...movementDefaults, ...options })
}

function O(name: string, regression: string, progression: string, options: Partial<ExerciseSeed> = {}) {
  return seed(name, regression, progression, { ...outputDefaults, ...options })
}

function C(name: string, regression: string, progression: string, options: Partial<ExerciseSeed> = {}) {
  return seed(name, regression, progression, { ...capacityDefaults, ...options })
}

function R(name: string, regression: string, progression: string, options: Partial<ExerciseSeed> = {}) {
  return seed(name, regression, progression, { ...resilienceDefaults, ...options })
}

function T(name: string, regression: string, progression: string, options: Partial<ExerciseSeed> = {}) {
  return seed(name, regression, progression, { ...tumblingDefaults, ...options })
}

export const FLIP_FIT_WEEK_SPECS: WeekSpec[] = [
  {
    movementFunction: 'Balance and Body Control',
    capacityFocus: 'Unilateral strength and trunk stability',
    coachingObjective: 'Own stable shapes, recover position, and distinguish control from stillness.',
    progression: 'Move from supported positions to reaches, locomotion, perturbation, and independent recovery.',
    movement: [
      M('Single-leg clock reach', 'Kickstand clock reach', 'Reactive clock reach on a low beam', {
        aliases: ['Clock reach balance'],
        matchStatus: 'alias',
        regressionEquipment: ['Floor markers'],
        progressionEquipment: ['Low beam', 'Floor markers'],
      }),
      M('Low-beam walk and freeze', 'Floor-line walk and freeze', 'Low-beam walk with head turns', { equipment: ['Low beam', 'Floor markers'] }),
      M('Half-kneeling cross-body reach', 'Tall-kneeling reach', 'Half-kneeling reactive catch and reach', { bodyRegions: ['Hip', 'Trunk', 'Shoulder'], tenets: ['Balance', 'Coordination', 'Body Control'] }),
      M('Partner perturbation recover', 'Coach-point weight shift', 'Partner mirror perturbation recover', { tenets: ['Agility', 'Balance', 'Coordination', 'Body Control'], equipment: ['Partner'] }),
      M('Balance shape assessment', 'Supported balance shape check', 'Eyes-up multi-position balance assessment', { matchStatus: 'review' }),
    ],
    output: [
      O('Hop to stick', 'Step to single-leg stick', 'Multi-direction hop to reactive stick', { matchStatus: 'reused' }),
      O('Snap-down to athletic hold', 'Tall-to-quarter-squat stick', 'Snap-down to partner call', { matchStatus: 'reused' }),
      O('Lateral bound to stick', 'Lateral step and stick', 'Continuous lateral bound with final stick', { matchStatus: 'reused' }),
      O('Quick-feet to balance freeze', 'March to balance freeze', 'Reactive quick-feet to single-leg freeze', { tenets: ['Explosiveness', 'Speed', 'Agility', 'Balance', 'Coordination', 'Body Control'] }),
      O('Forward jump to target stick', 'Step-over target and stick', 'Single-leg forward hop to target stick', { matchStatus: 'reused' }),
    ],
    capacity: [
      C('Rear-foot supported split squat', 'Bodyweight split squat to pad', 'Front-rack barbell split squat', { equipment: ['Dumbbell', 'Kettlebell', 'Barbell', 'Pad'], bodyRegions: ['Hip', 'Knee', 'Trunk'] }),
      C('Single-leg Romanian deadlift', 'Kickstand Romanian deadlift', 'Contralateral barbell single-leg Romanian deadlift', { equipment: ['Dumbbell', 'Kettlebell', 'Barbell'], movementPattern: 'Hinge', bodyRegions: ['Foot', 'Ankle', 'Hip', 'Back', 'Trunk'], matchStatus: 'reused' }),
      C('Step-up with knee drive', 'Low step-up with support', 'Loaded high step-up with knee drive', { equipment: ['Box', 'Dumbbell', 'Kettlebell'], movementPattern: 'Lunge or split stance' }),
      C('Suitcase carry', 'Light short-distance suitcase carry', 'Heavy offset suitcase carry with march', { equipment: ['Dumbbell', 'Kettlebell'], movementPattern: 'Carry', bodyRegions: ['Grip', 'Shoulder', 'Trunk', 'Hip'], matchStatus: 'reused' }),
      C('Half-kneeling Pallof press', 'Tall-kneeling anti-rotation hold', 'Split-stance Pallof step-out', { equipment: ['Cable', 'Resistance band'], movementPattern: 'Anti-rotation', bodyRegions: ['Shoulder', 'Chest', 'Back', 'Trunk'], matchStatus: 'reused' }),
    ],
    resilience: [
      R('Single-leg calf raise hold', 'Two-leg calf raise hold', 'Loaded single-leg calf raise isometric', {
        equipment: ['Bodyweight', 'Support', 'Dumbbell'],
        bodyRegions: ['Foot', 'Ankle', 'Calf'],
        methodology: 'Isometric — Strength Application',
      }),
      R('Side plank short lever', 'Side-lying brace', 'Side plank with top-leg march', { bodyRegions: ['Shoulder', 'Trunk', 'Hip'], matchStatus: 'reused' }),
      R('Step-down control', 'Low heel tap with rail support', 'Loaded lateral step-down', { equipment: ['Low box', 'Dumbbell'], bodyRegions: ['Foot', 'Ankle', 'Knee', 'Hip'] }),
      R('Split-stance isometric', 'Supported shallow split-stance hold', 'Loaded long-lever split-stance hold', { methodology: 'Isometric — Strength Application', equipment: ['Dumbbell', 'Support'] }),
      R('Dead bug press-down', 'Heel-tap dead bug', 'Dead bug with band pulldown', { equipment: ['Resistance band'], bodyRegions: ['Shoulder', 'Trunk', 'Hip'], matchStatus: 'reused' }),
    ],
    tumbling: [
      T('Tuck roll to stand', 'Rocking tuck to squat', 'Tuck roll to controlled jump stick', { matchStatus: 'reused' }),
      T('Cartwheel hand-placement line', 'Sideways hand-step over panel mat', 'Cartwheel to lunge on a narrow line', { matchStatus: 'reused' }),
      T('Wall handstand body line', 'Incline plank body line', 'Wall handstand shoulder taps', { equipment: ['Wall', 'Panel mat'], matchStatus: 'reused' }),
      T('Forward roll shape series', 'Wedge-mat forward rock', 'Forward roll to immediate balance shape', { equipment: ['Wedge mat', 'Panel mat'] }),
      T('Landing shape circuit', 'Two-foot squat and freeze', 'Quarter-turn landing shape circuit', { matchStatus: 'reused' }),
    ],
  },
  {
    movementFunction: 'Rotation, Tumbling and Inversion',
    capacityFocus: 'Overhead support, scapular strength, and trunk position',
    coachingObjective: 'Control hollow, arch, side, and inverted shapes while preserving safe hand support.',
    progression: 'Move from floor shapes and supported rotation to connected inversion choices with clear prerequisites.',
    movement: [
      M('Hollow-to-arch roll', 'Tuck side roll', 'Hollow-to-arch roll with shape call', { equipment: ['Panel mat'], bodyRegions: ['Shoulder', 'Trunk', 'Hip'], matchStatus: 'reused' }),
      M('Cartwheel hand-placement rehearsal', 'Bench hand-step side transfer', 'Cartwheel entry and finish-lunge precision', { equipment: ['Floor line', 'Panel mat'], bodyRegions: ['Wrist', 'Shoulder', 'Trunk', 'Hip'], matchStatus: 'reused' }),
      M('Wall handstand line drill', 'Incline body-line hold', 'Toe-pull handstand line drill', { equipment: ['Wall', 'Panel mat'], bodyRegions: ['Wrist', 'Shoulder', 'Trunk'], matchStatus: 'reused' }),
      M('Directional roll choice', 'Coach-called side roll', 'Reactive roll-or-cartwheel lane choice', { equipment: ['Panel mat', 'Floor markers'], tenets: ['Agility', 'Flexibility and Mobility', 'Balance', 'Coordination', 'Body Control'] }),
      M('Inversion shape assessment', 'Incline support shape check', 'Freestanding kick-up shape assessment', { equipment: ['Panel mat', 'Wall'], matchStatus: 'review' }),
    ],
    output: [
      O('Handstand snap-down to stick', 'Incline snap-down step to stick', 'Handstand snap-down to rebound stick', { equipment: ['Panel mat', 'Low block'], methodology: 'Ballistic', bodyRegions: ['Wrist', 'Shoulder', 'Trunk', 'Hip', 'Ankle'], matchStatus: 'reused' }),
      O('Cartwheel speed line', 'Fast side hand-step over', 'Power cartwheel to rebound line', { equipment: ['Panel mat', 'Floor line'], methodology: 'Ballistic' }),
      O('Tuck jump quarter turn to stick', 'Pivot jump to stick', 'Tuck jump half turn to stick', { methodology: 'Plyometric' }),
      O('Reactive inversion entry', 'Coach-call bear position', 'Partner-call cartwheel or handstand entry', { equipment: ['Panel mat', 'Partner'], tenets: ['Explosiveness', 'Speed', 'Agility', 'Balance', 'Coordination', 'Body Control'], methodology: 'Ballistic' }),
      O('Roundoff entry rebound', 'Hurdle to cartwheel stick', 'Roundoff rebound to controlled landing', { equipment: ['Spring floor', 'Panel mat'], methodology: 'Plyometric', matchStatus: 'review', prerequisites: ['Consistent cartwheel line', 'Safe rebound landing', 'Direct tumbling supervision'] }),
    ],
    capacity: [
      C('Push-up', 'Hands-elevated push-up', 'Ring, feet-elevated, or loaded push-up', { equipment: ['Bodyweight', 'Bench', 'Rings', 'Weight vest'], movementPattern: 'Push', bodyRegions: ['Wrist', 'Shoulder', 'Chest', 'Trunk'], matchStatus: 'reused' }),
      C('Pike press', 'Box-supported pike hold', 'Feet-elevated pike press', { equipment: ['Box'], movementPattern: 'Push', bodyRegions: ['Wrist', 'Shoulder', 'Chest', 'Trunk'], matchStatus: 'reused' }),
      C('One-arm dumbbell row', 'Bench-supported light row', 'Split-stance heavy one-arm row', { equipment: ['Dumbbell', 'Bench'], movementPattern: 'Pull', bodyRegions: ['Grip', 'Shoulder', 'Back', 'Trunk'], matchStatus: 'reused' }),
      C('Hollow body hold', 'Tuck hollow hold', 'Hollow hold with overhead plate reach', { equipment: ['Bodyweight', 'Light plate'], movementPattern: 'Brace', bodyRegions: ['Shoulder', 'Trunk', 'Hip'], methodology: 'Isometric — Strength Application', matchStatus: 'reused' }),
      C('Front support shoulder tap', 'Incline front support hold', 'Ring front support shoulder tap', { equipment: ['Floor', 'Bench', 'Rings'], movementPattern: 'Upper-body support', bodyRegions: ['Wrist', 'Shoulder', 'Chest', 'Trunk'] }),
    ],
    resilience: [
      R('Wrist rocker series', 'Quadruped wrist weight shift', 'Long-lever wrist rocker with fingertip lift', { bodyRegions: ['Wrist', 'Forearm'], matchStatus: 'reused' }),
      R('Scapular push-up', 'Wall scapular glide', 'Ring scapular push-up', { equipment: ['Wall', 'Floor', 'Rings'], bodyRegions: ['Shoulder', 'Chest', 'Back'], matchStatus: 'reused' }),
      R('Arch body hold', 'Prone swimmer hold', 'Weighted arch body hold', { equipment: ['Bodyweight', 'Light plate'], bodyRegions: ['Shoulder', 'Back', 'Trunk', 'Hip'], methodology: 'Isometric — Strength Application', matchStatus: 'reused' }),
      R('Bilateral band external rotation', 'Light band external rotation', 'Split-stance cable external rotation', { equipment: ['Resistance band', 'Cable'], bodyRegions: ['Shoulder', 'Back'], matchStatus: 'reused' }),
      R('Finger pulses and palm lifts', 'Seated finger pulses', 'Loaded fingertip support prep', { bodyRegions: ['Wrist', 'Hand', 'Forearm'], matchStatus: 'reused' }),
    ],
    tumbling: [
      T('Forward roll to lunge', 'Wedge forward roll to squat', 'Forward roll to handstand kick-up setup', { equipment: ['Wedge mat', 'Panel mat'] }),
      T('Backward roll incline', 'Rock back to candle', 'Backward roll to push-up shape', { equipment: ['Wedge mat', 'Panel mat'], matchStatus: 'review' }),
      T('Cartwheel to finish lunge', 'Panel-mat cartwheel hand step', 'Cartwheel step-in connection', { equipment: ['Panel mat', 'Floor line'], matchStatus: 'reused' }),
      T('Handstand kick-up station', 'Donkey kick to stacked shoulders', 'Freestanding handstand kick-up and controlled exit', { equipment: ['Wall', 'Panel mat'], matchStatus: 'review' }),
      T('Roundoff shape pathway', 'Hurdle cartwheel pathway', 'Roundoff rebound connection', { equipment: ['Spring floor', 'Panel mat'], matchStatus: 'review', prerequisites: ['Consistent cartwheel', 'Hurdle-step control', 'Coach-approved roundoff readiness'] }),
    ],
  },
  {
    movementFunction: 'Locomotion and Running',
    capacityFocus: 'Single-leg gait strength and foot/ankle capacity',
    coachingObjective: 'Build efficient posture, rhythm, arm action, and foot strike across basic locomotor patterns.',
    progression: 'Move from marching and skipping rhythm to multi-direction locomotion and self-corrected running mechanics.',
    movement: [
      M('A-march mechanics', 'Wall-supported march', 'A-march with rhythmic switch call', { equipment: ['Floor markers', 'Wall'], movementPattern: 'Locomotion', tenets: ['Speed', 'Balance', 'Coordination', 'Body Control'], matchStatus: 'reused' }),
      M('Skipping rhythm drill', 'Step-hop rhythm line', 'A-skip with cadence change', { movementPattern: 'Locomotion', tenets: ['Speed', 'Balance', 'Coordination', 'Body Control'], matchStatus: 'reused' }),
      M('Lateral shuffle posture', 'Side-step posture line', 'Shuffle-to-crossover transition', { movementPattern: 'Locomotion', tenets: ['Speed', 'Agility', 'Balance', 'Coordination', 'Body Control'], matchStatus: 'reused' }),
      M('Mirror locomotion call', 'Coach-led direction walk', 'Partner mirror shuffle and backpedal', { equipment: ['Partner', 'Floor markers'], movementPattern: 'Reactive locomotion', tenets: ['Speed', 'Agility', 'Balance', 'Coordination', 'Body Control'] }),
      M('Running rhythm assessment', 'March-and-skip rhythm check', 'Self-selected build-up mechanics check', { movementPattern: 'Locomotion', tenets: ['Speed', 'Balance', 'Coordination', 'Body Control'], matchStatus: 'review' }),
    ],
    output: [
      O('Rhythm bound', 'Power skip for distance', 'Alternating bound with controlled contacts', { methodology: 'Plyometric', matchStatus: 'reused' }),
      O('Build-up sprint', 'Progressive 10-meter run', 'Progressive 25-meter build-up', { equipment: ['Cones'], methodology: 'Overspeed', movementPattern: 'Sprint', tenets: ['Explosiveness', 'Speed', 'Coordination', 'Body Control'] }),
      O('Fast skip burst', 'Quick march burst', 'A-skip to 10-meter acceleration', { methodology: 'Ballistic', matchStatus: 'reused' }),
      O('Reactive locomotion burst', 'Coach-call 5-meter run', 'Partner-call shuffle-to-sprint', { methodology: 'Ballistic', tenets: ['Explosiveness', 'Speed', 'Agility', 'Coordination', 'Body Control'] }),
      O('Stride rhythm relay', 'Short rhythm run with full recovery', 'Flying stride relay with full recovery', { equipment: ['Cones'], methodology: 'Overspeed' }),
    ],
    capacity: [
      C('Reverse lunge', 'Bodyweight reverse lunge with support', 'Front-rack barbell reverse lunge', { equipment: ['Bodyweight', 'Dumbbell', 'Barbell'], movementPattern: 'Lunge or split stance', matchStatus: 'reused' }),
      C('Step-up', 'Low supported step-up', 'Contralateral loaded step-up', { equipment: ['Box', 'Dumbbell', 'Kettlebell'], movementPattern: 'Lunge or split stance', matchStatus: 'reused' }),
      C('Standing calf raise', 'Two-leg calf raise with support', 'Single-leg loaded calf raise', { equipment: ['Support', 'Dumbbell'], movementPattern: 'Foot and ankle', bodyRegions: ['Foot', 'Ankle', 'Calf'], matchStatus: 'reused' }),
      C('Tibialis raise', 'Wall-supported short-range tibialis raise', 'Loaded tibialis raise', { equipment: ['Wall', 'Tib bar'], movementPattern: 'Foot and ankle', bodyRegions: ['Ankle', 'Shin'], matchStatus: 'reused' }),
      C('Contralateral farmer carry', 'Light march carry', 'Heavy contralateral carry with cadence', { equipment: ['Dumbbell', 'Kettlebell'], movementPattern: 'Carry', bodyRegions: ['Grip', 'Shoulder', 'Trunk', 'Hip'] }),
    ],
    resilience: [
      R('Bent-knee soleus raise', 'Supported two-leg soleus raise', 'Single-leg loaded soleus raise', { equipment: ['Bench', 'Dumbbell'], bodyRegions: ['Ankle', 'Calf'], matchStatus: 'reused' }),
      R('Short-foot drill', 'Seated short-foot drill', 'Single-leg short-foot balance', { bodyRegions: ['Foot', 'Ankle'], matchStatus: 'reused' }),
      R('Glute bridge march', 'Glute bridge hold', 'Long-lever glute bridge march', { bodyRegions: ['Hip', 'Hamstring', 'Trunk'], matchStatus: 'reused' }),
      R('Copenhagen plank short lever', 'Side-lying adductor lift', 'Copenhagen plank long lever', { equipment: ['Bench'], bodyRegions: ['Trunk', 'Hip', 'Adductor'] }),
      R('Toe yoga', 'Seated toe yoga', 'Standing single-leg toe yoga', { bodyRegions: ['Foot'], matchStatus: 'reused' }),
    ],
    tumbling: [
      T('Run-hurdle landing shapes', 'Step-hurdle to stick', 'Run-hurdle to rebound line', { equipment: ['Floor line', 'Panel mat'] }),
      T('Forward roll from lunge', 'Wedge roll from squat', 'Run-in forward roll to stand', { equipment: ['Wedge mat', 'Panel mat'] }),
      T('Cartwheel rhythm lane', 'Hand-step cartwheel lane', 'Connected cartwheel rhythm lane', { equipment: ['Panel mat', 'Floor line'] }),
      T('Handstand lunge entry', 'Donkey-kick lunge entry', 'Handstand lunge entry with controlled hold', { equipment: ['Wall', 'Panel mat'] }),
      T('Roundoff hurdle rehearsal', 'Hurdle to cartwheel', 'Run-hurdle roundoff rebound', { equipment: ['Spring floor', 'Panel mat'], matchStatus: 'review' }),
    ],
  },
  {
    movementFunction: 'Starts and Acceleration',
    capacityFocus: 'Horizontal force and hip-extension strength',
    coachingObjective: 'Create clean projection angles and powerful first steps from multiple start positions.',
    progression: 'Move from rehearsed lean-and-push shapes to timed and choice-based starts while preserving full recovery.',
    movement: [
      M('Wall acceleration march', 'Tall wall march hold', 'Wall switch with projection angle', { equipment: ['Wall'], movementPattern: 'Acceleration', tenets: ['Speed', 'Balance', 'Coordination', 'Body Control'], matchStatus: 'reused' }),
      M('Falling start hold', 'Lean-and-catch step', 'Falling start into three-step projection', { equipment: ['Cones'], movementPattern: 'Acceleration', tenets: ['Speed', 'Balance', 'Coordination', 'Body Control'], matchStatus: 'reused' }),
      M('Split-stance start rehearsal', 'Static split-stance push step', 'Split-stance start with arm-action constraint', { movementPattern: 'Acceleration', tenets: ['Speed', 'Coordination', 'Body Control'] }),
      M('Reactive start direction call', 'Coach-point walk start', 'Partner-call lateral or crossover start', { equipment: ['Partner', 'Cones'], movementPattern: 'Reactive acceleration', tenets: ['Speed', 'Agility', 'Balance', 'Coordination', 'Body Control'] }),
      M('First-three-step assessment', 'Two-step projection check', 'Timed first-three-step video check', { equipment: ['Cones'], movementPattern: 'Acceleration', tenets: ['Speed', 'Coordination', 'Body Control'], matchStatus: 'review' }),
    ],
    output: [
      O('Falling-start sprint', 'Falling start for 5 meters', 'Falling start for 15 meters', { equipment: ['Cones'], methodology: 'Ballistic', movementPattern: 'Sprint', matchStatus: 'reused' }),
      O('Split-stance acceleration', 'Split-stance 5-meter burst', 'Split-stance 15-meter acceleration', { equipment: ['Cones'], methodology: 'Ballistic', movementPattern: 'Sprint' }),
      O('Light sled acceleration', 'Partner-band march and release', 'Light sled 10-meter acceleration', { equipment: ['Sled', 'Resistance band'], methodology: 'Resisted — Speed/Power Application', movementPattern: 'Sprint' }),
      O('Reactive crossover start', 'Coach-call two-step crossover', 'Partner-call crossover 10-meter sprint', { equipment: ['Partner', 'Cones'], methodology: 'Ballistic', tenets: ['Explosiveness', 'Speed', 'Agility', 'Coordination', 'Body Control'] }),
      O('Three-start quality series', 'Two-position 5-meter start series', 'Three-position timed 10-meter start series', { equipment: ['Cones', 'Timing gates'], methodology: 'Ballistic', movementPattern: 'Sprint' }),
    ],
    capacity: [
      C('Front-foot elevated split squat', 'Bodyweight split squat', 'Barbell front-foot elevated split squat', { equipment: ['Low plate', 'Dumbbell', 'Barbell'], movementPattern: 'Lunge or split stance', matchStatus: 'reused' }),
      C('Barbell hip thrust', 'Floor glute bridge', 'Paused heavy barbell hip thrust', {
        equipment: ['Barbell', 'Bench', 'Pad'],
        movementPattern: 'Hinge',
        bodyRegions: ['Hip', 'Hamstring', 'Trunk'],
        matchStatus: 'reused',
        regressionEquipment: ['Floor', 'Panel mat'],
        progressionEquipment: ['Barbell', 'Bench', 'Pad'],
      }),
      C('Trap-bar deadlift', 'Kettlebell deadlift from blocks', 'Low-handle trap-bar deadlift', { equipment: ['Trap bar', 'Kettlebell', 'Blocks'], movementPattern: 'Hinge', bodyRegions: ['Grip', 'Back', 'Trunk', 'Hip', 'Knee'], matchStatus: 'reused' }),
      C('Sled push', 'Light sled march', 'Heavy controlled sled push', { equipment: ['Sled'], movementPattern: 'Horizontal force', bodyRegions: ['Shoulder', 'Trunk', 'Hip', 'Knee', 'Calf'], methodology: 'Concentric-Focused', matchStatus: 'reused' }),
      C('Bent-knee calf raise', 'Two-leg supported soleus raise', 'Single-leg loaded soleus raise', { equipment: ['Bench', 'Dumbbell'], movementPattern: 'Foot and ankle', bodyRegions: ['Ankle', 'Calf'], matchStatus: 'reused' }),
    ],
    resilience: [
      R('Hamstring bridge walkout', 'Glute bridge heel slide', 'Long-lever hamstring bridge walkout', { bodyRegions: ['Hamstring', 'Hip', 'Trunk'] }),
      R('Half-kneeling hip-flexor isometric', 'Tall-kneeling hip lock', 'Standing band-resisted hip lock', { equipment: ['Resistance band'], bodyRegions: ['Hip', 'Trunk'], methodology: 'Isometric — Strength Application' }),
      R('Tibialis raise', 'Wall-supported tibialis raise', 'Loaded tibialis raise', { equipment: ['Wall', 'Tib bar'], bodyRegions: ['Ankle', 'Shin'], matchStatus: 'reused' }),
      R('Split-squat eccentric lower', 'Supported shallow split-squat lower', 'Loaded five-second split-squat lower', { equipment: ['Support', 'Dumbbell'], methodology: 'Eccentric-Focused — Strength Application' }),
      R('Prone Y-T raise', 'Floor scapular reach', 'Incline loaded Y-T raise', { equipment: ['Bench', 'Light dumbbell'], bodyRegions: ['Shoulder', 'Back', 'Trunk'] }),
    ],
    tumbling: [
      T('Hurdle step to lunge', 'Step-together hurdle shape', 'Run-hurdle to lunge with arm timing', { equipment: ['Floor line'] }),
      T('Cartwheel entry acceleration', 'Side lunge to hand-step', 'Run-in cartwheel to lunge', { equipment: ['Panel mat', 'Floor line'] }),
      T('Handstand snap-down pathway', 'Incline support step-down', 'Handstand snap-down to rebound', { equipment: ['Panel mat', 'Low block'], matchStatus: 'reused' }),
      T('Roundoff run-in shapes', 'Hurdle cartwheel shapes', 'Run-hurdle roundoff rebound', { equipment: ['Spring floor', 'Panel mat'], matchStatus: 'review' }),
      T('Forward tumbling punch shape', 'Straight jump punch to stick', 'Dive-roll or front-handspring entry shape', { equipment: ['Spring floor', 'Wedge mat'], matchStatus: 'review', prerequisites: ['Coach-approved forward tumbling readiness', 'Reliable hand support and landing'] }),
    ],
  },
  {
    movementFunction: 'Max-Velocity Sprinting',
    capacityFocus: 'Posterior-chain and upright sprint support',
    coachingObjective: 'Develop upright sprint posture, front-side rhythm, stiffness, and relaxed high-speed mechanics.',
    progression: 'Move from dribbles and wicket rhythm to short fly zones; increase speed exposure without chasing fatigue.',
    movement: [
      M('A-run rhythm', 'A-march to low A-skip', 'A-run with wicket entry', { equipment: ['Mini hurdles'], movementPattern: 'Sprint mechanics', tenets: ['Speed', 'Balance', 'Coordination', 'Body Control'], matchStatus: 'reused' }),
      M('Ankle dribble series', 'Low marching dribble', 'Fast dribble into upright run', { equipment: ['Cones'], movementPattern: 'Sprint mechanics', tenets: ['Speed', 'Balance', 'Coordination', 'Body Control'] }),
      M('Wicket walk-run', 'Walk-over mini-hurdle rhythm', 'Progressive wicket run', { equipment: ['Mini hurdles'], movementPattern: 'Sprint mechanics', tenets: ['Speed', 'Balance', 'Coordination', 'Body Control'], matchStatus: 'reused' }),
      M('Reactive cadence call', 'Coach-clap march cadence', 'Partner-called fast or float cadence', { equipment: ['Partner'], movementPattern: 'Reactive sprint rhythm', tenets: ['Speed', 'Agility', 'Balance', 'Coordination', 'Body Control'] }),
      M('Upright sprint mechanics check', 'Posture and arm-action check', 'Video-assisted fly-zone mechanics check', { equipment: ['Cones'], movementPattern: 'Sprint mechanics', tenets: ['Speed', 'Coordination', 'Body Control'], matchStatus: 'review' }),
    ],
    output: [
      O('Flying sprint', '10-meter build plus 5-meter fly', '20-meter build plus 15-meter fly', { equipment: ['Cones', 'Timing gates'], methodology: 'Overspeed', movementPattern: 'Sprint', matchStatus: 'reused' }),
      O('Wicket sprint', 'Low-speed wicket run', 'Fast wicket run into 10-meter fly', { equipment: ['Mini hurdles'], methodology: 'Overspeed', movementPattern: 'Sprint', matchStatus: 'reused' }),
      O('Assisted cadence run', 'Partner cadence chase without tether', 'Very light assisted sprint with expert coach', { equipment: ['Partner', 'Sprint assistance'], methodology: 'Assisted — Speed/Power Application', movementPattern: 'Sprint', matchStatus: 'review', prerequisites: ['Stable upright sprint mechanics', 'Specialist coach and safe run-out'] }),
      O('Reactive fly-in', 'Coach-call build-up run', 'Partner-call float-or-fly sprint', { equipment: ['Partner', 'Cones'], methodology: 'Overspeed', tenets: ['Explosiveness', 'Speed', 'Agility', 'Coordination', 'Body Control'] }),
      O('Fast-relaxed stride', 'Short relaxed stride', 'Timed fast-relaxed fly with full recovery', { equipment: ['Cones', 'Timing gates'], methodology: 'Overspeed', movementPattern: 'Sprint' }),
    ],
    capacity: [
      C('Barbell Romanian deadlift', 'Kettlebell Romanian deadlift', 'Heavy controlled barbell Romanian deadlift', { equipment: ['Barbell', 'Kettlebell'], movementPattern: 'Hinge', bodyRegions: ['Grip', 'Back', 'Trunk', 'Hip', 'Hamstring'], matchStatus: 'reused' }),
      C('Slider hamstring curl', 'Bridge heel slide', 'Single-leg slider hamstring curl', { equipment: ['Sliders'], movementPattern: 'Hinge', bodyRegions: ['Hamstring', 'Hip', 'Trunk'], matchStatus: 'reused' }),
      C('Standing cable hip-flexor lift', 'Wall hip-lock hold', 'Cable hip-flexor lift with contralateral load', { equipment: ['Cable', 'Wall'], movementPattern: 'Gait strength', bodyRegions: ['Hip', 'Trunk'] }),
      C('Seated soleus raise', 'Bodyweight seated soleus raise', 'Heavy barbell seated soleus raise', { equipment: ['Bench', 'Barbell', 'Pad'], movementPattern: 'Foot and ankle', bodyRegions: ['Ankle', 'Calf'], matchStatus: 'reused' }),
      C('Front-rack carry', 'Goblet carry', 'Heavy barbell front-rack carry', { equipment: ['Kettlebell', 'Barbell'], movementPattern: 'Carry', bodyRegions: ['Grip', 'Shoulder', 'Back', 'Trunk', 'Hip'] }),
    ],
    resilience: [
      R('Nordic hamstring lower', 'Band-assisted short-range Nordic lower', 'Full-range controlled Nordic lower', { equipment: ['Nordic anchor', 'Resistance band'], bodyRegions: ['Hamstring', 'Knee', 'Hip'], methodology: 'Eccentric-Focused — Strength Application', matchStatus: 'reused', prerequisites: ['Coach-controlled range', 'No posterior-knee symptoms'] }),
      R('Soleus isometric hold', 'Two-leg bent-knee calf hold', 'Single-leg loaded soleus hold', { equipment: ['Wall', 'Dumbbell'], bodyRegions: ['Ankle', 'Calf'], methodology: 'Isometric — Strength Application' }),
      R('Hip airplane support', 'Supported hip airplane', 'Hands-free hip airplane', { equipment: ['Support'], bodyRegions: ['Foot', 'Ankle', 'Hip', 'Trunk'] }),
      R('Dead bug heel tap', 'Short-lever dead bug', 'Dead bug with overhead pulldown', { equipment: ['Resistance band'], bodyRegions: ['Shoulder', 'Trunk', 'Hip'], matchStatus: 'reused' }),
      R('Wall slide with lift-off', 'Wall slide', 'Prone loaded lift-off', { equipment: ['Wall', 'Light plate'], bodyRegions: ['Shoulder', 'Back'], matchStatus: 'reused' }),
    ],
    tumbling: [
      T('Fast hurdle cartwheel', 'Step-hurdle cartwheel', 'Run-hurdle cartwheel rebound', { equipment: ['Spring floor', 'Panel mat'] }),
      T('Handstand line to snap-down', 'Wall handstand step-down', 'Freestanding handstand snap-down', { equipment: ['Wall', 'Panel mat'], matchStatus: 'reused' }),
      T('Roundoff rebound rhythm', 'Cartwheel snap-together drill', 'Roundoff multiple-rebound connection', { equipment: ['Spring floor', 'Panel mat'], matchStatus: 'review' }),
      T('Backward roll to push support', 'Candle rock with hand placement', 'Backward roll to push-up shape', { equipment: ['Wedge mat', 'Panel mat'] }),
      T('Tumbling speed-control lane', 'Two-skill shape lane', 'Connected skill lane with controlled finish', { equipment: ['Spring floor', 'Panel mat'], matchStatus: 'review' }),
    ],
  },
  {
    movementFunction: 'Deceleration and Stopping',
    capacityFocus: 'Unilateral braking-force reserve',
    coachingObjective: 'Lower the center of mass, organize the trunk, and spread braking force across controlled steps.',
    progression: 'Move from planned sticks to faster entries, multiple approach angles, and late but safe stopping cues.',
    movement: [
      M('Linear deceleration stick', 'Walk-in two-step stop', 'Sprint-in three-step deceleration', { equipment: ['Cones'], movementPattern: 'Deceleration', tenets: ['Agility', 'Balance', 'Coordination', 'Body Control'], matchStatus: 'reused' }),
      M('Shuffle stop mechanics', 'Side-step and freeze', 'Fast shuffle to crossover stop', { equipment: ['Cones'], movementPattern: 'Deceleration', tenets: ['Agility', 'Balance', 'Coordination', 'Body Control'] }),
      M('Drop-step braking rehearsal', 'Step-back squat hold', 'Drop-step to angled braking stance', { movementPattern: 'Deceleration', tenets: ['Agility', 'Balance', 'Coordination', 'Body Control'] }),
      M('Reactive stop signal', 'Coach-clap walk stop', 'Late color-call sprint stop', { equipment: ['Colored cones'], movementPattern: 'Reactive deceleration', tenets: ['Speed', 'Agility', 'Balance', 'Coordination', 'Body Control'] }),
      M('Deceleration quality assessment', 'Jog-to-stop posture check', 'Timed entry with braking-zone score', { equipment: ['Cones', 'Timing gates'], movementPattern: 'Deceleration', tenets: ['Speed', 'Agility', 'Balance', 'Coordination', 'Body Control'], matchStatus: 'review' }),
    ],
    output: [
      O('Sprint to stick', '5-meter run to two-step stick', '15-meter sprint to defined braking zone', { equipment: ['Cones'], methodology: 'Ballistic', movementPattern: 'Deceleration', matchStatus: 'reused' }),
      O('Shuffle to lateral stick', 'Side shuffle to wide-base stop', 'Fast shuffle to single-leg lateral stick', { equipment: ['Cones'], methodology: 'Plyometric', tenets: ['Explosiveness', 'Speed', 'Agility', 'Balance', 'Coordination', 'Body Control'] }),
      O('Drop jump to braking hold', 'Low step-off to squat hold', 'Low drop jump to single-leg braking hold', { equipment: ['Low box', 'Panel mat'], methodology: 'Plyometric', matchStatus: 'reused' }),
      O('Reactive sprint-stop', 'Coach-call run and stop', 'Partner chase with late safe stop call', { equipment: ['Partner', 'Cones'], methodology: 'Ballistic', tenets: ['Explosiveness', 'Speed', 'Agility', 'Balance', 'Coordination', 'Body Control'] }),
      O('Multi-angle stop series', 'Forward and lateral jog stops', 'Forward, lateral, and diagonal sprint stops', { equipment: ['Cones'], methodology: 'Ballistic', movementPattern: 'Deceleration' }),
    ],
    capacity: [
      C('Front-loaded squat', 'Goblet box squat', 'Barbell front squat', { equipment: ['Kettlebell', 'Barbell', 'Box'], movementPattern: 'Squat', matchStatus: 'reused' }),
      C('Rear-foot elevated split squat', 'Supported split squat', 'Heavy dumbbell rear-foot elevated split squat', { equipment: ['Bench', 'Dumbbell'], movementPattern: 'Lunge or split stance', matchStatus: 'reused' }),
      C('Controlled step-down', 'Low heel tap with rail', 'Loaded deficit step-down', { equipment: ['Low box', 'Dumbbell', 'Support'], movementPattern: 'Lunge or split stance', matchStatus: 'reused' }),
      C('Split-squat isometric', 'Supported shallow split-squat hold', 'Loaded front-foot elevated split-squat hold', { equipment: ['Support', 'Dumbbell', 'Low plate'], methodology: 'Isometric — Strength Application', movementPattern: 'Lunge or split stance', matchStatus: 'reused' }),
      C('Single-leg box squat', 'Supported sit-to-stand', 'Loaded single-leg box squat', { equipment: ['Box', 'Dumbbell', 'Support'], movementPattern: 'Squat' }),
    ],
    resilience: [
      R('Spanish squat hold', 'Wall sit', 'Loaded Spanish squat hold', { equipment: ['Resistance band', 'Wall', 'Light plate'], bodyRegions: ['Knee', 'Hip', 'Trunk'], methodology: 'Isometric — Strength Application' }),
      R('Single-leg landing isometric', 'Split-stance landing hold', 'Single-leg landing hold with reach', { bodyRegions: ['Foot', 'Ankle', 'Knee', 'Hip', 'Trunk'], methodology: 'Isometric — Strength Application' }),
      R('Bent-knee soleus raise', 'Supported two-leg soleus raise', 'Single-leg loaded soleus raise', { equipment: ['Bench', 'Dumbbell'], bodyRegions: ['Ankle', 'Calf'], matchStatus: 'reused' }),
      R('Lateral band walk', 'Short-step mini-band walk', 'Low-position long-step band walk', { equipment: ['Mini band'], bodyRegions: ['Hip', 'Knee'], matchStatus: 'reused' }),
      R('Forearm plank body saw', 'Front plank hold', 'Slider body saw', { equipment: ['Sliders'], bodyRegions: ['Shoulder', 'Chest', 'Back', 'Trunk'] }),
    ],
    tumbling: [
      T('Landing snap-down series', 'Tall-to-squat stick', 'Handstand snap-down to landing score', { equipment: ['Panel mat'], matchStatus: 'reused' }),
      T('Forward roll to controlled stop', 'Wedge roll to squat hold', 'Run-in roll to immediate lunge stop', { equipment: ['Wedge mat', 'Panel mat'] }),
      T('Cartwheel finish control', 'Hand-step to side-lunge freeze', 'Cartwheel to narrow finish-lunge freeze', { equipment: ['Panel mat', 'Floor line'] }),
      T('Roundoff rebound to stick', 'Cartwheel snap-together to stick', 'Roundoff rebound then controlled stick', { equipment: ['Spring floor', 'Panel mat'], matchStatus: 'review' }),
      T('Backward tumbling landing prep', 'Backward jump to stick', 'Back handspring snap-down landing station', { equipment: ['Spring floor', 'Spotting block'], matchStatus: 'review', prerequisites: ['Coach-approved backward tumbling readiness', 'Qualified hands-on spotter'] }),
    ],
  },
  {
    movementFunction: 'Change of Direction',
    capacityFocus: 'Lateral and multiplanar strength',
    coachingObjective: 'Brake, reposition, and reaccelerate through clean footwork at 45, 90, and 180 degrees.',
    progression: 'Move from preplanned cuts to controlled perception-action choices without sacrificing trunk or knee control.',
    movement: [
      M('45-degree cut rehearsal', 'Walk-in angle step', 'Approach-and-cut with visual exit target', { equipment: ['Cones'], movementPattern: 'Change of direction', tenets: ['Speed', 'Agility', 'Balance', 'Coordination', 'Body Control'], matchStatus: 'reused' }),
      M('90-degree plant and go', 'Lateral step to square', 'Three-step approach to 90-degree cut', { equipment: ['Cones'], movementPattern: 'Change of direction', tenets: ['Speed', 'Agility', 'Balance', 'Coordination', 'Body Control'] }),
      M('180-degree turn mechanics', 'Walk-in pivot return', 'Sprint-in 180 turn with chosen foot', { equipment: ['Cones'], movementPattern: 'Change of direction', tenets: ['Speed', 'Agility', 'Balance', 'Coordination', 'Body Control'] }),
      M('Color-call cut choice', 'Coach-point side step', 'Late color-call multi-angle cut', { equipment: ['Colored cones'], movementPattern: 'Reactive agility', tenets: ['Speed', 'Agility', 'Balance', 'Coordination', 'Body Control'] }),
      M('Change-of-direction assessment', 'Planned three-cone walk-through', 'Timed three-cone cut quality check', { equipment: ['Cones', 'Timing gates'], movementPattern: 'Change of direction', tenets: ['Speed', 'Agility', 'Balance', 'Coordination', 'Body Control'], matchStatus: 'review' }),
    ],
    output: [
      O('45-degree cut and reaccelerate', 'Jog-in 45-degree cut', 'Fast approach 45-degree cut to 10-meter exit', { equipment: ['Cones'], methodology: 'Ballistic', tenets: ['Explosiveness', 'Speed', 'Agility', 'Balance', 'Coordination', 'Body Control'], matchStatus: 'reused' }),
      O('Pro-agility quality rep', 'Three-cone shuffle touch', 'Timed pro-agility rep with full recovery', { equipment: ['Cones', 'Timing gates'], methodology: 'Ballistic', tenets: ['Explosiveness', 'Speed', 'Agility', 'Balance', 'Coordination', 'Body Control'] }),
      O('Crossover cut burst', 'Crossover step to 5-meter run', 'Reactive crossover cut to 10-meter sprint', { equipment: ['Cones'], methodology: 'Ballistic', tenets: ['Explosiveness', 'Speed', 'Agility', 'Coordination', 'Body Control'] }),
      O('Partner mirror cut', 'Coach-led mirror steps', 'Partner mirror cut and escape', { equipment: ['Partner', 'Cones'], methodology: 'Ballistic', tenets: ['Explosiveness', 'Speed', 'Agility', 'Balance', 'Coordination', 'Body Control'] }),
      O('Three-angle cut series', 'Two-angle planned cut series', 'Three-angle reactive cut series', { equipment: ['Colored cones'], methodology: 'Ballistic', tenets: ['Explosiveness', 'Speed', 'Agility', 'Balance', 'Coordination', 'Body Control'] }),
    ],
    capacity: [
      C('Lateral lunge', 'Supported shallow lateral lunge', 'Barbell or landmine lateral lunge', { equipment: ['Support', 'Dumbbell', 'Barbell', 'Landmine'], movementPattern: 'Lunge or split stance', matchStatus: 'reused' }),
      C('Cossack squat', 'Lateral box squat', 'Loaded full-range Cossack squat', { equipment: ['Box', 'Kettlebell'], movementPattern: 'Squat', bodyRegions: ['Hip', 'Knee', 'Adductor', 'Trunk'], matchStatus: 'reused' }),
      C('Crossover step-up', 'Low lateral step-up', 'Contralateral loaded crossover step-up', { equipment: ['Box', 'Dumbbell'], movementPattern: 'Lunge or split stance' }),
      C('Copenhagen row hold', 'Short-lever Copenhagen hold', 'Long-lever Copenhagen cable row', { equipment: ['Bench', 'Cable'], movementPattern: 'Pull and brace', bodyRegions: ['Grip', 'Shoulder', 'Back', 'Trunk', 'Hip', 'Adductor'], methodology: 'Isometric — Strength Application' }),
      C('Rotational front-rack carry', 'Goblet carry with turn', 'Heavy front-rack carry with controlled direction changes', { equipment: ['Kettlebell', 'Dumbbell', 'Barbell'], movementPattern: 'Carry and rotation', bodyRegions: ['Grip', 'Shoulder', 'Back', 'Trunk', 'Hip'] }),
    ],
    resilience: [
      R('Adductor side plank', 'Side-lying adductor squeeze', 'Long-lever Copenhagen plank', { equipment: ['Bench', 'Ball'], bodyRegions: ['Trunk', 'Hip', 'Adductor'] }),
      R('Lateral step-down', 'Supported low lateral heel tap', 'Loaded deficit lateral step-down', { equipment: ['Low box', 'Support', 'Dumbbell'], bodyRegions: ['Foot', 'Ankle', 'Knee', 'Hip'] }),
      R('Ankle inversion-eversion band control', 'Seated ankle alphabet', 'Standing band-resisted ankle control', { equipment: ['Resistance band'], bodyRegions: ['Foot', 'Ankle'] }),
      R('Pallof step-out hold', 'Tall-kneeling Pallof hold', 'Split-stance Pallof step-out with return', { equipment: ['Cable', 'Resistance band'], bodyRegions: ['Shoulder', 'Chest', 'Back', 'Trunk'], methodology: 'Isometric — Strength Application', matchStatus: 'reused' }),
      R('Hip airplane with support', 'Supported hip rotation reach', 'Hands-free hip airplane with pause', { equipment: ['Support'], bodyRegions: ['Foot', 'Ankle', 'Hip', 'Trunk'] }),
    ],
    tumbling: [
      T('Quarter-turn landing series', 'Pivot to two-foot stick', 'Half-turn jump to controlled stick', { equipment: ['Panel mat'] }),
      T('Cartwheel direction choice', 'Coach-point hand-step side transfer', 'Reactive left-or-right cartwheel to lunge', { equipment: ['Panel mat', 'Colored cones'] }),
      T('Roundoff line correction', 'Cartwheel snap-together line', 'Roundoff rebound with exit-direction call', { equipment: ['Spring floor', 'Floor line'], matchStatus: 'review' }),
      T('Handstand pirouette prep', 'Wall handstand weight shift', 'Quarter-pirouette handstand exit', { equipment: ['Wall', 'Panel mat'], matchStatus: 'review' }),
      T('Tumbling direction circuit', 'Roll and cartwheel direction circuit', 'Connected direction-change tumbling circuit', { equipment: ['Panel mat', 'Spring floor'], matchStatus: 'review' }),
    ],
  },
  {
    movementFunction: 'Landing and Force Absorption',
    capacityFocus: 'Force acceptance through the ankle, knee, and hip',
    coachingObjective: 'Receive force quietly with aligned joints, stable trunk position, and honest landing limits.',
    progression: 'Move from bilateral low-height landings to single-leg, lateral, and simple rebound decisions.',
    movement: [
      M('Drop squat stick', 'Tall-to-squat freeze', 'Drop squat with reach target', { equipment: ['Floor markers'], movementPattern: 'Landing', tenets: ['Balance', 'Coordination', 'Body Control'], matchStatus: 'reused' }),
      M('Forward jump landing rehearsal', 'Step-over and stick', 'Forward jump with distance choice and stick', { equipment: ['Floor markers'], movementPattern: 'Landing', tenets: ['Balance', 'Coordination', 'Body Control'], matchStatus: 'reused' }),
      M('Single-leg snap-down', 'Split-stance snap-down', 'Single-leg snap-down with reach', { movementPattern: 'Landing', tenets: ['Balance', 'Coordination', 'Body Control'], matchStatus: 'reused' }),
      M('Landing direction call', 'Coach-call squat direction', 'Late call forward or lateral landing', { equipment: ['Colored cones'], movementPattern: 'Reactive landing', tenets: ['Agility', 'Balance', 'Coordination', 'Body Control'] }),
      M('Landing quality assessment', 'Two-foot landing score', 'Multi-direction single-leg landing score', { equipment: ['Panel mat', 'Floor markers'], movementPattern: 'Landing', tenets: ['Balance', 'Coordination', 'Body Control'], matchStatus: 'review' }),
    ],
    output: [
      O('Low box drop to stick', 'Step-off low block to squat hold', 'Low box drop to single-leg stick', { equipment: ['Low box', 'Panel mat'], methodology: 'Plyometric', matchStatus: 'reused' }),
      O('Broad jump to stick', 'Two-foot jump over line to stick', 'Maximum-quality broad jump to measured stick', { equipment: ['Tape measure', 'Floor line'], methodology: 'Plyometric', matchStatus: 'reused' }),
      O('Lateral hop to stick', 'Lateral step-over to stick', 'Repeated lateral hop with final single-leg stick', { equipment: ['Floor line'], methodology: 'Plyometric', matchStatus: 'reused' }),
      O('Reactive landing call', 'Coach-call jump direction', 'Partner-call jump, rebound, or stick', { equipment: ['Partner', 'Colored cones'], methodology: 'Plyometric', tenets: ['Explosiveness', 'Speed', 'Agility', 'Balance', 'Coordination', 'Body Control'] }),
      O('Jump-stick-rebound contrast', 'Jump and hold', 'Jump-stick then one quality rebound', { equipment: ['Panel mat'], methodology: 'Plyometric' }),
    ],
    capacity: [
      C('Squat isometric against pins', 'Goblet squat hold to box', 'Barbell squat isometric against pins', { equipment: ['Box', 'Kettlebell', 'Barbell', 'Rack'], movementPattern: 'Squat', methodology: 'Isometric — Strength Application' }),
      C('Slow eccentric step-down', 'Supported low heel tap', 'Loaded five-second deficit step-down', { equipment: ['Low box', 'Support', 'Dumbbell'], movementPattern: 'Lunge or split stance', methodology: 'Eccentric-Focused — Strength Application', matchStatus: 'reused' }),
      C('Single-leg box squat', 'Supported sit-to-stand', 'Loaded single-leg box squat', { equipment: ['Box', 'Support', 'Dumbbell'], movementPattern: 'Squat' }),
      C('Seated soleus raise', 'Bodyweight soleus raise', 'Heavy barbell seated soleus raise', { equipment: ['Bench', 'Barbell', 'Pad'], movementPattern: 'Foot and ankle', bodyRegions: ['Ankle', 'Calf'], matchStatus: 'reused' }),
      C('Tempo goblet squat', 'Bodyweight box squat tempo', 'Barbell back squat with controlled eccentric', { equipment: ['Box', 'Kettlebell', 'Barbell'], movementPattern: 'Squat', methodology: 'Tempo-Controlled', matchStatus: 'reused' }),
    ],
    resilience: [
      R('Landing calf isometric', 'Two-leg calf hold', 'Single-leg calf hold after step-in', { bodyRegions: ['Foot', 'Ankle', 'Calf'], methodology: 'Isometric — Strength Application' }),
      R('Reverse Nordic short range', 'Tall-kneeling lean', 'Full-range controlled reverse Nordic', { equipment: ['Panel mat'], bodyRegions: ['Knee', 'Quadriceps', 'Hip'], methodology: 'Eccentric-Focused — Strength Application', matchStatus: 'reused' }),
      R('Hamstring slider eccentric', 'Two-leg heel slide', 'Single-leg slider eccentric', { equipment: ['Sliders'], bodyRegions: ['Hamstring', 'Hip', 'Trunk'], methodology: 'Eccentric-Focused — Strength Application' }),
      R('Scapular push-up hold', 'Wall protraction hold', 'Ring protraction hold', { equipment: ['Wall', 'Rings'], bodyRegions: ['Shoulder', 'Chest', 'Back', 'Trunk'], methodology: 'Isometric — Strength Application' }),
      R('Dead bug cross press', 'Dead bug heel tap', 'Loaded cross-body dead bug press', { equipment: ['Light plate'], bodyRegions: ['Shoulder', 'Trunk', 'Hip'], matchStatus: 'reused' }),
    ],
    tumbling: [
      T('Tumbling landing shapes', 'Straight jump to squat stick', 'Tuck jump to rebound or stick call', { equipment: ['Panel mat'] }),
      T('Forward roll exit landing', 'Wedge roll to squat hold', 'Forward roll to jump-stick connection', { equipment: ['Wedge mat', 'Panel mat'] }),
      T('Cartwheel finish landing', 'Hand-step to side-lunge hold', 'Cartwheel or aerial-prep finish stick', { equipment: ['Panel mat', 'Floor line'], matchStatus: 'review' }),
      T('Roundoff snap-down landing', 'Cartwheel snap-together stick', 'Roundoff rebound to defined landing zone', { equipment: ['Spring floor', 'Panel mat'], matchStatus: 'review' }),
      T('Backward tumbling snap-down', 'Backward jump to stick', 'Back handspring snap-down to controlled rebound', { equipment: ['Spring floor', 'Spotting block'], matchStatus: 'review', prerequisites: ['Coach-approved back handspring readiness', 'Qualified hands-on spotter'] }),
    ],
  },
  {
    movementFunction: 'Jumping and Takeoff',
    capacityFocus: 'Vertical and horizontal force production',
    coachingObjective: 'Coordinate countermovement, arm swing, stiffness, and projection for repeatable high-quality takeoffs.',
    progression: 'Move from bilateral jumps to approach, unilateral, and directional takeoffs while keeping contacts low.',
    movement: [
      M('Countermovement jump rehearsal', 'Squat-to-reach', 'Countermovement jump with arm-swing timing', { movementPattern: 'Jump takeoff', tenets: ['Explosiveness', 'Balance', 'Coordination', 'Body Control'] }),
      M('Broad jump projection drill', 'Rock-back broad-jump shape', 'Measured broad-jump projection rehearsal', { equipment: ['Floor line', 'Tape measure'], movementPattern: 'Jump takeoff', tenets: ['Explosiveness', 'Balance', 'Coordination', 'Body Control'] }),
      M('Single-leg takeoff step', 'Step-to-knee-drive balance', 'Three-step single-leg takeoff rehearsal', { equipment: ['Floor markers'], movementPattern: 'Jump takeoff', tenets: ['Explosiveness', 'Speed', 'Balance', 'Coordination', 'Body Control'] }),
      M('Reactive takeoff direction', 'Coach-point step and reach', 'Partner-call vertical, forward, or lateral takeoff', { equipment: ['Partner', 'Colored cones'], movementPattern: 'Reactive jumping', tenets: ['Explosiveness', 'Speed', 'Agility', 'Balance', 'Coordination', 'Body Control'] }),
      M('Jump takeoff assessment', 'Jump-and-stick shape check', 'Measured jump with takeoff and landing score', { equipment: ['Tape measure', 'Jump mat'], movementPattern: 'Jump takeoff', tenets: ['Explosiveness', 'Balance', 'Coordination', 'Body Control'], matchStatus: 'review' }),
    ],
    output: [
      O('Countermovement vertical jump', 'Squat jump to target', 'Maximum-quality countermovement jump', { equipment: ['Jump target', 'Jump mat'], methodology: 'Plyometric', matchStatus: 'reused' }),
      O('Broad jump', 'Standing line jump', 'Measured maximum-quality broad jump', { equipment: ['Tape measure', 'Floor line'], methodology: 'Plyometric', matchStatus: 'reused' }),
      O('Approach jump', 'Step-in vertical jump', 'Three-step approach jump to target', { equipment: ['Jump target'], methodology: 'Plyometric' }),
      O('Reactive takeoff call', 'Coach-call jump direction', 'Partner-call takeoff direction or leg', { equipment: ['Partner', 'Colored cones'], methodology: 'Plyometric', tenets: ['Explosiveness', 'Speed', 'Agility', 'Balance', 'Coordination', 'Body Control'] }),
      O('Medicine-ball scoop toss jump', 'Light medicine-ball scoop toss', 'Loaded scoop toss with jump release', { equipment: ['Medicine ball'], methodology: 'Ballistic', bodyRegions: ['Shoulder', 'Back', 'Trunk', 'Hip', 'Knee', 'Ankle'], matchStatus: 'reused' }),
    ],
    capacity: [
      C('Barbell back squat', 'Youth-barbell box squat', 'Technically sound barbell back squat', {
        equipment: ['Kettlebell', 'Barbell', 'Rack'],
        movementPattern: 'Squat',
        matchStatus: 'reused',
        regressionEquipment: ['Youth barbell or technique bar', 'Box', 'Rack'],
        progressionEquipment: ['Barbell', 'Rack'],
      }),
      C('Trap-bar deadlift', 'Kettlebell deadlift from blocks', 'Low-handle trap-bar deadlift', { equipment: ['Trap bar', 'Kettlebell', 'Blocks'], movementPattern: 'Hinge', bodyRegions: ['Grip', 'Back', 'Trunk', 'Hip', 'Knee'], matchStatus: 'reused' }),
      C('Front-foot elevated split squat', 'Bodyweight split squat', 'Barbell front-foot elevated split squat', { equipment: ['Low plate', 'Dumbbell', 'Barbell'], movementPattern: 'Lunge or split stance', matchStatus: 'reused' }),
      C('Explosive step-up drive', 'Low step-up to balance', 'Loaded step-up with fast concentric drive', { equipment: ['Box', 'Dumbbell'], movementPattern: 'Lunge or split stance', methodology: 'Concentric-Focused' }),
      C('Standing calf raise', 'Two-leg supported calf raise', 'Heavy single-leg calf raise', { equipment: ['Support', 'Dumbbell'], movementPattern: 'Foot and ankle', bodyRegions: ['Foot', 'Ankle', 'Calf'], matchStatus: 'reused' }),
    ],
    resilience: [
      R('Pogo landing isometric', 'Calf raise hold', 'Single-leg pogo position hold', { bodyRegions: ['Foot', 'Ankle', 'Calf'], methodology: 'Isometric — Strength Application' }),
      R('Patellar tendon split-squat hold', 'Wall sit', 'Loaded split-squat isometric', { equipment: ['Wall', 'Dumbbell'], bodyRegions: ['Knee', 'Hip', 'Trunk'], methodology: 'Isometric — Strength Application' }),
      R('Single-leg Romanian deadlift reach', 'Kickstand hinge reach', 'Loaded single-leg Romanian deadlift reach', { equipment: ['Dumbbell'], bodyRegions: ['Foot', 'Ankle', 'Hip', 'Hamstring', 'Trunk'] }),
      R('Push-up plus', 'Wall push-up plus', 'Ring push-up plus', { equipment: ['Wall', 'Rings'], bodyRegions: ['Wrist', 'Shoulder', 'Chest', 'Back', 'Trunk'], matchStatus: 'reused' }),
      R('Hollow body breathing hold', 'Tuck breathing hold', 'Hollow breathing hold with overhead reach', { equipment: ['Light plate'], bodyRegions: ['Shoulder', 'Trunk', 'Hip'], methodology: 'Isometric — Strength Application' }),
    ],
    tumbling: [
      T('Punch jump shapes', 'Straight jump to stick', 'Tuck or straddle punch jump to stick', { equipment: ['Spring floor', 'Panel mat'] }),
      T('Handstand snap-down rebound', 'Incline support step-down', 'Handstand snap-down to repeated rebound', { equipment: ['Panel mat', 'Low block'], matchStatus: 'reused' }),
      T('Roundoff rebound height', 'Cartwheel snap-together rebound', 'Roundoff rebound to target height', { equipment: ['Spring floor', 'Jump target'], matchStatus: 'review' }),
      T('Forward tumbling takeoff', 'Hurdle to dive-roll shape', 'Front handspring takeoff station', { equipment: ['Wedge mat', 'Spring floor', 'Spotting block'], matchStatus: 'review', prerequisites: ['Coach-approved forward tumbling readiness', 'Qualified spotter'] }),
      T('Tumbling takeoff circuit', 'Jump-roll-cartwheel circuit', 'Roundoff and forward-tumbling choice circuit', { equipment: ['Panel mat', 'Spring floor'], matchStatus: 'review' }),
    ],
  },
  {
    movementFunction: 'Traversal and Upper-Body Locomotion',
    capacityFocus: 'Pulling, grip, and shoulder-girdle capacity',
    coachingObjective: 'Move over, under, and across obstacles with purposeful grip, shoulder rhythm, and safe dismounts.',
    progression: 'Move from supported crawling and hanging to linked traversal routes and independent route selection.',
    movement: [
      M('Bear crawl line', 'Quadruped weight-shift crawl', 'Bear crawl with forward-backward transitions', { equipment: ['Floor line'], movementPattern: 'Crawl', bodyRegions: ['Wrist', 'Shoulder', 'Chest', 'Back', 'Trunk', 'Hip'], tenets: ['Strength', 'Balance', 'Coordination', 'Body Control'], matchStatus: 'reused' }),
      M('Active hang rhythm', 'Feet-assisted active hang', 'Active hang with controlled swing shape', { equipment: ['Pull-up bar', 'Box'], movementPattern: 'Hang and swing', bodyRegions: ['Grip', 'Shoulder', 'Back', 'Trunk'], tenets: ['Strength', 'Balance', 'Coordination', 'Body Control'] }),
      M('Low obstacle vault rehearsal', 'Step-over with hand support', 'Speed vault step-through on low block', { equipment: ['Vault block', 'Panel mat'], movementPattern: 'Vault', bodyRegions: ['Wrist', 'Shoulder', 'Chest', 'Trunk', 'Hip'], tenets: ['Agility', 'Balance', 'Coordination', 'Body Control'] }),
      M('Reactive traversal route', 'Coach-point crawl lane', 'Partner-call over-under-around route', { equipment: ['Low obstacles', 'Partner'], movementPattern: 'Reactive traversal', bodyRegions: ['Wrist', 'Shoulder', 'Chest', 'Back', 'Trunk', 'Hip'], tenets: ['Speed', 'Agility', 'Balance', 'Coordination', 'Body Control'] }),
      M('Traversal route assessment', 'Two-station route check', 'Timed four-station route with quality score', { equipment: ['Low obstacles', 'Rope', 'Pull-up bar'], movementPattern: 'Traversal', bodyRegions: ['Grip', 'Wrist', 'Shoulder', 'Chest', 'Back', 'Trunk', 'Hip'], tenets: ['Strength', 'Agility', 'Balance', 'Coordination', 'Body Control'], matchStatus: 'review' }),
    ],
    output: [
      O('Explosive bear crawl burst', 'Fast quadruped step burst', 'Reactive bear crawl direction burst', { equipment: ['Floor markers'], methodology: 'Ballistic', movementPattern: 'Crawl', bodyRegions: ['Wrist', 'Shoulder', 'Chest', 'Back', 'Trunk', 'Hip'] }),
      O('Low vault pop-over', 'Two-hand step-over vault', 'Speed vault pop-over with controlled landing', { equipment: ['Vault block', 'Panel mat'], methodology: 'Ballistic', movementPattern: 'Vault', bodyRegions: ['Wrist', 'Shoulder', 'Chest', 'Trunk', 'Hip'] }),
      O('Lache tap-swing release target', 'Feet-supported swing and land', 'Short lache release to padded target', { equipment: ['High bar', 'Panel mat'], methodology: 'Ballistic', movementPattern: 'Swing and release', bodyRegions: ['Grip', 'Shoulder', 'Back', 'Trunk', 'Hip'], matchStatus: 'review', prerequisites: ['Active hang control', 'Coach-approved swing and release readiness', 'Clear padded landing zone'] }),
      O('Reactive obstacle escape', 'Coach-call crawl or step-over', 'Partner-call vault, crawl, or sprint exit', { equipment: ['Low obstacles', 'Partner'], methodology: 'Ballistic', tenets: ['Explosiveness', 'Speed', 'Agility', 'Balance', 'Coordination', 'Body Control'], bodyRegions: ['Wrist', 'Shoulder', 'Chest', 'Back', 'Trunk', 'Hip'] }),
      O('Traversal power route', 'Two-station crawl-and-step route', 'Three-station vault-swing-sprint route with full recovery', { equipment: ['Low obstacles', 'Pull-up bar', 'Panel mat'], methodology: 'Ballistic', bodyRegions: ['Grip', 'Wrist', 'Shoulder', 'Chest', 'Back', 'Trunk', 'Hip'] }),
    ],
    capacity: [
      C('Pull-up', 'Band-assisted pull-up or foot-supported row', 'Weighted pull-up', { equipment: ['Pull-up bar', 'Resistance band', 'Weight belt'], movementPattern: 'Pull', bodyRegions: ['Grip', 'Shoulder', 'Back', 'Trunk'], matchStatus: 'reused' }),
      C('Inverted row', 'High-bar body row', 'Feet-elevated weighted inverted row', { equipment: ['Low bar', 'Box', 'Weight vest'], movementPattern: 'Pull', bodyRegions: ['Grip', 'Shoulder', 'Back', 'Trunk'], matchStatus: 'reused' }),
      C('Dead hang', 'Feet-assisted hang', 'Towel-grip active hang', { equipment: ['Pull-up bar', 'Box', 'Towel'], movementPattern: 'Hang', bodyRegions: ['Grip', 'Shoulder', 'Back', 'Trunk'], methodology: 'Isometric — Strength Application', matchStatus: 'alias', aliases: ['Passive hang'] }),
      C('Farmer carry', 'Light two-hand carry', 'Heavy towel-grip farmer carry', { equipment: ['Dumbbell', 'Kettlebell', 'Towel'], movementPattern: 'Carry', bodyRegions: ['Grip', 'Shoulder', 'Back', 'Trunk', 'Hip'], matchStatus: 'reused' }),
      C('Push-up', 'Hands-elevated push-up', 'Ring, feet-elevated, or loaded push-up', { equipment: ['Bodyweight', 'Bench', 'Rings', 'Weight vest'], movementPattern: 'Push', bodyRegions: ['Wrist', 'Shoulder', 'Chest', 'Trunk'], matchStatus: 'reused' }),
    ],
    resilience: [
      R('Scapular pull-up', 'Feet-assisted scapular hang', 'Towel-grip scapular pull-up', { equipment: ['Pull-up bar', 'Box', 'Towel'], bodyRegions: ['Grip', 'Shoulder', 'Back'], matchStatus: 'reused' }),
      R('Wrist extension eccentric', 'Wrist range with no load', 'Light dumbbell wrist extension eccentric', { equipment: ['Light dumbbell'], bodyRegions: ['Wrist', 'Forearm'], methodology: 'Eccentric-Focused — Strength Application' }),
      R('Rear support table hold', 'Bent-knee rear support', 'Straight-leg rear support march', { bodyRegions: ['Wrist', 'Shoulder', 'Back', 'Trunk', 'Hip'], methodology: 'Isometric — Strength Application', matchStatus: 'reused' }),
      R('Prone swimmer', 'Scapular floor slide', 'Loaded prone swimmer', { equipment: ['Light plate'], bodyRegions: ['Shoulder', 'Back', 'Trunk'] }),
      R('Hollow hang knee raise', 'Supine tuck hold', 'Controlled hanging knee raise', { equipment: ['Pull-up bar'], bodyRegions: ['Grip', 'Shoulder', 'Back', 'Trunk', 'Hip'] }),
    ],
    tumbling: [
      T('Vault hand-support shapes', 'Bench hand-support step-over', 'Squat-on or speed-vault shape station', { equipment: ['Vault block', 'Panel mat'] }),
      T('Swing-to-landing shapes', 'Feet-supported hang and step-down', 'Tap swing to controlled drop landing', { equipment: ['High bar', 'Panel mat'], matchStatus: 'review' }),
      T('Handstand obstacle line', 'Incline plank over panel mat', 'Handstand walk over low panel line', { equipment: ['Panel mat', 'Wall'], matchStatus: 'review' }),
      T('Cartwheel over panel mat', 'Side hand-step over panel', 'Cartwheel over low panel to lunge', { equipment: ['Panel mat'] }),
      T('Traversal tumbling circuit', 'Crawl-roll-cartwheel circuit', 'Vault-swing-cartwheel connection circuit', { equipment: ['Panel mat', 'Vault block', 'High bar'], matchStatus: 'review' }),
    ],
  },
  {
    movementFunction: 'Object Interaction',
    capacityFocus: 'Whole-body force transfer',
    coachingObjective: 'Coordinate the ground, trunk, and limbs to throw, catch, strike, kick, carry, and receive.',
    progression: 'Move from stable two-hand actions to varied stances, moving targets, and controlled reactive choices.',
    movement: [
      M('Medicine-ball catch posture', 'Light ball scoop catch', 'Moving medicine-ball catch to stable stance', { equipment: ['Medicine ball'], movementPattern: 'Catch', bodyRegions: ['Grip', 'Shoulder', 'Chest', 'Back', 'Trunk', 'Hip'], tenets: ['Strength', 'Balance', 'Coordination', 'Body Control'] }),
      M('Step-and-throw sequence', 'Two-hand chest pass from stable stance', 'Contralateral step rotational throw rehearsal', { equipment: ['Medicine ball'], movementPattern: 'Throw', bodyRegions: ['Grip', 'Shoulder', 'Chest', 'Back', 'Trunk', 'Hip'], tenets: ['Explosiveness', 'Balance', 'Coordination', 'Body Control'] }),
      M('Kicking plant-foot control', 'Stationary inside-foot pass', 'Approach kick to target with controlled follow-through', { equipment: ['Ball', 'Target'], movementPattern: 'Kick', bodyRegions: ['Foot', 'Ankle', 'Knee', 'Hip', 'Trunk'], tenets: ['Balance', 'Coordination', 'Body Control'] }),
      M('Reactive object call', 'Coach-call catch or roll', 'Partner-call throw, strike, or carry response', { equipment: ['Partner', 'Ball', 'Medicine ball'], movementPattern: 'Reactive object interaction', bodyRegions: ['Grip', 'Shoulder', 'Chest', 'Back', 'Trunk', 'Hip'], tenets: ['Speed', 'Agility', 'Balance', 'Coordination', 'Body Control'] }),
      M('Object-skill assessment', 'Catch-and-pass accuracy check', 'Multi-object accuracy and decision check', { equipment: ['Balls', 'Targets'], movementPattern: 'Object interaction', bodyRegions: ['Grip', 'Shoulder', 'Chest', 'Back', 'Trunk', 'Hip'], tenets: ['Agility', 'Balance', 'Coordination', 'Body Control'], matchStatus: 'review' }),
    ],
    output: [
      O('Medicine-ball overhead slam', 'Light ball tall-kneeling slam', 'Heavy high-intent overhead slam', { equipment: ['Medicine ball', 'Slam ball'], methodology: 'Ballistic', movementPattern: 'Throw', bodyRegions: ['Grip', 'Shoulder', 'Back', 'Trunk', 'Hip'], matchStatus: 'reused' }),
      O('Medicine-ball shot-put throw', 'Half-kneeling light chest throw', 'Step-behind rotational shot-put throw', { equipment: ['Medicine ball'], methodology: 'Ballistic', movementPattern: 'Throw', bodyRegions: ['Grip', 'Shoulder', 'Chest', 'Trunk', 'Hip'], matchStatus: 'reused' }),
      O('Rotational scoop toss', 'Tall-kneeling scoop toss', 'Step-in rotational scoop toss for distance', { equipment: ['Medicine ball'], methodology: 'Ballistic', movementPattern: 'Throw', bodyRegions: ['Grip', 'Shoulder', 'Back', 'Trunk', 'Hip'], matchStatus: 'reused' }),
      O('Reactive target throw', 'Coach-called near target throw', 'Partner-called moving target throw', { equipment: ['Medicine ball', 'Targets', 'Partner'], methodology: 'Ballistic', tenets: ['Explosiveness', 'Speed', 'Agility', 'Balance', 'Coordination', 'Body Control'], bodyRegions: ['Grip', 'Shoulder', 'Chest', 'Back', 'Trunk', 'Hip'] }),
      O('Instep kick to target', 'Stationary light-ball kick', 'Approach kick to changing target', { equipment: ['Ball', 'Targets'], methodology: 'Ballistic', movementPattern: 'Kick', bodyRegions: ['Foot', 'Ankle', 'Knee', 'Hip', 'Trunk'] }),
    ],
    capacity: [
      C('Landmine press', 'Half-kneeling light landmine press', 'Split-stance single-arm landmine press', { equipment: ['Landmine', 'Barbell'], movementPattern: 'Push', bodyRegions: ['Grip', 'Shoulder', 'Chest', 'Trunk', 'Hip'], matchStatus: 'reused' }),
      C('Cable row', 'Resistance-band row', 'Heavy split-stance cable row', { equipment: ['Cable', 'Resistance band'], movementPattern: 'Pull', bodyRegions: ['Grip', 'Shoulder', 'Back', 'Trunk'], matchStatus: 'reused' }),
      C('Front-rack carry', 'Goblet carry', 'Heavy double-kettlebell front-rack carry', { equipment: ['Kettlebell', 'Dumbbell'], movementPattern: 'Carry', bodyRegions: ['Grip', 'Shoulder', 'Back', 'Trunk', 'Hip'] }),
      C('Cable chop', 'Half-kneeling band chop', 'Split-stance heavy cable chop', { equipment: ['Cable', 'Resistance band'], movementPattern: 'Rotation', bodyRegions: ['Grip', 'Shoulder', 'Chest', 'Back', 'Trunk', 'Hip'], matchStatus: 'reused' }),
      C('Front-loaded reverse lunge', 'Bodyweight reverse lunge', 'Barbell front-rack reverse lunge', { equipment: ['Kettlebell', 'Barbell'], movementPattern: 'Lunge or split stance', bodyRegions: ['Shoulder', 'Trunk', 'Hip', 'Knee'], matchStatus: 'reused' }),
    ],
    resilience: [
      R('External-rotation band hold', 'Light elbow-at-side band hold', '90-degree cable external-rotation hold', { equipment: ['Resistance band', 'Cable'], bodyRegions: ['Shoulder', 'Back'], methodology: 'Isometric — Strength Application' }),
      R('Forearm pronation-supination', 'Unloaded forearm rotation', 'Light hammer pronation-supination', { equipment: ['Light hammer'], bodyRegions: ['Wrist', 'Forearm', 'Grip'] }),
      R('Split-stance Pallof hold', 'Tall-kneeling band hold', 'Pallof press with overhead reach', { equipment: ['Resistance band', 'Cable'], bodyRegions: ['Shoulder', 'Chest', 'Back', 'Trunk', 'Hip'], methodology: 'Isometric — Strength Application' }),
      R('Single-leg calf raise hold', 'Two-leg calf raise hold', 'Loaded single-leg calf raise isometric', {
        equipment: ['Bodyweight', 'Support', 'Dumbbell'],
        bodyRegions: ['Foot', 'Ankle', 'Calf'],
        methodology: 'Isometric — Strength Application',
      }),
      R('Side plank reach-through control', 'Side-lying open book', 'Loaded side plank reach-through', { equipment: ['Light plate'], bodyRegions: ['Shoulder', 'Chest', 'Back', 'Trunk', 'Hip'] }),
    ],
    tumbling: [
      T('Ball carry to roll', 'Soft-ball carry to rocking tuck', 'Medicine-ball carry release then forward roll', { equipment: ['Soft ball', 'Panel mat'] }),
      T('Target cartwheel', 'Hand-step to floor targets', 'Cartwheel through hand and foot targets', { equipment: ['Floor markers', 'Panel mat'] }),
      T('Handstand target taps', 'Incline plank target taps', 'Wall handstand alternating target taps', { equipment: ['Wall', 'Targets', 'Panel mat'] }),
      T('Roundoff target line', 'Cartwheel snap-together to target', 'Roundoff rebound into landing target', { equipment: ['Spring floor', 'Target mat'], matchStatus: 'review' }),
      T('Object-and-tumble circuit', 'Catch-roll-cartwheel circuit', 'Throw-roundoff-catch decision circuit', { equipment: ['Soft ball', 'Panel mat', 'Partner'], matchStatus: 'review' }),
    ],
  },
  {
    movementFunction: 'Perception, Reaction and Adaptation',
    capacityFocus: 'Integrated total-body strength and reassessment',
    coachingObjective: 'See, decide, and execute the right learned movement with composure and honest self-assessment.',
    progression: 'Move from one-choice signals to constrained multi-choice tasks, then consolidate and reassess the full program.',
    movement: [
      M('Mirror movement drill', 'Coach-led mirror walk', 'Partner mirror with locomotion choices', { equipment: ['Partner', 'Floor markers'], movementPattern: 'Reactive movement', tenets: ['Speed', 'Agility', 'Balance', 'Coordination', 'Body Control'], matchStatus: 'reused' }),
      M('Color-call movement choice', 'Two-color step choice', 'Four-color locomotion and shape choice', { equipment: ['Colored cones'], movementPattern: 'Reactive movement', tenets: ['Speed', 'Agility', 'Balance', 'Coordination', 'Body Control'] }),
      M('Chase-and-evade boundary game', 'Walking shadow game', 'Short reactive chase-and-evade round', { equipment: ['Partner', 'Cones'], movementPattern: 'Reactive agility', tenets: ['Speed', 'Agility', 'Balance', 'Coordination', 'Body Control'], matchStatus: 'reused' }),
      M('Multi-signal reaction grid', 'Coach-point grid step', 'Partner-led color, number, and direction grid', { equipment: ['Colored cones', 'Partner'], movementPattern: 'Reactive agility', tenets: ['Speed', 'Agility', 'Balance', 'Coordination', 'Body Control'] }),
      M('Movement-function reassessment', 'Coach-selected foundation skill check', 'Athlete-selected challenge with quality rubric', { equipment: ['Program stations'], movementPattern: 'Integrated movement', tenets: ['Speed', 'Agility', 'Balance', 'Coordination', 'Body Control'], matchStatus: 'review' }),
    ],
    output: [
      O('Reactive sprint or stick', 'Coach-call short run or freeze', 'Partner-call sprint, cut, jump, or stick', { equipment: ['Partner', 'Colored cones'], methodology: 'Ballistic', tenets: ['Explosiveness', 'Speed', 'Agility', 'Balance', 'Coordination', 'Body Control'] }),
      O('Choice jump', 'Two-choice jump direction', 'Four-choice jump or rebound task', { equipment: ['Colored cones'], methodology: 'Plyometric', tenets: ['Explosiveness', 'Speed', 'Agility', 'Balance', 'Coordination', 'Body Control'] }),
      O('Reaction chase burst', 'Coach-led 5-meter chase', 'Partner chase-and-escape burst', { equipment: ['Partner', 'Cones'], methodology: 'Ballistic', tenets: ['Explosiveness', 'Speed', 'Agility', 'Balance', 'Coordination', 'Body Control'] }),
      O('Reactive medicine-ball action', 'Coach-call slam or chest pass', 'Partner-call slam, scoop toss, or shot-put', { equipment: ['Medicine ball', 'Partner'], methodology: 'Ballistic', tenets: ['Strength', 'Explosiveness', 'Speed', 'Agility', 'Balance', 'Coordination', 'Body Control'] }),
      O('Output reassessment choice', 'Coach-selected jump or sprint check', 'Athlete-selected output test with full recovery', { equipment: ['Timing gates', 'Jump mat'], methodology: 'Ballistic', tenets: ['Explosiveness', 'Speed', 'Agility', 'Balance', 'Coordination', 'Body Control'], matchStatus: 'review' }),
    ],
    capacity: [
      C('Front squat reassessment set', 'Goblet box squat quality set', 'Submaximal barbell front squat quality set', { equipment: ['Kettlebell', 'Barbell', 'Rack'], movementPattern: 'Squat', matchStatus: 'review' }),
      C('Trap-bar deadlift reassessment set', 'Kettlebell deadlift quality set', 'Submaximal trap-bar deadlift quality set', { equipment: ['Kettlebell', 'Trap bar'], movementPattern: 'Hinge', bodyRegions: ['Grip', 'Back', 'Trunk', 'Hip', 'Knee'], matchStatus: 'review' }),
      C('Push-up quality set', 'Hands-elevated push-up quality set', 'Weighted or ring push-up quality set', { equipment: ['Bench', 'Rings', 'Weight vest'], movementPattern: 'Push', bodyRegions: ['Wrist', 'Shoulder', 'Chest', 'Trunk'], matchStatus: 'reused' }),
      C('Pull-up quality set', 'Band-assisted pull-up quality set', 'Weighted pull-up quality set', { equipment: ['Pull-up bar', 'Resistance band', 'Weight belt'], movementPattern: 'Pull', bodyRegions: ['Grip', 'Shoulder', 'Back', 'Trunk'], matchStatus: 'reused' }),
      C('Carry medley', 'Light farmer-and-suitcase carry', 'Heavy front-rack, farmer, and suitcase carry medley', { equipment: ['Dumbbell', 'Kettlebell', 'Barbell'], movementPattern: 'Carry', bodyRegions: ['Grip', 'Shoulder', 'Back', 'Trunk', 'Hip'] }),
    ],
    resilience: [
      R('Joint-control reassessment circuit', 'Supported ankle-hip-shoulder control circuit', 'Single-leg and overhead joint-control circuit', { equipment: ['Support', 'Resistance band'], bodyRegions: ['Foot', 'Ankle', 'Knee', 'Hip', 'Wrist', 'Shoulder', 'Trunk'], matchStatus: 'review' }),
      R('Tempo split squat', 'Supported bodyweight split squat', 'Loaded four-second split squat', { equipment: ['Support', 'Dumbbell'], bodyRegions: ['Foot', 'Ankle', 'Knee', 'Hip', 'Trunk'], methodology: 'Tempo-Controlled' }),
      R('Scapular control circuit', 'Wall slide and scapular glide', 'Ring scapular pull and push circuit', { equipment: ['Wall', 'Rings'], bodyRegions: ['Wrist', 'Shoulder', 'Chest', 'Back', 'Trunk'] }),
      R('Trunk control circuit', 'Dead bug and side-lying brace', 'Hollow, side plank, and Pallof control circuit', { equipment: ['Resistance band'], bodyRegions: ['Shoulder', 'Chest', 'Back', 'Trunk', 'Hip'] }),
      R('Foot and ankle control circuit', 'Seated toe yoga and calf hold', 'Single-leg short-foot, soleus, and tibialis circuit', { equipment: ['Support', 'Tib bar'], bodyRegions: ['Foot', 'Ankle', 'Calf', 'Shin'] }),
    ],
    tumbling: [
      T('Tumbling shape reassessment', 'Foundation body-shape check', 'Independent shape sequence with coach rubric', { equipment: ['Panel mat'], matchStatus: 'review' }),
      T('Roll and inversion choice', 'Coach-call forward roll or incline support', 'Partner-call roll, cartwheel, or handstand', { equipment: ['Panel mat', 'Wall'], matchStatus: 'review' }),
      T('Cartwheel-roundoff pathway check', 'Cartwheel line check', 'Roundoff or advanced cartwheel pathway check', { equipment: ['Spring floor', 'Floor line'], matchStatus: 'review' }),
      T('Forward-backward pathway check', 'Forward roll and backward rock check', 'Coach-approved forward or backward tumbling connection', { equipment: ['Wedge mat', 'Spring floor', 'Spotting block'], matchStatus: 'review', prerequisites: ['Coach-selected skill based on demonstrated prerequisites', 'Qualified spotter for hands-on skills'] }),
      T('Athlete-choice tumbling routine', 'Two-skill coached sequence', 'Three-to-five-skill athlete-choice routine', { equipment: ['Spring floor', 'Panel mat'], matchStatus: 'review', prerequisites: ['Every selected skill has already been demonstrated safely', 'Coach approves the connection order'] }),
    ],
  },
]

const PREPARE_CORE = seed(
  'Vortex locomotor RAMP sequence',
  'Walk-and-reach guided RAMP sequence',
  'Athlete-led RAMP sequence with crisp rhythm',
  {
    equipment: ['Floor markers'],
    movementPattern: 'Raise, mobilize, activate, integrate',
    bodyRegions: ['Foot', 'Ankle', 'Knee', 'Hip', 'Shoulder', 'Trunk'],
    tenets: ['Flexibility and Mobility', 'Balance', 'Coordination', 'Body Control'],
    methodology: 'Dynamic preparation',
    aliases: ['Standard Flip & Fit warm-up'],
    matchStatus: 'new',
    cues: ['Start easy, then build rhythm.', 'Finish each position before moving faster.'],
  },
)

const RESTORE_CORE = seed(
  'Crocodile breathing and mobility reset',
  'Supported breathing and easy mobility reset',
  'Athlete-led breathing and mobility reset',
  {
    equipment: ['Panel mat'],
    movementPattern: 'Breathing and mobility',
    bodyRegions: ['Shoulder', 'Back', 'Trunk', 'Hip'],
    tenets: ['Flexibility and Mobility', 'Body Control'],
    methodology: 'Recovery breathing',
    aliases: ['Crocodile breathing'],
    matchStatus: 'alias',
    cues: ['Let the exhale slow the pace.', 'Use comfortable range only.'],
    safety: ['No forced range, breath holds, competitive stretching, or new skill exposure.'],
  },
)

const TUMBLING_PREP = seed(
  'Tumbling wrist, ankle, and body-shape preparation',
  'Supported wrist-ankle prep and tuck shapes',
  'Independent wrist-ankle prep with hollow-arch transitions',
  {
    ...tumblingDefaults,
    equipment: ['Panel mat', 'Wall'],
    movementPattern: 'Tumbling preparation',
    matchStatus: 'new',
    cues: ['Warm wrists and ankles before impact or inversion.', 'Show hollow, arch, tuck, and straight shapes with control.'],
  },
)

const UPPER_SUPPORT_POOL: ExerciseSeed[] = [
  C('Push-up strength support', 'Hands-elevated push-up', 'Weighted or ring push-up', { equipment: ['Bench', 'Rings', 'Weight vest'], movementPattern: 'Push', bodyRegions: ['Wrist', 'Shoulder', 'Chest', 'Trunk'], matchStatus: 'reused' }),
  C('One-arm row strength support', 'Bench-supported light row', 'Heavy split-stance one-arm row', { equipment: ['Dumbbell', 'Bench'], movementPattern: 'Pull', bodyRegions: ['Grip', 'Shoulder', 'Back', 'Trunk'], matchStatus: 'reused' }),
  C('Half-kneeling landmine press support', 'Half-kneeling band press', 'Split-stance single-arm landmine press', { equipment: ['Resistance band', 'Landmine', 'Barbell'], movementPattern: 'Push', bodyRegions: ['Grip', 'Shoulder', 'Chest', 'Trunk', 'Hip'], matchStatus: 'reused' }),
  C('Inverted row strength support', 'High-bar body row', 'Feet-elevated weighted inverted row', { equipment: ['Low bar', 'Box', 'Weight vest'], movementPattern: 'Pull', bodyRegions: ['Grip', 'Shoulder', 'Back', 'Trunk'], matchStatus: 'reused' }),
  C('Bear-plank shoulder tap support', 'Incline plank shoulder tap', 'Ring plank shoulder tap', { equipment: ['Bench', 'Rings'], movementPattern: 'Upper-body support', bodyRegions: ['Wrist', 'Shoulder', 'Chest', 'Back', 'Trunk', 'Hip'] }),
]

const SUSTAINED_CAPACITY_POOL: ExerciseSeed[] = [
  C('Sled march intervals', 'Light sled walk intervals', 'Moderate sled march with posture target', { equipment: ['Sled'], movementPattern: 'Simple locomotion', bodyRegions: ['Shoulder', 'Trunk', 'Hip', 'Knee', 'Calf'], methodology: 'Simple interval', matchStatus: 'reused' }),
  C('Farmer carry tempo lanes', 'Light short farmer carry', 'Moderate farmer carry with controlled turns', { equipment: ['Dumbbell', 'Kettlebell'], movementPattern: 'Carry', bodyRegions: ['Grip', 'Shoulder', 'Back', 'Trunk', 'Hip'], methodology: 'Carry circuit', matchStatus: 'reused' }),
  C('Bear crawl tempo lanes', 'Quadruped crawl intervals', 'Forward-backward bear crawl intervals', { equipment: ['Floor markers'], movementPattern: 'Crawl', bodyRegions: ['Wrist', 'Shoulder', 'Chest', 'Back', 'Trunk', 'Hip'], methodology: 'Tempo locomotion', matchStatus: 'reused' }),
  C('Low box step-up intervals', 'Low alternating step-up', 'Moderate loaded alternating step-up', { equipment: ['Low box', 'Dumbbell'], movementPattern: 'Simple locomotion', bodyRegions: ['Trunk', 'Hip', 'Knee', 'Calf'], methodology: 'Simple interval', matchStatus: 'reused' }),
  C('Tempo rope-pull and walk', 'Light hand-over-hand rope pull', 'Moderate rope pull with backward walk', { equipment: ['Battle rope'], movementPattern: 'Pull and locomotion', bodyRegions: ['Grip', 'Shoulder', 'Back', 'Trunk', 'Hip', 'Knee'], methodology: 'Simple interval' }),
]

const STRESS_VOLUME_WEIGHTS: Record<FlipFitPhaseKey | 'tumbling', number> = {
  prepare_and_access: 0.25,
  movement_intelligence: 0.5,
  output: 0.3,
  capacity: 0.9,
  sustained_capacity: 0.65,
  resilience: 0.6,
  restore: 0.1,
  tumbling: 0.45,
}

const STRESS_LEVEL_SCORE = { low: 1, moderate: 2, high: 3 } as const
const ECCENTRIC_METHOD_PATTERN = /eccentric/i
const TEMPO_METHOD_PATTERN = /tempo|paused/i
const HIGH_REGION_LOAD = 12
const DIFFUSE_STABILIZER_REGIONS = new Set(['Trunk'])

const DAY_OBJECTIVES = [
  'Establish positions and a shared movement vocabulary.',
  'Repeat the pattern with rhythm and technical consistency.',
  'Apply the pattern through a new direction or environment.',
  'Respond to a simple perception-action cue while preserving quality.',
  'Consolidate, coach one another, and reassess the week’s key quality.',
] as const

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[—–]/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function parseIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) throw new Error('Start date must use YYYY-MM-DD format.')
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error('Start date is not a valid calendar date.')
  }
  return date
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

export function nextMondayIso(today = new Date()) {
  const localMidnightUtc = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
  const day = localMidnightUtc.getUTCDay()
  const daysUntil = day === 1 ? 7 : (8 - day) % 7
  return isoDate(addUtcDays(localMidnightUtc, daysUntil))
}

export function flipFitEndDate(startDate: string) {
  const start = parseIsoDate(startDate)
  if (start.getUTCDay() !== 1) throw new Error('Flip & Fit must start on a Monday.')
  return isoDate(addUtcDays(start, 81))
}

const LOADED_EQUIPMENT_PATTERN = /barbell|trap bar|landmine|dumbbell|kettlebell|sled|cable|resistance band|mini band|medicine ball|battle rope|weight vest|weight belt|plate|tib bar|sprint assistance/i

const VARIATION_EQUIPMENT_HINTS: Array<{ pattern: RegExp; equipment: string[] }> = [
  { pattern: /youth[- ]barbell|technique bar/i, equipment: ['Youth barbell or technique bar'] },
  { pattern: /trap[- ]bar/i, equipment: ['Trap bar'] },
  { pattern: /barbell/i, equipment: ['Barbell'] },
  { pattern: /kettlebell|goblet/i, equipment: ['Kettlebell'] },
  { pattern: /dumbbell/i, equipment: ['Dumbbell'] },
  { pattern: /landmine/i, equipment: ['Landmine'] },
  { pattern: /mini[- ]band/i, equipment: ['Mini band'] },
  { pattern: /resistance band|band-assisted|band-resisted|\bband\b/i, equipment: ['Resistance band'] },
  { pattern: /medicine[- ]ball|med[- ]ball/i, equipment: ['Medicine ball'] },
  { pattern: /sled/i, equipment: ['Sled'] },
  { pattern: /cable/i, equipment: ['Cable'] },
  { pattern: /low beam|\bbeam\b/i, equipment: ['Low beam'] },
  { pattern: /\bwall\b/i, equipment: ['Wall'] },
  { pattern: /\bbench\b/i, equipment: ['Bench'] },
  { pattern: /low box|\bbox\b/i, equipment: ['Box'] },
  { pattern: /\bblocks?\b/i, equipment: ['Blocks'] },
  { pattern: /\brings?\b/i, equipment: ['Rings'] },
  { pattern: /panel mat/i, equipment: ['Panel mat'] },
  { pattern: /wedge mat/i, equipment: ['Wedge mat'] },
  { pattern: /\bfloor\b/i, equipment: ['Floor'] },
  { pattern: /\bpartner\b/i, equipment: ['Partner'] },
  { pattern: /\bsupport(?:ed)?\b/i, equipment: ['Support'] },
  { pattern: /weight vest/i, equipment: ['Weight vest'] },
  { pattern: /\btowel\b/i, equipment: ['Towel'] },
  { pattern: /\bsliders?\b/i, equipment: ['Sliders'] },
]

function sortedEquipment(values: string[], ageBand: FlipFitAgeBand) {
  const normalized = values.map((item) => ageBand === '9-11' && item === 'Barbell' ? 'Youth barbell or technique bar' : item)
  return [...new Set(normalized)].sort((a, b) => a.localeCompare(b))
}

function inferredVariationEquipment(seedValue: ExerciseSeed, variation: string, ageBand: FlipFitAgeBand) {
  const source = [...seedValue.equipment]
  const inferred = VARIATION_EQUIPMENT_HINTS
    .filter(({ pattern }) => pattern.test(variation))
    .flatMap(({ equipment }) => equipment)
  const explicitLoaded = inferred.filter((item) => LOADED_EQUIPMENT_PATTERN.test(item))
  const clearlyUnloaded = /bodyweight|unloaded|no[- ]load|floor glute bridge|hands-elevated push-up|wall push-up/i.test(variation)
  let selected = [...source]

  if (explicitLoaded.length > 0) {
    selected = selected.filter((item) => !LOADED_EQUIPMENT_PATTERN.test(item))
  } else if (clearlyUnloaded) {
    selected = selected.filter((item) => !LOADED_EQUIPMENT_PATTERN.test(item))
  }
  if (/\bfloor\b/i.test(variation)) {
    selected = selected.filter((item) => !/bench|box|rack|blocks|low plate|wall/i.test(item))
  }
  if (/freestanding/i.test(variation)) selected = selected.filter((item) => !/wall/i.test(item))
  if (/hands-free/i.test(variation)) selected = selected.filter((item) => !/support/i.test(item))

  selected.push(...inferred)
  if (selected.length === 0) selected.push('Bodyweight')
  return sortedEquipment(selected, ageBand)
}

function scaledEquipment(seedValue: ExerciseSeed, ageBand: FlipFitAgeBand) {
  const explicit = ageBand === '9-11'
    ? seedValue.regressionEquipment
    : ageBand === '15-18'
      ? seedValue.progressionEquipment
      : undefined
  if (explicit) return sortedEquipment(explicit, ageBand)
  if (ageBand === '12-14') return sortedEquipment(seedValue.equipment, ageBand)
  const variation = ageBand === '9-11' ? seedValue.regression : seedValue.progression
  return inferredVariationEquipment(seedValue, variation, ageBand)
}

function ageDosage(phase: FlipFitPhaseKey | 'tumbling', ageBand: FlipFitAgeBand) {
  if (phase === 'prepare_and_access') {
    if (ageBand === '9-11') return { dosage: '1 guided pass', work: '20–30 sec per action', rest: 'As needed to learn positions', intensity: 'RPE 2–3' }
    if (ageBand === '15-18') return { dosage: '1 athlete-led pass', work: '30–40 sec per action', rest: 'Brief transition only', intensity: 'RPE 3–4' }
    return { dosage: '1 continuous pass', work: '30 sec per action', rest: 'Brief transition only', intensity: 'RPE 3' }
  }
  if (phase === 'movement_intelligence') {
    if (ageBand === '9-11') return { dosage: '2–3 sets · 2–3 quality reps', work: '20–30 sec', rest: '40–60 sec', intensity: 'RPE 3–4' }
    if (ageBand === '15-18') return { dosage: '3–4 sets · 3 quality reps', work: '20–35 sec', rest: '45–60 sec', intensity: 'RPE 4–5' }
    return { dosage: '3 sets · 3 quality reps', work: '20–30 sec', rest: '45–60 sec', intensity: 'RPE 4' }
  }
  if (phase === 'output') {
    if (ageBand === '9-11') return { dosage: '3 sets · 1–2 quality reps', work: '3–6 sec', rest: '75–120 sec', intensity: 'Fast with complete control' }
    if (ageBand === '15-18') return { dosage: '4–5 sets · 1–2 quality reps', work: '3–8 sec', rest: '90–150 sec', intensity: 'Maximum available intent' }
    return { dosage: '4 sets · 1–2 quality reps', work: '3–6 sec', rest: '90–120 sec', intensity: 'Maximum quality and intent' }
  }
  if (phase === 'capacity') {
    if (ageBand === '9-11') return { dosage: '2–3 sets · 6–8 reps', work: 'Controlled set', rest: '75–90 sec', intensity: 'RPE 4–6' }
    if (ageBand === '15-18') return { dosage: '3–4 sets · 3–6 reps', work: 'Controlled set', rest: '90–150 sec', intensity: 'RPE 7–8; 2 reps in reserve' }
    return { dosage: '3 sets · 5–8 reps', work: 'Controlled set', rest: '75–120 sec', intensity: 'RPE 6–7; 2–3 reps in reserve' }
  }
  if (phase === 'sustained_capacity') {
    if (ageBand === '9-11') return { dosage: '3 station visits', work: '30 sec', rest: '30 sec', intensity: 'RPE 5–6' }
    if (ageBand === '15-18') return { dosage: '4–5 station visits', work: '45 sec', rest: '15 sec', intensity: 'RPE 7; mechanics stay repeatable' }
    return { dosage: '4 station visits', work: '40 sec', rest: '20 sec', intensity: 'RPE 6–7' }
  }
  if (phase === 'resilience') {
    if (ageBand === '9-11') return { dosage: '2 sets · 5–6 reps or 15-sec hold', work: 'Controlled', rest: '30–45 sec', intensity: 'RPE 4–5' }
    if (ageBand === '15-18') return { dosage: '2–3 sets · 6–8 reps or 25-sec hold', work: 'Slow and controlled', rest: '45–60 sec', intensity: 'RPE 6–7' }
    return { dosage: '2 sets · 6–8 reps or 20-sec hold', work: 'Slow and controlled', rest: '45 sec', intensity: 'RPE 5–6' }
  }
  if (phase === 'restore') {
    return { dosage: '1 continuous reset', work: 'Easy breathing and comfortable range', rest: 'Not applicable', intensity: 'RPE 1–2' }
  }
  if (ageBand === '9-11') return { dosage: 'Coached station · 3–5 quality attempts', work: 'One skill attempt', rest: 'Reset fully between attempts', intensity: 'Technique first' }
  if (ageBand === '15-18') return { dosage: '4–7 quality attempts', work: 'One skill or approved connection', rest: 'Reset fully between attempts', intensity: 'High technical intent' }
  return { dosage: '4–6 quality attempts', work: 'One skill attempt', rest: 'Reset fully between attempts', intensity: 'High technical quality' }
}

function buildAgeScaling(seedValue: ExerciseSeed, phase: FlipFitPhaseKey | 'tumbling'): Record<FlipFitAgeBand, FlipFitAgePrescription> {
  const create = (ageBand: FlipFitAgeBand): FlipFitAgePrescription => {
    const role = ageBand === '9-11' ? 'regression' : ageBand === '15-18' ? 'progression' : 'foundation'
    const variation = ageBand === '9-11' ? seedValue.regression : ageBand === '15-18' ? seedValue.progression : seedValue.name
    const dose = ageDosage(phase, ageBand)
    const scalingGuidance = ageBand === '9-11'
      ? 'Reduce range, load, distance, speed, or choices until the athlete owns the shape. Appropriately sized free weights and youth barbells remain available when technique and supervision are sound.'
      : ageBand === '15-18'
        ? 'Progress one variable at a time—load, range, speed, direction, unilateral demand, or decision complexity. Do not add fatigue to simulate advancement.'
        : 'This is the 12–14 foundation. Use any listed equipment with a technically sound, submaximal prescription and readiness-based coaching.'
    return {
      ageBand,
      role,
      variation,
      ...dose,
      intent: phase === 'output'
        ? 'Stop the set when speed, height, distance, rhythm, or landing quality drops.'
        : phase === 'restore'
          ? 'Lower arousal and leave the athlete feeling better than they entered the phase.'
          : 'Keep the written quality standard; scale before compensations become repetitions.',
      equipment: scaledEquipment(seedValue, ageBand),
      scalingGuidance,
      readinessGate: ageBand === '15-18'
        ? 'Use only after the 12–14 foundation variation is consistently clean and the coach approves the added demand.'
        : 'Pain-free setup, understands the stop signal, and can repeat the chosen variation with stable technique.',
    }
  }
  return {
    '9-11': create('9-11'),
    '12-14': create('12-14'),
    '15-18': create('15-18'),
  }
}

function defaultInstructions(seedValue: ExerciseSeed, phase: FlipFitPhaseKey | 'tumbling') {
  if (phase === 'output') return ['Set the exact start and finish positions.', 'Perform one brief high-intent effort.', 'Reset fully and repeat only while output quality is stable.']
  if (phase === 'capacity') return ['Set the implement and stance before the first repetition.', 'Use the prescribed range and controlled tempo.', 'Finish with the planned repetitions still technically available.']
  if (phase === 'sustained_capacity') return ['Set a simple repeatable station.', 'Keep breathing and mechanics consistent through the interval.', 'Reduce pace or load before form changes.']
  if (phase === 'tumbling') return ['Review the prerequisite and landing zone.', 'Perform one coached attempt at a time.', 'Exit to a controlled finish before the next athlete begins.']
  return [`Set the start position for ${seedValue.name}.`, 'Move through the available range with control.', 'Reset when balance, rhythm, or posture changes.']
}

function buildExerciseCard(
  seedValue: ExerciseSeed,
  phase: FlipFitPhaseKey | 'tumbling',
): FlipFitExerciseCard {
  const loaded = seedValue.equipment.some((item) => /barbell|trap bar|landmine|dumbbell|kettlebell|sled|cable/i.test(item))
  const impactLevel: FlipFitExerciseCard['impactLevel'] = /drop|depth|handspring|lache|maximum|sprint|jump|bound|hop|rebound/i.test(seedValue.name)
    ? 'moderate'
    : 'low'
  return {
    id: `${phase}-${slugify(seedValue.name)}`,
    name: seedValue.name,
    aliases: [...(seedValue.aliases ?? [])].sort((a, b) => a.localeCompare(b)),
    description: `${seedValue.name} develops ${seedValue.tenets.join(', ').toLowerCase()} through the ${seedValue.movementPattern.toLowerCase()} pattern.`,
    instructions: defaultInstructions(seedValue, phase),
    coachingCues: seedValue.cues ?? ['Own the start position.', 'Move with quiet, repeatable control.', 'Stop on the first meaningful quality loss.'],
    commonErrors: ['Rushing the setup', 'Adding range, load, or speed after quality declines', 'Treating fatigue as successful progression'],
    movementPattern: seedValue.movementPattern,
    phase,
    methodology: seedValue.methodology ?? (phase === 'output' ? 'Plyometric' : 'Skill acquisition'),
    tenets: [...new Set(seedValue.tenets)].sort((a, b) => FLIP_FIT_TENETS.indexOf(a) - FLIP_FIT_TENETS.indexOf(b)),
    bodyRegions: [...new Set(seedValue.bodyRegions)].sort((a, b) => a.localeCompare(b)),
    equipment: sortedEquipment(seedValue.equipment, '12-14'),
    impactLevel,
    freshnessRequirement: phase === 'output' ? 'high' : phase === 'movement_intelligence' || phase === 'capacity' || phase === 'tumbling' ? 'moderate' : 'low',
    safetyNotes: seedValue.safety ?? [
      'Use a clear station, an athlete-sized setup, and the facility stop signal.',
      loaded ? 'Choose load from demonstrated technique; do not prescribe routine true 1RM attempts.' : 'Scale range or complexity before adding repetitions.',
    ],
    supervision: phase === 'tumbling'
      ? 'Direct qualified supervision; hands-on spotting only by an appropriately trained coach.'
      : loaded
        ? 'Active coach supervision with equipment setup and technique checks.'
        : 'Active floor supervision with clear station boundaries.',
    prerequisites: seedValue.prerequisites ?? ['Pain-free setup', 'Understands the primary cue and stop signal'],
    matchStatus: seedValue.matchStatus ?? 'new',
    ageScaling: buildAgeScaling(seedValue, phase),
    under9EquipmentNote: loaded
      ? 'For an athlete younger than 9 outside the selectable schedule bands, a youth-size barbell may be used as a technique implement under direct qualified supervision after a separate readiness assessment.'
      : undefined,
  }
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value
  for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested)
  return Object.freeze(value)
}

function cardPayload(card: FlipFitExerciseCard) {
  return JSON.stringify(card)
}

function scheduled(
  cardInventory: Map<string, FlipFitExerciseCard>,
  sessionId: string,
  phase: FlipFitPhaseKey | 'tumbling',
  slot: number,
  allocationMinutes: number,
  seedValue: ExerciseSeed,
  movementFunction: string,
): FlipFitScheduledExercise {
  const candidate = buildExerciseCard(seedValue, phase)
  const existing = cardInventory.get(candidate.id)
  if (existing && cardPayload(existing) !== cardPayload(candidate)) {
    throw new Error(`Flip & Fit card ID ${candidate.id} resolved to more than one payload.`)
  }
  const card = existing ?? deepFreeze(candidate)
  if (!existing) cardInventory.set(card.id, card)
  return {
    id: `${sessionId}-${phase}-${slot + 1}`,
    cardId: card.id,
    allocationMinutes,
    movementFunction,
    card,
  }
}

function phaseObjective(phase: FlipFitPhaseKey, movementFunction: string, capacityFocus: string) {
  if (phase === 'prepare_and_access') return `Raise temperature and access positions for ${movementFunction} without fatigue.`
  if (phase === 'movement_intelligence') return `Learn and adapt the week’s ${movementFunction} pattern while fresh.`
  if (phase === 'output') return `Express ${movementFunction} with brief maximum-quality speed or power.`
  if (phase === 'capacity') return `Build ${capacityFocus.toLowerCase()} with technically sound resistance.`
  if (phase === 'sustained_capacity') return 'Repeat simple, familiar athletic work under controlled fatigue.'
  if (phase === 'resilience') return `Build force acceptance and joint control that support ${movementFunction}.`
  return 'Lower arousal, restore breathing, and finish with comfortable mobility.'
}

function capacityPhaseFor(weekNumber: number, dayNumber: number): 'capacity' | 'sustained_capacity' {
  const capacityDays = weekNumber % 2 === 1 ? [1, 2] : [3, 4, 5]
  return capacityDays.includes(dayNumber) ? 'capacity' : 'sustained_capacity'
}

function roundStress(value: number) {
  return Math.round(value * 10) / 10
}

export function deriveFlipFitStressProfile(exercises: FlipFitScheduledExercise[]): FlipFitStressProfile {
  const regionLoad: Record<string, number> = {}
  const impactExercises = new Set<string>()
  const eccentricExercises = new Set<string>()
  let effectiveVolumeMinutes = 0
  let moderateImpactMinutes = 0
  let highImpactMinutes = 0
  let moderateFreshnessMinutes = 0
  let highFreshnessMinutes = 0
  let eccentricMinutes = 0
  let tempoMinutes = 0
  let restoreMinutes = 0

  for (const exercise of exercises) {
    const { card, allocationMinutes } = exercise
    const phaseWeight = STRESS_VOLUME_WEIGHTS[card.phase]
    const effectiveMinutes = allocationMinutes * phaseWeight
    const impactScore = STRESS_LEVEL_SCORE[card.impactLevel]
    const isEccentric = ECCENTRIC_METHOD_PATTERN.test(card.methodology)
    effectiveVolumeMinutes += effectiveMinutes
    if (card.phase === 'restore') restoreMinutes += allocationMinutes

    if (card.impactLevel === 'moderate') moderateImpactMinutes += allocationMinutes
    if (card.impactLevel === 'high') highImpactMinutes += allocationMinutes
    if (card.impactLevel !== 'low') impactExercises.add(card.name)
    if (card.freshnessRequirement === 'moderate') moderateFreshnessMinutes += allocationMinutes
    if (card.freshnessRequirement === 'high') highFreshnessMinutes += allocationMinutes
    if (isEccentric) {
      eccentricMinutes += allocationMinutes
      eccentricExercises.add(card.name)
    } else if (TEMPO_METHOD_PATTERN.test(card.methodology)) {
      tempoMinutes += allocationMinutes
    }

    const regions = card.bodyRegions.length > 0 ? card.bodyRegions : ['Total body']
    const stressMultiplier = 1 + (impactScore - 1) * 0.1 + (isEccentric ? 0.15 : 0)
    const contribution = (effectiveMinutes * stressMultiplier) / regions.length
    for (const region of regions) regionLoad[region] = (regionLoad[region] ?? 0) + contribution
  }

  const sortedRegions = Object.entries(regionLoad)
    .map(([region, load]) => ({ region, load: roundStress(load) }))
    .sort((left, right) => right.load - left.load || left.region.localeCompare(right.region))
  const maxRegionLoad = sortedRegions[0]?.load ?? 0
  const bodyRegions = sortedRegions
    .filter(({ load }) => load >= Math.max(2, maxRegionLoad * 0.35))
    .slice(0, 6)
    .map(({ region }) => region)
  const topRegion = sortedRegions[0]
  const topNonTrunk = sortedRegions.find(({ region }) => region !== 'Trunk')
  const primaryRegion = topRegion?.region === 'Trunk' && topNonTrunk && topNonTrunk.load >= topRegion.load * 0.65
    ? topNonTrunk.region
    : topRegion?.region ?? 'Total body'
  const impact: FlipFitStressProfile['impact'] = highImpactMinutes >= 6 || moderateImpactMinutes >= 40
    ? 3
    : highImpactMinutes + moderateImpactMinutes > 0 ? 2 : 1
  const freshness: FlipFitStressProfile['freshness'] = highFreshnessMinutes >= 30 || (highImpactMinutes >= 6 && highFreshnessMinutes >= 10)
    ? 3
    : highFreshnessMinutes > 0 || moderateFreshnessMinutes >= 30 ? 2 : 1
  const eccentricDemand: FlipFitStressProfile['eccentricDemand'] = eccentricMinutes >= 8
    ? 3
    : eccentricMinutes > 0 || tempoMinutes >= 12 ? 2 : 1
  const volume: FlipFitStressProfile['volume'] = effectiveVolumeMinutes >= 58
    ? 3
    : effectiveVolumeMinutes >= 45 ? 2 : 1

  return {
    primaryRegion,
    bodyRegions,
    regionLoad: Object.fromEntries(sortedRegions.map(({ region, load }) => [region, load])),
    impact,
    freshness,
    eccentricDemand,
    volume,
    evidence: {
      effectiveVolumeMinutes: roundStress(effectiveVolumeMinutes),
      moderateImpactMinutes,
      highImpactMinutes,
      highFreshnessMinutes,
      eccentricMinutes,
      tempoMinutes,
      restoreMinutes,
      impactExercises: [...impactExercises].sort((a, b) => a.localeCompare(b)),
      eccentricExercises: [...eccentricExercises].sort((a, b) => a.localeCompare(b)),
    },
  }
}

export function summarizeFlipFitWeeklyStress(days: FlipFitTrainingDay[]): FlipFitWeeklyStressSummary {
  const regions = new Map<string, { load: number; days: number; peakDailyLoad: number }>()
  for (const day of days) {
    for (const [region, load] of Object.entries(day.stress.regionLoad)) {
      const current = regions.get(region) ?? { load: 0, days: 0, peakDailyLoad: 0 }
      current.load += load
      current.days += load > 0 ? 1 : 0
      current.peakDailyLoad = Math.max(current.peakDailyLoad, load)
      regions.set(region, current)
    }
  }
  return {
    bodyRegions: [...regions.entries()]
      .map(([region, summary]) => ({
        region,
        load: roundStress(summary.load),
        days: summary.days,
        peakDailyLoad: roundStress(summary.peakDailyLoad),
      }))
      .sort((left, right) => right.load - left.load || left.region.localeCompare(right.region)),
    impact: {
      lowDays: days.filter((day) => day.stress.impact === 1).length,
      moderateDays: days.filter((day) => day.stress.impact === 2).length,
      highDays: days.filter((day) => day.stress.impact === 3).length,
      exposureMinutes: days.reduce((sum, day) => sum + day.stress.evidence.moderateImpactMinutes + day.stress.evidence.highImpactMinutes, 0),
    },
    recovery: {
      highFreshnessDays: days.filter((day) => day.stress.freshness === 3).length,
      highEccentricDays: days.filter((day) => day.stress.eccentricDemand === 3).length,
      highVolumeDays: days.filter((day) => day.stress.volume === 3).length,
      restoreMinutes: days.reduce((sum, day) => sum + day.stress.evidence.restoreMinutes, 0),
    },
  }
}

function buildCoverage(days: FlipFitTrainingDay[]): FlipFitCoverageSummary {
  const tenets = Object.fromEntries(FLIP_FIT_TENETS.map((tenet) => [tenet, 0])) as Record<FlipFitTenet, number>
  const bodyRegions: Record<string, number> = {}
  const equipment = new Set<string>()
  const performanceHits = { Speed: 0, Agility: 0, Strength: 0, Power: 0 }

  for (const day of days) {
    for (const tenet of day.tenets) tenets[tenet] += 1
    const exercises = [...day.phases.flatMap((phase) => phase.exercises), ...day.tumbling.exercises]
    for (const exercise of exercises) {
      for (const region of exercise.card.bodyRegions) bodyRegions[region] = (bodyRegions[region] ?? 0) + 1
      for (const item of exercise.card.equipment) equipment.add(item)
      if (exercise.card.tenets.includes('Speed')) performanceHits.Speed += 1
      if (exercise.card.tenets.includes('Agility')) performanceHits.Agility += 1
      if (exercise.card.tenets.includes('Strength')) performanceHits.Strength += 1
      if (exercise.card.tenets.includes('Explosiveness')) performanceHits.Power += 1
    }
  }
  const maxHit = Math.max(1, ...Object.values(performanceHits))
  return {
    tenets: Object.fromEntries(FLIP_FIT_TENETS.map((tenet) => [tenet, Math.round((tenets[tenet] / days.length) * 100)])) as Record<FlipFitTenet, number>,
    performanceBalance: Object.fromEntries(Object.entries(performanceHits).map(([key, value]) => [key, Math.round((value / maxHit) * 100)])) as FlipFitCoverageSummary['performanceBalance'],
    bodyRegions,
    equipment: [...equipment].sort(),
    stress: summarizeFlipFitWeeklyStress(days),
  }
}

export function generateFlipFitProgram(startDate: string): FlipFitProgram {
  const start = parseIsoDate(startDate)
  if (start.getUTCDay() !== 1) throw new Error('Flip & Fit must start on a Monday.')

  const weeks: FlipFitProgramWeek[] = []
  const sessions: FlipFitTrainingDay[] = []
  const cardInventory = new Map<string, FlipFitExerciseCard>()

  for (let weekIndex = 0; weekIndex < FLIP_FIT_WEEK_SPECS.length; weekIndex += 1) {
    const weekNumber = weekIndex + 1
    const spec = FLIP_FIT_WEEK_SPECS[weekIndex]
    const days: FlipFitTrainingDay[] = []

    for (let dayIndex = 0; dayIndex < 5; dayIndex += 1) {
      const dayNumber = dayIndex + 1
      const sessionId = `flip-fit-w${String(weekNumber).padStart(2, '0')}-d${dayNumber}`
      const date = isoDate(addUtcDays(start, weekIndex * 7 + dayIndex))
      const capacityKey = capacityPhaseFor(weekNumber, dayNumber)
      const focusPrimer = M(
        `${spec.movementFunction} access primer`,
        `Supported ${spec.movementFunction.toLowerCase()} access primer`,
        `Athlete-led ${spec.movementFunction.toLowerCase()} access primer`,
        {
          equipment: [...new Set(spec.movement.flatMap((exercise) => exercise.equipment))],
          movementPattern: 'Daily movement access',
          bodyRegions: [...new Set(spec.movement.flatMap((exercise) => exercise.bodyRegions))],
          tenets: ['Flexibility and Mobility', 'Balance', 'Coordination', 'Body Control'],
          methodology: 'Dynamic preparation',
          matchStatus: 'new',
        },
      )
      const schedule = (
        phase: FlipFitPhaseKey | 'tumbling',
        slot: number,
        allocationMinutes: number,
        seedValue: ExerciseSeed,
      ) => scheduled(cardInventory, sessionId, phase, slot, allocationMinutes, seedValue, spec.movementFunction)

      const prepareExercises = [
        schedule('prepare_and_access', 0, 6, PREPARE_CORE),
        schedule('prepare_and_access', 1, 4, focusPrimer),
      ]
      const movementExercises = [
        schedule('movement_intelligence', 0, 10, spec.movement[dayIndex]),
        schedule('movement_intelligence', 1, 10, spec.movement[(dayIndex + 1) % 5]),
      ]
      const outputExercises = [
        schedule('output', 0, 10, spec.output[dayIndex]),
        schedule('output', 1, 10, spec.output[(dayIndex + 1) % 5]),
      ]
      const capacityExercises = capacityKey === 'capacity'
        ? [
            schedule('capacity', 0, 8, spec.capacity[dayIndex]),
            schedule('capacity', 1, 8, spec.capacity[(dayIndex + 1) % 5]),
            schedule('capacity', 2, 9, UPPER_SUPPORT_POOL[dayIndex]),
          ]
        : [
            schedule('sustained_capacity', 0, 8, SUSTAINED_CAPACITY_POOL[dayIndex]),
            schedule('sustained_capacity', 1, 8, SUSTAINED_CAPACITY_POOL[(dayIndex + 1) % 5]),
            schedule('sustained_capacity', 2, 9, SUSTAINED_CAPACITY_POOL[(dayIndex + 2) % 5]),
          ]
      const resilienceExercises = [
        schedule('resilience', 0, 5, spec.resilience[dayIndex]),
        schedule('resilience', 1, 5, spec.resilience[(dayIndex + 1) % 5]),
      ]
      const restoreExercises = [schedule('restore', 0, 5, RESTORE_CORE)]

      const phases: FlipFitSessionPhase[] = [
        { key: 'prepare_and_access', name: PHASE_NAMES.prepare_and_access, durationMinutes: 10, objective: phaseObjective('prepare_and_access', spec.movementFunction, spec.capacityFocus), exercises: prepareExercises },
        { key: 'movement_intelligence', name: PHASE_NAMES.movement_intelligence, durationMinutes: 20, objective: phaseObjective('movement_intelligence', spec.movementFunction, spec.capacityFocus), exercises: movementExercises },
        { key: 'output', name: PHASE_NAMES.output, durationMinutes: 20, objective: phaseObjective('output', spec.movementFunction, spec.capacityFocus), exercises: outputExercises },
        { key: capacityKey, name: PHASE_NAMES[capacityKey], durationMinutes: 25, objective: phaseObjective(capacityKey, spec.movementFunction, spec.capacityFocus), exercises: capacityExercises },
        { key: 'resilience', name: PHASE_NAMES.resilience, durationMinutes: 10, objective: phaseObjective('resilience', spec.movementFunction, spec.capacityFocus), exercises: resilienceExercises },
        { key: 'restore', name: PHASE_NAMES.restore, durationMinutes: 5, objective: phaseObjective('restore', spec.movementFunction, spec.capacityFocus), exercises: restoreExercises },
      ]

      const tumblingExercises = [
        schedule('tumbling', 0, 6, TUMBLING_PREP),
        schedule('tumbling', 1, 12, spec.tumbling[dayIndex]),
        schedule('tumbling', 2, 12, spec.tumbling[(dayIndex + 1) % 5]),
      ]
      const allExercises = [...phases.flatMap((phase) => phase.exercises), ...tumblingExercises]
      const tenets = [...new Set(allExercises.flatMap((exercise) => exercise.card.tenets))]
        .filter((tenet): tenet is FlipFitTenet => FLIP_FIT_TENETS.includes(tenet))

      const day: FlipFitTrainingDay = {
        id: sessionId,
        weekNumber,
        dayNumber,
        dayName: DAY_NAMES[dayIndex],
        date,
        movementFunction: spec.movementFunction,
        objective: `${DAY_OBJECTIVES[dayIndex]} ${spec.coachingObjective}`,
        phases,
        tumbling: {
          durationMinutes: 30,
          objective: `Build recurring tumbling prerequisites and apply ${spec.movementFunction.toLowerCase()} without changing the athletic phase order.`,
          exercises: tumblingExercises,
        },
        athleticMinutes: 90,
        totalMinutes: 120,
        stress: deriveFlipFitStressProfile(allExercises),
        tenets,
      }
      days.push(day)
      sessions.push(day)
    }

    weeks.push({
      weekNumber,
      dateRange: { start: days[0].date, end: days[4].date },
      movementFunction: spec.movementFunction,
      capacityFocus: spec.capacityFocus,
      coachingObjective: spec.coachingObjective,
      progression: spec.progression,
      days,
      coverage: buildCoverage(days),
    })
  }

  return {
    version: FLIP_FIT_PROGRAM_VERSION,
    name: 'Flip & Fit',
    startDate,
    endDate: flipFitEndDate(startDate),
    weeks,
    sessions,
    exerciseCards: [...cardInventory.values()].sort((a, b) => a.name.localeCompare(b.name)),
  }
}

function normalizedCardKeys(card: FlipFitExerciseCard) {
  return [card.name, ...card.aliases].map((value) => slugify(value)).filter(Boolean)
}

export function validateFlipFitProgram(program: FlipFitProgram): FlipFitValidationResult {
  const errors: FlipFitValidationIssue[] = []
  const warnings: FlipFitValidationIssue[] = []
  let checks = 0
  const test = (
    condition: boolean,
    code: string,
    message: string,
    resolution: string,
    severity: FlipFitValidationIssue['severity'] = 'error',
    sessionId?: string,
  ) => {
    checks += 1
    if (condition) return
    const issue = { code, severity, message, resolution, sessionId }
    if (severity === 'warning') warnings.push(issue)
    else errors.push(issue)
  }

  let parsedStart: Date | null = null
  try {
    parsedStart = parseIsoDate(program.startDate)
  } catch {
    parsedStart = null
  }
  test(parsedStart?.getUTCDay() === 1, 'calendar.start_monday', 'The program start date is not a Monday.', 'Choose a Monday before regenerating the calendar.')
  test(program.endDate === (parsedStart ? isoDate(addUtcDays(parsedStart, 81)) : ''), 'calendar.end_date', 'The end date is not the twelfth Friday.', 'Regenerate dates from the confirmed Monday anchor.')
  test(program.weeks.length === 12, 'calendar.week_count', `Expected 12 weeks; found ${program.weeks.length}.`, 'Regenerate the complete 12-week curriculum.')
  test(program.sessions.length === 60, 'calendar.session_count', `Expected 60 sessions; found ${program.sessions.length}.`, 'Regenerate all five weekdays for all 12 weeks.')
  test(program.weeks.every((week) => week.days.length === 5), 'calendar.five_days', 'At least one week does not contain five training dates.', 'Restore Monday-through-Friday dates for every week.')
  test(program.weeks.every((week, index) => week.movementFunction === FLIP_FIT_WEEK_SPECS[index]?.movementFunction), 'calendar.function_order', 'The Primary Movement Functions are out of order.', 'Restore the canonical 12-function sequence.')

  const cardIds = new Set(program.exerciseCards.map((card) => card.id))
  const cardsById = new Map(program.exerciseCards.map((card) => [card.id, card]))
  const cardKeyOwner = new Map<string, string>()
  let duplicateCardIdentity = false
  for (const card of program.exerciseCards) {
    for (const key of normalizedCardKeys(card)) {
      const owner = cardKeyOwner.get(key)
      if (owner && owner !== card.id) duplicateCardIdentity = true
      else cardKeyOwner.set(key, card.id)
    }
  }
  test(program.exerciseCards.length === cardIds.size, 'cards.idempotent_ids', 'Duplicate program card IDs were generated.', 'Normalize card identity and reuse the existing program card.')
  test(!duplicateCardIdentity, 'cards.normalized_duplicates', 'Two program cards share a normalized name or alias.', 'Merge aliases into one canonical program card.')
  test(program.exerciseCards.every((card) => ['reused', 'alias', 'new', 'review'].includes(card.matchStatus)), 'cards.match_status', 'At least one card lacks a matching-workflow status.', 'Mark every card as reused, alias matched, newly created, or coach review.')
  test(program.exerciseCards.every((card) => FLIP_FIT_AGE_BANDS.every((ageBand) => Boolean(card.ageScaling[ageBand]))), 'scaling.all_cards', 'At least one card is missing an age-specific prescription.', 'Add 9–11, 12–14, and 15–18 prescriptions to every card.')
  test(program.exerciseCards.every((card) => FLIP_FIT_AGE_BANDS.every((ageBand) => card.ageScaling[ageBand].equipment.length > 0)), 'scaling.age_equipment', 'At least one age-specific variation lacks equipment.', 'Infer or explicitly provide equipment for every age-specific variation.')
  test(program.exerciseCards.every((card) => cardPayload(card) === cardPayload(cardsById.get(card.id)!)), 'cards.inventory_payload', 'A card ID resolves to inconsistent inventory data.', 'Keep one immutable canonical payload per program card ID.')
  test(program.exerciseCards.every((card) => card.ageScaling['12-14'].role === 'foundation'), 'scaling.foundation', 'A 12–14 prescription is not marked as the foundation.', 'Keep ages 12–14 as the primary prescription on every exercise.')
  test(program.exerciseCards.every((card) => card.ageScaling['9-11'].role === 'regression'), 'scaling.regression', 'A 9–11 prescription is not marked as a regression.', 'Provide a lower-complexity or lower-dose 9–11 path for every exercise.')
  test(program.exerciseCards.every((card) => card.ageScaling['15-18'].role === 'progression'), 'scaling.progression', 'A 15–18 prescription is not marked as a progression.', 'Provide a readiness-gated 15–18 progression for every exercise.')
  const loadedCards = program.exerciseCards.filter((card) => card.equipment.some((item) => /barbell|trap bar|landmine|dumbbell|kettlebell|sled|cable/i.test(item)))
  test(loadedCards.every((card) => Boolean(card.under9EquipmentNote)), 'scaling.under9_barbell_note', 'A loaded card omits the under-9 youth-barbell equipment policy.', 'Add the separate readiness and direct-supervision note for younger athletes.')

  for (const session of program.sessions) {
    const expectedCapacity = capacityPhaseFor(session.weekNumber, session.dayNumber)
    const expectedOrder: FlipFitPhaseKey[] = ['prepare_and_access', 'movement_intelligence', 'output', expectedCapacity, 'resilience', 'restore']
    test(session.phases.map((phase) => phase.key).join('|') === expectedOrder.join('|'), 'session.phase_order', `${session.id} has an invalid athletic phase order.`, 'Restore Prepare → Movement Intelligence → Output → capacity slot → Resilience → Restore.', 'error', session.id)
    test(session.phases.reduce((total, phase) => total + phase.durationMinutes, 0) === 90, 'session.athletic_time', `${session.id} does not total 90 athletic minutes.`, 'Restore the 10/20/20/25/10/5 phase allocation.', 'error', session.id)
    const durationMap = new Map(session.phases.map((phase) => [phase.key, phase.durationMinutes]))
    test(durationMap.get('prepare_and_access') === 10, 'session.prepare_time', `${session.id} Prepare & Access is not 10 minutes.`, 'Set Prepare & Access to 10 minutes.', 'error', session.id)
    test(durationMap.get('movement_intelligence') === 20, 'session.movement_time', `${session.id} Movement Intelligence is not 20 minutes.`, 'Set Movement Intelligence to 20 minutes.', 'error', session.id)
    test(durationMap.get('output') === 20, 'session.output_time', `${session.id} Output is not 20 minutes.`, 'Set Output to 20 minutes.', 'error', session.id)
    test(durationMap.get(expectedCapacity) === 25, 'session.capacity_time', `${session.id} capacity slot is not 25 minutes.`, 'Set the assigned Capacity or Sustained Capacity phase to 25 minutes.', 'error', session.id)
    test(durationMap.get('resilience') === 10, 'session.resilience_time', `${session.id} Resilience is not 10 minutes.`, 'Set Resilience to 10 minutes.', 'error', session.id)
    test(durationMap.get('restore') === 5, 'session.restore_time', `${session.id} Restore is not 5 minutes.`, 'Set Restore to 5 minutes.', 'error', session.id)
    test(session.tumbling.durationMinutes === 30, 'session.tumbling_time', `${session.id} tumbling is not 30 minutes.`, 'Restore the separate 30-minute tumbling block.', 'error', session.id)
    test(session.totalMinutes === 120, 'session.total_time', `${session.id} athlete participation time is not 120 minutes.`, 'Keep 90 athletic minutes plus 30 tumbling minutes.', 'error', session.id)
    test(session.phases.every((phase) => phase.exercises.reduce((sum, exercise) => sum + exercise.allocationMinutes, 0) === phase.durationMinutes), 'session.exercise_allocations', `${session.id} has exercise allocations that do not fit a phase.`, 'Adjust station allocations inside the existing phase window.', 'error', session.id)
    test(session.tumbling.exercises.reduce((sum, exercise) => sum + exercise.allocationMinutes, 0) === 30, 'session.tumbling_allocations', `${session.id} tumbling stations do not total 30 minutes.`, 'Adjust tumbling stations to 6/12/12 minutes.', 'error', session.id)

    const allExercises = [...session.phases.flatMap((phase) => phase.exercises), ...session.tumbling.exercises]
    test(allExercises.every((exercise) => cardIds.has(exercise.cardId)), 'cards.every_exercise', `${session.id} references an exercise without a program card.`, 'Create or match the missing exercise card.', 'error', session.id)
    test(allExercises.every((exercise) => {
      const canonical = cardsById.get(exercise.cardId)
      return Boolean(canonical) && cardPayload(exercise.card) === cardPayload(canonical!)
    }), 'cards.immutable_payload', `${session.id} resolves one card ID to multiple payloads.`, 'Move session context into the scheduled exercise and reuse one immutable card payload.', 'error', session.id)
    test(allExercises.every((exercise) => exercise.movementFunction === session.movementFunction), 'cards.scheduled_context', `${session.id} has a scheduled exercise with the wrong movement-function context.`, 'Keep weekly movement function on the scheduled occurrence rather than the canonical card.', 'error', session.id)
    test(JSON.stringify(session.stress) === JSON.stringify(deriveFlipFitStressProfile(allExercises)), 'stress.derived_profile', `${session.id} has stress values that do not match its scheduled exercises.`, 'Recalculate stress from card regions, impact, freshness, methodology, allocation, and phase density.', 'error', session.id)
    const output = session.phases.find((phase) => phase.key === 'output')
    test(Boolean(output) && output!.exercises.every((exercise) => OUTPUT_METHODS.has(exercise.card.methodology)), 'method.output', `${session.id} Output contains an excluded methodology.`, 'Use only high-velocity plyometric, ballistic, overspeed, or qualified speed/power methods.', 'error', session.id)
    const capacity = session.phases.find((phase) => phase.key === 'capacity')
    test(!capacity || capacity.exercises.every((exercise) => CAPACITY_METHODS.has(exercise.card.methodology)), 'method.capacity', `${session.id} Capacity contains an Output-only methodology.`, 'Use a strength-application methodology in Capacity.', 'error', session.id)
    const sustained = session.phases.find((phase) => phase.key === 'sustained_capacity')
    test(!sustained || sustained.exercises.every((exercise) => ['Simple interval', 'Tempo locomotion', 'Carry circuit'].includes(exercise.card.methodology)), 'method.sustained', `${session.id} Sustained Capacity contains a complex or inappropriate method.`, 'Use a familiar carry, crawl, tempo-locomotion, or simple interval station.', 'error', session.id)
    const restore = session.phases.find((phase) => phase.key === 'restore')
    test(Boolean(restore) && restore!.exercises.every((exercise) => exercise.card.methodology === 'Recovery breathing' && exercise.card.impactLevel === 'low'), 'method.restore', `${session.id} Restore introduces new stress.`, 'Use only the stable low-stress breathing and mobility reset.', 'error', session.id)
  }

  test(program.sessions.every((session) => session.phases[0].exercises[0].cardId === 'prepare_and_access-vortex-locomotor-ramp-sequence'), 'sequence.prepare_core', 'Prepare & Access does not maintain its stable core sequence.', 'Restore the standard Vortex RAMP card as the first item each day.')
  test(program.sessions.every((session) => session.phases[5].exercises[0].cardId === 'restore-crocodile-breathing-and-mobility-reset'), 'sequence.restore_core', 'Restore does not maintain its stable core sequence.', 'Restore the standard breathing and mobility reset each day.')
  test(program.sessions.every((session) => session.phases[3].key === capacityPhaseFor(session.weekNumber, session.dayNumber)), 'rotation.week_ab', 'The Week A/Week B Capacity rotation is incorrect.', 'Odd weeks use Capacity Mon/Tue; even weeks use Capacity Wed/Thu/Fri.')

  for (let weekIndex = 0; weekIndex < program.weeks.length - 1; weekIndex += 1) {
    const rolling = new Set(program.weeks.slice(weekIndex, weekIndex + 2).flatMap((week) => week.days.flatMap((day) => day.tenets)))
    test(FLIP_FIT_TENETS.every((tenet) => rolling.has(tenet)), 'coverage.rolling_two_week', `Weeks ${weekIndex + 1}–${weekIndex + 2} omit an athletic tenet.`, 'Add a legitimate exercise that develops the missing tenet inside the two-week window.')
  }

  const allCardsByOccurrence = program.sessions.flatMap((session) => [...session.phases.flatMap((phase) => phase.exercises), ...session.tumbling.exercises].map((exercise) => exercise.card))
  const lowerRegions = new Set(['Foot', 'Ankle', 'Calf', 'Shin', 'Knee', 'Quadriceps', 'Hamstring', 'Hip', 'Adductor'])
  const upperRegions = new Set(['Grip', 'Wrist', 'Forearm', 'Shoulder', 'Chest', 'Back'])
  const lowerHits = allCardsByOccurrence.reduce((sum, card) => sum + card.bodyRegions.filter((region) => lowerRegions.has(region)).length, 0)
  const upperHits = allCardsByOccurrence.reduce((sum, card) => sum + card.bodyRegions.filter((region) => upperRegions.has(region)).length, 0)
  test(lowerHits > upperHits, 'coverage.lower_emphasis', 'The program does not retain its intended lower-body emphasis.', 'Increase quality lower-body strength and tissue-capacity exposure without removing upper-body balance.')
  test(program.weeks.every((week) => {
    const regions = new Set(week.days.flatMap((day) => [...day.phases.flatMap((phase) => phase.exercises), ...day.tumbling.exercises].flatMap((exercise) => exercise.card.bodyRegions)))
    return ['Hip', 'Shoulder', 'Chest', 'Back', 'Trunk'].every((region) => regions.has(region))
  }), 'coverage.whole_body', 'At least one week neglects a major upper-body, trunk, or lower-body region.', 'Add an appropriate push, pull, trunk, and lower-body exposure to the week.')
  test(program.weeks.every((week) => JSON.stringify(week.coverage.stress) === JSON.stringify(summarizeFlipFitWeeklyStress(week.days))), 'stress.weekly_summary', 'At least one weekly stress summary does not match its scheduled days.', 'Rebuild weekly body-region, impact, and recovery totals from the derived daily profiles.')

  for (const week of program.weeks) {
    for (let dayIndex = 1; dayIndex < week.days.length; dayIndex += 1) {
      const previousDay = week.days[dayIndex - 1]
      const currentDay = week.days[dayIndex]
      const previous = week.days[dayIndex - 1].stress
      const current = week.days[dayIndex].stress
      const repeatedHighRegion = Object.keys(previous.regionLoad)
        .filter((region) => !DIFFUSE_STABILIZER_REGIONS.has(region) && previous.regionLoad[region] >= HIGH_REGION_LOAD && (current.regionLoad[region] ?? 0) >= HIGH_REGION_LOAD)
        .sort((left, right) => Math.min(previous.regionLoad[right], current.regionLoad[right]) - Math.min(previous.regionLoad[left], current.regionLoad[left]))[0]
      const previousImpactMinutes = previous.evidence.moderateImpactMinutes + previous.evidence.highImpactMinutes
      const currentImpactMinutes = current.evidence.moderateImpactMinutes + current.evidence.highImpactMinutes
      test(!(previous.impact === 3 && current.impact === 3), 'stress.consecutive_impact', `${currentDay.id} follows ${previousDay.id} with ${previousImpactMinutes} then ${currentImpactMinutes} impact-exposure minutes.`, 'Regress or replace one moderate/high-impact Output or tumbling card, or separate the exposures with a recovery day.', 'warning', currentDay.id)
      test(!(Boolean(repeatedHighRegion) && previous.volume === 3 && current.volume === 3), 'stress.consecutive_region', `${currentDay.id} repeats high ${repeatedHighRegion ?? 'regional'} load after ${previousDay.id} (${repeatedHighRegion ? `${previous.regionLoad[repeatedHighRegion]} → ${current.regionLoad[repeatedHighRegion]} weighted load` : 'high load'}).`, `Reduce allocation or load for one ${repeatedHighRegion ?? 'regional'} station, substitute a lower-stress card, or rotate the Capacity emphasis.`, 'warning', currentDay.id)
      test(!(previous.eccentricDemand === 3 && current.eccentricDemand === 3), 'stress.consecutive_eccentric', `${currentDay.id} follows ${previousDay.id} with ${previous.evidence.eccentricMinutes} then ${current.evidence.eccentricMinutes} explicit eccentric minutes.`, 'Reduce one eccentric dose, substitute a non-eccentric resilience card, or add a recovery buffer.', 'warning', currentDay.id)
      test(!(previous.freshness === 3 && current.freshness === 3 && (previous.volume === 3 || current.volume === 3)), 'stress.consecutive_freshness', `${currentDay.id} follows ${previousDay.id} with back-to-back high-freshness demand (${previous.evidence.highFreshnessMinutes} then ${current.evidence.highFreshnessMinutes} minutes).`, 'Lower one day’s neural demand or move the high-freshness card behind a recovery buffer.', 'warning', currentDay.id)
    }
  }

  test(FLIP_FIT_ATHLETE_SETS[0].blocks[0].label === 'Athletic workout' && FLIP_FIT_ATHLETE_SETS[0].blocks[1].label === 'Shared tumbling', 'sets.set1_order', 'Athlete Set 1 is not workout then tumbling.', 'Restore the 90-minute workout before shared tumbling.')
  test(FLIP_FIT_ATHLETE_SETS[1].blocks[0].label === 'Shared tumbling' && FLIP_FIT_ATHLETE_SETS[1].blocks[1].label === 'Athletic workout', 'sets.set2_order', 'Athlete Set 2 is not tumbling then workout.', 'Restore shared tumbling before the 90-minute workout.')
  test(FLIP_FIT_ATHLETE_SETS.every((set) => set.totalMinutes === 120), 'sets.total_time', 'An athlete set does not total 120 minutes.', 'Keep one 90-minute workout and the shared 30-minute tumbling block.')
  test(!warnings.some((warning) => /tumbling.*placement/i.test(warning.message)), 'sets.no_tumbling_warning', 'Tumbling placement generated a sequencing warning.', 'Do not treat facility-set tumbling placement as an athletic phase-order violation.')

  return { valid: errors.length === 0, checks, errors, warnings }
}

export function flipFitCardInventory(program: FlipFitProgram) {
  return (['reused', 'alias', 'new', 'review'] as const).map((status) => ({
    status,
    cards: program.exerciseCards.filter((card) => card.matchStatus === status),
  }))
}
