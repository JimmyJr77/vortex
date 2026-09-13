import programSessions from './data/acceleratorPrograms.json'

export const ACCELERATOR_PROGRAMS = [
  { id: 'distance-running', title: 'Distance Running', category: 'Endurance', description: 'Build the capacity to keep moving.', icon: 'endurance' },
  { id: 'sprinting', title: 'Sprinting & Acceleration', category: 'Speed', description: 'Make the first steps count.', icon: 'speed' },
  { id: 'jumps-horizontal', title: 'Jumps: Horizontal', category: 'Power', description: 'Project force forward.', icon: 'horizontal' },
  { id: 'jumps-vertical', title: 'Jumps: Vertical', category: 'Power', description: 'Develop upward projection.', icon: 'vertical' },
  { id: 'jumps-rebound', title: 'Jumps: Absorption & Rebound', category: 'Elasticity', description: 'Land with control. Return with intent.', icon: 'rebound' },
  { id: 'agility-mobility', title: 'Agility: Mobility', category: 'Movement', description: 'Create room to move well.', icon: 'mobility' },
  { id: 'agility-reactive', title: 'Agility: Reactive', category: 'Movement', description: 'Read, respond, and change direction.', icon: 'reactive' },
  { id: 'rotation-upper', title: 'Rotational Force: Upper Body', category: 'Rotational force', description: 'Connect the body turn to hand speed.', icon: 'upper' },
  { id: 'rotation-lower', title: 'Rotational Force: Lower Body', category: 'Rotational force', description: 'Drive the turn from the ground up.', icon: 'lower' },
] as const

export type AcceleratorProgram = typeof ACCELERATOR_PROGRAMS[number]
export type AcceleratorProgramId = AcceleratorProgram['id']
export type AcceleratorPhase = 'prepare' | 'E' | 'S' | 'P'
export type AcceleratorSession = (typeof programSessions)[AcceleratorProgramId][number]
export type AcceleratorExercise = AcceleratorSession['exercises'][number]

export const getAcceleratorSessions = (programId: AcceleratorProgramId): AcceleratorSession[] => programSessions[programId]
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
  Bench: 'Check that support surfaces are stable and fit the athlete.',
  'Box / step': 'Use a stable height with clear takeoff and landing space.',
  'Marked space': 'Mark the drill area and keep waiting athletes outside it.',
}
