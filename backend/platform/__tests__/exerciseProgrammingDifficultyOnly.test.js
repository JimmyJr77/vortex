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
