import programSessions from './data/acceleratorPrograms.json'
import { DISCIPLINE_PREPARATION_CARDS } from './preparation/routines'

export const ACCELERATOR_PROGRAMS = [
  { kind: 'routine', id: 'access-prepare-standard', title: 'Access & Prepare Standard', durationMinutes: 15, category: 'Preparation', description: 'A familiar 16-exercise base that prepares athletes to move with purpose.', icon: 'prepare' },
  ...DISCIPLINE_PREPARATION_CARDS,
  { kind: 'program', id: 'distance-running', title: 'Distance Running', classCount: 12, category: 'Endurance', description: 'Build the capacity to keep moving.', icon: 'endurance' },
  { kind: 'program', id: 'sprinting', title: 'Sprinting & Acceleration', classCount: 12, category: 'Speed', description: 'Make the first steps count.', icon: 'speed' },
  { kind: 'program', id: 'speed-agility', title: 'Speed & Agility', classCount: 36, category: 'Speed & movement', description: 'Sprinting, acceleration, mobile agility and reactive agility integrated in every class.', icon: 'speed' },
  { kind: 'program', id: 'jumps-horizontal', title: 'Jumps: Horizontal', classCount: 12, category: 'Power', description: 'Project force forward.', icon: 'horizontal' },
  { kind: 'program', id: 'jumps-vertical', title: 'Jumps: Vertical', classCount: 12, category: 'Power', description: 'Develop upward projection.', icon: 'vertical' },
  { kind: 'program', id: 'jumps-rebound', title: 'Jumps: Absorption & Rebound', classCount: 12, category: 'Elasticity', description: 'Land with control. Return with intent.', icon: 'rebound' },
  { kind: 'program', id: 'jumps-max-air', title: 'Jumps: Max Air', classCount: 36, category: 'Complete jumping', description: 'Vertical and horizontal jumps with force absorption and elastic rebound.', icon: 'maxair' },
  { kind: 'program', id: 'agility-mobility', title: 'Agility: Mobility', classCount: 12, category: 'Movement', description: 'Create room to move well.', icon: 'mobility' },
  { kind: 'program', id: 'agility-reactive', title: 'Agility: Reactive', classCount: 12, category: 'Movement', description: 'Read, respond, and change direction.', icon: 'reactive' },
  { kind: 'program', id: 'upper-body-force', title: 'Upper Body Force Generation', classCount: 12, category: 'Upper-body force generation', description: 'Develop pushing, pulling and straight-line projection through purposeful explosive drills and progressive strength.', icon: 'horizontal' },
  { kind: 'program', id: 'lower-body-force', title: 'Lower Body Force Generation', classCount: 12, category: 'Power', description: 'Build knee, hip and ankle force for upward and forward projection across twelve weekly classes.', icon: 'vertical' },
  { kind: 'program', id: 'full-body-force', title: 'Full Body Force Generation', classCount: 36, category: 'Power', description: 'Combine upper and lower body force with upper and lower rotational power in every class.', icon: 'fullbody' },
  { kind: 'program', id: 'rotation-upper', title: 'Rotational Force: Upper Body', classCount: 12, category: 'Rotational force', description: 'Connect the body turn to hand speed.', icon: 'upper' },
  { kind: 'program', id: 'rotation-lower', title: 'Rotational Force: Lower Body', classCount: 12, category: 'Rotational force', description: 'Drive the turn from the ground up.', icon: 'lower' },
  { kind: 'program', id: 'rotation-full-body', title: 'Rotational Force: Full Body', classCount: 36, category: 'Rotational force', description: 'Upper and lower body rotational force generation connected in every class of this 36-week plan.', icon: 'rotationfullbody' },
] as const

export type AcceleratorProgram = typeof ACCELERATOR_PROGRAMS[number]
export type AcceleratorProgramId = AcceleratorProgram['id']
export type AcceleratorClassProgram = Extract<AcceleratorProgram, { kind: 'program' }>
export type AcceleratorClassProgramId = AcceleratorClassProgram['id']
export type AcceleratorPhase = 'prepare' | 'E' | 'S' | 'P'
export type AcceleratorExercise = {
  id: string
  name: string
  sourceName: string
  dose: string
  description: string
  prescription: string
  rest: string
  purpose: string
  instruction: string
  preparation: string | null
  equipment: string[]
  librarySlug: string
  sourceTrack?: string
  sourceClass?: number
  sourceExerciseId?: string
}

export type AcceleratorSession = {
  n: number
  title: string
  effort: string
  minutes: number[] | null
  delivery: string
  equipment: string[]
  exercises: AcceleratorExercise[]
  prepareExercises?: AcceleratorExercise[]
  quality: string
  preparation: string
  explosiveNotes: string
  counts: { explosive: number; resilience: number; primary: number }
  phaseNotes?: Partial<Record<AcceleratorPhase, string[]>>
  progression?: string
  setup?: string
  connections?: { slots: string[]; title: string; cue: string }[]
  extension?: string
  classRole?: 'integration' | 'application'
}

export type AcceleratorPlanGuidance = { cadence: string; overview: string; progression: string }
export const ACCELERATOR_PLAN_GUIDANCE: Partial<Record<AcceleratorClassProgramId, AcceleratorPlanGuidance>> = {
  'full-body-force': {
    cadence: '36 Classes · 12 development stages',
    overview: 'Twelve stages of three classes combine all twelve upper and all twelve lower body force classes. Every explosive and primary-strength phase includes two upper force, two lower force, one upper rotation and one lower rotation selection. Each class references existing Access & Prepare 1 and keeps six explosive drills, two light resilience exercises and six challenging strength exercises.',
    progression: 'Each stage retains every original force exercise and its dose across three classes. Rotational additions use smaller doses with separate recovery. Consolidate in Classes 16–18 and review matched actual records in Classes 34–36. Useful strength lifts recur; a new placement is not a new drill or an earned load increase. Schedule by actual technique, broader workload and recovery, without doubling up missed classes.',
  },
  'lower-body-force': {
    cadence: '12 weeks · 1 class per week',
    overview: 'Develop lower-body force from settled starts through independent stance-leg drive, hip-to-ankle sequencing and controlled entries. Each week references existing Access & Prepare 1, then includes six explosive drills, two light resilience exercises and six challenging strength exercises. This program supports vertical and horizontal jumps, with limited straight-line acceleration practice.',
    progression: 'Use purposeful new drills and related variants, with justified repeats for practice and review. Retain useful strength lifts, reduce work at Week 6 and revisit the original still-start reference at Week 12. Review actual technique, loads, symptoms, recovery and other leg training before advancing. Written classes do not establish completed training; resume missed weeks without doubling up.',
  },
  'upper-body-force': {
    cadence: '12 Classes · Progress by observed readiness',
    overview: 'Build pushing, pulling and straight-line projection from stationary force through independent-arm control and controlled moving releases. Each class references existing Access & Prepare 1, then includes six explosive drills, two light resilience exercises and six challenging strength exercises.',
    progression: 'Prioritize unique, relevant drills; related variants and justified repeats have specific jobs. Retain useful strength lifts, consolidate at Class 6 and review matched reference work at Class 12. Written prescriptions do not establish completed training or earned progression. Review actual technique, loads and recovery before advancing.',
  },
  'jumps-max-air': {
    cadence: '36 Classes · 12 integrated development stages',
    overview: 'Every class combines force absorption and elastic rebound, vertical jumping and horizontal jumping. Across each three-class stage, all existing explosive, resilience and primary-strength prescriptions from the matching source classes are used once.',
    progression: 'Each stage advances all three source tracks together from Class 1 through Class 12. Every class includes two explosive and two primary-strength selections from each track; resilience work rotates in balanced pairs. Preserve the original doses, recovery and coaching standards.',
  },
  'rotation-full-body': {
    cadence: '36 weeks · 1 class per week',
    overview: 'Every class connects upper and lower body work through three specific exercise pairs. Each stage has two integrated lessons built from the existing courses, followed by an added application day: 24 integrated classes plus 12 application days.',
    progression: 'Develop foot-led initiation, support transfer, recoil, entry and braking. Consolidate both regions in weeks 16–18, then apply the connections to receiving, redirection and early cues. Each class has six explosive drills, two light resilience exercises and six primary-strength lifts. Week 36 revisits Week 3 under matched conditions. Advance by observed technique and recovery.',
  },
  'speed-agility': {
    cadence: '36 weeks · 1 class per week',
    overview: 'Every class combines two explosive drills from Sprinting & Acceleration, two from Agility: Mobility and two from Agility: Reactive. Connect speed production to planned braking and direction control, then apply it to a live decision.',
    progression: 'Twelve stages span three integrated classes each: Push, brake & respond; Redirect & pursue; Coordinate, read & reaccelerate. Sprint and live-decision anchors recur while supporting drills vary. Each day retains two resilience exercises and six complementary strength exercises from the existing courses. Keep the original doses and recovery; progress by technique and readiness, and resume missed classes without doubling up.',
  },
}

const sessionsByProgram = programSessions as Record<AcceleratorClassProgramId, AcceleratorSession[]>
export const getAcceleratorSessions = (programId: AcceleratorClassProgramId): AcceleratorSession[] => sessionsByProgram[programId]
export const ACCELERATOR_PHASES: { id: AcceleratorPhase; title: string; subtitle: string }[] = [
  { id: 'prepare', title: 'Prepare', subtitle: 'Access & Prepare 1' },
  { id: 'E', title: 'Explosiveness', subtitle: '6 exercises' },
  { id: 'S', title: 'Resilience', subtitle: '2 light exercises' },
  { id: 'P', title: 'Primary strength', subtitle: '6 exercises' },
]

export const EQUIPMENT_NOTES: Record<string, string> = {
  'Medicine ball': 'Use a light, grippable ball and confirm the release or impact surface.',
  'Slam ball': 'Use a non-rebounding ball approved for the floor surface.',
  Bands: 'Use working resistance and secure anchors or loops before the class begins.',
  Landmine: 'Secure the base and select manageable loads.',
  Dumbbells: 'Stage the selected working loads where they will not obstruct the station.',
  Kettlebell: 'Stage manageable loads with a clear swing and carry area.',
  'Battle rope': 'Secure the anchor and clear the rope path.',
  'Loose battle rope': 'Use a manageable free rope on the floor with no fixed anchor or attached weight; clear its path and never wrap it around the body.',
  'Pull-up bar': 'Inspect the bar and stable foot support; preserve the prescribed assistance and controlled return.',
  'Rated band attachment': 'Confirm a manufacturer-permitted attachment at the prescribed height; use the exercise replacement if it is unsuitable.',
  'Wall support': 'Inspect a stable wall and clear foot space for the prescribed push-off; this does not establish a throw-rated surface.',
  'Stable hand support': 'Inspect a fixed support that fits the athlete; use it for the prescribed balance or assistance without pulling to create the rapid effort.',
  Bench: 'Check that support surfaces are stable and fit the athlete.',
  'Box / step': 'Use a stable height with clear takeoff and landing space.',
  'Marked space': 'Mark the drill area and keep waiting athletes outside it.',
}
