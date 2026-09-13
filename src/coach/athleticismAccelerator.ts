import upperBodySessions from './data/rotationalUpperBody.json'

export const ACCELERATOR_PROGRAMS = [
  { id: 'distance-running', title: 'Distance Running', category: 'Endurance', description: 'Build the capacity to keep moving.', icon: 'endurance' },
  { id: 'sprinting', title: 'Sprinting & Acceleration', category: 'Speed', description: 'Make the first steps count.', icon: 'speed' },
  { id: 'jumps-horizontal', title: 'Jumps: Horizontal', category: 'Power', description: 'Project force forward.', icon: 'horizontal' },
  { id: 'jumps-vertical', title: 'Jumps: Vertical', category: 'Power', description: 'Develop upward projection.', icon: 'vertical' },
  { id: 'jumps-rebound', title: 'Jumps: Absorpsion & Rebound', category: 'Elasticity', description: 'Land with control. Return with intent.', icon: 'rebound' },
  { id: 'agility-mobility', title: 'Agility: Mobility', category: 'Movement', description: 'Create room to move well.', icon: 'mobility' },
  { id: 'agility-reactive', title: 'Agility: Reactive', category: 'Movement', description: 'Read, respond, and change direction.', icon: 'reactive' },
  { id: 'rotation-upper', title: 'Rotational Force: Upper Body', category: 'Rotational force', description: 'Connect the body turn to hand speed.', icon: 'upper' },
  { id: 'rotation-lower', title: 'Rotational Force: Lower Body', category: 'Rotational force', description: 'Drive the turn from the ground up.', icon: 'lower' },
  { id: 'object-control', title: 'Object control & catch', category: 'Coordination', description: 'Track, receive, and control.', icon: 'catch' },
] as const

export type AcceleratorProgram = typeof ACCELERATOR_PROGRAMS[number]
export type AcceleratorProgramId = AcceleratorProgram['id']
export type AcceleratorPhase = 'prepare' | 'E' | 'S' | 'P'
export type AcceleratorSession = typeof upperBodySessions[number]
export type AcceleratorExercise = AcceleratorSession['exercises'][number]

export const ROTATIONAL_UPPER_SESSIONS = upperBodySessions
export const ACCELERATOR_PHASES: { id: AcceleratorPhase; title: string; subtitle: string }[] = [
  { id: 'prepare', title: 'Prepare', subtitle: 'Access & Prepare 1' },
  { id: 'E', title: 'Explosiveness', subtitle: '6 exercises' },
  { id: 'S', title: 'Resilience', subtitle: '2 light exercises' },
  { id: 'P', title: 'Primary strength', subtitle: '6 exercises' },
]

export const EQUIPMENT_NOTES: Record<string, string> = {
  'Medicine ball': 'Light, grippable; impact compatible with verified low rebound.',
  'Slam ball': 'Non-rebounding; approved for the floor surface.',
  Bands: 'Light and working resistance; secure high, chest-height and low anchors.',
  Landmine: 'Secured base, bar and manageable loads; verify the minimum bar weight.',
  Dumbbells: 'Light shoulder work and individually selected working loads.',
  'Battle rope': 'Secure anchor and clear space for the prescribed rope path.',
  Bench: 'Stable support for the listed supported exercises.',
}
