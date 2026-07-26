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

test('canonical research derives overall difficulty only from complexity and physical demand', () => {
  const failures = recursivelyListJson(CANONICAL_RESEARCH_DIR).flatMap((filename) => (
    inspectProposedDifficulty(JSON.parse(readFileSync(filename, 'utf8')), filename)
  ))
  assert.deepEqual(failures, [])
})
