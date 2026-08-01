import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  attachProgrammingToExercise,
  buildExerciseCard,
} from '../exerciseProgramming.js'

const GENERATOR_DIR = fileURLToPath(new URL('../../../scripts/', import.meta.url))
const CANONICAL_RESEARCH_DIR = fileURLToPath(
  new URL('../../../scripts/data/canonical-research/', import.meta.url),
)
const EXERCISE_LIBRARY_SOURCE = readFileSync(
  new URL('../../../src/components/coach/ExerciseLibrary.tsx', import.meta.url),
  'utf8',
)
const KNEELING_CHEST_PASS_IDENTITY_MIGRATION = readFileSync(
  new URL('../../migrations/317_coaching_kneeling_chest_pass_identity_consolidation.sql', import.meta.url),
  'utf8',
)
const KNEELING_CHEST_PASS_COMPLETION_MIGRATION = readFileSync(
  new URL('../../migrations/318_coaching_kneeling_chest_pass_family_completion.sql', import.meta.url),
  'utf8',
)
const ROTATIONAL_WALL_THROW_IDENTITY_MIGRATION = readFileSync(
  new URL('../../migrations/319_coaching_rotational_wall_throw_identity_consolidation.sql', import.meta.url),
  'utf8',
)
const ROTATIONAL_WALL_THROW_COMPLETION_MIGRATION = readFileSync(
  new URL('../../migrations/320_coaching_rotational_wall_throw_family_completion.sql', import.meta.url),
  'utf8',
)
const ROTATIONAL_WALL_THROW_EQUIPMENT_MIGRATION = readFileSync(
  new URL('../../migrations/321_coaching_rotational_wall_throw_equipment_taxonomy.sql', import.meta.url),
  'utf8',
)
const SHUFFLE_ROTATIONAL_THROW_IDENTITY_MIGRATION = readFileSync(
  new URL('../../migrations/322_coaching_shuffle_rotational_throw_identity_consolidation.sql', import.meta.url),
  'utf8',
)
const SHUFFLE_ROTATIONAL_THROW_COMPLETION_MIGRATION = readFileSync(
  new URL('../../migrations/323_coaching_shuffle_rotational_throw_family_completion.sql', import.meta.url),
  'utf8',
)
const BOX_JUMP_SINGLE_LEG_LANDING_IDENTITY_MIGRATION = readFileSync(
  new URL('../../migrations/324_coaching_box_jump_single_leg_landing_identity_consolidation.sql', import.meta.url),
  'utf8',
)
const BOX_JUMP_SINGLE_LEG_LANDING_COMPLETION_MIGRATION = readFileSync(
  new URL('../../migrations/325_coaching_box_jump_single_leg_landing_family_completion.sql', import.meta.url),
  'utf8',
)
const SINGLE_LEG_LATERAL_HOP_STICK_IDENTITY_MIGRATION = readFileSync(
  new URL('../../migrations/326_coaching_single_leg_lateral_hop_stick_identity_consolidation.sql', import.meta.url),
  'utf8',
)
const SINGLE_LEG_LATERAL_HOP_STICK_COMPLETION_MIGRATION = readFileSync(
  new URL('../../migrations/327_coaching_single_leg_lateral_hop_stick_family_completion.sql', import.meta.url),
  'utf8',
)
const DEAD_BUG_PULLOVER_IDENTITY_MIGRATION = readFileSync(
  new URL('../../migrations/328_coaching_dead_bug_pullover_identity_consolidation.sql', import.meta.url),
  'utf8',
)
const DEAD_BUG_PULLOVER_COMPLETION_MIGRATION = readFileSync(
  new URL('../../migrations/329_coaching_dead_bug_pullover_family_completion.sql', import.meta.url),
  'utf8',
)
const ROMANIAN_DEADLIFT_IDENTITY_MIGRATION = readFileSync(
  new URL('../../migrations/330_coaching_romanian_deadlift_identity_consolidation.sql', import.meta.url),
  'utf8',
)
const ROMANIAN_DEADLIFT_COMPLETION_MIGRATION = readFileSync(
  new URL('../../migrations/331_coaching_romanian_deadlift_family_completion.sql', import.meta.url),
  'utf8',
)
const FRONT_FOOT_ELEVATED_SPLIT_SQUAT_IDENTITY_MIGRATION = readFileSync(
  new URL('../../migrations/332_coaching_front_foot_elevated_split_squat_identity_consolidation.sql', import.meta.url),
  'utf8',
)
const FRONT_FOOT_ELEVATED_SPLIT_SQUAT_COMPLETION_MIGRATION = readFileSync(
  new URL('../../migrations/333_coaching_front_foot_elevated_split_squat_family_completion.sql', import.meta.url),
  'utf8',
)
const HALF_KNEELING_SINGLE_ARM_PRESS_IDENTITY_MIGRATION = readFileSync(
  new URL('../../migrations/334_coaching_half_kneeling_single_arm_press_identity_consolidation.sql', import.meta.url),
  'utf8',
)
const HALF_KNEELING_SINGLE_ARM_PRESS_COMPLETION_MIGRATION = readFileSync(
  new URL('../../migrations/335_coaching_half_kneeling_single_arm_press_family_completion.sql', import.meta.url),
  'utf8',
)
const HIGH_SIMILARITY_IDENTITY_BOUNDARIES_MIGRATION = readFileSync(
  new URL('../../migrations/336_coaching_high_similarity_identity_boundaries.sql', import.meta.url),
  'utf8',
)
const OVERHEAD_MEDICINE_BALL_PROJECTION_COMPLETION_MIGRATION = readFileSync(
  new URL('../../migrations/337_coaching_overhead_medicine_ball_projection_family_completion.sql', import.meta.url),
  'utf8',
)
const HIGH_SIMILARITY_MOVEMENT_BOUNDARIES_MIGRATION = readFileSync(
  new URL('../../migrations/338_coaching_high_similarity_movement_boundaries.sql', import.meta.url),
  'utf8',
)
const HIGH_CONFIDENCE_IMPLEMENT_IDENTITY_MIGRATION = readFileSync(
  new URL('../../migrations/339_coaching_high_confidence_implement_identity_consolidation.sql', import.meta.url),
  'utf8',
)
const REMAINING_HIGH_SIMILARITY_ADJUDICATION_MIGRATION = readFileSync(
  new URL('../../migrations/340_coaching_remaining_high_similarity_identity_adjudication.sql', import.meta.url),
  'utf8',
)
const REMAINING_IDENTITY_BOUNDARIES_RESEARCHED_MIGRATION = readFileSync(
  new URL('../../migrations/341_coaching_remaining_identity_boundaries_researched.sql', import.meta.url),
  'utf8',
)
const RESEARCHED_IDENTITY_BOUNDARY_COMPLETION_MIGRATION = readFileSync(
  new URL('../../migrations/342_coaching_researched_identity_boundary_card_completion.sql', import.meta.url),
  'utf8',
)
const CHEST_PASS_VARIANT_CONSOLIDATION_MIGRATION = readFileSync(
  new URL('../../migrations/343_coaching_chest_pass_variant_consolidation_and_tuck_boundary.sql', import.meta.url),
  'utf8',
)
const BOUNDARY_RELATIONSHIP_DIMENSION_TAXONOMY_MIGRATION = readFileSync(
  new URL('../../migrations/344_coaching_boundary_relationship_dimension_taxonomy.sql', import.meta.url),
  'utf8',
)
const PALLOF_PRESS_STEP_OUT_IDENTITY_MIGRATION = readFileSync(
  new URL('../../migrations/345_coaching_pallof_press_step_out_identity_consolidation.sql', import.meta.url),
  'utf8',
)
const PALLOF_PRESS_STEP_OUT_COMPLETION_MIGRATION = readFileSync(
  new URL('../../migrations/346_coaching_pallof_press_step_out_family_completion.sql', import.meta.url),
  'utf8',
)
const EXERCISE_SKILL_METADATA_ABSENCE_MIGRATION = readFileSync(
  new URL('../../migrations/347_coaching_exercise_skill_metadata_absence.sql', import.meta.url),
  'utf8',
)
const STIR_THE_POT_IDENTITY_MIGRATION = readFileSync(
  new URL('../../migrations/348_coaching_stir_the_pot_identity_consolidation.sql', import.meta.url),
  'utf8',
)
const STIR_THE_POT_COMPLETION_MIGRATION = readFileSync(
  new URL('../../migrations/349_coaching_stir_the_pot_family_completion.sql', import.meta.url),
  'utf8',
)
const EXERCISE_PROFICIENCY_METADATA_GUARD_MIGRATION = readFileSync(
  new URL('../../migrations/350_coaching_exercise_proficiency_metadata_guard.sql', import.meta.url),
  'utf8',
)
const STATIC_CONTROL_IDENTITY_MIGRATION = readFileSync(
  new URL('../../migrations/351_coaching_static_control_identity_consolidations.sql', import.meta.url),
  'utf8',
)
const STATIC_CONTROL_COMPLETION_MIGRATION = readFileSync(
  new URL('../../migrations/352_coaching_static_control_family_completion.sql', import.meta.url),
  'utf8',
)
const REACTIVE_LANDING_POGO_IDENTITY_MIGRATION = readFileSync(
  new URL('../../migrations/353_coaching_reactive_landing_pogo_identity_consolidations.sql', import.meta.url),
  'utf8',
)
const REACTIVE_LANDING_POGO_COMPLETION_MIGRATION = readFileSync(
  new URL('../../migrations/354_coaching_reactive_landing_pogo_family_completion.sql', import.meta.url),
  'utf8',
)
const SCORE_84_IDENTITY_BOUNDARIES_MIGRATION = readFileSync(
  new URL('../../migrations/355_coaching_score_84_identity_boundaries.sql', import.meta.url),
  'utf8',
)
const DROP_DEPTH_FALLING_START_IDENTITY_MIGRATION = readFileSync(
  new URL('../../migrations/356_coaching_drop_depth_falling_start_identity_consolidation.sql', import.meta.url),
  'utf8',
)
const REMAINING_SCORE_84_IDENTITY_MIGRATION = readFileSync(
  new URL('../../migrations/357_coaching_remaining_score_84_identity_boundaries.sql', import.meta.url),
  'utf8',
)
const SCORE_84_VARIANT_CONSOLIDATIONS_MIGRATION = readFileSync(
  new URL('../../migrations/358_coaching_score_84_variant_identity_consolidations.sql', import.meta.url),
  'utf8',
)
const REACTIVE_CUT_HOP_CUT_BOUNDARY_MIGRATION = readFileSync(
  new URL('../../migrations/359_coaching_reactive_cut_hop_cut_identity_boundary.sql', import.meta.url),
  'utf8',
)
const REACTIVE_HOP_CUT_SEATED_PRESS_COMPLETION_MIGRATION = readFileSync(
  new URL('../../migrations/360_coaching_reactive_hop_cut_seated_press_completion.sql', import.meta.url),
  'utf8',
)
const HIP_THRUST_IDENTITY_MIGRATION = readFileSync(
  new URL('../../migrations/361_coaching_hip_thrust_identity_consolidations.sql', import.meta.url),
  'utf8',
)
const HIP_THRUST_COMPLETION_MIGRATION = readFileSync(
  new URL('../../migrations/362_coaching_hip_thrust_family_completion.sql', import.meta.url),
  'utf8',
)
const BALL_DROP_IDENTITY_CLUSTER_MIGRATION = readFileSync(
  new URL('../../migrations/363_coaching_ball_drop_identity_cluster.sql', import.meta.url),
  'utf8',
)
const BALL_DROP_COMPOUND_BOUNDARY_MIGRATION = readFileSync(
  new URL('../../migrations/364_coaching_ball_drop_compound_identity_boundary.sql', import.meta.url),
  'utf8',
)
const BALL_DROP_COMPLETION_MIGRATION = readFileSync(
  new URL('../../migrations/365_coaching_ball_drop_chase_catch_completion.sql', import.meta.url),
  'utf8',
)
const ALTERNATING_BOUNDS_IDENTITY_MIGRATION = readFileSync(
  new URL('../../migrations/366_coaching_alternating_bounds_identity_consolidation.sql', import.meta.url),
  'utf8',
)
const ALTERNATING_BOUNDS_COMPLETION_MIGRATION = readFileSync(
  new URL('../../migrations/367_coaching_alternating_bounds_family_completion.sql', import.meta.url),
  'utf8',
)
const REMAINING_ALTERNATING_BOUNDS_IDENTITY_MIGRATION = readFileSync(
  new URL('../../migrations/368_coaching_remaining_alternating_bounds_identity_consolidations.sql', import.meta.url),
  'utf8',
)
const SPLIT_SQUAT_IDENTITY_MIGRATION = readFileSync(
  new URL('../../migrations/369_coaching_split_squat_identity_cluster.sql', import.meta.url),
  'utf8',
)
const SPLIT_SQUAT_COMPLETION_MIGRATION = readFileSync(
  new URL('../../migrations/370_coaching_split_squat_family_completion.sql', import.meta.url),
  'utf8',
)
const SCORE_83_IDENTITY_BOUNDARIES_MIGRATION = readFileSync(
  new URL('../../migrations/371_coaching_score_83_identity_boundaries.sql', import.meta.url),
  'utf8',
)
const SCORE_83_VARIANT_CONSOLIDATIONS_MIGRATION = readFileSync(
  new URL('../../migrations/372_coaching_score_83_variant_identity_consolidations.sql', import.meta.url),
  'utf8',
)
const HAMSTRING_SLIDER_COMPLETION_MIGRATION = readFileSync(
  new URL('../../migrations/373_coaching_hamstring_slider_curl_family_completion.sql', import.meta.url),
  'utf8',
)
const EXERCISE_IDENTITY_PROFICIENCY_GUARD_MIGRATION = readFileSync(
  new URL('../../migrations/374_coaching_exercise_identity_proficiency_metadata_guard.sql', import.meta.url),
  'utf8',
)
const SCORE_82_IDENTITY_BOUNDARIES_MIGRATION = readFileSync(
  new URL('../../migrations/375_coaching_score_82_identity_boundaries.sql', import.meta.url),
  'utf8',
)
const SCORE_82_VARIANT_CONSOLIDATIONS_MIGRATION = readFileSync(
  new URL('../../migrations/376_coaching_score_82_variant_identity_consolidations.sql', import.meta.url),
  'utf8',
)
const SCORE_81_IDENTITY_BOUNDARIES_MIGRATION = readFileSync(
  new URL('../../migrations/377_coaching_score_81_identity_boundaries.sql', import.meta.url),
  'utf8',
)
const SCORE_81_VARIANT_CONSOLIDATIONS_MIGRATION = readFileSync(
  new URL('../../migrations/378_coaching_score_81_variant_identity_consolidations.sql', import.meta.url),
  'utf8',
)
const SCORE_80_IDENTITY_BOUNDARIES_MIGRATION = readFileSync(
  new URL('../../migrations/379_coaching_score_80_identity_boundaries.sql', import.meta.url),
  'utf8',
)
const SCORE_80_VARIANT_CONSOLIDATIONS_MIGRATION = readFileSync(
  new URL('../../migrations/380_coaching_score_80_variant_identity_consolidations.sql', import.meta.url),
  'utf8',
)
const SCORE_79_IDENTITY_BOUNDARIES_MIGRATION = readFileSync(
  new URL('../../migrations/381_coaching_score_79_identity_boundaries.sql', import.meta.url),
  'utf8',
)
const SCORE_79_VARIANT_CONSOLIDATIONS_MIGRATION = readFileSync(
  new URL('../../migrations/382_coaching_score_79_variant_identity_consolidations.sql', import.meta.url),
  'utf8',
)
const SCORE_78_IDENTITY_BOUNDARIES_MIGRATION = readFileSync(
  new URL('../../migrations/383_coaching_score_78_identity_boundaries.sql', import.meta.url),
  'utf8',
)
const SCORE_78_VARIANT_CONSOLIDATIONS_MIGRATION = readFileSync(
  new URL('../../migrations/384_coaching_score_78_variant_identity_consolidations.sql', import.meta.url),
  'utf8',
)
const SCORE_77_IDENTITY_BOUNDARIES_MIGRATION = readFileSync(
  new URL('../../migrations/385_coaching_score_77_identity_boundaries.sql', import.meta.url),
  'utf8',
)
const SCORE_77_VARIANT_CONSOLIDATIONS_MIGRATION = readFileSync(
  new URL('../../migrations/386_coaching_score_77_variant_identity_consolidations.sql', import.meta.url),
  'utf8',
)
const SCORE_76_IDENTITY_BOUNDARIES_MIGRATION = readFileSync(
  new URL('../../migrations/387_coaching_score_76_identity_boundaries.sql', import.meta.url),
  'utf8',
)
const SCORE_76_VARIANT_CONSOLIDATIONS_MIGRATION = readFileSync(
  new URL('../../migrations/388_coaching_score_76_variant_identity_consolidations.sql', import.meta.url),
  'utf8',
)
const SCORE_75_IDENTITY_BOUNDARIES_MIGRATION = readFileSync(
  new URL('../../migrations/389_coaching_score_75_identity_boundaries.sql', import.meta.url),
  'utf8',
)
const SCORE_75_VARIANT_CONSOLIDATIONS_MIGRATION = readFileSync(
  new URL('../../migrations/390_coaching_score_75_variant_identity_consolidations.sql', import.meta.url),
  'utf8',
)
const SCORE_74_IDENTITY_BOUNDARIES_MIGRATION = readFileSync(
  new URL('../../migrations/391_coaching_score_74_identity_boundaries.sql', import.meta.url),
  'utf8',
)
const SCORE_74_VARIANT_CONSOLIDATIONS_MIGRATION = readFileSync(
  new URL('../../migrations/392_coaching_score_74_variant_identity_consolidations.sql', import.meta.url),
  'utf8',
)
const SCORE_73_IDENTITY_BOUNDARIES_MIGRATION = readFileSync(
  new URL('../../migrations/393_coaching_score_73_identity_boundaries.sql', import.meta.url),
  'utf8',
)
const SCORE_73_VARIANT_CONSOLIDATIONS_MIGRATION = readFileSync(
  new URL('../../migrations/394_coaching_score_73_variant_identity_consolidations.sql', import.meta.url),
  'utf8',
)
const SCORE_72_IDENTITY_BOUNDARIES_MIGRATION = readFileSync(
  new URL('../../migrations/395_coaching_score_72_identity_boundaries.sql', import.meta.url),
  'utf8',
)
const SCORE_72_VARIANT_CONSOLIDATIONS_MIGRATION = readFileSync(
  new URL('../../migrations/396_coaching_score_72_variant_identity_consolidations.sql', import.meta.url),
  'utf8',
)
const LANDMINE_PRESS_COMPLETION_MIGRATION = readFileSync(
  new URL('../../migrations/397_coaching_landmine_press_family_completion.sql', import.meta.url),
  'utf8',
)
const ONE_ARM_LANDMINE_BASE_COMPLETION_MIGRATION = readFileSync(
  new URL('../../migrations/398_coaching_one_arm_landmine_base_family_completion.sql', import.meta.url),
  'utf8',
)
const LANDMINE_EXPLOSIVE_PRESS_COMPLETION_MIGRATION = readFileSync(
  new URL('../../migrations/401_coaching_landmine_explosive_press_family_completion.sql', import.meta.url),
  'utf8',
)
const LANDMINE_SQUAT_LUNGE_COMPLETION_MIGRATION = readFileSync(
  new URL('../../migrations/402_coaching_landmine_squat_lunge_family_completion.sql', import.meta.url),
  'utf8',
)
const COSSACK_SQUAT_COMPLETION_MIGRATION = readFileSync(
  new URL('../../migrations/403_coaching_cossack_squat_family_completion.sql', import.meta.url),
  'utf8',
)
const ADDUCTOR_ROCKBACK_COMPLETION_MIGRATION = readFileSync(
  new URL('../../migrations/404_coaching_adductor_rockback_family_completion.sql', import.meta.url),
  'utf8',
)
const BACKPEDAL_TO_SPRINT_COMPLETION_MIGRATION = readFileSync(
  new URL('../../migrations/407_coaching_backpedal_to_sprint_family_completion.sql', import.meta.url),
  'utf8',
)
const HANG_FAMILY_RESEARCH_COMPLETION_MIGRATION = readFileSync(
  new URL('../../migrations/408_coaching_hang_family_research_completion.sql', import.meta.url),
  'utf8',
)
const SUPPORT_COMPRESSION_RESEARCH_COMPLETION_MIGRATION = readFileSync(
  new URL('../../migrations/409_coaching_support_compression_research_completion.sql', import.meta.url),
  'utf8',
)
const HANGING_LEG_RAISE_L_SIT_RESEARCH_COMPLETION_MIGRATION = readFileSync(
  new URL('../../migrations/410_coaching_hanging_leg_raise_l_sit_research_completion.sql', import.meta.url),
  'utf8',
)
const A_SERIES_SPRINT_DRILLS_RESEARCH_COMPLETION_MIGRATION = readFileSync(
  new URL('../../migrations/411_coaching_a_series_sprint_drills_research_completion.sql', import.meta.url),
  'utf8',
)
const ANKLING_STRAIGHT_LEG_IDENTITY_CORRECTION_MIGRATION = readFileSync(
  new URL('../../migrations/412_coaching_ankling_straight_leg_identity_lineage_correction.sql', import.meta.url),
  'utf8',
)
const ANKLING_STRAIGHT_LEG_RESEARCH_COMPLETION_MIGRATION = readFileSync(
  new URL('../../migrations/413_coaching_ankling_straight_leg_research_completion.sql', import.meta.url),
  'utf8',
)
const SKIPPING_FAST_LEG_IDENTITY_PREPARATION_MIGRATION = readFileSync(
  new URL('../../migrations/414_coaching_skipping_fast_leg_identity_preparation.sql', import.meta.url),
  'utf8',
)
const SKIPPING_FAST_LEG_RESEARCH_COMPLETION_MIGRATION = readFileSync(
  new URL('../../migrations/415_coaching_skipping_fast_leg_research_completion.sql', import.meta.url),
  'utf8',
)
const DRIBBLE_RUN_VARIANT_PREPARATION_MIGRATION = readFileSync(
  new URL('../../migrations/416_coaching_dribble_run_variant_lineage_preparation.sql', import.meta.url),
  'utf8',
)
const DRIBBLE_RUN_RESEARCH_COMPLETION_MIGRATION = readFileSync(
  new URL('../../migrations/417_coaching_dribble_run_research_completion.sql', import.meta.url),
  'utf8',
)
const POGO_DRIBBLE_IDENTITY_QUEUE_CLOSURE_MIGRATION = readFileSync(
  new URL('../../migrations/418_coaching_pogo_dribble_identity_queue_closure.sql', import.meta.url),
  'utf8',
)
const SHORT_ACCELERATION_IDENTITY_CONSOLIDATION_MIGRATION = readFileSync(
  new URL('../../migrations/419_coaching_short_acceleration_identity_variant_consolidation.sql', import.meta.url),
  'utf8',
)
const SHORT_ACCELERATION_RESEARCH_COMPLETION_MIGRATION = readFileSync(
  new URL('../../migrations/420_coaching_short_acceleration_research_completion.sql', import.meta.url),
  'utf8',
)
const SHORT_ACCELERATION_IDENTITY_QUEUE_CLOSURE_MIGRATION = readFileSync(
  new URL('../../migrations/421_coaching_short_acceleration_identity_queue_closure.sql', import.meta.url),
  'utf8',
)
const HILL_SPRINT_ACCELERATION_RESEARCH_COMPLETION_MIGRATION = readFileSync(
  new URL('../../migrations/422_coaching_hill_sprint_acceleration_research_completion.sql', import.meta.url),
  'utf8',
)
const WALL_BALL_180_IDENTITY_RESOLUTION_MIGRATION = readFileSync(
  new URL('../../migrations/423_coaching_180_wall_ball_identity_resolution.sql', import.meta.url),
  'utf8',
)
const LANDMINE_ARC_IDENTITY_RESOLUTION_MIGRATION = readFileSync(
  new URL('../../migrations/424_coaching_landmine_arc_identity_resolution.sql', import.meta.url),
  'utf8',
)
const ANKLING_POGO_IDENTITY_RESOLUTION_MIGRATION = readFileSync(
  new URL('../../migrations/425_coaching_ankling_pogo_identity_resolution.sql', import.meta.url),
  'utf8',
)
const OPPOSITE_LEG_BOUND_DIRECTION_IDENTITY_RESOLUTION_MIGRATION = readFileSync(
  new URL('../../migrations/426_coaching_opposite_leg_bound_direction_identity_resolution.sql', import.meta.url),
  'utf8',
)
const RECENT_FAMILY_IDENTITY_BOUNDARY_MIGRATION = readFileSync(
  new URL('../../migrations/405_coaching_recent_family_identity_boundary_closure.sql', import.meta.url),
  'utf8',
)
const UNCLASSIFIED_IDENTITY_QUEUE_CLOSURE_MIGRATION = readFileSync(
  new URL('../../migrations/406_coaching_remaining_unclassified_identity_queue_closure.sql', import.meta.url),
  'utf8',
)
const PLATFORM_INIT_TABLES_SOURCE = readFileSync(
  new URL('../initTables.js', import.meta.url),
  'utf8',
)
const SKILL_LIBRARY_GENERATORS = new Set([
  'generate-105-skill-seed.mjs',
  'generate-usag-mag-floor.mjs',
  'generate-usag-youth-at-acro.mjs',
])

function emptyBundle() {
  return {
    phaseProfiles: new Map(),
    dosageProfiles: new Map(),
    scalingProfiles: new Map(),
    safetyProfiles: new Map(),
    regimenRules: new Map(),
    difficultyProfiles: new Map(),
  }
}

function recursivelyListJson(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name)
    if (entry.isDirectory()) return recursivelyListJson(filename)
    return entry.name.endsWith('.json') ? [filename] : []
  })
}

function inspectProposedDifficulty(value, filename, objectPath = '') {
  const failures = []
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => (
      inspectProposedDifficulty(item, filename, `${objectPath}[${index}]`)
    ))
  }
  if (!value || typeof value !== 'object') return failures
  if (value.proposedDifficulty && typeof value.proposedDifficulty === 'object') {
    const difficulty = value.proposedDifficulty
    const technical = Number(difficulty.technicalComplexity)
    const physical = Number(difficulty.absoluteLoadDemand)
    const overall = Number(difficulty.baseOverallDifficulty)
    if (
      !Number.isInteger(technical)
      || !Number.isInteger(physical)
      || !Number.isInteger(overall)
      || overall !== Math.max(technical, physical)
    ) {
      failures.push({
        filename,
        objectPath,
        technical,
        physical,
        overall,
        expectedOverall: Math.max(technical, physical),
      })
    }
  }
  for (const [key, item] of Object.entries(value)) {
    failures.push(...inspectProposedDifficulty(
      item,
      filename,
      objectPath ? `${objectPath}.${key}` : key,
    ))
  }
  return failures
}

test('exercise generators cannot classify cards by athlete skill level', () => {
  const forbiddenPatterns = [
    /\bskill\s*:\s*['"](?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)['"]/,
    /function\s+skill(?:Level|ForCard)\s*\(/,
    /sqlStr\(\s*skillForCard\s*\(/,
    /AS\s+d\([^)\n]*\bskill\b/,
    /d\.skill::public\.skill_level/,
    /['"](?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)['"]::public\.skill_level/,
  ]

  const exerciseGenerators = readdirSync(GENERATOR_DIR)
    .filter((filename) => filename.startsWith('generate-') && filename.endsWith('.mjs'))
    .filter((filename) => !SKILL_LIBRARY_GENERATORS.has(filename))
    .map((filename) => ({
      filename,
      source: readFileSync(new URL(`../../../scripts/${filename}`, import.meta.url), 'utf8'),
    }))
    .filter(({ source }) => source.includes('INSERT INTO coaching.exercise'))

  assert.ok(exerciseGenerators.length > 0)
  for (const { filename, source } of exerciseGenerators) {
    for (const pattern of forbiddenPatterns) {
      assert.doesNotMatch(source, pattern, `${filename} contains an exercise skill-level classifier`)
    }
  }
})

test('exercise read models omit legacy skill-level classifications', () => {
  const row = {
    id: 42,
    name: 'Countermovement Jump',
    slug: 'countermovement-jump',
    skill_level: 'ADVANCED',
    movement_requirements: {
      coordination_demand: 'high',
      impact_level: 4,
    },
  }
  const bundle = emptyBundle()
  bundle.scalingProfiles.set('42', [{
    id: 1,
    cohort_key: 'adult_beginner',
    label: 'Adult beginner',
    skill_level: 'BEGINNER',
  }])
  bundle.safetyProfiles.set('42', {
    risk_level: 3,
    impact_level: 4,
    minimum_skill_level: 'ADVANCED',
    readiness_checks: ['Pain-free landing'],
  })
  bundle.difficultyProfiles.set('42', {
    technical: 7,
    load: 6,
    overall: 7,
  })

  const attached = attachProgrammingToExercise(row, bundle)
  const card = buildExerciseCard(row, attached)

  assert.equal(Object.hasOwn(attached, 'skill_level'), false)
  assert.equal(Object.hasOwn(attached.safety_profile, 'minimum_skill_level'), false)
  assert.equal(Object.hasOwn(attached.scaling_profiles[0], 'skill_level'), false)
  assert.equal(Object.hasOwn(card.movement_identity, 'skill_level'), false)
  assert.equal(Object.hasOwn(card.safety_profile, 'minimum_skill_level'), false)
  assert.deepEqual(card.difficulty_profile, attached.difficulty_profile)
  assert.deepEqual(card.difficulty_profile, {
    technical: 7,
    load: 6,
    overall: 7,
  })
})

test('exercise difficulty filters do not use skill-library level labels', () => {
  assert.doesNotMatch(
    EXERCISE_LIBRARY_SOURCE,
    /label:\s*['"](?:Beginner|Intermediate|Advanced|Elite)\b/i,
  )
})

test('canonical research derives overall difficulty only from complexity and physical demand', () => {
  const failures = recursivelyListJson(CANONICAL_RESEARCH_DIR).flatMap((filename) => (
    inspectProposedDifficulty(JSON.parse(readFileSync(filename, 'utf8')), filename)
  ))
  assert.deepEqual(failures, [])
})

test('kneeling chest-pass migrations preserve review gates and difficulty-only exercise semantics', () => {
  for (const filename of [
    '317_coaching_kneeling_chest_pass_identity_consolidation.sql',
    '318_coaching_kneeling_chest_pass_family_completion.sql',
  ]) {
    assert.match(PLATFORM_INIT_TABLES_SOURCE, new RegExp(`['"]${filename}['"]`))
  }

  for (const protectedTable of [
    'exercise_card_review_v1',
    'exercise_card_revision_v1',
    'exercise_media_review_v1',
    'exercise_score_calibration_v1',
    'exercise_score_v1',
  ]) {
    assert.match(KNEELING_CHEST_PASS_IDENTITY_MIGRATION, new RegExp(protectedTable))
    assert.match(KNEELING_CHEST_PASS_COMPLETION_MIGRATION, new RegExp(protectedTable))
  }

  for (const variantKey of [
    'tall-kneeling-throw-only',
    'tall-kneeling-rebound-catch',
    'half-kneeling-throw-only',
    'half-kneeling-rebound-catch',
  ]) {
    assert.match(KNEELING_CHEST_PASS_COMPLETION_MIGRATION, new RegExp(variantKey))
  }
  assert.match(
    KNEELING_CHEST_PASS_COMPLETION_MIGRATION,
    /greatest\(\s*seed\.technical_complexity,\s*seed\.physical_difficulty\s*\)/,
  )
  assert.match(
    KNEELING_CHEST_PASS_COMPLETION_MIGRATION,
    /genericSourceStance', 'unresolved_and_archived'/,
  )
  assert.match(
    KNEELING_CHEST_PASS_COMPLETION_MIGRATION,
    /approved_video_url = NULL/,
  )
  assert.doesNotMatch(
    KNEELING_CHEST_PASS_COMPLETION_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
})

test('rotational wall-throw migrations preserve review gates and difficulty-only exercise semantics', () => {
  for (const filename of [
    '319_coaching_rotational_wall_throw_identity_consolidation.sql',
    '320_coaching_rotational_wall_throw_family_completion.sql',
    '321_coaching_rotational_wall_throw_equipment_taxonomy.sql',
  ]) {
    assert.match(PLATFORM_INIT_TABLES_SOURCE, new RegExp(`['"]${filename}['"]`))
  }

  for (const protectedTable of [
    'exercise_card_review_v1',
    'exercise_card_revision_v1',
    'exercise_media_review_v1',
    'exercise_score_calibration_v1',
    'exercise_score_v1',
  ]) {
    assert.match(ROTATIONAL_WALL_THROW_IDENTITY_MIGRATION, new RegExp(protectedTable))
    assert.match(ROTATIONAL_WALL_THROW_COMPLETION_MIGRATION, new RegExp(protectedTable))
  }

  for (const variantKey of [
    'athletic-stance-wall-throw-only',
    'athletic-stance-wall-rebound-catch',
  ]) {
    assert.match(ROTATIONAL_WALL_THROW_COMPLETION_MIGRATION, new RegExp(variantKey))
  }
  assert.match(
    ROTATIONAL_WALL_THROW_COMPLETION_MIGRATION,
    /greatest\(\s*seed\.exercise_complexity,\s*seed\.physical_difficulty\s*\)/,
  )
  assert.match(
    ROTATIONAL_WALL_THROW_COMPLETION_MIGRATION,
    /legacySourceReturnContract', 'unresolved_and_archived'/,
  )
  assert.match(
    ROTATIONAL_WALL_THROW_COMPLETION_MIGRATION,
    /approved_video_url = NULL/,
  )
  assert.doesNotMatch(
    ROTATIONAL_WALL_THROW_COMPLETION_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.match(
    ROTATIONAL_WALL_THROW_EQUIPMENT_MIGRATION,
    /required_equipment = ARRAY\['medicine_ball', 'wall'\]/,
  )
  assert.match(
    ROTATIONAL_WALL_THROW_EQUIPMENT_MIGRATION,
    /optional_equipment = ARRAY\['line_tape', 'timer', 'mirror'\]/,
  )
  assert.match(ROTATIONAL_WALL_THROW_EQUIPMENT_MIGRATION, /exercise_card_review_v1/)
  assert.match(ROTATIONAL_WALL_THROW_EQUIPMENT_MIGRATION, /exercise_media_review_v1/)
})

test('shuffle rotational-throw migrations consolidate identity without exercise skill levels', () => {
  for (const filename of [
    '322_coaching_shuffle_rotational_throw_identity_consolidation.sql',
    '323_coaching_shuffle_rotational_throw_family_completion.sql',
  ]) {
    assert.match(PLATFORM_INIT_TABLES_SOURCE, new RegExp(`['"]${filename}['"]`))
  }

  for (const protectedTable of [
    'exercise_card_review_v1',
    'exercise_card_revision_v1',
    'exercise_media_review_v1',
    'exercise_score_calibration_v1',
    'exercise_score_v1',
  ]) {
    assert.match(SHUFFLE_ROTATIONAL_THROW_IDENTITY_MIGRATION, new RegExp(protectedTable))
    assert.match(SHUFFLE_ROTATIONAL_THROW_COMPLETION_MIGRATION, new RegExp(protectedTable))
  }

  assert.match(
    SHUFFLE_ROTATIONAL_THROW_IDENTITY_MIGRATION,
    /lateral_shuffle_to_two_hand_rotational_medicine_ball_projection/,
  )
  for (const variantKey of [
    'lateral-shuffle-wall-throw-only',
    'lateral-shuffle-wall-rebound-catch',
  ]) {
    assert.match(SHUFFLE_ROTATIONAL_THROW_COMPLETION_MIGRATION, new RegExp(variantKey))
  }
  assert.match(
    SHUFFLE_ROTATIONAL_THROW_COMPLETION_MIGRATION,
    /greatest\(\s*seed\.exercise_complexity,\s*seed\.physical_difficulty\s*\)/,
  )
  assert.match(
    SHUFFLE_ROTATIONAL_THROW_COMPLETION_MIGRATION,
    /proficiencyClassificationScope', 'coaching_skill_library_only'/,
  )
  assert.match(
    SHUFFLE_ROTATIONAL_THROW_COMPLETION_MIGRATION,
    /approved_video_url = NULL/,
  )
  assert.doesNotMatch(
    SHUFFLE_ROTATIONAL_THROW_COMPLETION_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
})

test('box-jump single-leg-landing migrations use variants for difficulty, never exercise skill levels', () => {
  for (const filename of [
    '324_coaching_box_jump_single_leg_landing_identity_consolidation.sql',
    '325_coaching_box_jump_single_leg_landing_family_completion.sql',
  ]) {
    assert.match(PLATFORM_INIT_TABLES_SOURCE, new RegExp(`['"]${filename}['"]`))
  }

  for (const protectedTable of [
    'exercise_card_review_v1',
    'exercise_card_revision_v1',
    'exercise_media_review_v1',
    'exercise_score_calibration_v1',
    'exercise_score_v1',
  ]) {
    assert.match(BOX_JUMP_SINGLE_LEG_LANDING_IDENTITY_MIGRATION, new RegExp(protectedTable))
    assert.match(BOX_JUMP_SINGLE_LEG_LANDING_COMPLETION_MIGRATION, new RegExp(protectedTable))
  }

  assert.match(
    BOX_JUMP_SINGLE_LEG_LANDING_IDENTITY_MIGRATION,
    /standing_vertical_box_jump_to_declared_single_leg_landing/,
  )
  for (const variantKey of [
    'bilateral-takeoff-single-leg-landing',
    'same-leg-unilateral-takeoff-and-landing',
  ]) {
    assert.match(BOX_JUMP_SINGLE_LEG_LANDING_COMPLETION_MIGRATION, new RegExp(variantKey))
  }
  assert.match(
    BOX_JUMP_SINGLE_LEG_LANDING_COMPLETION_MIGRATION,
    /greatest\(\s*seed\.exercise_complexity,\s*seed\.physical_difficulty\s*\)/,
  )
  assert.match(
    BOX_JUMP_SINGLE_LEG_LANDING_COMPLETION_MIGRATION,
    /proficiencyClassificationScope', 'coaching_skill_library_only'/,
  )
  assert.match(
    BOX_JUMP_SINGLE_LEG_LANDING_COMPLETION_MIGRATION,
    /approved_video_url = NULL/,
  )
  assert.match(
    BOX_JUMP_SINGLE_LEG_LANDING_COMPLETION_MIGRATION,
    /skill_level = NULL/,
  )
  assert.doesNotMatch(
    BOX_JUMP_SINGLE_LEG_LANDING_COMPLETION_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
})

test('single-leg lateral hop-stick migrations preserve same-leg identity without skill levels', () => {
  for (const filename of [
    '326_coaching_single_leg_lateral_hop_stick_identity_consolidation.sql',
    '327_coaching_single_leg_lateral_hop_stick_family_completion.sql',
  ]) {
    assert.match(PLATFORM_INIT_TABLES_SOURCE, new RegExp(`['"]${filename}['"]`))
  }

  for (const protectedTable of [
    'exercise_card_review_v1',
    'exercise_card_revision_v1',
    'exercise_media_review_v1',
    'exercise_score_calibration_v1',
    'exercise_score_v1',
  ]) {
    assert.match(SINGLE_LEG_LATERAL_HOP_STICK_IDENTITY_MIGRATION, new RegExp(protectedTable))
    assert.match(SINGLE_LEG_LATERAL_HOP_STICK_COMPLETION_MIGRATION, new RegExp(protectedTable))
  }

  assert.match(
    SINGLE_LEG_LATERAL_HOP_STICK_IDENTITY_MIGRATION,
    /ipsilateral_single_leg_lateral_hop_to_terminal_stick/,
  )
  for (const variantKey of ['low-amplitude-control', 'distance-output']) {
    assert.match(SINGLE_LEG_LATERAL_HOP_STICK_COMPLETION_MIGRATION, new RegExp(variantKey))
  }
  assert.match(
    SINGLE_LEG_LATERAL_HOP_STICK_COMPLETION_MIGRATION,
    /greatest\(\s*seed\.exercise_complexity,\s*seed\.physical_difficulty\s*\)/,
  )
  assert.match(
    SINGLE_LEG_LATERAL_HOP_STICK_COMPLETION_MIGRATION,
    /proficiencyClassificationScope', 'coaching_skill_library_only'/,
  )
  assert.match(
    SINGLE_LEG_LATERAL_HOP_STICK_COMPLETION_MIGRATION,
    /approved_video_url = NULL/,
  )
  assert.doesNotMatch(
    SINGLE_LEG_LATERAL_HOP_STICK_COMPLETION_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
})

test('dead-bug pullover migrations consolidate implement labels and derive difficulty without skill levels', () => {
  for (const filename of [
    '328_coaching_dead_bug_pullover_identity_consolidation.sql',
    '329_coaching_dead_bug_pullover_family_completion.sql',
  ]) {
    assert.match(PLATFORM_INIT_TABLES_SOURCE, new RegExp(`['"]${filename}['"]`))
  }

  for (const protectedTable of [
    'exercise_card_review_v1',
    'exercise_card_revision_v1',
    'exercise_media_review_v1',
    'exercise_score_calibration_v1',
    'exercise_score_v1',
  ]) {
    assert.match(DEAD_BUG_PULLOVER_IDENTITY_MIGRATION, new RegExp(protectedTable))
    assert.match(DEAD_BUG_PULLOVER_COMPLETION_MIGRATION, new RegExp(protectedTable))
  }

  assert.match(
    DEAD_BUG_PULLOVER_IDENTITY_MIGRATION,
    /loaded_supine_bilateral_dead_bug_pullover_identity_equivalence/,
  )
  for (const variantKey of [
    'dumbbell-tabletop-hold',
    'medicine-ball-tabletop-hold',
    'band-tabletop-hold',
    'dumbbell-contralateral-leg-extension',
    'band-contralateral-leg-extension',
  ]) {
    assert.match(DEAD_BUG_PULLOVER_COMPLETION_MIGRATION, new RegExp(variantKey))
  }
  assert.match(
    DEAD_BUG_PULLOVER_COMPLETION_MIGRATION,
    /greatest\(\s*seed\.exercise_complexity,\s*seed\.physical_difficulty\s*\)/,
  )
  assert.match(
    DEAD_BUG_PULLOVER_COMPLETION_MIGRATION,
    /proficiencyClassificationScope', 'coaching_skill_library_only'/,
  )
  assert.match(
    DEAD_BUG_PULLOVER_COMPLETION_MIGRATION,
    /approved_video_url = NULL/,
  )
  assert.match(
    DEAD_BUG_PULLOVER_COMPLETION_MIGRATION,
    /skill_level = NULL/,
  )
  assert.doesNotMatch(
    DEAD_BUG_PULLOVER_COMPLETION_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
})

test('Romanian-deadlift migrations model implement and tempo variants without skill levels', () => {
  for (const filename of [
    '330_coaching_romanian_deadlift_identity_consolidation.sql',
    '331_coaching_romanian_deadlift_family_completion.sql',
  ]) {
    assert.match(PLATFORM_INIT_TABLES_SOURCE, new RegExp(`['"]${filename}['"]`))
  }

  for (const protectedTable of [
    'exercise_card_review_v1',
    'exercise_card_revision_v1',
    'exercise_media_review_v1',
    'exercise_score_calibration_v1',
    'exercise_score_v1',
  ]) {
    assert.match(ROMANIAN_DEADLIFT_IDENTITY_MIGRATION, new RegExp(protectedTable))
    assert.match(ROMANIAN_DEADLIFT_COMPLETION_MIGRATION, new RegExp(protectedTable))
  }

  assert.match(
    ROMANIAN_DEADLIFT_IDENTITY_MIGRATION,
    /bilateral_loaded_romanian_deadlift_identity_equivalence/,
  )
  for (const variantKey of [
    'barbell-standard-tempo',
    'dumbbell-standard-tempo',
    'single-kettlebell-standard-tempo',
    'double-kettlebell-standard-tempo',
    'sandbag-front-hold-standard-tempo',
    'landmine-two-hand-standard-tempo',
    'barbell-slow-eccentric',
    'dumbbell-slow-eccentric',
  ]) {
    assert.match(ROMANIAN_DEADLIFT_COMPLETION_MIGRATION, new RegExp(variantKey))
  }
  assert.match(
    ROMANIAN_DEADLIFT_COMPLETION_MIGRATION,
    /greatest\(\s*seed\.exercise_complexity,\s*seed\.physical_difficulty\s*\)/,
  )
  assert.match(
    ROMANIAN_DEADLIFT_COMPLETION_MIGRATION,
    /proficiencyClassificationScope', 'coaching_skill_library_only'/,
  )
  assert.match(
    ROMANIAN_DEADLIFT_COMPLETION_MIGRATION,
    /approved_video_url = NULL/,
  )
  assert.match(
    ROMANIAN_DEADLIFT_COMPLETION_MIGRATION,
    /skill_level = NULL/,
  )
  assert.doesNotMatch(
    ROMANIAN_DEADLIFT_COMPLETION_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
})

test('front-foot-elevated split-squat migrations model support and load variants without skill levels', () => {
  for (const filename of [
    '332_coaching_front_foot_elevated_split_squat_identity_consolidation.sql',
    '333_coaching_front_foot_elevated_split_squat_family_completion.sql',
  ]) {
    assert.match(PLATFORM_INIT_TABLES_SOURCE, new RegExp(`['"]${filename}['"]`))
  }

  for (const protectedTable of [
    'exercise_card_review_v1',
    'exercise_card_revision_v1',
    'exercise_media_review_v1',
    'exercise_score_calibration_v1',
    'exercise_score_v1',
  ]) {
    assert.match(
      FRONT_FOOT_ELEVATED_SPLIT_SQUAT_IDENTITY_MIGRATION,
      new RegExp(protectedTable),
    )
    assert.match(
      FRONT_FOOT_ELEVATED_SPLIT_SQUAT_COMPLETION_MIGRATION,
      new RegExp(protectedTable),
    )
  }

  assert.match(
    FRONT_FOOT_ELEVATED_SPLIT_SQUAT_IDENTITY_MIGRATION,
    /front_foot_elevated_split_squat_identity_equivalence/,
  )
  for (const variantKey of [
    'bodyweight-standard-tempo',
    'supported-bodyweight-standard-tempo',
    'two-dumbbell-suitcase-standard-tempo',
    'single-dumbbell-contralateral-standard-tempo',
    'single-dumbbell-ipsilateral-standard-tempo',
    'sandbag-front-hold-standard-tempo',
  ]) {
    assert.match(
      FRONT_FOOT_ELEVATED_SPLIT_SQUAT_COMPLETION_MIGRATION,
      new RegExp(variantKey),
    )
  }
  assert.match(
    FRONT_FOOT_ELEVATED_SPLIT_SQUAT_COMPLETION_MIGRATION,
    /greatest\(\s*seed\.exercise_complexity,\s*seed\.physical_difficulty\s*\)/,
  )
  assert.match(
    FRONT_FOOT_ELEVATED_SPLIT_SQUAT_COMPLETION_MIGRATION,
    /proficiencyClassificationScope', 'coaching_skill_library_only'/,
  )
  assert.match(
    FRONT_FOOT_ELEVATED_SPLIT_SQUAT_COMPLETION_MIGRATION,
    /approved_video_url = NULL/,
  )
  assert.match(
    FRONT_FOOT_ELEVATED_SPLIT_SQUAT_COMPLETION_MIGRATION,
    /skill_level = NULL/,
  )
  assert.doesNotMatch(
    FRONT_FOOT_ELEVATED_SPLIT_SQUAT_COMPLETION_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
})

test('half-kneeling single-arm press migrations model exact implement and side variants without skill levels', () => {
  for (const filename of [
    '334_coaching_half_kneeling_single_arm_press_identity_consolidation.sql',
    '335_coaching_half_kneeling_single_arm_press_family_completion.sql',
  ]) {
    assert.match(PLATFORM_INIT_TABLES_SOURCE, new RegExp(`['"]${filename}['"]`))
  }

  for (const protectedTable of [
    'exercise_card_review_v1',
    'exercise_card_revision_v1',
    'exercise_media_review_v1',
    'exercise_score_calibration_v1',
    'exercise_score_v1',
  ]) {
    assert.match(
      HALF_KNEELING_SINGLE_ARM_PRESS_IDENTITY_MIGRATION,
      new RegExp(protectedTable),
    )
    assert.match(
      HALF_KNEELING_SINGLE_ARM_PRESS_COMPLETION_MIGRATION,
      new RegExp(protectedTable),
    )
  }

  assert.match(
    HALF_KNEELING_SINGLE_ARM_PRESS_IDENTITY_MIGRATION,
    /half_kneeling_single_arm_vertical_press_equivalence/,
  )
  for (const variantKey of [
    'dumbbell-ipsilateral-to-down-knee-standard',
    'dumbbell-contralateral-to-down-knee-standard',
    'kettlebell-ipsilateral-to-down-knee-standard',
    'kettlebell-contralateral-to-down-knee-standard',
    'band-low-anchor-ipsilateral-to-down-knee-standard',
    'band-low-anchor-contralateral-to-down-knee-standard',
  ]) {
    assert.match(
      HALF_KNEELING_SINGLE_ARM_PRESS_COMPLETION_MIGRATION,
      new RegExp(variantKey),
    )
  }
  assert.match(
    HALF_KNEELING_SINGLE_ARM_PRESS_COMPLETION_MIGRATION,
    /greatest\(\s*seed\.exercise_complexity,\s*seed\.physical_difficulty\s*\)/,
  )
  assert.match(
    HALF_KNEELING_SINGLE_ARM_PRESS_COMPLETION_MIGRATION,
    /proficiencyClassificationScope', 'coaching_skill_library_only'/,
  )
  assert.match(
    HALF_KNEELING_SINGLE_ARM_PRESS_COMPLETION_MIGRATION,
    /approved_video_url = NULL/,
  )
  assert.match(
    HALF_KNEELING_SINGLE_ARM_PRESS_COMPLETION_MIGRATION,
    /skill_level = NULL/,
  )
  assert.doesNotMatch(
    HALF_KNEELING_SINGLE_ARM_PRESS_COMPLETION_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
})

test('high-similarity identity boundaries resolve movement differences without exercise skill levels', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /['"]336_coaching_high_similarity_identity_boundaries\.sql['"]/,
  )
  for (const slug of [
    'medicine-ball-overhead-throw',
    'medicine-ball-overhead-back-throw',
    'depth-drop-to-box-jump',
    'box-jump-to-depth-drop',
  ]) {
    assert.match(HIGH_SIMILARITY_IDENTITY_BOUNDARIES_MIGRATION, new RegExp(slug))
  }
  assert.match(
    HIGH_SIMILARITY_IDENTITY_BOUNDARIES_MIGRATION,
    /'distinct_exercises'/,
  )
  assert.match(
    HIGH_SIMILARITY_IDENTITY_BOUNDARIES_MIGRATION,
    /'exercise_complexity_and_physical_difficulty_only'/,
  )
  assert.match(
    HIGH_SIMILARITY_IDENTITY_BOUNDARIES_MIGRATION,
    /'coaching_skill_library_only'/,
  )
  assert.doesNotMatch(
    HIGH_SIMILARITY_IDENTITY_BOUNDARIES_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
})

test('overhead medicine-ball completion scores exact projection variants without exercise skill levels', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /['"]337_coaching_overhead_medicine_ball_projection_family_completion\.sql['"]/,
  )
  for (const protectedTable of [
    'exercise_card_review_v1',
    'exercise_card_revision_v1',
    'exercise_media_review_v1',
    'exercise_score_calibration_v1',
    'exercise_score_v1',
  ]) {
    assert.match(
      OVERHEAD_MEDICINE_BALL_PROJECTION_COMPLETION_MIGRATION,
      new RegExp(protectedTable),
    )
  }
  for (const variantKey of [
    'stationary-forward-distance',
    'step-through-forward-wall-throw-only',
    'countermovement-backward-distance',
    'no-countermovement-backward-distance',
  ]) {
    assert.match(
      OVERHEAD_MEDICINE_BALL_PROJECTION_COMPLETION_MIGRATION,
      new RegExp(variantKey),
    )
  }
  assert.match(
    OVERHEAD_MEDICINE_BALL_PROJECTION_COMPLETION_MIGRATION,
    /greatest\(seed\.exercise_complexity, seed\.physical_difficulty\)/,
  )
  assert.match(
    OVERHEAD_MEDICINE_BALL_PROJECTION_COMPLETION_MIGRATION,
    /proficiencyClassificationScope[\s\S]*coaching_skill_library_only/,
  )
  assert.match(
    OVERHEAD_MEDICINE_BALL_PROJECTION_COMPLETION_MIGRATION,
    /approved_video_url = NULL/,
  )
  assert.match(
    OVERHEAD_MEDICINE_BALL_PROJECTION_COMPLETION_MIGRATION,
    /skill_level = NULL/,
  )
  assert.doesNotMatch(
    OVERHEAD_MEDICINE_BALL_PROJECTION_COMPLETION_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
})

test('high-similarity movement boundaries use mechanics instead of exercise skill levels', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /['"]338_coaching_high_similarity_movement_boundaries\.sql['"]/,
  )
  for (const boundary of [
    'two_point_vs_three_point_start_base',
    'forward_or_general_vs_lateral_crawl_direction',
    'knees_hovered_bear_base_vs_extended_tall_plank_base',
    'box_landing_target_vs_floor_landing',
    'outward_eversion_vs_inward_inversion_force_direction',
    'hinge_plus_row_vs_hinge_only',
    'clean_and_squat_vs_clean_squat_and_wall_shot',
    'one_projection_contact_vs_three_repeated_projections',
    'split_stance_unilateral_bias_vs_bilateral_squat_base',
    'strict_press_vs_deliberate_lower_body_drive',
  ]) {
    assert.match(
      HIGH_SIMILARITY_MOVEMENT_BOUNDARIES_MIGRATION,
      new RegExp(boundary),
    )
  }
  assert.match(
    LANDMINE_PRESS_COMPLETION_MIGRATION,
    /body_regions = ARRAY\[[\s\S]*?'rib_cage'[\s\S]*?\]::TEXT\[\],[\s\S]*?required_equipment = ARRAY\[\s*'landmine',\s*'barbell'\s*\]::TEXT\[\],[\s\S]*?optional_equipment = ARRAY\[\s*'plates'\s*\]::TEXT\[\]/,
  )
  assert.match(
    LANDMINE_PRESS_COMPLETION_MIGRATION,
    /'progression',82,ARRAY\['stability','complexity','load'\]::TEXT\[\]/,
  )
  assert.match(
    LANDMINE_PRESS_COMPLETION_MIGRATION,
    /'regression',92,ARRAY\['stability','complexity'\]::TEXT\[\]/,
  )
  assert.match(
    HIGH_SIMILARITY_MOVEMENT_BOUNDARIES_MIGRATION,
    /'distinct_exercises'/,
  )
  assert.match(
    HIGH_SIMILARITY_MOVEMENT_BOUNDARIES_MIGRATION,
    /'exercise_complexity_and_physical_difficulty_only'/,
  )
  assert.match(
    HIGH_SIMILARITY_MOVEMENT_BOUNDARIES_MIGRATION,
    /'coaching_skill_library_only'/,
  )
  assert.doesNotMatch(
    HIGH_SIMILARITY_MOVEMENT_BOUNDARIES_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
})

test('implement identity consolidation converts source modifiers to variants without exercise skill levels', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /['"]339_coaching_high_confidence_implement_identity_consolidation\.sql['"]/,
  )
  for (const survivorSlug of [
    'bulgarian-split-squat',
    'strict-overhead-press',
    'sumo-deadlift',
    'glute-bridge',
    'reverse-lunge',
    'single-leg-romanian-deadlift',
    'lateral-bear-crawl',
  ]) {
    assert.match(
      HIGH_CONFIDENCE_IMPLEMENT_IDENTITY_MIGRATION,
      new RegExp(survivorSlug),
    )
  }
  for (const protectedTable of [
    'exercise_card_review_v1',
    'exercise_card_revision_v1',
    'exercise_media_review_v1',
    'exercise_score_calibration_v1',
    'exercise_score_v1',
  ]) {
    assert.match(
      HIGH_CONFIDENCE_IMPLEMENT_IDENTITY_MIGRATION,
      new RegExp(protectedTable),
    )
  }
  assert.match(
    HIGH_CONFIDENCE_IMPLEMENT_IDENTITY_MIGRATION,
    /'duplicate_consolidated'/,
  )
  assert.match(
    HIGH_CONFIDENCE_IMPLEMENT_IDENTITY_MIGRATION,
    /'max_exercise_complexity_physical_difficulty'/,
  )
  assert.match(
    HIGH_CONFIDENCE_IMPLEMENT_IDENTITY_MIGRATION,
    /'coaching_skill_library_only'/,
  )
  assert.match(
    HIGH_CONFIDENCE_IMPLEMENT_IDENTITY_MIGRATION,
    /skill_level = NULL/,
  )
  assert.match(
    HIGH_CONFIDENCE_IMPLEMENT_IDENTITY_MIGRATION,
    /minimum_skill_level = NULL/,
  )
  assert.doesNotMatch(
    HIGH_CONFIDENCE_IMPLEMENT_IDENTITY_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
})

test('remaining similarity adjudication records movement boundaries and quarantines ambiguity without skill levels', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /['"]340_coaching_remaining_high_similarity_identity_adjudication\.sql['"]/,
  )
  for (const boundary of [
    'two_point_vs_three_point_start_base',
    'cut_plant_vs_bound_projection',
    'flat_supine_vs_inclined_press_angle',
    'full_curl_contract_vs_eccentric_only_lowering',
    'vertical_pull_vs_horizontal_push',
  ]) {
    assert.match(
      REMAINING_HIGH_SIMILARITY_ADJUDICATION_MIGRATION,
      new RegExp(boundary),
    )
  }
  for (const ambiguity of [
    'legacy_dead_bug_press_contract_under_specified',
    'legacy_lateral_hop_laterality_under_specified',
    'legacy_countermovement_projection_direction_under_specified',
  ]) {
    assert.match(
      REMAINING_HIGH_SIMILARITY_ADJUDICATION_MIGRATION,
      new RegExp(ambiguity),
    )
  }
  assert.match(
    REMAINING_HIGH_SIMILARITY_ADJUDICATION_MIGRATION,
    /'distinct_exercises'/,
  )
  assert.match(
    REMAINING_HIGH_SIMILARITY_ADJUDICATION_MIGRATION,
    /'needs_human_review'/,
  )
  assert.match(
    REMAINING_HIGH_SIMILARITY_ADJUDICATION_MIGRATION,
    /'exercise_complexity_and_physical_difficulty_only'/,
  )
  assert.match(
    REMAINING_HIGH_SIMILARITY_ADJUDICATION_MIGRATION,
    /'coaching_skill_library_only'/,
  )
  assert.doesNotMatch(
    REMAINING_HIGH_SIMILARITY_ADJUDICATION_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
})

test('researched identity boundaries complete candidate cards without exercise skill levels or fabricated approvals', () => {
  for (const migrationName of [
    '341_coaching_remaining_identity_boundaries_researched.sql',
    '342_coaching_researched_identity_boundary_card_completion.sql',
    '343_coaching_chest_pass_variant_consolidation_and_tuck_boundary.sql',
    '344_coaching_boundary_relationship_dimension_taxonomy.sql',
  ]) {
    assert.match(
      PLATFORM_INIT_TABLES_SOURCE,
      new RegExp(`['"]${migrationName.replaceAll('.', '\\.')}['"]`),
    )
  }

  for (const migration of [
    REMAINING_IDENTITY_BOUNDARIES_RESEARCHED_MIGRATION,
    RESEARCHED_IDENTITY_BOUNDARY_COMPLETION_MIGRATION,
    CHEST_PASS_VARIANT_CONSOLIDATION_MIGRATION,
  ]) {
    assert.match(migration, /skill_level = NULL/)
    assert.doesNotMatch(
      migration,
      /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
    )
    assert.doesNotMatch(
      migration,
      /['"]exerciseSkillLevel(?:Allowed)?['"]\s*[:,]/,
    )
  }

  for (const slug of [
    'dead-bug-wall-press',
    'medicine-ball-dead-bug-press',
    'lateral-hop-to-stick',
    'medicine-ball-chest-pass',
    'med-ball-countermovement-rotational-throw',
  ]) {
    assert.match(
      RESEARCHED_IDENTITY_BOUNDARY_COMPLETION_MIGRATION
        + CHEST_PASS_VARIANT_CONSOLIDATION_MIGRATION,
      new RegExp(slug),
    )
    assert.match(
      BOUNDARY_RELATIONSHIP_DIMENSION_TAXONOMY_MIGRATION,
      new RegExp(slug),
    )
  }

  assert.match(
    RESEARCHED_IDENTITY_BOUNDARY_COMPLETION_MIGRATION,
    /greatest\(seed\.technical_complexity, seed\.physical_difficulty\)/,
  )
  assert.match(
    RESEARCHED_IDENTITY_BOUNDARY_COMPLETION_MIGRATION,
    /ARRAY\['range', 'complexity', 'load'\]::TEXT\[\]/,
  )
  assert.doesNotMatch(
    RESEARCHED_IDENTITY_BOUNDARY_COMPLETION_MIGRATION,
    /ARRAY\['range_or_amplitude', 'coordination', 'physical_difficulty'\]/,
  )
  assert.match(
    BOUNDARY_RELATIONSHIP_DIMENSION_TAXONOMY_MIGRATION,
    /relationship\.review_status <> 'review'/,
  )
  assert.match(
    BOUNDARY_RELATIONSHIP_DIMENSION_TAXONOMY_MIGRATION,
    /requirements_json[\s\S]*'exerciseSkillLevel'[\s\S]*'exerciseSkillLevelAllowed'/,
  )
  assert.match(
    BOUNDARY_RELATIONSHIP_DIMENSION_TAXONOMY_MIGRATION,
    /programming_logic[\s\S]*'exerciseSkillLevel'[\s\S]*'exerciseSkillLevelAllowed'/,
  )
  assert.match(
    BOUNDARY_RELATIONSHIP_DIMENSION_TAXONOMY_MIGRATION,
    /legacy_scores[\s\S]*'exerciseSkillLevel'[\s\S]*'exerciseSkillLevelAllowed'/,
  )

  for (const migration of [
    RESEARCHED_IDENTITY_BOUNDARY_COMPLETION_MIGRATION,
    CHEST_PASS_VARIANT_CONSOLIDATION_MIGRATION,
  ]) {
    assert.match(migration, /approved_video_url = NULL/)
    assert.match(migration, /review_status[\s\S]*'candidate'/)
    assert.doesNotMatch(
      migration,
      /approved_video_url\s*=\s*'https:\/\//,
    )
  }
})

test('Pallof press and step-out migrations preserve exact identities, difficulty-only scoring, and human gates', () => {
  for (const migrationName of [
    '345_coaching_pallof_press_step_out_identity_consolidation.sql',
    '346_coaching_pallof_press_step_out_family_completion.sql',
  ]) {
    assert.match(
      PLATFORM_INIT_TABLES_SOURCE,
      new RegExp(`['"]${migrationName.replaceAll('.', '\\.')}['"]`),
    )
  }

  for (const slug of [
    'pallof-press-pallof-hold',
    'pallof-press-step-out',
    'pallof-press-with-march',
    'half-kneeling-anti-rotation-press-lift-hold',
    'split-stance-anti-rotation-row',
    'tall-kneeling-anti-rotation-pulldown',
    'landmine-anti-rotation-press',
    'mini-band-lateral-walk',
  ]) {
    assert.match(
      PALLOF_PRESS_STEP_OUT_IDENTITY_MIGRATION,
      new RegExp(slug),
    )
  }

  for (const sourceSlug of [
    'anti-rotation-cable-press-out',
    'band-pallof-press',
    'half-kneeling-pallof-press',
    'pallof-press-eccentric-return',
    'pallof-press-reps',
    'partner-pallof-band-hold',
    'split-stance-cable-pallof-iso-hold',
    'split-stance-pallof-press',
    'tall-kneeling-pallof-press-hold',
    'band-anti-rotation-walkout',
    'cable-anti-rotation-step-out',
  ]) {
    assert.match(
      PALLOF_PRESS_STEP_OUT_IDENTITY_MIGRATION,
      new RegExp(sourceSlug),
    )
  }

  assert.match(
    PALLOF_PRESS_STEP_OUT_IDENTITY_MIGRATION,
    /'duplicate_consolidated'/,
  )
  assert.match(
    PALLOF_PRESS_STEP_OUT_IDENTITY_MIGRATION,
    /'distinct_exercises'/,
  )
  assert.match(
    PALLOF_PRESS_STEP_OUT_IDENTITY_MIGRATION,
    /refused to override % protected record/,
  )
  assert.match(
    PALLOF_PRESS_STEP_OUT_COMPLETION_MIGRATION,
    /greatest\(\s*seed\.technical_complexity,\s*seed\.physical_difficulty\s*\)/,
  )
  assert.match(
    PALLOF_PRESS_STEP_OUT_COMPLETION_MIGRATION,
    /'standing-band-repetition'/,
  )
  assert.match(
    PALLOF_PRESS_STEP_OUT_COMPLETION_MIGRATION,
    /'cable-arms-extended-step-out'/,
  )
  assert.match(
    PALLOF_PRESS_STEP_OUT_COMPLETION_MIGRATION,
    /review_status[\s\S]*'candidate'/,
  )
  assert.match(
    PALLOF_PRESS_STEP_OUT_COMPLETION_MIGRATION,
    /"humanApprovalRequired":true/,
  )
  assert.match(
    PALLOF_PRESS_STEP_OUT_COMPLETION_MIGRATION,
    /approved_video_url = NULL/,
  )
  assert.doesNotMatch(
    PALLOF_PRESS_STEP_OUT_COMPLETION_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )

  for (const migration of [
    PALLOF_PRESS_STEP_OUT_IDENTITY_MIGRATION,
    PALLOF_PRESS_STEP_OUT_COMPLETION_MIGRATION,
  ]) {
    assert.match(migration, /skill_level = NULL/)
    assert.doesNotMatch(
      migration,
      /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
    )
    assert.doesNotMatch(
      migration,
      /['"](?:exerciseSkillLevelAllowed|neverUseExerciseSkillLevel|proficiencyClassificationScope)['"]/,
    )
  }
})

test('exercise metadata cleanup removes level classifications without touching skill-library cards', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /['"]347_coaching_exercise_skill_metadata_absence\.sql['"]/,
  )
  for (const forbiddenKey of [
    'skillLevel',
    'skill_level',
    'minimumSkillLevel',
    'minimum_skill_level',
    'proficiencyLevel',
    'proficiency_level',
    'exerciseSkillLevel',
    'exerciseSkillLevelAllowed',
    'exerciseCardSkillLevel',
    'formalProficiencyClassification',
    'proficiencyClassificationScope',
    'skillLevelClassification',
  ]) {
    assert.match(
      EXERCISE_SKILL_METADATA_ABSENCE_MIGRATION,
      new RegExp(`['"]${forbiddenKey}['"]`),
    )
  }
  for (const jsonColumn of [
    'provenance_json',
    'difficulty_json',
    'requirements_json',
    'programming_profile_json',
    'objective_relevance_json',
    'dose_scaling_json',
    'legacy_scores',
    'movement_requirements',
    'programming_logic',
  ]) {
    assert.match(
      EXERCISE_SKILL_METADATA_ABSENCE_MIGRATION,
      new RegExp(jsonColumn),
    )
  }
  for (const protectedTable of [
    'exercise_card_review_v1',
    'exercise_card_revision_v1',
    'exercise_media_review_v1',
  ]) {
    assert.match(
      EXERCISE_SKILL_METADATA_ABSENCE_MIGRATION,
      new RegExp(protectedTable),
    )
  }
  assert.match(
    EXERCISE_SKILL_METADATA_ABSENCE_MIGRATION,
    /skill_level = NULL/,
  )
  assert.match(
    EXERCISE_SKILL_METADATA_ABSENCE_MIGRATION,
    /minimum_skill_level = NULL/,
  )
  assert.match(
    EXERCISE_SKILL_METADATA_ABSENCE_MIGRATION,
    /refused to remove exercise level metadata/,
  )
  assert.doesNotMatch(
    EXERCISE_SKILL_METADATA_ABSENCE_MIGRATION,
    /UPDATE\s+coaching\.skill\b/i,
  )
  assert.doesNotMatch(
    EXERCISE_SKILL_METADATA_ABSENCE_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
})

test('exercise metadata guard recursively blocks proficiency-classification variants at the database boundary', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /['"]350_coaching_exercise_proficiency_metadata_guard\.sql['"]/,
  )
  assert.match(
    EXERCISE_PROFICIENCY_METADATA_GUARD_MIGRATION,
    /exercise_json_has_level_classification/,
  )
  assert.match(
    EXERCISE_PROFICIENCY_METADATA_GUARD_MIGRATION,
    /strip_exercise_level_classification/,
  )
  assert.match(
    EXERCISE_PROFICIENCY_METADATA_GUARD_MIGRATION,
    /skill\[\^a-z0-9\]\*level/,
  )
  assert.match(
    EXERCISE_PROFICIENCY_METADATA_GUARD_MIGRATION,
    /proficiency\[\^a-z0-9\]\*classification/,
  )
  for (const table of [
    'exercise_definition_v1',
    'exercise_variant_v1',
    'exercise_delivery_profile_v1',
    'exercise_score_v1',
    'exercise',
  ]) {
    assert.match(
      EXERCISE_PROFICIENCY_METADATA_GUARD_MIGRATION,
      new RegExp(`ALTER TABLE coaching\\.${table}`),
    )
  }
  assert.match(
    EXERCISE_PROFICIENCY_METADATA_GUARD_MIGRATION,
    /skill_library_levels_before/,
  )
  assert.doesNotMatch(
    EXERCISE_PROFICIENCY_METADATA_GUARD_MIGRATION,
    /UPDATE\s+coaching\.skill\b/i,
  )
})

test('Stir-the-Pot migrations consolidate the duplicate label and preserve difficulty-only human-gated semantics', () => {
  for (const migrationName of [
    '348_coaching_stir_the_pot_identity_consolidation.sql',
    '349_coaching_stir_the_pot_family_completion.sql',
  ]) {
    assert.match(
      PLATFORM_INIT_TABLES_SOURCE,
      new RegExp(`['"]${migrationName.replaceAll('.', '\\.')}['"]`),
    )
  }

  for (const slug of ['stir-the-pot', 'stir-the-pot-plank']) {
    assert.match(STIR_THE_POT_IDENTITY_MIGRATION, new RegExp(slug))
  }
  assert.match(
    STIR_THE_POT_IDENTITY_MIGRATION,
    /'duplicate_consolidated'/,
  )
  assert.match(
    STIR_THE_POT_IDENTITY_MIGRATION,
    /same_stability_ball_circular_plank_action/,
  )
  assert.match(
    STIR_THE_POT_IDENTITY_MIGRATION,
    /refused to override % protected record/,
  )

  for (const variantKey of [
    'knee-supported-small-circles',
    'toe-supported-small-circles',
    'toe-supported-large-circles',
  ]) {
    assert.match(STIR_THE_POT_COMPLETION_MIGRATION, new RegExp(variantKey))
  }
  assert.match(
    STIR_THE_POT_COMPLETION_MIGRATION,
    /greatest\(seed\.exercise_complexity, seed\.physical_difficulty\)/,
  )
  assert.match(
    STIR_THE_POT_COMPLETION_MIGRATION,
    /review_status[\s\S]*'candidate'/,
  )
  assert.match(
    STIR_THE_POT_COMPLETION_MIGRATION,
    /approved_video_url = NULL/,
  )
  assert.doesNotMatch(
    STIR_THE_POT_COMPLETION_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )

  for (const migration of [
    STIR_THE_POT_IDENTITY_MIGRATION,
    STIR_THE_POT_COMPLETION_MIGRATION,
  ]) {
    assert.doesNotMatch(
      migration,
      /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
    )
    assert.doesNotMatch(
      migration,
      /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
    )
  }
})

test('static-control collision migrations consolidate exact synonyms and keep exercise difficulty independent of proficiency', () => {
  for (const migrationName of [
    '351_coaching_static_control_identity_consolidations.sql',
    '352_coaching_static_control_family_completion.sql',
  ]) {
    assert.match(
      PLATFORM_INIT_TABLES_SOURCE,
      new RegExp(`['"]${migrationName.replaceAll('.', '\\.')}['"]`),
    )
  }

  for (const slug of [
    'quadruped-thread-the-needle',
    'quadruped-thread-the-needle-rotation',
    'single-leg-balance-hold-tripod-foot',
    'single-leg-tripod-balance',
    'split-squat-isometric-hold',
    'split-squat-iso-hold',
  ]) {
    assert.match(STATIC_CONTROL_IDENTITY_MIGRATION, new RegExp(slug))
  }
  assert.equal(
    (STATIC_CONTROL_IDENTITY_MIGRATION.match(/'duplicate_consolidated'/g) ?? []).length > 0,
    true,
  )
  assert.match(
    STATIC_CONTROL_IDENTITY_MIGRATION,
    /refused to override % protected record/,
  )

  for (const variantKey of [
    'quadruped-thread-and-open',
    'heel-sit-thread-and-open',
    'supported-eyes-open',
    'unsupported-eyes-open',
    'unsupported-eyes-closed',
    'supported-bodyweight-mid-range',
    'unsupported-bodyweight-mid-range',
    'goblet-loaded-mid-range',
  ]) {
    assert.match(STATIC_CONTROL_COMPLETION_MIGRATION, new RegExp(variantKey))
  }
  assert.match(
    STATIC_CONTROL_COMPLETION_MIGRATION,
    /greatest\(seed\.exercise_complexity, seed\.physical_difficulty\)/,
  )
  assert.match(
    STATIC_CONTROL_COMPLETION_MIGRATION,
    /'lateral_substitution'/,
  )
  assert.match(
    STATIC_CONTROL_COMPLETION_MIGRATION,
    /embedding_allowed = NULL/,
  )
  assert.match(
    STATIC_CONTROL_COMPLETION_MIGRATION,
    /approved_video_url = NULL/,
  )
  assert.match(
    STATIC_CONTROL_COMPLETION_MIGRATION,
    /review_status[\s\S]*'candidate'/,
  )

  for (const migration of [
    STATIC_CONTROL_IDENTITY_MIGRATION,
    STATIC_CONTROL_COMPLETION_MIGRATION,
  ]) {
    assert.doesNotMatch(
      migration,
      /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
    )
    assert.doesNotMatch(
      migration,
      /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
    )
    assert.doesNotMatch(
      migration,
      /approved_video_url\s*=\s*'https:\/\//,
    )
  }
})

test('reactive landing and pogo migrations consolidate duplicate cards without adding exercise proficiency', () => {
  for (const migrationName of [
    '353_coaching_reactive_landing_pogo_identity_consolidations.sql',
    '354_coaching_reactive_landing_pogo_family_completion.sql',
  ]) {
    assert.match(
      PLATFORM_INIT_TABLES_SOURCE,
      new RegExp(`['"]${migrationName.replaceAll('.', '\\.')}['"]`),
    )
  }

  for (const slug of [
    'snap-down-to-stick',
    'snap-down-to-athletic-stick',
    'snapdown-landing-stick',
    'snap-down-to-stick-control-version',
    'mirror-shuffle',
    'mirror-shuffle-drill',
    'partner-mirror-shuffle',
    'sprint-to-stick-deceleration',
    '5-yard-acceleration-decel-stick',
    '5-yard-accel-to-decel-stick',
    'single-leg-pogo',
    'single-leg-pogo-in-place',
    'single-leg-pogo-jumps',
  ]) {
    assert.match(REACTIVE_LANDING_POGO_IDENTITY_MIGRATION, new RegExp(slug))
  }
  assert.match(
    REACTIVE_LANDING_POGO_IDENTITY_MIGRATION,
    /'duplicate_consolidated'/,
  )
  assert.match(
    REACTIVE_LANDING_POGO_IDENTITY_MIGRATION,
    /refused to override % protected record/,
  )

  for (const variantKey of [
    'bilateral-tall-reach-stick',
    'partner-lateral-leader-follower',
    'five-yard-planned-stick',
    'seven-to-ten-yard-planned-stick',
    'supported-stationary-low-amplitude',
    'stationary-low-amplitude',
    'linear-forward-traveling',
    'lateral-line',
  ]) {
    assert.match(REACTIVE_LANDING_POGO_COMPLETION_MIGRATION, new RegExp(variantKey))
  }
  assert.match(
    REACTIVE_LANDING_POGO_COMPLETION_MIGRATION,
    /greatest\(seed\.exercise_complexity, seed\.physical_difficulty\)/,
  )
  assert.match(
    REACTIVE_LANDING_POGO_COMPLETION_MIGRATION,
    /'lateral_substitution'/,
  )
  assert.match(
    REACTIVE_LANDING_POGO_COMPLETION_MIGRATION,
    /embedding_allowed = NULL/,
  )
  assert.match(
    REACTIVE_LANDING_POGO_COMPLETION_MIGRATION,
    /approved_video_url = NULL/,
  )
  assert.match(
    REACTIVE_LANDING_POGO_COMPLETION_MIGRATION,
    /review_status[\s\S]*'candidate'/,
  )

  for (const migration of [
    REACTIVE_LANDING_POGO_IDENTITY_MIGRATION,
    REACTIVE_LANDING_POGO_COMPLETION_MIGRATION,
  ]) {
    assert.doesNotMatch(
      migration,
      /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
    )
    assert.doesNotMatch(
      migration,
      /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
    )
    assert.doesNotMatch(
      migration,
      /approved_video_url\s*=\s*'https:\/\//,
    )
  }
})

test('score-84 identity boundaries remain distinct without adding exercise proficiency', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'355_coaching_score_84_identity_boundaries\.sql'/,
  )

  for (const slug of [
    '180-jump-to-stick',
    '90-degree-jump-turn-to-stick',
    'backpedal-to-sprint-to-stick',
    'backpedal-to-sprint-turn',
    'lateral-hop-to-stick',
    'lateral-quick-step-to-stick',
    'bound-to-stick',
    'curved-bound-to-stick',
    'skater-bound-to-stick',
    'box-jump',
    'countermovement-jump-rebound',
    'broad-jump-to-box-jump',
    'low-box-drop-to-broad-jump',
    'bulgarian-split-squat',
    'front-foot-elevated-split-squat',
    'cossack-squat',
    'landmine-hack-squat',
    'crossover-step-and-go',
    'drop-step-crossover-go',
  ]) {
    assert.match(SCORE_84_IDENTITY_BOUNDARIES_MIGRATION, new RegExp(slug))
  }

  assert.equal(
    [...SCORE_84_IDENTITY_BOUNDARIES_MIGRATION.matchAll(
      /'distinct_exercises'/g,
    )].length,
    4,
  )
  assert.match(
    SCORE_84_IDENTITY_BOUNDARIES_MIGRATION,
    /resolution_source[\s\S]*<> 'human_review'/,
  )
  assert.match(
    SCORE_84_IDENTITY_BOUNDARIES_MIGRATION,
    /'publicationQuarantined', TRUE/,
  )
  assert.match(
    SCORE_84_IDENTITY_BOUNDARIES_MIGRATION,
    /'exercise_complexity_and_physical_difficulty_only'/,
  )
  assert.doesNotMatch(
    SCORE_84_IDENTITY_BOUNDARIES_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    SCORE_84_IDENTITY_BOUNDARIES_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    SCORE_84_IDENTITY_BOUNDARIES_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('drop, depth, and falling-start identities consolidate variants without exercise proficiency', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'356_coaching_drop_depth_falling_start_identity_consolidation\.sql'/,
  )

  for (const slug of [
    'drop-jump',
    'drop-jump-reactive',
    'depth-drop-to-rebound',
    'depth-drop-to-vertical-rebound',
    'low-box-drop-to-vertical-rebound',
    'low-box-drop-to-quarter-squat-rebound',
    'low-box-rebound-jump',
    'depth-jump',
    'depth-jump-to-rebound',
    'depth-jump-to-vertical-jump',
    'falling-start-10m',
    'falling-start-sprint',
    'falling-start-to-10-meters',
    'falling-start-to-10-yards',
    'falling-start-to-5-10-yard-sprint',
    'falling-start-hold',
  ]) {
    assert.match(
      DROP_DEPTH_FALLING_START_IDENTITY_MIGRATION,
      new RegExp(slug),
    )
  }

  assert.match(
    DROP_DEPTH_FALLING_START_IDENTITY_MIGRATION,
    /'duplicate_consolidated'/,
  )
  assert.match(
    DROP_DEPTH_FALLING_START_IDENTITY_MIGRATION,
    /'distinct_exercises'/,
  )
  assert.match(
    DROP_DEPTH_FALLING_START_IDENTITY_MIGRATION,
    /refused to override % protected record/,
  )
  assert.match(
    DROP_DEPTH_FALLING_START_IDENTITY_MIGRATION,
    /resolution_source[\s\S]*<> 'human_review'/,
  )
  assert.match(
    DROP_DEPTH_FALLING_START_IDENTITY_MIGRATION,
    /'publicationQuarantined', TRUE/,
  )
  assert.match(
    DROP_DEPTH_FALLING_START_IDENTITY_MIGRATION,
    /'max_exercise_complexity_physical_difficulty'/,
  )
  assert.doesNotMatch(
    DROP_DEPTH_FALLING_START_IDENTITY_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    DROP_DEPTH_FALLING_START_IDENTITY_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    DROP_DEPTH_FALLING_START_IDENTITY_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('remaining score-84 boundaries resolve mechanics and quarantine underspecified line hops', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'357_coaching_remaining_score_84_identity_boundaries\.sql'/,
  )

  for (const slug of [
    'half-kneeling-cable-chop',
    'half-kneeling-cable-lift',
    'lateral-one-in-shuffle',
    'lateral-two-in-shuffle',
    'one-arm-landmine-arc-press',
    'one-arm-landmine-floor-press',
    'one-arm-landmine-z-press',
    'romanian-deadlift',
    'sandbag-deadlift-strength',
    'single-leg-lateral-hop-to-stick',
    'single-leg-line-hop-and-stick',
  ]) {
    assert.match(REMAINING_SCORE_84_IDENTITY_MIGRATION, new RegExp(slug))
  }

  assert.match(
    REMAINING_SCORE_84_IDENTITY_MIGRATION,
    /'distinct_exercises'/,
  )
  assert.match(
    REMAINING_SCORE_84_IDENTITY_MIGRATION,
    /'needs_human_review'/,
  )
  assert.match(
    REMAINING_SCORE_84_IDENTITY_MIGRATION,
    /legacy_line_hop_takeoff_and_contact_sequence_underspecified/,
  )
  assert.match(
    REMAINING_SCORE_84_IDENTITY_MIGRATION,
    /resolution_source[\s\S]*<> 'human_review'/,
  )
  assert.match(
    REMAINING_SCORE_84_IDENTITY_MIGRATION,
    /'publicationQuarantined', TRUE/,
  )
  assert.doesNotMatch(
    REMAINING_SCORE_84_IDENTITY_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    REMAINING_SCORE_84_IDENTITY_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    REMAINING_SCORE_84_IDENTITY_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('score-84 variants consolidate angle and implement wording without exercise proficiency', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'358_coaching_score_84_variant_identity_consolidations\.sql'/,
  )

  for (const slug of [
    'reactive-hop-to-cut',
    'reactive-45-degree-hop-to-cut',
    'seated-barbell-overhead-press',
    'seated-dumbbell-overhead-press',
  ]) {
    assert.match(SCORE_84_VARIANT_CONSOLIDATIONS_MIGRATION, new RegExp(slug))
  }

  assert.match(
    SCORE_84_VARIANT_CONSOLIDATIONS_MIGRATION,
    /same_cue_driven_hop_landing_to_directional_cut/,
  )
  assert.match(
    SCORE_84_VARIANT_CONSOLIDATIONS_MIGRATION,
    /same_strict_bilateral_seated_vertical_press/,
  )
  assert.match(
    SCORE_84_VARIANT_CONSOLIDATIONS_MIGRATION,
    /"cut_angle"/,
  )
  assert.match(
    SCORE_84_VARIANT_CONSOLIDATIONS_MIGRATION,
    /"implement"/,
  )
  assert.match(
    SCORE_84_VARIANT_CONSOLIDATIONS_MIGRATION,
    /refused to override % protected record/,
  )
  assert.match(
    SCORE_84_VARIANT_CONSOLIDATIONS_MIGRATION,
    /resolution_source[\s\S]*<> 'human_review'/,
  )
  assert.match(
    SCORE_84_VARIANT_CONSOLIDATIONS_MIGRATION,
    /'publicationQuarantined', TRUE/,
  )
  assert.match(
    SCORE_84_VARIANT_CONSOLIDATIONS_MIGRATION,
    /'max_exercise_complexity_physical_difficulty'/,
  )
  assert.doesNotMatch(
    SCORE_84_VARIANT_CONSOLIDATIONS_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    SCORE_84_VARIANT_CONSOLIDATIONS_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    SCORE_84_VARIANT_CONSOLIDATIONS_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('reactive running cut and hop-to-cut remain distinct ordered-contact identities', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'359_coaching_reactive_cut_hop_cut_identity_boundary\.sql'/,
  )
  assert.match(
    REACTIVE_CUT_HOP_CUT_BOUNDARY_MIGRATION,
    /reactive-45-degree-cut/,
  )
  assert.match(
    REACTIVE_CUT_HOP_CUT_BOUNDARY_MIGRATION,
    /reactive-hop-to-cut/,
  )
  assert.match(
    REACTIVE_CUT_HOP_CUT_BOUNDARY_MIGRATION,
    /marked_approach_cut_vs_discrete_hop_landing_to_cut/,
  )
  assert.match(
    REACTIVE_CUT_HOP_CUT_BOUNDARY_MIGRATION,
    /'distinct_exercises'/,
  )
  assert.match(
    REACTIVE_CUT_HOP_CUT_BOUNDARY_MIGRATION,
    /resolution_source[\s\S]*<> 'human_review'/,
  )
  assert.match(
    REACTIVE_CUT_HOP_CUT_BOUNDARY_MIGRATION,
    /'publicationQuarantined', TRUE/,
  )
  assert.match(
    REACTIVE_CUT_HOP_CUT_BOUNDARY_MIGRATION,
    /'exercise_complexity_and_physical_difficulty_only'/,
  )
  assert.doesNotMatch(
    REACTIVE_CUT_HOP_CUT_BOUNDARY_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    REACTIVE_CUT_HOP_CUT_BOUNDARY_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    REACTIVE_CUT_HOP_CUT_BOUNDARY_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('reactive hop-to-cut and seated overhead press completion stays difficulty-only and quarantined', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'360_coaching_reactive_hop_cut_seated_press_completion\.sql'/,
  )
  assert.match(
    REACTIVE_HOP_CUT_SEATED_PRESS_COMPLETION_MIGRATION,
    /'bilateral-hop-reactive-45-cut'/,
  )
  assert.match(
    REACTIVE_HOP_CUT_SEATED_PRESS_COMPLETION_MIGRATION,
    /'bilateral-hop-reactive-90-cut'/,
  )
  assert.match(
    REACTIVE_HOP_CUT_SEATED_PRESS_COMPLETION_MIGRATION,
    /'barbell-unsupported-pronated'/,
  )
  assert.match(
    REACTIVE_HOP_CUT_SEATED_PRESS_COMPLETION_MIGRATION,
    /'barbell-back-supported-pronated'/,
  )
  assert.match(
    REACTIVE_HOP_CUT_SEATED_PRESS_COMPLETION_MIGRATION,
    /'dumbbell-back-supported-neutral'/,
  )
  assert.match(
    REACTIVE_HOP_CUT_SEATED_PRESS_COMPLETION_MIGRATION,
    /'dumbbell-back-supported-pronated'/,
  )
  assert.match(
    REACTIVE_HOP_CUT_SEATED_PRESS_COMPLETION_MIGRATION,
    /greatest\(seed\.exercise_complexity, seed\.physical_difficulty\)/,
  )
  assert.match(
    REACTIVE_HOP_CUT_SEATED_PRESS_COMPLETION_MIGRATION,
    /'max_exercise_complexity_physical_difficulty'/,
  )
  assert.match(
    REACTIVE_HOP_CUT_SEATED_PRESS_COMPLETION_MIGRATION,
    /refused to overwrite % protected record/,
  )
  assert.match(
    REACTIVE_HOP_CUT_SEATED_PRESS_COMPLETION_MIGRATION,
    /'publicationQuarantined', TRUE/,
  )
  assert.match(
    REACTIVE_HOP_CUT_SEATED_PRESS_COMPLETION_MIGRATION,
    /'media_exact_match_candidate_missing'/,
  )
  assert.doesNotMatch(
    REACTIVE_HOP_CUT_SEATED_PRESS_COMPLETION_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    REACTIVE_HOP_CUT_SEATED_PRESS_COMPLETION_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    REACTIVE_HOP_CUT_SEATED_PRESS_COMPLETION_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('hip thrust identity and completion preserve exact variants without exercise proficiency', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'361_coaching_hip_thrust_identity_consolidations\.sql'/,
  )
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'362_coaching_hip_thrust_family_completion\.sql'/,
  )

  for (const slug of [
    'band-hip-thrust',
    'barbell-hip-thrust',
    'hip-thrust-loaded-glute-bridge',
    'sandbag-hip-thrust-strength',
    'single-leg-hip-thrust',
  ]) {
    assert.match(HIP_THRUST_IDENTITY_MIGRATION, new RegExp(slug))
  }
  assert.match(
    HIP_THRUST_IDENTITY_MIGRATION,
    /same_upper_back_supported_hip_extension/,
  )
  assert.match(
    HIP_THRUST_IDENTITY_MIGRATION,
    /feet-elevated-hip-thrust/,
  )
  assert.match(
    HIP_THRUST_IDENTITY_MIGRATION,
    /hip-thrust-eccentric-lower/,
  )
  assert.match(
    HIP_THRUST_IDENTITY_MIGRATION,
    /'needs_human_review'/,
  )
  assert.match(
    HIP_THRUST_IDENTITY_MIGRATION,
    /conflicts with protected identity decision/,
  )
  assert.match(
    HIP_THRUST_IDENTITY_MIGRATION,
    /'publicationQuarantined', TRUE/,
  )

  for (const variantKey of [
    'bodyweight-bilateral-upper-back-supported',
    'barbell-bilateral-upper-back-supported',
    'band-bilateral-upper-back-supported',
    'dumbbell-bilateral-upper-back-supported',
    'kettlebell-bilateral-upper-back-supported',
    'plate-bilateral-upper-back-supported',
    'sandbag-bilateral-upper-back-supported',
    'bodyweight-single-leg-upper-back-supported',
  ]) {
    assert.match(HIP_THRUST_COMPLETION_MIGRATION, new RegExp(variantKey))
  }
  assert.match(
    HIP_THRUST_COMPLETION_MIGRATION,
    /greatest\(seed\.complexity, seed\.physical\)/,
  )
  assert.match(
    HIP_THRUST_COMPLETION_MIGRATION,
    /'max_exercise_complexity_physical_difficulty'/,
  )
  assert.match(
    HIP_THRUST_COMPLETION_MIGRATION,
    /refused to overwrite % protected record/,
  )
  assert.match(
    HIP_THRUST_COMPLETION_MIGRATION,
    /'media_human_review_required'/,
  )
  assert.match(
    HIP_THRUST_COMPLETION_MIGRATION,
    /'identity_boundary_human_review_required'/,
  )

  for (const migration of [
    HIP_THRUST_IDENTITY_MIGRATION,
    HIP_THRUST_COMPLETION_MIGRATION,
  ]) {
    assert.doesNotMatch(
      migration,
      /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
    )
    assert.doesNotMatch(
      migration,
      /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
    )
    assert.doesNotMatch(
      migration,
      /approved_video_url\s*=\s*'https:\/\//,
    )
  }
})

test('ball-drop identity cluster consolidates the exact chase-and-catch duplicate without exercise proficiency', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'363_coaching_ball_drop_identity_cluster\.sql'/,
  )
  assert.match(
    BALL_DROP_IDENTITY_CLUSTER_MIGRATION,
    /partner-tennis-ball-drop-sprint/,
  )
  assert.match(
    BALL_DROP_IDENTITY_CLUSTER_MIGRATION,
    /same_live_ball_drop_chase_capture_and_reset/,
  )
  for (const distinctSlug of [
    'ball-drop-point-and-sprint-cone-reaction',
    'reaction-ball-drop-to-hop-and-go',
    'ball-drop-sprint-plus-direction-cue',
    'reaction-ball-drop-catch-to-cut',
    'gate-reaction-drill',
  ]) {
    assert.match(
      BALL_DROP_IDENTITY_CLUSTER_MIGRATION,
      new RegExp(distinctSlug),
    )
  }
  assert.match(
    BALL_DROP_IDENTITY_CLUSTER_MIGRATION,
    /'duplicate_consolidated'/,
  )
  assert.match(
    BALL_DROP_IDENTITY_CLUSTER_MIGRATION,
    /'distinct_exercises'/,
  )
  assert.match(
    BALL_DROP_IDENTITY_CLUSTER_MIGRATION,
    /refused to override % protected record/,
  )
  assert.match(
    BALL_DROP_IDENTITY_CLUSTER_MIGRATION,
    /'max_exercise_complexity_physical_difficulty'/,
  )
  assert.match(
    BALL_DROP_IDENTITY_CLUSTER_MIGRATION,
    /'publicationQuarantined', TRUE/,
  )
  assert.doesNotMatch(
    BALL_DROP_IDENTITY_CLUSTER_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    BALL_DROP_IDENTITY_CLUSTER_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    BALL_DROP_IDENTITY_CLUSTER_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('ball-drop compound cards preserve different ordered actions without exercise proficiency', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'364_coaching_ball_drop_compound_identity_boundary\.sql'/,
  )
  assert.match(
    BALL_DROP_COMPOUND_BOUNDARY_MIGRATION,
    /reaction-ball-drop-catch-to-cut/,
  )
  assert.match(
    BALL_DROP_COMPOUND_BOUNDARY_MIGRATION,
    /reaction-ball-drop-to-hop-and-go/,
  )
  assert.match(
    BALL_DROP_COMPOUND_BOUNDARY_MIGRATION,
    /capture_then_called_cut_vs_hop_contact_then_acceleration/,
  )
  assert.match(
    BALL_DROP_COMPOUND_BOUNDARY_MIGRATION,
    /'distinct_exercises'/,
  )
  assert.match(
    BALL_DROP_COMPOUND_BOUNDARY_MIGRATION,
    /conflicts with protected identity decision/,
  )
  assert.match(
    BALL_DROP_COMPOUND_BOUNDARY_MIGRATION,
    /'max_exercise_complexity_physical_difficulty'/,
  )
  assert.doesNotMatch(
    BALL_DROP_COMPOUND_BOUNDARY_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    BALL_DROP_COMPOUND_BOUNDARY_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    BALL_DROP_COMPOUND_BOUNDARY_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('ball-drop chase-and-catch completion uses difficulty-only exact variants and human gates', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'365_coaching_ball_drop_chase_catch_completion\.sql'/,
  )
  for (const variantKey of [
    'tennis-ball-partner-drop-catch',
    'reaction-ball-partner-drop-secure',
  ]) {
    assert.match(BALL_DROP_COMPLETION_MIGRATION, new RegExp(variantKey))
  }
  assert.match(
    BALL_DROP_COMPLETION_MIGRATION,
    /greatest\(seed\.complexity, seed\.physical\)/,
  )
  assert.match(
    BALL_DROP_COMPLETION_MIGRATION,
    /'max_exercise_complexity_physical_difficulty'/,
  )
  assert.match(
    BALL_DROP_COMPLETION_MIGRATION,
    /'movement-intelligence-technique','movement_intelligence'/,
  )
  assert.match(
    BALL_DROP_COMPLETION_MIGRATION,
    /'output-reactive-acceleration','output'/,
  )
  assert.match(
    BALL_DROP_COMPLETION_MIGRATION,
    /'lateral_substitution'/,
  )
  assert.match(
    BALL_DROP_COMPLETION_MIGRATION,
    /refused to overwrite % protected record/,
  )
  assert.match(
    BALL_DROP_COMPLETION_MIGRATION,
    /'media_human_review_required'/,
  )
  assert.match(
    BALL_DROP_COMPLETION_MIGRATION,
    /'athlete_comprehension_pilot_required'/,
  )
  assert.doesNotMatch(
    BALL_DROP_COMPLETION_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    BALL_DROP_COMPLETION_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    BALL_DROP_COMPLETION_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('alternating-bounds identity consolidation preserves one stable exercise without proficiency', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'366_coaching_alternating_bounds_identity_consolidation\.sql'/,
  )
  assert.match(
    ALTERNATING_BOUNDS_IDENTITY_MIGRATION,
    /alternate-leg-bound-for-distance/,
  )
  assert.match(
    ALTERNATING_BOUNDS_IDENTITY_MIGRATION,
    /alternate-bounds-for-height-and-distance/,
  )
  assert.match(
    ALTERNATING_BOUNDS_IDENTITY_MIGRATION,
    /'duplicate_consolidated'/,
  )
  assert.match(
    ALTERNATING_BOUNDS_IDENTITY_MIGRATION,
    /refused to override % protected record/,
  )
  assert.match(
    ALTERNATING_BOUNDS_IDENTITY_MIGRATION,
    /'max_exercise_complexity_physical_difficulty'/,
  )
  assert.match(
    ALTERNATING_BOUNDS_IDENTITY_MIGRATION,
    /'publicationQuarantined', TRUE/,
  )
  assert.doesNotMatch(
    ALTERNATING_BOUNDS_IDENTITY_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    ALTERNATING_BOUNDS_IDENTITY_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    ALTERNATING_BOUNDS_IDENTITY_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('alternating-bounds completion models exercise difficulty and keeps approvals human-gated', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'367_coaching_alternating_bounds_family_completion\.sql'/,
  )
  for (const variantKey of [
    'traditional-height-distance',
    'sprint-bound-distance',
  ]) {
    assert.match(ALTERNATING_BOUNDS_COMPLETION_MIGRATION, new RegExp(variantKey))
  }
  assert.match(
    ALTERNATING_BOUNDS_COMPLETION_MIGRATION,
    /greatest\(seed\.complexity, seed\.physical\)/,
  )
  assert.match(
    ALTERNATING_BOUNDS_COMPLETION_MIGRATION,
    /'max_exercise_complexity_physical_difficulty'/,
  )
  assert.match(
    ALTERNATING_BOUNDS_COMPLETION_MIGRATION,
    /'movement-intelligence-technique','movement_intelligence'/,
  )
  assert.match(
    ALTERNATING_BOUNDS_COMPLETION_MIGRATION,
    /'output-horizontal-power','output'/,
  )
  assert.match(
    ALTERNATING_BOUNDS_COMPLETION_MIGRATION,
    /link_status = 'mismatched'/,
  )
  for (const videoId of [
    'eIjuMzIFREs',
    'b3124L0KK3Q',
    'LwsQ-AGc8JU',
    'bIUl_AsST0c',
    'NgclB0lb5DA',
  ]) {
    assert.match(ALTERNATING_BOUNDS_COMPLETION_MIGRATION, new RegExp(videoId))
  }
  assert.match(
    ALTERNATING_BOUNDS_COMPLETION_MIGRATION,
    /refused to overwrite % protected record/,
  )
  assert.match(
    ALTERNATING_BOUNDS_COMPLETION_MIGRATION,
    /'media_human_review_required'/,
  )
  assert.match(
    ALTERNATING_BOUNDS_COMPLETION_MIGRATION,
    /'calibration_human_review_required'/,
  )
  assert.doesNotMatch(
    ALTERNATING_BOUNDS_COMPLETION_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    ALTERNATING_BOUNDS_COMPLETION_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    ALTERNATING_BOUNDS_COMPLETION_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('remaining alternating-bounds aliases consolidate without proficiency or fabricated review', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'368_coaching_remaining_alternating_bounds_identity_consolidations\.sql'/,
  )
  assert.match(
    REMAINING_ALTERNATING_BOUNDS_IDENTITY_MIGRATION,
    /alternate-leg-bound-for-distance/,
  )
  assert.match(
    REMAINING_ALTERNATING_BOUNDS_IDENTITY_MIGRATION,
    /alternating-bounds-for-height/,
  )
  assert.match(
    REMAINING_ALTERNATING_BOUNDS_IDENTITY_MIGRATION,
    /'alternating-bounds'/,
  )
  for (const videoId of [
    '1pfCX540xz4',
    'Hnf_4gSkXtg',
    'I7ChaipZVM4',
    'LMOrbWBhyMs',
    'X0dZBSroHDg',
  ]) {
    assert.match(
      REMAINING_ALTERNATING_BOUNDS_IDENTITY_MIGRATION,
      new RegExp(videoId),
    )
  }
  assert.match(
    REMAINING_ALTERNATING_BOUNDS_IDENTITY_MIGRATION,
    /link_status = 'mismatched'/,
  )
  assert.match(
    REMAINING_ALTERNATING_BOUNDS_IDENTITY_MIGRATION,
    /refused to override % protected record/,
  )
  assert.doesNotMatch(
    REMAINING_ALTERNATING_BOUNDS_IDENTITY_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    REMAINING_ALTERNATING_BOUNDS_IDENTITY_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    REMAINING_ALTERNATING_BOUNDS_IDENTITY_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('split-squat identity cluster consolidates load variants and preserves support boundaries', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'369_coaching_split_squat_identity_cluster\.sql'/,
  )
  for (const duplicateSlug of [
    'barbell-split-squat',
    'bodyweight-split-squat',
    'front-rack-kettlebell-split-squat',
    'sandbag-split-squat-strength',
    'slow-eccentric-split-squat',
    'split-squat-eccentric-to-pause',
    'landmine-handle-grip-split-squat',
  ]) {
    assert.match(SPLIT_SQUAT_IDENTITY_MIGRATION, new RegExp(duplicateSlug))
  }
  for (const boundarySlug of [
    'bulgarian-split-squat',
    'single-kettlebell-front-rack-squat',
    'bodyweight-box-squat',
    'split-squat-jump',
    'split-squat-jump-to-stick',
  ]) {
    assert.match(SPLIT_SQUAT_IDENTITY_MIGRATION, new RegExp(boundarySlug))
  }
  assert.match(
    SPLIT_SQUAT_IDENTITY_MIGRATION,
    /rear_foot_floor_support_vs_rear_foot_elevation/,
  )
  assert.match(
    SPLIT_SQUAT_IDENTITY_MIGRATION,
    /'duplicate_consolidated'/,
  )
  assert.match(
    SPLIT_SQUAT_IDENTITY_MIGRATION,
    /'distinct_exercises'/,
  )
  assert.match(
    SPLIT_SQUAT_IDENTITY_MIGRATION,
    /'needs_human_review'/,
  )
  assert.match(
    SPLIT_SQUAT_IDENTITY_MIGRATION,
    /protected record/,
  )
  assert.doesNotMatch(
    SPLIT_SQUAT_IDENTITY_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    SPLIT_SQUAT_IDENTITY_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    SPLIT_SQUAT_IDENTITY_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('split-squat family completion uses difficulty-only variants and human review gates', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'370_coaching_split_squat_family_completion\.sql'/,
  )
  for (const variantKey of [
    'supported-bodyweight-standard',
    'bodyweight-standard',
    'two-dumbbell-suitcase',
    'barbell-back-rack',
    'single-kettlebell-front-rack',
    'double-kettlebell-front-rack',
    'sandbag-front-hold',
    'bodyweight-slow-eccentric-pause',
    'supported-bodyweight-rear-foot-elevated',
    'bodyweight-rear-foot-elevated',
    'two-dumbbell-suitcase-rear-foot-elevated',
    'barbell-back-rack-rear-foot-elevated',
    'single-kettlebell-goblet-rear-foot-elevated',
    'bodyweight-slow-eccentric-pause-rear-foot-elevated',
  ]) {
    assert.match(SPLIT_SQUAT_COMPLETION_MIGRATION, new RegExp(variantKey))
  }
  assert.match(
    SPLIT_SQUAT_COMPLETION_MIGRATION,
    /greatest\(seed\.exercise_complexity, seed\.physical_difficulty\)/,
  )
  assert.match(
    SPLIT_SQUAT_COMPLETION_MIGRATION,
    /'max_exercise_complexity_physical_difficulty'/,
  )
  assert.match(
    SPLIT_SQUAT_COMPLETION_MIGRATION,
    /'capacity-strength', 'capacity'/,
  )
  assert.match(
    SPLIT_SQUAT_COMPLETION_MIGRATION,
    /'resilience-control', 'resilience'/,
  )
  assert.match(
    SPLIT_SQUAT_COMPLETION_MIGRATION,
    /refused to overwrite % protected record/,
  )
  assert.match(
    SPLIT_SQUAT_COMPLETION_MIGRATION,
    /'media_human_review_required'/,
  )
  assert.match(
    SPLIT_SQUAT_COMPLETION_MIGRATION,
    /'calibration_human_review_required'/,
  )
  assert.match(
    SPLIT_SQUAT_COMPLETION_MIGRATION,
    /review_status[\s\S]*'candidate'/,
  )
  assert.match(
    SPLIT_SQUAT_COMPLETION_MIGRATION,
    /review_status[\s\S]*'review'/,
  )
  assert.doesNotMatch(
    SPLIT_SQUAT_COMPLETION_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    SPLIT_SQUAT_COMPLETION_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    SPLIT_SQUAT_COMPLETION_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('score-83 identity adjudication preserves mechanical boundaries and quarantines ambiguity', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'371_coaching_score_83_identity_boundaries\.sql'/,
  )
  for (const boundary of [
    'quadruped_knee_hover_vs_long_lever_prone_support',
    'unobstructed_lateral_jump_vs_required_hurdle_clearance',
    'external_box_contact_vs_unsupported_bottom_pause',
    'unsupported_inverted_balance_vs_wall_supported_inversion',
    'bound_then_capture_then_throw_vs_throw_then_lateral_bound',
    'dynamic_dead_start_squat_vs_overcoming_isometric_against_pins',
    'supported_seated_press_vs_standing_whole_body_braced_press',
    'straight_leg_bound_sequence_vs_bound_to_sprint_transition',
    'angled_press_only_vs_squat_drive_to_press',
  ]) {
    assert.match(SCORE_83_IDENTITY_BOUNDARIES_MIGRATION, new RegExp(boundary))
  }
  for (const ambiguousPair of [
    'bound-to-stick',
    'dumbbell-overhead-press-eccentric',
    'landmine-press',
  ]) {
    assert.match(
      SCORE_83_IDENTITY_BOUNDARIES_MIGRATION,
      new RegExp(ambiguousPair),
    )
  }
  assert.match(
    SCORE_83_IDENTITY_BOUNDARIES_MIGRATION,
    /'needs_human_review'/,
  )
  assert.match(
    SCORE_83_IDENTITY_BOUNDARIES_MIGRATION,
    /'distinct_exercises'/,
  )
  assert.match(
    SCORE_83_IDENTITY_BOUNDARIES_MIGRATION,
    /exercise_complexity_and_physical_difficulty_only/,
  )
  assert.doesNotMatch(
    SCORE_83_IDENTITY_BOUNDARIES_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    SCORE_83_IDENTITY_BOUNDARIES_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    SCORE_83_IDENTITY_BOUNDARIES_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('score-83 variant duplicates consolidate without proficiency or fabricated approvals', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'372_coaching_score_83_variant_identity_consolidations\.sql'/,
  )
  for (const duplicateSlug of [
    'double-pogo-to-box-jump',
    'feet-elevated-ring-row-strength',
    'sliding-hamstring-curl-eccentric',
    'landmine-ball-grip-squat-to-press',
    'landmine-hinge-to-row',
    'skater-bound-to-stick',
    'low-hurdle-quick-hop',
    'wall-ball-shot-put-throw-to-wall',
    'repeated-broad-jump-elastic',
    'wall-facing-handstand-hold',
  ]) {
    assert.match(
      SCORE_83_VARIANT_CONSOLIDATIONS_MIGRATION,
      new RegExp(duplicateSlug),
    )
  }
  assert.match(
    SCORE_83_VARIANT_CONSOLIDATIONS_MIGRATION,
    /'duplicate_consolidated'/,
  )
  assert.match(
    SCORE_83_VARIANT_CONSOLIDATIONS_MIGRATION,
    /refused to override % protected record/,
  )
  assert.match(
    SCORE_83_VARIANT_CONSOLIDATIONS_MIGRATION,
    /max_exercise_complexity_physical_difficulty/,
  )
  assert.doesNotMatch(
    SCORE_83_VARIANT_CONSOLIDATIONS_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    SCORE_83_VARIANT_CONSOLIDATIONS_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    SCORE_83_VARIANT_CONSOLIDATIONS_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('score-82 identity adjudication preserves action boundaries and quarantines missing facts', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'375_coaching_score_82_identity_boundaries\.sql'/,
  )
  for (const boundary of [
    'sprint_only_vs_pogo_contacts_then_sprint',
    'half_turn_rotation_vs_sagittal_tuck_in_flight',
    'supine_horizontal_press_vs_floor_seated_vertical_press',
    'direct_bound_entry_vs_carioca_crossover_approach_then_bound',
    'dynamic_squat_repetitions_vs_fixed_bottom_isometric',
    'ballistic_hand_flight_and_landing_vs_continuous_controlled_support',
    'bilateral_hinge_vs_unilateral_support_hinge',
    'active_floor_takeoff_vs_elevated_step_off_without_takeoff',
    'wall_supported_switch_repetitions_vs_wall_switch_then_free_acceleration',
  ]) {
    assert.match(SCORE_82_IDENTITY_BOUNDARIES_MIGRATION, new RegExp(boundary))
  }
  assert.match(
    SCORE_82_IDENTITY_BOUNDARIES_MIGRATION,
    /line_hop_source_does_not_declare_direction_contact_count_or_line_crossing/,
  )
  assert.match(
    SCORE_82_IDENTITY_BOUNDARIES_MIGRATION,
    /'needs_human_review'/,
  )
  assert.match(
    SCORE_82_IDENTITY_BOUNDARIES_MIGRATION,
    /found archived endpoint without matching decision/,
  )
  assert.match(
    SCORE_82_IDENTITY_BOUNDARIES_MIGRATION,
    /exercise_complexity_and_physical_difficulty_only/,
  )
  assert.doesNotMatch(
    SCORE_82_IDENTITY_BOUNDARIES_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    SCORE_82_IDENTITY_BOUNDARIES_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    SCORE_82_IDENTITY_BOUNDARIES_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('score-82 variant duplicates consolidate as quarantined variants without proficiency', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'376_coaching_score_82_variant_identity_consolidations\.sql'/,
  )
  for (const duplicateSlug of [
    'sandbag-good-morning-strength',
    'seated-soleus-raise-bent-knee-calf-raise',
    'dumbbell-bent-over-row',
    'clock-reach-balance',
    'close-grip-dumbbell-floor-press',
    'copenhagen-plank-long-lever',
    'countermovement-jump-to-stick',
    'deep-squat-jump-to-box',
    'kettlebell-crush-grip-floor-press',
    'dumbbell-bench-press-eccentric',
    'kettlebell-z-press',
    'flying-20',
    'heels-elevated-goblet-squat',
    'medicine-ball-hollow-body-hold',
    'kettlebell-suitcase-deadlift',
    'low-box-step-off-to-horizontal-stick',
    'moving-target-medicine-ball-chest-pass',
    'medicine-ball-front-rack-breathing-squat',
    'single-leg-balance-reach-clock-control',
  ]) {
    assert.match(
      SCORE_82_VARIANT_CONSOLIDATIONS_MIGRATION,
      new RegExp(duplicateSlug),
    )
  }
  assert.match(
    SCORE_82_VARIANT_CONSOLIDATIONS_MIGRATION,
    /'duplicate_consolidated'/,
  )
  assert.match(
    SCORE_82_VARIANT_CONSOLIDATIONS_MIGRATION,
    /refused to override % protected record/,
  )
  assert.match(
    SCORE_82_VARIANT_CONSOLIDATIONS_MIGRATION,
    /status = 'archived'/,
  )
  assert.match(
    SCORE_82_VARIANT_CONSOLIDATIONS_MIGRATION,
    /max_exercise_complexity_physical_difficulty/,
  )
  assert.doesNotMatch(
    SCORE_82_VARIANT_CONSOLIDATIONS_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    SCORE_82_VARIANT_CONSOLIDATIONS_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    SCORE_82_VARIANT_CONSOLIDATIONS_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('score-81 identity adjudication resolves mechanics and quarantines underspecified sources', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'377_coaching_score_81_identity_boundaries\.sql'/,
  )
  for (const boundary of [
    'reactive_chase_to_late_target_vs_predeclared_compass_route',
    'asymmetric_vertical_pull_vs_asymmetric_horizontal_push',
    'required_box_contact_vs_unsupported_front_loaded_squat',
    'forward_fall_triggered_start_vs_static_two_point_start',
    'ballistic_reactive_hurdle_contacts_vs_controlled_step_over_contacts',
    'downward_floor_slam_vs_forward_overhead_release',
    'floor_seated_angled_press_vs_square_standing_angled_press',
    'floor_takeoff_to_floor_landing_vs_floor_takeoff_to_elevated_box_landing',
  ]) {
    assert.match(SCORE_81_IDENTITY_BOUNDARIES_MIGRATION, new RegExp(boundary))
  }
  for (const ambiguousBoundary of [
    'sumo_source_does_not_declare_dumbbell_load_position',
    'generic_line_pogo_source_does_not_declare_crossing_direction',
    'arc_press_source_does_not_declare_support_stance',
    'line_hop_sources_do_not_jointly_declare_direction_or_contact_contract',
  ]) {
    assert.match(
      SCORE_81_IDENTITY_BOUNDARIES_MIGRATION,
      new RegExp(ambiguousBoundary),
    )
  }
  assert.match(
    SCORE_81_IDENTITY_BOUNDARIES_MIGRATION,
    /found archived endpoint without matching decision/,
  )
  assert.match(
    SCORE_81_IDENTITY_BOUNDARIES_MIGRATION,
    /exercise_complexity_and_physical_difficulty_only/,
  )
  assert.doesNotMatch(
    SCORE_81_IDENTITY_BOUNDARIES_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    SCORE_81_IDENTITY_BOUNDARIES_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    SCORE_81_IDENTITY_BOUNDARIES_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('score-81 variant duplicates consolidate as archived exact variants without proficiency', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'378_coaching_score_81_variant_identity_consolidations\.sql'/,
  )
  for (const duplicateSlug of [
    '5-10-5-pro-agility-shuttle',
    'barbell-t-bar-row',
    'box-pike-handstand-push-up',
    'chest-to-wall-handstand-hold',
    'med-ball-countermovement-rotational-throw',
    'tempo-front-squat',
    'kettlebell-goblet-squat-iso-hold',
    'lateral-lunge-shift',
    'shuffle-to-stick',
    'low-cone-hop-to-stick',
    'one-arm-eccentric-landmine-press',
    'pistol-squat-to-box',
    'reverse-lunge-negative',
    'sprint-to-balance-deceleration',
    'switch-step-up-jump',
  ]) {
    assert.match(
      SCORE_81_VARIANT_CONSOLIDATIONS_MIGRATION,
      new RegExp(duplicateSlug),
    )
  }
  assert.match(
    SCORE_81_VARIANT_CONSOLIDATIONS_MIGRATION,
    /'duplicate_consolidated'/,
  )
  assert.match(
    SCORE_81_VARIANT_CONSOLIDATIONS_MIGRATION,
    /refused to override % protected record/,
  )
  assert.match(
    SCORE_81_VARIANT_CONSOLIDATIONS_MIGRATION,
    /max_exercise_complexity_physical_difficulty/,
  )
  assert.doesNotMatch(
    SCORE_81_VARIANT_CONSOLIDATIONS_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    SCORE_81_VARIANT_CONSOLIDATIONS_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    SCORE_81_VARIANT_CONSOLIDATIONS_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('score-80 identity adjudication resolves ordered mechanics and quarantines underspecified line hops', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'379_coaching_score_80_identity_boundaries\.sql'/,
  )
  for (const boundary of [
    'progressively_faster_three_zone_run_vs_fast_float_fast_reacceleration',
    'backward_entry_to_forward_sprint_vs_forward_entry_to_backward_run',
    'rapid_descent_to_bilateral_landing_shape_without_takeoff_vs_vertical_jump_and_landing',
    'dynamic_barbell_bench_press_repetitions_vs_overcoming_pin_isometric',
    'supine_bench_horizontal_press_vs_floor_seated_vertical_press',
    'press_out_while_resisting_trunk_rotation_vs_loaded_rotational_arc',
    'ladder_inside_outside_footwork_pattern_vs_cone_shuffle_then_braking_stick',
    'approach_broad_jump_to_floor_stick_vs_broad_rebound_into_box_jump',
    'dynamic_wall_pressure_release_balance_drill_vs_static_wall_supported_hold',
  ]) {
    assert.match(SCORE_80_IDENTITY_BOUNDARIES_MIGRATION, new RegExp(boundary))
  }
  assert.match(
    SCORE_80_IDENTITY_BOUNDARIES_MIGRATION,
    /line_hop_sources_do_not_declare_matching_direction_or_crossing_contract/,
  )
  assert.match(
    SCORE_80_IDENTITY_BOUNDARIES_MIGRATION,
    /found archived endpoint without matching decision/,
  )
  assert.match(
    SCORE_80_IDENTITY_BOUNDARIES_MIGRATION,
    /exercise_complexity_and_physical_difficulty_only/,
  )
  assert.doesNotMatch(
    SCORE_80_IDENTITY_BOUNDARIES_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    SCORE_80_IDENTITY_BOUNDARIES_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    SCORE_80_IDENTITY_BOUNDARIES_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('score-80 variant duplicates consolidate under stable cards without exercise proficiency', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'380_coaching_score_80_variant_identity_consolidations\.sql'/,
  )
  for (const duplicateSlug of [
    'two-point-start-to-5-10-yard-sprint',
    'assisted-pistol-squat',
    'low-bar-back-squat',
    'pause-back-squat',
    'tempo-back-squat',
    'bench-pin-press',
    'dumbbell-bench-press',
    'paused-bench-press',
    'depth-drop-to-horizontal-rebound',
    'ring-row-trx-row',
    'sandbag-zercher-squat-strength',
    'single-leg-rdl-negative',
    'tibialis-iso-toe-up-hold',
    'worlds-greatest-stretch-with-rotation',
  ]) {
    assert.match(
      SCORE_80_VARIANT_CONSOLIDATIONS_MIGRATION,
      new RegExp(duplicateSlug),
    )
  }
  assert.match(
    SCORE_80_VARIANT_CONSOLIDATIONS_MIGRATION,
    /same_barbell_bench_press_with_pin_height_and_dead_start_variant/,
  )
  assert.match(
    SCORE_80_VARIANT_CONSOLIDATIONS_MIGRATION,
    /THEN 'Bench Press'/,
  )
  assert.match(
    SCORE_80_VARIANT_CONSOLIDATIONS_MIGRATION,
    /'duplicate_consolidated'/,
  )
  assert.match(
    SCORE_80_VARIANT_CONSOLIDATIONS_MIGRATION,
    /refused to override % protected record/,
  )
  assert.match(
    SCORE_80_VARIANT_CONSOLIDATIONS_MIGRATION,
    /max_exercise_complexity_physical_difficulty/,
  )
  assert.doesNotMatch(
    SCORE_80_VARIANT_CONSOLIDATIONS_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    SCORE_80_VARIANT_CONSOLIDATIONS_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    SCORE_80_VARIANT_CONSOLIDATIONS_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('score-79 identity adjudication preserves mechanical boundaries and quarantines missing facts', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'381_coaching_score_79_identity_boundaries\.sql'/,
  )
  for (const boundary of [
    'alternating_skip_contacts_vs_bilateral_lateral_hops',
    'supported_squat_to_box_vs_barbell_held_behind_legs',
    'bench_supported_prone_row_vs_unsupported_standing_hinge_row',
    'bilateral_lateral_jump_vs_unilateral_hop_family',
    'reactive_cut_and_exit_vs_reactive_reach_or_touch',
    'isometric_resistance_to_rotation_vs_intentional_rotation_and_press',
    'declared_ball_grip_interface_vs_declared_drop_step_approach_sequence',
    'split_stance_press_with_declared_rotation_vs_fixed_split_stance_press',
    'continuous_incline_press_vs_ballistic_hand_release_press',
    'transverse_two_hand_rotation_vs_sagittal_low_to_high_scoop_projection',
    'elevated_step_off_ground_contact_vs_self_initiated_rapid_descent',
    'ball_grip_isometric_anti_rotation_vs_ball_grip_dynamic_rotation_and_press',
    'two_hand_rotational_projection_vs_single_arm_shot_put_projection',
    'repeated_ankle_dominant_contacts_vs_pogos_feeding_terminal_box_jump',
  ]) {
    assert.match(SCORE_79_IDENTITY_BOUNDARIES_MIGRATION, new RegExp(boundary))
  }
  for (const missingFactBoundary of [
    'quarter_turn_cards_do_not_declare_takeoff_or_landing_laterality',
    'countermovement_source_declares_rotation_but_not_projection_or_arm_contract',
    'arc_press_source_does_not_declare_whether_arc_is_path_or_eccentric_only_variant',
    'hurdle_source_does_not_declare_takeoff_or_landing_foot_count',
    'bound_source_does_not_declare_unilateral_or_bilateral_takeoff_and_landing',
  ]) {
    assert.match(
      SCORE_79_IDENTITY_BOUNDARIES_MIGRATION,
      new RegExp(missingFactBoundary),
    )
  }
  assert.match(
    SCORE_79_IDENTITY_BOUNDARIES_MIGRATION,
    /found archived endpoint without matching decision/,
  )
  assert.match(
    SCORE_79_IDENTITY_BOUNDARIES_MIGRATION,
    /exercise_complexity_and_physical_difficulty_only/,
  )
  assert.doesNotMatch(
    SCORE_79_IDENTITY_BOUNDARIES_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    SCORE_79_IDENTITY_BOUNDARIES_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    SCORE_79_IDENTITY_BOUNDARIES_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('score-79 variants consolidate under general identities with exact dimensions', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'382_coaching_score_79_variant_identity_consolidations\.sql'/,
  )
  for (const duplicateSlug of [
    'band-ninety-ninety-external-rotation-activation',
    'barbell-box-squat',
    'double-kettlebell-bent-over-row',
    'sandbag-bent-over-row-strength',
    'chin-up-isometric-hold',
    'copenhagen-plank-short-lever',
    'kettlebell-alternating-floor-press',
    'dynamic-leg-swing-lateral',
    'reverse-icky-shuffle',
    'incline-plyo-push-up',
    'lateral-lunge-negative',
    'low-box-drop-to-stick',
    'med-ball-rebound-rotational-catch-and-throw',
    'medicine-ball-rotational-scoop-toss',
    'medicine-ball-rotational-shot-put',
    'partner-medicine-ball-shot-put-pass',
    'split-stance-medicine-ball-shot-put-pass',
    'push-up-start-10m',
    'sandbag-zercher-carry-strength',
    'single-leg-hop-to-stick-low-amplitude',
    'single-leg-rdl-reach-bodyweight-control',
    'snap-down-to-low-vertical-rebound',
    'sprinter-step-up-jump',
    'three-point-acceleration-build-up',
    'wall-drill-iso-lean-march',
  ]) {
    assert.match(
      SCORE_79_VARIANT_CONSOLIDATIONS_MIGRATION,
      new RegExp(duplicateSlug),
    )
  }
  assert.match(
    SCORE_79_VARIANT_CONSOLIDATIONS_MIGRATION,
    /same_unsupported_standing_hinge_row_with_implement_variant/,
  )
  assert.match(
    SCORE_79_VARIANT_CONSOLIDATIONS_MIGRATION,
    /same_single_arm_shot_put_throw_with_rotational_entry_variant/,
  )
  assert.match(
    SCORE_79_VARIANT_CONSOLIDATIONS_MIGRATION,
    /same_three_point_start_acceleration_with_build_up_intent_variant/,
  )
  assert.match(
    SCORE_79_VARIANT_CONSOLIDATIONS_MIGRATION,
    /'Bent-Over Row'/,
  )
  assert.match(
    SCORE_79_VARIANT_CONSOLIDATIONS_MIGRATION,
    /'Pull-Up \/ Chin-Up Isometric Hold'/,
  )
  assert.match(
    SCORE_79_VARIANT_CONSOLIDATIONS_MIGRATION,
    /'duplicate_consolidated'/,
  )
  assert.match(
    SCORE_79_VARIANT_CONSOLIDATIONS_MIGRATION,
    /refused to override % protected record/,
  )
  assert.match(
    SCORE_79_VARIANT_CONSOLIDATIONS_MIGRATION,
    /max_exercise_complexity_physical_difficulty/,
  )
  assert.doesNotMatch(
    SCORE_79_VARIANT_CONSOLIDATIONS_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    SCORE_79_VARIANT_CONSOLIDATIONS_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    SCORE_79_VARIANT_CONSOLIDATIONS_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('score-78 identity adjudication preserves mechanical boundaries and quarantines missing facts', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'383_coaching_score_78_identity_boundaries\.sql'/,
  )
  for (const boundary of [
    'turn_on_cue_then_receive_and_throw_vs_lateral_step_catch_and_throw',
    'linear_three_zone_velocity_progression_vs_continuous_curved_acceleration',
    'supine_floor_horizontal_press_vs_floor_seated_vertical_press',
    'horizontal_projection_to_stick_vs_vertical_projection_with_airborne_knee_tuck',
    'high_speed_brake_then_reaccelerate_vs_continuous_uphill_acceleration',
    'bilateral_depth_landing_vs_unilateral_depth_landing',
    'airborne_lateral_projection_vs_grounded_lateral_step_and_brake',
    'rotational_pelvic_open_close_control_vs_square_pelvis_loaded_hinge',
    'ankle_dorsiflexion_isometric_hold_vs_dynamic_repetitions',
    'crossing_x_route_with_center_transitions_vs_sequential_zig_zag_route',
    'bilateral_front_loaded_squat_vs_stationary_split_stance_squat',
    'vertical_eccentric_pull_vs_horizontal_bodyweight_push',
    'repeated_airborne_elastic_hops_vs_grounded_alternating_step_overs',
    'ladder_inside_outside_contact_sequence_vs_open_space_lateral_braking',
    'inside_inside_outside_icky_sequence_vs_single_contact_per_ladder_box',
  ]) {
    assert.match(SCORE_78_IDENTITY_BOUNDARIES_MIGRATION, new RegExp(boundary))
  }
  for (const missingFactBoundary of [
    'diagonal_bound_source_does_not_declare_same_leg_or_opposite_leg_landing',
    'line_hop_source_does_not_declare_foot_count_or_stiff_pogo_contact_contract',
    'lateral_bound_source_does_not_declare_takeoff_or_landing_foot_count',
    'arc_press_source_does_not_declare_stance_or_arc_contract',
    'pogo_hold_source_does_not_declare_contact_count_or_projection_amplitude',
    'landing_stick_source_does_not_declare_entry_or_takeoff',
    'pogo_hold_source_does_not_declare_repeated_contact_and_terminal_hold_sequence',
  ]) {
    assert.match(
      SCORE_78_IDENTITY_BOUNDARIES_MIGRATION,
      new RegExp(missingFactBoundary),
    )
  }
  assert.match(
    SCORE_78_IDENTITY_BOUNDARIES_MIGRATION,
    /found archived endpoint without matching decision/,
  )
  assert.match(
    SCORE_78_IDENTITY_BOUNDARIES_MIGRATION,
    /exercise_complexity_and_physical_difficulty_only/,
  )
  assert.doesNotMatch(
    SCORE_78_IDENTITY_BOUNDARIES_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    SCORE_78_IDENTITY_BOUNDARIES_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    SCORE_78_IDENTITY_BOUNDARIES_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('score-78 variants consolidate under general identities with exact dimensions', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'384_coaching_score_78_variant_identity_consolidations\.sql'/,
  )
  for (const duplicateSlug of [
    'alternating-bounds-for-rhythm',
    'barbell-floor-press',
    'double-dumbbell-front-squat',
    'single-kettlebell-front-rack-squat',
    'dynamic-leg-swing-front-to-back',
    'single-leg-glute-bridge',
    'single-leg-glute-bridge-hold',
    'glute-bridge-iso-hold',
    'hurdle-hop-series-low-hurdles',
    'lateral-icky-shuffle',
    'ins-and-out-sprint-float-sprint',
    'linear-deceleration-stop-eccentric-stick',
    'sprint-to-stick-deceleration',
    'ring-push-up',
    'push-up-negative',
    'push-up-start-to-cone',
    'seated-soleus-raise-eccentric',
    'triple-broad-jump-d7',
  ]) {
    assert.match(
      SCORE_78_VARIANT_CONSOLIDATIONS_MIGRATION,
      new RegExp(duplicateSlug),
    )
  }
  assert.match(
    SCORE_78_VARIANT_CONSOLIDATIONS_MIGRATION,
    /same_supine_floor_press_with_barbell_implement_variant/,
  )
  assert.match(
    SCORE_78_VARIANT_CONSOLIDATIONS_MIGRATION,
    /same_supine_hip_extension_bridge_with_unilateral_support_variant/,
  )
  assert.match(
    SCORE_78_VARIANT_CONSOLIDATIONS_MIGRATION,
    /same_linear_approach_deceleration_to_terminal_stick/,
  )
  assert.match(
    SCORE_78_VARIANT_CONSOLIDATIONS_MIGRATION,
    /'Floor Press'/,
  )
  assert.match(
    SCORE_78_VARIANT_CONSOLIDATIONS_MIGRATION,
    /'Linear Deceleration to Stick'/,
  )
  assert.match(
    SCORE_78_VARIANT_CONSOLIDATIONS_MIGRATION,
    /'duplicate_consolidated'/,
  )
  assert.match(
    SCORE_78_VARIANT_CONSOLIDATIONS_MIGRATION,
    /refused to override % protected record/,
  )
  assert.match(
    SCORE_78_VARIANT_CONSOLIDATIONS_MIGRATION,
    /source_peer\.id::TEXT < candidate\.id::TEXT/,
  )
  assert.match(
    SCORE_78_VARIANT_CONSOLIDATIONS_MIGRATION,
    /source_peer\.video_id = candidate\.video_id[\s\S]*source_peer\.url = candidate\.url/,
  )
  assert.match(
    SCORE_78_VARIANT_CONSOLIDATIONS_MIGRATION,
    /max_exercise_complexity_physical_difficulty/,
  )
  assert.doesNotMatch(
    SCORE_78_VARIANT_CONSOLIDATIONS_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    SCORE_78_VARIANT_CONSOLIDATIONS_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    SCORE_78_VARIANT_CONSOLIDATIONS_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('score-77 identity adjudication preserves action boundaries and quarantines missing contacts', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'385_coaching_score_77_identity_boundaries\.sql'/,
  )
  for (const boundary of [
    'half_turn_projection_and_reorientation_vs_sagittal_vertical_projection',
    'backward_overhead_release_to_open_sector_vs_downward_slam_to_floor',
    'airborne_bilateral_lateral_projection_vs_grounded_lateral_shuffle_braking',
    'hand_to_knee_isometric_without_limb_excursion_vs_wall_press_with_declared_leg_action',
    'brake_then_reaccelerate_through_exit_vs_brake_to_terminal_held_stop',
    'elevated_step_off_floor_contact_then_box_jump_vs_static_floor_squat_takeoff',
    'hip_extension_cycle_or_hold_vs_bridge_hold_with_ordered_heel_walkout_and_return',
    'supine_heel_slider_knee_cycle_with_bridge_vs_kneeling_body_lowering_eccentric',
    'hinge_and_clean_to_rack_then_press_vs_squat_then_continuous_press',
    'incoming_catch_then_low_hop_reoutput_vs_chest_pass_return_catch_and_stationary_stick',
    'lateral_unilateral_projection_to_box_vs_vertical_projection_to_single_leg_box_landing',
    'standing_extended_knee_plantar_flexion_vs_seated_bent_knee_plantar_flexion',
    'bilateral_sandbag_squat_vs_stationary_asymmetrical_split_stance_squat',
    'rotational_landmine_press_with_hip_turn_and_foot_pivot_vs_nonrotational_angled_press',
    'half_turn_reorientation_and_stick_vs_vertical_projection_with_airborne_hip_and_knee_flexion',
    'vertical_tuck_jump_landing_under_base_vs_tuck_jump_to_declared_lateral_landing_displacement',
    'frontal_plane_lateral_weight_shift_with_extended_trail_leg_vs_bilateral_sandbag_squat',
    'sandbag_squat_with_declared_front_shoulder_or_bear_hug_variant_vs_elbow_crook_zercher_support',
    'squat_preload_to_vertical_projection_and_stick_vs_vertical_projection_with_airborne_tuck',
    'horizontal_projection_to_distance_landing_vs_vertical_projection_with_airborne_tuck',
    'held_hip_hinge_landmine_row_vs_active_romanian_deadlift_cycle_then_row',
    'angled_landmine_push_with_elbow_extension_vs_hinged_landmine_pull_with_elbow_flexion',
    'held_hip_hinge_with_upper_body_row_vs_active_hip_hinge_and_extension_without_required_row',
  ]) {
    assert.match(SCORE_77_IDENTITY_BOUNDARIES_MIGRATION, new RegExp(boundary))
  }
  for (const missingFactBoundary of [
    'a_skip_sources_do_not_jointly_declare_contact_sequence_and_pogo_contract',
    'iso_hold_source_allows_standing_or_supine_base_and_does_not_declare_march_sequence',
    'hurdle_box_sources_do_not_jointly_declare_direction_and_foot_contact_contract',
  ]) {
    assert.match(
      SCORE_77_IDENTITY_BOUNDARIES_MIGRATION,
      new RegExp(missingFactBoundary),
    )
  }
  assert.match(
    SCORE_77_IDENTITY_BOUNDARIES_MIGRATION,
    /found archived endpoint without matching decision/,
  )
  assert.match(
    SCORE_77_IDENTITY_BOUNDARIES_MIGRATION,
    /exercise_complexity_and_physical_difficulty_only/,
  )
  assert.doesNotMatch(
    SCORE_77_IDENTITY_BOUNDARIES_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    SCORE_77_IDENTITY_BOUNDARIES_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    SCORE_77_IDENTITY_BOUNDARIES_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('score-77 variants consolidate under stable identities with exact dimensions', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'386_coaching_score_77_variant_identity_consolidations\.sql'/,
  )
  for (const duplicateSlug of [
    'high-bar-back-squat',
    'band-row',
    'pause-box-jump',
    'landmine-ball-grip-press',
    'landmine-ball-grip-row',
    'landmine-gorilla-row',
    'landmine-meadows-row',
    'landmine-neutral-handle-t-bar-row',
    'landmine-suitcase-row',
    'landmine-t-bar-row-with-v-handle',
    'loaded-squat-jump',
    'strict-ring-dip-strength',
    'squat-roll-to-stand',
    'sandbag-bear-hug-squat-strength',
    'sandbag-shoulder-loaded-squat-strength',
    'tuck-jump-to-stick',
  ]) {
    assert.match(
      SCORE_77_VARIANT_CONSOLIDATIONS_MIGRATION,
      new RegExp(duplicateSlug),
    )
  }
  assert.match(
    SCORE_77_VARIANT_CONSOLIDATIONS_MIGRATION,
    /same_nonrotational_landmine_press_with_ball_grip_attachment_variant/,
  )
  assert.match(
    SCORE_77_VARIANT_CONSOLIDATIONS_MIGRATION,
    /same_single_arm_landmine_row_with_meadows_stance_and_sleeve_grip_variant/,
  )
  assert.match(
    SCORE_77_VARIANT_CONSOLIDATIONS_MIGRATION,
    /same_landmine_row_with_ball_grip_attachment_and_hand_count_variants/,
  )
  assert.match(
    SCORE_77_VARIANT_CONSOLIDATIONS_MIGRATION,
    /same_landmine_row_with_neutral_handle_and_bilateral_hand_count_variants/,
  )
  assert.match(
    SCORE_77_VARIANT_CONSOLIDATIONS_MIGRATION,
    /same_landmine_row_with_gorilla_stance_and_double_handle_variant/,
  )
  assert.match(
    SCORE_77_VARIANT_CONSOLIDATIONS_MIGRATION,
    /same_landmine_row_with_suitcase_stance_and_anti_rotation_emphasis_variant/,
  )
  assert.match(
    SCORE_77_VARIANT_CONSOLIDATIONS_MIGRATION,
    /same_sandbag_squat_with_front_or_unilateral_shoulder_load_position_variant/,
  )
  assert.match(
    SCORE_77_VARIANT_CONSOLIDATIONS_MIGRATION,
    /same_sandbag_squat_with_bear_hug_load_position_variant/,
  )
  assert.match(
    SCORE_77_VARIANT_CONSOLIDATIONS_MIGRATION,
    /'Landmine T-Bar Row'/,
  )
  assert.match(
    SCORE_77_VARIANT_CONSOLIDATIONS_MIGRATION,
    /'Landmine Row'/,
  )
  assert.match(
    SCORE_77_VARIANT_CONSOLIDATIONS_MIGRATION,
    /'Sandbag Squat'/,
  )
  assert.match(
    SCORE_77_VARIANT_CONSOLIDATIONS_MIGRATION,
    /source_peer\.id::TEXT < candidate\.id::TEXT/,
  )
  assert.match(
    SCORE_77_VARIANT_CONSOLIDATIONS_MIGRATION,
    /'duplicate_consolidated'/,
  )
  assert.match(
    SCORE_77_VARIANT_CONSOLIDATIONS_MIGRATION,
    /refused to override % protected record/,
  )
  assert.match(
    SCORE_77_VARIANT_CONSOLIDATIONS_MIGRATION,
    /max_exercise_complexity_physical_difficulty/,
  )
  assert.doesNotMatch(
    SCORE_77_VARIANT_CONSOLIDATIONS_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    SCORE_77_VARIANT_CONSOLIDATIONS_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    SCORE_77_VARIANT_CONSOLIDATIONS_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('score-76 identity adjudication preserves mechanics and quarantines missing identity facts', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'387_coaching_score_76_identity_boundaries\.sql'/,
  )
  for (const boundary of [
    'half_turn_bilateral_jump_reorientation_vs_quarter_turn_hop_contract',
    'single_180_degree_timed_change_of_direction_vs_multi_segment_box_route',
    'posterior_rolling_direction_and_hand_support_vs_anterior_rolling_direction',
    'horizontal_jump_then_second_box_jump_vs_single_horizontal_jump_and_terminal_landing',
    'feet_elevated_continuous_closed_chain_press_vs_ballistic_hand_release_press',
    'incoming_drop_catch_then_chest_projection_vs_kneeling_chest_projection_without_drop_catch',
    'upright_forward_fall_to_acceleration_vs_grounded_half_kneeling_start',
    'controlled_low_to_high_lift_without_release_vs_ballistic_unilateral_projection',
    'rotational_angled_press_with_elbow_extension_vs_hinged_pull_with_elbow_flexion',
    'single_lateral_projection_and_landing_vs_repeated_rebound_contact_series',
    'ballistic_dip_drive_and_split_under_load_vs_static_split_stance_strict_press',
    'top_down_hip_hinge_with_soft_knees_vs_floor_pull_from_wide_turned_out_stance',
  ]) {
    assert.match(SCORE_76_IDENTITY_BOUNDARIES_MIGRATION, new RegExp(boundary))
  }
  for (const missingFactBoundary of [
    'sources_do_not_declare_body_orientation_support_or_implement_retention_contract',
    'generic_bound_source_does_not_declare_projection_direction_or_rotation_contract',
    'eccentric_press_source_does_not_declare_base_assisted_return_or_repetition_cycle',
    'reactive_45_source_does_not_declare_stimulus_branch_count_or_cue_timing',
    'build_up_source_does_not_declare_three_zone_velocity_sequence_or_intensity_targets',
    'sources_do_not_jointly_declare_same_leg_or_alternating_contact_sequence',
  ]) {
    assert.match(
      SCORE_76_IDENTITY_BOUNDARIES_MIGRATION,
      new RegExp(missingFactBoundary),
    )
  }
  assert.match(
    SCORE_76_IDENTITY_BOUNDARIES_MIGRATION,
    /found archived endpoint without matching decision/,
  )
  assert.match(
    SCORE_76_IDENTITY_BOUNDARIES_MIGRATION,
    /exercise_complexity_and_physical_difficulty_only/,
  )
  assert.doesNotMatch(
    SCORE_76_IDENTITY_BOUNDARIES_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    SCORE_76_IDENTITY_BOUNDARIES_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    SCORE_76_IDENTITY_BOUNDARIES_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('score-76 variants consolidate exact dimensions without creating approvals or skill levels', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'388_coaching_score_76_variant_identity_consolidations\.sql'/,
  )
  for (const duplicateSlug of [
    'slam-ball-bear-hug-carry',
    'barbell-good-morning',
    'calf-isometric-hold-straight-knee',
    'calf-raise-iso-with-single-leg-hold',
    'chin-up',
    'feet-elevated-inverted-row',
    'half-kneeling-cable-chop',
    'tall-kneeling-cable-band-chop',
    'slider-hamstring-eccentric-slow-lower',
    'head-turn-single-leg-balance',
    'inverted-row-negative',
    'lateral-bound-to-stick',
    'skater-hop-to-stick',
    'over-shoulder-tennis-ball-track-and-stick',
    'two-hand-landmine-push-press',
    'tempo-bodyweight-squat',
    'pull-up',
    'staggered-stance-rotational-box-jump',
    'step-off-to-single-leg-stick',
    'single-leg-calf-raise',
    'suitcase-carry-line-walk',
  ]) {
    assert.match(
      SCORE_76_VARIANT_CONSOLIDATIONS_MIGRATION,
      new RegExp(duplicateSlug),
    )
  }
  for (const stableName of [
    "'Good Morning'",
    "'Kneeling Cable/Band Chop'",
    "'Over-Shoulder Track and Catch'",
    "'Landmine Push Press'",
    "'Bodyweight Squat'",
  ]) {
    assert.match(
      SCORE_76_VARIANT_CONSOLIDATIONS_MIGRATION,
      new RegExp(stableName),
    )
  }
  assert.match(
    SCORE_76_VARIANT_CONSOLIDATIONS_MIGRATION,
    /source_peer\.id::TEXT < candidate\.id::TEXT/,
  )
  assert.match(
    SCORE_76_VARIANT_CONSOLIDATIONS_MIGRATION,
    /refused to override % protected record/,
  )
  assert.match(
    SCORE_76_VARIANT_CONSOLIDATIONS_MIGRATION,
    /max_exercise_complexity_physical_difficulty/,
  )
  assert.doesNotMatch(
    SCORE_76_VARIANT_CONSOLIDATIONS_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    SCORE_76_VARIANT_CONSOLIDATIONS_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    SCORE_76_VARIANT_CONSOLIDATIONS_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('score-75 identity adjudication preserves mechanics and quarantines missing identity facts', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'389_coaching_score_75_identity_boundaries\.sql'/,
  )
  for (const boundary of [
    'half_turn_reorientation_and_landing_vs_forward_horizontal_projection',
    'posterior_shoulder_supported_barbell_squat_vs_bar_held_behind_legs',
    'horizontal_anchored_pull_vs_diagonal_trunk_and_shoulder_chop',
    'wide_stance_squat_with_continuous_front_load_vs_floor_deadlift_to_standing',
    'anti_rotation_press_with_square_pelvis_vs_deliberate_hip_trunk_rotation_and_pivot',
    'half_kneeling_asymmetric_base_vs_floor_seated_long_sit_base',
    'standing_dip_drive_push_press_vs_fixed_split_stance_strict_press',
    'supine_horizontal_landmine_press_vs_square_standing_angled_press',
    'floor_seated_long_sit_base_vs_tall_kneeling_symmetric_base',
    'bear_hug_loaded_gait_vs_stationary_front_loaded_squat',
    'squat_to_rear_box_contact_and_pause_vs_continuous_front_loaded_squat',
    'dynamic_loaded_shoulder_extension_pullover_vs_isometric_hollow_body_line',
    'dynamic_front_loaded_squat_repetitions_vs_fixed_bottom_isometric',
    'general_front_loaded_squat_vs_required_heel_elevation_and_barbell_front_rack',
    'intentional_whole_body_rotation_vs_fixed_split_stance_strict_press',
    'squat_then_overhead_press_vs_floor_clean_then_front_loaded_squat',
    'squat_to_overhead_press_vs_front_loaded_squat_without_press',
    'single_elevated_step_off_landing_vs_three_unilateral_horizontal_projections',
    'wide_turned_out_barbell_or_center_load_pull_vs_hip_width_trap_bar_pull',
    'repeated_throws_and_catches_across_targets_vs_nonballistic_target_rehearsal',
  ]) {
    assert.match(SCORE_75_IDENTITY_BOUNDARIES_MIGRATION, new RegExp(boundary))
  }
  for (const missingFactBoundary of [
    'balance_pad_source_does_not_declare_single_or_double_leg_support',
    'bear_position_source_does_not_declare_knee_contact_or_hover_support_state',
    'reactive_rebound_source_does_not_declare_extra_contact_or_rebound_sequence',
    'continuous_hurdle_source_does_not_declare_hurdle_count_direction_or_contact_contract',
    'arc_press_source_does_not_declare_base_or_arc_path_contract',
    'arc_press_source_does_not_declare_base_or_arc_path_against_tall_kneeling_press',
    'landmine_handle_deadlift_source_does_not_declare_stance_or_handle_geometry',
    'generic_single_leg_landing_source_does_not_declare_entry_or_projection_direction',
    'line_hop_source_does_not_declare_contact_count_or_projection_direction',
    'triple_line_source_does_not_declare_line_orientation_or_projection_distance',
  ]) {
    assert.match(
      SCORE_75_IDENTITY_BOUNDARIES_MIGRATION,
      new RegExp(missingFactBoundary),
    )
  }
  assert.match(
    SCORE_75_IDENTITY_BOUNDARIES_MIGRATION,
    /found archived endpoint without matching decision/,
  )
  assert.match(
    SCORE_75_IDENTITY_BOUNDARIES_MIGRATION,
    /exercise_complexity_and_physical_difficulty_only/,
  )
  assert.doesNotMatch(
    SCORE_75_IDENTITY_BOUNDARIES_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    SCORE_75_IDENTITY_BOUNDARIES_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    SCORE_75_IDENTITY_BOUNDARIES_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('score-75 variants consolidate exact dimensions without creating approvals or skill levels', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'390_coaching_score_75_variant_identity_consolidations\.sql'/,
  )
  for (const duplicateSlug of [
    'bear-hug-sandbag-carry',
    'dead-bug-heel-tap-control-progression',
    'deep-squat-pry-with-reach',
    'dumbbell-hollow-body-pullover-hold',
    'sandbag-floor-press-strength',
    'goblet-squat',
    'landmine-split-stance-rotational-press',
    'landmine-neutral-handle-press',
    'wall-ball-squat-to-press-pattern',
    'slam-ball-clean-to-front-squat',
    'tempo-push-up',
    'tempo-eccentric-push-up',
    'quadruped-scapular-push-up-hold',
    'scapular-push-up-plus-iso-hold',
  ]) {
    assert.match(
      SCORE_75_VARIANT_CONSOLIDATIONS_MIGRATION,
      new RegExp(duplicateSlug),
    )
  }
  for (const stableName of [
    "'Bear-Hug Carry'",
    "'Floor Press'",
    "'Medicine Ball Squat to Press'",
  ]) {
    assert.match(
      SCORE_75_VARIANT_CONSOLIDATIONS_MIGRATION,
      new RegExp(stableName),
    )
  }
  assert.match(
    SCORE_75_VARIANT_CONSOLIDATIONS_MIGRATION,
    /source_peer\.id::TEXT < candidate\.id::TEXT/,
  )
  assert.match(
    SCORE_75_VARIANT_CONSOLIDATIONS_MIGRATION,
    /refused to override % protected record/,
  )
  assert.match(
    SCORE_75_VARIANT_CONSOLIDATIONS_MIGRATION,
    /max_exercise_complexity_physical_difficulty/,
  )
  assert.doesNotMatch(
    SCORE_75_VARIANT_CONSOLIDATIONS_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    SCORE_75_VARIANT_CONSOLIDATIONS_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    SCORE_75_VARIANT_CONSOLIDATIONS_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('score-74 identity adjudication closes deterministic boundaries and quarantines missing facts', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'391_coaching_score_74_identity_boundaries\.sql'/,
  )
  for (const boundary of [
    'supine_wall_supported_breathing_reset_vs_seated_dynamic_hip_rotation',
    'posterior_loaded_bilateral_sagittal_squat_vs_frontal_shift_to_one_leg',
    'direct_floor_takeoff_to_box_vs_repeated_ankle_contact_entry_then_box_jump',
    'continuous_progressive_acceleration_vs_accelerate_float_reaccelerate_sequence',
    'elevated_drop_to_floor_absorption_vs_concentric_floor_jump_to_box',
    'incline_bench_external_load_press_vs_ballistic_closed_chain_push_up',
    'front_rack_squat_cycle_vs_floor_clean_receive_then_squat_sequence',
    'single_leg_balance_with_optional_body_perturbation_vs_object_catch_task',
    'skipping_with_object_toss_and_catch_vs_unloaded_skip_rhythm',
    'active_rapid_snap_down_from_tall_vs_slow_elevated_single_leg_step_down',
  ]) {
    assert.match(SCORE_74_IDENTITY_BOUNDARIES_MIGRATION, new RegExp(boundary))
  }
  for (const missingFactBoundary of [
    'line_hops_source_does_not_declare_direction_foot_count_or_pogo_contact_contract',
    'combined_rope_and_towel_source_does_not_declare_one_repetition_contract',
    'generic_single_leg_landing_source_does_not_declare_entry_against_forward_hop',
  ]) {
    assert.match(
      SCORE_74_IDENTITY_BOUNDARIES_MIGRATION,
      new RegExp(missingFactBoundary),
    )
  }
  assert.match(
    SCORE_74_IDENTITY_BOUNDARIES_MIGRATION,
    /found archived endpoint without matching decision/,
  )
  assert.match(
    SCORE_74_IDENTITY_BOUNDARIES_MIGRATION,
    /exercise_complexity_and_physical_difficulty_only/,
  )
  assert.doesNotMatch(
    SCORE_74_IDENTITY_BOUNDARIES_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    SCORE_74_IDENTITY_BOUNDARIES_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    SCORE_74_IDENTITY_BOUNDARIES_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('score-74 variants consolidate controlled dimensions without approvals or exercise skill levels', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'392_coaching_score_74_variant_identity_consolidations\.sql'/,
  )
  for (const duplicateSlug of [
    '20-20-20-build-up-sprint',
    '90-degree-cut-drill',
    '90-degree-cut-and-stick',
    'wall-ankling-pogo',
    'barbell-step-up',
    'box-jump-step-down-reset',
    'reset-repetition-box-jump',
    'low-box-drop-to-eccentric-landing-stick',
    'low-box-step-off-to-stick',
    'incline-barbell-bench-press',
    'medicine-ball-front-squat',
    'front-foot-elevated-split-squat',
    'low-dribble-run',
    'mini-hurdle-wicket-rhythm-run',
    'parallel-bar-dip-progression',
    'perturbation-single-leg-balance',
    'slam-ball-bear-hug-squat',
    'skipping-rhythm-change',
    'lateral-step-down',
    'step-down-to-stick',
    'wall-drive-iso-hold',
  ]) {
    assert.match(
      SCORE_74_VARIANT_CONSOLIDATIONS_MIGRATION,
      new RegExp(duplicateSlug),
    )
  }
  for (const stableName of [
    "'Ankling Pogo'",
    "'Incline Press'",
    "'Dribble Run'",
    "'Mini-Hurdle Wicket Rhythm Run'",
    "'Step-Down'",
    "'Wall Drive ISO Hold'",
  ]) {
    assert.match(
      SCORE_74_VARIANT_CONSOLIDATIONS_MIGRATION,
      new RegExp(stableName),
    )
  }
  assert.match(
    SCORE_74_VARIANT_CONSOLIDATIONS_MIGRATION,
    /source_peer\.id::TEXT < candidate\.id::TEXT/,
  )
  assert.match(
    SCORE_74_VARIANT_CONSOLIDATIONS_MIGRATION,
    /refused to override % protected record/,
  )
  assert.match(
    SCORE_74_VARIANT_CONSOLIDATIONS_MIGRATION,
    /max_exercise_complexity_physical_difficulty/,
  )
  assert.match(
    SCORE_74_VARIANT_CONSOLIDATIONS_MIGRATION,
    /identity_consolidation_reaudit_required/,
  )
  assert.doesNotMatch(
    SCORE_74_VARIANT_CONSOLIDATIONS_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    SCORE_74_VARIANT_CONSOLIDATIONS_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    SCORE_74_VARIANT_CONSOLIDATIONS_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('score-73 identity adjudication records exact boundaries and quarantines only missing contracts', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'393_coaching_score_73_identity_boundaries\.sql'/,
  )
  for (const boundary of [
    'split_stance_unilateral_bias_vs_bilateral_static_takeoff',
    'rotational_press_vs_rotational_pull',
    'terminal_catch_and_brake_vs_catch_pivot_and_outgoing_pass',
    'horizontal_projection_vs_vertical_projection',
    'floor_start_deadlift_vs_top_down_hip_hinge_without_floor_reset',
  ]) {
    assert.match(SCORE_73_IDENTITY_BOUNDARIES_MIGRATION, new RegExp(boundary))
  }
  for (const missingFactBoundary of [
    'generic_landmine_press_missing_hand_count_and_base_contract',
    'eccentric_source_missing_arm_abduction_and_rotation_plane',
    'sources_missing_exact_contact_count_line_direction_and_hold_order',
    'rebound_source_missing_amplitude_contact_count_and_terminal_behavior',
  ]) {
    assert.match(
      SCORE_73_IDENTITY_BOUNDARIES_MIGRATION,
      new RegExp(missingFactBoundary),
    )
  }
  assert.match(
    SCORE_73_IDENTITY_BOUNDARIES_MIGRATION,
    /changedOrMissingDimensions/,
  )
  assert.match(
    SCORE_73_IDENTITY_BOUNDARIES_MIGRATION,
    /exercise_complexity_and_physical_difficulty_only/,
  )
  assert.doesNotMatch(
    SCORE_73_IDENTITY_BOUNDARIES_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    SCORE_73_IDENTITY_BOUNDARIES_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('score-73 variants consolidate support, implement, sensory, and contraction dimensions without approvals', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'394_coaching_score_73_variant_identity_consolidations\.sql'/,
  )
  for (const duplicateSlug of [
    'a-march-linear',
    'volleyball-approach-jump',
    'medicine-ball-rollout',
    'dumbbell-z-press',
    'eyes-closed-single-leg-balance',
    'front-plank-long-lever-plank',
    'goblet-squat-tempo-d6',
    'standing-hip-airplane-kick-prep',
    'nordic-hamstring-iso-hold',
    'partner-assisted-nordic-hamstring-negative',
    'single-leg-in-out-hops',
    'squat-jump-to-stick',
    'depth-drop-to-athletic-stick',
    'single-leg-balance-clock',
  ]) {
    assert.match(
      SCORE_73_VARIANT_CONSOLIDATIONS_MIGRATION,
      new RegExp(duplicateSlug),
    )
  }
  assert.match(
    SCORE_73_VARIANT_CONSOLIDATIONS_MIGRATION,
    /refused to override % protected record/,
  )
  assert.match(
    SCORE_73_VARIANT_CONSOLIDATIONS_MIGRATION,
    /max_exercise_complexity_physical_difficulty/,
  )
  assert.doesNotMatch(
    SCORE_73_VARIANT_CONSOLIDATIONS_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    SCORE_73_VARIANT_CONSOLIDATIONS_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('score-72 identity adjudication closes the configured queue without inventing missing facts', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'395_coaching_score_72_identity_boundaries\.sql'/,
  )
  for (const boundary of [
    'incline_bench_external_load_press_vs_closed_chain_bodyweight_press',
    'full_spinal_shoulder_extension_bridge_vs_supine_hip_extension_bridge',
    'live_cue_selected_acceleration_vs_preplanned_three_point_start',
    'full_squat_throw_catch_cycle_vs_nonballistic_target_rehearsal',
  ]) {
    assert.match(SCORE_72_IDENTITY_BOUNDARIES_MIGRATION, new RegExp(boundary))
  }
  for (const missingFactBoundary of [
    'eccentric_source_missing_elbow_position_and_rotation_plane',
    'band_sources_missing_anchor_force_direction_and_rebound_contract',
    'landmine_deadlift_source_missing_stance_handle_geometry_and_floor_start',
    'low_hurdle_source_missing_takeoff_and_landing_foot_count',
  ]) {
    assert.match(
      SCORE_72_IDENTITY_BOUNDARIES_MIGRATION,
      new RegExp(missingFactBoundary),
    )
  }
  assert.match(
    SCORE_72_IDENTITY_BOUNDARIES_MIGRATION,
    /exercise_complexity_and_physical_difficulty_only/,
  )
  assert.doesNotMatch(
    SCORE_72_IDENTITY_BOUNDARIES_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    SCORE_72_IDENTITY_BOUNDARIES_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('score-72 variants collapse aliases into stable difficulty-only identities', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'396_coaching_score_72_variant_identity_consolidations\.sql'/,
  )
  for (const duplicateSlug of [
    'low-pogos',
    'archer-pull-up',
    'archer-push-up',
    'bodyweight-step-up',
    'one-step-box-jump',
    'eccentric-pull-up-chin-up-negative',
    'negative-chin-up',
    'negative-pull-up',
    'hamstring-bridge-iso-long-lever-bridge-hold',
    'half-wall-ball-shot',
    'tempo-wall-ball-shot',
    'high-target-wall-ball-shot',
    'light-fast-wall-ball-shot',
    'incline-push-up',
    'decline-push-up',
    'one-arm-landmine-row',
    'strict-pull-up',
    'sandbag-step-up-strength',
    'split-stance-band-row',
    'single-leg-football-catch-with-late-color-call',
    'tag-and-go-acceleration',
  ]) {
    assert.match(
      SCORE_72_VARIANT_CONSOLIDATIONS_MIGRATION,
      new RegExp(duplicateSlug),
    )
  }
  assert.match(
    SCORE_72_VARIANT_CONSOLIDATIONS_MIGRATION,
    /source_peer\.id::TEXT < candidate\.id::TEXT/,
  )
  assert.match(
    SCORE_72_VARIANT_CONSOLIDATIONS_MIGRATION,
    /max_exercise_complexity_physical_difficulty/,
  )
  assert.doesNotMatch(
    SCORE_72_VARIANT_CONSOLIDATIONS_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    SCORE_72_VARIANT_CONSOLIDATIONS_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('hamstring slider completion uses exact difficulty-only variants and preserves every human gate', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'373_coaching_hamstring_slider_curl_family_completion\.sql'/,
  )
  for (const variantKey of [
    'bilateral-short-range-bridge-reset',
    'bilateral-full-cycle',
    'bilateral-eccentric-only-reset-down',
    'alternating-full-cycle',
    'single-leg-full-cycle',
    'single-leg-eccentric-only-assisted-return',
  ]) {
    assert.match(
      HAMSTRING_SLIDER_COMPLETION_MIGRATION,
      new RegExp(variantKey),
    )
  }
  for (const videoId of [
    'AlTI3igOaLw',
    '4lp8W4ztK4k',
    '5HSIt7T8JCk',
    'URPkeNfJN0I',
    '2ShLmP5NL5w',
  ]) {
    assert.match(
      HAMSTRING_SLIDER_COMPLETION_MIGRATION,
      new RegExp(videoId),
    )
  }
  assert.match(
    HAMSTRING_SLIDER_COMPLETION_MIGRATION,
    /greatest\(seed\.complexity, seed\.physical\)/,
  )
  assert.match(
    HAMSTRING_SLIDER_COMPLETION_MIGRATION,
    /'max_exercise_complexity_physical_difficulty'/,
  )
  assert.match(
    HAMSTRING_SLIDER_COMPLETION_MIGRATION,
    /'capacity-strength','capacity'/,
  )
  assert.match(
    HAMSTRING_SLIDER_COMPLETION_MIGRATION,
    /'resilience-eccentric-control','resilience'/,
  )
  assert.match(
    HAMSTRING_SLIDER_COMPLETION_MIGRATION,
    /refused to overwrite % protected record/,
  )
  assert.match(
    HAMSTRING_SLIDER_COMPLETION_MIGRATION,
    /'media_human_review_required'/,
  )
  assert.match(
    HAMSTRING_SLIDER_COMPLETION_MIGRATION,
    /'calibration_human_review_required'/,
  )
  assert.doesNotMatch(
    HAMSTRING_SLIDER_COMPLETION_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    HAMSTRING_SLIDER_COMPLETION_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    HAMSTRING_SLIDER_COMPLETION_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('landmine press completion uses exact strict variants, five embedded candidates, and every human gate', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'397_coaching_landmine_press_family_completion\.sql'/,
  )
  for (const variantKey of [
    'single-arm-square-stance-sleeve-grip-strict',
    'single-arm-split-stance-sleeve-grip-strict',
    'two-hand-square-stance-sleeve-grip-strict',
    'two-hand-square-stance-neutral-handle-strict',
    'two-hand-square-stance-ball-grip-strict',
  ]) {
    assert.match(
      LANDMINE_PRESS_COMPLETION_MIGRATION,
      new RegExp(variantKey),
    )
  }
  for (const videoId of [
    '3gYz0bLG-wY',
    'Xf5tyNy5M6k',
    'N9_1DnqUAQw',
    '5Cs27w8WVz4',
    '6cSTRPhpubs',
  ]) {
    assert.match(
      LANDMINE_PRESS_COMPLETION_MIGRATION,
      new RegExp(videoId),
    )
  }
  assert.match(
    LANDMINE_PRESS_COMPLETION_MIGRATION,
    /greatest\(seed\.complexity, seed\.physical\)/,
  )
  assert.match(
    LANDMINE_PRESS_COMPLETION_MIGRATION,
    /'max_exercise_complexity_physical_difficulty'/,
  )
  assert.match(
    LANDMINE_PRESS_COMPLETION_MIGRATION,
    /'capacity-strict-strength','capacity'/,
  )
  assert.match(
    LANDMINE_PRESS_COMPLETION_MIGRATION,
    /'movement-intelligence-path-control','movement_intelligence'/,
  )
  assert.match(
    LANDMINE_PRESS_COMPLETION_MIGRATION,
    /refused to overwrite % protected record/,
  )
  assert.match(
    LANDMINE_PRESS_COMPLETION_MIGRATION,
    /slug = 'two-hand-landmine-press'/,
  )
  assert.match(
    LANDMINE_PRESS_COMPLETION_MIGRATION,
    /'duplicate_consolidated'/,
  )
  assert.match(
    LANDMINE_PRESS_COMPLETION_MIGRATION,
    /'same_strict_standing_fixed_arc_landmine_press_with_exact_two_hand_variant'/,
  )
  assert.match(
    LANDMINE_PRESS_COMPLETION_MIGRATION,
    /'same_strict_standing_fixed_arc_landmine_press_with_exact_single_arm_square_stance_variant'/,
  )
  assert.match(
    LANDMINE_PRESS_COMPLETION_MIGRATION,
    /'same_strict_standing_fixed_arc_landmine_press_with_exact_single_arm_split_stance_variant'/,
  )
  assert.match(
    LANDMINE_PRESS_COMPLETION_MIGRATION,
    /UPDATE coaching\.exercise_definition_source_v1/,
  )
  for (const boundary of [
    'standing_two_feet_vs_half_kneeling_one_knee_and_one_foot_base',
    'standing_two_feet_vs_tall_kneeling_two_knee_base',
    'standing_diagonal_press_vs_supine_floor_press',
    'strict_press_without_leg_drive_vs_dip_drive_and_split_catch',
    'standing_landmine_diagonal_arc_vs_long_sit_free_bar_vertical_press',
    'standing_landmine_diagonal_arc_vs_supine_bench_horizontal_press',
  ]) {
    assert.match(
      LANDMINE_PRESS_COMPLETION_MIGRATION,
      new RegExp(boundary),
    )
  }
  assert.match(
    LANDMINE_PRESS_COMPLETION_MIGRATION,
    /'media_human_review_required'/,
  )
  assert.match(
    LANDMINE_PRESS_COMPLETION_MIGRATION,
    /'alternate_boundary_human_review_required'/,
  )
  assert.match(
    LANDMINE_PRESS_COMPLETION_MIGRATION,
    /'graph_human_review_required'/,
  )
  assert.match(
    LANDMINE_PRESS_COMPLETION_MIGRATION,
    /'calibration_human_review_required'/,
  )
  assert.doesNotMatch(
    LANDMINE_PRESS_COMPLETION_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    LANDMINE_PRESS_COMPLETION_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    LANDMINE_PRESS_COMPLETION_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('one-arm landmine base completion builds exact cards and keeps ambiguous Arc Press non-selectable', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'398_coaching_one_arm_landmine_base_family_completion\.sql'/,
  )
  for (const slug of [
    'half-kneeling-one-arm-landmine-press',
    'tall-kneeling-one-arm-landmine-press',
    'one-arm-landmine-floor-press',
    'one-arm-landmine-z-press',
    'one-arm-landmine-arc-press',
  ]) {
    assert.match(
      ONE_ARM_LANDMINE_BASE_COMPLETION_MIGRATION,
      new RegExp(slug),
    )
  }
  for (const variantKey of [
    'working-arm-ipsilateral-to-down-knee-strict',
    'working-arm-contralateral-to-down-knee-strict',
    'single-arm-tall-kneeling-sleeve-grip-strict',
    'single-arm-supine-floor-supported-strict',
    'single-arm-long-sit-legs-together-strict',
    'single-arm-long-sit-straddle-strict',
    'identity-review-only',
  ]) {
    assert.match(
      ONE_ARM_LANDMINE_BASE_COMPLETION_MIGRATION,
      new RegExp(variantKey),
    )
  }
  for (const videoId of [
    '_ArzG9qz-yM',
    'JH_L7Itnv9s',
    'BKDzLILFURM',
    'ZQBaGzoe3P0',
    'hiMe9Fu8Ha8',
    'fw_4FpH96Nw',
    'AXWAI6yTB-I',
    '2XGv3QrU-n4',
    'JFwX9gJh8Fc',
    'Sgikteuhkkw',
  ]) {
    assert.match(
      ONE_ARM_LANDMINE_BASE_COMPLETION_MIGRATION,
      new RegExp(videoId),
    )
  }
  assert.match(
    ONE_ARM_LANDMINE_BASE_COMPLETION_MIGRATION,
    /greatest\(seed\.complexity, seed\.physical\)/,
  )
  assert.match(
    ONE_ARM_LANDMINE_BASE_COMPLETION_MIGRATION,
    /'max_exercise_complexity_physical_difficulty'/,
  )
  assert.match(
    ONE_ARM_LANDMINE_BASE_COMPLETION_MIGRATION,
    /'capacity-strict-strength','capacity'/,
  )
  assert.match(
    ONE_ARM_LANDMINE_BASE_COMPLETION_MIGRATION,
    /'movement-intelligence-base-and-path','movement_intelligence'/,
  )
  assert.match(
    ONE_ARM_LANDMINE_BASE_COMPLETION_MIGRATION,
    /'blocked_pending_identity_review'/,
  )
  assert.match(
    ONE_ARM_LANDMINE_BASE_COMPLETION_MIGRATION,
    /'selectable', seed\.selectable/,
  )
  assert.match(
    ONE_ARM_LANDMINE_BASE_COMPLETION_MIGRATION,
    /exact_variant_match = NULL/,
  )
  assert.match(
    ONE_ARM_LANDMINE_BASE_COMPLETION_MIGRATION,
    /reviewer_user_id = NULL/,
  )
  assert.match(
    ONE_ARM_LANDMINE_BASE_COMPLETION_MIGRATION,
    /refused to overwrite % protected canonical definition/,
  )
  assert.match(
    ONE_ARM_LANDMINE_BASE_COMPLETION_MIGRATION,
    /human-reviewed legacy score record/,
  )
  assert.match(
    ONE_ARM_LANDMINE_BASE_COMPLETION_MIGRATION,
    /ARRAY\[1405,1406,1411,1412,1413,1414\]/,
  )
  for (const blocker of [
    'CARD-IDENTITY-01',
    'CARD-MEDIA-01',
    'CARD-PUBLISH-01',
    'CARD-GRAPH-03',
    'CARD-CALIBRATION-01',
  ]) {
    assert.match(
      ONE_ARM_LANDMINE_BASE_COMPLETION_MIGRATION,
      new RegExp(blocker),
    )
  }
  assert.doesNotMatch(
    ONE_ARM_LANDMINE_BASE_COMPLETION_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    ONE_ARM_LANDMINE_BASE_COMPLETION_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    ONE_ARM_LANDMINE_BASE_COMPLETION_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('landmine explosive press completion preserves action identities and difficulty-only scoring', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'401_coaching_landmine_explosive_press_family_completion\.sql'/,
  )
  for (const slug of [
    'one-arm-landmine-push-press',
    'two-hand-landmine-push-press',
    'one-arm-landmine-split-jerk',
    'landmine-squat-to-press',
  ]) {
    assert.match(
      LANDMINE_EXPLOSIVE_PRESS_COMPLETION_MIGRATION,
      new RegExp(slug),
    )
  }
  for (const variantKey of [
    'unilateral-square-stance-dip-drive',
    'unilateral-split-stance-dip-drive',
    'bilateral-square-stance-dip-drive',
    'working-arm-ipsilateral-to-lead-leg-split-jerk',
    'working-arm-contralateral-to-lead-leg-split-jerk',
    'bilateral-continuous-squat-to-press',
    'unilateral-continuous-squat-to-press',
  ]) {
    assert.match(
      LANDMINE_EXPLOSIVE_PRESS_COMPLETION_MIGRATION,
      new RegExp(variantKey),
    )
  }
  for (const videoId of [
    'MwXJebZh4nk',
    'M7P7qPojHZE',
    '2O-AaN6dUSc',
    'u-HAgu0odgY',
    'Rc23TMvgY34',
    'ccpp98MbLoM',
    '5Rebfu_-T98',
    'J4MJUcilrmo',
    '0oJsNm_MreY',
    'G9RpZXJcg10',
    'qFwUiUkMlFg',
  ]) {
    assert.match(
      LANDMINE_EXPLOSIVE_PRESS_COMPLETION_MIGRATION,
      new RegExp(videoId),
    )
  }
  assert.match(
    LANDMINE_EXPLOSIVE_PRESS_COMPLETION_MIGRATION,
    /greatest\(seed\.complexity, seed\.physical\)/,
  )
  assert.match(
    LANDMINE_EXPLOSIVE_PRESS_COMPLETION_MIGRATION,
    /'max_exercise_complexity_physical_difficulty'/,
  )
  for (const actionIdentity of [
    'push_press_no_receiving_dip',
    'split_jerk_receive',
    'full_squat_to_press',
  ]) {
    assert.match(
      LANDMINE_EXPLOSIVE_PRESS_COMPLETION_MIGRATION,
      new RegExp(actionIdentity),
    )
  }
  for (const profileKey of [
    'movement-intelligence-receive',
    'capacity-strength-power',
    'output-power',
  ]) {
    assert.match(
      LANDMINE_EXPLOSIVE_PRESS_COMPLETION_MIGRATION,
      new RegExp(profileKey),
    )
  }
  assert.match(
    LANDMINE_EXPLOSIVE_PRESS_COMPLETION_MIGRATION,
    /ARRAY\[1409,1410,1416,1417\]/,
  )
  assert.match(
    LANDMINE_EXPLOSIVE_PRESS_COMPLETION_MIGRATION,
    /migration-388 two-hand push-press consolidation/,
  )
  assert.match(
    LANDMINE_EXPLOSIVE_PRESS_COMPLETION_MIGRATION,
    /refused to overwrite % protected canonical definition/,
  )
  assert.match(
    LANDMINE_EXPLOSIVE_PRESS_COMPLETION_MIGRATION,
    /human-reviewed legacy score record/,
  )
  assert.match(
    LANDMINE_EXPLOSIVE_PRESS_COMPLETION_MIGRATION,
    /link_status = 'unverified'/,
  )
  assert.doesNotMatch(
    LANDMINE_EXPLOSIVE_PRESS_COMPLETION_MIGRATION,
    /link_status\s*(?:=|<>)\s*'pending'/,
  )
  assert.match(
    LANDMINE_EXPLOSIVE_PRESS_COMPLETION_MIGRATION,
    /embedding_allowed = FALSE/,
  )
  assert.match(
    LANDMINE_EXPLOSIVE_PRESS_COMPLETION_MIGRATION,
    /exact_variant_match = NULL/,
  )
  assert.match(
    LANDMINE_EXPLOSIVE_PRESS_COMPLETION_MIGRATION,
    /reviewer_user_id = NULL/,
  )
  for (const blocker of [
    'CARD-MEDIA-01',
    'CARD-PUBLISH-01',
    'CARD-GRAPH-03',
    'CARD-CALIBRATION-01',
  ]) {
    assert.match(
      LANDMINE_EXPLOSIVE_PRESS_COMPLETION_MIGRATION,
      new RegExp(blocker),
    )
  }
  assert.doesNotMatch(
    LANDMINE_EXPLOSIVE_PRESS_COMPLETION_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    LANDMINE_EXPLOSIVE_PRESS_COMPLETION_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    LANDMINE_EXPLOSIVE_PRESS_COMPLETION_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('landmine squat and lunge completion preserves identity review and difficulty-only scoring', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'402_coaching_landmine_squat_lunge_family_completion\.sql'/,
  )
  for (const slug of [
    'landmine-front-squat',
    'landmine-hack-squat',
    'landmine-split-squat',
    'landmine-reverse-lunge-to-press',
    'landmine-handle-grip-split-squat',
  ]) {
    assert.match(
      LANDMINE_SQUAT_LUNGE_COMPLETION_MIGRATION,
      new RegExp(slug),
    )
  }
  for (const variantKey of [
    'bilateral-central-chest-sleeve-front-squat',
    'unilateral-shoulder-rack-front-squat',
    'shoulder-supported-away-facing-hack-squat',
    'ipsilateral-shoulder-rack-stationary-split-squat',
    'contralateral-shoulder-rack-stationary-split-squat',
    'two-hand-neutral-handle-stationary-split-squat',
    'working-arm-ipsilateral-to-step-back-leg-drive-to-press',
    'working-arm-contralateral-to-step-back-leg-drive-to-press',
  ]) {
    assert.match(
      LANDMINE_SQUAT_LUNGE_COMPLETION_MIGRATION,
      new RegExp(variantKey),
    )
  }
  for (const videoId of [
    'docorX86lEg',
    'rxwiKvk4H2s',
    'oTRl7p13XtY',
    'hLVh6VDjpDg',
    'NfoJhEvRcFA',
    '0X3mydcwZGU',
    'KnT02UvXUJE',
    'BS9jpHWIwH8',
    'Vse04Q-SFz4',
    'c-MKGioqmbQ',
    'yx-ta5JphKo',
    'PSvv3LvzIkQ',
    'DqwMGTl4gvk',
    '1GzW5PGkmt8',
  ]) {
    assert.match(
      LANDMINE_SQUAT_LUNGE_COMPLETION_MIGRATION,
      new RegExp(videoId),
    )
  }
  for (const actionIdentity of [
    'front_supported_fixed_pivot_squat',
    'away_facing_shoulder_supported_hack_squat',
    'stationary_split_squat_no_step',
    'reverse_lunge_return_to_press',
  ]) {
    assert.match(
      LANDMINE_SQUAT_LUNGE_COMPLETION_MIGRATION,
      new RegExp(actionIdentity),
    )
  }
  assert.match(
    LANDMINE_SQUAT_LUNGE_COMPLETION_MIGRATION,
    /greatest\(seed\.complexity,seed\.physical\)/,
  )
  assert.match(
    LANDMINE_SQUAT_LUNGE_COMPLETION_MIGRATION,
    /'max_exercise_complexity_physical_difficulty'/,
  )
  assert.match(
    LANDMINE_SQUAT_LUNGE_COMPLETION_MIGRATION,
    /THEN 'resilience'/,
  )
  assert.doesNotMatch(
    LANDMINE_SQUAT_LUNGE_COMPLETION_MIGRATION,
    /THEN 'control_resilience'/,
  )
  const variantSeedBlock = LANDMINE_SQUAT_LUNGE_COMPLETION_MIGRATION.match(
    /INSERT INTO squat_lunge_variant_seed VALUES([\s\S]*?)\n\n  INSERT INTO coaching\.exercise_variant_v1/,
  )?.[1]
  assert.ok(variantSeedBlock)
  assert.doesNotMatch(variantSeedBlock, /,0,/)
  assert.match(
    LANDMINE_SQUAT_LUNGE_COMPLETION_MIGRATION,
    /ARRAY\[1418,1419,1420,1421,1452\]/,
  )
  assert.doesNotMatch(
    LANDMINE_SQUAT_LUNGE_COMPLETION_MIGRATION,
    /legacy_exercise_id = 1453/,
  )
  assert.match(
    LANDMINE_SQUAT_LUNGE_COMPLETION_MIGRATION,
    /requires the unresolved migration-369 split-squat review boundary/,
  )
  assert.match(
    LANDMINE_SQUAT_LUNGE_COMPLETION_MIGRATION,
    /lost the archived handle-grip split-squat source mapping/,
  )
  assert.match(
    LANDMINE_SQUAT_LUNGE_COMPLETION_MIGRATION,
    /link_status = 'unverified'/,
  )
  assert.doesNotMatch(
    LANDMINE_SQUAT_LUNGE_COMPLETION_MIGRATION,
    /link_status\s*(?:=|<>)\s*'pending'/,
  )
  assert.match(
    LANDMINE_SQUAT_LUNGE_COMPLETION_MIGRATION,
    /embedding_allowed = FALSE/,
  )
  assert.match(
    LANDMINE_SQUAT_LUNGE_COMPLETION_MIGRATION,
    /exact_variant_match = NULL/,
  )
  assert.match(
    LANDMINE_SQUAT_LUNGE_COMPLETION_MIGRATION,
    /reviewer_user_id = NULL/,
  )
  for (const blocker of [
    'CARD-IDENTITY-02',
    'CARD-MEDIA-01',
    'CARD-PUBLISH-01',
    'CARD-GRAPH-03',
    'CARD-CALIBRATION-01',
  ]) {
    assert.match(
      LANDMINE_SQUAT_LUNGE_COMPLETION_MIGRATION,
      new RegExp(blocker),
    )
  }
  assert.doesNotMatch(
    LANDMINE_SQUAT_LUNGE_COMPLETION_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    LANDMINE_SQUAT_LUNGE_COMPLETION_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    LANDMINE_SQUAT_LUNGE_COMPLETION_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('Cossack completion preserves consolidated variants and blocks unresolved identities', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'403_coaching_cossack_squat_family_completion\.sql'/,
  )
  for (const slug of [
    'cossack-squat',
    'cossack-shift-to-wall-ball-toss',
    'landmine-cossack-squat',
    'loaded-cossack-squat',
    'cossack-shift-with-reach',
  ]) {
    assert.match(COSSACK_SQUAT_COMPLETION_MIGRATION, new RegExp(slug))
  }
  for (const variantKey of [
    'baseline',
    'low-amplitude-shift',
    'bottom-hold',
    'bottom-pry',
    'shift-to-stick',
    'slow-eccentric-shift',
    'reach-overlay',
    'thoracic-rotation-reach',
    'kettlebell-loaded',
    'landmine-loaded',
    'loaded-unspecified-implement',
    'sandbag-loaded',
    'unresolved-throw-protocol',
  ]) {
    assert.match(COSSACK_SQUAT_COMPLETION_MIGRATION, new RegExp(variantKey))
  }
  for (const videoId of [
    'tpczTeSkHz0',
    'iPZNB5GsOnM',
    'nLNqEQ4B6XI',
    'Zi_x6s6YXHo',
    'usfu415_0AI',
    'ZHp6dQyNTnA',
    'WpsIRIJGW5o',
    'G5C_rmEPVJU',
    'OagZ48JldgQ',
    'vQ45G3IXYKs',
  ]) {
    assert.match(COSSACK_SQUAT_COMPLETION_MIGRATION, new RegExp(videoId))
  }
  assert.match(
    COSSACK_SQUAT_COMPLETION_MIGRATION,
    /greatest\(seed\.complexity,seed\.physical\)/,
  )
  assert.match(
    COSSACK_SQUAT_COMPLETION_MIGRATION,
    /'max_exercise_complexity_physical_difficulty'/,
  )
  assert.match(
    COSSACK_SQUAT_COMPLETION_MIGRATION,
    /'scoreDeferred',TRUE/,
  )
  assert.match(
    COSSACK_SQUAT_COMPLETION_MIGRATION,
    /requires all 12 migration-307 Cossack consolidations/,
  )
  assert.match(
    COSSACK_SQUAT_COMPLETION_MIGRATION,
    /expected all 15 legacy mappings on the active survivor set/,
  )
  assert.match(
    COSSACK_SQUAT_COMPLETION_MIGRATION,
    /did not create all 23 contextual or review-only profiles/,
  )
  assert.match(
    COSSACK_SQUAT_COMPLETION_MIGRATION,
    /did not create all 10 unverified, non-embeddable media candidates/,
  )
  assert.match(
    COSSACK_SQUAT_COMPLETION_MIGRATION,
    /link_status = 'unverified'/,
  )
  assert.doesNotMatch(
    COSSACK_SQUAT_COMPLETION_MIGRATION,
    /link_status\s*(?:=|<>)\s*'pending'/,
  )
  assert.match(
    COSSACK_SQUAT_COMPLETION_MIGRATION,
    /WHEN seed\.selectable THEN 'primary'\s+ELSE 'avoid'/,
  )
  assert.match(
    COSSACK_SQUAT_COMPLETION_MIGRATION,
    /\('prepare-control','prepare_and_access'\)/,
  )
  assert.match(
    COSSACK_SQUAT_COMPLETION_MIGRATION,
    /SELECT 'identity-review-only','prepare_and_access'/,
  )
  assert.doesNotMatch(
    COSSACK_SQUAT_COMPLETION_MIGRATION,
    /ELSE 'review_only'|'identity_review'/,
  )
  assert.match(
    COSSACK_SQUAT_COMPLETION_MIGRATION,
    /embedding_allowed = FALSE/,
  )
  assert.match(
    COSSACK_SQUAT_COMPLETION_MIGRATION,
    /exact_variant_match = NULL/,
  )
  assert.match(
    COSSACK_SQUAT_COMPLETION_MIGRATION,
    /reviewer_user_id = NULL/,
  )
  for (const blocker of [
    'CARD-IDENTITY-03',
    'CARD-IDENTITY-04',
    'CARD-MEDIA-01',
    'CARD-PUBLISH-01',
    'CARD-GRAPH-03',
    'CARD-CALIBRATION-01',
  ]) {
    assert.match(COSSACK_SQUAT_COMPLETION_MIGRATION, new RegExp(blocker))
  }
  assert.doesNotMatch(
    COSSACK_SQUAT_COMPLETION_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    COSSACK_SQUAT_COMPLETION_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    COSSACK_SQUAT_COMPLETION_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('Adductor Rockback completion preserves support variants and defers unresolved identities', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'404_coaching_adductor_rockback_family_completion\.sql'/,
  )
  for (const slug of [
    'adductor-rockback',
    'adductor-rockback-with-reach',
    'adductor-rock-back-with-t-spine-reach',
    'half-kneeling-adductor-rockback',
  ]) {
    assert.match(ADDUCTOR_ROCKBACK_COMPLETION_MIGRATION, new RegExp(slug))
  }
  for (const variantKey of [
    'baseline',
    'reach-overlay-unresolved',
    'thoracic-rotation-reach',
    'half-kneeling-kicking-access',
    'elevated-hand-support',
  ]) {
    assert.match(ADDUCTOR_ROCKBACK_COMPLETION_MIGRATION, new RegExp(variantKey))
  }
  for (const videoId of [
    'Vr0Us9LPGRg',
    'yF8o6I6aSZg',
    'zfO4HhPUxDw',
    'Gf2eQUxG2HM',
    'OH1uIXf0y-w',
  ]) {
    assert.match(ADDUCTOR_ROCKBACK_COMPLETION_MIGRATION, new RegExp(videoId))
  }
  assert.match(
    ADDUCTOR_ROCKBACK_COMPLETION_MIGRATION,
    /'baseOverallDifficulty',greatest\(seed\.complexity,seed\.physical\)/,
  )
  assert.match(
    ADDUCTOR_ROCKBACK_COMPLETION_MIGRATION,
    /'difficultyModel','max_exercise_complexity_physical_difficulty'/,
  )
  assert.match(
    ADDUCTOR_ROCKBACK_COMPLETION_MIGRATION,
    /'scoreDeferred',TRUE/,
  )
  assert.match(
    ADDUCTOR_ROCKBACK_COMPLETION_MIGRATION,
    /requires all 3 migration-308 Adductor Rockback consolidations/,
  )
  for (const expected of [
    'did not create all 5 exact review variants',
    'did not create all 5 contextual or review-only profiles',
    'did not create all 16 candidate evidence rows',
    'did not create all 5 unverified, non-embeddable media candidates',
    'did not create all 11 candidate alternate assessments',
    'did not create all 6 review-only relationships',
    'did not create all 6 review-only calibration rows',
  ]) {
    assert.match(ADDUCTOR_ROCKBACK_COMPLETION_MIGRATION, new RegExp(expected))
  }
  assert.match(
    ADDUCTOR_ROCKBACK_COMPLETION_MIGRATION,
    /WHEN seed\.selectable THEN 'primary'\s+ELSE 'avoid'/,
  )
  assert.match(
    ADDUCTOR_ROCKBACK_COMPLETION_MIGRATION,
    /'prepare_and_access'/,
  )
  assert.match(
    ADDUCTOR_ROCKBACK_COMPLETION_MIGRATION,
    /link_status = 'unverified'/,
  )
  assert.match(
    ADDUCTOR_ROCKBACK_COMPLETION_MIGRATION,
    /embedding_allowed = FALSE/,
  )
  assert.match(
    ADDUCTOR_ROCKBACK_COMPLETION_MIGRATION,
    /exact_variant_match = NULL/,
  )
  assert.match(
    ADDUCTOR_ROCKBACK_COMPLETION_MIGRATION,
    /reviewer_user_id = NULL/,
  )
  for (const blocker of [
    'CARD-IDENTITY-03',
    'CARD-IDENTITY-04',
    'CARD-MEDIA-01',
    'CARD-PUBLISH-01',
    'CARD-GRAPH-03',
    'CARD-CALIBRATION-01',
  ]) {
    assert.match(ADDUCTOR_ROCKBACK_COMPLETION_MIGRATION, new RegExp(blocker))
  }
  assert.doesNotMatch(
    ADDUCTOR_ROCKBACK_COMPLETION_MIGRATION,
    /link_status\s*(?:=|<>)\s*'pending'/,
  )
  assert.doesNotMatch(
    ADDUCTOR_ROCKBACK_COMPLETION_MIGRATION,
    /ELSE 'review_only'|'identity_review'/,
  )
  assert.doesNotMatch(
    ADDUCTOR_ROCKBACK_COMPLETION_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    ADDUCTOR_ROCKBACK_COMPLETION_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    ADDUCTOR_ROCKBACK_COMPLETION_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('Backpedal-to-Sprint completion preserves terminal-action boundaries and exact delivery contracts', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'407_coaching_backpedal_to_sprint_family_completion\.sql'/,
  )
  for (const slug of [
    'backpedal-to-sprint-turn',
    'backpedal-to-sprint-open-turn',
    'backpedal-to-sprint-turn-on-signal',
    'backpedal-to-sprint-to-stick',
    'backpedal-turn-to-hop-and-go',
  ]) {
    assert.match(BACKPEDAL_TO_SPRINT_COMPLETION_MIGRATION, new RegExp(slug))
  }
  for (const variantKey of [
    'preplanned-90',
    'preplanned-180',
    'reactive-90',
    'reactive-180',
    'preplanned-90-stick',
    'preplanned-180-stick',
    'reactive-90-stick',
    'reactive-180-stick',
    'free-deceleration-no-hold-unresolved',
  ]) {
    assert.match(
      BACKPEDAL_TO_SPRINT_COMPLETION_MIGRATION,
      new RegExp(variantKey),
    )
  }
  for (const videoId of [
    'efQLNVcbacY',
    'uCsY1saY1og',
    'pjMhiDcQrNE',
    'pkegBuBghpg',
    '8DTlAOcua6s',
    'H2d-tqSKxtg',
    'II72PAlImbM',
    'sz45B4GpEXw',
    'xmQ6aSsDaE4',
  ]) {
    assert.match(
      BACKPEDAL_TO_SPRINT_COMPLETION_MIGRATION,
      new RegExp(videoId),
    )
  }
  assert.match(
    BACKPEDAL_TO_SPRINT_COMPLETION_MIGRATION,
    /'baseOverallDifficulty',greatest\(seed\.complexity,seed\.physical\)/,
  )
  assert.match(
    BACKPEDAL_TO_SPRINT_COMPLETION_MIGRATION,
    /'difficultyModel','max_exercise_complexity_physical_difficulty'/,
  )
  assert.match(
    BACKPEDAL_TO_SPRINT_COMPLETION_MIGRATION,
    /'scoreDeferred',TRUE/,
  )
  assert.match(
    BACKPEDAL_TO_SPRINT_COMPLETION_MIGRATION,
    /requires both migration-339 Backpedal-to-Sprint consolidations/,
  )
  assert.match(
    BACKPEDAL_TO_SPRINT_COMPLETION_MIGRATION,
    /requires the researched sprint-through versus terminal-stick identity boundary/,
  )
  assert.match(
    BACKPEDAL_TO_SPRINT_COMPLETION_MIGRATION,
    /open_turn_sprint_through_vs_required_hop_contact_then_go/,
  )
  assert.match(
    BACKPEDAL_TO_SPRINT_COMPLETION_MIGRATION,
    /did not persist the Open Turn versus Hop-and-Go distinct boundary/,
  )
  for (const expected of [
    'did not create all 9 exact review variants',
    'did not create all 17 contextual or review-only profiles',
    'did not create all 32 candidate evidence rows',
    'did not create all 10 unverified, non-embeddable media candidates',
    'did not create all 10 candidate alternate assessments',
    'did not create all 16 review-only relationships',
    'did not create all 16 review-only calibration rows',
    'did not create both quarantined card test packets',
  ]) {
    assert.match(
      BACKPEDAL_TO_SPRINT_COMPLETION_MIGRATION,
      new RegExp(expected),
    )
  }
  for (const legacyExerciseId of [123, 297, 549, 1242]) {
    assert.match(
      BACKPEDAL_TO_SPRINT_COMPLETION_MIGRATION,
      new RegExp(`\\(${legacyExerciseId}::BIGINT`),
    )
  }
  for (const profileKey of [
    'movement-rehearsal',
    'quality-output',
    'identity-review-only',
  ]) {
    assert.match(
      BACKPEDAL_TO_SPRINT_COMPLETION_MIGRATION,
      new RegExp(profileKey),
    )
  }
  for (const phaseKey of ['movement_intelligence', 'output']) {
    assert.match(
      BACKPEDAL_TO_SPRINT_COMPLETION_MIGRATION,
      new RegExp(`'${phaseKey}'`),
    )
  }
  assert.match(
    BACKPEDAL_TO_SPRINT_COMPLETION_MIGRATION,
    /link_status = 'unverified'/,
  )
  assert.match(
    BACKPEDAL_TO_SPRINT_COMPLETION_MIGRATION,
    /embedding_allowed = FALSE/,
  )
  assert.match(
    BACKPEDAL_TO_SPRINT_COMPLETION_MIGRATION,
    /exact_variant_match = NULL/,
  )
  assert.match(
    BACKPEDAL_TO_SPRINT_COMPLETION_MIGRATION,
    /reviewer_user_id = NULL/,
  )
  for (const blocker of [
    'CARD-EVIDENCE-02',
    'CARD-IDENTITY-05',
    'CARD-MEDIA-01',
    'CARD-PUBLISH-01',
    'CARD-GRAPH-03',
    'CARD-CALIBRATION-01',
  ]) {
    assert.match(
      BACKPEDAL_TO_SPRINT_COMPLETION_MIGRATION,
      new RegExp(blocker),
    )
  }
  assert.doesNotMatch(
    BACKPEDAL_TO_SPRINT_COMPLETION_MIGRATION,
    /link_status\s*(?:=|<>)\s*'pending'/,
  )
  assert.doesNotMatch(
    BACKPEDAL_TO_SPRINT_COMPLETION_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    BACKPEDAL_TO_SPRINT_COMPLETION_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    BACKPEDAL_TO_SPRINT_COMPLETION_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('Hang-family completion preserves passive, active-isometric, and dynamic scapular identities', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'408_coaching_hang_family_research_completion\.sql'/,
  )
  for (const slug of [
    'dead-hang',
    'active-hang',
    'scapular-pull-up',
    'active-hang-scapular-hold',
    'pull-up-chin-up',
  ]) {
    assert.match(HANG_FAMILY_RESEARCH_COMPLETION_MIGRATION, new RegExp(slug))
  }
  for (const variantKey of [
    'baseline',
    'foot-assisted',
    'band-assisted',
    'ring',
    'weighted',
    'single-arm',
  ]) {
    assert.match(
      HANG_FAMILY_RESEARCH_COMPLETION_MIGRATION,
      new RegExp(variantKey),
    )
  }
  for (const videoId of [
    '0Bx_Ap7-EwU',
    '2vspW4N4BMs',
    '0HBhuaD_S7M',
    'AH8YrGT9s1s',
    'EmQVeAF_CJ0',
    '0_YZc2yuKkE',
    'kKXyCA7i-20',
    'mtOAYPGRBMc',
    'lqy8oud8FgQ',
    'thmWJ-Z749M',
    '-ZIpSoTRsuE',
    'XIkPI-_80r4',
    'd0DVd2V0n7A',
    'qVFX6LnZF4A',
    'kCoCVLZvI8E',
  ]) {
    assert.match(
      HANG_FAMILY_RESEARCH_COMPLETION_MIGRATION,
      new RegExp(videoId),
    )
  }
  assert.match(
    HANG_FAMILY_RESEARCH_COMPLETION_MIGRATION,
    /'difficultyModel','max_exercise_complexity_physical_difficulty'/,
  )
  assert.match(
    HANG_FAMILY_RESEARCH_COMPLETION_MIGRATION,
    /greatest\(seed\.complexity,seed\.physical\)/,
  )
  assert.match(
    HANG_FAMILY_RESEARCH_COMPLETION_MIGRATION,
    /'scoreDeferred',seed\.complexity IS NULL OR seed\.physical IS NULL/,
  )
  assert.match(
    HANG_FAMILY_RESEARCH_COMPLETION_MIGRATION,
    /Historical passive-or-active compound source remains identity-quarantined and deliberately unscored/,
  )
  for (const expected of [
    'expected exactly all 6 migration-309 hang-family legacy mappings',
    'requires all 18 exact migration-313 review variants',
    'requires all 19 exact contextual hang-family delivery profiles',
    'requires all 5 researched hang-family identity boundaries and consolidations',
    'did not create all 48 candidate evidence rows',
    'did not create all 15 unverified, non-embeddable media candidates',
    'requires exactly 5 current media candidates per definition',
    'did not create all 33 candidate alternate assessments',
    'did not preserve 17 progression and create 17 inverse regression proposals',
    'did not create all 36 review-only calibration rows',
    'did not create all 3 quarantined card test packets',
  ]) {
    assert.match(
      HANG_FAMILY_RESEARCH_COMPLETION_MIGRATION,
      new RegExp(expected),
    )
  }
  for (const legacyExerciseId of [200, 201, 820, 857, 1074, 1689]) {
    assert.match(
      HANG_FAMILY_RESEARCH_COMPLETION_MIGRATION,
      new RegExp(`\\(${legacyExerciseId}::BIGINT`),
    )
  }
  assert.match(
    HANG_FAMILY_RESEARCH_COMPLETION_MIGRATION,
    /link_status = 'unverified'/,
  )
  assert.match(
    HANG_FAMILY_RESEARCH_COMPLETION_MIGRATION,
    /embedding_allowed = FALSE/,
  )
  assert.match(
    HANG_FAMILY_RESEARCH_COMPLETION_MIGRATION,
    /exact_variant_match = NULL/,
  )
  assert.match(
    HANG_FAMILY_RESEARCH_COMPLETION_MIGRATION,
    /reviewer_user_id = NULL/,
  )
  for (const blocker of [
    'CARD-EVIDENCE-02',
    'CARD-IDENTITY-05',
    'CARD-MEDIA-01',
    'CARD-GRAPH-03',
    'CARD-CALIBRATION-01',
    'CARD-PUBLISH-01',
  ]) {
    assert.match(
      HANG_FAMILY_RESEARCH_COMPLETION_MIGRATION,
      new RegExp(blocker),
    )
  }
  assert.doesNotMatch(
    HANG_FAMILY_RESEARCH_COMPLETION_MIGRATION,
    /link_status\s*(?:=|<>)\s*'pending'/,
  )
  assert.doesNotMatch(
    HANG_FAMILY_RESEARCH_COMPLETION_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    HANG_FAMILY_RESEARCH_COMPLETION_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    HANG_FAMILY_RESEARCH_COMPLETION_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('Support-compression completion separates grounded lifts, V-Sit, and Manna without exercise skill levels', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'409_coaching_support_compression_research_completion\.sql'/,
  )
  for (const slug of [
    'straddle-compression-lift',
    'v-sit',
    'manna-hold',
    'l-sit',
  ]) {
    assert.match(
      SUPPORT_COMPRESSION_RESEARCH_COMPLETION_MIGRATION,
      new RegExp(slug),
    )
  }
  for (const variantKey of [
    'baseline',
    'bent-knee',
    'pike',
    'single-leg-pike',
    'straddle',
    'ring-support',
  ]) {
    assert.match(
      SUPPORT_COMPRESSION_RESEARCH_COMPLETION_MIGRATION,
      new RegExp(variantKey),
    )
  }
  for (const boundaryKey of [
    'grounded_dynamic_leg_lift_vs_static_above_horizontal_support',
    'above_horizontal_v_position_vs_hips_and_legs_beyond_shoulders',
    'grounded_dynamic_compression_vs_extreme_posterior_support_hold',
  ]) {
    assert.match(
      SUPPORT_COMPRESSION_RESEARCH_COMPLETION_MIGRATION,
      new RegExp(boundaryKey),
    )
  }
  for (const videoId of [
    'WR3C2cliSaA',
    'yQXnOuQqKYc',
    '6w4gmF0NUX0',
    'hEo814VH208',
    'mC4sBN6E_R8',
    '3HAQXpSpHBA',
    'm2Di7xThWx0',
    'P83rvEDFTjg',
    'dzpeUQIp0cY',
    'ARiWA2R6gzM',
    'KJFW2rnownQ',
    'dTPEnTZnHHo',
    'OLFnFSTqP_c',
    '7r5HgYtuwSs',
    'BKwVJrGf5do',
  ]) {
    assert.match(
      SUPPORT_COMPRESSION_RESEARCH_COMPLETION_MIGRATION,
      new RegExp(videoId),
    )
  }
  assert.match(
    SUPPORT_COMPRESSION_RESEARCH_COMPLETION_MIGRATION,
    /'difficultyModel','max_exercise_complexity_physical_difficulty'/,
  )
  assert.match(
    SUPPORT_COMPRESSION_RESEARCH_COMPLETION_MIGRATION,
    /greatest\(seed\.complexity,seed\.physical\)/,
  )
  for (const expected of [
    'expected exactly all 3 migration-312 legacy mappings',
    'requires exactly all 8 migration-312 review variants',
    'requires exactly all 8 migration-312 delivery profiles',
    'did not preserve or create all 4 support-compression identity boundaries',
    'did not create all 48 candidate evidence rows',
    'did not create all 15 unverified, non-embeddable media candidates',
    'requires exactly 5 current media candidates per definition',
    'did not create all 24 candidate alternate assessments',
    'did not preserve 8 graph proposals and create all 7 inverse proposals',
    'did not create all 16 review-only calibration rows',
    'did not create all 3 quarantined card test packets',
  ]) {
    assert.match(
      SUPPORT_COMPRESSION_RESEARCH_COMPLETION_MIGRATION,
      new RegExp(expected),
    )
  }
  for (const legacyExerciseId of [803, 1704, 1705]) {
    assert.match(
      SUPPORT_COMPRESSION_RESEARCH_COMPLETION_MIGRATION,
      new RegExp(`\\(${legacyExerciseId}::BIGINT`),
    )
  }
  for (const blocker of [
    'CARD-EVIDENCE-02',
    'CARD-IDENTITY-05',
    'CARD-MEDIA-01',
    'CARD-GRAPH-03',
    'CARD-CALIBRATION-01',
    'CARD-PUBLISH-01',
  ]) {
    assert.match(
      SUPPORT_COMPRESSION_RESEARCH_COMPLETION_MIGRATION,
      new RegExp(blocker),
    )
  }
  assert.match(
    SUPPORT_COMPRESSION_RESEARCH_COMPLETION_MIGRATION,
    /link_status='unverified'/,
  )
  assert.match(
    SUPPORT_COMPRESSION_RESEARCH_COMPLETION_MIGRATION,
    /embedding_allowed=FALSE/,
  )
  assert.match(
    SUPPORT_COMPRESSION_RESEARCH_COMPLETION_MIGRATION,
    /exact_variant_match=NULL/,
  )
  assert.match(
    SUPPORT_COMPRESSION_RESEARCH_COMPLETION_MIGRATION,
    /reviewer_user_id=NULL/,
  )
  assert.match(
    SUPPORT_COMPRESSION_RESEARCH_COMPLETION_MIGRATION,
    /'authoredDirection',TRUE/,
  )
  assert.match(
    SUPPORT_COMPRESSION_RESEARCH_COMPLETION_MIGRATION,
    /NOT \(coalesce\(relationship\.conditions_json,'\{\}'::JSONB\)\?'inverseOfRelationship'\)/,
  )
  assert.doesNotMatch(
    SUPPORT_COMPRESSION_RESEARCH_COMPLETION_MIGRATION,
    /link_status\s*(?:=|<>)\s*'pending'/,
  )
  assert.doesNotMatch(
    SUPPORT_COMPRESSION_RESEARCH_COMPLETION_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|formalProficiencyScope|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    SUPPORT_COMPRESSION_RESEARCH_COMPLETION_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    SUPPORT_COMPRESSION_RESEARCH_COMPLETION_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('Hanging Leg Raise and L-Sit completion preserves support and contraction identities without exercise skill levels', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'410_coaching_hanging_leg_raise_l_sit_research_completion\.sql'/,
  )
  for (const slug of ['hanging-leg-raise', 'l-sit', 'hanging-l-sit']) {
    assert.match(
      HANGING_LEG_RAISE_L_SIT_RESEARCH_COMPLETION_MIGRATION,
      new RegExp(slug),
    )
  }
  for (const variantKey of [
    'baseline',
    'straight-leg',
    'bent-knee-eccentric-lower',
    'tuck',
    'one-leg',
    'straddle',
    'ring-support',
  ]) {
    assert.match(
      HANGING_LEG_RAISE_L_SIT_RESEARCH_COMPLETION_MIGRATION,
      new RegExp(variantKey),
    )
  }
  for (const boundaryKey of [
    'straight_arm_push_support_vs_overhead_suspension',
    'dynamic_hanging_hip_flexion_vs_static_hanging_hold',
    'static_push_support_hold_vs_dynamic_overhead_suspension',
  ]) {
    assert.match(
      HANGING_LEG_RAISE_L_SIT_RESEARCH_COMPLETION_MIGRATION,
      new RegExp(boundaryKey),
    )
  }
  for (const videoId of [
    'dPwg1E_ygjc',
    'p9hhX_Sx5v0',
    'fLbZrF6MZuE',
    'PjlPiVTtWA4',
    'XykqIceOdso',
    'H_iZG5-L_KI',
    'IUZJoSP66HI',
    'eywCpp0p7lg',
    'jceq8cCj1z8',
    'r-LQKNxGJB0',
    'WHi1bvZLwlw',
    '784YzIaJSJg',
    'U5q6xbZ74Hw',
    'zTNEqU6pWuE',
    'TWpGkp1TvG0',
  ]) {
    assert.match(
      HANGING_LEG_RAISE_L_SIT_RESEARCH_COMPLETION_MIGRATION,
      new RegExp(videoId),
    )
  }
  for (const researchBatch of [
    'hanging-leg-raise-family-v1',
    'l-sit-support-and-hanging-family-v1',
  ]) {
    assert.match(
      HANGING_LEG_RAISE_L_SIT_RESEARCH_COMPLETION_MIGRATION,
      new RegExp(researchBatch),
    )
  }
  assert.match(
    HANGING_LEG_RAISE_L_SIT_RESEARCH_COMPLETION_MIGRATION,
    /'difficultyModel','max_exercise_complexity_physical_difficulty'/,
  )
  assert.match(
    HANGING_LEG_RAISE_L_SIT_RESEARCH_COMPLETION_MIGRATION,
    /greatest\(seed\.complexity,seed\.physical\)/,
  )
  for (const expected of [
    'expected exactly all 7 migration-310/311 legacy mappings',
    'requires exactly all 11 migration-310/311 review variants',
    'requires exactly all 11 migration-310/311 delivery profiles',
    'did not create all 3 Hanging Leg Raise/L-Sit identity boundaries',
    'did not create all 48 candidate evidence rows',
    'did not create all 15 unverified, non-embeddable media candidates',
    'requires exactly 5 current media candidates per definition',
    'did not create all 36 candidate alternate assessments',
    'did not preserve 9 graph proposals, add 4 authored proposals, and create 11 inverse proposals',
    'did not create all 22 review-only calibration rows',
    'did not create all 3 quarantined card test packets',
  ]) {
    assert.match(
      HANGING_LEG_RAISE_L_SIT_RESEARCH_COMPLETION_MIGRATION,
      new RegExp(expected),
    )
  }
  for (const legacyExerciseId of [603, 604, 605, 778, 804, 819]) {
    assert.match(
      HANGING_LEG_RAISE_L_SIT_RESEARCH_COMPLETION_MIGRATION,
      new RegExp(`\\(${legacyExerciseId},|\\b${legacyExerciseId}\\b`),
    )
  }
  for (const blocker of [
    'CARD-EVIDENCE-02',
    'CARD-IDENTITY-05',
    'CARD-MEDIA-01',
    'CARD-GRAPH-03',
    'CARD-CALIBRATION-01',
    'CARD-PUBLISH-01',
  ]) {
    assert.match(
      HANGING_LEG_RAISE_L_SIT_RESEARCH_COMPLETION_MIGRATION,
      new RegExp(blocker),
    )
  }
  assert.match(
    HANGING_LEG_RAISE_L_SIT_RESEARCH_COMPLETION_MIGRATION,
    /'authoredDirection',TRUE/,
  )
  assert.match(
    HANGING_LEG_RAISE_L_SIT_RESEARCH_COMPLETION_MIGRATION,
    /NOT\(coalesce\(relationship\.conditions_json,'\{\}'::JSONB\)\?'inverseOfRelationship'\)/,
  )
  assert.match(
    HANGING_LEG_RAISE_L_SIT_RESEARCH_COMPLETION_MIGRATION,
    /link_status='unverified'/,
  )
  assert.match(
    HANGING_LEG_RAISE_L_SIT_RESEARCH_COMPLETION_MIGRATION,
    /embedding_allowed=FALSE/,
  )
  assert.match(
    HANGING_LEG_RAISE_L_SIT_RESEARCH_COMPLETION_MIGRATION,
    /exact_variant_match=NULL/,
  )
  assert.match(
    HANGING_LEG_RAISE_L_SIT_RESEARCH_COMPLETION_MIGRATION,
    /reviewer_user_id=NULL/,
  )
  assert.doesNotMatch(
    HANGING_LEG_RAISE_L_SIT_RESEARCH_COMPLETION_MIGRATION,
    /link_status\s*(?:=|<>)\s*'pending'/,
  )
  assert.doesNotMatch(
    HANGING_LEG_RAISE_L_SIT_RESEARCH_COMPLETION_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|formalProficiencyScope|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    HANGING_LEG_RAISE_L_SIT_RESEARCH_COMPLETION_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    HANGING_LEG_RAISE_L_SIT_RESEARCH_COMPLETION_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('A-series completion consolidates cue labels and blocks unresolved contact contracts', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'411_coaching_a_series_sprint_drills_research_completion\.sql'/,
  )
  for (const slug of [
    'a-march',
    'a-march-linear',
    'a-march-mobility-with-arm-sweep',
    'a-march-to-projection',
    'a-skip',
    'a-skip-pogo-rhythm',
    'a-skip-rhythm-punch',
    'a-skip-snap-down',
    'a-skip-through-cone-gates',
    'a-skip-through-ladder',
    'a-skip-for-approach-rhythm',
    'high-knee-a-march-ladder',
  ]) {
    assert.match(
      A_SERIES_SPRINT_DRILLS_RESEARCH_COMPLETION_MIGRATION,
      new RegExp(slug),
    )
  }
  for (const identityMatch of [
    'same_a_march_with_low_cadence_arm_action_emphasis',
    'same_a_skip_with_rhythm_and_active_downstroke_cue',
    'same_a_skip_with_active_downstroke_cue_not_bilateral_snap_down',
    'same_a_skip_with_jump_approach_context_annotation',
  ]) {
    assert.match(
      A_SERIES_SPRINT_DRILLS_RESEARCH_COMPLETION_MIGRATION,
      new RegExp(identityMatch),
    )
  }
  for (const boundaryKey of [
    'no_flight_alternating_march_vs_step_hop_skip_with_flight',
    'base_no_flight_march_vs_unresolved_projection_sequence',
    'ordinary_step_hop_skip_vs_unresolved_added_pogo_contact',
    'base_a_skip_vs_unresolved_cone_gate_contact_rule',
    'base_a_skip_vs_unresolved_ladder_cell_contact_rule',
    'no_flight_a_march_vs_unresolved_march_or_running_ladder_contacts',
  ]) {
    assert.match(
      A_SERIES_SPRINT_DRILLS_RESEARCH_COMPLETION_MIGRATION,
      new RegExp(boundaryKey),
    )
  }
  for (const profileKey of [
    'arm-sweep-mobility-context',
    'rhythm-punch-cue',
    'snap-down-cue',
    'approach-rhythm-context',
  ]) {
    assert.match(
      A_SERIES_SPRINT_DRILLS_RESEARCH_COMPLETION_MIGRATION,
      new RegExp(profileKey),
    )
  }
  for (const expected of [
    'requires exactly 7 active A-series canonical definitions',
    'requires exactly all 12 audited legacy A-series mappings',
    'requires one active baseline variant per canonical definition',
    'did not create all 6 A-series active identity boundaries',
    'did not create all 112 candidate evidence rows',
    'did not create all 35 unverified media candidates',
    'requires exactly 5 current media candidates per definition',
    'did not create all 35 candidate alternate assessments',
    'requires 8 retained and 4 contextual delivery profiles',
    'did not create 6 authored and 6 inverse graph proposals',
    'did not create all 14 review-only calibration rows',
    'did not create all 7 quarantined card test packets',
    'left an unresolved A-series definition structurally selectable',
  ]) {
    assert.match(
      A_SERIES_SPRINT_DRILLS_RESEARCH_COMPLETION_MIGRATION,
      new RegExp(expected),
    )
  }
  for (const blocker of [
    'CARD-IDENTITY-06',
    'CARD-SELECTION-02',
    'CARD-EVIDENCE-02',
    'CARD-MEDIA-01',
    'CARD-GRAPH-03',
    'CARD-CALIBRATION-01',
    'CARD-PUBLISH-01',
  ]) {
    assert.match(
      A_SERIES_SPRINT_DRILLS_RESEARCH_COMPLETION_MIGRATION,
      new RegExp(blocker),
    )
  }
  assert.match(
    A_SERIES_SPRINT_DRILLS_RESEARCH_COMPLETION_MIGRATION,
    /'difficultyModel','max_exercise_complexity_physical_difficulty'/,
  )
  assert.match(
    A_SERIES_SPRINT_DRILLS_RESEARCH_COMPLETION_MIGRATION,
    /greatest\(seed\.complexity,seed\.physical\)/,
  )
  assert.match(
    A_SERIES_SPRINT_DRILLS_RESEARCH_COMPLETION_MIGRATION,
    /'authoredDirection',TRUE/,
  )
  assert.match(
    A_SERIES_SPRINT_DRILLS_RESEARCH_COMPLETION_MIGRATION,
    /NOT\(coalesce\(relationship\.conditions_json,'\{\}'::JSONB\)\?'inverseOfRelationship'\)/,
  )
  assert.match(
    A_SERIES_SPRINT_DRILLS_RESEARCH_COMPLETION_MIGRATION,
    /link_status='unverified'/,
  )
  assert.match(
    A_SERIES_SPRINT_DRILLS_RESEARCH_COMPLETION_MIGRATION,
    /embedding_allowed=FALSE/,
  )
  assert.match(
    A_SERIES_SPRINT_DRILLS_RESEARCH_COMPLETION_MIGRATION,
    /exact_variant_match=NULL/,
  )
  assert.match(
    A_SERIES_SPRINT_DRILLS_RESEARCH_COMPLETION_MIGRATION,
    /reviewer_user_id=NULL/,
  )
  assert.doesNotMatch(
    A_SERIES_SPRINT_DRILLS_RESEARCH_COMPLETION_MIGRATION,
    /link_status\s*(?:=|<>)\s*'pending'/,
  )
  assert.doesNotMatch(
    A_SERIES_SPRINT_DRILLS_RESEARCH_COMPLETION_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|formalProficiencyScope|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    A_SERIES_SPRINT_DRILLS_RESEARCH_COMPLETION_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    A_SERIES_SPRINT_DRILLS_RESEARCH_COMPLETION_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('ankling and straight-leg completion corrects lineage and quarantines unresolved contacts', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'412_coaching_ankling_straight_leg_identity_lineage_correction\.sql'/,
  )
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'413_coaching_ankling_straight_leg_research_completion\.sql'/,
  )
  for (const slug of [
    'ankle-pogo-in-place',
    'low-pogos',
    'ankling-pogo-hop',
    'wall-ankling-pogo',
    'ankling-dribble-march',
    'ankling-drill',
    'ankling-walk',
    'fast-ankling-pogo-march',
    'distance-jump-straight-leg-bound-march',
    'distance-jump-straight-leg-bound',
    'straight-leg-ankling-ladder',
    'straight-leg-bounds-to-sprint',
  ]) {
    assert.match(
      ANKLING_STRAIGHT_LEG_IDENTITY_CORRECTION_MIGRATION +
        ANKLING_STRAIGHT_LEG_RESEARCH_COMPLETION_MIGRATION,
      new RegExp(slug),
    )
  }
  for (const correction of [
    'stationary_bilateral_low_pogo_identity',
    'unresolved_wall_supported_ankling_contract',
    'same_traveling_ankling_with_dribble_learning_cadence',
    'same_traveling_ankling_with_walk_learning_cadence',
    'straight_leg_march_no_flight',
    'refused to override a human identity decision',
    'expected nine surviving active family definitions',
  ]) {
    assert.match(
      ANKLING_STRAIGHT_LEG_IDENTITY_CORRECTION_MIGRATION,
      new RegExp(correction),
    )
  }
  for (const profileKey of [
    'low-pogo-preparation',
    'dribble-march-learning-cadence',
    'ankling-walk-learning-cadence',
  ]) {
    assert.match(
      ANKLING_STRAIGHT_LEG_RESEARCH_COMPLETION_MIGRATION,
      new RegExp(profileKey),
    )
  }
  for (const expected of [
    'requires exactly nine active corrected definitions',
    'requires exactly all % audited source mappings',
    'requires one active baseline variant per definition',
    'expected 144 candidate evidence rows',
    'expected 45 quarantined media candidates',
    'requires exactly five current media candidates per card',
    'expected 45 candidate alternate assessments',
    'expected ten retained plus three contextual profiles',
    'expected eight authored and eight inverse graph proposals',
    'expected 18 review-only calibration rows',
    'expected nine current quarantined test packets',
    'found an unresolved card that remains selectable',
  ]) {
    assert.match(
      ANKLING_STRAIGHT_LEG_RESEARCH_COMPLETION_MIGRATION,
      new RegExp(expected),
    )
  }
  for (const blocker of [
    'CARD-IDENTITY-06',
    'CARD-SELECTION-02',
    'CARD-EVIDENCE-02',
    'CARD-MEDIA-01',
    'CARD-GRAPH-03',
    'CARD-CALIBRATION-01',
    'CARD-PUBLISH-01',
  ]) {
    assert.match(
      ANKLING_STRAIGHT_LEG_RESEARCH_COMPLETION_MIGRATION,
      new RegExp(blocker),
    )
  }
  assert.match(
    ANKLING_STRAIGHT_LEG_RESEARCH_COMPLETION_MIGRATION,
    /'difficultyModel','max_exercise_complexity_physical_difficulty'/,
  )
  assert.match(
    ANKLING_STRAIGHT_LEG_RESEARCH_COMPLETION_MIGRATION,
    /greatest\(seed\.complexity,seed\.physical\)/,
  )
  assert.match(
    ANKLING_STRAIGHT_LEG_RESEARCH_COMPLETION_MIGRATION,
    /link_status='unverified'/,
  )
  assert.match(
    ANKLING_STRAIGHT_LEG_RESEARCH_COMPLETION_MIGRATION,
    /embedding_allowed=FALSE/,
  )
  assert.match(
    ANKLING_STRAIGHT_LEG_RESEARCH_COMPLETION_MIGRATION,
    /exact_variant_match=NULL/,
  )
  assert.match(
    ANKLING_STRAIGHT_LEG_RESEARCH_COMPLETION_MIGRATION,
    /reviewer_user_id=NULL/,
  )
  for (const migration of [
    ANKLING_STRAIGHT_LEG_IDENTITY_CORRECTION_MIGRATION,
    ANKLING_STRAIGHT_LEG_RESEARCH_COMPLETION_MIGRATION,
  ]) {
    assert.doesNotMatch(
      migration,
      /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|formalProficiencyScope|proficiencyClassificationScope)['"]\s*[:,]/,
    )
    assert.doesNotMatch(
      migration,
      /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
    )
    assert.doesNotMatch(
      migration,
      /approved_video_url\s*=\s*'https:\/\//,
    )
  }
})

test('skipping and fast-leg completion consolidates cadence and exact sources while quarantining unresolved contracts', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'414_coaching_skipping_fast_leg_identity_preparation\.sql'/,
  )
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'415_coaching_skipping_fast_leg_research_completion\.sql'/,
  )
  for (const slug of [
    'skipping-rhythm-drill',
    'skipping-rhythm-change',
    'cone-skip-rhythm-build',
    'skipping-rhythm-change-with-ball-toss',
    'power-skip-for-distance',
    'fast-leg-cycle-drill',
  ]) {
    assert.match(
      SKIPPING_FAST_LEG_IDENTITY_PREPARATION_MIGRATION +
        SKIPPING_FAST_LEG_RESEARCH_COMPLETION_MIGRATION,
      new RegExp(slug),
    )
  }
  for (const boundary of [
    'ordinary_skip_vs_unresolved_marker_spacing_contract',
    'ordinary_submaximal_skip_vs_horizontal_high_intent_power_skip',
    'alternating_two_sided_step_hop_skip_vs_single_designated_leg_cycle',
    'external_spacing_skip_vs_timed_object_dual_task_skip',
    'sourceIdentityDuplicate',
    'refused to override a human identity decision',
    'expected one active baseline variant per active definition',
  ]) {
    assert.match(
      SKIPPING_FAST_LEG_IDENTITY_PREPARATION_MIGRATION,
      new RegExp(boundary),
    )
  }
  assert.match(
    SKIPPING_FAST_LEG_RESEARCH_COMPLETION_MIGRATION,
    /'cadence-change-rhythm'/,
  )
  for (const expected of [
    'requires exactly five active prepared definitions',
    'requires exactly all % audited source mappings',
    'requires one active baseline variant per active definition',
    'expected 80 candidate evidence rows',
    'expected 25 quarantined media candidates',
    'requires exactly five current media candidates per card',
    'expected 25 candidate alternate assessments',
    'expected five retained plus one contextual profile',
    'expected five authored and five inverse graph proposals',
    'expected 10 review-only calibration rows',
    'expected five current quarantined test packets',
    'found an unresolved card that remains selectable',
  ]) {
    assert.match(
      SKIPPING_FAST_LEG_RESEARCH_COMPLETION_MIGRATION,
      new RegExp(expected),
    )
  }
  for (const blocker of [
    'CARD-IDENTITY-06',
    'CARD-SELECTION-02',
    'CARD-EVIDENCE-02',
    'CARD-MEDIA-01',
    'CARD-GRAPH-03',
    'CARD-CALIBRATION-01',
    'CARD-PUBLISH-01',
  ]) {
    assert.match(
      SKIPPING_FAST_LEG_RESEARCH_COMPLETION_MIGRATION,
      new RegExp(blocker),
    )
  }
  assert.match(
    SKIPPING_FAST_LEG_RESEARCH_COMPLETION_MIGRATION,
    /'difficultyModel','max_exercise_complexity_physical_difficulty'/,
  )
  assert.match(
    SKIPPING_FAST_LEG_RESEARCH_COMPLETION_MIGRATION,
    /greatest\(seed\.complexity,seed\.physical\)/,
  )
  assert.match(
    SKIPPING_FAST_LEG_RESEARCH_COMPLETION_MIGRATION,
    /link_status='unverified'/,
  )
  assert.match(
    SKIPPING_FAST_LEG_RESEARCH_COMPLETION_MIGRATION,
    /embedding_allowed=FALSE/,
  )
  assert.match(
    SKIPPING_FAST_LEG_RESEARCH_COMPLETION_MIGRATION,
    /exact_variant_match=NULL/,
  )
  assert.match(
    SKIPPING_FAST_LEG_RESEARCH_COMPLETION_MIGRATION,
    /reviewer_user_id=NULL/,
  )
  for (const migration of [
    SKIPPING_FAST_LEG_IDENTITY_PREPARATION_MIGRATION,
    SKIPPING_FAST_LEG_RESEARCH_COMPLETION_MIGRATION,
  ]) {
    assert.doesNotMatch(
      migration,
      /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|formalProficiencyScope|proficiencyClassificationScope)['"]\s*[:,]/,
    )
    assert.doesNotMatch(
      migration,
      /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
    )
    assert.doesNotMatch(
      migration,
      /approved_video_url\s*=\s*'https:\/\//,
    )
  }
})

test('dribble-run completion restores controlled cycle-height variants and separates terminal sprint exposure', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'416_coaching_dribble_run_variant_lineage_preparation\.sql'/,
  )
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'417_coaching_dribble_run_research_completion\.sql'/,
  )
  for (const token of [
    'low-dribble-run',
    'high-dribble-run',
    'dribble-build-to-sprint',
    'low-ankle-shin-recovery',
    'high-knee-recovery',
    'fixed_dribble_cycle_vs_terminal_free_sprint_transition',
    'refused to override a human identity decision',
    'expected two controlled Dribble Run variants and one build-to-sprint baseline',
  ]) {
    assert.match(
      DRIBBLE_RUN_VARIANT_PREPARATION_MIGRATION +
        DRIBBLE_RUN_RESEARCH_COMPLETION_MIGRATION,
      new RegExp(token),
    )
  }
  for (const expected of [
    'requires exactly two active prepared definitions',
    'requires exactly all % audited source mappings',
    'requires the two controlled Dribble Run variants and one build-to-sprint baseline',
    'expected 32 candidate evidence rows',
    'expected 10 quarantined media candidates',
    'requires exactly five current media candidates per card',
    'expected 10 candidate alternate assessments',
    'expected one active delivery profile per exact variant',
    'expected three authored and three inverse graph proposals',
    'expected six review-only calibration rows',
    'expected two current quarantined test packets',
  ]) {
    assert.match(DRIBBLE_RUN_RESEARCH_COMPLETION_MIGRATION, new RegExp(expected))
  }
  for (const blocker of [
    'CARD-EVIDENCE-02',
    'CARD-MEDIA-01',
    'CARD-GRAPH-03',
    'CARD-CALIBRATION-01',
    'CARD-PUBLISH-01',
  ]) {
    assert.match(DRIBBLE_RUN_RESEARCH_COMPLETION_MIGRATION, new RegExp(blocker))
  }
  assert.match(
    DRIBBLE_RUN_RESEARCH_COMPLETION_MIGRATION,
    /'difficultyModel','max_exercise_complexity_physical_difficulty'/,
  )
  assert.match(
    DRIBBLE_RUN_RESEARCH_COMPLETION_MIGRATION,
    /greatest\(seed\.complexity,seed\.physical\)/,
  )
  assert.match(DRIBBLE_RUN_RESEARCH_COMPLETION_MIGRATION, /link_status='unverified'/)
  assert.match(DRIBBLE_RUN_RESEARCH_COMPLETION_MIGRATION, /embedding_allowed=FALSE/)
  assert.match(DRIBBLE_RUN_RESEARCH_COMPLETION_MIGRATION, /exact_variant_match=NULL/)
  assert.match(DRIBBLE_RUN_RESEARCH_COMPLETION_MIGRATION, /reviewer_user_id=NULL/)
  for (const migration of [
    DRIBBLE_RUN_VARIANT_PREPARATION_MIGRATION,
    DRIBBLE_RUN_RESEARCH_COMPLETION_MIGRATION,
  ]) {
    assert.doesNotMatch(
      migration,
      /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|formalProficiencyScope|proficiencyClassificationScope)['"]\s*[:,]/,
    )
    assert.doesNotMatch(
      migration,
      /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
    )
    assert.doesNotMatch(migration, /approved_video_url\s*=\s*'https:\/\//)
  }
})

test('post-family identity closure consolidates cadence-only pogos and separates ankling from dribbling', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'418_coaching_pogo_dribble_identity_queue_closure\.sql'/,
  )
  for (const token of [
    'ankle-pogo-in-place',
    'fast-low-pogos',
    'ankling-drill',
    'high-dribble-run',
    'same_stationary_bilateral_ankle_pogo',
    'no_flight_short_ankling_step_vs_cyclic_dribble_recovery',
    'duplicate_consolidated',
    'distinct_exercises',
    'failed to persist both identity dispositions',
    'refused to override a human identity decision',
  ]) {
    assert.match(POGO_DRIBBLE_IDENTITY_QUEUE_CLOSURE_MIGRATION, new RegExp(token))
  }
  assert.match(
    POGO_DRIBBLE_IDENTITY_QUEUE_CLOSURE_MIGRATION,
    /'difficultyModel','max_exercise_complexity_physical_difficulty'/,
  )
  assert.match(
    POGO_DRIBBLE_IDENTITY_QUEUE_CLOSURE_MIGRATION,
    /'approvalsCreated',FALSE/,
  )
  assert.doesNotMatch(
    POGO_DRIBBLE_IDENTITY_QUEUE_CLOSURE_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|formalProficiencyScope|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    POGO_DRIBBLE_IDENTITY_QUEUE_CLOSURE_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('short acceleration completion consolidates start cards into exact variants and blocks unresolved entries', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'419_coaching_short_acceleration_identity_variant_consolidation\.sql'/,
  )
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'420_coaching_short_acceleration_research_completion\.sql'/,
  )
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'421_coaching_short_acceleration_identity_queue_closure\.sql'/,
  )
  for (const token of [
    'short_linear_acceleration_with_controlled_start_variant',
    'standing-static',
    'two-point-static',
    'three-point-static',
    'falling-start',
    'half-kneeling-start',
    'two-point-auditory-start',
    'two-point-walk-in-provisional',
    'three-point-build-up-provisional',
    'expected all 20 audited sources on the survivor',
    'expected one survivor, eight variants, eight profiles, and archived sources',
    'refused to override a human identity decision',
  ]) {
    assert.match(
      SHORT_ACCELERATION_IDENTITY_CONSOLIDATION_MIGRATION +
        SHORT_ACCELERATION_RESEARCH_COMPLETION_MIGRATION,
      new RegExp(token),
    )
  }
  for (const expected of [
    'requires exactly one active prepared survivor',
    'requires the six exact and two provisional prepared variants',
    'requires all eight generated research packets',
    'requires candidate evidence for all 16 controlled sections',
    'requires three to five quarantined media candidates',
    'expected at least 30 candidate alternate assessments',
    'expected one active delivery profile per exact variant',
    'expected seven authored and seven inverse graph proposals',
    'expected 16 review-only calibration proposals',
    'expected 20 queued source-score packets',
    'expected six selectable and two identity-blocked variants',
    'expected one current quarantined version-2 test packet',
    'Canonical candidate compatibility: exercise complexity 48/100, physical difficulty 68/100',
    'ON CONFLICT\\(exercise_id\\) DO NOTHING',
  ]) {
    assert.match(
      SHORT_ACCELERATION_RESEARCH_COMPLETION_MIGRATION,
      new RegExp(expected),
    )
  }
  for (const blocker of [
    'CARD-IDENTITY-06',
    'CARD-EVIDENCE-02',
    'CARD-MEDIA-01',
    'CARD-GRAPH-03',
    'CARD-CALIBRATION-01',
    'CARD-PUBLISH-01',
  ]) {
    assert.match(
      SHORT_ACCELERATION_RESEARCH_COMPLETION_MIGRATION,
      new RegExp(blocker),
    )
  }
  assert.match(
    SHORT_ACCELERATION_RESEARCH_COMPLETION_MIGRATION,
    /'difficultyModel','max_exercise_complexity_physical_difficulty'/,
  )
  assert.match(
    SHORT_ACCELERATION_RESEARCH_COMPLETION_MIGRATION,
    /greatest\(seed\.complexity,seed\.physical\)/,
  )
  assert.match(
    SHORT_ACCELERATION_RESEARCH_COMPLETION_MIGRATION,
    /link_status='unverified'/,
  )
  assert.match(
    SHORT_ACCELERATION_RESEARCH_COMPLETION_MIGRATION,
    /embedding_allowed=FALSE/,
  )
  assert.match(
    SHORT_ACCELERATION_RESEARCH_COMPLETION_MIGRATION,
    /exact_variant_match IS NULL/,
  )
  assert.match(
    SHORT_ACCELERATION_RESEARCH_COMPLETION_MIGRATION,
    /reviewer_user_id IS NULL/,
  )
  for (const migration of [
    SHORT_ACCELERATION_IDENTITY_CONSOLIDATION_MIGRATION,
    SHORT_ACCELERATION_RESEARCH_COMPLETION_MIGRATION,
    SHORT_ACCELERATION_IDENTITY_QUEUE_CLOSURE_MIGRATION,
  ]) {
    assert.doesNotMatch(
      migration,
      /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|formalProficiencyScope|proficiencyClassificationScope)['"]\s*[:,]/,
    )
    assert.doesNotMatch(
      migration,
      /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
    )
    assert.doesNotMatch(migration, /approved_video_url\s*=\s*'https:\/\//)
  }
  for (const token of [
    'level_unresisted_acceleration_vs_measured_incline_resisted_acceleration',
    'single_start_acceleration_vs_ordered_brake_and_reacceleration',
    'simple_go_signal_acceleration_vs_live_multi_option_choice_reaction',
    'failed to persist all three identity boundaries',
    'refused to override a human identity decision',
    "'decisionScope','identity_only_not_human_approval'",
    "'approvalsCreated',FALSE",
  ]) {
    assert.match(
      SHORT_ACCELERATION_IDENTITY_QUEUE_CLOSURE_MIGRATION,
      new RegExp(token),
    )
  }
})

test('hill sprint acceleration completion models grade, two starts, physical difficulty, and review quarantine', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'422_coaching_hill_sprint_acceleration_research_completion\.sql'/,
  )
  for (const token of [
    'requires exactly legacy sources 126 and 332',
    'two-point-shallow-grade',
    'falling-shallow-grade',
    'measured_declared_uniform_positive_grade_that_preserves_sprint_gait',
    'controlled_non_sprinted_walk_back',
    'gradeDistanceUnitMarkersTimingIntentAndRecoveryAreDeliveryDimensions',
    'requires exactly 16 candidate evidence sections',
    'requires exactly three quarantined media candidates',
    'requires exactly seven candidate alternate assessments',
    'expected one active delivery profile per exact variant',
    'expected four review-only graph proposals',
    'expected four review-only calibration proposals',
    'expected two queued source-score packets',
    'expected one current quarantined version-2 test packet',
    'No external implement; grade and gravity materially raise physical demand.',
    'CARD-GRADE-01',
    'CARD-EVIDENCE-02',
    'CARD-MEDIA-01',
    'CARD-GRAPH-03',
    'CARD-CALIBRATION-01',
    'CARD-PUBLISH-01',
  ]) {
    assert.match(
      HILL_SPRINT_ACCELERATION_RESEARCH_COMPLETION_MIGRATION,
      new RegExp(token),
    )
  }
  assert.match(
    HILL_SPRINT_ACCELERATION_RESEARCH_COMPLETION_MIGRATION,
    /'difficultyModel','max_exercise_complexity_physical_difficulty'/,
  )
  assert.match(
    HILL_SPRINT_ACCELERATION_RESEARCH_COMPLETION_MIGRATION,
    /greatest\(seed\.complexity,seed\.physical\)/,
  )
  assert.match(
    HILL_SPRINT_ACCELERATION_RESEARCH_COMPLETION_MIGRATION,
    /'two-point-shallow-grade'[\s\S]{0,180}52,72/,
  )
  assert.match(
    HILL_SPRINT_ACCELERATION_RESEARCH_COMPLETION_MIGRATION,
    /'falling-shallow-grade'[\s\S]{0,180}56,72/,
  )
  assert.match(
    HILL_SPRINT_ACCELERATION_RESEARCH_COMPLETION_MIGRATION,
    /link_status='unverified'/,
  )
  assert.match(
    HILL_SPRINT_ACCELERATION_RESEARCH_COMPLETION_MIGRATION,
    /embedding_allowed=FALSE/,
  )
  assert.match(
    HILL_SPRINT_ACCELERATION_RESEARCH_COMPLETION_MIGRATION,
    /exact_variant_match IS NULL/,
  )
  assert.match(
    HILL_SPRINT_ACCELERATION_RESEARCH_COMPLETION_MIGRATION,
    /reviewer_user_id IS NULL/,
  )
  assert.doesNotMatch(
    HILL_SPRINT_ACCELERATION_RESEARCH_COMPLETION_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|formalProficiencyScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    HILL_SPRINT_ACCELERATION_RESEARCH_COMPLETION_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    HILL_SPRINT_ACCELERATION_RESEARCH_COMPLETION_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('180 wall-ball resolution quarantines the composite and creates the exact throw-turn-catch card without exercise skill levels', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'423_coaching_180_wall_ball_identity_resolution\.sql'/,
  )
  for (const token of [
    'requires exactly legacy source 1284',
    'legacy-ambiguous-composite',
    'identity_quarantine_do_not_prescribe',
    'through-legs-wall-throw-180-turn-catch',
    'standardized-three-metre-assessment',
    'scaled-coordination-rehearsal',
    'throw_to_wall__stand_and_turn_180__reacquire__two_hand_catch',
    'standardized_scores_only_for_exact_validated_population_and_protocol',
    'requires exactly 16 candidate evidence sections per card',
    'expected two review-only graph proposals',
    'expected one deterministic distinct-identity boundary',
    'expected six review-only calibration proposals',
    'expected one queued provisional source-score packet',
    'expected current quarantined version-2 and version-1 packets',
    "'trainingStimuli'",
    "'weeklyExposure'",
    "'uncertaintyPolicy'",
    "'observationChecklist'",
    "'modificationDecisionTree'",
    "'retentionPolicy'",
    "ARRAY\\['load','range','speed','complexity','stability'\\]",
    'CARD-IDENTITY-01',
    'CARD-PROTOCOL-01',
    'CARD-MEDIA-01',
    'CARD-PUBLISH-01',
    'identity_only_not_card_media_graph_calibration_or_publication_approval',
  ]) {
    assert.match(
      WALL_BALL_180_IDENTITY_RESOLUTION_MIGRATION,
      new RegExp(token),
    )
  }
  assert.match(
    WALL_BALL_180_IDENTITY_RESOLUTION_MIGRATION,
    /'difficultyModel','max_exercise_complexity_physical_difficulty'/,
  )
  assert.match(
    WALL_BALL_180_IDENTITY_RESOLUTION_MIGRATION,
    /greatest\(seed\.complexity,seed\.physical\)/,
  )
  assert.match(
    WALL_BALL_180_IDENTITY_RESOLUTION_MIGRATION,
    /embedding_allowed=FALSE/,
  )
  assert.match(
    WALL_BALL_180_IDENTITY_RESOLUTION_MIGRATION,
    /exact_variant_match IS NULL/,
  )
  assert.doesNotMatch(
    WALL_BALL_180_IDENTITY_RESOLUTION_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|formalProficiencyScope|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    WALL_BALL_180_IDENTITY_RESOLUTION_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    WALL_BALL_180_IDENTITY_RESOLUTION_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
  assert.doesNotMatch(
    WALL_BALL_180_IDENTITY_RESOLUTION_MIGRATION,
    /ARRAY\['ball','distance','turn_speed','protocol','score_interpretation'\]/,
  )
  assert.doesNotMatch(
    WALL_BALL_180_IDENTITY_RESOLUTION_MIGRATION,
    /ARRAY\['Do not place this card in a workout/,
  )
})

test('landmine arc resolution consolidates false one-arm sources and creates the exact two-hand arc without approvals or exercise levels', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'424_coaching_landmine_arc_identity_resolution\.sql'/,
  )
  for (const token of [
    'standard_one_arm_fixed_diagonal_press',
    'standard_press_with_eccentric_tempo_modifier',
    'two-hand-landmine-shoulder-to-shoulder-arc-press',
    'tall-kneeling-two-hand-shoulder-to-shoulder',
    'half-kneeling-two-hand-shoulder-to-shoulder',
    'one_way_shoulder_to_shoulder_crossing',
    'expected five embeddable but unapproved media candidates',
    'expected seven deterministic exact-card boundaries',
    'expected four planning-ready delivery profiles',
    'expected four review-only calibration proposals',
    'identity_only_not_card_media_graph_calibration_or_publication_approval',
    "'trainingStimuli'",
    "'weeklyExposure'",
    "'uncertaintyPolicy'",
    "'demonstrationPlan'",
    "'modificationDecisionTree'",
    "'retentionPolicy'",
    'CARD-MEDIA-01',
    'CARD-GRAPH-03',
    'CARD-CALIBRATION-01',
  ]) {
    assert.match(
      LANDMINE_ARC_IDENTITY_RESOLUTION_MIGRATION,
      new RegExp(token),
    )
  }
  assert.match(
    LANDMINE_ARC_IDENTITY_RESOLUTION_MIGRATION,
    /'difficultyModel','max_exercise_complexity_physical_difficulty'/,
  )
  assert.match(
    LANDMINE_ARC_IDENTITY_RESOLUTION_MIGRATION,
    /'baseOverallDifficulty',52/,
  )
  assert.match(
    LANDMINE_ARC_IDENTITY_RESOLUTION_MIGRATION,
    /\{baseOverallDifficulty\}','54'::JSONB/,
  )
  assert.match(
    LANDMINE_ARC_IDENTITY_RESOLUTION_MIGRATION,
    /embedding_allowed=TRUE AND media\.exact_variant_match IS NULL/,
  )
  assert.match(
    LANDMINE_ARC_IDENTITY_RESOLUTION_MIGRATION,
    /review_status='candidate' AND media\.link_status='healthy'/,
  )
  assert.doesNotMatch(
    LANDMINE_ARC_IDENTITY_RESOLUTION_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|formalProficiencyScope|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    LANDMINE_ARC_IDENTITY_RESOLUTION_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    LANDMINE_ARC_IDENTITY_RESOLUTION_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('ankling pogo resolution retires ambiguous labels and adds an exact wall-lean variant without approvals or exercise levels', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'425_coaching_ankling_pogo_identity_resolution\.sql'/,
  )
  for (const token of [
    'ankling-pogo-hop',
    'wall-ankling-pogo',
    'wall-lean-stationary-single-leg',
    'same_leg_repeated_low_amplitude_ankle_dominant_hops',
    'one_landing_contact_on_declared_support_leg',
    'legacySourcesMappedToExactVariant',
    'expected two planning-ready wall-lean profiles',
    'expected five embeddable but unapproved media candidates',
    'expected nine alternate assessments',
    'CARD-MEDIA-01',
    'CARD-GRAPH-03',
    'CARD-CALIBRATION-01',
  ]) {
    assert.match(
      ANKLING_POGO_IDENTITY_RESOLUTION_MIGRATION,
      new RegExp(token),
    )
  }
  assert.match(
    ANKLING_POGO_IDENTITY_RESOLUTION_MIGRATION,
    /'baseOverallDifficulty',52/,
  )
  assert.match(
    ANKLING_POGO_IDENTITY_RESOLUTION_MIGRATION,
    /'difficultyModel','max_exercise_complexity_physical_difficulty'/,
  )
  assert.match(
    ANKLING_POGO_IDENTITY_RESOLUTION_MIGRATION,
    /media\.embedding_allowed=TRUE AND media\.exact_variant_match IS NULL/,
  )
  assert.match(
    ANKLING_POGO_IDENTITY_RESOLUTION_MIGRATION,
    /calibration\.status='review'/,
  )
  assert.doesNotMatch(
    ANKLING_POGO_IDENTITY_RESOLUTION_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|formalProficiencyScope|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    ANKLING_POGO_IDENTITY_RESOLUTION_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    ANKLING_POGO_IDENTITY_RESOLUTION_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('opposite-leg bound direction resolution preserves stable slugs while separating forward and lateral tasks', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'426_coaching_opposite_leg_bound_direction_identity_resolution\.sql'/,
  )
  for (const token of [
    'Opposite-Leg Forward Bound to Stick',
    'Opposite-Leg Lateral Bound to Stick',
    'forward_vs_lateral_projection',
    'opposite_leg_landing',
    'terminal_hold',
    'full_reset',
    'distinct_exercises',
    'expected complete candidate evidence coverage',
    'expected candidate-only media and alternate packets',
    'expected review-only delivery, calibration, and graph rows',
    'did not resolve the direct identity collision',
  ]) {
    assert.match(
      OPPOSITE_LEG_BOUND_DIRECTION_IDENTITY_RESOLUTION_MIGRATION,
      new RegExp(token),
    )
  }
  for (const score of [
    /'technicalComplexity',56/,
    /'absoluteLoadDemand',64/,
    /'baseOverallDifficulty',64/,
    /'technicalComplexity',60/,
    /'absoluteLoadDemand',66/,
    /'baseOverallDifficulty',66/,
  ]) {
    assert.match(OPPOSITE_LEG_BOUND_DIRECTION_IDENTITY_RESOLUTION_MIGRATION, score)
  }
  assert.match(
    OPPOSITE_LEG_BOUND_DIRECTION_IDENTITY_RESOLUTION_MIGRATION,
    /media\.exact_variant_match IS NULL/,
  )
  assert.match(
    OPPOSITE_LEG_BOUND_DIRECTION_IDENTITY_RESOLUTION_MIGRATION,
    /relationship\.review_status='review'/,
  )
  assert.match(
    OPPOSITE_LEG_BOUND_DIRECTION_IDENTITY_RESOLUTION_MIGRATION,
    /calibration\.status='review'/,
  )
  assert.doesNotMatch(
    OPPOSITE_LEG_BOUND_DIRECTION_IDENTITY_RESOLUTION_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|formalProficiencyScope|proficiencyClassificationScope)['"]\s*[:,]/,
  )
  assert.doesNotMatch(
    OPPOSITE_LEG_BOUND_DIRECTION_IDENTITY_RESOLUTION_MIGRATION,
    /skill_level\s*=\s*'(?:BEGINNER|INTERMEDIATE|ADVANCED|ELITE)'/i,
  )
  assert.doesNotMatch(
    OPPOSITE_LEG_BOUND_DIRECTION_IDENTITY_RESOLUTION_MIGRATION,
    /approved_video_url\s*=\s*'https:\/\//,
  )
})

test('recent completion migrations calibrate complexity and physical difficulty, never derived overall', () => {
  for (const migration of [
    ONE_ARM_LANDMINE_BASE_COMPLETION_MIGRATION,
    LANDMINE_EXPLOSIVE_PRESS_COMPLETION_MIGRATION,
    LANDMINE_SQUAT_LUNGE_COMPLETION_MIGRATION,
    COSSACK_SQUAT_COMPLETION_MIGRATION,
    ADDUCTOR_ROCKBACK_COMPLETION_MIGRATION,
    BACKPEDAL_TO_SPRINT_COMPLETION_MIGRATION,
    HANG_FAMILY_RESEARCH_COMPLETION_MIGRATION,
    SUPPORT_COMPRESSION_RESEARCH_COMPLETION_MIGRATION,
    HANGING_LEG_RAISE_L_SIT_RESEARCH_COMPLETION_MIGRATION,
    A_SERIES_SPRINT_DRILLS_RESEARCH_COMPLETION_MIGRATION,
    ANKLING_STRAIGHT_LEG_RESEARCH_COMPLETION_MIGRATION,
    SKIPPING_FAST_LEG_RESEARCH_COMPLETION_MIGRATION,
    DRIBBLE_RUN_RESEARCH_COMPLETION_MIGRATION,
    SHORT_ACCELERATION_RESEARCH_COMPLETION_MIGRATION,
    HILL_SPRINT_ACCELERATION_RESEARCH_COMPLETION_MIGRATION,
    LANDMINE_ARC_IDENTITY_RESOLUTION_MIGRATION,
    ANKLING_POGO_IDENTITY_RESOLUTION_MIGRATION,
    OPPOSITE_LEG_BOUND_DIRECTION_IDENTITY_RESOLUTION_MIGRATION,
  ]) {
    assert.doesNotMatch(
      migration,
      /CROSS JOIN(?: LATERAL)? \(\s*VALUES[\s\S]{0,500}\('baseOverallDifficulty'/,
    )
  }
})

test('recent-family identity closure resolves authored mechanics and preserves ambiguous quarantines', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'405_coaching_recent_family_identity_boundary_closure\.sql'/,
  )
  assert.match(
    RECENT_FAMILY_IDENTITY_BOUNDARY_MIGRATION,
    /expected_count CONSTANT INTEGER := 18/,
  )
  for (const boundaryKey of [
    'squat_only_vs_squat_then_press',
    'frontal_lateral_shift_vs_sagittal_bilateral_squat',
    'strict_press_vs_step_back_lunge_then_press',
    'full_squat_press_vs_dip_drive_press',
    'lateral_squat_vs_lateral_squat_release_target_protocol',
    'angled_shoulder_press_vs_anti_rotation_press_out',
    'stationary_split_squat_vs_dynamic_split_receive',
    'vertical_kneeling_support_vs_supine_floor_support',
    'supine_floor_press_vs_tall_kneeling_press',
  ]) {
    assert.match(
      RECENT_FAMILY_IDENTITY_BOUNDARY_MIGRATION,
      new RegExp(boundaryKey),
    )
  }
  assert.match(
    RECENT_FAMILY_IDENTITY_BOUNDARY_MIGRATION,
    /'evidenceSource','current_authored_candidate_card_contracts'/,
  )
  assert.match(
    RECENT_FAMILY_IDENTITY_BOUNDARY_MIGRATION,
    /'approvalsCreated',FALSE/,
  )
  assert.match(
    RECENT_FAMILY_IDENTITY_BOUNDARY_MIGRATION,
    /refused to overwrite an existing decision/,
  )
  for (const unresolvedSlug of [
    'one-arm-landmine-arc-press',
    'split-squat',
    'clean-grip-deadlift',
    'sumo-deadlift',
  ]) {
    assert.doesNotMatch(
      RECENT_FAMILY_IDENTITY_BOUNDARY_MIGRATION,
      new RegExp(`'${unresolvedSlug}'`),
    )
  }
  assert.doesNotMatch(
    RECENT_FAMILY_IDENTITY_BOUNDARY_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
})

test('remaining unclassified identity closure distinguishes Box Squat and quarantines Arc Press', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'406_coaching_remaining_unclassified_identity_queue_closure\.sql'/,
  )
  for (const slug of [
    'box-squat',
    'split-squat',
    'landmine-squat-to-press',
    'one-arm-landmine-arc-press',
  ]) {
    assert.match(
      UNCLASSIFIED_IDENTITY_QUEUE_CLOSURE_MIGRATION,
      new RegExp(`'${slug}'`),
    )
  }
  assert.match(
    UNCLASSIFIED_IDENTITY_QUEUE_CLOSURE_MIGRATION,
    /'bilateral_box_supported_squat_vs_stationary_split_stance_squat'/,
  )
  assert.match(
    UNCLASSIFIED_IDENTITY_QUEUE_CLOSURE_MIGRATION,
    /'authored_squat_to_press_vs_unresolved_arc_press_source'/,
  )
  assert.match(
    UNCLASSIFIED_IDENTITY_QUEUE_CLOSURE_MIGRATION,
    /'needs_human_review'/,
  )
  assert.match(
    UNCLASSIFIED_IDENTITY_QUEUE_CLOSURE_MIGRATION,
    /'approvalsCreated',FALSE/,
  )
  assert.doesNotMatch(
    UNCLASSIFIED_IDENTITY_QUEUE_CLOSURE_MIGRATION,
    /['"](?:exerciseSkillLevel|skillLevel|minimumSkillLevel|proficiencyLevel|exerciseCardSkillLevel|formalProficiencyClassification|proficiencyClassificationScope)['"]\s*[:,]/,
  )
})

test('recent completion migrations protect reviewed content on clean re-entry', () => {
  for (const [migration, completedCardCount, completedCardVersion] of [
    [ONE_ARM_LANDMINE_BASE_COMPLETION_MIGRATION, 5, 2],
    [LANDMINE_EXPLOSIVE_PRESS_COMPLETION_MIGRATION, 3, 2],
    [LANDMINE_SQUAT_LUNGE_COMPLETION_MIGRATION, 4, 2],
    [COSSACK_SQUAT_COMPLETION_MIGRATION, 2, 2],
    [ADDUCTOR_ROCKBACK_COMPLETION_MIGRATION, 1, 2],
    [BACKPEDAL_TO_SPRINT_COMPLETION_MIGRATION, 2, 2],
    [HANG_FAMILY_RESEARCH_COMPLETION_MIGRATION, 3, 4],
    [SUPPORT_COMPRESSION_RESEARCH_COMPLETION_MIGRATION, 3, 2],
    [HANGING_LEG_RAISE_L_SIT_RESEARCH_COMPLETION_MIGRATION, 3, 2],
    [A_SERIES_SPRINT_DRILLS_RESEARCH_COMPLETION_MIGRATION, 7, 2],
    [ANKLING_STRAIGHT_LEG_RESEARCH_COMPLETION_MIGRATION, 9, 2],
    [SKIPPING_FAST_LEG_RESEARCH_COMPLETION_MIGRATION, 5, 2],
    [DRIBBLE_RUN_RESEARCH_COMPLETION_MIGRATION, 2, 2],
    [SHORT_ACCELERATION_RESEARCH_COMPLETION_MIGRATION, 1, 2],
    [HILL_SPRINT_ACCELERATION_RESEARCH_COMPLETION_MIGRATION, 1, 2],
  ]) {
    assert.match(
      migration,
      new RegExp(
        `already_applied_count = ${completedCardCount}[\\s\\S]{0,500}definition\\.card_version <> ${completedCardVersion}`,
      ),
    )
    assert.match(
      migration,
      /refused to overwrite % (?:human-)?reviewed or published|refused to overwrite % human-reviewed current-version/,
    )
  }
})

test('exercise identity evidence cannot retain skill or proficiency classifications', () => {
  assert.match(
    PLATFORM_INIT_TABLES_SOURCE,
    /'374_coaching_exercise_identity_proficiency_metadata_guard\.sql'/,
  )
  assert.match(
    EXERCISE_IDENTITY_PROFICIENCY_GUARD_MIGRATION,
    /exercise_json_has_non_neutral_level_classification/,
  )
  assert.match(
    EXERCISE_IDENTITY_PROFICIENCY_GUARD_MIGRATION,
    /strip_exercise_level_classification/,
  )
  assert.match(
    EXERCISE_IDENTITY_PROFICIENCY_GUARD_MIGRATION,
    /exercise_identity_resolution_no_level_classification_check/,
  )
  assert.match(
    EXERCISE_IDENTITY_PROFICIENCY_GUARD_MIGRATION,
    /changed dedicated skill-library level assignments/,
  )
  assert.match(
    EXERCISE_IDENTITY_PROFICIENCY_GUARD_MIGRATION,
    /changed identity resolution state while cleaning evidence/,
  )
})
