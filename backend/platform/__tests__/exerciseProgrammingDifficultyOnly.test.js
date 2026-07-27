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
