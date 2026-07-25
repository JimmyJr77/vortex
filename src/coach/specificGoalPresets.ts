import type { Taxonomy } from './taxonomy'
import type { NeedsEnginePhaseRow, PhaseFocusTarget } from './phaseArchitect'
import type { SessionObjective } from './phasePlan'

export type SpecificGoalKey =
  | ''
  | 'jumping'
  | 'rotational_power'
  | 'core_power'
  | 'injury_resilience'
  | 'sprint_starts'
  | 'stopping'
  | 'cutting'
  | 'vo2_max'

type FocusKey = { facetType: PhaseFocusTarget['facetType']; key: string; weight: number }

export interface SpecificGoalPreset {
  key: Exclude<SpecificGoalKey, ''>
  label: string
  objective: SessionObjective
  recommendedMinutes: string
  description: string
  coachingSpecifics: string
  minutes60: Record<string, number>
  focus: Record<string, FocusKey[]>
}

const phases = (
  prepare: number, movement: number, output: number, capacity: number,
  resilience: number, sustained: number, restore: number,
) => ({
  prepare_and_access: prepare,
  movement_intelligence: movement,
  output,
  capacity,
  resilience,
  sustained_capacity: sustained,
  restore,
})

const f = (facetType: FocusKey['facetType'], key: string, weight: number): FocusKey => ({ facetType, key, weight })

export const SPECIFIC_GOAL_PRESETS: SpecificGoalPreset[] = [
  {
    key: 'jumping', label: 'Jumping', objective: 'explosiveness_power_priority', recommendedMinutes: '45–75 min',
    description: 'Maximize takeoff force, stretch-shortening-cycle output, and landing quality.',
    coachingSpecifics: 'Fresh, low-rep jumps first; strength support next; landing and tendon control after.',
    minutes60: phases(8, 8, 20, 14, 7, 1, 2),
    focus: {
      movement_intelligence: [f('pattern', 'land', 6), f('tenet', 'coordination', 5)],
      output: [f('tenet', 'explosiveness', 8), f('methodology', 'plyometrics', 7), f('physiology', 'ssc_stiffness', 6), f('pattern', 'jump', 8)],
      capacity: [f('tenet', 'strength', 7), f('physiology', 'force_tissue_capacity', 6), f('pattern', 'squat', 5), f('pattern', 'hinge', 5)],
      resilience: [f('methodology', 'eccentric_negative', 6), f('tenet', 'balance', 5), f('pattern', 'land', 7)],
    },
  },
  {
    key: 'rotational_power', label: 'Rotational Power', objective: 'explosiveness_power_priority', recommendedMinutes: '45–70 min',
    description: 'Produce and transfer force rapidly through the hips, trunk, and upper body.',
    coachingSpecifics: 'Explosive throws and rotational actions precede loaded force production and anti-rotation control.',
    minutes60: phases(8, 7, 20, 17, 6, 0, 2),
    focus: {
      movement_intelligence: [f('pattern', 'rotate', 7), f('tenet', 'coordination', 5)],
      output: [f('tenet', 'explosiveness', 8), f('methodology', 'rotational_power', 8), f('pattern', 'rotate', 8)],
      capacity: [f('tenet', 'strength', 6), f('methodology', 'power_strength', 6), f('pattern', 'brace', 6), f('pattern', 'rotate', 7)],
      resilience: [f('methodology', 'core_body_control', 7), f('pattern', 'brace', 7)],
    },
  },
  {
    key: 'core_power', label: 'Core Power', objective: 'explosiveness_power_priority', recommendedMinutes: '40–65 min',
    description: 'Build fast trunk force transfer plus anti-extension and anti-rotation capacity.',
    coachingSpecifics: 'Ballistic trunk work stays crisp; loaded bracing and isometric control build the foundation.',
    minutes60: phases(8, 7, 16, 17, 10, 0, 2),
    focus: {
      movement_intelligence: [f('pattern', 'brace', 7), f('tenet', 'body_control', 6)],
      output: [f('tenet', 'explosiveness', 7), f('methodology', 'rotational_power', 7), f('pattern', 'rotate', 7)],
      capacity: [f('tenet', 'strength', 6), f('methodology', 'core_body_control', 8), f('pattern', 'brace', 8)],
      resilience: [f('methodology', 'isometrics', 7), f('physiology', 'control_stability', 7), f('pattern', 'brace', 8)],
    },
  },
  {
    key: 'injury_resilience', label: 'Injury Resilience', objective: 'mobility_control_priority', recommendedMinutes: '45–70 min',
    description: 'Develop strength, balance, deceleration control, and tissue capacity in a multimodal session.',
    coachingSpecifics: 'Prioritize technically clean unilateral control, eccentric strength, balance, and progressive landing exposure.',
    minutes60: phases(8, 9, 7, 15, 18, 1, 2),
    focus: {
      movement_intelligence: [f('tenet', 'balance', 7), f('tenet', 'coordination', 6), f('pattern', 'land', 6)],
      output: [f('tenet', 'body_control', 6), f('pattern', 'land', 6)],
      capacity: [f('tenet', 'strength', 7), f('physiology', 'force_tissue_capacity', 7)],
      resilience: [f('methodology', 'eccentric_negative', 8), f('methodology', 'balance_stability', 7), f('physiology', 'control_stability', 8)],
    },
  },
  {
    key: 'sprint_starts', label: 'Sprint Starts', objective: 'speed_priority', recommendedMinutes: '45–70 min',
    description: 'Improve first-step projection, horizontal force, acceleration mechanics, and early speed.',
    coachingSpecifics: 'Short starts receive the freshest minutes; full recovery protects speed quality; strength supports projection.',
    minutes60: phases(8, 8, 22, 14, 6, 0, 2),
    focus: {
      movement_intelligence: [f('tenet', 'speed', 7), f('tenet', 'coordination', 6), f('pattern', 'locomote', 7)],
      output: [f('tenet', 'speed', 9), f('methodology', 'speed_agility', 8), f('physiology', 'neural_output_readiness', 7), f('pattern', 'locomote', 8)],
      capacity: [f('tenet', 'strength', 7), f('physiology', 'force_tissue_capacity', 7), f('pattern', 'hinge', 6), f('pattern', 'squat', 5)],
      resilience: [f('methodology', 'eccentric_negative', 5), f('pattern', 'land', 5)],
    },
  },
  {
    key: 'stopping', label: 'Stopping', objective: 'agility_priority', recommendedMinutes: '45–70 min',
    description: 'Improve braking mechanics, eccentric force absorption, posture, and landing control.',
    coachingSpecifics: 'Teach progressive deceleration before reactive stopping; reinforce eccentric strength and stable positions.',
    minutes60: phases(8, 10, 17, 13, 10, 0, 2),
    focus: {
      movement_intelligence: [f('tenet', 'agility', 7), f('tenet', 'body_control', 6), f('pattern', 'land', 7)],
      output: [f('tenet', 'agility', 8), f('methodology', 'speed_agility', 7), f('pattern', 'locomote', 6), f('pattern', 'land', 7)],
      capacity: [f('tenet', 'strength', 7), f('methodology', 'eccentric_negative', 7), f('pattern', 'squat', 6)],
      resilience: [f('methodology', 'balance_stability', 7), f('physiology', 'control_stability', 7), f('pattern', 'land', 7)],
    },
  },
  {
    key: 'cutting', label: 'Cutting', objective: 'agility_priority', recommendedMinutes: '45–75 min',
    description: 'Develop planned and reactive direction change through braking, reorientation, and reacceleration.',
    coachingSpecifics: 'Build movement solutions from planned cuts to reactive decisions, then support them with strength and control.',
    minutes60: phases(8, 11, 18, 12, 9, 0, 2),
    focus: {
      movement_intelligence: [f('tenet', 'agility', 8), f('tenet', 'coordination', 7), f('pattern', 'locomote', 7), f('pattern', 'land', 6)],
      output: [f('tenet', 'agility', 9), f('tenet', 'speed', 6), f('methodology', 'speed_agility', 8), f('methodology', 'plyometrics', 5)],
      capacity: [f('tenet', 'strength', 7), f('physiology', 'force_tissue_capacity', 6)],
      resilience: [f('methodology', 'eccentric_negative', 7), f('methodology', 'balance_stability', 6), f('physiology', 'control_stability', 7)],
    },
  },
  {
    key: 'vo2_max', label: 'VO₂ Max', objective: 'fitness_priority', recommendedMinutes: '40–65 min',
    description: 'Accumulate quality high-intensity aerobic work near maximal oxygen uptake.',
    coachingSpecifics: 'Favor intervals of at least two minutes and sufficient cumulative work; keep power work brief and supportive.',
    minutes60: phases(8, 5, 5, 8, 5, 27, 2),
    focus: {
      movement_intelligence: [f('pattern', 'locomote', 6), f('tenet', 'coordination', 4)],
      output: [f('tenet', 'speed', 5), f('physiology', 'neural_output_readiness', 4)],
      capacity: [f('tenet', 'strength', 5), f('physiology', 'force_tissue_capacity', 4)],
      sustained_capacity: [f('methodology', 'hiit', 9), f('physiology', 'energy_systems_repeatability', 9), f('pattern', 'locomote', 7)],
      resilience: [f('methodology', 'mobility_flexibility', 4), f('physiology', 'control_stability', 4)],
    },
  },
]

export function specificGoalPreset(key: SpecificGoalKey) {
  return SPECIFIC_GOAL_PRESETS.find((preset) => preset.key === key)
}

function scaledMinutes(minutes60: Record<string, number>, duration: number) {
  const rows = Object.entries(minutes60).map(([phaseKey, minutes]) => ({
    phaseKey,
    minutes: minutes === 0 ? 0 : Math.max(1, Math.round(minutes * duration / 60)),
  }))
  const total = rows.reduce((sum, row) => sum + row.minutes, 0)
  const preferred = rows.find((row) => row.phaseKey === 'capacity') ?? rows[0]
  preferred.minutes = Math.max(0, preferred.minutes + duration - total)
  return rows.filter((row) => row.minutes > 0)
}

function resolveFocus(target: FocusKey, taxonomy: Taxonomy): PhaseFocusTarget | null {
  const lists = {
    tenet: taxonomy.tenets,
    methodology: taxonomy.methodologies,
    physiology: taxonomy.physiology,
    pattern: taxonomy.patterns,
    body_region: taxonomy.bodyRegions,
    order_slot: taxonomy.phaseOrderSlots ?? [],
  }
  const item = lists[target.facetType].find((row) => row.key === target.key)
  return item ? { facetType: target.facetType, facetId: Number(item.id), weight: target.weight } : null
}

export function buildSpecificGoalPlan(
  key: Exclude<SpecificGoalKey, ''>,
  duration: number,
  taxonomy: Taxonomy,
  muscleRegionIds: number[],
): NeedsEnginePhaseRow[] {
  const preset = specificGoalPreset(key)
  if (!preset) return []
  return scaledMinutes(preset.minutes60, duration).map(({ phaseKey, minutes }) => {
    const focusTargets = (preset.focus[phaseKey] ?? [])
      .map((target) => resolveFocus(target, taxonomy))
      .filter((target): target is PhaseFocusTarget => Boolean(target))
    if (!['prepare_and_access', 'restore'].includes(phaseKey)) {
      for (const facetId of muscleRegionIds) {
        focusTargets.push({ facetType: 'body_region', facetId, weight: 6 })
      }
    }
    return { phaseKey, minutes, focusTargets }
  })
}
