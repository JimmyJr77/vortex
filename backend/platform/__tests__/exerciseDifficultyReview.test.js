import assert from 'node:assert/strict'
import test from 'node:test'
import { reviewExerciseDifficulty } from '../exerciseDifficultyReview.js'
import { classifyProgrammingKind } from '../exerciseProgrammingKind.js'

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

test('integrated workout drills stay exercise even when DB says skill_drill', () => {
  const base = {
    programming_kind: 'skill_drill',
    phase_subrole: 'rotation_inversion_tumbling_foundations',
    primary_phase_key: 'movement_intelligence',
  }
  assert.equal(classifyProgrammingKind({ ...base, slug: 'skipping-rhythm-drill', name: 'Skipping Rhythm Drill' }), 'exercise')
  assert.equal(classifyProgrammingKind({ ...base, slug: 'cartwheel-finish-lunge', name: 'Cartwheel Finish Lunge Drill' }), 'exercise')
  assert.equal(classifyProgrammingKind({ ...base, slug: 'round-off-rebound-snap-down-to-stick', name: 'Round-Off Rebound / Snap-Down to Stick' }), 'exercise')
})

test('pure skill tumbling remains skill_drill', () => {
  assert.equal(classifyProgrammingKind({
    slug: 'cartwheel-step-over',
    name: 'Cartwheel Step-Over',
    programming_kind: 'skill_drill',
    phase_subrole: 'rotation_inversion_tumbling_foundations',
  }), 'skill_drill')
})

test('muscle-up scores high on both axes', () => {
  const d = score('muscle-up', 'Muscle-Up')
  assert.ok(d.overall >= 8)
})
