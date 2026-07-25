/**
 * Coach-selectable Needs Engine focuses by canonical session phase.
 *
 * This is intentionally stricter than the exercise library's raw tag/profile
 * intersections. A secondary phase profile can make an exercise eligible in a
 * phase without making every one of its tags an appropriate phase emphasis.
 */
export const PHASE_FOCUS_KEYS = {
  prepare_and_access: {
    tenet: ['flexibility', 'balance', 'coordination', 'body_control'],
    methodology: [
      'plyometrics',
      'isometrics',
      'neural',
      'balance_stability',
      'mobility_flexibility',
      'core_body_control',
    ],
    physiology: ['neural_output_readiness', 'ssc_stiffness', 'control_stability'],
  },
  movement_intelligence: {
    tenet: ['speed', 'agility', 'balance', 'coordination', 'body_control'],
    methodology: [
      'resistance_calisthenics',
      'plyometrics',
      'isometrics',
      'neural',
      'balance_stability',
      'core_body_control',
      'speed_agility',
    ],
    physiology: [
      'neural_output_readiness',
      'ssc_stiffness',
      'control_stability',
      'perception_action_skill',
    ],
  },
  output: {
    tenet: ['explosiveness', 'speed', 'agility', 'coordination'],
    methodology: [
      'plyometrics',
      'neural',
      'speed_agility',
      'power_strength',
      'rotational_power',
    ],
    physiology: [
      'neural_output_readiness',
      'ssc_stiffness',
      'control_stability',
      'perception_action_skill',
    ],
  },
  capacity: {
    tenet: ['strength', 'explosiveness'],
    methodology: [
      'resistance_calisthenics',
      'isometrics',
      'eccentric_negative',
      'strength_training',
      'grip_training',
      'power_strength',
      'rotational_power',
    ],
    physiology: ['force_tissue_capacity', 'ssc_stiffness'],
  },
  resilience: {
    tenet: ['strength', 'balance', 'coordination', 'body_control'],
    methodology: [
      'resistance_calisthenics',
      'isometrics',
      'eccentric_negative',
      'balance_stability',
      'core_body_control',
      'strength_training',
      'grip_training',
    ],
    physiology: ['force_tissue_capacity', 'control_stability'],
  },
  sustained_capacity: {
    tenet: [],
    methodology: ['hiit'],
    physiology: ['energy_systems_repeatability'],
  },
  restore: {
    tenet: ['flexibility'],
    methodology: ['mobility_flexibility'],
    physiology: ['recovery_downregulation'],
  },
}

export function focusKeysForPhase(phaseKey, facetType) {
  return PHASE_FOCUS_KEYS[phaseKey]?.[facetType] ?? []
}

export function isFocusKeyApplicable(phaseKey, facetType, focusKey) {
  return focusKeysForPhase(phaseKey, facetType).includes(focusKey)
}
