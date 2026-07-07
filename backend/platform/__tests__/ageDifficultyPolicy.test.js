import assert from 'node:assert/strict'
import test from 'node:test'
import {
  computeOverallDifficulty,
  resolveAudienceProfile,
  resolveAgeBand,
  scoreAgeDifficultyFit,
  classifyAgeFit,
  ageFitWarnings,
  parseAgeRangeFromText,
  parseSessionObjectiveFromText,
  detectStrengthIntent,
} from '../ageDifficultyPolicy.js'

test('computeOverallDifficulty uses max of sub-scores', () => {
  assert.equal(computeOverallDifficulty(3, 7, 4), 7)
  assert.equal(computeOverallDifficulty(3, 7, 4, 5), 5)
})

test('resolveAgeBand for 6-8 returns youth_intermediate caps', () => {
  const band = resolveAgeBand(6, 8)
  assert.equal(band.maxOverall, 5)
  assert.equal(band.scalingCohort, 'youth_intermediate')
})

test('resolveAudienceProfile auto-configures strength for ages 6-8', () => {
  const profile = resolveAudienceProfile({
    ageMin: 6,
    ageMax: 8,
    prompt: 'focus on strength development',
    targets: [],
  })
  assert.equal(profile.sessionObjective, 'strength_priority')
  assert.equal(profile.caps.maxOverall, 5)
  assert.equal(profile.impliedSkillLevel, 'BEGINNER')
  assert.equal(profile.scalingCohort, 'youth_intermediate')
  assert.ok(profile.targets.some((t) => t.facetKey === 'strength'))
})

test('scoreAgeDifficultyFit soft penalty above caps', () => {
  const caps = { maxOverall: 5, maxTechnical: 5, maxLoad: 4, maxComplexity: 4 }
  assert.equal(scoreAgeDifficultyFit({ overall: 4, technical: 4, load: 3, complexity: 3 }, caps), 1)
  const moderate = scoreAgeDifficultyFit({ overall: 8, technical: 7, load: 7, complexity: 6 }, caps)
  assert.ok(moderate < 0.75)
  assert.ok(moderate >= 0.15)
  const severe = scoreAgeDifficultyFit({ overall: 10, technical: 10, load: 10, complexity: 10 }, caps)
  assert.ok(severe <= 0.35)
})

test('classifyAgeFit buckets', () => {
  const caps = { maxOverall: 5, maxTechnical: 5, maxLoad: 4, maxComplexity: 4 }
  assert.equal(classifyAgeFit({ overall: 4, technical: 4, load: 3, complexity: 3 }, caps), 'good')
  assert.equal(classifyAgeFit({ overall: 10, technical: 10, load: 10, complexity: 10 }, caps), 'over_cap')
})

test('ageFitWarnings lists breaches', () => {
  const caps = { maxOverall: 5, maxTechnical: 5, maxLoad: 4, maxComplexity: 4 }
  const warnings = ageFitWarnings({ overall: 6, technical: 4, load: 5, complexity: 3 }, caps, 'Push-up')
  assert.ok(warnings.some((w) => w.includes('overall')))
  assert.ok(warnings.some((w) => w.includes('load')))
})

test('parseAgeRangeFromText', () => {
  assert.deepEqual(parseAgeRangeFromText('kids ages 6-8 strength'), { ageMin: 6, ageMax: 8 })
  assert.deepEqual(parseAgeRangeFromText('6 year old group'), { ageMin: 6, ageMax: 6 })
})

test('parseSessionObjectiveFromText strength', () => {
  assert.equal(parseSessionObjectiveFromText('strength development session'), 'strength_priority')
})

test('detectStrengthIntent', () => {
  assert.equal(detectStrengthIntent({ sessionObjective: 'strength_priority' }), true)
  assert.equal(detectStrengthIntent({ prompt: 'get stronger with calisthenics' }), true)
  assert.equal(detectStrengthIntent({ targets: [{ facetKey: 'speed' }] }), false)
})
