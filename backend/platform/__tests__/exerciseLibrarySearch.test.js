import assert from 'node:assert/strict'
import test from 'node:test'

import { exerciseLiftFamilyTerms } from '../exerciseLibrarySearch.js'

test('Olympic lifting searches expand to the competition lift families', () => {
  const expected = ['snatch', 'clean', 'jerk']

  assert.deepEqual(exerciseLiftFamilyTerms('Olympic lifts'), expected)
  assert.deepEqual(exerciseLiftFamilyTerms('olympic-lifting'), expected)
  assert.deepEqual(exerciseLiftFamilyTerms(' weightlifting '), expected)
})

test('powerlifting searches expand across the three foundational lifts', () => {
  const expected = ['squat', 'bench press', 'deadlift']

  assert.deepEqual(exerciseLiftFamilyTerms('power lifting'), expected)
  assert.deepEqual(exerciseLiftFamilyTerms('Powerlifting'), expected)
  assert.deepEqual(exerciseLiftFamilyTerms('power-lifts'), expected)
})

test('ordinary exercise searches are not expanded', () => {
  assert.deepEqual(exerciseLiftFamilyTerms('box jump'), [])
})
