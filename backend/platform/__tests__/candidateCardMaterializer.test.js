import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backendRoot = path.resolve(__dirname, '../..')
const repoRoot = path.resolve(backendRoot, '..')
const materializer = readFileSync(
  path.join(backendRoot, 'migrations', '523_coaching_candidate_card_materializer_v1.sql'),
  'utf8',
)
const materializerCompatibility = readFileSync(
  path.join(backendRoot, 'migrations', '523a_coaching_candidate_card_materializer_compatibility.sql'),
  'utf8',
)
const legacyDifficultyCompatibility = readFileSync(
  path.join(backendRoot, 'migrations', '523b_coaching_candidate_legacy_difficulty_compatibility.sql'),
  'utf8',
)
const generatedMigration = readFileSync(
  path.join(backendRoot, 'migrations', '524_coaching_foot_control_trio_candidate_materialization.sql'),
  'utf8',
)
const jumpRopeGeneratedMigration = readFileSync(
  path.join(backendRoot, 'migrations', '525_coaching_jump_rope_bounce_source_49_candidate_materialization.sql'),
  'utf8',
)
const walkingKneeHugGeneratedMigration = readFileSync(
  path.join(backendRoot, 'migrations', '526_coaching_walking_knee_hug_source_50_candidate_materialization.sql'),
  'utf8',
)
const walkingQuadPullGeneratedMigration = readFileSync(
  path.join(backendRoot, 'migrations', '527_coaching_walking_quad_pull_source_51_candidate_materialization.sql'),
  'utf8',
)
const legSwingsFrontBackGeneratedMigration = readFileSync(
  path.join(backendRoot, 'migrations', '528_coaching_leg_swings_front_back_source_52_candidate_materialization.sql'),
  'utf8',
)
const legSwingsLateralGeneratedMigration = readFileSync(
  path.join(backendRoot, 'migrations', '529_coaching_leg_swings_lateral_source_53_candidate_materialization.sql'),
  'utf8',
)
const hipSwitchGeneratedMigration = readFileSync(
  path.join(backendRoot, 'migrations', '530_coaching_9090_hip_switch_source_54_candidate_materialization.sql'),
  'utf8',
)
const shinBoxGetUpGeneratedMigration = readFileSync(
  path.join(backendRoot, 'migrations', '531_coaching_shin_box_get_up_source_56_candidate_materialization.sql'),
  'utf8',
)
const hipCarsGeneratedMigration = readFileSync(
  path.join(backendRoot, 'migrations', '532_coaching_hip_cars_source_57_candidate_materialization.sql'),
  'utf8',
)
const adductorRockbackPhysicalDifficultyBackfill = readFileSync(
  path.join(backendRoot, 'migrations', '533_coaching_adductor_rockback_physical_difficulty_backfill.sql'),
  'utf8',
)
const frogRockbackGeneratedMigration = readFileSync(
  path.join(backendRoot, 'migrations', '534_coaching_frog_rockback_source_59_candidate_materialization.sql'),
  'utf8',
)
const cossackSquatPhysicalDifficultyBackfill = readFileSync(
  path.join(backendRoot, 'migrations', '535_coaching_cossack_squat_physical_difficulty_backfill.sql'),
  'utf8',
)
const deepSquatPryGeneratedMigration = readFileSync(
  path.join(backendRoot, 'migrations', '536_coaching_deep_squat_pry_source_61_candidate_materialization.sql'),
  'utf8',
)
const squatToStandGeneratedMigration = readFileSync(
  path.join(backendRoot, 'migrations', '537_coaching_squat_to_stand_with_reach_source_62_candidate_materialization.sql'),
  'utf8',
)
const squatToStandIdentityConsolidation = readFileSync(
  path.join(backendRoot, 'migrations', '538_coaching_squat_to_stand_mobility_reach_identity_consolidation.sql'),
  'utf8',
)
const gluteBridgeGeneratedMigration = readFileSync(
  path.join(backendRoot, 'migrations', '539_coaching_glute_bridge_source_64_candidate_materialization.sql'),
  'utf8',
)
const gluteBridgeMarchGeneratedMigration = readFileSync(
  path.join(backendRoot, 'migrations', '540_coaching_glute_bridge_march_source_65_candidate_materialization.sql'),
  'utf8',
)
const birdDogGeneratedMigration = readFileSync(
  path.join(backendRoot, 'migrations', '541_coaching_bird_dog_source_67_candidate_materialization.sql'),
  'utf8',
)
const deadBugHeelTapGeneratedMigration = readFileSync(
  path.join(backendRoot, 'migrations', '542_coaching_dead_bug_heel_tap_source_66_candidate_materialization.sql'),
  'utf8',
)
const miniBandLateralWalkGeneratedMigration = readFileSync(
  path.join(backendRoot, 'migrations', '543_coaching_mini_band_lateral_walk_source_68_candidate_materialization.sql'),
  'utf8',
)
const initTables = readFileSync(path.join(backendRoot, 'platform', 'initTables.js'), 'utf8')
const contractFilename = path.join(
  repoRoot,
  'scripts/data/canonical-research/contracts/foot-control-trio.v1.json',
)
const generatedManifest = JSON.parse(readFileSync(path.join(
  repoRoot,
  'scripts/data/canonical-research/generated/foot-control-trio',
  '524_coaching_foot_control_trio_candidate_materialization.manifest.json',
), 'utf8'))

test('candidate card materializer keeps declarative foot-control payloads candidate-only', () => {
  assert.match(initTables, /'523_coaching_candidate_card_materializer_v1\.sql'/)
  assert.match(initTables, /'523a_coaching_candidate_card_materializer_compatibility\.sql'/)
  assert.match(initTables, /'523b_coaching_candidate_legacy_difficulty_compatibility\.sql'/)
  assert.match(initTables, /'523c_coaching_weight_shift_taxonomy\.sql'/)
  assert.match(initTables, /'523d_coaching_plantar_flex_taxonomy\.sql'/)
  assert.match(initTables, /'524_coaching_foot_control_trio_candidate_materialization\.sql'/)
  assert.match(initTables, /'525_coaching_jump_rope_bounce_source_49_candidate_materialization\.sql'/)
  assert.match(initTables, /'526_coaching_walking_knee_hug_source_50_candidate_materialization\.sql'/)
  assert.match(initTables, /'527_coaching_walking_quad_pull_source_51_candidate_materialization\.sql'/)
  assert.match(initTables, /'528_coaching_leg_swings_front_back_source_52_candidate_materialization\.sql'/)
  assert.match(initTables, /'529_coaching_leg_swings_lateral_source_53_candidate_materialization\.sql'/)
  assert.match(initTables, /'530_coaching_9090_hip_switch_source_54_candidate_materialization\.sql'/)
  assert.match(initTables, /'531_coaching_shin_box_get_up_source_56_candidate_materialization\.sql'/)
  assert.match(initTables, /'532_coaching_hip_cars_source_57_candidate_materialization\.sql'/)
  assert.match(initTables, /'533_coaching_adductor_rockback_physical_difficulty_backfill\.sql'/)
  assert.match(initTables, /'534_coaching_frog_rockback_source_59_candidate_materialization\.sql'/)
  assert.match(initTables, /'535_coaching_cossack_squat_physical_difficulty_backfill\.sql'/)
  assert.match(initTables, /'536_coaching_deep_squat_pry_source_61_candidate_materialization\.sql'/)
  assert.match(initTables, /'537_coaching_squat_to_stand_with_reach_source_62_candidate_materialization\.sql'/)
  assert.match(initTables, /'538_coaching_squat_to_stand_mobility_reach_identity_consolidation\.sql'/)
  assert.match(initTables, /'539_coaching_glute_bridge_source_64_candidate_materialization\.sql'/)
  assert.match(initTables, /'540_coaching_glute_bridge_march_source_65_candidate_materialization\.sql'/)
  assert.match(initTables, /'541_coaching_bird_dog_source_67_candidate_materialization\.sql'/)
  assert.match(initTables, /'542_coaching_dead_bug_heel_tap_source_66_candidate_materialization\.sql'/)
  assert.match(initTables, /'543_coaching_mini_band_lateral_walk_source_68_candidate_materialization\.sql'/)
  assert.match(materializerCompatibility, /ADD COLUMN IF NOT EXISTS updated_at/)
  assert.match(materializerCompatibility, /preserve_exercise_est_seconds_per_set_v1/)
  assert.match(materializerCompatibility, /NEW\.est_seconds_per_set IS NULL/)
  assert.match(legacyDifficultyCompatibility, /normalize_legacy_exercise_difficulty_profile_v1/)
  assert.match(legacyDifficultyCompatibility, /WHEN 'low_to_moderate' THEN 'moderate'/)
  assert.match(legacyDifficultyCompatibility, /WHEN 'moderate_to_high' THEN 'high'/)
  assert.match(legacyDifficultyCompatibility, /unsupported legacy attention_demand value/)
  for (const token of [
    'apply_candidate_exercise_card_v1',
    'refuses to overwrite % human-reviewed records',
    'exerciseDifficultyDescribesTaskOnly',
    'publicationQuarantined',
    'candidate-only invariant failed',
    'REVOKE ALL ON FUNCTION',
    'minimum_age_recommended=NULL',
    'minimum_skill_level=NULL',
    'approved_video_url IS NOT NULL',
    'definition_slug_value',
    'source_variant_key_value',
    'source_variant_archive_key_value',
    "source_variant_data->>'lookupKey'",
    'preserveLegacyExerciseId',
    'preserveArchived',
  ]) {
    assert.match(materializer, new RegExp(token))
  }
  assert.match(
    materializer,
    /'https:\/\/www\.youtube-nocookie\.com\/embed\/'\s*\|\|\s*\(media_data->>'videoId'\)/,
  )
  assert.match(
    materializer,
    /variant_key IN \(source_variant_key_value, source_variant_archive_key_value\)/,
  )
  assert.doesNotMatch(materializer, /VALUES \([^\n]*'approved'/)

  const contract = JSON.parse(readFileSync(contractFilename, 'utf8'))
  assert.equal(contract.cards.length, 3)
  assert.deepEqual(
    contract.cards.map((card) => card.definition.slug),
    [
      'foot-tripod-weight-shifts',
      'big-toe-press-iso-hold',
      'short-foot-to-calf-raise-mobility-prep',
    ],
  )
  assert.deepEqual(
    generatedManifest.cards.map((card) => [
      card.slug,
      card.cardVersion,
      card.evidenceSections,
      card.mediaCandidates,
    ]),
    [
      ['foot-tripod-weight-shifts', 2, 16, 3],
      ['big-toe-press-iso-hold', 2, 16, 5],
      ['short-foot-to-calf-raise-mobility-prep', 2, 16, 5],
    ],
  )
  for (const card of contract.cards) {
    assert.equal(card.definition.cardVersion, 2)
    assert.equal(card.testPacket.status, 'quarantined')
    assert.equal(card.testPacket.humanReviewRequired, true)
    assert.equal(card.testPacket.blockingIssues.length, 4)
    assert.equal(card.variants.every((variant) => (
      variant.difficulty.baseOverallDifficulty === Math.max(
        variant.difficulty.technicalComplexity,
        variant.difficulty.physicalDifficulty,
      )
    )), true)
  }
  for (const token of [
    '3370a943-9672-49da-b28c-3940470091e1',
    '285b2fe4-707c-41af-9382-08597788407f',
    'a1f96711-3528-4b38-b51a-9f087caa9735',
    '258c1f16-d662-4d7e-9796-7c465084086f',
    'fae4f330-b804-4094-8184-2de2e6900e0c',
    '687b3320-7ce9-4790-a8d3-76c955e8eb07',
    'CARD-MEDIA-01',
    'CARD-GRAPH-03',
    'CARD-CALIBRATION-01',
    'CARD-PUBLISH-01',
  ]) {
    assert.match(generatedMigration, new RegExp(token))
  }
  assert.doesNotMatch(generatedMigration, /"status":"approved"|"reviewStatus":"approved"/)
  assert.match(jumpRopeGeneratedMigration, /"preserveArchived":true/)
  assert.match(walkingKneeHugGeneratedMigration, /"lookupKey":"baseline"/)
  assert.match(walkingKneeHugGeneratedMigration, /"superseded-source-50-skeleton"/)
  assert.doesNotMatch(walkingKneeHugGeneratedMigration, /"status":"approved"|"reviewStatus":"approved"/)
  assert.match(walkingQuadPullGeneratedMigration, /"alternating-walking-wall-touch-quad-pull-step-through"/)
  assert.match(walkingQuadPullGeneratedMigration, /"upright_support_optional"/)
  assert.doesNotMatch(walkingQuadPullGeneratedMigration, /"status":"approved"|"reviewStatus":"approved"/)
  assert.match(legSwingsFrontBackGeneratedMigration, /"supported-stationary-front-back-leg-swing"/)
  assert.match(legSwingsFrontBackGeneratedMigration, /"upright_support_optional"/)
  assert.doesNotMatch(legSwingsFrontBackGeneratedMigration, /"status":"approved"|"reviewStatus":"approved"/)
  assert.match(legSwingsLateralGeneratedMigration, /"supported-stationary-lateral-leg-swing"/)
  assert.match(legSwingsLateralGeneratedMigration, /"movementPatterns":\["brace"\]/)
  assert.doesNotMatch(legSwingsLateralGeneratedMigration, /"status":"approved"|"reviewStatus":"approved"/)
  assert.match(hipSwitchGeneratedMigration, /"seated-optional-hands-9090-hip-switch"/)
  assert.match(hipSwitchGeneratedMigration, /"Shin Box Get-Up"/)
  assert.doesNotMatch(hipSwitchGeneratedMigration, /"status":"approved"|"reviewStatus":"approved"/)
  assert.match(shinBoxGetUpGeneratedMigration, /"bodyweight-full-sequence-shin-box-get-up"/)
  assert.match(shinBoxGetUpGeneratedMigration, /"physicalDifficulty":30/)
  assert.doesNotMatch(shinBoxGetUpGeneratedMigration, /"status":"approved"|"reviewStatus":"approved"/)
  assert.match(hipCarsGeneratedMigration, /"standing-stable-support-hip-car"/)
  assert.match(hipCarsGeneratedMigration, /"quadruped-hip-car"/)
  assert.match(hipCarsGeneratedMigration, /"linkStatus":"unverified"/)
  assert.doesNotMatch(hipCarsGeneratedMigration, /"status":"approved"|"reviewStatus":"approved"/)
  assert.match(adductorRockbackPhysicalDifficultyBackfill, /\{physicalDifficulty\}/)
  assert.match(adductorRockbackPhysicalDifficultyBackfill, /refused % protected records/)
  assert.match(frogRockbackGeneratedMigration, /"bilateral-wide-kneeling-frog-rockback"/)
  assert.match(frogRockbackGeneratedMigration, /"physicalDifficulty":10/)
  assert.match(frogRockbackGeneratedMigration, /"linkStatus":"unverified"/)
  assert.doesNotMatch(frogRockbackGeneratedMigration, /"status":"approved"|"reviewStatus":"approved"/)
  assert.match(cossackSquatPhysicalDifficultyBackfill, /variant\.status <> 'archived'/)
  assert.match(cossackSquatPhysicalDifficultyBackfill, /\{physicalDifficulty\}/)
  assert.match(cossackSquatPhysicalDifficultyBackfill, /refused % protected records/)
  assert.match(deepSquatPryGeneratedMigration, /"bodyweight-deep-squat-gentle-pry"/)
  assert.match(deepSquatPryGeneratedMigration, /"physicalDifficulty":14/)
  assert.match(deepSquatPryGeneratedMigration, /"linkStatus":"unverified"/)
  assert.doesNotMatch(deepSquatPryGeneratedMigration, /"status":"approved"|"reviewStatus":"approved"/)
  assert.match(squatToStandGeneratedMigration, /"sequential-bilateral-reach-squat-to-stand"/)
  assert.match(squatToStandGeneratedMigration, /"physicalDifficulty":14/)
  assert.doesNotMatch(squatToStandGeneratedMigration, /"status":"approved"|"reviewStatus":"approved"/)
  assert.match(gluteBridgeGeneratedMigration, /"bodyweight-bilateral-floor-glute-bridge"/)
  assert.match(gluteBridgeGeneratedMigration, /"physicalDifficulty":16/)
  assert.match(gluteBridgeGeneratedMigration, /"linkStatus":"unverified"/)
  assert.doesNotMatch(gluteBridgeGeneratedMigration, /"status":"approved"|"reviewStatus":"approved"/)
  assert.match(gluteBridgeMarchGeneratedMigration, /"bodyweight-alternating-elevated-floor-glute-bridge-march"/)
  assert.match(gluteBridgeMarchGeneratedMigration, /"physicalDifficulty":22/)
  assert.match(gluteBridgeMarchGeneratedMigration, /"linkStatus":"unverified"/)
  assert.doesNotMatch(gluteBridgeMarchGeneratedMigration, /"status":"approved"|"reviewStatus":"approved"/)
  assert.match(birdDogGeneratedMigration, /"bodyweight-quadruped-alternating-contralateral-bird-dog"/)
  assert.match(birdDogGeneratedMigration, /"physicalDifficulty":14/)
  assert.match(birdDogGeneratedMigration, /"linkStatus":"unverified"/)
  assert.doesNotMatch(birdDogGeneratedMigration, /"status":"approved"|"reviewStatus":"approved"/)
  assert.match(deadBugHeelTapGeneratedMigration, /"bodyweight-supine-arms-fixed-alternating-heel-tap"/)
  assert.match(deadBugHeelTapGeneratedMigration, /"physicalDifficulty":12/)
  assert.match(deadBugHeelTapGeneratedMigration, /"linkStatus":"unverified"/)
  assert.doesNotMatch(deadBugHeelTapGeneratedMigration, /"status":"approved"|"reviewStatus":"approved"/)
  assert.match(miniBandLateralWalkGeneratedMigration, /"loop-band-above-knees-athletic-stance-lateral-walk"/)
  assert.match(miniBandLateralWalkGeneratedMigration, /"physicalDifficulty":18/)
  assert.match(miniBandLateralWalkGeneratedMigration, /"linkStatus":"unverified"/)
  assert.doesNotMatch(miniBandLateralWalkGeneratedMigration, /"status":"approved"|"reviewStatus":"approved"/)
  assert.match(squatToStandIdentityConsolidation, /same_ordered_hinge_squat_reach_stand_cycle/)
  assert.match(squatToStandIdentityConsolidation, /requires human review: % protected records/)
  assert.match(squatToStandIdentityConsolidation, /status = 'archived'/)
})

test('candidate materializer generator rebuilds the three-card migration deterministically', () => {
  const output = execFileSync(
    process.execPath,
    [
      path.join(backendRoot, 'scripts', 'build-canonical-candidate-migration.mjs'),
      '--contract=' + contractFilename,
      '--output=' + path.join(repoRoot, 'tmp-foot-control-trio.sql'),
    ],
    { cwd: repoRoot, encoding: 'utf8' },
  )
  const result = JSON.parse(output)
  assert.equal(result.status, 'valid_dry_run')
  assert.equal(result.cards.length, 3)
  assert.deepEqual(
    result.cards.map((card) => [card.evidence, card.media]),
    [[16, 3], [16, 5], [16, 5]],
  )
})
