import assert from 'node:assert/strict'
import test from 'node:test'
import { sportContextMultiplier } from '../sportContextPolicy.js'

const sportIdByKey = new Map([
  ['fitness', 1],
  ['football', 2],
])

test('fitness sport penalizes football catch slug', () => {
  const exercise = { slug: 'jog-cut-catch-scan-drill', name: 'Jog-Cut-Catch-Scan Drill', sport_id: 1 }
  assert.ok(sportContextMultiplier(exercise, 'fitness', sportIdByKey) < 0.5)
})

test('fitness sport boosts universal cards', () => {
  const exercise = { slug: 'bird-dog', name: 'Bird Dog', sport_id: null }
  assert.ok(sportContextMultiplier(exercise, 'fitness', sportIdByKey) > 1)
})

test('no sport leaves multiplier at 1', () => {
  const exercise = { slug: 'bird-dog', name: 'Bird Dog', sport_id: null }
  assert.equal(sportContextMultiplier(exercise, null, sportIdByKey), 1)
})
