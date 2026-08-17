const term = (key, name, domain = null, scopes = ['definition', 'variant', 'delivery_profile']) => ({
  key,
  name,
  domain,
  scopes,
})

export const TAXONOMY_V2_FACETS = Object.freeze({
  tenet: Object.freeze([
    term('strength', 'Strength', null, ['delivery_profile']),
    term('explosiveness', 'Explosiveness', null, ['delivery_profile']),
    term('speed', 'Speed', null, ['delivery_profile']),
    term('agility', 'Agility', null, ['delivery_profile']),
    term('flexibility', 'Flexibility/Mobility', null, ['delivery_profile']),
    term('balance', 'Balance', null, ['delivery_profile']),
    term('coordination', 'Coordination', null, ['delivery_profile']),
    term('body_control', 'Body Control', null, ['delivery_profile']),
  ]),
  methodology: Object.freeze([
    term('plyometric', 'Plyometric'),
    term('ballistic', 'Ballistic'),
    term('isometric', 'Isometric'),
    term('eccentric_emphasis', 'Eccentric Emphasis'),
    term('eccentric_only', 'Eccentric-Only'),
    term('eccentric_overload', 'Eccentric Overload'),
    term('concentric_only', 'Concentric-Only'),
    term('tempo_controlled', 'Tempo-Controlled'),
    term('paused', 'Paused'),
    term('resisted', 'Resisted'),
    term('assisted_overspeed', 'Assisted/Overspeed'),
    term('accommodating_resistance', 'Accommodating Resistance'),
    term('variable_resistance', 'Variable Resistance'),
    term('perturbation', 'Perturbation'),
    term('instability', 'Instability'),
    term('blood_flow_restriction', 'Blood-Flow Restriction'),
    term('velocity_based', 'Velocity-Based'),
  ]),
  training_family: Object.freeze([
    term('general_resistance', 'General Resistance'),
    term('powerlifting', 'Powerlifting'),
    term('olympic_weightlifting', 'Olympic Weightlifting'),
    term('bodybuilding', 'Bodybuilding'),
    term('calisthenics', 'Calisthenics'),
    term('loaded_carry_training', 'Loaded-Carry Training'),
    term('strongman', 'Strongman'),
    term('kettlebell_training', 'Kettlebell Training'),
    term('gymnastics', 'Gymnastics'),
    term('tumbling_acrobatics', 'Tumbling/Acrobatics'),
    term('sprinting', 'Sprinting'),
    term('running_locomotion', 'Running/Locomotion'),
    term('jumping_landing', 'Jumping/Landing'),
    term('throwing', 'Throwing'),
    term('change_of_direction_agility', 'Change-of-Direction/Agility'),
    term('conditioning', 'Conditioning'),
    term('mobility_recovery', 'Mobility/Recovery'),
  ]),
  athletic_niche: Object.freeze([
    term('trunk_core_strength', 'Trunk/Core Strength', 'specialized_strength'),
    term('grip_strength', 'Grip Strength', 'specialized_strength'),
    term('shoulder_strength', 'Shoulder Strength', 'specialized_strength'),
    term('foot_ankle_strength', 'Foot/Ankle Strength', 'specialized_strength'),
    term('first_step_quickness', 'First-Step Quickness', 'speed_agility'),
    term('acceleration', 'Acceleration', 'speed_agility'),
    term('maximum_velocity', 'Maximum Velocity', 'speed_agility'),
    term('speed_endurance', 'Speed Endurance', 'speed_agility'),
    term('deceleration', 'Deceleration', 'speed_agility'),
    term('change_of_direction', 'Change of Direction', 'speed_agility'),
    term('reactive_agility', 'Reactive Agility', 'speed_agility'),
    term('vertical_jump_power', 'Vertical Jump Power', 'jump_landing_elasticity'),
    term('horizontal_jump_power', 'Horizontal Jump Power', 'jump_landing_elasticity'),
    term('lateral_jump_power', 'Lateral Jump Power', 'jump_landing_elasticity'),
    term('landing_braking', 'Landing/Braking', 'jump_landing_elasticity'),
    term('reactive_strength', 'Reactive Strength', 'jump_landing_elasticity'),
    term('rotational_power', 'Rotational Power', 'throwing_rotational_power'),
    term('linear_throwing_power', 'Linear Throwing Power', 'throwing_rotational_power'),
    term('overhead_throwing_power', 'Overhead Throwing Power', 'throwing_rotational_power'),
  ]),
  force_velocity: Object.freeze([
    term('maximum_strength', 'Maximum Strength', null, ['variant', 'delivery_profile']),
    term('strength_speed', 'Strength-Speed', null, ['variant', 'delivery_profile']),
    term('peak_power', 'Peak Power', null, ['variant', 'delivery_profile']),
    term('speed_strength', 'Speed-Strength', null, ['variant', 'delivery_profile']),
    term('ballistic_speed', 'Ballistic Speed', null, ['variant', 'delivery_profile']),
    term('reactive_strength', 'Reactive Strength', null, ['variant', 'delivery_profile']),
    term('maximum_movement_speed', 'Maximum Movement Speed', null, ['variant', 'delivery_profile']),
  ]),
  movement_character: Object.freeze([
    term('static_isometric', 'Static/Isometric'),
    term('controlled_dynamic', 'Controlled Dynamic'),
    term('explosive', 'Explosive'),
    term('ballistic', 'Ballistic'),
    term('elastic_reactive', 'Elastic/Reactive'),
    term('cyclical', 'Cyclical'),
    term('continuous', 'Continuous'),
    term('multidirectional', 'Multidirectional'),
    term('reactive_open_skill', 'Reactive/Open Skill'),
    term('acrobatic', 'Acrobatic'),
    term('locomotor', 'Locomotor'),
    term('ground_based', 'Ground-Based'),
    term('aerial', 'Aerial'),
  ]),
  programming_set_structure: Object.freeze([
    term('straight_sets', 'Straight Sets', null, ['delivery_profile']),
    term('superset', 'Superset', null, ['delivery_profile']),
    term('tri_set', 'Tri-Set', null, ['delivery_profile']),
    term('giant_set', 'Giant Set', null, ['delivery_profile']),
    term('circuit', 'Circuit', null, ['delivery_profile']),
    term('complex', 'Complex', null, ['delivery_profile']),
    term('contrast', 'Contrast', null, ['delivery_profile']),
    term('cluster_set', 'Cluster Set', null, ['delivery_profile']),
    term('rest_pause', 'Rest-Pause', null, ['delivery_profile']),
    term('ladder', 'Ladder', null, ['delivery_profile']),
    term('pyramid', 'Pyramid', null, ['delivery_profile']),
    term('wave', 'Wave', null, ['delivery_profile']),
  ]),
  programming_clock_structure: Object.freeze([
    term('timed_set', 'Timed Set', null, ['delivery_profile']),
    term('continuous_work', 'Continuous Work', null, ['delivery_profile']),
    term('interval', 'Interval', null, ['delivery_profile']),
    term('emom', 'EMOM', null, ['delivery_profile']),
    term('amrap', 'AMRAP', null, ['delivery_profile']),
    term('density_block', 'Density Block', null, ['delivery_profile']),
  ]),
  conditioning_protocol: Object.freeze([
    term('hiit', 'HIIT', null, ['delivery_profile']),
    term('tempo_conditioning', 'Tempo Conditioning', null, ['delivery_profile']),
    term('repeat_sprint', 'Repeat Sprint', null, ['delivery_profile']),
    term('repeat_shuttle', 'Repeat Shuttle', null, ['delivery_profile']),
    term('aerobic_base', 'Aerobic Base', null, ['delivery_profile']),
    term('threshold', 'Threshold', null, ['delivery_profile']),
    term('aerobic_power', 'Aerobic Power', null, ['delivery_profile']),
    term('mixed_modal', 'Mixed-Modal', null, ['delivery_profile']),
    term('partner_alternating', 'Partner Alternating', null, ['delivery_profile']),
    term('team_relay', 'Team Relay', null, ['delivery_profile']),
    term('game_based', 'Game-Based', null, ['delivery_profile']),
    term('recovery_pace', 'Recovery Pace', null, ['delivery_profile']),
  ]),
  physiology_mechanism: Object.freeze([
    term('motor_unit_recruitment', 'Motor-Unit Recruitment', 'neural_output_readiness'),
    term('rate_of_force_development', 'Rate of Force Development', 'neural_output_readiness'),
    term('movement_intent', 'Movement Intent', 'neural_output_readiness'),
    term('coordination_speed', 'Coordination Speed', 'neural_output_readiness'),
    term('potentiation_readiness', 'Potentiation/Readiness', 'neural_output_readiness'),
    term('maximum_force', 'Maximum Force', 'force_tissue_capacity'),
    term('hypertrophy', 'Hypertrophy', 'force_tissue_capacity'),
    term('muscular_endurance', 'Muscular Endurance', 'force_tissue_capacity'),
    term('tendon_capacity', 'Tendon Capacity', 'force_tissue_capacity'),
    term('ligament_joint_tolerance', 'Ligament/Joint Tolerance', 'force_tissue_capacity'),
    term('bone_loading', 'Bone Loading', 'force_tissue_capacity'),
    term('local_fatigue_resistance', 'Local Fatigue Resistance', 'force_tissue_capacity'),
    term('fast_ssc', 'Fast SSC', 'ssc_stiffness'),
    term('slow_ssc', 'Slow SSC', 'ssc_stiffness'),
    term('elastic_stiffness', 'Elastic Stiffness', 'ssc_stiffness'),
    term('reactive_strength', 'Reactive Strength', 'ssc_stiffness'),
    term('rebound_efficiency', 'Rebound Efficiency', 'ssc_stiffness'),
    term('postural_control', 'Postural Control', 'control_stability'),
    term('joint_stabilization', 'Joint Stabilization', 'control_stability'),
    term('landing_control', 'Landing Control', 'control_stability'),
    term('eccentric_braking', 'Eccentric Braking', 'control_stability'),
    term('perturbation_control', 'Perturbation Control', 'control_stability'),
    term('reaction', 'Reaction', 'perception_action_skill'),
    term('choice_response', 'Choice Response', 'perception_action_skill'),
    term('anticipation', 'Anticipation', 'perception_action_skill'),
    term('spatial_rhythm_coupling', 'Spatial/Rhythm Coupling', 'perception_action_skill'),
    term('dual_task_attention', 'Dual-Task Attention', 'perception_action_skill'),
    term('phosphagen', 'Phosphagen Dominant', 'energy_systems_repeatability'),
    term('glycolytic', 'Glycolytic Dominant', 'energy_systems_repeatability'),
    term('oxidative', 'Oxidative Dominant', 'energy_systems_repeatability'),
    term('mixed_energy', 'Mixed Energy Systems', 'energy_systems_repeatability'),
    term('repeat_sprint_ability', 'Repeat-Sprint Ability', 'energy_systems_repeatability'),
    term('aerobic_base', 'Aerobic Base', 'energy_systems_repeatability'),
    term('threshold', 'Threshold', 'energy_systems_repeatability'),
    term('aerobic_power', 'Aerobic Power', 'energy_systems_repeatability'),
  ]),
})

export const TAXONOMY_V2_SCOPES = Object.freeze(['definition', 'variant', 'delivery_profile'])
export const TAXONOMY_V2_ASSIGNMENT_ROLES = Object.freeze([
  'primary',
  'secondary',
  'compatible',
  'incompatible',
  'default',
])
export const TAXONOMY_V2_REVIEW_STATUSES = Object.freeze([
  'suggested',
  'review',
  'approved',
  'rejected',
])

export const TAXONOMY_V2_REQUIRED_FACETS = Object.freeze({
  definition: Object.freeze(['training_family', 'movement_character']),
  variant: Object.freeze(['movement_character', 'force_velocity']),
  delivery_profile: Object.freeze([
    'tenet',
    'methodology',
    'athletic_niche',
    'programming_set_structure',
    'programming_clock_structure',
    'conditioning_protocol',
    'physiology_mechanism',
  ]),
})

export const EQUIPMENT_V2_KEYS = Object.freeze([
  'none',
  'kettlebell',
  'medicine_ball',
  'wall_ball',
  'slam_ball',
  'jump_rope',
  'barbell',
  'dumbbell',
  'battle_rope',
  'climbing_rope',
  'resistance_band',
  'mini_band',
  'cones',
  'mini_hurdles',
  'trap_bar',
  'sandbag',
  'agility_ladder',
  'timing_gates',
  'force_plate',
])

export const EQUIPMENT_V2_ROLES = Object.freeze([
  'required',
  'optional',
  'substitute',
  'measurement',
  'safety_support',
])

export const EQUIPMENT_V2_ALIASES = Object.freeze({
  bodyweight: 'none',
  no_equipment: 'none',
  dumbbells: 'dumbbell',
  wallball: 'wall_ball',
  sand_bags: 'sandbag',
  cone: 'cones',
  mini_hurdle: 'mini_hurdles',
  timing_gate: 'timing_gates',
})

const facetIndex = new Map(Object.entries(TAXONOMY_V2_FACETS).flatMap(([facetType, terms]) => (
  terms.map((entry) => [`${facetType}:${entry.key}`, entry])
)))

function text(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function integer(value, field, minimum, maximum) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new RangeError(`${field} must be an integer from ${minimum} to ${maximum}.`)
  }
  return parsed
}

export function taxonomyV2Term(facetType, key) {
  return facetIndex.get(`${text(facetType)}:${text(key)}`) ?? null
}

export function normalizeTaxonomyV2Assignment(raw = {}) {
  const facetType = text(raw.facetType ?? raw.facet_type)
  const key = text(raw.key ?? raw.termKey ?? raw.term_key)
  const scope = text(raw.scope ?? raw.subjectScope ?? raw.subject_scope)
  const role = text(raw.role) || 'secondary'
  const reviewStatus = text(raw.reviewStatus ?? raw.review_status) || 'suggested'
  const definition = taxonomyV2Term(facetType, key)

  if (!definition) throw new TypeError(`Unknown Taxonomy v2 term: ${facetType}:${key}.`)
  if (!TAXONOMY_V2_SCOPES.includes(scope)) throw new TypeError(`Unknown Taxonomy v2 scope: ${scope}.`)
  if (!definition.scopes.includes(scope)) {
    throw new RangeError(`${facetType}:${key} cannot be assigned at ${scope} scope.`)
  }
  if (!TAXONOMY_V2_ASSIGNMENT_ROLES.includes(role)) {
    throw new TypeError(`Unknown Taxonomy v2 assignment role: ${role}.`)
  }
  if (!TAXONOMY_V2_REVIEW_STATUSES.includes(reviewStatus)) {
    throw new TypeError(`Unknown Taxonomy v2 review status: ${reviewStatus}.`)
  }

  const normalized = {
    facetType,
    key,
    scope,
    role,
    weight: integer(raw.weight ?? 3, 'weight', 1, 5),
    confidence: integer(raw.confidence ?? 50, 'confidence', 1, 100),
    reviewStatus,
    provenance: raw.provenance && typeof raw.provenance === 'object' && !Array.isArray(raw.provenance)
      ? raw.provenance
      : {},
  }

  const reviewedBy = raw.reviewedBy ?? raw.reviewed_by ?? null
  const reviewedAt = raw.reviewedAt ?? raw.reviewed_at ?? null
  if (reviewStatus === 'approved' && (String(reviewedBy ?? '').trim() === '' || !reviewedAt)) {
    throw new TypeError('Approved Taxonomy v2 assignments require a reviewer and review timestamp.')
  }
  return reviewStatus === 'approved' ? { ...normalized, reviewedBy, reviewedAt } : normalized
}

export function validateTaxonomyV2Assignments(assignments) {
  const errors = []
  const normalized = []
  const seen = new Set()
  for (const [index, assignment] of (Array.isArray(assignments) ? assignments : []).entries()) {
    try {
      const value = normalizeTaxonomyV2Assignment(assignment)
      const identity = `${value.scope}:${value.facetType}:${value.key}`
      if (seen.has(identity)) throw new TypeError(`Duplicate Taxonomy v2 assignment: ${identity}.`)
      seen.add(identity)
      normalized.push(value)
    } catch (error) {
      errors.push({ index, message: error.message })
    }
  }
  return { valid: errors.length === 0, errors, normalized }
}

export function normalizeTaxonomyV2Decision(raw = {}) {
  const facetType = text(raw.facetType ?? raw.facet_type)
  const scope = text(raw.scope ?? raw.subjectScope ?? raw.subject_scope)
  const decision = text(raw.decision)
  const reviewStatus = text(raw.reviewStatus ?? raw.review_status) || 'suggested'
  if (!Object.hasOwn(TAXONOMY_V2_FACETS, facetType)) {
    throw new TypeError(`Unknown Taxonomy v2 facet: ${facetType}.`)
  }
  if (!TAXONOMY_V2_SCOPES.includes(scope)) throw new TypeError(`Unknown Taxonomy v2 scope: ${scope}.`)
  if (!TAXONOMY_V2_REQUIRED_FACETS[scope].includes(facetType)) {
    throw new RangeError(`${facetType} does not require a completeness decision at ${scope} scope.`)
  }
  if (!['classified', 'not_applicable'].includes(decision)) {
    throw new TypeError('Taxonomy v2 decision must be classified or not_applicable.')
  }
  if (!TAXONOMY_V2_REVIEW_STATUSES.includes(reviewStatus)) {
    throw new TypeError(`Unknown Taxonomy v2 review status: ${reviewStatus}.`)
  }
  const rationale = text(raw.rationale)
  if (decision === 'not_applicable' && !rationale) {
    throw new TypeError('Not-applicable Taxonomy v2 decisions require a rationale.')
  }
  const reviewedBy = raw.reviewedBy ?? raw.reviewed_by ?? null
  const reviewedAt = raw.reviewedAt ?? raw.reviewed_at ?? null
  if (reviewStatus === 'approved' && (String(reviewedBy ?? '').trim() === '' || !reviewedAt)) {
    throw new TypeError('Approved Taxonomy v2 decisions require a reviewer and review timestamp.')
  }
  const normalized = {
    facetType,
    scope,
    decision,
    rationale: rationale || null,
    confidence: integer(raw.confidence ?? 50, 'confidence', 1, 100),
    reviewStatus,
    provenance: raw.provenance && typeof raw.provenance === 'object' && !Array.isArray(raw.provenance)
      ? raw.provenance
      : {},
  }
  return reviewStatus === 'approved' ? { ...normalized, reviewedBy, reviewedAt } : normalized
}

export function evaluateTaxonomyV2Completeness(block, scope, { requireApproved = true } = {}) {
  const assignments = Array.isArray(block?.assignments) ? block.assignments : []
  const decisions = Array.isArray(block?.decisions) ? block.decisions : []
  const issues = []
  for (const facetType of TAXONOMY_V2_REQUIRED_FACETS[scope] ?? []) {
    const matchingAssignments = assignments.filter((entry) => entry.facetType === facetType)
    const decision = decisions.find((entry) => entry.facetType === facetType)
    const approvedAssignment = matchingAssignments.some((entry) => entry.reviewStatus === 'approved')
    const approvedDecision = decision?.reviewStatus === 'approved'
    if (matchingAssignments.length === 0 && decision?.decision !== 'not_applicable') {
      issues.push({ facetType, code: 'missing_classification' })
    } else if (requireApproved && !approvedAssignment && !approvedDecision) {
      issues.push({ facetType, code: 'classification_review_required' })
    }
    if (decision?.decision === 'classified' && matchingAssignments.length === 0) {
      issues.push({ facetType, code: 'classified_without_assignment' })
    }
  }
  return { complete: issues.length === 0, issues }
}

export function resolveEquipmentV2Key(raw) {
  const normalized = text(raw)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/(^_|_$)/g, '')
  if (!normalized || normalized === 'rope' || normalized === 'band' || normalized === 'bands') {
    return { key: null, status: normalized ? 'ambiguous' : 'missing', source: normalized || null }
  }
  const key = EQUIPMENT_V2_ALIASES[normalized] ?? normalized
  return EQUIPMENT_V2_KEYS.includes(key)
    ? { key, status: key === normalized ? 'canonical' : 'alias', source: normalized }
    : { key: null, status: 'unknown', source: normalized }
}

export function taxonomyV2Catalog() {
  return Object.fromEntries(Object.entries(TAXONOMY_V2_FACETS).map(([facetType, terms]) => [
    facetType,
    terms.map((entry) => ({ ...entry, scopes: [...entry.scopes] })),
  ]))
}
