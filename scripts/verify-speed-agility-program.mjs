import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const programs = JSON.parse(readFileSync(new URL('../src/coach/data/acceleratorPrograms.json', import.meta.url), 'utf8'))
const plan = programs['speed-agility']
const sources = { sprinting: 'sprinting', 'agility-mobility': 'agility_directional', 'agility-reactive': 'agility_reactive_anticipation' }
const draft = readFileSync(new URL('../workout_plan/speed_and_agility/curriculum.md', import.meta.url), 'utf8')
assert.equal(plan.length, 36)
assert.deepEqual(plan.map(({ n }) => n), Array.from({ length: 36 }, (_, index) => index + 1))
assert.equal([...draft.matchAll(/^### Class \d+:/gm)].length, 36)
const combinations = new Set()
for (const [index, session] of plan.entries()) {
  const stage = Math.floor(index / 3) + 1
  assert.equal(session.stage, stage)
  assert.ok(draft.includes(`### Class ${session.n}: ${session.title}`))
  assert.equal(session.exercises.length, 14)
  for (const [phase, count] of [['E', 6], ['S', 2], ['P', 6]]) {
    const rows = session.exercises.filter(({ id }) => id.startsWith(phase))
    assert.deepEqual(rows.map(({ id }) => id), Array.from({ length: count }, (_, index) => `${phase}${index + 1}`))
    if (phase !== 'S') for (const source of Object.keys(sources)) assert.equal(rows.filter(({ sourceProgram }) => sourceProgram === source).length, 2, `Class ${session.n} ${phase}: two from ${source}`)
    assert.equal(new Set(rows.map(({ name }) => name)).size, count, `Class ${session.n}: no duplicate exercise names within ${phase}`)
  }
  for (const [phase, families] of [['P', [/split squat/i, /romanian deadlift/i, /lateral lunge/i]], ['S', [/short-foot|foot doming/i, /lateral step-down/i]]]) {
    for (const family of families) {
      assert.ok(session.exercises.filter(({ id, name }) => id.startsWith(phase) && family.test(name)).length <= 1, `Class ${session.n}: avoid redundant ${family} selections with different names`)
    }
  }
  // These are the actual live-response anchors in the reviewed source courses:
  // Mirror Shuffle (Class 1 E2), then the live opponent/read task in E1 of 2–12.
  assert.ok(session.exercises.some(({ id, sourceProgram, sourceExerciseId }) => id.startsWith('E') && sourceProgram === 'agility-reactive' && sourceExerciseId === (stage === 1 ? 'E2' : 'E1')), `Class ${session.n}: true reactive task`)
  assert.equal(session.exercises[0].sourceProgram, 'sprinting')
  assert.equal(session.exercises[0].sourceExerciseId, 'E1', `Class ${session.n}: sprint mechanics while fresh`)
  for (const exercise of session.exercises) {
    const { sourceProgram, sourceClass, sourceExerciseId, sourceTrack, id, ...prescription } = exercise
    assert.ok(sources[sourceProgram])
    assert.equal(sourceClass, stage)
    const source = programs[sourceProgram][stage - 1].exercises.find(({ id }) => id === sourceExerciseId)
    assert.ok(source, `Class ${session.n} ${id}: source exercise exists`)
    const { id: originalId, ...originalPrescription } = source
    assert.equal(originalId, sourceExerciseId)
    assert.deepEqual(prescription, originalPrescription, `Class ${session.n} ${id}: exact original dose, recovery and instructions`)
    const link = `../${sources[sourceProgram]}/classes/class_${String(stage).padStart(2, '0')}.md`
    assert.ok(draft.includes(`[${sourceTrack} · Class ${stage} · ${sourceExerciseId}](${link})`))
  }
  combinations.add(session.exercises.map(({ sourceProgram, sourceClass, sourceExerciseId }) => `${sourceProgram}/${sourceClass}/${sourceExerciseId}`).join(','))
}
assert.equal(combinations.size, 36, 'Every integrated class has a distinct selection of existing prescriptions')
console.log('Verified 36 integrated classes: every class has sprinting, mobile agility and a live reactive anchor; 6/2/6 structure; original prescriptions and source links retained.')
