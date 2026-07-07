import assert from 'node:assert/strict'
import test from 'node:test'
import { parseAgeRangeFromText, parseSessionObjectiveFromText, resolveAudienceProfile } from '../ageDifficultyPolicy.js'

test('NL-style prompt resolves 6-8 strength audience', () => {
  const prompt = 'group of kids ages 6-8 focus on strength development 45 minutes'
  const ages = parseAgeRangeFromText(prompt)
  const objective = parseSessionObjectiveFromText(prompt)
  const profile = resolveAudienceProfile({
    ageMin: ages.ageMin,
    ageMax: ages.ageMax,
    sessionObjective: objective,
    prompt,
    targets: [],
  })
  assert.equal(ages.ageMin, 6)
  assert.equal(ages.ageMax, 8)
  assert.equal(objective, 'strength_priority')
  assert.equal(profile.caps.maxOverall, 5)
  assert.equal(profile.scalingCohort, 'youth_intermediate')
})
