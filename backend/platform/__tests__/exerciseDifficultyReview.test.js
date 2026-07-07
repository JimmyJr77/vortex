import assert from 'node:assert/strict'
import test from 'node:test'
import { reviewExerciseDifficulty } from '../exerciseDifficultyReview.js'

function score(slug, name, extra = {}) {
  return reviewExerciseDifficulty({ slug, name, ...extra })
}

test('nordic curl scores high load, moderate technical, age from overall', () => {
  const d = score('nordic-hamstring-curl', 'Nordic Hamstring Curl')
  assert.equal(d.load, 8)
  assert.equal(d.technical, 3)
  assert.equal(d.overall, 8)
  assert.equal(d.recommended_age_min, 13)
  assert.equal(d.programming_kind, 'exercise')
})

test('nordic negative reduces load vs full ROM', () => {
  const full = score('nordic-hamstring-curl', 'Nordic Hamstring Curl')
  const neg = score('nordic-hamstring-curl-negative', 'Nordic Hamstring Curl Negative')
  assert.ok(neg.load < full.load)
  assert.equal(neg.load, 6)
})

test('assisted pull-up drops load not technical', () => {
  const full = score('pull-up', 'Pull-Up')
  const assisted = score('assisted-pull-up', 'Assisted Pull-Up')
  assert.equal(full.technical, assisted.technical)
  assert.ok(assisted.load < full.load)
  assert.equal(assisted.load, 3)
})

test('pull-up ranks above dip on load', () => {
  const pull = score('pull-up', 'Pull-Up')
  const dip = score('parallel-bar-dip', 'Parallel Bar Dip')
  assert.ok(pull.load > dip.load)
})

test('unilateral variants increase load', () => {
  const push = score('push-up', 'Push-Up')
  const archer = score('archer-push-up', 'Archer Push-Up')
  assert.equal(push.technical, archer.technical)
  assert.ok(archer.load > push.load)
})

test('ring dip adds load not technical', () => {
  const bar = score('parallel-bar-dip', 'Parallel Bar Dip')
  const ring = score('ring-dip', 'Ring Dip')
  assert.equal(bar.technical, ring.technical)
  assert.ok(ring.load > bar.load)
})

test('wall handstand push-up is exercise not skill drill', () => {
  const d = score('wall-handstand-push-up', 'Wall Handstand Push-Up', { skill_level: 'ADVANCED' })
  assert.equal(d.programming_kind, 'exercise')
  assert.ok(d.load >= 5)
})

test('wall handstand hold is skill drill', () => {
  const d = score('wall-handstand-hold', 'Wall Handstand Hold', { skill_level: 'INTERMEDIATE' })
  assert.equal(d.programming_kind, 'skill_drill')
  assert.equal(d.recommended_age_min, null)
})

test('muscle-up scores high on both axes', () => {
  const d = score('muscle-up', 'Muscle-Up')
  assert.ok(d.overall >= 8)
})
