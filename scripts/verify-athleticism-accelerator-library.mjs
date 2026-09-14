#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  accessPrepareRoutine,
  associations,
  manifest,
  manifestContents,
  newCards,
  sql,
} from './generate-athleticism-accelerator-library.mjs'
import { acceleratorExerciseKey, YOUTUBE_WATCH_URL } from './lib/accelerator-exercise-library.mjs'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const programsPath = path.join(root, 'src/coach/data/acceleratorPrograms.json')
const manifestPath = path.join(root, 'scripts/data/athleticism-accelerator-library-manifest.json')
const migrationPath = path.join(root, 'backend/migrations/818_coaching_athleticism_accelerator_library.sql')
const migrationsPath = path.join(root, 'backend/migrations')
const programs = JSON.parse(fs.readFileSync(programsPath, 'utf8'))
const historicalMigrationCorpus = fs.readdirSync(migrationsPath)
  .filter((file) => file.endsWith('.sql') && file !== path.basename(migrationPath))
  .map((file) => fs.readFileSync(path.join(migrationsPath, file), 'utf8'))
  .join('\n')
const requiredCohorts = [
  'youth_beginner',
  'youth_intermediate',
  'teen',
  'adult_beginner',
  'adult_advanced',
  'older_adult',
  'pregnancy_postpartum',
]

assert.equal(fs.readFileSync(manifestPath, 'utf8'), manifestContents, 'Accelerator library manifest is stale')
assert.equal(fs.readFileSync(migrationPath, 'utf8'), sql, 'Accelerator exercise-card migration is stale')
assert.equal(manifest.cardGuide, 'docs/exercise_card_details_for_llm.md')
assert.equal(manifest.minimumYoutubeReferences, 3)
assert.equal(manifest.associationCount, associations.length)
assert.equal(manifest.newCardCount, newCards.length)
assert.equal(manifest.reusedCardCount + manifest.newCardCount, manifest.associationCount)

const byKey = new Map(associations.map((association) => [association.exerciseKey, association]))
assert.equal(byKey.size, associations.length, 'Exercise identities must be unique')
assert.equal(new Set(associations.map((association) => association.librarySlug)).size, associations.length, 'Every identity must have a unique library card')

let prescriptionCount = 0
let preparePrescriptionCount = 0
const phaseCounts = { E: 0, S: 0, P: 0, prepare: 0 }
for (const sessions of Object.values(programs)) {
  for (const session of sessions) {
    const listed = [...(session.prepareExercises ?? []), ...(session.exercises ?? [])]
    for (const exercise of listed) {
      prescriptionCount += 1
      const phase = exercise.id?.startsWith('E') ? 'E' : exercise.id?.startsWith('S') ? 'S' : exercise.id?.startsWith('P') ? 'P' : 'prepare'
      phaseCounts[phase] += 1
      if (phase === 'prepare') preparePrescriptionCount += 1
      const association = byKey.get(acceleratorExerciseKey(exercise.name))
      assert.ok(association, `Missing exercise-card association: ${exercise.name}`)
      assert.equal(exercise.librarySlug, association.librarySlug, `Stale card link: ${exercise.name}`)
      assert.equal(association.youtubeReferences.length, 3, `YouTube reference count: ${exercise.name}`)
      assert.equal(new Set(association.youtubeReferences).size, 3, `Duplicate YouTube references: ${exercise.name}`)
      assert.ok(association.youtubeReferences.every((url) => YOUTUBE_WATCH_URL.test(url)), `Invalid YouTube URL: ${exercise.name}`)
    }
  }
}

for (const exercise of accessPrepareRoutine.exercises) {
  prescriptionCount += 1
  preparePrescriptionCount += 1
  phaseCounts.prepare += 1
  const association = byKey.get(acceleratorExerciseKey(exercise.name))
  assert.ok(association, `Missing prepare exercise-card association: ${exercise.name}`)
  assert.equal(association.phase, 'prepare_and_access', `Wrong prepare card phase: ${exercise.name}`)
  assert.equal(association.librarySlug, `accelerator-${exercise.id}`, `Unexpected prepare card slug: ${exercise.name}`)
  assert.equal(association.youtubeReferences.length, 3, `YouTube reference count: ${exercise.name}`)
  assert.equal(new Set(association.youtubeReferences).size, 3, `Duplicate YouTube references: ${exercise.name}`)
  assert.ok(association.youtubeReferences.every((url) => YOUTUBE_WATCH_URL.test(url)), `Invalid YouTube URL: ${exercise.name}`)
}

assert.equal(prescriptionCount, manifest.prescriptionCount)
assert.equal(preparePrescriptionCount, manifest.preparePrescriptionCount)

const cardSlugs = new Set(newCards.map((card) => card.slug))
for (const association of associations.filter((item) => item.source === 'accelerator_card')) {
  assert.ok(cardSlugs.has(association.librarySlug), `Missing generated card: ${association.exerciseName}`)
}
for (const association of associations.filter((item) => item.source === 'existing_library')) {
  assert.ok(
    historicalMigrationCorpus.includes(association.librarySlug),
    `Reused card is absent from historical migrations: ${association.librarySlug}`,
  )
}

for (const card of newCards) {
  assert.ok(card.slug && card.name && card.cardSummary && card.family, `Incomplete identity: ${card.name}`)
  assert.ok(card.primaryPhaseKey && card.subrole && card.slot, `Incomplete phase placement: ${card.name}`)
  assert.ok(card.movementRequirements.primary_joint_actions.length || card.movementRequirements.primary_tissues.length, `Missing movement requirements: ${card.name}`)
  assert.ok(card.coachingExecution.setup.length && card.coachingExecution.execution_steps.length, `Missing coaching execution: ${card.name}`)
  assert.ok(card.coachingExecution.coach_cues.length && card.coachingExecution.athlete_cues.length, `Missing coaching language: ${card.name}`)
  assert.ok(card.coachingExecution.common_faults.length && card.coachingExecution.quality_gate.length && card.coachingExecution.stop_signs.length, `Missing execution safeguards: ${card.name}`)
  for (const facet of ['tenets', 'methodologies', 'physiology', 'patterns', 'equipment', 'body_regions']) {
    assert.ok(card[facet].length, `Missing ${facet}: ${card.name}`)
  }
  assert.ok(card.phaseProfile.role && card.phaseProfile.fit_weight, `Missing phase profile: ${card.name}`)
  assert.ok(card.dosage.volume_unit && card.dosage.default_sets && card.dosage.default_reps && card.dosage.est_seconds_per_set, `Missing default dosage: ${card.name}`)
  assert.ok(card.dosage.default_rpe_min >= 0 && card.dosage.default_rpe_max >= card.dosage.default_rpe_min, `Invalid RPE range: ${card.name}`)
  for (const cohort of requiredCohorts) assert.ok(card.scaling[cohort], `Missing ${cohort} scaling: ${card.name}`)
  assert.ok(card.safety.risk_level && card.safety.readiness_checks.length && card.safety.contraindications.length && card.safety.common_substitutions.length, `Missing safety profile: ${card.name}`)
  assert.ok(card.doNotUseWhen.length && card.goodForSessions.length, `Missing pairing logic: ${card.name}`)
  assert.ok(card.description && card.whyItWorks && card.whyItGoesHere && card.commonMisuse, `Missing why layer: ${card.name}`)
  assert.equal(card.difficultyProfile.overall, Math.max(card.difficultyProfile.technical, card.difficultyProfile.load, card.difficultyProfile.complexity), `Difficulty overall mismatch: ${card.name}`)
  assert.equal(card.mediaReferences.length, 3, `YouTube reference count: ${card.name}`)
  assert.ok(card.mediaReferences.every((url) => YOUTUBE_WATCH_URL.test(url)), `Invalid YouTube URL: ${card.name}`)
  assert.ok(sql.includes(`('${card.slug}',`), `Migration omits ${card.slug}`)
}

console.log(`Verified ${prescriptionCount} listed prescriptions across ${Object.keys(programs).length} class programs plus the standard prepare routine.`)
console.log(`Verified ${associations.length} unique exercise-card links: ${newCards.length} new and ${manifest.reusedCardCount} reused.`)
console.log(`Verified three direct YouTube references per exercise identity.`)
console.log(`Phase prescriptions: ${phaseCounts.E} explosiveness, ${phaseCounts.S} resilience, ${phaseCounts.P} primary strength, ${phaseCounts.prepare} explicitly listed prepare.`)
